/* Shell Lab 浏览器 JS 模型：模拟进程/信号/终端，学生实现 Shell 的作业控制策略。
   不是官方 C tsh；官方 sdriver.pl trace 在 Linux 实验机中。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShellHarness = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var starter = `class Shell {
  constructor(os) {
    this.os = os;
    this.jobs = [];
    this.nextJid = 1;
    this.fg = null;
  }

  addJob(pid, state, cmd) {
    /* TODO */
  }

  deleteJob(pid) {
    /* TODO */
  }

  async eval(line) {
    /* TODO: 内建 quit/jobs/bg/fg；外部程序用 this.os.spawn(cmd)，
       前台用 await this.waitfg(pid)。 */
  }

  async waitfg(pid) {
    /* TODO: 等待进程退出/停止；前台退出后删除 job。 */
  }

  sigchld() {
    /* TODO: 回收已退出/停止的后台 job。 */
  }

  sigint() {
    /* TODO: 把 SIGINT 发给前台进程组。 */
  }

  sigtstp() {
    /* TODO: 把 SIGTSTP 发给前台进程组。 */
  }

  jobsText() {
    /* TODO: 返回 [jid] (pid) 状态 命令。 */
    return '';
  }
}
`;
  var SIGINT = 'SIGINT', SIGTSTP = 'SIGTSTP', SIGCONT = 'SIGCONT';

  function OS() {
    this.procs = new Map();
    this.waiters = new Map();
    this.timers = new Map();
    this.nextPid = 100;
    this.shell = null;
    this.output = '';
  }
  OS.prototype.get = function (pid) { return this.procs.get(pid); };
  OS.prototype._notify = function (pid) {
    var list = this.waiters.get(pid) || [];
    this.waiters.delete(pid);
    list.forEach(function (r) { r(); });
    if (this.shell) { try { this.shell.sigchld(); } catch (e) { } }
  };
  OS.prototype.spawn = function (cmd) {
    var self = this, pid = this.nextPid++, parts = cmd.trim().split(/\s+/);
    var ms = 120;
    if (parts[0] === 'sleep') ms = Math.max(20, Math.round(parseFloat(parts[1] || '0.2') * 1000));
    else if (parts[0] === 'spin') ms = 250;
    else if (parts[0] === 'echo') { ms = 5; self.output += parts.slice(1).join(' ') + '\n'; }
    var p = { pid: pid, pgid: pid, cmd: cmd, state: 'running', remaining: ms, start: Date.now() };
    this.procs.set(pid, p);
    if (ms > 0) this.timers.set(pid, setTimeout(function () { self._exit(pid); }, ms));
    return p;
  };
  OS.prototype._exit = function (pid) {
    var p = this.procs.get(pid); if (!p) return;
    if (this.timers.has(pid)) { clearTimeout(this.timers.get(pid)); this.timers.delete(pid); }
    p.state = 'exited';
    this._notify(pid);
  };
  OS.prototype.waitPid = function (pid) {
    var self = this, p = this.procs.get(pid);
    if (!p) return Promise.resolve(null);
    if (p.state !== 'running') return Promise.resolve(p);
    return new Promise(function (resolve) {
      if (!self.waiters.has(pid)) self.waiters.set(pid, []);
      self.waiters.get(pid).push(function () { resolve(self.procs.get(pid)); });
    });
  };
  OS.prototype.kill = function (pid, sig) {
    var p = this.procs.get(pid); if (!p) return;
    if (sig === SIGINT) { this._exit(pid); return; }
    if (sig === SIGTSTP && p.state === 'running') {
      if (this.timers.has(pid)) { clearTimeout(this.timers.get(pid)); this.timers.delete(pid); }
      p.remaining = Math.max(60, p.remaining - (Date.now() - p.start));
      p.state = 'stopped';
      this._notify(pid);
      return;
    }
    if (sig === SIGCONT && p.state === 'stopped') {
      p.state = 'running'; p.start = Date.now();
      var self = this;
      this.timers.set(pid, setTimeout(function () { self._exit(pid); }, p.remaining));
      this._notify(pid);
    }
  };
  OS.prototype.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var scenarios = [
    {
      id: 'eval', name: 'eval 与 jobs', pts: 15, desc: 'echo 前台完成；jobs 输出包含后台进程。',
      run: async function (S) {
        var os = new OS(), sh = new S(os); os.shell = sh;
        await sh.eval('echo hi');
        await sh.eval('sleep 0.25 &');
        var text = sh.jobsText();
        await os.sleep(350);
        return { ok: sh.jobs.length === 0 && /running|Running|BG|后台/.test(text), detail: 'jobsText=' + JSON.stringify(text) };
      }
    },
    {
      id: 'fg', name: '前台等待', pts: 20, desc: '前台 sleep 完成后 job 被回收（不残留僵尸/后台项）。',
      run: async function (S) {
        var os = new OS(), sh = new S(os); os.shell = sh;
        var t0 = Date.now(); await sh.eval('sleep 0.15'); var dt = Date.now() - t0;
        return { ok: sh.jobs.length === 0 && dt >= 100, detail: 'jobs=' + sh.jobs.length + ' elapsed=' + dt + 'ms' };
      }
    },
    {
      id: 'bg', name: '后台与 SIGCHLD', pts: 20, desc: '后台 sleep 立即返回；退出后由 SIGCHLD 回收。',
      run: async function (S) {
        var os = new OS(), sh = new S(os); os.shell = sh;
        await sh.eval('sleep 0.2 &');
        var immediate = sh.jobs.length;
        await os.sleep(350);
        return { ok: immediate === 1 && sh.jobs.length === 0, detail: 'immediateJobs=' + immediate + ' after=' + sh.jobs.length };
      }
    },
    {
      id: 'jobs', name: 'jobs 输出', pts: 15, desc: 'jobs 文本包含作业号、pid 与状态。',
      run: async function (S) {
        var os = new OS(), sh = new S(os); os.shell = sh;
        await sh.eval('sleep 0.25 &');
        var t = sh.jobsText();
        await os.sleep(350);
        return { ok: /%?1/.test(t) && /\d{2,}/.test(t) && /running|Running|BG|后台/.test(t), detail: JSON.stringify(t) };
      }
    },
    {
      id: 'signals', name: 'SIGINT / SIGTSTP', pts: 20, desc: 'Ctrl-C 终止前台；Ctrl-Z 停止前台并保留为 ST。',
      run: async function (S) {
        var os = new OS(), sh = new S(os); os.shell = sh;
        var p = sh.eval('sleep 0.5');
        await os.sleep(80); sh.sigint(); await p;
        var afterInt = sh.jobs.length;
        var q = sh.eval('sleep 0.5');
        await os.sleep(80); sh.sigtstp(); await q;
        var stopped = sh.jobs.length === 1 && /ST|Stopped|stopped/.test(sh.jobsText());
        var jid = sh.jobs[0] ? sh.jobs[0].jid : 1;
        var r = sh.eval('fg %' + jid); await os.sleep(50); sh.sigint(); await r;
        await os.sleep(200);
        return { ok: afterInt === 0 && stopped && sh.jobs.length === 0, detail: 'afterInt=' + afterInt + ' stopped=' + stopped + ' final=' + sh.jobs.length + ' text=' + JSON.stringify(sh.jobsText()) };
      }
    },
    {
      id: 'resume', name: 'bg / fg 恢复', pts: 10, desc: 'Ctrl-Z 后用 bg 恢复，最终由 SIGCHLD 回收。',
      run: async function (S) {
        var os = new OS(), sh = new S(os); os.shell = sh;
        var p = sh.eval('sleep 0.4'); await os.sleep(60); sh.sigtstp(); await p;
        var st = sh.jobs.length === 1;
        await sh.eval('bg %1');
        await os.sleep(500);
        return { ok: st && sh.jobs.length === 0, detail: 'stopped=' + st + ' final=' + sh.jobs.length };
      }
    }
  ];

  function loadShell(code) {
    if (typeof code !== 'string' || code.length > 60000) throw new Error('源码为空或超过 60000 字符');
    var factory;
    try { factory = new Function('"use strict";' + code + '\nreturn Shell;'); }
    catch (e) { throw new Error('语法错误：' + e.message); }
    var S = factory();
    if (typeof S !== 'function') throw new Error('代码必须定义 class Shell');
    return S;
  }
  async function runTask(code, taskId) {
    var s = scenarios.find(function (x) { return x.id === taskId; }); if (!s) throw new Error('未知任务');
    var S = loadShell(code);
    var r = await s.run(S);
    return { id: s.id, name: s.name, pts: s.pts, ok: !!r.ok, detail: r.detail || '' };
  }
  async function runAll(code) {
    var results = [];
    for (var i = 0; i < scenarios.length; i++) {
      try { results.push(await runTask(code, scenarios[i].id)); }
      catch (e) { results.push({ id: scenarios[i].id, name: scenarios[i].name, pts: scenarios[i].pts, ok: false, detail: e.message }); }
    }
    return { results: results, score: results.reduce(function (a, r) { return a + (r.ok ? r.pts : 0); }, 0) };
  }
  return { starter: starter, scenarios: scenarios, runTask: runTask, runAll: runAll, OS: OS, signals: { SIGINT: SIGINT, SIGTSTP: SIGTSTP, SIGCONT: SIGCONT } };
});
