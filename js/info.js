// 물줄때 마을 · 영상·땀땀이 알아보기·앱 화면
// 원본 단일 파일 index.html 3600–3751행에서 옮김
// 물줄때 마을 — 땀땀이 알아보기 / 앱 알아보기
let MV = null; // 모델 뷰어

function playVideo(src, caption, onEnd) {
  const ov = $('#videoOverlay'), v = $('#video');
  SFX.pauseBgm(true);
  $('#videoCap').textContent = caption;
  ov.classList.add('show');
  let triedData = false, finished = false;
  const done = () => { if (finished) return; finished = true; v.onended = null; v.onerror = null; v.pause(); ov.classList.remove('show'); onEnd && onEnd(); };
  const start = () => { const p = v.play(); if (p && p.catch) p.catch(() => { v.muted = true; const q = v.play(); if (q && q.catch) q.catch(() => {}); }); };
  v.onended = done;
  v.onerror = () => { // 영상을 못 여는 환경이면 다른 방식으로 한 번 더, 그래도 안 되면 다음 화면으로
    if (!triedData && window.ASSET_B64 && window.ASSET_B64[src]) { triedData = true; v.src = assetURL(src, true); start(); } else done();
  };
  $('#videoSkip').onclick = () => { SFX.play('click'); done(); };
  v.muted = false; v.src = assetURL(src); v.currentTime = 0;
  start();
}

function openTtamiInfo() {
  SFX.play('click');
  $('#complete').classList.remove('show');
  G.render3D = false;
  playVideo('assets/video/package.mp4', '물줄때 패키지', () => {
    hydrateAssets(document);
    $('#info').classList.add('show'); $('#info').scrollTop = 0;
    $('#appView').classList.remove('show');
    initModelViewer(); MV && MV.start();
    SFX.play('open');
  });
}
function closeInfo() {
  $('#info').classList.remove('show');
  MV && MV.stop();
  $$('#info video').forEach(v => v.pause());
}
function openFigmaApp() {
  let w = null;
  try { w = window.open(APP_LINK.url, '_blank'); if (w) w.opener = null; } catch (e) { w = null; }
  $('#appMsg').textContent = w ? '새 창에서 앱이 열렸어요. 둘러본 뒤 이 창으로 돌아오세요.' : '아래 버튼을 누르면 새 창에서 앱이 열려요.';
  return w;
}
function showAppFrame(src) {
  const f = $('#appFrame');
  if (f.dataset.src !== src) { f.dataset.src = src; f.src = src; }
  $('#appView').classList.add('frame');
}
function openApp() {
  SFX.play('click');
  MV && MV.stop();
  $$('#info video').forEach(v => v.pause());
  playVideo('assets/video/app.mp4', '물줄때 앱', () => {
    const v = $('#appView');
    v.classList.remove('frame'); v.classList.add('show');
    if (APP_LINK.embed) showAppFrame(APP_LINK.url); else openFigmaApp();
    SFX.play('open');
  });
}
function closeApp() { $('#appView').classList.remove('show'); }
function backToInfo() { SFX.play('click'); closeApp(); hydrateAssets(document); $('#info').classList.add('show'); MV && MV.start(); }

