CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.archlab = {
  summary: 'Architecture Lab 有三部分：用 Y86-64 写链表求和、给处理器扩展 iaddq、优化 ncopy 的流水线周期。本页把三部分都做成可运行检查：程序、真实 Y86-64 编码、五级流水线和周期统计都来自项目模型；官方 sim/HCL 评分仍可在 Linux 实验机中复核。',
  objectives: [
    '能用 Y86-64 实现 sum_list/rsum_list，并遵守寄存器与栈的调用约定。',
    '能说明 iaddq 需要改动哪些数据通路与控制信号，并让流水线正确执行。',
    '能用循环展开、指令调度与 iaddq 降低 ncopy 的 CPE。',
    '能读懂官方 sim 的 ISA Check、correctness.pl 与 benchmark.pl 输出。'
  ],
  browserNote: 'Part A/B/C 都有浏览器内检查：Y86-64 汇编器、顺序执行器、可编辑 HCL 与五级流水线。检查是项目模型，不等同于官方 psim 的逐项复刻。',
  vmNote: '官方 sim、完整 HCL、correctness.pl/benchmark.pl 与实验机评分在 Debian 实验机中运行；网页可回放官方 PIPE/SEQ 轨迹。',
  vmLab: 'architecture',
  sections: [
    {
      id: 'partA', num: '4.A', title: 'Part A · 用 Y86-64 写链表求和',
      html: `
        <p>链表节点布局：偏移 0 存 64 位值，偏移 8 存 next 指针；空指针为 0。实现 <code>sum_list</code>：<code>%rdi</code> 是头指针，返回和放在 <code>%rax</code>。</p>
        <p>最低要求：能处理空链表、单节点和多节点；不要修改调用者的寄存器（除返回值）；用 <code>ret</code> 返回。</p>
        <div class="callout info"><div class="c-title">调用约定</div><p>Y86-64 的 <code>%rsp</code> 由 <code>call</code> 自动维护；<code>%rax</code> 是返回值；<code>%rdi</code> 是第一个参数。你可以在函数内使用 <code>%rsi</code>、<code>%rcx</code> 等临时寄存器，但若调用别的函数，要遵守保存规则。</p></div>
        <div class="editor-wrap" style="min-height:220px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:12px 0">
          <pre class="editor-lines" aria-hidden="true"></pre>
          <textarea id="archSumCode" class="editor" spellcheck="false" style="min-height:220px" aria-label="sum_list Y86-64 源码"></textarea>
        </div>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="archSumCheck">检查 Part A</button><button class="btn sm" type="button" id="archSumReset">恢复模板</button></div>
        <pre id="archSumLog" class="console" style="min-height:90px;margin-top:10px" role="status">尚未检查。空链表、单节点、多节点与负数都会测试。</pre>
      `,
      init: function (sec) {
        var CA = window.CA, A = window.Y86Assembler, S = window.Y86Subset;
        var starter = 'sum_list:\n    xorq %rax, %rax\n    # 在这里遍历链表：读取 0(%rdi) 的值，累加到 %rax；\n    # 再把 8(%rdi) 装入 %rdi，直到 %rdi 为 0。\n    ret\n';
        var ed = CA.editor(sec.querySelector('#archSumCode'), { key: 'arch-sum', onRun: check });
        if (!localStorage.getItem('ca.code.arch-sum')) ed.set(starter);
        var log = sec.querySelector('#archSumLog');
        function say(t, cls) { log.textContent = t; log.className = 'console ' + (cls || ''); }
        function build(values) {
          var data = '';
          if (!values.length) data = 'list0:\n  .quad 0\n  .quad 0\n';
          else {
            data = 'list0:\n';
            values.forEach(function (v, i) {
              data += '  .quad ' + v + '\n  .quad ' + (i === values.length - 1 ? '0' : 'n' + (i + 1)) + '\n';
              if (i !== values.length - 1) data += 'n' + (i + 1) + ':\n';
            });
          }
          return '.pos 0\nmain:\n  irmovq stack,%rsp\n  ' + (values.length ? 'irmovq list0,%rdi' : 'irmovq $0,%rdi') + '\n  call sum_list\n  halt\nStartFun:\n' + ed.get() + '\nEndFun:\n.align 8\n' + data + '.pos 0x400\nstack:\n';
        }
        function checkCase(values) {
          var src = build(values), b = A.assemble(src, { memorySize: 4096 });
          if (!(b.labels.sum_list >= b.labels.StartFun && b.labels.sum_list < b.labels.EndFun)) throw Error('必须在 StartFun/EndFun 之间定义 sum_list');
          if (b.labels.EndFun - b.labels.StartFun > 300) throw Error('函数代码超过 300 字节');
          var m = new S(b.bytes, 4096), ret = false, steps = 0;
          while (m.status === 'AOK' && steps++ < 6000) { m.step(); if (m.last && m.last.name === 'ret') ret = true; }
          if (!ret) throw Error('没有执行 ret（不要用 halt 返回）');
          if (m.status !== 'HLT') throw Error('处理器状态 ' + m.status + '，没有正常结束');
          var want = values.reduce(function (a, x) { return BigInt.asUintN(64, a + BigInt(x)); }, 0n);
          if (m.reg[0] !== want) throw Error('结果 %rax = ' + BigInt.asIntN(64, m.reg[0]) + '，期望 ' + BigInt.asIntN(64, want));
          return steps;
        }
        function check() {
          var cases = [[], [1], [1, 2, 3], [10, -3, 7], [0, 0, 0], [5, 5, 5, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]];
          var passed = 0, total = cases.length, first = null;
          for (var i = 0; i < total; i++) {
            try { checkCase(cases[i]); passed++; }
            catch (e) { first = '用例 #' + (i + 1) + '（' + cases[i].length + ' 个节点）：' + e.message; break; }
          }
          if (passed === total) {
            say('✓ Part A 通过 · ' + total + ' / ' + total + ' 组链表，函数 ' + '（浏览器 Y86-64 顺序模型）', 'ok');
            mark('partA', true);
          } else say('✕ ' + passed + ' / ' + total + ' 通过\n' + first, 'err');
        }
        sec.querySelector('#archSumCheck').addEventListener('click', check);
        sec.querySelector('#archSumReset').addEventListener('click', function () { if (confirm('恢复 Part A 模板？')) { ed.reset(); ed.set(starter); } });
      }
    },
    {
      id: 'partB', num: '4.B', title: 'Part B · 给流水线扩展 iaddq',
      html: `
        <p><code>iaddq V, rB</code> 的语义是 <code>rB ← rB + V</code>，并设置条件码。它需要：取指时识别合法指令、读取寄存器字节与 8 字节立即数；译码时选择 <code>rB</code>；执行时 ALU 的 A 输入取立即数、B 输入取 <code>rB</code>；写回目标为 <code>rB</code>；更新 CC。</p>
        <p>下面是项目自编的 HCL 子集。基础规则不包含 <code>IIADDQ</code>；把它接入相关信号，然后运行测试。</p>
        <div class="callout warn"><div class="c-title">这不是官方 HCL</div><p>只支持页面列出的 12 个信号和有限表达式，不是官方 <code>hcl2c</code>。完整 Part B 仍需在实验机中修改 <code>seq-full.hcl</code> / <code>pipe-full.hcl</code> 并跑官方测试。</p></div>
        <textarea id="archHclCode" class="editor" spellcheck="false" style="width:100%;min-height:300px;white-space:pre;margin:10px 0" aria-label="可编辑的流水线控制规则"></textarea>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="archHclCheck">检查 Part B</button><button class="btn sm" type="button" id="archHclReset">恢复默认 HCL</button><button class="btn sm" type="button" id="archHclHint">显示提示</button></div>
        <pre id="archHclLog" class="console" style="min-height:100px;margin-top:10px" role="status">尚未检查。</pre>
      `,
      init: function (sec) {
        var CA = window.CA, H = window.Y86HCLControl, A = window.Y86Assembler, P = window.Y86Pipeline;
        var ed = CA.editor(sec.querySelector('#archHclCode'), { key: 'arch-hcl' });
        if (!localStorage.getItem('ca.code.arch-hcl')) ed.set(H.defaultSource);
        var log = sec.querySelector('#archHclLog');
        function say(t, cls) { log.textContent = t; log.className = 'console ' + (cls || ''); }
        function run() {
          var control = H.compile(ed.get());
          var src = 'irmovq $5,%rax\nirmovq $0,%rbx\niaddq $7,%rax\niaddq $-12,%rbx\nhalt\n';
          var b = A.assemble(src, { memorySize: 4096 });
          var m = new P(b.bytes, 4096, { control: control });
          var steps = 0;
          while (m.status === 'AOK' && steps++ < 500) m.step();
          if (m.status !== 'HLT') throw Error('流水线没有正常结束：' + m.status + '（检查 instr_valid / need_regids / need_valC）');
          if (m.reg[0] !== 12n) throw Error('%rax = ' + BigInt.asIntN(64, m.reg[0]) + '，期望 12（检查 aluA/aluB/d_dstE）');
          if (m.reg[3] !== BigInt.asUintN(64, -12n)) throw Error('%rbx = ' + BigInt.asIntN(64, m.reg[3]) + '，期望 -12（检查 need_valC/aluA）');
          return steps;
        }
        function check() {
          try {
            var steps = run();
            say('✓ Part B 通过 · 流水线执行 iaddq，%rax=12，%rbx=-12，' + steps + ' 周期。', 'ok');
            mark('partB', true);
          } catch (e) {
            say('✕ Part B 未通过：' + e.message + '\n提示：要把 IIADDQ 加入 instr_valid、need_regids、need_valC，并让 d_srcB/d_dstE/aluA/aluB/set_cc 处理它。', 'err');
          }
        }
        sec.querySelector('#archHclCheck').addEventListener('click', check);
        sec.querySelector('#archHclReset').addEventListener('click', function () { if (confirm('恢复默认 HCL？当前修改会丢失。')) { ed.reset(); ed.set(H.defaultSource); } });
        sec.querySelector('#archHclHint').addEventListener('click', function () {
          say('需要改的信号：\n1) instr_valid / need_regids / need_valC 加入 IIADDQ\n2) d_srcB / d_dstE 在 IIADDQ 时选 D_rB\n3) aluA 在 IIADDQ 时选 E_valC；aluB 选 E_valB\n4) set_cc 在 E_icode == IIADDQ 时为真（且排除异常）', 'warn');
        });
      }
    },
    {
      id: 'partC', num: '4.C', title: 'Part C · 优化 ncopy 的流水线周期',
      html: `
        <p>实现 <code>ncopy</code>：把 <code>%rdi</code> 指向的数组复制到 <code>%rsi</code>，<code>%rdx</code> 是长度；返回 <code>%rax</code> 为严格大于零的元素个数。保持 <code>ncopy</code> 标签，用 <code>ret</code> 返回。</p>
        <p>检查器会运行 0–64、128、192、256 个元素与一组边界值，验证复制内容、计数、源数组不被修改、目标两端越界哨兵不被改写，并统计平均 CPE。目标：正确性与周期都尽量好。</p>
        <div class="editor-wrap" style="min-height:230px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:12px 0">
          <pre class="editor-lines" aria-hidden="true"></pre>
          <textarea id="archCopyCode" class="editor" spellcheck="false" style="min-height:230px" aria-label="ncopy Y86-64 源码"></textarea>
        </div>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="archCopyCheck">检查 Part C</button><button class="btn sm" type="button" id="archCopyReset">恢复模板</button></div>
        <pre id="archCopyLog" class="console" style="min-height:110px;margin-top:10px" role="status">尚未检查。</pre>
        <div id="archCopyReport"></div>
      `,
      init: function (sec) {
        var CA = window.CA, AC = window.ArchitectureCopy;
        var ed = CA.editor(sec.querySelector('#archCopyCode'), { key: 'arch-ncopy' });
        if (!localStorage.getItem('ca.code.arch-ncopy')) ed.set(AC.starter);
        var log = sec.querySelector('#archCopyLog'), report = sec.querySelector('#archCopyReport');
        function say(t, cls) { log.textContent = t; log.className = 'console ' + (cls || ''); }
        function check() {
          say('运行 0–64、128、192、256 与边界数据…', 'warn');
          setTimeout(function () {
            try {
              var r = AC.test(ed.get(), { iaddq: true });
              var fails = r.results.filter(function (x) { return !x.passed; });
              if (r.passed) {
                say('✓ Part C 通过 · 平均 CPE ' + r.meanCpe.toFixed(2) + ' · 函数 ' + r.codeSize + ' 字节', 'ok');
                mark('partC', true);
              } else {
                var f = fails[0];
                say('✕ Part C 未通过 · ' + fails.length + ' 组失败\n首个失败：n=' + f.n + '，' + f.fail.join('；'), 'err');
              }
              report.innerHTML = '<div class="test-results">' + r.results.slice(0, 10).map(function (x) {
                return '<div class="' + (x.passed ? 'pass' : 'fail') + '"><span>n=' + x.n + (x.pattern === 'edge' ? ' · edge' : '') + '</span><span>' + (x.passed ? x.cycles + ' cycles' : 'FAIL') + '</span></div>';
              }).join('') + '</div>';
            } catch (e) { say('✕ ' + e.message, 'err'); }
          }, 30);
        }
        sec.querySelector('#archCopyCheck').addEventListener('click', check);
        sec.querySelector('#archCopyReset').addEventListener('click', function () { if (confirm('恢复 ncopy 模板？当前修改会丢失。')) { ed.reset(); ed.set(AC.starter); } });
      }
    },
    {
      id: 'official', num: '4.D', title: '官方实验机复核',
      html: `
        <p>浏览器内检查用于快速迭代；最终以实验机中的官方 sim 与脚本为准。</p>
        <pre data-lang="bash"><code>cd /root/CSAPP/archlab-handout/sim/misc
./yas sum.ys &amp;&amp; ./yis sum.yo
cd ../seq
make -B VERSION=full
./ssim -t ../y86-code/asumi.yo
cd ../pipe
make -B psim VERSION=full
./correctness.pl
./benchmark.pl</code></pre>
        <p>官方 Architecture Lab 的三部分要求、材料导入与构建步骤，已集成在 3D 实验台的 Linux 指南中。点击“打开 Linux 实验机”会直接进入对应指南与终端。</p>
        <div class="callout warn"><div class="c-title">读输出的方式</div><p>进程退出码为零不代表通过。请检查 <code>ISA Check</code>、<code>correctness.pl</code> 的 FAIL 行与 <code>benchmark.pl</code> 的 CPE/分数。官方 HCL 修改需要重新 <code>make -B</code>。</p></div>
      `,
      init: function () { }
    }
  ],
  checklist: [
    { id: 'a', label: 'Part A：sum_list 通过空链表、单节点、多节点与负数测试。' },
    { id: 'b', label: 'Part B：在 HCL/数据通路中加入 iaddq，并解释每个被修改的信号。' },
    { id: 'c', label: 'Part C：ncopy 通过正确性检查，并报告平均 CPE。' },
    { id: 'd', label: '在实验机中运行官方 sim / correctness.pl / benchmark.pl，保存原始输出。' }
  ]
};

function mark(part, ok) {
  var CA = window.CA;
  var p = CA.progress.lab('archlab');
  var solved = Object.assign({}, p.solved || {});
  if (ok) solved[part] = true;
  var score = (solved.partA ? 30 : 0) + (solved.partB ? 30 : 0) + (solved.partC ? 40 : 0);
  CA.labScore('archlab', score, solved);
}
