#!/bin/bash
# GitHub 仓库深度解析器入口脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "错误：未找到 Node.js，请先安装 Node.js" >&2
  exit 1
fi

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "首次运行，正在安装依赖..." >&2
  cd "$SCRIPT_DIR"
  if ! npm install --silent >/dev/null 2>&1; then
    echo "依赖安装失败，请手动运行：cd $SCRIPT_DIR && npm install" >&2
    exit 1
  fi
  echo "依赖安装完成" >&2
fi

if [ $# -lt 2 ]; then
  echo "用法:" >&2
  echo "  bash $0 --clone <github_url>" >&2
  echo "  bash $0 --preview <repo_path>" >&2
  echo "  bash $0 --generate <output_dir> <repo_name>" >&2
  exit 1
fi

node "$SCRIPT_DIR/skill.js" "$@"
