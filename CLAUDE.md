# xiaoer-ai-devkit 项目说明

## 项目定位

企业级 AI 编程助手工具集，扩展 Claude Code 能力。

## 核心约定

- 所有 Commands 前缀使用 `xe:`
- 所有 Agents 使用 `agent-` 前缀
- 所有 Skills 使用小写+连字符命名

## 目录说明

| 目录 | 用途 |
|------|------|
| `claude/commands/xe/` | 自定义命令，通过 `/xe:xxx` 调用 |
| `claude/agents/` | Subagent 定义，通过 Task 工具调用 |
| `claude/skills/` | 技能模块，可复用的原子能力 |
| `claude/plugins/` | Claude Code 插件 |

## 开发规范

### Command 格式

```markdown
---
allowed-tools: [Bash, Read, Write]
description: 命令描述
model: haiku
---

## Context
- 预填充上下文: !`command`

## 用户输入
用户输入：$ARGUMENTS

## 实现步骤
1. 步骤一
2. 步骤二
```

### Agent 格式

```markdown
---
name: agent-name
description: Agent 描述
allowed-tools: [Bash, Read, Write]
permissionMode: acceptEdits
model: sonnet
---

# Agent 标题

## 核心原则
...

## 执行工作流程
...
```

### Skill 格式

```
skill-name/
├── SKILL.md      # AI 理解入口
├── run.sh        # Bash 入口
├── skill.js/py   # 实现代码
└── package.json  # 依赖声明
```

## Current Date

Today's date is 2026-03-04.
