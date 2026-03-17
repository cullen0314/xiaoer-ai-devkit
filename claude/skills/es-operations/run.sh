#!/bin/bash

# Elasticsearch 操作工具 - 安全执行 ES 索引操作
# 用法: bash run.sh <operation> [arguments...]

set -e

# ==================== 默认 ES 配置 ====================
DEFAULT_ES_HOST="dev.es.summerfarm.net"
DEFAULT_ES_PORT="80"
DEFAULT_ES_SCHEME="http"
DEFAULT_ES_USER="elastic"
DEFAULT_ES_PASSWORD="Xianmu619"

# 当前使用的 ES 配置（初始为默认值）
ES_HOST="$DEFAULT_ES_HOST"
ES_PORT="$DEFAULT_ES_PORT"
ES_SCHEME="$DEFAULT_ES_SCHEME"
ES_USER="$DEFAULT_ES_USER"
ES_PASSWORD="$DEFAULT_ES_PASSWORD"

# ==================== 辅助函数 ====================

# 显示帮助信息
show_help() {
    cat << 'EOF'
Elasticsearch 操作工具

用法:
  bash run.sh search <index> <query>        查询文档
  bash run.sh index <index> <document>      创建/更新文档
  bash run.sh update <index> <id> <document> 部分更新文档
  bash run.sh delete <index> <id>           删除文档
  bash run.sh bulk <data>                   批量操作
  bash run.sh --help                        显示帮助信息

参数说明:
  index    - 索引名称
  query    - Elasticsearch DSL 查询语句 (JSON 格式)
  document - 文档内容 (JSON 格式)
  id       - 文档 ID
  data     - Bulk 操作数据 (NDJSON 格式)

示例:
  # 查询所有文档
  bash run.sh search "orders" '{"query": {"match_all": {}}, "size": 10}'

  # 创建文档
  bash run.sh index "users" '{"name": "张三", "age": 25}'

  # 更新文档
  bash run.sh update "users" "123" '{"doc": {"age": 26}}'

  # 删除文档
  bash run.sh delete "users" "123"

  # 批量操作
  bash run.sh bulk '{"index": {"_index": "users", "_id": "1"}}
{"name": "张三"}'

配置:
  修改脚本中的 DEFAULT_ES_* 变量来设置默认连接参数
EOF
}

# 构建完整的 ES URL
build_es_url() {
    local endpoint="$1"
    local url="${ES_SCHEME}://"

    if [ -n "$ES_USER" ] && [ -n "$ES_PASSWORD" ]; then
        url="${url}${ES_USER}:${ES_PASSWORD}@"
    fi

    url="${url}${ES_HOST}:${ES_PORT}${endpoint}"
    echo "$url"
}

# 执行 ES 请求
execute_es_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local url

    url=$(build_es_url "$endpoint")

    if [ -n "$data" ]; then
        curl -s -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" "$url" \
            -H "Content-Type: application/json"
    fi
}

# 格式化输出结果
format_output() {
    local result="$1"
    local format="${2:-json}"

    if ! echo "$result" | jq . >/dev/null 2>&1; then
        echo "$result"
        return
    fi

    case "$format" in
        table)
            # 尝试将 hits 转换为表格
            local hits
            hits=$(echo "$result" | jq -r '.hits.hits[]? | ._source | @json' 2>/dev/null || echo "")
            if [ -n "$hits" ]; then
                echo "$hits" | jq -r '[
                    (to_entries | map(.key) | @tsv),
                    ([.[] | to_entries | map(.value | @json) | @tsv])
                ] | @tsv' | column -t -s $'\t'
            else
                echo "$result" | jq .
            fi
            ;;
        pretty|*)
            echo "$result" | jq .
            ;;
    esac
}

# 检查并确认危险操作
confirm_dangerous_operation() {
    local operation="$1"
    local details="$2"

    echo "⚠️  即将执行 $operation 操作"
    echo "📋 操作详情:"
    echo "$details"
    echo ""
    echo "⚠️  此操作将修改数据，是否继续？"
    echo -n "请输入 'yes' 确认: "

    read -r response
    if [ "$response" != "yes" ] && [ "$response" != "y" ]; then
        echo "❌ 操作已取消"
        exit 1
    fi
}

# ==================== 操作函数 ====================

# Search 查询
operation_search() {
    local index="$1"
    local query="$2"

    if [ -z "$index" ]; then
        echo "❌ 错误: 缺少索引名称"
        echo "用法: bash run.sh search <index> <query>"
        exit 1
    fi

    if [ -z "$query" ]; then
        query='{"query": {"match_all": {}}, "size": 10}'
    fi

    echo "🔍 查询索引: $index"
    echo "📋 查询条件: $query"
    echo ""

    local result
    result=$(execute_es_request "POST" "/${index}/_search" "$query")
    format_output "$result"

    # 显示统计信息
    local total
    total=$(echo "$result" | jq -r '.hits.total.value // .hits.total // "N/A"' 2>/dev/null || echo "N/A")
    echo ""
    echo "📊 命中总数: $total"
}

