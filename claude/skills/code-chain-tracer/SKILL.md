---
name: code-chain-tracer
description: 从 Controller API 入口追踪完整业务链路，穿透 MQ 异步边界，输出链路文档 + Mermaid 时序图。当用户说"追踪这个接口的链路"、"分析这个 API 的调用链"、"帮我看看这个接口的完整代码链路"、"/code-chain-tracer"时触发。
allowed-tools: [Read, Write, Bash, Glob, Grep, Agent, AskUserQuestion]
---

# 业务链路追踪器

## 核心定位

从 Controller API 入口出发，自动追踪完整业务链路（穿透 MQ 异步边界，标注跨服务调用），输出结构化链路文档 + Mermaid 时序图。

## The Iron Law

```
NO CHAIN NODE WITHOUT READING ACTUAL CODE FIRST
```

基于方法名或类名猜测行为？删掉重来。

<HARD-GATE>
每个链路节点必须基于 Read 工具读取的实际代码内容分析。未读过的代码不得出现在链路文档中。禁止基于索引中的类名/方法名推断行为。
</HARD-GATE>

## Red Flags - STOP

- 没读代码就写"该方法负责 XXX"
- 链路中出现"可能调用了""应该会触发"等推测用语
- MQ topic 常量未解析就写在文档里
- 跨服务调用没标注目标服务名
- 链路断了但没标注断点原因

## 追踪规则

### 边界处理策略

| 边界类型 | 处理方式 | 继续追踪？ |
|---------|---------|-----------|
| 同步方法调用 | 读取实现类代码 | ✅ 继续 |
| DB（Mapper/Repository） | 记录操作类型 + 表名 | ❌ 终点 |
| Redis（RedisTemplate/RedisUtil） | 记录操作类型 + key 模式 + TTL | ❌ 终点 |
| `mqProducer.send()` | 解析常量 → 查索引匹配 consumer | ✅ 跳入 consumer 继续 |
| `@DubboReference` | 标注目标服务 + 接口 + 方法 | ❌ 标注后停止 |
| `@EventListener` | 查索引匹配监听者 → 读取代码 | ✅ 继续 |
| 定时任务（XianMu/SchedulerX） | 标注 Job 类名 | ❌ 终点 |
| HTTP 外部调用（RestTemplate/Feign） | 标注目标 URL/服务 | ❌ 标注后停止 |

### 深度限制

最多追踪 **15 层**。达到上限时标注 `[达到追踪深度上限，未继续]`。

### MQ 链路穿透流程

```
1. 发现 mqProducer.send(TOPIC_CONST, TAG_CONST, msgDTO)
2. 解析常量：查索引 constants 或执行 --resolve-constant
3. 用解析出的 topic + tag 匹配索引 mqConsumers
4. 找到 consumer 类 → Read consumer.process() 方法
5. 从 process() 内部继续递归追踪
```

## 工作流程

### 步骤 1：预扫描建索引

```bash
bash ~/.claude/skills/code-chain-tracer/run.sh --scan "<project_path>"
```

输出 JSON 索引，包含 controllers、mqConsumers、mqProducers、constants、dubboFacades、eventListeners、scheduledJobs。

### 步骤 2：定位入口

根据用户输入的 API Path 或 Controller 方法名：

1. 从索引 `controllers` 匹配目标入口
2. 用 Read 工具读取 Controller 方法的完整代码
3. 如果匹配不到，用 Grep 在项目中搜索

### 步骤 3：递归追踪

从 Controller 方法开始，逐层读取代码：

1. **识别当前方法调用了哪些依赖**
   - 读取类的字段注入（`@Resource` / `@Autowired` / `@DubboReference`）
   - 识别方法体中的调用链

2. **按边界处理策略决定是否继续追踪**
   - 同步调用：找到实现类，Read 代码，继续
   - MQ 发送：解析常量 → 匹配 consumer → 跳入继续
   - Dubbo/外部调用：标注后停止
   - DB/Redis：记录后停止

