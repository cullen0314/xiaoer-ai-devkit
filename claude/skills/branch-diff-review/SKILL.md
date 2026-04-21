---
name: branch-diff-review
description: 对比当前分支与 master 差异，快速总结当前工作状态。当用户说"对比分支"、"看看改了什么"、"总结一下当前改动"、"/branch-diff-review"时触发。
allowed-tools: [Bash, Read, Grep, Glob]
---

# 分支变更速览

快速读懂当前分支的工作状态，不需要用户口述。

## 工作流程

### 步骤 1：获取变更概览

```bash
git branch --show-current
git diff master --name-status
git diff master --stat
```

若当前分支就是 master，提示用户切换到目标分支后再执行。

### 步骤 2：读取关键 diff

对变更文件执行 `git diff master -- <file>`，重点关注：
- 新增/修改的类、方法、接口
- 业务逻辑变更（if/else、校验、流程）
- TODO、FIXME、HACK 等标记

非代码文件（配置、pom.xml、资源文件）扫一眼即可，不需要逐行分析。

## 输出格式

```markdown
## 分支：{branch} vs master

### 当前在做什么
{从改动中推断意图，1-2 句话概括}

### 关键修改文件
- `path/to/File.java` — {一句话说明改了什么}
- `path/to/AnotherFile.java` — {一句话说明}
- ...

### TODO / 未完成工作
- [ ] {从 diff 中发现的 TODO/FIXME}
- [ ] {注释掉的代码、半完成的逻辑}
（无则写"无"）
```

## 规则

- 中文输出，Java 类名方法名保留英文
- 推断意图要基于实际 diff 内容，不猜测
- 保持简洁，不做风险评级，不搜调用方
