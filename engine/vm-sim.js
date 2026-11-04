/* Single-level virtual address translation, no TLB or OS fault handler. */
(function(root){'use strict';
 class VirtualMemorySim{
  constructor({pageSize=16,virtualPages=16,frames=4,mapping={0:2,2:0}}={}){
   if(!Number.isSafeInteger(pageSize)||pageSize<1||!Number.isSafeInteger(virtualPages)||virtualPages<1||!Number.isSafeInteger(frames)||frames<1)throw new Error('invalid configuration');
   this.pageSize=pageSize;this.virtualPages=virtualPages;this.frames=frames;this.table=Array(virtualPages).fill(null);
   for(const [key,frame] of Object.entries(mapping)){const vpn=Number(key);if(!Number.isInteger(vpn)||vpn<0||vpn>=virtualPages||!Number.isInteger(frame)||frame<0||frame>=frames)throw new Error('invalid mapping');this.table[vpn]=frame;}
  }
  translate(address){if(!Number.isSafeInteger(address)||address<0||address>=this.pageSize*this.virtualPages)throw new RangeError('invalid virtual address');
   const vpn=Math.floor(address/this.pageSize),offset=address%this.pageSize,frame=this.table[vpn];return {address,vpn,offset,frame,fault:frame===null,physical:frame===null?null:frame*this.pageSize+offset};}
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={VirtualMemorySim};else root.VirtualMemorySim=VirtualMemorySim;
})(typeof window==='undefined'?globalThis:window);
