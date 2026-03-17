# GSD plan-phase 工作流翻译

原文档：`/Users/wangyijun/Documents/common-project/get-shit-done/get-shit-done/workflows/plan-phase.md`

---

## 目的（purpose）

为路线图阶段创建可执行的阶段提示词（PLAN.md 文件），集成研究和验证功能。

**默认流程：** 研究（如需要）→ 计划 → 验证 → 完成

编排 `gsd-phase-researcher`、`gsd-planner` 和 `gsd-plan-checker` 代理，使用修订循环（最多 3 次迭代）。

---

## 必读材料（required_reading）

在开始之前，读取调用提示词的 execution_context 中引用的所有文件。

```
@~/.claude/get-shit-done/references/ui-brand.md
```

---

## 流程（process）

### 1. 初始化

一次调用加载所有上下文（仅路径以最小化编排器上下文）：

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON 获取：
- `researcher_model`, `planner_model`, `checker_model`
- `research_enabled`, `plan_checker_enabled`, `nyquist_validation_enabled`
- `commit_docs`
- `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`
- `has_research`, `has_context`, `has_plans`, `plan_count`
- `planning_exists`, `roadmap_exists`
- `phase_req_ids`

**文件路径（用于 `<files_to_read>` 块）：**
`state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `verification_path`, `uat_path`
如果文件不存在，这些值为 null。

**如果 `planning_exists` 为 false：** 错误 — 需要先运行 `/gsd:new-project`。

---

### 2. 解析和规范化参数

从 `$ARGUMENTS` 提取：
- 阶段编号（整数或小数，如 `2.1`）
- 标志（`--research`, `--skip-research`, `--gaps`, `--skip-verify`, `--prd <filepath>`）

从 `$ARGUMENTS` 提取 `--prd <filepath>`。如果存在，将 PRD_FILE 设置为该文件路径。

**如果没有阶段编号：** 从路线图检测下一个未计划的阶段。

**如果 `phase_found` 为 false：** 验证阶段是否存在于 ROADMAP.md 中。如果有效，使用 init 中的 `phase_slug` 和 `padded_phase` 创建目录：

```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**从 init 获取的现有构件：** `has_research`, `has_plans`, `plan_count`。

---

### 3. 验证阶段

```bash
PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
```

**如果 `found` 为 false：** 错误，显示可用阶段。
**如果 `found` 为 true：** 从 JSON 提取 `phase_number`, `phase_name`, `goal`。

---

### 3.5. 处理 PRD 快速路径

**跳过条件：** 参数中没有 `--prd` 标志。

**如果提供了 `--prd <filepath>`：**

1. 读取 PRD 文件：
```bash
PRD_CONTENT=$(cat "$PRD_FILE" 2>/dev/null)
if [ -z "$PRD_CONTENT" ]; then
  echo "Error: PRD file not found: $PRD_FILE"
  exit 1
fi
```

2. 显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PRD EXPRESS PATH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Using PRD: {PRD_FILE}
Generating CONTEXT.md from requirements...
```

3. 解析 PRD 内容并生成 CONTEXT.md。编排器应该：
   - 从 PRD 提取所有需求、用户故事、验收标准和约束
   - 将每个映射到锁定决策（PRD 中的所有内容都被视为锁定决策）
   - 识别 PRD 未覆盖的任何区域并标记为 "Claude's Discretion"
   - **从 ROADMAP.md 提取规范引用**用于此阶段，加上 PRD 中引用的任何规范/ADR — 扩展为完整文件路径（必需）
   - 在阶段目录中创建 CONTEXT.md

4. 写入 CONTEXT.md：
```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning
**Source:** PRD Express Path ({PRD_FILE})

<domain>
## Phase Boundary

[从 PRD 提取 — 此阶段交付的内容]

</domain>

<decisions>
## Implementation Decisions

{对于 PRD 中的每个需求/故事/标准：}
### [从内容派生的类别]
- [作为锁定决策的需求]

### Claude's Discretion
[PRD 未覆盖的区域 — 实现细节、技术选择]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

