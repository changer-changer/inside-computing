/* A small x86-64 PC-relative relocation example, not a complete ELF linker. */
(function(root){'use strict';
 class LinkLab{
  constructor({base=0x400000n,alignment=16n,missing=false}={}){
   if(typeof base!=='bigint'||base<0n||base>0xffffffffn||typeof alignment!=='bigint'||alignment<1n||alignment>4096n||(alignment&(alignment-1n))!==0n)throw Error('地址或对齐值无效');
   this.base=base;this.alignment=alignment;this.missing=!!missing;this.phase=0;this.call=Uint8Array.from([0xe8,0,0,0,0,0xc3]);this.callee=Uint8Array.from([0xc3]);this.target=null;this.site=null;this.displacement=null;
  }
  step(){
   if(this.phase===0){this.site=this.base+1n;this.target=(this.base+BigInt(this.call.length)+this.alignment-1n)&~(this.alignment-1n);this.phase=1;return {phase:'layout',caller:this.base,site:this.site,target:this.target};}
   if(this.phase===1){if(this.missing)return {phase:'error',error:'未定义符号 sum'};this.phase=2;return {phase:'resolve',symbol:'sum',target:this.target};}
   if(this.phase===2){const displacement=this.target-4n-this.site;if(displacement<-(1n<<31n)||displacement>=(1n<<31n))throw Error('PC 相对位移超出 32 位');this.displacement=displacement;const value=BigInt.asUintN(32,displacement);for(let i=0;i<4;i++)this.call[i+1]=Number((value>>BigInt(i*8))&255n);this.phase=3;return {phase:'relocate',site:this.site,target:this.target,addend:-4n,displacement,bytes:[...this.call.slice(1,5)]};}
   return {phase:'done'};
  }
  snapshot(){return {phase:this.phase,base:this.base,site:this.site,target:this.target,displacement:this.displacement,call:[...this.call],callee:[...this.callee],missing:this.missing};}
 }
 const api={LinkLab};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LinkLab=LinkLab;
})(typeof window==='undefined'?globalThis:window);
