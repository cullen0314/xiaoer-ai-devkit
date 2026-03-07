# Git 工作流

## 提交消息格式
```
<type>: <description>

<optional body>
```

类型：feat, fix, refactor, docs, test, chore, perf, ci

注意：通过 ~/.claude/settings.json 全局禁用了署名。

## Pull Request 工作流

创建 PR 时：
1. 分析完整的提交历史（不仅仅是最新提交）
2. 使用 `git diff [base-branch]...HEAD` 查看所有更改
3. 起草全面的 PR 摘要
4. 包含带 TODO 的测试计划
5. 如果是新分支，使用 `-u` 标志推送

> 对于 git 操作之前的完整开发流程（规划、TDD、代码评审），
> 参见 [development-workflow.md](./development-workflow.md)。
