const assert=require('node:assert/strict');
const H=require('../labs/malloc-harness');
assert.match(H.starter,/mm_malloc/);
const built=H.build(H.starter);
assert.match(built.source,/mem_sbrk/);
assert.match(built.source,/MREUSE/);
assert.match(built.source,/MRESULT/);
const output=`MFAIL reuse freed block was not reused (heap grew)
MTRACE short pass=1 util=70.57 ops=600 heap=16336 payload=11528 realloc=1
MTRACE mixed pass=1 util=82.89 ops=2500 heap=102776 payload=85193 realloc=1
MTRACE realloc pass=1 util=70.38 ops=1200 heap=100776 payload=70929 realloc=1
MTRACE small pass=1 util=60.75 ops=1000 heap=19064 payload=11581 realloc=1
MRESULT 0 0`;
const r=H.parse(output);
assert.equal(r.ok,false);
assert.equal(r.reuseOk,false);
assert.equal(r.traces.length,4);
assert.equal(r.failures.length,1);
assert.ok(r.maxUtil>82);
console.log('Malloc harness：构建、reuse 失败解析与 trace 统计通过');
