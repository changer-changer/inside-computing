/* Local HTTP/1.1 request/response model; no sockets, DNS or external requests. */
(function(root){'use strict';
 const resources={'/':'Hello, systems!\n','/index':'Hello, systems!\n','/about':'Learn how computers work.\n'};
 class HttpLab{
  constructor(path='/'){
   if(typeof path!=='string'||!/^\/[A-Za-z0-9._~/-]*$/.test(path)||path.length>128)throw Error('路径须以 / 开头，只能包含字母、数字和 . _ ~ / -');
   this.path=path;this.phase=0;this.request=`GET ${path} HTTP/1.1\r\nHost: lab.example\r\nConnection: close\r\n\r\n`;this.response=null;this.status=null;this.body=null;this.length=null;
  }
  step(){
   if(this.phase===0){this.phase=1;return {phase:'dns',host:'lab.example',address:'192.0.2.10'};}
   if(this.phase===1){this.phase=2;return {phase:'connect',address:'192.0.2.10',port:80};}
   if(this.phase===2){this.phase=3;return {phase:'request',request:this.request,bytes:new TextEncoder().encode(this.request).length};}
   if(this.phase===3){const found=Object.hasOwn(resources,this.path);this.status=found?200:404;this.body=found?resources[this.path]:'Not found\n';this.length=new TextEncoder().encode(this.body).length;this.response=`HTTP/1.1 ${found?'200 OK':'404 Not Found'}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${this.length}\r\nConnection: close\r\n\r\n${this.body}`;this.phase=4;return {phase:'response',status:this.status,body:this.body,length:this.length,response:this.response};}
   if(this.phase===4){this.phase=5;return {phase:'close'};}
   return {phase:'done'};
  }
  snapshot(){return {phase:this.phase,path:this.path,request:this.request,response:this.response,status:this.status,body:this.body,length:this.length};}
 }
 const api={HttpLab};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HttpLab=HttpLab;
})(typeof window==='undefined'?globalThis:window);
