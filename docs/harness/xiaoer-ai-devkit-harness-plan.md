# xiaoer-ai-devkit Harness 改造方案

## 1. 背景

`xiaoer-ai-devkit` 的定位是企业级 AI 编程助手工具集，核心目标不是单纯堆积 Commands、Agents、Skills，而是逐步形成一套能支撑 Agent **稳定执行、自动验证、跨会话恢复、持续演进** 的工程化运行环境。

从当前项目现状看，已经具备了 Harness 的基础雏形：

- 有工作流入口：`claude/commands/xe/feature-flow.md`
- 有执行型 Agent：`claude/agents/xe-task-executor.md`
- 有技术设计与实现阶段拆分
- 有 `docs/plans/` 作为中间工件存储位置
- 有 memory plugin，并在 `PreCompact` 和 `SessionEnd` 阶段触发

这说明项目已经不是“是否要做 Harness”的问题，而是：

**如何把现有分散能力升级为一套状态化、任务化、可验证、可恢复的闭环系统。**

---

## 2. 改造目标

本次 Harness 改造的目标，不是新增更多 Agent，而是补齐以下五种能力：

1. **状态管理**：让工作流具备明确阶段状态和断点恢复能力
2. **任务拆解**：让复杂需求从“方案”落到“可执行任务单元”
3. **验证闭环**：让 Agent 的完成判断不再依赖口头声明，而依赖可校验结果
4. **记忆分层**：区分长期记忆、任务记忆、运行时记忆
5. **机械化约束**：把规范写成可执行规则，而不是只停留在文档中

最终希望形成如下能力：

- 一个需求可以被拆成多个阶段和任务稳定执行
- 任意中断后可以从状态文件恢复
- 每个阶段都有工件产出和验证结果
- 关键规则由脚本和校验器自动执行
- Agent 的能力扩展不会让系统越来越脆弱

---

## 3. 当前项目已有基础

### 3.1 工作流基础

`claude/commands/xe/feature-flow.md` 已定义：

```text
Tech-Plan → Java-Coding → Unit-Test → (可选)Code-Review
```

这已经具备了多阶段串行执行的框架。

### 3.2 执行型 Agent 基础

`claude/agents/xe-task-executor.md` 已强调以下原则：

- 只做执行，不做决策
- 遇到歧义立即暂停
- 完成后必须编译验证
- 输出结构化 JSON 结果

这已经非常接近 Harness 中的“受控执行器”角色。

### 3.3 Memory Hook 基础

`claude/plugins/memory-plugin/hooks/hooks.json` 已经在两个时机触发 memory hook：

- `PreCompact`
- `SessionEnd`

说明项目已经有“跨会话信息沉淀”的意识。

### 3.4 中间工件基础

当前已有：

- `docs/plans/2026-03-05-curl-debug-design.md`
- `docs/plans/2026-03-05-curl-debug-implementation.md`

这说明项目已经接受“计划文档是一等工件”的思路。

---

## 4. 当前 Harness 的主要短板

---

### 4.1 缺少统一状态机

当前 `feature-flow` 中虽然定义了阶段顺序，但更偏“流程说明”，还不是“机器可消费的状态系统”。

例如：

- 当前阶段是什么
- 哪个阶段完成了
- 哪个阶段失败了
- 失败原因是什么
- 下次应该从哪里恢复

这些信息目前没有统一载体。

#### 问题表现

- 中断恢复依赖人工判断
- 多 Agent 接力时容易丢上下文
- 无法可靠实现自动续跑

#### 改造建议

引入统一状态文件，例如：

```text
.claude/state/<feature-name>.json
```

建议结构：

