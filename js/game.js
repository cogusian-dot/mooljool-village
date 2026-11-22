// 물줄때 마을 · 게임 진행·조작·대화·퀘스트
// 원본 단일 파일 index.html 2350–3597행에서 옮김
// 물줄때 마을 — 게임 진행
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = { out: t => 1 - Math.pow(1 - t, 3), inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1 };

const TTAMI_SCALE = 18, PLANT_SCALE_BIG = 3.0, MINI_SCALE = 6.5, PLANT_SCALE_MINI = 1.2;
const SPAWN = V3(0, 0, 6.5);

const G = {
  mode: 'loading', render3D: true,
  name: '', charId: null, seedId: null, completed: new Set(),
  player: null, pos: SPAWN.clone(), yaw: Math.PI, speed: 0,
  ttami: null, floatDrop: null, npcs: [], pickups: [], particles: [], tweens: [],
  inv: { apple: 0, water: 0, crystal: 0, nutrient: 0 }, flags: {}, posY: 0, onHill: false, inPlaza: false,
  stage: 0, reqIdx: 0, given: { w: 0, n: 0 }, requestActive: false,
  keys: {}, joy: { x: 0, y: 0 }, busy: false,
  cam: { pos: V3(0, 14, 22), look: V3(0, 1, 0), mode: 'follow', tPos: V3(), tLook: V3(), k: 3 },
  shake: 0, treeShake: 0, swing: 0, swingTool: null, t: 0, stepPh: 0,
  hint: '',
};
const MAX_WATER = 8;
const ICON = {
  ladder: '<svg viewBox="0 0 32 32" width="32" height="32"><g fill="none" stroke-linecap="round"><path d="M10 3v26M22 3v26" stroke="#B5763A" stroke-width="3.4"/><path d="M10 8h12M10 14h12M10 20h12M10 26h12" stroke="#DDA661" stroke-width="3"/></g></svg>',
};

// ═════════ 트윈 ═════════
function tween(dur, fn, easing = ease.out) {
  return new Promise(res => G.tweens.push({ t: 0, dur, fn, easing, res }));
}
function updateTweens(dt) {
  for (let i = G.tweens.length - 1; i >= 0; i--) {
    const tw = G.tweens[i]; tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.easing(k), k);
    if (k >= 1) { G.tweens.splice(i, 1); tw.res(); }
  }
}

// ═════════ 파티클 ═════════
const PART_GEO = { sph: sphereGeo(8), oct: new THREE.OctahedronGeometry(1, 0), box: new THREE.BoxGeometry(1, 1, 1) };
function burst(kind, pos, n = 12, o = {}) {
  for (let i = 0; i < n; i++) {
    let geo = PART_GEO.sph, mat, s = 0.12, life = 0.9, vel = V3((Math.random() - .5) * 4, 2 + Math.random() * 4, (Math.random() - .5) * 4), grav = -9, spin = 0;
    if (kind === 'sparkle') { geo = PART_GEO.oct; mat = M(['#FFF6A8', '#FFFFFF', '#FFE06B', '#BFF3FF'][i % 4], { em: '#FFF2A0', ei: 0.9, nobump: true }); s = 0.09 + Math.random() * 0.08; grav = -2; vel.multiplyScalar(0.7); life = 1.1; spin = 6; }
    if (kind === 'leaf') { mat = M(['#5DB34F', '#7CCB5E', '#4FA548'][i % 3]); s = 0.12; grav = -3; vel.set((Math.random() - .5) * 3, Math.random() * 1.5, (Math.random() - .5) * 3); life = 1.8; spin = 4; }
    if (kind === 'splash') { mat = M('#7CCDF2', { r: 0.2, nobump: true, rim: 0.3 }); s = 0.08 + Math.random() * 0.08; vel.set((Math.random() - .5) * 3, 3 + Math.random() * 3, (Math.random() - .5) * 3); life = 0.9; grav = -14; }
    if (kind === 'tear') { mat = M('#6CC4F5', { r: 0.2, nobump: true, rim: 0.3 }); s = 0.06; vel.set((Math.random() - .5) * 0.3, 2.3 + Math.random() * 0.5, (Math.random() - .5) * 0.3); grav = -9; life = 0.85; }
    if (o.vel) vel.add(o.vel);
    if (kind === 'puff') { mat = M('#FFFFFF', { nobump: true, rim: 0 }); s = 0.25; vel.set((Math.random() - .5) * 2, 0.6 + Math.random(), (Math.random() - .5) * 2); grav = 0; life = 0.6; }
    if (kind === 'rock') { mat = M('#B9B3AA'); s = 0.12 + Math.random() * 0.1; grav = -16; life = 0.8; }
    if (kind === 'confetti') { geo = PART_GEO.box; mat = M(['#FF6B8B', '#FFD23A', '#6BC4F0', '#7CC46E', '#B98CFF', '#FF9E5E'][i % 6], { nobump: true }); s = 0.14; vel.set((Math.random() - .5) * 7, 6 + Math.random() * 6, (Math.random() - .5) * 7); grav = -7; life = 2.6; spin = 8; }
    if (kind === 'heart') { mat = M('#FF7FA8', { nobump: true }); s = 0.1; grav = 1; vel.set((Math.random() - .5) * 1.5, 1.5, (Math.random() - .5) * 1.5); life = 1.2; }
    const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.scale.setScalar(s * (o.scale || 1));
    if (kind === 'leaf') m.scale.set(s, s * 0.3, s * 1.6);
    if (kind === 'tear') m.scale.set(s, s * 1.35, s);
    m.castShadow = false; W.scene.add(m);
    G.particles.push({ m, vel, grav, life, age: 0, s: m.scale.clone(), spin, kind });
  }
}
function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i]; p.age += dt;
    if (p.kind === 'leaf') { p.vel.x += Math.sin(p.age * 5) * dt * 3; }
    p.vel.y += p.grav * dt; p.m.position.addScaledVector(p.vel, dt);
    if (p.m.position.y < 0.05 && p.kind !== 'sparkle') { p.m.position.y = 0.05; p.vel.y *= -0.3; p.vel.x *= 0.7; p.vel.z *= 0.7; }
    if (p.spin) { p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt * 0.7; }
    const k = 1 - p.age / p.life;
    const sc = p.kind === 'puff' ? 1 + p.age * 3 : Math.max(0, Math.min(1, k * 2.5));
    p.m.scale.copy(p.s).multiplyScalar(p.kind === 'puff' ? sc * Math.max(0, k) : sc);
    if (p.age >= p.life) { W.scene.remove(p.m); G.particles.splice(i, 1); }
  }
}

// ═════════ 물방울(머리 위) ═════════
function dropGeo() {
  const pts = [];
  for (let i = 0; i <= 28; i++) { const t = Math.PI - i / 28 * Math.PI; pts.push(new THREE.Vector2(Math.sin(t) * Math.sin(t / 2) * 0.62, Math.cos(t) * 0.75 + 0.75)); }
  return new THREE.LatheGeometry(pts, 32);
}
function makeFloatDrop() {
  const g = new THREE.Group();
  const m = add(g, dropGeo(), M('#46B2F5', { r: 0.15, rim: 0.45, nobump: true, em: '#1E7FD0', ei: 0.18 }), 0, -0.75, 0);
  ell(g, M('#FFFFFF', { nobump: true, em: '#FFFFFF', ei: 0.8 }), 0.09, 0.16, 0.05, -0.2, 0.1, 0.42, 10);
  ell(g, M('#2B5C86', { nobump: true }), 0.06, 0.08, 0.04, -0.17, -0.15, 0.5, 10);
  ell(g, M('#2B5C86', { nobump: true }), 0.06, 0.08, 0.04, 0.17, -0.15, 0.5, 10);
  g.visible = false; g.userData = { mesh: m, base: V3(), on: false };
  return g;
}

// ═════════ 시작 ═════════
window.addEventListener('DOMContentLoaded', () => {
  initRenderer($('#gl'));
  loadTtamiModel(() => {
    buildWorld();
    MP.init(); GB.init();   // 마을 안 3D 방명록 게시판은 게임 중엔 숨김 (방명록은 타이틀·완성 창에서만)
    G.ttami = makeTtami(TTAMI_SCALE); W.scene.add(G.ttami);
    W.colliders.push({ x: 0, z: 0, r: 2.25 });
    G.floatDrop = makeFloatDrop(); W.scene.add(G.floatDrop);
    setTtamiPlant(G.ttami, 'sunflower', 3, PLANT_SCALE_BIG); // 타이틀용
    G.ttami.userData.plant.visible = true;
    buildUI();
    G.mode = 'title';
    G.cam.mode = 'orbit';
    $('#loading').classList.add('hide');
    requestAnimationFrame(loop);
  });
});

let last = performance.now();
const DT_CAP = /fast/.test(location.search) ? 0.15 : 0.05;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(DT_CAP, (now - last) / 1000); last = now;
  if (!G.render3D) return;
  G.t += dt;
  update(dt);
  W.renderer.render(W.scene, W.camera);
  updateLabels();
}

