CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.proxylab = {
  summary: 'Proxy Lab 要求实现一个带缓存、能并发处理多个客户端的 HTTP 代理。你要处理请求行/头部、Host、Connection、Content-Length，按 URI 缓存对象，并保证线程安全。本页用 HTTP 模型展示请求—响应与缓存决策；官方代理与并发测试在实验机中运行。',
  objectives: [
    '能解释客户端—代理—源服务器之间的请求/响应字节流。',
    '能解析请求行与头部，正确构造转发请求（Host、Connection）。',
    '能实现按 URI 的 LRU 缓存，并处理命中、未命中与并发访问。',
    '能说明线程池/每连接一线程的并发模型与竞态风险。'
  ],
  browserNote: 'HTTP 模型展示协议与缓存；浏览器 JS 代理检查会执行你的 Proxy.handle（不是 C proxy），真实 socket/线程/官方 driver 在实验机中。',
  vmNote: '官方 proxylab-handout 在实验机中：make 后启动 tiny 与 proxy，用 curl/浏览器经代理访问；并发与缓存测试以官方 driver 为准。',
  vmLab: 'proxy',
  sections: [
    {
      id: 'http', num: '11.P1', title: '一次请求的旅程',
      html: `
        <p>浏览器把 HTTP 请求写进 TCP 连接；代理读到请求后，解析方法/URI/版本与头部，向源服务器建立新连接，转发请求，读取响应，再写回客户端。代理既是服务器，也是客户端。</p>
        <div class="control-row"><label class="field"><span>请求路径</span><select id="pxPath"><option value="/">/（存在）</option><option value="/missing">/missing（不存在）</option></select></label><button class="btn primary sm" type="button" id="pxStep">下一步</button><button class="btn sm" type="button" id="pxReset">重置</button></div>
        <pre id="pxLog" class="console" style="min-height:110px" role="status">选择路径，逐步执行。</pre>
        <pre id="pxBytes" class="console" style="min-height:120px;color:var(--mute)"></pre>
        <p style="font-size:11px;color:var(--mute)">模型中的 DNS 返回 192.0.2.10（文档地址），不会发起真实网络请求。</p>
      `,
      init: function (sec) {
        var H = window.HttpLab;
        var m = null, log = sec.querySelector('#pxLog'), bytes = sec.querySelector('#pxBytes');
        function reset() { m = new H(sec.querySelector('#pxPath').value); log.textContent = '准备请求 ' + m.path; bytes.textContent = ''; }
        function step() {
          if (!m) reset();
          var r = m.step();
          if (r.phase === 'dns') log.textContent = '1. DNS：lab.example → ' + r.address;
          else if (r.phase === 'connect') log.textContent = '2. connect：' + r.address + ':' + r.port;
          else if (r.phase === 'request') { log.textContent = '3. 发送请求（' + r.bytes + ' 字节）'; bytes.textContent = r.request; }
          else if (r.phase === 'response') { log.textContent = '4. 收到响应：HTTP ' + r.status + '，Content-Length=' + r.length; bytes.textContent = m.snapshot().request + '\n' + r.response; }
          else if (r.phase === 'close') log.textContent = '5. 关闭连接（Connection: close）。';
          else log.textContent = '完成。';
        }
        sec.querySelector('#pxStep').addEventListener('click', step);
        sec.querySelector('#pxReset').addEventListener('click', reset);
        reset(); step();
      }
    },
    {
      id: 'cache', num: '11.P2', title: '代理缓存与并发',
      html: `
        <p>代理的核心数据结构是“URI → 响应对象”的缓存。一个简单实现：</p>
        <ul>
          <li>缓存对象包含 URI、响应字节（头部 + body）、大小、时间戳/引用计数。</li>
          <li>命中：直接把缓存响应写回客户端；未命中：转发、读完整响应、写入缓存、再写回。</li>
          <li>并发：多个客户端可能同时请求同一 URI；需要锁保护缓存，避免读到半写入对象。</li>
          <li>淘汰：LRU 或按大小；要处理缓存对象被一个线程使用、另一个线程淘汰的引用计数问题。</li>
        </ul>
        <div class="callout warn"><div class="c-title">不要缓存所有东西</div><p>至少不要缓存带 <code>Cache-Control: no-store</code> 或非 GET 的响应；不要缓存不完整/分块传输未读完的响应。缓存键通常用 host + path，不要只用 path。</p></div>
        <pre data-lang="c"><code>// 伪代码：读完整响应再缓存
while ((n = Rio_read(connfd, buf, sizeof buf)) &gt; 0) {
    Rio_writen(cachefd, buf, n);
    Rio_writen(clientfd, buf, n);
}
// 更好的做法：先在内存/临时文件拼完整对象，确认 Content-Length 后再发布到缓存</code></pre>
        <h3>并发模型</h3>
        <p>每连接一线程最简单，但线程数随客户端增长；线程池限制并发。无伦哪种，都要：</p>
        <ul>
          <li>每个连接独立的缓冲区/文件描述符；</li>
          <li>共享缓存加锁，锁的粒度尽量小；</li>
          <li>不要在持锁时做阻塞 I/O；</li>
          <li>处理 SIGPIPE，避免写已关闭连接导致进程退出。</li>
        </ul>
      `,
      init: function () { }
    },
    {
      id: 'browser', num: '11.P2b', title: '浏览器代理模型',
      html: `
        <p>在浏览器里实现一个 JS 版 <code>Proxy.handle(req)</code>：转发请求、按 host+path 缓存 200 响应、在 <code>os.cacheLimit</code> 下做 LRU、拒绝非 GET 请求。检查器会用模拟源站验证基本转发、404、缓存、LRU 与健壮性。</p>
        <div class="task-list" id="pxTasks" style="margin:10px 0"></div>
        <div class="card"><h4 id="pxTaskTitle">基本转发</h4><p id="pxTaskDesc"></p><p id="pxTaskHint" style="font-size:11px;color:var(--mute)"></p></div>
        <div class="editor-wrap" style="min-height:330px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:12px 0">
          <pre class="editor-lines" aria-hidden="true"></pre>
          <textarea id="pxCode" class="editor" spellcheck="false" style="min-height:330px" aria-label="Proxy JS 实现"></textarea>
        </div>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="pxRunAll">运行全部检查</button><button class="btn sm" type="button" id="pxReset">恢复模板</button><button class="btn sm" type="button" id="pxAdopt" disabled>采用浏览器得分</button></div>
        <pre id="pxOut" class="console" style="min-height:120px;margin-top:10px" role="status">尚未检查。</pre>
        <div id="pxReport"></div>
        <p style="font-size:10.5px;color:var(--mute)">这是浏览器 JS 模型，不是官方 C proxy；真实 socket/线程/官方 driver 在实验机中。请只运行自己的代码。</p>
      `,
      init: function (sec) {
        var CA = window.CA, PH = window.ProxyHarness;
        if (!PH) { sec.querySelector('#pxOut').textContent = 'ProxyHarness 未载入。'; return; }
        var ed = CA.editor(sec.querySelector('#pxCode'), { key: 'proxy-js' });
        try { if (!localStorage.getItem('ca.code.proxy-js')) ed.set(PH.starter); } catch (e) { ed.set(PH.starter); }
        var out = sec.querySelector('#pxOut'), report = sec.querySelector('#pxReport'), adopt = sec.querySelector('#pxAdopt');
        var lastScore = 0;
        function log(t, cls) { out.textContent = t; out.className = 'console ' + (cls || ''); }
        function renderTasks() {
          var box = sec.querySelector('#pxTasks'); box.innerHTML = '';
          PH.TASKS.forEach(function (t, i) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'task-item' + (i === 0 ? ' active' : '');
            var tick = document.createElement('span'); tick.className = 'tick'; tick.textContent = '✓';
            var name = document.createElement('span'); name.className = 't-name'; name.textContent = t.name;
            var pts = document.createElement('span'); pts.className = 't-pts'; pts.textContent = t.pts + ' pts';
            b.append(tick, name, pts); b.addEventListener('click', function () {
              sec.querySelectorAll('#pxTasks .task-item').forEach(function (x) { x.classList.remove('active'); });
              b.classList.add('active');
              sec.querySelector('#pxTaskTitle').textContent = t.name;
              sec.querySelector('#pxTaskDesc').textContent = t.desc;
              sec.querySelector('#pxTaskHint').textContent = '提示：' + t.hint;
            });
            box.appendChild(b);
          });
        }
        async function runAll() {
          sec.querySelector('#pxRunAll').disabled = true; adopt.disabled = true; log('▶ 运行代理检查…');
          try {
            var r = await PH.runAll(ed.get());
            var lines = r.results.map(function (x) { return (x.ok ? '✓' : '✕') + ' ' + x.name + ' · ' + x.pts + ' pts · ' + x.detail; });
            log(lines.join('\n') + '\n浏览器得分 ' + r.score + ' / 100', r.score >= 60 ? 'ok' : 'err');
            report.innerHTML = '<div class="test-results">' + r.results.map(function (x) { return '<div class="' + (x.ok ? 'pass' : 'fail') + '"><span>' + x.name + '</span><span>' + (x.ok ? '✓ +' + x.pts : '✕ ' + x.detail) + '</span></div>'; }).join('') + '</div>';
            lastScore = r.score; adopt.disabled = !(lastScore > 0);
            sec.querySelectorAll('#pxTasks .task-item').forEach(function (b, i) { b.classList.toggle('solved', r.results[i] && r.results[i].ok); });
          } catch (e) { log('✕ ' + e.message, 'err'); }
          finally { sec.querySelector('#pxRunAll').disabled = false; }
        }
        sec.querySelector('#pxRunAll').addEventListener('click', runAll);
        sec.querySelector('#pxReset').addEventListener('click', function () { if (confirm('恢复模板？当前修改会丢失。')) { ed.reset(); ed.set(PH.starter); } });
        adopt.addEventListener('click', function () {
          if (!lastScore) return;
          CA.progress.lab('proxylab', { score: lastScore, solved: { browser: true } });
          CA.refreshLabScore('proxylab');
          adopt.disabled = true;
          CA.toast('已采用 Proxy 浏览器得分 ' + lastScore + ' / 100（非官方）');
        });
        renderTasks();
        sec.querySelector('#pxTaskDesc').textContent = PH.TASKS[0].desc;
        sec.querySelector('#pxTaskHint').textContent = '提示：' + PH.TASKS[0].hint;
      }
    },
    {
      id: 'official', num: '11.P3', title: '官方实验机与测试',
      html: `
        <pre data-lang="bash"><code>cd /root/CSAPP/proxylab-handout
make
./tiny 8000 &amp;          # 启动源服务器（看 README）
./proxy 8001 &amp;         # 启动你的代理
curl -x http://localhost:8001 http://localhost:8000/
curl -x http://localhost:8001 http://localhost:8000/missing
# 并发：多个 curl 同时请求，观察缓存命中与线程安全
make test              # 官方 driver（若提供）</code></pre>
        <p>实验机默认不联网，但 localhost 可用；这足够测试代理的转发、缓存与并发。官方评分通常包括基本代理、缓存、并发与健壮性。</p>
        <div class="callout info"><div class="c-title">浏览器与页面</div><p>页面无法直接连接实验机的 socket；原始输出可通过终端回传。若实验机没有 curl，可用 python3 的 urllib 写一个小客户端，或使用官方 handout 提供的测试程序。</p></div>
        <div class="card" style="margin-top:10px"><h4>记录官方 driver 结果</h4><p style="font-size:11px;color:var(--mute)">把官方 <code>driver.sh</code> 末尾的 <code>totalScore: NN/70</code> 粘贴到这里；页面会归一化为 100 分制并写入学习档案。</p>
          <textarea id="pxOfficialPaste" style="width:100%;height:100px;resize:vertical;margin-top:6px" spellcheck="false" placeholder="totalScore: 70/70"></textarea>
          <div class="flex wrap gap8" style="margin-top:8px"><button class="btn primary sm" type="button" id="pxOfficialParse">解析并记录</button></div>
          <pre id="pxOfficialMsg" class="console" style="min-height:60px;margin-top:8px">尚未记录官方结果。</pre>
        </div>
      `,
      init: function (sec) {
        var CA = window.CA;
        var btn = sec.querySelector('#pxOfficialParse'), paste = sec.querySelector('#pxOfficialPaste'), msg = sec.querySelector('#pxOfficialMsg');
        btn.addEventListener('click', function () {
          var text = paste.value || '';
          var m = /totalScore\s*:\s*(\d+)\s*\/\s*(\d+)/i.exec(text);
          if (!m) {
            msg.textContent = '✕ 没有找到 totalScore: NN/MM；请粘贴官方 driver.sh 的末尾输出。';
            msg.className = 'console err'; return;
          }
          var raw = Number(m[1]), max = Number(m[2]);
          if (!max || raw < 0 || raw > max) { msg.textContent = '✕ totalScore 超出范围。'; msg.className = 'console err'; return; }
          var score = Math.round(raw / max * 100);
          CA.progress.lab('proxylab', { score: score, solved: { official: true } });
          CA.refreshLabScore('proxylab');
          msg.textContent = '✓ 已记录官方 driver 结果 ' + raw + ' / ' + max + '，归一化 ' + score + ' / 100。';
          msg.className = 'console ok';
          CA.toast('已记录官方 Proxy 分数 ' + score + ' / 100');
        });
      }
    }
  ],
  checklist: [
    { id: 'basic', label: '代理能转发 GET 请求并返回正确响应。' },
    { id: 'headers', label: '正确处理 Host、Connection、Content-Length 与请求行。' },
    { id: 'cache', label: '按 URI 缓存对象，命中/未命中/淘汰行为正确。' },
    { id: 'concurrent', label: '多客户端并发下不崩、不串数据、缓存线程安全。' },
    { id: 'robust', label: '处理截断、超长、非法请求与 SIGPIPE。' }
  ]
};
