/* A deterministic interleaving model, not native threads or timing. */
(function(root){'use strict';
 class CounterLab{
  constructor({locked=false,initial=0}={}){if(!Number.isSafeInteger(initial)||Math.abs(initial)>1000000)throw Error('初始值无效');this.locked=!!locked;this.value=initial;this.owner=null;this.threads=[{id:'A',ip:0,local:null},{id:'B',ip:0,local:null}];this.trace=[];}
  program(){return this.locked?['lock','load','add','store','unlock']:['load','add','store'];}
  next(id){const t=this.threads.find(x=>x.id===id);if(!t)throw Error('未知线程');return this.program()[t.ip]||null;}
  step(id){
   const t=this.threads.find(x=>x.id===id);if(!t)throw Error('未知线程');const op=this.next(id);if(!op)return {id,op:null,done:true,blocked:false};
   if(op==='lock'&&this.owner!==null&&this.owner!==id)return {id,op,blocked:true,owner:this.owner};
   const before=this.value,localBefore=t.local;
   if(op==='lock')this.owner=id;else if(op==='load')t.local=this.value;else if(op==='add')t.local++;else if(op==='store')this.value=t.local;else if(op==='unlock'){if(this.owner!==id)throw Error('锁状态错误');this.owner=null;}
   t.ip++;const event={id,op,blocked:false,before,after:this.value,localBefore,localAfter:t.local,owner:this.owner};this.trace.push(event);return event;
  }
  get done(){return this.threads.every(t=>this.next(t.id)===null);}
  snapshot(){return {value:this.value,owner:this.owner,locked:this.locked,threads:this.threads.map(t=>({...t,next:this.next(t.id)})),done:this.done};}
 }
 const api={CounterLab};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CounterLab=CounterLab;
})(typeof window==='undefined'?globalThis:window);
