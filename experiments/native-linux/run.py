#!/usr/bin/env python3
"""Boot a disposable x86-64 Linux development VM using a locally supplied UTM."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DEFAULT_UTM = Path('/Applications/UTM.app')

def build_debian_initrd(original, destination):
    """Append one generated newc archive; the original initramfs remains unchanged."""
    with tempfile.TemporaryDirectory(prefix='open3d-init-') as directory:
        init = Path(directory)/'init'
        init.write_bytes((HERE/'debian-init.sh').read_bytes())
        init.chmod(0o755)
        helper = Path(directory)/'open3d-export-yo'
        helper.write_bytes((HERE/'export-yo.sh').read_bytes())
        helper.chmod(0o755)
        trace_helper = Path(directory)/'open3d-export-pipe-trace'
        trace_helper.write_bytes((HERE/'export-pipe-trace.sh').read_bytes())
        trace_helper.chmod(0o755)
        cache_helper = Path(directory)/'open3d-export-cache-trace'
        cache_helper.write_bytes((HERE/'export-cache-trace.sh').read_bytes())
        cache_helper.chmod(0o755)
        seq_helper = Path(directory)/'open3d-export-seq-trace'
        seq_helper.write_bytes((HERE/'export-seq-trace.sh').read_bytes())
        seq_helper.chmod(0o755)
        capture_helper = Path(directory)/'open3d-capture-seq'
        capture_helper.write_bytes((HERE/'capture-seq.py').read_bytes())
        capture_helper.chmod(0o755)
        shell_helper = Path(directory)/'open3d-check-shell'
        shell_helper.write_bytes((HERE/'check-shell.py').read_bytes())
        shell_helper.chmod(0o755)
        for name in ('capture-malloc.py','malloc-observer.c'):
            destination_file = Path(directory)/('open3d-'+name)
            destination_file.write_bytes((HERE/name).read_bytes())
            destination_file.chmod(0o755 if name.endswith('.py') else 0o644)
        for name in ('cache-transpose.sh','cache-timeout.c','control-agent.sh','guest-init.sh','setup-tools.sh','prepare-archlab.sh'):
            destination_file = Path(directory)/('open3d-'+name)
            destination_file.write_bytes((HERE/name).read_bytes())
            destination_file.chmod(0o755 if name.endswith('.sh') else 0o644)
        installer = Path(directory)/'open3d-install-labs'
        installer.write_bytes((HERE/'install-labs.sh').read_bytes())
        installer.chmod(0o755)
        files = ['open3d-capture-malloc.py','open3d-malloc-observer.c','init','open3d-export-yo','open3d-export-pipe-trace','open3d-export-cache-trace','open3d-export-seq-trace','open3d-capture-seq','open3d-check-shell','open3d-cache-transpose.sh','open3d-cache-timeout.c','open3d-control-agent.sh','open3d-guest-init.sh','open3d-setup-tools.sh','open3d-prepare-archlab.sh','open3d-install-labs']
        # Handouts are locally acquired and pinned; never silently import a changed file.
        handouts = Path(directory)/'open3d-lab-handouts'
        handouts.mkdir()
        files.append(handouts.name)
        for entry in json.loads((HERE/'labs-manifest.json').read_text()):
            name = entry['file']
            source = HERE/'assets/lab-handouts'/name
            if not source.exists():
                continue
            if hashlib.sha256(source.read_bytes()).hexdigest() != entry['sha256']:
                raise ValueError('官方材料校验不符，未导入：'+name)
            shutil.copyfile(source, handouts/name)
            files.append('open3d-lab-handouts/'+name)
        archive = subprocess.run(['cpio','-o','--format','newc'],cwd=directory,input=('\n'.join(files)+'\n').encode(),capture_output=True,check=True).stdout
        with destination.open('wb') as output, original.open('rb') as source:
            while block := source.read(1024*1024): output.write(block)
            output.write(gzip.compress(archive,mtime=0))

def command(utm, launcher, kernel, initrd, disk=None, network=False, persistent=False, control_socket=None):
    frameworks = utm/'Contents/Frameworks'
    lib = frameworks/'qemu-x86_64-softmmu.framework/qemu-x86_64-softmmu'
    bios = utm/'Contents/Resources/qemu'
    for item in (lib,bios/'bios.bin',kernel,initrd):
        if not item.is_file(): raise FileNotFoundError(str(item))
    if network and disk is None: raise ValueError('联网试验需要指定 Debian 磁盘')
    if disk is not None and not disk.is_file(): raise FileNotFoundError(str(disk))
    cmd=[str(launcher),str(lib),'-L',str(bios),'-nographic','-m','1024M' if disk else '512M',
         '-nic','user,model=virtio-net-pci' if network else 'none']
    if persistent and disk is None: raise ValueError('持久工作区需要指定磁盘')
    if control_socket and disk is None: raise ValueError('同步通道需要指定磁盘')
    if disk is not None:
        # QEMU key-value syntax escapes commas by doubling them.
        if not persistent: cmd += ['-snapshot']
        cmd += ['-drive',f'file={str(disk).replace(",", ",,")},format=qcow2,if=virtio']
    if control_socket:
        path=str(control_socket).replace(',',',,')
        cmd += ['-chardev',f'socket,id=open3dcontrol,path={path},server=on,wait=off','-serial','mon:stdio','-serial','chardev:open3dcontrol']
    cmd += ['-kernel',str(kernel),'-initrd',str(initrd),'-append',
            ('console=ttyS0 quiet'+(' open3d.network=1' if network else '')+(' open3d.control=1' if control_socket else '')) if disk else 'console=ttyS0 rdinit=/bin/sh']
    return cmd

def prepare_workspace(utm,launcher,base,overlay):
    """Create or verify a qcow2 overlay without modifying the base image."""
    base=base.resolve();overlay=overlay.resolve()
    if base==overlay: raise ValueError('工作区文件不能与基础镜像相同')
    if not base.is_file(): raise FileNotFoundError(str(base))
    tool=utm/'Contents/Frameworks/qemu-img.framework/qemu-img'
    if not tool.is_file(): raise FileNotFoundError(str(tool))
    if not overlay.exists():
        overlay.parent.mkdir(parents=True,exist_ok=True)
        subprocess.run([str(launcher),str(tool),'create','-f','qcow2','-F','qcow2','-b',str(base),str(overlay)],check=True)
    metadata=json.loads(subprocess.check_output([str(launcher),str(tool),'info','--output=json',str(overlay)],text=True))
    backing=metadata.get('full-backing-filename') or metadata.get('backing-filename')
    if metadata.get('format')!='qcow2' or not backing or Path(backing).resolve()!=base:
        raise ValueError('工作区不是以所选镜像为基础的 qcow2 文件')
    return overlay

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--utm',type=Path,default=DEFAULT_UTM,help='UTM.app 路径')
    parser.add_argument('--kernel',type=Path,default=ROOT/'experiments/browser-linux/assets/load-kernel.data')
    parser.add_argument('--initrd',type=Path,default=ROOT/'experiments/browser-linux/assets/load-initramfs.data')
    parser.add_argument('--disk',type=Path,help='Debian 12 genericcloud amd64 qcow2；所有写入都在临时快照')
    parser.add_argument('--network',action='store_true',help='允许试验虚拟机联网；仅用于配置工具链')
    parser.add_argument('--workspace',type=Path,help='可选的持久 qcow2 工作区；基础镜像保持不变')
    parser.add_argument('--control-socket',type=Path,help='可选的本地磁盘同步通道')
    args=parser.parse_args();utm=args.utm.resolve();frameworks=utm/'Contents/Frameworks'
    if args.workspace and not args.disk: parser.error('--workspace 需要 --disk')
    try:
        with tempfile.TemporaryDirectory(prefix='open3d-native-linux-') as directory:
            launcher=Path(directory)/'qemu-launch';initrd=args.initrd.resolve()
            subprocess.run(['clang','-O2',f'-Wl,-rpath,{frameworks}',str(HERE/'launcher.c'),'-o',str(launcher)],check=True)
            if args.disk:
                generated=Path(directory)/'debian-initramfs.gz';build_debian_initrd(initrd,generated);initrd=generated
            disk=args.disk.resolve() if args.disk else None
            if args.workspace: disk=prepare_workspace(utm,launcher,disk,args.workspace)
            cmd=command(utm,launcher,args.kernel.resolve(),initrd,disk,args.network,persistent=bool(args.workspace),control_socket=args.control_socket)
            print(('启动持久工作区' if args.workspace else '启动临时 x86-64 Linux')+'；退出 QEMU 请按 Ctrl+A 后按 X。',flush=True)
            return subprocess.call(cmd)
    except (FileNotFoundError,ValueError,subprocess.CalledProcessError) as error:
        parser.exit(1,f'无法启动试验：{error}\n')

if __name__=='__main__': raise SystemExit(main())
