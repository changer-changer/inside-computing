const assert=require('node:assert/strict');
const {parse}=require('../engine/official-pipe-trace');
const {decode,TRACE_PREFIX}=require('../engine/yo-transfer');
function cycle(n, {d='nop',ds='BUB',e='nop',es='BUB',m='nop',ms='BUB',w='nop',ws='BUB',fetch='irmovq'}={}) {
 return `Cycle ${n}. CC=Z=1 S=0 O=0, Stat=AOK\nF: predPC = 0x0\nD: instr = ${d}, rA = ----, rB = ----, valC = 0x0, valP = 0x0, Stat = ${ds}\nE: instr = ${e}, valC = 0x0, valA = 0x0, valB = 0x0\n   srcA = ----, srcB = ----, dstE = ----, dstM = ----, Stat = ${es}\nM: instr = ${m}, Cnd = 0, valE = 0x0, valA = 0x0\n   dstE = ----, dstM = ----, Stat = ${ms}\nW: instr = ${w}, valE = 0x0, valM = 0x0, dstE = ----, dstM = ----, Stat = ${ws}\n\tFetch: f_pc = 0x0, imem_instr = ${fetch}, f_instr = ${fetch}\n`;
}
const raw='Y86-64 Processor: pipe-test.hcl\n'+cycle(0)+cycle(1,{d:'irmovq',ds:'AOK',fetch:'halt'})+'Status = HLT\nChanged Register State:\n%rax:\t0x0\t0x2a\nChanged Memory State:\n0x0100:\t0x0\t0x2a\nCPI: 2 cycles/2 instructions = 1.00\n';
const decoded=decode(TRACE_PREFIX+Buffer.from(raw).toString('base64'));
const trace=parse(decoded);
assert.equal(trace.frames.length,2);assert.equal(trace.frames[1].stages[0].instruction,'irmovq');assert.equal(trace.frames[1].fetch.instruction,'halt');assert.equal(trace.result,'HLT');assert.equal(trace.cpi.cycles,2);assert.equal(trace.producer,'pipe-test.hcl');assert.match(trace.changes.registers,/%rax/);assert.match(trace.changes.memory,/0x0100/);assert.match(trace.frames[1].details.join('\n'),/D: instr = irmovq/);
assert.throws(()=>parse(cycle(1)),/不连续/);assert.throws(()=>parse(cycle(0).replace('D: instr','Q: instr')),/缺少/);assert.throws(()=>parse('not a trace'),/没有找到/);
assert.throws(()=>decode(TRACE_PREFIX+Buffer.alloc(262145).toString('base64')));
console.log('官方 PIPE 轨迹：周期、阶段、结果及无效输入检查通过');
