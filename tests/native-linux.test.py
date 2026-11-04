import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pty
import subprocess
import shutil
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('native_linux',ROOT/'experiments/native-linux/run.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class NativeLinuxTests(unittest.TestCase):
    def test_command_is_disposable_and_checks_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);app=root/'UTM.app';lib=app/'Contents/Frameworks/qemu-x86_64-softmmu.framework/qemu-x86_64-softmmu';bios=app/'Contents/Resources/qemu/bios.bin'
            for file in (lib,bios,root/'kernel',root/'initrd'):
                file.parent.mkdir(parents=True,exist_ok=True);file.touch()
            cmd=module.command(app,root/'launcher',root/'kernel',root/'initrd')
            self.assertEqual(cmd[cmd.index('-nic')+1],'none')
            self.assertNotIn('-drive',cmd)
            self.assertNotIn('-virtfs',cmd)
            self.assertEqual(cmd[-1],'console=ttyS0 rdinit=/bin/sh')
            disk=root/'disk,one.qcow2';disk.touch()
            vm=module.command(app,root/'launcher',root/'kernel',root/'initrd',disk)
            self.assertIn('-snapshot',vm);self.assertIn('file='+str(disk).replace(',',',,')+',format=qcow2,if=virtio',vm)
            self.assertEqual(vm[vm.index('-nic')+1],'none')
            persistent=module.command(app,root/'launcher',root/'kernel',root/'initrd',disk,persistent=True)
            self.assertNotIn('-snapshot',persistent)
            controlled=module.command(app,root/'launcher',root/'kernel',root/'initrd',disk,persistent=True,control_socket=root/'control,sock')
            self.assertEqual(controlled.count('-serial'),2)
            self.assertIn('path='+str(root/'control,sock').replace(',',',,'),controlled[controlled.index('-chardev')+1])
            self.assertIn('open3d.control=1',controlled[-1])
            with self.assertRaises(ValueError):module.command(app,root/'launcher',root/'kernel',root/'initrd',control_socket=root/'s')
            with self.assertRaises(ValueError):module.command(app,root/'launcher',root/'kernel',root/'initrd',persistent=True)
            network=module.command(app,root/'launcher',root/'kernel',root/'initrd',disk,True)
            self.assertEqual(network[network.index('-nic')+1],'user,model=virtio-net-pci');self.assertIn('open3d.network=1',network[-1])
            with self.assertRaises(ValueError):module.command(app,root/'launcher',root/'kernel',root/'initrd',None,True)
            (root/'kernel').unlink()
            with self.assertRaises(FileNotFoundError):module.command(app,root/'launcher',root/'kernel',root/'initrd')

    def test_image_digest_and_atomic_failure(self):
        spec=importlib.util.spec_from_file_location('native_prepare',ROOT/'experiments/native-linux/prepare.py')
        prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'input';target=root/'image';source.write_bytes(b'valid')
            expected=hashlib.sha256(b'valid').hexdigest()
            self.assertEqual(prepare.prepare(target,source,expected).read_bytes(),b'valid')
            target.write_bytes(b'existing');source.write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'校验失败'):prepare.prepare(target,source,expected)
            self.assertEqual(target.read_bytes(),b'existing')

    def test_handout_integrity_and_no_overwrite(self):
        spec=importlib.util.spec_from_file_location('lab_prepare',ROOT/'experiments/native-linux/prepare_labs.py')
        prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'source';source.mkdir();dest=root/'destination'
            entry={'file':'lab.tar','sha256':hashlib.sha256(b'official').hexdigest()}
            (source/'lab.tar').write_bytes(b'official')
            target=prepare.prepare(entry,dest,source)
            self.assertEqual(target.read_bytes(),b'official')
            target.write_bytes(b'student data')
            with self.assertRaisesRegex(ValueError,'未覆盖'):prepare.prepare(entry,dest,source)
            self.assertEqual(target.read_bytes(),b'student data')
            with self.assertRaises(ValueError):prepare.prepare({'file':'../bad.tar','sha256':'x'},dest,source)
            (source/'other.tar').write_bytes(b'incorrect')
            with self.assertRaisesRegex(ValueError,'校验失败'):prepare.prepare({'file':'other.tar','sha256':'0'*64},dest,source)
            self.assertFalse((dest/'other.tar').exists())

    def test_initrd_rejects_changed_handout(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); original_here=module.HERE
            try:
                for name in ('debian-init.sh','export-yo.sh','export-pipe-trace.sh','export-seq-trace.sh','capture-seq.py','check-shell.py',
                             'export-cache-trace.sh','cache-transpose.sh','cache-timeout.c',
                             'control-agent.sh','guest-init.sh','install-labs.sh','setup-tools.sh','prepare-archlab.sh'):
                    shutil.copyfile(original_here/name,root/name)
                (root/'labs-manifest.json').write_text(json.dumps([{'file':'lab.tar','sha256':hashlib.sha256(b'original').hexdigest()}]))
                handouts=root/'assets/lab-handouts';handouts.mkdir(parents=True)
                (handouts/'lab.tar').write_bytes(b'changed')
                base=root/'base';base.write_bytes(b'base')
                module.HERE=root
                with self.assertRaisesRegex(ValueError,'校验不符'):
                    module.build_debian_initrd(base,root/'output')
                self.assertFalse((root/'output').exists())
            finally:
                module.HERE=original_here

    def test_export_helper_requires_terminal_and_limits_size(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'example.yo'
            for name,limit in (('export-yo.sh',65536),('export-pipe-trace.sh',262144),('export-seq-trace.sh',262144),('export-cache-trace.sh',262144)):
                helper=ROOT/'experiments/native-linux'/name
                path.write_text('0x000: 00 | halt\n')
                result=subprocess.run(['/bin/sh',str(helper),str(path)],capture_output=True)
                self.assertNotEqual(result.returncode,0)
                self.assertNotIn(b'\x1b]',result.stdout)
                result=subprocess.run(['/bin/sh',str(helper),str(path.parent/'missing.yo')],capture_output=True)
                self.assertNotEqual(result.returncode,0)
                path.write_bytes(b'a'*(limit+1))
                master,slave=pty.openpty()
                try:
                    result=subprocess.run(['/bin/sh',str(helper),str(path)],stdout=slave,stderr=subprocess.PIPE)
                    self.assertNotEqual(result.returncode,0)
                finally:
                    os.close(master);os.close(slave)

    def test_cache_transpose_rejects_invalid_arguments(self):
        helper=ROOT/'experiments/native-linux/cache-transpose.sh'
        for args in ([],['0','32'],['32','257'],['32','32','119'],['32','32','nope']):
            result=subprocess.run(['/bin/sh',str(helper),*args],capture_output=True)
            self.assertEqual(result.returncode,2)

    def test_shell_process_snapshot_only_contains_descendants(self):
        spec=importlib.util.spec_from_file_location('check_shell',ROOT/'experiments/native-linux/check-shell.py')
        helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            def record(pid,name,state,ppid,pgid,start):
                folder=root/str(pid);folder.mkdir()
                fields=[state,str(ppid),str(pgid)]+['0']*16+[str(start)]
                (folder/'stat').write_text(f'{pid} ({name}) '+' '.join(fields))
                task=folder/'task'/str(pid);task.mkdir(parents=True)
                (task/'children').write_text('')
            record(100,'driver','S',1,100,11)
            record(101,'shell','S',100,100,12)
            record(102,'a (job)','T',101,102,13)
            record(200,'other','R',1,200,14)
            (root/'100/task/100/children').write_text('101 300')
            other_thread=root/'101/task/111';other_thread.mkdir()
            (other_thread/'children').write_text('102')
            (root/'300').mkdir()  # process vanished during inspection
            got=helper.process_snapshot(100,root)
            self.assertEqual([p['pid'] for p in got],[100,101,102])
            self.assertEqual((got[2]['name'],got[2]['state'],got[2]['pgid'],got[2]['start']),('a (job)','T',102,'13'))
            (other_thread/'children').unlink()
            with self.assertRaisesRegex(ValueError,'children'):
                helper.process_snapshot(100,root)

if __name__=='__main__': unittest.main()
