/* Original six-stage reverse-engineering exercise. Generates real x86-64 code. */
(function(root){'use strict';
 const stages=[
  {title:'直接比较',body:'movq $42, %rax\ncmpq %rax, %rdi\njne fail'},
  {title:'先加再比较',body:'movq $7, %rax\naddq %rax, %rdi\nmovq $25, %rax\ncmpq %rax, %rdi\njne fail'},
  {title:'按位异或',body:'movq $90, %rax\nxorq %rax, %rdi\nmovq $51, %rax\ncmpq %rax, %rdi\njne fail'},
  {title:'检查低字节',body:'movq $255, %rax\nandq %rax, %rdi\nmovq $42, %rax\ncmpq %rax, %rdi\njne fail'},
  {title:'有符号比较',body:'movq $0, %rax\ncmpq %rax, %rdi\njge fail'},
  {title:'范围检查',body:'movq $10, %rax\ncmpq %rax, %rdi\njl fail\nmovq $20, %rbx\ncmpq %rbx, %rdi\njg fail'}
 ];
 function input(value){if(typeof value!=='string'||!/^[-+]?(?:0x[0-9a-f]+|\d+)$/i.test(value.trim()))throw Error('请输入十进制或 0x 十六进制整数');let t=value.trim(),sign=1n;if(t[0]==='-'||t[0]==='+'){if(t[0]==='-')sign=-1n;t=t.slice(1);}const x=sign*BigInt(t);if(x<-(1n<<63n)||x>(1n<<64n)-1n)throw Error('输入超出 64 位范围');return x;}
 function build(index,value){if(!Number.isInteger(index)||index<0||index>=stages.length)throw Error('未知关卡');const v=input(value),stage=stages[index];return {title:stage.title,source:`# 第 ${index+1} 关：${stage.title}。输入放入 %rdi。\nmovq $${v}, %rdi\n${stage.body}\n# 未跳转到 fail：成功退出\nmovq $60, %rax\nmovq $0, %rdi\nsyscall\nfail:\n# 跳到这里：失败退出\nmovq $60, %rax\nmovq $1, %rdi\nsyscall`};}
 const api={stages:stages.map(({title})=>({title})),build,input};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BombExercise=api;
})(typeof window==='undefined'?globalThis:window);
