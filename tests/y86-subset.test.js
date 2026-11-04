const assert=require('node:assert/strict');
const {Y86Subset}=require('../engine/y86-subset');
function imm(reg,value){let n=BigInt.asUintN(64,value),a=[0x30,0xf0|reg];for(let i=0;i<8;i++)a.push(Number((n>>BigInt(i*8))&255n));return a;}
let m=new Y86Subset(Uint8Array.from([...imm(0,5n),...imm(3,7n),0x60,0x30,0]));
m.step();assert.equal(m.reg[0],5n);assert.equal(m.pc,10n);m.step();assert.equal(m.reg[3],7n);m.step();assert.equal(m.reg[0],12n);assert.equal(m.pc,22n);m.step();assert.equal(m.status,'HLT');
m=new Y86Subset(Uint8Array.from([...imm(0,0x7fffffffffffffffn),...imm(3,1n),0x60,0x30,0]));m.step();m.step();m.step();assert.equal(m.reg[0],0x8000000000000000n);assert.equal(m.of,true);assert.equal(m.sf,true);
m=new Y86Subset(Uint8Array.from([...imm(0,-1n),...imm(3,1n),0x60,0x30,0]));m.step();m.step();m.step();assert.equal(m.reg[0],0n);assert.equal(m.zf,true);assert.equal(m.of,false);
m=new Y86Subset(Uint8Array.from([0xff]));m.step();assert.equal(m.status,'INS');
m=new Y86Subset(Uint8Array.from([0x30,0xf0]),2);m.step();assert.equal(m.status,'ADR');assert.equal(m.pc,0n);
m=new Y86Subset(Uint8Array.from([0x30,0x00,0,0,0,0,0,0,0,0]));m.step();assert.equal(m.status,'INS');assert.equal(m.pc,0n);
console.log('Y86-64 子集：加载、加法、64 位溢出、非法指令与越界检查通过');
function q(n){let v=BigInt.asUintN(64,BigInt(n)),a=[];for(let i=0;i<8;i++)a.push(Number((v>>BigInt(i*8))&255n));return a;}
function run(machine,limit=100){let n=0;while(machine.status==='AOK'&&n++<limit)machine.step();assert.ok(n<limit,'program must terminate');}
// Register moves, all ALU functions and flags.
m=new Y86Subset(Uint8Array.from([...imm(0,9n),...imm(3,4n),0x61,0x30,0x62,0x30,0x63,0x30,0x20,0x01,0]));run(m);assert.equal(m.reg[0],0n);assert.equal(m.reg[1],0n);assert.equal(m.zf,true);assert.equal(m.of,false);
m=new Y86Subset(Uint8Array.from([...imm(0,0x8000000000000000n),...imm(3,1n),0x61,0x30,0]));run(m);assert.equal(m.reg[0],0x7fffffffffffffffn);assert.equal(m.of,true);assert.equal(m.sf,false);
// Little-endian store/load at an address formed with signed displacement.
m=new Y86Subset(Uint8Array.from([...imm(3,200n),...imm(0,0x1122334455667788n),0x40,0x03,...q(-8),0x50,0x13,...q(-8),0]));run(m);assert.equal(m.reg[1],0x1122334455667788n);assert.deepEqual([...m.mem.slice(192,200)],[0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11]);
// Branch and conditional move based on negative comparison (2 - 5).
m=new Y86Subset(Uint8Array.from([...imm(0,2n),...imm(3,5n),0x61,0x30,0x22,0x31,0x72,...q(34),0x30,0xf2,...q(99),0]));m.step();m.step();m.step();m.step();assert.equal(m.reg[1],5n);m.step();assert.equal(m.pc,34n);assert.equal(m.last.taken,true);
// call and ret preserve the return address on the stack.
m=new Y86Subset(Uint8Array.from([...imm(4,256n),0x80,...q(20),0,...imm(0,42n),0x90]),512);m.step();m.step();assert.equal(m.reg[4],248n);assert.equal(m.u64(248n),19n);m.step();m.step();assert.equal(m.pc,19n);assert.equal(m.reg[4],256n);m.step();assert.equal(m.status,'HLT');assert.equal(m.reg[0],42n);
// pushq %rsp saves the old value; popq %rsp writes the popped value.
m=new Y86Subset(Uint8Array.from([...imm(4,256n),0xa0,0x4f,0xb0,0x4f,0]),512);run(m);assert.equal(m.reg[4],256n);assert.equal(m.u64(248n),256n);
// Faults must not partially change architectural registers or PC.
m=new Y86Subset(Uint8Array.from([...imm(4,4n),0xa0,0x0f]),64);m.step();m.step();assert.equal(m.status,'ADR');assert.equal(m.pc,10n);assert.equal(m.reg[4],4n);
m=new Y86Subset(Uint8Array.from([0xa0,0x00]),64);m.step();assert.equal(m.status,'INS');assert.equal(m.pc,0n);
console.log('顺序指令：算术、访存、条件控制、调用、栈和故障检查通过');
