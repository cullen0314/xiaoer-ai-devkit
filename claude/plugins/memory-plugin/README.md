# Memory Plugin

Claude Code 项目记忆系统插件，自动记录用户偏好、技术决策和功能变更，并支持搜索回顾。

## 功能

### 1. 自动记忆（Memory Hooks）

在 `PreCompact` 和 `SessionEnd` 事件时自动触发：
- 调用 LLM 分析对话记录
- 提取用户偏好 `[偏好]`、技术决策 `[决策]`、功能变更 `[变更]`
- 保存到项目的 `.claude/memory/` 目录

### 2. 记忆搜索（Memory Search Skill）

搜索项目 memory 和 git 历史：

```bash
/memory:memory-search "关键词"
```

## 安装

### 方式 1：本地插件模式

```bash
# 使用 --plugin-dir 参数启动 Claude Code
claude --plugin-dir ./claude/plugins/memory-plugin
```

### 方式 2：软链接到 Claude Code plugins 目录

```bash
# 创建链接
ln -s $(pwd)/claude/plugins/memory-plugin ~/.claude/plugins/memory
```

## 目录结构

```
memory-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin 元数据
├── skills/
│   └── memory-search/
│       └── SKILL.md         # 搜索 Skill 定义
├── hooks/
│   └── hooks.json           # Hook 配置
├── scripts/
│   ├── memory-hook.sh       # Memory 提取脚本
│   └── memory-search.sh     # 搜索脚本
└── README.md
```

## Memory 文件结构

安装后，项目中会生成：

```
.claude/memory/
├── memory.md              # 主 Memory（汇总，≤1000行）
└── memory-20250307.md     # 每日详细记录
```

### 条目格式

```markdown
- [偏好] 禁止添加冗余注释 (2025-03-07)
- [决策] 使用 hooks 实现 memory 系统 (2025-03-07)
- [变更] 新增 LLM 智能清理功能 (2025-03-07)
```

## 使用示例

### 搜索记忆

```bash
# 搜索 "hook" 相关内容
/memory:memory-search "hook"

# 多关键词搜索
/memory:memory-search "memory LLM"

# 仅搜索 memory 文件
/memory:memory-search "偏好" --memory-only

# 仅搜索 git 历史
/memory:memory-search "refactor" --git-only
```

### 在 Agent 中使用

在 `agent-xe-tech-plan` Agent 等场景中，可以通过 Memory Search 快速回顾项目历史：

```markdown
### 步骤 3：探索项目上下文

回顾项目 Memory（推荐）：使用 `/memory:memory-search` 搜索项目历史决策和用户偏好，了解技术约定，避免重复踩坑
```

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `XM_LLM_API_KEY` | 否 | LLM API Key（有内置默认值） |
| `XM_LLM_API_BASE` | 否 | API Base URL |
| `XM_LLM_MODEL` | 否 | 模型名称（默认 kimi-k2.5） |
| `MEMORY_HOOK_DEBUG` | 否 | 设为 1 开启调试日志 |

## 日志

```bash
tail -f ~/.claude/logs/memory-hook.log
```

## 依赖

- `bash` 4.0+
- `jq` - JSON 处理工具
- `curl` - HTTP 请求工具

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

## License

MIT
