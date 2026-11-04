const assert=require('node:assert/strict');const {LinkLab}=require('../engine/link-lab');
let x=new LinkLab();assert.equal(x.step().phase,'layout');assert.equal(x.snapshot().target,0x400010n);assert.equal(x.step().phase,'resolve');let e=x.step();assert.equal(e.displacement,11n);assert.deepEqual(e.bytes,[11,0,0,0]);assert.equal(x.snapshot().site+4n+e.displacement,x.snapshot().target);assert.equal(x.step().phase,'done');
x=new LinkLab({alignment:1n});x.step();x.step();e=x.step();assert.equal(e.displacement,1n);assert.deepEqual(e.bytes,[1,0,0,0]);
x=new LinkLab({missing:true});x.step();assert.equal(x.step().error,'未定义符号 sum');assert.equal(x.snapshot().phase,1);
assert.throws(()=>new LinkLab({alignment:3n}));console.log('链接实验：段布局、符号解析、PC 相对重定位及未定义符号检查通过');
