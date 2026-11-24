// 물줄때 마을 · 실시간 연결 (방명록 + 같이 접속한 사람들)
// Firebase 실시간 데이터베이스를 SDK 없이 REST로 써요. 한 사람당 연결은 하나(EventSource)만 열어요(무료 요금제는 동시 연결 100개).
// GUESTBOOK.dbUrl이 비어 있으면 체험 모드: 같은 브라우저의 탭끼리만 공유(BroadcastChannel).
const NET = (() => {
  const CFG = GUESTBOOK;
  const mode = CFG.dbUrl ? 'firebase' : 'local';
  const base = mode === 'firebase' ? CFG.dbUrl.replace(/\/+$/, '') + '/' + encodeURIComponent(CFG.room) : '';
  const cid = (Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5));
  const notes = new Map(), players = new Map();
  const subs = new Set();
  let status = 'connecting', offset = 0, loaded = false, ch = null;

  const emit = (type, key) => { for (const fn of subs) { try { fn(type, key); } catch (e) { console.error(e); } } };
  const setStatus = (s) => { if (status !== s) { status = s; emit('status'); } };
  const isNote = (n) => n && typeof n === 'object' && typeof n.name === 'string' && typeof n.msg === 'string';
  const isPlayer = (p) => p && typeof p === 'object' && typeof p.x === 'number' && typeof p.z === 'number';

  function trimNotes() {
    if (notes.size <= CFG.maxNotes) return;
    const keys = [...notes.keys()].sort(); for (let i = 0; i < keys.length - CFG.maxNotes; i++) notes.delete(keys[i]);
  }
  // path: ['notes', key] / ['players', cid] / [] 등
  function route(parts, data, isPatch) {
    if (parts.length === 0) {
      if (!isPatch) { notes.clear(); players.clear(); }
      if (data && typeof data === 'object') {
        for (const k of Object.keys(data)) route([k], data[k], isPatch);
      }
      if (!isPatch) { emit('notes'); emit('players'); }
      return;
    }
    const [col, key, field] = parts;
    const map = col === 'notes' ? notes : col === 'players' ? players : null;
    if (!map) return;
    if (!key) {
      if (!isPatch) map.clear();
      if (data && typeof data === 'object') for (const [k, v] of Object.entries(data)) setItem(map, col, k, v);
      if (col === 'notes') trimNotes();
      emit(col); return;
    }
    if (field) { // 필드 하나만 바뀐 경우
      const cur = map.get(key); if (!cur) return;
      const nv = { ...cur }; if (data === null) delete nv[field]; else nv[field] = data;
      setItem(map, col, key, nv); emit(col, key); return;
    }
    setItem(map, col, key, data);
    if (col === 'notes') trimNotes();
    emit(col, key);
  }
  function setItem(map, col, k, v) {
    if (v === null || v === undefined) { map.delete(k); return; }
    if (col === 'notes' ? isNote(v) : isPlayer(v)) map.set(k, v);
  }

  // ─── Firebase ───
  function startFirebase() {
    const es = new EventSource(base + '.json');
    const onData = (isPatch) => (e) => {
      let d; try { d = JSON.parse(e.data); } catch (err) { return; }
      route(String(d.path || '/').split('/').filter(Boolean), d.data, isPatch);
      if (!loaded && !isPatch) { loaded = true; emit('loaded'); }
      setStatus('live');
    };
    es.addEventListener('put', onData(false));
    es.addEventListener('patch', onData(true));
    es.addEventListener('cancel', () => { setStatus('denied'); es.close(); });
    es.onopen = () => { if (loaded) setStatus('live'); };
    es.onerror = () => setStatus(loaded ? 'reconnecting' : 'connecting');
  }
  async function fb(method, path, body, keepalive) {
    const r = await fetch(`${base}/${path}.json`, { method, body: body === undefined ? undefined : JSON.stringify(body), keepalive: !!keepalive });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // ─── 체험 모드 ───
  const LKEY = 'mjnet:' + CFG.room;
  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LKEY) || '{}'); } catch (e) { return {}; } };
  const saveLocal = (o) => { try { localStorage.setItem(LKEY, JSON.stringify(o)); } catch (e) { } };
  function startLocal() {
    const o = loadLocal(); for (const [k, v] of Object.entries(o)) setItem(notes, 'notes', k, v); trimNotes();
    try {
      ch = new BroadcastChannel('mjnet:' + CFG.room);
      ch.onmessage = (e) => {
        const m = e.data || {};
        if (m.type === 'put') route(m.path, m.data, false);
        if (m.type === 'hello' && players.has(cid)) ch.postMessage({ type: 'put', path: ['players', cid], data: players.get(cid) });
      };
      ch.postMessage({ type: 'hello' });
    } catch (e) { }
    loaded = true; setStatus('local'); emit('loaded'); emit('notes');
  }
  function localPut(path, data) {
    route(path, data, false);
    try { ch && ch.postMessage({ type: 'put', path, data }); } catch (e) { }
  }

  // ─── 공개 API ───
  const resolveTs = (o) => ({ ...o, t: Date.now() });
  return {
    cid, mode, notes, players,
    get status() { return status; },
    get loaded() { return loaded; },
    now: () => Date.now() + offset,
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    start() { try { mode === 'firebase' ? startFirebase() : startLocal(); } catch (e) { console.warn('[NET] 시작 실패', e); setStatus('reconnecting'); } },
    // 방명록 글 추가 → 새 글의 키
    async addNote(note) {
      if (mode === 'firebase') { const { name } = await fb('POST', 'notes', { ...note, ts: { '.sv': 'timestamp' } }); return name; }
      const key = Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 6);
      const o = loadLocal(); o[key] = { ...note, ts: Date.now() };
      const keys = Object.keys(o).sort(); while (keys.length > CFG.maxNotes) delete o[keys.shift()];
      saveLocal(o); localPut(['notes', key], o[key]); return key;
    },
    // 내 상태 올리기 (위치·동작)
    async putMe(state) {
      if (mode === 'firebase') {
        const res = await fb('PUT', 'players/' + cid, { ...state, t: { '.sv': 'timestamp' } });
        if (res && typeof res.t === 'number') offset = res.t - Date.now();
        return;
      }
      localPut(['players', cid], resolveTs(state));
    },
    removeMe() {
      if (mode === 'firebase') { fb('DELETE', 'players/' + cid, undefined, true).catch(() => {}); return; }
      localPut(['players', cid], null);
    },
    removePlayer(id) {
      if (mode === 'firebase') { fb('DELETE', 'players/' + id).catch(() => {}); return; }
      players.delete(id);
    },
  };
})();
