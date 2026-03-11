---
description: "根据 curl 命令深度诊断接口问题，支持辅助说明、智能代码定位、多种输出格式"
allowed-tools: [Bash, Agent, Skill(mysql-executor)]
argument-hint: "curl 命令 [辅助说明] [--format=text|md|json]"
model: opus
---

# curl-debug 命令

这个命令会解析用户提供的 curl 命令，执行请求并深度分析接口响应，帮助诊断接口问题。

## 功能特性

- 📋 **辅助说明**：支持传入问题背景、预期结果、TraceID 等上下文
- 🎯 **智能定位**：根据 URL 路径自动推断 Controller 位置
- 📊 **多格式输出**：支持 text / md / json 三种输出格式

## Context

- 当前目录: !`pwd 2>/dev/null || echo "(未知)"`
- 当前时间: !`date "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "(未知)"`
- 项目类型: !(grep -r "@RestController\|@Controller" --include="*.java" . 2>/dev/null | head -1 > /dev/null && echo "Spring Boot" || (grep -r "def.*_request\|@api_view" --include="*.py" . 2>/dev/null | head -1 > /dev/null && echo "Django" || (grep -r "router\.\|app\." --include="*.js" --include="*.ts" . 2>/dev/null | head -1 > /dev/null && echo "Node.js" || echo "未知")))

## Context

- 当前目录: !`pwd 2>/dev/null || echo "(未知)"`
- 当前时间: !`date "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "(未知)"`

## 用户输入

```
$ARGUMENTS
```

输入格式支持：

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
---
curl -X GET "http://api.example.com/users"
```

## 实现步骤

### 步骤1：解析用户输入

#### 1.1 提取 curl 命令

从用户输入中提取 curl 命令部分：

```bash
# 提取包含 curl 的行
curl_command=$(echo "$ARGUMENTS" | grep -E "^curl" | tr '\n' ' ')
```

#### 1.2 提取辅助说明

解析非 curl 行的结构化信息：

| 关键词 | 提取字段 |
|--------|----------|
| `问题:` | problem_desc |
| `预期:` | expected_result |
| `实际:` | actual_result |
| `环境:` | environment |
| `背景:` | background |
| `错误日志:` | error_log |
| `TraceID:` | trace_id |

```bash
# 提取辅助说明（非 curl 开头的行，排除 --- 分隔符）
aux_info=$(echo "$ARGUMENTS" | grep -vE "^curl|^---$" | grep -v "^$")
```

#### 1.3 解析 curl 关键信息

分析 curl 命令的关键信息：
- 请求方法（GET/POST/PUT/DELETE 等）
- 请求 URL
- 请求头（Headers）
- 请求体（Body）
- 认证信息

#### 1.4 解析输出格式参数

检测用户指定的输出格式：

```bash
# 提取 --format 参数
output_format=$(echo "$ARGUMENTS" | grep -oE -- '--format=(text|md|json)' | cut -d'=' -f2)
# 默认为 text
output_format=${output_format:-text}
```

| 格式 | 说明 |
|------|------|
| `text` | 简洁文本格式（默认） |
| `md` | Markdown 结构化格式 |
| `json` | JSON 机器可读格式 |

#### 1.5 智能代码定位

根据 URL 路径推断可能的 Controller/Handler 位置：

**URL 路径映射规则**

| URL 模式 | 推断规则 | 示例 |
|----------|----------|------|
| `/api/users` | `{Resource}Controller` / `user/*` | UserController.java |
| `/summerfarm-wms/shelving/...` | 模块名 + 路由段 | ShelvingMissionController.java |
| `/order/create` | `{domain}Controller` | OrderController.java |

**预填充给 Agent 的代码定位提示**

```
【代码定位提示】
- 项目类型: {project_type}
- URL 路径: {url_path}
- 推断关键词: {keywords_from_url}
- 搜索路径建议:
  - Controller: **/*{keyword}*Controller.{ext}
  - Service: **/*{keyword}*Service*.{ext}
```

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

构造 Agent 调用参数，包含：
- curl 命令解析结果
- 执行响应
- 用户提供的辅助说明（如果有）
- 智能代码定位提示
- 输出格式要求

```
【调用上下文】
curl命令: {解析后的 curl 信息}
响应: {执行结果}
辅助说明:
  - 问题: {problem_desc}
  - 预期: {expected_result}
  - 实际: {actual_result}
  - 环境: {environment}
  - 背景: {background}
  - TraceID: {trace_id}
代码定位提示:
  - 项目类型: {project_type}
  - 推断关键词: {keywords}
  - 搜索路径: {search_paths}
输出格式: {output_format}
```

调用 Agent 对接口问题进行深度诊断，包括：
- 状态码含义解释
- 常见错误原因分析
- 响应数据格式验证（JSON/XML）
- 结合辅助说明进行精准定位
- 根据代码定位提示快速找到相关代码
- 按 output_format 要求格式化输出
- 可能的解决方案建议

### 步骤5：输出诊断报告

根据 `output_format` 参数输出不同格式的诊断报告：

#### text 格式（默认）
```
[诊断结果] HTTP 400 - 容器不存在

[问题定位]
Controller: ShelvingMissionController.queryMissionItem()
Service: ShelvingMissionQueryServiceImpl.validateContainer()

[原因] 容器 TY99970 不存在于数据库

[建议] 使用可用容器: TY99971, TY99972
```

#### md 格式
```markdown
# 接口诊断报告

## 📋 请求信息
| 项目 | 值 |
|------|-----|
| 方法 | POST |
| URL | /summerfarm-wms/shelving/query/mission_item_pda |
...
```

#### json 格式
```json
{
  "summary": {
    "status": "failed",
    "http_code": 400,
    ...
  }
}
```

## 使用示例

```bash
# 纯 curl 命令调试（默认 text 格式）
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
