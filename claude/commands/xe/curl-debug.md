---
name: curl-debug
description: "根据 curl 命令深度诊断接口问题，支持辅助说明、智能代码定位、多种输出格式"
allowed-tools: [Agent]
argument-hint: "curl 命令 [辅助说明] [--format=text|md|json]"
model: haiku
---

# curl-debug 命令

根据 curl 命令深度诊断接口问题，支持辅助说明、智能代码定位、多种输出格式。

## 功能特性

- 📋 **辅助说明**：支持传入问题背景、预期结果、TraceID 等上下文
- 🎯 **智能定位**：根据 URL 路径自动推断 Controller 位置
- 📊 **多格式输出**：支持 text / md / json 三种输出格式

## 用户输入

```
$ARGUMENTS
```

### 输入格式

**形式一：纯 curl 命令**
```bash
/xe:curl-debug curl -X POST "http://api.example.com/user" -d '{"id": 123}'
```

**形式二：curl + 辅助说明（用 --- 分隔）**
```bash
/xe:curl-debug curl -X POST "http://api.example.com/user" -d '{"id": 123}'
---
预期：返回用户信息
实际：返回 500 错误
背景：新上线接口，本地测试正常
```

**形式三：辅助说明在前**
```bash
/xe:curl-debug
问题：用户列表接口报错
环境：测试环境
TraceID: abc123
---
curl -X GET "http://api.example.com/users"
```

**格式选项**
```bash
--format=text   # 简洁文本格式（默认）
--format=md     # Markdown 结构化格式
--format=json   # JSON 机器可读格式
```

## 实现步骤

### 步骤1：解析用户输入

从 `$ARGUMENTS` 中提取：

1. **curl 命令**：以 `curl` 开头的行
2. **输出格式**：`--format=text|md|json` 参数（默认 text）
3. **辅助说明**：非 curl 开头的行，支持以下字段

   | 关键词 | 字段名 |
   |--------|--------|
   | `问题:` | problem_desc |
   | `预期:` | expected_result |
   | `实际:` | actual_result |
   | `环境:` | environment |
   | `背景:` | background |
   | `错误日志:` | error_log |
   | `TraceID:` | trace_id |

### 步骤2：调用 Agent

调用 `agent-curl-debug`，传递以下信息：

```
【任务输入】
用户原始输入: {完整原始输入}

curl命令: {提取的 curl 命令}
辅助说明:
  - 问题: {problem_desc}
  - 预期: {expected_result}
  - 实际: {actual_result}
  - 环境: {environment}
  - 背景: {background}
  - 错误日志: {error_log}
  - TraceID: {trace_id}

输出格式: {output_format}
当前工作目录: {pwd}
```

## 使用示例

```bash
# 纯 curl 命令调试
/xe:curl-debug curl -X GET "https://api.example.com/users/1" -H "Authorization: Bearer token123"

# 带辅助说明的调试（推荐）
/xe:curl-debug curl -X POST "https://api.example.com/users" -H "Content-Type: application/json" -d '{"name":"test"}'
---
预期：返回新创建的用户 ID
实际：返回 400 Bad Request
背景：用户创建接口，必填字段都已填写

# 输出 Markdown 格式报告
/xe:curl-debug curl -X POST "https://api.example.com/users" -d '{}' --format=md

# 输出 JSON 格式（便于程序处理）
/xe:curl-debug curl -X GET "https://api.example.com/users" --format=json

# 完整的问题描述
/xe:curl-debug
问题：容器上架接口返回容器不存在
环境：测试环境
TraceID: abc123def456
---
curl -X POST "https://test-api.example.com/shelving/create" \
  -H "Content-Type: application/json" \
  -d '{"containerCode": "TY99970", "location": "A-01-01"}'
```
