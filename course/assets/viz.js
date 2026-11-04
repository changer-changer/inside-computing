/* 计算之境 · 课程可视化小部件
   只做 2D/轻量交互；3D 空间模型仍由主实验台承担。 */
(function () {
  'use strict';
  var CA = window.CA = window.CA || {};
  var V = CA.viz = CA.viz || {};
  function h(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return CA.esc(s); }
  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function panel(title, body, foot, tools) {
    return '<div class="viz"><div class="viz-head"><div class="viz-title">' + title + '</div><div class="viz-tools">' + (tools || '') + '</div></div>' +
      '<div class="viz-body">' + body + '</div>' + (foot ? '<div class="viz-foot">' + foot + '</div>' : '') + '</div>';
  }
  function signed32(v) { return v | 0; }
  function hex32(v) { return (v >>> 0).toString(16).toUpperCase().padStart(8, '0'); }
  function bin32(v) { return (v >>> 0).toString(2).padStart(32, '0'); }

  /* 32-bit surgery table */
  V.bitLab = function (root, opts) {
    opts = opts || {};
    var state = { v: opts.value == null ? 0xDEADBEEF : (opts.value >>> 0) };
    var wrap = h(panel('32 位手术台 · BIT SURGERY',
      '<div class="bit-grid" data-grid role="group" aria-label="32 个比特，点击翻转"></div>' +
      '<div class="bit-legend"><span>bit 31 · 符号/最高位</span><span>bit 0 · 最低位</span></div>' +
      '<div class="readout"><div><span>HEX</span><b class="lime" data-hex>0x00000000</b></div><div><span>UNSIGNED</span><b data-uns>0</b></div><div><span>SIGNED</span><b class="teal" data-sgn>0</b></div><div><span>BINARY</span><b data-bin style="font-size:9px;letter-spacing:.04em">0</b></div></div>' +
      '<div class="hex-input"><label class="field"><span>输入十六进制</span><input data-in value="DEADBEEF" maxlength="10" spellcheck="false" aria-label="输入 32 位十六进制"></label><button class="btn sm" type="button" data-set>写入</button><button class="btn sm" type="button" data-neg>取反 ~x</button><button class="btn sm" type="button" data-inc>加一 +1</button></div>' +
      '<div class="control-row" data-presets><label>预设</label></div>',
      '点击任意位翻转；十六进制可输入 1–8 位。这是位级视图，不改变主实验台状态。',
      '<span class="badge plain">32-BIT</span>'));
    var grid = q('[data-grid]', wrap), input = q('[data-in]', wrap);
    function render() {
      var v = state.v >>> 0;
      grid.innerHTML = '';
      for (var b = 31; b >= 0; b--) {
        var on = !!((v >>> b) & 1);
        var cell = document.createElement('button');
        cell.type = 'button'; cell.className = 'bit-cell' + (on ? ' on' : '');
        cell.textContent = on ? '1' : '0';
        cell.setAttribute('aria-label', '第 ' + b + ' 位，当前 ' + (on ? 1 : 0));
        cell.setAttribute('aria-pressed', String(on));
        cell.addEventListener('click', function (bit) { return function () { state.v = (state.v ^ (1 << bit)) >>> 0; render(); if (opts.onChange) opts.onChange(state.v); }; }(b));
        grid.appendChild(cell);
      }
      q('[data-hex]', wrap).textContent = '0x' + hex32(v);
      q('[data-uns]', wrap).textContent = String(v);
      q('[data-sgn]', wrap).textContent = String(v | 0);
      q('[data-bin]', wrap).textContent = bin32(v);
      input.value = hex32(v);
    }
    q('[data-set]', wrap).addEventListener('click', function () {
      var raw = input.value.trim().replace(/^0x/i, '');
      if (!/^[0-9a-f]{1,8}$/i.test(raw)) { CA.toast('请输入 1–8 位十六进制'); return; }
      state.v = parseInt(raw, 16) >>> 0; render();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') q('[data-set]', wrap).click(); });
    q('[data-neg]', wrap).addEventListener('click', function () { state.v = (~state.v) >>> 0; render(); });
    q('[data-inc]', wrap).addEventListener('click', function () { state.v = (state.v + 1) >>> 0; render(); });
    var presets = [['0', 0], ['1', 1], ['-1 = 0xFFFFFFFF', 0xFFFFFFFF], ['INT_MAX', 0x7FFFFFFF], ['INT_MIN', 0x80000000], ['0xAAAAAAAA', 0xAAAAAAAA], ['0xDEADBEEF', 0xDEADBEEF]];
    presets.forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = p[0];
      b.addEventListener('click', function () { state.v = p[1] >>> 0; render(); });
      q('[data-presets]', wrap).appendChild(b);
    });
    root.appendChild(wrap); render();
    return { set: function (v) { state.v = v >>> 0; render(); }, get: function () { return state.v >>> 0; } };
  };

  /* 8-bit two's complement wheel */
  V.twosWheel = function (root) {
    var wrap = h(panel('补码轮盘 · 8 位',
      '<div class="circle-wrap"><svg viewBox="0 0 240 240" role="img" aria-label="8 位补码轮盘">' +
      '<circle cx="120" cy="120" r="88" fill="none" stroke="rgba(200,230,205,.15)" stroke-width="14"/>' +
      '<circle cx="120" cy="120" r="88" fill="none" stroke="rgba(200,229,143,.55)" stroke-width="2" stroke-dasharray="4 7"/>' +
      '<g data-labels font-family="ui-monospace,monospace" font-size="10" fill="#9fb3a6" text-anchor="middle"></g>' +
      '<g data-pointer><line x1="120" y1="120" x2="120" y2="42" stroke="#c8e58f" stroke-width="2"/><circle cx="120" cy="42" r="5" fill="#c8e58f"/></g>' +
      '<text x="120" y="114" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#71867b">VALUE</text>' +
      '<text x="120" y="138" text-anchor="middle" font-family="ui-monospace,monospace" font-size="22" fill="#e9f1e7" data-center>0</text></svg>' +
      '<div style="flex:1;min-width:220px"><p style="font-size:12px;color:var(--dim);margin:0 0 10px">同一个 8 位模式，既可以读成 0–255 的无符号数，也可以读成 −128–127 的补码。指针沿圆周走，越过 127 就“绕回”−128。</p>' +
      '<div class="slider-line"><input type="range" min="0" max="255" value="0" data-slider aria-label="8 位无符号值"><b data-uns>0</b></div>' +
      '<div class="readout" style="grid-template-columns:1fr 1fr"><div><span>无符号</span><b data-u2>0</b></div><div><span>补码</span><b class="teal" data-s2>0</b></div></div>' +
      '<div class="control-row"><button class="btn sm" type="button" data-p127>127</button><button class="btn sm" type="button" data-p128>128</button><button class="btn sm" type="button" data-p255>255</button></div></div></div>',
      '轮盘是 8 位教学模型；32 位补码使用同一规则，只是位数更多。'));
    var slider = q('[data-slider]', wrap), labels = q('[data-labels]', wrap);
    var marks = [[0, '0'], [32, '+32'], [64, '+64'], [96, '+96'], [127, '+127'], [128, '−128'], [160, '−96'], [192, '−64'], [224, '−32'], [255, '−1']];
    labels.innerHTML = marks.map(function (m) {
      var a = (m[0] / 256) * Math.PI * 2 - Math.PI / 2, r = 110;
      return '<text x="' + (120 + r * Math.cos(a)).toFixed(1) + '" y="' + (120 + r * Math.sin(a) + 3).toFixed(1) + '">' + m[1] + '</text>';
    }).join('');
    function render() {
      var u = parseInt(slider.value, 10), s = u < 128 ? u : u - 256;
      var a = (u / 256) * 360;
      q('[data-pointer]', wrap).setAttribute('transform', 'rotate(' + a + ' 120 120)');
      q('[data-center]', wrap).textContent = String(s);
      q('[data-uns]', wrap).textContent = String(u);
      q('[data-u2]', wrap).textContent = String(u);
      q('[data-s2]', wrap).textContent = String(s);
    }
    slider.addEventListener('input', render);
    q('[data-p127]', wrap).addEventListener('click', function () { slider.value = 127; render(); });
    q('[data-p128]', wrap).addEventListener('click', function () { slider.value = 128; render(); });
    q('[data-p255]', wrap).addEventListener('click', function () { slider.value = 255; render(); });
    root.appendChild(wrap); render();
  };

  /* overflow experiment */
  V.overflow = function (root) {
    var wrap = h(panel('整数溢出实验 · 32 位',
      '<div class="grid-2"><label class="field"><span>x（十进制或 0x 十六进制）</span><input data-x value="2147483647" spellcheck="false"></label><label class="field"><span>y</span><input data-y value="1" spellcheck="false"></label></div>' +
      '<div class="control-row"><button class="btn sm" type="button" data-add>计算 x + y</button><button class="btn sm" type="button" data-preset="max">INT_MAX + 1</button><button class="btn sm" type="button" data-preset="umax">UINT_MAX + 1</button><button class="btn sm" type="button" data-preset="neg">−1 + 1</button></div>' +
      '<div class="readout"><div><span>32 位结果（十六进制）</span><b class="lime" data-rhex>—</b></div><div><span>有符号解释</span><b class="teal" data-rs>—</b></div><div><span>无符号解释</span><b data-ru>—</b></div><div><span>标志</span><b data-flags style="font-size:11px">—</b></div></div>' +
      '<div class="callout warn" style="margin-bottom:0"><div class="c-title">C 语言中的现实</div><p>有符号整数溢出在 C 中是未定义行为（UB），编译器可以假设它从不发生；无符号运算按 2³² 取模。上面的“环绕”是硬件补码加法的结果，不代表 C 程序可以依赖它。</p></div>',
      '输入按 32 位截断；结果展示的是位模式，不改变课程实验台。'));
    var xi = q('[data-x]', wrap), yi = q('[data-y]', wrap);
    function parse(text) {
      text = String(text).trim();
      if (/^[+-]?0x[0-9a-f]+$/i.test(text)) return parseInt(text.replace(/^[+-]?0x/i, ''), 16) >>> 0;
      if (/^[+-]?\d+$/.test(text)) return Number(BigInt.asUintN(32, BigInt(text)));
      throw new Error('请输入十进制或 0x 十六进制整数');
    }
    function calc() {
      try {
        var x = parse(xi.value), y = parse(yi.value);
        var sum = (x + y) >>> 0, sx = x | 0, sy = y | 0, ss = (sum | 0);
        var carry = (x + y) > 0xFFFFFFFF;
        var ovf = ((sx ^ ss) & (sy ^ ss)) < 0;
        q('[data-rhex]', wrap).textContent = '0x' + hex32(sum);
        q('[data-rs]', wrap).textContent = String(ss);
        q('[data-ru]', wrap).textContent = String(sum);
        q('[data-flags]', wrap).textContent = (carry ? '进位 ' : '') + (ovf ? '有符号溢出' : (carry ? '仅无符号进位' : '无溢出'));
        q('[data-flags]', wrap).style.color = ovf ? 'var(--red)' : 'var(--dim)';
      } catch (e) { CA.toast(e.message); }
    }
    q('[data-add]', wrap).addEventListener('click', calc);
    qa('[data-preset]', wrap).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-preset');
        if (k === 'max') { xi.value = '2147483647'; yi.value = '1'; }
        if (k === 'umax') { xi.value = '4294967295'; yi.value = '1'; }
        if (k === 'neg') { xi.value = '-1'; yi.value = '1'; }
        calc();
      });
    });
    [xi, yi].forEach(function (el) { el.addEventListener('keydown', function (e) { if (e.key === 'Enter') calc(); }); });
    root.appendChild(wrap); calc();
  };

  /* IEEE 754 binary32 explorer */
  V.floatExplorer = function (root) {
    var wrap = h(panel('IEEE 754 binary32 拆解器',
      '<div class="float-fields"><div class="float-field sign"><span>SIGN</span><b data-sign>0</b></div><div class="float-field exp"><span>EXPONENT</span><b data-exp>00000000</b></div><div class="float-field frac"><span>FRACTION</span><b data-frac style="font-size:10px;letter-spacing:.08em">0</b></div></div>' +
      '<div class="readout"><div><span>HEX</span><b class="lime" data-hex>0x00000000</b></div><div><span>值</span><b class="teal" data-val>0</b></div><div><span>类别</span><b data-kind>零</b></div><div><span>实际指数</span><b data-unbiased>—</b></div></div>' +
      '<div class="hex-input"><label class="field"><span>位模式（8 位十六进制）</span><input data-in value="3F800000" maxlength="10" spellcheck="false"></label><button class="btn sm" type="button" data-set>写入</button>' +
      '<label class="field"><span>十进制数（按最近偶数舍入）</span><input data-dec value="0.1" spellcheck="false"></label><button class="btn sm" type="button" data-enc>编码</button></div>' +
      '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:11.5px;color:var(--dim)">逐位修改（32 位）</summary><div data-bits style="margin-top:8px"></div></details>' +
      '<div class="control-row" data-presets><label>示例</label></div>' +
      '<div class="callout info" style="margin-bottom:0" data-explain><div class="c-title">读法</div><p></p></div>',
      'binary32 = 1 位符号 + 8 位指数（偏置 127）+ 23 位小数；指数全 0/全 1 有特殊含义。',
      '<span class="badge plain">FLOAT32</span>'));
    var FL = window.Float32Lab;
    if (!FL) { root.appendChild(h('<div class="callout warn"><div class="c-title">引擎未载入</div><p>请确认 float32-lab.js 已加载。</p></div>')); return; }
    var bits = 0x3F800000;
    var input = q('[data-in]', wrap), dec = q('[data-dec]', wrap), bitbox = q('[data-bits]', wrap);
    var kinds = { zero: '零', subnormal: '非规格化数', normal: '规格化数', infinity: '无穷大', nan: 'NaN' };
    function fmtValue(r) {
      if (r.kind === 'nan') return 'NaN';
      if (r.kind === 'infinity') return r.sign ? '−∞' : '+∞';
      if (r.kind === 'zero') return r.sign ? '−0' : '+0';
      return String(r.value);
    }
    function render() {
      var r = FL.decode(bits);
      q('[data-sign]', wrap).textContent = r.signBits;
      q('[data-exp]', wrap).textContent = r.exponentBits;
      q('[data-frac]', wrap).textContent = r.fractionBits;
      q('[data-hex]', wrap).textContent = '0x' + r.hex.toUpperCase();
      q('[data-val]', wrap).textContent = fmtValue(r);
      q('[data-kind]', wrap).textContent = kinds[r.kind];
      q('[data-unbiased]', wrap).textContent = r.unbiased == null ? '—' : String(r.unbiased);
      input.value = r.hex.toUpperCase();
      var exp = r.kind === 'normal' ? '指数 ' + r.exponent + ' − 127 = ' + r.unbiased + '；有效数 = 1 + ' + (r.fraction / 0x800000).toFixed(6) + '。' :
        r.kind === 'subnormal' ? '指数全 0；有效数 = ' + (r.fraction / 0x800000).toFixed(6) + '，实际指数 −126（非规格化）。' :
          r.kind === 'zero' ? '指数和小数全 0；符号位区分 +0 与 −0。' :
            r.kind === 'infinity' ? '指数全 1、小数全 0；符号位决定正负无穷。' :
              '指数全 1、小数非 0；这是一个 NaN，小数字段保留负载。';
      q('[data-explain] p', wrap).textContent = exp + ' 十进制值按最近的 binary32 表示舍入；显示的是 JavaScript 读出的 float32 近似值。';
      bitbox.innerHTML = '<div class="bit-row" data-row-sign></div><div class="bit-row" data-row-exp></div><div class="bit-row" data-row-frac></div>';
      function row(sel, hi, lo) {
        var el = q(sel, bitbox);
        for (var b = hi; b >= lo; b--) {
          (function (bit) {
            var btn = document.createElement('button'); btn.type = 'button';
            var on = !!((bits >>> bit) & 1); btn.textContent = on ? '1' : '0';
            if (on) btn.classList.add('on');
            btn.setAttribute('aria-label', '第 ' + bit + ' 位');
            btn.addEventListener('click', function () { bits = (bits ^ (1 << bit)) >>> 0; render(); });
            el.appendChild(btn);
          })(b);
        }
      }
      row('[data-row-sign]', 31, 31); row('[data-row-exp]', 30, 23); row('[data-row-frac]', 22, 0);
    }
    q('[data-set]', wrap).addEventListener('click', function () {
      try { bits = FL.parseHex(input.value); render(); } catch (e) { CA.toast(e.message); }
    });
    q('[data-enc]', wrap).addEventListener('click', function () {
      try { bits = FL.encodeDecimal(dec.value).bits; render(); } catch (e) { CA.toast(e.message); }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') q('[data-set]', wrap).click(); });
    dec.addEventListener('keydown', function (e) { if (e.key === 'Enter') q('[data-enc]', wrap).click(); });
    var presets = [['+0', '00000000'], ['−0', '80000000'], ['最小非规格化数', '00000001'], ['最大非规格化数', '007FFFFF'], ['最小规格化数', '00800000'], ['1.0', '3F800000'], ['0.1', '3DCCCCCD'], ['FLT_MAX', '7F7FFFFF'], ['+∞', '7F800000'], ['NaN', '7FC00001']];
    presets.forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = p[0];
      b.addEventListener('click', function () { bits = FL.parseHex(p[1]); render(); });
      q('[data-presets]', wrap).appendChild(b);
    });
    root.appendChild(wrap); render();
  };

  /* storage hierarchy */
  V.memLadder = function (root) {
    var rows = [
      ['寄存器', '8–64 个 × 8 B', '~0.3 ns', '1 cycle', 4],
      ['L1 Cache', '32–64 KB', '~1 ns', '4–5 cycles', 12],
      ['L2 Cache', '256 KB–1 MB', '~4 ns', '10–20 cycles', 25],
      ['L3 Cache', '4–32 MB', '~15 ns', '30–70 cycles', 42],
      ['DRAM', '8–64 GB', '~80 ns', '~200–300 cycles', 65],
      ['SSD', '256 GB–2 TB', '~50–150 µs', '~10⁵ cycles', 84],
      ['磁盘 / 网络', 'TB / 全球', 'ms–100 ms', '~10⁶–10⁸ cycles', 100]
    ];
    var wrap = h(panel('存储层次 · 容量与延迟',
      '<div style="display:flex;flex-direction:column;gap:7px" data-rows></div>' +
      '<p style="font-size:11.5px;color:var(--dim);margin:12px 0 0">越靠近 CPU：更快、更小、更贵；越远：更慢、更大、更便宜。Cache 的意义是把“最近用过的远处数据”搬到近处。</p>',
      '延迟为数量级示意，随工艺、频率、命中/缺失而变；不是本机实测。'));
    var box = q('[data-rows]', wrap);
    rows.forEach(function (r) {
      var el = document.createElement('div');
      el.style.cssText = 'display:grid;grid-template-columns:100px 1fr 90px 110px;gap:9px;align-items:center;font-size:11px;color:var(--dim)';
      el.innerHTML = '<b style="font:600 10px var(--mono);color:var(--ink)">' + r[0] + '</b>' +
        '<span style="height:7px;border-radius:4px;background:linear-gradient(90deg,rgba(200,229,143,.75),rgba(99,209,180,.18));width:' + r[4] + '%"></span>' +
        '<span class="mono" style="font-size:9.5px;color:var(--mute)">' + r[1] + '</span>' +
        '<span class="mono" style="font-size:9.5px;color:var(--lime)">' + r[2] + '</span>';
      box.appendChild(el);
    });
    root.appendChild(wrap);
  };

  /* generic key-value readout helper */
  V.readout = function (root, items) {
    var el = h('<div class="readout">' + items.map(function (it) { return '<div><span>' + esc(it[0]) + '</span><b class="' + (it[2] || '') + '">' + esc(it[1]) + '</b></div>'; }).join('') + '</div>');
    root.appendChild(el); return el;
  };
})();

