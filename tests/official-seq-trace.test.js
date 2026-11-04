const assert=require('node:assert/strict');
const {parse}=require('../engine/official-seq-trace');
const log=`Y86-64 Processor: seq-full.hcl
20 bytes of code read
IF: Fetched irmovq at 0x0.  ra=----, rb=%rax, valC = 0x1
IF: Fetched call at 0xa.  ra=----, rb=----, valC = 0x20
Wrote 0x13 to address 0xf8
2 instructions executed
Status = AOK
Condition Codes: Z=0 S=0 O=0
Changed Register State:
%rax:\t0x0000000000000000\t0x0000000000000001
Changed Memory State:
0x00f8:\t0x0000000000000000\t0x0000000000000013
ISA Register != Pipeline Register File
%rax:\t0x0000000000000002\t0x0000000000000001
ISA Check Fails
`;
const result=parse(log);
assert.equal(result.producer,'seq-full.hcl');
assert.equal(result.frames.length,2);
assert.deepEqual(result.frames[1].events,['Wrote 0x13 to address 0xf8']);
assert.equal(result.count,2);assert.equal(result.status,'AOK');assert.equal(result.isa,'Fails');
assert.match(result.changes.memory,/0x00f8/);assert.doesNotMatch(result.changes.memory,/ISA Register|%rax/);
assert.throws(()=>parse('not a trace'));
assert.throws(()=>parse('x'.repeat(262145)));
const snapshots=[{count:1,status:'AOK',cc:'Z=1 S=0 O=0',registers:'%rax:\t0x0\t0x1',memory:''},{count:2,status:'AOK',cc:'Z=0 S=0 O=0',registers:'%rax:\t0x0\t0x1',memory:'0xf8:\t0x0\t0x13'}];
const bundle={format:'open3d-seq-snapshots-v1',trace:log,snapshots};
assert.equal(parse(JSON.stringify(bundle)).frames[1].snapshot.memory,snapshots[1].memory);
assert.throws(()=>parse(JSON.stringify({...bundle,snapshots:[snapshots[0]]})),/数量/);
assert.throws(()=>parse(JSON.stringify({...bundle,snapshots:[snapshots[0],{...snapshots[1],count:9}]})),/内容/);
console.log('官方 SEQ 轨迹：取指、内存事件、结束状态与结果边界通过');
