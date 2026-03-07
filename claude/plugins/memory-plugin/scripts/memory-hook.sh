#!/bin/bash
# =============================================================================
# Memory Hook - 基于 Claude Code Hooks 的 Memory 系统
# =============================================================================
# 触发事件: PreCompact, SessionEnd
# 功能: 读取 session transcript，调用 LLM 提取用户偏好和采纳决策，保存到 memory 文件
#
# 环境变量:
#   XM_LLM_API_BASE - LLM API Base URL (默认内部 API)
#   XM_LLM_API_KEY  - LLM API Key (有默认值)
#   XM_LLM_MODEL    - LLM 模型名称 (默认 kimi-k2.5)
#   MEMORY_HOOK_DEBUG - 设为 1 开启调试日志
#
# 输出文件:
#   {cwd}/.claude/memory/memory-{yyyyMMdd}.md - 每日 memory
#   {cwd}/.claude/memory/memory.md            - 主 memory (限制 1000 行)
# =============================================================================

# 严格模式：遇到错误不立即退出，由 trap 处理
set +e

# =============================================================================
# 配置
# =============================================================================
MAX_MEMORY_LINES=1000
MAX_TRANSCRIPT_CHARS=100000
LOG_FILE="$HOME/.claude/logs/memory-hook.log"

# =============================================================================
# 错误处理
# =============================================================================
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Hook exited with code $exit_code"
    fi
    exit 0  # 始终返回 0，不阻塞 Claude Code
}
trap cleanup EXIT

# =============================================================================
# 日志函数
# =============================================================================
ensure_log_dir() {
    local log_dir=$(dirname "$LOG_FILE")
    if [ ! -d "$log_dir" ]; then
        mkdir -p "$log_dir" 2>/dev/null || true
    fi
}

log() {
    ensure_log_dir
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $*" >> "$LOG_FILE" 2>/dev/null || true
}

log_error() {
    log "ERROR: $*"
}

log_debug() {
    if [ "${MEMORY_HOOK_DEBUG:-0}" = "1" ]; then
        log "DEBUG: $*"
    fi
}

# =============================================================================
# 解析输入
# =============================================================================
parse_input() {
    log "Reading input from stdin..."
    INPUT=$(cat)

    if [ -z "$INPUT" ]; then
        log_error "Empty input received"
        exit 0
    fi

    log_debug "Raw input: $INPUT"

    TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
    CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
    EVENT_NAME=$(echo "$INPUT" | jq -r '.hook_event_name // empty')

    # 验证必需字段
    if [ -z "$TRANSCRIPT_PATH" ]; then
        log_error "Missing required field: transcript_path"
        exit 0
    fi

    if [ -z "$CWD" ]; then
        log_error "Missing required field: cwd"
        exit 0
    fi

    if [ ! -f "$TRANSCRIPT_PATH" ]; then
        log_error "Transcript file not found: $TRANSCRIPT_PATH"
        exit 0
    fi

    log "Parsed input - Event: $EVENT_NAME, Session: $SESSION_ID"
    log "Transcript: $TRANSCRIPT_PATH"
    log "CWD: $CWD"
}

