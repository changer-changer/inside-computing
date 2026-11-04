/* Compiles C to wasm32-wasi and runs it in an isolated browser worker. */
import {compile} from '../vendor/browsercc/index.js';
import {WASI,File,OpenFile,ConsoleStdout} from '../vendor/wasi/dist/index.js';
self.onmessage=async({data})=>{
 try{
  if(!data||typeof data.source!=='string'||data.source.length>100000||typeof data.stdin!=='string'||data.stdin.length>65536)throw Error('源码或输入过长');
  self.postMessage({type:'phase',phase:'compile'});
  const flags=Array.isArray(data.flags)&&data.flags.length?data.flags:['-std=c11','-O0','-Wall','-Wextra'];
  const compiled=await compile({source:data.source,fileName:'main.c',flags:flags});
  if(!compiled.module){self.postMessage({type:'error',message:compiled.compileOutput||'编译失败'});return;}
  self.postMessage({type:'phase',phase:'run',diagnostics:compiled.compileOutput||''});
  let output='',truncated=false;const decoder=new TextDecoder();const sink=bytes=>{if(output.length>=100000){truncated=true;return;}output+=decoder.decode(bytes,{stream:true}).slice(0,100000-output.length);};
  const fds=[new OpenFile(new File(new TextEncoder().encode(data.stdin))),new ConsoleStdout(sink),new ConsoleStdout(sink)];
  const wasi=new WASI(['program'],[],fds),instance=await WebAssembly.instantiate(compiled.module,{wasi_snapshot_preview1:wasi.wasiImport});
  const exitCode=wasi.start(instance);output+=decoder.decode();if(truncated)output+='\n[输出已截断]';self.postMessage({type:'done',exitCode,output});
 }catch(e){self.postMessage({type:'error',message:String(e?.message||e)});}
};
