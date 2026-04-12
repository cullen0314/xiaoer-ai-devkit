---
name: branch-diff-review
description: 对比当前分支与 master 的代码差异，按 7 个维度分析变更影响并给出风险评级。当用户说"对比一下分支差异"、"分析这次改动的影响"、"评估分支变更风险"、"review 一下分支改动"、"/branch-diff-review"时触发。
allowed-tools: [Bash, Read, Grep, Glob, Write]
---

# 分支变更影响分析

## 核心定位

对比当前分支与 master 的代码差异，按 7 个维度逐项分析变更对现有功能的影响，自动评定风险等级，输出结构化分析报告。

**不是 git diff 的美化版，是变更影响的深度分析。**

## The Iron Laws

```
NO RISK RATING WITHOUT READING ACTUAL DIFF FIRST
NO IMPACT CLAIM WITHOUT GREP VERIFICATION
```

<HARD-GATE>
每个影响判断必须基于 git diff 的实际内容。每个"影响 N 个调用方"的结论必须基于 Grep 搜索的真实结果。禁止基于文件名或方法名推测影响范围。
</HARD-GATE>

## Red Flags - STOP

- 没搜调用方就写"影响范围有限"
- 没看 diff 内容就评风险等级
- 把新增字段标为 🔴 高风险（通常是 🟡）
- 没 grep 就写"无调用方"
- 把 private 方法改动标为 🔴

<Bad>
看到 OrderService.java 有改动 → 直接写"订单服务逻辑变更，影响范围中等"
</Bad>

<Good>
git diff master -- OrderService.java → 发现 createOrder() 方法签名增加了参数 → grep "createOrder" 找到 5 个调用方 → 标记 🔴 高风险并列出调用方
</Good>

## 风险评级规则

### 单项评级

| 变更类型 | 风险 | 理由 |
|---------|------|------|
| Dubbo/Feign 接口签名变更（方法名、参数、返回值） | 🔴 高 | 下游直接挂 |
| MQ DTO 删除/改名字段 | 🔴 高 | 消费方反序列化失败 |
| DB 字段删除/类型变更 | 🔴 高 | 数据不兼容 |
| 公共 Service 方法签名变更（被 3+ 处调用） | 🔴 高 | 影响面大 |
| Controller 入参/出参变更 | 🟡 中 | 前端需同步改 |
| MQ DTO 新增字段（非删除） | 🟡 中 | 通常兼容但需确认 |
| DB 新增字段/新增索引 | 🟡 中 | 需评估迁移脚本 |
| 枚举/常量值变更 | 🟡 中 | 影响引用方 |
| 业务逻辑分支变更 | 🟡 中 | 需回归测试 |
| 公共方法签名变更（被 1-2 处调用） | 🟡 中 | 影响面可控 |
| 新增文件 | 🟢 低 | 纯新增不影响现有 |
| 内部 private 方法修改 | 🟢 低 | 影响范围有限 |
| 注释/日志修改 | 🟢 低 | 无功能影响 |

### 整体评级

取所有变更项中的**最高风险级别**作为整体评级。

## 工作流程

### 步骤 1：获取变更概览

```bash
# 当前分支名
git branch --show-current

# 变更文件清单
git diff master --name-status

# 增删统计
git diff master --stat
```

若当前分支就是 master，提示用户切换到目标分支后再执行。

### 步骤 2：逐文件分析 diff

对每个变更的 `.java` 文件执行：

```bash
git diff master -- <file>
```

阅读 diff 内容，按 7 个维度分类：

**维度 1：接口契约变更**
- 检查 Dubbo 接口（`*Provider.java`、`*Facade.java`）的方法签名是否改变
- 检查 Controller 方法的 `@XxxMapping` 路径、入参、出参是否改变
- 检查 Feign 接口定义是否改变

**维度 2：共享方法影响半径**
- 识别被修改的 `public` 方法签名（方法名、参数列表、返回类型）
- 区分 public / protected / private

**维度 3：DB 变更风险**
- Entity 类：字段增删改、注解变更（`@Column`、`@Table`）
- Mapper/Repository：SQL 逻辑变更、新增/删除方法
- 关注字段类型变更、字段删除、NOT NULL 约束变更

**维度 4：MQ 消息体变更**
- DTO/MsgDTO 类：字段增删改
- 区分"新增字段"（通常兼容）和"删除/改名字段"（不兼容）

**维度 5：配置/常量变更**
- 常量值修改、枚举项增删改
- 配置文件（`application.yml`、`properties`）变更

**维度 6：新增/删除文件**
- 从 `git diff --name-status` 中识别 A（新增）/ D（删除）/ R（重命名）

**维度 7：行为逻辑变更**
- if/else 分支逻辑变更
- 校验规则变更
- 异常处理变更（catch 块、throw 语句）
- 事务边界变更（`@Transactional`）

### 步骤 3：影响半径分析

对步骤 2 发现的每个有风险的变更项，执行 Grep 搜索调用方：

**接口契约变更 → 搜调用方**
```bash
# 搜索方法调用
grep -rn "methodName(" src/main/java/ --include="*.java"
```

