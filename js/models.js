// 물줄때 마을 · 클레이 재질·캐릭터·식물·땀땀이 모델
// 원본 단일 파일 index.html 1073–1930행에서 옮김
// 물줄때 마을 — 클레이 재질 / 캐릭터 / 식물 / 땀땀이 모델
THREE.ColorManagement.legacyMode = false;

// 둥글게 휘는 지평선(동물의 숲 느낌)
const U_CURVE = { value: 0.0042 }, U_D0 = { value: 15 };

const BUMP = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 100 + Math.random() * 60 | 0;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 5, 0, 7); g.fill();
  }
  // 손가락 자국 같은 둥근 눌림
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(90,90,90,0.25)'); gr.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();

const CURVE_PROJ = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
float cfz = max(0.0, -mvPosition.z - uD0);
mvPosition.y -= uCurve * cfz * cfz;
gl_Position = projectionMatrix * mvPosition;
`;
function clayPatch(m, rim = 0.11) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCurve = U_CURVE; sh.uniforms.uD0 = U_D0;
    sh.vertexShader = 'uniform float uCurve;\nuniform float uD0;\n' + sh.vertexShader.replace('#include <project_vertex>', CURVE_PROJ);
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
       float rimF = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
       gl_FragColor.rgb += pow(rimF, 2.6) * ${rim.toFixed(3)} * vec3(1.0, 0.96, 0.9);`);
  };
  m.customProgramCacheKey = () => 'clay' + rim;
}
const _matCache = {};
function M(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  if (_matCache[key]) return _matCache[key];
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.78, metalness: 0,
    bumpMap: null,
    emissive: o.em || 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: o.op !== undefined, opacity: o.op ?? 1,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: !!o.flat,
  });
  if (!o.flat) clayPatch(m, o.rim ?? 0.11); else clayPatch2(m);
  _matCache[key] = m; return m;
}
function clayPatch2(m) { // flat shading 용 (vNormal 없음)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCurve = U_CURVE; sh.uniforms.uD0 = U_D0;
    sh.vertexShader = 'uniform float uCurve;\nuniform float uD0;\n' + sh.vertexShader.replace('#include <project_vertex>', CURVE_PROJ);
  };
  m.customProgramCacheKey = () => 'clayflat';
}

// ── 지오메트리 도우미 ──
function roundedBox(w, h, d, r, seg = 6) {
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3(), inner = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) * w, p.getY(i) * h, p.getZ(i) * d);
    inner.set(THREE.MathUtils.clamp(v.x, -hw, hw), THREE.MathUtils.clamp(v.y, -hh, hh), THREE.MathUtils.clamp(v.z, -hd, hd));
    nn.subVectors(v, inner).normalize();
    v.copy(inner).addScaledVector(nn, r);
    p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, nn.x, nn.y, nn.z);
  }
  return g;
}
const SPH = {};
function sphereGeo(seg = 20) { return SPH[seg] || (SPH[seg] = new THREE.SphereGeometry(1, seg, Math.max(8, seg * 0.75 | 0))); }
function ell(parent, mat, sx, sy, sz, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(sphereGeo(seg), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
function add(parent, geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
  if (parent) parent.add(m); return m;
}
function cyl(rt, rb, h, seg = 16) { return new THREE.CylinderGeometry(rt, rb, h, seg, 1); }
function tube(points, r, seg = 10, rad = 7) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, seg, r, rad, false);
}
// 잎: +z 방향으로 뻗는 납작한 타원
function leafGeo(len, wid, cup = 0.3, droop = 0.2, tipSharp = 0.3) {
  const g = new THREE.SphereGeometry(1, 14, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (z + 1) / 2; // 0(기부) ~ 1(끝)
    const taper = 1 - tipSharp * Math.pow(t, 3);
    let X = x * wid * taper, Y = y * wid * 0.09, Z = t * len;
    Y += cup * (X / wid) * (X / wid) * wid * 0.5 - droop * t * t * len * 0.5;
    p.setXYZ(i, X, Y, Z);
  }
  g.computeVertexNormals();
  return g;
}
function mergeByMaterial(group) {
  // 같은 재질끼리 합쳐서 드로우콜 줄이기
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    const arr = buckets.get(o.material) || []; arr.push(o); buckets.set(o.material, arr);
  });
  const out = new THREE.Group();
  for (const [mat, meshes] of buckets) {
    const geos = meshes.map(m => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      const mm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      g.applyMatrix4(mm); return g;
    });
    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

// ═════════════════ 캐릭터 ═════════════════
const C_BODY = '#F9B835';
function faceZ(x, y) { // 몸 앞면의 z (둥근 모서리 반영)
  const dx = Math.max(0, Math.abs(x) - 0.2), dy = Math.max(0, Math.abs(y - 0.6) - 0.13);
  const d2 = 0.09 - dx * dx - dy * dy;
  return 0.12 + (d2 > 0 ? Math.sqrt(d2) : 0);
}
function dec(parent, mat, sx, sy, sz, x, y, lift = 0, seg = 12) { return ell(parent, mat, sx, sy, sz, x, y, faceZ(x, y) + lift, seg); }
function rrShape(w, d, r) {
  const q = new THREE.Shape(); const x = w / 2 - r, y = d / 2 - r;
  q.absarc(x, y, r, 0, Math.PI / 2); q.absarc(-x, y, r, Math.PI / 2, Math.PI); q.absarc(-x, -y, r, Math.PI, Math.PI * 1.5); q.absarc(x, -y, r, Math.PI * 1.5, Math.PI * 2); q.closePath();
  return q;
}
function ringGeo(w, d, r, hw, hd, hr, depth, bevel = 0.025) { // 머리에 두르는 둥근 사각 고리
  const outer = rrShape(w, d, r); if (hw > 0) outer.holes.push(rrShape(hw, hd, hr));
  const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); return g;
}
function arcGeo(r, tube, arc) { return new THREE.TorusGeometry(r, tube, 6, 16, arc); }
function heartGeo(w) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.45);
  s.bezierCurveTo(-0.55, -0.05, -0.55, 0.45, -0.25, 0.45);
  s.bezierCurveTo(-0.1, 0.45, 0, 0.33, 0, 0.22);
  s.bezierCurveTo(0, 0.33, 0.1, 0.45, 0.25, 0.45);
  s.bezierCurveTo(0.55, 0.45, 0.55, -0.05, 0, -0.45);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.08, bevelSegments: 5, curveSegments: 16 });
  g.translate(0, 0, -0.05); g.scale(w, w, w); return g;
}
const STRAWB = new THREE.LatheGeometry([[0.001, 0], [0.06, 0.008], [0.088, 0.05], [0.08, 0.1], [0.05, 0.15], [0.001, 0.18]].map(q => new THREE.Vector2(q[0], q[1])), 14);
const LENS = (() => { const g = new THREE.ExtrudeGeometry(rrShape(0.36, 0.2, 0.085), { depth: 0.035, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -0.02); return g; })();

function buildCharacter(def) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const bodyCol = def.body || C_BODY;
  const bm = M(bodyCol, { rim: 0.14 });
  const torso = add(body, roundedBox(1.0, 0.86, 0.84, 0.3, 8), bm, 0, 0.6, 0);
  const handL = ell(body, bm, 0.17, 0.18, 0.17, -0.55, 0.52, 0.04);
  const handR = ell(body, bm, 0.17, 0.18, 0.17, 0.55, 0.52, 0.04);
  const footL = ell(root, bm, 0.19, 0.13, 0.23, -0.23, 0.11, 0.08);
  const footR = ell(root, bm, 0.19, 0.13, 0.23, 0.23, 0.11, 0.08);
  const deco = new THREE.Group(); body.add(deco);
  const eyeM = M('#5A3018', { r: 0.45 });
  if (!['shades', 'spiky', 'bamti', 'tissue'].includes(def.acc)) {
    dec(deco, eyeM, 0.06, 0.066, 0.03, -0.17, 0.64, 0.006); dec(deco, eyeM, 0.06, 0.066, 0.03, 0.17, 0.64, 0.006);
  }
  if (def.blush || def.acc === 'santa' || def.acc === 'ribbon') {
    const bl = M('#FF9C8A', { op: 0.75 });
    dec(deco, bl, 0.085, 0.05, 0.02, -0.3, 0.56, 0.004); dec(deco, bl, 0.085, 0.05, 0.02, 0.3, 0.56, 0.004);
  }
  const top = new THREE.Group(); top.position.y = 1.02;
  buildAccessory(def.acc, top, body, deco, bm);
  // 움직이지 않는 장식은 재질별로 합쳐서 가볍게
  const mTop = mergeByMaterial(top); mTop.position.copy(top.position); body.add(mTop);
  if (deco.children.length) { body.remove(deco); body.add(mergeByMaterial(deco)); }
  root.userData = { body, torso, hands: [handL, handR], feet: [footL, footR], top: mTop, handX: body.userData.handX || 0.55, handZ: body.userData.handZ ?? 0.04 };
  return root;
}

