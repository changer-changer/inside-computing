#!/usr/bin/env python3
"""Loopback-only static server with an authenticated local PTY shell."""
import argparse
import codecs
import fcntl
import hmac
import http.server
import json
import os
import pty
import secrets
import select
import shutil
import signal
import socket
import struct
import sys
import termios
import tempfile
import threading
import urllib.parse
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKEN = secrets.token_urlsafe(32)

class Terminal:
    def __init__(self):
        self.lock = threading.Lock()
        self.fd = None
        self.pid = None
        self.kind = None
        self.control_dir = None
        self.control_socket = None
        self.decoder = codecs.getincrementaldecoder('utf-8')(errors='replace')

    def start(self, kind='host'):
        with self.lock:
            if kind not in ('host','linux'):
                raise ValueError('未知终端类型')
            if self.fd is not None:
                if self.kind != kind: raise ValueError('请先断开当前终端')
                return
            if kind == 'linux':
                base = ROOT/'experiments/native-linux/assets/debian-12-genericcloud-amd64-20261026-2643.qcow2'
                local_utm = ROOT/'experiments/native-linux/assets/UTM.app'
                default_utm = local_utm if local_utm.is_dir() else Path('/Applications/UTM.app')
                utm = Path(os.environ.get('OPEN3D_UTM_APP',str(default_utm))).expanduser().resolve()
                required = [base,utm/'Contents/Frameworks/qemu-x86_64-softmmu.framework/qemu-x86_64-softmmu',ROOT/'experiments/browser-linux/assets/load-kernel.data',ROOT/'experiments/browser-linux/assets/load-initramfs.data']
                if not all(p.is_file() for p in required):
                    raise ValueError('Linux 环境尚未准备：请按 docs/学习终端.md 准备 UTM、内核和磁盘镜像')
                workspace = ROOT/'experiments/native-linux/assets/student-workspace.qcow2'
                control_dir = Path(tempfile.mkdtemp(prefix='open3d-sync-',dir='/tmp'))
                control_socket = control_dir/'control.sock'
            try:
                pid, fd = pty.fork()
            except OSError:
                if kind == 'linux': shutil.rmtree(control_dir,ignore_errors=True)
                raise
            if pid == 0:
                fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))
                os.chdir(str(ROOT))
                if kind == 'linux':
                    runner=ROOT/'experiments/native-linux/run.py'
                    os.execv(sys.executable,[sys.executable,str(runner),'--utm',str(utm),'--disk',str(base),'--workspace',str(workspace),'--control-socket',str(control_socket)])
                shell = os.environ.get('SHELL', '/bin/sh')
                if not os.path.isabs(shell) or not os.access(shell, os.X_OK):
                    shell = '/bin/sh'
                os.environ['TERM'] = 'xterm-256color'
                args = [shell, '-f', '-i'] if os.path.basename(shell) == 'zsh' else [shell, '-i']
                os.execv(shell, args)
            self.pid, self.fd, self.kind = pid, fd, kind
            if kind == 'linux': self.control_dir,self.control_socket = control_dir,control_socket
            self.decoder = codecs.getincrementaldecoder('utf-8')(errors='replace')
            os.set_blocking(fd, False)

    def write(self, data):
        with self.lock:
            if self.fd is None:
                raise ValueError('终端未连接')
            remaining = memoryview(data.encode('utf-8'))
            while remaining:
                if not select.select([], [self.fd], [], 2)[1]:
                    raise ValueError('终端输入超时')
                try:
                    written = os.write(self.fd, remaining)
                except BlockingIOError:
                    continue
                if written <= 0: raise ValueError('终端输入失败')
                remaining = remaining[written:]

    def read(self):
        with self.lock:
            if self.fd is None:
                raise ValueError('终端未连接')
            chunks = []
            for _ in range(32):
                if not select.select([self.fd], [], [], 0)[0]:
                    break
                try:
                    part = os.read(self.fd, 4096)
                except OSError:
                    part = b''
                if not part:
                    os.close(self.fd)
                    self.fd = None
                    self.kind = None
                    break
                chunks.append(part)
            return self.decoder.decode(b''.join(chunks), final=self.fd is None)

    def close(self):
        with self.lock:
            if self.kind == 'linux' and self.fd is not None:
                self.sync_guest()
            if self.fd is not None:
                os.close(self.fd)
                self.fd = None
            if self.pid:
                try:
                    os.kill(self.pid, signal.SIGHUP)
                except ProcessLookupError:
                    pass
                self.pid = None
            self.kind = None
            if self.control_dir:
                shutil.rmtree(self.control_dir,ignore_errors=True)
            self.control_dir = self.control_socket = None

    def sync_guest(self):
        if not self.control_socket:
            raise ValueError('实验机同步通道不可用，连接仍保留。请稍后重试。')
        try:
            with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as channel:
                channel.settimeout(20)
                channel.connect(str(self.control_socket))
                channel.sendall(b'SYNC\n')
                response=b''
                while not response.endswith(b'\n') and len(response)<32:
                    chunk=channel.recv(32-len(response))
                    if not chunk: break
                    response+=chunk
                if response != b'OK\n': raise OSError('同步未获得确认')
        except OSError as error:
            raise ValueError('实验机未确认磁盘同步，连接仍保留。请稍后重试。') from error

terminal = Terminal()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def allowed(self):
        expected = '127.0.0.1:%d' % self.server.server_port
        host = self.headers.get('Host', '')
        origin = self.headers.get('Origin')
        return (host == expected and (origin is None or origin == 'http://' + expected)
                and hmac.compare_digest(self.headers.get('X-Terminal-Token', ''), TOKEN))

    def reply(self, code, value):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_head(self):
        # Disk images contain private student work and must never be static files.
        target = Path(self.translate_path(self.path)).resolve()
        private = (ROOT/'experiments/native-linux/assets').resolve()
        if target == private or private in target.parents:
            self.send_error(404, 'Not found')
            return None
        return super().send_head()

    def do_GET(self):
        if urllib.parse.urlsplit(self.path).path == '/api/terminal/read':
            if not self.allowed():
                self.reply(403, {'error': '终端认证失败'})
                return
            try:
                self.reply(200, {'output': terminal.read(), 'connected': terminal.fd is not None})
            except ValueError as error:
                self.reply(400, {'error': str(error)})
            return
        super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        if path not in ('/api/terminal/start', '/api/terminal/write', '/api/terminal/close') or not self.allowed():
            self.reply(403, {'error': '终端认证失败'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 65536 or self.headers.get_content_type() != 'application/json':
                raise ValueError('请求格式无效')
            data = json.loads(self.rfile.read(length) or b'{}')
            if path.endswith('/start'):
                terminal.start(data.get('kind','host'))
            elif path.endswith('/close'):
                terminal.close()
            else:
                value = data.get('input')
                if not isinstance(value, str) or len(value.encode('utf-8')) > 16384:
                    raise ValueError('输入无效')
                terminal.write(value)
            self.reply(200, {'ok': True})
        except (ValueError, OSError, json.JSONDecodeError) as error:
            self.reply(400, {'error': str(error)})

    def log_message(self, fmt, *args):
        if not self.path.startswith('/api/terminal/'):
            super().log_message(fmt, *args)

class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    server = Server(('127.0.0.1', args.port), Handler)
    address = 'http://127.0.0.1:%d/#terminal=%s' % (server.server_port, TOKEN)
    print('计算之境已启动：本机终端仅供本机页面连接。关闭此窗口即可停止。', flush=True)
    if not args.no_browser:
        webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        terminal.close()
        server.server_close()
