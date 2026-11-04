CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.perflab = {
  summary: 'Performance Lab 要求优化两个官方 kernel（rotate 与 smooth），用 CPE（每元素周期数）衡量。核心不是“写得短”，而是减少关键路径、提高指令级并行、减少不必要的内存访问。本页用依赖链模型解释为什么多累加器能缩短路径，并给出官方 fcyc/CPE 工作流。',
  objectives: [
    '能区分吞吐量瓶颈与延迟/关键路径瓶颈。',
    '能解释循环展开、多累加器、重结合与指令调度的作用。',
    '能读懂 CPE、基线/优化版本的对比与性能上限。',
    '能判断编译器优化、内存别名和测量噪声对结果的影响。'
  ],
  browserNote: '浏览器用官方 naive rotate/smooth 作基线，编译学生实现并比较 wasm 相对时间；不测真实 CPU 周期，官方 CPE 在实验机中由 fcyc 测量。',
  vmNote: '官方 perflab-handout 在实验机中：make 后运行 ./driver.pl 或 ./fcyc2；CPE 阈值与评分以官方 driver 为准。',
  vmLab: 'perf',
  sections: [
    {
      id: 'cpe', num: '5.P1', title: 'CPE：把时间摊到每个元素',
      html: `
        <p>CPE（cycles per element）是处理一个数组元素平均需要的周期数。对长度 n 的循环，总周期 ≈ <code>CPE × n + 常数</code>。常数是循环启动/收尾；n 足够大时，CPE 决定斜率。</p>
        <p>一个简单求和：</p>
        <pre data-lang="c"><code>long sum(long *a, long n) {
    long s = 0;
    for (long i = 0; i &lt; n; i++) s += a[i];
    return s;
}</code></pre>
        <p>每次迭代只有一条依赖链 <code>s = s + a[i]</code>。如果加法延迟是 3 周期，而下一次加法必须等上一次结果，CPE 至少是 3——哪怕有 4 个加法器。把一条链拆成两条（或多条）独立链，最后再合并，就能让多个加法同时在飞行中：</p>
        <pre data-lang="c"><code>long s0 = 0, s1 = 0;
for (long i = 0; i + 1 &lt; n; i += 2) {
    s0 += a[i];
    s1 += a[i + 1];
}
return s0 + s1;</code></pre>
        <div class="callout info"><div class="c-title">循环展开 ≠ 一定变快</div><p>展开减少循环开销和分支，但如果仍然把所有加法串在同一条累加器链上，关键路径没有缩短。真正起作用的是“重结合 + 多累加器 + 调度”。</p></div>
        ${CA.quizHTML({
          id: 'perf-q1', q: '一个求和循环的加法延迟为 3 周期，且只有一个累加器。CPE 的下界大约是多少？',
          options: ['3', '1', '0.5', '无法估计'],
          answer: 0, explain: '<b>正确。</b>下一次加法依赖上一次结果，必须等 3 周期；即使有多个加法器也无法并行。多累加器可以把这个下界降到约 3/k。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'model', num: '5.P2', title: '依赖链模型：一个累加器 vs 两个',
      html: `
        <p>下面的模型假设：加法延迟为 L 周期，功能单元数量不限，忽略取指/分支/内存。它给出关键路径下界，而不是实际 CPE。</p>
        <div class="grid-3">
          <label class="field"><span>元素数 n</span><input type="number" id="pfN" min="2" max="64" value="8"></label>
          <label class="field"><span>累加器数</span><select id="pfWays"><option value="1">1 条链</option><option value="2">2 条链</option></select></label>
          <label class="field"><span>加法延迟 L</span><input type="number" id="pfLat" min="1" max="20" value="3"></label>
        </div>
        <div class="control-row"><button class="btn primary sm" type="button" id="pfRun">计算关键路径</button><button class="btn sm" type="button" id="pfCompare">比较 1 / 2 条链</button></div>
        <pre id="pfLog" class="console" style="min-height:100px">选择参数，运行模型。</pre>
        <div id="pfBars" style="margin-top:10px"></div>
        <p>两个累加器最后仍要合并一次，所以总周期是 <code>max(两条链完成时间) + L</code>；这解释了为什么“多累加器”不是免费的，但在 n 很大时收益显著。</p>
      `,
      init: function (sec) {
        var PL = window.PerformanceLab;
        function run(ways) {
          var n = parseInt(sec.querySelector('#pfN').value, 10), L = parseInt(sec.querySelector('#pfLat').value, 10);
          return PL.analyze({ n: n, ways: ways, latency: L });
        }
        function log(t) { sec.querySelector('#pfLog').textContent = t; }
        function bars(rows) {
          var max = Math.max.apply(null, rows.map(function (r) { return r.cycles; }));
          sec.querySelector('#pfBars').innerHTML = rows.map(function (r) {
            return '<div style="display:grid;grid-template-columns:110px 1fr 62px;gap:7px;align-items:center;font:10px/1.5 var(--mono);color:var(--mute);margin:4px 0"><span>' + r.label + '</span><span style="height:7px;border-radius:4px;background:linear-gradient(90deg,var(--lime),var(--teal));width:' + Math.max(2, r.cycles / max * 100) + '%"></span><span style="color:var(--lime)">' + r.cycles + ' cyc</span></div>';
          }).join('');
        }
        sec.querySelector('#pfRun').addEventListener('click', function () {
          try {
            var ways = parseInt(sec.querySelector('#pfWays').value, 10), r = run(ways);
            log('n=' + r.n + ' · ways=' + r.ways + ' · latency=' + r.latency + '\n关键路径周期 = ' + r.criticalPathCycles + ' · 结果 = ' + r.result + '\n（无限功能单元模型；不是实测 CPE）');
            bars([{ label: ways + ' 条链', cycles: r.criticalPathCycles }]);
          } catch (e) { log('✕ ' + e.message); }
        });
        sec.querySelector('#pfCompare').addEventListener('click', function () {
          try {
            var a = run(1), b = run(2);
            log('n=' + a.n + ' · L=' + a.latency + '\n1 条链：' + a.criticalPathCycles + ' 周期\n2 条链：' + b.criticalPathCycles + ' 周期\n理论加速比：' + (a.criticalPathCycles / b.criticalPathCycles).toFixed(2) + '×');
            bars([{ label: '1 条链', cycles: a.criticalPathCycles }, { label: '2 条链', cycles: b.criticalPathCycles }]);
          } catch (e) { log('✕ ' + e.message); }
        });
      }
    },
    {
      id: 'browser', num: '5.P2b', title: '浏览器相对性能检查',
      html: `
        <p>在浏览器里实现官方 <code>rotate</code> 与 <code>smooth</code> 两个 kernel。页面会分别编译“官方 naive 起始实现”和你的实现，在 wasm32 中运行同一组数据，比较运行时间并比对输出 hash。</p>
        <p>评分：每个 kernel 正确性 10 分 + 相对加速 40 分。目标加速：rotate ≥ 1.15×，smooth ≥ 1.30×（相对官方 naive 起始实现，低于 1.05× 的差异视为测量噪声）。这不是官方 CPE；wasm 时间是相对指标，受宿主/负载影响。</p>
        <div class="editor-wrap" style="min-height:330px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:12px 0">
          <pre class="editor-lines" aria-hidden="true"></pre>
          <textarea id="perfCode" class="editor" spellcheck="false" style="min-height:330px" aria-label="rotate 与 smooth kernel 的 C 代码"></textarea>
        </div>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="perfRun">编译并比较</button><button class="btn sm" type="button" id="perfReset">恢复模板</button><button class="btn sm" type="button" id="perfAdopt" disabled>采用浏览器得分</button></div>
        <pre id="perfOut" class="console" style="min-height:130px;margin-top:10px" role="status">尚未检查。</pre>
        <div id="perfReport"></div>
        <p style="font-size:10.5px;color:var(--mute)">浏览器相对性能不是官方 fcyc/CPE：计时从 wasm 开始运行到程序结束，包含少量实例化开销；请把结果用于比较优化方向，官方分数以实验机为准。</p>
      `,
      init: function (sec) {
        var CA = window.CA, PH = window.PerfHarness;
        if (!PH) { sec.querySelector('#perfOut').textContent = 'PerfHarness 未载入。'; return; }
        var ed = CA.editor(sec.querySelector('#perfCode'), { key: 'perf-kernels' });
        try { if (!localStorage.getItem('ca.code.perf-kernels')) ed.set(PH.starter); } catch (e) { ed.set(PH.starter); }
        var out = sec.querySelector('#perfOut'), report = sec.querySelector('#perfReport'), adopt = sec.querySelector('#perfAdopt');
        var lastScore = 0;
        function log(t, cls) { out.textContent = t; out.className = 'console ' + (cls || ''); }
        function setBusy(b) { ['#perfRun', '#perfReset'].forEach(function (id) { var e = sec.querySelector(id); if (e) e.disabled = b; }); }
        function compileAndRun(source) {
          return new Promise(function (resolve, reject) {
            var w;
            try { w = new Worker('../engine/c-worker.js', { type: 'module' }); }
            catch (e) { reject(new Error('无法创建编译 Worker：' + e.message)); return; }
            var settled = false, runStart = 0, timer = setTimeout(function () {
              if (settled) return; settled = true; try { w.terminate(); } catch (e) { } reject(new Error('编译/运行超时（90 秒）'));
            }, 90000);
            w.onmessage = function (e) {
              var d = e.data || {};
              if (d.type === 'phase') {
                if (d.phase === 'compile') log('clang: 正在编译…', 'dim');
                if (d.phase === 'run') { runStart = performance.now(); log('wasm: 运行基准/实现…', 'dim'); }
              } else if (d.type === 'error') { if (settled) return; settled = true; clearTimeout(timer); w.terminate(); reject(new Error(d.message || '编译失败')); }
              else if (d.type === 'done') { if (settled) return; settled = true; clearTimeout(timer); w.terminate(); resolve({ output: d.output || '', runMs: Math.max(0.1, performance.now() - runStart) }); }
            };
            w.onerror = function (err) { if (settled) return; settled = true; clearTimeout(timer); try { w.terminate(); } catch (e) { } reject(new Error(err.message || 'Worker 错误')); };
            w.postMessage({ source: source, stdin: '', flags: ['-std=c11', '-O1', '-Wall', '-Wextra'] });
          });
        }
        async function measure(mode, code) {
          var built = PH.build(code, mode), best = null, value = null;
          for (var k = 0; k < 2; k++) {
            var res = await compileAndRun(built.source);
            var parsed = PH.parse(res.output, mode);
            if (!parsed.ok) throw new Error(mode + ' 没有输出期望的 hash：' + (res.output || '').slice(0, 800));
            if (best == null || res.runMs < best) best = res.runMs;
            value = parsed.value;
          }
          return { value: value, ms: Math.max(0.1, best) };
        }
        async function run() {
          setBusy(true); adopt.disabled = true; log('▶ 编译并比较两个 kernel…');
          try {
            var student = ed.get();
            var rows = [], total = 0;
            for (var mode of ['rotate', 'smooth']) {
              log('— ' + mode + '：基准 —', 'dim');
              var base = await measure(mode, PH.starter);
              log('— ' + mode + '：你的实现 —', 'dim');
              var mine = await measure(mode, student);
              var correct = PH.same(base.value, mine.value, mode);
              var speedup = base.ms / mine.ms;
              var target = mode === 'rotate' ? 1.15 : 1.30;
              var cScore = correct ? 10 : 0;
              var sScore = correct ? Math.round(40 * Math.min(1, Math.max(0, (speedup - 1.05) / (target - 1.05)))) : 0;
              rows.push({ mode: mode, base: base, mine: mine, correct: correct, speedup: speedup, target: target, score: cScore + sScore, cScore: cScore, sScore: sScore });
              total += cScore + sScore;
            }
            log(rows.map(function (r) {
              return (r.correct ? '✓' : '✕') + ' ' + r.mode.padEnd(4) + ' · 基准 ' + r.base.ms.toFixed(0) + 'ms · 你的 ' + r.mine.ms.toFixed(0) + 'ms · 加速 ' + r.speedup.toFixed(2) + '× · ' + r.score + ' / 50';
            }).join('\n') + '\n浏览器得分 ' + total + ' / 100', rows.every(function (r) { return r.correct; }) ? 'ok' : 'err');
            report.innerHTML = rows.map(function (r) {
              return '<div class="kv"><span>' + r.mode + ' · ' + (r.correct ? '结果一致' : '结果不一致') + '</span><b>' + r.speedup.toFixed(2) + '× · ' + r.score + ' / 50</b></div>';
            }).join('');
            lastScore = total; adopt.disabled = !(total > 0);
          } catch (e) { log('✕ ' + e.message, 'err'); }
          finally { setBusy(false); }
        }
        sec.querySelector('#perfRun').addEventListener('click', run);
        sec.querySelector('#perfReset').addEventListener('click', function () { if (confirm('恢复 kernel 模板？当前修改会丢失。')) { ed.reset(); ed.set(PH.starter); } });
        adopt.addEventListener('click', function () {
          if (!lastScore) return;
          CA.progress.lab('perflab', { score: lastScore, solved: { browser: true } });
          CA.refreshLabScore('perflab');
          adopt.disabled = true;
          CA.toast('已采用浏览器相对性能得分 ' + lastScore + ' / 100（非官方）');
        });
      }
    },
    {
      id: 'official', num: '5.P3', title: '官方实验机与 CPE',
      html: `
        <pre data-lang="bash"><code>cd /root/CSAPP/perflab-handout
make
./driver.pl            # 完整检查 + CPE
./fcyc2 7 16 1         # 单独测某组参数（依 handout 说明）
cat README             # 查看本组阈值与评分</code></pre>
        <p>官方 Performance Lab 是 Cache Lab 的替代选项；不同年份/课程的 kernel 与阈值不同。以你拿到的 handout 为准。实验机是模拟 x86，绝对 CPE 会受宿主影响；但同一环境下的相对优化仍然有意义。</p>
        <div class="callout warn"><div class="c-title">测量前先固定条件</div><p>关闭其他负载、固定 CPU 频率/电源模式、重复运行取中位数。一次运行快不代表优化有效；要看基线、优化版本和不同 n 的曲线。</p></div>
      `,
      init: function () { }
    }
  ],
  checklist: [
    { id: 'cpe', label: '能解释 CPE 的斜率含义，并画出基线/优化版本的对比。' },
    { id: 'dep', label: '能画出循环的依赖图，指出哪条边是关键路径。' },
    { id: 'rotate', label: 'rotate 通过正确性检查，CPE 达到 handout 阈值。' },
    { id: 'smooth', label: 'smooth 通过正确性检查，CPE 达到 handout 阈值。' },
    { id: 'measure', label: '在实验机重复测量并保存原始 fcyc/driver 输出。' }
  ]
};
