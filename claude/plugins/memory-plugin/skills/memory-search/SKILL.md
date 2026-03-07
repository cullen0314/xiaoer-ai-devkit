---
name: memory-search
description: 搜索项目 memory 和 git 历史，快速回顾技术决策、用户偏好和功能变更
allowed-tools: [Bash]
---

# Memory Search

搜索当前 repo 的 memory 文件和 git 历史。

## 使用方式

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/memory-search.sh" <keywords> [options]
```

## 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `keywords` | 是 | 搜索关键词，多个用空格分隔 |
| `--memory-only` | 否 | 仅搜索 memory 文件 |
| `--git-only` | 否 | 仅搜索 git 历史 |
| `--limit N` | 否 | git log 返回数量（默认 50） |

## 示例

```bash
# 搜索 "hook" 相关内容
bash "${CLAUDE_PLUGIN_ROOT}/scripts/memory-search.sh" "hook"

# 多关键词搜索
bash "${CLAUDE_PLUGIN_ROOT}/scripts/memory-search.sh" "memory LLM"

# 仅搜索 memory 文件
bash "${CLAUDE_PLUGIN_ROOT}/scripts/memory-search.sh" "偏好" --memory-only

# 仅搜索 git 历史，限制返回 10 条
bash "${CLAUDE_PLUGIN_ROOT}/scripts/memory-search.sh" "refactor" --git-only --limit 10
```

## 输出格式

```
# Memory Search: "关键词"

## Memory 搜索结果

### memory.md
- [偏好] 禁止添加冗余注释 (2025-02-04)
- [决策] 使用 hooks 实现 memory 系统 (2025-02-04)

### memory-20250204.md
- [变更] 新增 LLM 智能清理功能 (2025-02-04)

## Git 历史匹配

| Commit | Message |
|--------|---------|
| abc123 | feat: add memory search feature |
| def456 | refactor: improve memory hook |
```
