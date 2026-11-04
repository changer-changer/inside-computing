/* A bounded HCL expression interpreter for editable PIPE control signals.
   This is a documented subset, not the official hcl2c compiler. */
(function(root){'use strict';
 const constants={IHALT:0,INOP:1,IRRMOVQ:2,IIRMOVQ:3,IRMMOVQ:4,IMRMOVQ:5,IOPQ:6,IJXX:7,ICALL:8,IRET:9,IPUSHQ:10,IPOPQ:11,IIADDQ:12,RSP:4,RNONE:15,SAOK:1,SHLT:2,SADR:3,SINS:4};
 const inputs=['f_icode','D_icode','D_rB','E_icode','E_valA','E_valB','E_valC','m_stat','W_stat','M_icode','E_dstM','d_srcA','d_srcB','e_Cnd'];
 const outputs=['instr_valid','need_regids','need_valC','d_srcB','d_dstE','aluA','aluB','set_cc','F_stall','D_stall','D_bubble','E_bubble'];
 const defaultSource=`# 可修改这些控制信号，基础 PIPE 不包含 IIADDQ。
bool instr_valid = f_icode in {IHALT, INOP, IRRMOVQ, IIRMOVQ, IRMMOVQ, IMRMOVQ, IOPQ, IJXX, ICALL, IRET, IPUSHQ, IPOPQ};
bool need_regids = f_icode in {IRRMOVQ, IIRMOVQ, IRMMOVQ, IMRMOVQ, IOPQ, IPUSHQ, IPOPQ};
bool need_valC = f_icode in {IIRMOVQ, IRMMOVQ, IMRMOVQ, IJXX, ICALL};
word d_srcB = [ D_icode in {IRMMOVQ, IMRMOVQ, IOPQ}: D_rB; D_icode in {ICALL, IRET, IPUSHQ, IPOPQ}: RSP; 1: RNONE; ];
word d_dstE = [ D_icode in {IRRMOVQ, IIRMOVQ, IOPQ}: D_rB; D_icode in {ICALL, IRET, IPUSHQ, IPOPQ}: RSP; 1: RNONE; ];
word aluA = [ E_icode in {IRRMOVQ, IOPQ}: E_valA; E_icode in {IIRMOVQ, IRMMOVQ, IMRMOVQ}: E_valC; E_icode in {ICALL, IPUSHQ}: -8; E_icode in {IRET, IPOPQ}: 8; 1: 0; ];
word aluB = [ E_icode in {IRMMOVQ, IMRMOVQ, IOPQ, ICALL, IRET, IPUSHQ, IPOPQ}: E_valB; 1: 0; ];
bool set_cc = E_icode == IOPQ && !(m_stat in {SADR, SINS, SHLT}) && !(W_stat in {SADR, SINS, SHLT});
# 流水线寄存器的暂停与气泡规则
bool F_stall = (E_icode in {IMRMOVQ, IPOPQ} && E_dstM != RNONE && E_dstM in {d_srcA, d_srcB}) || IRET in {D_icode, E_icode, M_icode};
bool D_stall = E_icode in {IMRMOVQ, IPOPQ} && E_dstM != RNONE && E_dstM in {d_srcA, d_srcB};
bool D_bubble = (E_icode == IJXX && !e_Cnd) || (!(E_icode in {IMRMOVQ, IPOPQ} && E_dstM != RNONE && E_dstM in {d_srcA, d_srcB}) && IRET in {D_icode, E_icode, M_icode});
bool E_bubble = (E_icode == IJXX && !e_Cnd) || (E_icode in {IMRMOVQ, IPOPQ} && E_dstM != RNONE && E_dstM in {d_srcA, d_srcB});`;
 const hazardSource=defaultSource.slice(defaultSource.indexOf('# 流水线寄存器的暂停与气泡规则'));
 function upgrade(source){return typeof source==='string'&&!/\b(?:F_stall|D_stall|D_bubble|E_bubble)\s*=/.test(source)?source+'\n'+hazardSource:source;}
 function compile(source){
  if(typeof source!=='string'||source.length>20000)throw Error('控制规则过长');
  const tokens=[];let pos=0,line=1;
  while(pos<source.length){const rest=source.slice(pos),ws=rest.match(/^(?:\s+|#[^\n]*)/);if(ws){line+=(ws[0].match(/\n/g)||[]).length;pos+=ws[0].length;continue;}const m=rest.match(/^(?:0x[0-9a-f]+|\d+|[A-Za-z_][A-Za-z_0-9]*|==|!=|&&|\|\||[!{}()[\],:;=\-])/i);if(!m)throw Error(`第 ${line} 行：无法识别 ${rest[0]}`);tokens.push({value:m[0],line});pos+=m[0].length;if(tokens.length>1200)throw Error('控制规则过于复杂');}
  let i=0,depth=0;const cur=()=>tokens[i]?.value,where=()=>tokens[i]?.line||line;
  function take(expected){if(cur()!==expected)throw Error(`第 ${where()} 行：需要 ${expected}，实际为 ${cur()||'文件结尾'}`);i++;}
  function guarded(fn){if(++depth>100)throw Error('表达式嵌套过深');try{return fn();}finally{depth--;}}
  function primary(){return guarded(()=>{let t=cur();if(t==='('){i++;let e=or();take(')');return e;}if(t==='['){i++;let cases=[];while(cur()!==']'){if(!cur())throw Error('条件选择缺少 ]');let cond=or();take(':');let result=or();take(';');cases.push([cond,result]);}take(']');if(!cases.length)throw Error('条件选择不能为空');return ['case',cases];}if(t==='-'){i++;const n=primary();return ['neg',n];}if(t&&/^(?:\d+|0x[\da-f]+)$/i.test(t)){i++;return ['literal',BigInt(t)];}if(t&&/^[A-Za-z_]/.test(t)){i++;if(!Object.hasOwn(constants,t)&&!inputs.includes(t))throw Error(`第 ${where()} 行：未知信号 ${t}`);return ['id',t];}throw Error(`第 ${where()} 行：需要表达式`);});}
  function unary(){return guarded(()=>{if(cur()==='!'){i++;return ['not',unary()];}return primary();});}
  function compare(){let a=unary();if(cur()==='=='||cur()==='!='){let op=cur();i++;return [op,a,unary()];}if(cur()==='in'){i++;take('{');let values=[];if(cur()!=='}'){values.push(unary());while(cur()===','){i++;values.push(unary());}}take('}');return ['in',a,values];}return a;}
  function and(){let a=compare();while(cur()==='&&'){i++;a=['&&',a,compare()];}return a;}
  function or(){let a=and();while(cur()==='||'){i++;a=['||',a,and()];}return a;}
  const rules={};while(cur()){const type=cur();if(type!=='word'&&type!=='bool')throw Error(`第 ${where()} 行：需要 word 或 bool`);i++;const name=cur();if(!outputs.includes(name))throw Error(`第 ${where()} 行：不支持控制信号 ${name}`);if(Object.hasOwn(rules,name))throw Error(`重复定义 ${name}`);if((name==='instr_valid'||name==='need_regids'||name==='need_valC'||name==='set_cc'||name==='F_stall'||name==='D_stall'||name==='D_bubble'||name==='E_bubble')!==(type==='bool'))throw Error(`${name} 的类型错误`);i++;take('=');rules[name]=or();take(';');}
  for(const name of outputs)if(!Object.hasOwn(rules,name))throw Error(`缺少控制信号 ${name}`);
  const domains={instr_valid:['f_icode'],need_regids:['f_icode'],need_valC:['f_icode'],d_srcB:['D_icode','D_rB'],d_dstE:['D_icode','D_rB'],aluA:['E_icode','E_valA','E_valB','E_valC'],aluB:['E_icode','E_valA','E_valB','E_valC'],set_cc:['E_icode','m_stat','W_stat'],F_stall:['D_icode','E_icode','M_icode','E_dstM','d_srcA','d_srcB','e_Cnd'],D_stall:['D_icode','E_icode','M_icode','E_dstM','d_srcA','d_srcB','e_Cnd'],D_bubble:['D_icode','E_icode','M_icode','E_dstM','d_srcA','d_srcB','e_Cnd'],E_bubble:['D_icode','E_icode','M_icode','E_dstM','d_srcA','d_srcB','e_Cnd']};
  function checkDomain(node,name){const [op,a,b]=node;if(op==='id'&&inputs.includes(a)&&!domains[name].includes(a))throw Error(`${name} 中不能使用信号 ${a}`);if(op==='case'){for(const [condition,value] of a){checkDomain(condition,name);checkDomain(value,name);}return;}if(op==='in'){checkDomain(a,name);for(const item of b)checkDomain(item,name);return;}if(Array.isArray(a))checkDomain(a,name);if(Array.isArray(b))checkDomain(b,name);}
  for(const name of outputs)checkDomain(rules[name],name);

  function evaluate(node,env){const [op,a,b]=node;switch(op){case 'literal':return a;case 'id':return BigInt(Object.hasOwn(constants,a)?constants[a]:env[a]);case 'neg':return -evaluate(a,env);case 'not':return evaluate(a,env)===0n?1n:0n;case '==':return evaluate(a,env)===evaluate(b,env)?1n:0n;case '!=':return evaluate(a,env)!==evaluate(b,env)?1n:0n;case '&&':return evaluate(a,env)!==0n&&evaluate(b,env)!==0n?1n:0n;case '||':return evaluate(a,env)!==0n||evaluate(b,env)!==0n?1n:0n;case 'in':{const v=evaluate(a,env);return b.some(x=>evaluate(x,env)===v)?1n:0n;}case 'case':for(const [c,v] of a)if(evaluate(c,env)!==0n)return evaluate(v,env);return 0n;default:throw Error('无效表达式');}}
  return Object.freeze({run(name,env){if(!Object.hasOwn(rules,name))throw Error(`未知控制信号 ${name}`);return evaluate(rules[name],env);}});
 }
 const api={compile,defaultSource,upgrade,outputs};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Y86HCLControl=api;
})(typeof window==='undefined'?globalThis:window);
