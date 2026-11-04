CA.registerChapter('ch09', {
  summary: '虚拟内存让每个进程以为自己独占一大片连续地址。页表把虚拟页映射到物理页，TLB 缓存映射，缺页处理按需装入。堆分配器则在虚拟地址空间里管理 malloc/free。本章从地址翻译走到堆块与碎片，最后进入 Malloc Lab。',
  objectives: [
    '能解释虚拟地址、物理地址、页表项与页框的关系。',
    '能走一遍 TLB → 页表 → 缺页 → 重试的地址翻译。',
    '能说明 mmap、共享映射、写时复制与按需分页。',
    '能解释块头、对齐、隐式/显式空闲链表与碎片。',
    '能读懂 mdriver 的利用率与吞吐量。'
  ],
  sections: [
    {
      id: 'space', num: '9.1', title: '地址空间与页表',
      html: `
        <p>每个进程看到一段连续的虚拟地址空间：代码、数据、堆、共享库、栈。CPU 发出的虚拟地址由 MMU 用页表翻译成物理地址；进程不需要知道物理页在哪里，也不需要连续。</p>
        <p>页表是一个多级数组（x86-64 通常 4 级），每个页表项（PTE）包含物理页号与权限位（present、writable、user、accessed、dirty）。地址拆成 VPN（虚拟页号）与 offset；offset 在翻译前后不变。</p>
        <div class="callout info"><div class="c-title">为什么用页</div><p>按页（4 KB）而不是按字节映射，减少页表项数量；缺页/换出以页为单位；权限保护也以页为单位。代价是内部碎片（最后一页用不满）。</p></div>
        ${CA.quizHTML({
          id: 'ch09-q-page', q: '页大小 4 KB 时，虚拟地址的低 12 位在翻译过程中怎样？',
          options: ['保持不变，作为页内偏移', '被页表替换', '被清零', '变成物理页号'],
          answer: 0, explain: '<b>正确。</b>offset 位数 = log2(页大小) = 12；翻译只替换 VPN，offset 原样保留。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'walk', num: '9.2', title: 'TLB、页表与缺页',
      html: `
        <p>每次访存都查 4 级页表太慢，所以有 TLB（翻译后备缓冲）：一个小型、全相联/组相联的 VPN→PFN 缓存。地址翻译顺序：</p>
        <ol>
          <li>查 TLB；命中 → 得到物理页号，拼 offset，访存。</li>
          <li>TLB 未命中 → 查页表（可能多级）；PTE present → 填入 TLB，重试。</li>
          <li>PTE 不存在 → 缺页异常；内核决定装入页面、分配页框、换出牺牲页，更新页表/TLB，返回后重试指令。</li>
          <li>权限不满足 → 保护故障（segfault）。</li>
        </ol>
        <div data-widget="vm"></div>
        <p>缺页不是“错误”，而是虚拟内存的正常机制：按需分页、写时复制、文件映射都靠它。只有非法地址/权限才是致命信号。</p>
        ${CA.quizHTML({
          id: 'ch09-q-tlb', q: 'TLB 未命中是否一定意味着缺页？',
          options: ['不一定，页表可能已有有效映射', '一定，TLB 就是页表', '只有写操作才会缺页', '只有多级页表才会缺页'],
          answer: 0, explain: '<b>正确。</b>TLB 只是缓存；页表项可能 present，只是 TLB 里没有。查页表后填入 TLB 即可，不必缺页。'
        })}
      `,
      init: function (sec) {
        CA.viz.stepper(sec.querySelector('[data-widget="vm"]'), {
          title: '一次地址翻译：TLB → 页表 → 缺页',
          steps: [
            { label: '虚拟地址', sub: 'VA', html: '<pre>VA = 0x0000 1234\npage size = 4 KB → offset = 0x234\nVPN = 0x00001</pre><p>先拆 VPN/offset；offset 不参与翻译。</p>' },
            { label: '查 TLB', sub: 'miss', html: '<pre>TLB: VPN 0x00001 → ?\n未命中</pre><p>TLB 小且全相联；未命中时查页表。</p>' },
            { label: '查页表', sub: 'PTE', html: '<pre>PTE[0x00001] = PFN 0x7A | present | writable\n物理地址 = 0x7A234</pre><p>PTE 有效；把 VPN→PFN 填入 TLB，重试访存。</p>' },
            { label: '缺页', sub: 'not present', html: '<pre>PTE[0x00002] = not present\n→ page fault\n内核装入页面、分配页框、更新 PTE/TLB\n→ 返回后重试指令</pre><p>缺页处理可能换出脏页（写回磁盘），再装入新页。</p>' },
            { label: '保护', sub: 'segfault', html: '<pre>PTE present, writable=0\n写入 → protection fault\n→ SIGSEGV</pre><p>非法地址/权限不是“缺页”，而是保护故障；进程通常被终止。</p>' }
          ]
        });
      }
    },
    {
      id: 'mmap', num: '9.3', title: 'mmap、共享与写时复制',
      html: `
        <p><code>mmap</code> 把文件/匿名内存映射到虚拟地址空间。常见用途：加载可执行文件、共享库、大块内存分配、文件 I/O。参数包括地址提示、长度、保护（PROT_READ/WRITE/EXEC）、标志（MAP_SHARED/PRIVATE/ANONYMOUS）、fd、offset。</p>
        <ul>
          <li><b>MAP_SHARED</b>：修改对其他映射/文件可见；适合共享内存、文件映射。</li>
          <li><b>MAP_PRIVATE</b>：写时复制；修改不写回文件，适合加载程序/库。</li>
          <li><b>MAP_ANONYMOUS</b>：不关联文件，零初始化；malloc 大块分配常用。</li>
        </ul>
        <p>fork 后父子共享物理页，写入时触发 COW 缺页，内核复制页面。exec 会替换地址空间，但保留打开的文件描述符（除非 CLOEXEC）。</p>
        <pre data-lang="c"><code>char *p = mmap(NULL, 4096, PROT_READ|PROT_WRITE,
               MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
if (p == MAP_FAILED) { perror("mmap"); exit(1); }
p[0] = 'A';
munmap(p, 4096);</code></pre>
        <div class="callout warn"><div class="c-title">mmap 不是免费的 malloc</div><p>每次 mmap 都有系统调用与页表开销；小块分配用堆分配器更合适。mmap 的返回值要检查 MAP_FAILED，长度要按页对齐。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'heap', num: '9.4', title: '堆分配器：块、对齐与碎片',
      html: `
        <p>malloc 在堆上管理块。一个简单块格式：头部存大小 + 已分配位，载荷按 8/16 字节对齐；相邻空闲块可合并。分配器要同时考虑：</p>
        <ul>
          <li><b>正确性</b>：不重叠、对齐、数据保持、realloc 语义。</li>
          <li><b>利用率</b>：峰值载荷 / 峰值堆大小；头部、对齐、空闲块元数据、外部碎片都降低利用率。</li>
          <li><b>吞吐量</b>：每次 malloc/free 的查找与合并开销。</li>
        </ul>
        <p>隐式空闲链表靠块头遍历所有块；显式空闲链表只串空闲块；分离空闲链表按大小类分桶。真实分配器（dlmalloc、jemalloc、tcmalloc）都使用更复杂的大小类/线程缓存。</p>
        <div class="callout lab"><div class="c-title">开始实验</div><p>Malloc Lab 页面可以观察首次适配、合并与碎片；官方 mdriver 在实验机中检查全部 trace、利用率与吞吐量。</p><p><a class="btn primary sm" href="../labs/lab.html?lab=malloclab">进入 Malloc Lab →</a></p></div>
        ${CA.quizHTML({
          id: 'ch09-q-frag', q: '空闲空间总量足够，但 malloc 仍可能失败，为什么？',
          options: ['外部碎片：没有单个连续空闲块足够大', '因为 malloc 只能分配 4 KB', '因为堆只能增长一次', '因为 free 会立即清零'],
          answer: 0, explain: '<b>正确。</b>总空闲量够不等于有足够大的连续块；这就是外部碎片。合并/分离空闲链表/更好的放置策略可以缓解。'
        })}
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['malloclab'],
  afterRender: function () { document.title = '第 9 章 · 虚拟内存 · 计算之境'; }
});
