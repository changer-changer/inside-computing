#!/usr/bin/env python3
"""Fetch or copy the pinned Debian development image and check its digest."""
import argparse
import hashlib
from pathlib import Path
import shutil
import tempfile
from urllib.request import urlopen

HERE=Path(__file__).resolve().parent
IMAGE=HERE/'assets/debian-12-genericcloud-amd64-20261026-2643.qcow2'
URL='https://cloud.debian.org/images/cloud/bookworm/20261026-2643/debian-12-genericcloud-amd64-20261026-2643.qcow2'
SHA256='24036a8b79cbb11d809752c60f2f885b1a3b02b1d663faa0b648eb87bd7a256e'

def digest(path):
    value=hashlib.sha256()
    with path.open('rb') as src:
        for chunk in iter(lambda:src.read(1024*1024),b''):value.update(chunk)
    return value.hexdigest()

def prepare(target=IMAGE,source=None,expected=SHA256):
    target=Path(target)
    if target.is_file() and digest(target)==expected:return target
    target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent,delete=False) as tmp: staged=Path(tmp.name)
    try:
        if source:
            with Path(source).open('rb') as inp,staged.open('wb') as out:shutil.copyfileobj(inp,out,1024*1024)
        else:
            with urlopen(URL,timeout=180) as inp,staged.open('wb') as out:shutil.copyfileobj(inp,out,1024*1024)
        if digest(staged)!=expected:raise ValueError('Debian 镜像的 SHA-256 校验失败')
        staged.replace(target)
        return target
    finally: staged.unlink(missing_ok=True)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,help='已有镜像的路径');p.add_argument('--output',type=Path,default=IMAGE)
    a=p.parse_args()
    try:print('已准备镜像：'+str(prepare(a.output,a.source)))
    except (OSError,ValueError) as e:p.exit(1,'准备失败：'+str(e)+'\n')
if __name__=='__main__':main()
