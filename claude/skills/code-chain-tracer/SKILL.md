---
name: code-chain-tracer
description: 从 Controller API 入口追踪完整业务链路，穿透 MQ 异步边界，输出链路文档 + Mermaid 时序图。当用户说"追踪这个接口的链路"、"分析这个 API 的调用链"、"/code-chain-tracer"时触发。
allowed-tools: [Read, Write, Bash, Glob, Grep, Agent, AskUserQuestion]
---

# 业务链路追踪器

从 Controller API 入口出发，递归追踪完整业务链路，穿透 MQ 异步边界，输出链路文档 + Mermaid 时序图。每个链路节点必须基于实际代码，不得推测。

## 边界处理策略

| 边界类型 | 处理方式 | 继续追踪？ |
|---------|---------|-----------|
| 同步方法调用 | 读取实现类代码 | ✅ 继续 |
| DB（Mapper/Repository） | 记录操作类型 + 表名 | ❌ 终点 |
| Redis（RedisTemplate/RedisUtil） | 记录操作类型 + key 模式 + TTL | ❌ 终点 |
| `mqProducer.send()` | 解析常量 → 匹配 consumer | ✅ 跳入 consumer 继续 |
| `@DubboReference` | 标注目标服务 + 接口 + 方法 | ❌ 标注后停止 |
| `@EventListener` | 匹配监听者 → 读取代码 | ✅ 继续 |
| 定时任务（XianMu/SchedulerX） | 标注 Job 类名 | ❌ 终点 |
| HTTP 外部调用（RestTemplate/Feign） | 标注目标 URL/服务 | ❌ 标注后停止 |

最多追踪 **15 层**，达到上限标注 `[达到追踪深度上限]`。

## MQ 链路穿透

```
1. 发现 mqProducer.send(TOPIC_CONST, TAG_CONST, msgDTO)
2. 解析常量：查索引或执行 --resolve-constant
3. 用 topic + tag 匹配索引 mqConsumers
4. 找到 consumer → Read process() 方法 → 继续递归追踪
```

## 工作流程

### 步骤 1：预扫描建索引

```bash
bash ~/.claude/skills/code-chain-tracer/run.sh --scan "<project_path>"
```

输出 JSON 索引（controllers、mqConsumers、mqProducers、constants、dubboFacades、eventListeners、scheduledJobs）。

### 步骤 2：定位入口

从索引 `controllers` 匹配用户指定的 API Path 或方法名，Read 该方法代码。匹配不到则用 Grep 搜索。

### 步骤 3：递归追踪

从 Controller 方法开始逐层读代码：
1. 读取类的字段注入，识别方法体中的调用链
2. 按边界处理策略决定继续或停止
3. 每个节点记录：文件路径+行号、行为摘要、关键代码片段（不超过 20 行）、边界操作详情

### 步骤 4：生成链路文档

## 输出格式

```markdown
# 链路分析：{HTTP方法} {API路径}

> 一句话描述该链路的业务作用

## 时序图

\`\`\`mermaid
sequenceDiagram
    participant C as XxxController
    participant S as XxxService
    participant DB as Database
    participant MQ as RocketMQ
    participant Consumer as XxxConsumer
    Note over MQ,Consumer: 异步边界
    C->>S: method()
    S->>DB: INSERT/UPDATE xxx表
    S-->>MQ: send(topic, tag)
    MQ-->>Consumer: process()
\`\`\`

## 链路节点

### 1. [Controller] XxxController.method()
- **文件**：`path/to/Controller.java:行号`
- **行为**：基于代码的行为描述
- **关键代码**：核心逻辑片段

### 2. [Service] XxxServiceImpl.method()
- **文件**：`path/to/ServiceImpl.java:行号`
- **行为**：基于代码的行为描述
- **DB/MQ/Redis**：边界操作详情

## 边界汇总

| 类型 | 详情 |
|------|------|
| DB | 操作类型 + 表名 |
| MQ | topic + tag + consumerGroup |
| Redis | 操作类型 + key 模式 |
| 跨服务 | 协议 → 服务名#接口.方法() |
```

## 规则

- 中文输出，Java 类名方法名保留英文
- MQ topic/tag 必须解析为实际字符串值，不写常量名
- 时序图中异步边界用虚线箭头（`-->>`）
