const assert=require('node:assert/strict');const {Y86Terminal}=require('../engine/y86-terminal');const {Y86Subset}=require('../engine/y86-subset');const {assemble}=require('../engine/y86-assembler');
let source='irmovq $5,%rax\nirmovq $7,%rbx\naddq %rbx,%rax\nhalt',machine=null,dirty=true,refreshes=0;
const api={machine:()=>machine,dirty:()=>dirty,load:()=>{machine=new Y86Subset(assemble(source).bytes);dirty=false;return '已装载';},reset:()=>{machine=new Y86Subset(assemble(source).bytes);return '已复位';},step:()=>machine.step(),modified:()=>{},refresh:()=>refreshes++,grade:()=> '5 / 5'};
const t=new Y86Terminal(api),exec=x=>t.execute(x),text=x=>exec(x).text;
assert.match(text('step'),/请先/);assert.match(text('help'),/不是系统 shell/);assert.equal(text('load'),'已装载');assert.match(text('step'),/PC 0xa/);assert.match(text('regs %rax'),/0x0000000000000005/);assert.match(text('run'),/正常停止/);assert.equal(machine.reg[0],12n);assert.ok(refreshes>=2);
assert.match(text('step'),/先 reset/);assert.equal(text('reset'),'已复位');assert.match(text('set %rax -1'),/ffffffffffffffff/);assert.equal(machine.reg[0],0xffffffffffffffffn);assert.match(text('set pc 0x1000'),/超出/);assert.match(text('write 0x100 0xab'),/已写入/);assert.match(text('mem 0x100 1'),/ab/);assert.match(text('mem 0xfff 2'),/越界/);assert.match(text('write 0x100 256'),/0–255/);assert.match(text('run 1001'),/1–1000/);assert.match(text('rm -rf /'),/未知命令/);assert.equal(text('grade'),'5 / 5');assert.equal(exec('clear').clear,true);
dirty=true;assert.match(text('regs'),/请先/);
console.log('模拟器终端：装载、运行、寄存器、内存、越界与未知命令检查通过');
