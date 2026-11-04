#!/bin/sh
# Send a student-selected Y86 .yo listing to the page's terminal, not to a network.
set -eu
if [ "$#" -ne 1 ] || [ ! -f "$1" ] || [ ! -r "$1" ]; then
  echo '用法：/run/open3d/export-yo 可读取的文件.yo' >&2
  exit 1
fi
if [ ! -t 1 ]; then
  echo '请在网页的 Linux 实验机终端中使用。' >&2
  exit 1
fi
size=$(wc -c < "$1")
if [ "$size" -eq 0 ] || [ "$size" -gt 65536 ]; then
  echo '文件必须为 1–65536 字节。' >&2
  exit 1
fi
printf '\033]777;open3d-yo;'
head -c 65537 < "$1" | base64 | tr -d '\n'
printf '\007\n已发送。请在网页中检查提示，再选择是否装入流水线。\n'
