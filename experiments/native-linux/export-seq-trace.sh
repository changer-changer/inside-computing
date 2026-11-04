#!/bin/sh
# Send a student-selected ssim text trace through the local terminal.
set -eu
if [ "$#" -ne 1 ] || [ ! -f "$1" ] || [ ! -r "$1" ]; then
  echo '用法：/run/open3d/export-seq-trace 可读取的轨迹文件' >&2
  exit 1
fi
if [ ! -t 1 ]; then
  echo '请在网页的 Linux 实验机终端中使用。' >&2
  exit 1
fi
size=$(wc -c < "$1")
if [ "$size" -eq 0 ] || [ "$size" -gt 262144 ]; then
  echo '轨迹文件必须为 1–262144 字节；可用 ssim -l 限制指令数。' >&2
  exit 1
fi
printf '\033]777;open3d-seq-trace;'
head -c 262145 < "$1" | base64 | tr -d '\n'
printf '\007\n轨迹已发送。请在网页中检查提示，再选择是否回放。\n'
