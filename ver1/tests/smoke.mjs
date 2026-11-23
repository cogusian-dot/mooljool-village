// 물줄때 마을 스모크 테스트 (Playwright)
// 사용법:  node tests/smoke.mjs            (프로젝트 루트를 서빙)
//          node tests/smoke.mjs --root /tmp/dummy   (다른 폴더를 서빙)
// 결과: tests/out/*.png 스크린샷 + 콘솔에 JSON 요약. 문제 있으면 exit code 1.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/opt/npm-tools/node_modules/playwright',
    '/usr/local/lib/node_modules_global/playwright',
    '/usr/local/lib/node_modules/playwright',
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* try next */ }
  }
  throw new Error('playwright 모듈을 찾을 수 없습니다 (playwright install 은 실행하지 마세요).');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argRootIdx = process.argv.indexOf('--root');
const ROOT = path.resolve(argRootIdx > -1 && process.argv[argRootIdx + 1]
  ? process.argv[argRootIdx + 1]
  : path.join(__dirname, '..'));
const OUT = path.join(__dirname, 'out');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('로컬 서버가 시작되지 않았습니다: ' + url);
}

const summary = { root: ROOT, externalRequests: [], consoleErrors: [], pageErrors: [], screenshots: [], notes: [] };

function isLocal(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
}
function isFigma(host) {
  return host === 'figma.com' || host.endsWith('.figma.com');
}

async function runViewport(browser, base, label, contextOpts) {
  const context = await browser.newContext({ ...contextOpts, deviceScaleFactor: 1 });
  const page = await context.newPage();

  await page.route('**/*', route => {
    const url = route.request().url();
    let host = '';
    try { host = new URL(url).hostname; } catch { /* data:, blob: etc. */ }
    if (!host || isLocal(host)) return route.continue();
    summary.externalRequests.push({ viewport: label, url, figma: isFigma(host) });
    return route.abort(); // 외부 요청은 전부 차단(피그마도 기록만 하고 차단)
  });
  page.on('console', msg => {
    if (msg.type() === 'error') summary.consoleErrors.push({ viewport: label, text: msg.text() });
  });
  page.on('pageerror', err => {
    summary.pageErrors.push({ viewport: label, text: String(err && err.stack || err) });
  });

  const shot = async name => {
    const file = path.join(OUT, `${label}-${name}.png`);
    try {
      await page.screenshot({ path: file });
      summary.screenshots.push(path.relative(path.join(__dirname, '..'), file));
    } catch (e) {
      summary.notes.push(`${label}: screenshot ${name} 실패 - ${e.message}`);
    }
  };

  try {
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    try {
      await page.waitForSelector('#loading.hide', { state: 'attached', timeout: 20000 });
    } catch {
      summary.notes.push(`${label}: #loading 에 'hide' 클래스가 20초 안에 붙지 않음`);
    }
    await shot('01-title');

    const start = page.locator('#titleStart');
    if (await start.count() > 0) {
      try {
        await start.first().click({ timeout: 5000 });
        await page.waitForTimeout(1000);
        await shot('02-after-start');
      } catch (e) {
        summary.notes.push(`${label}: #titleStart 클릭 실패 - ${e.message}`);
      }
    } else {
      summary.notes.push(`${label}: #titleStart 없음`);
    }

    const skip = page.locator('#storySkip');
    if (await skip.count() > 0 && await skip.first().isVisible()) {
      try {
        await skip.first().click({ timeout: 5000 });
        await page.waitForTimeout(1000);
        await shot('03-after-skip');
      } catch (e) {
        summary.notes.push(`${label}: #storySkip 클릭 실패 - ${e.message}`);
      }
    } else {
      summary.notes.push(`${label}: #storySkip 보이지 않음 (건너뜀)`);
    }
  } finally {
    await context.close();
  }
}

let server;
let browser;
let exitCode = 0;
try {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    summary.notes.push('경고: ' + ROOT + ' 에 index.html 이 없습니다.');
  }
  fs.mkdirSync(OUT, { recursive: true });

  const port = await freePort();
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: ROOT, stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  await waitForServer(base + '/');

  const { chromium, devices } = loadPlaywright();
  browser = await chromium.launch();

  await runViewport(browser, base, 'desktop', { viewport: { width: 1280, height: 800 } });
  const iphone = { ...devices['iPhone 13 landscape'] };
  delete iphone.defaultBrowserType;
  await runViewport(browser, base, 'iphone', iphone);

  const nonFigma = summary.externalRequests.filter(r => !r.figma);
  if (summary.pageErrors.length > 0 || nonFigma.length > 0) exitCode = 1;
} catch (e) {
  summary.notes.push('치명적 오류: ' + (e && e.stack || e));
  exitCode = 1;
} finally {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  if (server) { try { server.kill('SIGTERM'); } catch { /* ignore */ } }
}

console.log(JSON.stringify(summary, null, 2));
process.exit(exitCode);
