// 물줄때 마을 · 렌더러 & 마을 만들기
// 원본 단일 파일 index.html 1933–2347행에서 옮김
// 물줄때 마을 — 렌더러 & 마을 만들기
const W = {
  renderer: null, scene: null, camera: null, sun: null,
  colliders: [], refs: {}, clouds: [], ripples: [], time: 0,
  BOUND: 31,
};

function initRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const LOWQ = /lowq|fast/.test(location.search), FAST = /fast/.test(location.search);
  const MOBILE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; // 휴대폰·태블릿은 조금 가볍게
  r.setPixelRatio(FAST ? 0.3 : LOWQ ? 0.5 : Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2));
  r.setSize(window.innerWidth, window.innerHeight, false);
  r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = !FAST; r.shadowMap.type = THREE.PCFSoftShadowMap;
  W.renderer = r;
  const s = new THREE.Scene();
  s.fog = new THREE.Fog('#CFEFFF', 48, 100);
  W.scene = s;
  const cam = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.3, 220);
  cam.position.set(0, 12, 18); W.camera = cam;
  // 세로 화면에서는 시야를 넓혀서 마을이 좁아 보이지 않게
  window.fitCamera = () => { cam.aspect = window.innerWidth / window.innerHeight; cam.fov = cam.aspect < 0.8 ? 58 : cam.aspect < 1.25 ? 47 : 38; cam.updateProjectionMatrix(); };
  fitCamera();

  const hemi = new THREE.HemisphereLight('#FFF6E6', '#9CC97A', 0.7); s.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF1D8', 1.12);
  sun.castShadow = true;
  const SM = LOWQ ? 512 : MOBILE ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM);
  const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  s.add(sun); s.add(sun.target); W.sun = sun;
  const fill = new THREE.DirectionalLight('#DDEBFF', 0.25); fill.position.set(10, 8, 20); s.add(fill);

  window.addEventListener('resize', () => {
    r.setSize(window.innerWidth, window.innerHeight, false);
    fitCamera();
  });
}

// 화면 좌표로 변환 (휘어진 지평선 반영)
const _v = new THREE.Vector3();
function worldToScreen(p, out) {
  const cam = W.camera;
  _v.copy(p).applyMatrix4(cam.matrixWorldInverse);
  const cf = Math.max(0, -_v.z - U_D0.value); _v.y -= U_CURVE.value * cf * cf;
  const behind = _v.z > 0;
  _v.applyMatrix4(cam.projectionMatrix);
  out.x = (_v.x * 0.5 + 0.5) * window.innerWidth;
  out.y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
  out.visible = !behind && Math.abs(_v.x) < 1.3 && Math.abs(_v.y) < 1.3;
  return out;
}

function collider(x, z, r) { const c = { x, z, r }; W.colliders.push(c); return c; }

