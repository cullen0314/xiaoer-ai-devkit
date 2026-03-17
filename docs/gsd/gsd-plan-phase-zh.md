# gsd:plan-phase 命令翻译

原文档：`/Users/wangyijun/Documents/common-project/get-shit-done/commands/gsd/plan-phase.md`

---

## 命令元数据

| 字段 | 值 |
|------|-----|
| **name** | `gsd:plan-phase` |
| **description** | 创建详细的阶段计划（PLAN.md），带验证循环 |
| **argument-hint** | `[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>]` |
| **agent** | `gsd-planner` |
| **allowed-tools** | Read, Write, Bash, Glob, Grep, Task, WebFetch, mcp__context7__* |

---

## 目标（objective）

为路线图阶段创建可执行的阶段提示词（PLAN.md 文件），集成研究和验证功能。

**默认流程：** 研究（如需要）→ 计划 → 验证 → 完成

**编排器角色：** 解析参数、验证阶段、研究领域（除非跳过）、生成 gsd-planner、使用 gsd-plan-checker 验证、迭代直至通过或达到最大迭代次数、展示结果。

---

## 执行上下文（execution_context）

```
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
```

---

## 上下文（context）

| 参数 | 说明 |
|------|------|
| **phase** | 阶段编号：`$ARGUMENTS`（可选 — 省略时自动检测下一个未计划的阶段） |

**标志选项：**

| 标志 | 作用 |
|------|------|
| `--research` | 强制重新研究，即使 RESEARCH.md 已存在 |
| `--skip-research` | 跳过研究，直接进入规划 |
| `--gaps` | 缺口填补模式（读取 VERIFICATION.md，跳过研究） |
| `--skip-verify` | 跳过验证循环 |
| `--prd <file>` | 使用 PRD/验收标准文件替代 discuss-phase。自动解析需求到 CONTEXT.md。完全跳过 discuss-phase。 |

> 在步骤 2 中进行阶段输入标准化，然后再进行任何目录查找。

---

## 流程（process）

端到端执行 `@~/.claude/get-shit-done/workflows/plan-phase.md` 中的 plan-phase 工作流。

保留所有工作流关卡（验证、研究、规划、验证循环、路由）。
