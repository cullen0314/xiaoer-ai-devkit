#!/bin/bash
# 网页技术文档抓取与中文翻译 Skill 入口脚本
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
  echo "用法: bash $0 [--preview|--generate] [--output <path>] [--name <slug>] [--bilingual] [--force] [--source-only] <url>" >&2
  echo "" >&2
  echo "示例:" >&2
  echo "  bash $0 --preview \"https://example.com/docs/page\"" >&2
  echo "  bash $0 --generate \"https://example.com/docs/page\"" >&2
  echo "  bash $0 --generate --bilingual --name react-use-effect \"https://example.com/docs/page\"" >&2
  exit 1
fi

node "$SCRIPT_DIR/skill.js" "$@"
