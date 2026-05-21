#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILLS_SOURCE_DIR="$SCRIPT_DIR/claude/skills"

list_skills() {
    ls "$SKILLS_SOURCE_DIR" 2>/dev/null | sort
}

if [ -z "$1" ]; then
    echo "用法: $0 <skill-name>"
    echo ""
    echo "可用的 skills:"
    list_skills | sed 's/^/  /'
    exit 0
fi

SKILL_NAME="$1"
SOURCE_DIR="$SKILLS_SOURCE_DIR/$SKILL_NAME"

if [ ! -f "$SOURCE_DIR/SKILL.md" ]; then
    echo "❌ skill 不存在: $SKILL_NAME"
    echo ""
    echo "可用的 skills:"
    list_skills | sed 's/^/  /'
    exit 1
fi

install_to() {
    local target_dir="$1"
    mkdir -p "$target_dir"
    rm -rf "$target_dir"
    mkdir -p "$target_dir"
    (cd "$SOURCE_DIR" && tar --exclude='node_modules' -cf - .) | (cd "$target_dir" && tar -xf -)
    find "$target_dir" -type f -name "*.sh" -exec chmod +x {} \;

    if [ -f "$target_dir/package.json" ]; then
        echo "   📦 安装 npm 依赖..."
        (cd "$target_dir" && npm install --production --registry=https://registry.npmmirror.com 2>&1 | grep -v "npm warn")
    fi
}

echo "🚀 安装 skill: $SKILL_NAME"
echo ""

# 安装到 ~/.claude/skills/
CLAUDE_TARGET="$HOME/.claude/skills/$SKILL_NAME"
echo "📁 安装到 ~/.claude/skills/$SKILL_NAME ..."
install_to "$CLAUDE_TARGET"
echo "   ✅ 完成"

# 安装到 ~/.codex/skills/（目录存在才执行）
CODEX_SKILLS_DIR="${CODEX_HOME:-$HOME/.codex}/skills"
if [ -d "$CODEX_SKILLS_DIR" ]; then
    CODEX_TARGET="$CODEX_SKILLS_DIR/$SKILL_NAME"
    echo "📁 安装到 $CODEX_SKILLS_DIR/$SKILL_NAME ..."
    install_to "$CODEX_TARGET"
    echo "   ✅ 完成"
fi

echo ""
echo "✅ skill 安装完成: $SKILL_NAME"
