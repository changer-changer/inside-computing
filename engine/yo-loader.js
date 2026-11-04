/* Parser for Y86 .yo listings. No official lab material is bundled. */
(function(root){'use strict';
 function parseYo(source,memorySize=4096){
  if(typeof source!=='string'||source.length>1000000||!Number.isInteger(memorySize)||memorySize<1)throw Error('文件或内存大小无效');
  const bytes=new Uint8Array(memorySize),written=new Uint8Array(memorySize);let end=0,total=0,overwrittenBytes=0;
  for(const [i,line] of source.split(/\r?\n/).entries()){
   const body=line.split('|',1)[0].trim();if(!body)continue;
   const m=body.match(/^0x([0-9a-f]+):\s*([0-9a-f]*)\s*$/i);if(!m)throw Error(`第 ${i+1} 行不是有效的 .yo 记录`);
   const address=Number.parseInt(m[1],16),hex=m[2];if(!Number.isSafeInteger(address)||hex.length%2)throw Error(`第 ${i+1} 行地址或字节无效`);
   const n=hex.length/2;if(address+n>memorySize)throw Error(`第 ${i+1} 行超出内存范围`);
   for(let j=0;j<n;j++){const at=address+j;if(written[at])overwrittenBytes++;written[at]=1;bytes[at]=parseInt(hex.slice(j*2,j*2+2),16);}
   total+=n;end=Math.max(end,address+n);
  }
  if(!total)throw Error('文件中没有机器码');return {bytes:bytes.slice(0,end),loadedBytes:total,overwrittenBytes};
 }
 const api={parseYo};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Y86ObjectFile=api;
})(typeof window==='undefined'?globalThis:window);
