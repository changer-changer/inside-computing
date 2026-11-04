# 本地实验机资产（不随仓库分发）

这个目录在公开仓库中是空的。它需要放置本机自己的：

- `UTM.app`（或通过 `OPEN3D_UTM_APP` 指向已安装的 UTM）
- Debian 12 genericcloud x86-64 基础镜像
- `student-workspace.qcow2` 持久工作区
- `lab-handouts/` 中由你从 CS:APP 官方自学页面取得的实验原包

这些文件体积大、包含第三方运行时，且官方实验材料有各自的授权条件，因此不纳入 MIT/CC BY-SA 授权的源码仓库。准备方法见：

- [`experiments/native-linux/README.md`](../README.md)
- [`docs/资产与第三方.md`](../../../docs/资产与第三方.md)

不要把参考答案、个人作业或包含隐私的磁盘镜像提交到仓库。