/* hello.c lifecycle */
(function(){
  var CA=window.CA,V=CA.viz;
  V.lifecycle=function(root){
    var stages=[
      {k:'SRC',name:'hello.c',in:'C 源文件',out:'ASCII 字节',desc:'程序员写下的文本：预处理指令、函数、字符串。它在磁盘上就是一组字节，编辑器按 UTF-8/ASCII 解释成字符。',bytes:'约 100 B'},
      {k:'CPP',name:'预处理',in:'hello.c + 头文件',out:'hello.i',desc:'cpp 展开 #include、#define 和条件编译，把宏替换成代码。仍然是可以阅读的 C 文本，但通常变大很多。',bytes:'约 20–30 KB'},
      {k:'CC1',name:'编译',in:'hello.i',out:'hello.s',desc:'编译器做词法/语法/语义分析、优化和寄存器分配，生成汇编文本。高级语言的控制流在这里变成标签、比较和跳转。',bytes:'约 1–2 KB'},
      {k:'AS',name:'汇编',in:'hello.s',out:'hello.o',desc:'汇编器把助记符编码成机器指令，生成可重定位目标文件：代码、数据、符号表和重定位记录，但地址尚未最终确定。',bytes:'约 1–2 KB'},
      {k:'LD',name:'链接',in:'hello.o + libc',out:'hello',desc:'链接器合并目标文件、解析符号、重定位地址，把 printf 等外部引用接到 libc（静态或动态）。输出可执行文件。',bytes:'约 16–20 KB'},
      {k:'RUN',name:'加载运行',in:'hello',out:'进程',desc:'shell 调用 fork/execve；加载器把代码和数据映射进虚拟内存，跳转到入口。CPU 取指、译码、执行，write 系统调用把字节送到终端。',bytes:'进程地址空间'}
    ];
    var idx=0;
    var el=document.createElement('div');
    el.className='viz';
    el.innerHTML='<div class="viz-head"><div class="viz-title">hello.c 的一生 · 编译与运行轨道</div><div class="viz-tools"><button class="btn sm" type="button" data-prev>←</button><button class="btn sm" type="button" data-next>下一阶段 →</button></div></div>'+
      '<div class="viz-body"><div class="life-track" data-track></div><div class="life-detail" data-detail></div></div>'+
      '<div class="viz-foot"><span>点击阶段查看输入/输出与发生了什么</span><span class="mono">STATIC VIEW · 不是真实编译日志</span></div>';
    root.appendChild(el);
    var track=el.querySelector('[data-track]'),detail=el.querySelector('[data-detail]');
    function render(){
      track.innerHTML='';
      stages.forEach(function(s,i){
        var b=document.createElement('button');b.type='button';b.className='life-node'+(i===idx?' on':'');
        b.innerHTML='<b>'+s.k+'</b>'+s.name+'<span>'+s.out+'</span>';
        b.addEventListener('click',function(){idx=i;render();});
        track.appendChild(b);
      });
      var s=stages[idx];
      detail.innerHTML='<b>'+s.name+'</b> · 输入：'+s.in+' → 输出：<code>'+s.out+'</code>（'+s.bytes+'）<br>'+s.desc;
    }
    el.querySelector('[data-next]').addEventListener('click',function(){idx=(idx+1)%stages.length;render();});
    el.querySelector('[data-prev]').addEventListener('click',function(){idx=(idx-1+stages.length)%stages.length;render();});
    render();
  };
})();

