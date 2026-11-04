/* A trace-driven teaching cache: finite address range, LRU replacement, read-only. */
(function(root){
 'use strict';
 class CacheSim{
  constructor({sets=2,ways=1,blockSize=4}={}){
   for(const n of [sets,ways,blockSize])if(!Number.isSafeInteger(n)||n<1)throw new Error('invalid cache configuration');
   this.setCount=sets;this.ways=ways;this.blockSize=blockSize;this.sets=Array.from({length:sets},()=>Array.from({length:ways},()=>({valid:false,tag:0,last:0})));
   this.tick=0;this.hits=0;this.misses=0;this.evictions=0;
  }
  access(address){
   if(!Number.isSafeInteger(address)||address<0)throw new RangeError('invalid address');
   const block=Math.floor(address/this.blockSize),setIndex=block%this.setCount,tag=Math.floor(block/this.setCount),set=this.sets[setIndex];this.tick++;
   let way=set.findIndex(line=>line.valid&&line.tag===tag),hit=way!==-1,evicted=null;
   if(hit)this.hits++;else{this.misses++;way=set.findIndex(line=>!line.valid);if(way<0){way=set.reduce((best,line,i)=>line.last<set[best].last?i:best,0);evicted=set[way].tag;this.evictions++;}set[way].valid=true;set[way].tag=tag;}
   set[way].last=this.tick;
   return {address,block,set:setIndex,tag,way,hit,evicted};
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={CacheSim};else root.CacheSim=CacheSim;
})(typeof window==='undefined'?globalThis:window);