function update(dt) {
  const t = G.t;
  updateTweens(dt);
  updateWorld(dt, t);
  if (G.ttami) updateTtami(G.ttami, dt, t);
  for (const n of G.npcs) { updateTtami(n.pot, dt, t); }
  if (G.mode === 'play' && !G.busy && !G.onHill) movePlayer(dt);
  else G.speed *= Math.pow(0.001, dt);
  if (G.player) {
    G.player.position.set(G.pos.x, G.posY || 0, G.pos.z);
    const dy = ((G.yaw - G.player.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    G.player.rotation.y += dy * Math.min(1, dt * 12);
    animateCharacter(G.player, t, G.speed, { hop: G.playerHop || 0, squash: G.playerSquash || 0, hold: G.sunHold });
    updateToolSwing(dt);
    updateHeadBucket(t);
  }
  updateNPCs(dt, t);
  PZ.update(dt, t);
  MP.update(dt, t);
  updateFloatDrop(dt, t);
  updatePickups(dt);
  updateParticles(dt);
  updateTree(dt);
  updateRocks(dt);
  if (W.refs.hill && G.mode === 'play' && Math.random() < dt * 3) { const ht = W.refs.hill.top; burst('sparkle', V3(ht.x + (Math.random() - .5) * 3, ht.y + 0.6 + Math.random() * 2.2, ht.z + (Math.random() - .5) * 3), 1); }
  updateCamera(dt, t);
}

// ═════════ 카메라 ═════════
function updateCamera(dt, t) {
  const c = G.cam, cam = W.camera;
  if (c.mode === 'orbit') {
    const a = t * 0.07;
    c.tPos.set(Math.sin(a) * 30, 17, Math.cos(a) * 30); c.tLook.set(0, 2, 0); c.k = 1.5;
  } else if (c.mode === 'follow') {
    c.tPos.set(G.pos.x, 10.5 + (G.posY || 0), G.pos.z + 14.5); c.tLook.set(G.pos.x, 1.3 + (G.posY || 0), G.pos.z - 1.8); c.k = 4;
  }
  const k = 1 - Math.exp(-dt * c.k);
  c.pos.lerp(c.tPos, k); c.look.lerp(c.tLook, k);
  cam.position.copy(c.pos);
  if (G.shake > 0) { G.shake -= dt; cam.position.x += (Math.random() - .5) * G.shake * 0.6; cam.position.y += (Math.random() - .5) * G.shake * 0.6; }
  cam.lookAt(c.look);
  U_D0.value = c.pos.distanceTo(c.look) * 0.92;
  const f = c.mode === 'follow' ? G.pos : c.look;
  W.sun.position.set(f.x - 14, 30, f.z + 12); W.sun.target.position.set(f.x, 0, f.z);
}
function camTo(pos, look, k = 2.5) { G.cam.mode = 'fixed'; G.cam.tPos.copy(pos); G.cam.tLook.copy(look); G.cam.k = k; }
function camFollow() { G.cam.mode = 'follow'; }
function camFocusTtami(close = false) {
  if (close) camTo(V3(2.5, 6.8, 13.5), V3(0, 2.6, 2), 2.2);
  else camTo(V3(3, 8, 16), V3(0, 2.8, 2), 2.2);
}

// ═════════ 플레이어 ═════════
function spawnPlayer() {
  if (G.player) W.scene.remove(G.player);
  G.player = buildCharacter(CHAR_BY_ID[G.charId]);
  G.pos.copy(SPAWN); G.yaw = Math.PI; G.player.rotation.y = Math.PI;
  W.scene.add(G.player);
  // 손 도구
  const hand = G.player.userData.hands[1];
  G.tools = { bucket: makeBucketMesh() };
  for (const k of ['bucket']) { const m = G.tools[k]; m.visible = false; G.player.userData.body.add(m); }
  // 양동이는 머리 위에 이고 다녀요 (물이 있으면 물이 찰랑)
  const bw = new THREE.Group(); G.tools.bucket.add(bw);   // 양동이 윗부분까지 찰랑이는 하늘색 물
  add(bw, cyl(0.25, 0.215, 0.3, 22), M('#38AEEA', { r: 0.25, nobump: true, em: '#1E8CD0', ei: 0.12, rim: 0.15 }), 0, 0.22, 0, false);
  ell(bw, M('#D9F6FF', { r: 0.1, nobump: true, em: '#BDEFFF', ei: 0.5 }), 0.09, 0.012, 0.05, -0.08, 0.372, 0.06, 12);
  bw.visible = false; G.tools.bucket.userData.water = bw;
  const tb = new THREE.Box3().setFromObject(G.player.userData.top);
  G.headY = Math.min(1.3, Math.max(1.0, isFinite(tb.max.y) ? tb.max.y - 0.04 : 1.0));
}
function movePlayer(dt) {
  let x = 0, z = 0;
  const k = G.keys;
  if (k.ArrowLeft || k.KeyA) x -= 1; if (k.ArrowRight || k.KeyD) x += 1;
  if (k.ArrowUp || k.KeyW) z -= 1; if (k.ArrowDown || k.KeyS) z += 1;
  x += G.joy.x; z += G.joy.y;
  const len = Math.hypot(x, z);
  const run = k.ShiftLeft || k.ShiftRight ? 1.5 : 1;
  const target = len > 0.1 ? 6.2 * run * Math.min(1, len) : 0;
  G.speed += (target - G.speed) * Math.min(1, dt * 10);
  if (len > 0.1) {
    G.yaw = Math.atan2(x, z);
    G.pos.x += (x / len) * G.speed * dt; G.pos.z += (z / len) * G.speed * dt;
    G.stepPh += dt * G.speed * 1.9;
    if (G.stepPh > 1) { G.stepPh = 0; SFX.play('step'); }
  }
  // 충돌
  for (let it = 0; it < 2; it++) {
    for (const c of W.colliders) pushOut(c.x, c.z, c.r + 0.45);
    for (const n of G.npcs) { pushOut(n.root.position.x, n.root.position.z, 0.95); pushOut(n.pot.position.x, n.pot.position.z, 0.85); }
  }
  if (G.inPlaza) { PZ.clampWalk(); return; }
  const d = Math.hypot(G.pos.x, G.pos.z);
  if (d > W.BOUND) { G.pos.x *= W.BOUND / d; G.pos.z *= W.BOUND / d; }
}
function pushOut(cx, cz, r) {
  const dx = G.pos.x - cx, dz = G.pos.z - cz, d = Math.hypot(dx, dz);
  if (d < r && d > 0.0001) { G.pos.x = cx + dx / d * r; G.pos.z = cz + dz / d * r; }
}
function facePoint(p) { G.yaw = Math.atan2(p.x - G.pos.x, p.z - G.pos.z); }

function swingTool(kind, dur = 0.5) {
  if (!G.tools) return;
  const m = G.tools[kind]; if (!m) return;
  m.visible = true; G.swingTool = kind; G.swing = dur; G.swingDur = dur;
}
function updateToolSwing(dt) {
  if (!G.swingTool) return;
  G.swing -= dt;
  const m = G.tools[G.swingTool];
  const k = 1 - Math.max(0, G.swing) / G.swingDur;
  if (G.swingTool === 'hammer') { m.position.set(0.55, 0.65, 0.45); m.rotation.set(-1.8 + Math.sin(k * Math.PI) * 1.9, 0, 0); }
  else { m.position.set(0.5, 0.35 + Math.sin(k * Math.PI) * 0.3, 0.5); m.rotation.set(Math.sin(k * Math.PI) * 1.2, 0, 0); }
  m.scale.setScalar(1);
  if (G.swing <= 0) { m.visible = false; G.swingTool = null; }
}
function updateHeadBucket(t) {
  const b = G.tools && G.tools.bucket; if (!b || G.swingTool === 'bucket') return;
  // 언덕에서 햇빛을 모을 때는 양동이를 가방에 넣어 둬요
  const has = !!G.flags.bucket && ['play', 'cutscene', 'complete'].includes(G.mode) && !G.onHill && !G.sunHold;
  b.visible = has; if (!has) return;
  const full = G.inv.water > 0, walk = Math.min(1, G.speed / 5);
  b.position.set(0, (G.headY || 1.0) + Math.abs(Math.sin(t * 12)) * 0.03 * walk, 0);
  b.rotation.set(Math.sin(t * 6) * 0.05 * walk, 0, Math.sin(t * 12) * 0.06 * walk);
  b.scale.setScalar(1.15);
  b.userData.water.visible = full;
  if (full) b.userData.water.rotation.z = Math.sin(t * 7) * 0.04 * walk;
  if (!G.sunHold) { // 두 손으로 양동이를 받쳐요
    const u = G.player.userData, hy = Math.min((G.headY || 1.0) + 0.12, 1.25);
    u.hands[0].position.set(-0.4, hy, 0.02); u.hands[1].position.set(0.4, hy, 0.02);
  }
}

// ═════════ NPC ═════════
const NPC_SPOTS = [[-8.5, -2], [9, -1.5], [-7.5, -14.5], [8.5, -15.5], [-23, 3.5], [23.5, 3], [-4.5, 15], [4.8, 19.5]];
function buildNPCs() {
  for (const n of G.npcs) { W.scene.remove(n.root); W.scene.remove(n.pot); }
  G.npcs = [];
  const others = CHARACTERS.filter(c => c.id !== G.charId);
  const pick = (prefs) => { for (const p of prefs) { const i = others.findIndex(c => c.id === p); if (i >= 0) return others.splice(i, 1)[0]; } return others.shift(); };
  const mush = pick(['ribbon', 'sarang', 'kitty', 'apple']);
  const carp = CARPENTER;
  const R = rnd(G.charId.length * 31 + 7);
  others.sort(() => R() - 0.5);
  const list = [
    { def: mush, role: 'mushroom', home: V3(12.6, 0, -7.6) },
    { def: carp, role: 'carpenter', home: V3(-12.2, 0, 11.2), pot: V3(-14.3, 0, 9.3) },  // 화분은 작업대 옆 (사다리 만드는 모습을 가리지 않게)
    ...NPC_SPOTS.map((s, i) => ({ def: others[i], role: 'brag', home: V3(s[0], 0, s[1]) })),
  ];
  for (const it of list) {
    if (!it.def) continue;
    const root = buildCharacter(it.def);
    root.position.copy(it.home); root.rotation.y = Math.atan2(-it.home.x, -it.home.z) * 0.5;
    W.scene.add(root);
    const pot = makeTtami(MINI_SCALE);
    const side = it.home.x > 0 ? -1 : 1;
    if (it.pot) pot.position.copy(it.pot); else pot.position.set(it.home.x + 1.5 * side, 0, it.home.z - 0.6);
    pot.rotation.y = Math.atan2(-pot.position.x * 0.1, 1);
    setTtamiPlant(pot, it.def.seed, 3, PLANT_SCALE_MINI);
    W.scene.add(pot);
    G.npcs.push({ def: it.def, role: it.role, root, pot, home: it.home.clone(), target: it.home.clone(), timer: R() * 3, talk: 0, hop: 0, wave: 0, facing: root.rotation.y, seed: SEED_BY_ID[it.def.seed] });
  }
}
function updateNPCs(dt, t) {
  for (const n of G.npcs) {
    const p = n.root.position;
    const dPlayer = G.player ? Math.hypot(G.pos.x - p.x, G.pos.z - p.z) : 99;
    let speed = 0;
    if (n.celebrate) { // 식물이 다 자라면 땀땀이 둘레에 동그랗게 모여 축하해요
      const dx = n.celebrate.x - p.x, dz = n.celebrate.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.2) { speed = Math.min(9, 3 + d * 1.6); const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; n.facing = Math.atan2(dx, dz); }
      else {
        n.facing = Math.atan2(-p.x, -p.z); n.wave = 0.5;
        n.cheer = (n.cheer || 0) - dt;
        if (n.cheer <= 0) { n.cheer = 0.9 + Math.random() * 0.8; n.hop = 0.45; if (Math.random() < 0.35) burst('confetti', V3(p.x, 2.4, p.z), 5); }
      }
    } else if (n.sad > 0) {
      n.sad -= dt; n.facing = Math.atan2(G.pos.x - p.x, G.pos.z - p.z);
      n.tear = (n.tear || 0) - dt;
      // 두 눈에서 위로 솟았다가 양옆으로 포물선을 그리며 떨어지는 눈물
      if (n.tear <= 0) { n.tear = 0.16; const s = Math.sin(n.root.rotation.y), c = Math.cos(n.root.rotation.y); for (const e of [-0.19, 0.19]) { const side = Math.sign(e); burst('tear', V3(p.x + c * e + s * 0.44, 0.7, p.z - s * e + c * 0.44), 1, { vel: V3(c * side * 1.5 + s * 0.35, 0, -s * side * 1.5 + c * 0.35) }); } if (Math.random() < 0.3) SFX.play('blip', 0.6); }
    } else if (n.working) {
      n.facing = Math.atan2(-11 - p.x, 8.6 - p.z);
    } else if (n.talking || dPlayer < 3.5) {
      n.facing = Math.atan2(G.pos.x - p.x, G.pos.z - p.z);
    } else {
      n.timer -= dt;
      if (n.timer <= 0) {
        n.timer = 2.5 + Math.random() * 3.5;
        const a = Math.random() * Math.PI * 2;
        n.target.set(n.home.x + Math.cos(a) * 1.3, 0, n.home.z + Math.sin(a) * 1.3);
      }
      const dx = n.target.x - p.x, dz = n.target.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.15) { speed = 1.6; p.x += dx / d * speed * dt; p.z += dz / d * speed * dt; n.facing = Math.atan2(dx, dz); }
    }
    const dy = ((n.facing - n.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    n.root.rotation.y += dy * Math.min(1, dt * 6);
    n.hop = Math.max(0, n.hop - dt);
    const hopY = n.hop > 0 ? Math.abs(Math.sin(n.hop * 14)) * 0.45 : 0;
    n.wave = Math.max(0, n.wave - dt);
    const sadNow = n.sad > 0 && !n.celebrate;
    animateCharacter(n.root, t + n.home.x, speed, { hop: hopY, squash: sadNow ? 0.13 + Math.abs(Math.sin(t * 9)) * 0.03 : 0, wave: !sadNow && (n.wave > 0 || (dPlayer < 3.5 && dPlayer > 2.2 && !n.talking)) });
    n.root.userData.body.rotation.x = sadNow ? 0.22 : n.root.userData.body.rotation.x;
    if (sadNow) { const u = n.root.userData; u.hands[0].position.set(-0.24, 0.7, 0.42); u.hands[1].position.set(0.24, 0.7, 0.42); }
  }
}

// ═════════ 줍는 물건 ═════════
function spawnPickup(kind, from, vel) {
  let mesh;
  if (kind === 'apple') { mesh = new THREE.Group(); ell(mesh, M('#E5322E', { r: 0.35, rim: 0.25 }), 0.26, 0.24, 0.26, 0, 0, 0, 14); add(mesh, cyl(0.025, 0.03, 0.14, 6), M('#6B3E1E'), 0, 0.26, 0); const lf = add(mesh, leafGeo(0.18, 0.08, 0.3, 0.1), M('#3E9B3A'), 0.02, 0.28, 0); lf.rotation.set(-0.4, 0.8, 0); }
  else if (kind === 'bag') { mesh = makeBagMesh(); }
  else if (kind === 'crystal') { mesh = new THREE.Group(); crystalMesh(mesh, 0.2); }
  mesh.position.copy(from); W.scene.add(mesh);
  const p = { kind, mesh, vel: vel.clone(), age: 0, rest: false, r: kind === 'bag' ? 0.3 : 0.25, magnet: kind === 'crystal' };
  G.pickups.push(p); return p;
}
function updatePickups(dt) {
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i]; p.age += dt;
    const m = p.mesh;
    if (!p.rest) {
      p.vel.y -= 18 * dt; m.position.addScaledVector(p.vel, dt);
      m.rotation.x += p.vel.z * dt * 2; m.rotation.z -= p.vel.x * dt * 2;
      if (m.position.y < p.r) {
        m.position.y = p.r;
        if (Math.abs(p.vel.y) > 2.5) { p.vel.y *= -0.38; p.vel.x *= 0.6; p.vel.z *= 0.6; if (p.kind !== 'crystal') SFX.play('plop'); }
        else { p.rest = true; m.rotation.set(0, m.rotation.y, 0); }
      }
    } else {
      m.position.y = p.r + Math.abs(Math.sin(p.age * 3)) * 0.06;
      m.rotation.y += dt * 1.5;
    }
    if (!G.player || G.mode !== 'play') continue;
    const d = Math.hypot(G.pos.x - m.position.x, G.pos.z - m.position.z);
    if (p.magnet) { // 반짝이는 튀어나오자마자 가방 속으로 (플레이어를 따라다니지 않아요)
      if (p.age > 0.55) collectPickup(p, i);
      continue;
    }
    if (p.age > 0.45 && d < 1.25) {
      if (p.kind !== 'bag' && !G.flags.bag) { if (!p.warned) { p.warned = true; toast('가방이 있어야 담을 수 있어요'); } continue; }
      collectPickup(p, i);
    }
  }
}
function collectPickup(p, i) {
  G.pickups.splice(i, 1); W.scene.remove(p.mesh);
  if (p.kind === 'bag') {
    G.flags.bag = true; SFX.play('bag'); burst('sparkle', p.mesh.position, 14);
    showInventory(); toast('가방을 얻었어요! 이제 물건을 담을 수 있어요', 'bag');
    G.playerHop = 0; tween(0.6, k => { G.playerHop = Math.sin(k * Math.PI) * 0.6; });
  } else if (p.kind === 'apple') {
    G.inv.apple++; SFX.play('pickup'); flyIcon('🍎', p.mesh.position, 'apple');
  } else if (p.kind === 'crystal') {
    G.inv.crystal++; G.flags.gotCrystal = true; SFX.play('sparkle'); flyIcon('💎', p.mesh.position, 'crystal');
  }
  refreshInventory(); refreshObjective();
}

