/* Inspect IEEE 754 binary32 bit patterns without canonicalising NaN payloads. */
(function(root){'use strict';
 function parseHex(text){
  if(typeof text!=='string'||! /^(?:0x)?[0-9a-f]{8}$/i.test(text.trim()))throw Error('请输入 8 位十六进制数');
  return parseInt(text.trim().replace(/^0x/i,''),16)>>>0;
 }
 function encodeDecimal(text){
  if(typeof text!=='string'||text.trim().length>256)throw Error('请输入不超过 256 个字符的十进制数');
  const trimmed=text.trim(),match=trimmed.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i);
  const special=trimmed.match(/^([+-]?)infinity$/i);
  if(!match&&!special)throw Error('请输入十进制数或 Infinity');
  const negative=(match||special)[1]==='-',sign=negative?0x80000000:0;
  if(special)return {bits:(sign|0x7f800000)>>>0};
  const fractional=match[3]??match[4]??'',digits=((match[2]||'')+fractional).replace(/^0+/,'');
  if(!digits)return {bits:sign>>>0};
  const scale=Number(match[5]||0)-fractional.length,order=digits.length+scale;
  if(order>40)return {bits:(sign|0x7f800000)>>>0};
  if(order< -60)return {bits:sign>>>0};
  let numerator=BigInt(digits),denominator=1n;
  if(scale>=0)numerator*=10n**BigInt(scale);else denominator=10n**BigInt(-scale);
  const roundEven=(a,b)=>{let q=a/b,r=a%b;if(2n*r>b||(2n*r===b&&(q&1n)))q++;return q;};
  let exp=numerator.toString(2).length-denominator.toString(2).length;
  if(exp>=0 ? numerator < (denominator<<BigInt(exp)) : (numerator<<BigInt(-exp)) < denominator)exp--;
  let payload;
  if(exp< -126){payload=Number(roundEven(numerator<<149n,denominator));}
  else if(exp>127){payload=0x7f800000;}
  else{
   const shift=23-exp;
   let mantissa=shift>=0?roundEven(numerator<<BigInt(shift),denominator):roundEven(numerator,denominator<<BigInt(-shift));
   if(mantissa===0x1000000n){mantissa>>=1n;exp++;}
   payload=exp>127?0x7f800000:((exp+127)*0x800000+Number(mantissa)-0x800000);
  }
  return {bits:(sign|payload)>>>0};
 }
 function decode(bits){
  if(!Number.isInteger(bits)||bits<0||bits>0xffffffff)throw Error('位模式必须是 32 位无符号整数');
  const sign=bits>>>31,exponent=(bits>>>23)&255,fraction=bits&0x7fffff;
  const view=new DataView(new ArrayBuffer(4));view.setUint32(0,bits,false);
  const value=view.getFloat32(0,false);
  let kind,unbiased=null,significand=null;
  if(exponent===255)kind=fraction===0?'infinity':'nan';
  else if(exponent===0){kind=fraction===0?'zero':'subnormal';unbiased=-126;significand=fraction/0x800000;}
  else{kind='normal';unbiased=exponent-127;significand=1+fraction/0x800000;}
  return {bits:bits>>>0,hex:(bits>>>0).toString(16).padStart(8,'0'),sign,exponent,fraction,kind,unbiased,significand,value,
   signBits:String(sign),exponentBits:exponent.toString(2).padStart(8,'0'),fractionBits:fraction.toString(2).padStart(23,'0')};
 }
 const api={parseHex,encodeDecimal,decode};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Float32Lab=api;
})(typeof window==='undefined'?globalThis:window);
