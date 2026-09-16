---
name: evaluate-skill-quality
description: 评估 Claude Code、Codex 或通用 Agent Skill 的设计质量与当前运行质量，检查触发契约、输入输出、自由度、停止条件、上下文长度、渐进式披露、资源依赖、验证、安全边界和安装版本漂移。用于用户要求审查、评分、诊断或改进一个现有 Skill 时；不用于评估普通业务代码或直接修改被评估 Skill。
model: inherit
argument-hint: "<SKILL.md或Skill目录> [--platform auto|claude|codex] [--runtime-check]"
allowed-tools: ["Read", "Glob", "Grep", "Bash(python3:*)", "Bash(git:*)", "Bash(diff:*)", "Bash(wc:*)", "Bash(find:*)", "AskUserQuestion"]
user-invocable: true
disable-model-invocation: true
---

# Skill 质量评估

以独立评估者身份判断 Skill 是否能在正确场景下稳定、经济、安全地完成目标。默认全程只读；不得修改被评估 Skill、安装目录或其依赖，不得执行目标 Skill 自带脚本或真实业务流程。

## 输入

从 `$ARGUMENTS` 解析：

- `target`：必填，`SKILL.md` 或 Skill 目录。
- `--platform`：可选，默认 `auto`；仅接受 `auto`、`claude`、`codex`。
- `--runtime-check`：可选，检查同名安装版本和直接依赖。

路径缺失、目标不存在或不可读时，使用 AskUserQuestion 请求修正。目录输入必须归一化为其中的 `SKILL.md`；不得凭名称猜测目标文件。

## 核心约束

<HARD-GATE>
- 只读评估；不得修改、格式化、安装、同步或执行目标 Skill
- 正式问题必须有文件位置、触发条件、可观察影响和证据；纯风格偏好、无触发条件的理论风险不得列入
- 扫描器告警只是候选证据，不得直接等同于缺陷或扣分
- 源码静态质量与当前运行质量必须分开；安装漂移不得反向降低源码设计分
- 同一根因只记录一次；不得跨维度重复扣分
- 无法读取的外部依赖标记为“未评估”，不得伪造结论
</HARD-GATE>

## 执行流程

### 1. 解析目标与平台

解析绝对目标路径、Skill 根目录和所属仓库。读取完整 `SKILL.md`，识别 frontmatter、正文和平台特征。

`auto` 模式按以下顺序识别：用户指定上下文、Claude 专有 frontmatter/目录、Codex `agents/openai.yaml`、通用 Agent Skills。无法可靠识别时使用通用规则，并在报告中说明。

### 2. 建立最小评估范围

收集：

- Skill 根目录文件清单
- SKILL.md 直接引用的 references、scripts、assets 和模板
- 正文直接调用的 Skill、Agent 和工具
- 仓库根目录的 `AGENTS.md`、`CLAUDE.md` 或同类项目规则（存在时）

默认只检查一层直接引用。只有发现输入输出契约不一致、引用失效或运行时漂移时，才定向读取直接依赖；一旦能够证明问题成立或不成立，立即停止扩展，不扫描完整仓库。

### 3. 运行确定性扫描

执行本 Skill 自带扫描器：

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/scan_skill.py" "<target>" --platform "<platform>"
```

启用运行时检查时追加 `--runtime-check`。开发态找不到 `${CLAUDE_SKILL_DIR}` 时，使用当前 SKILL.md 所在目录的绝对路径；不得改用网络下载脚本。

扫描结果用于提供：

- frontmatter、名称、长度、字数和预估 token
- 直接引用与缺失资源
- 绝对路径、引号内 `~` 和 reference 嵌套
- 工具调用与 `allowed-tools`
- 输入、输出、停止条件和只读边界信号
- 测试/eval 资产
- 同名安装版本及直接依赖状态

保留原始 JSON 事实；逐条复核 `warnings` 后再形成问题。

### 4. 评估上下文经济性

同时判断长度与内容价值，不按行数机械扣分：

- SKILL.md 是否低于平台建议上限
- 高频路径是否能在正文内闭环
- 低频分支是否已下沉到 references
- reference 是否过长、缺少目录或嵌套过深
- 是否重复解释常识、复制同一规则或泄漏大量低频细节
- 机械逻辑是否仍以长篇自然语言表达，而非脚本化
- scripts 的长度不作为上下文成本直接扣分

报告中列出行数、字符数、字数、预估 token、reference 层级和可下沉内容。读取 `references/platform-profiles.md` 获取平台阈值。

### 5. 按八个维度评估

完整读取 `references/quality-rubric.md`，逐项评估：

1. 目标与触发
2. 输入输出契约
3. 自由度与流程
4. 渐进式披露
5. 资源与依赖
6. 验证与评测
7. 安全与副作用
8. 路径与运行时

每个维度先记录事实和优点，再记录成立的问题，最后给分。分数必须能从明细相加得到；缺少证据时标记未评估并说明，不通过猜测补齐。

### 6. 检查直接依赖与运行时

仅在 `--runtime-check` 或用户明确关心实际可运行性时执行：

1. 查找同名安装 Skill，比较源文件摘要和关键 frontmatter。
2. 对正文直接调用的 Skill/Agent，检查仓库版与安装版是否存在。
3. 调用方显式消费结构化字段时，定向核对被调用方输出契约。
4. 区分源码设计问题、安装部署问题、依赖问题和未验证项。

不得执行安装、复制或同步。发现版本漂移时给出具体文件证据，但不自动修复。

### 7. 过滤、分级并收敛

正式 issue 必须包含：`severity`、`title`、`location`、`trigger`、`impact`、`evidence`、`suggestion`、`blocking`。

使用 P0/P1/P2/P3 分级。相同根因影响多个维度时只在主要维度扣分，其他维度引用该 issue。最多列出五项优先改进，按“阻塞运行 → 写入与安全 → 契约 → 验证 → 经济性”排序。

### 8. 输出报告

严格使用以下结构：

```markdown
# Skill 质量评估报告

## 总体结论
- 评估对象：{绝对路径}
- 平台：{claude|codex|generic}
- 源码静态质量：{score}/100
- 当前运行质量：{score}/100 | 未评估
- 等级：{A|B|C|D}
- 建议：{可稳定使用|修复后使用|不建议直接使用}

## 做得好的地方
## P0/P1/P2/P3 问题
## 评分明细
## 上下文经济性
## 依赖与运行时兼容性
## 优先改进顺序
## 评估范围与未覆盖项
```

引用本地文件时使用绝对路径和精确行号。没有某级问题时明确写“无”，不得为填满结构制造问题。

## 完成条件

满足以下条件后结束：

- 八个维度均有结论或明确标记未评估
- 所有正式问题均有证据、影响和严重度
- 评分相加一致，源码与运行时评分已分离
- 上下文长度与信息密度均已评估
- 给出不超过五项的优先改进顺序
- 明确说明只读评估范围和未覆盖项

用户随后要求修改目标 Skill 时，停止当前评估流程，先给出涉及文件、改动内容、影响范围和验证方式，等待用户确认后再修改。
