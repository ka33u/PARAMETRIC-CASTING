#!/bin/zsh
set -eu
cd "$(dirname "$0")"
if [[ ! -x native/recognize || native/Recognize.swift -nt native/recognize ]]; then
  echo '正在准备本机图纸识别组件…'
  task_cache=$(mktemp -d /tmp/casting-swift.XXXXXX)
  trap 'rm -rf "$task_cache"' EXIT
  swiftc -module-cache-path "$task_cache" native/Recognize.swift -o native/recognize
fi
python3 tools/launch.py
