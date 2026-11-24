// 물줄때 마을 · 함께 접속한 사람들 (다른 접속자 보기, 인사, 하트, 놀리기, 기차놀이)
const MP = (() => {
  const SEND_MS = 250, IDLE_MS = 8000, STALE_MS = 20000, SHOW_MAX = 24;
  const GREET_R = 3.2, ACT_R = 2.6, TRAIN_R = 6.5, TRAIN_MS = 5000, TRAIN_GAP = 1.25, TRAIN_MAX = 3, LINE_IN = 0.7, LINE_WALK = 3.0;
  const remotes = new Map();
  const me = { a: 0, an: 0, tg: '', last: null, lastSend: 0, sending: false, hop: 0, wiggle: 0, wiggleYaw: 0, line: null, lead: 0, cd: 0, puff: 0, hearts: 0 };
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  const wrapA = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  const nameOf = (p) => (p && p.n ? GB.clean(p.n).slice(0, 8) : '') || '여행자';
  const shown = () => !!(G.player && G.inPlaza && ['play', 'cutscene', 'complete'].includes(G.mode));   // 광장에 있을 때만 서로 보여요
  const nowMs = () => performance.now();

  // ─── 내 상태 보내기 ───
  function state() {
    const vis = shown();
    return {
      n: Array.from(G.name || '').slice(0, 8).join(''), c: G.charId || '', m: vis ? 1 : 0,
      // 좌표는 광장 한가운데를 기준으로 보내요 (데이터베이스 규칙: -60~60)
      x: vis ? r1(G.pos.x - PLAZA.x) : 0, y: vis ? r1((G.posY || 0) + (G.jumpY || 0)) : 0, z: vis ? r1(G.pos.z - PLAZA.z) : 0, r: r2(wrapA(G.yaw || 0)),
      a: me.a, an: me.an, tg: me.tg,
    };
  }
  function publish(force) {
    if (me.sending) { if (force) me.again = true; return; }
    const s = state(), L = me.last, t = nowMs();
    const changed = !L || L.m !== s.m || L.an !== s.an || L.a !== s.a || L.c !== s.c || L.n !== s.n ||
      Math.hypot(L.x - s.x, L.z - s.z) > 0.12 || Math.abs(L.y - s.y) > 0.2 || Math.abs(wrapA(L.r - s.r)) > 0.15;
    if (!force && !changed && t - me.lastSend < IDLE_MS) return;
    if (!force && t - me.lastSend < SEND_MS) return;
    me.sending = true; me.last = s; me.lastSend = t;
    NET.putMe(s).catch(() => {}).finally(() => { me.sending = false; if (me.again) { me.again = false; publish(true); } });
  }

  // ─── 다른 접속자 ───
  function syncAll() {
    for (const id of [...remotes.keys()]) if (!NET.players.has(id)) removeR(id);
    for (const [id, p] of NET.players) sync(id, p);
  }
  function sync(id, p) {
    if (id === NET.cid) return;
    const fresh = p && NET.now() - (p.t || 0) < STALE_MS;
    const ok = fresh && p.m === 1 && CHAR_BY_ID[p.c] && shown() && Math.hypot(p.x, p.z) < 26;
    let R = remotes.get(id);
    if (!ok) { if (R) removeR(id); return; }
    if (!R) { if (remotes.size >= SHOW_MAX) return; R = createR(id, p); }
    else if (R.c !== p.c) { removeR(id); R = createR(id, p); }
    const prevAn = R.an;
    R.data = p; R.name = nameOf(p);
    R.target.set(p.x + PLAZA.x, p.y || 0, p.z + PLAZA.z); R.targetYaw = p.r || 0;
    if (p.an !== prevAn) { R.an = p.an; onAction(R, p); }
  }
  function createR(id, p) {
    const root = buildCharacter(CHAR_BY_ID[p.c]);
    root.position.set(p.x + PLAZA.x, p.y || 0, p.z + PLAZA.z); root.rotation.y = p.r || 0;
    W.scene.add(root);
    const tag = makeTag(nameOf(p)); tag.classList.add('mpTag');
    tag.addEventListener('click', (e) => { e.stopPropagation(); tapOpen(id); });
    const R = { id, c: p.c, root, tag, tagText: '', target: new THREE.Vector3(p.x + PLAZA.x, p.y || 0, p.z + PLAZA.z), targetYaw: p.r || 0, speed: 0,
      wave: 0, waveCd: 2 + Math.random() * 2, hop: 0, wiggle: 0, wiggleYaw: 0, trail: [], an: p.an, data: p, name: nameOf(p),
      ph: Math.random() * 10, trainUntil: 0, inTrain: 0 };
    remotes.set(id, R);
    return R;
  }
  function removeR(id) {
    const R = remotes.get(id); if (!R) return;
    W.scene.remove(R.root); R.tag.remove(); remotes.delete(id);
    if (menuId === id) closeMenu();
  }
  function posOf(id) { if (id === NET.cid) return G.pos; const R = remotes.get(id); return R ? R.root.position : null; }

  // 누군가 동작을 했을 때 (모든 화면에서 똑같이 보여요)
  function onAction(R, p) {
    const targets = String(p.tg || '').split(',').filter(Boolean);
    if (p.a === 1) {
      R.hop = 0.6;
      const tp = posOf(targets[0]); if (tp) hearts(tp.clone ? tp.clone() : V3(tp.x, 0, tp.z));
      if (targets[0] === NET.cid) { me.hearts++; toast(`${R.name}님이 하트를 보냈어요 💗`); SFX.play('happy'); me.hop = 0.6; }
    } else if (p.a === 2) {
      const tp = posOf(targets[0]);
      R.wiggle = 2.2; R.wiggleYaw = tp ? Math.atan2(R.root.position.x - tp.x, R.root.position.z - tp.z) : R.targetYaw;
      if (targets[0] === NET.cid) { toast(`${R.name}님이 엉덩이를 씰룩씰룩 놀려요 😝`); SFX.play('boing'); }
    } else if (p.a === 3) {
      R.trainUntil = nowMs() + TRAIN_MS + 500;
      for (const id of targets) { const m = remotes.get(id); if (m) m.inTrain = R.trainUntil; }
      if (targets.includes(NET.cid)) joinLine(R, p, targets.indexOf(NET.cid) + 1);
      SFX.play('whoosh');
    }
  }

  // ─── 내 동작 ───
  function ready() { if (nowMs() < me.cd) { SFX.play('deny'); return false; } return true; }
  function act(a, tg) { me.a = a; me.tg = tg; me.an = (me.an + 1) % 100000; publish(true); }
  function doHeart(id) {
    const R = remotes.get(id); if (!R || !ready()) return; me.cd = nowMs() + 1200;
    act(1, id); me.hop = 0.6; hearts(R.root.position.clone()); SFX.play('happy');
    toast(`${R.name}에게 하트를 보냈어요 💗`);
  }
  function doTease(id) {
    const R = remotes.get(id); if (!R || !ready()) return; me.cd = nowMs() + 1200;
    act(2, id); me.wiggle = 2.2; me.wiggleYaw = Math.atan2(G.pos.x - R.root.position.x, G.pos.z - R.root.position.z); G.yaw = me.wiggleYaw;
    SFX.play('boing'); toast(`${R.name}에게 엉덩이를 씰룩씰룩 😝`);
  }
  function trainCandidates() {
    const list = [];
    for (const R of remotes.values()) {
      const d = Math.hypot(R.root.position.x - G.pos.x, R.root.position.z - G.pos.z);
      if (d < TRAIN_R && R.inTrain < nowMs() && R.trainUntil < nowMs()) list.push([d, R]);
    }
    return list.sort((a, b) => a[0] - b[0]).slice(0, TRAIN_MAX).map(x => x[1]);
  }
  // 기차놀이: 시작한 사람 뒤로 주변 2~3명이 일렬로 '착' 줄 서서, 5초 동안 뒤뚱뒤뚱 몇 걸음 앞으로 가요
  function startLine(x0, z0, yaw, idx, leader) {
    me.line = { x0, z0, yaw, idx, leader, start: nowMs(), fx: G.pos.x, fz: G.pos.z };
    G.busy = true; G.speed = 0;
  }
  function doTrain() {
    const cars = trainCandidates();
    if (!cars.length) { toast('주변에 친구가 있어야 기차놀이를 할 수 있어요'); SFX.play('deny'); return; }
    if (!ready() || me.line) return; me.cd = nowMs() + TRAIN_MS + 2000;
    act(3, cars.map(R => R.id).join(','));
    me.lead = nowMs() + TRAIN_MS;
    for (const R of cars) R.inTrain = me.lead;
    startLine(G.pos.x, G.pos.z, G.yaw, 0, null);
    toast(`🚂 기차놀이! ${cars.length + 1}명이 한 줄로 칙칙폭폭`); SFX.play('whoosh');
  }
  function joinLine(R, p, idx) {
    if (G.mode !== 'play' || !G.inPlaza || me.line || (G.busy && !menuId)) return;
    closeMenu();
    startLine(p.x + PLAZA.x, p.z + PLAZA.z, p.r || 0, Math.max(1, idx), R.id);
    toast(`🚂 ${R.name}님의 기차에 탔어요! 칙칙폭폭`); SFX.play('rise');
  }
  function endLine() {
    if (!me.line) return;
    const lead = !me.line.leader; me.line = null; G.busy = false; G.speed = 0; G.playerHop = 0;
    if (G.player) G.player.userData.body.rotation.z = 0;
    if (lead) { me.lead = 0; if (me.a === 3) { me.a = 0; me.tg = ''; publish(true); } }
    toast('🚂 기차놀이 끝! 재밌었다');
  }
  function updateLine(t) {
    const L = me.line, tt = (nowMs() - L.start) / 1000;
    const fx = Math.sin(L.yaw), fz = Math.cos(L.yaw);
    const sx = L.x0 - fx * L.idx * TRAIN_GAP, sz = L.z0 - fz * L.idx * TRAIN_GAP;
    if (tt >= TRAIN_MS / 1000) { G.pos.x = sx + fx * LINE_WALK; G.pos.z = sz + fz * LINE_WALK; if (G.inPlaza) PZ.clampWalk(); endLine(); return; }
    G.yaw = L.yaw; G.busy = true;
    if (tt < LINE_IN) {   // 제자리로 폴짝
      const k = tt / LINE_IN, e = k * k * (3 - 2 * k);
      G.pos.x = L.fx + (sx - L.fx) * e; G.pos.z = L.fz + (sz - L.fz) * e;
      G.playerHop = Math.sin(k * Math.PI) * 0.6; G.speed = 0;
    } else {              // 다 같이 뒤뚱뒤뚱 앞으로
      const w = Math.min(1, (tt - LINE_IN) / (TRAIN_MS / 1000 - LINE_IN - 0.3));
      G.pos.x = sx + fx * w * LINE_WALK; G.pos.z = sz + fz * w * LINE_WALK;
      G.playerHop = Math.abs(Math.sin(tt * 4.5)) * 0.12; G.speed = 2.2;
    }
    if (G.inPlaza) PZ.clampWalk();
  }

  // ─── 메뉴 (접속자 고르기) ───
  let menuEl = null, menuId = null, menuResolve = null;
  function buildMenu() {
    const w = document.createElement('div');
    w.innerHTML = `<div id="mpMenu" class="clay" role="dialog" aria-label="접속자에게 하기">
  <button class="mpClose" aria-label="닫기">✕</button>
  <div class="mpHead"><span class="mpWave">👋</span><div><b id="mpName"></b><small>무엇을 해 볼까요?</small></div></div>
  <div class="mpBtns">
    <button data-a="heart"><em>💗</em><span>하트 보내기</span><kbd>1</kbd></button>
    <button data-a="tease"><em>🍑</em><span>엉덩이 씰룩</span><kbd>2</kbd></button>
    <button data-a="train"><em>🚂</em><span>기차놀이</span><small id="mpTrainN"></small><kbd>3</kbd></button>
  </div></div>`;
    menuEl = w.firstElementChild; document.body.appendChild(menuEl);
    menuEl.querySelector('.mpClose').onclick = () => { SFX.play('click'); closeMenu(); };
    menuEl.querySelectorAll('.mpBtns button').forEach(b => b.onclick = () => choose(b.dataset.a));
    window.addEventListener('keydown', (e) => {
      if (!menuId) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
      if (e.key === '1') choose('heart'); if (e.key === '2') choose('tease'); if (e.key === '3') choose('train');
    }, true);
  }
  function choose(a) {
    const id = menuId; if (!id) return;
    if (a === 'heart') doHeart(id); else if (a === 'tease') doTease(id);
    else if (a === 'train') { closeMenu(); doTrain(); return; }
    closeMenu();
  }
  function openMenu(id) {
    const R = remotes.get(id); if (!R) return Promise.resolve();
    if (!menuEl) buildMenu();
    menuId = id;
    menuEl.querySelector('#mpName').textContent = R.name;
    refreshMenu();
    menuEl.classList.add('show'); SFX.play('open');
    R.wave = 1.4; G.playerWave = 1.4;   // 메뉴를 열면 나도 손을 흔들어요
    return new Promise(res => { menuResolve = res; });
  }
  function refreshMenu() {
    if (!menuId) return;
    const n = trainCandidates().length + 1;
    const tb = menuEl.querySelector('[data-a="train"]');
    tb.disabled = n < 2 || nowMs() < me.cd && me.lead > 0;
    menuEl.querySelector('#mpTrainN').textContent = `${n}명`;
  }
  function closeMenu() {
    if (!menuId) return;
    menuId = null; menuEl.classList.remove('show');
    const r = menuResolve; menuResolve = null; r && r();
  }
  function tapOpen(id) {
    if (G.mode !== 'play' || G.busy) return;
    G.busy = true; openMenu(id).then(() => { if (!me.line) G.busy = false; });
  }

  // ─── 매 프레임 ───
  const tmp = new THREE.Vector3();
  function applyWiggle(root, t, on) {
    const b = root.userData.body;
    if (on) { b.rotation.y = Math.sin(t * 17) * 0.38; b.rotation.z = Math.sin(t * 17) * 0.22; b.position.y += Math.abs(Math.sin(t * 17)) * 0.06; }
    else if (b.rotation.y !== 0) b.rotation.y = 0;
  }
  function update(dt, t) {
    publish(false);
    const play = G.mode === 'play';
    // 나
    if (G.player) {
      if (me.hop > 0) { me.hop -= dt; G.playerHop = me.hop > 0 ? Math.abs(Math.sin(me.hop * 14)) * 0.45 : 0; }
      if (me.wiggle > 0) { me.wiggle -= dt; G.yaw = me.wiggleYaw; }
      applyWiggle(G.player, t, me.wiggle > 0);
      if (me.lead > nowMs()) { me.puff -= dt; if (me.puff <= 0) { me.puff = 0.12; burst('puff', V3(G.pos.x, (G.posY || 0) + 2.3, G.pos.z), 2); } }
    }
    if (me.line) updateLine(t);
    if (me.line && G.player && nowMs() - me.line.start > LINE_IN * 1000) G.player.userData.body.rotation.z = Math.sin(t * 9) * 0.28;   // 뒤뚱뒤뚱
    // 다른 사람들
    let nearAny = false;
    for (const R of remotes.values()) {
      const p = R.root.position; tmp.copy(p);
      if (p.distanceTo(R.target) > 8) p.copy(R.target); else p.lerp(R.target, Math.min(1, dt * 8));
      const mv = Math.hypot(p.x - tmp.x, p.z - tmp.z);
      R.speed += (mv / Math.max(dt, 1e-3) - R.speed) * Math.min(1, dt * 8);
      const dMe = G.player ? Math.hypot(G.pos.x - p.x, G.pos.z - p.z) : 99;
      let yawT = R.targetYaw;
      if (R.wiggle > 0) yawT = R.wiggleYaw;
      else if (R.speed < 0.6 && dMe < 3.5 && play) yawT = Math.atan2(G.pos.x - p.x, G.pos.z - p.z);
      R.root.rotation.y += wrapA(yawT - R.root.rotation.y) * Math.min(1, dt * 8);
      // 가까이 있는 동안 서로 계속 손을 흔들어요 (마을 요정들처럼). 처음 가까워질 때만 '뿅' 소리
      R.waveCd -= dt;
      const near = play && dMe < GREET_R + 0.8 && dMe > 0.8 && !(R.trainUntil > nowMs() || R.inTrain > nowMs());
      if (near && !R.wasNear && R.waveCd <= 0) { R.waveCd = 6; SFX.play('blip', 1.25); }
      R.wasNear = near;
      if (near) nearAny = true;
      R.wave -= dt; R.hop -= dt; R.wiggle -= dt;
      const hopY = R.hop > 0 ? Math.abs(Math.sin(R.hop * 14)) * 0.45 : 0;
      animateCharacter(R.root, t + R.ph, R.speed, { hop: hopY, wave: R.wave > 0 || (near && R.speed < 2.5 && R.wiggle <= 0) });
      applyWiggle(R.root, t + R.ph, R.wiggle > 0);
      if (R.trainUntil > nowMs() || R.inTrain > nowMs()) R.root.userData.body.rotation.z = Math.sin(t * 9) * 0.28;   // 기차놀이 중엔 뒤뚱뒤뚱
      if (R.trainUntil > nowMs()) { R.puff = (R.puff || 0) - dt; if (R.puff <= 0) { R.puff = 0.12; burst('puff', V3(p.x, p.y + 2.3, p.z), 2); } }
      // 이름표
      const tagOn = (play || G.mode === 'complete') && dMe < 16;
      if (tagOn) {
        const txt = (R.trainUntil > nowMs() ? '🚂 ' : R.inTrain > nowMs() ? '🚃 ' : '') + R.name;
        if (txt !== R.tagText) { R.tagText = txt; R.tag.textContent = txt; }
        worldToScreen(V3(p.x, p.y + 2.35, p.z), _mp);
        R.tag.style.transform = `translate(${_mp.x}px, ${_mp.y}px) translate(-50%, -100%)`;
        R.tag.classList.toggle('show', _mp.visible);
      } else R.tag.classList.remove('show');
    }
    // 나도 가까운 친구가 있으면 계속 손을 흔들어요 (걷거나 다른 동작 중이 아닐 때)
    if (nearAny && !G.busy && G.speed < 2.5 && me.wiggle <= 0 && !me.line) G.playerWave = Math.max(G.playerWave || 0, 0.12);
    if (menuId) {
      const R = remotes.get(menuId);
      if (!R || Math.hypot(R.root.position.x - G.pos.x, R.root.position.z - G.pos.z) > 8) closeMenu(); else refreshMenu();
    }
  }
  const _mp = { x: 0, y: 0, visible: false };

  function interactables() {
    const list = [];
    if (me.line) return list;
    for (const R of remotes.values()) list.push({ id: 'player', pos: R.root.position, r: ACT_R, h: 2.5, label: `${R.name}에게 인사`, act: () => openMenu(R.id) });
    return list;
  }

  function init() {
    NET.on((type, key) => {
      if (type !== 'players') return;
      if (key) sync(key, NET.players.get(key)); else syncAll();
      if (!key) remotes.forEach((R, id) => { if (!NET.players.has(id)) removeR(id); });
      if (key && !NET.players.has(key)) removeR(key);
    });
    setInterval(() => {
      syncAll(); publish(false);
      // 오래 접속이 끊긴 기록 정리 (한 번에 3개까지)
      let n = 0; const now = NET.now();
      for (const [id, p] of NET.players) if (id !== NET.cid && now - (p.t || 0) > 90000 && n < 3) { n++; NET.removePlayer(id); }
    }, 2000);
    window.addEventListener('pagehide', () => NET.removeMe());
  }

  return {
    init, update, interactables, openMenu, closeMenu,
    menuOpen: () => !!menuId,
    get remotes() { return remotes; },
    get me() { return me; },
    get inTrain() { return !!me.line; },
    syncAll() { syncAll(); },
  };
})();
