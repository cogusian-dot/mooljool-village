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
    ctl.update();
    r.render(scene, cam);
  }
  MV = {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
    setDrop(v) { dropTarget = v ? 1 : 0; },
    setCut(v) { cutT = v ? 1 : 0; if (v) { ctl.autoRotate = false; } },
    view(n) { const p = n === 'front' ? [0, 1.3, 5.2] : n === 'top' ? [0.01, 5.6, 0.6] : [3.4, 2.3, 4.6]; tweenCam(p); },
  };
  function tweenCam(p) {
    const from = cam.position.clone(), to = new THREE.Vector3(...p); let k = 0;
    ctl.autoRotate = false;
    const step = () => { k = Math.min(1, k + 0.04); cam.position.lerpVectors(from, to, ease.inOut(k)); if (k < 1) requestAnimationFrame(step); };
    step();
  }
  $$('[data-mv]').forEach(b => b.onclick = () => {
    SFX.play('click');
    const a = b.dataset.mv;
    if (a === 'drop') { const on = !b.classList.contains('on'); b.classList.toggle('on', on); MV.setDrop(on); SFX.play(on ? 'rise' : 'absorb'); $('#mvState').textContent = on ? '흙이 말랐어요 · 물방울이 쏙' : '수분이 충분해요 · 물방울이 숨었어요'; }
    if (a === 'cut') { const on = !b.classList.contains('on'); b.classList.toggle('on', on); MV.setCut(on); if (on) MV.view('front'); }
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

