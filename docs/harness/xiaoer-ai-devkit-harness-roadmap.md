# xiaoer-ai-devkit Harness 实施路线图

## 1. 路线图目标

本路线图基于《xiaoer-ai-devkit Harness 改造方案》拆解，目标不是一次性完成所有改造，而是按优先级逐步建立一套：

- 可导航
- 可拆解
- 可验证
- 可恢复
- 可持续演进

的 Agent 工程运行环境。

路线图遵循两个原则：

1. **先补闭环，再扩能力**
2. **先做机械化基础设施，再做高级自动化**

---

## 2. 总体阶段划分

实施分为四个阶段：

### Phase 1：建立基础骨架

目标：先把地图、状态、任务拆解三个基础能力补齐。

### Phase 2：建立验证闭环

目标：让流程从“能跑”升级到“能验证、能阻断”。

### Phase 3：建立多 Agent 编排能力

目标：让各阶段通过统一输出协议和状态文件可靠衔接。

### Phase 4：建立自演进能力

目标：增加清洁、互审、失败模式沉淀等高级 Harness 能力。

---

## 3. 分阶段路线图

---

## Phase 1：建立基础骨架

### 目标

解决三个最基础的问题：

- Agent 去哪里找信息
- 任务执行到哪一步了
- 大任务如何拆小

### 核心交付物

#### 1. 项目地图文档 `AGENTS.md`

建议放在项目根目录：

```text
AGENTS.md
```

内容应包括：

- 项目目录地图
- Commands / Agents / Skills 的存放规则
- 常见工作流入口
- `docs/plans/` 的作用
- 状态文件位置约定
- 验证入口说明

#### 2. 状态文件机制

建议目录：

```text
.claude/state/
```

每个 feature 一个状态文件，例如：

```text
.claude/state/<feature-name>.json
```

用于记录：

- 当前阶段
- 各阶段状态
- 工件路径
- 验证结果
- 更新时间

#### 3. Task-List 强制中间层

升级当前主流程：

```text
Tech-Plan → Java-Coding → Unit-Test
```

改为：

```text
Tech-Plan → Task-List → Java-Coding → Unit-Test
```

### 涉及文件

优先改造：

- `claude/commands/xe/feature-flow.md`
- `claude/commands/xe/feature-flow-resume.md`
- `claude/skills/task-list/SKILL.md`
- `docs/plans/` 相关模板

### 完成标准

满足以下条件即可判定 Phase 1 完成：

- 新需求进入 `feature-flow` 后会创建状态文件
- `feature-flow-resume` 能从状态文件恢复
- `tech-plan` 后必须产出 task-list
- `AGENTS.md` 能为新 Agent 提供导航入口

### 风险

- 状态文件结构设计过于复杂，导致使用成本高
- task-list 粒度过粗，无法发挥拆解效果

### 建议控制方式

- 状态文件字段先少后多
- task-list 先按 2-10 分钟粒度落地

---

## Phase 2：建立验证闭环

### 目标

让每个阶段都能“被验证”，不是靠 Agent 自报完成。

### 核心交付物

#### 1. `verify-devkit` 统一验证入口

建议新增脚本：

```text
tools/verify-devkit.js
```

第一版建议覆盖四类检查：

##### A. 命名校验

- Commands 是否符合 `xe:` 规则
- Agents 是否符合 `xe-` 规则
- Skills 是否符合小写+连字符规则

##### B. 目录校验

- command 是否位于 `claude/commands/xe/`
- agent 是否位于 `claude/agents/`
- skill 是否位于 `claude/skills/`

##### C. Frontmatter 校验

- `name`
- `description`
- `allowed-tools`
- `model`
- `permissionMode`

##### D. 引用一致性校验

- command 引用的 agent 是否存在
- skill/文档引用的路径是否存在

#### 2. 阶段级验证结果结构

建议每个阶段输出结构化验证结果，例如：

```json
{
  "stage": "java-coding",
  "verification": {
    "compile": "passed",
    "structure": "passed",
    "references": "passed"
  }
}
```

#### 3. 验证结果写回状态文件

每个阶段执行完成后，更新：

- 阶段状态
- 验证结果
- 下一阶段是否可进入

### 涉及文件

建议优先改造：

- `claude/agents/xe-task-executor.md`
- `claude/commands/xe/feature-flow.md`
- `claude/commands/xe/feature-flow-resume.md`
- `claude/agents/agent-xe-tech-plan.md`
- `claude/agents/agent-xe-java-coding.md`
- `claude/agents/agent-xe-unit-test.md`

### 完成标准

满足以下条件即可判定 Phase 2 完成：

- 存在统一验证入口 `verify-devkit`
- 任一关键阶段执行完成后都有验证结果
- 验证失败会阻止阶段推进
- 验证结果能写回状态文件

### 风险

- 校验规则过严，影响开发效率
- 校验范围过大，第一版难以落地

### 建议控制方式

- 第一版先校验结构，不校验语义质量
- 先让 verify 具备“发现问题”能力，再逐步变成“强阻断”

---

## Phase 3：建立多 Agent 编排能力

### 目标

让多个 Agent 之间的衔接不依赖自然语言猜测，而依赖统一协议和状态推进。

### 核心交付物

#### 1. 统一 Agent 输出协议

建议所有关键 Agent 输出统一 JSON 结构，至少包含：

```json
{
  "status": "completed",
  "stage": "java-coding",
  "summary": "...",
  "artifacts": {
    "task_list": "...",
    "report": "..."
  },
  "verification": {
    "compile": "passed"
  }
}
```

错误状态统一为：

