#!/usr/bin/env python3
"""Build a temporary extended PIPE from an independently obtained CS:APP simulator.

The official files are never copied into the project. The local HCL modifications
provide a reference for iaddq, not an implementation of student HCL editing.
"""
import os
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
if not os.environ.get('OPEN3D_CSAPP_SIM'):
    print('iaddq 扩展 PIPE 对照：未指定 OPEN3D_CSAPP_SIM，跳过')
    raise SystemExit(0)
sim = Path(os.environ['OPEN3D_CSAPP_SIM']).resolve()
pipe = sim / 'pipe'
source = (pipe / 'pipe-std.hcl').read_text()
replacements = [
    ("wordsig IHALT", "wordsig IIADDQ 'I_IADDQ'\nwordsig IHALT"),
    ('IOPQ, IJXX, ICALL, IRET, IPUSHQ, IPOPQ };', 'IOPQ, IJXX, ICALL, IRET, IPUSHQ, IPOPQ, IIADDQ };'),
    ('IIRMOVQ, IRMMOVQ, IMRMOVQ };', 'IIRMOVQ, IRMMOVQ, IMRMOVQ, IIADDQ };'),
    ('IIRMOVQ, IRMMOVQ, IMRMOVQ, IJXX, ICALL };', 'IIRMOVQ, IRMMOVQ, IMRMOVQ, IJXX, ICALL, IIADDQ };'),
    ('D_icode in { IOPQ, IRMMOVQ, IMRMOVQ  }', 'D_icode in { IOPQ, IRMMOVQ, IMRMOVQ, IIADDQ  }'),
    ('D_icode in { IRRMOVQ, IIRMOVQ, IOPQ}', 'D_icode in { IRRMOVQ, IIRMOVQ, IOPQ, IIADDQ}'),
    ('E_icode in { IIRMOVQ, IRMMOVQ, IMRMOVQ }', 'E_icode in { IIRMOVQ, IRMMOVQ, IMRMOVQ, IIADDQ }'),
    ('E_icode in { IRMMOVQ, IMRMOVQ, IOPQ, ICALL,', 'E_icode in { IRMMOVQ, IMRMOVQ, IOPQ, IIADDQ, ICALL,'),
    ('bool set_cc = E_icode == IOPQ &&', 'bool set_cc = E_icode in { IOPQ, IIADDQ } &&'),
]
for old, new in replacements:
    if source.count(old) != 1:
        raise SystemExit('无法识别参考 HCL 的预期结构：' + old)
    source = source.replace(old, new, 1)
with tempfile.TemporaryDirectory(prefix='open3d-pipe-iaddq-') as temp:
    temp = Path(temp)
    generated = subprocess.run([str(sim / 'misc/hcl2c'), '-n', 'pipe-iaddq.hcl'], input=source, text=True, capture_output=True, check=True)
    cfile, binary = temp / 'pipe-iaddq.c', temp / 'psim-iaddq'
    cfile.write_text(generated.stdout)
    subprocess.run([os.environ.get('CC', 'cc'), '-w', '-O2', '-I'+str(pipe), '-I'+str(sim / 'misc'), '-o', str(binary), str(pipe / 'psim.c'), str(cfile), str(sim / 'misc/isa.c'), '-lm'], check=True)
    env = dict(os.environ, OPEN3D_PSIM=str(binary), OPEN3D_PTEST_IADDQ='1')
    subprocess.run(['node', str(root / 'tests/y86-official-ptest.test.js')], env=env, check=True)
