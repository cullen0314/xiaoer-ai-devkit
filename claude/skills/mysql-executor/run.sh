#!/bin/bash

# MySQL 执行器 - 安全执行 SQL 查询
# 用法: bash run.sh "SQL 语句"

set -e

# 内置数据库连接配置
DEFAULT_DB_NAME_LABEL="默认库"
DEFAULT_DB_HOST="mysql-xm.summerfarm.net"
DEFAULT_DB_PORT="3308"
DEFAULT_DB_NAME="xianmudb"
DEFAULT_DB_USER="dev2"
DEFAULT_DB_PASSWORD="xianmu619"
DEFAULT_DB_SOURCE="builtin-default"

OFFLINE_DB_NAME_LABEL="离线库"
OFFLINE_DB_HOST="mysql-8.summerfarm.net"
OFFLINE_DB_PORT="3307"
OFFLINE_DB_NAME="xianmu_offline_db"
OFFLINE_DB_USER="dev"
OFFLINE_DB_PASSWORD="xianmu619"
OFFLINE_DB_SOURCE="builtin-offline"

# 当前使用的数据库配置
DB_HOST=""
DB_PORT=""
DB_NAME=""
DB_USER=""
DB_PASSWORD=""
DB_CONFIG_SOURCE=""
DB_DISPLAY_NAME=""

# 候选数据源列表
DATA_SOURCE_NAMES=()
DATA_SOURCE_HOSTS=()
DATA_SOURCE_PORTS=()
DATA_SOURCE_DATABASES=()
DATA_SOURCE_USERS=()
DATA_SOURCE_PASSWORDS=()
DATA_SOURCE_SOURCES=()
DATA_SOURCE_KEYS=()

# 从 YAML 文件提取值
# 支持 yq 和 grep 两种方式
extract_yaml_value() {
    local file="$1"
    local key="$2"
    local value=""

    if command -v yq &> /dev/null; then
        value=$(yq -r "$key // \"\"" "$file" 2>/dev/null)
        if [ "$value" != "null" ] && [ -n "$value" ]; then
            echo "$value"
            return 0
        fi
    fi

    local last_key
    last_key=$(echo "$key" | sed 's/.*\.//' | tr -d "'\"")
    value=$(grep -E "^\s*${last_key}:" "$file" 2>/dev/null | head -1 | sed 's/^[^:]*:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')

    if [ -n "$value" ]; then
        echo "$value"
        return 0
    fi

    return 1
}

# 从 JDBC URL 解析数据库连接信息
# 格式: jdbc:mysql://host:port/database?params
parse_jdbc_url() {
    local jdbc_url="$1"

    local url_part
    url_part=$(echo "$jdbc_url" | sed -E 's|jdbc:mysql://||' | sed 's/\?.*//')

    local host
    host=$(echo "$url_part" | sed -E 's|:.*||' | sed 's|/.*||')

    local port="3306"
    if echo "$url_part" | grep -q ':'; then
        port=$(echo "$url_part" | sed -E 's|[^:]*:||' | sed 's|/.*||')
    fi

    local dbname
    dbname=$(echo "$url_part" | sed 's|.*/||')

    echo "$host|$port|$dbname"
}

add_data_source() {
    local display_name="$1"
    local host="$2"
    local port="$3"
    local db_name="$4"
    local user="$5"
    local password="$6"
    local source="$7"

    if [ -z "$host" ] || [ -z "$port" ] || [ -z "$db_name" ] || [ -z "$user" ]; then
        return 0
    fi

    local unique_key="${host}|${port}|${db_name}|${user}"
    local index
    for index in "${!DATA_SOURCE_KEYS[@]}"; do
        if [ "${DATA_SOURCE_KEYS[$index]}" = "$unique_key" ]; then
            return 0
        fi
    done

    DATA_SOURCE_NAMES+=("$display_name")
    DATA_SOURCE_HOSTS+=("$host")
    DATA_SOURCE_PORTS+=("$port")
    DATA_SOURCE_DATABASES+=("$db_name")
    DATA_SOURCE_USERS+=("$user")
    DATA_SOURCE_PASSWORDS+=("$password")
    DATA_SOURCE_SOURCES+=("$source")
    DATA_SOURCE_KEYS+=("$unique_key")
}