# =============================================================================
# 读取 Transcript
# =============================================================================
read_transcript() {
    log "Reading transcript file..."

    # 检查文件是否为空
    if [ ! -s "$TRANSCRIPT_PATH" ]; then
        log "Transcript file is empty"
        exit 0
    fi

    # 提取 user 和 assistant 消息
    # transcript 是 JSONL 格式，每行一个 JSON 对象
    CONVERSATION=$(jq -s '
        [.[] | select(.type == "user" or .type == "assistant")] |
        map(
            if .type == "user" then
                "User: " + ((.message // .content // .text // "") | tostring)
            else
                "Assistant: " + ((.message // .content // .text // "") | tostring)[0:2000]
            end
        ) |
        join("\n\n")
    ' "$TRANSCRIPT_PATH" 2>/dev/null)

    if [ -z "$CONVERSATION" ] || [ "$CONVERSATION" = '""' ] || [ "$CONVERSATION" = "null" ]; then
        log "No conversation found in transcript"
        exit 0
    fi

    # 统计用户消息条数（仅统计 user）
    local user_msg_count=$(jq -s '[.[] | select(.type == "user")] | length' "$TRANSCRIPT_PATH" 2>/dev/null)
    log "User message count: $user_msg_count"

    # 统计用户消息总字符数
    local user_chars=$(jq -s '
        [.[] | select(.type == "user")] |
        map((.message // .content // .text // "") | tostring | length) |
        add // 0
    ' "$TRANSCRIPT_PATH" 2>/dev/null)
    log "User input chars: $user_chars"

    # 仅当用户消息 > 3 且用户总输入字符数 > 200 才更新 memory
    # 任一条件不满足都直接结束，并记录日志
    if [ "$user_msg_count" -le 3 ]; then
        log "Skip memory update: user message count too few ($user_msg_count <= 3)"
        exit 0
    fi

    if [ "$user_chars" -le 200 ]; then
        log "Skip memory update: user input chars too short ($user_chars <= 200)"
        exit 0
    fi

    # 限制字符数
    CONVERSATION=$(echo "$CONVERSATION" | head -c "$MAX_TRANSCRIPT_CHARS")

    local conv_length=${#CONVERSATION}
    log "Extracted conversation: $conv_length chars"
}

# =============================================================================
# 调用 LLM
# =============================================================================
call_llm() {
    local api_base="${XM_LLM_API_BASE:-https://litellm-test.summerfarm.net/v1}"
    local api_key="${XM_LLM_API_KEY:-sk-x68Xp8HoNeZdJ3xTGOCCbg}"
    local model="${XM_LLM_MODEL:-kimi-k2.5}"

    if [ -z "$api_key" ]; then
        log_error "XM_LLM_API_KEY environment variable not set"
        exit 0
    fi

    log "Calling LLM API: $api_base (model: $model)"

    # 构造 prompt - 直接返回 Markdown 格式
    local prompt='分析以下 Claude Code session，提取三类信息：

**1. 用户偏好** - 用户明确表达的工作方式要求
**2. 技术决策** - 被采纳的架构/设计/实现方案
**3. 功能变更** - 本次 session 完成的代码改动

**输出规则：**
- 格式：`- [偏好/决策/变更] 简短描述`
- 每条≤20字，只保留核心信息
- 功能变更需体现：改了什么、为什么改
- 无有价值内容则输出：无

**示例：**
- [偏好] 禁止添加冗余注释
- [决策] 用hooks实现memory系统
- [变更] 新增LLM智能清理memory功能

--- session 开始 ---
'"$CONVERSATION"'
--- session 结束 ---'

    # 使用 jq 构造请求 JSON，确保正确转义
    local request_body=$(jq -n \
        --arg model "$model" \
        --arg content "$prompt" \
        '{
            model: $model,
            messages: [{role: "user", content: $content}]
        }')

    log_debug "Request body length: ${#request_body}"

    # 调用 API
    LLM_RESPONSE=$(curl -s -X POST "${api_base}/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${api_key}" \
        -d "$request_body" \
        --max-time 120 \
        --retry 2 \
        --retry-delay 5)

    if [ -z "$LLM_RESPONSE" ]; then
        log_error "Empty response from LLM API"
        exit 0
    fi

    log_debug "LLM response: $LLM_RESPONSE"

    # 检查是否有错误
    local error_msg=$(echo "$LLM_RESPONSE" | jq -r '.error.message // empty')
    if [ -n "$error_msg" ]; then
        log_error "LLM API error: $error_msg"
        exit 0
    fi

    # 解析响应内容 - 直接获取 Markdown 文本
    MEMORY_TEXT=$(echo "$LLM_RESPONSE" | jq -r '.choices[0].message.content // empty')

    if [ -z "$MEMORY_TEXT" ] || [ "$MEMORY_TEXT" = "null" ]; then
        log_error "Failed to extract content from LLM response"
        log_debug "Full response: $LLM_RESPONSE"
        exit 0
    fi

    # 检查是否有实际内容（不是"无"）
    if [ "$MEMORY_TEXT" = "无" ] || [ "$MEMORY_TEXT" = "无。" ]; then
        log "LLM determined no valuable memory to save"
        exit 0
    fi

    # 检查是否包含有效的 memory 条目（偏好/决策/变更）
    if ! echo "$MEMORY_TEXT" | grep -qE "^\- \[(偏好|决策|变更)\]"; then
        log "No valid memory entries found in LLM response"
        log_debug "Response text: $MEMORY_TEXT"
        exit 0
    fi

    local entry_count=$(echo "$MEMORY_TEXT" | grep -cE "^\- \[(偏好|决策|变更)\]" || echo "0")
    log "LLM extracted $entry_count memory entries"
}

# =============================================================================
# 写入每日 Memory
# =============================================================================
write_daily_memory() {
    local today=$(date '+%Y%m%d')
    local date_display=$(date '+%Y-%m-%d')
    local time_display=$(date '+%H:%M:%S')
    local memory_dir="$CWD/.claude/memory"
    local daily_file="$memory_dir/memory-$today.md"

    log "Writing daily memory to $daily_file"

    # 创建目录
    mkdir -p "$memory_dir"

    # 如果文件不存在，添加头部
    if [ ! -f "$daily_file" ]; then
        {
            echo "# Memory - $date_display"
            echo ""
            echo "> 当日自动记录的用户偏好和项目决策"
            echo ""
        } > "$daily_file"
    fi

    # 追加本次记录 - 直接写入 LLM 返回的 Markdown 文本
    {
        echo ""
        echo "---"
        echo ""
        echo "### Session @ $time_display"
        echo ""
        echo "$MEMORY_TEXT"
        echo ""
    } >> "$daily_file"

    log "Daily memory updated"
}

# =============================================================================
# 合并到主 Memory（使用 LLM 智能合并）
# =============================================================================
merge_memory() {
    local memory_dir="$CWD/.claude/memory"
    local main_file="$memory_dir/memory.md"
    local today=$(date '+%Y-%m-%d')

    log "Merging to main memory: $main_file"

    # 为新 memory 条目添加日期后缀
    local new_memory_with_date=$(echo "$MEMORY_TEXT" | while IFS= read -r line; do
        if [[ "$line" =~ ^-\ \[ ]]; then
            echo "${line% } ($today)"
        elif [ -n "$line" ]; then
            echo "$line"
        fi
    done)

    # 如果主文件不存在，直接创建
    if [ ! -f "$main_file" ]; then
        log "Main memory file not exists, creating new one"
        {
            echo "# Project Memory"
            echo ""
            echo "> 此文件由 Claude Code Memory Hook 自动生成和更新。"
            echo "> 记录用户偏好和项目决策，帮助 Claude 更好地理解用户需求。"
            echo ""
            echo "---"
            echo ""
            echo "$new_memory_with_date"
        } > "$main_file"
        log "Main memory created"
        return
    fi

    # 读取现有主 memory
    local existing_memory=$(cat "$main_file")

    # 调用 LLM 智能合并
    log "Calling LLM to merge new memory with existing memory..."
    local merged_memory=$(call_llm_for_merge "$existing_memory" "$new_memory_with_date")

    if [ -n "$merged_memory" ] && [ "$merged_memory" != "null" ]; then
        echo "$merged_memory" > "$main_file"
        local new_lines=$(wc -l < "$main_file" | tr -d ' ')
        log "LLM merged memory successfully, total lines: $new_lines"
    else
        log_error "LLM merge failed, falling back to simple append"
        # 回退：直接追加
        {
            echo ""
            echo "$new_memory_with_date"
        } >> "$main_file"
        # 检查是否需要裁剪
        trim_memory "$main_file"
    fi

    log "Main memory updated"
}

# =============================================================================
# LLM 智能合并 Memory
# =============================================================================
call_llm_for_merge() {
    local existing_memory="$1"
    local new_memory="$2"
    local api_base="${XM_LLM_API_BASE:-https://litellm-test.summerfarm.net/v1}"
    local api_key="${XM_LLM_API_KEY:-sk-x68Xp8HoNeZdJ3xTGOCCbg}"
    local model="${XM_LLM_MODEL:-kimi-k2.5}"

    local prompt='将新 Memory 合并到现有 Memory 中，输出合并后的完整文件。

**合并规则：**
1. **冲突处理**：如果新旧记录冲突，用新记录替换旧记录（新的是最新决策）
2. **去重**：相同或高度相似的条目只保留一条（保留最新日期）
3. **保持格式**：保持 `- [偏好/决策/变更] 描述 (日期)` 格式
4. **行数限制**：合并后总行数≤800行，超出时移除最旧的琐碎条目
5. **保留重要**：架构决策、核心偏好必须保留

**输出要求：**
- 直接输出合并后的完整 Markdown 文件
- 保留文件头部说明
- 无需额外解释

--- 现有 Memory ---
'"$existing_memory"'
--- 现有 Memory 结束 ---

--- 新 Memory ---
'"$new_memory"'
--- 新 Memory 结束 ---'

    local request_body=$(jq -n \
        --arg model "$model" \
        --arg content "$prompt" \
        '{
            model: $model,
            messages: [{role: "user", content: $content}]
        }')

    local response=$(curl -s -X POST "${api_base}/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${api_key}" \
        -d "$request_body" \
        --max-time 120)

    if [ -z "$response" ]; then
        log_error "Empty response from LLM API during merge"
        return 1
    fi

    local error_msg=$(echo "$response" | jq -r '.error.message // empty')
    if [ -n "$error_msg" ]; then
        log_error "LLM API error during merge: $error_msg"
        return 1
    fi

    echo "$response" | jq -r '.choices[0].message.content // empty'
}

# =============================================================================
# 限制 Memory 行数（使用 LLM 智能清理）
# =============================================================================
trim_memory() {
    local file="$1"
    local current_lines=$(wc -l < "$file" | tr -d ' ')

    if [ "$current_lines" -gt "$MAX_MEMORY_LINES" ]; then
        log "Memory file has $current_lines lines (limit: $MAX_MEMORY_LINES), calling LLM to clean up..."

        # 读取当前 memory 内容
        local memory_content=$(cat "$file")

        # 调用 LLM 进行智能清理
        local cleaned_content=$(call_llm_for_cleanup "$memory_content")

        if [ -n "$cleaned_content" ] && [ "$cleaned_content" != "null" ]; then
            echo "$cleaned_content" > "$file"
            local new_lines=$(wc -l < "$file" | tr -d ' ')
            log "LLM cleaned memory: $current_lines -> $new_lines lines"
        else
            log_error "LLM cleanup failed, falling back to simple trim"
            # 回退到简单裁剪
            simple_trim "$file"
        fi
    fi
}

# =============================================================================
# LLM 智能清理 Memory
# =============================================================================
call_llm_for_cleanup() {
    local memory_content="$1"
    local api_base="${XM_LLM_API_BASE:-https://litellm-test.summerfarm.net/v1}"
    local api_key="${XM_LLM_API_KEY:-sk-x68Xp8HoNeZdJ3xTGOCCbg}"
    local model="${XM_LLM_MODEL:-kimi-k2.5}"

    local prompt='精简以下 Project Memory，目标≤800行。

**规则（按优先级）：**
1. 合并重复条目（保留最新日期）
2. 移除被覆盖的旧决策
3. 合并高度相关的条目
4. 优先保留：架构决策、核心偏好、重要变更
5. 可移除：琐碎细节、一次性操作

**格式要求：**
- 保持`- [偏好/决策/变更] 描述 (日期)`格式
- 每条≤20字
- 直接输出精简后内容，无需解释

--- 原文 ---
'"$memory_content"'
--- 结束 ---'

    local request_body=$(jq -n \
        --arg model "$model" \
        --arg content "$prompt" \
        '{
            model: $model,
            messages: [{role: "user", content: $content}]
        }')

    local response=$(curl -s -X POST "${api_base}/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${api_key}" \
        -d "$request_body" \
        --max-time 120)

    if [ -z "$response" ]; then
        log_error "Empty response from LLM API during cleanup"
        return 1
    fi

    local error_msg=$(echo "$response" | jq -r '.error.message // empty')
    if [ -n "$error_msg" ]; then
        log_error "LLM API error during cleanup: $error_msg"
        return 1
    fi

    echo "$response" | jq -r '.choices[0].message.content // empty'
}

# =============================================================================
# 简单裁剪（回退方案）
# =============================================================================
simple_trim() {
    local file="$1"
    local header_lines=15
    local keep_lines=$((MAX_MEMORY_LINES - header_lines))

    {
        head -n "$header_lines" "$file"
        echo ""
        echo "<!-- ... earlier entries trimmed ... -->"
        echo ""
        tail -n "$keep_lines" "$file"
    } > "$file.tmp"

    mv "$file.tmp" "$file"
    log "Simple trim completed"
}

# =============================================================================
# 主函数
# =============================================================================
main() {
    log "=========================================="
    log "Memory hook started"
    log "=========================================="

    parse_input
    read_transcript
    call_llm
    write_daily_memory
    merge_memory

    log "Memory hook completed successfully"
    log "=========================================="
}

# 执行主函数
main
