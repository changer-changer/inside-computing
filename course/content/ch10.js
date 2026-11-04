CA.registerChapter('ch10', {
  summary: '程序通过系统调用和世界交换字节。本章讲文件描述符、read/write、短计数与 EINTR、RIO 缓冲、dup2 重定向，以及文件元数据。理解“描述符表—打开文件描述—vnode”这三层，才能解释重定向、共享偏移和缓冲行为。',
  objectives: [
    '能解释文件描述符、打开文件描述、vnode 的关系。',
    '能处理 read/write 的短计数与 EINTR，写出健壮的读写循环。',
    '能解释 RIO 无缓冲/带缓冲的差别与适用场景。',
    '能用 dup2 实现重定向，并说明共享偏移。',
    '能区分文件内容与元数据（stat/inode/link）。'
  ],
  sections: [
    {
      id: 'fd', num: '10.1', title: '三层结构：fd → 打开文件描述 → vnode',
      html: `
        <p>每个进程有一张文件描述符表，fd 是小整数，指向内核的“打开文件描述”（open file description）。打开文件描述保存偏移、状态标志和引用计数；它再指向 vnode（文件本身）。</p>
        <table>
          <tr><th>层</th><th>属于</th><th>共享方式</th></tr>
          <tr><td>fd 表</td><td>每个进程</td><td>fork 复制表项，指向同一打开文件描述</td></tr>
          <tr><td>打开文件描述</td><td>内核，按 open 创建</td><td>dup/fork 共享偏移与标志</td></tr>
          <tr><td>vnode/inode</td><td>内核，文件系统</td><td>不同 open 也指向同一文件</td></tr>
        </table>
        <p>标准流：0=stdin，1=stdout，2=stderr。<code>dup2(oldfd, newfd)</code> 让 newfd 指向 oldfd 的打开文件描述；如果 newfd 已打开，先关闭它。这就是 shell 的 <code>&gt; file</code> / <code>2&gt;&amp;1</code>。</p>
        <div data-widget="fd"></div>
        ${CA.quizHTML({
          id: 'ch10-q-dup', q: '同一文件先 open 一次，再 dup 出 fd 4。从 fd 3 读 2 字节后，从 fd 4 读会从哪里开始？',
          options: ['从第 3 个字节开始（共享偏移）', '从文件开头（独立偏移）', '从 fd 3 的副本开头', '随机位置'],
          answer: 0, explain: '<b>正确。</b>dup 复制的是 fd 表项，指向同一个打开文件描述；偏移共享。分别 open 两次才会各自有独立偏移。'
        })}
      `,
      init: function (sec) {
        CA.viz.stepper(sec.querySelector('[data-widget="fd"]'), {
          title: 'open / dup / read 的偏移',
          steps: [
            { label: 'open', sub: 'fd 3', html: '<pre>fd 表：3 → OFD#1 (offset=0)\n文件内容：SYSTEMS\\n</pre><p>第一次 open 创建新的打开文件描述，偏移 0。</p>' },
            { label: 'dup', sub: 'fd 4', html: '<pre>fd 3 → OFD#1 (offset=0)\nfd 4 → OFD#1（同一个！）</pre><p>dup 不复制文件内容，只复制表项；偏移共享。</p>' },
            { label: 'read 3', sub: '2 bytes', html: '<pre>read(3, buf, 2) → "SY"\nOFD#1.offset = 2\nfd 4 也看到 offset=2</pre><p>下次从 4 读，会从 S 后面的 T 开始。</p>' },
            { label: 'read 4', sub: '2 bytes', html: '<pre>read(4, buf, 2) → "ST"\nOFD#1.offset = 4</pre><p>如果分别 open 两次，两个 OFD 各有 offset=0，会各自读到 SY。</p>' },
            { label: 'close', sub: '引用计数', html: '<pre>close(3)：fd 3 删除，OFD 引用计数减一\nclose(4)：引用计数到 0，OFD 释放</pre><p>关闭一个 fd 不会影响另一个指向同一 OFD 的 fd，直到最后一个关闭。</p>' }
          ]
        });
      }
    },
    {
      id: 'rw', num: '10.2', title: 'read/write、短计数与 EINTR',
      html: `
        <p><code>read(fd, buf, n)</code> 返回实际读到的字节数，可能小于 n（管道、终端、网络、信号打断）；返回 0 表示 EOF；返回 -1 表示错误。写也可能短写。健壮代码必须循环直到写满/读到需要的数据。</p>
        <pre data-lang="c"><code>ssize_t rio_readn(int fd, void *usrbuf, size_t n) {
    size_t nleft = n;
    ssize_t nread;
    char *bufp = usrbuf;
    while (nleft &gt; 0) {
        if ((nread = read(fd, bufp, nleft)) &lt; 0) {
            if (errno == EINTR) nread = 0;  // 被信号打断，重试
            else return -1;
        } else if (nread == 0) break;       // EOF
        nleft -= nread;
        bufp += nread;
    }
    return n - nleft;
}</code></pre>
        <p><b>RIO 无缓冲</b>（rio_readn/rio_writen）适合已知长度的二进制；<b>RIO 带缓冲</b>（rio_readlineb/rio_readnb）适合文本行，减少系统调用次数，但要注意缓冲区与 fd 的绑定。</p>
        <div class="callout warn"><div class="c-title">不要假设一次 read 读完整条消息</div><p>TCP 是字节流，没有消息边界；文件/管道也可能短读。协议层要用长度字段/分隔符/关闭连接来定界，不能依赖一次 read。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'redirect', num: '10.3', title: '重定向与缓冲',
      html: `
        <p>shell 的重定向本质是 dup2：</p>
        <pre data-lang="c"><code>int fd = open("out.txt", O_WRONLY|O_CREAT|O_TRUNC, 0644);
dup2(fd, STDOUT_FILENO);   // 1 现在指向 out.txt
close(fd);                 // 原 fd 不再需要
printf("hello\\n");         // 写到 out.txt（经 stdio 缓冲）</code></pre>
        <p><code>2&gt;&amp;1</code> 的顺序很重要：先 <code>dup2(1,2)</code> 再重定向 1，stderr 仍指向旧 stdout；先重定向 1 再 <code>dup2(1,2)</code>，两者都指向文件。</p>
        <p>stdio 缓冲（全缓冲/行缓冲/无缓冲）会让输出延迟；<code>fork</code> 后子进程继承缓冲区副本，可能重复输出。调试时用 <code>fflush</code> 或 <code>setvbuf</code>，或直接 write。</p>
        <div class="callout info"><div class="c-title">文件描述符不是文件</div><p>关闭 fd 只是删除表项；只要还有别的 fd/进程指向打开文件描述，文件仍打开。删除文件（unlink）也只是删除目录项，inode 在最后一个引用关闭后才释放。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'meta', num: '10.4', title: '元数据、目录与文件系统',
      html: `
        <p><code>stat</code> 返回 inode 元数据：类型、权限、大小、link 数、时间戳、设备号。目录是“名字 → inode”的映射；<code>link/unlink</code> 增减 link 计数，<code>rename</code> 原子替换目录项。</p>
        <pre data-lang="bash"><code>stat file
ls -li          # inode 与 link 数
df -h           # 文件系统容量
readelf -l a.out # 可执行文件的段映射</code></pre>
        <p>硬链接共享 inode；符号链接是单独的文件，内容是目标路径。文件系统用页缓存把磁盘块映射到内存；<code>mmap</code> 把文件页直接映射进地址空间，读写由缺页驱动。</p>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: [],
  afterRender: function () { document.title = '第 10 章 · 系统级 I/O · 计算之境'; }
});
