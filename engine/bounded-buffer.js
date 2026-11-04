/* A bounded FIFO and semaphore-count teaching model, not real threads. */
(function(root){'use strict';
 class BoundedBuffer {
  constructor(capacity=2){if(!Number.isInteger(capacity)||capacity<1||capacity>8)throw Error('容量必须为 1 至 8');this.capacity=capacity;this.queue=[];this.next=1;this.consumed=[];}
  produce(){if(this.queue.length===this.capacity)return {blocked:true,reason:'full'};const value=this.next++;this.queue.push(value);return {blocked:false,value};}
  consume(){if(!this.queue.length)return {blocked:true,reason:'empty'};const value=this.queue.shift();this.consumed.push(value);return {blocked:false,value};}
  snapshot(){return {capacity:this.capacity,queue:[...this.queue],empty:this.capacity-this.queue.length,full:this.queue.length,consumed:[...this.consumed]};}
 }
 const api={BoundedBuffer};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BoundedBufferLab=api;
})(typeof window==='undefined'?globalThis:window);