add_builtin_data_sources() {
    add_data_source \
        "$DEFAULT_DB_NAME_LABEL" \
        "$DEFAULT_DB_HOST" \
        "$DEFAULT_DB_PORT" \
        "$DEFAULT_DB_NAME" \
        "$DEFAULT_DB_USER" \
        "$DEFAULT_DB_PASSWORD" \
        "$DEFAULT_DB_SOURCE"

    add_data_source \
        "$OFFLINE_DB_NAME_LABEL" \
        "$OFFLINE_DB_HOST" \
        "$OFFLINE_DB_PORT" \
        "$OFFLINE_DB_NAME" \
        "$OFFLINE_DB_USER" \
        "$OFFLINE_DB_PASSWORD" \
        "$OFFLINE_DB_SOURCE"
}

apply_data_source() {
    local index="$1"

    DB_DISPLAY_NAME="${DATA_SOURCE_NAMES[$index]}"
    DB_HOST="${DATA_SOURCE_HOSTS[$index]}"
    DB_PORT="${DATA_SOURCE_PORTS[$index]}"
    DB_NAME="${DATA_SOURCE_DATABASES[$index]}"
    DB_USER="${DATA_SOURCE_USERS[$index]}"
    DB_PASSWORD="${DATA_SOURCE_PASSWORDS[$index]}"
    DB_CONFIG_SOURCE="${DATA_SOURCE_SOURCES[$index]}"
}

build_project_source_name() {
    local db_name="$1"
    local config_file="$2"
    local key="$3"
    local file_name
    file_name=$(basename "$config_file")
    echo "项目配置库(${db_name} @ ${file_name}:${key})"
}