function buildAccessory(acc, top, body, deco, bm) {
  const red = M('#E5322E'), white = M('#FFFFFF', { rim: 0.05 }), black = M('#2A2422', { r: 0.5 }), brown = M('#5A3018');
  switch (acc) {
    case 'santa': {
      const brim = add(top, new THREE.TorusGeometry(0.42, 0.11, 12, 28), white, 0, -0.02, 0); brim.rotation.x = Math.PI / 2;
      const cone = add(top, cyl(0.05, 0.42, 0.62, 20), red, 0.08, 0.3, -0.02); cone.rotation.z = -0.35;
      ell(top, white, 0.12, 0.12, 0.12, 0.27, 0.56, -0.02);
      break;
    }
    case 'bread': {
      const crust = M('#C9762B'), crumb = M('#F2C27B');
      const b = ell(top, crust, 0.6, 0.27, 0.38, 0, 0.1, 0); b.rotation.y = 0.15;
      for (let i = -1; i <= 1; i++) { const s = ell(top, crumb, 0.09, 0.05, 0.25, i * 0.25, 0.33, 0.02); s.rotation.y = 0.7; s.rotation.x = -0.15; }
      body.userData.handsUp = true;
      break;
    }
    case 'ribbon': {
      const pink = M('#F6A9C2'), blue = M('#A8C8F0');
      const l = ell(top, pink, 0.36, 0.2, 0.12, -0.33, 0.12, 0); l.rotation.z = 0.35;
      const r = ell(top, pink, 0.36, 0.2, 0.12, 0.33, 0.12, 0); r.rotation.z = -0.35;
      ell(top, blue, 0.2, 0.08, 0.13, -0.33, 0.13, 0.02).rotation.z = 0.35;
      ell(top, blue, 0.2, 0.08, 0.13, 0.33, 0.13, 0.02).rotation.z = -0.35;
      ell(top, pink, 0.12, 0.12, 0.12, 0, 0.1, 0.02);
      break;
    }
    case 'apple': {
      ell(top, red, 0.3, 0.27, 0.3, 0, 0.2, 0);
      add(top, cyl(0.025, 0.03, 0.18, 8), M('#6B3E1E'), 0, 0.5, 0);
      const lf = add(top, leafGeo(0.26, 0.11, 0.4, 0.1), M('#3E9B3A'), 0.02, 0.52, 0); lf.rotation.set(-0.5, 0.9, 0);
      break;
    }
    case 'seaweed': { // 미역이: 짙은 올리브색 물결 잎
      const g = M('#5E7A22', { rim: 0.1 });
      const wavy = (len, wid, droop) => {
        const geo = leafGeo(len, wid, 0.25, droop, 0.35); const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) { const t = p.getZ(i) / len; p.setX(i, p.getX(i) + Math.sin(t * 9) * wid * 0.24 * t); p.setY(i, p.getY(i) + Math.sin(t * 12) * 0.018); }
        geo.computeVertexNormals(); return geo;
      };
      for (let i = 0; i < 11; i++) { const lf = add(top, wavy(0.5 + (i % 3) * 0.05, 0.17, 1.5), g, 0, 0.07, 0); lf.rotation.set(-0.15, i / 11 * Math.PI * 2 + 0.3, 0, 'YXZ'); }
      for (let i = 0; i < 4; i++) { const lf = add(top, wavy(0.36 + i * 0.05, 0.12, 0.5), g, 0, 0.08, 0); lf.rotation.set(-1.25 + i * 0.12, i * 1.7, 0, 'YXZ'); }
      break;
    }
    case 'shark': { // 쪼수: 머리에 엎드린 상어
      const blue = M('#3A72B8'), teal = M('#7FCBCB'), dk = M('#2B5A96'), tooth = M('#F6ECD9');
      const sh = new THREE.Group(); sh.rotation.z = -0.07; top.add(sh);
      ell(sh, blue, 0.68, 0.27, 0.52, 0.03, 0.02, -0.02, 24);
      add(sh, ringGeo(1.1, 0.94, 0.36, 0.8, 0.64, 0.24, 0.07, 0.03), teal, 0, -0.2, 0);
      for (let i = 0; i < 6; i++) { const t = add(sh, new THREE.ConeGeometry(0.05, 0.11, 10), tooth, -0.44 + i * 0.105, -0.25, 0.44 - (i < 1 ? 0.05 : 0)); t.rotation.x = Math.PI; }
      for (let i = 0; i < 3; i++) { const t = add(sh, new THREE.ConeGeometry(0.05, 0.11, 10), tooth, -0.52, -0.25, 0.3 - i * 0.13); t.rotation.x = Math.PI; }
      ell(sh, M('#1E1C1C'), 0.04, 0.04, 0.03, -0.3, 0.1, 0.415, 10);
      for (let i = 0; i < 3; i++) { const gl = add(sh, roundedBox(0.014, 0.09, 0.02, 0.006, 1), dk, 0.12 + i * 0.07, 0.03, 0.495 - i * 0.012); gl.rotation.z = 0.3; }
      const fin = add(sh, new THREE.ConeGeometry(0.16, 0.34, 12), blue, 0.08, 0.36, -0.05); fin.scale.z = 0.35; fin.rotation.z = -0.5;
      const t1 = add(sh, new THREE.ConeGeometry(0.13, 0.4, 12), blue, 0.78, 0.22, -0.05); t1.scale.z = 0.35; t1.rotation.z = -0.9;
      const t2 = add(sh, new THREE.ConeGeometry(0.11, 0.3, 12), blue, 0.76, -0.06, -0.05); t2.scale.z = 0.35; t2.rotation.z = -2.3;
      break;
    }
    case 'bamti': { // 밤티: 긴 갈색 머리 · 작은 날개 · 흰 옷
      const hair = M('#A65A3A', { rim: 0.1 }), hair2 = M('#BF7650'), wing = M('#F3EDE2'), cloth = M('#F4EFE6'), gold = M('#E8B93A'), dk = M('#4A4540');
      ell(top, hair, 0.56, 0.26, 0.5, 0, -0.03, -0.06, 22);
      for (const s of [-1, 1]) {
        ell(top, hair2, 0.24, 0.12, 0.3, s * 0.2, 0.1, 0.02, 14).rotation.z = -s * 0.3;
        const bang = ell(deco, hair, 0.16, 0.34, 0.12, s * 0.45, 0.87, 0.28, 14); bang.rotation.z = s * 0.5;
        ell(deco, hair, 0.22, 0.44, 0.38, s * 0.6, 0.6, -0.06, 16);
        ell(deco, hair2, 0.1, 0.4, 0.2, s * 0.7, 0.58, 0.08, 12);
        ell(deco, hair, 0.26, 0.3, 0.36, s * 0.66, 0.3, -0.02, 16);
        ell(deco, hair, 0.14, 0.12, 0.2, s * 0.84, 0.17, 0.06, 12);
        const w = ell(top, wing, 0.17, 0.075, 0.05, s * 0.42, 0.2, 0.12, 12); w.rotation.z = s * 0.3;
        ell(top, wing, 0.07, 0.07, 0.05, s * 0.3, 0.16, 0.14, 10);
        // 반쯤 감긴 눈
        dec(deco, M('#F6E7C8'), 0.085, 0.05, 0.02, s * 0.2 - 0.02, 0.655, 0.0);
        dec(deco, M('#3A2A22'), 0.055, 0.055, 0.026, s * 0.2 + 0.015, 0.66, 0.004);
        dec(deco, white, 0.012, 0.012, 0.012, s * 0.2 + 0.035, 0.675, 0.028, 6);
        add(deco, roundedBox(0.21, 0.04, 0.03, 0.014, 1), M('#9A5A3A'), s * 0.2, 0.705, faceZ(0.2, 0.705) + 0.02);
        // 수염 자국
        for (const [fx, fy, rz] of [[0.07, 0.56, 0.5], [0.12, 0.56, 0.5], [0.16, 0.5, 0.4]]) { const q = add(deco, roundedBox(0.012, 0.035, 0.012, 0.005, 1), M('#3A2A22'), s * fx, fy, faceZ(fx, fy) + 0.004); q.rotation.z = s * rz; }
      }
      ell(deco, hair, 0.56, 0.55, 0.26, 0, 0.52, -0.38, 18);
      // 흰 옷
      add(deco, roundedBox(1.04, 0.3, 0.88, 0.14, 6), cloth, 0, 0.33, 0);
      const sash = add(deco, roundedBox(0.72, 0.17, 0.05, 0.022, 2), cloth, 0.02, 0.5, 0.425); sash.rotation.z = -0.3;
      const br = add(deco, new THREE.TorusGeometry(0.045, 0.02, 8, 16), gold, -0.3, 0.6, 0.43);
      add(deco, ringGeo(1.07, 0.91, 0.16, 0.9, 0.74, 0.1, 0.03, 0.008), dk, 0, 0.36, 0);
      ell(deco, dk, 0.045, 0.045, 0.04, 0.26, 0.375, 0.46, 10);
      for (const dx of [0.23, 0.29]) { const tl = add(deco, roundedBox(0.045, 0.22, 0.02, 0.009, 1), dk, dx, 0.26, 0.465); tl.rotation.z = (dx - 0.26) * 3; }
      for (const [lx, ly] of [[-0.3, 0.26], [0.0, 0.23], [0.4, 0.27]]) for (let k = 0; k < 3; k++) { const lf = ell(deco, gold, 0.035, 0.014, 0.008, lx + k * 0.05, ly + (k % 2) * 0.02, 0.447, 6); lf.rotation.z = 0.5 - k * 0.3; }
      body.userData.handX = 0.6; body.userData.handZ = 0.3;
      break;
    }
    case 'cake': { // 두섬이: 초코 케이크에 딸기 가득
      add(top, cyl(0.5, 0.5, 0.07, 32), M('#D9443C'), 0, 0.02, 0);
      add(top, cyl(0.47, 0.48, 0.27, 32), M('#8A4B2D'), 0, 0.185, 0);
      ell(top, M('#8A4B2D'), 0.47, 0.05, 0.47, 0, 0.32, 0, 24);
      const sm = M('#E9554B', { rim: 0.16 });
      const put = (x, z, k = 1) => { const b = add(top, STRAWB, sm, x, 0.33, z); b.scale.setScalar(k); };
      put(0, 0, 1.08);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(Math.cos(a) * 0.17, Math.sin(a) * 0.17); }
      for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2 + 0.2; put(Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0.95); }
      break;
    }
    case 'heart': { // 사랑이: 이마에 큰 하트
      const hg = new THREE.Group(); hg.position.set(0, 0.99, 0.29); hg.rotation.x = -0.3; body.add(hg);
      add(hg, heartGeo(0.82), M('#E3282C', { rim: 0.2 }));
      body.userData.beat = hg;
      break;
    }
    case 'tutu': { // 자야
      const pink = M('#F0357F', { rim: 0.16 }), dk = M('#3A2A20');
      for (const s of [-1, 1]) {
        const l1 = add(deco, arcGeo(0.082, 0.015, 2.7), dk, s * 0.17, 0.645, faceZ(0.17, 0.7) + 0.012); l1.rotation.z = s > 0 ? -0.1 : 0.54;
        const l2 = add(deco, roundedBox(0.085, 0.024, 0.02, 0.01, 1), dk, s * 0.285, 0.69, faceZ(0.285, 0.69) + 0.01); l2.rotation.z = s * 0.75;
        const l3 = add(deco, roundedBox(0.07, 0.022, 0.02, 0.01, 1), dk, s * 0.265, 0.725, faceZ(0.265, 0.725) + 0.01); l3.rotation.z = s * 1.05;
        dec(deco, pink, 0.045, 0.035, 0.03, s * 0.035, 0.535, 0.01);
        dec(deco, pink, 0.17, 0.1, 0.05, s * 0.13, 0.37, 0.0);
        const st = add(deco, tube([[s * 0.22, 0.43, 0.43], [s * 0.36, 0.5, 0.36], [s * 0.46, 0.56, 0.2]], 0.014, 8, 6), pink);
      }
      dec(deco, pink, 0.06, 0.035, 0.03, 0, 0.5, 0.01);
      dec(deco, brown, 0.014, 0.014, 0.01, 0.27, 0.56, 0.005, 6);
      add(deco, ringGeo(1.06, 0.9, 0.32, 0.7, 0.5, 0.2, 0.07, 0.03), pink, 0, 0.25, 0);
      for (let L = 0; L < 2; L++) for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2 + L * 0.24; ell(deco, pink, 0.15, 0.06, 0.15, Math.cos(a) * (0.56 - L * 0.02), 0.27 - L * 0.09, Math.sin(a) * (0.48 - L * 0.02), 10); }
      break;
    }
    case 'carrot': { // 당근이: 도톰한 챙의 당근 모자
      const or = M('#F07F2A', { rim: 0.14 }), dk = M('#D9661A'), gr = M('#6FA83A');
      ell(top, or, 0.5, 0.36, 0.45, 0, -0.03, -0.01, 24);
      add(top, ringGeo(1.14, 0.98, 0.38, 0.8, 0.64, 0.24, 0.1, 0.055), or, 0, -0.22, 0);
      const g1 = ell(top, dk, 0.17, 0.014, 0.02, -0.08, 0.2, 0.335, 8); g1.rotation.z = 0.12;
      const g2 = ell(top, dk, 0.19, 0.014, 0.02, 0.1, 0.12, 0.395, 8); g2.rotation.z = -0.08;
      for (let i = 0; i < 5; i++) { const k = i - 2; const lf = ell(top, gr, 0.09, 0.2, 0.08, k * 0.11, 0.42 - Math.abs(k) * 0.045, 0, 14); lf.rotation.z = -k * 0.38; }
      break;
    }
    case 'spiky': { // 기영이: 뾰족 머리 · 큰 눈 · 주황 티셔츠
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a); add(top, new THREE.ConeGeometry(0.115, 0.26, 12), bm, Math.sign(cx) * Math.pow(Math.abs(cx), 0.6) * 0.38, 0.07, Math.sign(cz) * Math.pow(Math.abs(cz), 0.6) * 0.3); }
      for (const [px, pz] of [[0, 0], [-0.18, 0], [0.18, 0]]) add(top, new THREE.ConeGeometry(0.12, 0.22, 12), bm, px, 0.07, pz);
      const wh = M('#F6E7C8'), ir = M('#6A3A1E'), pu = M('#3A1E10'), hi = M('#FFFFFF', { em: '#FFFFFF', ei: 0.4 }), line = M('#7A4520');
      for (const s of [-1, 1]) {
        dec(deco, wh, 0.1, 0.105, 0.025, s * 0.2, 0.73, -0.004);
        dec(deco, ir, 0.078, 0.088, 0.028, s * 0.195, 0.725, 0.004);
        dec(deco, pu, 0.04, 0.045, 0.03, s * 0.195, 0.725, 0.012);
        dec(deco, hi, 0.024, 0.024, 0.02, s * 0.195 + 0.03, 0.76, 0.03, 8); dec(deco, hi, 0.016, 0.016, 0.02, s * 0.195 - 0.03, 0.695, 0.03, 8);
        const lid = add(deco, roundedBox(0.2, 0.022, 0.02, 0.009, 1), line, s * 0.2, 0.825, faceZ(0.2, 0.825) + 0.012); lid.rotation.z = -s * 0.08; lid.rotation.x = -0.3;
        const brow = add(deco, roundedBox(0.2, 0.02, 0.02, 0.009, 1), line, s * 0.24, 0.915, faceZ(0.24, 0.915) + 0.008); brow.rotation.z = -s * 0.18; brow.rotation.x = -0.6;
        for (const [fx, fy] of [[0.37, 0.66], [0.31, 0.63], [0.35, 0.6]]) dec(deco, line, 0.012, 0.012, 0.008, s * fx, fy, 0.004, 6);
      }
      dec(deco, line, 0.014, 0.01, 0.01, 0.02, 0.65, 0.006, 6);
      const sm = add(deco, arcGeo(0.09, 0.009, 1.5), line, 0, 0.665, 0.428); sm.rotation.z = -Math.PI / 2 - 0.75;
      add(deco, roundedBox(1.04, 0.37, 0.88, 0.18, 6), M('#F0761C', { rim: 0.14 }), 0, 0.35, 0);
      add(deco, roundedBox(0.2, 0.055, 0.03, 0.012, 1), M('#FFC61A'), 0, 0.42, 0.447); add(deco, roundedBox(0.06, 0.15, 0.03, 0.012, 1), M('#FFC61A'), 0, 0.35, 0.447);
      for (const s of [-1, 1]) add(deco, roundedBox(0.075, 0.37, 0.03, 0.012, 1), M('#8A5230'), s * 0.31, 0.35, 0.445);
      break;
    }
    case 'fedora': { // 잭아저씨
      const bk = M('#2B2928'), band = M('#5E5A5B');
      ell(top, bk, 0.7, 0.055, 0.64, 0, -0.04, 0, 28);
      add(top, cyl(0.37, 0.44, 0.34, 28), bk, 0, 0.14, 0);
      ell(top, bk, 0.37, 0.07, 0.37, 0, 0.31, 0, 24);
      add(top, cyl(0.435, 0.45, 0.1, 28), band, 0, 0.03, 0);
      for (const s of [-1, 1]) {
        dec(deco, bk, 0.13, 0.065, 0.05, s * 0.1, 0.5, 0.0);
        add(deco, tube([[s * 0.16, 0.49, 0.44], [s * 0.27, 0.47, 0.42], [s * 0.35, 0.5, 0.385], [s * 0.38, 0.55, 0.365]], 0.035, 10, 8), bk);
        ell(deco, bk, 0.035, 0.035, 0.035, s * 0.38, 0.552, 0.365, 8);
      }
      break;
    }
    case 'shades': { // 강남이
      const gl = M('#1E1C1C', { r: 0.3 });
      for (const s of [-1, 1]) {
        const l = add(deco, LENS, gl, s * 0.215, 0.66, 0.435); l.rotation.y = s * 0.22; l.rotation.z = -s * 0.05;
        add(deco, roundedBox(0.05, 0.05, 0.5, 0.02, 2), gl, s * 0.505, 0.71, 0.13);
      }
      add(deco, roundedBox(0.12, 0.05, 0.05, 0.02, 2), gl, 0, 0.71, 0.455);
      for (const dx of [0, 0.035]) { const q = add(deco, roundedBox(0.012, 0.075, 0.01, 0.004, 1), M('#8E8E96'), -0.3 + dx, 0.695, 0.47); q.rotation.z = -0.6; }
      break;
    }
    case 'kitty': { // 키티
      const bk = M('#1E1C1C'), bowM = M('#E3322E', { rim: 0.16 });
      for (const s of [-1, 1]) {
        const e = add(deco, arcGeo(0.065, 0.013, Math.PI), bk, s * 0.27, 0.885, faceZ(0.27, 0.91) + 0.004); e.rotation.x = -0.6;
        for (let i = 0; i < 3; i++) { const yy = 0.66 - i * 0.055; const w = add(deco, roundedBox(0.1, 0.024, 0.024, 0.011, 1), bk, s * 0.42, yy, faceZ(0.42, yy) + 0.004); w.rotation.y = s * 0.75; w.rotation.z = -s * (i - 1) * 0.12; }
      }
      dec(deco, M('#FFC21A'), 0.045, 0.03, 0.03, 0, 0.6, 0.012);
      const bow = new THREE.Group(); bow.position.set(0.33, 0.9, 0.31); bow.rotation.set(-0.4, 0.3, -0.25); deco.add(bow);
      ell(bow, bowM, 0.16, 0.12, 0.08, -0.15, 0, 0, 14); ell(bow, bowM, 0.16, 0.12, 0.08, 0.15, 0, 0, 14); ell(bow, bowM, 0.07, 0.075, 0.075, 0, 0, 0.02, 12);
      break;
    }
    case 'books': { // 북북이
      const b1 = add(top, roundedBox(0.66, 0.14, 0.48, 0.045, 2), M('#8FAF5F'), 0, 0.04, 0);
      const b2 = add(top, roundedBox(0.6, 0.13, 0.44, 0.045, 2), M('#F2E4CF'), 0.02, 0.18, 0); b2.rotation.y = 0.14;
      const b3 = add(top, roundedBox(0.54, 0.13, 0.42, 0.045, 2), M('#F2A7A0'), -0.01, 0.315, 0); b3.rotation.y = -0.12;
      const page = M('#FFF8EC');
      add(top, roundedBox(0.58, 0.075, 0.03, 0.012, 1), page, 0, 0.04, 0.235);
      add(top, roundedBox(0.52, 0.065, 0.03, 0.012, 1), page, 0.02, 0.18, 0.215).rotation.y = 0.14;
      add(top, roundedBox(0.46, 0.065, 0.03, 0.012, 1), page, -0.01, 0.315, 0.205).rotation.y = -0.12;
      add(top, roundedBox(0.075, 0.17, 0.02, 0.008, 1), M('#FFC21A'), 0.14, 0.2, 0.245);
      const sm = add(deco, arcGeo(0.065, 0.014, 2.0), brown, 0, 0.62, 0.432); sm.rotation.z = -Math.PI / 2 - 1.0;
      body.userData.handsUp = true;
      break;
    }
    case 'tissue': { // 코쓱이: 티슈 상자 · 훌쩍
      const or = M('#E8692A', { rim: 0.14 }), ti = M('#F6F1E8'), mint = M('#8FD6B4'), eyeM = M('#5A3018'), hi = M('#FFFFFF', { em: '#FFFFFF', ei: 0.4 });
      add(top, ringGeo(1.1, 0.94, 0.33, 0.5, 0.2, 0.09, 0.15, 0.05), or, 0, -0.17, 0);
      ell(top, ti, 0.2, 0.2, 0.07, -0.04, 0.14, 0, 14);
      const t1 = ell(top, ti, 0.1, 0.22, 0.06, 0.14, 0.22, 0, 12); t1.rotation.z = -0.7;
      const t2 = ell(top, ti, 0.1, 0.16, 0.06, -0.16, 0.2, 0.01, 12); t2.rotation.z = 0.5;
      const t3 = ell(top, ti, 0.07, 0.12, 0.05, 0.27, 0.3, 0, 10); t3.rotation.z = -1.2;
      for (const s of [-1, 1]) {
        dec(deco, eyeM, 0.075, 0.078, 0.03, s * 0.2, 0.64, 0.004);
        dec(deco, hi, 0.024, 0.024, 0.016, s * 0.2 + 0.02, 0.67, 0.03, 8); dec(deco, hi, 0.015, 0.015, 0.014, s * 0.2 - 0.025, 0.63, 0.03, 8);
        const tr = dec(deco, mint, 0.06, 0.032, 0.02, s * 0.21, 0.555, 0.006); tr.rotation.z = -s * 0.15;
      }
      dec(deco, mint, 0.042, 0.06, 0.03, 0, 0.5, 0.012);
      add(deco, new THREE.ConeGeometry(0.03, 0.09, 10), mint, 0, 0.575, 0.44);
      break;
    }
    case 'towel': { // 목수 사달희의 수건 머리띠
      const tw = M('#FFFFFF', { rim: 0.06 });
      const band = add(top, ringGeo(1.07, 0.91, 0.33, 0.9, 0.74, 0.25, 0.15, 0.025), tw, 0, -0.27, 0); band.rotation.z = 0.06;
      ell(top, tw, 0.075, 0.075, 0.07, 0.57, -0.15, -0.06, 10);
      ell(top, tw, 0.06, 0.15, 0.05, 0.63, 0.0, -0.06, 10).rotation.z = -0.55;
      ell(top, tw, 0.15, 0.06, 0.05, 0.72, -0.2, -0.1, 10).rotation.z = -0.35;
      add(top, roundedBox(0.5, 0.02, 0.02, 0.008, 1), M('#9CCBF0'), 0, -0.19, 0.468);
      break;
    }
  }
}

