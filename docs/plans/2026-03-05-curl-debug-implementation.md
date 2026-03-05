# curl-debug 命令实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 xiaoer-ai-devkit 新增 `xe:curl-debug` 命令，实现根据 curl 命令深度诊断接口问题的功能。

**Architecture:** Command（入口）调用 Agent（诊断逻辑），Agent 使用 mysql-executor Skill 查询数据库。

**Tech Stack:** Markdown (Command/Agent 定义), Bash (curl 解析), Claude Code Agent 框架

---

## Task 1: 创建 curl-debug Command 文件

**Files:**
- Create: `claude/commands/xe/curl-debug.md`

**Step 1: 创建 Command 文件**

```markdown
---
description: "根据 curl 命令深度诊断接口问题"
allowed-tools: ["Bash", "Agent"]
argument-hint: "curl 命令"
model: opus
---

# curl-debug 命令

根据用户输入的 curl 命令深度诊断接口问题。

## 用户输入

用户输入的 curl 命令：$ARGUMENTS

## Context

- 当前目录: !`pwd`
- 当前项目: !`basename $(git rev-parse --show-toplevel 2>/dev/null)`

## 实现步骤

### 步骤1：解析 curl 命令

从用户输入的 curl 命令中提取：
- URL: 第一个参数（单引号或双引号包裹）
- Method: 默认 POST，或 `-X` 指定
- Headers: `-H` 参数
- Body: `--data-raw` 或 `-d` 参数
- Cookies: `-b` 参数

### 步骤2：调用接口获取响应

使用 curl 命令调用接口，获取响应：
- 状态码
- 响应体
- 响应时间

### 步骤3：分析响应状态

根据响应状态判断：
- 成功（2xx）: 输出简要信息
- 失败（4xx/5xx/超时）: 让用户选择诊断方向

### 步骤4：调用 Agent 执行深度诊断

使用 Agent 工具调用 `xe:curl-debug-agent`，传入：
- 解析后的请求信息
- 接口响应
- 用户选择的诊断方向

### 步骤5：输出诊断报告

输出简洁文本格式的诊断报告。

## 使用示例

```
/xe:curl-debug curl 'https://dev2admin.summerfarm.net/summerfarm-wms/shelving/query/mission_item_pda' \
  -H 'content-type: application/json' \
  -H 'token: xxx' \
  --data-raw '{"receivingContainer":"TY99970","warehouseNo":2,"missionType":10}'
```
```

**Step 2: 运行 setup.sh 更新配置**

```bash
cd /Users/wangyijun/Documents/common-project/xiaoer-ai-devkit
./setup.sh
```

Expected: 配置文件更新，新命令可用

**Step 3: 验证命令文件创建**

```bash
cat claude/commands/xe/curl-debug.md | head -20
```

Expected: 显示文件内容前 20 行

**Step 4: 提交**

```bash
git add claude/commands/xe/curl-debug.md
git commit -m "feat: add curl-debug command"
```

---

## Task 2: 创建 curl-debug-agent Agent 文件

**Files:**
- Create: `claude/agents/curl-debug-agent.md`

**Step 1: 创建 Agent 文件**

```markdown
---
name: xe:curl-debug-agent
description: 深度诊断接口问题的 Agent
allowed-tools: [Read, Grep, Glob, Bash, Skill]
model: opus
permissionMode: acceptEdits
---

# curl-debug 诊断 Agent

负责执行深度诊断逻辑，分析接口问题并给出解决方案。

## 输入格式

调用方会传入以下信息：

```json
{
  "url": "https://dev2admin.summerfarm.net/summerfarm-wms/shelving/query/mission_item_pda",
  "method": "POST",
  "headers": {"token": "xxx", "content-type": "application/json"},
  "body": {"receivingContainer": "TY99970", "warehouseNo": 2, "missionType": 10},
  "response": {"code": "4003008", "msg": "容器不存在或已被占用"},
  "diagnosisDirection": "参数问题"
}
```

## 诊断方向

### 1. 参数问题

检查项：
- 请求格式是否正确
- 必填项是否缺失
- 数据类型是否匹配
- 枚举值是否有效

### 2. 数据问题

检查项：
- 使用 @mysql-executor 查询相关表
- 检查数据一致性
- 检查外键约束

### 3. 权限问题

检查项：
- Token 有效性
- 用户角色
- 资源访问权限

### 4. 系统问题

检查项：
- 服务状态
- 依赖服务
- 超时/限流

## 输出格式

简洁文本模式：

```
=== 接口诊断报告 ===

