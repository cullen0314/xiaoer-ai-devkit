#!/bin/bash

# MySQL 执行器 - 安全执行 SQL 查询
# 用法: bash run.sh "SQL 语句"

set -e

# 默认数据库连接配置 (xianmudb)
DEFAULT_DB_HOST="mysql-xm.summerfarm.net"
DEFAULT_DB_PORT="3308"
DEFAULT_DB_NAME="xianmudb"
DEFAULT_DB_USER="dev2"
DEFAULT_DB_PASSWORD="xianmu619"

# 当前使用的数据库配置（初始为默认值）
DB_HOST="$DEFAULT_DB_HOST"
DB_PORT="$DEFAULT_DB_PORT"
DB_NAME="$DEFAULT_DB_NAME"
DB_USER="$DEFAULT_DB_USER"
DB_PASSWORD="$DEFAULT_DB_PASSWORD"
DB_CONFIG_SOURCE="default"



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
    
    local last_key=$(echo "$key" | sed 's/.*\.//' | tr -d "'" | tr -d '"')
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
    
    # 提取 host:port/database 部分
    local url_part=$(echo "$jdbc_url" | sed -E 's|jdbc:mysql://||' | sed 's/\?.*//')
    
    # 提取 host
    local host=$(echo "$url_part" | sed -E 's|:.*||' | sed 's|/.*||')
    
    # 提取 port（默认 3306）
    local port="3306"
    if echo "$url_part" | grep -q ':'; then
        port=$(echo "$url_part" | sed -E 's|[^:]*:||' | sed 's|/.*||')
    fi
    
    # 提取 database name
    local dbname=$(echo "$url_part" | sed 's|.*/||')
    
    echo "$host|$port|$dbname"
}

# 检查 URL 是否包含 offline
is_offline_url() {
    local url="$1"
    if [ -z "$url" ]; then
        return 1
    fi
    # 忽略大小写检查 offline
    if echo "$url" | grep -iq "offline"; then
        return 0
    fi
    return 1
}

