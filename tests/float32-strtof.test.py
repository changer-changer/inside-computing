"""Compare decimal conversion with this machine's C strtof under default rounding."""
import ctypes
import json
import random
import struct
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
lib = ctypes.CDLL(None)
lib.strtof.argtypes = [ctypes.c_char_p, ctypes.POINTER(ctypes.c_char_p)]
lib.strtof.restype = ctypes.c_float
rng = random.Random(481)
values = ['0.1', '-0', '1.000000059604644775390625',
          '1.00000005960464477539062500000000000000000000000000000001',
          '1.401298464324817070923729583289916131280e-45', '1e-1000', '1e1000']
for _ in range(2000):
    digits = ''.join(str(rng.randrange(10)) for _ in range(rng.randrange(1, 90)))
    point = rng.randrange(len(digits) + 1)
    values.append(('-' if rng.randrange(2) else '') + (digits[:point] or '0') + '.' + digits[point:] + 'e' + str(rng.randrange(-100, 101)))
js = "const f=require('./engine/float32-lab');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).map(x=>f.encodeDecimal(x).bits))));"
actual = json.loads(subprocess.check_output(['node', '-e', js], cwd=root, input=json.dumps(values).encode()))
for text, got in zip(values, actual):
    value = lib.strtof(text.encode(), None)
    expected = struct.unpack('>I', struct.pack('>f', value))[0]
    if got != expected:
        raise AssertionError((text, hex(got), hex(expected)))
print(f'binary32 十进制转换：{len(values)} 组与 C strtof 一致')
