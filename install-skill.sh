#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILLS_SOURCE_DIR="$SCRIPT_DIR/claude/skills"

list_skills() {
    ls "$SKILLS_SOURCE_DIR" 2>/dev/null | sort
}

if [ -z "$1" ]; then
    echo "用法: $0 <skill-name> [skill-name...]"
    echo ""
    echo "可用的 skills:"
    list_skills | sed 's/^/  /'
    exit 0
fi

install_to() {
    local source_dir="$1"
    local target_dir="$2"

    mkdir -p "$target_dir"
    rm -rf "$target_dir"
    mkdir -p "$target_dir"
    (cd "$source_dir" && tar --exclude='node_modules' -cf - .) | (cd "$target_dir" && tar -xf -)
    find "$target_dir" -type f -name "*.sh" -exec chmod +x {} \;

    if [ -f "$target_dir/package.json" ]; then
        echo "   📦 安装 npm 依赖..."
        (cd "$target_dir" && npm install --production --registry=https://registry.npmmirror.com 2>&1 | grep -v "npm warn")
    fi
}

install_skill() {
    local skill_name="$1"
    local source_dir="$SKILLS_SOURCE_DIR/$skill_name"

    if [ ! -f "$source_dir/SKILL.md" ]; then
        echo "❌ skill 不存在: $skill_name"
        echo ""
        echo "可用的 skills:"
        list_skills | sed 's/^/  /'
        exit 1
    fi

    echo "🚀 安装 skill: $skill_name"
    echo ""

    # 安装到 ~/.claude/skills/
    local claude_target="$HOME/.claude/skills/$skill_name"
    echo "📁 安装到 ~/.claude/skills/$skill_name ..."
    install_to "$source_dir" "$claude_target"
    echo "   ✅ 完成"

    # 安装到 ~/.codex/skills/（目录存在才执行）
    local codex_skills_dir="${CODEX_HOME:-$HOME/.codex}/skills"
    if [ -d "$codex_skills_dir" ]; then
        local codex_target="$codex_skills_dir/$skill_name"
        echo "📁 安装到 $codex_skills_dir/$skill_name ..."
        install_to "$source_dir" "$codex_target"
        echo "   ✅ 完成"
    fi

    echo ""
    echo "✅ skill 安装完成: $skill_name"
}

for skill_name in "$@"; do
    install_skill "$skill_name"
done
