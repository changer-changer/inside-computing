#!/bin/sh
# Import locally prepared, host-verified self-study archives without replacing work.
set -eu
source_dir=/run/open3d/lab-handouts
destination=/root/CSAPP
mkdir -p "$destination"
stage=$(mktemp -d "$destination/.open3d-import.XXXXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM
imported=0
missing=0
for item in \
  datalab-handout:./datalab-handout \
  bomb:./bomb \
  target1:./target1 \
  archlab-handout:./archlab-handout \
  cachelab-handout:./cachelab-handout \
  perflab-handout:. \
  shlab-handout:./shlab-handout \
  malloclab-handout:./malloclab-handout \
  proxylab-handout:./proxylab-handout
do
  name=${item%%:*}
  root=${item#*:}
  archive=$source_dir/$name.tar
  target=$destination/$name
  if [ ! -f "$archive" ]; then
    echo "未准备：$name"
    missing=$((missing + 1))
    continue
  fi
  if [ -e "$target" ] || [ -L "$target" ]; then
    echo "已存在，保留：$target"
    continue
  fi
  mkdir "$stage/$name"
  tar --no-same-owner -xf "$archive" -C "$stage/$name"
  if [ "$root" = . ]; then
    mv -T -n "$stage/$name" "$target"
  else
    mv -T -n "$stage/$name/$root" "$target"
  fi
  if [ -e "$stage/$name/$root" ]; then
    echo "目标已出现，未覆盖：$target" >&2
    exit 1
  fi
  echo "已导入：$target"
  imported=$((imported + 1))
done
echo "本次导入 $imported 项，未准备 $missing 项；已有目录保持不变。"
echo '编译工具和各实验所需依赖仍须另行安装。'
