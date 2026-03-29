---
name: feature-flow-resume
description: 恢复 feature-flow 流程 - 通过读取 state.json 检测当前阶段并继续
argument-hint: "[需求名称]"
disable-model-invocation: true
---

# 恢复 Feature-Flow 流程

本命令用于恢复之前中断的功能开发流程，通过读取 `state.json` 自动检测当前阶段。

## 核心改进

新版 resume 基于 `state.json` 文件进行阶段检测，相比旧版的文件推测方式更加准确可靠。

## 多项目处理

### 场景：多个需求同时进行中

```bash
/xe:resume
```

**执行流程：**

1. 列出所有状态文件
2. 读取每个需求的当前阶段
3. 展示需求列表供用户选择

**输出示例：**

```bash
# 列出所有进行中的需求
node claude/utils/state-manager.js list
```

```markdown
📋 检测到以下进行中的需求：

#  需求名称         当前阶段                    状态
────────────────────────────────────────────────────
1  用户登录      java-coding                🟡 进行中
2  订单支付      evaluator                  🟡 进行中
3  消息推送      tech-plan                  🟡 进行中
4  数据导出      tech-plan                  ✅ 已完成

请选择要恢复的需求 [1-4]，或输入需求名称：
```

### 场景：指定需求名称

```bash
/xe:resume "用户登录"
```

**直接进入该需求的当前阶段，跳过选择步骤。**

## 阶段检测逻辑

### 通过 state.json 检测

```bash
# 读取状态文件
node claude/utils/state-manager.js get "{需求名称}"
```

### 阶段判断表

恢复时优先按以下顺序判断：

1. `next_action`
2. `current_stage`
3. `stages[stage].status`
4. 历史阶段兼容映射

| current_stage / next_action | 下一步操作 | Agent 调用 | 说明 |
|----------------------------|-----------|-----------|------|
| `tech-plan` | 技术设计中 | Agent(agent-xe-tech-plan) | 继续设计或澄清需求 |
| `tech-plan` + `next_action = java-coding` | 进入实现阶段 | Agent(agent-xe-java-coding) | 技术设计与开发任务文档已具备 |
| `java-coding` | 代码实现中 | Agent(agent-xe-java-coding) | 继续开发或恢复上下文 |
| `java-coding` + `next_action = evaluator` | 进入独立评估 | Agent(agent-xe-evaluator) | 实现与基础自检已完成 |
| `evaluator` | 独立评估中 | Agent(agent-xe-evaluator) | 继续验收与生成评估报告 |
| `evaluator` + `next_action = manual_review_or_commit` | 人工复核/提交 | 人工后续动作 | 评估已通过 |
| `evaluator` + `next_action = fix_issues` | 回到修复阶段 | Agent(agent-xe-java-coding) | 根据 issue list 修复后再次评估 |

### 历史阶段兼容

旧状态只做最小兼容映射，不再作为主流程阶段：

| 旧阶段 | 恢复目标 | 说明 |
|-------|---------|------|
| `task-list` | `java-coding` | 旧任务整理阶段已被 `tech-plan` 自动生成的 `开发任务.md` 替代 |
| `tdd-implementation` | `java-coding` | 旧实现阶段并入 `java-coding` |
| `code-execution` | `java-coding` | 旧执行阶段并入 `java-coding` |
| `unit-test` | `evaluator` | 基础自检已并入 `java-coding`，独立验收由 `evaluator` 承担 |
| `code-review` | flow 外人工动作 | 不再作为 feature-flow 正式阶段 |

### 状态文件不存在

如果状态文件不存在，提示用户：

```markdown
❌ 未找到需求的状态文件

可能原因：
1. 需求名称输入错误
2. 未使用新版本 feature-flow 创建需求

解决方案：
- 使用 /xe:feature-flow-resume 查看所有进行中的需求
- 使用 /xe:feature-flow 从头开始创建
```

## 执行步骤

### 步骤 1：列出所有需求

```bash
# 列出所有进行中的需求
node claude/utils/state-manager.js list
```

### 步骤 2：分析当前阶段

对每个需求，优先读取 `next_action`，再结合 `current_stage` 与 `stages[stage].status` 判断恢复目标。

### 步骤 3：展示选择列表

**单个需求：**

```markdown
📋 检测到开发进度：

需求：用户登录
阶段：java-coding 🟡
状态：技术设计已完成

状态文件：docs/用户登录/state.json

即将继续执行：agent-xe-java-coding Agent

[Enter] 继续 | [c] 取消
```

**多个需求：**

```markdown
📋 检测到以下进行中的需求：

#  需求名称         当前阶段                    状态          更新时间
────────────────────────────────────────────────────────────────────
1  用户登录      java-coding                🟡 进行中      2026-03-11 14:30
2  订单支付      evaluator                  🟡 进行中      2026-03-10 10:15

请选择要恢复的需求 [1-2]，或输入需求名称：
```

### 步骤 4：启动对应 Agent

根据用户选择，启动对应的 Agent：

```bash
# 示例：恢复 java-coding 阶段
Agent(
  subagent_type="agent-xe-java-coding",
  prompt="需求名称：{需求名称}\n\n请继续代码实现工作。"
)
```

### 步骤 5：显示摘要

Agent 完成后，显示完成摘要：

```markdown
✅ 恢复执行完成

需求名称：{需求名称}
继续阶段：{阶段名称}
状态文件：docs/{需求名称}/state.json

[Enter] 继续下一阶段
```

## 状态文件格式

```json
{
  "requirement": {
    "name": "用户登录",
    "prd_url": "https://...",
    "description": "实现用户登录功能",
    "created_at": "2026-03-07T10:00:00Z"
  },
  "current_stage": "java-coding",
  "stages": {
    "tech-plan": {
      "status": "completed",
      "output": "docs/用户登录/技术设计.md",
      "completed_at": "2026-03-07T14:30:00Z"
    },
    "java-coding": {
      "status": "in_progress"
    },
    "evaluator": {
      "status": "pending"
    }
  },
  "decisions": [
    {
      "text": "使用 JWT 认证",
      "timestamp": "2026-03-07T14:25:00Z"
    },
    {
      "text": "密码使用 bcrypt 加密",
      "timestamp": "2026-03-07T14:26:00Z"
    }
  ]
}
```

## 使用示例

```bash
# 查看所有进行中的需求
/xe:resume

# 恢复指定需求
/xe:resume "用户登录"

# 使用数字选择（交互式）
/xe:resume
> 1
```

## 关键文件列表

| 文件 | 说明 |
|------|------|
| `claude/utils/state-manager.js` | 状态管理工具 |
| `claude/agents/agent-xe-tech-plan.md` | Tech-Plan Agent |
| `claude/agents/agent-xe-java-coding.md` | Java-Coding Agent |
| `claude/agents/agent-xe-evaluator.md` | Evaluator Agent |

## 注意事项

- 需求名称必须与 `state.json` 中的 `requirement.name` 一致
- 如果找不到任何状态文件，提示用户使用 `/xe:feature-flow` 从头开始
- 旧版 feature-flow 创建的需求若仍停留在 `task-list`、`tdd-implementation`、`code-execution` 或 `unit-test`，恢复时应按兼容映射落到新链路
