#!/bin/bash

# Xiaoer AI DevKit 安装脚本
# 用于配置 Claude Code 的 Commands、Agents 和 Skills

set -e

# 解析参数
USE_SYMLINK=true

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --copy         使用复制模式而不是软链接"
    echo "  --help, -h     显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0              # 默认软链接模式"
    echo "  $0 --copy       # 使用复制模式"
}

for arg in "$@"; do
    case $arg in
        --copy)
            USE_SYMLINK=false
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "❌ 错误: 不支持的参数 '$arg'"
            show_help
            exit 1
            ;;
    esac
done

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🚀 Xiaoer AI DevKit 安装配置..."
echo ""

# ========== Commands 配置 ==========
echo "📁 配置 Commands..."
CLAUDE_COMMANDS_DIR="$HOME/.claude/commands"
mkdir -p "$CLAUDE_COMMANDS_DIR"

if [ -d "$SCRIPT_DIR/claude/commands" ]; then
    echo "🔍 扫描 claude/commands 目录..."

    # 清理旧链接
    for item in "$CLAUDE_COMMANDS_DIR"/*; do
        if [ -L "$item" ] || [ -d "$item" ]; then
            echo "   🗑️  清理: $(basename "$item")"
            rm -rf "$item"
        fi
    done

    # 遍历子目录
    for subdir in "$SCRIPT_DIR/claude/commands"/*; do
        if [ -d "$subdir" ]; then
            subdir_name=$(basename "$subdir")
            echo "   📂 处理: $subdir_name"

            if [ "$USE_SYMLINK" = true ]; then
                ln -sf "$subdir" "$CLAUDE_COMMANDS_DIR/$subdir_name"
                echo "   🔗 已链接: $subdir_name"
            else
                mkdir -p "$CLAUDE_COMMANDS_DIR/$subdir_name"
                for file in "$subdir"/*; do
                    if [ -f "$file" ]; then
                        cp "$file" "$CLAUDE_COMMANDS_DIR/$subdir_name/"
                        echo "   ✅ 已复制: $(basename "$file")"
                    fi
                done
            fi
        fi
    done
    echo "✅ Commands 配置完成"
else
    echo "⚠️  警告: claude/commands 目录不存在"
fi

echo ""

# ========== Agents 配置 ==========
echo "📁 配置 Agents..."
CLAUDE_AGENTS_DIR="$HOME/.claude/agents"
mkdir -p "$CLAUDE_AGENTS_DIR"

if [ -d "$SCRIPT_DIR/claude/agents" ]; then
    # 清理旧链接
    for item in "$CLAUDE_AGENTS_DIR"/*; do
        if [ -L "$item" ] || [ -f "$item" ]; then
            echo "   🗑️  清理: $(basename "$item")"
            rm -f "$item"
        fi
    done

    if [ "$USE_SYMLINK" = true ]; then
        for agent_file in "$SCRIPT_DIR/claude/agents"/*; do
            if [ -e "$agent_file" ]; then
                filename=$(basename "$agent_file")
                ln -sf "$agent_file" "$CLAUDE_AGENTS_DIR/$filename"
                echo "   🔗 已链接: $filename"
            fi
        done
        echo "✅ Agents 配置完成 (软链接模式)"
    else
        cp -r "$SCRIPT_DIR/claude/agents"/* "$CLAUDE_AGENTS_DIR/"
        echo "✅ Agents 配置完成 (复制模式)"
    fi
else
    echo "⚠️  警告: claude/agents 目录不存在"
fi

echo ""

# ========== Skills 配置 ==========
echo "📁 配置 Skills..."
CLAUDE_SKILLS_DIR="$HOME/.claude/skills"
mkdir -p "$CLAUDE_SKILLS_DIR"

if [ -d "$SCRIPT_DIR/claude/skills" ] && [ "$(ls -A $SCRIPT_DIR/claude/skills 2>/dev/null)" ]; then
    # Skills 使用复制模式（因为有 node_modules）
    (cd "$SCRIPT_DIR/claude/skills" && tar --exclude='node_modules' -cf - .) | (cd "$CLAUDE_SKILLS_DIR" && tar -xf -)
    echo "✅ Skills 配置完成 (复制模式)"

    # 设置执行权限
    find "$CLAUDE_SKILLS_DIR" -type f -name "*.sh" -exec chmod +x {} \;
    echo "✅ 已设置脚本执行权限"
else
    echo "⚠️  警告: claude/skills 目录为空或不存在"
fi

echo ""
echo "🎉 安装配置完成！"
echo ""
echo "📋 已配置："
echo "   • Commands → ~/.claude/commands/"
echo "   • Agents → ~/.claude/agents/"
echo "   • Skills → ~/.claude/skills/"
echo ""
if [ "$USE_SYMLINK" = true ]; then
    echo "💡 模式: 软链接（仓库更新后自动生效）"
else
    echo "💡 模式: 复制（更新需重新运行脚本）"
fi
echo ""
echo "🔧 使用方法："
echo "   • Command: /xe:command-name"
echo "   • Agent:  Task(xe-task-executor, ...)"
echo ""
