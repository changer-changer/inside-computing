/* Optional: compare the extension against a separately built official YAS/YIS. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {assemble}=require('../engine/y86-assembler'),{parseYo}=require('../engine/yo-loader'),{Y86Subset}=require('../engine/y86-subset');
const dir=process.env.OPEN3D_CSAPP_SIM;if(!dir){console.log('iaddq 官方 ISA 对照：未指定 OPEN3D_CSAPP_SIM，跳过');process.exit(0)}
const yas=path.join(dir,'misc/yas'),yis=path.join(dir,'misc/yis'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'open3d-iaddq-'));
const cases=[['0','0'],['0','-1'],['0x7fffffffffffffff','1'],['0x8000000000000000','-1'],['0xffffffffffffffff','1'],['100','-101']];
try{for(let i=0;i<cases.length;i++){
 const [a,b]=cases[i],source=`irmovq $${a},%r8\niaddq $${b},%r8\nhalt\n`,file=path.join(tmp,'case'+i+'.ys');fs.writeFileSync(file,source);cp.execFileSync(yas,[file]);const yo=file.replace(/\.ys$/,'.yo');
 const bytes=assemble(source).bytes;assert.deepEqual(bytes,parseYo(fs.readFileSync(yo,'utf8')).bytes,'汇编编码');
 const output=cp.execFileSync(yis,[yo],{encoding:'utf8'}),m=new Y86Subset(bytes);while(m.status==='AOK')m.step();
 const state=output.match(/PC = (0x[\da-f]+).*Status '(\w+)', CC Z=(\d) S=(\d) O=(\d)/i);assert.ok(state);assert.equal(m.pc,BigInt(state[1]));assert.equal(m.status,state[2]);assert.deepEqual([m.zf,m.sf,m.of],state.slice(3).map(x=>x==='1'));
 const reg=output.match(/%r8:\s+0x[\da-f]+\s+0x([\da-f]+)/i);assert.equal(m.reg[8],reg?BigInt('0x'+reg[1]):0n);
}console.log(`iaddq：${cases.length} 组边界输入的机器码、状态、条件码和结果与官方 YAS/YIS 一致`)}finally{fs.rmSync(tmp,{recursive:true,force:true})}