【请求信息】
URL: POST /summerfarm-wms/shelving/query/mission_item_pda
参数: receivingContainer=TY99970, missionType=10

【调用结果】
状态: 失败 (400)
响应: {"code": "4003008", "msg": "容器不存在或已被占用"}

【诊断方向】参数问题

【问题分析】
1. 容器 TY99970 在数据库中不存在
2. Controller: ShelvingMissionController.queryMissionItem()
3. 校验逻辑: validateContainer() 方法检查容器状态

【解决方案】
1. 确认容器编码是否正确
2. 检查容器是否已在其他任务中使用
3. 使用可用容器: TY99971, TY99972

【相关代码】
Controller: inbound/src/.../ShelvingMissionController.java:120
```
```

**Step 2: 验证 Agent 文件创建**

```bash
cat claude/agents/curl-debug-agent.md | head -30
```

Expected: 显示文件内容前 30 行

**Step 3: 提交**

```bash
git add claude/agents/curl-debug-agent.md
git commit -m "feat: add curl-debug-agent"
```

---

## Task 3: 更新 setup.sh 确保 Agent 被正确注册

**Files:**
- Modify: `setup.sh`

**Step 1: 检查 setup.sh 是否已处理 agents 目录**

```bash
grep -n "agents" setup.sh
```

Expected: 应该有处理 agents 目录的逻辑

**Step 2: 如果没有，添加 agents 处理逻辑**

找到 setup.sh 中处理 skills 的部分，添加类似的 agents 处理：

```bash
# 复制 agents
if [ -d "claude/agents" ]; then
    mkdir -p "$CLAUDE_DIR/skills"
    for agent in claude/agents/*.md; do
        if [ -f "$agent" ]; then
            agent_name=$(basename "$agent" .md)
            echo "Installing agent: $agent_name"
            ln -sf "$PROJECT_ROOT/$agent" "$CLAUDE_DIR/skills/$agent_name.md"
        fi
    done
fi
```

**Step 3: 运行 setup.sh 验证**

```bash
./setup.sh
```

Expected: 无错误输出

**Step 4: 提交**

```bash
git add setup.sh
git commit -m "chore: update setup.sh to support agents"
```

---

## Task 4: 测试命令功能

**Files:**
- Test: 手动测试

**Step 1: 测试 Command 基本功能**

在 Claude Code 中执行：

```
/xe:curl-debug curl 'https://httpbin.org/post' -H 'content-type: application/json' --data-raw '{"test":"value"}'
```

Expected: Command 被正确调用，curl 被解析

**Step 2: 测试 Agent 调用**

如果 Command 测试成功，测试 Agent 调用逻辑。

**Step 3: 记录测试结果**

如果测试失败，记录问题并修复。

---

## Task 5: 更新文档

**Files:**
- Modify: `README.md`

**Step 1: 更新 README.md 添加新命令说明**

在 README.md 的 Commands 部分添加：

```markdown
- `curl-debug` - 根据 curl 命令深度诊断接口问题
```

**Step 2: 提交**

```bash
git add README.md
git commit -m "docs: add curl-debug command to README"
```

---

## 注意事项

1. **Command 中的 Context 块**：使用 `!` 前缀的命令会被动态执行
2. **Agent 权限**：`permissionMode: acceptEdits` 允许 Agent 修改文件
3. **Skill 调用**：使用 `Skill` 工具调用 mysql-executor，格式：`Skill(skill: "mysql-executor", args: "SELECT ...")`
4. **错误处理**：所有步骤都要考虑错误情况并给出友好提示