// 캐릭터 애니메이션 (걷기/숨쉬기/점프)
function animateCharacter(ch, t, speed, extra = {}) {
  const u = ch.userData;
  const walk = Math.min(1, speed / 5);
  const ph = t * 12;
  const bob = Math.abs(Math.sin(ph)) * 0.12 * walk;
  const breathe = Math.sin(t * 2.4) * 0.025 * (1 - walk);
  const hop = extra.hop || 0;
  u.body.position.y = bob + hop;
  const sq = 1 + breathe - (extra.squash || 0);
  u.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  u.body.rotation.z = Math.sin(ph) * 0.06 * walk;
  u.body.rotation.x = 0.08 * walk;
  u.feet[0].position.z = 0.08 + Math.sin(ph) * 0.18 * walk; u.feet[0].position.y = 0.11 + Math.max(0, Math.sin(ph)) * 0.1 * walk + hop * 0.6;
  u.feet[1].position.z = 0.08 - Math.sin(ph) * 0.18 * walk; u.feet[1].position.y = 0.11 + Math.max(0, -Math.sin(ph)) * 0.1 * walk + hop * 0.6;
  const up = (u.body.userData.handsUp || extra.hold) ? 0.42 : 0;
  u.hands[0].position.y = 0.52 + up + Math.sin(ph) * 0.06 * walk + (extra.wave ? Math.abs(Math.sin(t * 10)) * 0.25 : 0);
  u.hands[1].position.y = 0.52 + up - Math.sin(ph) * 0.06 * walk;
  if (extra.hold) { u.hands[0].position.x = -0.42; u.hands[1].position.x = 0.42; } else { u.hands[0].position.x = -(u.handX || 0.55); u.hands[1].position.x = (u.handX || 0.55); }
  const hz = u.handZ ?? 0.04;
  u.hands[0].position.z = hz - Math.sin(ph) * 0.12 * walk;
  u.hands[1].position.z = hz + Math.sin(ph) * 0.12 * walk;
  if (u.body.userData.beat) { const b = 1 + Math.max(0, Math.sin(t * 6)) * 0.06; u.body.userData.beat.scale.setScalar(b); }
}

