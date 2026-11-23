# Firebase RTDB REST 흉내 서버 (테스트용): SSE 스트림, POST push, PUT/DELETE, .sv timestamp
import json, time, threading, queue, random, string, sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
DB = {}; LOCK = threading.Lock(); SUBS = []  # (path, queue)
def now(): return int(time.time()*1000)
def resolve(v):
    if isinstance(v, dict):
        if v.get('.sv') == 'timestamp': return now()
        return {k: resolve(x) for k, x in v.items()}
    return v
def get(path):
    node = DB
    for p in path:
        if not isinstance(node, dict) or p not in node: return None
        node = node[p]
    return node
def setp(path, val):
    node = DB
    for p in path[:-1]: node = node.setdefault(p, {})
    if val is None: node.pop(path[-1], None)
    else: node[path[-1]] = val
def notify(path, val):
    for sp, q in list(SUBS):
        if path[:len(sp)] == sp:
            rel = '/' + '/'.join(path[len(sp):])
            q.put(('put', {'path': rel, 'data': val}))
class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); self.send_header('Access-Control-Allow-Headers', '*')
    def parts(self):
        p = urlparse(self.path).path
        assert p.endswith('.json'); p = p[:-5]
        return [x for x in p.split('/') if x]
    def reply(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.cors(); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def body(self):
        n = int(self.headers.get('Content-Length') or 0); return json.loads(self.rfile.read(n) or b'null')
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.send_header('Content-Length', '0'); self.end_headers()
    def do_GET(self):
        path = self.parts()
        if 'text/event-stream' not in (self.headers.get('Accept') or ''):
            with LOCK: return self.reply(get(path))
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
        path = self.parts(); val = resolve(self.body())
        key = '-' + format(now(), 'x') + ''.join(random.choices(string.ascii_letters, k=6))
        with LOCK: setp(path + [key], val); notify(path + [key], val)
        self.reply({'name': key})
    def do_PUT(self):
        path = self.parts(); val = resolve(self.body())
        with LOCK: setp(path, val); notify(path, val)
        self.reply(val)
    def do_DELETE(self):
        path = self.parts()
        with LOCK: setp(path, None); notify(path, None)
        self.reply(None)
ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
