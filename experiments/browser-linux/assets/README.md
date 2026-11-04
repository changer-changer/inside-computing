# 浏览器 Linux 试验资产（不随仓库分发）

公开仓库不包含 QEMU-Wasm、内核、rootfs 等约 142 MiB 的第三方构建产物。需要时运行：

```sh
python3 experiments/browser-linux/prepare.py
```

脚本会按 `assets-manifest.json` 中固定的 URL 与 SHA-256 下载。该试验仍是开发者兼容性试验，不是课程入口，也不是官方实验环境；不代表 Linux 已能在浏览器中稳定启动。详见 [`../README.md`](../README.md)。
