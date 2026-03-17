# Elasticsearch 操作工具

安全地执行 Elasticsearch 索引操作的命令行工具，支持完整的 CRUD 操作。

## 功能特性

- ✅ **Search** - 查询文档（自动执行）
- ✅ **Index** - 创建/覆盖文档（需确认）
- ✅ **Update** - 部分更新文档（需确认）
- ✅ **Delete** - 删除文档（需确认）
- ✅ **Bulk** - 批量操作（需确认）
- 🔒 安全确认机制，防止误操作
- 📊 结果自动格式化展示

## 安装依赖

在使用前，请确保系统已安装以下依赖：

```bash
# macOS
brew install curl jq

# Linux
apt-get install curl jq
```

## 配置

编辑 `run.sh` 中的默认配置：

```bash
# 默认 ES 配置
DEFAULT_ES_HOST="localhost"      # ES 主机地址
DEFAULT_ES_PORT="9200"           # ES 端口
DEFAULT_ES_SCHEME="http"         # 协议 (http/https)
DEFAULT_ES_USER=""               # 用户名（可选）
DEFAULT_ES_PASSWORD=""           # 密码（可选）
```

## 使用方法

### 1. 查询文档 (Search)

```bash
# 查询所有文档（默认10条）
bash run.sh search "orders"

# 使用 DSL 查询
bash run.sh search "orders" '{"query": {"match": {"status": "pending"}}, "size": 20}'

# 范围查询
bash run.sh search "logs" '{"query": {"range": {"timestamp": {"gte": "2024-01-01"}}}}'

# 聚合查询
bash run.sh search "sales" '{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": {"field": "category.keyword"}
    }
  }
}'
```

### 2. 创建文档 (Index)

```bash
# 创建文档（自动生成 ID）
bash run.sh index "users" '{"name": "张三", "age": 25, "email": "zhangsan@example.com"}'

# 创建文档（指定 ID）
bash run.sh index "users" '{"name": "李四", "age": 30}' --id "user_001"
```

### 3. 更新文档 (Update)

```bash
# 部分更新文档
bash run.sh update "users" "user_001" '{"doc": {"age": 26}}'

# 使用脚本更新
bash run.sh update "products" "prod_123" '{
  "doc": {
    "price": 99.99
  },
  "script": {
    "source": "ctx._source.views++",
    "lang": "painless"
  }
}'
```

### 4. 删除文档 (Delete)

```bash
# 删除指定文档
bash run.sh delete "users" "user_001"
```

### 5. 批量操作 (Bulk)

```bash
# 批量创建文档
bash run.sh bulk '{"index": {"_index": "users", "_id": "1"}}
{"name": "张三", "age": 25}
{"index": {"_index": "users", "_id": "2"}}
{"name": "李四", "age": 30}'

# 批量删除
bash run.sh bulk '{"delete": {"_index": "users", "_id": "1"}}
{"delete": {"_index": "users", "_id": "2"}}'

# 混合操作
bash run.sh bulk '{"index": {"_index": "users", "_id": "3"}}
{"name": "王五"}
{"update": {"_index": "users", "_id": "1"}}
{"doc": {"age": 26}}
{"delete": {"_index": "users", "_id": "2"}}'
```

## 常用查询示例

### 分页查询

```bash
bash run.sh search "orders" '{
  "query": {"match_all": {}},
  "from": 0,
  "size": 20
}'
```

### 排序查询

```bash
bash run.sh search "products" '{
  "query": {"match_all": {}},
  "sort": [{"price": "asc"}]
}'
```

### 多条件查询

```bash
bash run.sh search "orders" '{
  "query": {
    "bool": {
      "must": [
        {"match": {"status": "completed"}},
        {"range": {"amount": {"gte": 100}}}
      ]
    }
  }
}'
```

### 高亮查询

```bash
bash run.sh search "articles" '{
  "query": {"match": {"content": "Elasticsearch"}},
  "highlight": {
    "fields": {
      "content": {}
    }
  }
}'
```

## 安全机制

### 自动执行的操作
- **Search** - 查询操作不会修改数据，直接执行

### 需要确认的操作
- **Index** - 创建/更新文档
- **Update** - 部分更新文档
- **Delete** - 删除文档
- **Bulk** - 批量操作

对于需要确认的操作，系统会显示操作详情，要求输入 `yes` 确认：

```
⚠️  即将执行 Delete (删除文档) 操作
📋 操作详情:
索引: users
文档 ID: user_001

⚠️  此操作将修改数据，是否继续？
请输入 'yes' 确认: yes
```

## 输出格式

查询结果默认以格式化的 JSON 输出：

```
{
  "took": 5,
  "hits": {
    "total": {
      "value": 100
    },
    "hits": [
      {
        "_id": "1",
        "_source": {
          "name": "张三",
          "age": 25
        }
      }
    ]
  }
}

📊 命中总数: 100
```

## 常见问题

### 连接失败

```
⚠️  警告: 无法连接到 Elasticsearch
```

**解决方法**：
1. 检查 ES 服务是否运行
2. 确认配置中的 host 和 port 是否正确
3. 检查网络连接和防火墙设置

### JSON 格式错误

```
parse error: Unexpected token
```

**解决方法**：
1. 确保 JSON 字符串使用单引号包裹
2. 检查 JSON 格式是否正确
3. 使用 jq 工具验证 JSON: `echo '{...}' | jq .`

### 认证失败

```
Authentication failed
```

**解决方法**：
在脚本中配置正确的用户名和密码：

```bash
DEFAULT_ES_USER="elastic"
DEFAULT_ES_PASSWORD="your_password"
```

## 许可证

MIT License
