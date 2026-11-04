CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.attacklab = {
  summary: 'Attack Lab 用缓冲区溢出和 ROP 讲“机器级程序的边界在哪里”。你要构造十六进制 payload：前 3 关在可执行栈上注入代码，后 2 关在不可执行栈上用 gadget 拼出调用。官方靶场只在 Linux 实验机中运行；本页负责讲清栈布局、字节序、payload 格式与调试方法。',
  objectives: [
    '能画出 getbuf 的栈帧，指出缓冲区、保存的 %rbp 与返回地址。',
    '能按小端序写出 8 字节地址与指令字节。',
    '能构造代码注入 payload，调用 touch1/2/3 并传递 cookie/字符串。',
    '能用 ROP gadget（pop/mov/ret）在不可执行栈上完成同样目标。'
  ],
  browserNote: '本页提供固定栈布局、受限 x86 子集与符号 gadget 的 payload 工作台；真正执行官方 CTARGET/RTARGET 需要实验机。',
  vmNote: '官方 ctarget/rtarget 与 hex2raw 在实验机中；用 ./ctarget -i payload.txt 或 ./rtarget -i payload.txt 提交，观察 touch 函数是否被调用。',
  vmLab: 'attack',
  sections: [
    {
      id: 'stack', num: '3.A1', title: '先画出栈：返回地址在哪里',
      html: `
        <p><code>getbuf</code> 通常声明一个 <code>char buf[N]</code>，然后调用 <code>Gets(buf)</code>。栈向低地址增长，所以缓冲区在低地址，返回地址在高地址：</p>
        <pre data-lang="text"><code>高地址
+----------------------+  ← 调用者的栈帧
| ...                  |
+----------------------+
| 返回地址 (8 字节)     |  ← getbuf 的 ret 会跳到这里
+----------------------+
| 保存的 %rbp (8 字节)  |  ← 如果函数序言 push %rbp
+----------------------+
| buf[N-1] ... buf[0]  |  ← Gets 从 buf[0] 开始写
+----------------------+  ← %rsp（getbuf 内部）
低地址</code></pre>
        <p>输入超过 N 字节时，多出的字节会依次覆盖保存的 <code>%rbp</code> 和返回地址。payload 的布局因此是：<code>[填充 N 字节][可选 saved rbp 8 字节][目标地址 8 字节][更多数据]</code>。具体 N 与是否有 saved rbp 要读反汇编确认。</p>
        <h3>小端序</h3>
        <p>x86-64 是小端：地址 <code>0x004017c0</code> 在内存中的 8 个字节是 <code>c0 17 40 00 00 00 00 00</code>。payload 文本里不要写成 <code>00 40 17 c0</code>。</p>
        <div class="callout info"><div class="c-title">怎么找 N</div><p>看 <code>sub $0x??,%rsp</code> 或 <code>lea -0x??(%rbp),%rdi</code>；N 是缓冲区大小。也可以在 gdb 里比较 <code>&amp;buf</code> 与 <code>$rsp</code>/saved rbp 的位置。</p></div>
        ${CA.quizHTML({
          id: 'attack-q1', q: '要覆盖 getbuf 的返回地址，payload 中目标地址应该放在什么位置？',
          options: ['缓冲区填满后，跳过 saved rbp（若有），再写 8 字节地址', 'payload 最开头', '缓冲区中间', '紧跟在 cookie 字符串之后'],
          answer: 0, explain: '<b>正确。</b>溢出按内存顺序覆盖：buf → saved rbp（若有）→ 返回地址。先确认 N 和序言，再计算偏移。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'inject', num: '3.A2', title: '代码注入：touch1/2/3',
      html: `
        <p><b>Touch1</b> 只需要把返回地址改成 <code>touch1</code> 的地址：payload = N 字节填充 + 8 字节地址。不需要执行任何注入代码。</p>
        <p><b>Touch2</b> 要求 <code>%rdi = cookie</code>。两种做法：</p>
        <ul>
          <li>把返回地址指向 <code>touch2</code> 前面的 <code>mov $cookie,%rdi</code> gadget（如果存在）。</li>
          <li>把返回地址指向缓冲区里的注入代码：<code>mov $cookie,%rdi; ret</code>，并让注入代码的 <code>ret</code> 跳到 <code>touch2</code>。</li>
        </ul>
        <pre data-lang="text"><code>mov $0x59b997fa,%rdi   48 c7 c7 fa 97 b9 59
ret                    c3
# 缓冲区地址（示例）0x5561dc78 → 78 dc 61 55 00 00 00 00</code></pre>
        <p><b>Touch3</b> 要求 <code>%rdi</code> 指向 cookie 的字符串形式（十六进制 ASCII，例如 <code>"59b997fa"</code>，以 NUL 结尾）。字符串可以放在缓冲区里，但地址要按运行时栈地址计算。</p>
        <h3>调试建议</h3>
        <ul>
          <li>在 <code>getbuf</code> 返回前下断点，<code>x/20gx $rsp</code> 看 payload 是否落在预期位置。</li>
          <li>单步到 <code>ret</code>，确认 <code>%rip</code> 跳到目标地址。</li>
          <li>如果注入代码执行到一半崩溃，检查栈是否可执行、地址是否写错、字符串是否越界。</li>
        </ul>
        <div class="callout warn"><div class="c-title">CTARGET 的栈可执行</div><p>代码注入关依赖可执行栈；RTARGET 关闭了它，只能 ROP。不要假设所有系统都允许可执行栈——这正是实验要讲的防御演化。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'rop', num: '3.A3', title: 'ROP：用 gadget 拼出调用',
      html: `
        <p>RTARGET 的栈不可执行，但代码段里有很多以 <code>ret</code> 结尾的小片段（gadget）。把它们的地址依次写进栈，<code>ret</code> 就会像一条“指令链”一样跳转：</p>
        <pre data-lang="text"><code>[填充 N][saved rbp][gadget1][数据1][gadget2][数据2]...[touch2]</code></pre>
        <p>Fire 2 的典型链：</p>
        <ol>
          <li><code>pop %rdi; ret</code> —— 从栈上取下一个 8 字节到 <code>%rdi</code>；</li>
          <li>栈上放 cookie；</li>
          <li>跳到 <code>touch2</code>。</li>
        </ol>
        <p>Fire 3 需要把 cookie 字符串放到一个已知地址（例如栈上），再让 <code>%rdi</code> 指向它。常见链会用到 <code>mov %rsp,%rax</code>、<code>lea offset(%rax),%rdi</code> 或 <code>mov %rax,%rdi</code> 等 gadget；具体可用 gadget 取决于 farm 的反汇编。</p>
        <h3>找 gadget</h3>
        <pre data-lang="bash"><code>objdump -d rtarget | grep -B2 -A2 'ret'
# 或只找需要的字节序列，例如 pop rdi; ret = 5f c3
objdump -d rtarget | grep -n '5f c3'</code></pre>
        <p>注意 gadget 地址要落在可执行段；不要跳到数据段。每个 gadget 的副作用要逐条读清楚，尤其是它是否 pop 了额外数据。</p>
        <div class="callout info"><div class="c-title">payload 文件格式</div><p><code>hex2raw</code> 接受空格分隔的十六进制字节，生成原始二进制。<code>./ctarget -i payload.txt</code> 读取的是原始字节，不是十六进制文本。用 <code>./hex2raw &lt; payload.txt &gt; raw.txt</code> 转换。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'payload', num: '3.A3b', title: '浏览器 payload 工作台',
      html: `
        <p>在浏览器里构造 payload，用固定栈布局与受限 x86/gadget 模型执行。它覆盖代码注入与 ROP 的核心：覆盖返回地址、布置注入代码、按小端序写地址、用 gadget 链设置 <code>%rdi</code>。</p>
        <div class="task-list" id="atkLevels" style="margin:10px 0"></div>
        <div class="card"><h4 id="atkTitle">Touch 1</h4><p id="atkDesc"></p>
          <div class="readout" style="grid-template-columns:repeat(3,1fr)"><div><span>BUFFER</span><b>0x5561DC78</b></div><div><span>返回地址偏移</span><b>72</b></div><div><span>COOKIE</span><b>0x59B997FA</b></div></div>
          <details style="margin-top:8px"><summary style="cursor:pointer;color:var(--lime)">地址与 gadget</summary><pre style="font-size:10.5px;white-space:pre-wrap">touch1 = 0x4017C0
touch2 = 0x4017EC
touch3 = 0x4018FA
pop %rdi; ret          = 0x4019AB  (5F C3)
mov %rsp,%rdi; ret     = 0x401A06  (48 89 E7 C3)
lea 16(%rdi),%rdi; ret = 0x4019DD  (48 8D 7F 10 C3)
字符串 "59b997fa"（NUL 结尾）</pre></details>
          <details style="margin-top:6px"><summary style="cursor:pointer;color:var(--lime)">思路提示（先自己构造）</summary><p id="atkHint" style="font-size:11px;line-height:1.7"></p></details>
        </div>
        <label class="field" style="margin-top:12px"><span>payload（空格分隔十六进制字节）</span><textarea id="atkPayload" style="width:100%;height:130px;resize:vertical;margin-top:5px" spellcheck="false" placeholder="c0 17 40 00 00 00 00 00 ..."></textarea></label>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="atkRun">执行 payload</button><button class="btn sm" type="button" id="atkClear">清空</button><button class="btn sm" type="button" id="atkAdopt" disabled>采用浏览器得分</button></div>
        <pre id="atkOut" class="console" style="min-height:110px;margin-top:10px" role="status">选择关卡，输入 payload，然后执行。</pre>
        <div id="atkReport"></div>
        <p style="font-size:10.5px;color:var(--mute)">这是固定地址、受限指令/ gadget 的浏览器模型，不是官方 ctarget/rtarget；官方评分在实验机中。提交前请确认字节序为小端。</p>
      `,
      init: function (sec) {
        var CA = window.CA, AS = window.AttackSim;
        if (!AS) { sec.querySelector('#atkOut').textContent = 'AttackSim 未载入。'; return; }
        var STORE = 'ca.attack.payloads.v1';
        var payloads = {};
        try { payloads = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { payloads = {}; }
        var solved = Object.assign({}, CA.progress.lab('attacklab').solved || {});
        var current = AS.LEVELS[0].id;
        var ed = CA.editor(sec.querySelector('#atkPayload'), { key: null });
        var out = sec.querySelector('#atkOut'), report = sec.querySelector('#atkReport'), adopt = sec.querySelector('#atkAdopt');
        var lastScore = 0;
        var hints = {
          touch1: '返回地址在偏移 72（64 字节缓冲区 + 8 字节 saved rbp）。把 touch1 的 8 字节小端地址放在这里。',
          touch2: '在 buffer 开头写 mov $cookie,%rdi; ret（48 BF + 8 字节 cookie + C3），偏移 72 填 buffer 地址，偏移 80 填 touch2。',
          touch3: '把 "59b997fa\0" 放在 buffer+88；注入 mov $buffer+88,%rdi; ret；偏移 72=buffer，偏移 80=touch3。',
          fire2: '栈不可执行。偏移 72=pop %rdi;ret，80=cookie，88=touch2。',
          fire3: '栈不可执行。72=mov %rsp,%rdi;ret，80=lea 16(%rdi),%rdi;ret，88=touch3，96=字符串。'
        };
        function save() { try { payloads[current] = ed.get(); localStorage.setItem(STORE, JSON.stringify(payloads)); } catch (e) { } }
        function score() { return AS.LEVELS.reduce(function (a, l) { return a + (solved[l.id] ? l.pts : 0); }, 0); }
        function renderLevels() {
          var box = sec.querySelector('#atkLevels'); box.innerHTML = '';
          AS.LEVELS.forEach(function (l) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'task-item' + (l.id === current ? ' active' : '') + (solved[l.id] ? ' solved' : '');
            var tick = document.createElement('span'); tick.className = 'tick'; tick.textContent = '✓';
            var name = document.createElement('span'); name.className = 't-name'; name.textContent = l.name;
            var pts = document.createElement('span'); pts.className = 't-pts'; pts.textContent = l.pts + ' pts';
            b.append(tick, name, pts); b.addEventListener('click', function () { select(l.id); }); box.appendChild(b);
          });
        }
        function select(id) {
          save(); current = id;
          var l = AS.LEVELS.find(function (x) { return x.id === id; });
          sec.querySelector('#atkTitle').textContent = l.name;
          sec.querySelector('#atkDesc').textContent = l.desc + (l.nx ? '（RTARGET，栈不可执行）' : '（CTARGET，栈可执行）');
          sec.querySelector('#atkHint').textContent = hints[id] || '';
          ed.set(payloads[id] || '');
          renderLevels(); report.innerHTML = '';
        }
        function run() {
          try {
            var l = AS.LEVELS.find(function (x) { return x.id === current; });
            var bytes = AS.parseHex(ed.get());
            var r = AS.run(current, bytes);
            out.textContent = (r.ok ? '✓ 通过' : '✕ 未通过') + '：' + r.reason + '\n\n' + r.trace.join('\n');
            out.className = 'console ' + (r.ok ? 'ok' : 'err');
            if (r.ok) { solved[current] = true; save(); renderLevels(); CA.toast('通过 ' + l.name); }
            lastScore = score(); adopt.disabled = !(lastScore > 0);
            report.innerHTML = '<div class="kv"><span>当前得分</span><b>' + lastScore + ' / 100</b></div>';
          } catch (e) { out.textContent = '✕ ' + e.message; out.className = 'console err'; }
        }
        sec.querySelector('#atkRun').addEventListener('click', run);
        sec.querySelector('#atkClear').addEventListener('click', function () { ed.set(''); save(); });
        adopt.addEventListener('click', function () {
          if (!lastScore) return;
          CA.progress.lab('attacklab', { score: lastScore, solved: solved });
          CA.refreshLabScore('attacklab');
          adopt.disabled = true;
          CA.toast('已采用 Attack Lab 浏览器得分 ' + lastScore + ' / 100');
        });
        select(current); renderLevels();
      }
    },
    {
      id: 'official', num: '3.A4', title: '官方实验机模式',
      html: `
        <pre data-lang="bash"><code>ls /root/CSAPP | grep -i attack
cd /root/CSAPP/attack*        # 进入 attack 目录
cat README                   # 读取本组 cookie 与目标
objdump -d ctarget | less    # 找 touch1/2/3 与 getbuf
./hex2raw &lt; c1.txt &gt; raw.txt
./ctarget -i raw.txt         # 提交 CTARGET
./rtarget -i raw.txt         # 提交 RTARGET
./ctarget -q                 # 不连接评分服务器，仅本地运行</code></pre>
        <p>每组的 cookie 不同，地址也可能因编译而不同；不要直接套用别人的 payload。先用 <code>objdump</code> 确认 <code>touch1/2/3</code> 地址与 <code>getbuf</code> 的缓冲区大小。</p>
        <div class="callout warn"><div class="c-title">评分与合法性</div><p>官方评分会检查是否调用了正确的 touch 函数、是否传递了正确 cookie、是否使用了不允许的 gadget。不要修改靶场二进制；payload 才是你的答案。</p></div>
      `,
      init: function () { }
    }
  ],
  checklist: [
    { id: 'layout', label: '画出 getbuf 栈帧，标出 N、saved rbp、返回地址与 payload 偏移。' },
    { id: 't1', label: 'Touch1：用代码注入把返回地址改成 touch1。' },
    { id: 't2', label: 'Touch2：注入代码或 gadget 把 cookie 放入 %rdi。' },
    { id: 't3', label: 'Touch3：把 cookie 字符串放到已知地址并传入 %rdi。' },
    { id: 'r2', label: 'Fire2：只用 farm gadget 设置 %rdi 并调用 touch2。' },
    { id: 'r3', label: 'Fire3：只用 farm gadget 构造字符串指针并调用 touch3。' },
    { id: 'official', label: '在实验机中用 hex2raw 与 ctarget/rtarget 提交，保存输出。' }
  ]
};
