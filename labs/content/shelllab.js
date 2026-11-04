CA.LAB_CONTENT = CA.LAB_CONTENT || {};
CA.LAB_CONTENT.shelllab = {
  summary: 'Shell Lab 要求实现一个带作业控制的 Unix shell：fork/exec/wait、前台/后台、SIGINT/SIGCHLD/SIGTSTP、进程组与终端控制。本页用确定性进程模型解释 fork/等待/僵尸/回收，并给出官方 sdriver.pl trace 的完整工作流。',
  objectives: [
    '能解释 fork 后父子进程的返回值、地址空间与文件描述符继承。',
    '能解释前台等待、SIGCHLD 回收、僵尸与 waitpid 的 WNOHANG。',
    '能用 setpgid/tcsetpgrp 把前台进程组交给终端。',
    '能读懂 sdriver.pl trace 1–16 的预期行为与常见失败。'
  ],
  browserNote: '进程模型演示 fork/等待/退出；浏览器 JS 检查会运行你的 Shell 作业控制策略（模拟信号/终端），真实 tsh.c 与 sdriver.pl 在实验机中。',
  vmNote: '官方 shlab-handout 在实验机中：make 后运行 make test01…test16 / rtest01…；用 sdriver.pl 比较参考与学生输出。',
  vmLab: 'shell',
  sections: [
    {
      id: 'fork', num: '8.S1', title: 'fork 之后：两个进程，各自一份状态',
      html: `
        <p><code>fork()</code> 创建一个几乎相同的子进程：地址空间被复制（写时复制），文件描述符表被复制，父进程得到子进程 pid，子进程得到 0。之后的变量修改互不影响。</p>
        <div class="grid-2">
          <div class="card"><h4>父进程</h4><p><code>pid = fork()</code> 返回子进程 PID（&gt; 0）。它可以 <code>waitpid</code> 等待子进程结束，再回收。</p></div>
          <div class="card"><h4>子进程</h4><p><code>pid = fork()</code> 返回 0。它通常立刻 <code>execve</code> 加载新程序；exec 成功后，原程序的代码/数据被替换。</p></div>
        </div>
        <p>下面的模型用两个独立的 <code>x</code> 演示“子进程加一，父进程不会变”：</p>
        <div class="control-row"><button class="btn primary sm" type="button" id="shFork">执行 fork</button><button class="btn sm" type="button" id="shChild">子进程 x++</button><button class="btn sm" type="button" id="shParent">父进程 x++</button><button class="btn sm" type="button" id="shExit">子进程退出</button><button class="btn sm" type="button" id="shWait">父进程 wait</button><button class="btn sm" type="button" id="shReset">重置</button></div>
        <div id="shState"></div>
        <pre id="shLog" class="console" style="min-height:90px;margin-top:10px">先 fork。</pre>
        <p style="font-size:11px;color:var(--mute)">模型不模拟 CPU 调度、信号或终端；它只说明状态关系。</p>
      `,
      init: function (sec) {
        var CA = window.CA, PL = window.ProcessLab;
        var m = new PL(), log = sec.querySelector('#shLog'), state = sec.querySelector('#shState');
        function render() {
          var s = m.snapshot();
          state.innerHTML = '<div class="readout" style="grid-template-columns:repeat(3,1fr)">' +
            '<div><span>父进程 PID ' + s.parent.pid + '</span><b class="lime">x = ' + s.parent.x + '</b></div>' +
            '<div><span>子进程</span><b class="teal">' + (s.child ? 'PID ' + s.child.pid + ' · x = ' + s.child.x : '未创建') + '</b></div>' +
            '<div><span>状态</span><b>' + (s.reaped ? '已回收' : s.child ? s.child.state + (s.parent.state === 'waiting' ? ' / 父等待' : '') : '—') + '</b></div></div>';
          log.textContent = m.events.map(function (e) {
            if (e.op === 'fork') return 'fork: 父返回 ' + e.parentReturn + '，子返回 ' + e.childReturn + '，两边 x=' + e.parentX;
            if (e.op === 'increment') return e.which + ' x++: ' + e.before + ' → ' + e.after;
            if (e.op === 'wait') return e.blocked ? 'wait: 父阻塞（子仍在运行）' : 'wait: 回收子进程 ' + e.pid + '，status=' + e.status;
            if (e.op === 'exit') return 'exit: 子进程退出' + (e.collected ? '，父进程已回收' : '，成为僵尸，等待父进程 wait');
            return JSON.stringify(e);
          }).join('\n') || '先 fork。';
        }
        function guard(fn) { try { var r = fn(); if (r) m.events.push(r); render(); } catch (e) { log.textContent = '✕ ' + e.message; } }
        sec.querySelector('#shFork').addEventListener('click', function () { guard(function () { return m.fork(); }); });
        sec.querySelector('#shChild').addEventListener('click', function () { guard(function () { return m.increment('child'); }); });
        sec.querySelector('#shParent').addEventListener('click', function () { guard(function () { return m.increment('parent'); }); });
        sec.querySelector('#shExit').addEventListener('click', function () { guard(function () { return m.exit(); }); });
        sec.querySelector('#shWait').addEventListener('click', function () { guard(function () { return m.wait(); }); });
        sec.querySelector('#shReset').addEventListener('click', function () { m = new PL(); render(); });
        render();
      }
    },
    {
      id: 'jobs', num: '8.S2', title: '作业控制：前台、后台、信号与终端',
      html: `
        <p>一个带作业控制的 shell 维护 job 列表：每个 job 有 pid、状态（BG/FG/ST）、命令行。关键操作：</p>
        <ul>
          <li><b>前台</b>：<code>fork</code> → 子进程 <code>setpgid(0,0)</code> → <code>execve</code>；父进程 <code>setpgid(pid,pid)</code>、<code>tcsetpgrp</code>，然后等待前台 job 结束。</li>
          <li><b>后台</b>：同样 fork/exec，但不把终端交给它；<code>addjob(pid, BG, cmdline)</code> 后立即返回提示符。</li>
          <li><b>SIGCHLD</b>：子进程停止/退出时内核通知父进程；handler 用 <code>waitpid(-1, &amp;status, WNOHANG | WUNTRACED)</code> 回收/标记。</li>
          <li><b>SIGINT</b>：Ctrl-C 发给前台进程组；shell 自己忽略，避免被一起终止。</li>
          <li><b>SIGTSTP</b>：Ctrl-Z 停止前台进程组；shell 把它标为 ST，并在 <code>fg</code>/<code>bg</code> 时用 <code>kill(-pgid, SIGCONT)</code> 恢复。</li>
          <li><b>fg/bg</b>：<code>fg</code> 把 job 设为前台并等待；<code>bg</code> 发送 SIGCONT 并保持后台。</li>
        </ul>
        <div class="callout warn"><div class="c-title">竞态</div><p>fork 后、addjob 前，子进程可能已经退出并投递 SIGCHLD。若 handler 先运行、job 还没加入列表，就会丢 job。常见修复：fork 前阻塞 SIGCHLD，addjob 后再解除阻塞。</p></div>
        <pre data-lang="c"><code>sigemptyset(&amp;mask);
sigaddset(&amp;mask, SIGCHLD);
sigprocmask(SIG_BLOCK, &amp;mask, NULL);
pid = fork();
if (pid == 0) { setpgid(0, 0); execve(...); }
setpgid(pid, pid);
addjob(jobs, pid, BG, cmdline);
sigprocmask(SIG_UNBLOCK, &amp;mask, NULL);</code></pre>
      `,
      init: function () { }
    },
    {
      id: 'browser', num: '8.S2b', title: '浏览器作业控制模型',
      html: `
        <p>在浏览器里实现一个 JS 版 <code>Shell</code> 的作业控制策略：<code>eval</code>、<code>waitfg</code>、<code>sigchld</code>、<code>sigint</code>、<code>sigtstp</code>、<code>jobsText</code>。模拟器提供进程/信号/终端 API，按 6 个场景检查前台等待、后台回收、Ctrl-C、Ctrl-Z、bg/fg 恢复。</p>
        <div class="task-list" id="shTasks" style="margin:10px 0"></div>
        <div class="card"><h4 id="shTaskTitle">eval 与 jobs</h4><p id="shTaskDesc"></p><p id="shTaskHint" style="font-size:11px;color:var(--mute)"></p></div>
        <div class="editor-wrap" style="min-height:360px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:12px 0">
          <pre class="editor-lines" aria-hidden="true"></pre>
          <textarea id="shCode" class="editor" spellcheck="false" style="min-height:360px" aria-label="Shell JS 实现"></textarea>
        </div>
        <div class="flex wrap gap8"><button class="btn primary sm" type="button" id="shRunAll">运行全部场景</button><button class="btn sm" type="button" id="shReset">恢复模板</button><button class="btn sm" type="button" id="shAdopt" disabled>采用浏览器得分</button></div>
        <pre id="shOut" class="console" style="min-height:120px;margin-top:10px" role="status">尚未检查。</pre>
        <div id="shReport"></div>
        <p style="font-size:10.5px;color:var(--mute)">这是浏览器 JS 模型：进程/信号是模拟的，不是真实 tsh.c 或 pthread/OS。真实作业控制与官方 trace 在 Linux 实验机中。请只运行自己的代码。</p>
      `,
      init: function (sec) {
        var CA = window.CA, SH = window.ShellHarness;
        if (!SH) { sec.querySelector('#shOut').textContent = 'ShellHarness 未载入。'; return; }
        var ed = CA.editor(sec.querySelector('#shCode'), { key: 'shell-js' });
        try { if (!localStorage.getItem('ca.code.shell-js')) ed.set(SH.starter); } catch (e) { ed.set(SH.starter); }
        var out = sec.querySelector('#shOut'), report = sec.querySelector('#shReport'), adopt = sec.querySelector('#shAdopt');
        var lastScore = 0;
        function log(t, cls) { out.textContent = t; out.className = 'console ' + (cls || ''); }
        function renderTasks() {
          var box = sec.querySelector('#shTasks'); box.innerHTML = '';
          SH.scenarios.forEach(function (t, i) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'task-item' + (i === 0 ? ' active' : '');
            var tick = document.createElement('span'); tick.className = 'tick'; tick.textContent = '✓';
            var name = document.createElement('span'); name.className = 't-name'; name.textContent = t.name;
            var pts = document.createElement('span'); pts.className = 't-pts'; pts.textContent = t.pts + ' pts';
            b.append(tick, name, pts); b.addEventListener('click', function () {
              sec.querySelectorAll('#shTasks .task-item').forEach(function (x) { x.classList.remove('active'); });
              b.classList.add('active');
              sec.querySelector('#shTaskTitle').textContent = t.name;
              sec.querySelector('#shTaskDesc').textContent = t.desc;
              sec.querySelector('#shTaskHint').textContent = '提示：' + (t.id === 'eval' ? '内建 jobs/quit；外部程序用 this.os.spawn。' : t.id === 'fg' ? 'waitfg 要等到 exited 再删除 job。' : t.id === 'bg' ? 'sigchld 只回收非 FG 的已退出 job。' : t.id === 'signals' ? 'sigint/sigtstp 找 state=FG 的 job，发给 pid。' : 'bg 设为 BG 并 SIGCONT；fg 设为 FG、SIGCONT 并 waitfg。');
            });
            box.appendChild(b);
          });
        }
        async function runAll() {
          sec.querySelector('#shRunAll').disabled = true; adopt.disabled = true; log('▶ 运行 6 个作业控制场景（约几秒）…');
          try {
            var r = await SH.runAll(ed.get());
            var lines = r.results.map(function (x) { return (x.ok ? '✓' : '✕') + ' ' + x.name + ' · ' + x.pts + ' pts · ' + x.detail; });
            log(lines.join('\n') + '\n浏览器得分 ' + r.score + ' / 100', r.score >= 60 ? 'ok' : 'err');
            report.innerHTML = '<div class="test-results">' + r.results.map(function (x) { return '<div class="' + (x.ok ? 'pass' : 'fail') + '"><span>' + x.name + '</span><span>' + (x.ok ? '✓ +' + x.pts : '✕ ' + x.detail) + '</span></div>'; }).join('') + '</div>';
            lastScore = r.score; adopt.disabled = !(lastScore > 0);
            sec.querySelectorAll('#shTasks .task-item').forEach(function (b, i) { b.classList.toggle('solved', r.results[i] && r.results[i].ok); });
          } catch (e) { log('✕ ' + e.message, 'err'); }
          finally { sec.querySelector('#shRunAll').disabled = false; }
        }
        sec.querySelector('#shRunAll').addEventListener('click', runAll);
        sec.querySelector('#shReset').addEventListener('click', function () { if (confirm('恢复模板？当前修改会丢失。')) { ed.reset(); ed.set(SH.starter); } });
        adopt.addEventListener('click', function () {
          if (!lastScore) return;
          CA.progress.lab('shelllab', { score: lastScore, solved: { browser: true } });
          CA.refreshLabScore('shelllab');
          adopt.disabled = true;
          CA.toast('已采用 Shell 浏览器得分 ' + lastScore + ' / 100（非官方）');
        });
        renderTasks();
        sec.querySelector('#shTaskDesc').textContent = SH.scenarios[0].desc;
        sec.querySelector('#shTaskHint').textContent = '提示：内建 jobs/quit；外部程序用 this.os.spawn。';
      }
    },
    {
      id: 'official', num: '8.S3', title: '官方 trace 与实验机',
      html: `
        <pre data-lang="bash"><code>cd /root/CSAPP/shlab-handout
make
make test01        # 运行学生 shell 的 trace 1
make rtest01       # 运行参考 shell 的 trace 1
# 对比输出：提示符、job 编号、进程组与状态
/run/open3d/check-shell 3   # 提交 trace 3，页面显示参考/学生原始输出
cat traces/trace03.txt      # 查看测试脚本</code></pre>
        <p>官方 trace 1–16 覆盖：内建命令、前台/后台、SIGINT、SIGTSTP、fg/bg、jobs、管道/重定向、错误处理等。分数按通过项计，退出码为零不代表输出正确。</p>
        <table>
          <tr><th>常见失败</th><th>症状</th><th>修复方向</th></tr>
          <tr><td>僵尸未回收</td><td><code>jobs</code> 里一直有 Z</td><td>SIGCHLD handler 用 WNOHANG 循环 waitpid</td></tr>
          <tr><td>Ctrl-C 杀 shell</td><td>测试提前结束</td><td>shell 忽略 SIGINT/SIGTSTP；只发给前台进程组</td></tr>
          <tr><td>fg 后终端不对</td><td>输入没回显/没信号</td><td>tcsetpgrp 把终端给前台 pgid</td></tr>
          <tr><td>竞态丢 job</td><td>偶发 jobs 为空</td><td>fork 前阻塞 SIGCHLD，addjob 后解除</td></tr>
        </table>
      `,
      init: function () { }
    }
  ],
  checklist: [
    { id: 'eval', label: 'eval 能解析内建命令与外部程序，处理空行/错误命令。' },
    { id: 'fg', label: '前台 job 正确 fork/exec、等待并回收。' },
    { id: 'bg', label: '后台 job 立即返回提示符，SIGCHLD 正确回收。' },
    { id: 'jobs', label: 'jobs 输出格式、状态与 job 编号符合规范。' },
    { id: 'sig', label: 'Ctrl-C/Ctrl-Z/fg/bg 与进程组/终端控制正确。' },
    { id: 'traces', label: '在实验机跑完 trace 1–16，保存参考/学生对比。' }
  ]
};
