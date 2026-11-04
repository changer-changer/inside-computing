/* 64-bit trace cache and instrumented transpose for the CS:APP-aligned lab.
   Models an LRU, write-allocate cache. It does not execute native code. */
(function(root){'use strict';
 const MAX64=(1n<<64n)-1n;
 class TraceCache{
  constructor({s=1,E=1,b=4,semantics='range'}={}){
   if(!Number.isInteger(s)||s<0||s>8||!Number.isInteger(E)||E<1||E>8||!Number.isInteger(b)||b<0||b>12)throw Error('缓存参数超出范围：s 0–8，E 1–8，b 0–12');
   if(!['range','cachelab'].includes(semantics))throw Error('未知的访问计数方式');
   this.s=s;this.E=E;this.b=b;this.semantics=semantics;this.setCount=2**s;this.blockSize=2**b;this.sets=Array.from({length:this.setCount},()=>Array.from({length:E},()=>({valid:false,tag:0n,last:0})));this.hits=0;this.misses=0;this.evictions=0;this.clock=0;
  }
  block(address,operation){
   const block=address>>BigInt(this.b),set=Number(block&BigInt(this.setCount-1)),tag=block>>BigInt(this.s),ways=this.sets[set];this.clock++;
   let way=ways.findIndex(line=>line.valid&&line.tag===tag);const hit=way>=0;let evicted=null;
   if(hit)this.hits++;else{this.misses++;way=ways.findIndex(line=>!line.valid);if(way<0){way=ways.reduce((best,line,i)=>line.last<ways[best].last?i:best,0);evicted=ways[way].tag;this.evictions++;}ways[way].valid=true;ways[way].tag=tag;}
   ways[way].last=this.clock;return {operation,address,set,tag,way,hit,evicted};
  }
  access(operation,address,size=1){
   if(!['L','S','M'].includes(operation))throw Error('操作应为 L、S 或 M');
   if(typeof address!=='bigint'||address<0n||address>MAX64||!Number.isSafeInteger(size)||size<1||size>4096||address+BigInt(size)-1n>MAX64)throw Error('地址或大小无效');
   const out=[],end=address+BigInt(this.semantics==='cachelab'?1:size),stride=BigInt(this.blockSize);
   for(let pass=0;pass<(operation==='M'?2:1);pass++)for(let p=address;p<end;){out.push(this.block(p,operation==='M'?(pass?'S':'L'):operation));p=((p/stride)+1n)*stride;}
   return out;
  }
  summary(){return {hits:this.hits,misses:this.misses,evictions:this.evictions};}
 }
 function parseTrace(text){
  if(typeof text!=='string'||text.length>262144)throw Error('轨迹过长');const records=[];
  for(const [i,raw] of text.split(/\r?\n/).entries()){
   const line=raw.trim();if(!line||line.startsWith('#'))continue;
   const m=line.match(/^([ILSM])\s+(?:0x)?([0-9a-f]+)\s*,\s*(\d+)$/i);if(!m)throw Error(`第 ${i+1} 行：格式应为 L 10,1`);
   const op=m[1].toUpperCase(),address=BigInt('0x'+m[2]),size=Number(m[3]);if(address>MAX64||!Number.isSafeInteger(size)||size<1||size>4096||address+BigInt(size)-1n>MAX64)throw Error(`第 ${i+1} 行：地址或大小超出范围`);
   if(op!=='I')records.push({operation:op,address,size,line:i+1});if(records.length>20000)throw Error('轨迹最多 20000 条');
  }return records;
 }
 function transpose({N=8,block=1,cache={s:5,E:1,b:5}}={}){
  if(!Number.isInteger(N)||N<2||N>64||!Number.isInteger(block)||block<1||block>N)throw Error('矩阵大小应为 2–64，分块大小应为 1–矩阵大小');
  const m=new TraceCache(cache),a=Array.from({length:N},(_,r)=>Array.from({length:N},(_,c)=>r*N+c)),b=Array.from({length:N},()=>Array(N).fill(null));let count=0;
  for(let ii=0;ii<N;ii+=block)for(let jj=0;jj<N;jj+=block)for(let i=ii;i<Math.min(ii+block,N);i++)for(let j=jj;j<Math.min(jj+block,N);j++){
   const offset=BigInt((i*N+j)*4),target=BigInt((j*N+i)*4);m.access('L',0x1000n+offset,4);const value=a[i][j];m.access('S',0x100000n+target,4);b[j][i]=value;count++;
  }
  const correct=a.every((row,i)=>row.every((v,j)=>b[j][i]===v));return {...m.summary(),correct,operations:count,config:{N,block}};
 }
 const api={TraceCache,parseTrace,transpose};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CacheLab=api;
})(typeof window==='undefined'?globalThis:window);
