/* 计算之境 · 课程层运行时
   课程阅读、进度、测验、实验工作台共用；不依赖框架，可直接静态部署。 */
(function () {
  'use strict';
  window.CA = window.CA || {};
  var C = window.CA;
  C.qs = function (s, r) { return (r || document).querySelector(s); };
  C.qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  C.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  C.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  C.hex = function (n, w) { var s = (n >>> 0).toString(16).toUpperCase(); while (s.length < (w || 2)) s = '0' + s; return '0x' + s; };
  C.pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
  C.fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  C.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  C.debounce = function (fn, ms) { var t; return function () { var a = arguments, x = this; clearTimeout(t); t = setTimeout(function () { fn.apply(x, a); }, ms); }; };

  var KEY = 'ca.course.v1';
  var DEFAULTS = { chapters: {}, labs: {}, quiz: {}, created: Date.now(), updated: null };
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var d = raw ? JSON.parse(raw) : null;
      if (!d || typeof d !== 'object') d = JSON.parse(JSON.stringify(DEFAULTS));
      d.chapters = d.chapters || {}; d.labs = d.labs || {}; d.quiz = d.quiz || {};
      return d;
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  }
  var state = load();
  function save() {
    state.updated = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
    updateGlobalUI();
  }
  C.progress = {
    all: function () { return state; },
    chapter: function (id, patch) {
      var cur = state.chapters[id] || (state.chapters[id] = { visited: false, complete: false, depth: 0 });
      if (patch) { Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; }); save(); }
      return cur;
    },
    lab: function (id, patch) {
      var cur = state.labs[id] || (state.labs[id] = { score: 0, solved: {}, attempts: 0 });
      if (patch) {
        if (patch.score != null) cur.score = Math.max(cur.score || 0, patch.score);
        if (patch.solved) Object.keys(patch.solved).forEach(function (k) { if (patch.solved[k]) cur.solved[k] = true; });
        if (patch.attempts != null) cur.attempts = patch.attempts;
        cur.updated = Date.now(); save();
      }
      return cur;
    },
    quiz: function (id, answer, correct) { state.quiz[id] = { answer: answer, correct: !!correct, at: Date.now() }; save(); },
    chapterDone: function (id) {
      var c = C.progress.chapter(id);
      c.complete = true; c.visited = true; c.completedAt = Date.now(); save();
      var meta = C.CURRICULUM.chapterById[id] || {};
      C.toast('已完成 · ' + (meta.title || id));
      updateCompleteButtons(id); updateGlobalUI();
    },
    score: function () {
      var chapters = C.CURRICULUM.chapters, labs = C.CURRICULUM.labs;
      var cDone = chapters.filter(function (c) { return state.chapters[c.id] && state.chapters[c.id].complete; }).length;
      var labPts = labs.reduce(function (a, l) { return a + ((state.labs[l.id] && state.labs[l.id].score) || 0); }, 0);
      var labMax = labs.reduce(function (a, l) { return a + l.total; }, 0);
      return { chapters: chapters.length, chaptersDone: cDone, labPts: labPts, labMax: labMax, pct: Math.round((cDone / chapters.length * 55 + (labMax ? labPts / labMax : 0) * 45) * 10) / 10 };
    },
    portfolio: function () {
      var lines = [], s = C.progress.score();
      lines.push('# 计算之境 · CS:APP 学习作品集');
      lines.push('');
      lines.push('生成时间：' + new Date().toLocaleString('zh-CN'));
      lines.push('课程版本：' + C.CURRICULUM.edition);
      lines.push('');
      lines.push('## 总览');
      lines.push('');
      lines.push('- 章节完成：' + s.chaptersDone + ' / ' + s.chapters);
      lines.push('- 实验得分：' + s.labPts + ' / ' + s.labMax);
      lines.push('- 综合进度：' + s.pct + '%');
      try {
        var exam = JSON.parse(localStorage.getItem('ca.exam.v1') || 'null');
        if (exam && typeof exam.score === 'number') lines.push('- 结业检查：' + exam.score + ' / 100（' + exam.correct + ' / ' + exam.total + '）');
      } catch (e) { }
      lines.push('');
      lines.push('## 章节');
      lines.push('');
      lines.push('| 章 | 标题 | 状态 | 测验作答 |');
      lines.push('|---|---|---|---|');
      C.CURRICULUM.chapters.forEach(function (c) {
        var p = state.chapters[c.id] || {};
        var q = 0, ok = 0;
        Object.keys(state.quiz).forEach(function (k) { if (k.indexOf('ch' + C.pad(c.num, 2)) === 0) { q++; if (state.quiz[k].correct) ok++; } });
        lines.push('| ' + c.num + ' | ' + c.title + ' | ' + (p.complete ? '已完成' : p.visited ? '学习中' : '未开始') + ' | ' + ok + ' / ' + q + ' |');
      });
      lines.push('');
      lines.push('## 实验');
      lines.push('');
      lines.push('| 实验 | 得分 | 已解任务 | 模式 |');
      lines.push('|---|---|---|---|');
      C.CURRICULUM.labs.forEach(function (l) {
        var p = state.labs[l.id] || { score: 0, solved: {} };
        var solved = Object.keys(p.solved || {}).join(', ') || '—';
        lines.push('| ' + l.title + ' | ' + (p.score || 0) + ' / ' + l.total + ' | ' + solved + ' | ' + l.mode + ' |');
      });
      lines.push('');
      lines.push('## 实验代码与草稿');
      lines.push('');
      lines.push('以下内容来自当前浏览器的 localStorage；不是自动提交的官方作业。');
      lines.push('');
      var keys = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && (k.indexOf('ca.code.') === 0 || k === 'ca.datalab.code.v1' || k === 'ca.attack.payloads.v1' || k === 'ca.bomb.solved')) keys.push(k); } } catch (e) { }
      keys.sort();
      if (!keys.length) lines.push('（还没有保存的代码草稿。）');
      keys.forEach(function (k) {
        var raw = '';
        try { raw = localStorage.getItem(k) || ''; } catch (e) { }
        if (!raw) return;
        lines.push('### ' + k);
        lines.push('');
        var pretty = raw;
        try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch (e) { }
        if (pretty.length > 20000) pretty = pretty.slice(0, 20000) + '\n…（已截断）';
        lines.push('```text');
        lines.push(pretty);
        lines.push('```');
        lines.push('');
      });
      return lines.join('\n');
    },
    exportPortfolio: function () {
      C.download('computer-autonomy-portfolio.md', C.progress.portfolio(), 'text/markdown;charset=utf-8');
    },
    exportJSON: function () {
      C.download('jisuanzhijing-progress.json', JSON.stringify({ app: 'jisuanzhijing', version: 1, exportedAt: new Date().toISOString(), progress: state }, null, 2));
    },
    importJSON: function (text) {
      var obj = JSON.parse(text), p = obj.progress || obj;
      if (!p || typeof p !== 'object' || !p.chapters) throw new Error('不是有效的进度文件');
      state = p; state.labs = state.labs || {}; state.quiz = state.quiz || {}; save();
    },
    reset: function () { state = JSON.parse(JSON.stringify(DEFAULTS)); save(); }
  };

  C.toast = function (msg, ms) {
    var el = C.qs('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(C.toast._t); C.toast._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2400);
  };
  C.download = function (name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  };
  C.copy = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { C.toast('已复制'); });
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); C.toast('已复制'); } catch (e) { C.toast('复制失败'); }
    ta.remove();
  };

  /* ---------------- topbar / footer ---------------- */
  C.mount = function () {
    var base = document.body.getAttribute('data-base') || '';
    var page = document.body.getAttribute('data-page') || '';
    var top = C.qs('[data-topbar]');
    if (!top) return;
    var chOptions = C.CURRICULUM.chapters.map(function (c) {
      return '<option value="' + base + 'course/chapter.html?ch=' + c.id.slice(2) + '"' + (page === c.id ? ' selected' : '') + '>第 ' + c.num + ' 章 · ' + C.esc(c.title) + '</option>';
    }).join('');
    var isLabs = page === 'labs' || page.indexOf('lab:') === 0;
    var isHome = page === 'home';
    var isProgress = page === 'progress';
    top.className = 'topbar';
    top.innerHTML =
      '<div class="container topbar-inner">' +
        '<a class="brand" href="' + base + 'index.html" aria-label="回到计算之境 3D 实验台">' +
          '<span class="brand-mark">CA</span>' +
          '<span class="brand-text"><strong>计算之境 · Computer Autonomy</strong><span>CS:APP · 64-BIT VISUAL SYSTEMS LAB</span></span>' +
        '</a>' +
        '<nav class="topnav" aria-label="主导航">' +
          '<a href="' + base + 'course/index.html" class="' + (isHome ? 'active' : '') + '">课程</a>' +
          '<a href="' + base + 'labs/index.html" class="' + (isLabs ? 'active' : '') + '">实验室</a>' +
          '<a href="' + base + 'course/progress.html" class="' + (isProgress ? 'active' : '') + '">学习档案</a>' +
        '</nav>' +
        '<div class="top-spacer"></div>' +
        '<select class="chapter-select" aria-label="跳转章节">' +
          '<option value="">跳转章节…</option>' + chOptions +
        '</select>' +
        '<div class="progress-pill" title="章节完成与实验得分">' +
          '<svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15"></circle><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="94.2" stroke-dashoffset="94.2"></circle></svg>' +
          '<span data-progress-text>0%</span>' +
        '</div>' +
        '<button class="ghost-btn mobile-toggle" type="button" aria-label="打开导航">菜单</button>' +
      '</div>';
    var sel = C.qs('.chapter-select', top);
    if (sel) sel.addEventListener('change', function () { if (sel.value) location.href = sel.value; });
    var mob = C.qs('.mobile-toggle', top);
    if (mob) mob.addEventListener('click', function () {
      var nav = C.qs('.topnav', top);
      nav.style.cssText = 'display:flex;position:absolute;top:56px;left:16px;background:#0d1b16;border:1px solid var(--line);border-radius:10px;padding:6px;flex-direction:column;z-index:60';
    });
    if (!C.qs('.reading-bar')) { var rb = document.createElement('div'); rb.className = 'reading-bar'; document.body.appendChild(rb); }
    updateGlobalUI();
    mountFooter(base);
    if (page && page.indexOf('ch') === 0 && !C.qs('[data-mode="chapter"]')) C.progress.chapter(page, { visited: true, lastVisit: Date.now() });
    setupReadingBar();
  };

  function mountFooter(base) {
    var f = C.qs('[data-footer]');
    if (!f) return;
    f.className = 'footer';
    f.innerHTML = '<div class="container footer-inner">' +
      '<div><strong style="color:var(--ink);font-weight:500">计算之境 · Computer Autonomy</strong><br>CS:APP 3e 可视化课程 · 64 位执行模型 · 浏览器内实验</div>' +
      '<div class="mono" style="text-align:right"><a href="' + base + 'index.html">3D 实验台</a> · <a href="' + base + 'course/index.html">课程</a> · <a href="' + base + 'labs/index.html">实验室</a><br>' +
      '<span>进度与代码仅保存在本机浏览器；官方实验在 Linux 实验机中运行</span></div></div>';
  }

  function updateGlobalUI() {
    var txt = C.qs('[data-progress-text]'), ring = C.qs('.ring .fg');
    if (!txt) return;
    var s = C.progress.score();
    txt.textContent = s.pct + '%';
    if (ring) ring.setAttribute('stroke-dashoffset', String(94.2 - 94.2 * s.pct / 100));
  }

  function setupReadingBar() {
    var bar = C.qs('.reading-bar');
    if (!bar) return;
    var onScroll = function () {
      var doc = document.documentElement, max = doc.scrollHeight - window.innerHeight;
      bar.style.width = Math.min(100, max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  function updateCompleteButtons(id) {
    var done = C.progress.chapter(id).complete;
    C.qsa('[data-complete-chapter]').forEach(function (b) {
      if (done) { b.textContent = '✓ 本章已完成'; b.classList.add('done'); b.disabled = true; }
    });
  }

  /* ---------------- quizzes ---------------- */
  C.quizHTML = function (o) {
    var opts = o.options.map(function (t, i) {
      return '<button type="button" class="q-option" data-i="' + i + '"><span class="key">' + String.fromCharCode(65 + i) + '</span><span>' + t + '</span></button>';
    }).join('');
    return '<div class="quiz" data-quiz="' + C.esc(o.id) + '" data-answer="' + o.answer + '">' +
      '<div class="q-head"><span class="q-label">检查理解</span>' + (o.points ? '<span class="badge plain">' + o.points + ' pts</span>' : '') + '</div>' +
      '<div class="q-text">' + o.q + '</div><div class="q-options">' + opts + '</div>' +
      '<div class="q-explain">' + (o.explain || '') + '</div></div>';
  };
  C.initQuizzes = function (root) {
    C.qsa('.quiz', root).forEach(function (q) {
      if (q.dataset.bound) return; q.dataset.bound = '1';
      var id = q.getAttribute('data-quiz') || ('q' + Math.random().toString(36).slice(2, 8));
      var opts = C.qsa('.q-option', q), answer = parseInt(q.getAttribute('data-answer'), 10);
      var saved = state.quiz[id];
      if (saved) {
        q.classList.add('answered');
        opts.forEach(function (o, i) {
          if (i === answer) o.classList.add('correct'); else if (i === saved.answer) o.classList.add('wrong');
          o.disabled = true;
        });
      }
      opts.forEach(function (o, i) {
        o.addEventListener('click', function () {
          if (q.classList.contains('answered')) return;
          q.classList.add('answered'); var ok = i === answer;
          opts.forEach(function (x, j) { x.disabled = true; if (j === answer) x.classList.add('correct'); else if (j === i) x.classList.add('wrong'); });
          C.progress.quiz(id, i, ok);
          C.toast(ok ? '回答正确' : '看解析，再走一步');
        });
      });
    });
  };

  /* ---------------- TOC ---------------- */
  C.setupTOC = function () {
    var toc = C.qs('[data-toc]'); if (!toc) return;
    var hs = C.qsa('.lesson h2[id]'); if (!hs.length) return;
    toc.innerHTML = '<div class="toc-title">本章目录</div>' + hs.map(function (h) {
      return '<a href="#' + h.id + '">' + C.esc(h.getAttribute('data-short') || h.textContent.replace(/^\d+(\.\d+)*\s*/, '')) + '</a>';
    }).join('') + '<div class="toc-cta"><b>学习建议</b>先读讲解，再操作可视化；每节末尾的检查题用于确认理解，不追求一次全对。</div>';
    var links = C.qsa('a', toc), obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var i = hs.indexOf(en.target);
          links.forEach(function (l, j) { l.classList.toggle('active', j === i); });
        }
      });
    }, { rootMargin: '-12% 0px -72% 0px' });
    hs.forEach(function (h) { obs.observe(h); });
  };

  /* ---------------- editor ---------------- */
  C.editor = function (textarea, opts) {
    opts = opts || {};
    var wrap = textarea.closest('.editor-wrap') || textarea.parentElement;
    var lineEl = wrap && wrap.querySelector('.editor-lines');
    var key = opts.key;
    if (key) { try { var s = localStorage.getItem('ca.code.' + key); if (s != null) textarea.value = s; } catch (e) { } }
    function updateLines() {
      if (!lineEl) return;
      var n = textarea.value.split('\n').length, arr = [];
      for (var i = 1; i <= n; i++) arr.push(i);
      lineEl.textContent = arr.join('\n'); lineEl.scrollTop = textarea.scrollTop;
    }
    function persist() { if (key) { try { localStorage.setItem('ca.code.' + key, textarea.value); } catch (e) { } } }
    textarea.addEventListener('input', function () { updateLines(); persist(); if (opts.onInput) opts.onInput(textarea.value); });
    textarea.addEventListener('scroll', function () { if (lineEl) lineEl.scrollTop = textarea.scrollTop; });
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var st = textarea.selectionStart, en = textarea.selectionEnd, v = textarea.value;
        textarea.value = v.slice(0, st) + '    ' + v.slice(en);
        textarea.selectionStart = textarea.selectionEnd = st + 4; updateLines(); persist();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (opts.onRun) opts.onRun(); }
    });
    updateLines();
    return {
      get: function () { return textarea.value; },
      set: function (v) { textarea.value = v; updateLines(); persist(); },
      reset: function () { try { localStorage.removeItem('ca.code.' + key); } catch (e) { } },
      focus: function () { textarea.focus(); },
      refresh: updateLines
    };
  };

  C.highlight = function () {
    C.qsa('pre[data-lang] code').forEach(function (el) {
      if (el.dataset.hl) return; el.dataset.hl = '1';
      var html = C.esc(el.textContent);
      html = html.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)/g, '<span class="c">$1</span>');
      html = html.replace(/\b(int|unsigned|long|short|char|void|static|return|if|else|for|while|struct|typedef|sizeof|const|register|break|continue|switch|case|default|goto|extern|volatile|double|float|signed|union|enum)\b/g, '<span class="k">$1</span>');
      html = html.replace(/\b(0x[0-9a-fA-F]+|\d+)\b/g, '<span class="n">$1</span>');
      el.innerHTML = html;
    });
  };

  /* ---------------- chapter page ---------------- */
  C.registerChapter = function (id, data) { C.CHAPTER_CONTENT = C.CHAPTER_CONTENT || {}; C.CHAPTER_CONTENT[id] = data; };
  C.initChapterPage = function () {
    var q = new URLSearchParams(location.search);
    var n = parseInt(q.get('ch') || '1', 10);
    var id = 'ch' + C.pad(n, 2);
    var meta = C.CURRICULUM.chapterById[id];
    if (!meta) { location.replace('index.html'); return; }
    document.body.setAttribute('data-page', id);
    C.mount();
    var body = C.qs('#chapterBody');
    body.innerHTML = '<div class="callout info"><div class="c-title">载入中</div><p>正在载入第 ' + meta.num + ' 章内容…</p></div>';
    var script = document.createElement('script');
    script.src = 'content/' + id + '.js';
    script.onload = function () { C.renderChapter(id); };
    script.onerror = function () { C.renderChapterPlaceholder(meta); };
    document.body.appendChild(script);
  };

  C.renderChapterPlaceholder = function (meta) {
    var lesson = C.qs('.lesson');
    C.qs('.lesson-head').innerHTML = '<div class="crumb"><b>第 ' + meta.num + ' 章</b><span>/</span><span>' + C.esc(meta.en) + '</span></div>' +
      '<h1>' + C.esc(meta.title) + '</h1><p class="summary">' + C.esc(meta.blurb) + '</p>' +
      '<div class="meta"><span class="badge lime">' + meta.minutes + ' 分钟</span><span class="badge">' + meta.level + '</span></div>';
    C.qs('#chapterBody').innerHTML = '<div class="callout warn"><div class="c-title">内容迁移中</div><p>本章正在从旧版课程目录迁移到 64 位课程层。你可以先进入相关实验与 3D 实验台；章节正文会继续补齐。</p></div>' +
      '<p>本章关键词：' + meta.concepts.map(function (x) { return '<code>' + C.esc(x) + '</code>'; }).join(' ') + '</p>' +
      '<p><a class="btn" href="../index.html">回到 3D 实验台</a> <a class="btn" href="' + (meta.labs[0] ? '../labs/' + meta.labs[0] + '.html' : 'index.html') + '">相关实验</a></p>';
    C.mount();
  };

  C.renderChapter = function (id) {
    var meta = C.CURRICULUM.chapterById[id];
    var data = (C.CHAPTER_CONTENT || {})[id];
    if (!data) { C.renderChapterPlaceholder(meta); return; }
    var lesson = C.qs('.lesson');
    C.qs('.lesson-head').innerHTML =
      '<div class="crumb"><b>第 ' + C.pad(meta.num, 2) + ' 章</b><span>/</span><span>' + C.esc(meta.en) + '</span><span>/</span><span>' + C.esc(C.CURRICULUM.edition) + '</span></div>' +
      '<h1>' + C.esc(meta.title) + '</h1><div class="en">' + C.esc(meta.en) + '</div>' +
      '<div class="meta"><span class="badge lime">' + meta.minutes + ' 分钟</span><span class="badge">' + C.esc(meta.level) + '</span>' +
      (meta.labs.length ? '<span class="badge teal">实验 · ' + meta.labs.map(function (l) { return (C.CURRICULUM.labById[l] || {}).title || l; }).join(' / ') + '</span>' : '') +
      '</div><p class="summary">' + C.esc(data.summary || meta.blurb) + '</p>';
    var html = '';
    if (data.objectives && data.objectives.length) {
      html += '<div class="objectives">' + data.objectives.map(function (o, i) {
        return '<div class="objective"><b>目标 ' + C.pad(i + 1, 2) + '</b>' + o + '</div>';
      }).join('') + '</div>';
    }
    html += '<div id="sections"></div>';
    var quiz = data.quiz || [];
    if (quiz.length) {
      html += '<h2 id="check"><span class="h-num">CHECK</span>检查理解</h2><p>这些题目不记入正式成绩，只用于确认你能把概念迁移到新条件。答错会显示解析。</p>';
      quiz.forEach(function (q) { html += C.quizHTML(q); });
    }
    var labIds = data.labs || meta.labs;
    if (labIds && labIds.length) {
      html += '<h2 id="lab"><span class="h-num">LAB</span>把这一章变成可运行的实验</h2>';
      labIds.forEach(function (lid) {
        var lab = C.CURRICULUM.labById[lid]; if (!lab) return;
        html += '<div class="callout lab"><div class="c-title">官方实验 · ' + C.esc(lab.title) + '</div><p>' + C.esc(lab.tagline) + '</p>' +
          '<p><a class="btn primary sm" href="../' + lab.file + '">进入实验 →</a> <span class="badge plain">' + lab.mode + '</span></p></div>';
      });
    }
    html += '<div class="chapter-finish"><div><h3>完成这一章</h3><p>建议先做完检查题与实验，再标记完成。进度只保存在本机。</p></div>' +
      '<button class="btn" type="button" data-complete-chapter>标记本章完成</button></div>';
    var prev = C.CURRICULUM.chapters[meta.num - 2], next = C.CURRICULUM.chapters[meta.num];
    html += '<nav class="chapter-nav" aria-label="章节导航">' +
      (prev ? '<a href="chapter.html?ch=' + C.pad(prev.num, 2) + '"><span class="k">上一章</span><span class="v">' + C.esc(prev.title) + '</span></a>' : '<span></span>') +
      (next ? '<a class="next" href="chapter.html?ch=' + C.pad(next.num, 2) + '"><span class="k">下一章</span><span class="v">' + C.esc(next.title) + '</span></a>' : '<a class="next" href="index.html"><span class="k">课程结束</span><span class="v">回到课程总览</span></a>') +
      '</nav>';
    C.qs('#chapterBody').innerHTML = html;
    var sections = C.qs('#sections');
    data.sections.forEach(function (sec, i) {
      var el = document.createElement('section');
      el.className = 'chapter-section';
      el.innerHTML = '<h2 id="' + C.esc(sec.id) + '"><span class="h-num">' + (sec.num || (meta.num + '.' + (i + 1))) + '</span>' + sec.title + '</h2>' + sec.html;
      sections.appendChild(el);
      if (typeof sec.init === 'function') {
        try { sec.init(el); } catch (err) { console.error('section init', sec.id, err); var note = document.createElement('div'); note.className = 'callout warn'; note.innerHTML = '<div class="c-title">可视化加载失败</div><p>' + C.esc(err.message || err) + '</p>'; el.appendChild(note); }
      }
    });
    C.initQuizzes();
    C.setupTOC();
    C.highlight();
    C.qsa('[data-complete-chapter]').forEach(function (b) { b.addEventListener('click', function () { C.progress.chapterDone(id); }); });
    updateCompleteButtons(id);
    C.progress.chapter(id, { visited: true, lastVisit: Date.now() });
    updateGlobalUI();
    if (data.afterRender) { try { data.afterRender(); } catch (e) { console.error(e); } }
  };

  /* ---------------- lab pages ---------------- */
  C.initLabPage = function (labId) {
    document.body.setAttribute('data-page', 'lab:' + labId);
    C.mount();
    C.progress.lab(labId, {});
    C.refreshLabScore(labId);
    var base = document.body.getAttribute('data-base') || '';
    C.qsa('[data-back-course]').forEach(function (a) { var l = C.CURRICULUM.labById[labId]; if (l) a.href = base + 'course/chapter.html?ch=' + C.pad(l.chapter, 2); });
  };
  C.refreshLabScore = function (id) {
    var p = C.progress.lab(id), lab = C.CURRICULUM.labById[id];
    C.qsa('[data-lab-score]').forEach(function (el) { el.textContent = p.score + ' / ' + lab.total; });
    C.qsa('[data-lab-score-big]').forEach(function (el) { el.textContent = p.score; });
    C.qsa('.meter i[data-lab-meter]').forEach(function (el) { el.style.width = Math.min(100, p.score / lab.total * 100) + '%'; });
    C.qsa('.task-item[data-task]').forEach(function (el) { el.classList.toggle('solved', !!(p.solved && p.solved[el.dataset.task])); });
  };
  C.labScore = function (id, score, solved) {
    C.progress.lab(id, { score: score, solved: solved || {} });
    C.refreshLabScore(id);
  };

  /* ---------------- course home ---------------- */
  C.initCourseHome = function () {
    C.mount();
    var cont = C.qs('#continueBtn');
    if (cont) {
      var nextCh = C.CURRICULUM.chapters.find(function (c) { return !C.progress.chapter(c.id).complete; });
      if (nextCh) {
        cont.href = 'chapter.html?ch=' + C.pad(nextCh.num, 2);
        cont.textContent = '继续：第 ' + nextCh.num + ' 章 · ' + nextCh.title + ' →';
      } else {
        var nextLab = C.CURRICULUM.labs.find(function (l) { return C.progress.lab(l.id).score < l.total; });
        if (nextLab) {
          cont.href = '../' + nextLab.file;
          cont.textContent = '继续实验：' + nextLab.title + ' →';
        } else {
          cont.href = 'exam.html';
          cont.textContent = '做结业检查 →';
        }
      }
    }
    var grid = C.qs('#chapterGrid');
    if (grid) {
      grid.innerHTML = C.CURRICULUM.chapters.map(function (c) {
        var p = C.progress.chapter(c.id);
        return '<a class="chapter-card' + (p.complete ? ' complete' : '') + '" href="chapter.html?ch=' + C.pad(c.num, 2) + '">' +
          '<div class="num"><span>CHAPTER ' + C.pad(c.num, 2) + '</span>' + (p.complete ? '<span class="done">✓ 已完成</span>' : (p.visited ? '<span class="done" style="color:var(--mute)">学习中</span>' : '')) + '</div>' +
          '<h3>' + C.esc(c.title) + '</h3><div class="en">' + C.esc(c.en) + '</div><p>' + C.esc(c.blurb) + '</p>' +
          '<div class="foot"><span>' + c.minutes + ' MIN · ' + c.level + '</span><span>' + (c.labs.length ? '含实验' : '无实验') + '</span></div></a>';
      }).join('');
    }
    var labs = C.qs('#labGrid');
    if (labs) {
      labs.innerHTML = C.CURRICULUM.labs.slice(0, 9).map(function (l) {
        var p = C.progress.lab(l.id);
        return '<a class="lab-card" href="../' + l.file + '"><div class="lab-top"><h3>' + C.esc(l.title) + '</h3><div class="flex gap8">' + (l.verified ? '<span class="badge plain" style="font-size:9px">' + C.esc(l.verified) + '</span>' : '') + '<span class="lab-ch">CH ' + C.pad(l.chapter, 2) + '</span></div></div>' +
          '<p>' + C.esc(l.tagline) + '</p><div class="bar"><i style="width:' + Math.min(100, p.score / l.total * 100) + '%"></i></div>' +
          '<div class="lab-foot"><span>' + l.total + ' PTS · ' + l.difficulty + '</span><span>' + (p.score || 0) + '/' + l.total + '</span></div></a>';
      }).join('');
    }
    var stats = C.qs('#homeStats');
    if (stats) {
      var s = C.progress.score();
      stats.innerHTML = '<div class="stat"><b>' + s.chaptersDone + ' / 12</b><span>章已完成</span></div>' +
        '<div class="stat"><b>' + s.labPts + '</b><span>实验得分 / ' + s.labMax + '</span></div>' +
        '<div class="stat"><b>' + s.pct + '%</b><span>综合进度</span></div>' +
        '<div class="stat"><b>9+1</b><span>官方实验 · 含 legacy</span></div>';
    }
  };

  C.initLabsIndex = function () {
    C.mount();
    var grid = C.qs('#labsGrid');
    if (!grid) return;
    grid.innerHTML = C.CURRICULUM.labs.map(function (l) {
      var p = C.progress.lab(l.id);
      return '<a class="lab-card" href="../' + l.file + '"><div class="lab-top"><h3>' + C.esc(l.title) + '</h3><div class="flex gap8">' + (l.verified ? '<span class="badge plain" style="font-size:9px">' + C.esc(l.verified) + '</span>' : '') + '<span class="lab-ch">CH ' + C.pad(l.chapter, 2) + '</span></div></div>' +
        '<p>' + C.esc(l.tagline) + '</p><div class="bar"><i style="width:' + Math.min(100, p.score / l.total * 100) + '%"></i></div>' +
        '<div class="lab-foot"><span>' + l.total + ' PTS · ' + l.difficulty + ' · ' + l.minutes + ' MIN</span><span>' + (p.score || 0) + '/' + l.total + '</span></div></a>';
    }).join('');
  };

  C.initProgressPage = function () {
    C.mount();
    var chapters = C.qs('#progressChapters'), labs = C.qs('#progressLabs');
    if (chapters) chapters.innerHTML = C.CURRICULUM.chapters.map(function (c) {
      var p = C.progress.chapter(c.id);
      return '<div class="chapter-row' + (p.complete ? ' done' : '') + '"><span class="n">' + C.pad(c.num, 2) + '</span><span class="nm"><b>' + C.esc(c.title) + '</b>' + C.esc(c.en) + '</span><span class="state">' + (p.complete ? '已完成' : (p.visited ? '学习中' : '未开始')) + '</span></div>';
    }).join('');
    if (labs) labs.innerHTML = C.CURRICULUM.labs.map(function (l) {
      var p = C.progress.lab(l.id);
      return '<div class="chapter-row"><span class="n">' + p.score + '</span><span class="nm"><b>' + C.esc(l.title) + '</b>' + C.esc(l.tagline) + '</span><span class="state">' + p.score + ' / ' + l.total + '</span></div>';
    }).join('');
    var examSummary = C.qs('#examSummary');
    if (examSummary) {
      try {
        var exam = JSON.parse(localStorage.getItem('ca.exam.v1') || 'null');
        examSummary.innerHTML = (exam && typeof exam.score === 'number') ? '上次结业检查：<b style="color:var(--lime)">' + exam.score + ' / 100</b>（答对 ' + exam.correct + ' / ' + exam.total + '）。重做会覆盖本机记录。' : '还没有提交结业检查。12 道题覆盖第 1–12 章。';
      } catch (e) { }
    }
    var s = C.progress.score(), summary = C.qs('#progressSummary');
    if (summary) summary.innerHTML = '<div class="readout"><div><span>章节</span><b class="lime">' + s.chaptersDone + ' / ' + s.chapters + '</b></div><div><span>实验分</span><b class="teal">' + s.labPts + ' / ' + s.labMax + '</b></div><div><span>综合</span><b>' + s.pct + '%</b></div></div>';
    var exp = C.qs('#exportProgress'); if (exp) exp.addEventListener('click', function () { C.progress.exportJSON(); });
    var pf = C.qs('#exportPortfolio'); if (pf) pf.addEventListener('click', function () { C.progress.exportPortfolio(); });
    var imp = C.qs('#importProgress'), file = C.qs('#importFile');
    if (imp && file) {
      imp.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        var f = file.files[0]; if (!f) return;
        var r = new FileReader(); r.onload = function () { try { C.progress.importJSON(r.result); C.toast('进度已导入'); setTimeout(function () { location.reload(); }, 500); } catch (e) { C.toast('导入失败：' + e.message); } }; r.readAsText(f);
      });
    }
    var reset = C.qs('#resetProgress');
    if (reset) reset.addEventListener('click', function () { if (confirm('确定清空本机所有章节与实验进度？此操作不可撤销。')) { C.progress.reset(); location.reload(); } });
  };

  /* ---------------- init ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var mode = document.body.getAttribute('data-mode');
    if (mode === 'chapter') C.initChapterPage();
    else if (mode === 'home') C.initCourseHome();
    else if (mode === 'labs') C.initLabsIndex();
    else if (mode === 'progress') C.initProgressPage();
    else if (mode === 'lab') { var id = document.body.getAttribute('data-lab'); if (id) C.initLabPage(id); }
    else C.mount();
    C.highlight();
  });

  C._state = function () { return state; };
})();
