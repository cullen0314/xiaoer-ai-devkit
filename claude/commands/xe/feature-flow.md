---
name: feature-flow
description: 新功能开发工作流 - 从PRD到验证的完整链式流程，采用 Subagent 隔离模式
argument-hint: "飞书PRD链接 [辅助说明]"
disable-model-invocation: true
---

# 新功能开发工作流

本命令是新功能开发的完整工作流入口，采用 **Agent 隔离 + 文档驱动** 模式。

## 核心改进

与旧版 skill 链式调用不同，新版采用：

- **Subagent 隔离**：每个阶段由独立的 Agent 执行，拥有独立的 200k token 预算
- **状态持久化**：通过 `state.json` 记录进度，支持断点续传
- **主会话轻量**：主会话只做协调，上下文始终精简

## 完整流程

```
/xe:feature-flow "飞书PRD链接" "辅助说明"
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  主会话：轻量级协调器                                           │
│  → 调用 Agent(agent-xe-tech-plan)    独立上下文                        │
│  → 读取 state.json 确认完成                                     │
│  → 显示摘要，等待用户确认                                       │
└─────────────────────────────────────────────────────────────────┘
        ↓ 用户确认
┌─────────────────────────────────────────────────────────────────┐
│  主会话：轻量级协调器                                           │
│  → 调用 Agent(xe-task-list)    独立上下文                        │
│  → 读取 state.json 确认完成                                     │
│  → 显示摘要，等待用户确认                                       │
└─────────────────────────────────────────────────────────────────┘
        ↓ 用户确认
┌─────────────────────────────────────────────────────────────────┐
│  主会话：轻量级协调器                                           │
│  → 调用 Agent(xe-tdd-implementation)   独立上下文                │
│  → 读取 state.json 确认完成                                     │
│  → 显示摘要，等待用户确认                                       │
└─────────────────────────────────────────────────────────────────┘
        ↓ 用户确认
┌─────────────────────────────────────────────────────────────────┐
│  主会话：轻量级协调器                                           │
│  → 调用 Agent(xe-code-execution) 独立上下文                      │
│  → 读取 state.json 确认完成                                     │
│  → 显示摘要，等待用户确认                                       │
└─────────────────────────────────────────────────────────────────┘
        ↓ 用户确认
┌─────────────────────────────────────────────────────────────────┐
│  主会话：代码评审与验证                                         │
│  → 调用 Agent(code-reviewer)                                    │
│  → 调用 Agent(verify)                                           │
└─────────────────────────────────────────────────────────────────┘
```

## 输入

- PRD链接: $ARGUMENTS（飞书文档链接）
- 辅助说明: 从 $ARGUMENTS 中提取非链接部分

## 输出

| 输出物 | 路径 |
|------|------|
| 状态文件 | `docs/{需求名称}/state.json` |
| 技术设计文档 | `docs/{需求名称}/技术设计.md` |
| 任务列表文档 | `docs/plans/YYYY-MM-DD-{feature-name}.md` |
| 实现代码 + 测试 | 源代码目录 |
| 验证报告 | 控制台输出 |

## 执行流程

### 阶段 1：Tech-Plan

```bash
# 启动 tech-plan Agent
Agent({
  subagent_type: "agent-xe-tech-plan",
  prompt: `
PRD链接：${prdUrl}
辅助说明：${auxInfo}

请执行技术方案设计，生成设计文档并保存状态文件。
`
})
```

Agent 完成后，主会话：

```bash
# 读取状态文件
node claude/utils/state-manager.js get "{需求名称}"

# 显示完成摘要
```

```markdown
✅ Tech-Plan 阶段完成

需求名称：{需求名称}
技术设计：docs/{需求名称}/技术设计.md
状态文件：docs/{需求名称}/state.json

关键决策：
- 使用 JWT 认证
- 密码使用 bcrypt 加密
- 登录失败限流 5 次/小时

[Enter] 继续下一阶段 | [r] 重新设计 | [m] 修改设计
```

### 阶段 2：Task-List

用户确认后，启动 task-list Agent：

```bash
Agent({
  subagent_type: "xe-task-list",
  prompt: `
需求名称：{需求名称}

请读取技术设计文档，分解为可执行任务列表。
`
})
```

Agent 完成后，主会话：

```bash
# 读取状态文件
node claude/utils/state-manager.js get "{需求名称}"
```

```markdown
✅ Task-List 阶段完成

需求名称：{需求名称}
任务列表：docs/plans/YYYY-MM-DD-{feature-name}.md
总任务数：{N}
预估时间：{X}小时

[Enter] 开始 TDD 开发 | [r] 重新分解 | [m] 修改任务
```

### 阶段 3：TDD-Implementation

用户确认后，启动 tdd-implementation Agent：

```bash
Agent({
  subagent_type: "xe-tdd-implementation",
  prompt: `
需求名称：{需求名称}
任务列表：docs/plans/YYYY-MM-DD-{feature-name}.md

请执行 TDD 开发流程。
`
})
```

Agent 完成后，主会话：

```bash
# 读取状态文件
node claude/utils/state-manager.js get "{需求名称}"
```

```markdown
✅ TDD-Implementation 阶段完成

需求名称：{需求名称}
总任务数：{N}
测试覆盖率：{X}%

[Enter] 继续代码执行 | [r] 重新开发
```

### 阶段 4：Code-Execution

用户确认后，启动 code-execution Agent：

```bash
Agent({
  subagent_type: "xe-code-execution",
  prompt: `
需求名称：{需求名称}
任务列表：docs/plans/YYYY-MM-DD-{feature-name}.md

请执行代码实现和验证。
`
})
```

Agent 完成后，主会话：

```bash
# 读取状态文件
node claude/utils/state-manager.js get "{需求名称}"
```

```markdown
✅ Code-Execution 阶段完成

需求名称：{需求名称}
总任务数：{N}
所有测试通过：✅

[Enter] 继续代码评审
```

### 阶段 5：Code-Review & Verification

```bash
# 调用 code-reviewer Agent
Agent({
  subagent_type: "superpowers:code-reviewer",
  prompt: `
请对 {需求名称} 的代码进行全面评审。
`
})

# 调用 verify Agent
Agent({
  subagent_type: "superpowers:verification",
  prompt: `
请对 {需求名称} 的代码进行验证。
`
})
```

## 断点续传

如果流程中断，使用 `/xe:resume` 恢复：

```bash
/xe:resume "需求名称"
```

系统会读取 `state.json`，自动定位到当前阶段。

## 关键优势

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| 主会话上下文 | ~23k tokens | ~3k tokens |
| 支持功能规模 | 中小型 | 大型功能 |
| 断点续传 | 手动 | 自动 |
| 多项目并行 | 困难 | 容易 |
