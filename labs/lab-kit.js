/* 统一实验页：读取 curriculum 元数据 + labs/content/<id>.js，渲染工作流、检查清单与实验机入口。 */
(function () {
  'use strict';
  var CA = window.CA;
  if (!CA) return;
  var id = document.body.getAttribute('data-lab') || 'bomb';
  var meta = (CA.CURRICULUM.labById || {})[id];
  var content = null;
  var $ = function (s) { return document.querySelector(s); };

  function scoreKey(k) { return 'ca.labcheck.' + id + '.' + k; }
  function loadChecks() {
    try { return JSON.parse(localStorage.getItem('ca.labcheck.' + id) || '{}'); } catch (e) { return {}; }
  }
  function saveChecks(o) { try { localStorage.setItem('ca.labcheck.' + id, JSON.stringify(o)); } catch (e) { } }

  function renderHead() {
    var head = $('#labHead');
    head.innerHTML =
      '<div class="crumb"><b>第 ' + CA.pad(meta.chapter, 2) + ' 章</b><span>/</span><span>CS:APP 官方实验</span><span>/</span><span>' + CA.esc(meta.en) + '</span></div>' +
      '<h1>' + CA.esc(meta.title) + '</h1><div class="en">' + CA.esc(meta.en) + '</div>' +
      '<div class="meta"><span class="badge lime">' + CA.esc(meta.mode) + '</span><span class="badge plain">' + meta.total + ' PTS</span><span class="badge plain">' + meta.minutes + ' MIN</span><span class="badge plain">' + CA.esc(meta.difficulty) + '</span></div>' +
      '<p class="summary">' + CA.esc(content.summary || meta.tagline) + '</p>';
    document.title = meta.title + ' · 计算之境';
    document.querySelectorAll('[data-lab-total]').forEach(function (e) { e.textContent = String(meta.total); });
  }

  function renderBody() {
    var body = $('#labBody');
    var html = '';
    if (content.objectives && content.objectives.length) {
      html += '<div class="objectives">' + content.objectives.map(function (o, i) {
        return '<div class="objective"><b>目标 ' + CA.pad(i + 1, 2) + '</b>' + o + '</div>';
      }).join('') + '</div>';
    }
    html += '<div class="lab-mode-grid">' +
      '<div class="lab-mode"><h4>浏览器内观察 / 检查</h4><p>' + (content.browserNote || '本页提供机制可视化与部分自动检查；不需要安装环境。') + '</p></div>' +
      '<div class="lab-mode"><h4>Linux 实验机 / 官方评分</h4><p>' + (content.vmNote || '完整实验与官方评分在本机 Debian 实验机中运行；通过网页终端连接，原始输出回传页面。') + '</p></div></div>';
    if (content.vmLab) {
      html += '<p><a class="btn primary" href="../index.html?lab=' + encodeURIComponent(content.vmLab) + '">打开 Linux 实验机 →</a> <a class="btn" href="../course/chapter.html?ch=' + CA.pad(meta.chapter, 2) + '">回到第 ' + meta.chapter + ' 章</a></p><p style="font-size:10.5px;color:var(--mute);margin:-2px 0 10px">终端需要从“打开学习实验室.command”启动的会话；直接打开本地 HTTP 页面可能没有终端令牌。</p>';
    }
    html += '<div id="labSections"></div>';
    html += '<h2 id="checklist"><span class="h-num">CHECK</span>实验检查清单</h2>' +
      '<p>这些是完成实验前应亲自确认的步骤，不代替官方评分。勾选状态保存在本机。</p><div class="checklist" id="labChecklist"></div>' +
      '<div class="card mt16"><h4>记录官方得分</h4><p>在实验机中取得官方分数后，可在这里记录，便于学习档案汇总。该项为自报，需教师或助教核对。</p>' +
      '<div class="lab-score-form"><label class="field"><span>官方得分</span><input type="number" min="0" max="' + meta.total + '" step="1" id="officialScore" placeholder="0–' + meta.total + '"></label>' +
      '<button class="btn primary sm" type="button" id="saveOfficial">记录</button><span id="officialStatus" style="font-size:10.5px;color:var(--mute)"></span></div></div>';
    if (content.afterHtml) html += content.afterHtml;
    body.innerHTML = html;
    var sections = $('#labSections');
    (content.sections || []).forEach(function (sec, i) {
      var el = document.createElement('section');
      el.innerHTML = '<h2 id="' + CA.esc(sec.id) + '"><span class="h-num">' + (sec.num || (meta.chapter + '.' + (i + 1))) + '</span>' + sec.title + '</h2>' + sec.html;
      sections.appendChild(el);
      if (typeof sec.init === 'function') {
        try { sec.init(el); } catch (e) { console.error('lab section', sec.id, e); var n = document.createElement('div'); n.className = 'callout warn'; n.innerHTML = '<div class="c-title">可视化加载失败</div><p>' + CA.esc(e.message || e) + '</p>'; el.appendChild(n); }
      }
    });
    renderChecklist();
    var save = $('#saveOfficial'), inp = $('#officialScore'), st = $('#officialStatus');
    if (save && inp) save.addEventListener('click', function () {
      var v = parseInt(inp.value, 10);
      if (!Number.isFinite(v) || v < 0 || v > meta.total) { CA.toast('请输入 0–' + meta.total); return; }
      CA.progress.lab(id, { score: v });
      CA.refreshLabScore(id);
      st.textContent = '已记录 ' + v + ' / ' + meta.total + '（自报）';
      CA.toast('已记录官方得分');
    });
    var tocBox=document.querySelector('#labToc');
    if(tocBox){tocBox.innerHTML='<div class="toc-title">实验目录</div>'+(content.sections||[]).map(function(sec){return '<a href="#'+CA.esc(sec.id)+'">'+CA.esc(sec.title)+'</a>';}).join('');}
    CA.highlight(); CA.initQuizzes();
    var p = CA.progress.lab(id);
    if (p.score) { inp.value = p.score; st.textContent = '当前记录 ' + p.score + ' / ' + meta.total + '（自报或自动）'; }
  }

  function renderChecklist() {
    var box = $('#labChecklist'); if (!box) return;
    var state = loadChecks();
    box.innerHTML = '';
    (content.checklist || []).forEach(function (item, i) {
      var key = item.id || ('c' + i);
      var label = document.createElement('label'); label.className = 'check-item' + (state[key] ? ' done' : '');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!state[key];
      var span = document.createElement('span'); span.textContent = item.label || item;
      cb.addEventListener('change', function () {
        state[key] = cb.checked; saveChecks(state); label.classList.toggle('done', cb.checked);
        if (cb.checked) CA.toast('已勾选');
      });
      label.append(cb, span); box.appendChild(label);
    });
  }

  function renderError(msg) {
    $('#labBody').innerHTML = '<div class="callout warn"><div class="c-title">内容未载入</div><p>' + CA.esc(msg) + '</p></div>';
  }

  function init() {
    if (!meta) { renderError('未知实验：' + id); return; }
    var script = document.createElement('script');
    script.src = 'content/' + id + '.js';
    script.onload = function () {
      content = (CA.LAB_CONTENT || {})[id];
      if (!content) { renderError('实验内容文件没有注册 ' + id); return; }
      renderHead(); renderBody();
      CA.refreshLabScore(id);
      if (content.afterRender) { try { content.afterRender(); } catch (e) { console.error(e); } }
    };
    script.onerror = function () { renderError('找不到 labs/content/' + id + '.js'); };
    document.body.appendChild(script);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
