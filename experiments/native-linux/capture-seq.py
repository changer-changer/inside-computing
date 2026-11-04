#!/usr/bin/python3
"""Capture bounded, independently checked prefixes from a student's official SEQ."""
import base64
import json
import re
import subprocess
import sys

LIMIT_BYTES = 262144
FETCH = re.compile(r'^IF: Fetched .*$', re.M)
SUMMARY = re.compile(r'^(\d+) instructions executed\s*\nStatus = ([A-Z]+)\s*\nCondition Codes:\s*(Z=[01] S=[01] O=[01])\s*\nChanged Register State:\s*\n([\s\S]*?)^Changed Memory State:\s*\n([\s\S]*?)(?=^ISA (?:Check|Register|Cond\.|Memory)|\Z)', re.M)


def run(simulator, program, limit, compare=False):
    command = [simulator, '-v', '2', '-l', str(limit)]
    if compare:
        command.append('-t')
    result = subprocess.run(command + [program], stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=60, check=False)
    if result.returncode != 0 or len(result.stdout) > LIMIT_BYTES:
        raise ValueError('模拟器执行失败或输出过大')
    return result.stdout.decode('utf-8', errors='strict')


def main():
    if len(sys.argv) not in (3, 4):
        raise ValueError('用法：/run/open3d/capture-seq 模拟器路径 程序.yo [最多指令数，1–64]')
    if not sys.stdout.isatty():
        raise ValueError('请在网页的 Linux 实验机终端中使用。')
    simulator, program = sys.argv[1:3]
    limit = int(sys.argv[3]) if len(sys.argv) == 4 else 32
    if not 1 <= limit <= 64:
        raise ValueError('指令数必须在 1–64 之间。')
    full = run(simulator, program, limit, compare=True)
    fetches = FETCH.findall(full)
    full_summary = SUMMARY.search(full)
    if not fetches or len(fetches) > limit or not full_summary or int(full_summary[1]) != len(fetches):
        raise ValueError('没有找到有效的取指记录。')
    snapshots = []
    for n in range(1, len(fetches) + 1):
        trace = run(simulator, program, n)
        match = SUMMARY.search(trace)
        if (FETCH.findall(trace) != fetches[:n] or not match or int(match[1]) != n
                or (n < len(fetches) and match[2] != 'AOK')
                or (n == len(fetches) and match.groups() != full_summary.groups())):
            raise ValueError('重复执行的取指或状态不一致，已停止生成。')
        snapshots.append({'count': n, 'status': match[2], 'cc': match[3],
                          'registers': match[4].strip(), 'memory': match[5].strip()})
    payload = json.dumps({'format': 'open3d-seq-snapshots-v1', 'trace': full,
                          'snapshots': snapshots}, ensure_ascii=True).encode('utf-8')
    if len(payload) > LIMIT_BYTES:
        raise ValueError('快照文件过大，请减少指令数。')
    sys.stdout.write('\x1b]777;open3d-seq-trace;' + base64.b64encode(payload).decode('ascii') + '\x07\n')
    print('轨迹与逐步快照已发送；请在页面中选择是否回放。')


if __name__ == '__main__':
    try:
        main()
    except (OSError, UnicodeError, ValueError, subprocess.TimeoutExpired) as error:
        print('无法生成 SEQ 快照：' + str(error), file=sys.stderr)
        sys.exit(1)