collect_data_sources_from_project() {
    local project_dir="${1:-.}"

    local priority_names=(
        "application-dev2.yml"
        "application-dev.yml"
        "application.yml"
    )

    local candidate_files=()
    local config_name
    for config_name in "${priority_names[@]}"; do
        while IFS= read -r -d '' file; do
            candidate_files+=("$file")
        done < <(find "$project_dir" -maxdepth 6 -name "$config_name" -type f -print0 2>/dev/null)
    done

    if [ ${#candidate_files[@]} -eq 0 ]; then
        echo "📋 未找到 Spring Boot 配置文件，仅使用内置数据源" >&2
        return 0
    fi

    local config_file
    for config_file in "${candidate_files[@]}"; do
        local keys=(
            ".spring.datasource.url"
            ".spring.datasource.druid.url"
            ".spring.datasource.dynamic.datasource.master.url"
        )

        local key
        for key in "${keys[@]}"; do
            local jdbc_url
            jdbc_url=$(extract_yaml_value "$config_file" "$key")

            if [ -z "$jdbc_url" ]; then
                continue
            fi

            local username=""
            local password=""

            if [[ "$key" == *".druid.url" ]]; then
                username=$(extract_yaml_value "$config_file" ".spring.datasource.druid.username")
                password=$(extract_yaml_value "$config_file" ".spring.datasource.druid.password")
            elif [[ "$key" == *".master.url" ]]; then
                username=$(extract_yaml_value "$config_file" ".spring.datasource.dynamic.datasource.master.username")
                password=$(extract_yaml_value "$config_file" ".spring.datasource.dynamic.datasource.master.password")
            else
                username=$(extract_yaml_value "$config_file" ".spring.datasource.username")
                password=$(extract_yaml_value "$config_file" ".spring.datasource.password")
            fi

            local parsed
            parsed=$(parse_jdbc_url "$jdbc_url")
            local detected_host
            local detected_port
            local detected_db
            detected_host=$(echo "$parsed" | cut -d'|' -f1)
            detected_port=$(echo "$parsed" | cut -d'|' -f2)
            detected_db=$(echo "$parsed" | cut -d'|' -f3)

            if [ -n "$detected_host" ] && [ -n "$detected_db" ]; then
                add_data_source \
                    "$(build_project_source_name "$detected_db" "$config_file" "$key")" \
                    "$detected_host" \
                    "$detected_port" \
                    "$detected_db" \
                    "$username" \
                    "$password" \
                    "$config_file"
            fi
        done

        local all_urls
        all_urls=$(grep -o "jdbc:mysql://[^ \"']*" "$config_file" || true)

        while IFS= read -r scan_url; do
            if [ -z "$scan_url" ]; then
                continue
            fi

            scan_url=$(echo "$scan_url" | sed 's/[),;]*$//')

            local parsed
            parsed=$(parse_jdbc_url "$scan_url")
            local detected_host
            local detected_port
            local detected_db
            detected_host=$(echo "$parsed" | cut -d'|' -f1)
            detected_port=$(echo "$parsed" | cut -d'|' -f2)
            detected_db=$(echo "$parsed" | cut -d'|' -f3)

            local scan_user=""
            local scan_pass=""
            scan_user=$(grep -E "^\s*(username|user):" "$config_file" | head -1 | sed 's/^[^:]*:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')
            scan_pass=$(grep -E "^\s*(password|pass):" "$config_file" | head -1 | sed 's/^[^:]*:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')

            if [ -n "$detected_host" ] && [ -n "$detected_db" ]; then
                add_data_source \
                    "$(build_project_source_name "$detected_db" "$config_file" "scan")" \
                    "$detected_host" \
                    "$detected_port" \
                    "$detected_db" \
                    "$scan_user" \
                    "$scan_pass" \
                    "$config_file (scan)"
            fi
        done <<< "$all_urls"
    done
}

select_data_source() {
    if [ ${#DATA_SOURCE_NAMES[@]} -eq 0 ]; then
        echo "❌ 错误: 没有可用的数据源"
        exit 1
    fi

    echo "请选择要连接的数据库："
    echo ""

    local index
    for index in "${!DATA_SOURCE_NAMES[@]}"; do
        local display_index=$((index + 1))
        echo "${display_index}) ${DATA_SOURCE_NAMES[$index]}"
        echo "   数据库: ${DATA_SOURCE_DATABASES[$index]}"
        echo "   地址: ${DATA_SOURCE_HOSTS[$index]}:${DATA_SOURCE_PORTS[$index]}"
        echo "   用户: ${DATA_SOURCE_USERS[$index]}"
        echo "   来源: ${DATA_SOURCE_SOURCES[$index]}"
        echo ""
    done

    echo -n "请输入序号并回车: "
    local selected_index
    read -r selected_index

    if ! [[ "$selected_index" =~ ^[0-9]+$ ]]; then
        echo "❌ 错误: 请输入有效的数字序号"
        exit 1
    fi

    if [ "$selected_index" -lt 1 ] || [ "$selected_index" -gt ${#DATA_SOURCE_NAMES[@]} ]; then
        echo "❌ 错误: 序号超出范围"
        exit 1
    fi

    apply_data_source $((selected_index - 1))

    echo ""
    echo "✅ 已选择数据源: $DB_DISPLAY_NAME"
    echo "📍 目标数据库: $DB_NAME @ $DB_HOST:$DB_PORT"
    echo ""
}

# 显示帮助信息
show_help() {
    cat <<EOF
MySQL 执行器 - 安全执行 SQL 查询

用法:
    bash run.sh "SQL 语句" [选项]
    bash run.sh --help
    bash run.sh --project-dir /path/to/project "SQL 语句"

示例:
    # 查询数据（默认使用 Markdown 格式，适合 AI）
    bash run.sh "SELECT * FROM users LIMIT 10"

    # 使用表格格式（适合人类阅读）
    bash run.sh --table "SELECT * FROM users LIMIT 10"

    # 指定项目目录
    bash run.sh --project-dir /path/to/spring-boot-project "SELECT * FROM users LIMIT 10"

    # 更新数据（需要确认）
    bash run.sh "UPDATE users SET status = 1 WHERE id = 100"

    # 插入数据（需要确认）
    bash run.sh "INSERT INTO users (name, email) VALUES ('test', 'test@example.com')"

数据源选择:
    每次启动脚本都会先展示候选数据源，并要求用户选择。
    候选数据源包括：
    1. 内置默认库 xianmudb
    2. 内置离线库 xianmu_offline_db
    3. 项目目录中自动扫描到的 Spring Boot 数据源

项目配置扫描优先级:
    1. application-dev2.yml
    2. application-dev.yml
    3. application.yml

安全限制:
    允许: SELECT、SHOW（自动执行）、INSERT/UPDATE（需确认）
    禁止: DELETE、DROP、TRUNCATE、ALTER TABLE、CREATE TABLE 等

注意事项:
    - 建议在 SELECT 查询中使用 LIMIT 限制结果数量
    - INSERT/UPDATE 操作需要用户明确确认
    - 所有高危操作均被禁止
EOF
}

# 检查并安装 mysql 客户端
check_and_install_mysql() {
    if command -v mysql &> /dev/null; then
        return 0
    fi

    echo "未检测到 MySQL 客户端，正在自动安装..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            echo "使用 Homebrew 安装 mysql-client..."
            brew install mysql-client
            export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
        else
            echo "错误: 未找到 Homebrew，请先安装 Homebrew: https://brew.sh/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get &> /dev/null; then
            echo "使用 apt-get 安装 mysql-client..."
            sudo apt-get update
            sudo apt-get install -y mysql-client
        elif command -v yum &> /dev/null; then
            echo "使用 yum 安装 mysql..."
            sudo yum install -y mysql
        else
            echo "错误: 不支持的 Linux 发行版，请手动安装 mysql-client"
            exit 1
        fi
    else
        echo "错误: 不支持的操作系统: $OSTYPE"
        exit 1
    fi

    if ! command -v mysql &> /dev/null; then
        echo "错误: MySQL 客户端安装失败"
        exit 1
    fi

    echo "MySQL 客户端安装成功！"
}

# 检查 SQL 语句安全性
check_sql_safety() {
    local sql="$1"
    local sql_upper
    sql_upper=$(echo "$sql" | tr '[:lower:]' '[:upper:]')

    local dangerous_keywords=("DELETE" "DROP" "TRUNCATE")
    local keyword
    for keyword in "${dangerous_keywords[@]}"; do
        if echo "$sql_upper" | grep -q "\b$keyword\b"; then
            echo "❌ 错误: 禁止执行 $keyword 操作（高危操作）"
            exit 1
        fi
    done

    if echo "$sql_upper" | grep -q "^\s*SHOW\b"; then
        return 0
    fi

    local ddl_keywords=("ALTER" "CREATE")
    for keyword in "${ddl_keywords[@]}"; do
        if echo "$sql_upper" | grep -q "\b$keyword\b"; then
            echo "❌ 错误: 禁止执行 $keyword 操作（DDL 操作）"
            exit 1
        fi
    done

    if echo "$sql_upper" | grep -q "\bUPDATE\b" || echo "$sql_upper" | grep -q "\bINSERT\b"; then
        return 2
    fi

    return 0
}

# 执行 SQL 查询
execute_sql() {
    local sql="$1"
    local format="$2"

    if [ "$format" == "markdown" ]; then
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
            --default-character-set=utf8 \
            -B \
            -e "$sql" | awk -F'\t' '
            {
                printf "| "
                for(i=1;i<=NF;i++) {
                    val=$i
                    gsub(/\|/, "\\|", val)
                    gsub(/\n/, " ", val)
                    printf "%s | ", val
                }
                print ""
            }
            NR==1 {
                printf "| "
                for(i=1;i<=NF;i++) printf "--- | "
                print ""
            }
            '
    else
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
            --default-character-set=utf8 \
            -t \
            -e "$sql"
    fi
}

# 主逻辑
main() {
    if [ $# -eq 0 ]; then
        echo "错误: 缺少 SQL 语句参数"
        echo ""
        show_help
        exit 1
    fi

    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_help
        exit 0
    fi

    local format="markdown"
    local sql_query=""
    local project_dir="."

    while [[ $# -gt 0 ]]; do
        case $1 in
            --markdown)
                format="markdown"
                shift
                ;;
            --table)
                format="table"
                shift
                ;;
            --project-dir)
                project_dir="$2"
                shift 2
                ;;
            *)
                sql_query="$1"
                shift
                ;;
        esac
    done

    if [ -z "$sql_query" ]; then
        echo "错误: 缺少 SQL 语句参数"
        show_help
        exit 1
    fi

    check_and_install_mysql

    add_builtin_data_sources
    collect_data_sources_from_project "$project_dir"
    select_data_source

    check_sql_safety "$sql_query"
    safety_result=$?

    if [ $safety_result -eq 2 ]; then
        echo "⚠️  警告: 即将执行以下 SQL 语句："
        echo ""
        echo "$sql_query"
        echo ""
        echo "目标数据库: $DB_NAME @ $DB_HOST:$DB_PORT"
        echo "数据源名称: $DB_DISPLAY_NAME"
        echo ""
        echo "此操作将修改数据库数据，是否继续？(输入 yes 确认)"
        read -r confirmation

        if [ "$confirmation" != "yes" ]; then
            echo "❌ 操作已取消"
            exit 1
        fi
        echo ""
    fi

    echo "执行 SQL 查询..."
    echo ""
    execute_sql "$sql_query" "$format"
    echo ""
    echo "✅ 查询执行完成"
}

main "$@"
