#!/bin/bash
# 飞书文档读取 Skill 入口脚本
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
if [ $# -lt 1 ]; then
    echo "用法: bash $0 [--no-save] [--with-images] <飞书URL>" >&2
    echo "" >&2
    echo "参数说明:" >&2
    echo "  --no-save      不保存文件，只输出 Markdown 内容" >&2
    echo "  --with-images  包含图片（需要多模态模型支持）" >&2
    echo "" >&2
    echo "示例:" >&2
    echo "  bash $0 \"https://xxx.feishu.cn/wiki/xxx\"" >&2
    echo "  bash $0 --no-save \"https://xxx.feishu.cn/wiki/xxx\"" >&2
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
