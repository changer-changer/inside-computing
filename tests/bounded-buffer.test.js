const assert=require('node:assert/strict');
const {BoundedBuffer}=require('../engine/bounded-buffer.js');
const b=new BoundedBuffer(2);assert.equal(b.consume().reason,'empty');assert.equal(b.produce().value,1);assert.equal(b.produce().value,2);assert.equal(b.produce().reason,'full');assert.deepEqual(b.snapshot().queue,[1,2]);assert.equal(b.consume().value,1);assert.equal(b.produce().value,3);assert.equal(b.consume().value,2);assert.equal(b.consume().value,3);assert.deepEqual(b.snapshot().consumed,[1,2,3]);assert.equal(b.snapshot().empty,2);assert.throws(()=>new BoundedBuffer(0));
console.log('有界缓冲区：满、空、FIFO 和计数通过');
