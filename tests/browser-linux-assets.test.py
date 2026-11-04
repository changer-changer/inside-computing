import hashlib
import importlib.util
import json
import pathlib
import sys
import tempfile
import threading
import unittest
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

class BrowserLinuxTests(unittest.TestCase):
    def test_manifest_hash_enforced(self):
        prepare = load('vm_prepare_test', 'experiments/browser-linux/prepare.py')
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            source = base / 'source'
            source.mkdir()
            (source / 'image').write_bytes(b'good')
            manifest = [{'file': 'image', 'url': 'https://example.invalid/image', 'sha256': hashlib.sha256(b'good').hexdigest()}]
            (base / 'assets-manifest.json').write_text(json.dumps(manifest))
            prepare.HERE, prepare.ASSETS, prepare.MEMBERS = base, base / 'assets', {}
            previous = sys.argv
            try:
                sys.argv = ['prepare.py', '--source', str(source)]
                prepare.main()
                self.assertEqual((base / 'assets/image').read_bytes(), b'good')
                (base / 'assets/image').write_bytes(b'corrupt')
                (source / 'image').write_bytes(b'bad')
                with self.assertRaisesRegex(RuntimeError, '校验失败'):
                    prepare.main()
                self.assertEqual((base / 'assets/image').read_bytes(), b'corrupt')
            finally:
                sys.argv = previous

    def test_isolation_headers(self):
        serve = load('vm_server_test', 'experiments/browser-linux/serve.py')
        with tempfile.TemporaryDirectory() as directory:
            pathlib.Path(directory, 'index.html').write_text('ok')
            server = ThreadingHTTPServer(('127.0.0.1', 0), partial(serve.Handler, directory=directory))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with urllib.request.urlopen('http://127.0.0.1:%d/' % server.server_port) as response:
                    self.assertEqual(response.headers['Cross-Origin-Opener-Policy'], 'same-origin')
                    self.assertEqual(response.headers['Cross-Origin-Embedder-Policy'], 'require-corp')
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

if __name__ == '__main__': unittest.main()
