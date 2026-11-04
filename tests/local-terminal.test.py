import importlib.util
import json
import os
import pathlib
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

path = pathlib.Path(__file__).resolve().parents[1] / 'server' / 'local_terminal.py'
spec = importlib.util.spec_from_file_location('local_terminal', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.TOKEN = 'integration-test-token'

class TerminalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = module.Server(('127.0.0.1', 0), module.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:%d' % cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        module.terminal.close()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path, data=None, token='integration-test-token', origin=None):
        headers = {'X-Terminal-Token': token}
        if origin: headers['Origin'] = origin
        body = None
        if data is not None:
            headers['Content-Type'] = 'application/json'
            body = json.dumps(data).encode()
        req = urllib.request.Request(self.url + '/api/terminal/' + path, body, headers)
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.load(r)

    def test_terminal_mode_validation(self):
        with self.assertRaises(urllib.error.HTTPError) as invalid:
            self.request('start', {'kind':'unknown'})
        self.assertEqual(invalid.exception.code, 400)
        saved = module.os.environ.get('OPEN3D_UTM_APP')
        module.os.environ['OPEN3D_UTM_APP'] = '/nonexistent/open3d-test-utm'
        try:
            with self.assertRaises(urllib.error.HTTPError) as missing:
                self.request('start', {'kind':'linux'})
            self.assertEqual(missing.exception.code, 400)
            self.assertIn('尚未准备',missing.exception.read().decode('utf8'))
        finally:
            if saved is None: module.os.environ.pop('OPEN3D_UTM_APP',None)
            else: module.os.environ['OPEN3D_UTM_APP']=saved

    def test_private_vm_assets_are_not_served(self):
        for method in ('GET', 'HEAD'):
            req=urllib.request.Request(self.url+'/experiments/native-linux/assets/student-workspace.qcow2',method=method)
            with self.assertRaises(urllib.error.HTTPError) as denied:
                urllib.request.urlopen(req,timeout=5)
            self.assertEqual(denied.exception.code,404)

    def test_utf8_split_across_reads(self):
        terminal=module.Terminal()
        read_fd,write_fd=os.pipe()
        os.set_blocking(read_fd,False)
        terminal.fd=read_fd
        try:
            encoded='学习'.encode('utf8')
            os.write(write_fd,encoded[:2])
            self.assertEqual(terminal.read(),'')
            os.write(write_fd,encoded[2:])
            self.assertEqual(terminal.read(),'学习')
        finally:
            os.close(write_fd)
            terminal.close()

    def test_guest_close_requires_sync_acknowledgement(self):
        for reply,success in ((b'OK\n',True),(b'ERROR\n',False)):
            with tempfile.TemporaryDirectory(prefix='o3d-test-',dir='/tmp') as directory:
                endpoint=pathlib.Path(directory)/'s'
                listener=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
                listener.bind(str(endpoint));listener.listen(1)
                received=[]
                def respond():
                    with listener.accept()[0] as connection:
                        received.append(connection.recv(32));connection.sendall(reply)
                worker=threading.Thread(target=respond);worker.start()
                terminal=module.Terminal();read_fd,write_fd=os.pipe()
                terminal.fd=read_fd;terminal.kind='linux';terminal.control_socket=endpoint
                try:
                    if success:
                        terminal.close();self.assertIsNone(terminal.fd)
                    else:
                        with self.assertRaisesRegex(ValueError,'连接仍保留'):terminal.close()
                        self.assertEqual(terminal.fd,read_fd)
                    worker.join(3);self.assertEqual(received,[b'SYNC\n'])
                finally:
                    terminal.kind='host';terminal.close();os.close(write_fd);listener.close();worker.join(3)

    def test_real_shell_and_access_controls(self):
        with self.assertRaises(urllib.error.HTTPError) as err:
            self.request('start', {}, token='wrong')
        self.assertEqual(err.exception.code, 403)
        with self.assertRaises(urllib.error.HTTPError) as err:
            self.request('start', {}, origin='https://attacker.invalid')
        self.assertEqual(err.exception.code, 403)
        self.request('start', {}, origin=self.url)
        self.request('write', {'input': "cd /tmp\nprintf 'shell-check-123' | tr a-z A-Z\npwd\nstty size\n"}, origin=self.url)
        output = ''
        for _ in range(50):
            output += self.request('read')['output']
            if 'SHELL-CHECK-123' in output and '/tmp' in output and '24 80' in output: break
            time.sleep(.1)
        self.assertIn('SHELL-CHECK-123', output)
        self.assertIn('/tmp', output)
        self.assertIn('24 80', output)
        self.request('close', {}, origin=self.url)

if __name__ == '__main__': unittest.main()
