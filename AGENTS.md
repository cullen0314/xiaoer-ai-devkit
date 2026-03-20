# AGENTS.md

## 项目定位

`xiaoer-ai-devkit` 是一个面向 Claude Code 的企业级 AI 编程助手工具集。

项目的核心目标不是堆积单点能力，而是通过 Commands、Agents、Skills、Plugins 和文档工件，构建一套可复用、可扩展、可验证的 Agent 工程能力平台。

---

## 先看哪里

当你进入这个项目时，建议按下面顺序理解：

1. `CLAUDE.md`
   - 项目级约定、命名规则、目录说明
2. `AGENTS.md`
   - 项目导航地图、关键入口、工作流关系
3. `docs/harness/`
   - Harness 相关说明、改造方案、实施路线图
4. `docs/plans/`
   - 历史设计和实现工件
5. `claude/commands/xe/`
   - 用户可直接触发的工作流入口
6. `claude/agents/`
   - 可被工作流调用的执行单元
7. `claude/skills/`
   - 可复用的原子能力模块
8. `claude/plugins/`
   - 插件与 hook 扩展

---

## 目录地图

### 根目录

- `CLAUDE.md`：项目级规则与开发约定
- `AGENTS.md`：项目地图与导航入口
- `README.md`：项目介绍
- `docs/`：设计、方案、知识沉淀
- `claude/`：Claude Code 相关能力定义

### `claude/` 目录

#### `claude/commands/xe/`

放置自定义命令，用户通过 `/xe:xxx` 调用。

适合放：

- 流程型入口
- 工作流编排入口
- 面向用户的高层操作

代表文件：

- `claude/commands/xe/feature-flow.md`
- `claude/commands/xe/feature-flow-resume.md`
- `claude/commands/xe/tech-plan.md`
- `claude/commands/xe/curl-debug.md`
- `claude/commands/xe/new-branch.md`

#### `claude/agents/`

放置可由工作流调用的子 Agent。

适合放：

- 单一职责的执行器
- 设计、编码、测试、诊断类 Agent
- 可串联到工作流中的阶段性处理单元

代表文件：

- `claude/agents/agent-xe-tech-plan.md`
- `claude/agents/agent-xe-java-coding.md`
- `claude/agents/agent-xe-unit-test.md`
- `claude/agents/xe-task-executor.md`
- `claude/agents/agent-curl-debug.md`

#### `claude/skills/`

放置可复用的原子能力模块。

适合放：

- 可单独复用的小能力
- 文档处理、数据库执行、思考辅助、任务拆解等模块

代表目录：

- `claude/skills/feishu-doc-read/`
- `claude/skills/feishu-doc-write/`
- `claude/skills/task-list/`
- `claude/skills/tech-plan/`
- `claude/skills/code-execution/`

#### `claude/plugins/`

放置插件与 hook 扩展。

当前重点：

- `claude/plugins/memory-plugin/`

用于会话前后或压缩前的记忆沉淀。

### `docs/` 目录

#### `docs/harness/`

存放 Harness 相关文档，包括：

- 概念说明
- 改造方案
- 路线图

代表文件：

- `docs/harness/harness-overview.md`
- `docs/harness/xiaoer-ai-devkit-harness-plan.md`
- `docs/harness/xiaoer-ai-devkit-harness-roadmap.md`

#### `docs/plans/`

存放任务执行过程中的设计与实现工件。

适合放：

- 技术设计文档
- 实施计划
- 阶段性方案沉淀

#### 其他 `docs/*`

用于沉淀：

- 调研资料
- 翻译内容
- 最佳实践
- 竞品或能力说明

---

## 核心命名规则

以 `CLAUDE.md` 为准，当前项目核心约定如下：

### Commands

- 前缀使用 `xe:`
- 文件位置：`claude/commands/xe/`

### Agents

- 使用 `agent-` 前缀体系
- 文件位置：`claude/agents/`

说明：当前仓库里存在部分历史命名与新约定并存的情况，后续以统一规范为收敛方向。

### Skills

- 使用小写 + 连字符
- 文件位置：`claude/skills/`

---

## 关键工作流

### 1. 新功能开发工作流

入口：

- `/xe:feature-flow`
- `/xe:feature-flow-resume`

当前主流程：

```text
Tech-Plan → Java-Coding → Unit-Test → （可选）Code-Review
```

后续 Harness 演进方向：

```text
Tech-Plan → Task-List → Java-Coding → Unit-Test → Verify → Review
```

适用场景：

- 从 PRD 到实现的完整开发链路
- 分阶段推进、可恢复的功能开发任务

### 2. 技术设计工作流

入口：

- `/xe:tech-plan`
- `agent-xe-tech-plan`

适用场景：

- 从需求文档生成技术设计
- 沉淀设计工件到文档

### 3. 明确任务执行工作流

入口：

- `xe-task-executor`

适用场景：

- 需求已经足够明确
- 不需要额外做技术决策
- 只需要按任务描述精确执行

### 4. 接口诊断工作流

入口：

- `/xe:curl-debug`
- `agent-curl-debug`

适用场景：

- 基于 curl 命令定位接口问题
- 做链路排障和问题归因

---

## Agent 应该如何使用这个项目

### 做功能开发时

优先看：

1. `CLAUDE.md`
2. `AGENTS.md`
3. `claude/commands/xe/feature-flow.md`
4. `docs/harness/` 下的改造文档
5. `docs/plans/` 下相关历史工件

### 做已有能力扩展时

优先判断要改哪一层：

- 改用户入口 → `claude/commands/xe/`
- 改执行单元 → `claude/agents/`
- 改原子能力 → `claude/skills/`
- 改记忆/钩子 → `claude/plugins/`
- 改方法说明或沉淀 → `docs/`

### 做规范治理时

优先关注：

- 命名是否符合约定
- 文件是否放在正确目录
- command / agent / skill 是否存在引用漂移
- 文档与实现是否一致

---

## 当前 Harness 建设重点

当前项目正在从“能力集合”演进为“Agent 工程系统”。

现阶段最重要的建设重点是：

1. 建立统一项目地图
2. 建立状态文件机制
3. 引入 task-list 作为强制中间层
4. 建立统一验证入口
5. 统一 Agent 输出协议

相关文档：

- `docs/harness/harness-overview.md`
- `docs/harness/xiaoer-ai-devkit-harness-plan.md`
- `docs/harness/xiaoer-ai-devkit-harness-roadmap.md`

---

## 文档使用原则

### 地图，不是百科全书

`AGENTS.md` 的职责是提供导航，不负责承载所有细节。

因此：

- 只说明结构、入口、关系
- 不重复粘贴所有规则
- 详细规范应指向 `CLAUDE.md` 或 `docs/` 下专门文档

### 优先维护稳定信息

适合写进 `AGENTS.md` 的内容：

- 目录结构
- 入口路径
- 工作流关系
- 关键约定

不适合写进 `AGENTS.md` 的内容：

- 临时任务状态
- 一次性会议记录
- 高频变动的实现细节

---

## 后续建议

若继续推进 Harness 建设，建议下一步优先实现：

1. `.claude/state/` 状态文件机制
2. `feature-flow` 接入状态推进与恢复
3. `task-list` 接入主工作流
4. `verify-devkit` 统一校验入口

---

## 一句话总结

这个项目的核心不是“有多少 Agent”，而是：

**如何让 Commands、Agents、Skills、Plugins、Docs 在统一约束下协同工作，并逐步演进成一套可恢复、可验证、可持续的 Harness 系统。**
