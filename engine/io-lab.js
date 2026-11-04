/* File descriptors and open-file descriptions: byte-based instructional model. */
(function(root){'use strict';
 class FileDescriptorLab {
  constructor(bytes=new TextEncoder().encode('SYSTEMS\n')){if(!(bytes instanceof Uint8Array))throw Error('文件内容必须是字节');this.bytes=bytes.slice();this.fds=new Map();this.nextId=1;this.log=[];}
  allocate(){for(let fd=3;fd<1024;fd++)if(!this.fds.has(fd))return fd;throw Error('描述符已用尽');}
  open(){const fd=this.allocate(),description={id:this.nextId++,offset:0};this.fds.set(fd,description);const e={op:'open',fd,description:description.id};this.log.push(e);return e;}
  dup(fd){const d=this.get(fd),copy=this.allocate();this.fds.set(copy,d);const e={op:'dup',fd,copy,description:d.id};this.log.push(e);return e;}
  get(fd){if(!Number.isInteger(fd)||!this.fds.has(fd))throw Error(`文件描述符 ${fd} 未打开`);return this.fds.get(fd);}
  read(fd,length){if(!Number.isInteger(length)||length<0||length>64)throw Error('读取长度必须是 0 到 64 的整数');const d=this.get(fd),before=d.offset,data=this.bytes.slice(before,before+length);d.offset+=data.length;const e={op:'read',fd,description:d.id,before,after:d.offset,bytes:Array.from(data)};this.log.push(e);return e;}
  close(fd){const d=this.get(fd);this.fds.delete(fd);const e={op:'close',fd,description:d.id,remaining:[...this.fds.values()].filter(x=>x===d).length};this.log.push(e);return e;}
  snapshot(){return {fds:[...this.fds].map(([fd,d])=>({fd,description:d.id,offset:d.offset})).sort((a,b)=>a.fd-b.fd),length:this.bytes.length};}
 }
 const api={FileDescriptorLab};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FileDescriptorLab=FileDescriptorLab;
})(typeof window==='undefined'?globalThis:window);
