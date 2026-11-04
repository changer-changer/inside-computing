const assert=require('node:assert/strict');
const {assemble}=require('../engine/y86-assembler.js');
const {System64}=require('../engine/system64.js');
const source=`irmovq $0x100, %rsp
irmovq $7, %rax
pushq %rax
popq %rbx
halt`;
const m=new System64(assemble(source).bytes);
m.step();assert.equal(m.trace.pc,0n);assert.equal(m.reg[4],0x100n);assert.equal(m.trace.registers[0].after,0x100n);assert.equal(m.trace.accesses[0].type,'fetch');
m.step();m.step();assert.equal(m.u64(0xf8n),7n);assert(m.trace.accesses.some(x=>x.type==='write'&&x.address===0xf8));
m.step();assert.equal(m.reg[3],7n);assert(m.trace.accesses.some(x=>x.type==='read'&&x.address===0xf8&&x.cache.hit));
m.step();assert.equal(m.status,'HLT');assert(m.cache.hits>0);assert(m.cache.misses>0);
const invalid=new System64(Uint8Array.from([0xff]));assert.equal(invalid.step(),null);assert.equal(invalid.trace.status,'INS');assert.equal(invalid.trace.accesses[0].type,'fetch');
const boundary=new System64(Uint8Array.from([0x30]),1);assert.equal(boundary.step(),null);assert.equal(boundary.trace.status,'ADR');assert.equal(boundary.trace.accesses.length,1);
console.log('64 位教学系统：指令访问、栈读写、缓存命中、寄存器变化与异常检查通过');
