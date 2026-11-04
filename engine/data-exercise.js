/* Original 32-bit C expression exercises. The parser never evaluates JavaScript. */
(function(root){'use strict';
 const tasks={
  xor:{title:'用与、非实现异或',goal:'只使用 ~ 和 &，对 x、y 计算按位异或。',allowed:['~','&'],limit:14,starter:'x & y',expected:'x ^ y'},
  negate:{title:'计算二进制相反数',goal:'使用允许的位运算和加法，计算 0 − x 的 32 位结果；不要使用减号。',allowed:['~','&','^','|','+','<<','>>'],limit:8,starter:'x',expected:'0u - x'},
  zero:{title:'判断是否为零',goal:'x 为 0 时返回 1，否则返回 0；不要使用逻辑非或比较运算。',allowed:['~','&','^','|','+','<<','>>'],limit:12,starter:'x',expected:'(x == 0u)'},
  tmin:{title:'构造最高位',goal:'构造仅最高位为 1 的 32 位数 0x80000000。',allowed:['~','&','^','|','+','<<','>>'],limit:4,starter:'1',expected:'0x80000000u'}
 };
 function validate(expression,id='xor'){
  const task=tasks[id];if(!task)throw Error('未知练习');if(typeof expression!=='string'||expression.length>512)throw Error('表达式过长');const tokens=[];let i=0,count=0;
  while(i<expression.length){const c=expression[i];if(/\s/.test(c)){i++;continue;}let op=expression.slice(i,i+2);if(op==='<<'||op==='>>'){tokens.push({kind:'op',value:op});count++;i+=2;continue;}if('~!&^|+()'.includes(c)){tokens.push({kind:'op',value:c});if(c!=='('&&c!==')')count++;i++;continue;}if((c==='x'||c==='y')&&!/[A-Za-z0-9_]/.test(expression[i+1]||'')){tokens.push({kind:'var',value:c});i++;continue;}const m=expression.slice(i).match(/^(?:0x[0-9a-f]+|\d+)/i);if(m){const n=BigInt(m[0]);if(n>255n)throw Error('常量必须在 0 到 255 之间');tokens.push({kind:'number',value:String(n)+'u'});i+=m[0].length;continue;}throw Error(`不允许字符或标识符：${c}`);}
  for(const t of tokens)if(t.kind==='op'&&t.value!=='('&&t.value!==')'&&!task.allowed.includes(t.value))throw Error(`此题不允许运算符 ${t.value}`);
  for(let j=0;j<tokens.length;j++)if(tokens[j].value==='<<'||tokens[j].value==='>>'){const rhs=tokens[j+1];if(rhs?.kind!=='number'||Number(rhs.value.slice(0,-1))>31||tokens[j+2]?.value==='+')throw Error('移位位数必须是 0 到 31 的直接常量');}
  let p=0;const current=()=>tokens[p]?.value;function unary(){if(current()==='~'||current()==='!'){p++;unary();return;}if(current()==='('){p++;parseOr();if(current()!==')')throw Error('括号未闭合');p++;return;}if(tokens[p]?.kind==='var'||tokens[p]?.kind==='number'){p++;return;}throw Error('表达式不完整');}
  function binary(next,ops){next();while(ops.includes(current())){p++;next();}}function parseAdd(){binary(unary,['+']);}function parseShift(){binary(parseAdd,['<<','>>']);}function parseAnd(){binary(parseShift,['&']);}function parseXor(){binary(parseAnd,['^']);}function parseOr(){binary(parseXor,['|']);}
  if(!tokens.length)throw Error('请输入表达式');parseOr();if(p!==tokens.length)throw Error('表达式格式错误');if(count>task.limit)throw Error(`使用了 ${count} 个运算符，最多 ${task.limit} 个`);return {id,expression:tokens.map(t=>t.value).join(' '),operators:count};
 }
 function build(expression,id='xor'){const checked=validate(expression,id),task=tasks[id];const source=`#include <stdint.h>\n#include <stdio.h>\nstatic uint32_t solution(uint32_t x,uint32_t y){(void)x;(void)y;return ${checked.expression};}\nstatic uint32_t expected(uint32_t x,uint32_t y){(void)x;(void)y;return ${task.expected};}\nint main(void){\n uint32_t v[]={0u,1u,2u,0x7fffffffu,0x80000000u,0xffffffffu,0x55555555u,0xaaaaaaaau,0x12345678u};\n unsigned tests=0;\n for(unsigned i=0;i<9;i++)for(unsigned j=0;j<9;j++){uint32_t x=v[i],y=v[j],got=solution(x,y),want=expected(x,y);tests++;if(got!=want){printf("FAIL x=0x%08x y=0x%08x got=0x%08x want=0x%08x\\n",x,y,got,want);return 1;}}\n uint32_t r=0x12345678u;for(unsigned i=0;i<4096;i++){r^=r<<13;r^=r>>17;r^=r<<5;uint32_t x=r;r^=r<<13;r^=r>>17;r^=r<<5;uint32_t y=r,got=solution(x,y),want=expected(x,y);tests++;if(got!=want){printf("FAIL x=0x%08x y=0x%08x got=0x%08x want=0x%08x\\n",x,y,got,want);return 1;}}\n printf("PASS %u cases\\n",tests);return 0;}\n`;return {...checked,source,cases:4177};}
 const api={tasks,validate,build};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DataExercise=api;
})(typeof window==='undefined'?globalThis:window);
