const assert=require('node:assert/strict');
const H=require('../labs/shell-harness');
const ref=`class Shell {
  constructor(os){this.os=os;this.jobs=[];this.nextJid=1;this.fg=null;}
  addJob(pid,state,cmd){const j={jid:this.nextJid++,pid,state,cmd};this.jobs.push(j);return j;}
  deleteJob(pid){this.jobs=this.jobs.filter(j=>j.pid!==pid);if(this.fg===pid)this.fg=null;}
  findJob(spec){const m=/^%?(\\d+)$/.exec(spec||'');return m?this.jobs.find(j=>j.jid===Number(m[1])):null;}
  async eval(line){line=(line||'').trim();if(!line)return;
    if(line==='quit')return;
    if(line==='jobs'){this.os.output+=this.jobsText();return;}
    if(line.startsWith('bg ')||line.startsWith('fg ')){const [c,s]=line.split(/\\s+/);const j=this.findJob(s);if(!j)return;
      if(c==='bg'){j.state='BG';this.os.kill(j.pid,'SIGCONT');return;} j.state='FG';this.fg=j.pid;this.os.kill(j.pid,'SIGCONT');await this.waitfg(j.pid);return;}
    const bg=line.endsWith('&');const cmd=bg?line.slice(0,-1).trim():line;const p=this.os.spawn(cmd);const j=this.addJob(p.pid,bg?'BG':'FG',cmd);
    if(bg)return;this.fg=p.pid;await this.waitfg(p.pid);}
  async waitfg(pid){const j=this.jobs.find(x=>x.pid===pid);if(!j)return;j.state='FG';
    while(true){const p=this.os.get(pid);if(!p||p.state==='exited'){this.deleteJob(pid);return;}if(p.state==='stopped'){j.state='ST';this.fg=null;return;}await this.os.waitPid(pid);}}
  sigchld(){for(const j of [...this.jobs]){if(j.state==='FG')continue;const p=this.os.get(j.pid);if(!p||p.state==='exited')this.deleteJob(j.pid);else if(p.state==='stopped')j.state='ST';}}
  sigint(){const j=this.jobs.find(x=>x.state==='FG');if(j)this.os.kill(j.pid,'SIGINT');}
  sigtstp(){const j=this.jobs.find(x=>x.state==='FG');if(j)this.os.kill(j.pid,'SIGTSTP');}
  jobsText(){return this.jobs.map(j=>{const p=this.os.get(j.pid);const st=j.state==='ST'||(p&&p.state==='stopped')?'Stopped':j.state==='FG'?'Foreground':'Running';return '['+j.jid+'] ('+j.pid+') '+st+' '+j.cmd;}).join('\\n')+(this.jobs.length?'\\n':'');}
}`;
(async()=>{
  assert.equal(H.scenarios.length,6);
  assert.equal(H.scenarios.reduce((n,s)=>n+s.pts,0),100);
  const good=await H.runAll(ref);
  assert.equal(good.score,100);
  const bad=await H.runAll(H.starter);
  assert.ok(bad.score<20);
  console.log('Shell 模型：6 个作业控制场景、参考实现满分与起始实现低分');
})().catch(e=>{console.error(e);process.exit(1)});