// ═════════════════ 식물 ═════════════════
const PM = {
  leaf: M('#4DAF4E'), leafDark: M('#33883B'), leafLight: M('#93D25A'), stem: M('#5E9E3A'),
  soil: M('#6A4127', { r: 0.95 }), seed: M('#3A2A20'),
};
function stemTo(g, pts, r, mat = PM.stem) { return add(g, tube(pts, r, 10, 6), mat); }
function placeLeaf(g, geo, mat, pos, yaw, pitch, roll = 0) {
  const l = add(g, geo, mat, ...pos); l.rotation.set(pitch, yaw, roll, 'YXZ'); return l;
}
function flowerDaisy(g, pos, o) {
  const f = new THREE.Group(); f.position.set(...pos); g.add(f);
  if (o.face) f.rotation.set(o.face[0], o.face[1], 0, 'YXZ');
  const pm = M(o.petal), cm = M(o.center);
  const layers = o.layers || 1;
  for (let L = 0; L < layers; L++) {
    const n = o.n || 12;
    const pg = leafGeo(o.len * (1 - L * 0.22), o.wid, 0.15, -0.05 - L * 0.1, 0.1);
    for (let i = 0; i < n; i++) placeLeaf(f, pg, L % 2 ? M(o.petal2 || o.petal) : pm, [0, L * 0.015, 0], i / n * Math.PI * 2 + L * 0.3, -0.12 - L * 0.35);
  }
  ell(f, cm, o.cr, o.cr * 0.45, o.cr, 0, 0.02, 0, 16);
  return f;
}
function flower5(g, pos, petal, center, s = 0.08, face = null) {
  const f = new THREE.Group(); f.position.set(...pos); g.add(f);
  if (face) f.rotation.set(face[0], face[1], 0, 'YXZ');
  const pg = leafGeo(s, s * 0.8, 0.3, -0.2, -0.2);
  for (let i = 0; i < 5; i++) placeLeaf(f, pg, M(petal), [0, 0, 0], i / 5 * Math.PI * 2, -0.3);
  ell(f, M(center), s * 0.28, s * 0.22, s * 0.28, 0, 0.01, 0, 10);
  return f;
}
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// stage: 0 씨앗, 1 새싹, 2 어린 식물, 3 완성
function buildPlant(id, stage, seedNum = 7) {
  const g = new THREE.Group();
  if (stage === 0) {
    const s = ell(g, PM.seed, 0.06, 0.035, 0.09, 0, 0.02, 0, 12); s.rotation.y = 0.6;
    return g;
  }
  if (stage === 1) {
    const big = (id === 'bean' || id === 'sunflower' || id === 'nasturtium');
    const h = big ? 0.28 : 0.2;
    stemTo(g, [[0, 0, 0], [0.01, h * 0.5, 0], [0, h, 0]], big ? 0.025 : 0.016);
    if (id === 'catgrass') {
      for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.03 + (i % 4) * 0.035; stemTo(g, [[Math.cos(a) * r, 0, Math.sin(a) * r], [Math.cos(a) * r * 1.2, 0.12, Math.sin(a) * r * 1.2], [Math.cos(a) * r * 1.5, 0.22 + (i % 3) * 0.03, Math.sin(a) * r * 1.5]], 0.008, M('#8CD94E')); }
      return g;
    }
    const cg = leafGeo(big ? 0.16 : 0.11, big ? 0.1 : 0.07, 0.5, 0.05, -0.3);
    placeLeaf(g, cg, PM.leafLight, [0, h, 0], 0, -1.1);
    placeLeaf(g, cg, PM.leafLight, [0, h, 0], Math.PI, -1.1);
    return g;
  }
  const full = stage >= 3;
  const R = rnd(seedNum * 97 + id.length * 13);
  const k = full ? 1 : 0.6; // 크기 비율
  const B = PLANT_BUILDERS[id] || PLANT_BUILDERS.basil;
  const inner = new THREE.Group(); g.add(inner);
  B(inner, full, R);
  inner.scale.setScalar(k);
  return g;
}