```json
{
  "feature_name": "订单创建接口",
  "source_prd": "https://xxx.feishu.cn/wiki/xxx",
  "current_stage": "java-coding",
  "stages": {
    "tech-plan": "completed",
    "task-list": "completed",  // 历史兼容字段
    "java-coding": "in_progress",
    "unit-test": "pending",
    "code-review": "pending"
  },
  "artifacts": {
    "tech_plan": "docs/plans/order-create-tech-plan.md",
    "task_list": "docs/订单创建接口/开发任务.md"
  },
  "verification": {
    "compile": "passed",
    "unit_test": "not_run"
  },
  "updated_at": "2026-03-20T10:00:00+08:00"
}
```

#### 价值

- `/xe:feature-flow-resume` 可直接依据状态文件恢复
- 支持多阶段串联
- 为自动化闭环提供统一上下文

---

### 4.2 缺少 Task-List 这一层

当前主流程是：

```text
Tech-Plan → Java-Coding → Unit-Test
```

这个设计对于小任务可行，但对中型以上任务来说，`Tech-Plan` 到 `Java-Coding` 的跨度太大。

#### 风险

- Agent 一次领取任务过大
- 容易贪多，导致中途失控
- 不利于断点恢复
- 不利于精确验证

#### 改造建议

升级为：

```text
Tech-Plan → Task-List → Java-Coding → Unit-Test → Review
```

其中 `Task-List` 是强制阶段，不再作为可选辅助能力。

#### Task-List 的推荐粒度

每个任务控制在 2-10 分钟内完成，且必须包含：

- 文件路径
- 具体动作
- 验证方式
- 完成条件

示例：

```markdown
## 任务 3：新增接口参数对象
- 文件：src/main/java/.../CreateOrderRequest.java
- 操作：新增类
- 约束：字段必须与 PRD 保持一致
- 验证：mvn -q -DskipTests compile
```

#### 价值

- 把大任务拆成 Agent 更容易完成的工作单元
- 显著提升恢复能力
- 为测试和 review 提供更清晰的单位边界

---

### 4.3 验证还停留在 Prompt 要求，尚未形成系统 Gate

`xe-task-executor` 已明确要求完成后做编译验证，但这仍主要是 Prompt 层面的约束，不是工作流层面的强制门禁。

#### 风险

Agent 可能：

- 自称“已完成”但未执行验证
- 只跑编译，不跑贴近业务的验证
- 对文档、脚本、配置改动缺少针对性校验

#### 改造建议

把验证升级为阶段级强制 Gate。

每个阶段必须输出结构化验证结果，例如：

```json
{
  "stage": "java-coding",
  "verification": {
    "compile": "passed",
    "tests": "not_run",
    "smoke": "passed"
  }
}
```

并定义明确规则：

- `java-coding` 未产生验证结果，不能进入 `unit-test`
- `unit-test` 未通过，不能标记整个 feature 完成
- 结构校验失败，不允许进入代码评审阶段

#### 针对本项目的验证类型建议

##### A. 结构验证

检查：

- command 是否放在 `claude/commands/xe/`
- agent 是否放在 `claude/agents/`
- skill 是否放在 `claude/skills/`
- 命名是否符合项目规则

##### B. Frontmatter 验证

检查：

- `name`
- `description`
- `allowed-tools`
- `model`
- `permissionMode`

##### C. 引用一致性验证

检查：

- command 中引用的 agent 是否真实存在
- skill 名称是否真实存在
- 文档引用路径是否存在

##### D. 运行级 Smoke Test

检查：

- `hooks.json` 是否是合法 JSON
- `run.sh` 是否存在且可执行
- skill 依赖是否可解析

#### 价值

- 把“验证”从软要求升级为硬门槛
- 降低产物漂移
- 降低后续维护成本

---

### 4.4 记忆机制缺少分层

当前 memory plugin 能做跨会话沉淀，但还没有区分“长期记忆”和“任务记忆”。

#### 当前问题

项目约定主要散落在：

- `CLAUDE.md`
- skill 说明
- agent prompt
- docs 文档

任务过程中的状态则没有稳定载体。

#### 改造建议

引入三层记忆模型：

##### 1. 长期记忆

记录稳定信息，例如：