3. **每个节点记录**：
   - 文件路径 + 行号
   - 行为摘要（基于实际代码）
   - 关键代码片段（核心逻辑，不超过 20 行）
   - 边界操作详情

### 步骤 4：生成链路文档

按照输出模板生成完整 Markdown 文档。

### 步骤 5：保存文件

保存路径：`/Users/wangyijun/Documents/Notes/小二笔记/小二AI/AI业务沉淀/{链路名称}.md`

链路名称格式：`{HTTP方法}-{路径转连字符}`，如 `POST-api-order-create`

## 输出文档模板

```markdown
# 链路分析：{HTTP方法} {API路径}

> 一句话描述该链路的业务作用

## 时序图

\`\`\`mermaid
sequenceDiagram
    participant Client as 客户端
    participant C as XxxController
    participant S as XxxService
    participant DB as Database
    participant MQ as RocketMQ
    participant Consumer as XxxConsumer
    participant Dubbo as [外部] xxx-service

    Client->>C: POST /api/xxx
    C->>S: method()
    S->>DB: INSERT/UPDATE xxx表
    S->>MQ: send(topic, tag)
    MQ->>Consumer: process()
    Consumer->>Dubbo: method() [跨服务]
\`\`\`

## 链路节点

### 1. [Controller] XxxController.method()
- **文件**：`path/to/Controller.java:行号`
- **入参**：RequestDTO
- **出参**：Response<VO>
- **行为**：基于代码的行为描述
- **关键代码**：
  \`\`\`java
  // 核心逻辑片段
  \`\`\`

### 2. [Service] XxxServiceImpl.method()
- **文件**：`path/to/ServiceImpl.java:行号`
- **行为**：基于代码的行为描述
- **DB**：操作类型 → 表名
- **MQ 发送**：topic=`xxx`, tag=`xxx`
- **关键代码**：
  \`\`\`java
  // 核心逻辑片段
  \`\`\`

### 3. [MQ 消费] XxxConsumer.process()
- **文件**：`path/to/Consumer.java:行号`
- **监听**：topic=`xxx`, tag=`xxx`, consumerGroup=`xxx`
- **消息体**：MsgDTO
- **最大重试**：N 次
- **行为**：基于代码的行为描述
- **Redis**：操作类型, key 模式, TTL
- **[跨服务]**：Dubbo → `service-name#Interface.method()`
- **关键代码**：
  \`\`\`java
  // 核心逻辑片段
  \`\`\`

## 边界汇总

| 类型 | 详情 |
|------|------|
| DB | 操作类型 + 表名 |
| MQ | topic + tag + consumerGroup |
| Redis | 操作类型 + key 模式 + TTL |
| 跨服务 | 协议 → 服务名#接口.方法() |

## 风险点与备注

基于代码分析发现的潜在风险：
- MQ 消费重试策略
- 幂等机制实现方式
- 事务边界
- 异常处理策略
```

## 写作规则

- 中文表达，保留 Java 类名、方法名、注解等英文原文
- 每个节点的行为描述必须基于实际代码，不得推测
- 关键代码片段只摘核心逻辑，每段不超过 20 行
- MQ topic/tag 必须解析为实际字符串值，不写常量名
- 跨服务调用必须标注目标服务名和接口全限定名
- 时序图中异步边界用虚线箭头（`-->>` ）
- 如果某个节点的代码无法读取或找不到，标注 `[代码未找到：原因]`

## 自检清单

- 是否执行了预扫描获取索引
- 每个链路节点是否都读取了实际代码
- MQ topic/tag 是否都解析为了实际字符串值
- 跨服务调用是否都标注了目标服务
- 时序图是否覆盖了所有关键节点
- 边界汇总表是否完整
- 风险点是否基于代码分析而非猜测
- 文件是否已保存到指定路径