[必需。从 ROADMAP.md 和 PRD 中引用的任何文档提取。
使用完整相对路径。按主题区域分组。]

### [主题区域]
- `path/to/spec-or-adr.md` — [它决定/定义的内容]

[如果没有外部规范："No external specs — requirements fully captured in decisions above"]

</canonical_refs>

<specifics>
## Specific Ideas

[来自 PRD 的任何具体引用、示例或具体需求]

</specifics>

<deferred>
## Deferred Ideas

[PRD 中明确标记为未来/v2/超出范围的项目]
[如果没有："None — PRD covers phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date] via PRD Express Path*
```

5. 提交：
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): generate context from PRD" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

6. 将 `context_content` 设置为生成的 CONTEXT.md 内容，继续到步骤 5（处理研究）。

**效果：** 这完全绕过步骤 4（加载 CONTEXT.md），因为我们刚刚创建了它。工作流的其余部分（研究、规划、验证）使用从 PRD 派生的上下文正常进行。

---

### 4. 加载 CONTEXT.md

**跳过条件：** 使用了 PRD 快速路径（CONTEXT.md 已在步骤 3.5 中创建）。

检查 init JSON 中的 `context_path`。

如果 `context_path` 不为 null，显示：`Using phase context from: ${context_path}`

**如果 `context_path` 为 null（不存在 CONTEXT.md）：**

使用 AskUserQuestion：
- header: "No context"
- question: "Phase {X} 未找到 CONTEXT.md。计划将仅使用研究和需求 — 您的设计偏好不会被包含。继续还是先捕获上下文？"
- options:
  - "Continue without context" — 仅使用研究 + 需求进行规划
  - "Run discuss-phase first" — 在规划之前捕获设计决策

如果选择 "Continue without context"：继续到步骤 5。
如果选择 "Run discuss-phase first"：显示 `/gsd:discuss-phase {X}` 并退出工作流。

---

### 5. 处理研究

**跳过条件：** `--gaps` 标志、`--skip-research` 标志，或 `research_enabled` 为 false（来自 init）且没有 `--research` 覆盖。

**如果 `has_research` 为 true（来自 init）且没有 `--research` 标志：** 使用现有的，跳到步骤 6。

**如果 RESEARCH.md 缺失或存在 `--research` 标志：**

显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning researcher...
```

#### 生成 gsd-phase-researcher

```bash
PHASE_DESC=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}" | jq -r '.section')
```

研究提示词：

```markdown
<objective>
研究如何实现 Phase {phase_number}: {phase_name}
回答："要做好这个阶段的规划，我需要知道什么？"
</objective>

<files_to_read>
- {context_path} (来自 /gsd:discuss-phase 的用户决策)
- {requirements_path} (项目需求)
- {state_path} (项目决策和历史)
</files_to_read>

<additional_context>
**阶段描述：** {phase_description}
**阶段需求 ID（必须处理）：** {phase_req_ids}

**项目指令：** 如果存在 ./CLAUDE.md 则阅读 — 遵循项目特定指南
**项目技能：** 检查 .claude/skills/ 或 .agents/skills/ 目录（如果任一存在）— 阅读 SKILL.md 文件，研究应考虑项目技能模式
</additional_context>

<output>
写入到：{phase_dir}/{phase_num}-RESEARCH.md
</output>
```

```
Task(
  prompt=research_prompt,
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

#### 处理研究器返回

- **`## RESEARCH COMPLETE`：** 显示确认，继续到步骤 6
- **`## RESEARCH BLOCKED`：** 显示阻塞器，提供选项：1) 提供上下文，2) 跳过研究，3) 中止

---

### 5.5. 创建验证策略

跳过条件：`nyquist_validation_enabled` 为 false 或 `research_enabled` 为 false。

如果 `research_enabled` 为 false 且 `nyquist_validation_enabled` 为 true：警告 "Nyquist 验证已启用但研究已禁用 — 无法在没有 RESEARCH.md 的情况下创建 VALIDATION.md。计划将缺少验证要求（维度 8）。继续到步骤 6。

```bash
grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
```

