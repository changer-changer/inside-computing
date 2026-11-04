#!/usr/bin/env python3
"""Retrieve pinned CS:APP self-study handouts without redistributing or unpacking them."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
ASSETS = HERE / 'assets/lab-handouts'
BASE_URL = 'https://csapp.cs.cmu.edu/3e/'


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def prepare(entry, destination=ASSETS, source=None):
    name = entry['file']
    if Path(name).name != name or not name.endswith('.tar'):
        raise ValueError('无效的材料名称')
    expected = entry['sha256']
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / name
    if target.exists():
        if target.is_file() and digest(target) == expected:
            return target
        raise ValueError('已有文件校验不符，未覆盖：' + str(target))
    with tempfile.NamedTemporaryFile(dir=destination, delete=False) as out:
        staged = Path(out.name)
        try:
            if source is not None:
                with (Path(source) / name).open('rb') as stream:
                    shutil.copyfileobj(stream, out)
            else:
                with urlopen(BASE_URL + name, timeout=180) as stream:
                    shutil.copyfileobj(stream, out)
        except Exception:
            staged.unlink(missing_ok=True)
            raise
    try:
        if digest(staged) != expected:
            raise ValueError('材料校验失败：' + name)
        # Never replace a file that appeared while the download was in progress.
        os.link(staged, target)
        return target
    finally:
        staged.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='已有官方材料压缩包的目录')
    parser.add_argument('files', nargs='*', help='可选材料文件名；不指定时准备全部')
    args = parser.parse_args()
    entries = json.loads((HERE / 'labs-manifest.json').read_text())
    by_name = {item['file']: item for item in entries}
    for name in args.files:
        if name not in by_name:
            parser.error('未知材料：' + name)
    try:
        for name in args.files or by_name:
            print('准备 ' + name, flush=True)
            prepare(by_name[name], source=args.source)
        print('材料已校验；重新连接实验机后运行 /run/open3d/install-labs 导入。')
    except (OSError, ValueError) as error:
        parser.exit(1, '准备失败：' + str(error) + '\n')


if __name__ == '__main__':
    main()