// 반복되는 허브형(마주나기 잎)
function herb(g, R, o) {
  const stems = o.stems || 1;
  for (let s = 0; s < stems; s++) {
    const a = s / stems * Math.PI * 2 + R();
    const lean = stems > 1 ? 0.12 + R() * 0.1 : 0.02;
    const H = o.h * (0.85 + R() * 0.25);
    const nodes = o.nodes;
    const pts = [];
    for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push([Math.cos(a) * lean * H * t * 2, H * t, Math.sin(a) * lean * H * t * 2]); }
    stemTo(g, pts, o.r || 0.032, o.stemMat);
    for (let i = 1; i <= nodes; i++) {
      const t = i / (nodes + 0.6);
      const p = [Math.cos(a) * lean * H * t * 2, H * t, Math.sin(a) * lean * H * t * 2];
      const sz = o.leafScale(t);
      const lg = leafGeo(o.len * sz, o.wid * sz, o.cup ?? 0.4, o.droop ?? 0.25, o.tip ?? 0.2);
      const rot = i * (Math.PI / 2) + a;
      const mat = o.leafMat || PM.leaf;
      placeLeaf(g, lg, mat, p, rot, -0.5 - (1 - t) * 0.2);
      placeLeaf(g, lg, mat, p, rot + Math.PI, -0.5 - (1 - t) * 0.2);
    }
    const tipP = [Math.cos(a) * lean * H * 2, H, Math.sin(a) * lean * H * 2];
    const tg = leafGeo(o.len * 0.45, o.wid * 0.45, 0.6, 0, 0.2);
    for (let i = 0; i < 3; i++) placeLeaf(g, tg, o.leafMat || PM.leaf, tipP, i * 2.1, -1.0);
    if (o.onTip) o.onTip(tipP, s);
  }
}

