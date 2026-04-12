---
name: feature-flow
description: 新功能开发工作流 - 技术设计→代码实现→独立评估的完整流程
argument-hint: "飞书PRD链接 [辅助说明]"
allowed-tools: [Agent, AskUserQuestion, Read, Bash]
---

# 新功能开发工作流

## The Iron Law

```
NO PHASE WITHOUT USER CONFIRMATION FIRST
NO PHASE SKIP — 阶段顺序不可跳过
```

<HARD-GATE>
每个阶段启动前必须获得用户明确确认。禁止自动跳入下一阶段。
</HARD-GATE>

## 流程概览

```
Tech-Plan → 用户确认 → Java-Coding → 用户确认 → Evaluator
   ↓                       ↓                        ↓
技术设计                 代码实现                 独立验收
```

## 输入解析

从 `$ARGUMENTS` 中解析：

- 第一个参数为 PRD 链接（`prdUrl`）
- 剩余部分为辅助说明（`auxInfo`，可选）

若 `$ARGUMENTS` 为空，使用 AskUserQuestion 询问 PRD 链接。

## 执行流程

### 阶段 1：Tech-Plan（技术设计）

**启动前确认：**

向用户展示即将执行的内容，使用 AskUserQuestion 确认：
- PRD 链接：`{prdUrl}`
- 辅助说明：`{auxInfo}`
- 即将启动：agent-xe-tech-plan

用户确认后，调用：

```
Agent(
  subagent_type="agent-xe-tech-plan",
  prompt="请执行技术方案设计。
    prdUrl: {prdUrl}
    description: {auxInfo}"
)
```

**结果处理：**

| 返回状态 | 处理 |
|---------|------|
| `completed` | 从输出提取 `requirementName` + 文档路径 → 展示结果 → 进入阶段 2 确认 |
| `need_clarification` | 展示问题给用户 → 用户回答 → 带回答重新调用 tech-plan |
| `waiting_for_approval` | 展示待确认内容 → 用户确认 → 重新调用 tech-plan |
| `execution_failed` | 展示错误详情 → **停止流程** → 提示手动修复 |

### 阶段 2：Java-Coding（代码实现）

**启动前确认：**

向用户展示：
- 需求名称：`{requirementName}`（来自阶段 1 输出）
- 技术设计文档：`{techDesignDoc}`
- 开发任务文档：`{devTaskDoc}`
- 即将启动：agent-xe-java-coding

用户确认后，调用：

```
Agent(
  subagent_type="agent-xe-java-coding",
  prompt="请执行 Java 代码开发。
    requirementName: {requirementName}
    docPath: {techDesignDoc}"
)
```

**结果处理：**

| 返回状态 | 处理 |
|---------|------|
| `completed` | 展示实现结果和自检状态 → 进入阶段 3 确认 |
| `need_clarification` | 展示问题 → 用户回答 → 重新调用 |
| `waiting_for_approval` | 展示待确认内容 → 用户确认 → 重新调用 |
| `execution_failed` | 展示错误 → **停止流程** |

### 阶段 3：Evaluator（独立验收）

**启动前确认：**

向用户展示：
- 需求名称：`{requirementName}`
- 即将启动：agent-xe-evaluator（独立评估）
- 说明：评估结论独立于实现者自检

用户确认后，调用：

```
Agent(
  subagent_type="agent-xe-evaluator",
  prompt="请执行独立验收评估。
    requirementName: {requirementName}"
)
```

**结果处理：**

| 返回状态 | 处理 |
|---------|------|
| `completed` + `result=pass` | 🟢 展示评估报告 → 提示可提交代码 |
| `completed` + `result=conditional_pass` | 🟡 展示评估报告 + minor 问题 → 提示可提交但建议关注 |
| `completed` + `result=fail` | 🔴 展示缺陷清单 → 建议回到阶段 2 修复 → 用户决定是否重新执行 java-coding |
| `need_clarification` | 展示问题 → 用户回答 → 重新调用 |
| `execution_failed` | 展示错误 → **停止流程** |

## 完成输出

全部阶段完成后，展示汇总：

```
✅ 新功能开发工作流完成！

📋 需求名称：{requirementName}
📄 技术设计：docs/{requirementName}/技术设计.md
📋 开发任务：docs/{requirementName}/开发任务.md
📊 评估报告：docs/{requirementName}/.evaluation-report.md

评估结论：{pass/fail/conditional_pass}

🚀 下一步：
  • 评估通过 → git commit → 提交代码审查
  • 评估未通过 → 查看缺陷清单 → 修复后重新执行
  • 断点续传 → /xe:feature-flow-resume "{requirementName}"
```

## 断点续传

本 command 永远从头开始。如需从中间阶段恢复：

```
/xe:feature-flow-resume "{requirementName}"
```