- 项目目录结构
- 命名规范
- 常用工作流
- 常见失败模式

适合存放在：

- `AGENTS.md`
- `docs/architecture/project-map.md`
- memory plugin 的长期记忆文件

##### 2. 任务记忆

记录某个 feature 执行过程中的动态状态，例如：

- 当前阶段
- 已完成任务
- 验证结果
- 失败原因

适合存放在：

- `.claude/state/<feature>.json`
- `docs/plans/<feature>-progress.md`

##### 3. 运行时记忆

记录当前 agent 会话内的临时工作上下文，例如：

- 当前命令输入
- 当前工具调用摘要
- 当前会话结论

#### 价值

- 减少跨会话失忆
- 提高 resume 能力
- 降低对单次上下文窗口的依赖

---

### 4.5 规范仍以文档为主，缺少机械化约束

当前项目在 `CLAUDE.md` 中已经定义了清晰约定：

- Commands 使用 `xe:` 前缀
- Agents 使用 `xe-` 前缀
- Skills 使用小写+连字符

但这些规则目前主要依赖人和 Agent 去“记住”，还没有真正编码成检查逻辑。

#### 改造建议

新增统一校验脚本，例如：

```text
tools/verify-devkit.js
```

建议先实现以下规则：

##### 规则 1：命名校验

- command 名称必须符合 `xe:` 约定
- agent 名称必须符合 `xe-` 约定
- skill 目录必须使用小写+连字符

##### 规则 2：目录校验

- command 必须位于 `claude/commands/xe/`
- agent 必须位于 `claude/agents/`
- skill 必须位于 `claude/skills/`

##### 规则 3：frontmatter 校验

- 必填字段是否齐全
- 字段值是否合法

##### 规则 4：引用一致性校验

- command 引用的 agent/skill 是否存在
- agent 提到的模板、文档、脚本是否存在

##### 规则 5：脚本入口校验

- skill 是否包含 `SKILL.md`
- `run.sh` 是否存在
- `package.json` 是否缺必要信息

#### 价值

- 把规范从“经验”变成“门禁”
- 降低新增 skill / agent 时的漂移
- 为自动化 review 提供基础

---

## 5. 推荐的目标形态

建议将项目逐步演进为下面的工作流闭环：

```text
用户需求 / 飞书 PRD
  ↓
xe:feature-flow
  ↓
agent-xe-tech-plan
  ↓
Task-List
  ↓
状态文件更新
  ↓
agent-xe-java-coding
  ↓
verify-devkit
  ↓
agent-xe-unit-test
  ↓
verify-devkit + test result
  ↓
可选 reviewer / clean-up agent
  ↓
完成并沉淀 memory
```

这个目标形态的关键不在于增加更多模型调用，而在于每一步都具备：

- 输入
- 工件
- 状态
- 验证
- 恢复能力

---

## 6. 分阶段改造方案

---

### 第一阶段：低成本高收益

#### 6.1 新增项目地图 `AGENTS.md`

目标：为 Agent 提供统一导航入口。

建议内容：

- 项目目录说明
- Commands / Agents / Skills 的放置规则
- 常见工作流入口
- `docs/plans/` 的作用
- 状态文件的约定位置

核心原则：

- 做地图，不做百科全书
- 指向详细文档，而不是复制所有规则

#### 6.2 为 `feature-flow` 增加状态文件机制

改造目标：

- `xe:feature-flow` 创建状态文件
- `xe:feature-flow-resume` 从状态文件恢复
- 每完成一个阶段，更新状态

#### 6.3 将 `Task-List` 变成强制中间层

目标：

- `Tech-Plan` 后必须生成任务清单
- `Java-Coding` 只接收明确任务，而不是直接接收模糊需求

#### 6.4 新增统一校验入口 `verify-devkit`

第一版先实现：

- 命名校验
- 目录校验
- frontmatter 校验
- 引用存在性校验

---

### 第二阶段：形成执行闭环

