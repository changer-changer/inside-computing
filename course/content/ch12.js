CA.registerChapter('ch12', {
  summary: '并发让多个执行流同时推进：进程、线程或 I/O 多路复用。它带来性能与响应性，也带来竞争、死锁与不确定性。本章讲线程、临界区、互斥锁、信号量、条件变量与线程安全，最后把并发放回 Proxy Lab 的服务器场景。',
  objectives: [
    '能区分并发与并行，以及进程/线程/事件驱动三种模型。',
    '能构造竞争条件并解释为什么“看起来对”的代码会丢更新。',
    '能用互斥锁/信号量/条件变量保护共享数据与同步。',
    '能识别死锁、锁顺序、线程安全与可重入问题。',
    '能解释有界缓冲区/生产者—消费者与代理并发的设计。'
  ],
  sections: [
    {
      id: 'models', num: '12.1', title: '并发模型：进程、线程、事件',
      html: `
        <p><b>并发</b>是多个任务在时间上重叠；<b>并行</b>是它们真的同时运行（多核）。并发的目的可能是吞吐（服务器）、响应性（UI）或结构清晰（流水线）。</p>
        <table>
          <tr><th>模型</th><th>隔离/共享</th><th>典型开销</th></tr>
          <tr><td>进程</td><td>独立地址空间，显式 IPC/共享内存</td><td>fork/切换较重</td></tr>
          <tr><td>线程</td><td>共享地址空间，独立栈/寄存器</td><td>创建/切换较轻，需同步</td></tr>
          <tr><td>I/O 多路复用</td><td>单线程事件循环，非阻塞 fd</td><td>状态机复杂，不能阻塞</td></tr>
        </table>
        <p>线程共享全局变量、堆和文件描述符；每个线程有自己的栈、寄存器、线程 ID。共享是性能来源，也是 bug 来源。</p>
        <div class="callout info"><div class="c-title">“并发”不等于“更快”</div><p>如果任务受同一把锁/同一内存带宽限制，增加线程可能更慢；上下文切换、缓存抖动、锁竞争都会吃掉收益。要测量。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'race', num: '12.2', title: '竞争条件：一条 C 语句不是原子操作',
      html: `
        <p><code>counter++</code> 在机器层通常是“读—加—写”三步。两个线程交错执行时，可能都读到旧值，最后只加了一次：</p>
        <div data-widget="race"></div>
        <p>竞争条件（race condition）指结果依赖不可控的调度顺序。不是“概率很低”就可以忽略；服务器在高并发下会稳定触发。</p>
        <p>临界区是访问共享数据的代码段；要保证互斥（mutual exclusion）。临界区越短越好，但必须覆盖所有共享访问，包括读。</p>
        ${CA.quizHTML({
          id: 'ch12-q-race', q: '两个线程各执行一次 <code>counter++</code>，初始为 0。下面哪个结果不可能？',
          options: ['3', '1', '2', '取决于交错'],
          answer: 0, explain: '<b>正确。</b>每次 ++ 只加 1，最多 2；交错可能丢更新得到 1。3 不可能（除非还有其他写）。'
        })}
      `,
      init: function (sec) {
        CA.viz.stepper(sec.querySelector('[data-widget="race"]'), {
          title: '两个线程，一次丢失的更新',
          steps: [
            { label: '初始', sub: 'counter=0', html: '<pre>counter = 0\n线程 A：load → add → store\n线程 B：load → add → store</pre><p>每个线程都要读、加、写。</p>' },
            { label: 'A 读', sub: 'A.local=0', html: '<pre>A: load counter → A.local=0\nB: 尚未运行\ncounter 仍为 0</pre><p>A 把旧值放进寄存器/局部变量。</p>' },
            { label: 'B 读', sub: 'B.local=0', html: '<pre>B: load counter → B.local=0\nA 还没 store\ncounter 仍为 0</pre><p>两个线程都读到了 0，问题已经埋下。</p>' },
            { label: 'A 写', sub: 'counter=1', html: '<pre>A: A.local++ → 1\nA: store counter ← 1\ncounter = 1</pre><p>A 完成一次加一。</p>' },
            { label: 'B 写', sub: 'counter=1', html: '<pre>B: B.local++ → 1\nB: store counter ← 1\ncounter = 1（丢失一次更新）</pre><p>B 用旧值覆盖了 A 的结果。加锁可以让读—加—写成为一个临界区，或使用原子指令。</p>' }
          ]
        });
      }
    },
    {
      id: 'sync', num: '12.3', title: '锁、信号量、条件变量',
      html: `
        <p><b>互斥锁（mutex）</b>：<code>lock</code> 获取，<code>unlock</code> 释放；同一时刻只有一个线程在临界区。POSIX 提供 <code>pthread_mutex_lock/unlock</code>。</p>
        <pre data-lang="c"><code>pthread_mutex_lock(&amp;mutex);
counter++;              // 临界区
pthread_mutex_unlock(&amp;mutex);</code></pre>
        <p><b>信号量</b>：计数器 + 等待队列；<code>P</code>（wait）减一/阻塞，<code>V</code>（post）加一/唤醒。二值信号量可当锁；计数信号量可控制资源数量/有界缓冲区槽位。</p>
        <p><b>条件变量</b>：让线程在某个条件不满足时等待，另一个线程改变条件后广播/通知。必须与互斥锁配合，并在循环中检查条件（防虚假唤醒）：</p>
        <pre data-lang="c"><code>pthread_mutex_lock(&amp;mutex);
while (!ready) pthread_cond_wait(&amp;cond, &amp;mutex);
// 使用共享数据
pthread_mutex_unlock(&amp;mutex);

// 另一线程
pthread_mutex_lock(&amp;mutex);
ready = 1;
pthread_cond_signal(&amp;cond);
pthread_mutex_unlock(&amp;mutex);</code></pre>
        <div class="callout info"><div class="c-title">有界缓冲区</div><p>生产者等待“空槽”，消费者等待“物品”；用两个信号量/条件变量 + 一把锁。顺序错误会死锁（先拿锁再等条件，或 wait 前没锁）。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'safety', num: '12.4', title: '线程安全、死锁与可重入',
      html: `
        <p>一个函数是线程安全的，如果多个线程并发调用时不需要额外同步也能正确。共享全局/静态变量、返回静态缓冲区、懒初始化都是常见风险。</p>
        <ul>
          <li><b>死锁</b>：两个线程各持一把锁并等待对方；用固定锁顺序、超时或减少锁粒度避免。</li>
          <li><b>锁顺序反转</b>：A 先锁 1 再锁 2，B 先锁 2 再锁 1；统一顺序。</li>
          <li><b>饥饿</b>：某线程长期拿不到锁/CPU；公平锁/调度策略。</li>
          <li><b>伪共享</b>：不同线程写同一缓存行的不同变量，导致缓存行来回弹；填充/对齐。</li>
          <li><b>可重入</b>：函数在持有锁时被同一线程再次调用会死锁（非递归锁）；信号 handler 中只能调用 async-signal-safe 函数。</li>
        </ul>
        <div class="callout warn"><div class="c-title">不要用“加更多锁”解决并发</div><p>锁越多，死锁/竞争/开销越大。先缩小共享状态，再用最少的锁保护；能不可变/线程局部就避免共享。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'lab', num: '12.5', title: '把并发放回服务器',
      html: `
        <p>Proxy Lab 的并发测试会同时发起多个客户端请求。你需要保证：每个连接独立、缓存线程安全、不持有锁做阻塞 I/O、正确处理 SIGPIPE/超时。第 12 章的概念在这里变成可观察的 bug。</p>
        <div class="callout lab"><div class="c-title">开始实验</div><p>并发页面提供线程交错/竞争/锁的模型；真实 pthread 与官方并发测试在 Linux 实验机中运行。</p><p><a class="btn primary sm" href="../labs/lab.html?lab=proxylab">进入 Proxy Lab →</a> <a class="btn sm" href="../labs/lab.html?lab=shelllab">Shell Lab →</a></p></div>
        <p>调试并发 bug：先复现（固定种子/压力测试），再缩小临界区，最后用工具（helgrind/tsan）验证。不要靠“多跑几次没崩”判断正确。</p>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['proxylab'],
  afterRender: function () { document.title = '第 12 章 · 并发编程 · 计算之境'; }
});
