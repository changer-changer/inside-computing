/* Five-stage Y86-64 teaching pipeline: predict taken, forward, stall and bubble. */
(function(root){'use strict';
const N=15, RSP=4, MASK=(1n<<64n)-1n, SIGN=1n<<63n;
const bubble=()=>({bubble:true,stat:'AOK',icode:1,ifun:0,rA:N,rB:N,valC:0n,valP:0n,pc:0n});
class Y86Pipeline {
 constructor(bytes,memorySize=4096,options={}){if(!(bytes instanceof Uint8Array)||!Number.isInteger(memorySize)||memorySize<bytes.length||memorySize<1)throw Error('invalid memory');this.enableIaddq=options.iaddq===true;this.control=options.control||null;if(this.control&&typeof this.control.run!=='function')throw Error('invalid control');this.mem=new Uint8Array(memorySize);this.mem.set(bytes);this.reg=Array(15).fill(0n);this.cc={zf:true,sf:false,of:false};this.F={predPC:0n};this.D=bubble();this.E=bubble();this.M=bubble();this.W=bubble();this.status='AOK';this.cycles=0;this.retired=0;this.last=null;}
 read(addr,n){if(addr<0n||addr+BigInt(n)>BigInt(this.mem.length))throw RangeError('address');return Number(addr);}
 u64(addr){let p=this.read(addr,8),v=0n;for(let i=0;i<8;i++)v|=BigInt(this.mem[p+i])<<BigInt(i*8);return v;}
 put64(addr,value){let p=this.read(addr,8);for(let i=0;i<8;i++)this.mem[p+i]=Number((value>>BigInt(i*8))&255n);}
 condition(fn){let l=this.cc.sf!==this.cc.of;return [true,l||this.cc.zf,l,this.cc.zf,!this.cc.zf,!l,!l&&!this.cc.zf][fn]??false;}
 fetch(pc){let f={...bubble(),bubble:false,pc};try{let p=this.read(pc,1),v=this.mem[p];f.icode=v>>4;f.ifun=v&15;const c=f.icode,n=f.ifun;
  // Official PIPE validates the instruction code, but does not reject other function or register encodings.
  const env={f_icode:c},valid=this.control?this.control.run('instr_valid',env)!==0n:(c<=11||(c===12&&this.enableIaddq));
  if(!valid&&!this.control)return {...f,stat:'INS'};
  const reg=this.control?this.control.run('need_regids',env)!==0n:[2,3,4,5,6,10,11,12].includes(c),imm=this.control?this.control.run('need_valC',env)!==0n:[3,4,5,7,8,12].includes(c);if(reg){this.read(pc+1n,1);let b=this.mem[p+1];f.rA=b>>4;f.rB=b&15;}
  f.valP=pc+1n+(reg?1n:0n)+(imm?8n:0n);if(imm)f.valC=this.u64(pc+1n+(reg?1n:0n));if(!valid)f.stat='INS';else if(c===0)f.stat='HLT';return f;
 }catch(e){if(e instanceof RangeError)return {...f,stat:'ADR'};throw e;}}
 step(){if(this.status!=='AOK')return null;const {D,E,M,W}=this;if(W.stat!=='AOK'){this.status=W.stat;return {cycle:this.cycles,halted:true,status:W.stat};}
  // Results are computed from the old pipeline registers, then latched together.
  let mval=0n,mstat=M.stat,memoryAccess=null;try{if([5,11,9].includes(M.icode)&&M.stat==='AOK'){const address=M.icode===5?M.valE:M.valA;mval=this.u64(address);memoryAccess={kind:'read',address,value:mval,size:8};}if([4,8,10].includes(M.icode)&&M.stat==='AOK'){this.put64(M.valE,M.valA);memoryAccess={kind:'write',address:M.valE,value:BigInt.asUintN(64,M.valA),size:8};}}catch(e){if(e instanceof RangeError)mstat='ADR';else throw e;}
  let a=0n,b=0n,c=E.icode;if([2,6].includes(c))a=E.valA;else if([3,4,5,12].includes(c))a=E.valC;else if([8,10].includes(c))a=MASK-7n;else if([9,11].includes(c))a=8n;if([4,5,6,8,9,10,11,12].includes(c))b=E.valB;
  if(this.control){const env={E_icode:c,E_valA:E.valA??0n,E_valB:E.valB??0n,E_valC:E.valC??0n};a=BigInt.asUintN(64,this.control.run('aluA',env));b=BigInt.asUintN(64,this.control.run('aluB',env));}
  let ev=0n,of=false;if(c===6&&E.ifun===1){ev=(b-a)&MASK;of=!!((b^a)&(b^ev)&SIGN);}else if(c===6&&E.ifun===2)ev=b&a;else if(c===6&&E.ifun===3)ev=b^a;else if(c===6&&E.ifun>3)ev=0n;else{ev=(b+a)&MASK;of=!!(~(a^b)&(b^ev)&SIGN);}
  let cond=this.condition(E.ifun),edst=E.dstE;if(c===2&&!cond)edst=N;
  const statusCode={AOK:1,HLT:2,ADR:3,INS:4};const ccEnabled=this.control?this.control.run('set_cc',{E_icode:c,m_stat:statusCode[mstat],W_stat:statusCode[W.stat]})!==0n:((c===6||c===12)&&!['ADR','INS','HLT'].includes(mstat)&&!['ADR','INS','HLT'].includes(W.stat));
  if(ccEnabled&&E.stat==='AOK')this.cc={zf:ev===0n,sf:!!(ev&SIGN),of};
  let dc=D.icode,srcA=[2,4,6,10].includes(dc)?D.rA:[9,11].includes(dc)?RSP:N,srcB=[4,5,6,12].includes(dc)?D.rB:[8,9,10,11].includes(dc)?RSP:N,dstE=[2,3,6,12].includes(dc)?D.rB:[8,9,10,11].includes(dc)?RSP:N,dstM=[5,11].includes(dc)?D.rA:N;
  if(this.control){const env={D_icode:dc,D_rB:D.rB};srcB=Number(this.control.run('d_srcB',env));dstE=Number(this.control.run('d_dstE',env));if(!Number.isInteger(srcB)||srcB<0||srcB>15||!Number.isInteger(dstE)||dstE<0||dstE>15)throw Error('控制规则输出的寄存器编号必须在 0 到 15 之间');}
  const forward=r=>r===N?0n:r===edst?ev:r===M.dstM?mval:r===M.dstE?M.valE:r===W.dstM?W.valM:r===W.dstE?W.valE:this.reg[r];
  const da=[7,8].includes(dc)?D.valP:forward(srcA),db=forward(srcB);
  const pc=M.icode===7&&!M.Cnd?M.valA:W.icode===9?W.valM:this.F.predPC,f=this.fetch(pc),pred=[7,8].includes(f.icode)?f.valC:f.valP;
  const loadUse=[5,11].includes(E.icode)&&(E.dstM===srcA||E.dstM===srcB)&&E.dstM!==N,ret=[D.icode,E.icode,M.icode].includes(9),mispredict=E.icode===7&&!cond;
  const henv={D_icode:D.icode,E_icode:E.icode,M_icode:M.icode,E_dstM:E.dstM??N,d_srcA:srcA,d_srcB:srcB,e_Cnd:cond?1:0};
  const ctl=this.control?Object.fromEntries(['F_stall','D_stall','D_bubble','E_bubble'].map(name=>[name,this.control.run(name,henv)!==0n])):{F_stall:loadUse||ret,D_stall:loadUse,D_bubble:mispredict||(!loadUse&&ret),E_bubble:loadUse||mispredict};
  if(ctl.D_stall&&ctl.D_bubble)throw Error('D_stall 和 D_bubble 不能同时为真');
  if(W.dstE!==undefined&&W.dstE!==N)this.reg[W.dstE]=W.valE;if(W.dstM!==undefined&&W.dstM!==N)this.reg[W.dstM]=W.valM;
  if(!W.bubble&&W.stat==='AOK')this.retired++;if(W.stat!=='AOK')this.status=W.stat;
  this.W={...M,stat:mstat,valM:mval};this.M={...E,Cnd:cond,valE:ev,dstE:edst};
  this.E=ctl.E_bubble?bubble():{...D,srcA,srcB,dstE,dstM,valA:da,valB:db};
  this.D=ctl.D_stall?D:ctl.D_bubble?bubble():f;this.F={predPC:ctl.F_stall?this.F.predPC:pred};
  this.cycles++;this.last={cycle:this.cycles,fetchPC:pc,stages:{F:f,D,E,M,W},loadUse,retStall:ret,branchRecovery:mispredict,memoryAccess,controlSignals:{srcB,dstE,aluA:a,aluB:b,setCC:ccEnabled,...ctl}};return this.last;
 }
}
const api={Y86Pipeline};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Y86Pipeline=Y86Pipeline;
})(typeof window==='undefined'?globalThis:window);
