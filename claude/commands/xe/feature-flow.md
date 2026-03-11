---
name: feature-flow
description: 新功能开发工作流 - 技术设计→代码实现→单元测试的完整流程
argument-hint: "飞书PRD链接 [辅助说明]"
disable-model-invocation: true
---

# 新功能开发工作流

## 流程概览

```
Tech-Plan → Java-Coding → Unit-Test → (可选)Code-Review
   ↓            ↓              ↓
技术设计    代码实现       代码自测
```

## 执行流程

### 阶段 1：Tech-Plan

```bash
Agent(
  subagent_type="agent-xe-tech-plan",
  prompt="PRD链接：${prdUrl}\n辅助说明：${auxInfo}"
)
```

### 阶段 2：Java-Coding

```bash
Agent(
  subagent_type="agent-xe-java-coding",
  prompt="需求名称：{需求名称}"
)
```

### 阶段 3：Unit-Test

```bash
Agent(
  subagent_type="agent-xe-unit-test",
  prompt="需求名称：{需求名称}"
)
```

### 可选：Code-Review

```bash
Agent(
  subagent_type="everything-claude-code:code-reviewer",
  prompt="需求名称：{需求名称}"
)
```

## 输入/输出

| 项目 | 说明 |
|------|------|
| 输入 | PRD链接 + 辅助说明（可选） |
| 输出 | 技术设计文档 + 源代码 + 测试代码 + 测试报告 |

## 断点续传

```bash
/xe:feature-flow-resume "需求名称"
```

| 当前阶段 | 恢复后操作 |
|----------|-----------|
| tech-plan completed | → agent-xe-java-coding |
| java-coding completed | → agent-xe-unit-test |
| unit-test completed | → 代码评审或提交 |
