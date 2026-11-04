/* Data Lab 页面控制器：规则检查 → wasm32 编译 → 运行 → 评分。 */
(function () {
  'use strict';
  var D = window.DataLabCases;
  var CA = window.CA;
  if (!D || !CA) return;
  var $ = function (s) { return document.querySelector(s); };
  var STORE = 'ca.datalab.code.v1';
  var state = {
    current: D.tasks[0].id,
    code: {},
    results: {},
    solved: {},
    busy: false,
    editor: null,
    bitLab: null,
    floatLab: null,
    vizMode: 'bit'
  };

  try { state.solved = (CA.progress.lab('datalab').solved) || {}; } catch (e) { }
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    if (saved && typeof saved === 'object') state.code = saved;
  } catch (e) { }
  D.tasks.forEach(function (t) { if (!state.code[t.id]) state.code[t.id] = t.starter; });
  if (state.solved) {
    var firstUnsolved = D.tasks.find(function (t) { return !state.solved[t.id]; });
    if (firstUnsolved) state.current = firstUnsolved.id;
  }

  function saveCode() {
    try { localStorage.setItem(STORE, JSON.stringify(state.code)); } catch (e) { }
  }
  function log(msg, cls) {
    var el = $('#console'); if (!el) return;
    if (el.textContent === '准备就绪。选择任务，写代码，然后编译运行。') el.textContent = '';
    var line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    el.appendChild(line); el.scrollTop = el.scrollHeight;
  }
  function clearLog() { var el = $('#console'); if (el) el.textContent = ''; }
  function score() {
    return D.tasks.reduce(function (a, t) { return a + (state.solved[t.id] ? t.pts : 0); }, 0);
  }
  function solvedObj() {
    var o = {}; D.tasks.forEach(function (t) { if (state.solved[t.id]) o[t.id] = true; }); return o;
  }
  function task(id) { return D.tasks.find(function (t) { return t.id === id; }); }

  function taskList() {
    var box = $('#taskList'); if (!box) return;
    box.innerHTML = '';
    D.tasks.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'task-item' + (t.id === state.current ? ' active' : '') + (state.solved[t.id] ? ' solved' : '');
      b.setAttribute('data-task', t.id); b.setAttribute('role', 'listitem');
      var tick = document.createElement('span'); tick.className = 'tick'; tick.textContent = '✓';
      var name = document.createElement('span'); name.className = 't-name'; name.textContent = t.name;
      var pts = document.createElement('span'); pts.className = 't-pts'; pts.textContent = t.pts + ' pts';
      b.append(tick, name, pts);
      b.addEventListener('click', function () { selectTask(t.id); });
      box.appendChild(b);
    });
  }
  function selectTask(id) {
    if (state.busy) { CA.toast('正在运行，请稍候'); return; }
    saveCurrentCode();
    state.current = id;
    var t = task(id);
    $('#taskTitle').textContent = t.name;
    $('#taskDesc').textContent = t.desc;
    $('#taskOps').textContent = '最多 ' + t.ops + ' ops · ' + t.pts + ' pts';
    $('#taskHint').textContent = t.hint;
    $('#hintBox').open = false;
    state.editor.set(state.code[id] || t.starter);
    taskList(); renderCurrentState(); renderRule(state.results[id] && state.results[id].rule); renderResults();
    $('#vizInt').hidden = t.kind.indexOf('float') === 0;
    $('#vizFloat').hidden = t.kind.indexOf('float') !== 0;
    if (t.kind.indexOf('float') === 0) { ensureFloatViz(); setVizMode('float'); } else { setVizMode('bit'); }
    if (state.bitLab) { try { state.bitLab.set(D.cases(id)[0][0]); } catch (e) { } }
    $('#code').focus();
  }
  function saveCurrentCode() {
    if (!state.editor) return;
    state.code[state.current] = state.editor.get();
    saveCode();
  }
  function renderCurrentState() {
    var r = state.results[state.current];
    var el = $('#curTaskState');
    if (!el) return;
    if (state.solved[state.current]) { el.textContent = '已通过 ✓'; el.style.color = 'var(--teal)'; }
    else if (r && r.rule && !r.rule.ok) { el.textContent = '规则未通过'; el.style.color = 'var(--red)'; }
    else if (r && r.compiled && !r.ok) { el.textContent = '测试失败 ' + r.pass + '/' + r.total; el.style.color = 'var(--red)'; }
    else if (r && r.ok) { el.textContent = '通过 ✓'; el.style.color = 'var(--teal)'; }
    else { el.textContent = '未检查'; el.style.color = 'var(--mute)'; }
  }
  function renderScore() {
    var s = score(), n = D.tasks.filter(function (t) { return state.solved[t.id]; }).length;
    document.querySelectorAll('[data-lab-score]').forEach(function (e) { e.textContent = s + ' / 100'; });
    document.querySelectorAll('[data-lab-score-big]').forEach(function (e) { e.textContent = String(s); });
    document.querySelectorAll('[data-lab-meter]').forEach(function (e) { e.style.width = s + '%'; });
    var nEl = $('#solvedCount'); if (nEl) nEl.textContent = n + ' / ' + D.tasks.length;
    var st = $('#scoreState'); if (st) st.textContent = s >= 100 ? '全部完成' : s > 0 ? '进行中' : '未开始';
    CA.refreshLabScore('datalab');
  }
  function renderRule(rule) {
    var box = $('#ruleBox'), chip = $('#ruleChip');
    if (!box) return;
    if (!rule) { box.innerHTML = '还没有检查。'; if (chip) { chip.textContent = 'RULES'; chip.className = 'badge plain'; } return; }
    var cls = rule.ok ? 'rule-ok' : 'rule-bad';
    var html = '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px"><span>运算符</span><b class="' + (rule.ops > rule.limit ? 'rule-bad' : '') + '">' + rule.ops + ' / ' + rule.limit + '</b></div>';
    if (rule.errors.length) html += '<div class="' + cls + '"><b>必须修复</b><ul style="margin:4px 0 0;padding-left:16px">' + rule.errors.map(function (e) { return '<li>' + CA.esc(e) + '</li>'; }).join('') + '</ul></div>';
    else html += '<div class="rule-ok">✓ 规则检查通过</div>';
    if (rule.warnings && rule.warnings.length) html += '<div style="margin-top:6px;color:var(--amber)"><b>提示</b><ul style="margin:4px 0 0;padding-left:16px">' + rule.warnings.map(function (e) { return '<li>' + CA.esc(e) + '</li>'; }).join('') + '</ul></div>';
    box.innerHTML = html;
    if (chip) { chip.textContent = rule.ok ? 'RULES OK' : 'RULES FAIL'; chip.className = 'badge ' + (rule.ok ? 'teal' : 'red'); }
  }
  function renderResults() {
    var box = $('#resultList'); if (!box) return;
    box.innerHTML = D.tasks.map(function (t) {
      var r = state.results[t.id];
      var status = state.solved[t.id] ? '✓ 通过' : r ? (r.ok ? '✓ ' + r.pass + '/' + r.total : '✕ ' + (r.pass || 0) + '/' + (r.total || '?')) : '—';
      return '<div class="' + (state.solved[t.id] ? 'pass' : (r && !r.ok ? 'fail' : '')) + '"><span>' + t.name + '</span><span>' + status + '</span></div>';
    }).join('');
  }
  function setVizMode(mode) {
    state.vizMode = mode;
    $('#vizInt').hidden = mode !== 'bit';
    $('#vizFloat').hidden = mode !== 'float';
    document.querySelectorAll('[data-viz]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-viz') === mode); });
  }
  function ensureFloatViz() {
    if (state.floatLab) return;
    CA.viz.floatExplorer($('#vizFloat'));
    state.floatLab = true;
  }

  function compileAndRun(source) {
    return new Promise(function (resolve, reject) {
      var worker;
      try { worker = new Worker('../engine/c-worker.js', { type: 'module' }); }
      catch (e) { reject(new Error('无法创建编译 Worker：' + e.message)); return; }
      var settled = false;
      var timer = setTimeout(function () { if (settled) return; settled = true; try { worker.terminate(); } catch (e) { } reject(new Error('编译/运行超时（90 秒）')); }, 90000);
      worker.onmessage = function (e) {
        var d = e.data || {};
        if (d.type === 'phase') {
          if (d.phase === 'compile') log('clang: 正在编译…', 'dim');
          if (d.phase === 'run') { log('wasm: 编译完成，开始运行测试…', 'dim'); if (d.diagnostics && d.diagnostics.trim()) log(d.diagnostics.trim(), 'warn'); }
        } else if (d.type === 'error') {
          if (settled) return; settled = true; clearTimeout(timer); worker.terminate();
          reject(new Error(d.message || '编译失败'));
        } else if (d.type === 'done') {
          if (settled) return; settled = true; clearTimeout(timer); worker.terminate();
          resolve(d);
        }
      };
      worker.onerror = function (err) {
        if (settled) return; settled = true; clearTimeout(timer); try { worker.terminate(); } catch (e) { }
        reject(new Error(err.message || 'Worker 错误'));
      };
      worker.postMessage({ source: source, stdin: '' });
    });
  }

  async function runCurrent() {
    if (state.busy) return;
    saveCurrentCode();
    var t = task(state.current), code = state.code[t.id];
    clearLog(); log('▶ ' + t.name, 'cyan');
    var rule = D.checkRules(code, t.id);
    state.results[t.id] = { rule: rule, ok: false, pass: 0, total: 0, fails: [] };
    renderRule(rule);
    if (!rule.ok) {
      log('✕ 规则检查未通过，未进入编译。', 'err');
      renderCurrentState(); renderResults();
      return;
    }
    log('✓ 规则检查通过，' + rule.ops + ' / ' + rule.limit + ' ops', 'ok');
    state.busy = true; setBusy(true);
    try {
      var built = D.buildSource(t.id, code);
      log('clang: 测试样例 ' + built.cases + ' 组', 'dim');
      var res = await compileAndRun(built.source);
      var parsed = D.parseOutput(res.output || '');
      state.results[t.id] = { rule: rule, ok: false, pass: parsed.pass, total: parsed.total, fails: parsed.fails, output: res.output, compiled: true };
      if (parsed.total === 0) {
        log('✕ 没有得到测试结果。编译器/运行输出：', 'err');
        log((res.output || '(空)').slice(0, 4000), 'dim');
      } else if (parsed.pass === parsed.total) {
        state.results[t.id].ok = true;
        state.solved[t.id] = true;
        log('✓ PASS ' + parsed.pass + ' / ' + parsed.total + ' · ' + t.pts + ' pts', 'ok');
      } else {
        log('✕ FAIL ' + parsed.pass + ' / ' + parsed.total, 'err');
        parsed.fails.slice(0, 3).forEach(function (f) { log('  ' + f, 'err'); });
        if (res.exitCode !== 0) log('程序退出码 ' + res.exitCode, 'dim');
      }
      if (parsed.pass === parsed.total) {
        CA.labScore('datalab', score(), solvedObj());
        CA.toast('通过 ' + t.name + ' · +' + t.pts);
      }
      renderCurrentState(); renderScore(); renderResults();
    } catch (e) {
      log('✕ ' + (e.message || e), 'err');
      state.results[t.id].compiled = false;
    } finally {
      state.busy = false; setBusy(false);
    }
  }

  function checkOnly() {
    saveCurrentCode();
    var t = task(state.current), rule = D.checkRules(state.code[t.id], t.id);
    state.results[t.id] = state.results[t.id] || {};
    state.results[t.id].rule = rule;
    renderRule(rule); renderCurrentState(); renderResults();
    clearLog();
    log(rule.ok ? '✓ 规则检查通过 · ' + rule.ops + ' / ' + rule.limit + ' ops' : '✕ 规则检查未通过', rule.ok ? 'ok' : 'err');
    if (!rule.ok) rule.errors.forEach(function (e) { log('  ' + e, 'err'); });
    if (rule.warnings.length) rule.warnings.forEach(function (e) { log('  ' + e, 'warn'); });
  }

  function setBusy(b) {
    ['#runBtn', '#gradeAllBtn', '#checkBtn', '#resetBtn'].forEach(function (s) { var e = $(s); if (e) e.disabled = b; });
    var b1 = $('#runBtn'); if (b1) b1.textContent = b ? '运行中…' : '编译并运行 ⌘↵';
  }

  async function gradeAll() {
    if (state.busy) return;
    saveCurrentCode();
    state.busy = true; setBusy(true);
    clearLog(); log('▶ 全部评分：' + D.tasks.length + ' 个任务', 'cyan');
    for (var i = 0; i < D.tasks.length; i++) {
      var t = D.tasks[i];
      log('── ' + (i + 1) + '/' + D.tasks.length + ' ' + t.name, 'dim');
      var rule = D.checkRules(state.code[t.id], t.id);
      state.results[t.id] = { rule: rule, ok: false, pass: 0, total: 0, fails: [] };
      if (!rule.ok) { log('  规则未通过：' + rule.errors[0], 'err'); continue; }
      try {
        var built = D.buildSource(t.id, state.code[t.id]);
        var res = await compileAndRun(built.source);
        var parsed = D.parseOutput(res.output || '');
        state.results[t.id] = { rule: rule, ok: parsed.pass === parsed.total && parsed.total > 0, pass: parsed.pass, total: parsed.total, fails: parsed.fails, compiled: true, output: res.output };
        if (parsed.pass === parsed.total && parsed.total > 0) { state.solved[t.id] = true; log('  PASS ' + parsed.pass + '/' + parsed.total, 'ok'); }
        else { log('  FAIL ' + parsed.pass + '/' + parsed.total, 'err'); if (parsed.fails[0]) log('  ' + parsed.fails[0], 'err'); }
      } catch (e) { log('  ' + e.message, 'err'); }
      renderScore();
    }
    CA.labScore('datalab', score(), solvedObj());
    renderScore(); renderResults(); renderCurrentState();
    state.busy = false; setBusy(false);
    log('■ 全部评分结束：' + score() + ' / 100', 'cyan');
  }

  function exportBits() {
    saveCurrentCode();
    var header = '/* Data Lab · 计算之境 · ' + new Date().toISOString() + '\n' +
      ' * 由浏览器内实验页导出。规则与测试以页面/实验机为准。\n */\n\n';
    var body = D.tasks.map(function (t) { return '/* ' + t.name + ' */\n' + (state.code[t.id] || t.starter); }).join('\n\n');
    CA.download('bits.c', header + body, 'text/plain;charset=utf-8');
  }

  function resetCurrent() {
    if (!confirm('恢复当前任务的初始代码？当前修改会丢失。')) return;
    state.code[state.current] = task(state.current).starter;
    saveCode(); state.editor.set(state.code[state.current]);
    state.results[state.current] = null; renderCurrentState(); renderResults();
    log('已恢复初始代码。', 'warn');
  }

  function init() {
    CA.labScore('datalab', score(), solvedObj());
    state.editor = CA.editor($('#code'), {
      key: null,
      onInput: function (v) { state.code[state.current] = v; saveCode(); },
      onRun: function () { runCurrent(); }
    });
    state.editor.set(state.code[state.current]);
    taskList();
    var t = task(state.current);
    $('#taskTitle').textContent = t.name; $('#taskDesc').textContent = t.desc;
    $('#taskOps').textContent = '最多 ' + t.ops + ' ops · ' + t.pts + ' pts';
    $('#taskHint').textContent = t.hint;
    state.bitLab = CA.viz.bitLab($('#vizInt'), { value: D.cases(state.current)[0][0] });
    $('#runBtn').addEventListener('click', runCurrent);
    $('#checkBtn').addEventListener('click', checkOnly);
    $('#gradeAllBtn').addEventListener('click', gradeAll);
    $('#resetBtn').addEventListener('click', resetCurrent);
    $('#exportBtn').addEventListener('click', exportBits);
    document.querySelectorAll('[data-viz]').forEach(function (b) { b.addEventListener('click', function () { setVizMode(b.getAttribute('data-viz')); if (b.getAttribute('data-viz') === 'float') ensureFloatViz(); }); });
    renderScore(); renderResults(); renderCurrentState();
    if (t.kind.indexOf('float') === 0) { ensureFloatViz(); setVizMode('float'); } else setVizMode('bit');
    log('Data Lab 就绪。13 个任务，满分 100。先做整数题，再挑战浮点。', 'dim');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