**共享方法变更 → 搜调用方**
```bash
# 搜索方法名，排除定义本身
grep -rn "methodName(" src/main/java/ --include="*.java" | grep -v "定义所在文件"
```

**MQ DTO 变更 → 搜消费者**
```bash
# 搜索 DTO 类名使用位置
grep -rn "DtoClassName" src/main/java/ --include="*.java"
```

**常量/枚举变更 → 搜引用位置**
```bash
grep -rn "CONSTANT_NAME" src/main/java/ --include="*.java"
```

记录每个变更项的调用方数量和具体文件位置。

### 步骤 4：风险评级

按风险评级规则表，对每个变更项打分：

1. 判断变更类型
2. 结合调用方数量确定风险等级
3. 取所有变更项中最高风险作为整体评级

### 步骤 5：生成报告并保存

保存路径：`/Users/wangyijun/Documents/Notes/小二笔记/小二AI/AI业务沉淀/{分支名}-变更分析.md`

分支名中的 `/` 替换为 `-`，如 `feature/order-refactor` → `feature-order-refactor-变更分析.md`

## 输出文档模板

```markdown
# 分支变更影响分析：{分支名} vs master

> 分析时间：{YYYY-MM-DD}  |  整体风险：{🔴高风险 / 🟡中风险 / 🟢低风险}

## 变更概览

| 指标 | 值 |
|------|---|
| 分支名 | {branch} |
| 对比基准 | master |
| 修改文件 | N |
| 新增文件 | N |
| 删除文件 | N |
| 总增加行 | +N |
| 总删除行 | -N |

## 风险项汇总

| # | 风险 | 类型 | 描述 | 影响范围 |
|---|------|------|------|---------|
| 1 | 🔴 | 接口契约 | XxxFacade.method() 参数变更 | 3 个调用方 |
| 2 | 🟡 | MQ DTO | InBoundOrderMsgDTO 新增字段 | 2 个消费者 |
| ... | | | | |

## 详细分析

### 1. 接口契约变更

#### 1.1 {接口名}.{方法名}()
- **风险**：🔴 高
- **变更内容**：{参数增加/删除/类型变更}
- **diff**：
  \`\`\`diff
  - public Response<OrderVO> createOrder(CreateOrderReq req)
  + public Response<OrderVO> createOrder(CreateOrderReq req, String operator)
  \`\`\`
- **调用方**（{N} 处）：
  - `com/xxx/controller/OrderController.java:45`
  - `com/xxx/service/impl/BatchServiceImpl.java:123`
  - `com/xxx/consumer/OrderConsumer.java:67`

（如本维度无变更，写"本次无接口契约变更"）

### 2. 共享方法影响半径

#### 2.1 {类名}.{方法名}()
- **风险**：{等级}
- **变更内容**：{描述}
- **调用方**（{N} 处）：
  - 调用方清单

### 3. DB 变更

#### 3.1 {Entity类名}
- **风险**：{等级}
- **变更内容**：
  - 新增字段：`fieldName (Type)`
  - 删除字段：`fieldName`
  - 类型变更：`fieldName: OldType → NewType`
- **关联 Mapper**：{Mapper 类名}

### 4. MQ 消息体变更

#### 4.1 {DTO类名}
- **风险**：{等级}
- **变更内容**：{字段增删改}
- **消费者**（{N} 个）：
  - `XxxConsumer` (topic=xxx, tag=xxx)

### 5. 配置/常量变更

#### 5.1 {常量/枚举名}
- **风险**：{等级}
- **变更内容**：{值变更描述}
- **引用位置**（{N} 处）：
  - 引用方清单

### 6. 新增/删除文件

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | path/to/NewClass.java | {用途简述} |
| 删除 | path/to/OldClass.java | {原用途} |

### 7. 行为逻辑变更

#### 7.1 {类名}.{方法名}()
- **风险**：{等级}
- **变更内容**：{逻辑变更描述}
- **diff**：
  \`\`\`diff
  关键逻辑变更片段
  \`\`\`

## 回归测试建议

基于以上分析，建议重点回归以下功能：

1. {功能点} — 原因：{关联的变更项}
2. {功能点} — 原因：{关联的变更项}

## 变更文件清单

| 状态 | 文件 |
|------|------|
| M | path/to/modified.java |
| A | path/to/added.java |
| D | path/to/deleted.java |
```

## 写作规则

- 中文表达，保留 Java 类名、方法名等英文原文
- 每个风险判断必须附带 diff 片段作为证据
- 调用方清单必须基于 Grep 搜索结果，标注文件路径和行号
- 风险评级严格按规则表执行，不主观加减
- 如某个维度无变更，写"本次无 XXX 变更"，不省略该章节
- 回归测试建议要具体到功能点，不写泛泛的"建议全量回归"

## 自检清单

- 是否执行了 git diff master --name-status 获取完整变更清单
- 是否对每个变更文件读取了实际 diff 内容
- 每个影响范围判断是否有 Grep 搜索证据
- 风险评级是否严格按规则表执行
- 7 个维度是否都在报告中体现（无变更的也标注）
- 回归测试建议是否具体到功能点
- 文件是否已保存到指定路径
