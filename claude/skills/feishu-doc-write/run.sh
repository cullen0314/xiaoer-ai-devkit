#!/bin/bash
# 飞书文档写入 Skill 入口脚本
# 自动检测并安装 Node.js 依赖
set -e

# ==================== 配置区 ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ==================== 依赖检查 ====================
# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到 Node.js，请先安装 Node.js" >&2
    exit 1
fi

# ==================== 依赖安装 ====================
# 自动安装 npm 依赖（检测 node_modules 是否存在）
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..." >&2
    cd "$SCRIPT_DIR"
    
    if ! npm install --silent 2>&1; then
        echo "❌ 依赖安装失败，请手动运行：cd $SCRIPT_DIR && npm install" >&2
        exit 1
    fi
    
    echo "✅ 依赖安装完成" >&2
fi

# ==================== 参数检查 ====================
if [ $# -lt 2 ]; then
    echo "用法: bash $0 --title \"文档标题\" --file \"/path/to/file.md\"" >&2
    echo "      bash $0 --title \"文档标题\" --markdown \"Markdown内容\"" >&2
    echo "" >&2
    echo "参数说明:" >&2
    echo "  --title      文档标题（必填）" >&2
    echo "  --file       本地 Markdown 文件路径（推荐）" >&2
    echo "  --markdown   Markdown 格式的内容" >&2
    echo "" >&2
    echo "示例:" >&2
    echo "  bash $0 --title \"技术方案\" --file \"/tmp/design.md\"" >&2
    exit 1
fi

# ==================== 运行脚本 ====================
# 检查是否存在Token文件，如果不存在则提示将打开浏览器
if [ ! -f "$HOME/.feishu/credentials.json" ]; then
    echo "ℹ️  检测到首次使用（或Token不存在），即将打开浏览器进行飞书授权..." >&2
    echo "   请在弹出的浏览器窗口中点击确认授权。" >&2
    echo "" >&2
fi

# 执行 Node.js 脚本，传递所有参数
node "$SCRIPT_DIR/skill.js" "$@"
