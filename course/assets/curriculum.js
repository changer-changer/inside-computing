/* 计算之境 · 课程与实验元数据
   只描述“有什么、在哪里、多少分”，具体内容由 course/content/*.js 提供。 */
window.CA = window.CA || {};
CA.CURRICULUM = {
  edition: 'CS:APP 3e · 计算之境 64 位版',
  chapters: [
    {id:'ch01',num:1,title:'计算机系统漫游',en:'A Tour of Computer Systems',blurb:'从 hello.c 的源码、编译、链接、加载到进程运行，建立整机与系统的第一张地图。',minutes:40,level:'导论',concepts:['信息即比特','编译四阶段','存储层次','操作系统抽象','Amdahl 定律'],visual:'程序生命周期轨道 · 存储金字塔',labs:[]},
    {id:'ch02',num:2,title:'信息的表示与处理',en:'Representing and Manipulating Information',blurb:'二进制、补码、无符号运算、整数溢出、IEEE 754 浮点与舍入，一切行为的比特根源。',minutes:75,level:'基础',concepts:['补码','符号扩展','整数溢出','IEEE 754','舍入与精度','位级技巧'],visual:'32 位手术台 · 补码轮盘 · IEEE 754 拆解器',labs:['datalab']},
    {id:'ch03',num:3,title:'程序的机器级表示',en:'Machine-Level Representation of Programs',blurb:'把 C 落到寄存器、栈帧与指令流；读懂汇编，理解缓冲区溢出、代码注入与 ROP。',minutes:95,level:'核心',concepts:['寄存器与操作数','栈帧','控制流','过程调用','数组与结构体','缓冲区溢出','ROP'],visual:'x86-64 单步执行 · 栈帧生长 · ROP 链',labs:['bomblab','attacklab','bufferlab']},
    {id:'ch04',num:4,title:'处理器体系结构',en:'Processor Architecture',blurb:'从 Y86-64 指令集到五级流水线：数据通路、控制逻辑、冒险、转发与停顿。',minutes:80,level:'进阶',concepts:['Y86-64 ISA','组合逻辑','SEQ','五级流水线','数据冒险','控制冒险'],visual:'Y86 数据通路 · 流水线时空图 · 冒险动画',labs:['archlab']},
    {id:'ch05',num:5,title:'优化程序性能',en:'Optimizing Program Performance',blurb:'少做无用功、提高并行度：从 CPE 度量到循环展开、多累加器与分支预测。',minutes:60,level:'进阶',concepts:['CPE','关键路径','循环展开','多累加器','指令级并行','内存别名'],visual:'依赖图 · CPE 阶梯 · 展开对照',labs:['perflab']},
    {id:'ch06',num:6,title:'存储器层次结构',en:'The Memory Hierarchy',blurb:'寄存器、Cache、主存、磁盘的容量—延迟权衡；局部性如何决定程序快慢。',minutes:70,level:'核心',concepts:['局部性','Cache 映射','组相联','LRU','写策略','矩阵分块'],visual:'Cache 阵列命中图 · 地址拆解 · 访问热力图',labs:['cachelab']},
    {id:'ch07',num:7,title:'链接',en:'Linking',blurb:'把多个可重定位目标文件拼成可执行文件：符号、重定位、静态库与动态链接。',minutes:55,level:'进阶',concepts:['目标文件','符号表','重定位','静态库','PIC/GOT/PLT','动态链接'],visual:'链接器工作台 · 符号冲突 · GOT/PLT',labs:[]},
    {id:'ch08',num:8,title:'异常控制流',en:'Exceptional Control Flow',blurb:'异常、进程、信号、非本地跳转：操作系统如何夺回控制权并让程序协作。',minutes:75,level:'核心',concepts:['异常表','进程上下文','fork/exec/wait','信号','作业控制','非本地跳转'],visual:'进程时间线 · 信号投递 · 作业控制终端',labs:['shelllab']},
    {id:'ch09',num:9,title:'虚拟内存',en:'Virtual Memory',blurb:'页表、TLB、缺页、地址翻译，以及 malloc 如何在堆上构造分配器。',minutes:80,level:'核心',concepts:['地址空间','页表','TLB','缺页','mmap','堆分配器','垃圾回收'],visual:'页表漫游 · TLB 命中 · 堆块动画',labs:['malloclab']},
    {id:'ch10',num:10,title:'系统级 I/O',en:'System-Level I/O',blurb:'文件描述符、read/write、RIO、缓冲与重定向：程序如何和世界交换字节。',minutes:45,level:'基础',concepts:['文件描述符','read/write','短计数','RIO 缓冲','重定向','元数据'],visual:'fd 表 · 缓冲区流水线 · dup2 重定向',labs:[]},
    {id:'ch11',num:11,title:'网络编程',en:'Network Programming',blurb:'从 socket、TCP 到 HTTP：一个 Web 服务器/代理如何接收、解析并回应请求。',minutes:60,level:'进阶',concepts:['客户端-服务器','socket API','TCP 字节流','HTTP','代理','缓存'],visual:'TCP 字节流 · HTTP 请求解剖 · 代理缓存',labs:['proxylab']},
    {id:'ch12',num:12,title:'并发编程',en:'Concurrent Programming',blurb:'进程、线程、I/O 多路复用；共享数据、竞争、互斥、条件变量与线程安全。',minutes:65,level:'核心',concepts:['并发与并行','线程','竞争条件','互斥锁','条件变量','信号量','线程安全'],visual:'线程交错 · 竞争复现 · 锁/信号量',labs:['proxylab']}
  ],
  labs: [
    {id:'datalab',verified:'官方 62/62',file:'labs/datalab.html',chapter:2,title:'Data Lab',en:'Bit Manipulation',tagline:'只用 ! ~ & ^ | + << >>，在真实 C 编译器下重写 13 个整数与浮点函数。',difficulty:'入门',minutes:120,total:100,mode:'浏览器原生 · wasm32 C',skills:['补码','位运算','IEEE 754'],
      tasks:[
        {id:'bitXor',name:'bitXor',pts:4,ops:14,desc:'只用 ~ 和 & 实现 x ^ y'},
        {id:'tmin',name:'tmin',pts:4,ops:4,desc:'返回最小的 32 位补码整数'},
        {id:'isTmax',name:'isTmax',pts:4,ops:10,desc:'判断 x 是否为 INT_MAX'},
        {id:'allOddBits',name:'allOddBits',pts:4,ops:12,desc:'判断所有奇数位是否都为 1'},
        {id:'negate',name:'negate',pts:4,ops:5,desc:'返回 -x'},
        {id:'isAsciiDigit',name:'isAsciiDigit',pts:6,ops:15,desc:'判断 x 是否为 ASCII 数字 0–9'},
        {id:'conditional',name:'conditional',pts:6,ops:16,desc:'实现 x ? y : z'},
        {id:'isLessOrEqual',name:'isLessOrEqual',pts:8,ops:24,desc:'判断 x <= y（有符号）'},
        {id:'logicalNeg',name:'logicalNeg',pts:8,ops:12,desc:'不用 ! 实现逻辑非'},
        {id:'howManyBits',name:'howManyBits',pts:16,ops:90,desc:'表示 x 所需的最少补码位数'},
        {id:'floatScale2',name:'floatScale2',pts:12,ops:30,desc:'返回 2*f 的位模式（含非规格化数）'},
        {id:'floatFloat2Int',name:'floatFloat2Int',pts:12,ops:30,desc:'把 float 位模式转成 int（向零舍入）'},
        {id:'floatPower2',name:'floatPower2',pts:12,ops:30,desc:'返回 2.0^x 的 float 位模式'}
      ],
      note:'使用 wasm32 真实 Clang 编译；规则检查为本地实现，测试为确定性边界+随机集，并非官方 btest 的逐字节复刻。'},
    {id:'bomblab',verified:'官方全解',file:'labs/lab.html?lab=bomblab',chapter:3,title:'Bomb Lab',en:'Defusing a Binary Bomb',tagline:'用反汇编与单步调试拆掉 6 个阶段和 1 个隐藏关卡；浏览器内原创靶场 + 实验机官方模式。',difficulty:'挑战',minutes:180,total:100,mode:'x86-64 模型 / 官方靶场',skills:['汇编阅读','调试','控制流','递归','链表'],
      tasks:[{id:'phase1',name:'Phase 1',pts:10,desc:'字符串比较'},{id:'phase2',name:'Phase 2',pts:10,desc:'整数序列'},{id:'phase3',name:'Phase 3',pts:15,desc:'跳转表 / switch'},{id:'phase4',name:'Phase 4',pts:15,desc:'递归 func4'},{id:'phase5',name:'Phase 5',pts:15,desc:'字符数组映射'},{id:'phase6',name:'Phase 6',pts:20,desc:'链表排序'},{id:'secret',name:'Secret Phase',pts:15,desc:'隐藏关卡：二叉搜索树'}],
      note:'官方 bomb 二进制不随项目分发；浏览器提供同构原创靶场，实验机模式运行官方材料。'},
    {id:'attacklab',verified:'官方 5/5',file:'labs/lab.html?lab=attacklab',chapter:3,title:'Attack Lab',en:'Code Injection & ROP',tagline:'构造十六进制 payload：代码注入攻下 3 关，ROP 再攻下 2 关。',difficulty:'挑战',minutes:180,total:100,mode:'x86-64 模型 / 官方靶场',skills:['栈布局','缓冲区溢出','ROP','小端序'],
      tasks:[{id:'touch1',name:'Touch 1',pts:15,desc:'代码注入：跳转到 touch1'},{id:'touch2',name:'Touch 2',pts:20,desc:'代码注入：把 cookie 放入 %rdi'},{id:'touch3',name:'Touch 3',pts:20,desc:'代码注入：传递 cookie 字符串指针'},{id:'fire2',name:'Fire 2',pts:20,desc:'ROP：用 gadget 设置 %rdi'},{id:'fire3',name:'Fire 3',pts:25,desc:'ROP：构造 cookie 字符串并传指针'}],
      note:'CTARGET 栈可执行；RTARGET 栈不可执行，只能使用 farm 中的 gadget。'},
    {id:'bufferlab',verified:'legacy 模型',file:'labs/lab.html?lab=bufferlab',chapter:3,title:'Buffer Lab',en:'Legacy IA32 Buffer Overflow',tagline:'历史实验：在 32 位栈上完成 5 级缓冲区溢出，对照 x86-64 调用约定。',difficulty:'挑战',minutes:90,total:60,mode:'IA32 模型 · legacy',skills:['IA32 栈','返回地址','shellcode'],
      tasks:[{id:'smoke',name:'Smoke',pts:10,desc:'改写返回地址跳转 smoke'},{id:'fizz',name:'Fizz',pts:10,desc:'调用 fizz 并传入参数'},{id:'bang',name:'Bang',pts:15,desc:'全局变量 bang 改为 cookie'},{id:'boom',name:'Boom',pts:15,desc:'调用 boom 并恢复返回地址'},{id:'nitro',name:'Nitro',pts:10,desc:'注入 shellcode 并执行'}],
      note:'第三版官方已用 Attack Lab 取代；本项目作为历史对照保留。'},
    {id:'archlab',verified:'官方 ISA/CPI',file:'labs/lab.html?lab=archlab',chapter:4,title:'Architecture Lab',en:'Y86-64 & Pipelining',tagline:'写 Y86-64 程序、扩展 iaddq、调度流水线，把周期数压下来。',difficulty:'硬核',minutes:180,total:100,mode:'浏览器 Y86-64 / 官方 sim',skills:['Y86-64','流水线','冒险','指令调度'],
      tasks:[{id:'partA',name:'Part A · sum_list',pts:30,desc:'用 Y86-64 实现链表求和'},{id:'partB',name:'Part B · iaddq',pts:30,desc:'为数据通路扩展 iaddq 指令'},{id:'partC',name:'Part C · 流水线优化',pts:40,desc:'调度指令，降低 5 级流水线周期数'}],
      note:'浏览器内使用项目自建 Y86 模型；官方 HCL/psim 评分在实验机中完成。'},
    {id:'cachelab',verified:'官方 53/53',file:'labs/lab.html?lab=cachelab',chapter:6,title:'Cache Lab',en:'Cache Simulator & Transpose',tagline:'写一个 LRU cache 模拟器，再把矩阵转置优化到 miss 阈值以下。',difficulty:'中等',minutes:150,total:100,mode:'wasm32 C csim + 转置插桩',skills:['地址拆解','LRU','局部性','分块'],
      tasks:[{id:'partA',name:'Part A · csim',pts:40,desc:'实现 s/E/b 可配置的 cache 模拟器'},{id:'partB32',name:'Part B · 32×32',pts:20,desc:'转置 miss < 300'},{id:'partB64',name:'Part B · 64×64',pts:20,desc:'转置 miss < 1300'},{id:'partB61',name:'Part B · 61×61',pts:20,desc:'转置 miss < 2000'}],
      note:'缓存 s=5, E=1, b=5；浏览器使用项目模型，官方 test-trans 在实验机中运行。'},
    {id:'perflab',verified:'官方 CPE',file:'labs/lab.html?lab=perflab',chapter:5,title:'Performance Lab',en:'Optimizing Kernels',tagline:'优化官方 rotate 与 smooth 两个 kernel，让 CPE 降到阈值以下。',difficulty:'中等',minutes:120,total:100,mode:'wasm32 相对计时 + 周期模型',skills:['CPE','循环展开','多累加器','指令级并行'],
      tasks:[{id:'rotate',name:'rotate',pts:50,desc:'图像旋转，降低 CPE'},{id:'smooth',name:'smooth',pts:50,desc:'图像平滑，降低 CPE'}],
      note:'浏览器用官方 naive rotate/smooth 作基线并比较 wasm 相对时间；官方 fcyc/CPE 在实验机中测量。'},
    {id:'shelllab',verified:'官方 16 trace',file:'labs/lab.html?lab=shelllab',chapter:8,title:'Shell Lab',en:'Job Control Shell',tagline:'实现 tsh：fork/exec/wait、信号处理、前后台作业与终端控制。',difficulty:'硬核',minutes:180,total:100,mode:'JS 作业控制模型 + 官方 tsh',skills:['fork/exec','信号','作业控制','竞态'],
      tasks:[{id:'eval',name:'eval 与内建命令',pts:15,desc:'解析并执行 quit/jobs/bg/fg'},{id:'fg',name:'前台作业',pts:20,desc:'正确等待与回收前台进程'},{id:'bg',name:'后台作业',pts:20,desc:'后台运行、SIGCHLD 回收'},{id:'jobs',name:'jobs 输出',pts:15,desc:'按规范输出作业状态'},{id:'signals',name:'信号与终端',pts:20,desc:'处理 Ctrl-C / Ctrl-Z / fg / bg'},{id:'trace',name:'综合 trace',pts:10,desc:'通过 5 组官方风格 trace'}],
      note:'官方 sdriver.pl trace 1–16 在实验机中运行；网页展示原始输出与进程采样。'},
    {id:'malloclab',verified:'官方 82/100',file:'labs/lab.html?lab=malloclab',chapter:9,title:'Malloc Lab',en:'Dynamic Memory Allocator',tagline:'在堆上实现 malloc/free/realloc，平衡利用率与吞吐量。',difficulty:'硬核',minutes:180,total:100,mode:'wasm32 C 分配器 + 官方 mdriver',skills:['隐式链表','显式链表','分离空闲链表','边界标记'],
      tasks:[{id:'correct',name:'正确性',pts:30,desc:'通过 8 组 alloc/free/realloc trace'},{id:'util',name:'利用率',pts:35,desc:'峰值利用率 ≥ 55%'},{id:'through',name:'吞吐量',pts:25,desc:'相对吞吐量 ≥ 0.7'},{id:'realloc',name:'realloc 优化',pts:10,desc:'realloc 在边界处就地扩展'}],
      note:'浏览器堆 256 KB；官方 mdriver 与完整评分在实验机中运行。'},
    {id:'proxylab',verified:'官方 70/70',file:'labs/lab.html?lab=proxylab',chapter:11,title:'Proxy Lab',en:'Concurrent HTTP Proxy',tagline:'实现带缓存与并发的 HTTP 代理，经受住浏览器与并发客户端测试。',difficulty:'硬核',minutes:180,total:100,mode:'JS 代理模型 + 官方 C proxy',skills:['socket','HTTP','缓存','并发','线程安全'],
      tasks:[{id:'basic',name:'基本代理',pts:30,desc:'转发 GET 请求与响应'},{id:'headers',name:'头部处理',pts:15,desc:'Host / Connection / Content-Length'},{id:'cache',name:'对象缓存',pts:30,desc:'LRU 缓存、命中与并发安全'},{id:'concurrency',name:'并发',pts:15,desc:'多客户端交错请求'},{id:'robust',name:'健壮性',pts:10,desc:'截断/超长/非法请求'}],
      note:'官方 proxy 在实验机中运行；浏览器提供 HTTP/缓存/并发可视化与规则检查。'}
  ]
};
CA.CURRICULUM.chapterById = Object.fromEntries(CA.CURRICULUM.chapters.map(c => [c.id, c]));
CA.CURRICULUM.labById = Object.fromEntries(CA.CURRICULUM.labs.map(l => [l.id, l]));
CA.CURRICULUM.findChapter = n => CA.CURRICULUM.chapters[n - 1];
CA.CURRICULUM.chapterFile = id => 'course/chapter.html?ch=' + id.slice(2);
