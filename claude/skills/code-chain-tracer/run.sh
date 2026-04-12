#!/bin/bash
# 业务链路追踪器 - 预扫描入口
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "错误：未找到 Node.js，请先安装 Node.js" >&2
  exit 1
fi

if [ $# -lt 2 ]; then
  echo "用法:" >&2
  echo "  bash $0 --scan <project_path>                          # 扫描项目建索引" >&2
  echo "  bash $0 --resolve-constant <project_path> <constant>   # 解析常量值" >&2
  exit 1
fi

node "$SCRIPT_DIR/skill.js" "$@"
