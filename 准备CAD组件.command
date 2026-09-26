#!/bin/zsh
set -eu
cd "$(dirname "$0")"
echo '准备本地 CAD 组件（首次需要联网下载开源依赖，图纸不会上传）…'
python3 -m pip install --target cad-runtime/python --cache-dir .runtime/pip-cache -r tools/cad-requirements.txt
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null; then
  echo 'DXF 组件已准备。DWG 还需要 Node.js 20 或以上版本；请先安装 Node.js 再运行此文件。'
  exit 1
fi
npm ci --prefix cad-runtime --cache .runtime/npm-cache --ignore-scripts --no-audit --no-fund
echo 'CAD 组件已就绪，请双击“启动铸衡.command”。'