**如果找到：**
1. 读取模板：`~/.claude/get-shit-done/templates/VALIDATION.md`
2. 写入到 `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`（使用 Write 工具）
3. 填充 frontmatter：`{N}` → 阶段编号，`{phase-slug}` → slug，`{date}` → 当前日期
4. 验证：
```bash
test -f "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md" && echo "VALIDATION_CREATED=true" || echo "VALIDATION_CREATED=false"
```
5. 如果 `VALIDATION_CREATED=false`：停止 — 不要继续到步骤 6
6. 如果 `commit_docs`：`commit-docs "docs(phase-${PHASE}): add validation strategy"`

**如果未找到：** 警告并继续 — 计划可能在维度 8 上失败。

---

### 6. 检查现有计划

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null
```

**如果存在：** 提供选项：1) 添加更多计划，2) 查看现有计划，3) 从头重新规划。

---

### 7. 使用 INIT 中的上下文路径

从 INIT JSON 提取：

```bash
STATE_PATH=$(printf '%s\n' "$INIT" | jq -r '.state_path // empty')
ROADMAP_PATH=$(printf '%s\n' "$INIT" | jq -r '.roadmap_path // empty')
REQUIREMENTS_PATH=$(printf '%s\n' "$INIT" | jq -r '.requirements_path // empty')
RESEARCH_PATH=$(printf '%s\n' "$INIT" | jq -r '.research_path // empty')
VERIFICATION_PATH=$(printf '%s\n' "$INIT" | jq -r '.verification_path // empty')
UAT_PATH=$(printf '%s\n' "$INIT" | jq -r '.uat_path // empty')
CONTEXT_PATH=$(printf '%s\n' "$INIT" | jq -r '.context_path // empty')
```

---

### 7.5. 验证 Nyquist 构件

跳过条件：`nyquist_validation_enabled` 为 false 或 `research_enabled` 为 false。

```bash
VALIDATION_EXISTS=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
```

如果缺失且启用了 Nyquist — 询问用户：
1. 使用研究重新运行：`/gsd:plan-phase {PHASE} --research`
2. 禁用 Nyquist：`node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow.nyquist_validation false`
3. 无论如何继续（计划在维度 8 上失败）

仅当用户选择 2 或 3 时继续到步骤 8。

---

### 8. 生成 gsd-planner 代理

显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner...
```

规划器提示词：

