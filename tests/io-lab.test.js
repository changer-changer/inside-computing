const assert=require('node:assert/strict');const {FileDescriptorLab}=require('../engine/io-lab');
let m=new FileDescriptorLab(),a=m.open(),b=m.dup(a.fd);assert.equal(a.fd,3);assert.equal(b.copy,4);assert.deepEqual(m.read(3,2).bytes,[83,89]);assert.deepEqual(m.read(4,2).bytes,[83,84]);assert.deepEqual(m.snapshot().fds.map(x=>x.offset),[4,4]);assert.equal(m.close(3).remaining,1);assert.deepEqual(m.read(4,1).bytes,[69]);assert.throws(()=>m.read(3,1));assert.equal(m.open().fd,3);
m=new FileDescriptorLab();m.open();m.open();assert.deepEqual(m.read(3,2).bytes,m.read(4,2).bytes);assert.deepEqual(m.snapshot().fds.map(x=>x.offset),[2,2]);assert.equal(m.read(3,64).after,8);assert.equal(m.read(3,2).bytes.length,0);assert.throws(()=>m.read(4,-1));
console.log('文件描述符实验：dup 共享偏移、独立打开、关闭与 EOF 检查通过');
