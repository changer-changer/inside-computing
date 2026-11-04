#!/bin/sh
# Run the official transpose tester in a fresh directory, allowing for emulation.
set -eu
if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo '用法：在 Cache Lab 材料目录中执行 /run/open3d/cache-transpose M N [超时秒数]' >&2
  exit 2
fi
m=$1; n=$2; timeout=${3:-600}
for value in "$m" "$n" "$timeout"; do
  case "$value" in ''|*[!0-9]*) echo '矩阵尺寸和超时必须是整数。' >&2; exit 2;; esac
done
if [ "$m" -lt 1 ] || [ "$m" -gt 256 ] || [ "$n" -lt 1 ] || [ "$n" -gt 256 ] || [ "$timeout" -lt 120 ] || [ "$timeout" -gt 3600 ]; then
  echo '矩阵尺寸需为 1–256，超时需为 120–3600 秒。' >&2
  exit 2
fi
base=$(pwd -P)
for file in test-trans.c tracegen.c trans.c cachelab.c cachelab.h csim-ref; do
  if [ ! -f "$base/$file" ]; then echo "缺少 $file；请在官方 Cache Lab 目录运行。" >&2; exit 2; fi
done
if [ ! -x "$base/csim-ref" ]; then echo '官方 csim-ref 不可执行。' >&2; exit 2; fi
run=$(mktemp -d /tmp/open3d-cache-run.XXXXXXXX)
printf '本次独立目录：%s\n' "$run"
printf '尺寸 M=%s N=%s；模拟环境超时设为 %s 秒。\n' "$m" "$n" "$timeout"
sha256sum "$base/trans.c" > "$run/source.sha256"
printf 'M=%s\nN=%s\ntimeout=%s\n' "$m" "$n" "$timeout" > "$run/run-info.txt"
cc=${CC:-gcc}
"$cc" -g -Wall -Werror -std=c99 -m64 -O0 -I "$base" -c "$base/trans.c" -o "$run/trans.o"
"$cc" -g -Wall -Werror -std=c99 -m64 -O0 -I "$base" "$base/tracegen.c" "$run/trans.o" "$base/cachelab.c" -o "$run/tracegen"
"$cc" -g -Wall -Werror -std=c99 -m64 -I "$base" -Dalarm=open3d_compat_alarm -c "$base/test-trans.c" -o "$run/test-trans.o"
"$cc" -g -Wall -Werror -std=c99 -m64 -c /run/open3d/cache-timeout.c -o "$run/cache-timeout.o"
"$cc" -g -Wall -Werror -std=c99 -m64 -I "$base" "$run/test-trans.o" "$run/trans.o" "$base/cachelab.c" "$run/cache-timeout.o" -o "$run/test-trans"
ln -s "$base/csim-ref" "$run/csim-ref"
printf '正在运行官方测试；模拟 x86 的 Valgrind 可能需要数分钟。\n'
cd "$run"
set +e
OPEN3D_CACHE_TIMEOUT=$timeout ./test-trans -M "$m" -N "$n" > results.log 2>&1
status=$?
set -e
cat results.log
if [ "$status" -ne 0 ] || grep -q 'Error: Program timed out\.' results.log; then
  printf '测试未正常完成；请检查 %s/results.log。该目录内没有旧运行的轨迹。\n' "$run" >&2
  exit 1
fi
printf '\n本次结果：%s/results.log\n' "$run"
for trace in trace.f0 trace.f1; do
  if [ -f "$trace" ]; then printf '本次轨迹：%s/%s\n' "$run" "$trace"; fi
done
printf '仅在正确性检查通过的函数生成对应轨迹；结果以测试日志为准。\n'
