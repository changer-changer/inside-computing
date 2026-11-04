/* In-browser teaching shell. Its files belong to this browser, not the host OS. */
(function(root){'use strict';
 const SIM=new Set(['load','step','run','regs','mem','set','write','reset','grade']);
 const HELP=`学习终端 · 文件保存在当前浏览器中，不是系统 shell
文件：pwd  ls [-a] [路径]  cd [路径]  mkdir 路径  touch 文件
      cat [文件...]  echo  rm 文件  rmdir 目录  cp 源 目标  mv 源 目标
文本：grep 文本 [文件]  wc [-l|-w|-c] [文件]  head [-n 行数] [文件]
编辑：editor save 文件  /  editor open 文件
汇编：y86 load | step | run | regs | mem | set | write | reset | grade
也可直接输入 step、regs 等模拟器命令。支持引号、管道 | 和输出重定向 >、>>。
本终端不运行系统程序、C 编译器、网络命令或完整 POSIX shell。`;
 function tokenize(line){
  const out=[];let word='',quote='',active=false;
  const emit=()=>{if(active){out.push({word});word='';active=false;}};
  for(let i=0;i<line.length;i++){
   const c=line[i];
   if(quote){if(c===quote){quote='';active=true;}else if(c==='\\'&&quote==='"'){if(++i>=line.length)throw Error('反斜杠后缺少字符');word+=line[i];}else word+=c;continue;}
   if(c==='"'||c==="'"){quote=c;active=true;continue;}
   if(c==='\\'){if(++i>=line.length)throw Error('反斜杠后缺少字符');word+=line[i];active=true;continue;}
   if(/\s/.test(c)){emit();continue;}
   if('|><;&'.includes(c)){emit();let op=c;if(c==='>'&&line[i+1]==='>'){op='>>';i++;}if(op===';'||op==='&'||op==='<')throw Error('当前只支持管道 | 和输出重定向 >、>>');out.push({op});continue;}
   word+=c;active=true;
  }
  if(quote)throw Error('引号未闭合');emit();return out;
 }
 class LearningShell{
  constructor({simulator,editor,storage}={}){
   this.simulator=simulator;this.editor=editor;this.storage=storage;this.cwd='/home/student';
   this.files=new Map([['/',{type:'dir'}],['/home',{type:'dir'}],['/home/student',{type:'dir'}],['/home/student/hello.txt',{type:'file',content:'欢迎来到计算之境。\n输入 help 查看命令。\n'}]]);
   this.restore();
  }
  restore(){try{const raw=this.storage?.getItem('open3d.shell.v1');if(!raw||raw.length>1000000)return;const entries=JSON.parse(raw);if(!Array.isArray(entries)||entries.length>1000)return;const m=new Map();for(const item of entries){if(!Array.isArray(item)||item.length!==2||typeof item[0]!=='string'||!item[0].startsWith('/')||!item[1]||!['dir','file'].includes(item[1].type)||(item[1].type==='file'&&(typeof item[1].content!=='string'||item[1].content.length>65536)))return;m.set(item[0],item[1]);}if(m.get('/')?.type==='dir'&&m.get('/home/student')?.type==='dir')this.files=m;}catch(_){}}
  persist(){try{this.storage?.setItem('open3d.shell.v1',JSON.stringify([...this.files]));}catch(_){throw Error('浏览器存储不可用或空间不足，修改仅保存在本次页面中');}}
  path(name){if(typeof name!=='string'||!name)throw Error('缺少路径');const parts=(name[0]==='/'?name:this.cwd+'/'+name).split('/'),out=[];for(const p of parts){if(!p||p==='.')continue;if(p==='..')out.pop();else out.push(p);}return '/'+out.join('/');}
  parent(p){return p.slice(0,p.lastIndexOf('/'))||'/';}
  node(p){const n=this.files.get(p);if(!n)throw Error(`${p}: 没有这个文件或目录`);return n;}
  file(p){const n=this.node(p);if(n.type!=='file')throw Error(`${p}: 是目录`);return n.content;}
  put(p,content,append=false){const parent=this.node(this.parent(p));if(parent.type!=='dir')throw Error('父路径不是目录');const old=this.files.get(p);if(old&&old.type!=='file')throw Error(`${p}: 是目录`);const value=(append&&old?old.content:'')+content;if(value.length>65536)throw Error('文件超过 64 Ki 字符');if(!old&&this.files.size>=1000)throw Error('文件数量已达上限');this.files.set(p,{type:'file',content:value});this.persist();}
  execute(line){try{
   if(typeof line!=='string'||line.length>4096)throw Error('命令过长');const tokens=tokenize(line);if(!tokens.length)return {text:''};
   const groups=[[]];let redirect=null;
   for(let i=0;i<tokens.length;i++){const t=tokens[i];if(t.op==='|'){if(!groups.at(-1).length||redirect)throw Error('管道格式错误');groups.push([]);}else if(t.op==='>'||t.op==='>>'){if(redirect||!groups.at(-1).length||i!==tokens.length-2||!tokens[i+1]?.word)throw Error('重定向格式错误');redirect={append:t.op==='>>',path:tokens[++i].word};}else groups.at(-1).push(t.word);}
   if(!groups.at(-1).length)throw Error('管道末尾缺少命令');let input='';
   for(let i=0;i<groups.length;i++){const result=this.command(groups[i],input,i>0);if(result.clear){if(groups.length>1||redirect)throw Error('clear 不支持管道或重定向');return result;}input=result.text;if(input.length>65536)throw Error('输出过长');}
   if(redirect){this.put(this.path(redirect.path),input,redirect.append);return {text:''};}return {text:input.replace(/\n$/,'')};
  }catch(e){return {text:`错误：${e.message}`,error:true};}}
  command(args,input,piped){
   const [cmd,...a]=args,one=()=>{if(a.length!==1)throw Error(`${cmd}: 需要一个参数`);},read=()=>{if(a.length>1)throw Error(`${cmd}: 参数过多`);return a.length?this.file(this.path(a[0])):input;};
   if(cmd==='help'){if(a.length)throw Error('help 不需要参数');return {text:HELP+'\n'};}
   if(cmd==='clear'){if(a.length)throw Error('clear 不需要参数');return {clear:true};}
   if(cmd==='pwd'){if(a.length)throw Error('pwd 不需要参数');return {text:this.cwd+'\n'};}
   if(cmd==='cd'){if(a.length>1)throw Error('cd 参数过多');const p=this.path(a[0]||'/home/student');if(this.node(p).type!=='dir')throw Error(`${p}: 不是目录`);this.cwd=p;return {text:''};}
   if(cmd==='ls'){let all=false,names=a.slice();if(names[0]==='-a'){all=true;names.shift();}if(names.length>1)throw Error('ls: 参数过多');const p=this.path(names[0]||'.'),n=this.node(p);if(n.type==='file')return {text:p.split('/').pop()+'\n'};const prefix=p==='/'?'/':p+'/',list=[];for(const key of this.files.keys()){if(!key.startsWith(prefix)||key===p)continue;const rem=key.slice(prefix.length);if(rem&&!rem.includes('/')&&(all||!rem.startsWith('.')))list.push(rem+(this.files.get(key).type==='dir'?'/':''));}return {text:list.sort().join('  ')+(list.length?'\n':'')};}
   if(cmd==='echo')return {text:a.join(' ')+'\n'};
   if(cmd==='cat'){if(!a.length)return {text:input};return {text:a.map(x=>this.file(this.path(x))).join('')};}
   if(cmd==='mkdir'){one();const p=this.path(a[0]);if(this.files.has(p))throw Error(`${p}: 已存在`);if(this.node(this.parent(p)).type!=='dir')throw Error('父路径不是目录');if(this.files.size>=1000)throw Error('文件数量已达上限');this.files.set(p,{type:'dir'});this.persist();return {text:''};}
   if(cmd==='touch'){one();const p=this.path(a[0]);if(this.files.has(p)){if(this.node(p).type!=='file')throw Error(`${p}: 是目录`);return {text:''};}this.put(p,'');return {text:''};}
   if(cmd==='rm'||cmd==='rmdir'){one();const p=this.path(a[0]),n=this.node(p);if(p==='/'||p==='/home'||p==='/home/student'||p===this.cwd||this.cwd.startsWith(p+'/'))throw Error('不能删除根目录、主目录或当前目录');if(cmd==='rm'&&n.type!=='file')throw Error('rm 只支持删除文件');if(cmd==='rmdir'&&n.type!=='dir')throw Error('rmdir 只支持删除空目录');if(n.type==='dir'&&[...this.files.keys()].some(k=>k.startsWith(p+'/')))throw Error('目录不是空的');this.files.delete(p);this.persist();return {text:''};}
   if(cmd==='cp'||cmd==='mv'){if(a.length!==2)throw Error(`${cmd}: 需要源文件和目标文件`);const from=this.path(a[0]),content=this.file(from);let to=this.path(a[1]);if(this.files.get(to)?.type==='dir')to=(to==='/'?'':to)+'/'+from.split('/').pop();if(from===to)throw Error('源和目标相同');this.put(to,content);if(cmd==='mv'){this.files.delete(from);this.persist();}return {text:''};}
   if(cmd==='grep'){if(a.length<1||a.length>2)throw Error('grep: 需要文本及可选文件');const text=a.length===2?this.file(this.path(a[1])):input;return {text:text.split('\n').filter((v,i,arr)=>!(i===arr.length-1&&v==='')&&v.includes(a[0])).map(x=>x+'\n').join('')};}
   if(cmd==='wc'){let mode='',v=a.slice();if(v[0]&&['-l','-w','-c'].includes(v[0]))mode=v.shift();if(v.length>1)throw Error('wc: 参数过多');const t=v.length?this.file(this.path(v[0])):input,l=(t.match(/\n/g)||[]).length,w=(t.trim().match(/\S+/g)||[]).length,c=new TextEncoder().encode(t).length;return {text:(mode==='-l'?l:mode==='-w'?w:mode==='-c'?c:`${l} ${w} ${c}`)+'\n'};}
   if(cmd==='head'){let n=10,v=a.slice();if(v[0]==='-n'){v.shift();const k=v.shift();if(!/^\d+$/.test(k||'')||Number(k)>1000)throw Error('head: 行数应在 0 到 1000 之间');n=Number(k);}if(v.length>1)throw Error('head: 参数过多');const t=v.length?this.file(this.path(v[0])):input;return {text:(t.match(/[^\n]*\n|[^\n]+$/g)||[]).slice(0,n).join('')};}
   if(cmd==='editor'){if(a.length!==2||!['save','open'].includes(a[0]))throw Error('用法：editor save 文件 或 editor open 文件');if(!this.editor)throw Error('编辑器不可用');const p=this.path(a[1]);if(a[0]==='save'){this.put(p,this.editor.get());return {text:`已保存 ${p}\n`};}this.editor.set(this.file(p));return {text:`已打开 ${p}，请使用 y86 load 编译\n`};}
   if(cmd==='y86'||SIM.has(cmd)){if(piped)throw Error('模拟器命令不能接收管道输入');if(!this.simulator)throw Error('模拟器不可用');const parts=cmd==='y86'?a:[cmd,...a];if(!parts.length)throw Error('用法：y86 step、y86 regs 等');const r=this.simulator.execute(parts.join(' '));if(r.error)throw Error(r.text.replace(/^错误：/,''));return {text:r.text+(r.text?'\n':'')};}
   throw Error(`${cmd}: 未找到命令`);
  }
 }
 const api={LearningShell,tokenize};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LearningShell=LearningShell;
})(typeof window==='undefined'?globalThis:window);