// ── 땅 텍스처 ──
function groundTexture() {
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const P = (x, z) => [(x + 64) * 16, (z + 64) * 16];
  g.fillStyle = '#96CF60'; g.fillRect(0, 0, S, S);
  const R = rnd(42);
  for (let i = 0; i < 900; i++) {
    const x = R() * S, y = R() * S, r = 20 + R() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const col = R() < 0.5 ? '120,190,80' : '172,222,110';
    gr.addColorStop(0, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 길
  const paths = [
    [[0, 0], [-6, -3], [-11, -6], [-14, -7]],
    [[0, 0], [6, -4], [11, -7], [13, -8]],
    [[0, 0], [-5, 5], [-9, 9], [-12, 10]],
    [[0, 0], [5, 5], [9, 9], [11, 10]],
    [[0, 0], [0.5, -7], [-0.5, -12], [0, -17]],
    [[0, 0], [-8, -1], [-16, 0], [-24, 1]],
    [[0, 0], [9, 0], [17, -1], [24, 0]],
    [[0, 0], [0, 8], [0, 16]],
    [[0, -17], [-7, -16.5], [-13, -13], [-17.5, -10.6], [-20.6, -10.4]],
    [[-14, -7], [-17.5, -9.6], [-20.6, -10.4]],
  ];
  const stroke = (w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of paths) { g.beginPath(); p.forEach((q, i) => { const [x, y] = P(q[0], q[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  };
  stroke(58, 'rgba(201,170,110,0.55)'); stroke(44, '#E8CF97');
  // 광장
  const pl = (r, col) => { const [x, y] = P(0, 0); g.fillStyle = col; g.beginPath(); g.arc(x, y, r * 16, 0, 7); g.fill(); };
  pl(8.2, 'rgba(201,170,110,0.55)'); pl(7.6, '#EDD7A2'); pl(5.0, '#F2DFB0');
  // 광장 돌 무늬
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; const [x, y] = P(Math.cos(a) * 6.3, Math.sin(a) * 6.3); g.fillStyle = 'rgba(220,190,130,0.9)'; g.beginPath(); g.ellipse(x, y, 16, 11, a, 0, 7); g.fill(); }
  // 연못 모래
  { const [x, y] = P(15, 11); g.fillStyle = '#E6D29C'; g.beginPath(); g.ellipse(x, y, 8.3 * 16, 6.3 * 16, 0.15, 0, 7); g.fill(); }
  // 언덕 아래 흙
  { const [x, y] = P(-20.8, -10.3); g.fillStyle = 'rgba(232,207,151,0.95)'; g.beginPath(); g.ellipse(x, y, 3.0 * 16, 2.2 * 16, -0.3, 0, 7); g.fill(); }
  // 바위 터
  { const [x, y] = P(1, -20); g.fillStyle = 'rgba(190,175,150,0.6)'; g.beginPath(); g.ellipse(x, y, 7 * 16, 4.5 * 16, 0, 0, 7); g.fill(); }
  // 작은 꽃·클로버 점
  for (let i = 0; i < 1400; i++) {
    const x = R() * S, y = R() * S;
    g.fillStyle = R() < 0.82 ? 'rgba(110,175,70,0.6)' : ['#FFFFFF', '#FFE36E', '#FFB3C7'][(R() * 3) | 0];
    g.beginPath(); g.arc(x, y, 2 + R() * 3, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}

// ── 장식들 ──
function makeTree(parent, x, z, s = 1, kind = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  const trunk = add(g, cyl(0.32, 0.48, 2.4, 12), M('#9A6A42'), 0, 1.2, 0);
  const greens = ['#5DB34F', '#6CC25A', '#4FA548', '#7CCB5E'];
  const R = rnd((x * 31 + z * 17) | 0 + 99);
  if (kind === 1) { // 원뿔형
    for (let i = 0; i < 3; i++) add(g, new THREE.ConeGeometry(1.6 - i * 0.35, 1.6, 14), M(greens[(i + 1) % 4]), 0, 2.4 + i * 0.9, 0);
  } else {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + R(), r = i === 0 ? 0 : 0.85;
      ell(g, M(greens[i % 4]), 1.1 + R() * 0.3, 0.95 + R() * 0.2, 1.1 + R() * 0.3, Math.cos(a) * r, 3.2 + (i === 0 ? 0.6 : R() * 0.4), Math.sin(a) * r, 18);
    }
  }
  return g;
}
function makeMushroomHouse(parent, x, z, capCol, spotCol, rotY = 0, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; g.scale.setScalar(s); parent.add(g);
  const V2 = (pts) => pts.map(q => new THREE.Vector2(q[0], q[1]));
  const lathe = (pts, seg, rad = 40) => new THREE.LatheGeometry(new THREE.SplineCurve(V2(pts)).getPoints(seg), rad);
  const wall = M('#F6DFA8', { rim: 0.1 }), wood = M('#C9773A'), frame = M('#CF9060'), capM = M(capCol, { rim: 0.14 }), spotM = M('#F5E1B5');
  // 통통한 몸통
  add(g, lathe([[1.7, 0], [1.93, 0.45], [1.92, 1.1], [1.68, 1.9], [1.4, 2.5], [1.2, 2.9]], 24), wall);
  // 도톰한 갓
  const capCurve = new THREE.SplineCurve(V2([[2.35, 2.02], [2.62, 2.12], [2.7, 2.42], [2.52, 2.92], [2.02, 3.75], [1.32, 4.45], [0.6, 4.86], [0.01, 4.96]]));
  add(g, new THREE.LatheGeometry(capCurve.getPoints(36), 48), capM);
  add(g, lathe([[0.01, 2.7], [1.4, 2.5], [2.35, 2.02]], 8), capM);
  const spot = (a, u, k) => {
    const p2 = capCurve.getPoint(u), t2 = capCurve.getTangent(u);
    const n = new THREE.Vector3(Math.cos(a) * t2.y, -t2.x, Math.sin(a) * t2.y).normalize();
    const m = ell(g, spotM, 0.68 * k, 0.46 * k, 0.09, Math.cos(a) * p2.x - n.x * 0.03, p2.y - n.y * 0.03, Math.sin(a) * p2.x - n.z * 0.03, 18);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  };
  const F = Math.PI / 2;
  spot(F + 0.75, 0.6, 1.0); spot(F - 0.45, 0.8, 0.5); spot(F - 1.0, 0.5, 0.8); spot(-F + 0.4, 0.55, 0.9); spot(-F - 0.9, 0.7, 0.7); spot(Math.PI + 0.15, 0.45, 0.75);
  // 아치 문
  const band = new THREE.Shape();
  band.moveTo(-0.81, 0); band.lineTo(-0.81, 1.19); band.absarc(0, 1.19, 0.81, Math.PI, 0, true); band.lineTo(0.81, 0);
  band.lineTo(0.61, 0); band.lineTo(0.61, 1.19); band.absarc(0, 1.19, 0.61, 0, Math.PI, false); band.lineTo(-0.61, 0); band.closePath();
  add(g, new THREE.ExtrudeGeometry(band, { depth: 0.2, bevelEnabled: true, bevelSize: 0.045, bevelThickness: 0.045, bevelSegments: 3, curveSegments: 14 }), frame, 0, 0, 1.86);
  const door = new THREE.Shape();
  door.moveTo(-0.62, 0); door.lineTo(0.62, 0); door.lineTo(0.62, 1.19); door.absarc(0, 1.19, 0.62, 0, Math.PI, false); door.closePath();
  add(g, new THREE.ExtrudeGeometry(door, { depth: 0.1, bevelEnabled: false, curveSegments: 14 }), wood, 0, 0, 1.9);
  for (const dx of [-0.21, 0.21]) add(g, roundedBox(0.03, 1.55, 0.03, 0.012, 1), M('#A85F2C'), dx, 0.8, 2.005);
  ell(g, M('#F2C04A'), 0.09, 0.09, 0.07, 0.4, 0.78, 2.04, 12);
  add(g, roundedBox(2.0, 0.18, 0.7, 0.08, 3), frame, 0, 0.09, 2.3);
  ell(g, M('#DCC8A8'), 0.5, 0.06, 0.34, 0.25, 0.04, 3.1, 14); ell(g, M('#DCC8A8'), 0.42, 0.06, 0.3, -0.3, 0.04, 3.75, 14);
  // 둥근 창문 (불 켜진)
  const wa = F + 0.82, wn = new THREE.Vector3(Math.cos(wa), 0.12, Math.sin(wa)).normalize();
  const win = new THREE.Group(); win.position.set(Math.cos(wa) * 1.84, 1.42, Math.sin(wa) * 1.84); win.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wn); g.add(win);
  add(win, new THREE.TorusGeometry(0.36, 0.1, 10, 28), wood, 0, 0, 0.03);
  add(win, cyl(0.36, 0.36, 0.08, 24), M('#FFD34D', { em: '#FFC21A', ei: 0.7 }), 0, 0, 0).rotation.x = Math.PI / 2;
  add(win, roundedBox(0.72, 0.065, 0.07, 0.03, 1), wood, 0, 0, 0.06); add(win, roundedBox(0.065, 0.72, 0.07, 0.03, 1), wood, 0, 0, 0.06);
  // 덤불 · 꼬마 버섯
  const bush = M('#8FA545');
  ell(g, bush, 0.55, 0.5, 0.5, -1.75, 0.35, 1.5, 14); ell(g, bush, 0.4, 0.34, 0.38, -1.25, 0.25, 2.05, 12); ell(g, bush, 0.45, 0.4, 0.42, 1.75, 0.3, 1.45, 12);
  for (const [mx, mz, k] of [[-0.95, 2.45, 1], [-1.3, 2.6, 0.7]]) { add(g, cyl(0.09 * k, 0.11 * k, 0.3 * k, 10), M('#F6DFA8'), mx, 0.15 * k, mz); ell(g, capM, 0.22 * k, 0.15 * k, 0.22 * k, mx, 0.33 * k, mz, 12); }
  return g;
}
function makeRock(parent, x, z, s = 1, seed = 1) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position; const R = rnd(seed * 101 + 7);
  const offs = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3);
    if (!offs.has(key)) offs.set(key, 0.85 + R() * 0.25);
    const k = offs.get(key); p.setXYZ(i, p.getX(i) * k * 1.2, Math.max(-0.3, p.getY(i)) * k * 0.75, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  add(g, geo, M('#B9B3AA', { rim: 0.12 }), 0, 0.35, 0);
  return g;
}
function crystalMesh(parent, s = 0.3) {
  const m = add(parent, new THREE.OctahedronGeometry(s, 0), M('#7FE6F7', { r: 0.2, em: '#5FD8F0', ei: 0.55, nobump: true, rim: 0.4 }));
  m.scale.y = 1.6; return m;
}
function makeFlowerDecor(parent, x, z, col) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(g, cyl(0.03, 0.03, 0.45, 5), M('#5E9E3A'), 0, 0.22, 0);
  const pm = M(col);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ell(g, pm, 0.09, 0.04, 0.09, Math.cos(a) * 0.1, 0.46, Math.sin(a) * 0.1, 8); }
  ell(g, M('#FFD84A'), 0.06, 0.05, 0.06, 0, 0.48, 0, 8);
  ell(g, M('#5DB34F'), 0.12, 0.03, 0.06, 0.08, 0.15, 0, 8).rotation.z = -0.5;
}
function makeFence(parent, x1, z1, x2, z2, n) {
  const wood = M('#D9A66A');
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
    add(parent, roundedBox(0.28, 1.0, 0.2, 0.09, 3), wood, x, 0.5, z);
  }
  const len = Math.hypot(x2 - x1, z2 - z1);
  for (const y of [0.35, 0.72]) {
    const rail = add(parent, roundedBox(len, 0.12, 0.1, 0.05, 2), wood, (x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  }
}

function buildWorld() {
  const s = W.scene;
  // 땅
  const gg = new THREE.PlaneGeometry(128, 128, 110, 110); gg.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 });
  clayPatch(groundMat, 0.0);
  const ground = new THREE.Mesh(gg, groundMat); ground.receiveShadow = true; s.add(ground);
  W.refs.ground = ground;

  const decor = new THREE.Group();
  // 바깥쪽 언덕 & 나무 고리
  const R = rnd(7);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + R() * 0.1, r = 46 + R() * 8;
    ell(decor, M(['#7DC257', '#8ACB61', '#6FB84E'][i % 3]), 9 + R() * 5, 4 + R() * 3, 9 + R() * 5, Math.cos(a) * r, -1, Math.sin(a) * r, 24);
  }
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2 + R() * 0.05, r = 34 + R() * 8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 26 && Math.abs(x) < 10) continue; // 남쪽 시야 트기
    makeTree(decor, x, z, 0.9 + R() * 0.6, R() < 0.35 ? 1 : 0);
  }
  // 마을 안 나무
  const inner = [[-25, 9, 1], [21, -14, 1.05], [26, 9, 1], [-9, 21, 1], [10, 23, 1.1], [-4, -26, 1], [6, -27, 1.1], [18, -22, 0.95], [-20, 19, 0.9], [22, 19, 1]];
  for (const [x, z, sc] of inner) { makeTree(decor, x, z, sc, (x * z) % 3 === 0 ? 1 : 0); collider(x, z, 1.0 * sc); }
  // 꽃
  const fcol = ['#FF8FB1', '#FFFFFF', '#FFD84A', '#B79CFF', '#FF9E5E'];
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, r = 9 + R() * 21; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - 15, z - 11) < 8.5 || Math.hypot(x, z + 20) < 6 || Math.hypot(x + 19, z + 16) < 6.2) continue;
    makeFlowerDecor(decor, x, z, fcol[i % fcol.length]);
  }
  // 풀숲
  for (let i = 0; i < 40; i++) {
    const a = R() * Math.PI * 2, r = 10 + R() * 22; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - 15, z - 11) < 8.5 || Math.hypot(x + 19, z + 16) < 6.4) continue;
    for (let j = 0; j < 3; j++) ell(decor, M('#74BE52'), 0.5, 0.42, 0.5, x + (j - 1) * 0.5, 0.15, z + (j % 2) * 0.3, 12);
  }
  // 울타리
  makeFence(decor, 8.5, 16.5, 13, 18.6, 4); makeFence(decor, 13, 18.6, 19, 18.2, 5);
  makeFence(decor, -26, -6, -24, -12, 5);

  // 버섯 집들
  makeMushroomHouse(s, 16, -11.5, '#DB463D', '#FFF5EC', -0.5);
  collider(16, -11.5, 2.3);
  makeMushroomHouse(s, -16.5, 13, '#B57A45', '#F6E2C4', 0.7);
  collider(-16.5, 13, 2.3);
  makeMushroomHouse(decor, -27, -2, '#F2A03D', '#FFF5EC', 1.4, 0.8); collider(-27, -2, 2);
  makeMushroomHouse(decor, 27.5, -4, '#8FC3E8', '#FFFFFF', -1.3, 0.8); collider(27.5, -4, 2);
  makeMushroomHouse(decor, -11, -22, '#C27BD6', '#FFF0FF', 0.3, 0.75); collider(-11, -22, 1.8);
  makeMushroomHouse(decor, 12, -24, '#E8524A', '#FFF5EC', -0.3, 0.7); collider(12, -24, 1.7);

  // 목공 작업대
  const bench = new THREE.Group(); bench.position.set(-11, 0, 8.6); bench.rotation.y = 0.4; decor.add(bench);
  add(bench, roundedBox(2.6, 0.22, 1.1, 0.08, 3), M('#C98C55'), 0, 1.0, 0);
  for (const [lx, lz] of [[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.4], [1.1, 0.4]]) add(bench, roundedBox(0.18, 1.0, 0.18, 0.06, 2), M('#A86F3F'), lx, 0.5, lz);
  add(bench, roundedBox(0.9, 0.1, 0.3, 0.04, 2), M('#E3B67F'), -0.4, 1.17, 0.1);
  const axH = add(bench, roundedBox(0.75, 0.08, 0.08, 0.035, 2), M('#B5763A'), 0.6, 1.16, 0.08); axH.rotation.y = 0.5;
  const axB = add(bench, roundedBox(0.2, 0.07, 0.34, 0.03, 2), M('#A9A9B2', { r: 0.4 }), 0.9, 1.16, -0.1); axB.rotation.y = 0.5;
  collider(-11, 8.6, 1.5);
  for (let i = 0; i < 4; i++) { const pk = add(decor, roundedBox(3, 0.18, 0.55, 0.07, 2), M(i % 2 ? '#D9A66A' : '#C9935A'), -8.6 + i * 0.1, 0.1 + i * 0.18, 12.4 + i * 0.05); pk.rotation.y = 0.9 + i * 0.08; }
  collider(-8.6, 12.4, 1.2);
  const stool = new THREE.Group(); stool.position.set(-13.2, 0, 7.4); decor.add(stool);
  add(stool, cyl(0.45, 0.45, 0.14, 16), M('#C98C55'), 0, 0.6, 0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(stool, cyl(0.06, 0.06, 0.6, 6), M('#A86F3F'), Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3); }

  // 연못
  const pond = new THREE.Group(); pond.position.set(15, 0, 11); s.add(pond);
  const water = add(pond, cyl(1, 1, 0.12, 48), new THREE.MeshStandardMaterial({ color: '#7CCDF2', roughness: 0.15, metalness: 0.05, emissive: '#2F8FD0', emissiveIntensity: 0.18 }), 0, 0.02, 0, false);
  clayPatch(water.material, 0.25);
  water.scale.set(7, 1, 5.1); water.rotation.y = -0.15;
  add(pond, cyl(1, 1, 0.06, 48), M('#5DB3E0'), 0, 0.0, 0, false).scale.set(7.4, 1, 5.5);
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4; const lp = add(pond, cyl(0.55, 0.55, 0.05, 20), M('#5CB85C'), Math.cos(a) * 4, 0.1, Math.sin(a) * 2.8); lp.scale.z = 0.85; if (i % 2 === 0) flower5(pond, [Math.cos(a) * 4, 0.16, Math.sin(a) * 2.8], '#FFB6D0', '#FFE36E', 0.14); }
  for (let i = 0; i < 16; i++) { const a = -0.6 + i * 0.12 + (i > 8 ? 2.2 : 0); const rx = Math.cos(a) * 7.1, rz = Math.sin(a) * 5.2; const h = 0.9 + (i % 3) * 0.35; const rd = add(pond, cyl(0.04, 0.07, h, 5), M('#4C8F3A'), rx, h / 2, rz); rd.rotation.z = (i % 3 - 1) * 0.15; if (i % 3 === 0) ell(pond, M('#8B5A2B'), 0.08, 0.2, 0.08, rx, h + 0.1, rz, 8); }
  W.refs.pond = pond; W.refs.water = water;
  for (const [dx, dz] of [[0, 0], [-3.5, -1], [3.5, 1], [-4.5, 1.8], [4.5, -1.5], [0, 2.6], [0, -2.6]]) collider(15 + dx, 11 + dz, dx === 0 && dz === 0 ? 3.4 : 2.2);
  for (let i = 0; i < 3; i++) {
    const rp = add(s, new THREE.TorusGeometry(1, 0.03, 4, 32), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.6 }), 15, 0.1, 11, false);
    rp.rotation.x = Math.PI / 2; rp.userData.ph = i / 3; W.ripples.push(rp);
  }

  // 사과나무 (흔들 수 있는 나무)
  const at = new THREE.Group(); at.position.set(-15, 0, -8); s.add(at);
  const atInner = new THREE.Group(); at.add(atInner);
  add(atInner, cyl(0.5, 0.8, 3.4, 14), M('#9A6A42'), 0, 1.7, 0);
  const br1 = add(atInner, cyl(0.16, 0.25, 1.6, 8), M('#9A6A42'), 0.9, 3.4, 0.2); br1.rotation.z = -0.9;
  const br2 = add(atInner, cyl(0.16, 0.25, 1.6, 8), M('#9A6A42'), -0.9, 3.5, -0.1); br2.rotation.z = 0.9;
  const canopy = new THREE.Group(); canopy.position.y = 4.4; atInner.add(canopy);
  const cg = ['#5DB34F', '#6CC25A', '#4FA548', '#7CCB5E'];
  [[0, 0.7, 0, 2.0], [1.4, 0, 0.4, 1.5], [-1.4, 0.1, 0.2, 1.5], [0.2, 0, 1.3, 1.5], [-0.2, 0.2, -1.3, 1.5], [0, 1.8, 0, 1.2]].forEach((c, i) => ell(canopy, M(cg[i % 4]), c[3], c[3] * 0.85, c[3], c[0], c[1], c[2], 22));
  const treeApples = [];
  const apm = M('#E5322E', { r: 0.35, rim: 0.25 });
  [[1.3, -0.3, 1.5], [-1.2, -0.2, 1.4], [0.3, 0.5, 2.0], [1.9, 0.3, 0.3], [-1.8, 0.4, -0.2], [0.8, 1.2, 1.2], [-0.7, 1.0, 1.3]].forEach(p => {
    const a = ell(canopy, apm, 0.26, 0.24, 0.26, ...p, 14); treeApples.push(a);
  });
  // 나무에 걸린 가방
  const bag = makeBagMesh(); bag.position.set(1.4, -1.0, 1.3); bag.rotation.set(0.2, 0.3, 0.4); canopy.add(bag);
  W.refs.appleTree = { root: at, inner: atInner, canopy, bag, apples: treeApples };
  collider(-15, -8, 1.3);

  // 햇살 언덕 (사다리로 올라가 반짝이에 햇빛을 담는 곳)
  {
    const HX = -19, HZ = -16;
    const hill = new THREE.Group(); hill.position.set(HX, 0, HZ); s.add(hill);
    const lathe = (pts, seg) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(q => new THREE.Vector2(q[0], q[1]))).getPoints(seg), 48);
    add(hill, lathe([[4.85, 0], [4.72, 0.25], [4.3, 1.2], [3.75, 2.5], [3.2, 3.8], [2.9, 4.35], [2.4, 4.75], [1.4, 4.95], [0.01, 5.0]], 40), M('#7CC25A', { rim: 0.12 }));
    const capM = M('#BCE67E', { rim: 0.14 });
    add(hill, lathe([[3.42, 3.55], [3.34, 3.8], [2.98, 4.4], [2.46, 4.81], [1.42, 5.01], [0.01, 5.06]], 24), capM);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const b = ell(hill, capM, 0.52, 0.42, 0.3, Math.cos(a) * 3.38, 3.5, Math.sin(a) * 3.38, 12); b.rotation.y = -a + Math.PI / 2; }
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.5; flower5(hill, [Math.cos(a) * 1.3, 5.0, Math.sin(a) * 1.3 - 0.3], ['#FFFFFF', '#FFE36E', '#FFB3C7'][i % 3], '#FFC83A', 0.16); }
    const la = -0.35, out = new THREE.Vector3(Math.sin(la), 0, Math.cos(la));
    const base = new THREE.Vector3(HX + out.x * 5.05, 0, HZ + out.z * 5.05);
    const ladderTop = new THREE.Vector3(HX + out.x * 3.06, 4.6, HZ + out.z * 3.06);
    const yAxis = ladderTop.clone().sub(base).normalize();
    const xAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), out).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    const ladderQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    W.refs.hill = { x: HX, z: HZ, out, base, ladderTop, top: new THREE.Vector3(HX, 5.0, HZ + 0.2), ladderLen: base.distanceTo(ladderTop) + 0.45, ladderQuat, ladder: null };
    collider(HX, HZ, 4.75);
  }

  // 바위들 (양분)
  W.refs.rocks = [];
  [[-3.5, -19.5, 1.25], [1.8, -21.5, 1.4], [5.8, -18.6, 1.15]].forEach(([x, z, sc], i) => {
    const r = makeRock(s, x, z, sc, i + 3);
    const cr = new THREE.Group(); r.add(cr);
    for (let k = 0; k < 3; k++) { const c = crystalMesh(cr, 0.16 + k * 0.03); c.position.set(Math.cos(k * 2.1) * 0.75, 0.75 + k * 0.08, Math.sin(k * 2.1) * 0.55 + 0.3); c.rotation.set(k * 0.4, k, (k - 1) * 0.5); }
    W.refs.rocks.push({ root: r, crystals: cr, x, z, hits: 0, cooldown: 0, scale: sc });
    for (let k = 0; k < 6; k++) { const a = k * 1.1 + i; ell(decor, M(k % 2 ? '#A9A39A' : '#8F8980'), 0.17, 0.11, 0.14, x + Math.cos(a) * 2.0 * sc, 0.08, z + Math.abs(Math.sin(a)) * 1.5 * sc + 0.7, 8); }
    collider(x, z, 1.3 * sc);
  });
  // 장식 바위
  [[-6.5, -22.5, 0.7], [8.5, -21.5, 0.6], [-1, -24, 0.8], [20, 3, 0.6], [-20, 6, 0.55], [4, 25, 0.6]].forEach(([x, z, sc], i) => { makeRock(decor, x, z, sc, i + 20); collider(x, z, 1.2 * sc); });
  // 작은 크리스털 장식
  for (let i = 0; i < 5; i++) { const c = crystalMesh(decor, 0.14); c.position.set(-5 + i * 2.6, 0.2, -24 + (i % 2) * 1.2); c.rotation.z = (i - 2) * 0.3; }

  // 광장 장식: 벤치·가로등
  for (const [x, z, ry] of [[-5.5, 4.8, 0.85], [5.5, 4.8, -0.85]]) {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; decor.add(b);
    add(b, roundedBox(2.0, 0.16, 0.6, 0.07, 2), M('#D9A66A'), 0, 0.55, 0);
    add(b, roundedBox(2.0, 0.5, 0.12, 0.06, 2), M('#D9A66A'), 0, 0.95, -0.28);
    for (const lx of [-0.8, 0.8]) add(b, roundedBox(0.14, 0.55, 0.5, 0.05, 2), M('#B98652'), lx, 0.27, 0);
    collider(x, z, 1.0);
  }
  for (const [x, z] of [[-6.8, -3.2], [6.8, -3.2]]) {
    add(decor, cyl(0.1, 0.14, 2.8, 8), M('#6E5A4A'), x, 1.4, z);
    ell(decor, M('#FFF1B8', { em: '#FFD86B', ei: 0.6 }), 0.32, 0.36, 0.32, x, 3.0, z, 14);
    collider(x, z, 0.4);
  }
  const merged = mergeByMaterial(decor); s.add(merged);

  // 구름
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group(); const a = i / 9 * Math.PI * 2;
    c.position.set(Math.cos(a) * 30, 17 + (i % 3) * 3, Math.sin(a) * 30 - 10);
    for (let j = 0; j < 4; j++) ell(c, M('#FFFFFF', { rim: 0.05, nobump: true }), 1.6 + (j % 2) * 0.6, 1.1, 1.3, j * 1.3 - 2, (j % 2) * 0.5, 0, 14).castShadow = false;
    c.userData.speed = 0.3 + (i % 3) * 0.15; s.add(c); W.clouds.push(c);
  }
}