/* Generic step-through diagram: content supplies states as HTML. */
(function(){
  var CA=window.CA,V=CA.viz;
  V.stepper=function(root,opts){
    opts=opts||{};var steps=opts.steps||[],idx=0;
    var el=document.createElement('div');el.className='viz';
    el.innerHTML='<div class="viz-head"><div class="viz-title">'+(opts.title||'分步观察')+'</div><div class="viz-tools"><button class="btn sm" type="button" data-prev>←</button><button class="btn sm" type="button" data-next>下一步 →</button></div></div>'+
      '<div class="viz-body"><div class="life-track" data-tabs></div><div class="life-detail" data-detail></div></div>'+
      '<div class="viz-foot"><span>'+(opts.foot||'按步骤观察状态如何变化；这是教学示意，具体读数以实验页为准。')+'</span><span class="mono" data-count></span></div>';
    root.appendChild(el);
    var tabs=el.querySelector('[data-tabs]'),detail=el.querySelector('[data-detail]'),count=el.querySelector('[data-count]');
    function render(){
      tabs.innerHTML='';
      steps.forEach(function(s,i){
        var b=document.createElement('button');b.type='button';b.className='life-node'+(i===idx?' on':'');
        b.innerHTML='<b>'+CA.pad(i+1,2)+'</b>'+s.label+(s.sub?'<span>'+s.sub+'</span>':'');
        b.addEventListener('click',function(){idx=i;render();});tabs.appendChild(b);
      });
      detail.innerHTML=steps[idx].html;count.textContent=(idx+1)+' / '+steps.length;
      if(opts.onStep)opts.onStep(idx,detail);
    }
    el.querySelector('[data-next]').addEventListener('click',function(){idx=(idx+1)%steps.length;render();});
    el.querySelector('[data-prev]').addEventListener('click',function(){idx=(idx-1+steps.length)%steps.length;render();});
    render();
  };
})();

