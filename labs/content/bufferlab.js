CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.bufferlab = {
  summary: 'Buffer Lab 是 Attack Lab 的 32 位前身：在 IA32 栈上改写返回地址、传参、改全局变量、恢复返回地址并注入 shellcode。第三版官方已用 Attack Lab 取代它；本页作为历史对照，帮助理解 x86-64 与 IA32 调用约定/栈布局的差异。',
  objectives: [
    '能画出 IA32 的栈帧与参数布局（参数在栈上，返回地址在 %ebp+4）。',
    '能解释 x86-64 为什么把前 6 个整数参数放进寄存器。',
    '能对照 Buffer Lab 与 Attack Lab 的 payload 构造差异。',
    '能说明可执行栈、栈保护与 ASLR 的防御意义。'
  ],
  browserNote: '本页提供 32 位栈 payload 模型与 IA32 布局对照；它不是官方 IA32 靶场，现代课程请做 Attack Lab，官方旧版材料需另行准备。',
  vmNote: 'Buffer Lab 属于旧版 32 位材料，可能需要额外的 32 位编译环境；本项目不把它作为第三版必做项。',
  vmLab: null,
  sections: [
    {
      id: 'ia32', num: '3.L1', title: 'IA32 vs x86-64：栈帧的差别',
      html: `
        <table>
          <tr><th></th><th>IA32（Buffer Lab）</th><th>x86-64（Attack Lab）</th></tr>
          <tr><td>参数传递</td><td>全部压栈（从右到左）</td><td>前 6 个整数在 %rdi/%rsi/%rdx/%rcx/%r8/%r9，更多在栈上</td></tr>
          <tr><td>返回地址</td><td>call 压入栈，位于 %ebp+4</td><td>同样由 call 压栈，位于 %rsp</td></tr>
          <tr><td>帧指针</td><td>常用 %ebp；<code>leave</code> 恢复</td><td>常用 %rbp；也可省略帧指针</td></tr>
          <tr><td>寄存器宽度</td><td>32 位</td><td>64 位</td></tr>
          <tr><td>地址字节</td><td>4 字节（小端）</td><td>8 字节（小端）</td></tr>
        </table>
        <p>Buffer Lab 的 5 关通常对应：改写返回地址跳转 smoke；调用 fizz 并传参；改全局变量 bang；调用 boom 并恢复返回地址；注入 shellcode。每关都在训练“栈上的字节如何变成控制流”。</p>
        <pre data-lang="text"><code>IA32 栈帧（getbuf 内部）
高地址
+------------------+
| 参数 ...          |
+------------------+
| 返回地址 (4B)     |  ← 覆盖这里
+------------------+
| 保存的 %ebp (4B)  |
+------------------+
| buf[N-1..0]       |
+------------------+  ← %esp
低地址</code></pre>
        <div class="callout warn"><div class="c-title">历史边界</div><p>IA32 的寄存器少、参数在栈上，payload 布局与 x86-64 不同；不要把 32 位地址/偏移直接套到 64 位靶场。第三版课程应做 Attack Lab。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'lessons', num: '3.L2', title: '从 Buffer Lab 到 Attack Lab：同一组防御',
      html: `
        <p>缓冲区溢出能成功，依赖三个条件：输入长度不受控、栈上数据可被解释为控制信息、目标地址可预测。现代系统逐项加固：</p>
        <ul>
          <li><b>栈不可执行（NX）</b>：代码注入失效，攻击者转向 ROP。</li>
          <li><b>栈保护（canary）</b>：函数返回前检查哨兵，溢出被检测。</li>
          <li><b>ASLR</b>：栈/库地址随机化，硬编码地址不可靠。</li>
          <li><b>CFI/影子栈</b>：限制间接跳转/返回地址篡改。</li>
        </ul>
        <p>Attack Lab 的 CTARGET/RTARGET 正是按“栈可执行 → 不可执行 → ROP”的顺序设计。理解这条演化，比记住某一关的 payload 更重要。</p>
        <div class="callout info"><div class="c-title">安全边界</div><p>这些技术只应在隔离的课程实验环境中使用。不要对真实系统或他人的程序尝试利用；本项目不提供可对外攻击的靶场。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'browser', num: '3.L3', title: '浏览器 32 位栈 payload 工作台',
      html: `
        <p>用 32 位栈模型练习 Buffer Lab 的 5 个关卡：32 字节缓冲区、4 字节 saved ebp、4 字节返回地址（偏移 36），函数参数在栈上。它不是官方 IA32 bufferlab，但能练字节序、返回地址与栈参数布局。</p>
        <div class="task-list" id="bfLevels" style="margin:10px 0"></div>
        <div class="card"><h4 id="bfTitle">Smoke</h4><p id="bfDesc"></p>
          <div class="readout" style="grid-template-columns:repeat(3,1fr)"><div><span>BUFFER</span><b>0x5561DC00</b></div><div><span>返回地址偏移</span><b>36</b></div><div><span>COOKIE</span><b>0x59B997FA</b></div></div>
          <details style="margin-top:6px"><summary style="cursor:pointer;color:var(--lime)">地址</summary><pre style="font-size:10.5px;white-space:pre-wrap">smoke = 0x08048B20
fizz  = 0x08048B50
boom  = 0x08048C00
shell = 0x08048D00
bang  = 0x0804A1B0
"movl $cookie, bang; ret" = C7 05 B0 A1 04 08 FA 97 B9 59 C3</pre></details>
          <details style="margin-top:6px"><summary style="cursor:pointer;color:var(--lime)">思路提示</summary><p id="bfHint" style="font-size:11px"></p></details>
        </div>
        <label class="field" style="margin-top:12px"><span>payload（空格分隔十六进制字节）</span><textarea id="bfPayload" style="width:100%;height:120px;resize:vertical;margin-top:5px" spellcheck="false"></textarea></label>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="bfRun">执行 payload</button><button class="btn sm" type="button" id="bfClear">清空</button><button class="btn sm" type="button" id="bfAdopt" disabled>采用浏览器得分</button></div>
        <pre id="bfOut" class="console" style="min-height:100px;margin-top:10px" role="status">选择关卡并输入 payload。</pre>
        <div id="bfReport"></div>
      `,
      init: function (sec) {
        var CA = window.CA, BS = window.BufferSim;
        if (!BS) { sec.querySelector('#bfOut').textContent = 'BufferSim 未载入。'; return; }
        var STORE = 'ca.buffer.payloads.v1';
        var payloads = {}; try { payloads = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { payloads = {}; }
        var solved = Object.assign({}, CA.progress.lab('bufferlab').solved || {});
        var current = BS.LEVELS[0].id;
        var ed = CA.editor(sec.querySelector('#bfPayload'), { key: null });
        var out = sec.querySelector('#bfOut'), report = sec.querySelector('#bfReport'), adopt = sec.querySelector('#bfAdopt');
        var lastScore = 0;
        var hints = {
          smoke: '返回地址在偏移 36。写 smoke 的 4 字节小端地址。',
          fizz: '偏移 36=fizz；ret 后 esp 指向偏移 40，把 cookie 放在那里作为第一个参数。',
          bang: '在 buffer 写 C7 05 B0 A1 04 08 FA 97 B9 59 C3；偏移 36=buffer；偏移 40=smoke，让代码 ret 到 smoke。',
          boom: '偏移 36=boom；偏移 40=cookie。',
          nitro: '偏移 36=shell；偏移 40=buffer+44；偏移 44 起写 "/bin/sh\\0"。'
        };
        function save() { try { payloads[current] = ed.get(); localStorage.setItem(STORE, JSON.stringify(payloads)); } catch (e) { } }
        function score() { return BS.LEVELS.reduce(function (a, l) { return a + (solved[l.id] ? l.pts : 0); }, 0); }
        function renderLevels() {
          var box = sec.querySelector('#bfLevels'); box.innerHTML = '';
          BS.LEVELS.forEach(function (l) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'task-item' + (l.id === current ? ' active' : '') + (solved[l.id] ? ' solved' : '');
            var t = document.createElement('span'); t.className = 'tick'; t.textContent = '✓';
            var n = document.createElement('span'); n.className = 't-name'; n.textContent = l.name;
            var p = document.createElement('span'); p.className = 't-pts'; p.textContent = l.pts + ' pts';
            b.append(t, n, p); b.addEventListener('click', function () { select(l.id); }); box.appendChild(b);
          });
        }
        function select(id) {
          save(); current = id;
          var l = BS.LEVELS.find(function (x) { return x.id === id; });
          sec.querySelector('#bfTitle').textContent = l.name;
          sec.querySelector('#bfDesc').textContent = l.desc;
          sec.querySelector('#bfHint').textContent = hints[id] || '';
          ed.set(payloads[id] || '');
          renderLevels(); report.innerHTML = '';
        }
        function run() {
          try {
            var l = BS.LEVELS.find(function (x) { return x.id === current; });
            var r = BS.run(current, BS.parseHex(ed.get()));
            out.textContent = (r.ok ? '✓ 通过' : '✕ 未通过') + '：' + r.reason + '\n\n' + r.trace.join('\n');
            out.className = 'console ' + (r.ok ? 'ok' : 'err');
            if (r.ok) { solved[current] = true; save(); renderLevels(); CA.toast('通过 ' + l.name); }
            lastScore = score(); adopt.disabled = !(lastScore > 0);
            report.innerHTML = '<div class="kv"><span>当前得分</span><b>' + lastScore + ' / 60</b></div>';
          } catch (e) { out.textContent = '✕ ' + e.message; out.className = 'console err'; }
        }
        sec.querySelector('#bfRun').addEventListener('click', run);
        sec.querySelector('#bfClear').addEventListener('click', function () { ed.set(''); save(); });
        adopt.addEventListener('click', function () {
          if (!lastScore) return;
          CA.progress.lab('bufferlab', { score: lastScore, solved: solved });
          CA.refreshLabScore('bufferlab');
          adopt.disabled = true;
          CA.toast('已采用 Buffer Lab 浏览器得分 ' + lastScore + ' / 60（legacy 模型）');
        });
        select(current); renderLevels();
      }
    }
  ],
  checklist: [
    { id: 'stack', label: '能画出 IA32 与 x86-64 的栈帧差异。' },
    { id: 'payload', label: '能解释 32 位地址/4 字节槽与 64 位地址/8 字节槽的 payload 差异。' },
    { id: 'defense', label: '能说明 NX、canary、ASLR、CFI 各阻止哪一步。' },
    { id: 'attack', label: '转到 Attack Lab，完成 5 关并解释每关的栈布局。' }
  ]
};