function makeBagMesh() {
  const g = new THREE.Group();
  add(g, roundedBox(0.7, 0.55, 0.3, 0.14, 4), M('#B37A45'), 0, 0, 0);
  add(g, roundedBox(0.72, 0.28, 0.32, 0.1, 3), M('#8F5A2E'), 0, 0.16, 0.01);
  ell(g, M('#E2B24A', { nobump: true }), 0.06, 0.06, 0.04, 0, 0.03, 0.17, 8);
  const strap = add(g, new THREE.TorusGeometry(0.42, 0.04, 6, 24, Math.PI), M('#8F5A2E'), 0, 0.22, 0);
  return g;
}
function makeBucketMesh() {
  const g = new THREE.Group();
  add(g, cyl(0.28, 0.22, 0.42, 18), M('#E5322E'), 0, 0.21, 0);
  const h = add(g, new THREE.TorusGeometry(0.27, 0.025, 6, 20, Math.PI), M('#888890'), 0, 0.42, 0);
  return g;
}
function makeLadderMesh(len) {
  const g = new THREE.Group(); const wood = M('#C98C55'), wood2 = M('#E3B67F');
  for (const x of [-0.36, 0.36]) add(g, roundedBox(0.13, len, 0.13, 0.05, 2), wood, x, len / 2, 0);
  const n = Math.floor((len - 0.5) / 0.6) + 1;
  for (let i = 0; i < n; i++) add(g, roundedBox(0.74, 0.11, 0.11, 0.045, 2), wood2, 0, 0.42 + i * 0.6, 0);
  return g;
}
function makeAxeMesh() {
  const g = new THREE.Group();
  add(g, roundedBox(0.09, 0.8, 0.09, 0.035, 2), M('#B5763A'), 0, 0, 0);
  add(g, roundedBox(0.36, 0.24, 0.07, 0.03, 2), M('#A9A9B2', { r: 0.4 }), 0.12, 0.3, 0);
  return g;
}
function makeHammerMesh() {
  const g = new THREE.Group();
  add(g, cyl(0.05, 0.06, 0.7, 8), M('#B98652'), 0, 0.35, 0);
  add(g, roundedBox(0.42, 0.18, 0.18, 0.06, 3), M('#8C8C94', { r: 0.4 }), 0, 0.72, 0);
  return g;
}

function updateWorld(dt, t) {
  W.time = t;
  for (const c of W.clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 45) c.position.x = -45; }
  for (const r of W.ripples) {
    const p = (t * 0.25 + r.userData.ph) % 1;
    r.scale.set(0.5 + p * 3.5, 0.5 + p * 3.5, 1); r.material.opacity = 0.5 * (1 - p);
  }
  for (const rk of W.refs.rocks || []) {
    rk.crystals.children.forEach((c, i) => { c.rotation.y += dt * (0.6 + i * 0.2); });
  }
}

