// 물줄때 마을 · 방명록 (여러 사람이 동시에 보는 실시간 게시판 + 수확 자랑)
// 저장·실시간 연결은 js/net.js(NET)가 맡아요.
const GB = (() => {
  const CFG = GUESTBOOK;
  const COLORS = ['#FFF3A8', '#FFD6E0', '#CDEBFF', '#D8F5C8', '#FFE2C2', '#E6DAFF'];
  const notes = NET.notes;          // key → note
  const myKeys = new Set();
  const statusOf = () => NET.status;
  function presenceCount() { const now = NET.now(); let n = 0; for (const p of NET.players.values()) if (now - (p.t || 0) < 30000) n++; return Math.max(1, n); }

  // ─── 비속어 가리기 (표시할 때 모든 글에 적용) ───
  const BAD = ['씨발', '시발', '씨바', '씨빨', 'ㅅㅂ', 'ㅆㅂ', '병신', '븅신', 'ㅂㅅ', '개새끼', '개새', '좆', 'ㅈ같', '존나', '졸라', '지랄', 'ㅈㄹ', '염병',
    '꺼져', '닥쳐', '미친놈', '미친년', '썅', '느금', '니애미', '애미', 'fuck', 'shit', 'bitch'];
  const SEP = "[\\s.,!?~\\-_*·ㆍ'\"`^0-9]*";
  const BAD_RE = BAD.map(w => new RegExp(w.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(SEP), 'gi'));
  function clean(s) {
    let out = String(s || '');
    for (const re of BAD_RE) out = out.replace(re, (m) => '♥'.repeat(Math.min(4, Math.max(2, m.replace(/\s/g, '').length))));
    return out;
  }
  const trimTo = (s, n) => Array.from(String(s || '').replace(/\s+/g, ' ').trim()).slice(0, n).join('');

  function sorted() { return [...notes.entries()].sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0) || (a[0] < b[0] ? 1 : -1)); }

  // ─── 수확물 정보 & 썸네일 (게임 속 식물을 그대로 찍어요) ───
  function harvestInfo(seedId) {
    const s = SEED_BY_ID[seedId];
    if (!s) return { emoji: '🌱', name: '땀땀이를 키우는 중', label: '🌱 땀땀이를 키우는 중', seed: null };
    const name = HARVEST[seedId] || plantShort(s);
    return { emoji: s.emoji, name, label: `${s.emoji} ${name} 수확!`, seed: s };
  }
  const thumbCache = {};
  let tR = null, tScene = null, tCam = null;
  function thumb(seedId) {
    if (thumbCache[seedId] !== undefined) return thumbCache[seedId];
    if (!SEED_BY_ID[seedId] || typeof buildPlant !== 'function') return (thumbCache[seedId] = null);
    try {
      if (!tR) {
        tR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        tR.setPixelRatio(1); tR.setSize(200, 200, false);
        tR.outputEncoding = THREE.sRGBEncoding; tR.toneMapping = THREE.ACESFilmicToneMapping; tR.toneMappingExposure = 1.05;
        tScene = new THREE.Scene();
        tScene.add(new THREE.HemisphereLight('#FFF6E6', '#9CC97A', 0.85));
        const d = new THREE.DirectionalLight('#FFF1D8', 1.15); d.position.set(2, 4, 3); tScene.add(d);
        const f = new THREE.DirectionalLight('#DDEBFF', 0.35); f.position.set(-3, 2, 2); tScene.add(f);
        tCam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
      }
      const p = buildPlant(seedId, 3); tScene.add(p);
      const box = new THREE.Box3().setFromObject(p), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const r = Math.max(sz.x, sz.y, sz.z) * 0.55, dist = r / Math.sin(THREE.MathUtils.degToRad(15));
      tCam.position.set(c.x + dist * 0.3, c.y + dist * 0.32, c.z + dist * 0.9); tCam.lookAt(c);
      tR.render(tScene, tCam);
      const url = tR.domElement.toDataURL('image/png');
      tScene.remove(p); p.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      return (thumbCache[seedId] = url);
    } catch (e) { console.warn('[방명록] 썸네일 실패', e); return (thumbCache[seedId] = null); }
  }
  function charOf(id) { return (typeof CHARACTERS !== 'undefined' && CHARACTERS.find(c => c.id === id)) || null; }

  function relTime(ts) {
    if (!ts) return '';
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    const d = new Date(ts); return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  // ─── 화면 (게시판 오버레이 + 쓰기 창) ───
  let ui = null, openResolve = null, composeSeed = null, composeColor = 0, lastPost = 0;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function buildUI() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
<section id="gb" aria-label="방명록" aria-hidden="true">
  <header class="gbTop">
    <div class="gbTitle"><span class="gbPinBig">📌</span><div><h2>물줄때 마을 방명록</h2>
      <p class="gbStatus" id="gbStatus"><i></i><span></span></p></div></div>
    <div class="gbTopBtns"><button class="btn orange" id="gbWrite">✏️ 방명록 쓰기</button><button class="round" id="gbClose" aria-label="닫기">✕</button></div>
  </header>
  <div class="gbBoardWrap" id="gbBoardWrap">
    <div class="gbBoard" id="gbBoard"></div>
    <p class="gbEmpty" id="gbEmpty">아직 아무도 글을 남기지 않았어요.<br>첫 번째 방명록의 주인공이 되어 주세요!</p>
  </div>
</section>
<section id="gbCompose" aria-label="방명록 쓰기" aria-hidden="true">
  <div class="clay gbcCard">
    <h3 id="gbcTitle">수확한 걸 자랑해요!</h3>
    <div class="gbcPreview" id="gbcPreview"></div>
    <div class="gbcSeeds" id="gbcSeeds"></div>
    <label class="gbcLabel"><span>이름</span><input id="gbcName" maxlength="8" autocomplete="off" placeholder="이름"></label>
    <label class="gbcLabel"><span>한마디</span><textarea id="gbcMsg" rows="2" placeholder="땀땀이와 키운 소감을 남겨 주세요"></textarea></label>
    <div class="gbcRow"><div class="gbcColors" id="gbcColors"></div><small class="gbcCount" id="gbcCount"></small></div>
    <p class="gbcErr" id="gbcErr" role="alert"></p>
    <div class="gbcBtns"><button class="btn ghost" id="gbcCancel">취소</button><button class="btn" id="gbcSend">📌 게시판에 붙이기</button></div>
  </div>
</section>`;
    while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
    const $$ = (s) => document.getElementById(s);
    ui = { gb: $$('gb'), board: $$('gbBoard'), empty: $$('gbEmpty'), status: $$('gbStatus'), wrap: $$('gbBoardWrap'),
      compose: $$('gbCompose'), preview: $$('gbcPreview'), seeds: $$('gbcSeeds'), name: $$('gbcName'), msg: $$('gbcMsg'),
      colors: $$('gbcColors'), count: $$('gbcCount'), err: $$('gbcErr'), send: $$('gbcSend'), title: $$('gbcTitle') };
    $$('gbClose').onclick = () => { SFX.play('click'); close(); };
    $$('gbWrite').onclick = () => { SFX.play('click'); openCompose(G.seedId && G.completed.has(G.seedId) ? G.seedId : null); };
    $$('gbcCancel').onclick = () => { SFX.play('click'); closeCompose(); };
    ui.send.onclick = send;
    ui.msg.maxLength = CFG.maxLength * 2;
    ui.msg.oninput = () => { ui.count.textContent = `${Array.from(ui.msg.value).length}/${CFG.maxLength}`; ui.count.classList.toggle('over', Array.from(ui.msg.value).length > CFG.maxLength); };
    COLORS.forEach((c, i) => { const b = el('button', 'gbcColor'); b.style.background = c; b.setAttribute('aria-label', '쪽지 색 ' + (i + 1)); b.onclick = () => { composeColor = i; SFX.play('blip'); renderCompose(); }; ui.colors.appendChild(b); });
    // 글 쓰는 동안 게임 조작키가 눌리지 않게
    for (const node of [ui.gb, ui.compose]) node.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { if (ui.compose.classList.contains('show')) closeCompose(); else close(); }
      if (e.key === 'Enter' && e.target === ui.msg && !e.shiftKey) { e.preventDefault(); send(); }
    });
    window.addEventListener('keydown', (e) => { if (isOpen() && e.key === 'Escape') { if (ui.compose.classList.contains('show')) closeCompose(); else close(); } });
    setInterval(() => { if (ui.gb.classList.contains('show')) for (const t of ui.board.querySelectorAll('time')) t.textContent = relTime(+t.dataset.ts); }, 30000);
  }

  function noteEl(key, n, isNew) {
    const h = harvestInfo(n.seed), ch = charOf(n.char);
    const a = el('article', 'gbNote' + (isNew ? ' new' : '') + (myKeys.has(key) ? ' mine' : ''));
    a.dataset.key = key;
    const seedNum = [...key].reduce((s, c) => s + c.charCodeAt(0), 0);
    a.style.setProperty('--rot', ((seedNum % 7) - 3) * 0.9 + 'deg');
    a.style.setProperty('--paper', COLORS[(n.color | 0) % COLORS.length]);
    const top = el('div', 'gbNoteTop');
    const th = el('span', 'gbThumb'); const url = h.seed ? thumb(n.seed) : null;
    if (url) { const img = el('img'); img.src = url; img.alt = h.name; th.appendChild(img); }
    th.appendChild(el('em', null, h.emoji)); top.appendChild(th);
    const who = el('div', 'gbWho'); who.appendChild(el('b', null, trimTo(clean(n.name), 8)));
    if (ch) who.appendChild(el('small', null, `${J(ch.name, '과', '와')} 함께`));
    top.appendChild(who); a.appendChild(top);
    a.appendChild(el('p', 'gbMsg', trimTo(clean(n.msg), 60)));
    a.appendChild(el('div', 'gbTag', h.label));
    const t = el('time', null, relTime(n.ts)); t.dataset.ts = n.ts || 0; a.appendChild(t);
    if (myKeys.has(key)) a.appendChild(el('span', 'gbMine', '내 글'));
    return a;
  }
  let rendered = new Set();
  function renderBoard(newKey) {
    if (!ui || !ui.gb.classList.contains('show')) return;
    const list = sorted();
    const frag = document.createDocumentFragment(); const now = new Set();
    for (const [k, n] of list) { now.add(k); frag.appendChild(noteEl(k, n, rendered.size > 0 && !rendered.has(k))); }
    ui.board.replaceChildren(frag);
    ui.empty.style.display = list.length ? 'none' : '';
    if (newKey && rendered.size && !rendered.has(newKey)) SFX.play('plop');
    rendered = now;
  }
  function renderStatus() {
    if (!ui) return;
    const status = statusOf(), presence = presenceCount();
    const t = { connecting: '연결하는 중…', live: `실시간 연결됨 · 지금 ${presence}명이 마을에 있어요`, reconnecting: '연결이 끊겼어요 · 다시 연결하는 중…',
      denied: '게시판에 연결할 수 없어요 (데이터베이스 규칙 확인 필요)', local: `체험 모드 · 이 기기에서만 보여요 (${presence}개 창)` }[status] || '';
    ui.status.querySelector('span').textContent = t;
    ui.status.className = 'gbStatus ' + status;
  }

  function open(opts = {}) {
    if (!ui) buildUI();
    ui.gb.classList.add('show'); ui.gb.setAttribute('aria-hidden', 'false');
    rendered = new Set(); renderBoard(); rendered = new Set(notes.keys()); renderStatus();
    ui.wrap.scrollTop = 0;
    SFX.play('open');
    if (opts.compose) openCompose(opts.seedId || null);
    return new Promise(res => { openResolve = res; });
  }
  function close() {
    if (!ui) return;
    closeCompose(true);
    ui.gb.classList.remove('show'); ui.gb.setAttribute('aria-hidden', 'true');
    const r = openResolve; openResolve = null; r && r();
  }
  function isOpen() { return !!ui && (ui.gb.classList.contains('show') || ui.compose.classList.contains('show')); }

  function seedChoices() {
    const ids = [...(G.completed || [])];
    if (G.seedId && G.completed.has(G.seedId) && !ids.includes(G.seedId)) ids.push(G.seedId);
    return ids.filter(id => SEED_BY_ID[id]);
  }
  function openCompose(seedId) {
    const choices = seedChoices();
    composeSeed = seedId && choices.includes(seedId) ? seedId : (choices[choices.length - 1] || null);
    composeColor = Math.floor(Math.random() * COLORS.length);
    if (!ui.name.value) ui.name.value = G.name || '';
    ui.err.textContent = '';
    renderCompose(); ui.msg.oninput();
    ui.compose.classList.add('show'); ui.compose.setAttribute('aria-hidden', 'false');
    setTimeout(() => (ui.name.value ? ui.msg : ui.name).focus(), 60);
  }
  function closeCompose(silent) {
    if (!ui) return;
    ui.compose.classList.remove('show'); ui.compose.setAttribute('aria-hidden', 'true');
  }
  function renderCompose() {
    const h = harvestInfo(composeSeed), url = composeSeed ? thumb(composeSeed) : null;
    ui.title.textContent = composeSeed ? '수확한 걸 자랑해요!' : '방명록을 남겨요!';
    ui.preview.replaceChildren();
    const th = el('span', 'gbThumb big'); if (url) { const img = el('img'); img.src = url; img.alt = ''; th.appendChild(img); } th.appendChild(el('em', null, h.emoji));
    const tx = el('div'); tx.appendChild(el('b', null, composeSeed ? h.name : '아직 수확한 식물이 없어요'));
    tx.appendChild(el('small', null, composeSeed ? '이 수확물이 쪽지에 함께 붙어요' : '식물을 끝까지 키우면 수확물을 자랑할 수 있어요'));
    ui.preview.append(th, tx);
    ui.preview.style.setProperty('--paper', COLORS[composeColor]);
    const choices = seedChoices();
    ui.seeds.replaceChildren(); ui.seeds.style.display = choices.length > 1 ? '' : 'none';
    for (const id of choices) { const s = SEED_BY_ID[id]; const b = el('button', 'gbcSeed' + (id === composeSeed ? ' sel' : ''), `${s.emoji} ${plantShort(s)}`); b.onclick = () => { composeSeed = id; SFX.play('blip'); renderCompose(); }; ui.seeds.appendChild(b); }
    [...ui.colors.children].forEach((b, i) => b.classList.toggle('sel', i === composeColor));
  }
  async function send() {
    const name = trimTo(ui.name.value, 8), msg = trimTo(ui.msg.value, 1000);
    if (!name) { ui.err.textContent = '이름을 써 주세요.'; ui.name.focus(); return; }
    if (!msg) { ui.err.textContent = '한마디를 써 주세요.'; ui.msg.focus(); return; }
    if (Array.from(msg).length > CFG.maxLength) { ui.err.textContent = `한마디는 ${CFG.maxLength}자까지 쓸 수 있어요.`; return; }
    let lp = lastPost; try { lp = Math.max(lp, +localStorage.getItem('mjgb:last') || 0); } catch (e) { }
    const wait = CFG.cooldownSec * 1000 - (Date.now() - lp);
    if (wait > 0) { ui.err.textContent = `조금만 기다렸다가 다시 써 주세요 (${Math.ceil(wait / 1000)}초).`; SFX.play('deny'); return; }
    ui.send.disabled = true; ui.err.textContent = '';
    try {
      const note = { name: trimTo(clean(name), 8), msg: trimTo(clean(msg), 60), seed: composeSeed || 'sprout', char: G.charId || 'gibon', color: composeColor };
      const key = await NET.addNote(note);
      myKeys.add(key); lastPost = Date.now(); try { localStorage.setItem('mjgb:last', String(lastPost)); } catch (e) { }
      ui.msg.value = ''; closeCompose();
      if (!ui.gb.classList.contains('show')) open();
      renderBoard(); ui.wrap.scrollTop = 0;
      SFX.play('success');
    } catch (e) {
      console.warn('[방명록] 글 붙이기 실패', e);
      ui.err.textContent = '글을 붙이지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'; SFX.play('deny');
    } finally { ui.send.disabled = false; }
  }

  // ─── 마을 광장의 커다란 게시판 ───
  let board3D = null, tex = null, texCanvas = null, corkBg = null, drawTimer = null;
  function build3D() {
    const pos = new THREE.Vector3(12, 0, -4.5);
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = Math.atan2(-pos.x, -pos.z);
    const wood = M('#C98C55'), woodD = M('#A86F3F');
    for (const x of [-3.55, 3.55]) add(g, roundedBox(0.34, 5.6, 0.34, 0.1, 2), woodD, x, 2.8, -0.05);
    add(g, roundedBox(7.7, 4.5, 0.32, 0.14, 3), wood, 0, 3.35, 0);
    const roof = add(g, roundedBox(8.5, 0.34, 1.1, 0.16, 3), M('#DB463D'), 0, 5.75, 0.05);
    for (let i = 0; i < 5; i++) ell(g, M('#FFF5EC', { nobump: true }), 0.22, 0.07, 0.16, -3.2 + i * 1.6, 5.93, 0.15 + (i % 2) * 0.2, 10);
    texCanvas = document.createElement('canvas'); texCanvas.width = 1400; texCanvas.height = 800;
    tex = new THREE.CanvasTexture(texCanvas); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(7.1, 4.06), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    panel.position.set(0, 3.35, 0.17); panel.receiveShadow = true; g.add(panel);
    W.scene.add(g);
    const fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (let i = -3; i <= 3; i++) W.colliders.push({ x: pos.x + side.x * i * 1.15, z: pos.z + side.z * i * 1.15, r: 0.75 });
    board3D = { root: g, front: pos.clone().addScaledVector(fwd, 1.8) };
    if (document.fonts && document.fonts.load) document.fonts.load('40px Jua').then(redraw3D).catch(() => {});
    redraw3D();
    return board3D;
  }
  function makeCork(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#D6A26A'; x.fillRect(0, 0, w, h);
    const R = rnd(11);
    for (let i = 0; i < 2600; i++) { x.fillStyle = R() < 0.5 ? 'rgba(150,95,45,.28)' : 'rgba(250,215,160,.32)'; const s = 1 + R() * 3.2; x.beginPath(); x.ellipse(R() * w, R() * h, s, s * (0.5 + R() * 0.6), R() * 3, 0, 7); x.fill(); }
    return c;
  }
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function wrapLines(x, text, maxW, maxLines) {
    const chars = Array.from(text), lines = []; let cur = '';
    for (const ch of chars) { if (x.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; if (lines.length === maxLines) break; } else cur += ch; }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && lines.join('').length < chars.length) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
    return lines;
  }
  function redraw3D() { clearTimeout(drawTimer); drawTimer = setTimeout(draw3D, 250); }
  function draw3D() {
    if (!texCanvas) return;
    const status = statusOf(), presence = presenceCount();
    const x = texCanvas.getContext('2d'), Wd = texCanvas.width, Ht = texCanvas.height, F = "'Jua', 'Noto Sans KR', sans-serif";
    if (!corkBg) corkBg = makeCork(Wd, Ht);
    x.drawImage(corkBg, 0, 0);
    // 제목
    x.fillStyle = 'rgba(255,248,236,.95)'; rr(x, 30, 22, Wd - 60, 104, 30); x.fill();
    x.fillStyle = '#4A3326'; x.font = `64px ${F}`; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillText('📌 물줄때 마을 방명록', 62, 76);
    x.textAlign = 'right'; x.font = `38px ${F}`;
    x.fillStyle = status === 'live' || status === 'local' ? '#3B8F47' : '#C9663A';
    x.fillText(status === 'live' || status === 'local' ? `● 지금 ${presence}명` : '○ 연결 중', Wd - 62, 78);
    const list = sorted().slice(0, 8);
    if (!list.length) {
      x.textAlign = 'center'; x.fillStyle = '#5A3A22'; x.font = `56px ${F}`;
      x.fillText('첫 번째 방명록을 남겨 주세요!', Wd / 2, Ht / 2 + 40);
    }
    const cw = 310, chh = 300, gx = (Wd - cw * 4) / 5, top = 160, gy = (Ht - top - chh * 2) / 3;
    list.forEach(([k, n], i) => {
      const col = i % 4, row = (i / 4) | 0, cx = gx + col * (cw + gx), cy = top + gy + row * (chh + gy);
      const rot = ((([...k].reduce((s, c) => s + c.charCodeAt(0), 0)) % 7) - 3) * 0.012;
      x.save(); x.translate(cx + cw / 2, cy + chh / 2); x.rotate(rot); x.translate(-cw / 2, -chh / 2);
      x.fillStyle = 'rgba(80,45,15,.25)'; rr(x, 6, 10, cw, chh, 18); x.fill();
      x.fillStyle = COLORS[(n.color | 0) % COLORS.length]; rr(x, 0, 0, cw, chh, 18); x.fill();
      x.fillStyle = '#E5322E'; x.beginPath(); x.arc(cw / 2, 10, 13, 0, 7); x.fill();
      const h = harvestInfo(n.seed);
      x.textAlign = 'left'; x.fillStyle = '#4A3326';
      x.font = `56px ${F}`; x.fillText(h.emoji, 20, 70);
      x.font = `40px ${F}`; x.fillText(trimTo(clean(n.name), 8), 92, 70);
      x.font = `34px ${F}`; x.fillStyle = '#5A4234';
      wrapLines(x, trimTo(clean(n.msg), 60), cw - 40, 3).forEach((ln, j) => x.fillText(ln, 20, 140 + j * 44));
      x.font = `25px ${F}`; x.fillStyle = '#3B8F47';
      x.fillText(wrapLines(x, h.seed ? `🧺 ${h.name}` : '🌱 키우는 중', cw - 40, 1)[0] || '', 20, chh - 30);
      x.restore();
    });
    tex.needsUpdate = true;
  }

  // ─── 시작 ───
  let lastPresence = 0;
  function init() {
    NET.on((type, key) => {
      if (type === 'notes') {
        renderBoard(key); redraw3D();
        if (key && NET.loaded && notes.has(key) && !myKeys.has(key) && G.mode === 'play' && !isOpen() && typeof toast === 'function') {
          const n = notes.get(key); const h = harvestInfo(n.seed);
          if (Date.now() - (n.ts || 0) < 60000) { toast(`${trimTo(clean(n.name), 8)}님이 방명록에 ${h.seed ? h.name + '을(를) 자랑했어요' : '글을 남겼어요'}`); SFX.play('blip'); }
        }
      }
      if (type === 'status') { renderStatus(); redraw3D(); }
      if (type === 'players') { const p = presenceCount(); if (p !== lastPresence) { lastPresence = p; renderStatus(); redraw3D(); } }
    });
    setInterval(() => { const p = presenceCount(); if (p !== lastPresence) { lastPresence = p; renderStatus(); redraw3D(); } }, 5000);
    NET.start();
  }

  return {
    init, build3D, open, close, isOpen, clean,
    get board3D() { return board3D; },
    get count() { return notes.size; },
    get status() { return statusOf(); },
    get presence() { return presenceCount(); },
  };
})();
