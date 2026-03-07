# Agent 编排

## 可用的 Agent

位于 `~/.claude/agents/`：

| Agent | 用途 | 何时使用 |
|-------|------|----------|
| planner | 实施规划 | 复杂功能、重构 |
| architect | 系统设计 | 架构决策 |
| tdd-guide | 测试驱动开发 | 新功能、bug 修复 |
| code-reviewer | 代码评审 | 编写代码后 |
| security-reviewer | 安全分析 | 提交之前 |
| build-error-resolver | 修复构建错误 | 构建失败时 |
| e2e-runner | E2E 测试 | 关键用户流程 |
| refactor-cleaner | 死代码清理 | 代码维护 |
| doc-updater | 文档 | 更新文档 |

## 立即 Agent 使用

无需用户提示：
1. 复杂功能请求 - 使用 **planner** agent
2. 刚编写/修改的代码 - 使用 **code-reviewer** agent
3. Bug 修复或新功能 - 使用 **tdd-guide** agent
4. 架构决策 - 使用 **architect** agent

## 并行任务执行

**始终**对独立操作使用并行任务执行：

```markdown
# 好：并行执行
并行启动 3 个 agent：
1. Agent 1：认证模块的安全分析
2. Agent 2：缓存系统的性能审查
3. Agent 3：工具的类型检查

# 坏：不必要的顺序执行
先 agent 1，然后 agent 2，然后 agent 3
```

## 多视角分析

对于复杂问题，使用分裂角色的 sub-agent：
- 事实审查者
- 高级工程师
- 安全专家
- 一致性审查者
- 冗余检查者
