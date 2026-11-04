/* Proxy Lab 浏览器 JS 模型：学生实现 Proxy.handle，模拟源服务器、缓存与并发请求。
   不是官方 C proxy；官方评分在实验机中。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProxyHarness = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var starter = `class Proxy {
  constructor(os) {
    this.os = os;
    this.cache = new Map();
    this.limit = os.cacheLimit || 8;
  }

  async handle(req) {
    /* 目前只是转发：没有缓存、没有方法检查。
       试着按 host+path 缓存 200 响应，并实现 LRU。 */
    return await this.os.fetch(req);
  }
}
`;
  var resources = {
    '/': 'Hello from the origin!\n',
    '/index': 'Index page\n',
    '/about': 'About systems.\n',
    '/slow': 'Slow but correct.\n'
  };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function Origin() {
    this.calls = 0;
    this.last = null;
    this.cacheLimit = 8;
  }
  Origin.prototype.fetch = async function (req) {
    this.calls++;
    this.last = req;
    await delay(2);
    if (!req || req.method !== 'GET') return { status: 405, headers: { 'Content-Type': 'text/plain', 'Content-Length': 10 }, body: 'Method Not\n' };
    var body = Object.prototype.hasOwnProperty.call(resources, req.path) ? resources[req.path] : null;
    if (body == null) return { status: 404, headers: { 'Content-Type': 'text/plain', 'Content-Length': 10 }, body: 'Not Found\n' };
    return { status: 200, headers: { 'Content-Type': 'text/plain', 'Content-Length': body.length, 'Connection': 'close' }, body: body };
  };
  function makeReq(path, extra) {
    return Object.assign({ method: 'GET', path: path, headers: { host: 'example.com', connection: 'close' } }, extra || {});
  }
  function clone(r) { return { status: r.status, headers: Object.assign({}, r.headers), body: r.body }; }
  function loadProxy(code) {
    if (typeof code !== 'string' || code.length > 60000) throw new Error('源码为空或超过 60000 字符');
    var factory;
    try { factory = new Function('"use strict";' + code + '\nreturn Proxy;'); }
    catch (e) { throw new Error('语法错误：' + e.message); }
    var P = factory();
    if (typeof P !== 'function') throw new Error('代码必须定义 class Proxy');
    return P;
  }
  function status(r) { return r && typeof r.status === 'number' ? r.status : null; }
  function bodyOf(r) { return r && typeof r.body === 'string' ? r.body : ''; }

  var TASKS = [
    {
      id: 'basic', name: '基本转发', pts: 30, desc: 'GET / 返回 200 与源站正文；请求带 Host。',
      hint: '用 req.path 与 req.headers 构造源站请求，返回 os.fetch 的结果。',
      run: async function (P) {
        var os = new Origin(), p = new P(os);
        var r = await p.handle(makeReq('/'));
        var ok = status(r) === 200 && bodyOf(r).indexOf('Hello from the origin') >= 0 && os.calls === 1 && os.last && os.last.headers && os.last.headers.host === 'example.com';
        return { ok: ok, detail: 'status=' + status(r) + ' originCalls=' + os.calls + ' host=' + (os.last && os.last.headers && os.last.headers.host) };
      }
    },
    {
      id: 'missing', name: '404 透传', pts: 15, desc: 'GET /missing 返回 404，而不是崩溃或 200。',
      hint: '把源站状态码/正文原样返回。',
      run: async function (P) {
        var os = new Origin(), p = new P(os);
        var r = await p.handle(makeReq('/missing'));
        return { ok: status(r) === 404 && bodyOf(r).indexOf('Not Found') >= 0, detail: 'status=' + status(r) };
      }
    },
    {
      id: 'cache', name: '对象缓存', pts: 30, desc: '连续两次 GET /，源站只应被请求一次，两次响应一致。',
      hint: '按 host+path 缓存 200 响应；第二次直接返回缓存对象。',
      run: async function (P) {
        var os = new Origin(), p = new P(os);
        var a = await p.handle(makeReq('/'));
        var b = await p.handle(makeReq('/'));
        var ok = status(a) === 200 && status(b) === 200 && bodyOf(a) === bodyOf(b) && os.calls === 1;
        return { ok: ok, detail: 'status=' + status(a) + '/' + status(b) + ' originCalls=' + os.calls + '（期望 1）' };
      }
    },
    {
      id: 'lru', name: 'LRU 淘汰', pts: 15, desc: 'cacheLimit=2 时，依次取 /、/about、/index，再取 / 应回源（A 已被淘汰）。',
      hint: '维护访问顺序；超过 os.cacheLimit 时淘汰最久未使用的对象。',
      run: async function (P) {
        var os = new Origin(); os.cacheLimit = 2; var p = new P(os);
        await p.handle(makeReq('/')); await p.handle(makeReq('/about')); await p.handle(makeReq('/index'));
        await p.handle(makeReq('/index')); // 命中：不应回源
        var r = await p.handle(makeReq('/')); // A 已被淘汰：应回源
        var ok = status(r) === 200 && bodyOf(r).indexOf('Hello from the origin') >= 0 && os.calls === 4;
        return { ok: ok, detail: 'originCalls=' + os.calls + '（LRU 期望 4：A/B/C 三次回源，C 命中，A 淘汰后回源；无缓存会得到 5）' };
      }
    },
    {
      id: 'robust', name: '健壮性', pts: 10, desc: 'POST 请求应返回 400/501，且不抛异常。',
      hint: '在转发前检查 req.method；非 GET 直接返回错误。',
      run: async function (P) {
        var os = new Origin(), p = new P(os);
        try {
          var r = await p.handle(makeReq('/x', { method: 'POST' }));
          var s = status(r);
          return { ok: s === 400 || s === 501, detail: 'status=' + s };
        } catch (e) { return { ok: false, detail: '抛出异常：' + e.message }; }
      }
    }
  ];

  async function runTask(code, taskId) {
    var task = TASKS.find(function (t) { return t.id === taskId; });
    if (!task) throw new Error('未知任务');
    var P = loadProxy(code);
    var r = await task.run(P);
    return { id: task.id, name: task.name, pts: task.pts, ok: !!r.ok, detail: r.detail || '' };
  }
  async function runAll(code) {
    var results = [];
    for (var i = 0; i < TASKS.length; i++) {
      try { results.push(await runTask(code, TASKS[i].id)); }
      catch (e) { results.push({ id: TASKS[i].id, name: TASKS[i].name, pts: TASKS[i].pts, ok: false, detail: e.message }); }
    }
    var score = results.reduce(function (a, r) { return a + (r.ok ? r.pts : 0); }, 0);
    return { results: results, score: score };
  }

  return { starter: starter, TASKS: TASKS, runTask: runTask, runAll: runAll, Origin: Origin };
});
