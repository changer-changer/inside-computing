CA.registerChapter('ch02', {
  summary: '计算机里的每一个值——整数、指针、字符、浮点数——最终都是一串比特。本章先把“比特如何被解释”讲透：无符号与补码、转换与扩展、整数运算与溢出、移位与掩码；再把同样的视角带到 IEEE 754 浮点，理解精度、舍入与特殊值。最后进入 Data Lab，用真实 C 编译器验证你的位级实现。',
  objectives: [
    '能在二进制、十六进制、无符号十进制与有符号十进制之间转换 32 位模式。',
    '能解释补码的符号位权重，并判断转换、扩展、截断后的值。',
    '能识别有符号溢出的条件，区分 C 的未定义行为与硬件的模运算。',
    '能拆解 binary32 的符号、指数、小数，判断规格化/非规格化/特殊值。',
    '能用掩码、移位和算术恒等式实现 Data Lab 的整数与浮点函数。'
  ],
  sections: [
    {
      id: 'bits', num: '2.1', title: '一切皆比特，意义来自上下文',
      html: `
        <p class="lead">同一串字节，既可以是整数、指针，也可以是一段 UTF-8 文本、一条机器指令，或者一张图片的像素。比特本身没有类型；<em>类型和上下文</em>决定如何解释它。</p>
        <p>在 64 位机器上，一个地址是 8 字节（64 位），一个 <code>int</code> 通常是 4 字节（32 位），一个 <code>char</code> 是 1 字节。内存可以看成一个巨大的字节数组，每个字节有自己的地址。程序做的事，本质上就是在这片字节上按类型读写、做运算、改变控制流。</p>
        <h3>十六进制：给人看的二进制</h3>
        <p>4 个比特正好对应 1 个十六进制数字，所以 32 位写成 8 位十六进制最紧凑。例如 <code>0xDEADBEEF</code> 的每一位都对应 4 个比特：</p>
        <pre data-lang="text"><code>D    E    A    D    B    E    E    F
1101 1110 1010 1101 1011 1110 1110 1111</code></pre>
        <p>下面的“手术台”把 32 个比特逐个摊开。点击任意一位翻转它，观察十六进制、无符号、有符号和二进制读数如何一起变化。注意最高位（bit 31）在无符号解释里权重是 +2³¹，在补码解释里权重是 −2³¹。</p>
        <div data-widget="bitlab"></div>
        <div class="callout info"><div class="c-title">字长与字节序</div><p>同一台机器上，<code>sizeof(long)</code> 可能是 8，也可能是 4；不要假设。多字节对象在内存中的排列还涉及字节序：x86-64 是小端，低地址存最低有效字节。把 <code>0x12345678</code> 放进内存，字节序列是 <code>78 56 34 12</code>。</p></div>
        <h3>位、字节、字</h3>
        <table>
          <tr><th>单位</th><th>位数</th><th>典型 C 类型</th><th>能表示的范围（有符号）</th></tr>
          <tr><td>字节</td><td>8</td><td><code>char</code> / <code>unsigned char</code></td><td>−128 … 127</td></tr>
          <tr><td>字</td><td>16</td><td><code>short</code></td><td>−32,768 … 32,767</td></tr>
          <tr><td>双字</td><td>32</td><td><code>int</code></td><td>−2,147,483,648 … 2,147,483,647</td></tr>
          <tr><td>四字</td><td>64</td><td><code>long</code> / 指针</td><td>−2⁶³ … 2⁶³−1</td></tr>
        </table>
        <p>“字长”是机器一次处理/寻址的自然宽度。64 位程序里指针是 8 字节，但 <code>int</code> 仍是 4 字节。C 标准只规定最小范围，具体宽度由 ABI 决定。</p>
        ${CA.quizHTML({
          id: 'ch02-q-hex', q: '字节 <code>0x41</code> 作为 <code>char</code> 是字母 <code>A</code>，作为 <code>int</code> 是 65。这说明什么？',
          options: ['比特的模式相同，类型/上下文决定解释方式', '0x41 在内存中会同时存成 A 和 65', '字符和整数使用不同的物理存储介质', '必须先转成十进制才能存储'],
          answer: 0, explain: '<b>正确。</b>内存里只有 0100 0001。ASCII 表把 0x41 映射到 A；整数解释则把它读成 65。类型系统负责选择读法。'
        })}
      `,
      init: function (sec) { CA.viz.bitLab(sec.querySelector('[data-widget="bitlab"]'), { value: 0xDEADBEEF }); }
    },
    {
      id: 'unsigned', num: '2.2', title: '无符号数与补码：同一组比特的两种读法',
      html: `
        <p>对 <code>w</code> 位模式 <code>x</code>，无符号解释是：</p>
        <blockquote><p><code>B2U(x) = Σ x<sub>i</sub> · 2<sup>i</sup></code>，i 从 0 到 w−1。</p></blockquote>
        <p>补码（two's complement）把最高位的权重改成负数：</p>
        <blockquote><p><code>B2T(x) = −x<sub>w−1</sub> · 2<sup>w−1</sup> + Σ x<sub>i</sub> · 2<sup>i</sup></code>，i 从 0 到 w−2。</p></blockquote>
        <p>这不是“符号位 + 绝对值”。例如 8 位的 <code>1000 0001</code> 不是 −1，而是 −128 + 1 = −127；<code>1111 1111</code> 才是 −1。补码的好处是加法器不需要区分正负：同一套二进制加法，对无符号和补码都成立（只是溢出解释不同）。</p>
        <p>拖动下面的轮盘：同一个 0–255 的无符号值，按补码读就是 −128 到 127。指针越过 127 时，有符号读数会“跳”到 −128，这正是模 2⁸ 的环绕。</p>
        <div data-widget="wheel"></div>
        <h3>几个必须记住的端点</h3>
        <table>
          <tr><th>位模式（8 位）</th><th>无符号</th><th>补码</th><th>说明</th></tr>
          <tr><td><code>0000 0000</code></td><td>0</td><td>0</td><td>全零</td></tr>
          <tr><td><code>0111 1111</code></td><td>127</td><td>127</td><td><code>INT8_MAX</code></td></tr>
          <tr><td><code>1000 0000</code></td><td>128</td><td>−128</td><td><code>INT8_MIN</code>，取负仍是自己</td></tr>
          <tr><td><code>1111 1111</code></td><td>255</td><td>−1</td><td>全一</td></tr>
        </table>
        <p>32 位时，<code>INT_MIN = 0x80000000</code>，<code>INT_MAX = 0x7FFFFFFF</code>，<code>UINT_MAX = 0xFFFFFFFF</code>。这三个常量会在 Data Lab 里反复出现。</p>
        <div class="callout warn"><div class="c-title">不要把补码当成“取反加一”的定义</div><p>“取反加一”是求相反数的一种算法，不是补码的定义。定义是最高位权重为负。理解定义，才能解释为什么 <code>INT_MIN</code> 取负会溢出，以及为什么 <code>~x + 1</code> 对全零仍然得到零。</p></div>
        ${CA.quizHTML({
          id: 'ch02-q-ff', q: '位模式 <code>0xFF</code> 作为 8 位无符号数和 8 位补码分别是多少？',
          options: ['255 和 −1', '255 和 255', '127 和 −127', '−1 和 255'],
          answer: 0, explain: '<b>正确。</b>无符号：128+64+32+16+8+4+2+1=255；补码：−128+127=−1。'
        })}
        ${CA.quizHTML({
          id: 'ch02-q-min', q: '32 位补码中，<code>-INT_MIN</code> 的结果（按硬件模运算）是什么？',
          options: ['仍然是 INT_MIN', 'INT_MAX', '0', '未定义，一定崩溃'],
          answer: 0, explain: '<b>正确。</b><code>INT_MIN = 0x80000000</code>，取反加一仍是 <code>0x80000000</code>。在 C 中，<code>-INT_MIN</code> 是有符号溢出，属于未定义行为；这里说的是硬件位运算结果。'
        })}
      `,
      init: function (sec) { CA.viz.twosWheel(sec.querySelector('[data-widget="wheel"]')); }
    },
    {
      id: 'convert', num: '2.3', title: '转换、扩展与截断：值变了吗？',
      html: `
        <p>C 里的整数转换规则可以分成三类，每类的“位”与“值”变化不同：</p>
        <h3>1. 同宽度、有符号 ↔ 无符号</h3>
        <p>位模式不变，只是重新解释。把 <code>-1</code> 转成 <code>unsigned</code> 得到 <code>UINT_MAX</code>（32 位是 4294967295）。反过来，把 <code>UINT_MAX</code> 转成 <code>int</code> 在常见实现上得到 <code>-1</code>；C 标准对超出范围的有符号转换是实现定义，但主流平台都采用模运算。</p>
        <pre data-lang="c"><code>int a = -1;
unsigned b = (unsigned)a;      // 0xFFFFFFFF, 4294967295
int c = (int)0xFFFFFFFFu;      // 常见实现：-1

if (-1 &lt; 0U) { /* 不会执行 */ }
// 比较时 -1 被转成 unsigned，变成 UINT_MAX，所以 -1 &lt; 0U 为假</code></pre>
        <p>这类“隐式转换”是 C 里最经典的陷阱之一：只要一边是无符号，另一边就会被拉进无符号世界。</p>
        <h3>2. 扩展：从窄到宽</h3>
        <p>有符号扩展复制最高位（符号位）；无符号扩展在高位补 0。</p>
        <pre data-lang="text"><code>8 位 → 32 位
0x80  (-128)  → 0xFFFFFF80  (-128)   符号扩展
0x80  (128)   → 0x00000080  (128)    零扩展</code></pre>
        <p>把 <code>char</code> 转成 <code>int</code> 时，如果 <code>char</code> 有符号，就会发生符号扩展；这也是为什么 <code>getchar()</code> 返回 <code>int</code> 而不是 <code>char</code>——它需要能表示 EOF（−1）而不与合法字节 0xFF 混淆。</p>
        <h3>3. 截断：从宽到窄</h3>
        <p>直接丢弃高位，保留低 <code>w</code> 位，结果按 2<sup>w</sup> 取模。</p>
        <pre data-lang="text"><code>0x12345678  → 截成 16 位 → 0x5678
0x12345678  → 截成 8 位  → 0x78</code></pre>
        <p>截断不是“饱和”，也不是“四舍五入”。在做位运算时，经常先用掩码截断，再做移位，避免高位干扰。</p>
        <h3>用手术台验证</h3>
        <p>回到上面的 32 位手术台，试试 <code>0x000000FF</code>、<code>0xFFFFFF00</code>、<code>0x80000000</code>，同时看有符号和无符号读数。你能解释为什么同一个十六进制数会有两个十进制值吗？</p>
        <div class="callout info"><div class="c-title">C 的整数提升</div><p>比 <code>int</code> 窄的类型（<code>char</code>、<code>short</code>）在表达式中会先“提升”到 <code>int</code>。这会影响移位和比较的结果。写底层代码时，显式写 <code>unsigned</code> 或使用 <code>uint32_t</code> 往往更清楚。</p></div>
        ${CA.quizHTML({
          id: 'ch02-q-cmp', q: '<code>int x = -1; unsigned y = 1; x &lt; y</code> 的结果是什么？',
          options: ['假，因为 x 被转换成 UINT_MAX', '真，因为 −1 小于 1', '编译错误', '未定义'],
          answer: 0, explain: '<b>正确。</b>比较前 <code>x</code> 被转换成 <code>unsigned</code>，变成 4294967295，当然不小于 1。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'arith', num: '2.4', title: '整数运算：模运算、溢出与移位',
      html: `
        <p>补码加法的硬件行为就是“按 2<sup>w</sup> 取模”。无符号加法溢出时结果回绕；有符号加法在数学结果超出范围时发生溢出，但位模式仍然按同样规则环绕。</p>
        <h3>加法与溢出判定</h3>
        <p>对 <code>w</code> 位有符号数 <code>x</code>、<code>y</code>，令 <code>s = (x + y) mod 2<sup>w</sup></code>。当且仅当 <code>x</code> 与 <code>y</code> 同号，而 <code>s</code> 与它们异号时，发生有符号溢出：</p>
        <blockquote><p><code>overflow = ((x ^ s) &amp; (y ^ s)) &lt; 0</code></p></blockquote>
        <p>无符号加法的进位则看数学和是否 ≥ 2<sup>w</sup>。两个标志不是一回事：<code>UINT_MAX + 1</code> 有进位但无符号溢出；<code>INT_MAX + 1</code> 有符号溢出，结果变成 <code>INT_MIN</code>。</p>
        <div data-widget="overflow"></div>
        <h3>取负、乘法、除法</h3>
        <ul>
          <li>取负：<code>-x = ~x + 1</code>。对 <code>INT_MIN</code> 仍然是 <code>INT_MIN</code>。</li>
          <li>乘法：结果只保留低 <code>w</code> 位；<code>x * K</code> 可以用移位、加法和减法组合，例如 <code>x * 12 = (x &lt;&lt; 3) + (x &lt;&lt; 2)</code>。</li>
          <li>除以 2 的幂：无符号用逻辑右移；有符号直接算术右移会向 −∞ 舍入，而 C 要求向 0 舍入。对负数要先加偏置：<code>(x + (1 &lt;&lt; k) - 1) &gt;&gt; k</code>。</li>
        </ul>
        <pre data-lang="c"><code>// 有符号除以 8，向零舍入
int div8(int x) {
    return (x + ((x &gt;&gt; 31) &amp; 7)) &gt;&gt; 3;
}
// 注意：x 为 INT_MIN 时也可能溢出，实际工程要用更宽的临时类型</code></pre>
        <h3>左移与右移</h3>
        <p>C 的左移对负数是未定义行为；右移对负数是实现定义（常见平台做算术右移）。Data Lab 里我们使用补码平台的实际行为，但仍要避免依赖未定义行为。逻辑右移要用无符号类型：</p>
        <pre data-lang="c"><code>unsigned logical_shift(unsigned x, int n) {
    return x &gt;&gt; n;          // 无符号：高位补 0
}
int arithmetic_shift(int x, int n) {
    return x &gt;&gt; n;          // 常见实现：高位补符号位
}</code></pre>
        <div class="callout warn"><div class="c-title">C 的未定义行为不是“随便得到某个值”</div><p>编译器可以假设有符号溢出从不发生，并据此做优化。一个依赖溢出的程序可能在 <code>-O0</code> 下“看起来对”，在 <code>-O2</code> 下出错。写可移植代码时，用无符号运算表达模运算，或在运算前检查边界。</p></div>
        ${CA.quizHTML({
          id: 'ch02-q-ovf', q: '32 位下 <code>INT_MAX + 1</code> 的位模式是什么？',
          options: ['0x80000000，即 INT_MIN', '0x00000000', '0x7FFFFFFF', '0xFFFFFFFF'],
          answer: 0, explain: '<b>正确。</b>0x7FFFFFFF + 1 进位到最高位，得到 0x80000000。硬件结果是 INT_MIN；C 语言层面这是有符号溢出（UB）。'
        })}
        ${CA.quizHTML({
          id: 'ch02-q-shift', q: '对负数 <code>x</code>，表达式 <code>(unsigned)x &gt;&gt; 31</code> 得到什么？',
          options: ['1，因为逻辑右移把符号位移到最低位', '−1', '0x80000000', '取决于编译器'],
          answer: 0, explain: '<b>正确。</b>先转成无符号，右移是逻辑右移，高位补 0；原来的符号位最终落在 bit 0。'
        })}
      `,
      init: function (sec) { CA.viz.overflow(sec.querySelector('[data-widget="overflow"]')); }
    },
    {
      id: 'bitskills', num: '2.5', title: '位级技巧：掩码、提取与条件',
      html: `
        <p>底层的“聪明代码”通常来自几个恒等式。它们不是魔法，而是补码定义的直接推论。</p>
        <h3>掩码三件套</h3>
        <ul>
          <li><b>置位</b>：<code>x | (1 &lt;&lt; k)</code> 把第 k 位置 1。</li>
          <li><b>清位</b>：<code>x &amp; ~(1 &lt;&lt; k)</code> 把第 k 位清 0。</li>
          <li><b>翻转</b>：<code>x ^ (1 &lt;&lt; k)</code> 把第 k 位取反。</li>
          <li><b>提取</b>：<code>(x &gt;&gt; k) &amp; 1</code> 或 <code>(x &amp; (1 &lt;&lt; k)) != 0</code>。</li>
        </ul>
        <h3>四个常用恒等式</h3>
        <table>
          <tr><th>表达式</th><th>含义</th><th>为什么</th></tr>
          <tr><td><code>x &amp; (x - 1)</code></td><td>清除最低位的 1</td><td>减 1 会把最低位的 1 变 0，低位变 1；与自身相与即可清除</td></tr>
          <tr><td><code>x &amp; -x</code></td><td>取出最低位的 1</td><td><code>-x = ~x + 1</code>，只有最低位的 1 在两边都为 1</td></tr>
          <tr><td><code>!!x</code></td><td>把非零变成 1，零变成 0</td><td>两次逻辑非</td></tr>
          <tr><td><code>(x | -x) &gt;&gt; 31</code></td><td>非零返回 −1，零返回 0</td><td>非零时最高位为 1；再取反加一可构造 0/1 掩码</td></tr>
        </table>
        <p>Data Lab 里不能使用 <code>if</code>、循环或比较，所以“根据 x 是否为零选择 y 或 z”必须用掩码：</p>
        <pre data-lang="c"><code>// x ? y : z
int mask = ~(!x) + 1;     // x != 0 时 mask = 0xFFFFFFFF；x == 0 时 mask = 0
return (y &amp; ~mask) | (z &amp; mask);</code></pre>
        <h3>用手术台练习</h3>
        <p>在 32 位手术台上输入 <code>0x0000000F</code>，然后试试 <code>x &amp; (x-1)</code>、<code>x &amp; -x</code>、<code>!!x</code> 的直觉：最低位的 1 在哪里？清掉它之后变成什么？</p>
        <div class="callout lab"><div class="c-title">下一步：Data Lab</div><p>Data Lab 把这类技巧变成 13 个必须通过的函数。你只能用 <code>! ~ &amp; ^ | + &lt;&lt; &gt;&gt;</code>，常量 0–255，不能写循环/条件/函数调用。规则检查和真实编译都在实验页完成。</p><p><a class="btn primary sm" href="../labs/datalab.html">进入 Data Lab →</a></p></div>
        ${CA.quizHTML({
          id: 'ch02-q-lowbit', q: '<code>x = 0b10110100</code> 时，<code>x &amp; (x - 1)</code> 的结果是？',
          options: ['0b10110000', '0b10110101', '0b00110100', '0'],
          answer: 0, explain: '<b>正确。</b>最低位的 1 在 bit 2（值 4）。减 1 后变成 0b10110011；相与得到 0b10110000。'
        })}
        ${CA.quizHTML({
          id: 'ch02-q-cond', q: '要构造“x 非零时为全 1、x 为零时为全 0”的掩码，下面哪个可行？',
          options: ['~(!x) + 1', 'x &gt;&gt; 31', 'x | 1', '!!x'],
          answer: 0, explain: '<b>正确。</b><code>!x</code> 得到 0/1，取反得到 0xFFFFFFFF/0xFFFFFFFE，再加 1 得到 0/0xFFFFFFFF。注意 <code>x &gt;&gt; 31</code> 只对负数成立。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'float', num: '2.6', title: 'IEEE 754：用定点字段表示实数',
      html: `
        <p>浮点数不是“小数点会动”的十进制数，而是一种<b>二进制科学计数法</b>。binary32（C 的 <code>float</code>）把 32 位分成三段：</p>
        <table>
          <tr><th>字段</th><th>位数</th><th>作用</th></tr>
          <tr><td>符号 s</td><td>1</td><td>0 正、1 负（包括 +0/−0）</td></tr>
          <tr><td>指数 E</td><td>8</td><td>偏置 127；实际指数 = E − 127</td></tr>
          <tr><td>小数 M</td><td>23</td><td>规格化数隐含前导 1，有效数 = 1.M</td></tr>
        </table>
        <p>规格化数的值是：</p>
        <blockquote><p><code>(−1)<sup>s</sup> × (1 + M/2<sup>23</sup>) × 2<sup>E−127</sup></code></p></blockquote>
        <p>例如 <code>1.0</code> 的位模式是 <code>0x3F800000</code>：<code>s=0</code>，<code>E=127</code>，<code>M=0</code>，所以是 1.0 × 2⁰。把指数加 1 得到 2.0（<code>0x40000000</code>）；把小数最高位置 1 得到 1.5（<code>0x3FC00000</code>）。</p>
        <div data-widget="float"></div>
        <h3>三类“非普通”值</h3>
        <ul>
          <li><b>非规格化数</b>：<code>E=0</code>，有效数为 <code>0.M</code>，实际指数固定为 −126。它用来表示比最小规格化数更接近 0 的数，代价是有效位减少。</li>
          <li><b>零</b>：<code>E=0</code> 且 <code>M=0</code>；符号位区分 +0 与 −0。它们在多数比较中相等，但在 <code>1/x</code> 等场景会产生不同的无穷。</li>
          <li><b>无穷与 NaN</b>：<code>E=255</code>。小数全 0 是 ±∞；小数非 0 是 NaN（不是数）。NaN 不等于任何值，包括它自己。</li>
        </ul>
        <h3>和整数的关键差别</h3>
        <p>浮点数的位模式不是“连续的整数刻度”。同样的 32 位，整数在 0 附近最密、在两端均匀；浮点数在 0 附近极密，在绝对值大时相邻可表示值间隔变大。这就是为什么 <code>float</code> 能表示 10³⁸，却不能精确表示 10³⁸+1。</p>
        <table>
          <tr><th>位模式</th><th>值</th><th>类型</th></tr>
          <tr><td><code>0x00000000</code></td><td>+0</td><td>零</td></tr>
          <tr><td><code>0x80000000</code></td><td>−0</td><td>零</td></tr>
          <tr><td><code>0x00000001</code></td><td>2<sup>−149</sup> ≈ 1.4×10<sup>−45</sup></td><td>最小正非规格化数</td></tr>
          <tr><td><code>0x007FFFFF</code></td><td>最大非规格化数</td><td>非规格化</td></tr>
          <tr><td><code>0x00800000</code></td><td>2<sup>−126</sup></td><td>最小正规格化数</td></tr>
          <tr><td><code>0x7F7FFFFF</code></td><td>≈3.4×10<sup>38</sup></td><td>FLT_MAX</td></tr>
          <tr><td><code>0x7F800000</code></td><td>+∞</td><td>无穷</td></tr>
          <tr><td><code>0x7FC00000</code></td><td>NaN</td><td>NaN</td></tr>
        </table>
        ${CA.quizHTML({
          id: 'ch02-q-float1', q: '位模式 <code>0x3F800000</code> 表示什么？',
          options: ['1.0', '0.5', '2.0', '−1.0'],
          answer: 0, explain: '<b>正确。</b>指数 127 → 实际 0，小数 0 → 有效数 1.0，符号 0；所以是 1.0。'
        })}
        ${CA.quizHTML({
          id: 'ch02-q-nan', q: '关于 NaN，下面哪句话正确？',
          options: ['NaN 与任何值（包括自己）比较都不相等', 'NaN 等于 0', 'NaN 就是 +∞', '只有符号位不同才能产生 NaN'],
          answer: 0, explain: '<b>正确。</b>IEEE 754 规定 NaN 是无序的；要检测 NaN 用 <code>x != x</code> 或 <code>isnan(x)</code>。'
        })}
      `,
      init: function (sec) { CA.viz.floatExplorer(sec.querySelector('[data-widget="float"]')); }
    },
    {
      id: 'rounding', num: '2.7', title: '舍入、精度与“0.1 + 0.2”',
      html: `
        <p>binary32 只有 24 位有效二进制位（1 位隐含 + 23 位小数），十进制小数大多无法精确表示。把一个十进制数写成 float，需要舍入到最近的可表示值；正好居中时采用<b>舍入到偶数</b>（round-to-nearest, ties-to-even）。</p>
        <p>在浮点拆解器里输入 <code>0.1</code>，你会得到 <code>0x3DCCCCCD</code>，而不是某个“精确的 0.1”。它的十进制展开约为 0.100000001490116…；<code>0.2</code> 同理。把两者相加，结果不等于精确的 0.3。</p>
        <pre data-lang="c"><code>#include &lt;stdio.h&gt;
int main(void) {
    float a = 0.1f, b = 0.2f;
    printf("%.9f\n", a + b);       // 0.300000012
    printf("%d\n", a + b == 0.3f); // 0（通常）
    printf("%d\n", (double)a + (double)b == 0.3); // 也通常为 0
    return 0;
}</code></pre>
        <p>这不是“计算机算错了”，而是二进制浮点表示与十进制书写之间的差异。需要精确十进制时，用整数分/厘、<code>decimal</code> 库或定点运算；需要比较浮点时，用容差：</p>
        <pre data-lang="c"><code>int close(double x, double y, double eps) {
    double d = x - y;
    if (d &lt; 0) d = -d;
    return d &lt;= eps;
}</code></pre>
        <h3>三个常见陷阱</h3>
        <ul>
          <li><b>大数吃小数</b>：<code>1e20f + 1.0f</code> 仍是 <code>1e20f</code>，因为 1 小于该数量级的 ulp。</li>
          <li><b>灾难性抵消</b>：两个相近的大数相减，有效位大量丢失；改写公式（如 <code>sqrt(x+1)-sqrt(x)</code>）可以避免。</li>
          <li><b>结合律不成立</b>：<code>(a+b)+c</code> 不一定等于 <code>a+(b+c)</code>；并行求和要做误差分析或用补偿求和。</li>
        </ul>
        <h3>float 与 double</h3>
        <p><code>double</code> 是 binary64：1 位符号 + 11 位指数 + 52 位小数，偏置 1023。它也不是万能的；只是精度更高、范围更大。C 的 <code>float</code> 运算通常会被提升到 <code>double</code> 再舍回，具体取决于表达式和 ABI。</p>
        <div class="callout info"><div class="c-title">Data Lab 的浮点题</div><p><code>floatScale2</code>、<code>floatFloat2Int</code>、<code>floatPower2</code> 要求你直接操作位模式，而不是调用浮点运算。做这些题时，先把“符号/指数/小数”三段拆出来，再分别处理规格化、非规格化、无穷/NaN 和边界情况。</p></div>
        ${CA.quizHTML({
          id: 'ch02-q-round', q: '为什么 <code>0.1f + 0.2f == 0.3f</code> 在多数机器上为假？',
          options: ['0.1、0.2、0.3 的 binary32 表示都有舍入误差，舍入后的和与 0.3 的表示不同', 'CPU 的加法器有 bug', 'float 只能表示整数', '编译器把 0.1 变成了 0'],
          answer: 0, explain: '<b>正确。</b>三个数都无法用有限二进制精确表示；各自舍入后再相加，结果不一定落在 0.3 的舍入值上。'
        })}
        ${CA.quizHTML({
          id: 'ch02-q-sub', q: 'binary32 的非规格化数（subnormal）的实际指数是多少？',
          options: ['−126', '−127', '0', '−149'],
          answer: 0, explain: '<b>正确。</b>非规格化数的指数字段为 0，但实际指数固定为 −126，有效数为 0.M；最小正非规格化数是 2<sup>−149</sup>。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'workflow', num: '2.8', title: '从本章到 Data Lab：一次真实的位级工程',
      html: `
        <p>Data Lab 不是“把课堂例题再做一遍”，而是把本章的规则放进一个受限的工程环境：</p>
        <ul>
          <li>只能用 <code>! ~ &amp; ^ | + &lt;&lt; &gt;&gt;</code>，常量 0–255；整数题不能写循环、条件、函数调用。</li>
          <li>每个函数有运算符数量上限；正确性之外，还要控制实现规模。</li>
          <li>浮点题允许声明局部变量，但仍不能使用浮点运算、类型转换或库函数。</li>
          <li>你的代码会在真实 Clang/wasm32 下编译，并对边界值与确定性随机值运行。</li>
        </ul>
        <h3>推荐工作流</h3>
        <ol>
          <li><b>先写恒等式</b>：在纸上把目标函数写成位运算；不要一上来就敲代码。</li>
          <li><b>用小例子验证</b>：取 0、1、−1、INT_MIN、INT_MAX、0xAAAAAAAA 等边界，手算位模式。</li>
          <li><b>再进实验页</b>：选择任务，写函数，先看规则检查，再编译运行。</li>
          <li><b>看失败样例</b>：页面会给出第一组失败输入与期望值；用手术台复现它。</li>
          <li><b>控制运算符数</b>：通过后再压缩实现，理解每一步为什么可以合并。</li>
        </ol>
        <div class="callout lab"><div class="c-title">现在开始</div><p>Data Lab 页面提供 13 个任务、逐题规则检查、真实编译、失败样例与位级可视化。建议先做 <code>bitXor</code>、<code>tmin</code>、<code>negate</code>，再挑战 <code>howManyBits</code> 和浮点三题。</p><p><a class="btn primary" href="../labs/datalab.html">进入 Data Lab →</a> <a class="btn" href="../index.html">回到 3D 实验台</a></p></div>
        <p>做完后，你应当能用一句话解释每个函数：它利用了补码的哪条性质？为什么在边界值上仍然成立？如果答不出来，说明还差一次迁移练习。</p>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['datalab'],
  afterRender: function () { document.title = '第 2 章 · 信息的表示与处理 · 计算之境'; }
});
