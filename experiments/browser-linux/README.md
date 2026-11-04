# 浏览器 Linux 兼容性试验

这是开发者试验，不是课程入口，也不是可用的官方实验环境。目标是在浏览器内启动 x86-64 Linux，进一步验证 shell、gcc、gdb 与官方实验。不要将此目录作为已通过验收的学生功能发布。

试验使用 QEMU Wasm 官方演示的构建产物，固定至其镜像仓库提交 `b7c549b5e6f4c376f76483a03e983214421434ad`。仅用于本机研究；二进制的精确源码对应关系、所有依赖许可和正式再分发条件尚未审计。`prepare.py` 只从上游取得文件，不在仓库中复制这些构建产物。首次准备需要下载约 142 MiB。

```
python3 experiments/browser-linux/prepare.py
python3 experiments/browser-linux/serve.py
```

打开服务地址，浏览器须支持 WebAssembly 线程及跨源隔离。工具链仅用于开发，学生最终不需要运行这些命令。

## 目前的观察

2026-11-02，在本机 Apple Silicon 的应用内浏览器中，官方演示页面的网络组件因服务工作线程路径错误未启动。移除联网组件后的本地试验能输出 Linux 内核日志，但默认配置发生 IO-APIC 定时器错误；`noapic`、`noapic nolapic` 和 `no_timer_check tsc=reliable clocksource=tsc` 尝试到内核后期未见登录界面。`-icount` 配合单线程产生 QEMU worker 错误。尚未证明 Linux 启动成功，因此 gcc、gdb、实验工具、浏览器兼容性和持久化均未验证。

实验结果仅针对该机器、浏览器和上述构建，不足以判定 QEMU Wasm 整体不可用。需继续测试其他浏览器、上游较新构建、启动时钟配置与可复现的自建镜像。额外尝试了 microvm 设备并从 QEMU v9.2.0 获取 BIOS；启用 PIT、PIC 和 RTC 后，一次运行越过前述位置并显示执行 `/init`，但仍未观察到登录提示符。尚不能确定系统完成初始化。不得将组件加载或内核日志解释为 Linux 已就绪。

另可在试验地址后加 `?machine=microvm` 测试 microvm；加 `?machine=microvm&init=sh` 则尝试直接启动 initramfs 的 shell。两者均为故障排查选项，不代表完整 Linux 实验环境。
