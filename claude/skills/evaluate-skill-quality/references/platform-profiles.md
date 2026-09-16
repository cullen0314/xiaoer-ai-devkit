# Skill 平台差异

## 通用规则

所有平台优先检查：

- `SKILL.md` 是否存在且 frontmatter 可识别。
- name、description、目录名和职责是否一致。
- 正文是否定义输入、输出、停止条件和失败处理。
- 直接引用是否可达，机械逻辑是否脚本化。
- 长度是否与信息价值匹配，而非机械追求短小。

## Claude Code

常见 frontmatter：

- `name`
- `description`
- `model`
- `argument-hint`
- `allowed-tools`
- `user-invocable`
- `disable-model-invocation`
- `context`
- `agent`

评估注意：

- 流程型或高副作用 Skill 使用 `disable-model-invocation: true` 通常合理。
- `allowed-tools` 是放行信息，不能替代正文中的行为边界。
- description 应说明做什么与何时使用；手动 Skill 的触发评分更关注参数提示和职责边界。
- SKILL.md 理想低于 500 行；超过时结合上下文密度和拆分收益判断。
- 大型 reference 应提供目录；300 行以上默认提示复核。
- Skill 自带资源优先使用 `${CLAUDE_SKILL_DIR}`，避免依赖当前工作目录。
- 默认安装位置可能包括 `~/.claude/skills/<name>` 和项目 `.claude/skills/<name>`；必须识别副本与符号链接。

## Codex

评估注意：

- name 与 description 是主要发现和触发信息，所有“何时使用”信息应进入 description。
- SKILL.md 保留核心流程与选择规则，建议低于 500 行。
- reference 超过 100 行时宜提供目录或清晰检索指引。
- `agents/openai.yaml` 属于界面与调用策略元数据；存在时检查它是否与 SKILL.md 一致。
- 确定性或重复任务优先放入 scripts，避免每次重新生成代码。
- 安装位置可能包括 `~/.codex/skills/<name>`、`$CODEX_HOME/skills/<name>` 或兼容链接。

## 通用 Agent Skills

平台无法识别时：

- 只强制通用结构和行为契约。
- 不因未知 frontmatter 字段直接判错。
- 采用 500 行作为内容复核信号，而不是硬失败线。
- 将平台专属能力标记为“未评估”或“需确认目标运行时”。

## 长度与上下文经济性

推荐观察区间：

| SKILL.md 行数 | 处理方式 |
|---:|---|
| 0～200 | 通常健康，仍检查重复和信息密度 |
| 201～500 | 可接受，检查低频分支是否适合下沉 |
| 500 以上 | 默认提示复核拆分，不自动扣分 |

同时检查：

- frontmatter description 字符数。
- 正文字符数、字数和预估 token。
- references 数量、最长文件和最大嵌套深度。
- 高频路径完成一次任务需要读取多少额外文件。
- 同一规则是否在正文和 reference 重复。
- 长篇伪代码、JSON Schema 或工具协议是否适合脚本化。

只有长度导致指令不可发现、上下文浪费、重复冲突或高频多跳时，才形成正式问题。
