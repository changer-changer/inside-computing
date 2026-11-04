const assert=require('node:assert/strict');
const A=require('../labs/attack-sim');
assert.equal(A.LEVELS.length,5);
assert.equal(A.LEVELS.reduce((n,l)=>n+l.pts,0),100);
for(const l of A.LEVELS){const r=A.run(l.id,A.referencePayload(l.id));assert.equal(r.ok,true,l.id+' reference');}
assert.equal(A.run('touch1',new Uint8Array(72)).ok,false);
assert.equal(A.run('fire2',A.referencePayload('touch1')).ok,false);
assert.equal(A.parseHex('c0 17 40 00').length,4);
assert.throws(()=>A.parseHex('zz'));
console.log('Attack 模型：5 关参考 payload、NX 拦截与 hex 解析通过');
