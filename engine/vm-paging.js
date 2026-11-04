/* Small single-process paging model: 16-byte pages, 4 frames, 2-entry LRU TLB. */
(function(root){'use strict';
 class VMPaging{
  constructor(){
   this.pageSize=16;this.pageCount=16;this.tlbCapacity=2;this.clock=0;this.tlb=[];this.fifo=[];this.pending=null;
   this.pages=Array.from({length:16},(_,vpn)=>({allocated:vpn<6,writable:vpn!==5,resident:false,frame:null,dirty:false,backing:Uint8Array.from({length:16},(_,offset)=>(vpn*16+offset)&255)}));
   this.frames=Array(4).fill(null);this._install(2,0);this._install(0,2);
  }
  _install(vpn,frame){const p=this.pages[vpn];p.frame=frame;p.resident=true;p.dirty=false;this.frames[frame]={vpn,data:p.backing.slice()};this.fifo.push(vpn);}
  _address(address){if(!Number.isInteger(address)||address<0||address>=256)throw RangeError('地址须在 0x00–0xFF 之间');return {vpn:Math.floor(address/16),offset:address%16};}
  access(address,operation='read',value=0){
   const {vpn,offset}=this._address(address);
   if(operation!=='read'&&operation!=='write')throw Error('未知操作');
   if(operation==='write'&&(!Number.isInteger(value)||value<0||value>255))throw RangeError('写入值须在 0–255 之间');
   this.pending=null;this.clock++;const page=this.pages[vpn],entry=this.tlb.find(x=>x.vpn===vpn),hit=!!entry;
   const result={address,vpn,offset,operation,tlbHit:hit,frame:null,physical:null,value:null,fault:null};
   if(hit)entry.used=this.clock;
   if(!page.allocated){result.fault='unmapped';return result;}
   if(!page.resident){result.fault='not-present';this.pending={vpn};return result;}
   if(operation==='write'&&!page.writable){result.fault='protection';return result;}
   if(!hit){if(this.tlb.length===this.tlbCapacity){const victim=this.tlb.reduce((a,b)=>a.used<b.used?a:b);this.tlb.splice(this.tlb.indexOf(victim),1);result.tlbEvicted=victim.vpn;}this.tlb.push({vpn,frame:page.frame,used:this.clock});}
   const frame=page.frame;result.frame=frame;result.physical=frame*16+offset;
   if(operation==='write'){this.frames[frame].data[offset]=value;page.dirty=true;}
   result.value=this.frames[frame].data[offset];return result;
  }
  resolveFault(){
   if(!this.pending)throw Error('没有等待处理的可装入页面');
   const vpn=this.pending.vpn,page=this.pages[vpn];if(!page.allocated||page.resident)throw Error('页面状态已变化');
   let frame=this.frames.findIndex(x=>x===null),evicted=null,writeback=false,tlbInvalidated=false;
   if(frame<0){evicted=this.fifo.shift();const old=this.pages[evicted];frame=old.frame;writeback=old.dirty;if(writeback)old.backing=this.frames[frame].data.slice();old.resident=false;old.frame=null;old.dirty=false;tlbInvalidated=this.tlb.some(entry=>entry.vpn===evicted);this.tlb=this.tlb.filter(entry=>entry.vpn!==evicted);}
   this._install(vpn,frame);this.pending=null;return {vpn,frame,evicted,writeback,tlbInvalidated};
  }
  snapshot(){return {tlb:this.tlb.map(x=>({vpn:x.vpn,frame:x.frame})),frames:this.frames.map((f,frame)=>f?{frame,vpn:f.vpn,dirty:this.pages[f.vpn].dirty}:null),pending:this.pending?{...this.pending}:null};}
 }
 const api={VMPaging};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VMPaging=VMPaging;
})(typeof window==='undefined'?globalThis:window);