// ── 3D 모델 뷰어 (실제 조립품 CAD) ──
function initModelViewer() {
  if (MV) return;
  const canvas = $('#mvCanvas');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
  r.localClippingEnabled = true; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100); cam.position.set(3.4, 2.3, 4.6);
  scene.add(new THREE.HemisphereLight('#FFF6EA', '#C9B8A8', 0.9));
  const key = new THREE.DirectionalLight('#FFFFFF', 1.2); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3; scene.add(key);
  const rim = new THREE.DirectionalLight('#BFE3FF', 0.5); rim.position.set(-4, 3, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.ShadowMaterial({ opacity: 0.18 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const model = makeTtami(10, { viewer: true }); scene.add(model);
  const u = model.userData;
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 2);
  model.traverse(o => { if (o.isMesh) { const k = partKind(o.name); if (['top', 'bottom', 'mid', 'eye'].includes(k)) { o.material = o.material.clone(); o.material.clippingPlanes = [plane]; } } });
  const ctl = new THREE.OrbitControls(cam, canvas);
  ctl.target.set(0, 0.85, 0); ctl.enableDamping = true; ctl.enablePan = false; ctl.minDistance = 3; ctl.maxDistance = 9;
  ctl.autoRotate = true; ctl.autoRotateSpeed = 1.2;
  ctl.addEventListener('start', () => { ctl.autoRotate = false; });

  // ── 물받이통: 물 주기 → 서랍 열기 → 고인 물 버리기 → 서랍 닫기 ──
  const dw = u.drawer, bottomMesh = dw && dw.slide.parent;
  const fx = new THREE.Group(); if (bottomMesh) bottomMesh.add(fx); // 하단부 좌표(m)에서 물방울을 움직여요
  let holeL = new THREE.Vector3(-0.03, 0.086, 0.01); // 흙 구멍 위치(하단부 좌표)
  if (bottomMesh) { TTAMI_SRC.updateMatrixWorld(true); const sb = TTAMI_SRC.getObjectByName(bottomMesh.name); if (sb) holeL = TTAMI_INFO.hole.clone().applyMatrix4(sb.matrixWorld.clone().invert()); }
  const dropGeo = new THREE.SphereGeometry(0.0022, 10, 8).scale(1, 1.5, 1);
  const dropMat = new THREE.MeshStandardMaterial({ color: '#4FB0F5', roughness: 0.15, transparent: true, opacity: 0.9 });
  const drops = [];
  function spawnDrop(p, v, stopY) {
    let d = drops.find(o => !o.visible);
    if (!d) { d = new THREE.Mesh(dropGeo, dropMat); fx.add(d); drops.push(d); }
    d.visible = true; d.position.copy(p); d.userData.v = v; d.userData.stop = stopY; return d;
  }
  const TL = { rain: [0, 2.4], fill: [0.8, 3.0], open: [3.0, 4.1], tiltIn: [4.4, 5.2], pour: [5.0, 6.6], tiltOut: [6.7, 7.4], close: [7.6, 8.6], end: 9.0 };
  const seg = (a, x) => Math.min(1, Math.max(0, (x - a[0]) / (a[1] - a[0])));
  let tray = null, level = TRAY.waterEmpty;
  function setLevel(h) {
    if (!dw || !dw.water || Math.abs(h - level) < 0.05) return;
    level = h; dw.water.visible = h > TRAY.waterEmpty + 0.1;
    dw.water.geometry.dispose(); dw.water.geometry = makeTrayWaterGeometry(h);
  }
  const trayMsg = (m) => { $('#mvState').textContent = m; };
  function updateTray(dt) {
    for (const d of drops) if (d.visible) {
      d.userData.v.y -= 0.9 * dt; d.position.addScaledVector(d.userData.v, dt);
      if (d.position.y < d.userData.stop) d.visible = false;
    }
    if (!tray || !dw) return;
    const k = (tray.t += dt), once = (name, fn) => { if (!tray.done[name]) { tray.done[name] = true; fn(); } };
    if (k < TL.rain[1]) { // 화분 위로 물 뿌리기
      tray.acc += dt * 45;
      while (tray.acc > 1) {
        tray.acc--; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.035;
        spawnDrop(new THREE.Vector3(holeL.x + Math.cos(a) * r, holeL.y + 0.15 + Math.random() * 0.05, holeL.z + Math.sin(a) * r), new THREE.Vector3(0, -0.25, 0), holeL.y + 0.004);
      }
    }
    setLevel(TRAY.waterEmpty + (TRAY.waterFull - TRAY.waterEmpty) * ease.inOut(seg(TL.fill, k)) * (1 - seg(TL.pour, k)));
    dw.slide.position.x = -0.11 * ease.inOut(seg(TL.open, k)) * (1 - ease.inOut(seg(TL.close, k)));
    dw.tilt.rotation.z = 0.5 * ease.inOut(seg(TL.tiltIn, k)) * (1 - ease.inOut(seg(TL.tiltOut, k)));
    if (k > TL.pour[0] + 0.2 && k < TL.pour[1]) { // 앞쪽 테두리로 물이 쏟아져요
      tray.pacc += dt * 70;
      while (tray.pacc > 1) {
        tray.pacc--; const b = (Math.random() - 0.5) * 0.9, R = TRAY.outer(TRAY.top) / 1000 - 0.002;
        const p = dw.body.localToWorld(new THREE.Vector3(-R * Math.cos(b), -0.002, R * Math.sin(b))); fx.worldToLocal(p);
        spawnDrop(p, new THREE.Vector3(-0.1 - Math.random() * 0.06, 0.01, (Math.random() - 0.5) * 0.04), -0.05);
      }
    }
    if (k >= TL.open[0]) once('open', () => { SFX.play('open'); trayMsg('물받이통에 물이 고였어요 · 서랍을 열어요'); });
    if (k >= TL.tiltIn[0]) once('pour', () => { SFX.play('splash'); trayMsg('고인 물을 버려요'); });
    if (k >= TL.close[0]) once('close', () => { SFX.play('whoosh'); trayMsg('깨끗해진 서랍을 다시 쏙'); });
    if (k >= TL.close[1]) once('shut', () => SFX.play('tok'));
    if (k >= TL.end) {
      tray = null; setLevel(TRAY.waterEmpty); dw.slide.position.x = 0; dw.tilt.rotation.z = 0;
      $('[data-mv="tray"]').classList.remove('on'); trayMsg('물받이통을 비웠어요 · 다시 눌러 볼까요?');
    }
  }
  function playTray() {
    if (tray || !dw) return;
    tray = { t: 0, acc: 0, pacc: 0, done: {} };
    $('[data-mv="tray"]').classList.add('on');
    trayMsg('화분에 물을 줘요'); SFX.play('splash');
    const a = 140 * Math.PI / 180;
    tweenCam([Math.cos(a) * 6.4 - 0.6, 3.0, Math.sin(a) * 6.4], [-0.75, 0.4, 0]);
  }

  let raf = null, last = performance.now(), cut = 0, cutT = 0, dropT = 1, dropTarget = 1, t = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * r.getPixelRatio()) || canvas.height !== Math.floor(h * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    resize();
    cut += (cutT - cut) * Math.min(1, dt * 4);
    plane.constant = 2 - cut * 2.0;
    dropT += (dropTarget - dropT) * Math.min(1, dt * 3.5);
    if (u.drop) u.drop.position.y = u.dropBase.y + TTAMI_INFO.dropHideY * (1 - dropT) + (dropT > 0.95 ? Math.sin(t * 4) * 0.0015 : 0);
    updateTray(dt);
    ctl.update();
    r.render(scene, cam);
  }
  MV = {
    playTray,
    stepTray(sec) { for (let i = 0; i < sec / 0.05; i++) updateTray(0.05); r.render(scene, cam); }, // 점검용: 시간 빨리 감기
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
    setDrop(v) { dropTarget = v ? 1 : 0; },
    setCut(v) { cutT = v ? 1 : 0; if (v) { ctl.autoRotate = false; } },
    view(n) { const p = n === 'front' ? [0, 1.3, 5.2] : n === 'top' ? [0.01, 5.6, 0.6] : [3.4, 2.3, 4.6]; tweenCam(p); },
  };
  function tweenCam(p, target = [0, 0.85, 0]) {
    const from = cam.position.clone(), to = new THREE.Vector3(...p); let k = 0;
    const tFrom = ctl.target.clone(), tTo = new THREE.Vector3(...target);
    ctl.autoRotate = false;
    const step = () => { k = Math.min(1, k + 0.04); const e = ease.inOut(k); cam.position.lerpVectors(from, to, e); ctl.target.lerpVectors(tFrom, tTo, e); if (k < 1) requestAnimationFrame(step); };
    step();
  }
  $$('[data-mv]').forEach(b => b.onclick = () => {
    SFX.play('click');
    const a = b.dataset.mv;
    if (a === 'drop') { const on = !b.classList.contains('on'); b.classList.toggle('on', on); MV.setDrop(on); SFX.play(on ? 'rise' : 'absorb'); $('#mvState').textContent = on ? '흙이 말랐어요 · 물방울이 쏙' : '수분이 충분해요 · 물방울이 숨었어요'; }
    if (a === 'cut') { const on = !b.classList.contains('on'); b.classList.toggle('on', on); MV.setCut(on); if (on) MV.view('front'); }
    if (a === 'tray') MV.playTray();
    if (a === 'front' || a === 'top' || a === 'iso') MV.view(a);
  });
}