// ═════════ 사과나무 / 바위 ═════════
function updateTree(dt) {
  const tr = W.refs.appleTree; if (!tr) return;
  if (G.treeShake > 0) {
    G.treeShake -= dt;
    const s = G.treeShake;
    tr.inner.rotation.z = Math.sin(s * 28) * 0.06 * s; tr.inner.rotation.x = Math.cos(s * 23) * 0.04 * s;
    tr.canopy.scale.set(1 + Math.sin(s * 30) * 0.03 * s, 1 - Math.sin(s * 30) * 0.03 * s, 1);
  }
  // 사과 다시 열리기
  G.appleRegrow = (G.appleRegrow || 0) + dt;
  if (G.appleRegrow > 10) {
    G.appleRegrow = 0;
    const hidden = tr.apples.find(a => !a.visible);
    if (hidden) { hidden.visible = true; hidden.scale.set(0.01, 0.01, 0.01); tween(0.6, k => hidden.scale.set(0.26 * k, 0.24 * k, 0.26 * k), ease.back); }
  }
}
async function shakeTree() {
  const tr = W.refs.appleTree;
  G.treeShake = 1.2; SFX.play('shake'); G.shake = 0.25;
  facePoint(tr.root.position);
  const cp = tr.root.position.clone().add(V3(0, 4.4, 0));
  burst('leaf', cp.clone().add(V3(0, -0.5, 1)), 14);
  await wait(450);
  let dropped = 0;
  if (!G.flags.bag && tr.bag.parent) {
    const wp = new THREE.Vector3(); tr.bag.getWorldPosition(wp);
    tr.canopy.remove(tr.bag);
    spawnPickup('bag', wp, V3((G.pos.x - wp.x) * 0.25, 2, (G.pos.z - wp.z) * 0.25));
    setTimeout(() => SFX.play('boing'), 350);
  }
  const vis = tr.apples.filter(a => a.visible);
  const n = Math.min(vis.length, G.firstShakeDone ? 2 : 4);
  for (let i = 0; i < n; i++) {
    const a = vis[i]; const wp = new THREE.Vector3(); a.getWorldPosition(wp);
    a.visible = false;
    const dir = V3(wp.x - tr.root.position.x, 0, wp.z - tr.root.position.z).normalize();
    spawnPickup('apple', wp, V3(dir.x * 2 + (Math.random() - .5), 1.5, dir.z * 2 + 1.5 + Math.random()));
    dropped++;
  }
  G.firstShakeDone = true;
  if (!dropped && G.flags.bag) toast('사과가 아직 안 열렸어요. 조금만 기다려 봐요');
  refreshObjective();
}
function updateRocks(dt) {
  for (const r of W.refs.rocks || []) {
    if (r.cooldown > 0) {
      r.cooldown -= dt;
      if (r.cooldown <= 0) {
        r.crystals.children.forEach(c => { c.visible = true; });
        tween(0.7, k => r.crystals.scale.setScalar(Math.max(0.01, k)), ease.back); SFX.play('sparkle');
      }
    }
  }
}
// 돌멩이를 던져 바위에 붙은 반짝이를 떨어뜨려요
async function throwPebble(r) {
  facePoint(r.root.position);
  const from = V3(G.pos.x, 1.25, G.pos.z);
  const target = r.root.position.clone().add(V3(0, 0.85 * r.scale, 0.55 * r.scale));
  const peb = ell(null, M('#9E988F'), 0.15, 0.12, 0.15, 0, 0, 0, 10); peb.position.copy(from); W.scene.add(peb);
  tween(0.35, k => { G.playerHop = Math.sin(k * Math.PI) * 0.3; });
  SFX.play('whoosh');
  await tween(0.42, k => { peb.position.lerpVectors(from, target, k); peb.position.y += Math.sin(k * Math.PI) * 1.3; peb.rotation.x = k * 9; }, t => t);
  W.scene.remove(peb);
  SFX.play('tok'); G.shake = 0.15;
  tween(0.3, k => { const a = Math.sin(k * Math.PI); r.root.scale.set(r.scale * (1 + a * 0.08), r.scale * (1 - a * 0.1), r.scale * (1 + a * 0.08)); });
  burst('rock', target, 5);
  const vis = r.crystals.children.filter(c => c.visible);
  if (vis.length) {
    const c = vis[0]; const wp = new THREE.Vector3(); c.getWorldPosition(wp);
    c.visible = false; SFX.play('crack'); burst('sparkle', wp, 10);
    spawnPickup('crystal', wp, V3((G.pos.x - wp.x) * 0.5, 4.5, (G.pos.z - wp.z) * 0.5));
  }
  if (vis.length <= 1) r.cooldown = 12;
  await wait(250);
}
async function scoopWater() {
  const pc = W.refs.pond.position; facePoint(pc);
  swingTool('bucket', 0.7);
  SFX.play('splash');
  const edge = V3(G.pos.x + (pc.x - G.pos.x) * 0.25, 0.3, G.pos.z + (pc.z - G.pos.z) * 0.25);
  burst('splash', edge, 16);
  await wait(400);
  const add2 = Math.min(2, MAX_WATER - G.inv.water);
  G.inv.water += add2;
  flyIcon('💧', V3(G.pos.x, 1.5, G.pos.z), 'water');
  if (add2 === 1) flyIcon('💧', V3(G.pos.x, 1.8, G.pos.z), 'water');
  SFX.play('pickup');
  refreshInventory(); refreshObjective();
}

