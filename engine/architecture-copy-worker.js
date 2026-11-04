/* Runs student PIPE experiments off the UI thread; the page can terminate this worker. */
importScripts('y86-assembler.js?v=20261103-copy3','y86-pipeline.js?v=20261103-hcl5','hcl-control.js?v=20261103-hcl5','architecture-copy.js?v=20261103-copy3');
self.onmessage=({data})=>{
 try{
  if(!data||typeof data.source!=='string'||data.source.length>30000)throw Error('函数源码无效或过长');
  const control=data.controlSource===null?null:Y86HCLControl.compile(data.controlSource);
  const report=ArchitectureCopy.test(data.source,{iaddq:data.iaddq===true,control,onProgress:(done,total)=>self.postMessage({type:'progress',done,total})});
  self.postMessage({type:'done',report});
 }catch(error){self.postMessage({type:'error',message:String(error?.message||error)});}
};
