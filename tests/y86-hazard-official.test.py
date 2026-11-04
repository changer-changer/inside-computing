#!/usr/bin/env python3
"""Compare normal and deliberately broken PIPE stall policies to a local CS:APP simulator."""
import os
from pathlib import Path
import re
import subprocess
import tempfile

simdir=os.environ.get('OPEN3D_CSAPP_SIM')
if not simdir:
    print('暂停规则官方对照：未指定 OPEN3D_CSAPP_SIM，跳过')
    raise SystemExit(0)
sim=Path(simdir).resolve(); pipe=sim/'pipe'; root=Path(__file__).resolve().parents[1]
source=(pipe/'pipe-std.hcl').read_text()
with tempfile.TemporaryDirectory(prefix='open3d-hazard-ref-') as directory:
    for broken in (False,True):
        hcl=source
        if broken:
            for name in ('F_stall','D_stall','E_bubble'):
                hcl,n=re.subn(r'bool\s+'+name+r'\s*=.*?;', 'bool '+name+' = 0;', hcl, count=1, flags=re.S)
                if n != 1: raise RuntimeError('无法定位控制信号 '+name)
        cfile=Path(directory)/'pipe.c'; binary=Path(directory)/('psim-broken' if broken else 'psim-normal')
        result=subprocess.run([str(sim/'misc/hcl2c'),'-n','hazard-test.hcl'],input=hcl,text=True,capture_output=True,check=True);cfile.write_text(result.stdout)
        subprocess.run([os.environ.get('CC','cc'),'-w','-O2','-I'+str(pipe),'-I'+str(sim/'misc'),'-o',str(binary),str(pipe/'psim.c'),str(cfile),str(sim/'misc/isa.c'),'-lm'],check=True)
        env=dict(os.environ,OPEN3D_PSIM=str(binary),OPEN3D_BROKEN_HAZARD='1' if broken else '0')
        subprocess.run(['node',str(root/'tests/y86-hazard-reference.test.js')],env=env,check=True)
