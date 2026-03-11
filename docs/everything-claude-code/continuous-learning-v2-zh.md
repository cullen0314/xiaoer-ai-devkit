---
name: continuous-learning-v2
description: 基于 Instinct（本能）的学习系统，通过 hooks 观察会话，创建带信心评分的原子本能，并将其演进为 skills/commands/agents。v2.1 新增项目级本能，防止跨项目污染。
origin: ECC
version: 2.1.0
---

# 持续学习 v2.1 - 基于 Instinct 的架构

一个高级学习系统，通过原子化的"本能"（instincts）—— 带信心评分的小型学习行为，将你的 Claude Code 会话转化为可复用的知识。

**v2.1** 新增 **项目级本能** —— React 模式保留在你的 React 项目中，Python 约定保留在你的 Python 项目中，而通用模式（如"始终验证输入"）则在全局共享。

## 何时激活

- 设置从 Claude Code 会话中自动学习
- 通过 hooks 配置基于本能的行为提取
- 调整已学习行为的信心阈值
- 审查、导出或导入本能库
- 将本能演进为完整的 skills、commands 或 agents
- 管理项目级与全局本能
- 将本能从项目级提升到全局作用域

## v2.1 新功能

| 功能 | v2.0 | v2.1 |
|---------|------|------|
| 存储 | 全局 (~/.claude/homunculus/) | 项目级 (projects/<hash>/) |
| 作用域 | 所有本能到处适用 | 项目级 + 全局 |
| 检测 | 无 | git remote URL / repo path |
| 提升 | N/A | 项目 -> 全局（当在 2+ 项目中出现时） |
| 命令 | 4 个 (status/evolve/export/import) | 6 个 (+promote/projects) |
| 跨项目 | 有污染风险 | 默认隔离 |

## v2 新功能（对比 v1）

| 功能 | v1 | v2 |
|---------|----|----|
| 观察 | Stop hook（会话结束） | PreToolUse/PostToolUse（100% 可靠） |
| 分析 | 主上下文 | 后台 agent（Haiku） |
| 粒度 | 完整 skills | 原子"instincts" |
| 信心度 | 无 | 0.3-0.9 加权 |
| 演进 | 直接生成 skill | Instincts -> 聚类 -> skill/command/agent |
| 分享 | 无 | 导出/导入 instincts |

## Instinct 模型

Instinct 是一个小型的学习行为：

```yaml
---
id: prefer-functional-style
trigger: "编写新函数时"
confidence: 0.7
domain: "code-style"
source: "session-observation"
scope: project
project_id: "a1b2c3d4e5f6"
project_name: "my-react-app"
---

# 偏好函数式风格

## 行动
适当时使用函数式模式而非类。

## 证据
- 观察到 5 次函数式模式偏好
- 用户在 2025-01-15 将基于类的方式更正为函数式
```

**属性：**
- **原子化** -- 一个触发器，一个行动
- **信心加权** -- 0.3 = 试探性，0.9 = 接近确定
- **领域标签** -- code-style、testing、git、debugging、workflow 等
- **证据支持** -- 追踪创建它的观察记录
- **作用域感知** -- `project`（默认）或 `global`

## 工作原理

```
会话活动（在 git 仓库中）
      |
      | Hooks 捕获提示词 + 工具使用（100% 可靠）
      | + 检测项目上下文（git remote / repo path）
      v
+---------------------------------------------+
|  projects/<project-hash>/observations.jsonl  |
|   (提示词、工具调用、结果、项目)            |
+---------------------------------------------+
      |
      | Observer agent 读取（后台，Haiku）
      v
+---------------------------------------------+
|              模式检测                        |
|   * 用户更正 -> instinct                    |
|   * 错误解决 -> instinct                    |
|   * 重复工作流 -> instinct                  |
|   * 作用域决策：project 还是 global？       |
+---------------------------------------------+
      |
      | 创建/更新
      v
+---------------------------------------------+
|  projects/<project-hash>/instincts/personal/ |
|   * prefer-functional.yaml (0.7) [project]  |
|   * use-react-hooks.yaml (0.9) [project]    |
+---------------------------------------------+
|  instincts/personal/  (全局)                |
|   * always-validate-input.yaml (0.85) [global]|
|   * grep-before-edit.yaml (0.6) [global]    |
+---------------------------------------------+
      |
      | /evolve 聚类 + /promote
      v
+---------------------------------------------+
|  projects/<hash>/evolved/ (项目级)           |
|  evolved/ (全局)                            |
|   * commands/new-feature.md                 |
|   * skills/testing-workflow.md              |
|   * agents/refactor-specialist.md           |
+---------------------------------------------+
```

