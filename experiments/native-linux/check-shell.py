#!/usr/bin/python3
"""Run one official Shell Lab trace against the student and reference shells."""
import base64
import hashlib
import json
import os
from pathlib import Path
import resource
import signal
import subprocess
import sys
import tempfile
import threading
import time

LAB = Path('/root/CSAPP/shlab-handout')
MAX_OUTPUT = 100000
SAMPLE_INTERVAL = 0.08
MAX_SAMPLES = 80


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def limit_file():
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_OUTPUT + 1, MAX_OUTPUT + 1))


def descendants(pid):
    # Walk the guest process tree before terminating the driver, including job groups.
    parents = {}
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            line = (entry/'stat').read_text()
            parents[int(entry.name)] = int(line[line.rfind(')')+2:].split()[1])
        except (OSError, ValueError, IndexError):
            continue
    found = {pid}
    while True:
        more = {child for child, parent in parents.items() if parent in found} - found
        if not more:
            return found
        found.update(more)


def process_snapshot(root_pid, proc_root=Path('/proc')):
    records = {}
    pending = [(root_pid, None)]
    while pending:
        pid, expected_parent = pending.pop()
        if pid in records:
            continue
        entry = proc_root/str(pid)
        try:
            line = (entry/'stat').read_text()
            end = line.rfind(')')
            fields = line[end+2:].split()
            parent = int(fields[1])
            if expected_parent is not None and parent != expected_parent:
                continue
            records[pid] = {'pid':pid, 'ppid':int(fields[1]), 'pgid':int(fields[2]),
                            'state':fields[0], 'name':line[line.find('(')+1:end],
                            'start':fields[19]}
            if len(records) > 256:
                raise ValueError('进程树超过 256 个进程')
        except (FileNotFoundError, ProcessLookupError, IndexError):
            continue
        try:
            tasks = list((entry/'task').iterdir())
        except (FileNotFoundError, ProcessLookupError):
            continue
        for task in tasks:
            try:
                children = (task/'children').read_text().split()
            except FileNotFoundError:
                if task.exists():
                    raise ValueError('内核未提供进程树 children 信息')
                continue
            except ProcessLookupError:
                continue
            for child in children:
                if child.isdigit():
                    pending.append((int(child), pid))
    return [records[pid] for pid in sorted(records)]


def sample_processes(proc, stop, result):
    started = time.monotonic()
    last = None
    last_attempt = None
    try:
        while not stop.is_set():
            attempt = time.monotonic()
            result['attempts'] += 1
            if last_attempt is not None:
                result['maxGap'] = max(result['maxGap'], round(attempt - last_attempt, 3))
            last_attempt = attempt
            records = process_snapshot(proc.pid)
            signature = tuple((p['pid'],p['ppid'],p['pgid'],p['state'],p['name'],p['start']) for p in records)
            if records and signature != last:
                if len(result['frames']) >= MAX_SAMPLES:
                    result['truncated'] = True
                    return
                result['frames'].append({'seconds':round(time.monotonic()-started, 3), 'processes':records})
                last = signature
            stop.wait(SAMPLE_INTERVAL)
    except (OSError, ValueError) as error:
        result['error'] = str(error)


def run(driver, trace, shell, target):
    with target.open('wb') as output:
        proc = subprocess.Popen(['perl', str(driver), '-t', str(trace), '-s', str(shell), '-a', '-p'],
                                cwd=str(LAB), stdout=output, stderr=subprocess.STDOUT,
                                start_new_session=True, preexec_fn=limit_file)
        samples = {'interval':SAMPLE_INTERVAL, 'attempts':0, 'maxGap':0,
                   'frames':[], 'truncated':False, 'error':None}
        stop = threading.Event()
        sampler = threading.Thread(target=sample_processes, args=(proc, stop, samples), daemon=True)
        sampler.start()
        timed_out = False
        try:
            code = proc.wait(timeout=90)
        except subprocess.TimeoutExpired:
            timed_out = True
            for pid in descendants(proc.pid):
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            code = proc.wait()
        finally:
            stop.set()
            sampler.join(timeout=2)
    data = target.read_bytes()
    if len(data) > MAX_OUTPUT:
        raise ValueError('测试输出超过 100000 字节；原始输出保留在 ' + str(target))
    return {'exit': code, 'timeout': timed_out, 'output': data.decode('utf-8', errors='replace'), 'samples':samples}


def main():
    if len(sys.argv) != 2 or not sys.argv[1].isdigit() or not 1 <= int(sys.argv[1]) <= 16:
        raise ValueError('用法：/run/open3d/check-shell 测试编号（1–16）；请先在实验目录运行 make。')
    if not sys.stdout.isatty():
        raise ValueError('请在网页的 Linux 实验机终端中使用。')
    number = int(sys.argv[1])
    driver, trace, student, reference = LAB/'sdriver.pl', LAB/('trace%02d.txt' % number), LAB/'tsh', LAB/'tshref'
    for item in (driver, trace, student, reference, LAB/'myspin', LAB/'mysplit', LAB/'mystop', LAB/'myint'):
        if not item.is_file():
            raise ValueError('缺少 ' + str(item) + '；请确认材料已导入并运行 make。')
    directory = Path(tempfile.mkdtemp(prefix='open3d-shell-run.', dir='/tmp'))
    tracked = (driver, trace, student, reference, LAB/'tsh.c')
    before = {p.name: sha(p) for p in tracked if p.is_file()}
    stale = (LAB/'tsh.c').is_file() and (LAB/'tsh.c').stat().st_mtime_ns > student.stat().st_mtime_ns
    trace_text = trace.read_text(errors='replace')
    print('测试运行中；原始输出将保存至 ' + str(directory), flush=True)
    ref = run(driver, trace, reference, directory/'reference.txt')
    stu = run(driver, trace, student, directory/'student.txt')
    after = {p.name: sha(p) for p in tracked if p.is_file()}
    result = {'format':'open3d-shell-report-v1', 'traceName':trace.name,
              'trace':trace_text, 'reference':ref, 'student':stu,
              'hashes':before, 'unchanged':before == after, 'buildStale':stale, 'directory':str(directory)}
    payload = json.dumps(result, ensure_ascii=True).encode('utf-8')
    (directory/'report.json').write_bytes(payload)
    if len(payload) > 262144:
        raise ValueError('结果过大，原始输出保留在 ' + str(directory))
    sys.stdout.write('\x1b]777;open3d-shell-report;' + base64.b64encode(payload).decode('ascii') + '\x07\n')
    print('两份输出已发送；请在页面对照。进程号和运行时机可能不同，退出码不能代表通过。')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print('Shell Lab 测试未完成：' + str(error), file=sys.stderr)
        sys.exit(1)