// ═════════ 땀땀이 요청 ═════════
// 성장은 2단계: 씨앗 → 새싹 → 완성 (GROW_STAGES에 적힌 모습 순서대로 자라요)
const GROW_STAGES = [1, 3];
function currentReq() { const s = SEED_BY_ID[G.seedId]; const r = s.req[Math.min(G.reqIdx, s.req.length - 1)]; return { w: r[0], n: r[1] }; }
async function raiseRequest() {
  const tt = G.ttami;
  setTtamiDrop(tt, 1); SFX.play('rise');
  const fd = G.floatDrop;
  const dropWorld = new THREE.Vector3(); tt.userData.drop.getWorldPosition(dropWorld);
  const top = V3(0, 5.9, 0);
  fd.visible = true; fd.userData.on = false; fd.scale.setScalar(0.3); fd.position.copy(dropWorld);
  await tween(1.2, k => { fd.position.lerpVectors(dropWorld, top, k); fd.position.x += Math.sin(k * Math.PI) * 0.6; fd.scale.setScalar(0.3 + 0.7 * k); }, ease.inOut);
  fd.userData.base.copy(top); fd.userData.on = true;
  G.requestActive = true; G.given = { w: 0, n: 0 };
  updateReqBubble(true);
  refreshObjective();
}
function updateFloatDrop(dt, t) {
  const fd = G.floatDrop; if (!fd || !fd.visible || !fd.userData.on) return;
  fd.position.y = fd.userData.base.y + Math.sin(t * 2.2) * 0.18;
  fd.rotation.y = Math.sin(t * 1.3) * 0.4;
  const sq = 1 + Math.sin(t * 4.4) * 0.04; fd.scale.set(1 / sq, sq, 1 / sq);
}
async function giveToTtami() {
  const req = currentReq();
  const needW = req.w - G.given.w, needN = req.n - G.given.n;
  const gw = Math.min(G.inv.water, needW), gn = Math.min(G.inv.nutrient, needN);
  if (gw + gn === 0) return false;
  G.inv.water -= gw; G.inv.nutrient -= gn; refreshInventory();
  const from = V3(G.pos.x, 1.4, G.pos.z);
  for (let i = 0; i < gw + gn; i++) {
    const isW = i < gw;
    setTimeout(() => { flyToWorld(isW ? '💧' : '☀️', from, G.floatDrop.position); SFX.play('drop'); }, i * 160);
  }
  await wait((gw + gn) * 160 + 500);
  G.given.w += gw; G.given.n += gn;
  updateReqBubble(); refreshObjective();
  tween(0.4, k => { const s = 1 + Math.sin(k * Math.PI) * 0.18; G.floatDrop.scale.set(s, 1 / s, s); });
  return G.given.w >= req.w && G.given.n >= req.n;
}
async function completeStage() {
  G.requestActive = false; updateReqBubble();
  const fd = G.floatDrop, tt = G.ttami;
  fd.userData.on = false;
  camFocusTtami(true);
  const dropWorld = new THREE.Vector3(); tt.userData.drop.getWorldPosition(dropWorld);
  const from = fd.position.clone();
  SFX.play('absorb');
  await tween(1.4, k => { fd.position.lerpVectors(from, dropWorld, k); fd.scale.setScalar(1 - 0.75 * k); fd.rotation.y = k * 6; }, ease.inOut);
  fd.visible = false;
  setTtamiDrop(tt, 0);
  burst('splash', dropWorld, 10);
  await wait(500);
  // 성장!
  G.reqIdx++; G.stage = GROW_STAGES[Math.min(G.reqIdx, GROW_STAGES.length) - 1];
  const p = setTtamiPlant(tt, G.seedId, G.stage, PLANT_SCALE_BIG);
  SFX.play('grow');
  const anchorW = new THREE.Vector3(); tt.userData.anchor.getWorldPosition(anchorW);
  burst('sparkle', anchorW.clone().add(V3(0, 1, 0)), 26);
  p.scale.setScalar(0.01);
  await tween(1.1, k => p.scale.setScalar(PLANT_SCALE_BIG * Math.max(0.01, k)), ease.elastic);
  tween(0.5, k => { const s = 1 + Math.sin(k * Math.PI) * 0.06; tt.scale.set(s, 1 / s, s); });
  if (G.stage >= 3) { await finishPlant(); return; }
  const msg = G.stage === 1 ? '싹이 텄어요! 🌱' : '쑥쑥 자랐어요! 🌿';
  toast(msg, 'grow');
  await say('ttami', G.stage === 1 ? `우와;; 싹이 났어;;! 고마워 ${callName(G.name)};; 한 번만 더 도와주면 다 자랄 것 같아;;` : `잎이 많아졌지;;? 조금만 더 도와줘;;`);
  camFollow();
  await wait(900);
  toast('땀땀이가 또 물방울을 올려 보냈어요!');
  await raiseRequest();
}
async function finishPlant() {
  G.busy = true;
  const seed = SEED_BY_ID[G.seedId];
  SFX.play('success');
  const anchorW = new THREE.Vector3(); G.ttami.userData.anchor.getWorldPosition(anchorW);
  burst('confetti', anchorW.clone().add(V3(0, 3, 0)), 60);
  burst('sparkle', anchorW.clone().add(V3(0, 2, 0)), 30);
  // 모든 요정이 땀땀이 앞에 동그랗게 모여요
  G.npcs.forEach((n, i) => { const a = Math.PI * 0.5 + (i - (G.npcs.length - 1) / 2) * (Math.PI * 1.5 / Math.max(1, G.npcs.length - 1)); n.sad = 0; n.working = false; n.celebrate = V3(Math.cos(a) * 5.0, 0, Math.sin(a) * 5.0); });
  G.completed.add(G.seedId);
  camTo(V3(3.5, 8.5, 17), V3(2.8, 2.6, 0), 1.6);
  await wait(2600);
  await say('ttami', `해냈다;;! ${plantShort(seed)} 완성이야;;! ${callName(G.name)}, 정말 고마워;;;`);
  showComplete();
}

// ═════════ 상호작용 대상 ═════════
function interactables() {
  const list = [];
  if (!G.player) return list;
  if (G.inPlaza) { for (const it of MP.interactables()) list.push(it); PZ.interactables(list); return list; }
  if (G.onHill) {
    const has = G.inv.crystal > 0;
    list.push({ id: 'hilltop', pos: V3(G.pos.x, 0, G.pos.z), r: 99, h: G.posY + 2.5, label: has ? '햇빛 담기' : '내려가기', act: has ? gatherSun : climbDown });
    return list;
  }
  const tr = W.refs.appleTree;
  list.push({ id: 'tree', pos: tr.root.position, r: 3.4, h: 3.2, label: '흔들기', act: shakeTree });
  let tl = '말 걸기';
  if (G.requestActive) { const rq = currentReq(); if ((G.inv.water > 0 && rq.w > G.given.w) || (G.inv.nutrient > 0 && rq.n > G.given.n)) tl = '물·양분 주기'; }
  list.push({ id: 'ttami', pos: V3(0, 0, 0), r: 3.7, h: 4.2, label: tl, act: talkTtami });
  // 연못: 타원 가장자리
  const pc = W.refs.pond.position;
  const ex = (G.pos.x - pc.x) / 7.4, ez = (G.pos.z - pc.z) / 5.5, ed = Math.hypot(ex, ez);
  if (ed < 1.45) {
    const e = V3(pc.x + ex / ed * 7.0, 0, pc.z + ez / ed * 5.1);
    list.push({ id: 'pond', pos: e, r: 99, h: 1.4, label: '물 뜨기', act: actPond });
  }
  for (const r of W.refs.rocks) if (r.cooldown <= 0) list.push({ id: 'rock', pos: r.root.position, r: 3.6 * r.scale, h: 2.1, label: '돌멩이 던지기', act: () => actRock(r) });
  const h = W.refs.hill;
  list.push({ id: 'hill', pos: h.base, r: 2.8, h: 3.0, label: G.flags.ladderPlaced ? '올라가기' : G.flags.ladder ? '사다리 놓기' : '살펴보기', act: actHill });
  for (const n of G.npcs) list.push({ id: 'npc', pos: n.root.position, r: 2.4, h: 1.9, label: '말 걸기', act: () => talkNPC(n) });
  return list;
}
function nearestInteractable() {
  let best = null, bd = 1e9;
  for (const it of interactables()) {
    const d = Math.hypot(G.pos.x - it.pos.x, G.pos.z - it.pos.z);
    if (d < it.r && d < bd) { bd = d; best = it; }
  }
  return best;
}
async function interact() {
  if (G.mode !== 'play' || G.busy) return;
  const it = nearestInteractable(); if (!it) return;
  G.busy = true;
  try { await it.act(); } catch (e) { console.error(e); }
  G.busy = false;
  refreshObjective();
}
async function actPond() {
  if (!G.flags.bucket) { await say(null, '물을 담을 그릇이 없어요… 버섯집 요정이 양동이를 갖고 있대요.'); return; }
  if (G.inv.water >= MAX_WATER) { toast('물을 더는 담을 수 없어요 (최대 8)'); SFX.play('deny'); return; }
  await scoopWater();
}
async function actRock(r) {
  if (!G.flags.bag) { toast('가방이 먼저 필요해요'); return; }
  if (!G.flags.rockTip) { G.flags.rockTip = true; await say(null, '바위에 반짝이가 붙어 있어요. 주변의 돌멩이를 던져서 떨어뜨려 봐요!'); }
  await throwPebble(r);
}

