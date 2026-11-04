/* Trace-backed Y86-64 teaching system. Cache statistics model the observed
   accesses, not a cycle-accurate implementation or a virtual-memory system. */
(function(root){'use strict';
 const dependencies=typeof module!=='undefined'&&module.exports?{...require('./y86-subset.js'),...require('./cache-sim.js')}:root;
 const {Y86Subset,CacheSim}=dependencies;
 class System64 extends Y86Subset {
  constructor(bytes, memorySize=4096, cacheConfig={sets:4,ways:1,blockSize:16}){
   super(bytes,memorySize);this.cache=new CacheSim(cacheConfig);this.trace=null;
  }
  step(){
   if(this.status!=='AOK')return null;
   const pc=this.pc, before=this.reg.slice(), flags={zf:this.zf,sf:this.sf,of:this.of};
   const first=pc>=0n&&pc<BigInt(this.mem.length)?this.mem[Number(pc)]:null;
   const code=first===null?null:first>>4;
   const length=({0:1,1:1,2:2,3:10,4:10,5:10,6:2,7:9,8:9,9:1,10:2,11:2,12:10})[code]||1;
   const result=super.step(), accesses=[];
   const record=(type,address,size)=>{
    const start=Number(address),end=start+size;
    if(!Number.isSafeInteger(start)||start<0||end>this.mem.length)return;
    for(let p=start;p<end;){const cache=this.cache.access(p);accesses.push({type,address:p,cache});p=Math.min(end,(Math.floor(p/this.cache.blockSize)+1)*this.cache.blockSize);}
   };
   // A failed decode/bounds check only guarantees that the first byte was read.
   if(first!==null)record('fetch',pc,result?length:1);
   if(result && result.address!==undefined){
    const type=['rmmovq','call','pushq'].includes(result.name)?'write':'read';
    record(type,result.address,8);
   }
   const registers=[];for(let i=0;i<this.reg.length;i++)if(before[i]!==this.reg[i])registers.push({index:i,before:before[i],after:this.reg[i]});
   this.trace={pc,nextPc:this.pc,instruction:result?.name||null,status:this.status,registers,flagsBefore:flags,flagsAfter:{zf:this.zf,sf:this.sf,of:this.of},accesses};
   return result;
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={System64};else root.System64=System64;
})(typeof window==='undefined'?globalThis:window);
