/* Decode the explicit, bounded terminal transfer before the existing .yo parser. */
(function(root){'use strict';
 const MAX_BYTES=65536, PREFIX='open3d-yo;', TRACE_PREFIX='open3d-pipe-trace;', SEQ_PREFIX='open3d-seq-trace;', SHELL_PREFIX='open3d-shell-report;', TRACE_MAX_BYTES=262144, MALLOC_PREFIX='open3d-malloc-trace;', CACHE_PREFIX='open3d-cache-trace;', CACHE_MAX_BYTES=262144;
 function decode(message){
  if(typeof message!=='string')throw Error('不是有效的传输消息');
  const prefix=message.startsWith(PREFIX)?PREFIX:message.startsWith(TRACE_PREFIX)?TRACE_PREFIX:message.startsWith(SEQ_PREFIX)?SEQ_PREFIX:message.startsWith(SHELL_PREFIX)?SHELL_PREFIX:message.startsWith(CACHE_PREFIX)?CACHE_PREFIX:message.startsWith(MALLOC_PREFIX)?MALLOC_PREFIX:null;
  if(!prefix)throw Error('不是有效的传输消息');
  const limit=prefix===PREFIX?MAX_BYTES:prefix===CACHE_PREFIX?CACHE_MAX_BYTES:TRACE_MAX_BYTES,encoded=message.slice(prefix.length);
  if(!encoded||encoded.length>Math.ceil(limit/3)*4||encoded.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw Error('传输数据格式或大小无效');
  let raw;try{raw=atob(encoded);}catch{throw Error('传输数据编码无效');}
  if(!raw.length||raw.length>limit)throw Error('文件大小无效');
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('文件不是有效的 UTF-8 文本');}
 }
 const api={decode,PREFIX,MAX_BYTES,TRACE_PREFIX,SEQ_PREFIX,SHELL_PREFIX,TRACE_MAX_BYTES,CACHE_PREFIX,CACHE_MAX_BYTES,MALLOC_PREFIX};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Y86Transfer=api;
})(typeof window==='undefined'?globalThis:window);
