#!/bin/bash
# =============================================================================
# Memory Search - 搜索项目 memory 和 git 历史
# =============================================================================

set -e

# 默认参数
LIMIT=50
MEMORY_ONLY=false
GIT_ONLY=false
KEYWORDS=""

# =============================================================================
# 解析参数
# =============================================================================
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --memory-only)
                MEMORY_ONLY=true
                shift
                ;;
            --git-only)
                GIT_ONLY=true
                shift
                ;;
            --limit)
                LIMIT="$2"
                shift 2
                ;;
            *)
                if [ -z "$KEYWORDS" ]; then
                    KEYWORDS="$1"
                else
                    KEYWORDS="$KEYWORDS $1"
                fi
                shift
                ;;
        esac
    done

    if [ -z "$KEYWORDS" ]; then
        echo "Usage: $0 <keywords> [--memory-only] [--git-only] [--limit N]"
        exit 1
    fi
}

# =============================================================================
# 搜索 Memory 文件
# =============================================================================
search_memory() {
    local memory_dir=".claude/memory"
    local found=false

    if [ ! -d "$memory_dir" ]; then
        echo "> Memory 目录不存在: $memory_dir"
        echo ""
        return
    fi

    # 检查是否有 md 文件
    if ! ls "$memory_dir"/*.md >/dev/null 2>&1; then
        echo "> Memory 目录为空"
        echo ""
        return
    fi

    echo "## Memory 搜索结果"
    echo ""

    # 将关键词拆分为数组
    local keywords_array=($KEYWORDS)
    local first_keyword="${keywords_array[0]}"

    # 先用第一个关键词搜索，再用其他关键词过滤
    local results=""
    results=$(grep -rni "$first_keyword" "$memory_dir"/*.md 2>/dev/null || true)

    # 用剩余关键词过滤
    for keyword in "${keywords_array[@]:1}"; do
        if [ -n "$results" ]; then
            results=$(echo "$results" | grep -i "$keyword" || true)
        fi
    done

    if [ -z "$results" ]; then
        echo "> 无匹配结果"
        echo ""
        return
    fi

    # 按文件分组输出
    local current_file=""
    while IFS= read -r line; do
        # 提取文件名
        local file=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        if [ "$file" != "$current_file" ]; then
            if [ -n "$current_file" ]; then
                echo ""
            fi
            echo "### $(basename "$file")"
            echo ""
            current_file="$file"
        fi

        # 输出匹配行（去掉行号前缀，保留内容）
        local line_content=$(echo "$content" | sed 's/^[0-9]*://')
        echo "$line_content"
    done <<< "$results"

    echo ""
}

# =============================================================================
# 搜索 Git 历史
# =============================================================================
search_git() {
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo "> 当前目录不是 git 仓库"
        echo ""
        return
    fi

    echo "## Git 历史匹配"
    echo ""

    local keywords_array=($KEYWORDS)
    local results=""

    # 对每个关键词搜索，合并结果
    for keyword in "${keywords_array[@]}"; do
        local keyword_results=$(git log --grep="$keyword" -n "$LIMIT" --oneline --all 2>/dev/null || true)
        if [ -n "$keyword_results" ]; then
            if [ -z "$results" ]; then
                results="$keyword_results"
            else
                # 取交集（同时匹配所有关键词的 commit）
                local temp_results=""
                while IFS= read -r commit_line; do
                    local hash=$(echo "$commit_line" | cut -d' ' -f1)
                    if echo "$results" | grep -q "^$hash "; then
                        temp_results="$temp_results$commit_line"$'\n'
                    fi
                done <<< "$keyword_results"
                results="$temp_results"
            fi
        fi
    done

    if [ -z "$results" ]; then
        echo "> 无匹配 commit"
        echo ""
        return
    fi

    echo "| Commit | Message |"
    echo "|--------|---------|"

    echo "$results" | head -n "$LIMIT" | while IFS= read -r line; do
        if [ -n "$line" ]; then
            local hash=$(echo "$line" | cut -d' ' -f1)
            local msg=$(echo "$line" | cut -d' ' -f2-)
            echo "| $hash | $msg |"
        fi
    done

    echo ""
}

# =============================================================================
# 主函数
# =============================================================================
main() {
    parse_args "$@"

    echo "# Memory Search: \"$KEYWORDS\""
    echo ""

    if [ "$GIT_ONLY" = false ]; then
        search_memory
    fi

    if [ "$MEMORY_ONLY" = false ]; then
        search_git
    fi
}

main "$@"