const PLANT_BUILDERS = {
  basil(g, full, R) {
    herb(g, R, { stems: 3, h: 0.75, nodes: 4, len: 0.26, wid: 0.17, cup: 0.8, droop: 0.15, leafMat: M('#4CB548'), leafScale: t => 1.1 - t * 0.4,
      onTip: (p) => { if (full) for (let i = 0; i < 4; i++) ell(g, M('#F4F0FF'), 0.018, 0.022, 0.018, p[0] + (R() - .5) * .04, p[1] + 0.05 + i * 0.035, p[2], 8); } });
  },
  perilla(g, full, R) {
    herb(g, R, { stems: 3, h: 0.8, nodes: 3, len: 0.36, wid: 0.3, cup: 0.25, droop: 0.3, tip: 0.3, leafMat: M('#3E8E3A'), leafScale: t => 1.15 - t * 0.5 });
  },
  mint(g, full, R) {
    herb(g, R, { stems: 5, h: 0.6, nodes: 5, len: 0.17, wid: 0.12, cup: 0.5, droop: 0.2, leafMat: M('#58C46A'), leafScale: t => 1.05 - t * 0.3,
      onTip: (p) => { if (full) ell(g, M('#D6B8F2'), 0.025, 0.06, 0.025, p[0], p[1] + 0.06, p[2], 8); } });
  },
  lettuce(g, full, R) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = i / n, inner = i > 9;
      const lg = leafGeo(inner ? 0.26 : 0.42, inner ? 0.2 : 0.3, 0.9, 0.35, -0.2);
      placeLeaf(g, lg, inner ? M('#B6E36B') : M('#8DCC4C'), [0, 0.02 + t * 0.08, 0], i * 2.4, inner ? -1.15 : -0.6 + t * -0.4);
    }
    ell(g, M('#C9EC86'), 0.08, 0.12, 0.08, 0, 0.12, 0);
  },
  tomato(g, full, R) {
    const H = 1.25;
    stemTo(g, [[0, 0, 0], [0.03, 0.4, 0], [-0.02, 0.85, 0.02], [0.02, H, 0]], 0.042, M('#6BA23F'));
    const lm = M('#3F9440');
    for (let i = 0; i < 6; i++) {
      const y = 0.2 + i * 0.17, a = i * 2.3;
      const end = [Math.cos(a) * 0.32, y + 0.08, Math.sin(a) * 0.32];
      stemTo(g, [[0, y, 0], [end[0] * 0.5, y + 0.08, end[2] * 0.5], end], 0.012, M('#6BA23F'));
      for (let j = 0; j < 3; j++) { const lg = leafGeo(0.19, 0.11, 0.35, 0.3, 0.3); placeLeaf(g, lg, lm, [end[0] * (0.45 + j * 0.27), y + 0.06 + j * 0.01, end[2] * (0.45 + j * 0.27)], a + (j - 1) * 0.6 + Math.PI / 2, -0.3); }
    }
    if (full) {
      const tm = M('#E8352B', { r: 0.4, rim: 0.25 });
      for (let c = 0; c < 3; c++) {
        const a = c * 2.1 + 0.5, y = 0.45 + c * 0.25;
        const base = [Math.cos(a) * 0.2, y, Math.sin(a) * 0.2];
        for (let j = 0; j < 3; j++) { const p = [base[0] + Math.cos(a) * j * 0.07 + (j % 2) * 0.07, base[1] - j * 0.12, base[2] + Math.sin(a) * j * 0.07 + 0.05 - (j % 2) * 0.04]; ell(g, j === 2 ? M('#F59A3A', { r: 0.4 }) : tm, 0.085, 0.08, 0.085, ...p, 16); ell(g, M('#3F9440'), 0.03, 0.01, 0.03, p[0], p[1] + 0.058, p[2], 8); }
      }
      for (let i = 0; i < 3; i++) flower5(g, [Math.cos(i * 2) * 0.25, 1.0 + i * 0.07, Math.sin(i * 2) * 0.25], '#FFD93A', '#E0A21A', 0.05);
    }
  },
  pepper(g, full, R) {
    herb(g, R, { stems: 3, h: 0.8, nodes: 4, len: 0.25, wid: 0.13, cup: 0.3, droop: 0.3, tip: 0.4, leafMat: M('#2F7D34'), leafScale: t => 1 - t * 0.3, stemMat: M('#5F9A39') });
    if (full) {
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05, r = 0.15 + R() * 0.1, y = 0.35 + R() * 0.35;
        const p = add(g, new THREE.ConeGeometry(0.05, 0.26, 12), M(i % 3 === 2 ? '#3E9A3A' : '#D92B1F', { r: 0.35, rim: 0.2 }), Math.cos(a) * r, y, Math.sin(a) * r);
        p.rotation.set(Math.PI + (R() - .5) * 0.5, 0, (R() - .5) * 0.6);
      }
      for (let i = 0; i < 3; i++) flower5(g, [Math.cos(i * 2.2) * 0.18, 0.7, Math.sin(i * 2.2) * 0.18], '#FFFFFF', '#E9D24A', 0.04);
    }
  },
  strawberry(g, full, R) {
    const lm = M('#3C9A45');
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, len = 0.3 + R() * 0.1;
      const end = [Math.cos(a) * len * 0.6, len, Math.sin(a) * len * 0.6];
      stemTo(g, [[0, 0, 0], [end[0] * 0.4, len * 0.6, end[2] * 0.4], end], 0.012, M('#7DAA45'));
      for (let j = 0; j < 3; j++) { const lg = leafGeo(0.17, 0.13, 0.5, 0.1, -0.1); placeLeaf(g, lg, lm, end, a + (j - 1) * 0.9, -0.5); }
    }
    if (full) {
      const sm = M('#E8243A', { r: 0.35, rim: 0.25 }), dot = M('#FFE27A', { nobump: true });
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + 0.4;
        const p = [Math.cos(a) * 0.42, 0.06 + i * 0.03, Math.sin(a) * 0.42];
        stemTo(g, [[Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1], [Math.cos(a) * 0.3, 0.25, Math.sin(a) * 0.3], [p[0], p[1] + 0.12, p[2]]], 0.008, M('#7DAA45'));
        const fr = new THREE.Group(); fr.position.set(...p); g.add(fr);
        const c = add(fr, new THREE.SphereGeometry(0.07, 16, 12), sm); c.scale.set(1, 1.25, 1); fr.scale.setScalar(1.35);
        const cone = add(fr, new THREE.ConeGeometry(0.068, 0.09, 16), sm, 0, -0.08, 0); cone.rotation.x = Math.PI;
        for (let d = 0; d < 10; d++) ell(fr, dot, 0.008, 0.008, 0.008, Math.cos(d * 1.9) * 0.066, -0.06 + (d % 5) * 0.025, Math.sin(d * 1.9) * 0.066, 6);
        for (let s = 0; s < 5; s++) placeLeaf(fr, leafGeo(0.05, 0.025, 0.2, -0.3), lm, [0, 0.08, 0], s * 1.25, -0.2);
      }
      for (let i = 0; i < 2; i++) flower5(g, [Math.cos(i * 3) * 0.2, 0.38, Math.sin(i * 3) * 0.2], '#FFFFFF', '#F2C531', 0.06);
    }
  },
  bean(g, full, R) {
    stemTo(g, [[0, 0, 0], [0.05, 0.35, 0], [-0.04, 0.7, 0.02], [0.02, 1.0, 0]], 0.034, M('#78A83F'));
    const lm = M('#55A63F');
    for (let i = 0; i < 4; i++) {
      const y = 0.25 + i * 0.22, a = i * 2.5;
      const end = [Math.cos(a) * 0.2, y + 0.05, Math.sin(a) * 0.2];
      stemTo(g, [[0, y, 0], end], 0.01, M('#78A83F'));
      for (let j = 0; j < 3; j++) placeLeaf(g, leafGeo(0.26, 0.2, 0.3, 0.35, 0.4), lm, end, a + (j - 1) * 1.1, -0.35);
    }
    if (full) {
      const pm = M('#7CC34A', { r: 0.5 });
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3, y = 0.35 + i * 0.12;
        const pod = add(g, tube([[0, 0, 0], [0.02, -0.1, 0.02], [0.0, -0.24, 0.06]], 0.032, 8, 8), pm, Math.cos(a) * 0.12, y, Math.sin(a) * 0.12);
        pod.rotation.y = a;
      }
      for (let i = 0; i < 3; i++) flower5(g, [Math.cos(i * 2) * 0.1, 0.85 + i * 0.05, Math.sin(i * 2) * 0.1], '#FBE0EE', '#E6A1C3', 0.04);
    }
  },
  sunflower(g, full, R) {
    const H = 1.35;
    stemTo(g, [[0, 0, 0], [0.03, H * 0.4, 0], [-0.02, H * 0.8, 0.02], [0, H, 0.05]], 0.055, M('#6FA640'));
    const lm = M('#4E9E3E');
    for (let i = 0; i < 6; i++) placeLeaf(g, leafGeo(0.32 - i * 0.03, 0.22 - i * 0.015, 0.2, 0.4, 0.5), lm, [0, 0.2 + i * 0.18, 0], i * 2.4, -0.4);
    if (full) {
      flowerDaisy(g, [0, H + 0.02, 0.06], { petal: '#FFC91A', petal2: '#FFB000', center: '#6B3E1E', n: 18, len: 0.3, wid: 0.09, cr: 0.21, layers: 2, face: [1.25, 0] });
    } else {
      ell(g, M('#7FB54A'), 0.1, 0.06, 0.1, 0, H, 0.03);
    }
  },
  marigold(g, full, R) {
    herb(g, R, { stems: 5, h: 0.55, nodes: 4, len: 0.16, wid: 0.06, cup: 0.1, droop: 0.2, tip: 0.5, leafMat: M('#3D8A3C'), leafScale: t => 1,
      onTip: (p, s) => {
        if (!full) return;
        const col = ['#F38A1A', '#FFB81C', '#F06A12', '#FFC93C'][s % 4];
        const f = new THREE.Group(); f.position.set(p[0], p[1] + 0.07, p[2]); g.add(f);
        const pm = M(col, { rim: 0.18 });
        f.scale.setScalar(1.4); ell(f, pm, 0.1, 0.075, 0.1, 0, 0, 0, 16);
        for (let i = 0; i < 16; i++) { const a = i * 2.4, b = (i % 4) * 0.3; ell(f, pm, 0.04, 0.025, 0.04, Math.cos(a) * 0.08 * Math.cos(b), 0.02 + Math.sin(b) * 0.06, Math.sin(a) * 0.08 * Math.cos(b), 10); }
      } });
  },
  zinnia(g, full, R) {
    herb(g, R, { stems: 4, h: 0.75, nodes: 3, len: 0.21, wid: 0.085, cup: 0.2, droop: 0.2, tip: 0.5, leafMat: M('#469A3F'), leafScale: t => 1 - t * 0.2,
      onTip: (p, s) => {
        if (!full) return;
        const cols = [['#F0468C', '#FF7AB0'], ['#FF6F3C', '#FF9466'], ['#E83E8C', '#FF8AC0']][s % 3];
        flowerDaisy(g, [p[0], p[1] + 0.04, p[2]], { petal: cols[0], petal2: cols[1], center: '#E9B22B', n: 14, len: 0.15, wid: 0.06, cr: 0.05, layers: 3 });
      } });
  },
  nasturtium(g, full, R) {
    const lm = M('#7DBF4C', { rim: 0.15 }), sm = M('#8CBF57');
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4, r = 0.12 + R() * 0.3, h = 0.2 + R() * 0.3;
      const end = [Math.cos(a) * r, h, Math.sin(a) * r];
      stemTo(g, [[0, 0, 0], [end[0] * 0.5, h * 0.8, end[2] * 0.5], end], 0.01, sm);
      const disc = add(g, cyl(0.13 + R() * 0.04, 0.13, 0.02, 20), lm, ...end); disc.rotation.set((R() - .5) * 0.6, 0, (R() - .5) * 0.6);
      ell(g, M('#B6DE8B', { nobump: true }), 0.015, 0.012, 0.015, end[0], end[1] + 0.01, end[2], 6);
    }
    if (full) for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.3, r = 0.2 + R() * 0.2;
      flower5(g, [Math.cos(a) * r, 0.45 + R() * 0.15, Math.sin(a) * r], i % 2 ? '#FF7A1A' : '#F0461F', '#FFD23A', 0.11, [0.9, a + Math.PI / 2]);
    }
  },
  rosemary(g, full, R) {
    const wood = M('#7C6A4A'), needle = M('#4F7C5C');
    const ng = leafGeo(0.1, 0.022, 0, 0, 0.4);
    for (let s = 0; s < 8; s++) {
      const a = s * 0.8, lean = 0.06 + R() * 0.08, H = 0.65 + R() * 0.3;
      const top = [Math.cos(a) * lean * 3, H, Math.sin(a) * lean * 3];
      stemTo(g, [[0, 0, 0], [top[0] * 0.4, H * 0.5, top[2] * 0.4], top], 0.02, wood);
      for (let i = 0; i < 16; i++) { const t = 0.15 + i / 16 * 0.85; placeLeaf(g, ng, needle, [top[0] * t, H * t, top[2] * t], i * 2.2, -0.9); }
      if (full && s % 2 === 0) for (let i = 0; i < 3; i++) ell(g, M('#8FA8F2'), 0.018, 0.015, 0.018, top[0] * (0.7 + i * 0.1), H * (0.7 + i * 0.1), top[2] * (0.7 + i * 0.1) + 0.02, 8);
    }
  },
  catgrass(g, full, R) {
    const cols = [M('#7FCB45'), M('#96D85A'), M('#69B93C')];
    const n = full ? 46 : 28;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, r = Math.sqrt(i / n) * 0.3;
      const h = 0.45 + R() * 0.35, bend = (R() - 0.3) * 0.2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const blade = add(g, tube([[x, 0, z], [x * 1.1, h * 0.5, z * 1.1], [x * 1.25 + bend, h, z * 1.25 + bend * 0.5]], 0.017, 6, 4), cols[i % 3]);
      blade.scale.set(1, 1, 1);
    }
  },
  radish(g, full, R) {
    const lm = M('#55A845');
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      stemTo(g, [[0, 0.05, 0], [Math.cos(a) * 0.06, 0.2, Math.sin(a) * 0.06], [Math.cos(a) * 0.12, 0.32, Math.sin(a) * 0.12]], 0.01, M('#B5487A'));
      placeLeaf(g, leafGeo(0.32, 0.14, 0.35, 0.3, 0.2), lm, [Math.cos(a) * 0.12, 0.32, Math.sin(a) * 0.12], a + Math.PI / 2, -0.7);
    }
    if (full) {
      ell(g, M('#E0254F', { r: 0.35, rim: 0.25 }), 0.18, 0.16, 0.18, 0, 0.06, 0, 20);
      ell(g, M('#FFF3F3'), 0.03, 0.05, 0.03, 0, -0.08, 0);
    }
  },
  clover(g, full, R) {
    const lm = M('#4FB55A', { rim: 0.16 }), lm2 = M('#6CC96A', { rim: 0.16 }), sm = M('#86C25E');
    const n = full ? 20 : 12;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, r = 0.06 + Math.sqrt(i / n) * 0.3, h = 0.2 + R() * 0.26;
      const end = [Math.cos(a) * r, h, Math.sin(a) * r];
      stemTo(g, [[Math.cos(a) * r * 0.2, 0, Math.sin(a) * r * 0.2], [end[0] * 0.7, h * 0.7, end[2] * 0.7], end], 0.012, sm);
      const k = (full && i === 5) ? 4 : 3;
      const tilt = (R() - 0.5) * 0.5;
      for (let j = 0; j < k; j++) {
        const b = j / k * Math.PI * 2 + a;
        const lf = ell(g, i % 3 ? lm : lm2, 0.075, 0.014, 0.075, end[0] + Math.cos(b) * 0.065, end[1] + Math.sin(b) * tilt * 0.03, end[2] + Math.sin(b) * 0.065, 12);
      }
      ell(g, M('#B6E3A0', { nobump: true }), 0.018, 0.012, 0.018, end[0], end[1] + 0.008, end[2], 6);
    }
    if (full) for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + 0.4, r = 0.12 + R() * 0.12, h = 0.5 + R() * 0.12;
      stemTo(g, [[Math.cos(a) * r * 0.3, 0, Math.sin(a) * r * 0.3], [Math.cos(a) * r, h, Math.sin(a) * r]], 0.011, sm);
      ell(g, M('#FFF6F8', { rim: 0.2 }), 0.07, 0.065, 0.07, Math.cos(a) * r, h + 0.04, Math.sin(a) * r, 12);
      for (let j = 0; j < 7; j++) ell(g, M('#FFE3EC'), 0.022, 0.03, 0.022, Math.cos(a) * r + Math.cos(j * 0.9) * 0.055, h + 0.05 + (j % 3) * 0.018, Math.sin(a) * r + Math.sin(j * 0.9) * 0.055, 6);
    }
  },
  cotton(g, full, R) {
    const wood = M('#8A6B4A'), lm = M('#5FA548');
    stemTo(g, [[0, 0, 0], [0.03, 0.4, 0], [-0.02, 0.8, 0.02], [0.01, 1.05, 0]], 0.036, wood);
    for (let i = 0; i < 6; i++) {
      const y = 0.2 + i * 0.15, a = i * 2.4; const end = [Math.cos(a) * 0.26, y + 0.06, Math.sin(a) * 0.26];
      stemTo(g, [[0, y, 0], end], 0.012, M('#7FA050'));
      for (let j = -1; j <= 1; j++) placeLeaf(g, leafGeo(0.2 - Math.abs(j) * 0.04, 0.13, 0.3, 0.3, 0.4), lm, end, Math.PI / 2 - a + j * 0.7, -0.35);
    }
    if (full) {
      const fl = M('#FFFFFF', { rim: 0.2 });
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + 0.3, r = 0.2 + (i % 2) * 0.1, y = 0.5 + i * 0.13; const q = [Math.cos(a) * r, y, Math.sin(a) * r];
        stemTo(g, [[0, y - 0.1, 0], q], 0.012, wood);
        for (let k = 0; k < 4; k++) ell(g, fl, 0.075, 0.075, 0.075, q[0] + Math.cos(k * 1.57) * 0.055, q[1] + 0.06, q[2] + Math.sin(k * 1.57) * 0.055, 12);
        ell(g, fl, 0.065, 0.065, 0.065, q[0], q[1] + 0.12, q[2], 12);
        for (let k = 0; k < 4; k++) { const b = k * 1.57 + 0.78; ell(g, wood, 0.03, 0.02, 0.05, q[0] + Math.cos(b) * 0.075, q[1] + 0.01, q[2] + Math.sin(b) * 0.075, 6); }
      }
    } else flower5(g, [0.1, 0.95, 0.1], '#FFF1A8', '#F2C531', 0.09);
  },
  portulaca(g, full, R) {
    const sm = M('#B0476A'), lm = M('#78B84E', { rim: 0.2 });
    const lg = new THREE.CylinderGeometry(0.018, 0.026, 0.12, 6);
    const cols = ['#FF4FA5', '#FFD23A', '#FF7A2E', '#FFFFFF', '#E0306A', '#FF9ACD'];
    for (let s = 0; s < 8; s++) {
      const a = s * 0.79, r = 0.32;
      const end = [Math.cos(a) * r, 0.12 + R() * 0.08, Math.sin(a) * r];
      stemTo(g, [[0, 0.02, 0], [end[0] * 0.5, 0.12, end[2] * 0.5], end], 0.012, sm);
      for (let i = 0; i < 6; i++) { const t = 0.3 + i / 6 * 0.7; const n = add(g, lg, lm, end[0] * t, 0.06 + end[1] * t, end[2] * t); n.rotation.set(R() * 2, R() * 6, R() * 2); }
      if (full) flower5(g, [end[0], end[1] + 0.04, end[2]], cols[s % cols.length], '#FFE14A', 0.1);
    }
  },
};

