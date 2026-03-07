---
name: mysql-executor
description: 执行 MySQL 查询语句，支持 SELECT、INSERT、UPDATE 等操作
allowed-tools: [Read, Write, Bash]
---

# MySQL 执行器工具

## 功能描述

此 Skill 的核心能力是**安全地执行 MySQL 数据库查询**：

- 支持 SELECT 查询（无需确认，直接执行）
- 支持 INSERT/UPDATE 操作（需要用户二次确认）
- 禁止 DELETE、DROP、TRUNCATE 等高危操作
- 禁止 ALTER TABLE、CREATE TABLE 等 DDL 操作
- 自动格式化查询结果为表格形式

## 使用方式

### 命令格式

**执行 SELECT 查询**：

```bash
bash ~/.claude/skills/mysql-executor/run.sh "SELECT * FROM table_name LIMIT 10"
```

**执行 INSERT/UPDATE（需要二次确认）**：

```bash
bash ~/.claude/skills/mysql-executor/run.sh "UPDATE table_name SET column = value WHERE id = 1"
```

**显示查询帮助信息**：

```bash
bash ~/.claude/skills/mysql-executor/run.sh --help
```

### 参数说明

| 参数      | 必填 | 说明                     |
| --------- | ---- | ------------------------ |
| `SQL`     | 是   | 要执行的 SQL 语句        |
| `--markdown` | 否   | 输出 Markdown 格式（默认） |
| `--table` | 否   | 输出表格格式             |
| `--help`  | 否   | 显示帮助信息             |

### 安全限制

**允许的操作**：
- SELECT 查询（自动执行）
- INSERT、UPDATE（需要确认）

**禁止的操作**：
- DELETE（高危操作）
- DROP（高危操作）
- TRUNCATE（高危操作）
- ALTER TABLE（DDL 操作）
- CREATE TABLE（DDL 操作）
- CREATE、DROP DATABASE 等其他 DDL

## 使用示例

### 示例 1：查询数据

```
用户：查询用户表前 10 条数据

执行步骤：
1. 调用：bash ~/.claude/skills/mysql-executor/run.sh "SELECT * FROM users LIMIT 10"
2. 显示查询结果表格
```

### 示例 2：更新数据（需要确认）

```
用户：更新用户状态

执行步骤：
1. 调用：bash ~/.claude/skills/mysql-executor/run.sh "UPDATE users SET status = 1 WHERE id = 100"
2. 系统提示需要确认
3. 用户确认后执行
```

### 示例 3：禁止的操作

```
用户：删除某条数据

响应：
DELETE 操作被禁止，无法执行。只能执行 SELECT 查询和 INSERT/UPDATE 操作（需确认）。
```

## 注意事项

1. **务必通过脚本运行**：请务必通过 run.sh 脚本运行，这是唯一正确的使用方式
2. **安全第一**：所有 DML/DDL 高危操作均被禁止
3. **确认机制**：INSERT/UPDATE 需要用户明确确认后才会执行
4. **连接配置**：数据库连接参数已内置在脚本中
5. **结果限制**：建议在 SELECT 查询中使用 LIMIT 限制结果数量
