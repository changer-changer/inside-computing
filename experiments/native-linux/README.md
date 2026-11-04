# x86-64 Linux 实验机（开发版）

此实验机在 macOS 上通过 UTM 的 QEMU 运行 x86-64 Debian 12。网页终端可以连接真实 Linux shell；默认不联网、不挂载宿主目录，并将学生文件保存在本地 qcow2 工作区。该工作区以只读基础镜像为底层，删除工作区会丢失其中的作业。

当前这台电脑已在 `assets/` 中准备 UTM v5.0.8 和 Debian 12 genericcloud 镜像；这些文件仅保存在本地，不纳入项目版本管理。UTM 官方发布包 SHA-256 为 `7b2d7b2e2a02b3de1757ef19a8f36573e6d9cceae8c8cca0abcbcaa4a852019a`；Debian 镜像的固定来源与校验值见 `prepare.py`。其他电脑需要自行准备 UTM、运行 `python3 experiments/browser-linux/prepare.py` 和 `python3 experiments/native-linux/prepare.py`；UTM 可放在 `/Applications/UTM.app`，也可通过 `OPEN3D_UTM_APP` 指定。项目尚未提供完整自动安装流程，也尚未完成第三方依赖的再分发审查。

通过“打开学习实验室.command”启动项目后，在 3D 显示器的终端选择“连接 Linux 实验机”。断开前应先保存文件并退出编辑器；页面会等待实验机完成磁盘同步后再断开。同步失败时连接会保留，可以重试。强制退出或断电不属于这一保护范围。工作区保存在 `assets/student-workspace.qcow2`，基础镜像不可随意移动，否则工作区会失去引用。开发者也可在命令行运行：

```sh
python3 experiments/native-linux/run.py --utm experiments/native-linux/assets/UTM.app --disk experiments/native-linux/assets/debian-12-genericcloud-amd64-20261026-2643.qcow2 --workspace experiments/native-linux/assets/student-workspace.qcow2
```

命令行模式没有页面的自动同步流程，退出前需保存文件、退出编辑器并运行 `sync`，然后按 Ctrl+A 再按 X；没有 `--workspace` 时，磁盘修改只保存在临时快照。`--network` 是配置试验用的可选项，开启后虚拟机可以通过 QEMU 用户网络访问网络和宿主机的本地服务；它不是为不可信程序设计的安全隔离。网页入口不启用该选项。

网页使用 80 列、24 行的交互式终端；已在 Linux 中验证 vi 编辑、保存以及官方测试程序启动，窄屏可能需要横向滚动。3D 屏幕显示终端画面的局部，但场景尚未跟踪 Linux 的真实运行状态。不能将 Linux 启动、单题通过或教学动画视为完整官方实验验收。

