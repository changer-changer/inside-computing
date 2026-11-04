#!/usr/bin/env python3
"""Fetch pinned prototype assets; never unpack untrusted archive paths."""
import argparse
import hashlib
import json
import shutil
import tarfile
import tempfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE / 'assets'
MEMBERS = {
    'xterm-5.3.0.tgz': {'package/lib/xterm.js': 'xterm/xterm.js', 'package/css/xterm.css': 'xterm/xterm.css', 'package/LICENSE': 'xterm/LICENSE'},
    'xterm-pty-0.12.0.tgz': {'package/index.js': 'pty/index.js', 'package/LICENSE.txt': 'pty/LICENSE.txt'},
}

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, help='directory with previously downloaded assets')
    args = parser.parse_args()
    ASSETS.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((HERE / 'assets-manifest.json').read_text())
    for entry in manifest:
        target = ASSETS / entry['file']
        if target.exists() and digest(target) == entry['sha256']:
            continue
        print('准备 ' + entry['file'], flush=True)
        with tempfile.NamedTemporaryFile(dir=ASSETS, delete=False) as tmp:
            temp = Path(tmp.name)
        try:
            if args.source:
                shutil.copyfile(args.source / entry['file'], temp)
            else:
                with urllib.request.urlopen(entry['url'], timeout=180) as response, temp.open('wb') as dest:
                    shutil.copyfileobj(response, dest)
            if digest(temp) != entry['sha256']:
                raise RuntimeError('校验失败：' + entry['file'])
            temp.replace(target)
        finally:
            temp.unlink(missing_ok=True)
    for archive, members in MEMBERS.items():
        with tarfile.open(ASSETS / archive, 'r:gz') as source:
            for name, destination in members.items():
                member = source.getmember(name)
                if not member.isfile() or member.size > 2_000_000:
                    raise RuntimeError('包内容无效：' + name)
                dest = ASSETS / destination
                dest.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as inp, dest.open('wb') as out:
                    shutil.copyfileobj(inp, out)
    print('已准备校验通过的试验文件。')

if __name__ == '__main__':
    main()