# Index 创建/更新文档
operation_index() {
    local index="$1"
    local document="$2"
    local doc_id="$3"

    if [ -z "$index" ] || [ -z "$document" ]; then
        echo "❌ 错误: 缺少必要参数"
        echo "用法: bash run.sh index <index> <document> [--id <doc_id>]"
        exit 1
    fi

    local details="索引: $index\n文档内容: $document"
    if [ -n "$doc_id" ]; then
        details="$details\n文档 ID: $doc_id"
    fi

    confirm_dangerous_operation "Index (创建/更新文档)" "$details"

    local endpoint="/${index}"
    if [ -n "$doc_id" ]; then
        endpoint="${endpoint}/_create/${doc_id}"
    fi

    local result
    result=$(execute_es_request "POST" "$endpoint" "$document")

    echo "✅ 操作完成"
    echo "$result" | jq .

    # 提取文档 ID
    local result_id
    result_id=$(echo "$result" | jq -r '._id // empty' 2>/dev/null)
    if [ -n "$result_id" ]; then
        echo ""
        echo "📄 文档 ID: $result_id"
    fi
}

# Update 部分更新文档
operation_update() {
    local index="$1"
    local doc_id="$2"
    local document="$3"

    if [ -z "$index" ] || [ -z "$doc_id" ] || [ -z "$document" ]; then
        echo "❌ 错误: 缺少必要参数"
        echo "用法: bash run.sh update <index> <doc_id> <document>"
        exit 1
    fi

    local details="索引: $index\n文档 ID: $doc_id\n更新内容: $document"

    confirm_dangerous_operation "Update (部分更新文档)" "$details"

    local result
    result=$(execute_es_request "POST" "/${index}/_update/${doc_id}" "$document")

    echo "✅ 操作完成"
    echo "$result" | jq .
}

# Delete 删除文档
operation_delete() {
    local index="$1"
    local doc_id="$2"

    if [ -z "$index" ] || [ -z "$doc_id" ]; then
        echo "❌ 错误: 缺少必要参数"
        echo "用法: bash run.sh delete <index> <doc_id>"
        exit 1
    fi

    local details="索引: $index\n文档 ID: $doc_id"

    confirm_dangerous_operation "Delete (删除文档)" "$details"

    local result
    result=$(execute_es_request "DELETE" "/${index}/_doc/${doc_id}")

    echo "✅ 操作完成"
    echo "$result" | jq .

    # 检查删除结果
    local found
    found=$(echo "$result" | jq -r '.result // empty' 2>/dev/null)
    if [ "$found" = "deleted" ]; then
        echo ""
        echo "🗑️  文档已删除"
    fi
}

# Bulk 批量操作
operation_bulk() {
    local data="$1"

    if [ -z "$data" ]; then
        echo "❌ 错误: 缺少批量数据"
        echo "用法: bash run.sh bulk <data>"
        exit 1
    fi

    # 统计操作数量
    local lines
    lines=$(echo "$data" | grep -c "^{" || echo "0")
    local operations=$((lines / 2))

    local details="操作数量: $operations\n数据预览:\n$(echo "$data" | head -4)"

    confirm_dangerous_operation "Bulk (批量操作)" "$details"

    local result
    result=$(execute_es_request "POST" "/_bulk" "$data")

    echo "✅ 操作完成"

    # 显示批量操作结果摘要
    local errors
    errors=$(echo "$result" | jq -r '.errors // "false"' 2>/dev/null)

    if [ "$errors" = "false" ]; then
        echo "📊 所有操作成功"
    else
        echo "⚠️  部分操作失败，请查看详细结果"
    fi

    echo "$result" | jq .
}

# ==================== 主程序 ====================

main() {
    # 检查是否安装了依赖
    if ! command -v curl &> /dev/null; then
        echo "❌ 错误: 未找到 curl 命令"
        echo "请先安装 curl: brew install curl"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo "❌ 错误: 未找到 jq 命令"
        echo "请先安装 jq: brew install jq"
        exit 1
    fi

    # 检查 ES 连接
    local health_url
    health_url=$(build_es_url "/_cluster/health")

    if ! curl -s "$health_url" | jq . >/dev/null 2>&1; then
        echo "⚠️  警告: 无法连接到 Elasticsearch"
        echo "📍 连接地址: ${ES_SCHEME}://${ES_HOST}:${ES_PORT}"
        echo "请检查 ES 是否正常运行以及配置是否正确"
        echo ""
    fi

    # 解析命令
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi

    local operation="$1"
    shift

    case "$operation" in
        -h|--help|help)
            show_help
            exit 0
            ;;
        search)
            operation_search "$@"
            ;;
        index)
            local index="$1"
            local document="$2"
            local doc_id=""

            shift 2
            while [ $# -gt 0 ]; do
                case "$1" in
                    --id)
                        doc_id="$2"
                        shift 2
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            operation_index "$index" "$document" "$doc_id"
            ;;
        update)
            operation_update "$@"
            ;;
        delete)
            operation_delete "$@"
            ;;
        bulk)
            operation_bulk "$@"
            ;;
        *)
            echo "❌ 错误: 未知操作 '$operation'"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
