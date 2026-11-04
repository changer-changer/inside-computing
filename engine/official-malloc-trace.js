/* Replay recorded allocator calls, without guessing allocator metadata or free lists. */
(function(root){'use strict';
 function parse(text){
  let report;try{report=JSON.parse(text);}catch{throw Error('记录不是有效的 JSON');}
  if(!report||report.format!=='open3d-malloc-trace-v1'||!Array.isArray(report.instructions)||!Array.isArray(report.events)||report.instructions.length<1||report.instructions.length>512||report.events.length<1||report.events.length>report.instructions.length+1)throw Error('记录格式或长度无效');
  const init=report.events[0];if(!init||init.op!=='init'||!Number.isSafeInteger(init.heap)||init.heap<0||init.heap>67108864||!Number.isInteger(init.code))throw Error('初始化记录无效');
  const frames=[{heap:init.heap,blocks:[],description:`初始化返回 ${init.code}。`,warning:init.code?'初始化失败。':''}],active=new Map();
  const validNumber=n=>Number.isSafeInteger(n)&&n>=0&&n<=67108864;
  for(let i=1;i<report.events.length;i++){
   const event=report.events[i],item=report.instructions[i-1];
   if(!item||!event||!['alloc','free','realloc'].includes(item.op)||event.op!==item.op||!validNumber(item.id)||!validNumber(item.size)||!validNumber(event.heap)||!Number.isSafeInteger(event.old)||!Number.isSafeInteger(event.ptr)||event.heap>67108864||event.size!==(item.op==='free'?0:item.size))throw Error(`第 ${i} 条调用记录无效`);
   const next=new Map(active),prior=next.get(item.id);let warning='',description='';
   if(item.op==='alloc'){
    description=`申请 #${item.id}，${item.size} 字节，返回偏移 ${event.ptr}。`;
    if(prior)warning='该编号仍在使用，无法可靠回放。';
    else if(event.ptr<0)warning='分配返回空地址或无效地址。';
    else next.set(item.id,{id:item.id,start:event.ptr,size:item.size});
   }else if(item.op==='free'){
    description=`释放 #${item.id}，原地址偏移 ${event.old}。`;
    if(!prior||prior.start!==event.old)warning='释放地址与已记录的有效载荷不一致。';else next.delete(item.id);
   }else{
    description=`调整 #${item.id} 至 ${item.size} 字节，地址偏移 ${event.old} → ${event.ptr}。`;
    if(!prior||prior.start!==event.old)warning='原地址与已记录的有效载荷不一致。';
    else if(event.ptr<0)warning='重分配返回空地址或无效地址；原载荷仍保留。';
    else next.set(item.id,{id:item.id,start:event.ptr,size:item.size});
   }
   const blocks=Array.from(next.values()).sort((a,b)=>a.start-b.start);
   if(!warning&&blocks.some((b,j)=>b.start+b.size>event.heap||(j>0&&blocks[j-1].start+blocks[j-1].size>b.start)))warning='返回范围超出堆或与其他有效载荷重叠。';
   if(!warning){active.clear();for(const b of blocks)active.set(b.id,b);}
   frames.push({heap:event.heap,blocks:Array.from(active.values()).sort((a,b)=>a.start-b.start),description,warning});
   if(warning)break;
  }
  return {trace:typeof report.trace==='string'?report.trace.slice(0,200):'',frames,recorded:report.events.length-1,total:report.instructions.length,validityComplete:report.validityComplete===true&&report.driverExit===86&&init.code===0&&report.events.length===report.instructions.length+1&&frames.length===report.events.length&&!frames.some(frame=>frame.warning),driverExit:report.driverExit,log:typeof report.log==='string'?report.log.slice(0,30000):'',hashes:report.hashes||{},directory:typeof report.directory==='string'?report.directory:''};
 }
 const api={parse};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OfficialMallocTrace=api;
})(typeof window==='undefined'?globalThis:window);
