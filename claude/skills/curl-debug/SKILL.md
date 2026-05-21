---
name: curl-debug
description: 根据用户提供的 curl 命令诊断接口问题；当用户说“分析这个 curl”、“curl-debug”、“接口报错排查”、“根据 curl 定位问题”或粘贴 curl 请求并要求排障时使用。该 Skill 替代旧的 /xe:curl-debug command 和 agent-curl-debug agent。
allowed-tools: [Bash, Read, Grep, Glob, Skill]
---

# curl-debug

根据 curl 命令、响应结果、辅助说明和本地代码定位接口问题。只做诊断分析，不修改代码。

## 输入处理

从用户消息中提取：

- `curl_command`：完整 curl block，必须保留反斜杠续行、Header、Cookie、Body。
- `aux_info`：问题、预期、实际、环境、TraceID、错误日志、背景。
- `output_format`：默认 `text`；用户明确要求时可输出 `md` 或 `json`。

如果缺少完整 URL，或 curl 被脱敏到无法判断真实请求，先向用户追问。

## 诊断流程

### 1. 解析请求画像

识别以下信息：

- HTTP 方法：显式 `-X` 优先；有 `--data`/`-d` 且无 `-X` 时按 POST；否则按 GET。
- URL 与 path。
- Headers：重点关注 `Content-Type`、`Authorization`、`token`、`Cookie`、租户/仓库/用户相关 Header。
- Body：JSON、form、query string 分开处理。

输出和记录中必须脱敏敏感值：`Authorization`、`Cookie`、`token`、`access_token`、`session`。

### 2. 执行请求

优先执行带指标的 curl。不要写成 `curl ... {完整curl命令}`。

做法：复制用户原始 curl，并把诊断参数插入初始 `curl` 后面：

```bash
curl -sS -i --max-time 30 -w '\n---CURL_DEBUG_META---\ntime_total:%{time_total}\nhttp_code:%{http_code}\nremote_ip:%{remote_ip}\n' ...
```

如果原始命令引号复杂，先执行原始 curl，再在不破坏语义的前提下补充 `-i -w` 复测。

请求不可达时：

- 不要编造响应。
- 如果用户提供了实际响应、错误日志或 TraceID，可以继续基于这些证据分析，并在 `verification.curl_executed` 标记为 `failed`。
- 如果没有其他证据，返回 `execution_failed`。

### 3. 按响应分类

| 观察结果 | 优先方向 |
| --- | --- |
| 2xx | 对比预期与实际响应字段 |
| 301/302 | 检查重定向、登录态、是否缺 `-L` |
| 400 | 参数格式、必填项、枚举、JSON/form 类型 |
| 401 | Token/Cookie 失效或鉴权 Header 缺失 |
| 403 | 权限、角色、租户、仓库隔离 |
| 404 | URL、网关前缀、Controller/Route 映射 |
| 422/423 | 业务校验、数据状态 |
| 500 | 服务端异常、空指针、下游异常、错误码 |
| 502/503/504 | 网关、服务不可用、下游超时 |

### 4. 定位代码

先识别项目类型：

- Spring Boot：`@RestController`、`@RequestMapping`、`@GetMapping`、`@PostMapping`
- Node.js：`router.`、`app.`
- Django/FastAPI：`@api_view`、`@router`
- Go：`http.HandleFunc`、`gin.`

根据 path 拆关键词，优先搜索：

```bash
rg -n "@(RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping).*关键词|关键词.*Controller|错误码|响应文案" .
```

定位到入口后继续读 Controller/Service/Mapper/Repository，找到参数校验、业务错误码、数据库查询或下游调用证据。所有代码结论必须带文件路径和行号。

### 5. 可选日志和数据库补证

- 有 TraceID：优先使用可用的日志查询 Skill 或命令查询服务端日志；没有可用入口时说明缺少日志能力。
- 需要查数据：先从代码中确认表名和查询条件，再用 `mysql-executor` 执行只读 `SELECT`；禁止为了诊断执行写操作。
- 没有代码库、日志或数据库证据时，不输出确定根因，只输出最可能方向和下一步需要的证据。

## 输出协议

最终状态只能是：

- `completed`：有足够证据形成诊断结论。
- `need_clarification`：缺少继续诊断的关键信息。
- `execution_failed`：当前环境无法执行请求，且没有其他证据可继续分析。

默认输出：

```markdown
status: completed | need_clarification | execution_failed
stage: curl-debug
summary: 一句话说明结论或阻塞原因

verification:
- curl_executed: passed | failed | skipped
- request_parsed: passed | failed
- response_classified: passed | skipped
- code_search: passed | failed | skipped
- log_or_db_check: passed | failed | skipped

report:
1. 请求画像：方法、path、关键参数、敏感信息脱敏
2. 调用结果：HTTP 状态、业务错误码、核心响应、耗时
3. 问题定位：具体原因、证据链
4. 相关代码：文件:行号
5. 处理建议：可执行的下一步
```

用户要求 `json` 时，输出同等字段的合法 JSON。

## 规则

- 只读分析，不改代码。
- 不泄露 token、cookie、authorization。
- 不在证据不足时给确定根因。
- 优先给 20 行以内的高信号结论；必要证据可附在后面。
- 旧 `/xe:curl-debug` command 和 `agent-curl-debug` agent 已废弃，不再使用 Agent 派发。
