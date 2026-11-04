/* First-fit heap teaching model, 8-byte headers and alignment. */
(function(root){'use strict';
 class HeapLab{
  constructor(size=128){if(!Number.isInteger(size)||size<32||size>1024||size%8)throw Error('堆大小须为 32–1024 的 8 字节倍数');this.size=size;this.nextId=1;this.blocks=[{start:0,size,allocated:false,id:null,requested:0}];}
  alloc(requested){if(!Number.isInteger(requested)||requested<1||requested>this.size)throw Error('申请大小无效');const payload=Math.ceil(requested/8)*8,needed=payload+8,index=this.blocks.findIndex(b=>!b.allocated&&b.size>=needed);if(index<0)return {ok:false,requested,reason:'没有足够大的连续空闲块'};const block=this.blocks[index],rest=block.size-needed;if(rest>=16){this.blocks.splice(index+1,0,{start:block.start+needed,size:rest,allocated:false,id:null,requested:0});block.size=needed;}block.allocated=true;block.id=this.nextId++;block.requested=requested;return {ok:true,id:block.id,pointer:block.start+8,requested,blockSize:block.size};}
  free(id){const i=this.blocks.findIndex(b=>b.allocated&&b.id===id);if(i<0)throw Error('分配编号不存在或已经释放');let b=this.blocks[i];const released={id:b.id,start:b.start,size:b.size};b.allocated=false;b.id=null;b.requested=0;let idx=i,merged=0;if(idx>0&&!this.blocks[idx-1].allocated){this.blocks[idx-1].size+=b.size;this.blocks.splice(idx,1);idx--;b=this.blocks[idx];merged++;}if(idx+1<this.blocks.length&&!this.blocks[idx+1].allocated){b.size+=this.blocks[idx+1].size;this.blocks.splice(idx+1,1);merged++;}return {ok:true,released,merged,freeStart:b.start,freeSize:b.size};}
  snapshot(){return {size:this.size,blocks:this.blocks.map(x=>({...x})),free:this.blocks.filter(x=>!x.allocated).reduce((n,x)=>n+x.size,0)};}
 }
 const api={HeapLab};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HeapLab=HeapLab;
})(typeof window==='undefined'?globalThis:window);
