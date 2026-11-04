/* Dependency critical path lower bound; unlimited functional units, no timing claim. */
(function(root){'use strict';
 function analyze({n=8,ways=1,latency=3}={}){
  if(!Number.isInteger(n)||n<2||n>64||![1,2].includes(ways)||!Number.isInteger(latency)||latency<1||latency>20)throw Error('参数超出范围');
  const lanes=Array.from({length:ways},()=>({value:0,ready:0})),events=[];
  for(let i=0;i<n;i++){const lane=i%ways,l=lanes[lane],before=l.value,start=l.ready;l.value+=i+1;l.ready=start+latency;events.push({type:'add',lane,index:i,input:i+1,before,after:l.value,start,finish:l.ready});}
  let cycles=lanes[0].ready,result=lanes[0].value;
  if(ways===2){const start=Math.max(lanes[0].ready,lanes[1].ready);result+=lanes[1].value;cycles=start+latency;events.push({type:'combine',start,finish:cycles,result});}
  return {n,ways,latency,result,criticalPathCycles:cycles,events};
 }
 const api={analyze};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PerformanceLab=api;
})(typeof window==='undefined'?globalThis:window);
