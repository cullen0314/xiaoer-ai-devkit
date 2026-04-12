---
name:  
description: Elasticsearch 索引操作工具，支持完整的 CRUD 查询和写入
allowed-tools: [Read, Write, Bash]
---

# Elasticsearch 操作工具

## 功能描述

此 Skill 的核心能力是**安全地执行 Elasticsearch 索引操作**：

- 支持 Search 查询（无需确认，直接执行）
- 支持 Index 创建/更新文档（需要用户二次确认）
- 支持 Update 部分更新文档（需要用户二次确认）
- 支持 Delete 删除文档（需要用户二次确认）
- 支持 Bulk 批量操作（需要用户二次确认）
- 自动格式化查询结果为表格或 JSON 形式

## 使用方式

### 命令格式

**执行 Search 查询**：

```bash
bash ~/.claude/skills/es-operations/run.sh search "index_name" '{"query": {"match_all": {}}}'
```

**执行 Index 创建/更新文档**：

```bash
bash ~/.claude/skills/es-operations/run.sh index "index_name" '{"field": "value"}' --id "doc_id"
```

**执行 Update 部分更新**：

```bash
bash ~/.claude/skills/es-operations/run.sh update "index_name" "doc_id" '{"doc": {"field": "new_value"}}'
```

**执行 Delete 删除文档**：

```bash
bash ~/.claude/skills/es-operations/run.sh delete "index_name" "doc_id"
```

**执行 Bulk 批量操作**：

```bash
bash ~/.claude/skills/es-operations/run.sh bulk '{"index": {"_index": "test", "_id": "1"}}\n{"field": "value"}'
```

**显示帮助信息**：

```bash
bash ~/.claude/skills/es-operations/run.sh --help
```

### 参数说明

| 操作 | 参数 | 说明 |
|------|------|------|
| `search` | index_name | 索引名称 |
| | query | Elasticsearch DSL 查询语句（JSON 格式） |
| `index` | index_name | 索引名称 |
| | document | 文档内容（JSON 格式） |
| | --id | 文档 ID（可选，不指定则自动生成） |
| `update` | index_name | 索引名称 |
| | doc_id | 文档 ID |
| | document | 更新内容（JSON 格式，需包含在 {"doc": {...}} 中） |
| `delete` | index_name | 索引名称 |
| | doc_id | 文档 ID |
| `bulk` | data | Bulk 操作数据（NDJSON 格式） |

### 安全限制

**允许的操作**：
- Search 查询（自动执行）
- Index 创建/更新文档（需要确认）
- Update 部分更新（需要确认）
- Delete 删除文档（需要确认）
- Bulk 批量操作（需要确认）

**禁止的操作**：
- Delete By Query 删除全部数据
- Delete Index 删除整个索引
- 禁止不带查询条件的 Delete By Query

## 使用示例

### 示例 1：查询数据

```
用户：查询订单索引前 10 条数据

执行步骤：
1. 调用：bash ~/.claude/skills/es-operations/run.sh search "orders" '{"query": {"match_all": {}}, "size": 10}'
2. 显示查询结果表格
```

### 示例 2：创建文档

```
用户：在用户索引创建新文档

执行步骤：
1. 调用：bash ~/.claude/skills/es-operations/run.sh index "users" '{"name": "张三", "age": 25}'
2. 系统提示需要确认
3. 用户确认后执行，返回创建的文档 ID
```

### 示例 3：更新文档

```
用户：更新用户年龄

执行步骤：
1. 调用：bash ~/.claude/skills/es-operations/run.sh update "users" "123" '{"doc": {"age": 26}}'
2. 系统提示需要确认
3. 用户确认后执行
```

### 示例 4：删除文档

```
用户：删除指定用户文档

执行步骤：
1. 调用：bash ~/.claude/skills/es-operations/run.sh delete "users" "123"
2. 系统提示需要确认
3. 用户确认后执行
```

### 示例 5：批量操作

```
用户：批量创建多个文档

执行步骤：
1. 调用：bash ~/.claude/skills/es-operations/run.sh bulk '{"index": {"_index": "users", "_id": "1"}}\n{"name": "张三"}\n{"index": {"_index": "users", "_id": "2"}}\n{"name": "李四"}'
2. 系统提示需要确认
3. 用户确认后执行
```

## 注意事项

1. **务必通过脚本运行**：请务必通过 run.sh 脚本运行，这是唯一正确的使用方式
2. **安全第一**：删除操作需要用户明确确认后才会执行
3. **确认机制**：写入和删除操作需要用户明确确认
4. **连接配置**：ES 连接参数已内置在脚本中，可根据需要修改
5. **结果限制**：建议在 Search 查询中使用 size 参数限制结果数量
6. **JSON 格式**：所有 JSON 参数需要正确转义，建议使用单引号包裹