// ═════════ 햇살 언덕 & 사다리 ═════════
async function actHill() {
  const h = W.refs.hill;
  facePoint(V3(h.x, 0, h.z));
  if (!G.flags.ladderPlaced) {
    if (!G.flags.ladder) {
      G.flags.sawHill = true;
      await say(null, '가파른 언덕이에요. 꼭대기에는 햇빛이 가득 쏟아지고 있어요. 사다리가 있으면 올라갈 수 있을 텐데… 목수 사달희 아저씨에게 부탁해 볼까요?');
      return;
    }
    await placeLadder(); return;
  }
  await climbUp();
}
async function placeLadder() {
  const h = W.refs.hill;
  const lad = makeLadderMesh(h.ladderLen); W.scene.add(lad);
  const from = V3(G.pos.x, 1.2, G.pos.z), qFrom = new THREE.Quaternion();
  SFX.play('bag'); toast('가방에서 사다리를 꺼냈어요!');
  await tween(0.9, k => { lad.position.lerpVectors(from, h.base, k); lad.position.y += Math.sin(k * Math.PI) * 1.5; lad.quaternion.slerpQuaternions(qFrom, h.ladderQuat, k); lad.scale.setScalar(0.15 + 0.85 * k); }, ease.out);
  SFX.play('plop'); burst('puff', h.base, 8); G.shake = 0.15;
  tween(0.4, k => { const q = 1 + Math.sin(k * Math.PI) * 0.06; lad.scale.set(q, 1 / q, q); });
  h.ladder = lad; G.flags.ladderPlaced = true; refreshInventory();
}
async function climbUp() {
  const h = W.refs.hill;
  G.onHill = true; G.speed = 0;
  const start = V3(G.pos.x, 0, G.pos.z), base = h.base.clone().addScaledVector(h.out, 0.35);
  await tween(0.35, k => { G.pos.lerpVectors(start, base, k); });
  G.yaw = Math.atan2(h.x - G.pos.x, h.z - G.pos.z);
  const topL = h.ladderTop.clone().addScaledVector(h.out, 0.3);
  let stepT = 0;
  await tween(1.7, (k, raw) => {
    G.pos.set(base.x + (topL.x - base.x) * k, 0, base.z + (topL.z - base.z) * k); G.posY = topL.y * k;
    G.playerSquash = Math.sin(raw * Math.PI * 10) * 0.05;
    if (raw * 6 > stepT) { stepT++; SFX.play('step'); SFX.play('tok'); }
  }, t => t);
  G.playerSquash = 0;
  const a = V3(G.pos.x, 0, G.pos.z), ay = G.posY;
  SFX.play('boing');
  await tween(0.45, k => { G.pos.set(a.x + (h.top.x - a.x) * k, 0, a.z + (h.top.z - a.z) * k); G.posY = ay + (h.top.y - ay) * k + Math.sin(k * Math.PI) * 0.7; }, t => t);
  G.posY = h.top.y; G.yaw = 0;
  burst('sparkle', V3(h.top.x, h.top.y + 1, h.top.z), 10);
  if (!G.inv.crystal && !G.flags.hillTip) { G.flags.hillTip = true; await say(null, '따뜻한 햇빛이 쏟아져요. 반짝이를 가져오면 여기서 햇빛을 담을 수 있을 것 같아요.'); }
}
async function gatherSun() {
  const h = W.refs.hill;
  G.yaw = 0;
  const n = G.inv.crystal;
  const head = V3(h.top.x, h.top.y + 2.05, h.top.z);
  camTo(V3(h.top.x + 1.5, h.top.y + 4.4, h.top.z + 10), V3(h.top.x, h.top.y + 1.3, h.top.z), 3);
  const blue = M('#7FE6F7', { r: 0.2, em: '#5FD8F0', ei: 0.55, nobump: true, rim: 0.4 }), gold = M('#FFB32E', { r: 0.2, em: '#FF9A00', ei: 0.9, nobump: true, rim: 0.4 });
  const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), blue); cr.position.copy(head); cr.castShadow = true; W.scene.add(cr);
  G.sunHold = true;
  toast('햇빛 모으는 중…');
  await tween(0.5, k => cr.scale.set(Math.max(0.01, k), 1.5 * Math.max(0.01, k), Math.max(0.01, k)), ease.back);
  const rayM = M('#FFC83A', { em: '#FFB300', ei: 1, nobump: true });
  for (let i = 0; i < n; i++) {
    cr.material = blue;
    const rays = [];
    for (let j = 0; j < 9; j++) {
      const a = j / 9 * Math.PI * 2 + i, el = 0.25 + (j % 3) * 0.35;
      const dir = V3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const m = new THREE.Mesh(cyl(0.04, 0.04, 1.1, 6), rayM); m.quaternion.setFromUnitVectors(V3(0, 1, 0), dir); m.castShadow = false;
      W.scene.add(m); rays.push({ m, dir });
    }
    SFX.play('rise');
    await tween(0.75, k => { for (const q of rays) { q.m.position.copy(head).addScaledVector(q.dir, 4.2 - 3.5 * k); q.m.scale.set(1, 1 - k * 0.6, 1); } cr.rotation.y += 0.15; }, ease.inOut);
    rays.forEach(q => W.scene.remove(q.m));
    cr.material = gold;
    SFX.play('sparkle'); burst('sparkle', head, 12);
    await tween(0.35, k => { const q = 1 + Math.sin(k * Math.PI) * 0.35; cr.scale.set(q, 1.5 * q, q); });
    G.inv.crystal--; G.inv.nutrient++; refreshInventory();
    flyIcon('☀️', head, 'nutrient'); SFX.play('pickup');
    await wait(250);
  }
  await tween(0.3, k => cr.scale.set(1 - k, 1.5 * (1 - k), 1 - k));
  W.scene.remove(cr); G.sunHold = false;
  toast(`반짝이 ${n}개에 햇빛을 가득 담았어요!`);
  camFollow();
}
async function climbDown() {
  const h = W.refs.hill;
  const topL = h.ladderTop.clone().addScaledVector(h.out, 0.3), base = h.base.clone().addScaledVector(h.out, 0.9);
  const a = V3(G.pos.x, 0, G.pos.z), ay = G.posY;
  G.yaw = Math.atan2(h.x - topL.x, h.z - topL.z);
  await tween(0.4, k => { G.pos.set(a.x + (topL.x - a.x) * k, 0, a.z + (topL.z - a.z) * k); G.posY = ay + (topL.y - ay) * k + Math.sin(k * Math.PI) * 0.5; }, t => t);
  let stepT = 0;
  await tween(1.3, (k, raw) => { G.pos.set(topL.x + (base.x - topL.x) * k, 0, topL.z + (base.z - topL.z) * k); G.posY = topL.y * (1 - k); if (raw * 5 > stepT) { stepT++; SFX.play('step'); } }, t => t);
  G.posY = 0; G.onHill = false; G.yaw = Math.atan2(h.out.x, h.out.z);
}
async function talkTtami() {
  facePoint(V3(0, 0, 0));
  if (G.stage >= 3) { await say('ttami', '고마워;; 덕분에 활짝 자랐어;;'); showComplete(); return; }
  if (!G.requestActive) { await say('ttami', '지금 쑥쑥 자라는 중이야;; 잠깐만;;'); return; }
  const ok = await giveToTtami();
  if (ok) { await say('ttami', '물방울이… 꽉 찼어;;!'); await completeStage(); return; }
  if (G.given.w > 0 || G.given.n > 0) {
    const req = currentReq();
    if (G.given.w < req.w || G.given.n < req.n) {
      if (G.lastGiveTick !== G.given.w * 10 + G.given.n) { G.lastGiveTick = G.given.w * 10 + G.given.n; await say('ttami', `시원해;; 근데 아직 ${needText()} 더 필요해;;`); return; }
    }
  }
  await say('ttami', ttamiHint());
}
function needText() {
  const r = currentReq(); const w = r.w - G.given.w, n = r.n - G.given.n; const a = [];
  if (w > 0) a.push(`물 ${w}개`); if (n > 0) a.push(`양분 ${n}개`); return a.join('랑 ');
}
function ttamiHint() {
  if (!G.flags.bag) return '물이랑 양분이 필요해;; 근데 담을 게 없지;;? 저기 커다란 사과나무를 흔들어 봐;;';
  const r = currentReq();
  if (G.inv.water < r.w - G.given.w && !G.flags.bucket) return '물을 담으려면 양동이가 있어야 해;; 버섯집 요정이 사과를 좋아한대;;';
  if (G.inv.water < r.w - G.given.w) return '연못에서 물을 떠다 줘;; 목말라;;';
  if (G.inv.crystal + G.inv.nutrient < r.n - G.given.n) return '바위에 붙은 반짝이가 필요해;; 돌멩이를 던져서 떨어뜨려 봐;;';
  if (!G.flags.ladder && !G.flags.ladderPlaced) return '반짝이에 햇빛을 담아야 양분이 돼;; 높은 언덕에 올라가야 하는데… 목수 사달희 아저씨가 사다리를 만들 수 있대;;';
  return '언덕 꼭대기에서 반짝이에 햇빛을 담아 와;;';
}

// ═════════ NPC 대화 ═════════
async function talkNPC(n) {
  n.talking = true; facePoint(n.root.position); n.wave = 1.0;
  const nm = n.def.name, me = G.name;
  try {
    if (n.role === 'mushroom' && !G.flags.bucket) return await mushroomQuest(n);
    if (n.role === 'carpenter' && !G.flags.ladder && !G.flags.ladderPlaced) return await carpenterQuest(n);
    await bragTalk(n);
  } finally { n.talking = false; }
}
async function bragTalk(n) {
  const seed = n.seed, nm = n.def.name;
  if (!n.met) {
    await say(n, `안녕 ${callName(G.name)}! 난 ${J(nm, '이야', '야')}. ${n.def.line}`);
  } else {
    await say(n, n.sad > 0 ? `훌쩍… ${callName(G.name)}, 또 왔어…?` : `또 왔구나, ${callName(G.name)}!`);
  }
  n.met = true;
  // 화분 보여주기
  const pp = n.pot.position;
  camTo(V3(pp.x + (G.pos.x - pp.x) * 0.3 + 1.5, 4.2, pp.z + 6), V3(pp.x, 1.4, pp.z), 3);
  await say(n, `이것 좀 봐! 내 땀땀이가 키운 ${J(plantShort(seed), '이야', '야')}. ${seed.brag}`);
  const opts = n.praised ? ['역시 최고야!', seed.praise, '또 그 얘기야? 지겨운데…'] : ['우와, 정말 잘 키웠다!', seed.praise, '음… 별로 안 대단한데?'];
  const pick = await choose(n, opts);
  if (pick === 2) { // 공감해 주지 않으면 시무룩해져서 울어요
    n.sad = 5.5; n.hop = 0; SFX.play('deny');
    { // 옆에서 얼굴이 보이게
      const np = n.root.position, dx = G.pos.x - np.x, dz = G.pos.z - np.z, dl = Math.hypot(dx, dz) || 1, s = dx / dl >= 0 ? -1 : 1;
      camTo(V3(np.x + dx / dl * 1.0 + dz / dl * s * 5.2, 2.6, np.z + dz / dl * 1.0 - dx / dl * s * 5.2), V3(np.x + dx / dl * 0.8, 0.9, np.z + dz / dl * 0.8), 3);
    }
    await say(n, '…힝. 열심히 키웠는데… 너무해… 훌쩍훌쩍…');
    toast(`${J(nm, '이', '가')} 시무룩해졌어요. 다시 말을 걸어 달래 줄까요?`);
    camFollow();
    return;
  }
  n.sad = 0;
  n.hop = 0.9; SFX.play('happy');
  burst('heart', n.root.position.clone().add(V3(0, 1.8, 0)), 6);
  hearts(n.root.position);
  await say(n, `헤헤, 고마워! 비밀 하나 알려줄게. ${seed.tip}`);
  n.praised = true;
  camFollow();
}
async function mushroomQuest(n) {
  const nm = n.def.name;
  if (!n.met) { await say(n, `안녕 ${callName(G.name)}! 난 버섯집에 사는 ${J(nm, '이야', '야')}.`); n.met = true; }
  if (!G.flags.bag) { await say(n, '어? 빈손이네. 사과나무 근처를 잘 살펴봐! 뭔가 걸려 있던데?'); return; }
  if (G.inv.apple < 2) { await say(n, `배고파… 사과 2개만 있으면 내 양동이를 줄 수 있는데! (지금 🍎 ${G.inv.apple}개)`); return; }
  await say(n, '앗, 사과다! 나 사과 엄청 좋아하는데… 2개만 줄 수 있어?');
  const c = await choose(n, ['그래, 여기 있어!', '음… 다음에 줄게']);
  if (c === 1) { await say(n, '알았어. 마음 바뀌면 와!'); return; }
  G.inv.apple -= 2; refreshInventory();
  flyToWorld('🍎', V3(G.pos.x, 1.3, G.pos.z), n.root.position.clone().add(V3(0, 1, 0)));
  setTimeout(() => flyToWorld('🍎', V3(G.pos.x, 1.3, G.pos.z), n.root.position.clone().add(V3(0, 1, 0))), 150);
  n.hop = 0.8; SFX.play('happy'); hearts(n.root.position);
  await wait(500);
  G.flags.bucket = true; refreshInventory();
  SFX.play('bag'); toast('양동이를 얻었어요!', 'bucket');
  await say(n, '고마워! 대신 이 양동이를 줄게. 연못에서 물을 떠서 땀땀이에게 갖다줘!');
}
async function carpenterQuest(n) {
  if (!n.met) { await say(n, `뚝딱뚝딱… 오, 안녕 ${callName(G.name)}! 난 목수 사달희야.`); n.met = true; }
  if (!G.flags.bag) { await say(n, '빈손이구나. 사과나무 쪽에 가방이 걸려 있던데?'); return; }
  if (!G.flags.askedLadder) {
    const c0 = await choose(n, ['아저씨, 도끼로 사다리를 만들어 줄 수 있어요?', '그냥 인사하러 왔어요']);
    if (c0 === 1) { await say(n, '허허, 심심하면 또 놀러 와!'); return; }
    G.flags.askedLadder = true;
    await say(n, '사다리? 그럼, 뚝딱 만들어 주지! 그런데 일하려면 배가 든든해야 하거든. 사과 2개만 가져다줄래?');
  }
  if (G.inv.apple < 2) { await say(n, `사과 2개만 있으면 바로 만들어 줄게! (지금 🍎 ${G.inv.apple}개)`); return; }
  const c = await choose(n, ['여기 사과 2개요!', '다음에 올게요']);
  if (c === 1) { await say(n, '그래, 언제든 오라고!'); return; }
  G.inv.apple -= 2; refreshInventory();
  flyToWorld('🍎', V3(G.pos.x, 1.3, G.pos.z), n.root.position.clone().add(V3(0, 1, 0)));
  setTimeout(() => flyToWorld('🍎', V3(G.pos.x, 1.3, G.pos.z), n.root.position.clone().add(V3(0, 1, 0))), 150);
  n.hop = 0.8; SFX.play('happy'); hearts(n.root.position);
  await say(n, '아삭아삭, 힘이 난다! 잠깐만 기다려. 뚝딱뚝딱!');
  await carpenterWork(n);
  G.flags.ladder = true; refreshInventory();
  SFX.play('bag'); toast('사다리를 얻었어요!', 'ladder');
  tween(0.6, k => { G.playerHop = Math.sin(k * Math.PI) * 0.6; });
  await say(n, '짠, 튼튼한 사다리 완성! 언덕 아래에 세우고 올라가면 햇빛이 가득한 꼭대기가 나올 거야.');
}
// 뚝딱뚝딱 사다리 만들기
async function carpenterWork(n) {
  const bench = V3(-11, 1.5, 8.6);
  n.working = true;
  const home = n.root.position.clone();
  camTo(V3(-9.5, 6.5, 19.5), V3(-11, 1.0, 9.8), 2.5);
  await tween(0.5, k => { n.root.position.lerpVectors(home, V3(-11.4, 0, 10.3), k); });
  const axes = [0, 1].map(() => { const a = makeAxeMesh(); W.scene.add(a); return a; });
  let hits = 0;
  await tween(2.4, (k, raw) => {
    axes.forEach((a, i) => { const ph = raw * 14 + i * Math.PI; a.position.set(bench.x + Math.cos(ph) * 1.1, bench.y + 0.9 + Math.abs(Math.sin(ph * 0.7)) * 0.9, bench.z + Math.sin(ph) * 0.5); a.rotation.z = ph * 2; });
    if (raw * 8 > hits) { hits++; SFX.play('tok'); burst('puff', V3(bench.x + (Math.random() - .5) * 1.8, bench.y + Math.random() * 0.9, bench.z + 0.5), 4, { scale: 1.9 }); G.shake = 0.08; n.hop = 0.25; }
  }, t => t);
  axes.forEach(a => W.scene.remove(a));
  const lad = makeLadderMesh(2.6); lad.position.set(bench.x + 0.2, bench.y + 0.2, bench.z + 0.9); lad.rotation.z = 0.12; W.scene.add(lad);
  SFX.play('success'); burst('sparkle', lad.position.clone().add(V3(0, 1.3, 0)), 20);
  await tween(0.7, k => lad.scale.setScalar(Math.max(0.01, k)), ease.elastic);
  await wait(800);
  flyIcon(ICON.ladder, lad.position.clone().add(V3(0, 1.3, 0)), 'ladder');
  await tween(0.3, k => lad.scale.setScalar(Math.max(0.01, 1 - k)));
  W.scene.remove(lad);
  n.working = false;
  camFollow();
}

