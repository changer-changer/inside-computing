const assert=require('node:assert/strict');const {compile,defaultSource}=require('../engine/hcl-control');const {assemble}=require('../engine/y86-assembler');const {Y86Pipeline}=require('../engine/y86-pipeline');
const {extended}=require('./fixtures/extended-control');
const control=compile(defaultSource);assert.equal(control.run('instr_valid',{f_icode:12}),0n);assert.equal(compile(extended(defaultSource)).run('instr_valid',{f_icode:12}),1n);
for(const input of [defaultSource.replace('word aluA','word aluA_BOGUS'),defaultSource.replace('==','='),defaultSource.replace('INOP','UNKNOWN'),defaultSource.replace('bool instr_valid','word instr_valid'),defaultSource+'\nbool instr_valid = 1;',defaultSource.replace('f_icode in {IHALT','E_icode in {IHALT')])assert.throws(()=>compile(input));
function run(source,ctl){let vm=new Y86Pipeline(assemble(source).bytes,4096,{control:ctl});let limit=200;while(vm.status==='AOK'&&limit--)vm.step();assert.ok(limit>0);return vm;}
const code='irmovq $5,%rax\niaddq $-6,%rax\nhalt';assert.equal(run(code,control).status,'INS');const vm=run(code,compile(extended(defaultSource)));assert.equal(vm.status,'HLT');assert.equal(vm.reg[0],0xffffffffffffffffn);assert.equal(vm.cc.sf,true);
const changed=compile(extended(defaultSource).replace('word aluA = [','word aluA = [ E_icode == IIADDQ: 0;'));assert.equal(run(code,changed).reg[0],5n);
console.log('HCL 子集：解析错误、控制路径、iaddq 行为及错误控制规则通过');
// Removing load/use controls must change the outcome of an actual dependent program.
const hazardCode='irmovq $0x100,%rbx\nirmovq $42,%rax\nrmmovq %rax,0(%rbx)\nmrmovq 0(%rbx),%rcx\naddq %rcx,%rdx\nhalt';
assert.equal(run(hazardCode,control).reg[2],42n);
const noStall=defaultSource.replace(/bool F_stall = [^;]+;/,'bool F_stall = 0;').replace(/bool D_stall = [^;]+;/,'bool D_stall = 0;').replace(/bool E_bubble = [^;]+;/,'bool E_bubble = 0;');
assert.equal(run(hazardCode,compile(noStall)).reg[2],0n);
const conflicting=compile(defaultSource.replace(/bool D_stall = [^;]+;/,'bool D_stall = 1;').replace(/bool D_bubble = [^;]+;/,'bool D_bubble = 1;'));
assert.throws(()=>run('halt',conflicting),/不能同时/);
const {upgrade}=require('../engine/hcl-control');const old=defaultSource.slice(0,defaultSource.indexOf('# 流水线寄存器的暂停与气泡规则'));assert.doesNotThrow(()=>compile(upgrade(old)));assert.equal(upgrade(defaultSource),defaultSource);
// Branch recovery rules must squash instructions fetched on the wrong path.
const branch='xorq %rax,%rax\njne wrong\nirmovq $1,%rbx\nhalt\nwrong: irmovq $99,%rcx\nhalt';
const safeBranch=run(branch,control);assert.equal(safeBranch.reg[3],1n);assert.equal(safeBranch.reg[1],0n);
const noRecovery=defaultSource.replace(/bool D_bubble = [^;]+;/,'bool D_bubble = 0;').replace(/bool E_bubble = [^;]+;/,'bool E_bubble = 0;');
const unsafeBranch=run(branch,compile(noRecovery));assert.equal(unsafeBranch.reg[1],99n);
