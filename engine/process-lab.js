/* Deterministic fork/wait model: separate memory, no real OS processes. */
(function(root){'use strict';
 class ProcessLab{
  constructor(){this.parent={pid:100,x:1,incremented:false,state:'running'};this.child=null;this.reaped=false;this.events=[];}
  fork(){if(this.child)throw Error('子进程已经创建');this.child={pid:101,x:this.parent.x,incremented:false,state:'running'};const e={op:'fork',parentReturn:this.child.pid,childReturn:0,parentX:this.parent.x,childX:this.child.x};this.events.push(e);return e;}
  increment(which){const p=which==='parent'?this.parent:which==='child'?this.child:null;if(!p)throw Error('进程不存在');if(p.state!=='running')throw Error('进程没有运行');if(p.incremented)throw Error('此进程已经完成加一');const before=p.x;p.x++;p.incremented=true;const e={op:'increment',which,before,after:p.x};this.events.push(e);return e;}
  wait(){if(!this.child||this.reaped)throw Error('没有可等待的子进程');if(this.parent.state==='waiting')throw Error('父进程已经在等待');if(this.child.state==='running'){this.parent.state='waiting';const e={op:'wait',blocked:true};this.events.push(e);return e;}this.reaped=true;this.child.state='reaped';const e={op:'wait',blocked:false,pid:this.child.pid,status:0};this.events.push(e);return e;}
  exit(){if(!this.child||this.child.state!=='running')throw Error('子进程没有运行');if(!this.child.incremented)throw Error('先让子进程执行加一');const collected=this.parent.state==='waiting';if(collected){this.reaped=true;this.parent.state='running';this.child.state='reaped';}else this.child.state='zombie';const e={op:'exit',pid:this.child.pid,status:0,collected};this.events.push(e);return e;}
  snapshot(){return {parent:{...this.parent},child:this.child?{...this.child}:null,reaped:this.reaped};}
 }
 const api={ProcessLab};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProcessLab=ProcessLab;
})(typeof window==='undefined'?globalThis:window);
