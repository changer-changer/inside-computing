const assert=require('node:assert/strict');const {assemble}=require('../engine/x86-assembler');
let x=assemble('movq $5,%rax\nmovq $7,%rbx\naddq %rbx,%rax\nmovq $60,%rax\nxorq %rdi,%rdi\nsyscall');assert.deepEqual([...x.code.slice(0,10)],[0x48,0xb8,5,0,0,0,0,0,0,0]);assert.deepEqual([...x.code.slice(20,23)],[0x48,0x01,0xd8]);assert.equal(x.entry,0x401000n);assert.equal(new DataView(x.elf.buffer).getUint16(18,true),62);
x=assemble('loop: xorq %r8,%r9\njne loop');assert.deepEqual([...x.code],[0x4d,0x31,0xc1,0x0f,0x85,0xf7,0xff,0xff,0xff]);assert.throws(()=>assemble('jmp missing'));assert.throws(()=>assemble('movq $1,%r16'));assert.throws(()=>assemble('int $0x80'));
x=assemble('movq %rax, -8(%rsp)\nmovq (%r12), %r9');assert.deepEqual([...x.code],[0x48,0x89,0x84,0x24,0xf8,0xff,0xff,0xff,0x4d,0x8b,0x8c,0x24,0,0,0,0]);assert.throws(()=>assemble('movq (%rax), (%rbx)'));assert.throws(()=>assemble('movq 2147483648(%rax), %rbx'));
console.log('x86-64 汇编：REX、立即数、分支位移与 ELF 头检查通过');
