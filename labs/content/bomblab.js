CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.bomblab = {
  summary: 'Bomb Lab 训练的是“读懂一个没有源码的二进制”。你要用 objdump/gdb 找到每个 phase 的输入检查逻辑，逐关拆弹。官方 bomb 二进制不随本项目分发；浏览器内提供同构的六关原创靶场，官方模式在 Linux 实验机中运行。',
  objectives: [
    '能用 objdump -d 找到 phase 函数与关键比较/跳转。',
    '能用 gdb 设置断点、单步、查看寄存器和内存字符串。',
    '能识别字符串比较、整数序列、switch/跳转表、递归、数组映射与链表六类模式。',
    '能为每一关写下可复现的输入，并解释它为什么通过。'
  ],
  browserNote: '3D 实验台提供六关原创逆向练习，逐条执行真实 x86-64 机器码并保存本机通过状态；它不是官方 bomb，但训练同一组阅读与调试技能。',
  vmNote: '官方 bomb 在 Debian 实验机的 /root/CSAPP/bomb* 中；用 gdb/objdump 分析，输入答案文件逐关验证。原始输出可回传页面。',
  vmLab: 'bomb',
  sections: [
    {
      id: 'phases', num: '3.B1', title: '六个阶段，六种阅读模式',
      html: `
        <p>典型 bomb 有 6 个 phase，输入通过 <code>read_line</code> 读入，再由 <code>phase_n</code> 检查。不同 bomb 的具体常量不同，但模式高度相似：</p>
        <table>
          <tr><th>阶段</th><th>常见检查</th><th>阅读线索</th></tr>
          <tr><td>Phase 1</td><td>字符串相等</td><td><code>strings_not_equal</code> / <code>strcmp</code>，比较前先算长度</td></tr>
          <tr><td>Phase 2</td><td>6 个整数满足递推</td><td><code>read_six_numbers</code>、循环、<code>%eax</code> 与数组下标</td></tr>
          <tr><td>Phase 3</td><td>switch / 跳转表</td><td><code>jmp *0x...</code>、<code>cmp $n</code>、多个分支</td></tr>
          <tr><td>Phase 4</td><td>递归函数 func4</td><td><code>call func4</code>、参数在 <code>%edi/%esi/%edx</code>、返回值比较</td></tr>
          <tr><td>Phase 5</td><td>字符数组映射</td><td><code>and $0xf</code>、从常量数组取字符、目标字符串比较</td></tr>
          <tr><td>Phase 6</td><td>链表按值排序</td><td>6 个节点、<code>mov 0x8(%rbx)</code>、比较后交换/重排</td></tr>
        </table>
        <p>隐藏阶段通常由某个 phase 的额外输入触发（例如 phase 4 里多一个字符串），再进入一棵二叉搜索树。先拆完 6 关，再找 <code>secret_phase</code> 的引用。</p>
        <div class="callout info"><div class="c-title">不要从 main 硬读</div><p>先用 <code>objdump -d bomb | grep -A40 '&lt;phase_1&gt;'</code> 定位每个 phase，再逐个看它调用了哪些辅助函数。辅助函数（read_six_numbers、strings_not_equal、func4）通常比 phase 本身更能说明数据布局。</p></div>
        ${CA.quizHTML({
          id: 'bomb-q1', q: '在 phase_1 中看到 <code>call strings_not_equal</code>，最直接的下一步是什么？',
          options: ['查看该调用前 %rdi/%rsi 指向的字符串', '直接修改二进制跳过比较', '从 main 重新逐条读 500 行', '猜测输入是 6 个整数'],
          answer: 0, explain: '<b>正确。</b>比较函数的两个参数就是待比较字符串；在 gdb 里用 <code>x/s $rdi</code>、<code>x/s $rsi</code> 即可看到其中一个（通常是标准答案）。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'gdb', num: '3.B2', title: '最小 gdb 工作流',
      html: `
        <p>把下面几条命令练熟，足够拆完大多数 bomb：</p>
        <pre data-lang="bash"><code>gdb ./bomb
(gdb) break phase_1          # 在函数入口下断点
(gdb) run                    # 运行，输入第一关答案
(gdb) disas                  # 反汇编当前函数
(gdb) x/s $rdi               # 查看参数字符串
(gdb) x/8gx $rsp             # 查看栈上 8 个 8 字节
(gdb) info registers         # 查看寄存器
(gdb) stepi                  # 单条指令执行
(gdb) continue               # 继续到下一个断点
(gdb) quit</code></pre>
        <p>如果程序已经运行，先 <code>Ctrl-C</code> 暂停；如果断点打不上，确认二进制有符号（<code>file bomb</code>、<code>nm bomb | grep phase</code>）。如果 <code>phase_1</code> 被内联/改名，用 <code>objdump -d</code> 找调用 <code>read_line</code> 的位置。</p>
        <h3>读汇编的三个问题</h3>
        <ol>
          <li><b>输入在哪里？</b>函数参数寄存器（<code>%rdi</code>、<code>%rsi</code>…）或栈上的缓冲区。</li>
          <li><b>比较什么？</b>找 <code>cmp</code>/<code>test</code> 后紧跟的条件跳转；跳转的“失败”分支通常调用 <code>explode_bomb</code>。</li>
          <li><b>循环的边界？</b>找计数器、数组下标和 <code>jne/jl/jg</code> 的目标地址。</li>
        </ol>
        <div class="callout warn"><div class="c-title">别把“不爆炸”当成通过</div><p>有些错误输入会让程序提前退出或跳过检查。以 <code>phase_n</code> 返回后没有调用 <code>explode_bomb</code>、且程序继续到下一关为准。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'browser', num: '3.B2b', title: '浏览器六关训练场',
      html: `
        <p>3D 实验台内置一个原创六关 x86-64 逆向练习：每关把输入放入 <code>%rdi</code>，装载后逐条执行真实机器码，观察 <code>cmp</code>/条件跳转与退出码。它不是官方 bomb，但训练同一组阅读/单步技能。</p>
        <p><a class="btn primary" href="../index.html?bomb=1">打开浏览器六关训练场 →</a></p>
        <div class="card" style="margin-top:12px"><h4>本机训练进度</h4><p id="bombBrowserProgress">读取中…</p>
          <div class="flex wrap gap8" style="margin-top:8px"><button class="btn primary sm" type="button" id="bombAdopt" disabled>采用浏览器六关得分（60/100）</button><button class="btn sm" type="button" id="bombRefresh">刷新进度</button></div>
          <p style="font-size:10.5px;color:var(--mute);margin:7px 0 0">60 分是原创六关的浏览器归一化分；官方 bomb 的 100 分与 secret phase 仍需 Linux 实验机。</p>
        </div>
        <div class="callout info"><div class="c-title">怎么用</div><p>打开后选择关卡、输入整数、点“装载本关与输入”，再单步执行。退出码为 0 表示本关通过；六关通过状态保存在本机浏览器。官方 bomb 的二进制/评分仍只在 Linux 实验机中。</p></div>
      `,
      init: function (sec) {
        var el = sec.querySelector('#bombBrowserProgress');
        var adopt = sec.querySelector('#bombAdopt');
        function render() {
          try {
            var a = JSON.parse(localStorage.getItem('ca.bomb.solved') || '[]');
            var n = Array.isArray(a) ? a.length : 0;
            el.textContent = '已通过 ' + n + ' / 6 关' + (n >= 6 ? ' · 六关完成（浏览器原创练习）' : '。通过状态保存在本机。');
            adopt.disabled = n < 6;
          } catch (e) { el.textContent = '无法读取本机训练进度。'; adopt.disabled = true; }
        }
        adopt.addEventListener('click', function () {
          CA.progress.lab('bomblab', { score: 60, solved: { browser: true } });
          CA.refreshLabScore('bomblab');
          adopt.disabled = true;
          CA.toast('已采用浏览器六关得分 60 / 100（原创靶场）');
        });
        sec.querySelector('#bombRefresh').addEventListener('click', render);
        render();
      }
    },
    {
      id: 'official', num: '3.B3', title: '官方实验机模式',
      html: `
        <p>在实验机中：</p>
        <pre data-lang="bash"><code>ls /root/CSAPP | grep -i bomb
cd /root/CSAPP/bomb*            # 进入 bomb 目录
./bomb                          # 交互输入；先试一个错误答案看爆炸
objdump -d bomb | less          # 离线反汇编
gdb ./bomb                      # 调试
./bomb answers.txt              # 一次提交 6 个答案</code></pre>
        <p>把每关答案保存在 <code>answers.txt</code>，一行一关；隐藏关答案通常是额外的一行。官方分数按通过的 phase 计；爆炸会扣分，但可以重启。</p>
        <p>点“打开 Linux 实验机”会连接实验机并打开终端；如果从启动器进入，页面会携带会话令牌。首次连接需要等待 Linux 启动。</p>
        <div class="callout info"><div class="c-title">浏览器辅助</div><p>回到 <a href="../index.html">3D 实验台</a>，点“x86-64 汇编”，可以在六关原创练习里逐条执行真实机器码，观察 <code>cmp</code>/<code>jne</code> 如何决定成功/失败。它不能代替官方 bomb，但适合热身。</p></div>
      `,
      init: function () { }
    }
  ],
  checklist: [
    { id: 'p1', label: 'Phase 1：能说出被比较的字符串，并解释 strings_not_equal 的返回值。' },
    { id: 'p2', label: 'Phase 2：能写出 6 个整数并解释递推/循环边界。' },
    { id: 'p3', label: 'Phase 3：能读出 switch 的 case 数与每个分支的返回值。' },
    { id: 'p4', label: 'Phase 4：能手算 func4 的递归，或说明如何用 gdb 跳过递归爆破。' },
    { id: 'p5', label: 'Phase 5：能解释字符数组映射与目标字符串。' },
    { id: 'p6', label: 'Phase 6：能画出 6 个链表节点，并说明排序后的输入顺序。' },
    { id: 'sec', label: 'Secret Phase：找到触发条件并拆掉隐藏关（若你的 bomb 有）。' },
    { id: 'official', label: '在实验机中运行官方 bomb，保存 answers.txt 与最终分数。' }
  ]
};
