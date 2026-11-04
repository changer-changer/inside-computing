const assert=require('node:assert/strict');
const B=require('../labs/buffer-sim');
assert.equal(B.LEVELS.length,5);
assert.equal(B.LEVELS.reduce((n,l)=>n+l.pts,0),60);
for(const l of B.LEVELS){const r=B.run(l.id,B.referencePayload(l.id));assert.equal(r.ok,true,l.id+' reference');}
assert.equal(B.run('smoke',new Uint8Array(36)).ok,false);
assert.equal(B.parseHex('c0 17 40 00').length,4);
assert.throws(()=>B.parseHex('zz'));
console.log('Buffer 模型：5 关参考 payload、短 payload 与 hex 解析通过');
