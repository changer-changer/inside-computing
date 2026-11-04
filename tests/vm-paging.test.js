const assert=require('node:assert/strict');const {VMPaging}=require('../engine/vm-paging');
const vm=new VMPaging();
let r=vm.access(0x05);assert.deepEqual([r.vpn,r.offset,r.frame,r.physical,r.value,r.tlbHit,r.fault],[0,5,2,37,5,false,null]);
r=vm.access(0x06);assert.equal(r.tlbHit,true);assert.equal(r.physical,38);
r=vm.access(0x15,'write',99);assert.equal(r.fault,'not-present');assert.equal(r.physical,null);
assert.deepEqual(vm.resolveFault(),{vpn:1,frame:1,evicted:null,writeback:false,tlbInvalidated:false});
r=vm.access(0x15,'write',99);assert.equal(r.tlbHit,false);assert.equal(r.value,99);assert.equal(vm.access(0x15).value,99);
assert.equal(vm.access(0xf5).fault,'unmapped');assert.throws(()=>vm.resolveFault());
for(const address of [0x35,0x45,0x55]){assert.equal(vm.access(address).fault,'not-present');vm.resolveFault();vm.access(address);}
assert.equal(vm.access(0x55,'write',9).fault,'protection');assert.equal(vm.access(0x55).value,0x55);
assert.equal(vm.access(0x25).fault,'not-present');const eviction=vm.resolveFault();assert.equal(eviction.evicted,1);assert.equal(eviction.writeback,true);
assert.equal(vm.snapshot().tlb.some(e=>e.vpn===1),false);
assert.equal(vm.access(0x15).fault,'not-present');vm.resolveFault();assert.equal(vm.access(0x15).value,99);
assert.throws(()=>vm.access(256));assert.throws(()=>vm.access(1,'write',256));
const lru=new VMPaging();lru.access(0x05);lru.access(0x25);lru.access(0x06);lru.access(0x15);lru.resolveFault();r=lru.access(0x15);assert.equal(r.tlbEvicted,2);assert.deepEqual(lru.snapshot().tlb.map(x=>x.vpn),[0,1]);
const invalidate=new VMPaging();invalidate.access(0x25);for(const a of [0x15,0x35]){invalidate.access(a);invalidate.resolveFault();}invalidate.access(0x45);const remap=invalidate.resolveFault();assert.equal(remap.evicted,2);assert.equal(remap.tlbInvalidated,true);assert.equal(invalidate.snapshot().tlb.some(e=>e.vpn===2),false);
const randomVm=new VMPaging(),oracle=Uint8Array.from({length:96},(_,i)=>i);let seed=0x9142;
for(let i=0;i<2000;i++){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const addr=seed%96;
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const write=(seed&2)!==0,value=(seed>>>8)&255;
 let out=randomVm.access(addr,write?'write':'read',value);
 if(out.fault==='not-present'){randomVm.resolveFault();out=randomVm.access(addr,write?'write':'read',value);}
 if(write&&addr>=80){assert.equal(out.fault,'protection');continue;}
 assert.equal(out.fault,null);if(write)oracle[addr]=value;assert.equal(out.value,oracle[addr]);
 const state=randomVm.snapshot();assert.equal(new Set(state.tlb.map(e=>e.vpn)).size,state.tlb.length);for(const e of state.tlb)assert.equal(state.frames[e.frame].vpn,e.vpn);
}
console.log('分页模型：TLB LRU、缺页重试、保护、FIFO 置换与脏页回写通过');
