CA.registerChapter('ch08', {
  summary: '程序不是一条直线：中断、异常、系统调用、进程切换和信号会随时改变控制流。本章讲异常表、进程上下文、fork/exec/wait、信号与作业控制，以及 setjmp/longjmp 的非本地跳转。最后进入 Shell Lab，亲手实现一个带作业控制的 shell。',
  objectives: [
    '能区分中断、故障、陷阱与终止，并说明异常表/向量。',
    '能解释 fork、execve、waitpid 的语义与进程状态。',
    '能解释信号的发送、阻塞、递送与处理，以及 EINTR。',
    '能说明作业控制中进程组、前台终端与 SIGTTIN/SIGTTOU。',
    '能用 setjmp/longjmp 跳出深层调用栈，并知道它的风险。'
  ],
  sections: [
    {
      id: 'exception', num: '8.1', title: '异常：控制流被硬件/内核接管',
      html: `
        <p>异常是 CPU 在指令执行过程中检测到的事件，它会让控制流跳转到内核的异常处理程序，处理完再返回（或终止）。</p>
        <table>
          <tr><th>类别</th><th>例子</th><th>返回行为</th></tr>
          <tr><td>中断（异步）</td><td>定时器、I/O 完成、Ctrl-C</td><td>处理完返回下一条指令</td></tr>
          <tr><td>故障（同步）</td><td>缺页、除零、非法指令</td><td>可能修复并重试当前指令，或终止</td></tr>
          <tr><td>陷阱（同步）</td><td>系统调用、断点</td><td>返回下一条指令</td></tr>
          <tr><td>终止</td><td>致命错误</td><td>不返回，终止进程</td></tr>
        </table>
        <p>内核启动时建立异常表：每个异常号对应一个处理程序地址。发生异常时，CPU 保存部分上下文、切换到内核态、跳转到表中对应项。系统调用通常用 <code>syscall</code> 指令触发陷阱。</p>
        <div class="callout info"><div class="c-title">用户态/内核态</div><p>用户程序不能直接执行特权指令或访问内核内存；系统调用是受控入口。异常/中断让 CPU 从用户态切到内核态，内核决定是修复、调度还是终止。</p></div>
      `,
      init: function () { }
    },
    {
      id: 'process', num: '8.2', title: '进程：fork、exec、wait',
      html: `
        <p>进程是“正在运行的程序实例”，拥有独立的虚拟地址空间、文件描述符表、寄存器上下文和信号状态。关键系统调用：</p>
        <ul>
          <li><code>fork()</code>：复制当前进程；父返回子 pid，子返回 0。地址空间写时复制，fd 表复制。</li>
          <li><code>execve(path, argv, envp)</code>：用新程序替换当前进程的代码/数据/栈；成功不返回，失败返回 -1。</li>
          <li><code>waitpid(pid, &amp;status, options)</code>：等待子进程状态变化并回收；<code>WNOHANG</code> 非阻塞，<code>WUNTRACED</code> 也报告停止。</li>
          <li><code>exit(status)</code>：终止进程，变成僵尸直到父进程 wait。</li>
        </ul>
        <div data-widget="fork"></div>
        <p>僵尸（zombie）不是“还在运行”，而是“已退出但父进程还没回收”。孤儿（orphan）是父进程先退出，被 init/systemd 收养。shell 必须及时回收，否则 job 表/进程表会泄漏。</p>
        ${CA.quizHTML({
          id: 'ch08-q-fork', q: 'fork 后，父进程和子进程的 <code>x</code> 初始值相同。子进程执行 <code>x++</code> 后，父进程的 x 会变吗？',
          options: ['不会，地址空间独立（写时复制）', '会，因为共享同一份物理内存', '只有 x 是全局变量时才会', '取决于 CPU 核心数'],
          answer: 0, explain: '<b>正确。</b>fork 复制地址空间；写时复制让物理页在写入时才分离，父子的逻辑地址空间互不影响。'
        })}
      `,
      init: function (sec) {
        CA.viz.stepper(sec.querySelector('[data-widget="fork"]'), {
          title: 'fork → exec → wait 的时间线',
          steps: [
            { label: 'shell', sub: '父进程', html: '<pre>shell (pid 100)\n读取命令 "ls -l"\n准备 fork</pre><p>shell 先解析命令行，然后创建子进程执行外部程序。</p>' },
            { label: 'fork', sub: '两个进程', html: '<pre>父 pid=100：fork() 返回 101\n子 pid=101：fork() 返回 0\n两边拥有相同的地址空间副本</pre><p>子进程通常立刻 exec；父进程继续执行 else 分支。</p>' },
            { label: 'exec', sub: '替换映像', html: '<pre>子 pid=101：execve("/bin/ls", argv, envp)\n代码/数据/栈被 /bin/ls 替换\n成功不返回</pre><p>exec 保留 pid、fd、进程组等，但替换用户空间内容。</p>' },
            { label: 'wait', sub: '父阻塞', html: '<pre>父 pid=100：waitpid(101, &amp;status, 0)\n父进入阻塞，直到子状态变化\nCPU 可调度其他进程</pre><p>前台 shell 等待前台 job；后台 shell 不阻塞。</p>' },
            { label: 'exit', sub: '回收', html: '<pre>子 pid=101：exit(0) → 僵尸\n父 waitpid 返回，读取 status\n子进程被回收</pre><p>若父不 wait，僵尸会保留退出状态，占用进程表项。</p>' }
          ]
        });
      }
    },
    {
      id: 'signal', num: '8.3', title: '信号：异步通知与作业控制',
      html: `
        <p>信号是内核/进程发给进程的“软件中断”。常见：SIGINT（Ctrl-C）、SIGTSTP（Ctrl-Z）、SIGCHLD（子进程状态变化）、SIGKILL（不可捕获）、SIGSEGV（段错误）、SIGPIPE（写已关闭管道）。</p>
        <p>信号的生命周期：产生 → 挂起（pending）→ 递送（deliver）→ 处理（默认/忽略/自定义 handler）。信号可能被阻塞（blocked），阻塞期间保持 pending；<code>sigprocmask</code> 控制阻塞集，<code>sigaction</code> 安装 handler。</p>
        <pre data-lang="c"><code>void handler(int sig) {           // 异步信号安全：只调用 async-signal-safe 函数
    int olderrno = errno;
    pid_t pid;
    while ((pid = waitpid(-1, NULL, WNOHANG)) &gt; 0)
        deletejob(jobs, pid);
    errno = olderrno;
}
signal(SIGCHLD, handler);</code></pre>
        <p>作业控制依赖进程组：shell 把前台 job 放进一个进程组，<code>tcsetpgrp</code> 把终端交给它；Ctrl-C 发给前台进程组。后台进程读终端会收到 SIGTTIN，写会收到 SIGTTOU（默认停止）。</p>
        <div class="callout warn"><div class="c-title">竞态与 EINTR</div><p>fork 后、addjob 前，SIGCHLD 可能已到达；要在 fork 前阻塞 SIGCHLD。慢系统调用（read/wait）被信号打断会返回 EINTR，必须重启或处理。</p></div>
        ${CA.quizHTML({
          id: 'ch08-q-sig', q: '为什么 shell 要忽略 SIGINT/SIGTSTP，而不是让它们杀死自己？',
          options: ['Ctrl-C/Ctrl-Z 应只作用于前台 job，shell 要继续运行', 'shell 不能捕获信号', 'SIGINT 会终止内核', '忽略信号可以提升性能'],
          answer: 0, explain: '<b>正确。</b>shell 是作业控制者；它把终端交给前台进程组，自己忽略这些信号，才能在 Ctrl-C 后继续显示提示符。'
        })}
      `,
      init: function () { }
    },
    {
      id: 'longjmp', num: '8.4', title: '非本地跳转：setjmp/longjmp',
      html: `
        <p><code>setjmp(env)</code> 保存当前栈/寄存器上下文，返回 0；<code>longjmp(env, val)</code> 恢复上下文，让 <code>setjmp</code> 看起来“再次返回” val。它常用于深层错误恢复，绕过中间的调用栈。</p>
        <pre data-lang="c"><code>jmp_buf env;
if (setjmp(env) == 0) {
    may_fail();          // 可能调用 longjmp(env, 1)
    printf("ok\n");
} else {
    printf("recovered\n");
}</code></pre>
        <p>风险：跳过中间栈帧的清理（文件描述符、锁、malloc），造成泄漏/死锁；局部变量若被优化到寄存器，longjmp 后值不确定（应声明 volatile）。C++ 中析构函数不会自动执行，禁止用 longjmp 跨 C++ 对象。</p>
        <p>信号 handler 中 <code>siglongjmp</code> 可以跳出，但同样要保证异步信号安全。更现代的做法是错误码/异常/结构化并发。</p>
      `,
      init: function () { }
    },
    {
      id: 'lab', num: '8.5', title: 'Shell Lab：把控制流写成程序',
      html: `
        <p>Shell Lab 要求实现 <code>tsh</code>：解析命令行、fork/exec、前后台、SIGCHLD 回收、SIGINT/SIGTSTP、fg/bg/jobs。它把本章所有概念放进一个程序。</p>
        <div class="callout lab"><div class="c-title">开始实验</div><p>浏览器内可观察 fork/等待/僵尸的状态关系；真实信号、进程组与官方 trace 在 Linux 实验机中运行。</p><p><a class="btn primary sm" href="../labs/lab.html?lab=shelllab">进入 Shell Lab →</a></p></div>
        <p>调试建议：先让前台单命令跑通，再加后台，再加信号，最后处理竞态与终端控制。每次只加一个能力，用 trace 回归。</p>
      `,
      init: function () { }
    }
  ],
  quiz: [],
  labs: ['shelllab'],
  afterRender: function () { document.title = '第 8 章 · 异常控制流 · 计算之境'; }
});
