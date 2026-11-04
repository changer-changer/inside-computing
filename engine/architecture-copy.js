/* Array-copy lab harness using the project's Y86-64 simulator.
   User-provided function code is assembled and executed; this is not the official grader. */
(function(root){'use strict';
 const deps=typeof module!=='undefined'&&module.exports?{...require('./y86-assembler'),...require('./y86-pipeline')}:{...root.Y86Assembler,Y86Pipeline:root.Y86Pipeline};
 const {assemble,Y86Pipeline}=deps;
 const starter=`# 将数组从 %rdi 指向的位置复制到 %rsi 指向的位置。\n# %rdx 是元素个数；返回时 %rax 是严格大于零的元素数。\n# 保留 ncopy 标签，使用 ret 返回。\nncopy:\n    xorq %rax, %rax\n    # 在这里实现复制和计数\n    ret\nEnd:\n`;
 const MASK=(1n<<64n)-1n;
 function values(n,pattern='alternating'){
  if(!Number.isInteger(n)||n<0||n>256)throw Error('元素数应在 0 到 256 之间');
  return Array.from({length:n},(_,i)=>{if(pattern==='edge'){const v=[0n,1n,-1n,-(1n<<63n),(1n<<63n)-1n,2n];return v[i%v.length];}return (i%2?1n:-1n)*BigInt(i+1);});
 }
 function build(source,n,pattern='alternating'){
  if(typeof source!=='string'||source.length>30000)throw Error('函数源码过长');
  const data=values(n,pattern),quads=data.map(x=>` .quad ${x}`).join('\n'),zeros=data.map(()=> ' .quad 0xcdefab').join('\n');
  const listing=`.pos 0\nmain: irmovq Stack,%rsp\n irmovq $${n},%rdx\n irmovq dest,%rsi\n irmovq src,%rdi\n call ncopy\n halt\nStartFun:\n${source}\nEndFun:\n.align 8\nsrc:\n${quads}\n .quad 0xbcdefa\n.align 16\nPredest: .quad 0xbcdefa\ndest:\n${zeros}\nPostdest: .quad 0xdefabc\n.align 8\n${Array(16).fill(' .quad 0').join('\n')}\nStack:\n`;
  const build=assemble(listing,{memorySize:8192}),labels=build.labels;
  if(!Object.hasOwn(labels,'ncopy'))throw Error('函数中必须定义 ncopy 标签');
  if(labels.ncopy<labels.StartFun||labels.ncopy>=labels.EndFun)throw Error('ncopy 必须位于函数代码内');
  const codeSize=labels.EndFun-labels.StartFun;if(codeSize>1000||codeSize<1)throw Error(`函数长度 ${codeSize} 字节；允许 1–1000 字节`);
  return {listing,bytes:build.bytes,labels,data,codeSize,expected:data.filter(x=>x>0n).length};
 }
 function snapshot(machine,input,event=null){
  if(!machine||!input||!input.labels||!Array.isArray(input.data))throw Error('缺少实验状态');
  const access=event?.memoryAccess??null;
  function row(address){return input.data.map((_,i)=>{const cell=BigInt(address+i*8),value=machine.u64(cell);const active=!!(access&&access.address<cell+8n&&access.address+BigInt(access.size)>cell);return {index:i,address:cell,value,access:active?access.kind:null};});}
  return {source:row(input.labels.src),destination:row(input.labels.dest),access,returnValue:machine.reg[0],status:machine.status,cycle:machine.cycles};
 }
 function runCase(source,n,options={}){
  const input=build(source,n,options.pattern),m=new Y86Pipeline(input.bytes,8192,{iaddq:options.iaddq===true,control:options.control||null});
  let remaining=options.maxCycles??15000;if(!Number.isInteger(remaining)||remaining<1||remaining>100000)throw Error('周期上限无效');
  while(m.status==='AOK'&&remaining>0){m.step();remaining--;}
  const l=input.labels,fail=[];
  if(m.status==='AOK')fail.push('超出周期上限，可能没有结束');else if(m.status!=='HLT')fail.push(`处理器状态 ${m.status}`);
  if(m.status==='HLT'){
   if(m.reg[0]!==BigInt(input.expected))fail.push(`正数计数：得到 ${BigInt.asIntN(64,m.reg[0])}，期望 ${input.expected}`);
   for(let i=0;i<n;i++){let expected=input.data[i]&MASK;if(m.u64(BigInt(l.dest+i*8))!==expected){fail.push(`目标数组第 ${i} 项与源数据不一致`);break;}}
   if(m.u64(BigInt(l.Predest))!==0xbcdefan||m.u64(BigInt(l.Postdest))!==0xdefabcn)fail.push('目标数组边界之外的数据被修改');
   for(let i=0;i<n;i++)if(m.u64(BigInt(l.src+i*8))!==(input.data[i]&MASK)){fail.push(`源数组第 ${i} 项被修改`);break;}
  }
  return {n,pattern:options.pattern||'alternating',passed:fail.length===0,fail,cycles:m.cycles-3,codeSize:input.codeSize,count:String(m.reg[0]),expected:input.expected};
 }
 function test(source,options={}){
  const sizes=[...Array.from({length:65},(_,i)=>i),128,192,256],results=[];
  for(const n of sizes){const row=runCase(source,n,options);results.push(row);options.onProgress?.(results.length,sizes.length+1,row);}
  const edge=runCase(source,12,{...options,pattern:'edge'});results.push(edge);options.onProgress?.(results.length,sizes.length+1,edge);
  const passed=results.every(x=>x.passed);const meanCpe=passed?results.slice(1,65).reduce((sum,x)=>sum+x.cycles/x.n,0)/64:null;
  return {passed,results,meanCpe,codeSize:results[0].codeSize};
 }
 const api={starter,values,build,snapshot,runCase,test};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArchitectureCopy=api;
})(typeof window==='undefined'?globalThis:window);