## 项目检测

系统自动检测你当前的项目：

1. **`CLAUDE_PROJECT_DIR` 环境变量**（最高优先级）
2. **`git remote get-url origin`** -- 哈希化以创建可移植的项目 ID（不同机器上的同一仓库获得相同 ID）
3. **`git rev-parse --show-toplevel`** -- 使用仓库路径的回退方案（机器特定）
4. **全局回退** -- 如果未检测到项目，本能进入全局作用域

每个项目获得一个 12 字符的哈希 ID（例如 `a1b2c3d4e5f6`）。位于 `~/.claude/homunculus/projects.json` 的注册表文件将 ID 映射到人类可读的名称。

## 快速开始

### 1. 启用观察 Hooks

添加到你的 `~/.claude/settings.json`。

**如果作为插件安装**（推荐）：

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/skills/continuous-learning-v2/hooks/observe.sh"
      }]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/skills/continuous-learning-v2/hooks/observe.sh"
      }]
    }]
  }
}
```

**如果手动安装**到 `~/.claude/skills`：

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/skills/continuous-learning-v2/hooks/observe.sh"
      }]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/skills/continuous-learning-v2/hooks/observe.sh"
      }]
    }]
  }
}
```

### 2. 初始化目录结构

系统会在首次使用时自动创建目录，但你也可以手动创建：

```bash
# 全局目录
mkdir -p ~/.claude/homunculus/{instincts/{personal,inherited},evolved/{agents,skills,commands},projects}

# 项目目录在 hook 首次在 git repo 中运行时自动创建
```

### 3. 使用 Instinct 命令

```bash
/instinct-status     # 显示已学习的本能（项目 + 全局）
/evolve              # 将相关本能聚类为 skills/commands
/instinct-export     # 导出本能到文件
/instinct-import     # 从他人导入本能
/promote             # 将项目本能提升到全局作用域
/projects            # 列出所有已知项目及其本能计数
```

## 命令

| 命令 | 描述 |
|---------|-------------|
| `/instinct-status` | 显示所有本能（项目级 + 全局）及其信心度 |
| `/evolve` | 将相关本能聚类为 skills/commands，建议提升 |
| `/instinct-export` | 导出本能（可按作用域/领域过滤） |
| `/instinct-import <file>` | 导入本能并控制作用域 |
| `/promote [id]` | 将项目本能提升到全局作用域 |
| `/projects` | 列出所有已知项目及其本能计数 |

## 配置

编辑 `config.json` 来控制后台观察器：

```json
{
  "version": "2.1",
  "observer": {
    "enabled": false,
    "run_interval_minutes": 5,
    "min_observations_to_analyze": 20
  }
}
```

| 键 | 默认值 | 描述 |
|-----|---------|-------------|
| `observer.enabled` | `false` | 启用后台观察器 agent |
| `observer.run_interval_minutes` | `5` | 观察器分析观察结果的频率 |
| `observer.min_observations_to_analyze` | `20` | 分析运行前的最小观察数 |

其他行为（观察捕获、本能阈值、项目作用域、提升标准）通过 `instinct-cli.py` 和 `observe.sh` 中的代码默认值配置。

## 文件结构

