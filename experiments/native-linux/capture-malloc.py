#!/usr/bin/python3
"""Instrument the official malloc driver for one bounded correctness pass."""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

LAB = Path('/root/CSAPP/malloclab-handout')
SOURCE = Path('/run/open3d/malloc-observer.c')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if len(sys.argv) != 2 or not sys.stdout.isatty():
        raise ValueError('请在网页实验机终端运行：/run/open3d/capture-malloc 轨迹文件.rep')
    trace = Path(sys.argv[1]).resolve()
    if not trace.is_file() or trace.stat().st_size > 262144:
        raise ValueError('轨迹不存在或超过 256 KiB')
    raw = trace.read_bytes()
    lines = raw.decode('utf-8').splitlines()
    if len(lines) < 4 or not all(x.strip().isdigit() for x in lines[:4]):
        raise ValueError('轨迹头部无效')
    count = int(lines[2]); instructions = []
    for line in lines[4:]:
        part=line.split()
        if not part: continue
        if part[0] not in ('a','r','f') or len(part)!=(2 if part[0]=='f' else 3) or not all(x.isdigit() for x in part[1:]):
            raise ValueError('轨迹操作格式无效')
        instructions.append({'op':{'a':'alloc','r':'realloc','f':'free'}[part[0]],'id':int(part[1]),'size':int(part[2]) if len(part)==3 else 0})
    if count != len(instructions) or not 1 <= count <= 512:
        raise ValueError('轨迹须包含 1–512 条操作，且与头部数量一致')
    if any(item['id']>=int(lines[1]) or item['size']>20*1024*1024 for item in instructions):
        raise ValueError('轨迹编号或大小超出范围')
    source_files = ['mdriver.c','mm.c','memlib.c','fsecs.c','fcyc.c','clock.c','ftimer.c']
    headers = ['mm.h','memlib.h','config.h','fsecs.h','fcyc.h','clock.h','ftimer.h']
    for name in source_files+headers:
        if not (LAB/name).is_file(): raise ValueError('缺少文件：'+name)
    directory = Path(tempfile.mkdtemp(prefix='open3d-malloc-run.',dir='/tmp'))
    for name in source_files+headers: shutil.copy2(LAB/name,directory/name)
    shutil.copy2(SOURCE,directory/'observer.c')
    (directory/'trace.rep').write_bytes(raw)
    hashes={'mm.c':digest(directory/'mm.c'),'trace':hashlib.sha256(raw).hexdigest(),'mdriver.c':digest(directory/'mdriver.c')}
    compile_log=directory/'build.log';events_file=directory/'events.jsonl';output_file=directory/'driver.log'
    cmd=['gcc','-Wall','-O2','-m32',*source_files,'observer.c','-Wl,--wrap=mm_init,--wrap=mm_malloc,--wrap=mm_free,--wrap=mm_realloc','-o','mdriver-view']
    print('正在编译并运行官方检查路径；原始记录：'+str(directory),flush=True)
    with compile_log.open('wb') as log:
        build=subprocess.run(cmd,cwd=directory,stdout=log,stderr=subprocess.STDOUT,timeout=120)
    if build.returncode: raise ValueError('编译失败，请查看 '+str(compile_log))
    env=os.environ.copy();env['OPEN3D_MALLOC_EVENTS']=str(events_file)
    with output_file.open('wb') as log:
        result=subprocess.run([str(directory/'mdriver-view'),'-V','-f','trace.rep'],cwd=directory,stdout=log,stderr=subprocess.STDOUT,env=env,timeout=120)
    if not events_file.is_file(): raise ValueError('未记录到分配器调用，请查看 '+str(output_file))
    events=[json.loads(line) for line in events_file.read_text().splitlines()]
    if not events or events[0].get('op')!='init': raise ValueError('初始化记录缺失')
    calls=events[1:]
    if len(calls)>len(instructions) or any(event.get('op')!=op['op'] or (op['op']!='free' and event.get('size')!=op['size']) for event,op in zip(calls,instructions)):
        raise ValueError('调用记录与轨迹不一致，已停止导入')
    report={'format':'open3d-malloc-trace-v1','trace':trace.name,'hashes':hashes,'directory':str(directory),
            'driverExit':result.returncode,'validityComplete':result.returncode==86 and len(calls)==len(instructions),
            'instructions':instructions,'events':events,'log':output_file.read_text(errors='replace')[:30000]}
    payload=json.dumps(report,ensure_ascii=True).encode()
    (directory/'report.json').write_bytes(payload)
    if len(payload)>262144: raise ValueError('记录超过 256 KiB，请使用较短轨迹')
    sys.stdout.write('\x1b]777;open3d-malloc-trace;'+base64.b64encode(payload).decode('ascii')+'\x07\n')
    print('调用记录已保存在 '+str(directory/'report.json')+'；可视化接入尚在开发。插桩检查不提供官方性能评分。')


if __name__=='__main__':
    try: main()
    except (OSError,ValueError,UnicodeError,subprocess.TimeoutExpired) as error:
        print('Malloc Lab 记录未完成：'+str(error),file=sys.stderr);sys.exit(1)
