---
name: task-list
description: 基于技术设计文档中的详细执行计划派生标准化开发任务文档
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# 开发任务文档生成 Skill

## 概述

基于 `tech-plan` 阶段产出的技术设计文档中的“详细执行计划”，派生独立的**开发任务文档**。开发任务文档聚焦执行视图标准化，而不是重复发明技术设计。

## 执行时机

本技能用于在 `tech-plan` 自动输出双文档后，对 `开发任务.md` 进行二次标准化、补充校验或重新整理。

也可以通过 `/xe:resume` 命令在新建会话中恢复执行。

## 前置检查

**执行前，必须确认以下文件存在，且技术设计文档包含“详细执行计划”章节：**

```bash
ls docs/{需求名称}/技术设计.md
```

如果不存在，提示用户：
- `未找到技术方案文档，请先运行 tech-plan 或使用 /xe:resume`

如果文档存在但缺少“详细执行计划”章节，提示用户：
- `技术设计文档缺少详细执行计划，请先补全 tech-plan 产物后再执行 task-list`

## 输入

- 技术设计文档路径（默认 `docs/{需求名称}/技术设计.md`）
- 原始 PRD 内容（可选）
- 需求名称

## 执行流程

### 步骤 1：读取状态并验证

```bash
node claude/utils/state-manager.js get "{需求名称}"
```

要求：
- `tech-plan` 阶段必须为 `completed`
- `开发任务.md` 已存在，或当前链路允许对开发任务文档进行二次整理

### 步骤 2：读取技术方案文档

```bash
Read(docs/{需求名称}/技术设计.md)
```

### 步骤 3：理解技术方案与详细执行计划

从技术设计文档中提取以下信息：
- 功能列表
- 功能点分析
- 核心接口定义（Dubbo / HTTP / 定时任务 / MQ）
- 操作流程（Entity 实体）
- 数据库设计（MySQL / Redis / ES / Cache）
- 业务流程与异常分支

### 步骤 4：重整开发任务文档

使用模板文件：
- `claude/agents/templates/开发任务文档模板.md`

输出路径：
- `docs/{需求名称}/开发任务.md`

生成时遵循以下原则：
- 以技术设计文档中的“详细执行计划”为任务真相源
- 不重复发明接口、实体、字段或流程
- 每个开发任务都应能映射回技术设计文档中的章节或任务编号
- 若技术设计文档缺失必要信息，应提示上游补全执行计划，而不是自行臆造

### 步骤 5：标记阶段进行中

```bash
node claude/utils/state-manager.js update "{需求名称}" "task-list" "in_progress" null '{"substage":"generating_dev_tasks","next_action":"review_dev_tasks"}'
```

### 步骤 6：展示并确认开发任务文档

分段展示以下内容并等待用户确认：
1. 功能列表
2. 所有接口实现
3. 依赖项（前置实体实现）
4. 详细接口流程

### 步骤 7：保存任务统计与关键说明

```bash
node claude/utils/state-manager.js decision "{需求名称}" "开发任务文档已生成，包含功能列表、接口实现、依赖项与详细接口流程"
```

### 步骤 8：标记阶段完成

```bash
node claude/utils/state-manager.js update "{需求名称}" "task-list" "completed" "docs/{需求名称}/开发任务.md" '{"substage":"completed","next_action":"tdd-implementation","artifacts":{"dev_task_doc":"docs/{需求名称}/开发任务.md","task_list_doc":"docs/{需求名称}/开发任务.md","task_source_doc":"docs/{需求名称}/技术设计.md"}}'
```

### 步骤 9：输出完成摘要

```markdown
✅ Task-List 阶段完成

需求名称：{需求名称}
技术方案：docs/{需求名称}/技术设计.md
开发任务：docs/{需求名称}/开发任务.md

下一步建议：
- 进入 `tdd-implementation`
- 或继续人工审阅并调整开发任务文档
```

## 开发任务文档结构

开发任务文档来源于技术设计文档中的“详细执行计划”章节，必须包含以下章节：

1. 功能列表
2. 所有接口实现（Dubbo / HTTP / 定时任务 / MQ）
3. 依赖项（前置实体实现）
4. 详细接口流程

## 关键原则

1. **主文档优先**：技术设计文档中的“详细执行计划”是主任务真相源
2. **派生标准化**：开发任务文档是执行视图，不是新的设计来源
3. **保留映射关系**：每个功能/接口建议标注来源章节
4. **优先表达依赖顺序**：先实体、后接口、再异步链路与补充能力
5. **不要写完整实现代码**：本阶段输出任务文档，不直接输出大段代码实现

## 输出

| 输出物 | 路径 |
|------|------|
| 开发任务文档 | `docs/{需求名称}/开发任务.md` |
| 技术方案文档 | `docs/{需求名称}/技术设计.md` |
| 状态文件 | `docs/{需求名称}/state.json` |

## 下一步

**调用 `tdd-implementation` 或其他实现 Agent** 开始后续开发流程。