// ═════════ 목표 ═════════
function objective() {
  if (G.inPlaza) return G.mode === 'play' ? PZ.objective() : null;
  if (G.mode !== 'play' || G.stage >= 3) return null;
  const tr = W.refs.appleTree, h = W.refs.hill;
  const npc = (role) => G.npcs.find(n => n.role === role);
  const appleObj = () => {
    const ap = G.pickups.filter(p => p.kind === 'apple');
    if (ap.length) return { t: `떨어진 사과를 주워요 (🍎 ${G.inv.apple}/2)`, target: ap[0].mesh.position, h: 0.9 };
    return { t: `사과나무를 흔들어 사과를 얻어요 (🍎 ${G.inv.apple}/2)`, target: tr.root.position, h: 7.4 };
  };
  if (!G.flags.bag) {
    const bag = G.pickups.find(p => p.kind === 'bag');
    if (bag) return { t: '떨어진 가방을 주워요', target: bag.mesh.position, h: 1 };
    return { t: '커다란 사과나무를 흔들어 봐요', target: tr.root.position, h: 7.4 };
  }
  if (G.onHill) return G.inv.crystal > 0 ? { t: '반짝이를 높이 들어 햇빛을 담아요', target: null } : { t: '사다리를 타고 내려가요', target: null };
  if (!G.requestActive) return { t: '땀땀이가 자라고 있어요…', target: null };
  const r = currentReq();
  const needW = r.w - G.given.w, needN = r.n - G.given.n;
  if (G.inv.water < needW) {
    if (!G.flags.bucket) { if (G.inv.apple >= 2) { const m = npc('mushroom'); return { t: `${m.def.name}에게 사과 2개를 가져다줘요`, target: m.root.position, h: 2.2 }; } return appleObj(); }
    return { t: `연못에서 물을 떠요 (💧 ${G.inv.water}/${needW})`, target: W.refs.pond.position, h: 1.8 };
  }
  if (G.inv.nutrient < needN) {
    const lack = needN - G.inv.nutrient;
    if (G.inv.crystal < lack) {
      const rk = W.refs.rocks.find(q => q.cooldown <= 0) || W.refs.rocks[0];
      return { t: `바위에 돌멩이를 던져 반짝이를 모아요 (💎 ${G.inv.crystal}/${lack})`, target: rk.root.position, h: 2.6 };
    }
    if (!G.flags.ladder && !G.flags.ladderPlaced) {
      const c = npc('carpenter');
      if (!G.flags.sawHill && !G.flags.askedLadder) return { t: '반짝이에 햇빛을 담으러 높은 언덕으로 가요', target: h.base, h: 3.2 };
      if (!G.flags.askedLadder) return { t: '목수 사달희 아저씨에게 사다리를 부탁해요', target: c.root.position, h: 2.2 };
      if (G.inv.apple >= 2) return { t: '사달희 아저씨에게 사과 2개를 가져다줘요', target: c.root.position, h: 2.2 };
      return appleObj();
    }
    if (!G.flags.ladderPlaced) return { t: '언덕 아래에 사다리를 놓아요', target: h.base, h: 3.2 };
    return { t: '사다리로 언덕에 올라가 햇빛을 담아요', target: h.base, h: 3.2 };
  }
  return { t: '땀땀이에게 물과 양분을 가져다줘요!', target: V3(0, 0, 0), h: 8.6 };
}
function refreshObjective() {
  refreshPlazaBtn();
  const o = objective();
  const el = $('#objective');
  if (!o) { el.classList.remove('show'); G.obj = null; return; }
  if (el.dataset.t !== o.t) { el.dataset.t = o.t; $('#objText').textContent = o.t; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  el.classList.add('show');
  G.obj = o;
}

// ═════════ 화면 라벨(말풍선 등) ═════════
const _s = { x: 0, y: 0, visible: false };
function updateLabels() {
  // 상호작용 안내
  const pr = $('#prompt');
  const it = G.mode === 'play' && !G.busy ? nearestInteractable() : null;
  if (it) {
    worldToScreen(V3(it.pos.x, it.h, it.pos.z), _s);
    pr.style.transform = `translate(${_s.x}px, ${_s.y}px) translate(-50%, -100%)`;
    if (pr.dataset.l !== it.label) { pr.dataset.l = it.label; $('#promptText').textContent = it.label; }
    pr.classList.add('show'); $('#actBtn').classList.add('ready'); $('#actLabel').textContent = it.label;
  } else { pr.classList.remove('show'); $('#actBtn').classList.remove('ready'); $('#actLabel').textContent = '살펴보기'; }
  // 목표 마커
  const mk = $('#marker');
  if (G.obj && G.obj.target && G.mode === 'play' && !G.busy && !(it && Math.hypot(it.pos.x - G.obj.target.x, it.pos.z - G.obj.target.z) < 2)) {
    worldToScreen(V3(G.obj.target.x, G.obj.target.y + (G.obj.h || 2), G.obj.target.z), _s);
    const m = 46, x = Math.min(window.innerWidth - m, Math.max(m, _s.x)), y = Math.min(window.innerHeight - 140, Math.max(110, _s.y));
    mk.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    mk.classList.toggle('edge', !_s.visible || x !== _s.x || y !== _s.y);
    mk.classList.add('show');
  } else mk.classList.remove('show');
  // 물방울 요청 말풍선
  const rb = $('#reqBubble');
  if (G.requestActive && G.floatDrop.visible && ['play', 'cutscene'].includes(G.mode)) {
    worldToScreen(G.floatDrop.position.clone().add(V3(0, 0.2, 0)), _s);
    const by = Math.min(window.innerHeight - 220, Math.max(74, _s.y)), bx = Math.min(window.innerWidth - 250, Math.max(20, _s.x));
    rb.style.transform = `translate(${bx}px, ${by}px)`;
    rb.classList.toggle('show', _s.visible);
  } else rb.classList.remove('show');
  // 이름표
  for (const n of G.npcs) {
    const d = G.player ? Math.hypot(G.pos.x - n.root.position.x, G.pos.z - n.root.position.z) : 99;
    const el = n.tag || (n.tag = makeTag(n.def.name));
    if (G.mode === 'play' && d < 9 && !n.talking) {
      worldToScreen(n.root.position.clone().add(V3(0, 2.1 + (n.def.acc === 'santa' || n.def.acc === 'heart' ? 0.6 : 0.2), 0)), _s);
      el.style.transform = `translate(${_s.x}px, ${_s.y}px) translate(-50%, -100%)`;
      el.classList.toggle('show', _s.visible);
    } else el.classList.remove('show');
  }
  const tt = $('#ttamiTag');
  if (G.mode === 'play' && G.player && Math.hypot(G.pos.x, G.pos.z) < 9 && !G.requestActive) {
    worldToScreen(V3(0, 4.0, 0), _s); tt.style.transform = `translate(${_s.x}px, ${_s.y}px) translate(-50%, -100%)`; tt.classList.add('show');
  } else tt.classList.remove('show');
}
function makeTag(name) { const e = document.createElement('div'); e.className = 'nameTag'; e.textContent = name; $('#labels').appendChild(e); return e; }
function updateReqBubble(pop) {
  if (!G.seedId) return;
  const r = currentReq();
  const w = $('#reqW'), n = $('#reqN');
  w.innerHTML = dots('💧', r.w, G.given.w); n.innerHTML = dots('☀️', r.n, G.given.n);
  $('#reqNRow').style.display = r.n ? '' : 'none';
  if (pop) { const b = $('#reqBubble .bub'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
}
function dots(icon, need, got) {
  let s = '';
  for (let i = 0; i < need; i++) s += `<i class="${i < got ? 'got' : ''}">${icon}</i>`;
  return s;
}

// ═════════ UI 효과 ═════════
function toast(msg, icon) {
  const t = $('#toast');
  $('#toastText').textContent = msg;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
function flyIcon(icon, worldPos, slot) {
  worldToScreen(worldPos, _s);
  const target = $(`.slot[data-k="${slot}"]`);
  if (!target) return;
  const tr = target.getBoundingClientRect();
  const e = document.createElement('div'); e.className = 'flyIcon'; e.innerHTML = icon; document.body.appendChild(e);
  e.animate([
    { transform: `translate(${_s.x}px, ${_s.y}px) scale(0.6)` },
    { transform: `translate(${(_s.x + tr.left) / 2}px, ${Math.min(_s.y, tr.top) - 120}px) scale(1.4)`, offset: 0.45 },
    { transform: `translate(${tr.left + tr.width / 2}px, ${tr.top + tr.height / 2}px) scale(0.8)` },
  ], { duration: 750, easing: 'cubic-bezier(.4,0,.3,1)' }).onfinish = () => { e.remove(); target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); };
}
function flyToWorld(icon, from, to) {
  const a = worldToScreen(from, { x: 0, y: 0 }), b = worldToScreen(to, { x: 0, y: 0 });
  const e = document.createElement('div'); e.className = 'flyIcon'; e.innerHTML = icon; document.body.appendChild(e);
  e.animate([
    { transform: `translate(${a.x}px, ${a.y}px) scale(1)` },
    { transform: `translate(${(a.x + b.x) / 2}px, ${Math.min(a.y, b.y) - 90}px) scale(1.3)`, offset: 0.5 },
    { transform: `translate(${b.x}px, ${b.y}px) scale(0.4)`, opacity: 0.2 },
  ], { duration: 600, easing: 'cubic-bezier(.4,0,.3,1)' }).onfinish = () => e.remove();
}
function hearts(pos) {
  const p = worldToScreen(pos.clone().add(V3(0, 1.8, 0)), { x: 0, y: 0 });
  for (let i = 0; i < 5; i++) {
    const e = document.createElement('div'); e.className = 'flyIcon heartFx'; e.textContent = ['💛', '💕', '💗'][i % 3]; document.body.appendChild(e);
    const dx = (Math.random() - .5) * 120;
    e.animate([{ transform: `translate(${p.x}px, ${p.y}px) scale(0.3)`, opacity: 1 }, { transform: `translate(${p.x + dx}px, ${p.y - 110 - Math.random() * 60}px) scale(1.2)`, opacity: 0 }],
      { duration: 1100 + i * 120, easing: 'ease-out', delay: i * 80 }).onfinish = () => e.remove();
  }
}

// ═════════ 인벤토리 ═════════
function showInventory() { $('#inventory').classList.add('show'); }
function refreshInventory() {
  const set = (k, v, show = true) => { const q = $(`.slot[data-k="${k}"]`); q.classList.toggle('on', show); const c = q.querySelector('b'); if (c) c.textContent = v; };
  set('apple', G.inv.apple, true);
  set('bucket', '', !!G.flags.bucket);
  set('water', G.inv.water, G.flags.bucket || G.inv.water > 0);
  set('ladder', '', !!(G.flags.ladder || G.flags.ladderPlaced));
  set('crystal', G.inv.crystal, G.inv.crystal > 0 || !!G.flags.gotCrystal);
  set('nutrient', G.inv.nutrient, G.inv.nutrient > 0 || !!G.flags.gotCrystal);
}

// ═════════ 대화창 ═════════
const SPEAKERS = { ttami: { name: '땀땀이', color: '#EE8A55', voice: 1.35 } };
let dlgResolve = null, dlgTyping = false, dlgFull = '';
function speakerInfo(sp) {
  if (!sp) return { name: '', color: '#8FA3B5', voice: 1 };
  if (sp === 'ttami') return SPEAKERS.ttami;
  if (sp === 'me') return { name: G.name, color: '#5DB866', voice: CHAR_BY_ID[G.charId].voice };
  return { name: sp.def.name, color: '#6BB4E6', voice: sp.def.voice };
}
function say(sp, text) {
  return new Promise(res => {
    const info = speakerInfo(sp);
    const d = $('#dialog');
    d.classList.add('show'); d.classList.toggle('narr', !sp);
    $('#dlgName').textContent = info.name; $('#dlgName').style.background = info.color; $('#dlgName').style.display = info.name ? '' : 'none';
    $('#dlgChoices').innerHTML = ''; $('#dlgNext').style.visibility = 'hidden';
    const te = $('#dlgText'); te.textContent = '';
    dlgFull = text; dlgTyping = true;
    let i = 0;
    clearInterval(G._typer);
    G._typer = setInterval(() => {
      if (!dlgTyping) return;
      i++;
      te.textContent = text.slice(0, i);
      const ch = text[i - 1];
      if (i % 2 === 0 && ch && ch.trim() && !/[.,!?;~…]/.test(ch)) SFX.play('blip', info.voice);
      if (i >= text.length) { dlgTyping = false; clearInterval(G._typer); $('#dlgNext').style.visibility = 'visible'; }
    }, 32);
    dlgResolve = () => { d.classList.remove('show'); res(); };
  });
}
function choose(sp, options) {
  return new Promise(res => {
    const box = $('#dlgChoices'); box.innerHTML = '';
    $('#dialog').classList.add('show');
    $('#dlgNext').style.visibility = 'hidden';
    options.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'choice'; b.textContent = o;
      b.style.animationDelay = i * 0.07 + 's';
      b.onclick = (e) => { e.stopPropagation(); SFX.play('click'); box.innerHTML = ''; $('#dialog').classList.remove('show'); dlgResolve = null; res(i); };
      box.appendChild(b);
    });
    dlgResolve = null;
    setTimeout(() => box.querySelector('.choice')?.focus(), 50);
  });
}
function advanceDialog() {
  if (!$('#dialog').classList.contains('show')) return false;
  if ($('#dlgChoices').children.length) return true;
  if (dlgTyping) { dlgTyping = false; clearInterval(G._typer); $('#dlgText').textContent = dlgFull; $('#dlgNext').style.visibility = 'visible'; return true; }
  if (dlgResolve) { SFX.play('click'); const r = dlgResolve; dlgResolve = null; r(); }
  return true;
}

// ═════════ 이야기(스토리텔링) ═════════
const STORY = [
  { text: '숲속 작은 언덕 너머, 요정들이 오순도순 모여 사는 마을이 있어요.', cam: 'orbit' },
  { text: '마을 한가운데에는 ‘땀땀이’라는 신기한 화분이 살아요. 목이 마르면 땀처럼 물방울을 쏙 올려 보내는 화분이지요.', cam: [V3(4.5, 6, 16), V3(0, 0.8, 3)] },
  { text: '요정들은 소중한 씨앗을 가져와 땀땀이에게 하나씩 심어요.', cam: [V3(7, 5.5, 15.5), V3(1.5, 0.6, 4)], act: 'plant' },
  { text: '땀땀이는 씨앗을 싹틔우고 무럭무럭 키워서, 요정 마을을 평화롭고 행복하게 지켜 줘요.', cam: [V3(-5, 7.5, 19), V3(0, 2.6, 2)], act: 'grow' },
  { text: '물이 필요할 때면 땀땀이는 머리 위로 물방울을 올려 보내요. 필요한 만큼 물과 양분을 받으면, 물방울은 스르륵 다시 들어가요.', cam: [V3(3, 8, 19), V3(0, 3.2, 2)], act: 'drop' },
  { text: '이제 당신 차례예요! 땀땀이가 씨앗을 키울 수 있게 도와줄래요?', cam: [V3(0, 9, 21), V3(0, 2.6, 2)], last: true },
];
let storyIdx = 0, storyActor = null;
function startStory() {
  G.mode = 'story';
  $('#title').classList.add('hide');
  $('#story').classList.add('show');
  storyIdx = 0;
  setTtamiPlant(G.ttami, null, -1);
  G.floatDrop.visible = false; setTtamiDrop(G.ttami, 0, true);
  showStory();
}
async function showStory() {
  const s = STORY[storyIdx];
  const card = $('#storyCard');
  card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  $('#storyText').textContent = s.text;
  $('#storyNext').textContent = s.last ? '도와줄래요!' : '다음';
  $('#storyDots').innerHTML = STORY.map((_, i) => `<i class="${i === storyIdx ? 'on' : ''}"></i>`).join('');
  if (s.cam === 'orbit') G.cam.mode = 'orbit'; else camTo(s.cam[0], s.cam[1], 1.6);
  SFX.play('open');
  const myIdx = storyIdx;
  if (s.act === 'plant') {
    if (!storyActor) { storyActor = buildCharacter(CHAR_BY_ID.miyeok); W.scene.add(storyActor); }
    storyActor.visible = true; storyActor.position.set(6, 0, 7); storyActor.rotation.y = Math.atan2(-6, -7);
    const seedM = ell(null, PM.seed, 0.12, 0.07, 0.18, 0, 0, 0, 12); W.scene.add(seedM); seedM.visible = false;
    let walkT = 0;
    await tween(1.6, k => { storyActor.position.set(6 - 3.6 * k, 0, 7 - 3.8 * k); walkT += 0.016; animateCharacter(storyActor, G.t, 4); });
    animateCharacter(storyActor, G.t, 0, { wave: true });
    if (myIdx !== storyIdx) { W.scene.remove(seedM); return; }
    const a = V3(2.4, 1.2, 3.2), b = new THREE.Vector3(); G.ttami.userData.anchor.getWorldPosition(b);
    seedM.visible = true; SFX.play('whoosh');
    await tween(0.9, k => { seedM.position.lerpVectors(a, b, k); seedM.position.y += Math.sin(k * Math.PI) * 2.5; seedM.rotation.z = k * 8; }, t => t);
    W.scene.remove(seedM); SFX.play('plop');
    burst('sparkle', b, 12);
    setTtamiPlant(G.ttami, 'sunflower', 1, PLANT_SCALE_BIG);
  } else if (s.act === 'grow') {
    if (storyActor) storyActor.visible = false;
    for (const st of [2, 3]) {
      const p = setTtamiPlant(G.ttami, 'sunflower', st, PLANT_SCALE_BIG); SFX.play('grow');
      const aw = new THREE.Vector3(); G.ttami.userData.anchor.getWorldPosition(aw); burst('sparkle', aw.clone().add(V3(0, 1.5, 0)), 20);
      p.scale.setScalar(0.01); await tween(1.0, k => p.scale.setScalar(PLANT_SCALE_BIG * Math.max(0.01, k)), ease.elastic);
      await wait(400); if (myIdx !== storyIdx) return;
    }
  } else if (s.act === 'drop') {
    setTtamiPlant(G.ttami, 'sunflower', 2, PLANT_SCALE_BIG);
    setTtamiDrop(G.ttami, 1); SFX.play('rise');
    const fd = G.floatDrop; const from = new THREE.Vector3(); G.ttami.userData.drop.getWorldPosition(from);
    fd.visible = true; fd.userData.on = false;
    await tween(1.2, k => { fd.position.lerpVectors(from, V3(0, 6.6, 0), k); fd.scale.setScalar(0.3 + 0.7 * k); }, ease.inOut);
    fd.userData.base.set(0, 6.6, 0); fd.userData.on = true;
    await wait(1600); if (myIdx !== storyIdx) return;
    fd.userData.on = false; SFX.play('absorb');
    const top = fd.position.clone();
    await tween(1.3, k => { fd.position.lerpVectors(top, from, k); fd.scale.setScalar(1 - 0.75 * k); }, ease.inOut);
    fd.visible = false; setTtamiDrop(G.ttami, 0);
    setTtamiPlant(G.ttami, 'sunflower', 3, PLANT_SCALE_BIG); SFX.play('grow');
    const aw = new THREE.Vector3(); G.ttami.userData.anchor.getWorldPosition(aw); burst('sparkle', aw.clone().add(V3(0, 2, 0)), 24);
  }
}
function storyNext() {
  SFX.play('click');
  if (STORY[storyIdx].last) return endStory();
  storyIdx++; showStory();
}
function endStory() {
  $('#story').classList.remove('show');
  if (storyActor) storyActor.visible = false;
  G.floatDrop.visible = false; setTtamiDrop(G.ttami, 0);
  openSetup(1);
}

// ═════════ 설정(이름/캐릭터/씨앗) ═════════
let setupStep = 1;
function openSetup(step = 1) {
  G.mode = 'setup'; G.cam.mode = 'orbit';
  $('#setup').classList.add('show');
  setupStep = step; renderSetup();
}
function renderSetup() {
  $$('#setup .step').forEach(s => s.classList.toggle('on', +s.dataset.step === setupStep));
  $$('#setupProg i').forEach((d, i) => { d.classList.toggle('on', i + 1 === setupStep); d.classList.toggle('done', i + 1 < setupStep); });
  $('#nameInput').value = G.name;
  if (setupStep === 1) setTimeout(() => $('#nameInput').focus(), 100);
  $$('.charCard').forEach(c => c.classList.toggle('sel', c.dataset.id === G.charId));
  $$('.seedCard').forEach(c => { c.classList.toggle('sel', c.dataset.id === G.seedId); c.classList.toggle('done', G.completed.has(c.dataset.id)); });
  validateSetup();
  if (setupStep === 3) renderSeedDetail();
}
function validateSetup() {
  $('#nameNext').disabled = !$('#nameInput').value.trim();
  $('#charNext').disabled = !G.charId;
  $('#seedGo').disabled = !G.seedId; $('#seedPlaza').disabled = !G.seedId || !G.charId || !G.name;
  const c = CHAR_BY_ID[G.charId];
  $('#charPick').innerHTML = c ? `<img src="${assetURL('assets/chars/' + c.img + '.webp')}" alt=""><span>${J(c.name, '이', '가')} 함께할게요!</span>` : '<span>함께할 요정을 골라 주세요</span>';
}
function renderSeedDetail() {
  const s = SEED_BY_ID[G.seedId];
  const el = $('#seedDetail');
  if (!s) { el.innerHTML = '<p class="muted">씨앗을 하나 골라 주세요. 완성하면 다른 씨앗도 심을 수 있어요.</p>'; return; }
  el.innerHTML = `<div class="sdHead"><span class="sdEmoji" style="--c:${s.pack}">${s.emoji}</span><div><b>${s.name}</b><small>${stars(s.level)} 집에서 키우기</small></div></div>
    <p>${s.seed}</p><div class="sdRow"><span>💧 ${s.water}</span><span>🌱 싹트기 ${s.sprout}</span></div>`;
}
function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
function buildSetupLists() {
  $('#charGrid').innerHTML = CHARACTERS.map(c => `<button class="charCard" data-id="${c.id}"><img src="${assetURL('assets/chars/' + c.img + '.webp')}" alt=""><span>${c.name}</span></button>`).join('');
  $('#seedGrid').innerHTML = SEEDS.map(s => `<button class="seedCard" data-id="${s.id}" style="--c:${s.pack}"><span class="pk"><em>${s.emoji}</em></span><b>${plantShort(s)}</b><small>${stars(s.level)}</small><i class="badge">완성!</i></button>`).join('');
  $$('.charCard').forEach(b => b.onclick = () => { G.charId = b.dataset.id; SFX.play('click'); renderSetup(); });
  $$('.seedCard').forEach(b => b.onclick = () => { G.seedId = b.dataset.id; SFX.play('click'); renderSetup(); });
}
async function startGame() {
  $('#setup').classList.remove('show');
  SFX.play('click');
  // 리셋
  G.stage = 0; G.reqIdx = 0; G.given = { w: 0, n: 0 }; G.requestActive = false;
  G.inv.water = 0; G.inv.nutrient = 0; G.inv.crystal = 0; G.onHill = false; G.posY = 0; G.sunHold = false;
  for (const p of G.pickups) W.scene.remove(p.mesh); G.pickups = [];
  setTtamiPlant(G.ttami, null, -1); setTtamiDrop(G.ttami, 0, true); G.floatDrop.visible = false;
  spawnPlayer(); buildNPCs();
  for (const n of G.npcs) if (n.tag) { n.tag.remove(); n.tag = null; }
  $$('.nameTag').forEach(e => e.remove());
  G.mode = 'cutscene'; G.busy = true;
  $('#hud').classList.add('show');
  refreshInventory(); if (G.flags.bag) showInventory();
  G.cam.pos.set(0, 16, 26);
  camTo(V3(5, 7, 17), V3(0, 1.8, 3.5), 2);
  await wait(900);
  // 씨앗 심기
  const seed = SEED_BY_ID[G.seedId];
  await say('ttami', `안녕;; 난 땀땀이야;; 네가 ${callName(G.name)}?;; ${J(plantShort(seed), '을', '를')} 심어 줄 거야;;?`);
  facePoint(V3(0, 0, 0));
  G.playerHop = 0; await tween(0.4, k => { G.playerHop = Math.sin(k * Math.PI) * 0.5; });
  const seedM = ell(null, PM.seed, 0.12, 0.07, 0.18, 0, 0, 0, 12); W.scene.add(seedM);
  const a = V3(G.pos.x, 1.4, G.pos.z), b = new THREE.Vector3(); G.ttami.userData.anchor.getWorldPosition(b);
  SFX.play('whoosh');
  await tween(1.0, k => { seedM.position.lerpVectors(a, b, k); seedM.position.y += Math.sin(k * Math.PI) * 3; seedM.rotation.z = k * 9; }, t => t);
  W.scene.remove(seedM); SFX.play('plop'); burst('sparkle', b, 14);
  setTtamiPlant(G.ttami, G.seedId, 0, PLANT_SCALE_BIG);
  tween(0.5, k => { const s = 1 + Math.sin(k * Math.PI) * 0.07; G.ttami.scale.set(s, 1 / s, s); });
  await wait(600);
  camFocusTtami();
  await say('ttami', `씨앗이 쏙 들어왔어;;! 고마워;;`);
  await wait(200);
  await raiseRequest();
  await say('ttami', `앗… 목말라;; 머리 위 물방울 보이지;;? 물이랑 햇빛 양분을 저만큼 모아다 줘;;`);
  await say('ttami', '양분은 바위에 붙은 반짝이에 햇빛을 담아 오면 돼;;');
  if (!G.flags.bag) await say('ttami', '근데… 담을 게 없네;; 저기 커다란 사과나무를 흔들어 보면 뭐가 떨어질지도;;');
  else await say('ttami', '가방이랑 도구가 있으니까 금방 모을 수 있을 거야;;');
  camFollow();
  G.mode = 'play'; G.busy = false;
  refreshObjective();
  if (!G.seenHelp) { G.seenHelp = true; showHelp(true); }
}

// ═════════ 완성 화면 ═════════
function showComplete() {
  const s = SEED_BY_ID[G.seedId];
  G.mode = 'complete';
  $('#hud').classList.remove('show');
  const el = $('#complete');
  $('#cpEmoji').textContent = s.emoji; $('#cpEmoji').style.setProperty('--c', s.pack);
  $('#cpTitle').textContent = `${plantShort(s)} 완성!`;
  $('#cpSub').textContent = `${callName(G.name)}, 땀땀이와 함께 ${J(s.name, '을', '를')} 끝까지 키웠어요.`;
  $('#cpWater').textContent = s.water; $('#cpWaterD').textContent = s.waterDetail;
  $('#cpLevel').innerHTML = `<span class="st">${'★'.repeat(s.level)}<em>${'★'.repeat(5 - s.level)}</em></span><small>${['', '아주 쉬워요', '쉬워요', '보통이에요', '조금 어려워요', '어려워요'][s.level]}</small>`;
  $('#cpSeed').textContent = s.seed; $('#cpPlant').textContent = s.plant;
  $('#cpMeta').innerHTML = `<span>☀️ ${s.sun}</span><span>🌱 싹트기 ${s.sprout}</span><span>🧺 ${s.harvest}</span>`;
  $('#cpTip').textContent = s.tip;
  el.classList.add('show');
  G.busy = false;
  G.cam.mode = 'fixed';
}
function replay() {
  SFX.play('click');
  PZ.exitQuiet();
  $('#complete').classList.remove('show');
  closeInfo(); closeApp();
  G.render3D = true; SFX.pauseBgm(false);
  G.seedId = null;
  $('#hud').classList.remove('show');
  openSetup(3);
}
function goHome() {
  SFX.play('click');
  if (!G._homeArmed) { G._homeArmed = true; toast('한 번 더 누르면 처음 화면으로 돌아가요'); setTimeout(() => { G._homeArmed = false; }, 3000); return; }
  location.reload();
}

// ⛲ 버튼: 식물을 다 키운 뒤에만 광장으로 갈 수 있어요. 광장에서는 나가기
function goPlaza() {
  if (G.inPlaza) { if (G.mode === 'play' && !G.busy) { SFX.play('click'); PZ.leave(); } return; }
  const ok = G.completed.size > 0 && G.stage >= 3;
  if (!ok || G.mode !== 'play' || G.busy || G.onHill) { SFX.play('deny'); if (G.mode === 'play') toast(ok ? '지금은 광장으로 갈 수 없어요' : '식물을 끝까지 키우면 광장에 갈 수 있어요'); return; }
  PZ.enter('village');
}

// ═════════ 도움말 ═════════
function showHelp(first) { $('#help').classList.add('show'); $('#help').dataset.first = first ? '1' : ''; }

// ═════════ UI 연결 ═════════
function buildUI() {
  buildSetupLists();
  $('#titleStart').onclick = () => { SFX.init(); SFX.play('click'); startStory(); };
  $('#storyNext').onclick = storyNext;
  $('#storySkip').onclick = () => { SFX.play('click'); endStory(); };
  $('#nameInput').oninput = () => { G.name = $('#nameInput').value.trim().slice(0, 8); validateSetup(); };
  $('#nameInput').onkeydown = (e) => { if (e.key === 'Enter' && G.name) { e.preventDefault(); setupStep = 2; SFX.play('click'); renderSetup(); } e.stopPropagation(); };
  $('#nameNext').onclick = () => { setupStep = 2; SFX.play('click'); renderSetup(); };
  $('#charBack').onclick = () => { setupStep = 1; SFX.play('click'); renderSetup(); };
  $('#charNext').onclick = () => { setupStep = 3; SFX.play('click'); renderSetup(); };
  $('#seedBack').onclick = () => { setupStep = 2; SFX.play('click'); renderSetup(); };
  $('#seedGo').onclick = startGame;
  $('#cpLearn').onclick = openTtamiInfo;
  $('#cpReplay').onclick = replay;
  $('#cpBrag').onclick = () => { SFX.play('click'); PZ.enter('complete'); };
  $('#seedPlaza').onclick = () => { if (!G.seedId || !G.charId || !G.name) return; SFX.play('click'); PZ.enter('setup'); };
  $('#titleBoard').onclick = () => { SFX.init(); SFX.play('click'); GB.open(); };
  $('#btnSound').onclick = () => { SFX.init(); SFX.setMuted(!SFX.muted); $('#btnSound').classList.toggle('off', SFX.muted); SFX.play('click'); };
  $('#btnMusic').onclick = () => { SFX.init(); SFX.setBgm(!SFX.bgm); $('#btnMusic').classList.toggle('off', !SFX.bgm); SFX.play('click'); };
  $('#btnHelp').onclick = () => { SFX.play('click'); showHelp(false); };
  $('#btnHome').onclick = goHome;
  $('#btnPlaza').onclick = goPlaza;
  $('#btnDayNight').onclick = () => { SFX.init(); PZ.toggleMood(); };
  $('#helpClose').onclick = () => { SFX.play('click'); $('#help').classList.remove('show'); };
  $('#dialog').onclick = () => advanceDialog();
  $('#actBtn').onclick = (e) => { e.preventDefault(); if (!advanceDialog()) interact(); };

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (GB.isOpen() || MP.menuOpen()) return;
    G.keys[e.code] = true;
    if (['Space', 'KeyE', 'Enter', 'KeyZ'].includes(e.code)) {
      if ($('#help').classList.contains('show')) { $('#help').classList.remove('show'); e.preventDefault(); return; }
      if (G.mode === 'story') { e.preventDefault(); storyNext(); return; }
      if (G.mode === 'title' && e.code !== 'KeyE') { e.preventDefault(); $('#titleStart').click(); return; }
      if (advanceDialog()) { e.preventDefault(); return; }
      if (G.mode === 'play') { e.preventDefault(); interact(); }
    }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  window.addEventListener('blur', () => { G.keys = {}; });

  // 조이스틱
  const joy = $('#joy'), knob = $('#joyKnob');
  let jid = null, jc = { x: 0, y: 0 };
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; moveJ(e); joy.classList.add('act'); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) moveJ(e); });
  const endJ = (e) => { if (e.pointerId !== jid) return; jid = null; G.joy.x = G.joy.y = 0; knob.style.transform = ''; joy.classList.remove('act'); };
  joy.addEventListener('pointerup', endJ); joy.addEventListener('pointercancel', endJ);
  function moveJ(e) {
    let dx = e.clientX - jc.x, dy = e.clientY - jc.y; const R = 46, d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    G.joy.x = dx / R; G.joy.y = dy / R;
  }
  // 버튼 호버 효과음
  document.addEventListener('pointerover', (e) => { if (e.target.closest && e.target.closest('.btn, .charCard, .seedCard, .choice') && e.pointerType === 'mouse') SFX.play('hover'); });
}

