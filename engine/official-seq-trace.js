/* Read logged SEQ fetches and events without inventing intermediate state. */
(function(root){'use strict';
 function parse(source){
  if(typeof source!=='string'||source.length>262144)throw Error('轨迹文件过大或无效');
  let snapshots=null;
  if(source.trimStart().startsWith('{')){
   let bundle;try{bundle=JSON.parse(source);}catch{throw Error('SEQ 快照格式无效');}
   if(!bundle||bundle.format!=='open3d-seq-snapshots-v1'||typeof bundle.trace!=='string'||!Array.isArray(bundle.snapshots)||bundle.snapshots.length>64)throw Error('SEQ 快照格式无效');
   snapshots=bundle.snapshots;source=bundle.trace;
  }
  const header=/^IF: Fetched ([^\r\n]+?) at (0x[0-9a-f]+)\.\s*(.*)$/gim;
  const matches=[...source.matchAll(header)];
  if(!matches.length||matches.length>1500)throw Error('没有找到有效的官方 SEQ 取指记录');
  const frames=matches.map((match,i)=>{
   const rest=source.slice(match.index+match[0].length,matches[i+1]?.index??source.length);
   const beforeSummary=rest.split(/^\d+ instructions executed\s*$/m)[0];
   return {instruction:match[1].trim(),pc:match[2],fetchDetails:match[3].trim(),events:beforeSummary.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)};
  });
  const producer=source.match(/^Y86-64 Processor: ([^\r\n]{1,160})\s*$/m);
  const count=source.match(/^(\d+) instructions executed\s*$/m);
  const status=source.match(/^Status = ([A-Z]+)\s*$/m);
  const cc=source.match(/^Condition Codes:\s*(Z=[01] S=[01] O=[01])\s*$/m);
  const diff=source.match(/^Changed Register State:\s*\n([\s\S]*?)^Changed Memory State:\s*\n([\s\S]*?)(?=^ISA (?:Check|Register|Cond\.|Memory)|$(?![\s\S]))/m);
  const isa=source.match(/^ISA Check (Succeeds|Fails)\s*$/m);
  if(snapshots){
   if(snapshots.length!==frames.length)throw Error('SEQ 快照数量不一致');
   snapshots.forEach((snapshot,i)=>{
    if(!snapshot||snapshot.count!==i+1||!/^[A-Z]+$/.test(snapshot.status)||!/^Z=[01] S=[01] O=[01]$/.test(snapshot.cc)||typeof snapshot.registers!=='string'||typeof snapshot.memory!=='string')throw Error('SEQ 快照内容无效');
    frames[i].snapshot=snapshot;
   });
  }
  return {frames,producer:producer?producer[1].trim():null,count:count?Number(count[1]):null,status:status?status[1]:null,cc:cc?cc[1]:null,changes:diff?{registers:diff[1].trim(),memory:diff[2].trim()}:null,isa:isa?isa[1]:null};
 }
 const api={parse};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OfficialSeqTrace=api;
})(typeof window==='undefined'?globalThis:window);
