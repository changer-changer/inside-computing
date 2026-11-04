#!/bin/sh
# Install lab tools in a deliberately network-enabled Debian guest.
set -eu
if ! grep -qw 'open3d.network=1' /proc/cmdline; then
  echo '此实验机未启用联网配置；请按实验机说明以 --network 启动后重试。' >&2
  exit 1
fi
if [ "$(id -u)" != 0 ]; then
  echo '请以 root 运行。' >&2
  exit 1
fi
if ! [ -r /etc/os-release ] || ! grep -q '^VERSION_CODENAME=bookworm$' /etc/os-release; then
  echo '此准备脚本仅适用于 Debian 12 bookworm 实验机。' >&2
  exit 1
fi
sources=/run/open3d/lab-apt-sources.list
cat > "$sources" <<'EOF'
deb http://deb.debian.org/debian bookworm main
deb http://deb.debian.org/debian bookworm-updates main
deb http://deb.debian.org/debian-security bookworm-security main
deb http://deb.debian.org/debian bullseye main
EOF
export DEBIAN_FRONTEND=noninteractive
# Sources are passed only to these calls and do not change the guest's apt configuration.
apt-get -o Dir::Etc::sourcelist="$sources" -o Dir::Etc::sourceparts=- update
apt-get -o Dir::Etc::sourcelist="$sources" -o Dir::Etc::sourceparts=- -o Dpkg::Use-Pty=0 install -y --no-install-recommends \
  build-essential gcc-multilib gdb valgrind flex libfl-dev bison perl python2 python-is-python2
echo '工具安装完成。请运行 sync，再退出实验机；之后从网页连接时默认不联网。'
