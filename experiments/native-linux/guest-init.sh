#!/bin/sh
# Runs after switch_root, with the guest's /dev and /run mounted.
if grep -qw 'open3d.control=1' /proc/cmdline; then
  (while :; do /run/open3d/control-agent || :; sleep 1; done) </dev/null >/dev/null 2>&1 &
fi
# Keep PID 1 separate from login so another child exiting cannot terminate Linux.
while :; do
  /usr/bin/setsid /sbin/agetty --autologin root --noclear ttyS0 115200 vt100 &
  login_pid=$!
  wait "$login_pid" || :
  sleep 1
done
