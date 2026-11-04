CA.registerChapter('ch07', {
  summary: '一个可执行文件不是“编译出来的一个东西”，而是链接器把多个可重定位目标文件、静态库和动态库拼起来的结果。本章讲 ELF 的段与符号表、符号解析、重定位、静态库的按需抽取，以及动态链接的 GOT/PLT。',
  objectives: [
    '能说出 .text/.data/.bss/.rodata/.symtab/.rela.text 的作用。',
    '能区分局部/全局/弱符号，并解释重复定义与未定义引用。',
    '能计算 PC 相对重定位的位移，并读懂 R_X86_64_PC32。',
    '能解释静态库抽取规则、PIC、GOT 与 PLT 的延迟绑定。'
  ],
  sections: [
    {
      id: 'elf', num: '7.1', title: '目标文件里有什么',
      html: `
        <p>可重定位目标文件（<code>.o</code>）是链接器的输入。ELF 用“段”（section）组织内容：</p>
        <table>
          <tr><th>段</th><th>内容</th><th>链接时</th></tr>
          <tr><td><code>.text</code></td><td>机器指令</td><td>合并到可执行文件的代码段</td></tr>
          <tr><td><code>.data</code></td><td>已初始化的全局/静态变量</td><td>合并，分配地址</td></tr>
          <tr><td><code>.bss</code></td><td>未初始化/零初始化的全局变量</td><td>只记录大小，运行时清零，不占文件空间</td></tr>
          <tr><td><code>.rodata</code></td><td>只读常量、字符串、跳转表</td><td>合并到只读段</td></tr>
          <tr><td><code>.symtab</code></td><td>符号表：名字、类型、绑定、所在段、偏移</td><td>解析符号引用</td></tr>
          <tr><td><code>.rela.text</code></td><td>重定位记录：哪里、按什么类型、加什么</td><td>填入最终地址</td></tr>
        </table>
        <p>用 <code>readelf -S</code> 看段，<code>readelf -s</code> 看符号，<code>objdump -dr</code> 看反汇编与重定位。可执行文件（ET_EXEC/ET_DYN）与 .o（ET_REL）的结构相似，但地址已确定/可加载。</p>
        <div class="callout info"><div class="c-title">bss 为什么省空间</div><p>未初始化全局变量默认是 0，不需要在文件里存一堆 0；只需记录“需要多少字节、运行时清零”。这就是 <code>.bss</code> 与 <code>.data</code> 的关键差别。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'symbols', num: '7.2', title: '符号解析：谁定义了 sum',
      html: `
        <p>链接器维护全局符号表：<b>定义的符号</b>（本文件提供）和<b>引用的符号</b>（本文件需要）。规则：</p>
        <ul>
          <li>强符号：函数名、已初始化的全局变量；弱符号：未初始化全局变量、<code>__attribute__((weak))</code>。</li>
          <li>多个强符号同名 → 链接错误（duplicate symbol）。</li>
          <li>一个强符号 + 多个弱符号 → 选强符号。</li>
          <li>多个弱符号 → 任选一个（常见坑：两个 .o 都定义未初始化的 <code>int x</code>，链接器可能选错大小/类型）。</li>
          <li>只有引用、没有定义 → 未定义符号错误（除非来自库）。</li>
        </ul>
        <pre data-lang="bash"><code>nm -C main.o        # U=未定义, T=代码, D=已初始化数据, B=bss
readelf -s main.o
gcc -o app main.o util.o -L. -lutil</code></pre>
        <p><code>static</code> 把符号变成局部符号，不参与跨文件解析；这也是避免命名冲突的常用手段。头文件里的 <code>static inline</code> 每个翻译单元各有一份，不会重复定义。</p>
        ${CA.quizHTML({
          id: 'ch07-q-weak', q: '两个 .o 都定义了未初始化的全局 <code>int x;</code>，链接时通常怎样？',
          options: ['两个都是弱符号，链接器任选一个，可能不报错', '一定报 duplicate symbol', '自动变成两个不同的 x', '编译器自动加 static'],
          answer: 0, explain: '<b>正确。</b>未初始化全局变量是弱符号（common），多个弱符号可能被合并/任选，容易造成隐蔽 bug；用 <code>-fno-common</code> 可让重复定义报错。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'reloc', num: '7.3', title: '重定位：把占位符换成地址',
      html: `
        <p>编译 <code>main.c</code> 时，编译器不知道 <code>sum</code> 最终在哪，于是生成一条 <code>call</code> 并把位移留 0，同时在 <code>.rela.text</code> 里记一笔：在偏移 X、类型 R_X86_64_PC32、符号 sum、加数 -4。链接器算出最终地址后填入。</p>
        <p>PC 相对位移公式（call 指令）：</p>
        <blockquote><p><code>disp = S + A - P</code>，其中 S=目标地址，A=加数（call 通常是 -4），P=重定位位置（位移字段的地址）。</p></blockquote>
        <p>下面是一个可操作的链接模型：</p>
        <div class="control-row"><label class="checkbox"><input type="checkbox" id="lkMissing"> 移除 sum 的定义</label><button class="btn primary sm" type="button" id="lkStep">下一步</button><button class="btn sm" type="button" id="lkReset">重置</button></div>
        <pre id="lkLog" class="console" style="min-height:100px">点击“下一步”开始链接。</pre>
        <div id="lkBytes" class="readout" style="grid-template-columns:repeat(4,1fr)"></div>
      `,
      init: function (sec) {
        var LL = window.LinkLab, m = null;
        var log = sec.querySelector('#lkLog'), bytes = sec.querySelector('#lkBytes');
        function reset() { m = new LL({ base: 0x400000n, alignment: 16n, missing: sec.querySelector('#lkMissing').checked }); log.textContent = '已准备 main.o 与 util.o。'; render(); }
        function render() {
          if (!m) return;
          var s = m.snapshot();
          bytes.innerHTML = '<div><span>CALL SITE</span><b>' + (s.site ? '0x' + s.site.toString(16) : '—') + '</b></div><div><span>TARGET</span><b>' + (s.target ? '0x' + s.target.toString(16) : '—') + '</b></div><div><span>DISP</span><b>' + (s.displacement != null ? s.displacement.toString() : '—') + '</b></div><div><span>CALL BYTES</span><b style="font-size:10px">' + s.call.map(function (x) { return x.toString(16).padStart(2, '0'); }).join(' ') + '</b></div>';
        }
        function step() {
          if (!m) reset();
          try {
            var r = m.step();
            if (r.phase === 'layout') log.textContent = '1. 布局：main 从 0x' + r.caller.toString(16) + ' 开始；call 位移字段在 0x' + r.site.toString(16) + '；sum 对齐到 0x' + r.target.toString(16) + '。';
            else if (r.phase === 'resolve') log.textContent = '2. 符号解析：sum → 0x' + r.target.toString(16) + '。';
            else if (r.phase === 'relocate') log.textContent = '3. 重定位：disp = S + A − P = 0x' + r.target.toString(16) + ' + (-4) − 0x' + (r.site).toString(16) + ' = ' + r.displacement.toString() + '；写入 ' + r.bytes.map(function (x) { return x.toString(16).padStart(2, '0'); }).join(' ') + '。';
            else if (r.phase === 'error') log.textContent = '✕ 链接错误：' + r.error + '（在真实链接器中是 undefined reference）';
            else log.textContent = '链接完成。';
            render();
          } catch (e) { log.textContent = '✕ ' + e.message; }
        }
        sec.querySelector('#lkStep').addEventListener('click', step);
        sec.querySelector('#lkReset').addEventListener('click', reset);
        sec.querySelector('#lkMissing').addEventListener('change', reset);
        reset();
      }
    },
    {
      id: 'dynamic', num: '7.4', title: '静态库、动态链接与 GOT/PLT',
      html: `
        <p><b>静态库</b>（<code>.a</code>）是 .o 的归档。链接器从左到右扫描命令行，只抽取“当前未定义符号”所需的成员；顺序很重要：<code>gcc main.o -lutil</code> 通常可以，<code>gcc -lutil main.o</code> 可能失败。</p>
        <p><b>动态库</b>（<code>.so</code>）在加载/运行时解析。可执行文件里保留符号引用与重定位信息；动态链接器在启动时（或延迟到第一次调用）绑定地址。</p>
        <ul>
          <li><b>PIC</b>：位置无关代码，用 PC 相对寻址访问全局数据/函数，避免绝对地址。</li>
          <li><b>GOT</b>：全局偏移表，存放外部符号的绝对地址；PIC 通过 GOT 间接访问数据。</li>
          <li><b>PLT</b>：过程链接表，每个外部函数一个跳板；第一次调用触发动态链接器解析，之后跳到真实地址（延迟绑定）。</li>
        </ul>
        <pre data-lang="bash"><code>ldd ./app                 # 依赖哪些动态库
readelf -d ./app          # 动态段、NEEDED、RPATH
objdump -d -j .plt ./app  # 看 PLT 跳板
LD_DEBUG=bindings ./app   # 观察绑定过程（glibc）</code></pre>
        <div class="callout warn"><div class="c-title">静态链接不是“更安全”</div><p>静态链接把库代码复制进可执行文件，部署简单但体积大、库更新需重新链接；动态链接共享库、便于修复，但有版本/路径/加载时依赖问题。两者都要注意许可证。</p></div>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: [],
  afterRender: function () { document.title = '第 7 章 · 链接 · 计算之境'; }
});
