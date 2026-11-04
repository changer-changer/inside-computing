CA.registerChapter('ch11', {
  summary: '网络编程把“进程间通信”扩展到不同机器：socket、TCP 字节流、HTTP 请求/响应。你要理解客户端-服务器模型、socket API、HTTP 报文格式，以及代理如何转发、缓存并并发处理多个客户端。',
  objectives: [
    '能描述 socket、bind、listen、accept、connect 的调用顺序。',
    '能解释 TCP 是字节流而非消息流，以及 HTTP 如何定界。',
    '能解析/构造 HTTP 请求与响应，处理 Host/Content-Length/Connection。',
    '能说明代理缓存与并发服务器的设计取舍。'
  ],
  sections: [
    {
      id: 'socket', num: '11.1', title: 'socket：把网络连接当成文件描述符',
      html: `
        <p>Linux 把 socket 也抽象成文件描述符：<code>read/write/close</code> 同样适用。服务器典型顺序：</p>
        <pre data-lang="c"><code>int listenfd = socket(AF_INET, SOCK_STREAM, 0);
bind(listenfd, (struct sockaddr *)&amp;addr, sizeof addr);
listen(listenfd, 1024);
while (1) {
    int connfd = accept(listenfd, NULL, NULL);
    // 处理 connfd：read 请求，write 响应
    close(connfd);
}</code></pre>
        <p>客户端：<code>socket</code> → <code>connect</code> → <code>read/write</code>。地址用 <code>getaddrinfo</code> 解析，避免手写 IPv4/IPv6 结构。连接建立后，双方看到的是双向字节流。</p>
        <div class="callout info"><div class="c-title">端口与连接</div><p>服务器 bind 到知名端口（HTTP 80），accept 返回的是“已连接”的新 fd；监听 fd 继续等待下一个连接。一个服务器可以同时有多个 connfd。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'http', num: '11.2', title: 'HTTP：在字节流上定义消息',
      html: `
        <p>TCP 不保留消息边界；HTTP 用请求行/头部/空行/正文来定界。一个最简单的请求：</p>
        <pre data-lang="text"><code>GET /index.html HTTP/1.1\r\n
Host: example.com\r\n
Connection: close\r\n
\r\n</code></pre>
        <p>响应：</p>
        <pre data-lang="text"><code>HTTP/1.1 200 OK\r\n
Content-Type: text/html\r\n
Content-Length: 1234\r\n
\r\n
&lt;html&gt;...</code></pre>
        <p>正文长度由 <code>Content-Length</code> 或 <code>Transfer-Encoding: chunked</code> 或连接关闭决定。代理必须读完整响应再转发/缓存，不能假设一次 read 拿到全部。</p>
        <div data-widget="http"></div>
        ${CA.quizHTML({
          id: 'ch11-q-stream', q: '为什么不能假设一次 <code>read</code> 就能读到完整 HTTP 请求？',
          options: ['TCP 是字节流，数据可能分多段到达', 'HTTP 请求最大 1 字节', 'read 只能读文本', '服务器总是分块发送'],
          answer: 0, explain: '<b>正确。</b>TCP 只保证字节顺序，不保证一次 read 的边界；必须循环读到头部结束，再按 Content-Length/chunked 读正文。'
        })}
      `,
      init: function (sec) {
        CA.viz.stepper(sec.querySelector('[data-widget="http"]'), {
          title: '一次 HTTP 请求的旅程',
          steps: [
            { label: 'DNS', sub: '解析', html: '<pre>问：example.com 的地址？\n答：192.0.2.10\n（或使用本地缓存）</pre><p>真实 DNS 可能多级递归；浏览器/系统有缓存。</p>' },
            { label: 'connect', sub: 'TCP', html: '<pre>connect(192.0.2.10:80)\n三次握手：SYN → SYN/ACK → ACK</pre><p>连接建立后，双方可以读写字节流。</p>' },
            { label: 'request', sub: '发送', html: '<pre>GET / HTTP/1.1\nHost: example.com\nConnection: close\n\n</pre><p>请求头以空行结束；GET 通常没有正文。</p>' },
            { label: 'response', sub: '接收', html: '<pre>HTTP/1.1 200 OK\nContent-Length: 16\n\nHello, systems!</pre><p>代理/客户端按 Content-Length 读正文；没有长度则读到关闭。</p>' },
            { label: 'close', sub: '连接', html: '<pre>Connection: close\n→ 双方关闭连接\n（HTTP/1.1 默认 keep-alive，可复用）</pre><p>短连接简单；长连接减少握手开销，但要正确管理并发/超时。</p>' }
          ]
        });
      }
    },
    {
      id: 'proxy', num: '11.3', title: '代理：转发、缓存、并发',
      html: `
        <p>代理同时是服务器和客户端：接受客户端连接，解析请求，向源服务器发起新连接，转发响应。它要处理：</p>
        <ul>
          <li><b>请求行/头部</b>：方法、URI、版本；Host 用于虚拟主机；Connection 决定是否复用。</li>
          <li><b>缓存</b>：按 host+path 存完整响应；命中直接返回；未命中转发并缓存。注意不要缓存非 GET/不完整/敏感响应。</li>
          <li><b>并发</b>：每连接一线程/线程池/事件驱动；共享缓存要加锁，避免读到半写入对象。</li>
          <li><b>健壮性</b>：超长/截断/非法请求、SIGPIPE、超时、内存上限。</li>
        </ul>
        <p>缓存对象要等响应完整（Content-Length 满足或 chunked 结束）后再发布；并发命中同一 URI 时，可以用“正在填充”标记避免重复回源（thundering herd）。</p>
        <div class="callout warn"><div class="c-title">代理不是透明转发</div><p>它要改/加 Host、Connection 等头部，处理绝对 URI（<code>GET http://host/path</code>），并防止请求走私/头部注入。官方 Proxy Lab 的测试会覆盖这些边界。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'concurrent', num: '11.4', title: '并发服务器：线程、进程与事件',
      html: `
        <table>
          <tr><th>模型</th><th>优点</th><th>代价</th></tr>
          <tr><td>每连接一进程</td><td>隔离好，崩溃不影响其他</td><td>fork 开销大，进程间共享难</td></tr>
          <tr><td>每连接一线程</td><td>共享地址空间，编程直接</td><td>线程数随连接增长，需同步</td></tr>
          <tr><td>线程池</td><td>限制并发，复用线程</td><td>队列/背压/公平性</td></tr>
          <tr><td>I/O 多路复用（select/epoll）</td><td>单线程处理大量连接</td><td>事件驱动状态机复杂，阻塞调用会卡住</td></tr>
        </table>
        <p>本章的 Proxy Lab 通常用线程；第 12 章会深入竞争、锁与条件变量。无论哪种模型，都要避免在持锁时做阻塞 I/O，并为每个连接维护独立缓冲区。</p>
        <div class="callout lab"><div class="c-title">开始实验</div><p>Proxy Lab 页面展示 HTTP 流程与代理缓存设计；真实并发与官方 driver 在实验机中运行。</p><p><a class="btn primary sm" href="../labs/lab.html?lab=proxylab">进入 Proxy Lab →</a></p></div>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['proxylab'],
  afterRender: function () { document.title = '第 11 章 · 网络编程 · 计算之境'; }
});