本机工作区已安装 GCC 12、GDB 13、32 位编译支持、make 和 Perl，并在 `/root/CSAPP/datalab-handout` 保存了从 [CS:APP 官方自学页面](https://csapp.cs.cmu.edu/3e/labs.html)取得的 Data Lab 原版材料（原包 SHA-256：`a3bd21b752ecc7724d284417b1e19aa9f3839554893a4282ebe8e901c9fb2e02`）。重启后已核验编译器、调试器、原版 `dlc` 和编译出的 `btest` 均仍在。原始 `bits.c` 保留未完成的题目，供学生练习；测试时它的 `bitXor` 被正确判错。其他电脑新建的工作区尚不自动包含这些工具和材料。

## 新工作区安装工具（开发版）

先断开网页里的 Linux 实验机，再在项目目录的 macOS 终端运行下列命令。将 UTM 路径替换为本机实际位置；命令会打开同一个持久工作区，并临时开启网络：

```sh
python3 experiments/native-linux/run.py --utm experiments/native-linux/assets/UTM.app --disk experiments/native-linux/assets/debian-12-genericcloud-amd64-20261026-2643.qcow2 --workspace experiments/native-linux/assets/student-workspace.qcow2 --network
```

在出现的 Linux shell 中运行 `/run/open3d/setup-tools`。它使用 Debian 12 的软件仓库安装编译器、GDB、Valgrind、Flex、Bison 和 Perl，并从 Debian 11 安装旧版实验所需的 Python 2；仓库配置仅用于此次安装，不写入系统的软件源配置。随后运行 `/run/open3d/install-labs` 导入本机已准备的材料，再运行 `sync`，按 Ctrl+A、X 退出。之后可从网页连接，网页入口默认不联网。

`--network` 的虚拟机可访问网络和宿主机本地服务，因此只用于可信的环境准备，不应运行不可信程序。安装需要网络和一定时间；失败时保留输出并检查连接后重试。安装工具后还需运行 `/run/open3d/prepare-archlab` 准备 Architecture Lab；此流程不代表所有实验均已验收。

## 官方自学材料与工具

本机工作区的 `/root/CSAPP` 已保存官方自学包，包含 Data、Bomb、Attack、Architecture、Cache、Performance、Shell、Malloc 和 Proxy Lab。当前还装有 Valgrind、Flex、Bison、Python 2 和它们的依赖；Python 2 来自 Debian 11 仓库，用于部分旧版官方脚本。网页入口默认关闭网络。

已编译 Shell、Cache、Malloc、Proxy、Performance 的原始代码；Data Lab 的原版 `driver.pl` 能给未完成的原始答案评分，Shell Lab 的前几个参考与学生测试可以运行，Cache Lab 的缓存检查与 32×32 转置检查可以输出结果，Malloc Lab 的 `short1-bal.rep` 可执行。测试输出和程序退出码需分开看：例如 Shell Lab 测试命令退出码为零，并不证明学生输出与参考输出一致。这些结果不代表实验已完成，也不代表所有官方测试可运行。

模拟 x86 的墙钟时间和吞吐量受宿主机、模拟器及负载影响，不能当作物理 x86 机器的性能成绩。Cache、Malloc、Performance 等实验的性能测量还需要与合适的真实环境对照。材料的官方来源与校验值保存在 `labs-manifest.json`；可运行 `python3 experiments/native-linux/prepare_labs.py` 下载校验到本地，或用 `--source` 指定已有原包目录。该脚本不会覆盖已有的不同文件。随后启动或重新连接实验机，在 Linux 终端执行 `/run/open3d/install-labs`，将已准备的原包解压到 `/root/CSAPP`；已有同名目录不会覆盖。导入 Architecture Lab 后，可运行 `/run/open3d/prepare-archlab` 解压并编译模拟器；它保留原始 Makefile，并将图形界面关闭。已有 `sim` 目录不会被覆盖；若需要用现有配置重新编译，运行 `/run/open3d/prepare-archlab --build-existing`。材料导入本身不安装编译器或实验依赖，也不自动调整旧版源码的构建配置。自学包仅供本地使用，公开分发仍需核实授权。

Architecture Lab 的 `sim/misc`、`sim/seq`、`sim/pipe` 使用了适配新版 GCC 的 Makefile：添加 `-fcommon`，并关闭 Tcl/Tk 图形界面；原始 Makefile 在各目录的 `Makefile.open3d-original` 中。官方 PIPE 的原始数组复制函数已通过 `correctness.pl` 的 68 组检查；`benchmark.pl` 在原始配置下报告平均 15.18 CPE、0/60 分。CPE 由官方教学模拟器的周期模型计算，该结果只针对原始代码和本机配置，不代表学生的修改已经通过。

`/run/open3d/cache-transpose M N [超时秒数]` 为官方转置测试创建新的 `/tmp/open3d-cache-run.*` 目录，使用当前 `trans.c` 编译，保存源码 SHA-256、测试日志和本次生成的轨迹。测试程序的等待上限默认从 120 秒延长到 600 秒，可指定 120–3600 秒；官方源码、转置正确性检查及参考缓存模拟器不变。页面轨迹传输支持最多 256 KiB 和 20000 条 L/S/M 访问；超过限制需要先截取，截取后的统计只对应截取部分。

官方 SEQ 日志可用 `/run/open3d/export-seq-trace 文件路径` 发送到页面，文件上限为 256 KiB。日志需由 `ssim -v 2` 生成；`-l` 可限制执行指令数，`-t` 可附加 ISA 对照。页面只回放日志实际记录的取指和事件，并在最后显示有记录的结束状态；它不重建每条指令的完整寄存器状态。

`/run/open3d/capture-seq ./ssim 程序.yo [最多指令数]` 可生成取指时的逐步状态快照，默认 32 条、上限 64 条。它从头重复运行官方模拟器，核对取指序列和最后的状态；这比单次运行慢。官方 SEQ 在下一步开始时写回上一条指令，因此当前指令尚未写回。页面显示相对初始状态的累计变化，不能把它当成当前指令执行完成后的状态。

Shell Lab 中先运行 `make`，再运行 `/run/open3d/check-shell 3`（可选编号 1–16）。工具分别用官方 `sdriver.pl` 运行参考和学生程序，将两份原始输出及测试脚本送到页面；原始文件和校验信息保存在实验机 `/tmp/open3d-shell-run.*`。它不自动判分，也不抹去进程号或调度顺序差异；超时和文件变化会显示。若源码修改时间晚于可执行文件，页面提示重新编译；这一时间检查不能证明二进制一定与源码一致。每次运行上限 90 秒，输出各限 100000 字节。

Shell 测试运行时会从实验机的 `/proc` 采样驱动及其子孙进程，页面可分别回放参考和学生运行。三维卡片显示最多四个采到的进程，文字列出本次采样中的 PID、父进程、进程组和内核状态。目标采样间隔为 0.08 秒；页面同时显示本次实测的最大观察间隔。各进程依次读取，并非原子快照；只保存状态变化，最多 80 个采样。短命进程、信号传递及两次采样间的变化可能漏掉，采样本身也可能影响调度，因此不能把它当成完整事件跟踪或官方评分。