```markdown
<planning_context>
**阶段：** {phase_number}
**模式：** {standard | gap_closure}

<files_to_read>
- {state_path} (项目状态)
- {roadmap_path} (路线图)
- {requirements_path} (需求)
- {context_path} (来自 /gsd:discuss-phase 的用户决策)
- {research_path} (技术研究)
- {verification_path} (验证缺口 - 如果是 --gaps)
- {uat_path} (UAT 缺口 - 如果是 --gaps)
</files_to_read>

**阶段需求 ID（每个 ID 必须出现在计划的 `requirements` 字段中）：** {phase_req_ids}

**项目指令：** 如果存在 ./CLAUDE.md 则阅读 — 遵循项目特定指南
**项目技能：** 检查 .claude/skills/ 或 .agents/skills/ 目录（如果任一存在）— 阅读 SKILL.md 文件，计划应考虑项目技能规则
</planning_context>

<downstream_consumer>
输出由 /gsd:execute-phase 使用。计划需要：
- Frontmatter（wave, depends_on, files_modified, autonomous）
- XML 格式的任务，带有 read_first 和 acceptance_criteria 字段（每个任务必需）
- 验证标准
- 用于目标反向验证的 must_haves
</downstream_consumer>

<deep_work_rules>
## 反浅执行规则（必需）

每个任务必须包含这些字段 — 它们不是可选的：

1. **`<read_first>`** — 执行器在修改任何内容之前必须读取的文件。始终包括：
   - 正在修改的文件（以便执行器看到当前状态，而不是假设）
   - CONTEXT.md 中引用的任何"真实来源"文件（参考实现、现有模式、配置文件、架构）
   - 任何必须复制或尊重其模式、签名、类型或约定的文件

2. **`<acceptance_criteria>`** — 证明任务正确完成的可验证条件。规则：
   - 每个标准必须可以通过 grep、文件读取、测试命令或 CLI 输出来检查
   - 永远不要使用主观语言（"看起来正确"、"配置正确"、"与...一致"）
   - 始终包括必须存在的确切字符串、模式、值或命令输出
   - 示例：
     - 代码：`auth.py contains def verify_token(` / `test_auth.py exits 0`
     - 配置：`.env.example contains DATABASE_URL=` / `Dockerfile contains HEALTHCHECK`
     - 文档：`README.md contains '## Installation'` / `API.md lists all endpoints`
     - 基础设施：`deploy.yml has rollback step` / `docker-compose.yml has healthcheck for db`

3. **`<action>`** — 必须包括具体值，而不是引用。规则：
   - 永远不要说"将 X 与 Y 对齐"、"将 X 匹配到 Y"、"更新以保持一致"而不指定确切的目标状态
   - 始终包括实际值：配置键、函数签名、SQL 语句、类名、导入路径、环境变量等
   - 如果 CONTEXT.md 有比较表或预期值，将它们逐字复制到操作中
   - 执行器应该能够仅从操作文本完成任务，而无需阅读 CONTEXT.md 或参考文件（read_first 用于验证，而不是发现）

**为什么这很重要：** 执行器代理从计划文本工作。像"更新配置以匹配生产环境"这样的模糊指令会产生浅层的单行更改。像"添加 DATABASE_URL=postgresql://...，设置 POOL_SIZE=20，添加 REDIS_URL=redis://..."这样的具体指令会产生完整的工作。冗长计划的成本远低于重新做浅执行的成本。
</deep_work_rules>

<quality_gate>
- [ ] 在阶段目录中创建了 PLAN.md 文件
- [ ] 每个计划都有有效的 frontmatter
- [ ] 任务具体且可操作
- [ ] 每个任务都有 `<read_first>`，至少包括正在修改的文件
- [ ] 每个任务都有 `<acceptance_criteria>`，带有可验证的条件
- [ ] 每个 `<action>` 包含具体值（没有"将 X 与 Y 对齐"而不指定具体内容）
- [ ] 正确识别依赖关系
- [ ] 为并行执行分配了波次
- [ ] 从阶段目标派生了 must_haves
</quality_gate>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Plan Phase {phase}"
)
```

---

### 9. 处理规划器返回

- **`## PLANNING COMPLETE`：** 显示计划数量。如果 `--skip-verify` 或 `plan_checker_enabled` 为 false（来自 init）：跳到步骤 13。否则：步骤 10。
- **`## CHECKPOINT REACHED`：** 展示给用户，获取响应，生成继续代理（步骤 12）
- **`## PLANNING INCONCLUSIVE`：** 显示尝试，提供选项：添加上下文 / 重试 / 手动处理

---

### 10. 生成 gsd-plan-checker 代理

显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

检查器提示词：

```markdown
<verification_context>
**阶段：** {phase_number}
**阶段目标：** {来自 ROADMAP 的 goal}

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (要验证的计划)
- {roadmap_path} (路线图)
- {requirements_path} (需求)
- {context_path} (来自 /gsd:discuss-phase 的用户决策)
- {research_path} (技术研究 — 包括验证架构)
</files_to_read>

**阶段需求 ID（必须全部覆盖）：** {phase_req_ids}

**项目指令：** 如果存在 ./CLAUDE.md 则阅读 — 验证计划遵守项目指南
**项目技能：** 检查 .claude/skills/ 或 .agents/skills/ 目录（如果任一存在）— 验证计划考虑了项目技能规则
</verification_context>

<expected_output>
- ## VERIFICATION PASSED — 所有检查通过
- ## ISSUES FOUND — 结构化问题列表
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} plans"
)
```

---

### 11. 处理检查器返回

- **`## VERIFICATION PASSED`：** 显示确认，继续到步骤 13。
- **`## ISSUES FOUND`：** 显示问题，检查迭代次数，继续到步骤 12。

---

### 12. 修订循环（最多 3 次迭代）

跟踪 `iteration_count`（在初始计划 + 检查后从 1 开始）。

**如果 iteration_count < 3：**

显示：`Sending back to planner for revision... (iteration {N}/3)`

修订提示词：

```markdown
<revision_context>
**阶段：** {phase_number}
**模式：** revision

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (现有计划)
- {context_path} (来自 /gsd:discuss-phase 的用户决策)
</files_to_read>

**检查器问题：** {来自检查器的结构化问题}
</revision_context>

<instructions>
进行有针对性的更新以解决检查器问题。
除非问题根本，否则不要从头重新规划。
返回更改的内容。
</instructions>
```

```
Task(
  prompt=revision_prompt,
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

规划器返回后 → 再次生成检查器（步骤 10），增加 iteration_count。

**如果 iteration_count >= 3：**

显示：`Max iterations reached. {N} issues remain:` + 问题列表

提供选项：1) 强制继续，2) 提供指导并重试，3) 放弃

---

### 13. 展示最终状态

根据标志/配置路由到 `<offer_next>` 或 `auto_advance`。

---

### 14. 自动推进检查

检查自动推进触发器：

1. 从 `$ARGUMENTS` 解析 `--auto` 标志
2. **将链标志与意图同步** — 如果用户手动调用（没有 `--auto`），清除任何先前中断的 `--auto` 链的临时链标志。这不会触及 `workflow.auto_advance`（用户的持久设置偏好）：
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. 读取链标志和用户偏好：
   ```bash
   AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**如果存在 `--auto` 标志或 `AUTO_CHAIN` 为 true 或 `AUTO_CFG` 为 true：**

显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO EXECUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plans ready. Launching execute-phase...
```

使用 Skill 工具启动 execute-phase，以避免嵌套 Task 会话（由于深度代理嵌套导致运行时冻结）：
```
Skill(skill="gsd:execute-phase", args="${PHASE} --auto --no-transition")
```

`--no-transition` 标志告诉 execute-phase 在验证后返回状态，而不是继续链接。这保持自动推进链扁平 — 每个阶段在同一嵌套级别运行，而不是生成更深的 Task 代理。

**处理 execute-phase 返回：**
- **PHASE COMPLETE** → 显示最终摘要：
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${PHASE} COMPLETE ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished.

  Next: /gsd:discuss-phase ${NEXT_PHASE} --auto
  ```
- **GAPS FOUND / VERIFICATION FAILED** → 显示结果，停止链：
  ```
  Auto-advance stopped: Execution needs review.

  Review the output above and continue manually:
  /gsd:execute-phase ${PHASE}
  ```

**如果 `--auto` 和配置都未启用：**
路由到 `<offer_next>`（现有行为）。

---

## 下一步提供（offer_next）

直接输出此 markdown（不是代码块）：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {X} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} 个计划在 {M} 个波次中

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase {X}** — 运行所有 {N} 个计划

/gsd:execute-phase {X}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase-dir}/*-PLAN.md — review plans
- /gsd:plan-phase {X} --research — re-research first

───────────────────────────────────────────────────────────────
```

---

## 成功标准（success_criteria）

- [ ] .planning/ 目录已验证
- [ ] 针对路线图验证了阶段
- [ ] 根据需要创建了阶段目录
- [ ] CONTEXT.md 早期加载（步骤 4）并传递给所有代理
- [ ] 研究已完成（除非 --skip-research 或 --gaps 或已存在）
- [ ] 使用 CONTEXT.md 生成了 gsd-phase-researcher
- [ ] 检查了现有计划
- [ ] 使用 CONTEXT.md + RESEARCH.md 生成了 gsd-planner
- [ ] 创建了计划（PLANNING COMPLETE 或处理了 CHECKPOINT）
- [ ] 使用 CONTEXT.md 生成了 gsd-plan-checker
- [ ] 验证通过或用户覆盖或达到最大迭代次数并做出用户决定
- [ ] 用户在代理生成之间看到状态
- [ ] 用户知道下一步
