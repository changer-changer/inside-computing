# 第三方组件与素材声明

本文件汇总仓库内**随源码分发**的第三方组件。各组件的原许可证全文保存在对应目录；本文件不替代逐项法律审计。

## 随仓库包含

| 组件 | 位置 | 许可 | 上游/说明 |
|---|---|---|---|
| Three.js 0.169.0 | `vendor/three/` | MIT | <https://github.com/mrdoob/three.js>；`vendor/three/LICENSE` |
| browsercc 0.1.1 | `vendor/browsercc/` | wrapper MIT | <https://github.com/BertalanD/browsercc>；`LICENSE`、`PROVENANCE.md` |
| LLVM / clang / lld 构建 | `vendor/browsercc/*.wasm` | Apache-2.0 with LLVM exceptions | `LICENSE-LLVM.txt`；构建对应关系见 `PROVENANCE.md` |
| wasi-libc / WASI sysroot | `vendor/browsercc/sysroot.tar` | Apache-2.0 / MIT（按上游） | `LICENSE-wasi-libc.txt`、`LICENSE-LLVM.txt` |
| @bjorn3/browser_wasi_shim 0.4.2 | `vendor/wasi/` | Apache-2.0 / MIT | `LICENSE-APACHE`、`LICENSE-MIT` |
| Blink / x86-64 playground | `vendor/x86/` | ISC | `LICENSE.blink.txt`、`LICENSE.playground.txt`、`PROVENANCE.md`、`source/` |

`vendor/browsercc/PROVENANCE.md` 与 `vendor/x86/PROVENANCE.md` 记录了来源、哈希、修改和**尚未完全复现的构建/传递依赖审计**。再分发者应按自己的场景复核这些说明。

## 不随仓库分发

以下资产因体积、授权或隐私原因**不在本仓库**：

- CS:APP 官方实验原包（Data/Bomb/Attack/Architecture/Cache/Performance/Shell/Malloc/Proxy）及其答案。
- UTM.app、Debian 12 qcow2、`student-workspace.qcow2`、QEMU-Wasm 内核/rootfs。
- `验证参考答案（勿发布）`、个人作业、备份、含个人信息的终端日志/截图。

需要时请按 [docs/资产与第三方.md](docs/资产与第三方.md) 从官方/上游取得。官方实验材料版权归其作者/机构；本项目只提供原创教学层与互操作说明。

## 原创内容

- 代码：PolyForm Noncommercial 1.0.0（source-available，禁止商业使用），见 [LICENSE](LICENSE)。
- 原创课程文字、教学图与截图：CC BY-NC-SA 4.0，见 [LICENSE-CONTENT.md](LICENSE-CONTENT.md)。
- 商业使用：需另行书面许可，见 [COMMERCIAL.md](COMMERCIAL.md)。

## 免责声明

本项目按“现状”提供，不附带任何明示或暗示担保。第三方组件的使用、再分发与合规性由再分发者自行确认。CS:APP 是 CMU 的课程/教材体系；本项目不是其官方产品，也不代表其认可。
