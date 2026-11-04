const assert=require('node:assert/strict');const lab=require('../engine/architecture-copy');
// An independently written baseline implementation, used as a functional test only.
const correct=`ncopy:
 xorq %rax,%rax
 andq %rdx,%rdx
 jle done
loop:
 mrmovq (%rdi),%r8
 rmmovq %r8,(%rsi)
 andq %r8,%r8
 jle nonpositive
 irmovq $1,%r9
 addq %r9,%rax
nonpositive:
 irmovq $8,%r9
 addq %r9,%rdi
 addq %r9,%rsi
 irmovq $1,%r9
 subq %r9,%rdx
 jg loop
done:
 ret
`;
const report=lab.test(correct);assert.equal(report.passed,true);assert.equal(report.results.length,69);assert.ok(report.meanCpe>0);
const badCount=lab.test(correct.replace('addq %r9,%rax','nop'));assert.equal(badCount.passed,false);assert.equal(badCount.meanCpe,null);assert.ok(badCount.results.some(r=>r.fail.some(s=>s.includes('计数'))));
const badCopy=lab.runCase(correct.replace('rmmovq %r8,(%rsi)','nop'),3);assert.ok(badCopy.fail.some(s=>s.includes('目标数组')));
const badBoundary=lab.runCase(correct.replace('rmmovq %r8,(%rsi)','rmmovq %r8,-8(%rsi)'),1);assert.ok(badBoundary.fail.some(s=>s.includes('边界')));
const noExit=lab.runCase('ncopy: jmp ncopy',1,{maxCycles:50});assert.ok(noExit.fail.some(s=>s.includes('周期上限')));
assert.throws(()=>lab.build('ncopy: .pos 1100\nret',1),/长度/);assert.throws(()=>lab.values(257));
console.log('数组复制：69 组长度和边界数据、错误计数、复制、越界与超时检查通过');
// Snapshot data and access highlights must follow the executing machine, not an animation clock.
const {Y86Pipeline}=require('../engine/y86-pipeline');const input=lab.build(correct,4);const machine=new Y86Pipeline(input.bytes,8192);let snapshot=lab.snapshot(machine,input),reads=0,writes=0,limit=500;
assert.deepEqual(snapshot.source.map(c=>BigInt.asIntN(64,c.value)),[-1n,2n,-3n,4n]);assert.ok(snapshot.destination.every(c=>c.value===0xcdefabn));
while(machine.status==='AOK'&&limit-->0){const event=machine.step();snapshot=lab.snapshot(machine,input,event);for(const cell of [...snapshot.source,...snapshot.destination]){assert.equal(cell.value,machine.u64(cell.address));if(cell.access==='read')reads++;if(cell.access==='write')writes++;}}
assert.ok(limit>0);assert.ok(reads>=4);assert.ok(writes>=4);assert.deepEqual(snapshot.destination.map(c=>BigInt.asIntN(64,c.value)),[-1n,2n,-3n,4n]);assert.equal(snapshot.returnValue,2n);assert.equal(snapshot.status,'HLT');
