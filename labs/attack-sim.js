/* Attack Lab 浏览器模型：固定栈布局 + 受限 x86 子集 + 符号 gadget。
   用于在浏览器里练习 payload 布局/ROP；不是官方 ctarget/rtarget。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AttackSim = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var BUF = 0x5561dc78, BUF_SIZE = 64, RET_OFF = 72, FRAME = 0x5561dc00, MEM_SIZE = 512;
  var TOUCH1 = 0x4017c0, TOUCH2 = 0x4017ec, TOUCH3 = 0x4018fa;
  var POP_RDI = 0x4019ab, MOV_RDI_RSP = 0x401a06, LEA_RDI_16 = 0x4019dd;
  var COOKIE = 0x59b997fa, COOKIE_STR = '59b997fa';
  var LEVELS = [
    { id: 'touch1', name: 'Touch 1', pts: 15, nx: false, desc: '把 getbuf 的返回地址改成 touch1。' },
    { id: 'touch2', name: 'Touch 2', pts: 20, nx: false, desc: '让 %rdi = cookie，再跳到 touch2。' },
    { id: 'touch3', name: 'Touch 3', pts: 20, nx: false, desc: '让 %rdi 指向 cookie 的十六进制字符串，再跳到 touch3。' },
    { id: 'fire2', name: 'Fire 2', pts: 20, nx: true, desc: '栈不可执行：只用 gadget 设置 %rdi，再调用 touch2。' },
    { id: 'fire3', name: 'Fire 3', pts: 25, nx: true, desc: '栈不可执行：只用 gadget 让 %rdi 指向 cookie 字符串，再调用 touch3。' }
  ];
  var GADGETS = [
    { addr: POP_RDI, name: 'pop %rdi; ret', bytes: '5f c3', effect: 'pop rdi' },
    { addr: MOV_RDI_RSP, name: 'mov %rsp,%rdi; ret', bytes: '48 89 e7 c3', effect: 'rdi=rsp' },
    { addr: LEA_RDI_16, name: 'lea 16(%rdi),%rdi; ret', bytes: '48 8d 7f 10 c3', effect: 'rdi+=16' }
  ];

  function parseHex(text) {
    if (typeof text !== 'string') throw new Error('payload 必须是十六进制文本');
    var clean = text.replace(/0x/gi, ' ').replace(/[^0-9a-fA-F]/g, ' ').trim();
    if (!clean) throw new Error('payload 为空');
    var parts = clean.split(/\s+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.length > 2) throw new Error('每个字节应为 1–2 位十六进制：' + p);
      var v = parseInt(p, 16); if (isNaN(v)) throw new Error('无效字节：' + p);
      out.push(v);
    }
    if (out.length > 200) throw new Error('payload 最多 200 字节');
    return Uint8Array.from(out);
  }
  function qbytes(n) { var a = new Uint8Array(8), v = BigInt.asUintN(64, BigInt(n)); for (var i = 0; i < 8; i++) a[i] = Number((v >> BigInt(8 * i)) & 255n); return a; }
  function hexBytes(a) { return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(' '); }
  function makePayload(fill, ret, extras) {
    var buf = new Uint8Array(FRAME + MEM_SIZE);
    if (fill) buf.set(fill, BUF - FRAME);
    if (ret != null) buf.set(qbytes(ret), BUF - FRAME + RET_OFF);
    if (extras) Object.keys(extras).forEach(function (k) { buf.set(qbytes(extras[k]), BUF - FRAME + Number(k)); });
    return buf;
  }

  function run(levelId, payloadBytes) {
    var level = LEVELS.find(function (l) { return l.id === levelId; });
    if (!level) throw new Error('未知关卡');
    if (!(payloadBytes instanceof Uint8Array)) throw new Error('payload 类型错误');
    var mem = new Uint8Array(MEM_SIZE);
    if (payloadBytes.length > BUF_SIZE + 128) throw new Error('payload 超出模型内存');
    mem.set(payloadBytes.slice(0, MEM_SIZE), BUF - FRAME);
    function readQ(addr) {
      var off = addr - FRAME, v = 0n;
      for (var i = 0; i < 8; i++) { var b = mem[off + i]; if (b === undefined) throw new Error('读取栈外地址 0x' + addr.toString(16)); v |= BigInt(b) << BigInt(8 * i); }
      return v;
    }
    function readByte(addr) { var off = addr - FRAME; if (off < 0 || off >= MEM_SIZE) throw new Error('读取栈外地址'); return mem[off]; }
    function readString(addr) {
      var s = '', off = addr - FRAME;
      if (off < 0 || off >= MEM_SIZE) return null;
      for (var i = 0; i < 64 && off + i < MEM_SIZE; i++) { var b = mem[off + i]; if (b === 0) return s; s += String.fromCharCode(b); }
      return s;
    }
    var rsp = BUF + 80, rdi = 0n, trace = [];
    try {
      if (payloadBytes.length <= RET_OFF + 7) return { ok: false, reason: 'payload 太短：没有覆盖返回地址', trace: trace, rdi: '0x0' };
      var rip = Number(readQ(BUF + RET_OFF));
      trace.push('getbuf ret → 0x' + rip.toString(16) + '（rsp=0x' + rsp.toString(16) + '）');
      for (var step = 0; step < 80; step++) {
        if (rip === TOUCH1) { if (level.id !== 'touch1') return { ok: false, reason: '调用了 touch1，但本关不是 Touch 1', trace: trace, rdi: '0x' + rdi.toString(16) }; trace.push('进入 touch1'); return { ok: true, reason: '调用了 touch1', trace: trace, rdi: '0x' + rdi.toString(16) }; }
        if (rip === TOUCH2) {
          if (level.id !== 'touch2' && level.id !== 'fire2') return { ok: false, reason: '调用了 touch2，但本关不是 Touch 2/Fire 2', trace: trace, rdi: '0x' + rdi.toString(16) };
          var ok2 = rdi === BigInt(COOKIE);
          trace.push('进入 touch2，%rdi=0x' + rdi.toString(16) + (ok2 ? ' ✓' : ' ✗'));
          return { ok: ok2, reason: ok2 ? 'touch2 收到 cookie' : 'touch2 的 %rdi 不是 cookie', trace: trace, rdi: '0x' + rdi.toString(16) };
        }
        if (rip === TOUCH3) {
          if (level.id !== 'touch3' && level.id !== 'fire3') return { ok: false, reason: '调用了 touch3，但本关不是 Touch 3/Fire 3', trace: trace, rdi: '0x' + rdi.toString(16) };
          var s = readString(Number(rdi));
          var ok3 = s === COOKIE_STR;
          trace.push('进入 touch3，%rdi=0x' + rdi.toString(16) + '，字符串=' + JSON.stringify(s));
          return { ok: ok3, reason: ok3 ? 'touch3 收到 cookie 字符串' : 'touch3 的字符串不是 cookie', trace: trace, rdi: '0x' + rdi.toString(16) };
        }
        if (level.nx && rip === BUF) return { ok: false, reason: 'RTARGET 栈不可执行：返回到了 buffer', trace: trace, rdi: '0x' + rdi.toString(16) };
        var gadget = GADGETS.find(function (g) { return g.addr === rip; });
        if (gadget) {
          if (gadget.effect === 'pop rdi') { rdi = readQ(rsp); rsp += 8; }
          else if (gadget.effect === 'rdi=rsp') { rdi = BigInt(rsp); }
          else if (gadget.effect === 'rdi+=16') { rdi += 16n; }
          rip = Number(readQ(rsp)); rsp += 8;
          trace.push('gadget ' + gadget.name + ' → rip=0x' + rip.toString(16) + '，rdi=0x' + rdi.toString(16));
          continue;
        }
        if (rip >= BUF && rip < BUF + Math.max(16, payloadBytes.length)) {
          var b0 = readByte(rip);
          if (b0 === 0xc3) { rip = Number(readQ(rsp)); rsp += 8; trace.push('ret → 0x' + rip.toString(16)); continue; }
          if (b0 === 0x90) { rip++; trace.push('nop'); continue; }
          if (b0 === 0x5f) { rdi = readQ(rsp); rsp += 8; rip++; trace.push('pop %rdi'); continue; }
          if (b0 === 0x48 && readByte(rip + 1) === 0xbf) {
            var imm = 0n; for (var i = 0; i < 8; i++) imm |= BigInt(readByte(rip + 2 + i)) << BigInt(8 * i);
            rdi = imm; rip += 10; trace.push('mov $0x' + imm.toString(16) + ',%rdi'); continue;
          }
          if (b0 === 0x48 && readByte(rip + 1) === 0xc7 && readByte(rip + 2) === 0xc7) {
            var v = readByte(rip + 3) | (readByte(rip + 4) << 8) | (readByte(rip + 5) << 16) | (readByte(rip + 6) << 24);
            rdi = BigInt.asUintN(64, BigInt(v | 0)); rip += 7; trace.push('mov $0x' + rdi.toString(16) + ',%rdi'); continue;
          }
          if (b0 === 0x48 && readByte(rip + 1) === 0x89 && readByte(rip + 2) === 0xe7) { rdi = BigInt(rsp); rip += 3; trace.push('mov %rsp,%rdi'); continue; }
          if (b0 === 0x48 && readByte(rip + 1) === 0x8d && readByte(rip + 2) === 0x7c && readByte(rip + 3) === 0x24) { var d = (readByte(rip + 4) << 24) >> 24; rdi = BigInt(rsp + d); rip += 5; trace.push('lea ' + d + '(%rsp),%rdi'); continue; }
          if (b0 === 0x48 && readByte(rip + 1) === 0x8d && readByte(rip + 2) === 0x7f) { var d2 = (readByte(rip + 3) << 24) >> 24; rdi += BigInt(d2); rip += 4; trace.push('lea ' + d2 + '(%rdi),%rdi'); continue; }
          return { ok: false, reason: '不支持的注入指令字节 0x' + b0.toString(16) + ' @0x' + rip.toString(16), trace: trace, rdi: '0x' + rdi.toString(16) };
        }
        return { ok: false, reason: '执行跳到了未知地址 0x' + rip.toString(16), trace: trace, rdi: '0x' + rdi.toString(16) };
      }
      return { ok: false, reason: '执行步数超限', trace: trace, rdi: '0x' + rdi.toString(16) };
    } catch (e) { return { ok: false, reason: e.message, trace: trace, rdi: '0x' + rdi.toString(16) }; }
  }

  function referencePayload(levelId) {
    var zero = new Uint8Array(80);
    if (levelId === 'touch1') { var a = new Uint8Array(80); a.set(qbytes(TOUCH1), RET_OFF); return a; }
    if (levelId === 'touch2') {
      var b = new Uint8Array(88); b.set([0x48,0xbf,...Array.from(qbytes(COOKIE)),0xc3],0); b.set(qbytes(BUF),RET_OFF); b.set(qbytes(TOUCH2),80); return b;
    }
    if (levelId === 'touch3') {
      var c = new Uint8Array(120); c.set([0x48,0xbf,...Array.from(qbytes(BUF+88)),0xc3],0); c.set(qbytes(BUF),RET_OFF); c.set(qbytes(TOUCH3),80); for(var i=0;i<9;i++) c[88+i]=COOKIE_STR.charCodeAt(i); return c;
    }
    if (levelId === 'fire2') { var d = new Uint8Array(96); d.set(qbytes(POP_RDI),RET_OFF); d.set(qbytes(COOKIE),80); d.set(qbytes(TOUCH2),88); return d; }
    if (levelId === 'fire3') { var e = new Uint8Array(120); e.set(qbytes(MOV_RDI_RSP),RET_OFF); e.set(qbytes(LEA_RDI_16),80); e.set(qbytes(TOUCH3),88); for(var j=0;j<9;j++) e[96+j]=COOKIE_STR.charCodeAt(j); return e; }
    throw new Error('未知关卡');
  }

  return { BUF: BUF, BUF_SIZE: BUF_SIZE, RET_OFF: RET_OFF, TOUCH1: TOUCH1, TOUCH2: TOUCH2, TOUCH3: TOUCH3, POP_RDI: POP_RDI, MOV_RDI_RSP: MOV_RDI_RSP, LEA_RDI_16: LEA_RDI_16, COOKIE: COOKIE, COOKIE_STR: COOKIE_STR, LEVELS: LEVELS, GADGETS: GADGETS, parseHex: parseHex, run: run, referencePayload: referencePayload, qbytes: qbytes, hexBytes: hexBytes };
});
