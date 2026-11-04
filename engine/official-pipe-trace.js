/* Parse bounded psim -v 2 output. Never execute or infer a missing machine state. */
(function(root){'use strict';
 function parse(source){
  if(typeof source!=='string'||source.length>262144)throw Error('轨迹文件过大或无效');
  const header=/^Cycle (\d+)\. CC=(Z=[01] S=[01] O=[01]), Stat=([A-Z]+)\s*$/gm;
  const matches=[...source.matchAll(header)];
  if(!matches.length||matches.length>1500)throw Error('没有找到有效的官方 PIPE 周期记录');
  const frames=[];
  for(let i=0;i<matches.length;i++){
   const m=matches[i],cycle=Number(m[1]);
   if(cycle!==i)throw Error('轨迹的周期编号不连续');
   const block=source.slice(m.index,matches[i+1]?.index??source.length);
   const f=block.match(/^F: predPC = (0x[0-9a-f]+)\s*$/mi);
   const fetch=block.match(/^\s*Fetch: f_pc = (0x[0-9a-f]+), imem_instr = ([^,\n]+), f_instr = ([^\n]+)$/mi);
   const d=block.match(/^D: instr = ([^,\n]+),[^\n]*Stat = ([A-Z]+)\s*$/m);
   const e=block.match(/^E: instr = ([^,\n]+),[^\n]*\n\s+srcA = [^\n]*Stat = ([A-Z]+)\s*$/m);
   const mem=block.match(/^M: instr = ([^,\n]+),[^\n]*\n\s+dstE = [^\n]*Stat = ([A-Z]+)\s*$/m);
   const w=block.match(/^W: instr = ([^,\n]+),[^\n]*Stat = ([A-Z]+)\s*$/m);
   if(!f||!d||!e||!mem||!w)throw Error(`第 ${cycle} 周期缺少流水线状态`);
   const stage=x=>({instruction:x[1].trim(),status:x[2]});
   const events=block.split(/\r?\n/).filter(line=>/^\s*(Fetch:|Execute:|Memory:|Writeback:|Wrote |Disabled |Couldn't |.*Conflicting control)/.test(line)).map(line=>line.trim());
   const details=block.split(/\r?\n/).filter(line=>/^[FDEMW]:|^\s+(srcA|dstE) =/.test(line));
   frames.push({cycle,cc:m[2],status:m[3],predPC:f[1],fetch:fetch?{pc:fetch[1],instruction:fetch[3].trim(),memoryInstruction:fetch[2].trim()}:null,stages:[stage(d),stage(e),stage(mem),stage(w)],details,events});
  }
  const result=source.match(/^Status = ([A-Z]+)\s*$/m),cpi=source.match(/^CPI:\s*(\d+) cycles\/(\d+) instructions\s*=\s*([\d.]+)/m),producer=source.match(/^Y86-64 Processor: ([^\r\n]{1,160})\s*$/m);
  const diff=source.match(/^Changed Register State:\s*\n([\s\S]*?)^Changed Memory State:\s*\n([\s\S]*?)(?=^CPI:|^ISA Check|$(?![\s\S]))/m);
  return {frames,producer:producer?producer[1].trim():null,result:result?result[1]:null,cpi:cpi?{cycles:Number(cpi[1]),instructions:Number(cpi[2]),value:Number(cpi[3])}:null,changes:diff?{registers:diff[1].trim(),memory:diff[2].trim()}:null};
 }
 const api={parse};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OfficialPipeTrace=api;
})(typeof window==='undefined'?globalThis:window);
