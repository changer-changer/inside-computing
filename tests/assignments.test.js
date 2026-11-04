const assert=require('node:assert/strict');const {assemble}=require('../engine/y86-assembler');const {Y86Subset}=require('../engine/y86-subset');const {grade,exercises,sample}=require('../engine/assignments');const opts={assemble,Y86Subset};
const solutions={
 add:'rrmovq %rdi,%rax\naddq %rsi,%rax\nhalt',
 xor:'rrmovq %rdi,%rax\nxorq %rsi,%rax\nhalt',
 maximum:'rrmovq %rdi,%rax\nsubq %rsi,%rax\njl less\nrrmovq %rdi,%rax\nhalt\nless: rrmovq %rsi,%rax\nhalt',
 call_add:'call sum\nhalt\nsum: rrmovq %rdi,%rax\naddq %rsi,%rax\nret',
 store_load:'rmmovq %rdi,0(%rsi)\nmrmovq 0(%rsi),%rax\nhalt',
 stack_swap:'pushq %rdi\npushq %rsi\npopq %rdi\npopq %rsi\nhalt',
 array_sum:'xorq %rax,%rax\nandq %rsi,%rsi\nje end\nirmovq $8,%r8\nirmovq $1,%r9\nloop: mrmovq (%rdi),%r10\naddq %r10,%rax\naddq %r8,%rdi\nsubq %r9,%rsi\njne loop\nend: halt'
};
for(const ex of exercises){const report=grade(ex.id,solutions[ex.id],opts);assert.equal(report.passed,report.total,`${ex.id}: ${JSON.stringify(report.results)}`);}
let report=grade('add','irmovq $12,%rax\nhalt',opts);assert.ok(report.passed<report.total);report=grade('add','loop: jmp loop',opts);assert.equal(report.passed,0);assert.match(report.results[0].detail,/512/);assert.throws(()=>grade('add','invalid %rax',opts));assert.throws(()=>grade('unknown','halt',opts));
report=grade('stack_swap','rrmovq %rdi,%rax\nrrmovq %rsi,%rdi\nrrmovq %rax,%rsi\nhalt',opts);assert.equal(report.passed,0);assert.match(report.results[0].detail,/pushq/);
console.log('作业检查：七道原创题通过参考程序，错误答案、死循环及规则违规被识别');

assert.equal(sample('add').inputs[7],5n);assert.deepEqual(sample('array_sum').memory,[1n,2n,3n]);assert.throws(()=>sample('missing'));
