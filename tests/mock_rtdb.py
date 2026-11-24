# Firebase RTDB REST + 익명 로그인 흉내 서버 (테스트용)
#  - RTDB: SSE 스트림, GET(orderBy/limitToLast/limitToFirst/startAt), POST push, PUT, PATCH(여러 경로), DELETE, .sv timestamp
#  - 로그인: /v1/accounts:signUp, /v1/token (가짜 토큰 'tok-<uid>')
#  - 규칙 흉내: firebase/database.rules.json의 핵심(로그인 필요, 내 players만, 글 수·글쓰기 간격 검사)
# 사용법: python tests/mock_rtdb.py <port>   → js/data.js의 GUESTBOOK에 dbUrl·authUrl = 'http://127.0.0.1:<port>', apiKey = 'test'
import json, time, threading, queue, random, string, sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
DB = {}; LOCK = threading.Lock(); SUBS = []  # (path, queue)
ROOM = 'guestbook'
def now(): return int(time.time()*1000)
def resolve(v, t):
    if isinstance(v, dict):
        if v.get('.sv') == 'timestamp': return t
        return {k: resolve(x, t) for k, x in v.items()}
    return v
def get(path, src=None):
    node = DB if src is None else src
    for p in path:
        if not isinstance(node, dict) or p not in node: return None
        node = node[p]
    return node
def setp(path, val, dst=None):
    node = DB if dst is None else dst
    for p in path[:-1]: node = node.setdefault(p, {})
    if val is None: node.pop(path[-1], None)
    else: node[path[-1]] = val
def notify(path, val):
    for sp, q in list(SUBS):
        if path[:len(sp)] == sp:
            rel = '/' + '/'.join(path[len(sp):])
            q.put(('put', {'path': rel, 'data': val}))
        elif sp[:len(path)] == path:
            q.put(('put', {'path': '/', 'data': get(sp)}))

def allowed(writes, uid, t):
    """writes: [(path, val)] → 규칙 흉내. 통과하면 None, 아니면 이유"""
    if not uid: return 'auth'
    new = json.loads(json.dumps(DB))
    for p, v in writes: setp(p, v, new)
    for p, v in writes:
        if p[0] != ROOM: return 'room'
        col = p[1] if len(p) > 1 else None
        if col == 'players':
            cid = p[2]; old = get(p)
            if cid != uid and not (v is None and old and old.get('t', 0) < t - 90000): return 'players'
        elif col == 'notes':
            if get(p) is not None or v is None: return 'notes-exists'
            if len(p[2]) != 20 or v.get('uid') != uid or v.get('ts') != t: return 'notes-shape'
            if get([ROOM, 'last', uid], new) != t: return 'notes-last'
            if get([ROOM, 'meta', 'count'], new) != (get([ROOM, 'meta', 'count']) or 0) + 1: return 'notes-count'
        elif col == 'meta':
            old = get([ROOM, 'meta']) or {}
            nm = get([ROOM, 'meta'], new) or {}
            if nm.get('count') != (old.get('count') or 0) + 1: return 'meta-count'
            if nm.get('t') != t or ('t' in old and old['t'] > t - 1000): return 'meta-t'
            if get([ROOM, 'last', uid], new) != t: return 'meta-last'
        elif col == 'last':
            if p[2] != uid or v != t: return 'last'
            old = get(p)
            if old is not None and old > t - 20000: return 'last-rate'
        else: return 'other'
    return None

class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS'); self.send_header('Access-Control-Allow-Headers', '*')
    def url(self): return urlparse(self.path)
    def qs(self): return {k: v[0] for k, v in parse_qs(self.url().query).items()}
    def uid(self):
        tok = self.qs().get('auth', '')
        return tok[4:] if tok.startswith('tok-') else None
    def parts(self):
        p = self.url().path
        assert p.endswith('.json'); p = p[:-5]
        return [x for x in p.split('/') if x]
    def reply(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.cors(); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def deny(self, why): print('denied', why, flush=True); self.reply({'error': 'Permission denied'}, 401)
    def raw(self):
        n = int(self.headers.get('Content-Length') or 0); return self.rfile.read(n)
    def body(self): return json.loads(self.raw() or b'null')
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.send_header('Content-Length', '0'); self.end_headers()
    def do_GET(self):
        path = self.parts()
        if 'text/event-stream' not in (self.headers.get('Accept') or ''):
            q = self.qs()
            with LOCK: data = get(path)
            if 'orderBy' in q and isinstance(data, dict):
                f = json.loads(q['orderBy'])
                items = sorted(data.items(), key=lambda kv: (kv[1].get(f, 0) if isinstance(kv[1], dict) else 0, kv[0]))
                if 'startAt' in q: s = json.loads(q['startAt']); items = [kv for kv in items if kv[1].get(f, 0) >= s]
                if 'limitToFirst' in q: items = items[:int(q['limitToFirst'])]
                if 'limitToLast' in q: items = items[-int(q['limitToLast']):]
                data = dict(items)
            elif 'orderBy' not in q and len(path) >= 2 and path[1] == 'notes': return self.deny('notes-noquery')
            return self.reply(data)
        q = queue.Queue(); SUBS.append((path, q))
        self.send_response(200); self.cors(); self.send_header('Content-Type', 'text/event-stream'); self.send_header('Cache-Control', 'no-cache'); self.end_headers()
        with LOCK: q.put(('put', {'path': '/', 'data': get(path)}))
        try:
            while True:
                try: ev, d = q.get(timeout=15)
                except queue.Empty: ev, d = 'keep-alive', None
                self.wfile.write(f"event: {ev}\ndata: {json.dumps(d, ensure_ascii=False)}\n\n".encode()); self.wfile.flush()
        except Exception: pass
        finally: SUBS.remove((path, q))
    def do_POST(self):
        p = self.url().path
        if p.endswith('accounts:signUp'):
            self.raw(); uid = ''.join(random.choices(string.ascii_letters + string.digits, k=28))
            return self.reply({'localId': uid, 'idToken': 'tok-' + uid, 'refreshToken': 'rt-' + uid, 'expiresIn': '3600'})
        if p.endswith('/v1/token'):
            form = parse_qs(self.raw().decode()); rt = form.get('refresh_token', [''])[0]
            if not rt.startswith('rt-'): return self.reply({'error': {'message': 'INVALID_REFRESH_TOKEN'}}, 400)
            uid = rt[3:]
            return self.reply({'user_id': uid, 'id_token': 'tok-' + uid, 'refresh_token': rt, 'expires_in': '3600'})
        return self.deny('post')   # 새 코드는 POST를 안 씀 (PATCH로 여러 경로를 한 번에)
    def do_PUT(self):
        path = self.parts(); t = now(); val = resolve(self.body(), t)
        with LOCK:
            why = allowed([(path, val)], self.uid(), t)
            if why: return self.deny(why)
            setp(path, val); notify(path, val)
        self.reply(val)
    def do_PATCH(self):
        path = self.parts(); t = now(); body = resolve(self.body(), t)
        writes = [(path + [x for x in k.split('/') if x], v) for k, v in body.items()]
        with LOCK:
            why = allowed(writes, self.uid(), t)
            if why: return self.deny(why)
            for p, v in writes: setp(p, v); notify(p, v)
        self.reply(body)
    def do_DELETE(self):
        path = self.parts(); t = now()
        with LOCK:
            why = allowed([(path, None)], self.uid(), t)
            if why: return self.deny(why)
            setp(path, None); notify(path, None)
        self.reply(None)
ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
