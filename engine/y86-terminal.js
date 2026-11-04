/* Command interpreter for the local educational simulator; never launches a host shell. */
(function(root){'use strict';
 const REGISTERS=['%rax','%rcx','%rdx','%rbx','%rsp','%rbp','%rsi','%rdi','%r8','%r9','%r10','%r11','%r12','%r13','%r14'];
 const HELP=['模拟器终端（不是系统 shell）','help                    显示命令','load                    编译并装载编辑器源码','step [次数]             单步执行（默认 1）','run [次数]              连续执行（默认 1000，上限 1000）','regs [寄存器]           查看寄存器与状态','mem 地址 [长度]         查看内存（默认 16，最多 64 字节）','set 寄存器 数值         修改寄存器或 pc','write 地址 字节         修改模拟内存中的一个字节','reset                   复位程序及样例输入','grade                   检查当前选中的原创作业','clear                   清屏'].join('\n');
 function num(raw){if(!/^[+-]?(?:0x[0-9a-f]+|[0-9]+)$/i.test(raw||''))throw new Error('请输入十进制或 0x 十六进制整数');let s=raw,sign=1n;if(s[0]==='-'||s[0]==='+'){if(s[0]==='-')sign=-1n;s=s.slice(1);}return sign*BigInt(s);}
 function positive(raw,defaultValue,max){if(raw===undefined)return defaultValue;const n=num(raw);if(n<1n||n>BigInt(max))throw new Error(`次数或长度应为 1–${max}`);return Number(n);}
 function hx(v,width=0){return '0x'+BigInt(v).toString(16).padStart(width,'0');}
 function exact(args,n){if(args.length!==n)throw new Error('参数数量不正确；输入 help 查看用法');}
 class Y86Terminal{
  constructor(adapter){this.adapter=adapter;}
  execute(line){
   try{
    if(typeof line!=='string'||line.length>512)throw new Error('命令过长');const parts=line.trim().split(/\s+/);if(!parts[0])return {text:''};const command=parts.shift().toLowerCase(),a=this.adapter;
    if(command==='help'){exact(parts,0);return {text:HELP};}
    if(command==='clear'){exact(parts,0);return {clear:true,text:''};}
    if(command==='load'){exact(parts,0);return {text:a.load()};}
    if(command==='reset'){exact(parts,0);return {text:a.reset()};}
    if(command==='grade'){exact(parts,0);return {text:a.grade()};}
    const m=a.machine();if(!m||a.dirty())throw new Error('请先使用 load 编译并装载当前源码');
    if(command==='regs'){
     if(parts.length>1)throw new Error('用法：regs [寄存器]');
     if(parts.length===1){const name=parts[0].toLowerCase();if(name==='pc')return {text:`pc = ${hx(m.pc,16)}`};const index=REGISTERS.indexOf(name);if(index<0)throw new Error('未知寄存器');return {text:`${name} = ${hx(m.reg[index],16)} (${BigInt.asIntN(64,m.reg[index])})`};}
     const rows=REGISTERS.map((name,i)=>`${name.padEnd(5)} ${hx(m.reg[i],16)}`);return {text:`PC ${hx(m.pc,16)} · ${m.status} · Z=${+m.zf} S=${+m.sf} O=${+m.of}\n${rows.join('\n')}`};
    }
    if(command==='step'||command==='run'){
     if(parts.length>1)throw new Error(`用法：${command} [次数]`);const limit=positive(parts[0],command==='step'?1:1000,1000);if(m.status!=='AOK')throw new Error(`机器状态 ${m.status}，请先 reset`);
     let count=0;while(count<limit&&m.status==='AOK'){a.step();count++;}a.refresh();const suffix=m.status==='AOK'?'已暂停':m.status==='HLT'?'正常停止':`异常 ${m.status}`;return {text:`执行 ${count} 条 · PC ${hx(m.pc)} · ${suffix}`};
    }
    if(command==='mem'){
     if(parts.length<1||parts.length>2)throw new Error('用法：mem 地址 [长度]');const address=num(parts[0]),length=positive(parts[1],16,64);if(address<0n||address+BigInt(length)>BigInt(m.mem.length))throw new Error('内存范围越界');const start=Number(address),lines=[];for(let i=0;i<length;i+=8){const begin=start+i;lines.push(`${hx(begin,3)}: `+[...m.mem.slice(begin,Math.min(begin+8,start+length))].map(x=>x.toString(16).padStart(2,'0')).join(' '));}return {text:lines.join('\n')};
    }
    if(command==='set'){
     exact(parts,2);const name=parts[0].toLowerCase(),value=num(parts[1]);if(value<-(1n<<63n)||value>(1n<<64n)-1n)throw new Error('数值超出 64 位范围');if(name==='pc'){if(value<0n||value>=BigInt(m.mem.length))throw new Error('PC 超出模拟内存');m.pc=value;}else{const index=REGISTERS.indexOf(name);if(index<0)throw new Error('未知寄存器');m.reg[index]=BigInt.asUintN(64,value);}a.modified();a.refresh();return {text:`${name} = ${hx(BigInt.asUintN(64,value),16)}`};
    }
    if(command==='write'){
     exact(parts,2);const address=num(parts[0]),byte=num(parts[1]);if(address<0n||address>=BigInt(m.mem.length))throw new Error('内存地址越界');if(byte<0n||byte>255n)throw new Error('字节值应为 0–255');m.mem[Number(address)]=Number(byte);a.modified();a.refresh();return {text:`已写入 ${hx(address,3)} = ${hx(byte,2)}。若修改了代码，源码映射不会更新。`};
    }
    throw new Error(`未知命令：${command}；输入 help 查看用法`);
   }catch(err){return {text:`错误：${err.message}`,error:true};}
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={Y86Terminal};else root.Y86Terminal=Y86Terminal;
})(typeof window==='undefined'?globalThis:window);
