const assert=require('node:assert/strict');
const H=require('../labs/proxy-harness');
const ref=`class Proxy {
  constructor(os){this.os=os;this.cache=new Map();this.limit=os.cacheLimit||8;}
  touch(k){const v=this.cache.get(k);this.cache.delete(k);this.cache.set(k,v);}
  evict(){while(this.cache.size>this.limit)this.cache.delete(this.cache.keys().next().value);}
  async handle(req){
    if(!req||req.method!=='GET')return {status:400,headers:{},body:'Bad Request\\n'};
    const k=((req.headers&&req.headers.host)||'')+req.path;
    if(this.cache.has(k)){this.touch(k);return this.cache.get(k);}
    const r=await this.os.fetch(req);
    if(r&&r.status===200){this.cache.set(k,r);this.evict();}
    return r;
  }
}`;
(async()=>{
 assert.equal(H.TASKS.length,5);
 assert.equal(H.TASKS.reduce((n,t)=>n+t.pts,0),100);
 const good=await H.runAll(ref);
 assert.equal(good.score,100);
 const starter=await H.runAll(H.starter);
 assert.ok(starter.score<60);
 assert.equal(starter.results.find(r=>r.id==='basic').ok,true);
 console.log('Proxy 模型：5 项检查、参考实现满分与起始实现部分通过');
})().catch(e=>{console.error(e);process.exit(1)});
