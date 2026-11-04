CA.registerChapter('ch03', {
  summary: '这一章把 C 程序落到机器层：寄存器、操作数、条件码、栈帧与过程调用。你会读懂 AT&T 汇编，知道局部变量和参数在哪里，理解数组/结构体的内存布局，最后看到缓冲区溢出如何改写返回地址，以及 NX/ASLR/ROP 如何改变攻防。',
  objectives: [
    '能读懂常见 AT&T 指令（mov/lea/add/sub/cmp/test/jmp/call/ret）与操作数格式。',
    '能解释条件码与 jcc 的关系，并把 if/while/for 对应到跳转。',
    '能画出 x86-64 栈帧，说明参数、返回地址、saved rbp 与局部变量的位置。',
    '能计算数组/结构体字段的地址与对齐。',
    '能解释缓冲区溢出的栈布局，以及 ROP 为什么能在 NX 下工作。'
  ],
  sections: [
    {
      id: 'asm', num: '3.1', title: '寄存器、操作数与 AT&T 语法',
      html: `
        <p>x86-64 有 16 个通用 64 位寄存器。名字沿袭历史：<code>%rax</code> 的 32 位版本是 <code>%eax</code>，16 位是 <code>%ax</code>，8 位是 <code>%al</code>。写 32 位寄存器会零扩展高 32 位；写 8/16 位只改低位。</p>
        <table>
          <tr><th>寄存器</th><th>传统角色</th><th>调用约定</th></tr>
          <tr><td><code>%rax</code></td><td>累加器/返回值</td><td>调用者保存</td></tr>
          <tr><td><code>%rdi, %rsi, %rdx, %rcx, %r8, %r9</code></td><td>参数 1–6</td><td>调用者保存</td></tr>
          <tr><td><code>%rbx, %rbp, %r12–%r15</code></td><td>被调用者保存</td><td>callee-saved</td></tr>
          <tr><td><code>%rsp</code></td><td>栈指针</td><td>特殊</td></tr>
          <tr><td><code>%rip</code></td><td>下一条指令地址</td><td>特殊</td></tr>
        </table>
        <p>AT&T 语法是“源在前、目的在后”：<code>movq %rax, %rbx</code> 把 rax 的值写到 rbx。操作数可以是立即数 <code>$0x10</code>、寄存器 <code>%rax</code>、内存 <code>8(%rax)</code>，以及比例变址 <code>(%rax,%rdx,4)</code>。</p>
        <pre data-lang="asm"><code>movq 8(%rdi), %rax      # rax = *(long *)(rdi + 8)
movq %rax, (%rsi)       # *(long *)rsi = rax
leaq 8(%rax,%rdx,4), %rcx  # rcx = rax + 4*rdx + 8（只算地址，不访存）
addq $1, %rax           # rax += 1
cmpq %rsi, %rdi         # 计算 rdi - rsi，设置条件码（不写回）
testq %rax, %rax        # 计算 rax & rax，设置 ZF/SF
</code></pre>
        <div class="callout info"><div class="c-title">lea 不是“加载”</div><p><code>leaq</code> 只做地址算术，不访问内存。编译器常用它做乘加：<code>leaq (%rdi,%rdi,2),%rax</code> 等于 <code>rax = 3*rdi</code>，比乘法指令更轻。</p></div>
        ${CA.quizHTML({
          id: 'ch03-q-lea', q: '<code>leaq 8(%rax,%rdx,4), %rcx</code> 计算什么？',
          options: ['rcx = rax + 4*rdx + 8', 'rcx = *(rax + 4*rdx + 8)', 'rcx = 8*rax + 4*rdx', 'rcx = rax + rdx + 12'],
          answer: 0, explain: '<b>正确。</b>比例变址的公式是 base + index*scale + disp；lea 只算地址，不读写内存。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'control', num: '3.2', title: '条件码、分支与循环',
      html: `
        <p><code>cmp a,b</code> 计算 <code>b - a</code>；<code>test a,b</code> 计算 <code>b &amp; a</code>。它们只设置条件码：ZF（结果为零）、SF（结果为负）、OF（有符号溢出）、CF（无符号进位/借位）。</p>
        <p>条件跳转读这些标志：</p>
        <table>
          <tr><th>指令</th><th>条件</th><th>C 语义</th></tr>
          <tr><td><code>je</code> / <code>jne</code></td><td>ZF=1 / ZF=0</td><td>== / !=</td></tr>
          <tr><td><code>jl</code> / <code>jge</code></td><td>SF≠OF / SF=OF</td><td>有符号 &lt; / ≥</td></tr>
          <tr><td><code>jb</code> / <code>jae</code></td><td>CF=1 / CF=0</td><td>无符号 &lt; / ≥</td></tr>
          <tr><td><code>jg</code> / <code>jle</code></td><td>ZF=0 且 SF=OF / ZF=1 或 SF≠OF</td><td>有符号 &gt; / ≤</td></tr>
        </table>
        <pre data-lang="c"><code>// C: if (x &lt; y) return y; else return x;
// asm（概念）：
cmpq %rsi, %rdi     # rdi - rsi
jge  .Lelse         # rdi >= rsi → else
movq %rsi, %rax
ret
.Lelse:
movq %rdi, %rax
ret</code></pre>
        <p>循环通常编译成“跳到中间测试”或“底部测试”。<code>while</code> 与 <code>for</code> 的差别在初始化/更新位置，不在条件码本身。</p>
        <div class="callout warn"><div class="c-title">有符号 vs 无符号</div><p><code>jl</code> 看 SF/OF，<code>jb</code> 看 CF。把有符号比较误用无符号跳转，是汇编阅读里最常见的错误之一。</p></div>
        ${CA.quizHTML({
          id: 'ch03-q-cmp', q: '<code>cmpq %rsi, %rdi; jl target</code> 在什么条件下跳转？',
          options: ['%rdi < %rsi（有符号）', '%rdi > %rsi（有符号）', '%rdi < %rsi（无符号）', '%rdi == %rsi'],
          answer: 0, explain: '<b>正确。</b>cmp 计算 rdi-rsi；jl 是“小于”的有符号条件（SF≠OF）。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'stack', num: '3.3', title: '栈帧与过程调用',
      html: `
        <p><code>call</code> 把返回地址压栈并跳到函数；<code>ret</code> 弹出返回地址并跳回。被调用者通常用 <code>push %rbp; mov %rsp,%rbp; sub $N,%rsp</code> 建立帧，用 <code>leave; ret</code> 拆除。</p>
        <div data-widget="frame"></div>
        <p>x86-64 的前 6 个整数参数在寄存器里，第 7 个起才在栈上。返回值在 <code>%rax</code>。调用者保存的寄存器（rax/rcx/rdx/rsi/rdi/r8–r11）如果跨调用还要用，必须自己保存；被调用者保存的寄存器（rbx/rbp/r12–r15）由函数负责恢复。</p>
        <div class="callout info"><div class="c-title">红区</div><p>System V ABI 允许叶子函数使用 <code>%rsp</code> 以下 128 字节的“红区”，不调整 rsp。信号处理会破坏红区，所以不要跨信号依赖它。</p></div>
        ${CA.quizHTML({
          id: 'ch03-q-stack', q: '为什么缓冲区溢出能改写返回地址？',
          options: ['缓冲区在栈上，向高地址写会依次覆盖 saved rbp 与返回地址', '返回地址存放在堆里', 'CPU 会自动把输入写到代码段', '因为 %rax 保存返回地址'],
          answer: 0, explain: '<b>正确。</b>栈向低地址增长，但数组写入向高地址；越界写会覆盖更高地址的 saved rbp/返回地址。'
        })}
      `,
      init: function (sec) {
        CA.viz.stepper(sec.querySelector('[data-widget="frame"]'), {
          title: '一次函数调用 · 栈帧生长与拆除',
          steps: [
            { label: '调用前', sub: 'caller', html: '<pre>caller 帧\n...\n%rsp → 对齐的栈顶\n参数：%rdi=x, %rsi=y</pre><p>调用者把参数放入寄存器；如果还有第 7 个参数，压栈。</p>' },
            { label: 'call', sub: '压返回地址', html: '<pre>高地址\n...\n返回地址 (8B)   ← call 压入\n%rsp → 新栈顶\n低地址</pre><p>call 把下一条指令地址压栈，然后跳到 callee。</p>' },
            { label: 'push rbp', sub: '保存旧帧', html: '<pre>...\n返回地址\nsaved rbp       ← push %rbp\n%rsp/%rbp → 这里</pre><p>保存调用者的帧指针，随后 <code>mov %rsp,%rbp</code>。</p>' },
            { label: 'sub rsp', sub: '局部变量', html: '<pre>...\n返回地址\nsaved rbp\n局部变量/数组    ← sub $N,%rsp\n%rsp → 栈顶</pre><p>为局部变量分配空间；数组从低地址向高地址写。</p>' },
            { label: 'leave', sub: '恢复', html: '<pre>...\n返回地址       ← leave 后 %rsp 指向这里\nsaved rbp\n（局部变量释放）</pre><p><code>leave</code> = <code>mov %rbp,%rsp; pop %rbp</code>。</p>' },
            { label: 'ret', sub: '返回', html: '<pre>...\n%rsp → 调用者栈顶\n返回地址已弹出 → %rip</pre><p>ret 弹出返回地址并跳回 caller；返回值在 %rax。</p>' }
          ],
          foot: '图中省略对齐填充、callee-saved 寄存器与红区；用于建立栈帧直觉。'
        });
      }
    },
    {
      id: 'data', num: '3.4', title: '数组、结构体与内存布局',
      html: `
        <p>C 的数组在内存中连续存放，按行优先。对 <code>int a[4][8]</code>，<code>a[i][j]</code> 的地址是 <code>a + (i*8 + j)*4</code>。指针运算会按元素大小缩放；<code>a[i]</code> 等价于 <code>*(a+i)</code>。</p>
        <p>结构体字段按声明顺序排列，但编译器会插入填充，使每个字段满足对齐要求，整体大小是最大对齐的倍数。例如：</p>
        <pre data-lang="c"><code>struct S {
    char c;     // offset 0
    int  i;     // offset 4（填充 3 字节）
    char d;     // offset 8
    long l;     // offset 16（填充 7 字节）
};              // sizeof = 24, align = 8</code></pre>
        <p>调整字段顺序可以减小 sizeof（把 long 放前面）。联合体（union）所有成员共享起始地址，大小是最大成员；它常用于类型双关（type punning），但在 C++ 中要小心严格别名。</p>
        <table>
          <tr><th>构造</th><th>地址/大小</th><th>常见错误</th></tr>
          <tr><td><code>int *p; p+1</code></td><td>+4 字节</td><td>误以为 +1 字节</td></tr>
          <tr><td><code>char *p; p+1</code></td><td>+1 字节</td><td>用它遍历 int 数组</td></tr>
          <tr><td><code>a[i]</code></td><td><code>*(a+i)</code></td><td>越界不检查</td></tr>
          <tr><td><code>s.f</code> / <code>p-&gt;f</code></td><td>基址 + 字段偏移</td><td>对齐/填充假设错误</td></tr>
        </table>
        ${CA.quizHTML({
          id: 'ch03-q-size', q: '上面的 <code>struct S</code> 在 x86-64 上通常 sizeof 是多少？',
          options: ['24', '16', '13', '32'],
          answer: 0, explain: '<b>正确。</b>c@0，填充到 4，i@4；d@8，填充到 16，l@16；总共 24，最大对齐 8。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'overflow', num: '3.5', title: '缓冲区溢出、NX 与 ROP',
      html: `
        <p>经典溢出：<code>char buf[64]; gets(buf);</code> 不检查长度。输入超过 64 字节后，多出的字节覆盖 saved rbp 与返回地址。函数 <code>ret</code> 时，CPU 跳到攻击者指定的地址。</p>
        <pre data-lang="text"><code>[ 64 字节 buf ][ saved rbp ][ 返回地址 ][ 注入代码/数据 ]</code></pre>
        <p>防御与绕过：</p>
        <ul>
          <li><b>栈不可执行（NX）</b>：注入的代码不能执行；攻击者改用 ROP，把已有代码片段（gadget）串起来。</li>
          <li><b>栈保护（canary）</b>：返回前检查哨兵；溢出会破坏哨兵并被发现。</li>
          <li><b>ASLR</b>：栈/库地址随机化；需要信息泄露或暴力猜测。</li>
          <li><b>CFI</b>：限制间接跳转/返回目标。</li>
        </ul>
        <p>ROP 的核心是 <code>ret</code>：栈上依次放 gadget 地址与数据，每条 <code>ret</code> 把下一条地址弹入 <code>%rip</code>。例如 <code>pop %rdi; ret</code> 可以从栈上取 cookie，再跳到 <code>touch2</code>。</p>
        <div class="callout lab"><div class="c-title">实验</div><p>Bomb Lab 训练读汇编与调试；Attack Lab 训练构造 payload 与 ROP。两者都需要在隔离环境中进行，不要对真实系统尝试。</p><p><a class="btn primary sm" href="../labs/lab.html?lab=bomblab">进入 Bomb Lab →</a> <a class="btn sm" href="../labs/lab.html?lab=attacklab">进入 Attack Lab →</a></p></div>
        ${CA.quizHTML({
          id: 'ch03-q-rop', q: '在 NX 开启、栈不可执行时，ROP 为什么仍然能工作？',
          options: ['它复用代码段中已有的、以 ret 结尾的 gadget', '它把代码写到堆上再执行', '它关闭了 NX', '它只利用数据段'],
          answer: 0, explain: '<b>正确。</b>ROP 不注入新代码，而是用已有指令片段 + ret 链改变控制流；NX 只阻止执行栈上的数据。'
        })}
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['bomblab', 'attacklab', 'bufferlab'],
  afterRender: function () { document.title = '第 3 章 · 程序的机器级表示 · 计算之境'; }
});
