#!/bin/sh
# Private second serial port: only an explicit flush request is supported.
set -eu
stty -F /dev/ttyS1 115200 raw -echo clocal
while :; do
  exec 3<>/dev/ttyS1
  while IFS= read -r request <&3; do
    case "$request" in
      SYNC) sync && printf 'OK\n' >&3 || printf 'ERROR\n' >&3 ;;
      *) printf 'UNKNOWN\n' >&3 ;;
    esac
  done
  exec 3>&-
  sleep 1
done
