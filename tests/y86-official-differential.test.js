/* Optional: compare original test programs with a separately obtained CS:APP PIPE. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {assemble}=require('../engine/y86-assembler'),{Y86Pipeline}=require('../engine/y86-pipeline');
const yas=process.env.OPEN3D_YAS,psim=process.env.OPEN3D_PSIM;if(!yas||!psim){console.log('官方 PIPE 差分检查：未指定外部 yas/psim，跳过');process.exit(0)}
const programs=[
'irmovq $5,%rax\nirmovq $7,%rbx\naddq %rbx,%rax\nhalt\n',
'irmovq $0x100,%rbx\nirmovq $42,%rax\nrmmovq %rax,0(%rbx)\nmrmovq 0(%rbx),%rcx\naddq %rcx,%rax\nhalt\n',
'irmovq $0,%rax\nirmovq $4,%rcx\nirmovq $1,%rbx\nloop: addq %rcx,%rax\nsubq %rbx,%rcx\njne loop\nhalt\n',
'irmovq $0x100,%rsp\ncall fun\nhalt\nfun: irmovq $42,%rax\nret\n',
'irmovq $0x100,%rsp\nirmovq $3,%rax\npushq %rax\npopq %rbx\nhalt\n'];
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'open3d-pipe-'));try{for(let k=0;k<programs.length;k++){const f=path.join(dir,'test'+k+'.ys');fs.writeFileSync(f,programs[k]);cp.execFileSync(yas,[f]);const out=cp.execFileSync(psim,['-t',f.replace(/\.ys$/,'.yo')],{encoding:'utf8',maxBuffer:8*1024*1024});assert.match(out,/ISA Check Succeeds/);const vm=new Y86Pipeline(assemble(programs[k]).bytes);let limit=1000;while(vm.status==='AOK'&&limit--)vm.step();assert.ok(limit>0);assert.equal(vm.status,'HLT');const names=['rax','rcx','rdx','rbx','rsp','rbp','rsi','rdi','r8','r9','r10','r11','r12','r13','r14'];for(const match of out.matchAll(/%(\w+):\s+0x[0-9a-f]+\s+0x([0-9a-f]+)/gi)){let i=names.indexOf(match[1]);if(i>=0)assert.equal(vm.reg[i],BigInt('0x'+match[2]));}for(const match of out.matchAll(/^(0x[0-9a-f]+):\s+0x[0-9a-f]+\s+0x([0-9a-f]+)/gim))assert.equal(vm.u64(BigInt(match[1])),BigInt('0x'+match[2]));const c=out.match(/CPI:\s+(\d+) cycles/);assert.ok(c);assert.equal(vm.cycles-3,Number(c[1]),'官方统计排除初始流水线填充的前三个周期');}console.log(`官方 PIPE 差分：${programs.length} 个原创程序的寄存器、内存和周期统计一致`);}finally{fs.rmSync(dir,{recursive:true,force:true});}
