#!/bin/sh
# First-time setup for the official self-study simulator. Never overwrite a work tree.
set -eu
lab=/root/CSAPP/archlab-handout
if [ "${1:-}" = --build-existing ] && [ "$#" = 1 ]; then
  if [ ! -f "$lab/sim/misc/Makefile" ] || [ ! -f "$lab/sim/seq/Makefile" ] || [ ! -f "$lab/sim/pipe/Makefile" ]; then
    echo '未找到完整的模拟器目录。' >&2
    exit 1
  fi
  echo '使用现有文件重新编译；不修改配置或作业源码。'
  make -C "$lab/sim/misc"
  make -C "$lab/sim/seq"
  make -C "$lab/sim/pipe"
  exit 0
fi
if [ "$#" != 0 ]; then
  echo '用法：prepare-archlab [--build-existing]' >&2
  exit 2
fi
if [ ! -f "$lab/sim.tar" ]; then
  echo '未找到 Architecture Lab 材料；请先导入官方自学包。' >&2
  exit 1
fi
if [ -e "$lab/sim" ] || [ -L "$lab/sim" ]; then
  echo 'sim 目录已存在，未修改；如需重新编译，请运行 prepare-archlab --build-existing。' >&2
  exit 1
fi
for tool in gcc make flex bison; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "缺少工具 $tool；请先安装实验工具。" >&2
    exit 1
  fi
done
stage=$(mktemp -d "$lab/.open3d-arch.XXXXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM
tar --no-same-owner -xf "$lab/sim.tar" -C "$stage"
for dir in misc seq pipe; do
  file=$stage/sim/$dir/Makefile
  if [ ! -f "$file" ] || ! grep -q '^CFLAGS=' "$file"; then
    echo "模拟器配置格式不符合预期：$dir" >&2
    exit 1
  fi
  cp "$file" "$file.open3d-original"
  sed -i 's/^CFLAGS=\(.*\)$/CFLAGS=\1 -fcommon/' "$file"
done
misc=$stage/sim/misc/Makefile
grep -q '^LCFLAGS=' "$misc" || { echo '缺少 LCFLAGS 配置。' >&2; exit 1; }
sed -i 's/^LCFLAGS=\(.*\)$/LCFLAGS=\1 -fcommon/' "$misc"
for dir in seq pipe; do
  file=$stage/sim/$dir/Makefile
  for var in GUIMODE TKLIBS TKINC; do
    grep -q "^$var=" "$file" || { echo "缺少 $var 配置。" >&2; exit 1; }
    sed -i "s/^$var=.*/$var=/" "$file"
  done
done
mv -T -n "$stage/sim" "$lab/sim"
if [ -e "$stage/sim" ]; then
  echo 'sim 目录已出现，未覆盖。' >&2
  exit 1
fi
echo '已解压模拟器并保存原始 Makefile；开始编译无图形界面的模拟器。'
make -C "$lab/sim/misc"
make -C "$lab/sim/seq"
make -C "$lab/sim/pipe"
echo 'Architecture Lab 模拟器已构建；实验和评分仍需学生自行完成。'
