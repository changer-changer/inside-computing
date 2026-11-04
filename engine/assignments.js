/* Original exercises using the local Y86-64 model; not official CS:APP labs. */
(function(root){'use strict';
 const MASK=(1n<<64n)-1n;
 const exercises=[
  {id:'add',chapter:3,title:'两个 64 位数相加',goal:'输入 %rdi、%rsi；将两数之和的低 64 位写入 %rax，然后 halt。',template:'# 输入：%rdi、%rsi；输出：%rax\n# 在这里编写代码\nhalt',
   cases:[[0n,0n],[5n,7n],[-1n,1n],[0x7fffffffffffffffn,1n],[0xffffffffffffffffn,2n]].map(([a,b])=>({inputs:{7:a,6:b},expected:(a+b)&MASK,description:`%rdi=${a}，%rsi=${b}`}))},
  {id:'xor',chapter:2,title:'计算按位异或',goal:'输入 %rdi、%rsi；将它们按位异或的 64 位结果写入 %rax，然后 halt。',template:'# 输入：%rdi、%rsi；输出：%rax\n# 在这里编写代码\nhalt',
   cases:[[0n,0n],[0xffn,0x0fn],[-1n,0n],[0x123456789abcdef0n,0xf0f0f0f0f0f0f0f0n]].map(([a,b])=>({inputs:{7:a,6:b},expected:(a^b)&MASK,description:`%rdi=${a}，%rsi=${b}`}))},
  {id:'maximum',chapter:3,title:'比较有符号整数',goal:'把 %rdi、%rsi 看作 64 位补码数，将较大的值写入 %rax，然后 halt。注意有符号溢出边界。',template:'# 输入：%rdi、%rsi；输出较大值到 %rax\n# 可以使用 subq 和条件转移\nhalt',
   cases:[[0n,0n],[-4n,7n],[8n,-2n],[-8n,-3n],[0x7fffffffffffffffn,-1n],[-0x8000000000000000n,1n]].map(([a,b])=>({inputs:{7:a,6:b},expected:BigInt.asUintN(64,a>b?a:b),description:`%rdi=${a}，%rsi=${b}`}))},
  {id:'stack_swap',chapter:3,title:'使用栈交换数值',goal:'%rdi、%rsi 为输入，%rsp 初始为 0x200。使用 pushq 和 popq 交换两个寄存器的值，恢复 %rsp 后 halt。',template:'# %rdi、%rsi 为输入；%rsp 已初始化\n# 使用 pushq 和 popq 交换两个寄存器\nhalt',
   cases:[[0n,0n],[2n,9n],[-1n,5n],[0x123456789n,0x7fffffffffffffffn]].map(([a,b])=>({inputs:{7:a,6:b,4:0x200n},expectedRegs:{7:BigInt.asUintN(64,b),6:BigInt.asUintN(64,a),4:0x200n},required:['pushq','popq'],description:`%rdi=${a}，%rsi=${b}`}))},
  {id:'call_add',chapter:4,title:'用函数计算和',goal:'%rdi、%rsi 为输入；%rsp 初始为 0x200。必须执行 call 和 ret，将两数之和写入 %rax，恢复栈指针，再 halt。',template:'# 输入 %rdi、%rsi，栈指针已初始化\n# 使用 call 与 ret 完成加法\nhalt',
   cases:[[1n,2n],[5n,7n],[-1n,1n],[0x7fffffffffffffffn,1n]].map(([a,b])=>({inputs:{7:a,6:b,4:0x200n},expected:(a+b)&MASK,expectedRegs:{4:0x200n},required:['call','ret'],description:`%rdi=${a}，%rsi=${b}`}))},
  {id:'store_load',chapter:4,title:'存储并读取一个字',goal:'%rdi 为输入，%rsi 为 0x300。使用 rmmovq 将输入存入 0x300，再使用 mrmovq 读到 %rax，最后 halt。',template:'# 输入 %rdi；%rsi 指向 0x300\n# 存储到内存，再读回 %rax\nhalt',
   cases:[0n,1n,-1n,0x123456789abcdef0n].map(a=>({inputs:{7:a,6:0x300n},expected:BigInt.asUintN(64,a),expectedMemory:BigInt.asUintN(64,a),required:['rmmovq','mrmovq'],description:`%rdi=${a}`}))},
  {id:'array_sum',chapter:4,title:'遍历数组求和',goal:'%rdi 指向 0x300 的 64 位数组，%rsi 是元素数。将所有元素之和的低 64 位写入 %rax，然后 halt；空数组的结果为 0。',template:'# %rdi = 数组地址，%rsi = 元素个数\n# 每个元素占 8 字节；输出 %rax\nhalt',
   cases:[[],[3n],[1n,2n,3n],[-1n,1n,5n],[0x7fffffffffffffffn,1n],[-4n,-3n,-2n,-1n]].map(values=>({inputs:{7:0x300n,6:BigInt(values.length)},memory:values,expected:values.reduce((a,b)=>(a+b)&MASK,0n),description:`数组 [${values.join(', ')}]`}))}
 ];
 function format(v){return '0x'+BigInt.asUintN(64,v).toString(16);}
 function grade(id,source,options={}){
  const ex=exercises.find(x=>x.id===id);if(!ex)throw new Error('请选择作业');const {assemble,Y86Subset}=options;if(typeof assemble!=='function'||typeof Y86Subset!=='function')throw new Error('执行器不可用');
  const build=assemble(source),results=[];
  for(const test of ex.cases){const m=new Y86Subset(build.bytes);for(const [reg,val] of Object.entries(test.inputs))m.reg[Number(reg)]=BigInt.asUintN(64,val);
   if(test.memory)test.memory.forEach((v,i)=>m.put64(0x300n+BigInt(i*8),v));let count=0;const seen=new Set();while(m.status==='AOK'&&count<512){const step=m.step();if(step)seen.add(step.name);count++;}
   let detail='';if(m.status==='AOK')detail='超过 512 条指令，可能存在死循环';else if(m.status!=='HLT')detail=`执行异常：${m.status}`;
   else if(test.required?.some(op=>!seen.has(op)))detail=`需要实际执行 ${test.required.join('、')}`;
   else if(test.expected!==undefined&&m.reg[0]!==test.expected)detail=`%rax 期望 ${format(test.expected)}，实际 ${format(m.reg[0])}`;
   if(!detail&&test.expectedRegs){const bad=Object.keys(test.expectedRegs).find(i=>m.reg[Number(i)]!==test.expectedRegs[i]);if(bad!==undefined)detail=`寄存器 ${bad==='7'?'%rdi':bad==='6'?'%rsi':'%rsp'} 期望 ${format(test.expectedRegs[bad])}，实际 ${format(m.reg[Number(bad)])}`;}
   if(!detail&&test.expectedMemory!==undefined&&m.u64(0x300n)!==test.expectedMemory)detail=`内存 0x300 期望 ${format(test.expectedMemory)}，实际 ${format(m.u64(0x300n))}`;
   results.push({description:test.description,passed:!detail,detail:detail||'通过',steps:count});
  }
  return {id:ex.id,title:ex.title,passed:results.filter(x=>x.passed).length,total:results.length,results};
 }
 function sample(id){const ex=exercises.find(x=>x.id===id);if(!ex)throw new Error('请选择作业');const t=ex.cases[id==='array_sum'?2:1];return {inputs:{...t.inputs},memory:t.memory?[...t.memory]:undefined,description:t.description};}
 const api={exercises:exercises.map(({id,chapter,title,goal,template})=>({id,chapter,title,goal,template})),grade,sample};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Y86Assignments=api;
})(typeof window==='undefined'?globalThis:window);
