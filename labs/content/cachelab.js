CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.cachelab = {
  summary: 'Cache Lab 分两部分：Part A 写一个可配置的 LRU cache 模拟器（csim），Part B 优化矩阵转置，把 miss 数压到阈值以下。本页提供真实轨迹驱动的缓存模型、地址拆解与分块对照；官方 test-csim/test-trans 在实验机中运行。',
  objectives: [
    '能把 64 位地址拆成 tag/set/offset，并解释 s/E/b 的含义。',
    '能实现组相联 + LRU 的命中、缺失、替换统计。',
    '能解释写分配、写回与 M 操作的两次访问。',
    '能用分块/循环顺序改变局部性，并读懂 test-trans 的 miss 报告。'
  ],
  browserNote: '缓存模型按真实地址逐块/逐字节模拟；Part A 与 Part B 的浏览器检查都会用 wasm32 真正编译你的 C 代码。官方命令行 csim/test-trans 仍需实验机。',
  vmNote: '官方 cachelab-handout 在实验机中：make 后运行 ./test-csim 与 ./test-trans -M 32 -N 32；也可用 /run/open3d/cache-transpose 生成轨迹并回传 3D 缓存。',
  vmLab: 'cache',
  sections: [
    {
      id: 'workbench', num: '6.C1', title: '缓存工作台：拆地址、看命中',
      html: `
        <p>缓存参数：<code>s</code> 是组号位数（2ˢ 组），<code>E</code> 是每组行数，<code>b</code> 是块内偏移位数（2ᵇ 字节/块）。地址拆解为 <code>tag | set | offset</code>，从高位到低位。</p>
        <div class="grid-3">
          <label class="field"><span>s（组号位）</span><input type="number" id="clS" min="0" max="8" value="5"></label>
          <label class="field"><span>E（每组行数）</span><input type="number" id="clE" min="1" max="8" value="1"></label>
          <label class="field"><span>b（块内偏移位）</span><input type="number" id="clB" min="0" max="12" value="5"></label>
        </div>
        <div class="control-row"><label>计数方式</label><select id="clSem"><option value="cachelab">官方 Cache Lab（每条记录只算起始地址）</option><option value="range">按访问覆盖的块逐个计算</option></select></div>
        <label class="field" style="margin-top:8px"><span>访问轨迹（每行 L/S/M 地址,大小；地址可为 0x）</span><textarea id="clTrace" style="width:100%;height:170px;resize:vertical" spellcheck="false">L 0x1000,4
L 0x1004,4
L 0x1010,4
S 0x1000,4
M 0x1020,4
L 0x2000,4
L 0x1000,4</textarea></label>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="clRun">运行全部</button><button class="btn sm" type="button" id="clStep">单步</button><button class="btn sm" type="button" id="clReset">重置</button><button class="btn sm" type="button" id="clSample">载入 32×32 转置示例</button></div>
        <pre id="clLog" class="console" style="min-height:100px;margin-top:10px" role="status">准备就绪。</pre>
        <div class="readout" style="grid-template-columns:repeat(4,1fr)"><div><span>HITS</span><b class="lime" id="clHits">0</b></div><div><span>MISSES</span><b class="teal" id="clMiss">0</b></div><div><span>EVICTIONS</span><b id="clEvict">0</b></div><div><span>当前地址</span><b id="clAddr" style="font-size:10px">—</b></div></div>
        <div id="clSets" style="margin-top:10px;font:10px/1.5 var(--mono);color:var(--mute)"></div>
      `,
      init: function (sec) {
        var CA = window.CA, CL = window.CacheLab;
        var cache = null, records = [], index = 0;
        var log = sec.querySelector('#clLog');
        function el(id) { return sec.querySelector(id); }
        function say(t, cls) { log.textContent = t; log.className = 'console ' + (cls || ''); }
        function config() {
          var s = parseInt(el('#clS').value, 10), E = parseInt(el('#clE').value, 10), b = parseInt(el('#clB').value, 10);
          if (!Number.isInteger(s) || s < 0 || s > 8 || !Number.isInteger(E) || E < 1 || E > 8 || !Number.isInteger(b) || b < 0 || b > 12) throw Error('参数范围：s 0–8，E 1–8，b 0–12');
          return { s: s, E: E, b: b, semantics: el('#clSem').value };
        }
        function reset() {
          try {
            cache = new CL.TraceCache(config());
            records = CL.parseTrace(el('#clTrace').value); index = 0;
            say('已装入 ' + records.length + ' 条访问；参数 s=' + cache.s + ' E=' + cache.E + ' b=' + cache.b, 'dim');
            render();
          } catch (e) { say('✕ ' + e.message, 'err'); }
        }
        function runOne() {
          if (!cache) reset();
          if (!cache) return;
          if (index >= records.length) { say('已运行完 ' + records.length + ' 条访问。', 'ok'); return; }
          var r = records[index++], out;
          try { out = cache.access(r.operation, r.address, r.size); }
          catch (e) { say('✕ ' + e.message, 'err'); return; }
          var last = out[out.length - 1];
          say('#' + index + ' ' + r.operation + ' 0x' + r.address.toString(16) + ',' + r.size + ' → set ' + last.set + ' tag 0x' + last.tag.toString(16) + ' · ' + (last.hit ? 'HIT' : 'MISS') + (out.length > 1 ? '（跨 ' + out.length + ' 块）' : ''), last.hit ? 'ok' : 'warn');
          render(last);
        }
        function render(last) {
          var sum = cache ? cache.summary() : { hits: 0, misses: 0, evictions: 0 };
          el('#clHits').textContent = sum.hits; el('#clMiss').textContent = sum.misses; el('#clEvict').textContent = sum.evictions;
          el('#clAddr').textContent = last ? '0x' + last.address.toString(16) : '—';
          if (!cache) return;
          var html = '';
          for (var s = 0; s < cache.setCount; s++) {
            if (cache.setCount > 8 && s > 1 && s < cache.setCount - 1) { if (s === 2) html += '<div>… 共 ' + cache.setCount + ' 组 …</div>'; continue; }
            var ways = cache.sets[s].map(function (line, w) {
              return '<span style="display:inline-block;min-width:58px;padding:2px 5px;margin:1px;border:1px solid ' + (last && last.set === s && last.way === w ? 'var(--lime)' : 'var(--line)') + ';border-radius:3px;color:' + (line.valid ? 'var(--ink)' : 'var(--mute)') + '">' + (line.valid ? 'T' + line.tag.toString(16) : '—') + '</span>';
            }).join('');
            html += '<div style="margin:3px 0"><b style="color:var(--dim)">SET ' + s + '</b> ' + ways + '</div>';
          }
          el('#clSets').innerHTML = html;
        }
        el('#clRun').addEventListener('click', function () { reset(); var guard = 0; while (cache && index < records.length && guard++ < 20000) runOne(); });
        el('#clStep').addEventListener('click', runOne);
        el('#clReset').addEventListener('click', reset);
        el('#clSample').addEventListener('click', function () {
          var lines = [];
          for (var i = 0; i < 32; i++) for (var j = 0; j < 32; j++) { lines.push('L ' + (0x1000 + (i * 32 + j) * 4) + ',4'); }
          el('#clTrace').value = lines.join('\n'); reset();
          say('示例：32×32 行优先读取 A，只演示地址映射；真实 test-trans 还包含 B 的写访问。', 'dim');
        });
        reset();
      }
    },
    {
      id: 'partA', num: '6.C2', title: 'Part A：csim 要做什么',
      html: `
        <p>官方 csim 从命令行读 <code>-s E b -t tracefile</code>，对每条 <code>L/S/M addr,size</code> 更新缓存并统计 hit/miss/eviction。评分会用多组参数与轨迹对比参考实现。</p>
        <pre data-lang="c"><code>typedef struct { int valid; unsigned long tag; unsigned long lru; } line_t;

for each line in trace:
    set = (addr &gt;&gt; b) &amp; ((1 &lt;&lt; s) - 1);
    tag = addr &gt;&gt; (s + b);
    search ways for valid &amp;&amp; tag == tag;
    if hit: hits++; update lru;
    else: misses++; choose invalid or least-recently-used; evictions++ if replacing;
    if op == 'M': repeat once for write (hit after load);</code></pre>
        <p>边界：<code>E</code> 可达 1–8；<code>s</code> 可达 0–8；<code>b</code> 可达 0–12；轨迹可能很大，不要为每条访问分配新内存。</p>
        <div class="callout info"><div class="c-title">M 操作</div><p>官方 csim 对 <code>M</code> 先做一次 load，再做一次 store。第二次通常命中（除非写分配/替换策略不同），但它会计入 hit。不要简单地把 M 当一次访问。</p></div>
        ${CA.quizHTML({
          id: 'cache-q1', q: 's=5, E=1, b=5 时，地址 <code>0x1000</code> 的 set 号是多少？',
          options: ['0', '1', '32', '128'],
          answer: 0, explain: '<b>正确。</b>0x1000 &gt;&gt; 5 = 0x80，低 5 位为 0，所以 set 0。块号 128，tag = 128 &gt;&gt; 5 = 4。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'partAcode', num: '6.C2b', title: 'Part A 浏览器检查：写 cache_access',
      html: `
        <p>在浏览器里实现真正的 <code>cache_init</code> / <code>cache_access</code>。程序会用 wasm32 编译，跑 4 组配置（含直接映射、4 路组相联、s=0 全相联）和 4×220 次 L/S/M 访问，逐项比对命中、缺失、替换。</p>
        <p>接口约定：编译器提供 <code>C_S/C_E/C_B</code> 与计数器；你实现两个函数。M 操作会被调用两次（读后写），与官方 csim 一致；<code>size</code> 参数可忽略，因为官方按起始地址计一块。</p>
        <div class="editor-wrap" style="min-height:300px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:12px 0">
          <pre class="editor-lines" aria-hidden="true"></pre>
          <textarea id="csimCode" class="editor" spellcheck="false" style="min-height:300px" aria-label="csim 核心 C 代码"></textarea>
        </div>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="csimRun">编译并检查</button><button class="btn sm" type="button" id="csimReset">恢复模板</button><button class="btn sm" type="button" id="csimAdopt" disabled>采用 Part A 得分</button></div>
        <pre id="csimOut" class="console" style="min-height:120px;margin-top:10px" role="status">尚未检查。</pre>
        <div id="csimReport"></div>
        <p style="font-size:10.5px;color:var(--mute)">浏览器检查覆盖 csim 核心统计，不含命令行参数/getopt/verbose 输出；官方 test-csim 仍在实验机中。</p>
      `,
      init: function (sec) {
        var CA = window.CA, CH = window.CacheHarness, CL = window.CacheLab;
        if (!CH || !CL) { sec.querySelector('#csimOut').textContent = 'CacheHarness 未载入。'; return; }
        var cases;
        try { cases = CH.makeCases(CL.TraceCache); } catch (e) { sec.querySelector('#csimOut').textContent = '测试用例生成失败：' + e.message; return; }
        var ed = CA.editor(sec.querySelector('#csimCode'), { key: 'cache-csim' });
        try { if (!localStorage.getItem('ca.code.cache-csim')) ed.set(CH.starter); } catch (e) { ed.set(CH.starter); }
        var out = sec.querySelector('#csimOut'), report = sec.querySelector('#csimReport'), adopt = sec.querySelector('#csimAdopt');
        var lastScore = 0;
        function log(t, cls) { out.textContent = t; out.className = 'console ' + (cls || ''); }
        function setBusy(b) { ['#csimRun', '#csimReset'].forEach(function (id) { var e = sec.querySelector(id); if (e) e.disabled = b; }); }
        function compileAndRun(source) {
          return new Promise(function (resolve, reject) {
            var w;
            try { w = new Worker('../engine/c-worker.js', { type: 'module' }); }
            catch (e) { reject(new Error('无法创建编译 Worker：' + e.message)); return; }
            var settled = false, timer = setTimeout(function () {
              if (settled) return; settled = true; try { w.terminate(); } catch (e) { } reject(new Error('编译/运行超时（90 秒）'));
            }, 90000);
            w.onmessage = function (e) {
              var d = e.data || {};
              if (d.type === 'phase') { if (d.phase === 'compile') log('clang: 正在编译…', 'dim'); if (d.phase === 'run') log('wasm: 编译完成，运行 4 组 cache 配置…', 'dim'); }
              else if (d.type === 'error') { if (settled) return; settled = true; clearTimeout(timer); w.terminate(); reject(new Error(d.message || '编译失败')); }
              else if (d.type === 'done') { if (settled) return; settled = true; clearTimeout(timer); w.terminate(); resolve(d); }
            };
            w.onerror = function (err) { if (settled) return; settled = true; clearTimeout(timer); try { w.terminate(); } catch (e) { } reject(new Error(err.message || 'Worker 错误')); };
            w.postMessage({ source: source, stdin: '' });
          });
        }
        async function run() {
          setBusy(true); adopt.disabled = true; log('▶ 编译并运行 csim 核心检查…');
          try {
            var built = CH.build(ed.get(), cases);
            var res = await compileAndRun(built.source);
            var r = CH.parse(res.output || '');
            if (!r.total) { log('✕ 没有得到 CRESULT。输出：\n' + (res.output || '(空)').slice(0, 3000), 'err'); }
            else {
              var sc = Math.round(40 * r.passed / r.total);
              log((r.ok ? '✓ 全部配置通过' : '✕ ' + r.passed + ' / ' + r.total + ' 组通过') + ' · Part A 浏览器得分 ' + sc + ' / 40' + (r.failures.length ? '\n' + r.failures.slice(0, 4).join('\n') : ''), r.ok ? 'ok' : 'err');
              report.innerHTML = '<div class="test-results">' + r.cases.map(function (c) {
                var k = cases[c.index];
                return '<div class="' + (c.pass ? 'pass' : 'fail') + '"><span>s=' + k.s + ' E=' + k.E + ' b=' + k.b + '</span><span>' + (c.pass ? '✓' : '✕') + ' h' + c.hits + ' m' + c.misses + ' e' + c.evictions + '</span></div>';
              }).join('') + '</div>';
              lastScore = sc; adopt.disabled = !(sc > 0);
            }
          } catch (e) { log('✕ ' + e.message, 'err'); }
          finally { setBusy(false); }
        }
        sec.querySelector('#csimRun').addEventListener('click', run);
        sec.querySelector('#csimReset').addEventListener('click', function () { if (confirm('恢复 csim 模板？当前修改会丢失。')) { ed.reset(); ed.set(CH.starter); } });
        adopt.addEventListener('click', function () {
          if (!lastScore) return;
          var p = CA.progress.lab('cachelab');
          var solved = Object.assign({}, p.solved || {});
          var partB = solved.partB ? 60 : 0;
          CA.progress.lab('cachelab', { score: Math.min(100, partB + lastScore), solved: { partA: true } });
          CA.refreshLabScore('cachelab');
          adopt.disabled = true;
          CA.toast('已采用 Part A 浏览器得分 ' + lastScore + ' / 40');
        });
      }
    },
    {
      id: 'partB', num: '6.C3', title: 'Part B：矩阵转置与分块',
      html: `
        <p>32×32、64×64、61×61 三个矩阵，缓存为 32 组、1 路、32 字节块。朴素转置 <code>B[j][i] = A[i][j]</code> 会反复跨行，miss 数很高；分块与循环顺序可以显著降低。</p>
        <p>用一个简化的分块模型观察 miss 随 block 的变化（不是官方 test-trans，只用于建立直觉）：</p>
        <div class="control-row"><label class="field"><span>N</span><input type="number" id="tpN" min="2" max="64" value="32" style="width:70px"></label><label class="field"><span>block</span><input type="number" id="tpB" min="1" max="64" value="8" style="width:70px"></label><button class="btn sm" type="button" id="tpRun">比较 block=1 / 4 / 8 / 16</button></div>
        <pre id="tpLog" class="console" style="min-height:90px">选择 N 和 block，运行模型。</pre>
        <p>真实 Part B 还要处理对角块冲突、局部变量、循环展开和 61 的不规则边界。官方阈值：32×32 &lt; 300 miss，64×64 &lt; 1300，61×61 &lt; 2000。</p>
      `,
      init: function (sec) {
        var CL = window.CacheLab;
        sec.querySelector('#tpRun').addEventListener('click', function () {
          var N = parseInt(sec.querySelector('#tpN').value, 10), B = parseInt(sec.querySelector('#tpB').value, 10);
          if (!Number.isInteger(N) || N < 2 || N > 64) { sec.querySelector('#tpLog').textContent = 'N 应为 2–64'; return; }
          var lines = [];
          [1, 4, 8, 16, B].filter(function (v, i, a) { return a.indexOf(v) === i && v <= N; }).forEach(function (block) {
            try {
              var r = CL.transpose({ N: N, block: block, cache: { s: 5, E: 1, b: 5 } });
              lines.push('N=' + N + ' block=' + String(block).padStart(2) + ' · hits ' + r.hits + ' · misses ' + r.misses + ' · evictions ' + r.evictions + ' · ' + (r.correct ? '正确' : '错误'));
            } catch (e) { lines.push('block=' + block + '：' + e.message); }
          });
          sec.querySelector('#tpLog').textContent = lines.join('\n') + '\n\n这是参考分块模型的访问统计，不是你的 trans.c 分数。';
        });
      }
    },
    {
      id: 'partBcheck', num: '6.C3b', title: 'Part B 浏览器检查：转置 miss 数',
      html: `
        <p>在浏览器里实现 <code>transpose_submit</code>。检查器会把函数体中的 <code>A[i][j]</code> / <code>B[j][i]</code> 二维访问插桩到 32 组、1 路、32 字节块的缓存模型，分别跑 32×32、64×64、61×61，检查正确性与 miss 数。</p>
        <p>目标：32×32 &lt; 300，64×64 &lt; 1300，61×61 &lt; 2000。函数签名保持 <code>void transpose_submit(int M, int N, int A[N][M], int B[M][N])</code>。只支持二维下标访问；用指针算术绕过的访问不会被计数。</p>
        <div class="editor-wrap" style="min-height:300px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:12px 0">
          <pre class="editor-lines" aria-hidden="true"></pre>
          <textarea id="transCode" class="editor" spellcheck="false" style="min-height:300px" aria-label="transpose_submit C 代码"></textarea>
        </div>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="transRun">编译并检查</button><button class="btn sm" type="button" id="transReset">恢复模板</button><button class="btn sm" type="button" id="transAdopt" disabled>采用 Part B 得分</button></div>
        <pre id="transOut" class="console" style="min-height:120px;margin-top:10px" role="status">尚未检查。</pre>
        <div id="transReport"></div>
        <p style="font-size:10.5px;color:var(--mute)">这是项目自建的插桩检查，不是官方 test-trans：它只统计二维 A/B 访问，数组基址/插桩方式与官方 Valgrind 轨迹可能不同。官方分数以实验机为准。</p>
      `,
      init: function (sec) {
        var CA = window.CA, TH = window.TransposeHarness;
        if (!TH) { sec.querySelector('#transOut').textContent = 'TransposeHarness 未载入。'; return; }
        var ed = CA.editor(sec.querySelector('#transCode'), { key: 'cache-trans' });
        try { if (!localStorage.getItem('ca.code.cache-trans')) ed.set(TH.starter); } catch (e) { ed.set(TH.starter); }
        var out = sec.querySelector('#transOut'), report = sec.querySelector('#transReport'), adopt = sec.querySelector('#transAdopt');
        var lastScore = 0, lastResults = null;
        function log(t, cls) { out.textContent = t; out.className = 'console ' + (cls || ''); }
        function setBusy(b) { ['#transRun', '#transReset'].forEach(function (id) { var e = sec.querySelector(id); if (e) e.disabled = b; }); }
        function compileAndRun(source) {
          return new Promise(function (resolve, reject) {
            var w;
            try { w = new Worker('../engine/c-worker.js', { type: 'module' }); }
            catch (e) { reject(new Error('无法创建编译 Worker：' + e.message)); return; }
            var settled = false, timer = setTimeout(function () {
              if (settled) return; settled = true; try { w.terminate(); } catch (e) { } reject(new Error('编译/运行超时（90 秒）'));
            }, 90000);
            w.onmessage = function (e) {
              var d = e.data || {};
              if (d.type === 'phase') { if (d.phase === 'compile') log('clang: 正在编译…', 'dim'); if (d.phase === 'run') log('wasm: 编译完成，运行 32/64/61…', 'dim'); }
              else if (d.type === 'error') { if (settled) return; settled = true; clearTimeout(timer); w.terminate(); reject(new Error(d.message || '编译失败')); }
              else if (d.type === 'done') { if (settled) return; settled = true; clearTimeout(timer); w.terminate(); resolve(d); }
            };
            w.onerror = function (err) { if (settled) return; settled = true; clearTimeout(timer); try { w.terminate(); } catch (e) { } reject(new Error(err.message || 'Worker 错误')); };
            w.postMessage({ source: source, stdin: '' });
          });
        }
        async function run() {
          setBusy(true); adopt.disabled = true; log('▶ 编译并运行转置检查…');
          try {
            var built = TH.build(ed.get());
            var res = await compileAndRun(built.source);
            var r = TH.parse(res.output || '');
            if (!r.results.length) { log('✕ 没有得到 TRESULT。输出：\n' + (res.output || '(空)').slice(0, 3000), 'err'); }
            else {
              var sc = 0; r.results.forEach(function (x) { if (x.pass && x.misses < x.threshold) sc += 20; });
              log((r.ok ? '✓ 三个矩阵全部达标' : '△ 未全部达标') + ' · Part B 浏览器得分 ' + sc + ' / 60\n' + r.results.map(function (x) {
                return (x.pass && x.misses < x.threshold ? '✓' : '✕') + ' ' + x.name + ' · miss ' + x.misses + ' / 阈值 ' + x.threshold + ' · ' + (x.pass ? '正确' : '结果错误');
              }).join('\n'), r.ok ? 'ok' : 'warn');
              report.innerHTML = '<div class="test-results">' + r.results.map(function (x) {
                return '<div class="' + (x.pass && x.misses < x.threshold ? 'pass' : 'fail') + '"><span>' + x.name + '</span><span>' + x.misses + ' / ' + x.threshold + ' miss · ' + (x.pass ? '正确' : '错误') + '</span></div>';
              }).join('') + '</div>';
              lastScore = sc; lastResults = r; adopt.disabled = !(sc > 0);
            }
          } catch (e) { log('✕ ' + e.message, 'err'); }
          finally { setBusy(false); }
        }
        sec.querySelector('#transRun').addEventListener('click', run);
        sec.querySelector('#transReset').addEventListener('click', function () { if (confirm('恢复转置模板？当前修改会丢失。')) { ed.reset(); ed.set(TH.starter); } });
        adopt.addEventListener('click', function () {
          if (!lastScore) return;
          var p = CA.progress.lab('cachelab');
          var solved = Object.assign({}, p.solved || {});
          var partA = solved.partA ? 40 : 0;
          CA.progress.lab('cachelab', { score: Math.min(100, partA + lastScore), solved: { partB: true } });
          CA.refreshLabScore('cachelab');
          adopt.disabled = true;
          CA.toast('已采用 Part B 浏览器得分 ' + lastScore + ' / 60');
        });
      }
    },
    {
      id: 'official', num: '6.C4', title: '官方实验机与评分',
      html: `
        <pre data-lang="bash"><code>cd /root/CSAPP/cachelab-handout
make
./test-csim                 # Part A
./test-trans -M 32 -N 32    # Part B：生成 trace 与 miss 数
cat trace.f1 | ./csim-ref -s 5 -E 1 -b 5 -t -
/run/open3d/cache-transpose 64 64   # 生成独立目录与本次轨迹
/run/open3d/export-cache-trace 路径  # 回传 3D 缓存</code></pre>
        <p>官方评分：Part A 27 分，Part B 26 分（按三个矩阵的 miss 阈值），总分 53。页面的 100 分是课程归一化分数，不直接等同官方 53 分。</p>
        <div class="callout warn"><div class="c-title">性能测量的边界</div><p>实验机是模拟 x86，miss 计数与官方参考模型一致，但真实墙钟时间受宿主影响；评分主要看 miss 数，不看墙钟。</p></div>
      `,
      init: function () { }
    }
  ],
  checklist: [
    { id: 'a1', label: '能手算任意地址的 tag/set/offset，并解释 2ˢ 组、E 路、2ᵇ 字节。' },
    { id: 'a2', label: 'csim 正确处理 L/S/M、LRU、替换与多组参数。' },
    { id: 'a3', label: '在实验机运行 ./test-csim，保存 hits/misses/evictions 与得分。' },
    { id: 'b1', label: '32×32 转置 miss &lt; 300，且结果正确。' },
    { id: 'b2', label: '64×64 转置 miss &lt; 1300，且结果正确。' },
    { id: 'b3', label: '61×61 转置 miss &lt; 2000，且结果正确。' }
  ]
};