- `need_clarification`
- `execution_failed`
- `compile_failed`
- `verification_failed`

#### 2. 工作流驱动逻辑升级

由 `feature-flow` 根据状态文件和 Agent 输出决定下一步，而不是依赖静态说明。

#### 3. 阶段间工件契约

每一阶段都必须明确输入输出，例如：

##### Tech-Plan 输出

- 技术设计文档
- 需求名称
- 模块边界

##### Task-List 输出

- 可执行任务列表
- 每项任务的验证方式

##### Java-Coding 输出

- 改动文件列表
- 编译结果
- 产出代码位置

##### Unit-Test 输出

- 测试文件
- 测试执行结果
- 失败摘要

### 涉及文件

重点改造：

- `claude/commands/xe/feature-flow.md`
- `claude/commands/xe/feature-flow-resume.md`
- `claude/agents/agent-xe-tech-plan.md`
- `claude/agents/agent-xe-java-coding.md`
- `claude/agents/agent-xe-unit-test.md`
- `claude/agents/xe-task-executor.md`

### 完成标准

满足以下条件即可判定 Phase 3 完成：

- 上游 command 能解析 Agent 结构化输出
- 多阶段流转依赖状态文件和 JSON 结果，而不是人工判断
- 阶段间产物有稳定格式

### 风险

- 输出协议设计不统一，后续维护成本高
- 老 Agent 兼容成本较高

### 建议控制方式

- 先覆盖核心工作流中的 3-4 个关键 Agent
- 统一协议后再逐步扩展到其他 Agent

---

## Phase 4：建立自演进能力

### 目标

让项目具备持续清理、持续优化、持续学习能力。

### 核心交付物

#### 1. 清洁 Agent

定期扫描：

- 失效引用
- 命名不规范
- 文档与实现不一致
- 废弃文件仍被引用

#### 2. Agent 互审机制

示例：

- `agent-xe-java-coding` 完成后
- 自动交给 `agent-xe-unit-test` 或 reviewer agent
- 未通过则不允许推进状态

#### 3. 失败模式库

建议沉淀到：

```text
docs/harness/failure-patterns.md
```

记录内容：

- 常见失败原因
- 哪类任务容易失控
- 哪些提示词容易导致误判完成
- 哪些验证规则最常触发问题

#### 4. 文档清理与自动维护机制

针对：

- `docs/plans/`
- `AGENTS.md`
- 架构说明文档
- 模板说明文档

定期检查失效内容。

### 完成标准

满足以下条件即可判定 Phase 4 完成：

- 项目能自动发现一部分结构漂移问题
- 关键阶段具备互审能力
- 常见失败模式有文档化沉淀
- 文档和实现的一致性开始被持续维护

### 风险

- 过早引入过多自动化，增加系统复杂度
- 清洁 Agent 规则不成熟时误报较多

### 建议控制方式

- 先做“发现型”清洁，不做自动修改
- 先做 reviewer 提示，不做强制自动修复

---

## 4. 优先级排序

如果按投入产出比排序，推荐优先级如下：

### P0

1. `AGENTS.md`
2. 状态文件机制
3. Task-List 强制中间层

### P1

4. `verify-devkit`
5. 阶段验证结果结构化
6. 验证结果写回状态文件

### P2

7. 统一 Agent 输出协议
8. 工作流驱动逻辑升级
9. 阶段工件契约

### P3

10. 清洁 Agent
11. Agent 互审
12. 失败模式库

---

## 5. 建议实施顺序

建议按以下顺序推进：

### Step 1
起草 `AGENTS.md`

### Step 2
设计 `.claude/state/<feature>.json` 的最小字段集

### Step 3
改造 `feature-flow` / `feature-flow-resume` 接入状态文件

### Step 4
把 `task-list` 接入主流程，成为强制阶段

### Step 5
实现 `verify-devkit` 第一版

### Step 6
统一核心 Agent 的输出协议

### Step 7
将验证结果、阶段状态、工件路径统一回写状态文件

### Step 8
再考虑清洁 Agent 和互审机制

---

## 6. 每阶段验收视角

### Phase 1 验收问题

- 新 Agent 能否快速知道项目结构？
- 工作流中断后能否恢复？
- 大任务是否已经被拆成明确任务列表？

### Phase 2 验收问题

- Agent 声称完成时，是否有可验证证据？
- 验证失败是否能阻断流程继续？

### Phase 3 验收问题

- 上下游 Agent 是否靠结构化数据衔接？
- 是否减少了“看文字猜下一步”的情况？

### Phase 4 验收问题

- 项目是否具备一定的自我清理能力？
- 常见失败是否被不断沉淀和复用？

---

## 7. 最小里程碑定义

建议先定义三个里程碑：

### M1：可恢复

标志：

- 有 `AGENTS.md`
- 有状态文件
- `feature-flow-resume` 能恢复流程

### M2：可验证

标志：

- 有 `verify-devkit`
- 关键阶段具备结构化验证结果
- 验证失败会阻断推进

### M3：可编排

标志：

- 关键 Agent 输出协议统一
- 工作流依赖状态和结构化结果推进
- 多阶段协作明显更稳定

---

## 8. 总结

这份路线图的核心思路是：

- 先把项目从“有很多 Agent/Skill”升级为“有稳定工作流骨架”
- 再把“人工理解流程”升级为“系统理解流程”
- 最后再引入清洁、互审、失败模式沉淀等高级能力

一句话总结：

**xiaoer-ai-devkit 的 Harness 建设，应先解决地图、状态、拆解、验证四件事，再逐步走向编排和自演进。**
