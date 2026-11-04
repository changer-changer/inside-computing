const assert=require('node:assert/strict');const {assemble}=require('../engine/y86-assembler');const {Y86Subset}=require('../engine/y86-subset');const {Y86Pipeline}=require('../engine/y86-pipeline');
function compare(source){const {bytes}=assemble(source),a=new Y86Subset(bytes),b=new Y86Pipeline(bytes);let n=0,events=[];while(a.status==='AOK'&&n++<200)a.step();assert.ok(n<200);n=0;while(b.status==='AOK'&&n++<500)events.push(b.step());assert.ok(n<500);assert.equal(b.status,a.status);assert.deepEqual(b.reg,a.reg);assert.deepEqual(b.mem,a.mem);return events;}
compare('irmovq $5,%rax\nirmovq $7,%rbx\naddq %rbx,%rax\nhalt');
let e=compare('irmovq $0x100,%rbx\nirmovq $42,%rax\nrmmovq %rax,0(%rbx)\nmrmovq 0(%rbx),%rcx\naddq %rcx,%rax\nhalt');assert.ok(e.some(x=>x.loadUse));
e=compare('irmovq $0,%rax\nirmovq $4,%rcx\nirmovq $1,%rbx\nloop: addq %rcx,%rax\nsubq %rbx,%rcx\njne loop\nhalt');assert.ok(e.some(x=>x.branchRecovery));
e=compare('irmovq $0x100,%rsp\ncall fun\nhalt\nfun: irmovq $42,%rax\nret');assert.ok(e.some(x=>x.retStall));
compare('irmovq $0x100,%rsp\nirmovq $3,%rax\npushq %rax\npopq %rbx\nhalt');
console.log('Y86 流水线：算术转发、加载冒险、分支恢复与调用返回一致');
compare('irmovq $0x100,%rbx\nirmovq $99,%rax\nhalt\nrmmovq %rax,0(%rbx)\nhalt');
compare('irmovq $0x10000,%rbx\nmrmovq 0(%rbx),%rax\nirmovq $99,%rax\nhalt');

// Official PIPE accepts a recognized opcode even when its function nibble is outside the ISA.
const noncanonical=new Y86Pipeline(Uint8Array.from([0x6d,0x00,0x00]));
while(noncanonical.status==='AOK') noncanonical.step();
assert.equal(noncanonical.status,'HLT');assert.equal(noncanonical.reg[0],0n);assert.deepEqual(noncanonical.cc,{zf:true,sf:false,of:false});
// Exercise forwarding, load/use hazard, condition codes and signed overflow for iaddq.
const extendedSource='irmovq $0x100,%rbx\nirmovq $0x7fffffffffffffff,%rax\nrmmovq %rax,0(%rbx)\nmrmovq 0(%rbx),%rax\niaddq $1,%rax\ncmovl %rax,%rcx\niaddq $-1,%rax\nhalt';
const extBytes=assemble(extendedSource).bytes, seq=new Y86Subset(extBytes), ext=new Y86Pipeline(extBytes,4096,{iaddq:true});
while(seq.status==='AOK')seq.step();let extEvents=[];while(ext.status==='AOK')extEvents.push(ext.step());
assert.equal(ext.status,'HLT');assert.deepEqual(ext.reg,seq.reg);assert.deepEqual(ext.mem,seq.mem);assert.deepEqual(ext.cc,{zf:seq.zf,sf:seq.sf,of:seq.of});assert.ok(extEvents.some(event=>event?.loadUse));
const base=new Y86Pipeline(assemble('iaddq $1,%rax\nhalt').bytes);while(base.status==='AOK')base.step();assert.equal(base.status,'INS');