#### 6.5 统一 Agent 输出协议

建议所有关键 Agent 输出结构化结果，例如：

```json
{
  "status": "completed",
  "stage": "java-coding",
  "files_changed": ["..."],
  "summary": "...",
  "verification": {
    "compile": "passed"
  }
}
```

错误场景则统一使用：

- `need_clarification`
- `execution_failed`
- `compile_failed`
- `verification_failed`

这样上游工作流可以稳定编排，而不是依赖自然语言猜测。

#### 6.6 将验证结果写回状态文件

阶段完成后写回：

- 本阶段状态
- 校验结果
- 产出物路径
- 下一阶段是否允许启动

#### 6.7 为计划文档和进度文档增加模板

建议统一模板：

- tech-plan 模板
- task-list 模板
- progress 模板
- verification-report 模板

---

### 第三阶段：高级 Harness 化

#### 6.8 增加清洁 Agent

定期扫描以下问题：

- 命名不规范
- 文档中失效引用
- 已删除文件仍被引用
- 模板与实际实现漂移

#### 6.9 增加 Agent 互审机制

例如：

- Java-Coding 完成后
- 自动交给 Unit-Test 或 Reviewer Agent
- 未通过则阻止进入下一阶段

#### 6.10 建立失败模式库

沉淀常见问题，例如：

- task 粒度过大
- command 引用不存在的 agent
- 验证不足导致误判完成
- 技术设计和实现阶段脱节

失败模式库会成为后续 Prompt、Skill、Verify 脚本的重要输入源。

---

## 7. 最小可落地版本（MVP）

如果只做最小闭环，建议优先完成以下三项：

### MVP-1：新增 `AGENTS.md`

作用：

- 提供导航地图
- 降低上下文注入成本
- 增强跨会话理解能力

### MVP-2：给 `feature-flow` 增加状态文件

作用：

- 支持断点恢复
- 支持多阶段执行
- 为自动化编排提供统一状态

### MVP-3：新增 `verify-devkit`

作用：

- 把约定变成门禁
- 先覆盖最基础的命名、目录、frontmatter、引用关系
- 防止项目结构继续漂移

---

## 8. 推荐实施顺序

建议按以下顺序推进：

1. 先做 `AGENTS.md`
2. 再做状态文件机制
3. 再做 `Task-List` 强制中间层
4. 然后做 `verify-devkit`
5. 最后推进统一输出协议和清洁 Agent

原因是：

- 地图先行，能先解决“去哪找信息”的问题
- 状态机制解决“怎么恢复”的问题
- Task-List 解决“怎么拆解”的问题
- Verify 解决“怎么守门”的问题
- 统一输出协议解决“怎么编排”的问题

---

## 9. 对工程师角色的影响

这次改造的核心，不是把工程师替换成 Agent，而是重新定义工程师在系统中的角色。

在传统模式中，工程师的主要价值是：

- 写代码
- 调试代码
- 评审代码

在 Harness 模式中，工程师的价值逐步转向：

- 设计约束
- 设计反馈回路
- 设计执行状态机
- 设计验证机制
- 设计 Agent 之间的协作关系

也就是说，未来项目的竞争力，不只来自写了多少 Skill，而来自：

**是否构建出一套让这些 Skill 和 Agent 长期稳定工作的环境。**

---

## 10. 总结

对 `xiaoer-ai-devkit` 来说，最值得做的 Harness 改造，不是继续横向增加能力点，而是优先补齐以下闭环：

- 用 `AGENTS.md` 建立地图
- 用状态文件承载任务进度
- 用 `Task-List` 把计划转成可执行单元
- 用 `verify-devkit` 把规范机械化
- 用统一输出协议把多 Agent 串起来

一句话总结：

**xiaoer-ai-devkit 下一阶段的重点，不是“做更多 Agent”，而是“让现有 Agent 在一个可控、可验证、可恢复的 Harness 中可靠运行”。**
