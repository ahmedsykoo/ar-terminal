#!/usr/bin/env python3
"""AR Terminal (web) - a real shell in your browser with correct Arabic/RTL rendering.

Works in Termux (Android), Linux and macOS. Standard library only.
It starts a local server on 127.0.0.1, spawns your shell (pwsh if installed,
else $SHELL) on a PTY and shows it with the AR Terminal xterm + Arabic overlay UI.
Anything you run inside (pwsh, claude, vim, ssh...) behaves like a normal terminal.
"""
import argparse
import codecs
import fcntl
import json
import mimetypes
import os
import pty
import queue
import secrets
import shutil
import signal
import struct
import subprocess
import sys
import termios
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


def default_shell():
    env = os.environ.get("ARTERM_SHELL")
    if env:
        return env
    for name in ("pwsh", os.environ.get("SHELL", ""), "bash", "sh"):
        if name and shutil.which(name):
            return shutil.which(name)
    return "/bin/sh"


class Session:
    def __init__(self, shell, cwd):
        self.shell, self.cwd = shell, cwd
        self.rows, self.cols = 30, 100
        self.fd = None
        self.pid = None
        self.out = queue.Queue()
        self.lock = threading.Lock()

    def resize(self, rows, cols):
        self.rows, self.cols = rows, cols
        if self.fd is not None:
            fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    def start(self):
        with self.lock:
            if self.fd is not None:
                return
            env = dict(os.environ, TERM="xterm-256color", COLORTERM="truecolor")
            env.setdefault("LANG", "en_US.UTF-8")
            pid, fd = pty.fork()
            if pid == 0:
                try:
                    os.chdir(self.cwd)
                    os.execvpe(self.shell, [self.shell], env)
                finally:
                    os._exit(127)
            self.pid, self.fd = pid, fd
            self.resize(self.rows, self.cols)
            threading.Thread(target=self._reader, daemon=True).start()

    def _reader(self):
        dec = codecs.getincrementaldecoder("utf-8")(errors="replace")
        while True:
            try:
                data = os.read(self.fd, 65536)
            except OSError:
                break
            if not data:
                break
            text = dec.decode(data)
            if text:
                self.out.put({"type": "output", "data": text})
        self.out.put({"type": "exit"})

    def write(self, text):
        if self.fd is not None:
            os.write(self.fd, text.encode("utf-8"))

    def kill(self):
        if self.pid:
            try:
                os.kill(self.pid, signal.SIGHUP)
            except OSError:
                pass


class App:
    def __init__(self, token, shell, cwd, port):
        self.token, self.shell, self.cwd, self.port = token, shell, cwd, port
        self.sessions = {}
        self.lock = threading.Lock()

    def session(self, sid):
        with self.lock:
            if sid not in self.sessions:
                self.sessions[sid] = Session(self.shell, self.cwd)
            return self.sessions[sid]


def make_handler(app):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            pass

        def _auth(self):
            host = self.headers.get("Host", "")
            if host not in ("127.0.0.1:%d" % app.port, "localhost:%d" % app.port):
                self.send_error(403)
                return None
            u = urlparse(self.path)
            q = parse_qs(u.query)
            tok = q.get("t", [""])[0]
            if not tok:  # static assets: token arrives via the cookie set on the first page load
                for part in self.headers.get("Cookie", "").split(";"):
                    k, _, v = part.strip().partition("=")
                    if k == "arterm":
                        tok = v
            if not secrets.compare_digest(tok, app.token):
                self.send_error(403)
                return None
            return u.path, q

        def do_GET(self):
            r = self._auth()
            if not r:
                return
            path, q = r
            if path == "/stream":
                return self._stream(app.session(q.get("sid", [""])[0]))
            rel = "index.html" if path == "/" else path.lstrip("/")
            full = os.path.normpath(os.path.join(WEB_DIR, rel))
            if not full.startswith(WEB_DIR + os.sep) or not os.path.isfile(full):
                self.send_error(404)
                return
            body = open(full, "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(full)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            if path == "/":
                self.send_header("Set-Cookie", "arterm=%s; HttpOnly; SameSite=Strict; Path=/" % app.token)
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            r = self._auth()
            if not r:
                return
            path, q = r
            length = int(self.headers.get("Content-Length", "0"))
            msg = json.loads(self.rfile.read(length) or b"{}")
            s = app.session(q.get("sid", [""])[0])
            if path == "/input":
                s.write(msg.get("data", ""))
            elif path == "/resize":
                s.resize(int(msg["rows"]), int(msg["cols"]))
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def _stream(self, s):
            s.start()
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            try:
                while True:
                    try:
                        item = s.out.get(timeout=15)
                        chunk = "data: " + json.dumps(item) + "\n\n"
                        if item["type"] == "exit":
                            self.wfile.write(chunk.encode())
                            self.wfile.flush()
                            break
                    except queue.Empty:
                        chunk = ": ping\n\n"
                    self.wfile.write(chunk.encode())
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            self.close_connection = True

    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--shell", default=None, help="shell to run (default: pwsh if installed, else $SHELL)")
    ap.add_argument("--cwd", default=os.path.expanduser("~"))
    ap.add_argument("--no-open", action="store_true", help="don't try to open the browser")
    args = ap.parse_args()

    app = App(secrets.token_urlsafe(16), args.shell or default_shell(), args.cwd, args.port)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(app))
    srv.daemon_threads = True
    url = "http://127.0.0.1:%d/?t=%s" % (args.port, app.token)
    print("AR Terminal (web)\n  shell: %s\n  open : %s\n  (Ctrl+C to stop)" % (app.shell, url), flush=True)
    if not args.no_open:
        for opener in ("termux-open-url", "xdg-open", "open"):
            if shutil.which(opener):
                subprocess.Popen([opener, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                break
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        for s in app.sessions.values():
            s.kill()


if __name__ == "__main__":
    main()
