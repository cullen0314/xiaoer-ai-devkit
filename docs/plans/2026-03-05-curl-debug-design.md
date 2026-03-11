# curl-debug 命令设计文档

## 概述

为 xiaoer-ai-devkit 新增 `xe:curl-debug` 命令，用于根据用户输入的 curl 命令深度诊断接口问题。

## 需求

| 项目 | 说明 |
|------|------|
| 使用场景 | 深度问题诊断 - 调用接口、分析日志、查询数据库、定位根本原因 |
| curl 来源 | 用户手动粘贴从浏览器 DevTools 复制的 curl |
| 认证处理 | 直接使用 curl 中的 token/cookie，失败则提示更新 |
| 诊断方式 | 用户选择诊断方向（参数/数据/权限/系统） |
| 分析深度 | 智能模式 - 根据接口路径匹配相关代码 |
| 输出格式 | 简洁文本模式 |

## 架构设计

### 组件结构

```
xe:curl-debug (Command)
    ↓ 调用
xe:curl-debug-agent (Agent)
    ↓ 使用
mysql-executor (Skill)
```

### 文件清单

| 文件路径 | 说明 |
|----------|------|
| `claude/commands/xe/curl-debug.md` | 命令入口 |
| `claude/agents/agent-curl-debug.md` | 诊断逻辑 Agent |

## curl 解析逻辑

### 解析规则

| 字段 | 提取方式 |
|------|----------|
| URL | 第一个参数 |
| Method | 默认 POST，或 `-X` 指定 |
| Headers | `-H` 参数 |
| Body | `--data-raw` 或 `-d` 参数 |
| Cookies | `-b` 参数 |

### 特殊处理

- 自动解码 URL 编码的参数
- 合并重复的 headers
- 处理 JSON 格式的 body

## 诊断流程

### 整体流程

```
输入 curl → 解析 → 调用接口 → 选择诊断方向 → Agent 深度分析 → 输出报告
```

### 诊断方向

| 方向 | 检查项 |
|------|--------|
| 参数问题 | 请求格式、必填项、数据类型、枚举值校验 |
| 数据问题 | 查询数据库表、检查数据一致性、外键约束 |
| 权限问题 | Token 有效性、用户角色、资源访问权限 |
| 系统问题 | 服务状态、依赖服务、超时/限流 |

## 输出格式

### 简洁文本模式

```
=== 接口诊断报告 ===

【请求信息】
URL: POST /summerfarm-wms/shelving/query/mission_item_pda
参数: receivingContainer=TY99970, missionType=10

【调用结果】
状态: 失败 (400)
响应: {"code": "4003008", "msg": "容器不存在或已被占用"}

【诊断方向】参数问题

【问题分析】
1. 容器 TY99970 在数据库中不存在
2. Controller: ShelvingMissionController.queryMissionItem()
3. 校验逻辑: validateContainer() 方法检查容器状态

【解决方案】
1. 确认容器编码是否正确
2. 检查容器是否已在其他任务中使用
3. 使用可用容器: TY99971, TY99972

【相关代码】
Controller: inbound/src/.../ShelvingMissionController.java:120
Service: application/src/.../ShelvingMissionQueryServiceImpl.java
```

## 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| curl 解析失败 | 提示用户检查 curl 格式 |
| 接口调用失败（网络） | 提示检查网络、域名解析 |
| 认证失败（401/403） | 提示 token 已过期 |
| 接口超时 | 记录超时时间，建议检查服务状态 |
| 项目目录识别失败 | 提示切换到正确的项目目录 |
| 数据库连接失败 | 提示检查数据库配置 |
| 未找到相关代码 | 列出可能的搜索路径 |

## 依赖

- mysql-executor Skill：数据库查询

## 后续扩展

- 支持从日志文件中提取 curl
- 支持批量诊断多个 curl
- 支持导出诊断报告
