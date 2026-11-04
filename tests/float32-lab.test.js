const assert=require('node:assert/strict');
const f=require('../engine/float32-lab');
for(const [bits,kind,value] of [[0,'zero',0],[0x80000000,'zero',-0],[1,'subnormal',2**-149],[0x007fffff,'subnormal',(1-2**-23)*2**-126],[0x00800000,'normal',2**-126],[0x3f800000,'normal',1],[0x7f800000,'infinity',Infinity],[0xff800000,'infinity',-Infinity]]){
 const r=f.decode(bits);assert.equal(r.kind,kind);assert.ok(Object.is(r.value,value));
}
for(const bits of [0x7f800001,0x7fc12345,0xffc00000]){const r=f.decode(bits);assert.equal(r.kind,'nan');assert.ok(Number.isNaN(r.value));assert.equal(f.parseHex(r.hex),bits>>>0);}
assert.equal(f.encodeDecimal('0.1').bits,0x3dcccccd);assert.equal(f.encodeDecimal('1.000000059604644775390625').bits,0x3f800000);assert.equal(f.encodeDecimal('-0').bits,0x80000000);
assert.equal(f.encodeDecimal('1.00000005960464477539062500000000000000000000000000000001').bits,0x3f800001);
assert.equal(f.encodeDecimal('1e-1000').bits,0);assert.equal(f.encodeDecimal('-1e1000').bits,0xff800000);
assert.equal(f.encodeDecimal('-infinity').bits,0xff800000);
assert.equal(f.decode(0x3f800000).unbiased,0);assert.equal(f.decode(1).unbiased,-126);
for(const s of ['','0x1','0x123456789','-0000001','0xqqqqqqqq'])assert.throws(()=>f.parseHex(s));
for(const s of ['','0x1','NaN','1e','123abc'])assert.throws(()=>f.encodeDecimal(s));
let seed=0x7bd12345;for(let i=0;i<10000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=f.decode(seed);if(r.kind==='normal'||r.kind==='subnormal')assert.equal(r.value,(r.sign?-1:1)*r.significand*2**r.unbiased);}
console.log('binary32：边界、特殊值、舍入与 10000 个位模式通过');