```
~/.claude/homunculus/
+-- identity.json           # 你的个人资料、技术水平
+-- projects.json           # 注册表：项目哈希 -> 名称/路径/远程
+-- observations.jsonl      # 全局观察（回退）
+-- instincts/
|   +-- personal/           # 全局自动学习的本能
|   +-- inherited/          # 全局导入的本能
+-- evolved/
|   +-- agents/             # 全局生成的 agents
|   +-- skills/             # 全局生成的 skills
|   +-- commands/           # 全局生成的 commands
+-- projects/
    +-- a1b2c3d4e5f6/       # 项目哈希（来自 git remote URL）
    |   +-- observations.jsonl
    |   +-- observations.archive/
    |   +-- instincts/
    |   |   +-- personal/   # 项目特定的自动学习
    |   |   +-- inherited/  # 项目特定的导入
    |   +-- evolved/
    |       +-- skills/
    |       +-- commands/
    |       +-- agents/
    +-- f6e5d4c3b2a1/       # 另一个项目
        +-- ...
```

## 作用域决策指南

| 模式类型 | 作用域 | 示例 |
|-------------|-------|---------|
| 语言/框架约定 | **project** | "使用 React hooks"、"遵循 Django REST 模式" |
| 文件结构偏好 | **project** | "测试在 `__tests__`/"、"组件在 src/components/" |
| 代码风格 | **project** | "使用函数式风格"、"偏好 dataclasses" |
| 错误处理策略 | **project** | "使用 Result 类型处理错误" |
| 安全实践 | **global** | "验证用户输入"、"清理 SQL" |
| 通用最佳实践 | **global** | "先写测试"、"始终处理错误" |
| 工具工作流偏好 | **global** | "Edit 前先 Grep"、"Write 前先 Read" |
| Git 实践 | **global** | "约定式提交"、"小型专注提交" |

## Instinct 提升（项目 -> 全局）

当相同的本能以高信心出现在多个项目中时，它就是提升到全局作用域的候选者。

**自动提升标准：**
- 2+ 项目中存在相同的本能 ID
- 平均信心 >= 0.8

**如何提升：**

```bash
# 提升特定本能
python3 instinct-cli.py promote prefer-explicit-errors

# 自动提升所有符合条件的本能
python3 instinct-cli.py promote

# 预览而不做更改
python3 instinct-cli.py promote --dry-run
```

`/evolve` 命令也会建议提升候选者。

## 信心评分

信心会随时间演变：

| 分数 | 含义 | 行为 |
|-------|---------|----------|
| 0.3 | 试探性 | 建议但不强制执行 |
| 0.5 | 中等 | 相关时应用 |
| 0.7 | 强 | 自动批准应用 |
| 0.9 | 接近确定 | 核心行为 |

**信心增加**当：
- 模式被反复观察
- 用户不更正建议的行为
- 来自其他来源的类似本能一致

**信心减少**当：
- 用户明确更正该行为
- 模式长时间未被观察
- 出现矛盾的证据

## 为什么用 Hooks 而非 Skills 来观察？

> "v1 依赖 skills 来观察。Skills 是概率性的 -- 它们根据 Claude 的判断大约 50-80% 的时间触发。"

Hooks **100% 确定**地触发。这意味着：
- 每个工具调用都被观察
- 不会遗漏模式
- 学习是全面的

## 向后兼容

v2.1 完全兼容 v2.0 和 v1：
- `~/.claude/homunculus/instincts/` 中的现有全局本能仍然作为全局本能工作
- v1 的现有 `~/.claude/skills/learned/` skills 仍然工作
- Stop hook 仍然运行（但现在也馈入 v2）
- 逐步迁移：并行运行两者

## 隐私

- 观察结果保留在你的机器上**本地**
- 项目级本能按项目隔离
- 只有**instincts**（模式）可以导出 — 不是原始观察
- 不共享实际代码或对话内容
- 你控制导出和提升的内容

## 相关

- [Skill Creator](https://skill-creator.app) - 从仓库历史生成 instincts
- Homunculus - 启发 v2 基于 instinct 架构的社区项目（原子观察、信心评分、本能演进管道）
- [长篇指南](https://x.com/affaanmustafa/status/2014040193557471352) - 持续学习部分

---

*基于本能的学习：一次一个项目地教 Claude 你的模式。*
