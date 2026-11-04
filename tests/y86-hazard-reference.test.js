/* Compare a deliberately broken load/use policy with an externally built PIPE. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {compile,defaultSource}=require('../engine/hcl-control'),{assemble}=require('../engine/y86-assembler'),{Y86Pipeline}=require('../engine/y86-pipeline');
const sim=process.env.OPEN3D_CSAPP_SIM,psim=process.env.OPEN3D_PSIM;if(!sim||!psim){console.log('暂停规则官方对照：缺少参考程序，跳过');process.exit(0)}
const src='irmovq $0x100,%rbx\nirmovq $42,%rax\nrmmovq %rax,0(%rbx)\nmrmovq 0(%rbx),%rcx\naddq %rcx,%rdx\nhalt\n';
const broken=process.env.OPEN3D_BROKEN_HAZARD==='1';let rules=defaultSource;
if(broken)for(const name of ['F_stall','D_stall','E_bubble'])rules=rules.replace(new RegExp(`bool ${name} = [^;]+;`),`bool ${name} = 0;`);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'open3d-hazard-'));try{
 const file=path.join(dir,'hazard.ys');fs.writeFileSync(file,src);cp.execFileSync(path.join(sim,'misc/yas'),[file]);const out=cp.execFileSync(psim,['-v','1','-t',file.replace(/\.ys$/,'.yo')],{encoding:'utf8'});
 assert.match(out,broken?/ISA Check Fails/:/ISA Check Succeeds/);
 const model=new Y86Pipeline(assemble(src).bytes,8192,{control:compile(rules)});let max=200;while(model.status==='AOK'&&max-- > 0)model.step();assert.ok(max>0);
 const regs=['rax','rcx','rdx','rbx','rsp','rbp','rsi','rdi','r8','r9','r10','r11','r12','r13','r14'].map(()=>0n),names=['rax','rcx','rdx','rbx','rsp','rbp','rsi','rdi','r8','r9','r10','r11','r12','r13','r14'];
 for(const m of out.matchAll(/%(\w+):\s+0x[\da-f]+\s+0x([\da-f]+)/gi)){let i=names.indexOf(m[1]);assert.ok(i>=0);regs[i]=BigInt('0x'+m[2])}assert.deepEqual(model.reg,regs);assert.equal(model.reg[2],broken?0n:42n);
 const cycles=out.match(/CPI:\s+(\d+) cycles/);assert.ok(cycles);assert.equal(model.cycles-3,Number(cycles[1]));
 console.log(`${broken?'错误':'正常'}暂停规则：寄存器和周期与 PIPE 一致，rdx=${model.reg[2]}`);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
