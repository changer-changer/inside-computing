CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.malloclab = {
  summary: 'Malloc Lab 要求在 256 KB 堆上实现 malloc/free/realloc，并在正确性之外平衡空间利用率与吞吐量。核心是块格式、边界标记、空闲链表（隐式/显式/分离）与 realloc 的就地扩展。本页用首次适配模型观察块、头部、对齐、合并与碎片；官方 mdriver 在实验机中评分。',
  objectives: [
    '能解释 8 字节对齐、块头/脚、已分配位与载荷大小的关系。',
    '能实现首次适配/最佳适配，并正确合并相邻空闲块。',
    '能分析内部碎片与外部碎片的来源，以及峰值利用率。',
    '能用 realloc 就地扩展/搬迁，并理解吞吐量与利用率的权衡。'
  ],
  browserNote: '堆模型使用 8 字节头、8 字节对齐、首次适配；浏览器内检查会用 wasm32 真正编译你的 mm.c 并跑项目 trace。官方 mdriver 的完整 trace 与评分仍在实验机中。',
  vmNote: '官方 malloclab-handout 在实验机中：make 后运行 ./mdriver -V -f short1-bal.rep；完整评分需要全部 trace 与性能测量。',
  vmLab: 'malloc',
  sections: [
    {
      id: 'heap', num: '9.M1', title: '堆模型：申请、释放、合并',
      html: `
        <p>每个块有一个 8 字节头部（大小 + 已分配位），载荷按 8 字节对齐。申请 <code>r</code> 字节时，实际块大小至少是 <code>align8(r) + 8</code>；释放后块标记为空闲，相邻空闲块应合并。</p>
        <div class="control-row"><label class="field"><span>申请字节数</span><input type="number" id="mlSize" min="1" max="120" value="16" style="width:90px"></label><button class="btn primary sm" type="button" id="mlAlloc">申请</button><label class="field"><span>释放块</span><select id="mlFreeSel" style="min-width:90px"></select></label><button class="btn sm" type="button" id="mlFree">释放</button><button class="btn sm" type="button" id="mlReset">重置</button></div>
        <div id="mlBar" style="margin:12px 0"></div>
        <div class="readout" style="grid-template-columns:repeat(3,1fr)"><div><span>空闲总量</span><b class="lime" id="mlFreeTotal">128</b></div><div><span>块数</span><b id="mlBlocks">1</b></div><div><span>最大空闲块</span><b class="teal" id="mlMaxFree">128</b></div></div>
        <pre id="mlLog" class="console" style="min-height:90px;margin-top:10px">堆为空。</pre>
      `,
      init: function (sec) {
        var CA = window.CA, HL = window.HeapLab;
        var heap = new HL(128), log = sec.querySelector('#mlLog');
        function render() {
          var s = heap.snapshot(), total = s.size;
          sec.querySelector('#mlBar').innerHTML = '<div style="display:flex;height:38px;border:1px solid var(--line);border-radius:6px;overflow:hidden">' + s.blocks.map(function (b) {
            var w = b.size / total * 100;
            return '<div title="' + (b.allocated ? '#' + b.id + ' 申请 ' + b.requested + 'B' : '空闲') + '" style="width:' + w + '%;background:' + (b.allocated ? 'rgba(200,229,143,.24)' : 'rgba(255,255,255,.04)') + ';border-right:1px solid rgba(255,255,255,.08);font:9px/38px var(--mono);color:' + (b.allocated ? 'var(--lime)' : 'var(--mute)') + ';text-align:center;overflow:hidden;white-space:nowrap">' + (b.allocated ? '#' + b.id : 'free') + '</div>';
          }).join('') + '</div>';
          sec.querySelector('#mlFreeTotal').textContent = s.free; sec.querySelector('#mlBlocks').textContent = s.blocks.length;
          sec.querySelector('#mlMaxFree').textContent = Math.max.apply(null, s.blocks.filter(function (b) { return !b.allocated; }).map(function (b) { return b.size; }).concat([0]));
          var sel = sec.querySelector('#mlFreeSel'); sel.innerHTML = s.blocks.filter(function (b) { return b.allocated; }).map(function (b) { return '<option value="' + b.id + '">#' + b.id + ' · ' + b.requested + 'B</option>'; }).join('') || '<option value="">无可释放块</option>';
        }
        function say(t, cls) { log.textContent = t; log.className = 'console ' + (cls || ''); }
        sec.querySelector('#mlAlloc').addEventListener('click', function () {
          try {
            var n = parseInt(sec.querySelector('#mlSize').value, 10), r = heap.alloc(n);
            if (!r.ok) { say('✕ ' + r.reason + '（内部碎片/外部碎片可能让总量够但没有连续块）', 'err'); render(); return; }
            say('✓ 申请 ' + n + 'B → 块 #' + r.id + '，载荷指针 0x' + r.pointer.toString(16) + '，块大小 ' + r.blockSize + 'B（含头部）', 'ok'); render();
          } catch (e) { say('✕ ' + e.message, 'err'); }
        });
        sec.querySelector('#mlFree').addEventListener('click', function () {
          try {
            var id = parseInt(sec.querySelector('#mlFreeSel').value, 10);
            if (!id) return;
            var r = heap.free(id);
            say('✓ 释放 #' + r.released.id + '（' + r.released.size + 'B），合并 ' + r.merged + ' 次；空闲区 [' + r.freeStart + ', ' + (r.freeStart + r.freeSize) + ')', 'ok'); render();
          } catch (e) { say('✕ ' + e.message, 'err'); }
        });
        sec.querySelector('#mlReset').addEventListener('click', function () { heap = new HL(128); say('堆已重置为 128B。'); render(); });
        render();
      }
    },
    {
      id: 'design', num: '9.M2', title: '从首次适配到分离空闲链表',
      html: `
        <table>
          <tr><th>设计</th><th>查找</th><th>优点</th><th>代价</th></tr>
          <tr><td>隐式空闲链表</td><td>从堆头线性扫描</td><td>实现简单，块头即可遍历</td><td>分配 O(堆块数)，大堆很慢</td></tr>
          <tr><td>显式空闲链表</td><td>只在空闲块中找</td><td>跳过已分配块</td><td>需要 prev/next 指针，最小块更大</td></tr>
          <tr><td>分离空闲链表</td><td>按大小类分桶</td><td>近似 O(1)，适合真实分配器</td><td>实现复杂，需要维护多个链表</td></tr>
        </table>
        <p>利用率 = 峰值已用载荷 / 峰值堆大小。块头、对齐填充、空闲块指针与不可用碎片都会降低利用率。吞吐量取决于每次 malloc/free 的查找与合并开销。</p>
        <div class="callout info"><div class="c-title">realloc 的就地扩展</div><p>如果下一个块空闲且足够大，可以直接合并并返回原指针；否则 malloc + memcpy + free。就地把数据搬到相邻块也能减少拷贝。要在正确性检查中覆盖 realloc 的各种边界。</p></div>
        <pre data-lang="c"><code>void *mm_realloc(void *ptr, size_t size) {
    if (ptr == NULL) return mm_malloc(size);
    if (size == 0) { mm_free(ptr); return NULL; }
    size_t old = GET_SIZE(HDRP(ptr)) - DSIZE;
    if (size &lt;= old) return ptr;
    // 尝试与下一个空闲块合并；失败则 malloc + memcpy + free
    ...
}</code></pre>
      `,
      init: function () { }
    },
    {
      id: 'browser', num: '9.M2b', title: '浏览器内分配器检查',
      html: `
        <p>下面是一个 256 KB 堆上的真实 C 分配器练习：实现 <code>mm_init / mm_malloc / mm_free / mm_realloc</code>。浏览器会用 wasm32 编译并运行 4 组 alloc/free/realloc trace，外加一组“释放后复用”检查。</p>
        <p>起始代码是一个只会向前 bump 的分配器：它能分配，但不会复用/合并，因此会在“复用”检查中失败。把它改成真正的空闲链表。</p>
        <div class="editor-wrap" style="min-height:330px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:12px 0">
          <pre class="editor-lines" aria-hidden="true"></pre>
          <textarea id="mlCCode" class="editor" spellcheck="false" style="min-height:330px" aria-label="Malloc Lab C 分配器代码"></textarea>
        </div>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="mlCRun">编译并检查</button><button class="btn sm" type="button" id="mlCReset">恢复模板</button><button class="btn sm" type="button" id="mlCAdopt" disabled>采用为实验得分</button></div>
        <pre id="mlCOut" class="console" style="min-height:130px;margin-top:10px" role="status">尚未检查。</pre>
        <div id="mlCReport"></div>
        <p style="font-size:10.5px;color:var(--mute)">浏览器评分不是官方 mdriver：它使用本项目生成的 trace 与 256 KB 堆；wasm 环境没有进程时钟，吞吐量按通过项给保守分，不代表官方性能权重。官方分数请在实验机中另行取得并记录。</p>
      `,
      init: function (sec) {
        var CA = window.CA, MH = window.MallocHarness;
        if (!MH) { sec.querySelector('#mlCOut').textContent = 'MallocHarness 未载入。'; return; }
        var ed = CA.editor(sec.querySelector('#mlCCode'), { key: 'malloc-c' });
        try { if (!localStorage.getItem('ca.code.malloc-c')) ed.set(MH.starter); } catch (e) { ed.set(MH.starter); }
        var out = sec.querySelector('#mlCOut'), report = sec.querySelector('#mlCReport'), adopt = sec.querySelector('#mlCAdopt');
        var lastScore = 0;
        function log(t, cls) { out.textContent = t; out.className = 'console ' + (cls || ''); }
        function setBusy(b) { ['#mlCRun', '#mlCReset'].forEach(function (id) { var e = sec.querySelector(id); if (e) e.disabled = b; }); }
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
              if (d.type === 'phase') { if (d.phase === 'compile') log('clang: 正在编译…', 'dim'); if (d.phase === 'run') log('wasm: 编译完成，运行 trace…', 'dim'); }
              else if (d.type === 'error') { if (settled) return; settled = true; clearTimeout(timer); w.terminate(); reject(new Error(d.message || '编译失败')); }
              else if (d.type === 'done') { if (settled) return; settled = true; clearTimeout(timer); w.terminate(); resolve(d); }
            };
            w.onerror = function (err) { if (settled) return; settled = true; clearTimeout(timer); try { w.terminate(); } catch (e) { } reject(new Error(err.message || 'Worker 错误')); };
            w.postMessage({ source: source, stdin: '' });
          });
        }
        function scoreOf(r) {
          if (!r.ok) return { total: 0, correct: 0, util: 0, tput: 0, realloc: 0 };
          var correct = 30;
          var util = Math.min(35, 35 * Math.min(1, r.maxUtil / 60));
          var tput = r.ok ? 25 : 0;
          var realloc = r.reallocOk ? 10 : 0;
          return { total: Math.round(correct + util + tput + realloc), correct: correct, util: Math.round(util), tput: Math.round(tput), realloc: realloc };
        }
        async function run() {
          var code = ed.get();
          setBusy(true); adopt.disabled = true; log('▶ 编译并运行浏览器分配器检查…');
          try {
            var built = MH.build(code);
            var res = await compileAndRun(built.source);
            var r = MH.parse(res.output || '');
            if (!r.traces.length) {
              log('✕ 没有得到 MTRACE 结果。输出：\n' + (res.output || '(空)').slice(0, 3000), 'err');
            } else {
              var sc = scoreOf(r), lines = r.traces.map(function (t) {
                return (t.pass ? '✓' : '✕') + ' ' + t.name.padEnd(8) + ' util ' + t.util.toFixed(1) + '% · ' + t.ops + ' ops';
              });
              log((r.ok ? '✓ 全部 trace 通过' : '✕ 未通过') + ' · 浏览器得分 ' + sc.total + ' / 100\n' + lines.join('\n') + (r.failures.length ? '\n' + r.failures.slice(0, 3).join('\n') : ''), r.ok ? 'ok' : 'err');
              report.innerHTML = '<div class="test-results">' + r.traces.map(function (t) { return '<div class="' + (t.pass ? 'pass' : 'fail') + '"><span>' + t.name + '</span><span>util ' + t.util.toFixed(1) + '% · ' + t.ops + ' ops</span></div>'; }).join('') + '</div>' +
                '<div class="kv"><span>正确性</span><b>' + sc.correct + ' / 30</b></div><div class="kv"><span>利用率</span><b>' + sc.util + ' / 35（峰值 ' + r.maxUtil.toFixed(1) + '%）</b></div><div class="kv"><span>吞吐量</span><b>' + sc.tput + ' / 25（wasm 不测时钟）</b></div><div class="kv"><span>realloc</span><b>' + sc.realloc + ' / 10</b></div>';
              lastScore = sc.total; adopt.disabled = !(lastScore > 0);
            }
          } catch (e) { log('✕ ' + e.message, 'err'); }
          finally { setBusy(false); }
        }
        sec.querySelector('#mlCRun').addEventListener('click', run);
        sec.querySelector('#mlCReset').addEventListener('click', function () { if (confirm('恢复分配器模板？当前修改会丢失。')) { ed.reset(); ed.set(MH.starter); } });
        adopt.addEventListener('click', function () {
          if (!lastScore) return;
          CA.progress.lab('malloclab', { score: lastScore, solved: { browser: true } });
          CA.refreshLabScore('malloclab');
          adopt.disabled = true;
          CA.toast('已采用浏览器得分 ' + lastScore + ' / 100（非官方）');
        });
      }
    },
    {
      id: 'official', num: '9.M3', title: '官方 mdriver 与评分',
      html: `
        <pre data-lang="bash"><code>cd /root/CSAPP/malloclab-handout
make
./mdriver -V -f short1-bal.rep     # 短轨迹
./mdriver -V                       # 全部 trace
cat traces/README                  # 查看 trace 说明</code></pre>
        <p>官方评分大致按：正确性（必须全过）、利用率（峰值载荷/堆大小）与吞吐量（相对参考分配器）。具体权重与阈值以 handout 为准。不要为了利用率牺牲正确性；也不要让 realloc/合并出现悬空指针。</p>
        <div class="callout warn"><div class="c-title">实验机是模拟 x86</div><p>吞吐量测量受宿主影响，不能当作物理机性能。正确性与利用率是更稳定的指标；性能比较应在同一环境、同一 trace 下进行。</p></div>
        <div class="card" style="margin-top:10px"><h4>记录官方 mdriver 结果</h4><p style="font-size:11px;color:var(--mute)">把实验机 <code>./mdriver</code> 的末尾输出粘贴到这里；页面会解析 <code>Perf index = ... = NN/100</code> 并写入学习档案。</p>
          <textarea id="mlOfficialPaste" style="width:100%;height:100px;resize:vertical;margin-top:6px" spellcheck="false" placeholder="Perf index = 40 (util) + 40 (thru) = 80/100"></textarea>
          <div class="flex wrap gap8" style="margin-top:8px"><button class="btn primary sm" type="button" id="mlOfficialParse">解析并记录</button></div>
          <pre id="mlOfficialMsg" class="console" style="min-height:60px;margin-top:8px">尚未记录官方结果。</pre>
        </div>
      `,
      init: function (sec) {
        var CA = window.CA;
        var btn = sec.querySelector('#mlOfficialParse'), paste = sec.querySelector('#mlOfficialPaste'), msg = sec.querySelector('#mlOfficialMsg');
        btn.addEventListener('click', function () {
          var text = paste.value || '';
          var m = /Perf index\s*=\s*(\d+)\s*\(util\)\s*\+\s*(\d+)\s*\(thru\)\s*=\s*(\d+)\s*\/\s*100/i.exec(text);
          if (!m) m = /Perf index\s*=\s*(\d+)\s*\/\s*100/i.exec(text);
          var total = m ? Number(m[m.length - 1]) : NaN;
          if (!isFinite(total) || total < 0 || total > 100) {
            msg.textContent = '✕ 没有找到 0–100 的 Perf index；请粘贴包含 “Perf index = ... /100” 的 mdriver 输出。';
            msg.className = 'console err'; return;
          }
          CA.progress.lab('malloclab', { score: total, solved: { official: true } });
          CA.refreshLabScore('malloclab');
          msg.textContent = '✓ 已记录官方 mdriver 分数 ' + total + ' / 100' + (m.length === 4 ? '（util ' + m[1] + ' + thru ' + m[2] + '）' : '') + '。';
          msg.className = 'console ok';
          CA.toast('已记录官方 Malloc 分数 ' + total + ' / 100');
        });
      }
    }
  ],
  checklist: [
    { id: 'blocks', label: '能画出块头/载荷/脚，解释 8 字节对齐与已分配位。' },
    { id: 'fit', label: '实现首次/最佳适配，能在中间块释放后复用。' },
    { id: 'merge', label: '释放时正确合并前/后相邻空闲块。' },
    { id: 'realloc', label: 'realloc 正确处理 NULL、size=0、就地扩展与搬迁。' },
    { id: 'mdriver', label: '在实验机全部 trace 通过正确性检查，记录利用率与吞吐量。' }
  ]
};
