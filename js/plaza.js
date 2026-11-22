// 물줄때 마을 · 광장 (다른 접속자와 만나고 방명록을 남기는 곳)
// 마을과 길로 이어지지 않은 따로 떨어진 공간이에요. 들어오는 방법은 두 가지뿐:
//   1) 식물을 끝까지 키운 뒤 완성 창의 '광장에 가서 자랑하기'
//   2) 시작 화면에서 이름·캐릭터·씨앗을 고른 뒤 '광장 먼저 구경하기'
// 해 질 녘 하늘 + 벽돌 광장 + 마을회관 + 방명록 게시판 + 풍선 + 불꽃놀이
const PLAZA = { x: 0, z: -170, r: 13.5, bound: 15.6 };

const PZ = (() => {
  let built = false, from = null, saved = null;
  const anim = { balloons: [], flags: [], rockets: [], sparks: [], fwT: 1.5, clock: null };
  const at = (dx, dz) => V3(PLAZA.x + dx, 0, PLAZA.z + dz);
  const col = (dx, dz, r) => collider(PLAZA.x + dx, PLAZA.z + dz, r);

  // ─── 벽돌 바닥 텍스처 (동심원으로 깔린 벽돌 + 가운데 부채꼴 무늬) ───
  function brickTexture() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), R = rnd(77), cx = S / 2, k = S / 2 / (PLAZA.r + 0.6);
    g.fillStyle = '#9C5E45'; g.fillRect(0, 0, S, S);
    const tones = ['#C9805F', '#C47656', '#D08B69', '#BD7052', '#CC8664'];
    const sector = (r0, r1, a0, a1, fill) => { g.beginPath(); g.arc(cx, cx, r1, a0, a1); g.arc(cx, cx, r0, a1, a0, true); g.closePath(); g.fillStyle = fill; g.fill(); };
    // 가운데 원판 + 부채꼴 무늬
    const rc = 2.2 * k;
    for (let ring = 0; ring < 4; ring++) {
      const r0 = ring * rc / 4, r1 = (ring + 1) * rc / 4, n = 6 + ring * 6;
      for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; sector(r0 + 1.5, r1 - 1.5, a0 + 0.015, a1 - 0.015, tones[(i + ring) % 5]); }
    }
    // 바깥으로 동심원 벽돌
    let r = rc + 4, row = 0;
    while (r < (PLAZA.r - 0.6) * k) {
      const h = 0.62 * k, n = Math.max(8, Math.round(2 * Math.PI * (r + h / 2) / (1.05 * k))), off = (row % 2) * 0.5;
      for (let i = 0; i < n; i++) { const a0 = (i + off) / n * Math.PI * 2, a1 = (i + 1 + off) / n * Math.PI * 2; sector(r + 1.5, r + h - 1.5, a0 + 0.012, a1 - 0.012, tones[(R() * 5) | 0]); }
      r += h; row++;
    }
    // 테두리 돌
    g.lineWidth = 0.7 * k; g.strokeStyle = '#E9D6B8'; g.beginPath(); g.arc(cx, cx, (PLAZA.r + 0.05) * k, 0, 7); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(120,80,50,.5)'; g.beginPath(); g.arc(cx, cx, (PLAZA.r - 0.32) * k, 0, 7); g.stroke();
    // 살짝 얼룩
    for (let i = 0; i < 260; i++) { const x = R() * S, y = R() * S, rr = 6 + R() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${R() < .5 ? '255,230,200' : '90,50,30'},0.10)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function signTexture(text, w, h, bg, fg, font = 64) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = `${font}px 'Jua', 'Noto Sans KR', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  // ─── 소품 ───
  function bench(parent, x, z, ry) {
    const b = new THREE.Group(); b.position.copy(at(x, z)); b.rotation.y = ry; parent.add(b);
    const wood = M('#4E9A6A'), dk = M('#3B7A52');
    for (let i = 0; i < 3; i++) add(b, roundedBox(2.4, 0.1, 0.2, 0.04, 2), wood, 0, 0.58, -0.22 + i * 0.22);
    for (let i = 0; i < 2; i++) add(b, roundedBox(2.4, 0.16, 0.08, 0.04, 2), wood, 0, 0.9 + i * 0.22, -0.36);
    for (const lx of [-1.0, 1.0]) { add(b, roundedBox(0.14, 0.58, 0.6, 0.05, 2), dk, lx, 0.29, -0.05); add(b, roundedBox(0.12, 0.75, 0.1, 0.04, 2), dk, lx, 0.95, -0.38); }
    col(x, z, 1.1);
  }
  function lamp(parent, x, z) {
    const p = at(x, z);
    add(parent, cyl(0.28, 0.34, 0.3, 12), M('#2E3238'), p.x, 0.15, p.z);
    add(parent, cyl(0.09, 0.12, 3.4, 10), M('#2E3238'), p.x, 1.85, p.z);
    add(parent, cyl(0.22, 0.16, 0.12, 10), M('#2E3238'), p.x, 3.55, p.z);
    if (!glowMats.lamp) glowMats.lamp = new THREE.MeshStandardMaterial({ color: '#FFE7A6', emissive: '#FFC861', emissiveIntensity: 1.4, roughness: 0.6 });
    ell(parent, glowMats.lamp, 0.25, 0.32, 0.25, p.x, 3.92, p.z, 14);
    add(parent, new THREE.ConeGeometry(0.32, 0.3, 10), M('#2E3238'), p.x, 4.33, p.z);
    col(x, z, 0.45);
    return V3(p.x, 3.9, p.z);
  }
  function balloon(parent, x, z, h, color) {
    const g = new THREE.Group(); g.position.copy(at(x, z)); parent.add(g);
    const b = ell(g, M(color, { r: 0.35, rim: 0.3 }), 0.42, 0.5, 0.42, 0, h, 0, 18);
    add(g, new THREE.ConeGeometry(0.08, 0.12, 8), M(color), 0, h - 0.53, 0).rotation.x = Math.PI;
    add(g, cyl(0.008, 0.008, h - 0.5, 4), M('#FFFFFF'), 0, (h - 0.5) / 2, 0, false);
    anim.balloons.push({ g, ph: Math.random() * 6 });
  }
  function bunting(parent, a, b, n) {
    const cols = ['#FF6B8B', '#FFD23A', '#6BC4F0', '#7CC46E', '#B98CFF', '#FF9E5E'];
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.7, a.z + (b.z - a.z) * t]); }
    add(parent, tube(pts, 0.02, 24, 4), M('#FFFFFF'), 0, 0, 0, false);
    for (let i = 1; i < n; i++) {
      const t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.7, z = a.z + (b.z - a.z) * t;
      const f = add(parent, new THREE.ConeGeometry(0.2, 0.42, 3), M(cols[i % cols.length], { ds: true }), x, y - 0.22, z, false);
      f.rotation.x = Math.PI; f.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); f.scale.z = 0.25;
    }
  }

  // ─── 마을회관 (시계탑이 있는 작은 회관) ───
  function hall(parent, live) {
    const h = new THREE.Group(); h.position.copy(at(0, -17.5)); parent.add(h);
    const wall = M('#F6E6CC', { rim: 0.12 }), trim = M('#E7CFA9'), roof = M('#E0745A', { rim: 0.14 }), roofD = M('#C95E46'), wood = M('#A8693E'), glow = (glowMats.win = new THREE.MeshStandardMaterial({ color: '#FFE2A0', emissive: '#FFB84A', emissiveIntensity: 0.9, roughness: 0.6 }));
    add(h, roundedBox(13, 0.5, 6.6, 0.18, 3), trim, 0, 0.25, 0);
    add(h, roundedBox(12.2, 4.4, 5.8, 0.4, 5), wall, 0, 2.6, 0);
    add(h, roundedBox(13.2, 0.36, 6.8, 0.16, 3), roofD, 0, 4.9, 0);
    const rf = add(h, roundedBox(12.6, 1.9, 6.2, 0.9, 6), roof, 0, 5.75, 0); rf.scale.z = 0.92;
    // 가운데 박공 + 시계탑
    add(h, roundedBox(4.6, 2.2, 0.5, 0.3, 4), wall, 0, 5.4, 3.0);
    add(h, roundedBox(2.4, 2.4, 2.4, 0.35, 4), wall, 0, 7.6, 0.6);
    add(h, new THREE.ConeGeometry(1.9, 1.5, 4), roof, 0, 9.5, 0.6).rotation.y = Math.PI / 4;
    ell(h, M('#FFD23A', { em: '#FFB300', ei: 0.4 }), 0.16, 0.16, 0.16, 0, 10.35, 0.6, 10);
    const face = add(h, cyl(0.85, 0.85, 0.12, 28), M('#FFFDF6', { em: '#FFF6DA', ei: 0.35 }), 0, 7.65, 1.86); face.rotation.x = Math.PI / 2;
    add(h, new THREE.TorusGeometry(0.88, 0.07, 8, 28), M('#4A3A30'), 0, 7.65, 1.9);
    const hm = M('#3A2A22'), hands = new THREE.Group(); hands.position.copy(at(0, -17.5)).add(V3(0, 7.65, 1.96)); live.add(hands);
    const hh = add(hands, roundedBox(0.08, 0.45, 0.04, 0.02, 1), hm, 0, 0.2, 0); const mm = add(hands, roundedBox(0.06, 0.66, 0.04, 0.02, 1), hm, 0, 0.3, 0.02);
    const hp = new THREE.Group(); hands.add(hp); hp.add(hh); const mp = new THREE.Group(); hands.add(mp); mp.add(mm);
    anim.clock = { hp, mp };
    // 문 (아치형 두 짝) + 계단
    add(h, roundedBox(2.5, 3.0, 0.3, 0.5, 4), trim, 0, 1.9, 2.95);
    for (const s of [-1, 1]) { add(h, roundedBox(1.0, 2.5, 0.2, 0.3, 3), wood, s * 0.54, 1.75, 3.06); ell(h, M('#E8B93A'), 0.07, 0.07, 0.07, s * 0.16, 1.75, 3.18, 8); }
    for (let i = 0; i < 2; i++) add(h, roundedBox(3.4 - i * 0.4, 0.2, 1.0 - i * 0.3, 0.06, 2), trim, 0, 0.1 + i * 0.2, 3.6 - i * 0.15);
    // 둥근 창 (불 켜진 창)
    for (const s of [-1, 1]) for (const wx of [2.9, 4.8]) {
      add(h, roundedBox(1.15, 1.55, 0.2, 0.5, 4), trim, s * wx, 2.7, 2.92);
      add(h, roundedBox(0.9, 1.3, 0.2, 0.42, 4), glow, s * wx, 2.68, 2.98);
      add(h, roundedBox(0.06, 1.3, 0.06, 0.02, 1), trim, s * wx, 2.68, 3.1); add(h, roundedBox(0.9, 0.06, 0.06, 0.02, 1), trim, s * wx, 2.8, 3.1);
    }
    // 간판
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.7), new THREE.MeshStandardMaterial({ map: signTexture('물줄때 마을회관', 720, 140, '#FFF6E6', '#7A4A2E', 74), roughness: 0.9 }));
    sign.position.set(0, 4.15, 2.96); h.add(sign);
    for (let i = -2; i <= 2; i++) col(i * 2.6, -17.5, 2.0);
    col(-6, -16, 1.4); col(6, -16, 1.4);
  }

  // ─── 깃발 (물방울 깃발) ───
  function flagPole(parent, live, x, z) {
    const p = at(x, z);
    add(parent, cyl(0.07, 0.09, 6, 8), M('#D9D4CC', { r: 0.4 }), p.x, 3, p.z);
    ell(parent, M('#FFD23A'), 0.13, 0.13, 0.13, p.x, 6.05, p.z, 10);
    const fl = new THREE.Group(); fl.position.set(p.x + 0.07, 5.2, p.z); live.add(fl);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 180; const g = cv.getContext('2d');
    g.fillStyle = '#4FB0E8'; g.fillRect(0, 0, 256, 180); g.fillStyle = '#FFFFFF';
    g.beginPath(); g.moveTo(128, 30); g.bezierCurveTo(165, 80, 175, 105, 175, 118); g.arc(128, 118, 47, 0, Math.PI); g.bezierCurveTo(81, 105, 91, 80, 128, 30); g.fill();
    g.fillStyle = '#4FB0E8'; g.beginPath(); g.arc(112, 120, 9, 0, 7); g.fill(); g.beginPath(); g.arc(144, 120, 9, 0, 7); g.fill();
    const tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding;
    const geo = new THREE.PlaneGeometry(1.9, 1.3, 10, 1); geo.translate(0.95, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.9 })); fl.add(m);
    anim.flags.push({ m, base: geo.attributes.position.array.slice() });
    col(x, z, 0.4);
  }

  // ─── 씨앗 가게 노점 ───
  function stall(parent, x, z, ry) {
    const s = new THREE.Group(); s.position.copy(at(x, z)); s.rotation.y = ry; parent.add(s);
    add(s, roundedBox(3.0, 1.0, 1.2, 0.12, 3), M('#D9443C'), 0, 0.5, 0);
    add(s, roundedBox(3.1, 0.12, 1.3, 0.05, 2), M('#F6E6CC'), 0, 1.04, 0);
    for (const sx of [-1.45, 1.45]) add(s, roundedBox(0.12, 2.6, 0.12, 0.04, 1), M('#F6E6CC'), sx, 1.3, -0.5);
    for (let i = 0; i < 6; i++) { const st = add(s, roundedBox(0.55, 0.08, 1.5, 0.03, 1), M(i % 2 ? '#FFF6E6' : '#3FA34D'), -1.38 + i * 0.55, 2.55, 0.1); st.rotation.x = 0.28; }
    for (let i = 0; i < 4; i++) { const pot = makeTtami(MINI_SCALE * 0.42); pot.position.set(-1.05 + i * 0.7, 1.1, 0.1); s.add(pot); setTtamiPlant(pot, SEEDS[(i * 5) % SEEDS.length].id, 3, PLANT_SCALE_MINI * 0.42); }
    col(x, z, 1.7);
  }

  // 나가는 곳 표지판
  function exitSign(parent, x, z) {
    const p = at(x, z);
    for (const sx of [-0.9, 0.9]) add(parent, roundedBox(0.16, 2.2, 0.16, 0.05, 2), M('#A86F3F'), p.x + sx, 1.1, p.z);
    add(parent, roundedBox(2.4, 0.8, 0.16, 0.12, 3), M('#C98C55'), p.x, 1.85, p.z);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.62), new THREE.MeshStandardMaterial({ map: signTexture('마을로 가는 길', 440, 124, '#F6E6CC', '#6A4127', 62), roughness: 0.9 }));
    t.position.set(p.x, 1.85, p.z - 0.09); t.rotation.y = Math.PI; parent.add(t);
    col(x - 0.9, z, 0.3); col(x + 0.9, z, 0.3);
  }

  // ─── 짓기 ───
  function build() {
    if (built) return; built = true;
    const s = W.scene, decor = new THREE.Group();
    // 잔디 땅 + 벽돌 광장
    const gr = new THREE.Mesh(new THREE.CircleGeometry(58, 48).rotateX(-Math.PI / 2), M('#86C25A', { rim: 0 }));
    gr.position.set(PLAZA.x, -0.01, PLAZA.z); gr.receiveShadow = true; s.add(gr);
    const br = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.r + 0.6, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.9 }));
    br.position.set(PLAZA.x, 0.02, PLAZA.z); br.receiveShadow = true; s.add(br);
    // 회관 앞 벽돌 마당
    const yard = add(s, roundedBox(15, 0.04, 5, 0.02, 1), M('#C47656'), PLAZA.x, 0.01, PLAZA.z - 14.2, false); yard.receiveShadow = true;
    const live = new THREE.Group(); s.add(live);   // 움직이는 것(시계 바늘·깃발·풍선·노점 화분)은 합치지 않아요
    hall(decor, live);
    // 방명록 게시판 (회관 왼쪽)
    GB.build3D(at(-9.6, -12.2), at(0, -2));
    flagPole(decor, live, 8.4, -13.8);
    stall(live, 10.6, -9.5, -0.9);
    // 가로등 + 줄줄이 깃발
    const L = [lamp(decor, -11.5, -4.5), lamp(decor, -9, 8.5), lamp(decor, 9, 8.5), lamp(decor, 11.5, -4.5)];
    bunting(decor, L[0], L[1], 9); bunting(decor, L[2], L[3], 9); bunting(decor, L[1], L[2], 12);
    bench(decor, -12.2, 2.6, Math.PI / 2 - 0.15); bench(decor, 12.2, 2.6, -Math.PI / 2 + 0.15); bench(decor, -7, 11.2, Math.PI - 0.5); bench(decor, 7, 11.2, Math.PI + 0.5);
    exitSign(decor, 0, 14.4);
    // 풍선
    [[12.6, -12.2, 4.4, '#FF5A5A'], [13.3, -11.6, 3.9, '#FFD23A'], [12.9, -11.0, 4.7, '#6BC4F0'], [-13.4, 6.6, 3.8, '#FF8FB1'], [-12.8, 7.2, 4.3, '#7CC46E']].forEach(b => balloon(live, ...b));
    // 꽃 화단
    for (const [x, z] of [[-6.2, -14.4], [6.2, -14.4], [-14.5, -9], [14.5, 0], [-14.5, 0]]) {
      const p = at(x, z); add(decor, roundedBox(2.2, 0.5, 0.9, 0.2, 3), M('#B9704F'), p.x, 0.25, p.z);
      for (let i = 0; i < 5; i++) flower5(decor, [p.x - 0.8 + i * 0.4, 0.62, p.z + (i % 2) * 0.2 - 0.1], ['#FF8FB1', '#FFFFFF', '#FFD84A', '#B79CFF', '#FF9E5E'][i], '#FFC83A', 0.13);
      col(x, z, 1.0);
    }
    // 둘레 나무·덤불 (남쪽은 시야를 트기)
    const R = rnd(91);
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * Math.PI * 2, rr = 19 + R() * 6, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (z > 12 && Math.abs(x) < 12) continue;
      makeTree(decor, PLAZA.x + x, PLAZA.z + z, 0.9 + R() * 0.5, R() < 0.4 ? 1 : 0);
    }
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, x = Math.cos(a) * 16.2, z = Math.sin(a) * 16.2; if (z < -13) continue; ell(decor, M(i % 2 ? '#74BE52' : '#68B249'), 0.75, 0.6, 0.75, PLAZA.x + x, 0.3, PLAZA.z + z, 12); }
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = 34 + R() * 6; ell(decor, M(['#7DC257', '#8ACB61', '#6FB84E'][i % 3]), 9 + R() * 4, 5 + R() * 3, 9 + R() * 4, PLAZA.x + Math.cos(a) * rr, -1, PLAZA.z + Math.sin(a) * rr, 20); }
    s.add(mergeByMaterial(decor));
  }

  // ─── 불꽃놀이 ───
  const FW_COLS = ['#FF5A8A', '#FFD23A', '#6BD6FF', '#9BFF7A', '#C59BFF', '#FF9E5E'];
  const sparkGeo = sphereGeo(6);
  function launch() {
    const c = FW_COLS[(Math.random() * FW_COLS.length) | 0], c2 = FW_COLS[(Math.random() * FW_COLS.length) | 0];
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: '#FFF4D0' })); m.scale.setScalar(0.12);
    m.position.set(PLAZA.x + (Math.random() - 0.5) * 34, 2, PLAZA.z - 24 - Math.random() * 12); W.scene.add(m);
    anim.rockets.push({ m, vy: 15 + Math.random() * 4, fuse: 1.0 + Math.random() * 0.4, t: 0, c, c2 });
  }
  function explode(r) {
    const n = 46, p = r.m.position, big = 0.8 + Math.random() * 0.6;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const v = V3(s * Math.cos(th), u, s * Math.sin(th)).multiplyScalar((6 + Math.random() * 1.5) * big);
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: i % 3 ? r.c : r.c2, transparent: true })); m.position.copy(p); m.scale.setScalar(0.16 * big);
      W.scene.add(m); anim.sparks.push({ m, v, t: 0, life: 1.4 + Math.random() * 0.5, s: 0.16 * big });
    }
    if (inPlaza() && Math.random() < 0.5) SFX.play('plop');
  }
  function update(dt, t) {
    if (!built) return;
    const here = inPlaza();
    for (const b of anim.balloons) { b.g.position.y = Math.sin(t * 1.3 + b.ph) * 0.15; b.g.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.05; }
    for (const f of anim.flags) { const a = f.m.geometry.attributes.position, arr = a.array; for (let i = 0; i < arr.length; i += 3) { const x = f.base[i]; arr[i + 2] = Math.sin(t * 4 - x * 2.4) * 0.12 * x; } a.needsUpdate = true; }
    if (anim.clock) { const d = new Date(); anim.clock.hp.rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2; anim.clock.mp.rotation.z = -d.getMinutes() / 60 * Math.PI * 2; }
    if (here && mood === 'night') { anim.fwT -= dt; if (anim.fwT <= 0) { anim.fwT = 1.2 + Math.random() * 2.2; launch(); if (Math.random() < 0.3) setTimeout(launch, 250); } }
    for (let i = anim.rockets.length - 1; i >= 0; i--) {
      const r = anim.rockets[i]; r.t += dt; r.m.position.y += r.vy * dt; r.vy -= 6 * dt;
      if (Math.random() < 0.6) { const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: '#FFE2A0', transparent: true })); m.position.copy(r.m.position); m.scale.setScalar(0.07); W.scene.add(m); anim.sparks.push({ m, v: V3(0, -0.5, 0), t: 0, life: 0.45, s: 0.07 }); }
      if (r.t >= r.fuse) { explode(r); W.scene.remove(r.m); anim.rockets.splice(i, 1); }
    }
    for (let i = anim.sparks.length - 1; i >= 0; i--) {
      const s = anim.sparks[i]; s.t += dt; s.v.multiplyScalar(Math.pow(0.25, dt)); s.v.y -= 2.2 * dt; s.m.position.addScaledVector(s.v, dt);
      const k = 1 - s.t / s.life; s.m.material.opacity = Math.max(0, Math.min(1, k * 1.6)); s.m.scale.setScalar(s.s * (0.6 + 0.4 * k));
      if (s.t >= s.life) { W.scene.remove(s.m); s.m.material.dispose(); anim.sparks.splice(i, 1); }
    }
  }

  // ─── 낮 / 밤 (불을 껐다 켜듯이 바꿔요) ───
  const MOODS = {
    day:   { fog: '#CFEFFF', near: 48, far: 100, hc: '#FFF6E6', hg: '#9CC97A', hi: 0.7, sc: '#FFF1D8', si: 1.12, fi: 0.25, lamp: 0.25, win: 0.15, pl: 0 },
    night: { fog: '#22255A', near: 32, far: 90, hc: '#9AA6E8', hg: '#262752', hi: 0.4, sc: '#B8C2FF', si: 0.32, fi: 0.12, lamp: 2.6, win: 1.8, pl: 0 },
  };
  let mood = 'night', moodTw = 0;
  try { if (localStorage.getItem('mjplaza:mood') === 'day') mood = 'day'; } catch (e) { }
  const lights = [], glowMats = { lamp: null, win: null };
  function lightsOf() { const sc = W.scene; return { hemi: sc.children.find(o => o.isHemisphereLight), fill: sc.children.find(o => o.isDirectionalLight && o !== W.sun) }; }
  function snapshot() {
    const sc = W.scene, { hemi, fill } = lightsOf();
    return { fog: '#' + sc.fog.color.getHexString(), near: sc.fog.near, far: sc.fog.far, hc: '#' + hemi.color.getHexString(), hg: '#' + hemi.groundColor.getHexString(), hi: hemi.intensity,
      sc: '#' + W.sun.color.getHexString(), si: W.sun.intensity, fi: fill ? fill.intensity : 0,
      lamp: glowMats.lamp ? glowMats.lamp.emissiveIntensity : 0, win: glowMats.win ? glowMats.win.emissiveIntensity : 0, pl: lights[0] ? lights[0].intensity : 0 };
  }
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  function applyMood(A, B, k) {
    const sc = W.scene, { hemi, fill } = lightsOf(), L = (a, b) => a + (b - a) * k, C = (out, a, b) => out.copy(_ca.set(a)).lerp(_cb.set(b), k);
    C(sc.fog.color, A.fog, B.fog); sc.fog.near = L(A.near, B.near); sc.fog.far = L(A.far, B.far);
    C(hemi.color, A.hc, B.hc); C(hemi.groundColor, A.hg, B.hg); hemi.intensity = L(A.hi, B.hi);
    C(W.sun.color, A.sc, B.sc); W.sun.intensity = L(A.si, B.si); if (fill) fill.intensity = L(A.fi, B.fi);
    if (glowMats.lamp) glowMats.lamp.emissiveIntensity = L(A.lamp, B.lamp);
    if (glowMats.win) glowMats.win.emissiveIntensity = L(A.win, B.win);
    for (const l of lights) l.intensity = L(A.pl, B.pl);
  }
  function setSky() {
    document.body.classList.toggle('plazaNight', !!G.inPlaza && mood === 'night');
    document.body.classList.toggle('plazaDay', !!G.inPlaza && mood === 'day');
  }
  function setMood(on) {
    if (on) { if (!saved) saved = snapshot(); applyMood(MOODS[mood], MOODS[mood], 1); }
    else if (saved) { const v = saved; saved = null; applyMood(v, v, 1); for (const l of lights) l.intensity = 0; }
    setSky(); refreshMoodBtn();
  }
  function toggleMood() {
    if (!G.inPlaza) return;
    const A = snapshot(); mood = mood === 'night' ? 'day' : 'night';
    try { localStorage.setItem('mjplaza:mood', mood); } catch (e) { }
    SFX.play('tok'); SFX.play(mood === 'night' ? 'sparkle' : 'click');
    const id = ++moodTw;
    tween(0.7, k => { if (id === moodTw && G.inPlaza) applyMood(A, MOODS[mood], k); });
    setSky(); refreshMoodBtn();
    if (mood === 'night') anim.fwT = 0.3;
    toast(mood === 'night' ? '🌙 밤이 됐어요! 불꽃놀이가 시작돼요' : '☀️ 낮이 됐어요!');
  }
  function refreshMoodBtn() {
    const b = $('#btnDayNight'); if (!b) return;
    b.classList.toggle('hidden', !G.inPlaza);
    b.querySelector('span').textContent = mood === 'night' ? '☀️' : '🌙';
    b.querySelector('small').textContent = mood === 'night' ? '낮으로' : '밤으로';
  }

  // ─── 들어가기 / 나가기 ───
  function inPlaza() { return !!G.inPlaza; }
  function enter(source) {
    build();
    from = source; G.inPlaza = true;
    if (source === 'setup') { $('#setup').classList.remove('show'); $('#title').classList.add('hide'); $('#story').classList.remove('show'); spawnPlayer(); G.inv.water = 0; G.flags = {}; }
    $('#complete').classList.remove('show');
    G.render3D = true;
    $('#hud').classList.add('show');
    setMood(true);
    G.pos.copy(at(0, 9)); G.posY = 0; G.speed = 0; G.yaw = Math.PI; G.onHill = false; G.sunHold = false;
    if (G.player) { G.player.position.copy(G.pos); G.player.rotation.y = Math.PI; }
    G.cam.pos.set(G.pos.x, 12, G.pos.z + 16); G.cam.look.set(G.pos.x, 1.3, G.pos.z - 2); camFollow();
    G.mode = 'play'; G.busy = false;
    SFX.play('whoosh'); burst('confetti', V3(G.pos.x, 3, G.pos.z - 3), 40);
    anim.fwT = 0.4;
    toast(source === 'setup' ? '광장에 왔어요! 게시판에 방명록을 남기고 친구들과 놀아요' : '광장에 왔어요! 게시판에서 수확을 자랑해 보세요');
    refreshPlazaBtn(); refreshObjective(); MP.syncAll();
  }
  function leave() {
    if (!G.inPlaza) return;
    G.inPlaza = false; setMood(false); MP.syncAll();
    MP.closeMenu();
    const src = from; from = null;
    if (src === 'setup') { startGame(); return; }
    SFX.play('whoosh');
    G.pos.set(0, 0, 6.5); G.posY = 0; G.speed = 0; G.yaw = Math.PI;
    G.cam.pos.set(0, 12, 22); camFollow();
    burst('puff', V3(G.pos.x, 1, G.pos.z), 8);
    toast('마을로 돌아왔어요'); refreshPlazaBtn(); refreshObjective();
  }
  function clampWalk() {
    const dx = G.pos.x - PLAZA.x, dz = G.pos.z - PLAZA.z, d = Math.hypot(dx, dz);
    if (d > PLAZA.bound) { G.pos.x = PLAZA.x + dx / d * PLAZA.bound; G.pos.z = PLAZA.z + dz / d * PLAZA.bound; }
  }
  function interactables(list) {
    if (GB.board3D) list.push({ id: 'board', pos: GB.board3D.front, r: 3.4, h: 6.4, label: '방명록 쓰기', act: () => GB.open({ compose: true, seedId: G.seedId && G.completed.has(G.seedId) ? G.seedId : null }) });
    list.push({ id: 'exit', pos: at(0, 13.4), r: 2.2, h: 2.4, label: from === 'setup' ? '씨앗 심으러 마을로' : '마을로 돌아가기', act: async () => leave() });
  }
  function objective() {
    return { t: '게시판에서 E를 눌러 방명록을 남기고, 친구들과 놀아요', target: GB.board3D ? GB.board3D.front : null, h: 6.4 };
  }
  function near(x, z, r = 26) { return Math.hypot(x - PLAZA.x, z - PLAZA.z) < r; }
  return { build, enter, leave, update, toggleMood, clampWalk, interactables, objective, near, get from() { return from; } };
})();

// 오른쪽 위 ⛲ 버튼: 식물을 다 키운 뒤 마을에서는 '광장', 광장에서는 '나가기'
function refreshPlazaBtn() {
  const b = $('#btnPlaza'); if (!b) return;
  const show = G.inPlaza || (G.completed && G.completed.size > 0 && G.stage >= 3);
  b.classList.toggle('hidden', !show);
  b.querySelector('span').textContent = G.inPlaza ? '🏡' : '⛲';
  b.querySelector('small').textContent = G.inPlaza ? '나가기' : '광장';
  b.title = b.ariaLabel = G.inPlaza ? '광장에서 나가기' : '광장으로 가기';
}
