/* Optional: compare the same project-generated drivers with an external CS:APP PIPE. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const lab=require('../engine/architecture-copy'),{parseYo}=require('../engine/yo-loader');
const sim=process.env.OPEN3D_CSAPP_SIM;if(!sim){console.log('数组复制官方参考对照：未指定 OPEN3D_CSAPP_SIM，跳过');process.exit(0)}
const sourcePath=path.join(sim,'pipe/ncopy.ys'),source=fs.readFileSync(sourcePath,'utf8'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'open3d-copy-ref-'));let total=0;
try{
 for(const [n,pattern] of [...Array.from({length:65},(_,i)=>[i,'alternating']),[128,'alternating'],[192,'alternating'],[256,'alternating'],[12,'edge']]){
  const built=lab.build(source,n,pattern),file=path.join(dir,'driver.ys');fs.writeFileSync(file,built.listing);cp.execFileSync(path.join(sim,'misc/yas'),[file]);
  const yo=path.join(dir,'driver.yo'),refBytes=parseYo(fs.readFileSync(yo,'utf8'),8192).bytes;assert.deepEqual(built.bytes,refBytes,`长度 ${n}: 汇编字节`);
  const out=cp.execFileSync(path.join(sim,'pipe/psim'),['-v','1','-t',yo],{encoding:'utf8',maxBuffer:1000000});assert.match(out,/ISA Check Succeeds/);
  const cycles=out.match(/CPI:\s+(\d+) cycles/),status=out.match(/Status = (\w+)/),count=out.match(/%rax:\s+0x[\da-f]+\s+0x([\da-f]+)/i);
  assert.ok(cycles&&status);const project=lab.runCase(source,n,{pattern});assert.equal(status[1],'HLT');assert.equal(project.passed,true,JSON.stringify(project));assert.equal(project.cycles,Number(cycles[1]),`长度 ${n}: 周期`);assert.equal(BigInt(project.count),count?BigInt('0x'+count[1]):0n);total++;
 }
 console.log(`数组复制：${total} 组程序编码、返回计数与统计周期对照官方 PIPE 一致`);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
