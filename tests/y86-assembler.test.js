const assert=require('node:assert/strict');const {assemble}=require('../engine/y86-assembler');const {Y86Subset}=require('../engine/y86-subset');
function run(source,limit=200){const out=assemble(source),m=new Y86Subset(out.bytes);let i=0;while(m.status==='AOK'&&i++<limit)m.step();assert.ok(i<limit,'program failed to halt');return {m,out};}
let {m,out}=run(`irmovq $5,%rax\nirmovq $7,%rbx\naddq %rbx,%rax\nhalt`);assert.equal(m.reg[0],12n);assert.equal(m.status,'HLT');assert.deepEqual([...out.bytes.slice(0,2)],[0x30,0xf0]);assert.equal(out.lineMap[20].line,3);
({m}=run(`irmovq $0x100,%rsp\ncall function\nhalt\nfunction: irmovq $42,%rax\nret`));assert.equal(m.reg[0],42n);assert.equal(m.reg[4],256n);assert.equal(m.status,'HLT');
({m}=run(`irmovq $0,%rax\nirmovq $4,%rcx\nirmovq $1,%rbx\nloop: addq %rcx,%rax\nsubq %rbx,%rcx\njne loop\nhalt`));assert.equal(m.reg[0],10n);
({m}=run(`irmovq $0x100,%rbx\nirmovq $-9,%rax\nrmmovq %rax, -8(%rbx)\nmrmovq -8(%rbx), %rcx\nhalt`));assert.equal(BigInt.asIntN(64,m.reg[1]),-9n);
({m}=run(`irmovq $0x100,%rsp\nirmovq $0,%rax\nirmovq $1,%rcx\nsubq %rcx,%rax\ncmovl %rcx,%rbx\npushq %rbx\npopq %rdx\nhalt`));assert.equal(m.reg[2],1n);assert.equal(m.reg[4],256n);
out=assemble(`jmp start\n.align 16\ndata: .quad 0x1122334455667788\nstart: halt\n.pos 64\n.byte -1`);assert.equal(out.labels.data,16);assert.equal(out.labels.start,24);assert.equal(out.bytes[64],255);assert.deepEqual([...out.bytes.slice(16,24)],[0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11]);
for(const input of ['irmovq $1,%bogus','jmp missing','addq %rax','foo %rax','x: halt\nx: halt','.pos 0\nhalt\n.pos 0\nhalt','.quad 0x10000000000000000'])assert.throws(()=>assemble(input));
console.log('汇编器：字节编码、标签、循环、栈、访存、伪指令与错误检查通过');
const extended=assemble('iaddq $-1,%r8\nhalt');assert.deepEqual([...extended.bytes],[0xc0,0xf8,255,255,255,255,255,255,255,255,0]);
const overflow=run('irmovq $0x7fffffffffffffff,%rax\niaddq $1,%rax\nhalt').m;assert.equal(overflow.reg[0],0x8000000000000000n);assert.equal(overflow.sf,true);assert.equal(overflow.of,true);