# 自动检测并加载项目数据库配置
detect_and_load_db_config() {
    local project_dir="${1:-.}"
    
    # 候选配置文件名（按优先级）
    local priority_names=(
        "application-dev2.yml"
        "application-dev.yml"
        "application.yml"
    )

    # 收集所有候选文件
    local candidate_files=()
    for config_name in "${priority_names[@]}"; do
        while IFS= read -r -d '' file; do
            candidate_files+=("$file")
        done < <(find "$project_dir" -maxdepth 6 -name "$config_name" -type f -print0 2>/dev/null)
    done
    
    if [ ${#candidate_files[@]} -eq 0 ]; then
        echo "📋 未找到 Spring Boot 配置文件，使用默认数据库 (xianmudb)" >&2
        return 0
    fi
    
    # 遍历文件查找有效配置
    for config_file in "${candidate_files[@]}"; do
        # 定义要尝试的 Key 列表
        local keys=(
            ".spring.datasource.url"
            ".spring.datasource.druid.url"
            ".spring.datasource.dynamic.datasource.master.url"
        )
        
        for key in "${keys[@]}"; do
            local jdbc_url
            jdbc_url=$(extract_yaml_value "$config_file" "$key")
            
            if [ -n "$jdbc_url" ]; then
                # 检查是否是 offline 库
                if is_offline_url "$jdbc_url"; then
                    echo "⚠️  跳过 Offline 数据库配置: $jdbc_url (in $config_file)" >&2
                    continue
                fi
                
                # 提取用户名密码
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
                
                # 解析并应用配置
                local parsed
                parsed=$(parse_jdbc_url "$jdbc_url")
                local detected_host=$(echo "$parsed" | cut -d'|' -f1)
                local detected_port=$(echo "$parsed" | cut -d'|' -f2)
                local detected_db=$(echo "$parsed" | cut -d'|' -f3)
                
                if [ "$detected_db" = "xianmudb" ]; then
                    echo "📋 检测到数据库为 xianmudb，使用默认配置" >&2
                    return 0
                fi
                
                if [ -n "$detected_host" ]; then DB_HOST="$detected_host"; fi
                if [ -n "$detected_port" ]; then DB_PORT="$detected_port"; fi
                if [ -n "$detected_db" ]; then DB_NAME="$detected_db"; fi
                if [ -n "$username" ]; then DB_USER="$username"; fi
                if [ -n "$password" ]; then DB_PASSWORD="$password"; fi
                DB_CONFIG_SOURCE="$config_file"
                
                echo "✅ 已加载项目数据库配置:" >&2
                echo "   主机: $DB_HOST:$DB_PORT" >&2
                echo "   数据库: $DB_NAME" >&2
                echo "   用户: $DB_USER" >&2
                    echo "   来源: $config_file" >&2
                    
                    return 0
                fi
            done
        
        # Fallback: scan all JDBC URLs in file directly
        # Handles non-standard keys or complex structures grep can't parse
        local all_urls
        all_urls=$(grep -o "jdbc:mysql://[^ \"']*" "$config_file" || true)
        
        while IFS= read -r scan_url; do
            if [ -n "$scan_url" ]; then
                scan_url=$(echo "$scan_url" | sed 's/[),;]*$//')
                
                if is_offline_url "$scan_url"; then
                     echo "⚠️  [扫描模式] 跳过 Offline 数据库配置: $scan_url" >&2
                     continue
                fi
                
                echo "🔍 [扫描模式] 找到潜在有效连接: $scan_url" >&2
                
                local parsed
                parsed=$(parse_jdbc_url "$scan_url")
                local detected_host=$(echo "$parsed" | cut -d'|' -f1)
                local detected_port=$(echo "$parsed" | cut -d'|' -f2)
                local detected_db=$(echo "$parsed" | cut -d'|' -f3)
                
                if [ "$detected_db" = "xianmudb" ]; then
                     echo "📋 检测到数据库为 xianmudb，使用默认配置" >&2
                     return 0
                fi
                
                if [ -n "$detected_host" ]; then DB_HOST="$detected_host"; fi
                if [ -n "$detected_port" ]; then DB_PORT="$detected_port"; fi
                if [ -n "$detected_db" ]; then DB_NAME="$detected_db"; fi
                
                # Best effort to find username/password
                local scan_user
                local scan_pass
                scan_user=$(grep -E "^\s*(username|user):" "$config_file" | head -1 | sed 's/^[^:]*:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')
                scan_pass=$(grep -E "^\s*(password|pass):" "$config_file" | head -1 | sed 's/^[^:]*:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')
                
                if [ -n "$scan_user" ]; then DB_USER="$scan_user"; fi
                if [ -n "$scan_pass" ]; then DB_PASSWORD="$scan_pass"; fi
                
                DB_CONFIG_SOURCE="$config_file (scan)"
                
                echo "✅ [扫描模式] 已加载项目数据库配置:" >&2
                echo "   主机: $DB_HOST:$DB_PORT" >&2
                echo "   数据库: $DB_NAME" >&2
                echo "   用户: $DB_USER" >&2
                echo "   来源: $config_file" >&2
                
                return 0
            fi
        done <<< "$all_urls"
        
    done
    
    echo "⚠️  配置文件中未找到有效的 datasource 配置（或均为 offline），使用默认数据库 (xianmudb)" >&2
    return 0
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

数据库自动检测:
    脚本会自动搜索 Spring Boot 配置文件（优先级）:
    1. application-dev2.yml
    2. application-dev.yml
    3. application.yml

    如果检测到的数据库不是 xianmudb，将自动使用配置文件中的连接信息。
    如果未找到配置或数据库为 xianmudb，则使用默认连接。

安全限制:
    允许: SELECT（自动执行）、INSERT/UPDATE（需确认）
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

    # 检测操作系统
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - 使用 Homebrew
        if command -v brew &> /dev/null; then
            echo "使用 Homebrew 安装 mysql-client..."
            brew install mysql-client
            # 添加到 PATH
            export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
        else
            echo "错误: 未找到 Homebrew，请先安装 Homebrew: https://brew.sh/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            # Debian/Ubuntu
            echo "使用 apt-get 安装 mysql-client..."
            sudo apt-get update
            sudo apt-get install -y mysql-client
        elif command -v yum &> /dev/null; then
            # CentOS/RHEL
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

    # 再次检查是否安装成功
    if ! command -v mysql &> /dev/null; then
        echo "错误: MySQL 客户端安装失败"
        exit 1
    fi

    echo "MySQL 客户端安装成功！"
}

# 检查 SQL 语句安全性
check_sql_safety() {
    local sql="$1"
    local sql_upper=$(echo "$sql" | tr '[:lower:]' '[:upper:]')

    # 禁止的高危操作
    local dangerous_keywords=("DELETE" "DROP" "TRUNCATE")
    for keyword in "${dangerous_keywords[@]}"; do
        if echo "$sql_upper" | grep -q "\b$keyword\b"; then
            echo "❌ 错误: 禁止执行 $keyword 操作（高危操作）"
            exit 1
        fi
    done

    # 允许 SHOW 命令
    if echo "$sql_upper" | grep -q "^\s*SHOW\b"; then
        return 0
    fi

    # 禁止的 DDL 操作
    local ddl_keywords=("ALTER" "CREATE")
    for keyword in "${ddl_keywords[@]}"; do
        if echo "$sql_upper" | grep -q "\b$keyword\b"; then
            echo "❌ 错误: 禁止执行 $keyword 操作（DDL 操作）"
            exit 1
        fi
    done

    # 检查是否是 UPDATE 或 INSERT（需要确认）
    if echo "$sql_upper" | grep -q "\bUPDATE\b" || echo "$sql_upper" | grep -q "\bINSERT\b"; then
        return 2  # 需要确认
    fi

    return 0  # 安全，可以执行
}

# 执行 SQL 查询
execute_sql() {
    local sql="$1"
    local format="$2"

    if [ "$format" == "markdown" ]; then
        # Markdown 格式输出 (Token 友好)
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
            --default-character-set=utf8 \
            -B \
            -e "$sql" | awk -F'\t' '
            {
                printf "| "
                for(i=1;i<=NF;i++) {
                    val=$i
                    # 简单的转义，防止破坏表格结构
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
        # 默认表格格式 (人类可读，但在 LLM 中 Token 消耗较大)
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

    detect_and_load_db_config "$project_dir"

    check_sql_safety "$sql_query"
    safety_result=$?

    if [ $safety_result -eq 2 ]; then
        echo "⚠️  警告: 即将执行以下 SQL 语句："
        echo ""
        echo "$sql_query"
        echo ""
        echo "目标数据库: $DB_NAME @ $DB_HOST:$DB_PORT"
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
