const assert=require('node:assert/strict');const {CacheSim}=require('../engine/cache-sim');
let c=new CacheSim({sets:2,ways:1,blockSize:4});let results=[0,4,0,8,0].map(x=>c.access(x));
assert.deepEqual(results.map(x=>x.hit),[false,false,true,false,false]);assert.deepEqual(results.map(x=>x.set),[0,1,0,0,0]);assert.equal(c.hits,1);assert.equal(c.misses,4);assert.equal(c.evictions,2);
c=new CacheSim({sets:1,ways:2,blockSize:1});[0,1,0,2].forEach(x=>c.access(x));assert.deepEqual(c.sets[0].map(x=>x.tag),[0,2]);assert.equal(c.evictions,1);
assert.throws(()=>c.access(-1),RangeError);assert.throws(()=>new CacheSim({sets:0}));
console.log('缓存模型：映射、命中、替换和 LRU 检查通过');
