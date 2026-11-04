CA.registerChapter('ch05', {
  summary: '优化不是“把代码写短”，而是理解程序在机器上的关键路径与资源瓶颈。本章用 CPE 度量性能，用依赖图解释延迟与吞吐，再落到循环展开、多累加器、重结合、内存访问与编译器优化。最后用 Performance Lab 把优化变成可测量的数字。',
  objectives: [
    '能定义 CPE，并区分常数开销与随 n 增长的斜率。',
    '能画出循环的依赖图，找出关键路径与可并行的部分。',
    '能解释循环展开、多累加器、重结合、指令调度的作用与边界。',
    '能识别内存别名、分支预测、编译器优化与 Amdahl 定律的影响。'
  ],
  sections: [
    {
      id: 'cpe', num: '5.1', title: 'CPE：把性能摊到每个元素',
      html: `
        <p>对长度 n 的循环，运行时间通常可写成 <code>T(n) ≈ CPE × n + C</code>。CPE 是斜率，C 是启动/收尾。比较两个实现时，先看 n 足够大时的斜率，而不是某个特定 n 的总时间。</p>
        <p>例如一个求和循环，基线 CPE 可能是 2–4；优化后可能接近 1 或更低（取决于加法延迟、功能单元数和循环开销）。但“更低”必须有测量支撑，不能只看指令条数。</p>
        <div class="callout info"><div class="c-title">测量三原则</div><p>固定环境（负载、频率、电源模式）；重复运行取中位数；同时报告 n 的范围和基线/优化版本。一次快可能是噪声。</p></div>
        ${CA.quizHTML({
          id: 'ch05-q-cpe', q: 'CPE 在 <code>T(n) ≈ CPE×n + C</code> 中代表什么？',
          options: ['每个元素平均增加的周期数（斜率）', '程序启动的固定周期', 'CPU 的主频', '缓存缺失的总次数'],
          answer: 0, explain: '<b>正确。</b>CPE 是斜率；C 是截距。n 很大时，CPE 决定性能。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'deps', num: '5.2', title: '依赖图：哪条链决定下界',
      html: `
        <p>把每条指令看成节点，把“必须等前一条结果”看成有向边。没有边相连的指令可以并行；一条链上的延迟相加，决定关键路径下界。</p>
        <p>一个累加器：</p>
        <pre data-lang="c"><code>for (i = 0; i &lt; n; i++)
    s += a[i];       // s 依赖上一次 s</code></pre>
        <p>依赖图是一条链：<code>s0 → s1 → s2 → …</code>。如果加法延迟 3 周期，CPE ≥ 3。两个累加器：</p>
        <pre data-lang="c"><code>for (i = 0; i + 1 &lt; n; i += 2) {
    s0 += a[i];
    s1 += a[i+1];
}
return s0 + s1;</code></pre>
        <p>两条独立链可以交错执行，关键路径约为 <code>3 × ceil(n/2)</code>，最后再合并一次。注意：最后合并仍要等两条链都完成，所以加速比不是无限的。</p>
        <div class="callout warn"><div class="c-title">浮点与整数不同</div><p>浮点加法不满足结合律；重结合会改变舍入结果。Performance Lab 的 kernel 若要求逐位一致，不能随意重排；整数加法/乘法满足结合律（模运算下），更适合重结合。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'transform', num: '5.3', title: '展开、重结合与调度',
      html: `
        <p><b>循环展开</b>减少循环控制开销（比较/分支/计数器），并给调度器更多独立指令。它本身不缩短依赖链；要配合<b>重结合</b>（多个累加器）才有效。</p>
        <p><b>指令调度</b>把独立的加载/算术插入等待间隙，减少流水线停顿。编译器在 -O2/-O3 会做这些；但内存别名、异常语义、浮点精度会限制它。</p>
        <p><b>内存别名</b>：如果编译器不能证明两个指针不重叠，它不敢把加载提前或重排。C 的 <code>restrict</code> 可以帮助，但必须保证调用者不传重叠区域。</p>
        <div data-widget="dep"></div>
        <p>拖动/选择参数，比较多条链的关键路径。这个模型假设功能单元无限、忽略取指/分支/内存；它给的是下界，不是实测 CPE。</p>
        ${CA.quizHTML({
          id: 'ch05-q-unroll', q: '只做循环展开、但仍把所有加法累加到同一个变量，通常会怎样？',
          options: ['减少循环开销，但关键路径仍是一条长链', '关键路径也按展开因子缩短', '一定比多累加器快', '编译器会拒绝编译'],
          answer: 0, explain: '<b>正确。</b>展开减少了分支/计数器，但 s 仍然串行依赖；要缩短关键路径必须拆成多条独立链。'
        })}
      `,
      init: function (sec) {
        var el = sec.querySelector('[data-widget="dep"]');
        CA.viz.stepper(el, {
          title: '一个累加器 vs 两个累加器',
          steps: [
            { label: '基线', sub: '一条链', html: '<pre>s = s + a[0]\ns = s + a[1]\ns = s + a[2]\n...\n每步都要等上一步的加法结果</pre><p>CPE ≥ 加法延迟。功能单元再多也用不上。</p>' },
            { label: '展开', sub: '减少开销', html: '<pre>for (i=0; i+3&lt;n; i+=4) {\n  s += a[i]; s += a[i+1];\n  s += a[i+2]; s += a[i+3];\n}</pre><p>分支/计数器减少，但依赖链还是 s→s→s→s。</p>' },
            { label: '重结合', sub: '多条链', html: '<pre>s0 += a[i];   s1 += a[i+1];\ns2 += a[i+2]; s3 += a[i+3];\n...\nreturn (s0+s1)+(s2+s3);</pre><p>四条链并行，关键路径约 1/4；最后合并有额外延迟。</p>' },
            { label: '边界', sub: '收益递减', html: '<p>链数超过功能单元/寄存器/加载带宽后，收益递减；最后合并、循环收尾和内存带宽会成为新瓶颈。</p><p>浮点还要考虑舍入与结合律。</p>' }
          ]
        });
      }
    },
    {
      id: 'memory', num: '5.4', title: '内存、分支与 Amdahl',
      html: `
        <p>很多“算术优化”最后被内存限制：如果每个元素都要从 DRAM 取，CPU 再快也等数据。先改善局部性（分块、顺序访问、预取），再谈指令级并行。</p>
        <p>分支预测错误会清空流水线；把不可预测的分支改成条件传送（cmov）或分支无关的算术，可能更稳。但 cmov 会增加数据依赖，需测量。</p>
        <p><b>Amdahl 定律</b>：如果程序中只有比例 p 的部分能被加速 s 倍，总加速比上限是 <code>1 / ((1-p) + p/s)</code>。优化前先找热点；优化一个只占 5% 的函数，收益最多 5%。</p>
        <div class="callout info"><div class="c-title">先测量，再优化</div><p>用 profiler 找热点，用 CPE/周期计数验证改动；不要凭直觉重写。保持正确性测试，优化后重新跑全套用例。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'lab', num: '5.5', title: 'Performance Lab：把数字做出来',
      html: `
        <p>Performance Lab 要求优化 poly 与 sum 两个 kernel，达到 handout 的 CPE 阈值。步骤：</p>
        <ol>
          <li>先跑基线，记录 CPE 与正确性。</li>
          <li>画依赖图，找关键路径；决定展开因子与累加器数。</li>
          <li>小步修改，每次测量；避免一次改太多无法归因。</li>
          <li>检查编译器优化与内存别名；确认没有改变语义。</li>
          <li>在实验机重复测量，保存原始输出。</li>
        </ol>
        <div class="callout lab"><div class="c-title">开始实验</div><p>页面提供依赖链模型与官方 fcyc 工作流；真实 CPE 以实验机为准。</p><p><a class="btn primary sm" href="../labs/lab.html?lab=perflab">进入 Performance Lab →</a></p></div>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['perflab'],
  afterRender: function () { document.title = '第 5 章 · 优化程序性能 · 计算之境'; }
});
