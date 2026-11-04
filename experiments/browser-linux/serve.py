#!/usr/bin/env python3
"""Development server for the isolated browser VM experiment."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    if not (root / 'assets' / 'out.js').is_file():
        raise SystemExit('请先运行 python3 experiments/browser-linux/prepare.py')
    server = ThreadingHTTPServer(('127.0.0.1', 8777), partial(Handler, directory=str(root)))
    print('开发试验地址：http://127.0.0.1:8777/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
