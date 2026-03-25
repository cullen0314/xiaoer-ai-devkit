# Feature-Flow 工作流设计

## 概述

记录 feature-flow 从历史 skill 链路收敛到 command/agent 主链路的设计说明。

## 链式调用流程

```
用户输入：/xe:feature-flow "飞书PRD链接" "辅助说明"
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. agent-xe-tech-plan / xe:tech-plan                         │
│     • 读取飞书文档                                            │
│     • 需求澄清（按需）                                        │
│     • 生成技术设计文档                                        │
│     • 直接生成开发任务文档                                     │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. agent-xe-java-coding / xe-tdd-implementation              │
│     • 读取开发任务文档或技术设计文档                            │
│     • 执行实现 / TDD 开发                                      │
│     • 更新状态与验证结果                                       │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. tdd-implementation skill                                  │
│     • 对每个任务执行 TDD：                                    │
│     •   RED: 先写失败测试                                      │
│     •   GREEN: 写最小代码通过                                  │
│     •   REFACTOR: 重构                                         │
│     •   验证测试通过                                           │
│     • 末尾：调用 code-execution skill                             │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. code-execution skill                                      │
│     • 逐任务执行实现                                           │
│     • 每个任务独立 subagent                                     │
│     • 两阶段评审：规范 → 质量                                 │
│     • 末尾：调用 code-review skill                               │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. code-review skill (ECC code-reviewer)                       │
│     • 安全检查（CRITICAL）                                     │
│     • 代码质量（HIGH）                                          │
│     • 最佳实践（MEDIUM）                                        │
│     • 修复严重和高优先级问题                                     │
│     • 末尾：调用 verification skill                              │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. verification skill (ECC verify)                            │
│     • 构建检查                                                  │
│     • 类型检查                                                  │
│     • 运行测试                                                  │
│     • 检查覆盖率                                                │
│     • console.log 审计                                           │
│     • 生成验证报告                                              │
│     • 完成交付                                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Skill 依赖关系

| Skill | 状态 | 说明 |
|-------|------|------|
| `agent-xe-tech-plan` / `xe:tech-plan` | ✅ 当前主入口 | 链的起点，直接产出技术设计与开发任务文档 |
| `agent-xe-java-coding` / `xe-tdd-implementation` | ✅ 当前主执行入口 | 消费开发任务文档并进入实现阶段 |
| `tdd-implementation` | ✅ 已创建 | TDD 开发，末尾调用 code-execution |
| `code-execution` | ✅ 已创建 | 执行实现，末尾调用 code-review |
| `code-review` | ✅ ECC 已有 | 复用 ECC code-reviewer agent |
| `verification` | ✅ ECC 已有 | 复用 ECC verify agent |

## 输入输出

### 输入
- 飞书 PRD 链接
- 辅助说明（可选）

### 输出
- 技术设计文档 (`docs/{需求名称}/技术设计.md`)
- 开发任务文档 (`docs/{需求名称}/开发任务.md`)
- 实现代码 + 测试
- 验证报告

## 下一步

✅ 主工作流已收敛到 command / agent 主链路
✅ `tech-plan` 阶段直接产出 `技术设计.md` 与 `开发任务.md`
✅ `feature-flow` command 已更新，展示完整流程

**可选的后续工作：**
1. ✅ 创建 `xe:resume` command - 支持断点续传
2. 创建 `xe-task-executor` agent（code-execution skill 中引用）
3. 端到端测试完整的 skill 链

## 断点续传机制

### Resume Command

创建 `/xe:resume` 命令，支持在新建会话中恢复中断的流程：

```bash
# 自动检测进度并继续
/xe:resume

# 指定需求名称
/xe:resume "用户登录"
```

**检测逻辑：**

| 检测条件 | 当前阶段 | 下一步 |
|---------|---------|--------|
| 技术设计存在 | Java-Coding / TDD-Implementation | 直接读取 `开发任务.md` 或 `技术设计.md` 继续实现 |
| 开发任务文档存在 | TDD-Implementation | 调用 tdd-implementation skill |
| 代码已实现，测试未全过 | Code-Execution | 调用 code-execution skill |
| 测试通过，未 CR | Code-Review | 调用 code-review agent |
| CR 通过，未验证 | Verification | 调用 verify agent |
| 以上都有 | 完成 | 提示已完成 |

**前置检查：**

每个 skill 执行前检查前置文件是否存在，不存在时提示用户使用 `/xe:resume` 或从头开始。

## 硬性限制

- 设计未批准前，不进入实现阶段
- 测试未通过前，不进入重构
- 严重安全问题未修复，不进入验证
- 所有验证通过后，才宣布完成
