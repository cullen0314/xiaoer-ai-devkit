---
description: "根据 curl 命令深度诊断接口问题"
allowed-tools: ["Bash", "Agent"]
argument-hint: "curl 命令"
model: opus
---

# curl-debug 命令

这个命令会解析用户提供的 curl 命令，执行请求并深度分析接口响应，帮助诊断接口问题。

## Context

- 当前目录: !`pwd 2>/dev/null || echo "(未知)"`
- 当前时间: !`date "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "(未知)"`

## 用户输入

用户提供的 curl 命令：

```
$ARGUMENTS
```

## 实现步骤

### 步骤1：解析 curl 命令

分析用户提供 curl 命令的关键信息：
- 请求方法（GET/POST/PUT/DELETE 等）
- 请求 URL
- 请求头（Headers）
- 请求体（Body）
- 认证信息

### 步骤2：执行 curl 请求

使用 `-v` (verbose) 模式执行请求，获取完整的调试信息：

```bash
curl -v $ARGUMENTS 2>&1
```

### 步骤3：分析响应

根据返回结果分析：
- HTTP 状态码（2xx/3xx/4xx/5xx）
- 响应头信息
- 响应体内容
- 请求耗时

### 步骤4：调用 Agent 深度分析

调用 Agent 对接口问题进行深度诊断，包括：
- 状态码含义解释
- 常见错误原因分析
- 响应数据格式验证（JSON/XML）
- 可能的解决方案建议

### 步骤5：输出诊断报告

生成结构化的诊断报告，包含：
- 请求摘要（方法、URL、关键参数）
- 响应分析（状态码、响应时间、数据大小）
- 问题诊断（是否存在问题、问题原因）
- 建议方案（如何修复或优化）

## 使用示例

```bash
# 调试 GET 请求
/xe:curl-debug curl -X GET "https://api.example.com/users/1" -H "Authorization: Bearer token123"

# 调试 POST 请求
/xe:curl-debug curl -X POST "https://api.example.com/users" -H "Content-Type: application/json" -d '{"name":"test"}'

# 调试有问题的接口
/xe:curl-debug curl -v "https://api.example.com/error-endpoint"
```
