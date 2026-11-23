// 물줄때 마을 · 실시간 연결 (방명록 + 같이 접속한 사람들)
// Firebase 실시간 데이터베이스를 SDK 없이 REST로 써요.
//  - 접속자(players): EventSource 하나로 실시간 수신 (무료 요금제는 동시 연결 100개)
//  - 방명록(notes): 최근 글만(GUESTBOOK.maxNotes) 받아 오고, 그 뒤로는 새 글만 몇 초마다 확인해요.
//    글이 아무리 많이 쌓여도 접속할 때 받는 양이 늘지 않아요.
//  - 쓰기는 익명 로그인(Firebase Authentication)한 사람만. 글쓰기 간격·글 수는 서버 규칙이 검사해요.
// GUESTBOOK.dbUrl이 비어 있으면 체험 모드: 같은 브라우저의 탭끼리만 공유(BroadcastChannel).
const NET = (() => {
  const CFG = GUESTBOOK;
  const mode = CFG.dbUrl ? 'firebase' : 'local';
  const base = mode === 'firebase' ? CFG.dbUrl.replace(/\/+$/, '') + '/' + encodeURIComponent(CFG.room) : '';
  const LIMIT = Math.max(20, CFG.maxNotes | 0 || 500);
  const POLL_MS = 5000;
  let cid = (Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5));   // firebase 모드에서는 로그인 후 uid로 바뀜
  const notes = new Map(), players = new Map();
  const subs = new Set();
  let status = 'connecting', offset = 0, loaded = false, ch = null, total = 0;

  const emit = (type, key) => { for (const fn of subs) { try { fn(type, key); } catch (e) { console.error(e); } } };
  const setStatus = (s) => { if (status !== s) { status = s; emit('status'); } };
  const isNote = (n) => n && typeof n === 'object' && typeof n.name === 'string' && typeof n.msg === 'string';
  const isPlayer = (p) => p && typeof p === 'object' && typeof p.x === 'number' && typeof p.z === 'number';

  function trimNotes() {
    if (notes.size <= LIMIT) return;
    const keys = [...notes.entries()].sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0) || (a[0] < b[0] ? -1 : 1)).map(e => e[0]);
    for (let i = 0; i < keys.length - LIMIT; i++) notes.delete(keys[i]);
  }
  function setItem(map, col, k, v) {
    if (v === null || v === undefined) { map.delete(k); return; }
    if (col === 'notes' ? isNote(v) : isPlayer(v)) map.set(k, v);
  }
  // 접속자 스트림: path는 players 아래 기준 ('/', '/cid', '/cid/x')
  function routePlayers(parts, data, isPatch) {
    const [key, field] = parts;
    if (!key) {
      if (!isPatch) players.clear();
      if (data && typeof data === 'object') for (const [k, v] of Object.entries(data)) setItem(players, 'players', k, v);
      emit('players'); return;
    }
    if (field) {
      const cur = players.get(key); if (!cur) return;
      const nv = { ...cur }; if (data === null) delete nv[field]; else nv[field] = data;
      setItem(players, 'players', key, nv); emit('players', key); return;
    }
    setItem(players, 'players', key, data); emit('players', key);
  }

  // ─── 익명 로그인 (Firebase Authentication REST) ───
  // 로그인 정보는 이 기기(localStorage)에 남겨서, 새로 고침할 때마다 계정이 새로 생기지 않게 해요
  // (Firebase는 같은 인터넷 주소에서 1시간에 만들 수 있는 계정 수를 제한해요 — 전시장 와이파이 대비).
  const AKEY = 'mjauth:' + (CFG.apiKey || '').slice(-8);
  let auth = null, authP = null, refreshTimer = 0, authFailAt = 0;
  function saveAuth() { try { localStorage.setItem(AKEY, JSON.stringify({ uid: auth.uid, rt: auth.rt })); } catch (e) { } }
  function loadAuth() { try { const o = JSON.parse(localStorage.getItem(AKEY) || 'null'); return o && o.uid && o.rt ? o : null; } catch (e) { return null; } }
  async function postJSON(url, body, form) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('AUTH ' + r.status + ' ' + ((j.error && j.error.message) || ''));
    return j;
  }
  function useToken(uid, token, rt, expSec) {
    auth = { uid, token, rt, exp: Date.now() + (+expSec || 3600) * 1000 };
    cid = uid; saveAuth();
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { authP = null; ensureAuth(true).catch(() => {}); }, Math.max(60000, auth.exp - Date.now() - 5 * 60000));
  }
  async function signIn(force) {
    const key = encodeURIComponent(CFG.apiKey);
    const saved = auth || loadAuth();
    if (saved && saved.rt) {
      try {
        const j = await postJSON(`${CFG.authUrl || 'https://securetoken.googleapis.com'}/v1/token?key=${key}`, { grant_type: 'refresh_token', refresh_token: saved.rt }, true);
        useToken(j.user_id, j.id_token, j.refresh_token, j.expires_in); return auth;
      } catch (e) { if (!force) console.warn('[NET] 로그인 갱신 실패, 새로 로그인해요', e); }
    }
    const j = await postJSON(`${CFG.authUrl || 'https://identitytoolkit.googleapis.com'}/v1/accounts:signUp?key=${key}`, { returnSecureToken: true });
    useToken(j.localId, j.idToken, j.refreshToken, j.expiresIn); return auth;
  }
  function ensureAuth(force) {
    if (!CFG.apiKey) return Promise.reject(new Error('GUESTBOOK.apiKey가 비어 있어요'));
    if (!force && auth && Date.now() < auth.exp - 60000) return Promise.resolve(auth);
    if (!authP) {
      if (Date.now() - authFailAt < 30000) return Promise.reject(new Error('로그인 잠시 쉬는 중'));   // 실패하면 30초 동안은 다시 시도하지 않아요
      authP = signIn(force).catch((e) => { authP = null; authFailAt = Date.now(); throw e; });
    }
    return authP;
  }

  // ─── Firebase ───
  async function fb(method, path, body, opts = {}) {
    const q = new URLSearchParams(opts.query || {});
    if (opts.auth) { const a = await ensureAuth(); q.set('auth', a.token); }
    const qs = q.toString();
    const r = await fetch(`${base}${path ? '/' + path : ''}.json${qs ? '?' + qs : ''}`, { method, body: body === undefined ? undefined : JSON.stringify(body), keepalive: !!opts.keepalive });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  function startPlayers() {
    const es = new EventSource(base + '/players.json');
    const onData = (isPatch) => (e) => {
      let d; try { d = JSON.parse(e.data); } catch (err) { return; }
      routePlayers(String(d.path || '/').split('/').filter(Boolean), d.data, isPatch);
      if (status !== 'denied') setStatus(loaded ? 'live' : 'connecting');
    };
    es.addEventListener('put', onData(false));
    es.addEventListener('patch', onData(true));
    es.addEventListener('cancel', () => { setStatus('denied'); es.close(); });
    es.onerror = () => { if (status !== 'denied') setStatus(loaded ? 'reconnecting' : 'connecting'); };
  }
  // 방명록: 처음엔 최근 LIMIT개, 그다음부터는 마지막으로 본 시각 이후 글만
  let lastTs = 0, polling = false, pollTimer = 0;
  function takeNotes(obj) {
    const fresh = [];
    if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) {
      if (!isNote(v) || notes.has(k)) continue;
      notes.set(k, v); fresh.push(k); if (typeof v.ts === 'number' && v.ts > lastTs) lastTs = v.ts;
    }
    return fresh;
  }
  async function pollNotes(first) {
    if (polling) return; polling = true;
    try {
      const query = first ? { orderBy: '"ts"', limitToLast: String(LIMIT) } : { orderBy: '"ts"', startAt: String(lastTs), limitToFirst: '100' };
      const [data, meta] = await Promise.all([fb('GET', 'notes', undefined, { query }), fb('GET', 'meta/count').catch(() => null)]);
      if (typeof meta === 'number') total = meta;
      const fresh = takeNotes(data);
      if (fresh.length) { trimNotes(); }
      if (first) { loaded = true; emit('loaded'); emit('notes'); }
      else for (const k of fresh) emit('notes', k);
      setStatus('live');
    } catch (e) {
      // 400 = 규칙에 .indexOn이 없음(새 규칙을 아직 게시 안 함), 401/403 = 규칙이 막음 → 둘 다 '규칙 확인 필요'로 보여요
      setStatus(e.status === 400 || e.status === 401 || e.status === 403 ? 'denied' : (loaded ? 'reconnecting' : 'connecting'));
    } finally { polling = false; }
  }
  function schedulePoll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => { if (!document.hidden) await pollNotes(!loaded); schedulePoll(); }, loaded ? POLL_MS : 3000);
  }
  function startFirebase() {
    startPlayers();
    pollNotes(true).finally(schedulePoll);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pollNotes(!loaded); });
    if (CFG.apiKey) ensureAuth().catch((e) => console.warn('[NET] 익명 로그인 실패 · 글쓰기·함께 접속하기가 꺼져요', e));
    else console.warn('[NET] GUESTBOOK.apiKey가 비어 있어서 읽기만 할 수 있어요');
  }
  // Firebase 푸시 키와 같은 모양(20자, 시간순)
  const PUSH_CH = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  function pushId() {
    let t = Date.now() + offset, s = '';
    for (let i = 0; i < 8; i++) { s = PUSH_CH[t % 64] + s; t = Math.floor(t / 64); }
    const rnd = crypto.getRandomValues(new Uint8Array(12));
    for (let i = 0; i < 12; i++) s += PUSH_CH[rnd[i] % 64];
    return s;
  }
  async function addNoteFirebase(note) {
    // 글 + 글 수(meta) + 내 마지막 글 시각(last)을 한 번에 써요. 서버 규칙이 세 가지가 함께 맞는지 검사해요.
    let lastErr = null;
    for (let tries = 0; tries < 4; tries++) {
      try {
        const a = await ensureAuth();
        const cur = await fb('GET', 'meta/count').catch(() => null);
        const count = (typeof cur === 'number' ? cur : 0) + 1;
        const key = pushId(), SV = { '.sv': 'timestamp' };
        await fb('PATCH', '', {
          ['notes/' + key]: { ...note, uid: a.uid, ts: SV },
          'meta/count': count, 'meta/t': SV,
          ['last/' + a.uid]: SV,
        }, { auth: true });
        total = Math.max(total, count);
        pollNotes(false);
        return key;
      } catch (e) {
        lastErr = e;
        if (e.status !== 401 && e.status !== 403) break;
        if (tries === 0 && auth) { auth.exp = 0; authP = null; }   // 첫 실패는 로그인이 만료됐을 수도 있어서 새로 받아요
        await new Promise(r => setTimeout(r, 900 + Math.random() * 900));   // 다른 사람과 동시에 썼으면 잠깐 뒤 다시
      }
    }
    throw lastErr;
  }

  // ─── 체험 모드 ───
  const LKEY = 'mjnet:' + CFG.room;
  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LKEY) || '{}'); } catch (e) { return {}; } };
  const saveLocal = (o) => { try { localStorage.setItem(LKEY, JSON.stringify(o)); } catch (e) { } };
  function localRoute(path, data) {
    const [col, key] = path;
    if (col === 'players') return routePlayers(path.slice(1), data, false);
    if (col === 'notes' && key) { setItem(notes, 'notes', key, data); trimNotes(); total = Math.max(total, notes.size); emit('notes', key); }
  }
  function startLocal() {
    const o = loadLocal(); for (const [k, v] of Object.entries(o)) setItem(notes, 'notes', k, v); trimNotes();
    total = Object.keys(o).length;
    try {
      ch = new BroadcastChannel('mjnet:' + CFG.room);
      ch.onmessage = (e) => {
        const m = e.data || {};
        if (m.type === 'put' && Array.isArray(m.path)) localRoute(m.path, m.data);
        if (m.type === 'hello' && players.has(cid)) ch.postMessage({ type: 'put', path: ['players', cid], data: players.get(cid) });
      };
      ch.postMessage({ type: 'hello' });
    } catch (e) { }
    loaded = true; setStatus('local'); emit('loaded'); emit('notes');
  }
  function localPut(path, data) {
    localRoute(path, data);
    try { ch && ch.postMessage({ type: 'put', path, data }); } catch (e) { }
  }

  // ─── 공개 API ───
  return {
    get cid() { return cid; },
    mode, notes, players,
    get status() { return status; },
    get loaded() { return loaded; },
    // 지금까지 남긴 글 수 (받아 온 글은 최근 것만이라 notes.size보다 클 수 있어요)
    get total() { return Math.max(total, notes.size); },
    get canWrite() { return mode === 'local' || !!(auth && auth.token); },
    now: () => Date.now() + offset,
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    start() { try { mode === 'firebase' ? startFirebase() : startLocal(); } catch (e) { console.warn('[NET] 시작 실패', e); setStatus('reconnecting'); } },
    // 방명록 글 추가 → 새 글의 키
    async addNote(note) {
      if (mode === 'firebase') return addNoteFirebase(note);
      const key = Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 6);
      const o = loadLocal(); o[key] = { ...note, ts: Date.now() };
      const keys = Object.keys(o).sort(); while (keys.length > LIMIT) delete o[keys.shift()];
      saveLocal(o); localPut(['notes', key], o[key]); return key;
    },
    // 내 상태 올리기 (위치·동작). 로그인 전이면 조용히 건너뛰어요.
    async putMe(state) {
      if (mode === 'firebase') {
        if (!auth) { await ensureAuth(); }
        const res = await fb('PUT', 'players/' + cid, { ...state, t: { '.sv': 'timestamp' } }, { auth: true });
        if (res && typeof res.t === 'number') offset = res.t - Date.now();
        return;
      }
      localPut(['players', cid], { ...state, t: Date.now() });
    },
    removeMe() {
      if (mode === 'firebase') { if (auth) fb('DELETE', 'players/' + cid, undefined, { auth: true, keepalive: true }).catch(() => {}); return; }
      localPut(['players', cid], null);
    },
    // 90초 넘게 소식 없는 다른 접속자 기록 지우기 (서버 규칙도 오래된 것만 지우게 허락해요)
    removePlayer(id) {
      if (mode === 'firebase') { if (auth) fb('DELETE', 'players/' + id, undefined, { auth: true }).catch(() => {}); return; }
      players.delete(id);
    },
  };
})();
