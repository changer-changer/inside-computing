/* Buffer Lab legacy 浏览器模型：32 位栈、4 字节返回地址、movl 全局写与简单函数检查。
   不是官方 IA32 bufferlab；作为历史对照。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BufferSim = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var BUF = 0x5561dc00, BUF_SIZE = 32, RET_OFF = 36;
  var SMOKE = 0x08048b20, FIZZ = 0x08048b50, BOOM = 0x08048c00, SHELL = 0x08048d00;
  var BANG = 0x0804a1b0, COOKIE = 0x59b997fa;
  var LEVELS = [
    { id: 'smoke', name: 'Smoke', pts: 10, desc: '把返回地址改成 smoke。' },
    { id: 'fizz', name: 'Fizz', pts: 10, desc: '调用 fizz，并把 cookie 作为第一个栈参数。' },
    { id: 'bang', name: 'Bang', pts: 15, desc: '注入代码把全局变量 bang 改成 cookie，再安全返回 smoke。' },
    { id: 'boom', name: 'Boom', pts: 15, desc: '调用 boom，并把 cookie 作为第一个栈参数。' },
    { id: 'nitro', name: 'Nitro', pts: 10, desc: '调用 shell，并传入指向 "/bin/sh" 的指针。' }
  ];
  function parseHex(text) {
    if (typeof text !== 'string') throw new Error('payload 必须是十六进制文本');
    var clean = text.replace(/0x/gi, ' ').replace(/[^0-9a-fA-F]/g, ' ').trim();
    if (!clean) throw new Error('payload 为空');
    var parts = clean.split(/\s+/), out = [];
    for (var i = 0; i < parts.length; i++) { var p = parts[i]; if (p.length > 2) throw new Error('每个字节 1–2 位十六进制'); var v = parseInt(p, 16); if (isNaN(v)) throw new Error('无效字节'); out.push(v); }
    if (out.length > 160) throw new Error('payload 最多 160 字节');
    return Uint8Array.from(out);
  }
  function u32(a, off) { return (a[off] | (a[off+1] << 8) | (a[off+2] << 16) | (a[off+3] << 24)) >>> 0; }
  function qbytes(n) { var a = new Uint8Array(4); for (var i=0;i<4;i++) a[i]=(n >>> (8*i)) & 0xff; return a; }
  function hexBytes(a) { return Array.from(a).map(function (b) { return b.toString(16).padStart(2,'0'); }).join(' '); }
  function run(levelId, bytes) {
    var l = LEVELS.find(function (x) { return x.id === levelId; });
    if (!l) throw new Error('未知关卡');
    var mem = new Uint8Array(256); mem.set(bytes.slice(0, 256));
    var esp = RET_OFF + 4, eip = u32(mem, RET_OFF), trace = [], bang = 0;
    trace.push('getbuf ret → 0x' + eip.toString(16) + '（esp=0x' + esp.toString(16) + '）');
    function arg(i) { return u32(mem, esp + 4 * i); }
    for (var step = 0; step < 80; step++) {
      if (eip === SMOKE) {
        if (l.id !== 'smoke' && l.id !== 'bang') return { ok: false, reason: '调用了 smoke，但本关不是 Smoke', trace: trace };
        if (l.id === 'bang' && bang !== COOKIE) return { ok: false, reason: 'bang 没有被改成 cookie', trace: trace };
        trace.push('进入 smoke' + (l.id === 'bang' ? '（bang 已修改）' : ''));
        return { ok: true, reason: '调用了 smoke' + (l.id === 'bang' ? '，bang = cookie' : ''), trace: trace };
      }
      if (eip === FIZZ) {
        if (l.id !== 'fizz') return { ok: false, reason: '调用了 fizz，但本关不是 Fizz', trace: trace };
        var a = arg(0); trace.push('进入 fizz，arg0=0x' + a.toString(16));
        return { ok: a === COOKIE, reason: a === COOKIE ? 'fizz 收到 cookie' : 'fizz 参数不是 cookie', trace: trace };
      }
      if (eip === BOOM) {
        if (l.id !== 'boom') return { ok: false, reason: '调用了 boom，但本关不是 Boom', trace: trace };
        var b = arg(0); trace.push('进入 boom，arg0=0x' + b.toString(16));
        return { ok: b === COOKIE, reason: b === COOKIE ? 'boom 收到 cookie' : 'boom 参数不是 cookie', trace: trace };
      }
      if (eip === SHELL) {
        if (l.id !== 'nitro') return { ok: false, reason: '调用了 shell，但本关不是 Nitro', trace: trace };
        var ptr = arg(0), off = ptr - BUF, str = '';
        if (off >= 0 && off < 128) { for (var i = 0; i < 32 && off + i < 256; i++) { var ch = mem[off + i]; if (!ch) break; str += String.fromCharCode(ch); } }
        trace.push('进入 shell，arg0=0x' + ptr.toString(16) + ' → ' + JSON.stringify(str));
        return { ok: str === '/bin/sh', reason: str === '/bin/sh' ? 'shell 收到 /bin/sh' : 'shell 参数不是 /bin/sh', trace: trace };
      }
      if (eip >= BUF && eip < BUF + Math.max(16, bytes.length)) {
        var off2 = eip - BUF, op = mem[off2];
        if (op === 0xc3) { eip = u32(mem, esp); esp += 4; trace.push('ret → 0x' + eip.toString(16)); continue; }
        if (op === 0x90) { eip++; trace.push('nop'); continue; }
        if (op === 0xc7 && mem[off2 + 1] === 0x05) {
          var addr = u32(mem, off2 + 2), imm = u32(mem, off2 + 6);
          if (addr === BANG) { bang = imm; trace.push('movl $0x' + imm.toString(16) + ', bang'); }
          else trace.push('movl 到未知地址 0x' + addr.toString(16));
          eip += 10; continue;
        }
        return { ok: false, reason: '不支持的注入指令 0x' + op.toString(16), trace: trace };
      }
      return { ok: false, reason: '跳到未知地址 0x' + eip.toString(16), trace: trace };
    }
    return { ok: false, reason: '执行步数超限', trace: trace };
  }
  function referencePayload(id) {
    if (id === 'smoke') { var a = new Uint8Array(40); a.set(qbytes(SMOKE), RET_OFF); return a; }
    if (id === 'fizz') { var b = new Uint8Array(44); b.set(qbytes(FIZZ), RET_OFF); b.set(qbytes(COOKIE), 40); return b; }
    if (id === 'bang') { var c = new Uint8Array(44); c.set([0xc7,0x05,...Array.from(qbytes(BANG)),...Array.from(qbytes(COOKIE)),0xc3],0); c.set(qbytes(BUF), RET_OFF); c.set(qbytes(SMOKE),40); return c; }
    if (id === 'boom') { var d = new Uint8Array(44); d.set(qbytes(BOOM), RET_OFF); d.set(qbytes(COOKIE),40); return d; }
    if (id === 'nitro') { var e = new Uint8Array(60); e.set(qbytes(SHELL), RET_OFF); e.set(qbytes(BUF+44),40); for(var i=0;i<8;i++) e[44+i]='/bin/sh'.charCodeAt(i); e[52]=0; return e; }
    throw new Error('unknown');
  }
  return { BUF: BUF, RET_OFF: RET_OFF, COOKIE: COOKIE, LEVELS: LEVELS, parseHex: parseHex, run: run, referencePayload: referencePayload, qbytes: qbytes, hexBytes: hexBytes };
});
