#!/bin/sh
# Development initramfs overlay for a disposable Debian genericcloud image.
set -eu
/bin/busybox --install -s /bin
export PATH=/bin:/sbin:/usr/bin:/usr/sbin
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
modprobe -a ext4 virtio_blk virtio_net
sleep 2
ip link set lo up
network=0
if grep -qw 'open3d.network=1' /proc/cmdline; then
  network=1
  ip link set eth0 up
  ip addr add 10.0.2.15/24 dev eth0
  ip route add default via 10.0.2.2
fi
mkdir -p /sysroot
mount -t ext4 /dev/vda1 /sysroot
if [ "$network" = 1 ]; then
  rm -f /sysroot/etc/resolv.conf
  echo 'nameserver 10.0.2.3' > /sysroot/etc/resolv.conf
fi
stty rows 24 cols 80 < /dev/ttyS0
mount --move /dev /sysroot/dev
mount --move /proc /sysroot/proc
mount --move /sys /sysroot/sys
mkdir -p /sysroot/dev/pts /sysroot/run
mount -t devpts devpts /sysroot/dev/pts
mount -t tmpfs tmpfs /sysroot/run
mkdir -p /sysroot/run/open3d
cp /open3d-export-yo /sysroot/run/open3d/export-yo
cp /open3d-export-pipe-trace /sysroot/run/open3d/export-pipe-trace
cp /open3d-export-cache-trace /sysroot/run/open3d/export-cache-trace
cp /open3d-export-seq-trace /sysroot/run/open3d/export-seq-trace
cp /open3d-capture-seq /sysroot/run/open3d/capture-seq
cp /open3d-check-shell /sysroot/run/open3d/check-shell
cp /open3d-capture-malloc.py /sysroot/run/open3d/capture-malloc
cp /open3d-malloc-observer.c /sysroot/run/open3d/malloc-observer.c
cp /open3d-cache-transpose.sh /sysroot/run/open3d/cache-transpose
cp /open3d-cache-timeout.c /sysroot/run/open3d/cache-timeout.c
cp /open3d-control-agent.sh /sysroot/run/open3d/control-agent
cp /open3d-guest-init.sh /sysroot/run/open3d/guest-init
cp /open3d-install-labs /sysroot/run/open3d/install-labs
cp /open3d-setup-tools.sh /sysroot/run/open3d/setup-tools
cp /open3d-prepare-archlab.sh /sysroot/run/open3d/prepare-archlab
cp -R /open3d-lab-handouts /sysroot/run/open3d/lab-handouts
chmod 755 /sysroot/run/open3d/export-yo /sysroot/run/open3d/export-pipe-trace /sysroot/run/open3d/export-cache-trace /sysroot/run/open3d/export-seq-trace /sysroot/run/open3d/cache-transpose
chmod 755 /sysroot/run/open3d/control-agent /sysroot/run/open3d/guest-init
chmod 755 /sysroot/run/open3d/install-labs /sysroot/run/open3d/setup-tools /sysroot/run/open3d/prepare-archlab
chmod 755 /sysroot/run/open3d/capture-seq
chmod 755 /sysroot/run/open3d/check-shell /sysroot/run/open3d/capture-malloc
exec switch_root /sysroot /run/open3d/guest-init