/* Y86-64 five-stage pipeline driven by the project simulator. */
(function(){
  var CA=window.CA,V=CA.viz;
  var NAMES={0:'HALT',1:'NOP',2:'RRMOVQ',3:'IRMOVQ',4:'RMMOVQ',5:'MRMOVQ',6:'OPQ',7:'JXX',8:'CALL',9:'RET',10:'PUSHQ',11:'POPQ',12:'IADDQ'};
  V.y86pipeline=function(root,opts){
    opts=opts||{};
    var el=document.createElement('div');el.className='viz';
    el.innerHTML='<div class="viz-head"><div class="viz-title">Y86-64 五级流水线 · 逐周期</div><div class="viz-tools"><button class="btn sm" type="button" data-step>下一周期 →</button><button class="btn sm" type="button" data-reset>重置</button></div></div>'+
      '<div class="viz-body"><div data-stages style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px"></div><div class="readout" style="grid-template-columns:repeat(4,1fr);margin-top:10px"><div><span>CYCLE</span><b class="lime" data-cycle>0</b></div><div><span>STATUS</span><b data-status>AOK</b></div><div><span>%rax</span><b data-rax>0</b></div><div><span>%rbx</span><b data-rbx>0</b></div></div><div class="life-detail" style="margin-top:9px" data-note>装载后点击“下一周期”。</div></div>'+
      '<div class="viz-foot"><span data-foot>转发/加载暂停/分支恢复来自项目流水线模型。</span><span class="mono">5-STAGE</span></div>';
    root.appendChild(el);
    var stages=el.querySelector('[data-stages]'),note=el.querySelector('[data-note]');
    var m=null,bytes=null;
    function build(){
      var src='irmovq $1,%rax\nirmovq $2,%rbx\naddq %rbx,%rax\nirmovq $3,%rcx\naddq %rcx,%rax\nhalt\n';
      try{bytes=window.Y86Assembler.assemble(src,{memorySize:4096}).bytes;}catch(e){note.textContent='汇编失败：'+e.message;return false;}
      return true;
    }
    function reset(){if(!build())return;m=new window.Y86Pipeline(bytes,4096);render();}
    function stageName(st){if(!st)return '—';if(st.bubble)return 'bubble';if(st.stat==='HLT')return 'HALT';if(st.stat==='INS')return 'INS';return NAMES[st.icode]||('ICODE '+st.icode);}
    function render(){
      if(!m)return;
      var st=m.last?m.last.stages:{F:{bubble:true},D:{bubble:true},E:{bubble:true},M:{bubble:true},W:{bubble:true}};
      stages.innerHTML=['F','D','E','M','W'].map(function(k){return '<div class="life-node" style="cursor:default"><b>'+k+'</b><span style="font-size:11px;color:var(--ink)">'+stageName(st[k])+'</span></div>';}).join('');
      el.querySelector('[data-cycle]').textContent=m.cycles;
      el.querySelector('[data-status]').textContent=m.status;
      el.querySelector('[data-rax]').textContent=String(m.reg[0]);
      el.querySelector('[data-rbx]').textContent=String(m.reg[3]);
      var l=m.last;
      note.textContent=l?('本周期：取指 PC=0x'+Number(l.fetchPC).toString(16)+(l.loadUse?' · 加载后使用：暂停并转发':'' )+(l.retStall?' · 返回等待':'' )+(l.branchRecovery?' · 分支预测错误：清除/恢复':'' )):'尚未执行。';
    }
    function step(){if(!m)reset();if(!m)return;if(m.status==='AOK')m.step();render();}
    el.querySelector('[data-step]').addEventListener('click',step);
    el.querySelector('[data-reset]').addEventListener('click',function(){reset();});
    reset();
  };
})();
