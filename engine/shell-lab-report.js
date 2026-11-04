/* Validate an explicit report; never convert textual equality into an official grade. */
(function(root){'use strict';
 function parse(source){
  if(typeof source!=='string'||source.length>262144)throw Error('报告过大或无效');
  let report;try{report=JSON.parse(source);}catch{throw Error('报告格式无效');}
  if(!report||report.format!=='open3d-shell-report-v1'||!/^trace(?:0[1-9]|1[0-6])\.txt$/.test(report.traceName)||typeof report.trace!=='string'||typeof report.directory!=='string'||typeof report.unchanged!=='boolean'||typeof report.buildStale!=='boolean')throw Error('报告内容无效');
  for(const key of ['student','reference']){
   const r=report[key];if(!r||typeof r.output!=='string'||r.output.length>100000||!Number.isInteger(r.exit)||typeof r.timeout!=='boolean')throw Error('运行结果无效');
   const s=r.samples;if(!s||typeof s.interval!=='number'||!Number.isFinite(s.interval)||s.interval<=0||(s.attempts!==undefined&&(!Number.isInteger(s.attempts)||s.attempts<0))||(s.maxGap!==undefined&&(typeof s.maxGap!=='number'||!Number.isFinite(s.maxGap)||s.maxGap<0))||!Array.isArray(s.frames)||s.frames.length>80||typeof s.truncated!=='boolean'||(s.error!==null&&typeof s.error!=='string'))throw Error('进程采样无效');
   let prev=0;for(const f of s.frames){if(!f||typeof f.seconds!=='number'||!Number.isFinite(f.seconds)||f.seconds<prev||!Array.isArray(f.processes)||f.processes.length>256)throw Error('进程采样无效');prev=f.seconds;for(const p of f.processes){if(!p||!Number.isInteger(p.pid)||p.pid<1||!Number.isInteger(p.ppid)||!Number.isInteger(p.pgid)||typeof p.name!=='string'||p.name.length>64||!/^\d+$/.test(p.start)||!/^[A-Za-z]$/.test(p.state))throw Error('进程采样无效');}}
  }
  if(!report.hashes||typeof report.hashes!=='object'||Object.values(report.hashes).some(x=>typeof x!=='string'||!/^[0-9a-f]{64}$/.test(x)))throw Error('校验信息无效');
  return report;
 }
 const api={parse};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ShellLabReport=api;
})(typeof window==='undefined'?globalThis:window);