// ═════════════════ 땀땀이 (실제 CAD 조립품 기반) ═════════════════
let TTAMI_SRC = null;
const TTAMI_INFO = {
  center: new THREE.Vector3(0.0061, 0, -0.006), floorY: -0.0321,
  hole: new THREE.Vector3(-0.024, 0.104, 0.004), holeR: 0.05,
  dropHideY: -0.046,
};
const TTAMI_MATS = {
  top: M('#F3D3B7', { rim: 0.12, r: 0.65, bump: 0.35 }),
  bottom: M('#E97B42', { rim: 0.12, r: 0.65, bump: 0.35 }),
  mid: M('#F0D3BB', { r: 0.7 }),
  eye: M('#3D2419', { r: 0.35, nobump: true }),
  drop: M('#3BA8F0', { r: 0.25, rim: 0.35, nobump: true }),
  dark: M('#2C2C30', { r: 0.5 }), board: M('#2F6B4A'), motor: M('#2F6DD6'), metal: M('#B8B8C0', { r: 0.4 }),
};
function loadTtamiModel(cb) {
  const done = (scene) => { TTAMI_SRC = scene; cb && cb(); };
  if (window.TTAMI_GLB) {
    const bin = atob(window.TTAMI_GLB); const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer, '', (gl) => done(gl.scene), (e) => { console.error(e); done(makeTtamiPlaceholder()); });
    return;
  }
  // 정적 사이트 버전: 모델 파일을 assets/models/ttami.glb 에 두면 자동으로 불러와요
  new THREE.GLTFLoader().load('assets/models/ttami.glb', (gl) => done(gl.scene), undefined, () => {
    console.warn('[물줄때] assets/models/ttami.glb 파일이 없어 임시 땀땀이 모형을 씁니다.');
    done(makeTtamiPlaceholder());
  });
}
// 모델 파일이 없을 때 쓰는 임시 모형 (부품 이름은 실제 CAD 모델과 같게 맞춤)
function makeTtamiPlaceholder() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial();
  const cx = TTAMI_INFO.center.x, cz = TTAMI_INFO.center.z, fy = TTAMI_INFO.floorY;
  const add = (name, geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(x, y, z); g.add(m); return m; };
  add('하단부', new THREE.CylinderGeometry(0.078, 0.07, 0.075, 40), cx, fy + 0.0375, cz);
  add('상단부', new THREE.CylinderGeometry(0.08, 0.078, 0.06, 40), cx, fy + 0.105, cz);
  add('가림막', new THREE.TorusGeometry(0.079, 0.004, 8, 40).rotateX(Math.PI / 2), cx, fy + 0.075, cz);
  add('눈_L', new THREE.SphereGeometry(0.008, 16, 12), cx - 0.025, fy + 0.11, cz + 0.077);
  add('눈_R', new THREE.SphereGeometry(0.008, 16, 12), cx + 0.025, fy + 0.11, cz + 0.077);
  add('물방울', new THREE.SphereGeometry(0.016, 20, 16).scale(1, 1.3, 1), TTAMI_INFO.hole.x + 0.045, TTAMI_INFO.hole.y + 0.02, TTAMI_INFO.hole.z);
  return g;
}
function partKind(name) {
  if (name.includes('물방울')) return 'drop';
  if (name.includes('상단부')) return 'top';
  if (name.includes('하단부')) return 'bottom';
  if (name.includes('가림막')) return 'mid';
  if (name.includes('눈')) return 'eye';
  if (name.includes('센서')) return 'sensor';
  if (name.includes('서보') || name.includes('스플라인')) return 'motor';
  if (name.includes('분배') ) return 'board';
  return 'other';
}
// ── 하단부 물받침대(서랍) ──
// 원본 CAD「1-0. 화분 외형 - 하단부-물받침대.stp」의 치수로 빚은 반원 고리 모양 서랍.
// CAD 서랍 좌표(x_d, y_d, z_d, mm) → 하단부 좌표: x = -z_d, y = y_d - 50, z = x_d
// (서랍과 하단부의 맞춤 핀 Ø4.8 두 개가 이 변환으로 정확히 겹쳐요). 서랍은 하단부의 -x 쪽 절반에 들어가고 -x 방향으로 빠져요.
const TRAY = {
  inR: 80, wallIn: 83, floorTop: 13, floorBot: 10, top: 50, // mm (CAD 서랍 좌표)
  outer: (y) => 55 + Math.sqrt(Math.max(0, 50 * 50 - (50 - y) ** 2)), // 바깥 곡면: 토러스 R55 r50
  inner: (y) => 55 + Math.sqrt(Math.max(0, 47 * 47 - (50 - y) ** 2)), // 안쪽 곡면(벽 두께 3mm)
  waterFull: 26, waterEmpty: 13.3,
};
function trayLathe(pts) { // pts: [[r, y_d], ...] mm → 하단부 좌표(m)의 반바퀴 회전체 (-x 쪽)
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r / 1000, (y - 50) / 1000)), 48, Math.PI, Math.PI);
}
function makeTrayGeometry() {
  const T = TRAY, arc = (f, y0, y1, n) => Array.from({ length: n + 1 }, (_, i) => { const y = y0 + (y1 - y0) * i / n; return [f(y), y]; });
  const outerArc = arc(T.outer, T.floorBot, T.top, 14), innerArc = arc(T.inner, T.top, T.floorTop, 14);
  const pieces = [
    [[T.inR, T.floorBot], [T.outer(T.floorBot), T.floorBot]], // 바닥 아랫면
    outerArc,                                                  // 바깥 곡면
    [[T.outer(T.top), T.top], [T.inner(T.top), T.top]],        // 바깥 테두리 윗면
    innerArc,                                                  // 안쪽 곡면
    [[T.inner(T.floorTop), T.floorTop], [T.wallIn, T.floorTop]], // 안쪽 바닥
    [[T.wallIn, T.floorTop], [T.wallIn, T.top]],               // 안쪽 벽(가운데 기둥 쪽)
    [[T.wallIn, T.top], [T.inR, T.top]],                       // 안쪽 벽 윗면
    [[T.inR, T.top], [T.inR, T.floorBot]],                     // 가운데 기둥에 닿는 면 (CAD R80)
  ].map(trayLathe);
  // 양 끝 단면 막기
  const prof = [[T.inR, T.floorBot], ...outerArc, ...innerArc, [T.wallIn, T.floorTop], [T.wallIn, T.top], [T.inR, T.top]];
  const shape = new THREE.Shape(prof.map(([r, y]) => new THREE.Vector2(r / 1000, (y - 50) / 1000)));
  pieces.push(new THREE.ShapeGeometry(shape).rotateY(Math.PI / 2), new THREE.ShapeGeometry(shape).rotateY(-Math.PI / 2));
  // 앞쪽 손잡이
  const grip = new THREE.SphereGeometry(1, 20, 14).scale(0.004, 0.006, 0.022).translate(-T.outer(38) / 1000 + 0.001, -0.012, 0);
  pieces.push(grip);
  return THREE.BufferGeometryUtils.mergeBufferGeometries(pieces, false); // 조각마다 자기 법선을 유지해 매끈하게
}
function makeTrayWaterGeometry(level) { // level: CAD 서랍 높이(mm)
  const h = Math.max(TRAY.waterEmpty, level);
  return trayLathe([[TRAY.wallIn + 0.3, h], [TRAY.inner(h) - 0.3, h]]);
}
// 하단부 메시 옆에 서랍을 달아요. 슬라이드·기울기를 위해 그룹을 겹쳐 둬요.
function addTtamiDrawer(bottomMesh, material, opts = {}) {
  const slide = new THREE.Group(); slide.name = '물받침대_슬라이드';
  const tilt = new THREE.Group(); tilt.position.set(-TRAY.outer(TRAY.floorBot) / 1000, (TRAY.floorBot - 50) / 1000, 0); slide.add(tilt);
  const body = new THREE.Mesh(makeTrayGeometry(), material); body.name = '하단부_물받침대';
  body.position.copy(tilt.position).negate(); body.castShadow = true; body.receiveShadow = true; tilt.add(body);
  let water = null;
  if (opts.water) {
    water = new THREE.Mesh(makeTrayWaterGeometry(TRAY.waterEmpty), new THREE.MeshStandardMaterial({ color: '#3FA6F2', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
    water.name = '물받침대_물'; water.visible = false; body.add(water);
  }
  bottomMesh.add(slide);
  return { slide, tilt, body, water };
}
function makeTtami(scale, opts = {}) {
  const root = new THREE.Group();
  const inner = TTAMI_SRC.clone(true);
  const off = new THREE.Group(); off.add(inner);
  off.position.set(-TTAMI_INFO.center.x, -TTAMI_INFO.floorY, -TTAMI_INFO.center.z);
  const sc = new THREE.Group(); sc.scale.setScalar(scale); sc.add(off); root.add(sc);
  let drop = null, bottom = null;
  inner.traverse(o => {
    if (!o.isMesh) return;
    const k = partKind(o.name);
    o.castShadow = true; o.receiveShadow = true;
    if (opts.viewer) { o.material = VIEW_MATS[k] || VIEW_MATS.other; }
    else {
      if (['top', 'bottom', 'eye', 'drop'].includes(k)) o.material = TTAMI_MATS[k];
      else if (k === 'mid') o.material = TTAMI_MATS.mid;
      else if (k === 'sensor') { o.material = TTAMI_MATS.dark; }
      else o.visible = false;
    }
    if (k === 'drop') drop = o;
    if (k === 'bottom' && !bottom) bottom = o;
  });
  const drawer = bottom ? addTtamiDrawer(bottom, bottom.material, { water: !!opts.viewer }) : null;
  // 흙
  const holeLocal = TTAMI_INFO.hole.clone().sub(new THREE.Vector3(TTAMI_INFO.center.x, TTAMI_INFO.floorY, TTAMI_INFO.center.z));
  let soil = null, anchor = new THREE.Group();
  if (!opts.viewer) {
    soil = new THREE.Mesh(cyl(TTAMI_INFO.holeR * scale, TTAMI_INFO.holeR * scale * 0.9, 0.02 * scale, 28), PM.soil);
    soil.position.copy(holeLocal).multiplyScalar(scale); soil.receiveShadow = true; root.add(soil);
    anchor.position.copy(holeLocal).multiplyScalar(scale); anchor.position.y += 0.01 * scale; root.add(anchor);
  }
  const dropBase = drop ? drop.position.clone() : new THREE.Vector3();
  root.userData = { drop, dropBase, drawer, anchor, soil, scale, dropT: 0, dropTarget: 0, plant: null, plantId: null, stage: -1 };
  setTtamiDrop(root, 0, true);
  return root;
}
function setTtamiDrop(t, v, instant) { // v: 0 숨김 ~ 1 올라옴
  t.userData.dropTarget = v; if (instant) t.userData.dropT = v;
  const u = t.userData; if (!u.drop) return;
  u.drop.position.y = u.dropBase.y + TTAMI_INFO.dropHideY * (1 - u.dropT);
}
function updateTtami(t, dt, time) {
  const u = t.userData;
  u.dropT += (u.dropTarget - u.dropT) * Math.min(1, dt * 3);
  if (u.drop) u.drop.position.y = u.dropBase.y + TTAMI_INFO.dropHideY * (1 - u.dropT) + (u.dropT > 0.9 ? Math.sin(time * 5) * 0.002 : 0);
}
function setTtamiPlant(t, id, stage, plantScale) {
  const u = t.userData;
  if (u.plant) { u.anchor.remove(u.plant); u.plant = null; }
  u.plantId = id; u.stage = stage;
  if (id == null || stage < 0) return null;
  let p = buildPlant(id, stage);
  if (stage >= 2) p = mergeByMaterial(p);
  p.scale.setScalar(plantScale);
  u.anchor.add(p); u.plant = p;
  return p;
}
// 뷰어용(내부 부품까지 보이는) 재질
const VIEW_MATS = (() => {
  const mk = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.6, metalness: o.m ?? 0, side: THREE.DoubleSide, clippingPlanes: [], clipShadows: true });
  return { top: mk('#F5DCC6'), bottom: mk('#EE8A55'), mid: mk('#F0D3BB'), eye: mk('#3D2419', { r: 0.3 }), drop: mk('#3BA8F0', { r: 0.25 }),
    sensor: mk('#26272B', { r: 0.45 }), motor: mk('#2F6DD6', { r: 0.45 }), board: mk('#2E7D4F', { r: 0.5 }), other: mk('#9A9AA2', { r: 0.4, m: 0.3 }) };
})();

