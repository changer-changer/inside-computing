/* Original teaching assembler: a small AT&T x86-64 subset to static ELF64. */
(function(root){'use strict';
 const names=['%rax','%rcx','%rdx','%rbx','%rsp','%rbp','%rsi','%rdi','%r8','%r9','%r10','%r11','%r12','%r13','%r14','%r15'];
 const base=0x400000n,offset=0x1000;
 function assemble(source){
  if(typeof source!=='string'||source.length>100000)throw Error('源码为空或过长');const rows=[],labels=new Map();let pc=0;
  const reg=(v,n)=>{const i=names.indexOf(v.toLowerCase());if(i<0)throw Error(`第 ${n} 行：未知寄存器 ${v}`);return i;};
  const mem=(v,n)=>{const m=v.match(/^([+-]?(?:0x[0-9a-f]+|\d+))?\((%[a-z0-9]+)\)$/i);if(!m)throw Error(`第 ${n} 行：内存操作数应为 位移(%寄存器)`);let d=m[1]||'0',sign=1n;if(d[0]==='-'||d[0]==='+'){if(d[0]==='-')sign=-1n;d=d.slice(1);}const disp=sign*BigInt(d);if(disp<-(1n<<31n)||disp>=(1n<<31n))throw Error(`第 ${n} 行：位移超出 32 位`);return {base:reg(m[2],n),disp};};
  const imm=(v,n)=>{if(!/^\$[+-]?(?:0x[0-9a-f]+|\d+)$/i.test(v))throw Error(`第 ${n} 行：立即数格式错误`);let s=v.slice(1),sign=1n;if(s[0]==='-'||s[0]==='+'){if(s[0]==='-')sign=-1n;s=s.slice(1);}const x=sign*BigInt(s);if(x<-(1n<<63n)||x>(1n<<64n)-1n)throw Error(`第 ${n} 行：立即数超出 64 位`);return BigInt.asUintN(64,x);};
  const size=(op,args,n)=>{if(['ret','nop'].includes(op)&&args.length===0)return 1;if(op==='syscall'&&args.length===0)return 2;if(['pushq','popq'].includes(op)&&args.length===1)return reg(args[0],n)>=8?2:1;if(op==='movq'&&args.length===2){if(args[0].startsWith('$'))return 10;const isA=args[0].includes('('),isB=args[1].includes('(');if(isA&&isB)throw Error(`第 ${n} 行：不能同时使用两个内存操作数`);if(isA||isB){const m=mem(isA?args[0]:args[1],n);reg(isA?args[1]:args[0],n);return 7+((m.base&7)===4?1:0);}return 3;}if(['addq','subq','xorq','cmpq','andq','orq'].includes(op)&&args.length===2)return 3;if(['jmp','call'].includes(op)&&args.length===1)return 5;if(['je','jne','jl','jle','jg','jge'].includes(op)&&args.length===1)return 6;throw Error(`第 ${n} 行：指令或操作数不受支持`);};
  for(const [i,raw] of source.split(/\r?\n/).entries()){
   const n=i+1;let line=raw.split('#',1)[0].trim();if(!line)continue;const m=line.match(/^([A-Za-z_][\w]*):/);if(m){if(labels.has(m[1]))throw Error(`第 ${n} 行：重复标签`);labels.set(m[1],pc);line=line.slice(m[0].length).trim();if(!line)continue;}const cmd=line.match(/^(\S+)(?:\s+(.*))?$/),op=cmd[1].toLowerCase(),args=cmd[2]?cmd[2].split(',').map(x=>x.trim()):[];const len=size(op,args,n);rows.push({pc,n,op,args,len,source:raw.trim()});pc+=len;if(pc>65536)throw Error('程序过长');
  }
  if(!rows.length)throw Error('没有可执行指令');const code=new Uint8Array(pc),lineMap={};
  for(const r of rows){let out=[],{op,args,n}=r;
   if(op==='nop')out=[0x90];else if(op==='ret')out=[0xc3];else if(op==='syscall')out=[0x0f,0x05];
   else if(op==='pushq'||op==='popq'){const x=reg(args[0],n);out=[...(x>=8?[0x41]:[]),(op==='pushq'?0x50:0x58)+(x&7)];}
   else if(op==='movq'&&args[0].startsWith('$')){const x=imm(args[0],n),d=reg(args[1],n);out=[0x48|(d>=8?1:0),0xb8+(d&7)];for(let i=0;i<8;i++)out.push(Number((x>>BigInt(8*i))&255n));}
   else if(op==='movq'&&(args[0].includes('(')||args[1].includes('('))){const load=args[0].includes('('),m=mem(load?args[0]:args[1],n),r=reg(load?args[1]:args[0],n),d=BigInt.asUintN(32,m.disp);out=[0x48|(r>=8?4:0)|(m.base>=8?1:0),load?0x8b:0x89,0x80|((r&7)<<3)|(m.base&7)];if((m.base&7)===4)out.push(0x24);for(let i=0;i<4;i++)out.push(Number((d>>BigInt(8*i))&255n));}
   else if(['movq','addq','subq','xorq','cmpq','andq','orq'].includes(op)){const a=reg(args[0],n),b=reg(args[1],n),opcode={movq:0x89,addq:0x01,subq:0x29,xorq:0x31,cmpq:0x39,andq:0x21,orq:0x09}[op];out=[0x48|(a>=8?4:0)|(b>=8?1:0),opcode,0xc0|((a&7)<<3)|(b&7)];}
   else {if(!labels.has(args[0]))throw Error(`第 ${n} 行：未知标签 ${args[0]}`);const delta=labels.get(args[0])-(r.pc+r.len),v=BigInt.asUintN(32,BigInt(delta));const jumps={je:0x84,jne:0x85,jl:0x8c,jle:0x8e,jg:0x8f,jge:0x8d};out=op==='call'?[0xe8]:op==='jmp'?[0xe9]:[0x0f,jumps[op]];for(let i=0;i<4;i++)out.push(Number((v>>BigInt(i*8))&255n));}
   if(out.length!==r.len)throw Error(`第 ${n} 行：编码长度错误`);code.set(out,r.pc);lineMap[(base+BigInt(offset+r.pc)).toString()]={line:n,source:r.source};
  }
  const elf=new Uint8Array(offset+code.length),v=new DataView(elf.buffer),w16=(at,x)=>v.setUint16(at,x,true),w32=(at,x)=>v.setUint32(at,x,true),w64=(at,x)=>v.setBigUint64(at,x,true);
  elf.set([0x7f,0x45,0x4c,0x46,2,1,1,0],0);w16(16,2);w16(18,62);w32(20,1);w64(24,base+BigInt(offset));w64(32,64n);w16(52,64);w16(54,56);w16(56,1);
  w32(64,1);w32(68,5);w64(72,0n);w64(80,base);w64(88,base);w64(96,BigInt(elf.length));w64(104,BigInt(elf.length));w64(112,4096n);elf.set(code,offset);
  return {elf,code,lineMap,entry:base+BigInt(offset)};
 }
 const api={assemble,names};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.X86Assembler=api;
})(typeof window==='undefined'?globalThis:window);
