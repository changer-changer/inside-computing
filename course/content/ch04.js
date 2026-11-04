CA.registerChapter('ch04', {
  summary: '这一章从指令集走到处理器：Y86-64 的寄存器、编码与执行，SEQ 的五个组合逻辑阶段，再到五级流水线中的冒险、转发、暂停与分支恢复。最后用 Architecture Lab 把“正确”与“更快”同时落成可运行的电路/程序。',
  objectives: [
    '能说明 Y86-64 的寄存器、条件码、指令编码与寻址方式。',
    '能按取指/译码/执行/访存/写回拆解一条指令。',
    '能识别数据冒险（尤其加载后使用）与控制冒险，并说明转发/暂停/清除。',
    '能读懂流水线周期数，并用调度/展开/iaddq 优化。'
  ],
  sections: [
    {
      id: 'isa', num: '4.1', title: 'Y86-64：一台够小、够完整的 64 位机器',
      html: `
        <p>Y86-64 是 CS:APP 为教学设计的 RISC 风格指令集：15 个 64 位寄存器（<code>%rax</code>…<code>%r14</code>，没有 <code>%r15</code>）、程序计数器 PC、条件码 ZF/SF/OF。指令长度 1–10 字节，统一为：</p>
        <pre data-lang="text"><code>[icode:ifun] [rA:rB] [8 字节立即数/地址]</code></pre>
        <table>
          <tr><th>指令</th><th>语义</th><th>需要 valC</th></tr>
          <tr><td><code>halt</code></td><td>停止</td><td>否</td></tr>
          <tr><td><code>rrmovq rA,rB</code></td><td>rB ← rA</td><td>否</td></tr>
          <tr><td><code>irmovq V,rB</code></td><td>rB ← V</td><td>是</td></tr>
          <tr><td><code>rmmovq rA,D(rB)</code></td><td>Mem[rB+D] ← rA</td><td>是</td></tr>
          <tr><td><code>mrmovq D(rB),rA</code></td><td>rA ← Mem[rB+D]</td><td>是</td></tr>
          <tr><td><code>addq/subq/andq/xorq rA,rB</code></td><td>rB ← rB op rA，设置 CC</td><td>否</td></tr>
          <tr><td><code>jXX Dest</code></td><td>条件跳转</td><td>是</td></tr>
          <tr><td><code>call Dest</code> / <code>ret</code></td><td>压入/弹出返回地址</td><td>call 是</td></tr>
          <tr><td><code>pushq rA</code> / <code>popq rA</code></td><td>栈操作</td><td>否</td></tr>
          <tr><td><code>iaddq V,rB</code></td><td>rB ← rB + V，设置 CC（扩展）</td><td>是</td></tr>
        </table>
        <p>条件码由 ALU 的结果设置：ZF 表示零，SF 表示负，OF 表示有符号溢出。跳转指令用 <code>ifun</code> 选择条件（je/jne/jl/jge/jg/jle），<code>cmov</code> 用同一组条件做条件传送。</p>
        <div class="callout info"><div class="c-title">为什么需要 valC</div><p>取指阶段必须知道指令长度，才能算 <code>valP = PC + 1 + (rB?1:0) + (valC?8:0)</code>。指令是否带寄存器字节/立即数由 icode 决定；这正是 Part B 添加 iaddq 时要改的控制信号。</p></div>
        ${CA.quizHTML({
          id: 'ch04-q-enc', q: '哪条指令不需要 8 字节立即数（valC）？',
          options: ['addq %rbx,%rax', 'irmovq $5,%rax', 'mrmovq 8(%rdi),%rax', 'call dest'],
          answer: 0, explain: '<b>正确。</b>addq 只有 1 字节 icode + 1 字节寄存器；irmovq/mrmovq/call 都带 8 字节 valC。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'seq', num: '4.2', title: 'SEQ：一条指令的五个阶段',
      html: `
        <p>顺序实现（SEQ）每个周期执行一条完整指令，但内部仍按五个阶段组织：</p>
        <ol>
          <li><b>取指</b>：读 icode/ifun，按需读寄存器字节与 valC，计算 valP。</li>
          <li><b>译码</b>：读 rA/rB 的值（valA/valB），处理 <code>%rsp</code> 作为隐式源。</li>
          <li><b>执行</b>：ALU 计算 valE（加法、减法、与、异或、地址偏移），更新条件码。</li>
          <li><b>访存</b>：读/写数据内存（mrmovq/rmmovq/push/pop/call/ret）。</li>
          <li><b>写回</b>：把 valE/valM 写回寄存器；更新 PC。</li>
        </ol>
        <p>数据通路由组合逻辑（ALU、寄存器堆、内存）和时钟寄存器（PC、CC、寄存器堆）组成。一个周期的长短由最长的组合路径决定；流水线通过插入寄存器把一条指令拆到多个周期，让多条指令重叠。</p>
        <div class="callout warn"><div class="c-title">“顺序”不等于“简单”</div><p>SEQ 的控制器要处理每条指令的 icode/ifun/条件码，HCL 规则很多。流水线不是把 SEQ 简单切开：还要处理冒险、异常和冲刷。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'pipeline', num: '4.3', title: '五级流水线：让多条指令同时在飞',
      html: `
        <p>五级流水线把取指（F）、译码（D）、执行（E）、访存（M）、写回（W）分到五个周期。理想情况下每周期完成一条指令（CPI≈1）；但数据依赖和控制流会打破理想。</p>
        <div data-widget="pipe"></div>
        <p>点击“下一周期”，观察同一时刻 F/D/E/M/W 里分别是什么指令。注意：<b>写回发生在 W 阶段</b>，而后续指令可能在 D 阶段就需要这个寄存器——这就是冒险的来源。</p>
        <h3>三类冒险</h3>
        <table>
          <tr><th>类型</th><th>例子</th><th>处理</th></tr>
          <tr><td>数据冒险（转发）</td><td><code>addq %rbx,%rax</code> 后紧跟 <code>addq %rax,%rcx</code></td><td>从 E/M/W 流水线寄存器转发到 ALU 输入</td></tr>
          <tr><td>加载后使用</td><td><code>mrmovq (%rdi),%rax</code> 后紧跟 <code>addq %rax,%rbx</code></td><td>数据在 M 结束才可用，需暂停 1 周期（load-use）</td></tr>
          <tr><td>控制冒险</td><td>条件跳转/返回</td><td>预测 + 错误时清除；ret 需等返回地址到 W</td></tr>
        </table>
        ${CA.quizHTML({
          id: 'ch04-q-hazard', q: '为什么 <code>mrmovq</code> 后立即使用加载的寄存器需要暂停，而不能只靠转发？',
          options: ['加载数据在 M 阶段结束才从内存返回，E 阶段还拿不到', '因为 mrmovq 没有目的寄存器', '因为寄存器堆不能读', '因为流水线没有 W 阶段'],
          answer: 0, explain: '<b>正确。</b>转发只能转发“已经产生”的值；加载值在 M 末才可用，下一指令的 E 阶段太早，必须等一个周期。'
        })}
      `,
      init: function (sec) { CA.viz.y86pipeline(sec.querySelector('[data-widget="pipe"]')); }
    },
    {
      id: 'control', num: '4.4', title: '控制：转发、暂停、分支与返回',
      html: `
        <p>流水线控制的核心是四个信号：<code>F_stall</code>、<code>D_stall</code>、<code>D_bubble</code>、<code>E_bubble</code>。它们决定某个阶段是保持、插入气泡还是清除。</p>
        <ul>
          <li><b>加载后使用</b>：暂停 F/D，冻结 PC 与 D 寄存器；E 插入气泡，让加载指令走到 M/W。</li>
          <li><b>分支预测错误</b>：清除 D/E 中错误路径的指令（bubble），把 PC 改成正确目标。</li>
          <li><b>ret</b>：返回地址在 W 阶段才写回，F 需要等待，避免取到 ret 之后的错误指令。</li>
          <li><b>异常</b>：记录状态（ADR/INS/HLT），在指令到达 W 时处理，避免部分写回。</li>
        </ul>
        <p>转发路径通常包括：E→E（ALU 结果）、M→E（访存结果/ALU）、W→E（写回值）。优先级要正确：最近的生产者优先。</p>
        <div class="callout info"><div class="c-title">分支预测</div><p>简单模型“预测跳转/预测不跳转”各有代价。预测错误越晚发现，清除的指令越多。真实处理器用历史表/BTB 提高准确率，但本课程模型保持简单。</p></div>
        ${CA.quizHTML({
          id: 'ch04-q-ret', q: '为什么 <code>ret</code> 指令通常要让取指等待？',
          options: ['返回地址要到 W 阶段才从栈中读出，F 不能提前知道目标', '因为 ret 没有机器码', '因为 ret 会修改所有寄存器', '因为 ret 不能被流水线执行'],
          answer: 0, explain: '<b>正确。</b>返回地址是动态的；在它到达 W、写回 PC 之前，F 取到的下一条指令不可靠，需要暂停/等待。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'lab', num: '4.5', title: 'Architecture Lab：把模型变成分数',
      html: `
        <p>Architecture Lab 三部分分别对应本章的三个层次：</p>
        <ul>
          <li><b>Part A</b>：用 Y86-64 写 sum_list/rsum_list/copy_list，验证指令集与调用约定。</li>
          <li><b>Part B</b>：给 SEQ/PIPE 添加 iaddq，修改 HCL 与数据通路，验证控制信号。</li>
          <li><b>Part C</b>：优化 ncopy，用循环展开、调度与 iaddq 降低 CPE。</li>
        </ul>
        <div class="callout lab"><div class="c-title">开始实验</div><p>浏览器内可以写 Y86-64、改 HCL、跑五级流水线与 ncopy 周期检查；官方 sim/psim 与完整评分在 Linux 实验机中复核。</p><p><a class="btn primary sm" href="../labs/lab.html?lab=archlab">进入 Architecture Lab →</a></p></div>
        <p>做 Part C 时，不要只看“通过”；记录不同 n 的周期数，解释哪条依赖链被缩短、哪条指令被消除。能解释，才算真正理解流水线。</p>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['archlab'],
  afterRender: function () { document.title = '第 4 章 · 处理器体系结构 · 计算之境'; }
});
