# Feature-Flow Skill Chain 设计

## 概述

参考 superpowers 的链式调用设计，为新功能开发创建完整的 skill 链。

## 链式调用流程

```
用户输入：/xe:feature-flow "飞书PRD链接" "辅助说明"
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. tech-plan skill                                          │
│     • 读取飞书文档                                            │
│     • 需求澄清（逐个提问）                                    │
│     • 提出 2-3 种方案                                         │
│     • 分段展示设计，获取批准                                  │
│     • 生成技术设计文档                                        │
│     • 末尾：调用 task-list skill                                 │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. task-list skill                                          │
│     • 读取技术设计文档                                        │
│     • 分解为可执行任务（2-5分钟/个）                           │
│     • 每个任务包含：文件路径、代码、命令、验证                   │
│     • 创建 TODO 列表                                            │
│     • 末尾：调用 tdd-implementation skill                        │
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
| `tech-plan` | ✅ 已创建并更新 | 链的起点，末尾调用 task-list |
| `task-list` | ✅ 已创建 | 分解任务，末尾调用 tdd-implementation |
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
- 任务列表文档 (`docs/plans/YYYY-MM-DD-{feature-name}.md`)
- 实现代码 + 测试
- 验证报告

## 下一步

✅ 所有 skills 已创建完成
✅ `tech-plan` skill 已更新，末尾调用 `task-list`
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
| 技术设计存在 | Task-List | 调用 task-list skill |
| 任务列表存在 | TDD-Implementation | 调用 tdd-implementation skill |
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
