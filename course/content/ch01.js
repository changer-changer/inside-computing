CA.registerChapter('ch01', {
  summary: '这一章不急着钻进寄存器，而是先建立一张地图：一行 C 代码如何变成可执行文件，如何在操作系统上变成一个进程，又如何与存储层次、I/O 设备和网络协作。后面的每一章，都是把这张地图上的某一段放大。',
  objectives: [
    '能说出 hello.c 从源码到进程经过的四个编译阶段与加载/运行阶段。',
    '能区分源文件、可重定位目标文件、可执行文件与进程地址空间。',
    '能解释存储层次为什么存在，以及局部性对性能的影响。',
    '能描述操作系统提供的进程、虚拟内存和文件三个抽象。',
    '能用一个端到端例子说明 CPU、内存、I/O 与系统调用如何协作。'
  ],
  sections: [
    {
      id: 'hello', num: '1.1', title: '从一行 C 代码开始',
      html: `
        <p class="lead">几乎所有计算机系统课程都从同一个程序开始：打印一行字。它足够小，能在一屏内看完；又足够完整，能牵出编译、链接、加载、系统调用、内存和 I/O 的整条链。</p>
        <pre data-lang="c"><code>#include &lt;stdio.h&gt;

int main(void) {
    printf("hello, world\\n");
    return 0;
}</code></pre>
        <p>把这段文本保存为 <code>hello.c</code>，它在磁盘上只是一串字节。每个字节对应一个字符的 ASCII/UTF-8 编码；换行是 <code>0x0A</code>，字符串结尾有 <code>0x00</code>。计算机并不“理解”C；它只执行机器指令。中间必须经过一条翻译链。</p>
        <p>一个常见的误解是“编译器把 C 直接变成 CPU 执行的东西”。实际上，编译系统由多个程序组成，每一步的输出都是下一步的输入：预处理器、编译器、汇编器、链接器。每一步都改变表示形式，但保留程序的语义。</p>
        <div class="callout info"><div class="c-title">为什么从 hello 开始</div><p>因为它同时触发了：文件 I/O（读源码）、内存分配、字符串处理、函数调用、系统调用（write）、进程创建（shell 的 fork/exec）和终端设备。一个最小的程序，已经把整机的主要部件都串了一遍。</p></div>
        ${CA.quizHTML({
          id: 'ch01-q-source', q: '磁盘上的 <code>hello.c</code> 对计算机来说是什么？',
          options: ['一串按某种编码解释的字节', 'CPU 可以直接执行的机器指令', '已经加载到内存的进程', '一段由操作系统维护的虚拟地址'],
          answer: 0, explain: '<b>正确。</b>源文件是字节序列；编辑器按 UTF-8/ASCII 解释成字符。CPU 只执行加载到内存中的机器指令。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'pipeline', num: '1.2', title: '编译系统：四次表示变换',
      html: `
        <p>以 GCC 为例，四个阶段可以分别观察：</p>
        <pre data-lang="bash"><code>cpp hello.c -o hello.i      # 预处理：展开头文件与宏
cc1 hello.i -o hello.s      # 编译：生成汇编
as hello.s -o hello.o       # 汇编：生成可重定位目标文件
ld hello.o -o hello         # 链接：合并、解析符号、重定位
./hello                     # 由 shell 加载并运行</code></pre>
        <p>点击下面的轨道，逐步查看每一阶段的输入、输出和它真正做的事。</p>
        <div data-widget="life"></div>
        <h3>目标文件里有什么？</h3>
        <p><code>hello.o</code> 不是“半个可执行文件”。它包含：</p>
        <ul>
          <li><b>代码段</b>：已经编码成机器指令的函数，但地址还是相对的。</li>
          <li><b>数据段</b>：已初始化的全局/静态变量。</li>
          <li><b>符号表</b>：这个文件定义了什么、引用了什么。</li>
          <li><b>重定位表</b>：哪些位置需要在链接时填入最终地址。</li>
        </ul>
        <p>链接器把多个 <code>.o</code> 和库合并，解析 <code>printf</code> 这样的未定义符号，重定位调用地址，最后生成可执行文件。若使用动态链接，<code>printf</code> 的真正地址要到加载时才由动态链接器解析——这就是第 7 章的主题。</p>
        <div class="callout warn"><div class="c-title">“编译通过”不等于“能运行”</div><p>编译只检查单个翻译单元的语法与类型；链接才检查外部符号是否存在；加载才检查解释器、依赖库和权限；运行才可能遇到段错误、系统调用失败或逻辑错误。排错时要先判断失败发生在哪一层。</p></div>
        ${CA.quizHTML({
          id: 'ch01-q-link', q: '链接器最重要的两项工作是什么？',
          options: ['符号解析与重定位', '语法分析与代码优化', '分配寄存器与生成汇编', '创建进程与加载页面'],
          answer: 0, explain: '<b>正确。</b>链接器把符号引用与定义匹配（符号解析），再把最终地址写进需要重定位的位置（重定位）。'
        })}
      `,
      init: function (sec) { CA.viz.lifecycle(sec.querySelector('[data-widget="life"]')); }
    },
    {
      id: 'memory', num: '1.3', title: '存储层次：为什么需要 Cache',
      html: `
        <p>程序运行时，指令和数据必须靠近 CPU。但靠近 CPU 的存储又快又贵又小；远端的存储便宜、大、慢。计算机用一组层次结构来折中：</p>
        <div data-widget="ladder"></div>
        <p>层次结构能工作，靠的是<b>局部性</b>：</p>
        <ul>
          <li><b>时间局部性</b>：刚访问过的数据，很可能马上再次被访问（循环变量、热代码）。</li>
          <li><b>空间局部性</b>：访问了地址 x，很可能很快访问 x 附近（数组遍历、顺序指令）。</li>
        </ul>
        <p>Cache 把“最近用过的块”从慢速层搬到快速层。命中时延接近上一层；缺失时要付出下层延迟，并把整块搬上来。第 6 章会把地址拆成 tag/set/offset，并让你亲手写一个 Cache 模拟器。</p>
        <div class="callout info"><div class="c-title">一个数量级直觉</div><p>寄存器约 1 个周期，L1 约 4–5 个周期，DRAM 约 200–300 个周期，SSD 约 10⁵ 个周期。一次缓存缺失可能等于几百条指令的时间；这就是为什么“访问顺序”能决定程序快慢。</p></div>
        ${CA.quizHTML({
          id: 'ch01-q-locality', q: '按行遍历二维数组通常比按列遍历快，主要因为？',
          options: ['空间局部性：相邻元素在同一缓存块/同一行', '按行遍历的指令更少', '编译器只优化行优先的代码', '列优先会产生更多系统调用'],
          answer: 0, explain: '<b>正确。</b>C 的二维数组按行连续存放；按行访问会复用同一缓存行，按列访问会反复跨行、造成大量缺失。'
        })}
      `,
      init: function (sec) { CA.viz.memLadder(sec.querySelector('[data-widget="ladder"]')); }
    },
    {
      id: 'os', num: '1.4', title: '操作系统：三个关键抽象',
      html: `
        <p>应用程序不直接操作硬盘、网卡和物理内存。操作系统提供三个抽象，让程序可以“安全地假装自己独占一台机器”：</p>
        <table>
          <tr><th>抽象</th><th>程序看到什么</th><th>真实发生什么</th></tr>
          <tr><td><b>进程</b></td><td>自己独占 CPU，按顺序执行</td><td>CPU 在多个进程间切换，保存/恢复上下文</td></tr>
          <tr><td><b>虚拟内存</b></td><td>一段连续、私有的地址空间</td><td>页表把虚拟页映射到物理页，按需装入</td></tr>
          <tr><td><b>文件</b></td><td>一串字节，可按名打开、读写</td><td>内核管理文件描述符、偏移、缓存和设备</td></tr>
        </table>
        <p>当程序需要离开用户态做特权操作时，通过<b>系统调用</b>进入内核：<code>read</code>、<code>write</code>、<code>fork</code>、<code>execve</code>、<code>mmap</code>……CPU 从用户态切到内核态，内核完成工作后再返回。异常、中断和信号都走类似的“控制流被夺回”的机制，第 8 章会展开。</p>
        <h3>一次 hello 的完整路径</h3>
        <ol>
          <li>shell 读入命令，<code>fork</code> 创建子进程；</li>
          <li>子进程 <code>execve("./hello")</code>，加载器映射代码/数据；</li>
          <li>CPU 从入口开始取指、译码、执行；</li>
          <li><code>printf</code> 最终调用 <code>write(1, ...)</code>；</li>
          <li>内核把字节送到终端设备，进程退出；</li>
          <li>父进程 <code>wait</code> 回收子进程，shell 重新显示提示符。</li>
        </ol>
        <p>这条路径把编译器、链接器、加载器、CPU、Cache、虚拟内存、系统调用和 I/O 全部串起来。后面的章节会逐段放大；现在只要记住这张地图。</p>
        ${CA.quizHTML({
          id: 'ch01-q-vm', q: '虚拟内存给每个进程的主要幻觉是什么？',
          options: ['每个进程都拥有一段连续、私有的地址空间', '每个进程都拥有全部物理内存', '每个进程都不需要页表', '每个进程的指针都直接等于物理地址'],
          answer: 0, explain: '<b>正确。</b>虚拟地址由 MMU/页表翻译到物理地址；进程看到的是连续私有空间，物理页可以共享、换出、按需分配。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'next', num: '1.5', title: '接下来：把地图变成可操作的模型',
      html: `
        <p>这门课不要求你背下整张图，而是让你在每一段上做实验：改变一个比特、一条指令、一个缓存参数、一个进程调度顺序，观察状态如何传播。第 2 章从最底层开始——比特。</p>
        <div class="grid-3">
          <div class="card"><h4>先建立表示</h4><p>第 2 章：补码、整数运算、IEEE 754。你会知道 <code>0xFFFFFFFF</code> 为什么既可能是 4294967295，也可能是 −1。</p></div>
          <div class="card"><h4>再看执行</h4><p>第 3–4 章：x86-64 指令、栈帧、Y86-64 流水线。你会在单步中看到 PC、寄存器和内存一起变化。</p></div>
          <div class="card"><h4>最后看系统</h4><p>第 6–12 章：Cache、链接、进程、虚拟内存、I/O、网络与并发。每一章都配一个官方实验入口。</p></div>
        </div>
        <div class="callout lab"><div class="c-title">两种进入方式</div><p>想先看 3D 整机，回到 <a href="../index.html">3D 实验台</a>；想按课程顺序学，直接进入第 2 章。实验可以从 <a href="../labs/index.html">实验室</a> 随时开始。</p></div>
        <p>学习建议：每章先读“为什么”，再动可视化，最后做实验。不要用“看过动画”代替“能解释为什么”。</p>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: [],
  afterRender: function () { document.title = '第 1 章 · 计算机系统漫游 · 计算之境'; }
});
