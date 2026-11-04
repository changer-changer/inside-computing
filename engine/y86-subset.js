/* Y86-64 sequential interpreter: architectural state only; no pipeline or OS. */
(function (root) {
  'use strict';
  const MASK=(1n<<64n)-1n, SIGN=1n<<63n, RSP=4;
  class Y86Subset {
    constructor(bytes, memorySize=4096) {
      if (!(bytes instanceof Uint8Array) || !Number.isInteger(memorySize) || memorySize<bytes.length || memorySize<1) throw new Error('invalid memory');
      this.mem=new Uint8Array(memorySize);this.mem.set(bytes);this.reg=Array(15).fill(0n);
      this.pc=0n;this.zf=false;this.sf=false;this.of=false;this.status='AOK';this.last=null;
    }
    read(address,length) {
      if(typeof address!=='bigint'||address<0n||!Number.isInteger(length)||length<0||address+BigInt(length)>BigInt(this.mem.length))throw new RangeError('address');
      return Number(address);
    }
    u64(address) {const p=this.read(address,8);let v=0n;for(let i=0;i<8;i++)v|=BigInt(this.mem[p+i])<<BigInt(8*i);return v;}
    put64(address,value) {const p=this.read(address,8),v=BigInt.asUintN(64,value);for(let i=0;i<8;i++)this.mem[p+i]=Number((v>>BigInt(8*i))&255n);}
    condition(fn) {
      const less=this.sf!==this.of;
      return [true,less||this.zf,less,this.zf,!this.zf,!less,!less&&!this.zf][fn];
    }
    invalid(){this.status='INS';this.last=null;return null;}
    step() {
      if(this.status!=='AOK')return null;
      try {
        const old=this.pc,p=this.read(old,1),byte=this.mem[p],code=byte>>4,fn=byte&15;
        const desc={pc:old};let next=old;
        if(code===0&&fn===0){this.status='HLT';this.last={...desc,name:'halt'};return this.last;}
        if(code===1&&fn===0){this.pc=old+1n;this.last={...desc,name:'nop'};return this.last;}
        if(code===2&&fn<=6){
          this.read(old,2);const ids=this.mem[p+1],a=ids>>4,b=ids&15;if(a===15||b===15)return this.invalid();
          const taken=this.condition(fn);if(taken)this.reg[b]=this.reg[a];this.pc=old+2n;
          this.last={...desc,name:fn===0?'rrmovq':'cmov',src:a,dst:b,taken,value:this.reg[b]};return this.last;
        }
        if(code===3&&fn===0){
          this.read(old,10);const ids=this.mem[p+1],a=ids>>4,b=ids&15;if(a!==15||b===15)return this.invalid();
          const v=this.u64(old+2n);this.reg[b]=v;this.pc=old+10n;this.last={...desc,name:'irmovq',dst:b,value:v};return this.last;
        }
        if(code===12&&fn===0){
          this.read(old,10);const ids=this.mem[p+1],a=ids>>4,b=ids&15;if(a!==15||b===15)return this.invalid();
          const x=this.u64(old+2n),y=this.reg[b],v=(x+y)&MASK;
          this.zf=v===0n;this.sf=!!(v&SIGN);this.of=!!(~(x^y)&(y^v)&SIGN);this.reg[b]=v;this.pc=old+10n;
          this.last={...desc,name:'iaddq',dst:b,value:v};return this.last;
        }
        if((code===4||code===5)&&fn===0){
          this.read(old,10);const ids=this.mem[p+1],a=ids>>4,b=ids&15;if(a===15||b===15)return this.invalid();
          const address=(this.reg[b]+this.u64(old+2n))&MASK;this.read(address,8);
          const value=code===4?this.reg[a]:this.u64(address);
          if(code===4)this.put64(address,value);else this.reg[a]=value;
          this.pc=old+10n;this.last={...desc,name:code===4?'rmmovq':'mrmovq',src:code===4?a:b,dst:code===4?b:a,address,value};return this.last;
        }
        if(code===6&&fn<=3){
          this.read(old,2);const ids=this.mem[p+1],a=ids>>4,b=ids&15;if(a===15||b===15)return this.invalid();
          const x=this.reg[a],y=this.reg[b];let v,overflow=false;
          if(fn===0){v=(y+x)&MASK;overflow=!!((~(x^y)&(y^v)&SIGN));}
          if(fn===1){v=(y-x)&MASK;overflow=!!(((y^x)&(y^v)&SIGN));}
          if(fn===2)v=y&x;if(fn===3)v=y^x;
          this.zf=v===0n;this.sf=!!(v&SIGN);this.of=overflow;this.reg[b]=v;this.pc=old+2n;
          this.last={...desc,name:['addq','subq','andq','xorq'][fn],src:a,dst:b,value:v};return this.last;
        }
        if(code===7&&fn<=6){
          this.read(old,9);const target=this.u64(old+1n),taken=this.condition(fn);this.pc=taken?target:old+9n;
          this.last={...desc,name:'jxx',target,taken};return this.last;
        }
        if(code===8&&fn===0){
          this.read(old,9);const target=this.u64(old+1n),sp=(this.reg[RSP]-8n)&MASK;this.read(sp,8);this.put64(sp,old+9n);this.reg[RSP]=sp;this.pc=target;
          this.last={...desc,name:'call',target,address:sp};return this.last;
        }
        if(code===9&&fn===0){
          const sp=this.reg[RSP],target=this.u64(sp);this.reg[RSP]=(sp+8n)&MASK;this.pc=target;this.last={...desc,name:'ret',target,address:sp};return this.last;
        }
        if((code===10||code===11)&&fn===0){
          this.read(old,2);const ids=this.mem[p+1],a=ids>>4,b=ids&15;if(a===15||b!==15)return this.invalid();
          const oldSp=this.reg[RSP];if(code===10){const sp=(oldSp-8n)&MASK,value=this.reg[a];this.read(sp,8);this.put64(sp,value);this.reg[RSP]=sp;this.last={...desc,name:'pushq',src:a,address:sp,value};}
          else {const value=this.u64(oldSp);this.reg[RSP]=(oldSp+8n)&MASK;this.reg[a]=value;this.last={...desc,name:'popq',dst:a,address:oldSp,value};}
          this.pc=old+2n;return this.last;
        }
        return this.invalid();
      } catch(err) {if(err instanceof RangeError){this.status='ADR';this.last=null;return null;}throw err;}
    }
  }
  const api={Y86Subset};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Y86Subset=Y86Subset;
})(typeof window==='undefined'?globalThis:window);
