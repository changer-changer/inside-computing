const assert=require('node:assert/strict');const {CounterLab}=require('../engine/concurrency-lab');
const run=(m,seq)=>{for(const id of seq){const event=m.step(id);assert(!event.blocked);}};
let m=new CounterLab();run(m,['A','B','A','B','A','B']);assert(m.done);assert.equal(m.value,1);assert.equal(m.trace.length,6);
m=new CounterLab();run(m,['A','A','A','B','B','B']);assert.equal(m.value,2);assert(m.done);
m=new CounterLab({locked:true});assert.equal(m.step('A').op,'lock');assert.equal(m.step('B').blocked,true);assert.equal(m.trace.length,1);run(m,['A','A','A','A','B','B','B','B','B']);assert.equal(m.value,2);assert(m.done);assert.equal(m.owner,null);
assert.throws(()=>m.step('C'));assert.equal(m.step('A').done,true);
console.log('并发实验：竞争、串行、互斥锁阻塞与释放均通过');
