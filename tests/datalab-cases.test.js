const assert=require('node:assert/strict');
const D=require('../labs/datalab-cases');
assert.equal(D.tasks.length,13);
assert.equal(D.tasks.reduce((n,t)=>n+t.pts,0),100);
for(const t of D.tasks){
  const b=D.buildSource(t.id,t.starter);
  assert.ok(b.source.includes('CARESULT'),t.id);
  assert.ok(b.cases>0,t.id);
}
assert.equal(D.buildSource('bitXor','int bitXor(int x,int y){return 2;}').cases,624);
assert.equal(D.checkRules('int bitXor(int x,int y){return ~(~(~x & y) & ~(x & ~y));}','bitXor').ok,true);
assert.equal(D.checkRules('int bitXor(int x,int y){if(x)return 0;return 2;}','bitXor').ok,false);
assert.equal(D.checkRules('int tmin(void){return 256;}','tmin').ok,false);
assert.equal(D.checkRules('unsigned floatScale2(unsigned uf){if((uf>>23)==0xFF)return uf;return uf;}','floatScale2').ok,true);
assert.equal(D.checkRules('int floatFloat2Int(unsigned uf){double d=1.0;return 0;}','floatFloat2Int').ok,false);
assert.deepEqual(D.parseOutput('CAFAIL x\nCARESULT 3 5\n'),{pass:3,total:5,fails:['CAFAIL x']});
console.log('Data Lab 测试生成、规则检查与结果解析通过');
