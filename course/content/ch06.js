CA.registerChapter('ch06', {
  summary: '程序快不快，往往不取决于指令条数，而取决于数据离 CPU 有多远。本章讲局部性、Cache 的组织与地址拆解、命中/缺失/替换/写策略，以及矩阵分块如何把 miss 数降下来。最后进入 Cache Lab，写模拟器并优化转置。',
  objectives: [
    '能解释时间/空间局部性与存储层次的容量—延迟权衡。',
    '能把地址拆成 tag/set/offset，并计算组相联 Cache 的命中/替换。',
    '能区分写直达/写回、写分配/非写分配，以及 LRU。',
    '能用分块改善矩阵访问的局部性，并读懂 test-trans 的 miss 报告。'
  ],
  sections: [
    {
      id: 'locality', num: '6.1', title: '局部性：Cache 能工作的前提',
      html: `
        <p>理想情况下，CPU 需要的数据就在手边。现实是：寄存器只有几十个，DRAM 延迟约 200–300 周期，SSD 更慢。Cache 把最近用过的<b>块</b>（block/line）从慢速层搬到快速层，利用两种局部性：</p>
        <ul>
          <li><b>时间局部性</b>：刚访问的变量/指令很可能再次使用（循环、热函数）。</li>
          <li><b>空间局部性</b>：访问地址 x 后，x 附近的字节很可能被使用（数组、顺序指令）。</li>
        </ul>
        <p>Cache 的容量远小于主存，所以必须决定“放哪、换谁、何时写回”。这些策略决定了命中率，也决定了程序性能。</p>
        <div class="callout info"><div class="c-title">一次缺失的代价</div><p>L1 命中约 4–5 周期，DRAM 缺失约 200–300 周期。一次缺失可能等于几十条指令；如果循环每次迭代都缺失，CPU 大部分时间在等内存。</p></div>
        ${CA.quizHTML({
          id: 'ch06-q-loc', q: '按列遍历 C 的二维数组通常比按行慢，主要因为？',
          options: ['空间局部性差：每次跨行，缓存块利用率低', '列优先的指令更多', '编译器不支持列优先', '列优先会产生系统调用'],
          answer: 0, explain: '<b>正确。</b>C 按行连续存放；按列访问会反复跳到很远的地址，缓存块里的相邻元素用不上。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'org', num: '6.2', title: 'Cache 组织：S、E、B 与地址拆解',
      html: `
        <p>一个 Cache 有 <code>S = 2ˢ</code> 组，每组 <code>E</code> 行，每行 <code>B = 2ᵇ</code> 字节。地址从低位到高位拆成：</p>
        <pre data-lang="text"><code>| tag (剩余高位) | set (s 位) | offset (b 位) |
                  ↑ 选择组      ↑ 选择块内字节</code></pre>
        <p>访存时：用 set 找到组，比较组内每行的 tag；若有 valid 且 tag 相等 → 命中；否则缺失，选择空行或替换（LRU/随机/FIFO），并把整块装入。</p>
        <p>参数例子：s=5、E=1、b=5 → 32 组、直接映射、32 字节块。地址 <code>0x1000</code>：offset=0，set=0，tag=0x80&gt;&gt;5=4。下一个块 <code>0x1020</code> 仍然 set=0，会替换前一行。</p>
        <div data-widget="cache"></div>
        <p>组相联（E&gt;1）减少冲突缺失，但比较逻辑更复杂、LRU 维护更贵。全相联（S=1）没有冲突，但替换代价高；直接映射（E=1）最简单，冲突最多。</p>
        ${CA.quizHTML({
          id: 'ch06-q-addr', q: 's=4、b=4 时，地址 <code>0x1234</code> 的 set 号是多少？',
          options: ['3', '0x23', '4', '0x12'],
          answer: 0, explain: '<b>正确。</b>offset 低 4 位=4，set 接下 4 位=3，tag=0x12。地址拆解从低位开始。'
        })}
      `,
      init: function (sec) {
        CA.viz.stepper(sec.querySelector('[data-widget="cache"]'), {
          title: '一次访存：地址 → 组 → tag 比较',
          steps: [
            { label: '拆地址', sub: '0x1000', html: '<pre>地址 0x1000 = 0001 0000 0000 0000\nb=5 → offset = 0\ns=5 → set = 0\ntag = 0x1000 >> 10 = 4</pre><p>先看 offset 选块内字节，再看 set 选组，最后用 tag 比较。</p>' },
            { label: '查组', sub: 'set 0', html: '<pre>SET 0\nway 0: valid=0 tag=—   ← 空\nway 1: valid=0 tag=—</pre><p>直接映射 E=1；空行直接装入，miss +1。</p>' },
            { label: '装入', sub: 'tag 4', html: '<pre>SET 0\nway 0: valid=1 tag=4  ← 装入整块 0x1000–0x101F</pre><p>块内 32 字节全部进入 Cache；后续访问 0x1004…0x101C 都可能命中。</p>' },
            { label: '换一块', sub: '0x1400', html: '<pre>0x1400 的块号 = 0x1400/32 = 160\nset = 160 mod 32 = 0\ntag = 160 / 32 = 5</pre><p>它和 0x1000 落在同一组、不同 tag；直接映射必须替换。</p>' },
            { label: '替换', sub: 'miss', html: '<pre>访问 0x1400：set 0, tag 5 → miss\nway 0: tag 4 → tag 5\neviction +1\n若旧块 dirty，先写回</pre><p>直接映射没有选择；组相联才需要 LRU/随机。替换后旧块若 dirty，还要写回。</p>' }
          ]
        });
      }
    },
    {
      id: 'write', num: '6.3', title: '写策略、替换与性能',
      html: `
        <table>
          <tr><th>策略</th><th>行为</th><th>代价/风险</th></tr>
          <tr><td>写直达</td><td>每次写都更新 Cache 和下一层</td><td>写流量大，但实现简单</td></tr>
          <tr><td>写回</td><td>只写 Cache，标记 dirty；替换时写回</td><td>减少写流量，需要 dirty 位</td></tr>
          <tr><td>写分配</td><td>写缺失时先把块装入 Cache</td><td>利用空间局部性，增加读流量</td></tr>
          <tr><td>非写分配</td><td>写缺失直接写下一层，不装入</td><td>避免无用装入，但后续写可能再次缺失</td></tr>
        </table>
        <p>替换策略：LRU 近似“最近最少使用”，需要每行时间戳/栈；随机实现简单但不可预测；FIFO 不看使用频率。真实处理器常用伪 LRU/自适应策略。</p>
        <p>性能指标：命中率、缺失率、平均访存时间 AMAT = 命中时间 + 缺失率 × 缺失代价。降低缺失率（更大 Cache/更好局部性）或降低缺失代价（预取/多级 Cache）都能改善 AMAT。</p>
        <div class="callout warn"><div class="c-title">冲突缺失 vs 容量缺失</div><p>直接映射/组相联中，多个热块映射到同一组会冲突；工作集大于 Cache 会容量缺失。分块/填充/改变数据布局可以减少冲突；容量缺失只能靠更大 Cache 或更好算法。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'blocking', num: '6.4', title: '矩阵分块：把复用留在 Cache 里',
      html: `
        <p>矩阵转置 <code>B[j][i] = A[i][j]</code> 的朴素实现按行读 A、按列写 B；B 的写会反复跨行，造成大量冲突/容量缺失。分块把矩阵切成 <code>block×block</code> 的小块，让一个块在 Cache 中完成读写。</p>
        <pre data-lang="c"><code>for (ii = 0; ii &lt; N; ii += B)
  for (jj = 0; jj &lt; N; jj += B)
    for (i = ii; i &lt; min(ii+B,N); i++)
      for (j = jj; j &lt; min(jj+B,N); j++)
        trans[i][j] = A[j][i];   // 具体布局按你的 trans 函数</code></pre>
        <p>32×32 时 8×8 分块通常能把 miss 降到 300 以下；64×64 由于 8 路冲突，需要 4×4/8×8 组合、对角块特殊处理、局部变量缓存；61×61 的不规则边界要小心越界。</p>
        <p>官方阈值（s=5,E=1,b=5）：32×32 &lt; 300，64×64 &lt; 1300，61×61 &lt; 2000。先保证正确，再压 miss；每次只改一个策略，记录 trace 与 csim 统计。</p>
        <div class="callout lab"><div class="c-title">开始实验</div><p>Cache Lab 页面可以配置 s/E/b、输入轨迹、观察命中/替换，并比较不同分块；官方 test-csim/test-trans 在实验机中评分。</p><p><a class="btn primary sm" href="../labs/lab.html?lab=cachelab">进入 Cache Lab →</a></p></div>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['cachelab'],
  afterRender: function () { document.title = '第 6 章 · 存储器层次结构 · 计算之境'; }
});
