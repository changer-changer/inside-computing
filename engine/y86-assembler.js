/* Educational Y86-64 assembler; accepts a documented subset of YAS syntax. */
(function(root){'use strict';
 const REGS=['%rax','%rcx','%rdx','%rbx','%rsp','%rbp','%rsi','%rdi','%r8','%r9','%r10','%r11','%r12','%r13','%r14'];
 const CMOV=['rrmovq','cmovle','cmovl','cmove','cmovne','cmovge','cmovg'];
 const OP=['addq','subq','andq','xorq'];const JUMP=['jmp','jle','jl','je','jne','jge','jg'];
 const SIZE={halt:1,nop:1,ret:1,irmovq:10,iaddq:10,rmmovq:10,mrmovq:10,call:9,pushq:2,popq:2,'.quad':8,'.byte':1};
 for(const a of [...CMOV,...OP])SIZE[a]=2;for(const a of JUMP)SIZE[a]=9;
 const DEFAULT_MAX=4096;
 function fail(n,msg){throw new Error(`第 ${n} 行：${msg}`);}
 function literal(raw,n){const t=raw.trim();if(!/^[+-]?(?:0x[0-9a-f]+|[0-9]+)$/i.test(t))fail(n,`无效数字：${t}`);let sign=1n,v=t;if(v[0]==='-'||v[0]==='+'){if(v[0]==='-')sign=-1n;v=v.slice(1);}return sign*BigInt(v);}
 function resolve(raw,labels,n){const t=raw.trim().replace(/^\$/,'');if(/^[+-]?(?:0x[0-9a-f]+|[0-9]+)$/i.test(t))return literal(t,n);const m=t.match(/^([A-Za-z_][\w.]*)(?:\s*([+-])\s*(0x[0-9a-f]+|\d+))?$/i);if(!m||!Object.hasOwn(labels,m[1]))fail(n,`未知符号或表达式：${t}`);return BigInt(labels[m[1]])+(m[2]?literal((m[2]==='-'?'-':'')+m[3],n):0n);}
 function address(raw,n,max){const v=literal(raw,n);if(v<0n||v>BigInt(max))fail(n,`地址应在 0 到 ${max} 之间`);return Number(v);}
 function reg(raw,n){let id=REGS.indexOf(raw.trim().toLowerCase());if(id<0)fail(n,`未知寄存器：${raw.trim()}`);return id;}
 function args(raw,count,n){const parts=raw.trim()?raw.split(',').map(x=>x.trim()):[];if(parts.length!==count||parts.some(x=>!x))fail(n,`需要 ${count} 个操作数`);return parts;}
 function mem(raw,labels,n){const m=raw.trim().match(/^([^()]*)\(\s*(%[\w]+)\s*\)$/);if(!m)fail(n,'内存操作数格式应为 位移(%寄存器)');return {base:reg(m[2],n),disp:m[1].trim()?resolve(m[1],labels,n):0n};}
 function q64(v,n){if(v<-(1n<<63n)||v>(1n<<64n)-1n)fail(n,'数值超出 64 位范围');const x=BigInt.asUintN(64,v),out=[];for(let i=0;i<8;i++)out.push(Number((x>>BigInt(8*i))&255n));return out;}
 function assemble(source,options={}){
  const MAX=options.memorySize??DEFAULT_MAX;if(!Number.isInteger(MAX)||MAX<1||MAX>65536)throw new Error('汇编内存大小无效');
  if(typeof source!=='string'||source.length>100000)throw new Error('源码为空或过长');const labels=Object.create(null),records=[];let pc=0;
  for(const [i,original] of source.split(/\r?\n/).entries()){
   const n=i+1;let text=original.split('#',1)[0].trim();if(!text)continue;
   const label=text.match(/^([A-Za-z_][\w.]*):/);if(label){if(Object.hasOwn(labels,label[1]))fail(n,`重复标签：${label[1]}`);labels[label[1]]=pc;text=text.slice(label[0].length).trim();if(!text)continue;}
   const match=text.match(/^(\S+)(?:\s+(.*))?$/);const op=match[1].toLowerCase(),tail=match[2]||'';
   if(op==='.pos'){pc=address(tail,n,MAX);continue;}if(op==='.align'){const k=address(tail,n,MAX);if(k===0)fail(n,'对齐值必须大于 0');pc=Math.ceil(pc/k)*k;if(pc>MAX)fail(n,'超出内存');continue;}
   if(!Object.hasOwn(SIZE,op))fail(n,`不支持的指令：${op}`);const size=SIZE[op];if(pc+size>MAX)fail(n,`程序超出 ${MAX} 字节内存`);records.push({n,pc,op,tail,source:original.trim(),size});pc+=size;
  }
  const bytes=new Uint8Array(MAX),used=new Uint8Array(MAX),lineMap=Object.create(null);let highest=0;
  for(const r of records){const {n,pc,op,tail}=r;let out=[],a,b;
   if(['halt','nop','ret'].includes(op)){args(tail,0,n);out=[{halt:0x00,nop:0x10,ret:0x90}[op]];}
   else if(CMOV.includes(op)||OP.includes(op)){[a,b]=args(tail,2,n);out=[CMOV.includes(op)?0x20+CMOV.indexOf(op):0x60+OP.indexOf(op),(reg(a,n)<<4)|reg(b,n)];}
   else if(op==='irmovq'||op==='iaddq'){[a,b]=args(tail,2,n);out=[op==='irmovq'?0x30:0xc0,0xf0|reg(b,n),...q64(resolve(a,labels,n),n)];}
   else if(op==='rmmovq'){[a,b]=args(tail,2,n);const m=mem(b,labels,n);out=[0x40,(reg(a,n)<<4)|m.base,...q64(m.disp,n)];}
   else if(op==='mrmovq'){[a,b]=args(tail,2,n);const m=mem(a,labels,n);out=[0x50,(reg(b,n)<<4)|m.base,...q64(m.disp,n)];}
   else if(JUMP.includes(op)||op==='call'){[a]=args(tail,1,n);out=[op==='call'?0x80:0x70+JUMP.indexOf(op),...q64(resolve(a,labels,n),n)];}
   else if(op==='pushq'||op==='popq'){[a]=args(tail,1,n);out=[op==='pushq'?0xa0:0xb0,(reg(a,n)<<4)|0xf];}
   else if(op==='.quad'){[a]=args(tail,1,n);out=q64(resolve(a,labels,n),n);}
   else if(op==='.byte'){[a]=args(tail,1,n);const v=resolve(a,labels,n);if(v< -128n||v>255n)fail(n,'.byte 的值应在 -128 到 255 之间');out=[Number(BigInt.asUintN(8,v))];}
   if(out.length!==r.size)fail(n,'内部编码错误');for(let j=0;j<out.length;j++){if(used[pc+j])fail(n,`地址 0x${(pc+j).toString(16)} 被重复使用`);used[pc+j]=1;bytes[pc+j]=out[j];}lineMap[pc]={line:n,source:r.source,bytes:out};highest=Math.max(highest,pc+out.length);
  }
  if(!records.length)throw new Error('没有可装载的指令或数据');return {bytes:bytes.slice(0,highest),lineMap,labels};
 }
 const api={assemble,REGS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Y86Assembler=api;
})(typeof window==='undefined'?globalThis:window);