// ── 발표 자료 슬라이드 ──
let slideIdx = 0;
function buildInfo() {
  const N = 21;
  const strip = $('#slideStrip');
  strip.innerHTML = Array.from({ length: N }, (_, i) => `<img data-a="assets/slides/s-${String(i + 1).padStart(2, '0')}.jpg" alt="발표 자료 ${i + 1}쪽">`).join('');
  const show = (i) => { slideIdx = (i + N) % N; strip.style.transform = `translateX(${-slideIdx * 100}%)`; $('#slideNum').textContent = `${slideIdx + 1} / ${N}`; };
  $('#slidePrev').onclick = () => { SFX.play('click'); show(slideIdx - 1); };
  $('#slideNext').onclick = () => { SFX.play('click'); show(slideIdx + 1); };
  show(0);
  // 사진 크게 보기
  $$('#info [data-zoom]').forEach(im => im.onclick = () => { SFX.play('open'); $('#lbImg').src = im.dataset.zoom || im.src; $('#lightbox').classList.add('show'); });
  $('#lightbox').onclick = () => { SFX.play('click'); $('#lightbox').classList.remove('show'); };
  $('#infoApp').onclick = openApp;
  $('#infoReplay').onclick = replay;
  $('#appBack').onclick = backToInfo;
  hydrateAssets($('#appView'));
  $('#appUrl').textContent = APP_LINK.url.split('?')[0];
  if (window.WEB_BUILD) $('#appOffline').style.display = 'none';
  $('#appOpen').onclick = () => { SFX.play('click'); openFigmaApp(); };
  $('#appOffline').onclick = () => { SFX.play('click'); showAppFrame('app/mooljoolday_app.html'); };
  $('#appLandingBack').onclick = () => { SFX.play('click'); $('#appView').classList.remove('frame'); };
  $('#appReplay').onclick = replay;
  $('#infoClose').onclick = replay;
}
window.addEventListener('DOMContentLoaded', buildInfo);

