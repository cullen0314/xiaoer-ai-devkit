---
name: task-list
description: 将技术设计方案分解为可执行任务列表 - 每个任务 2-5 分钟可完成，包含文件路径、代码、命令、验证步骤
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# 任务列表生成 Skill

## 概述

将技术设计文档分解为详细的、可执行的任务列表。假设工程师对代码库零上下文，每个任务必须包含实现所需的所有信息。

## 执行时机

本技能在 `tech-plan` skill 完成后被调用，即技术设计文档已生成并获得用户批准后。

也可以通过 `/xe:resume` 命令在新建会话中恢复执行。

## 前置检查

**执行前，必须确认以下文件存在：**

```bash
# 检查技术设计文档是否存在
ls docs/{需求名称}/技术设计.md

# 如果不存在，提示用户：
# "未找到技术设计文档，请先运行 tech-plan skill 或使用 /xe:resume"
```

**如果存在：**
- 读取技术设计文档
- 确认需求名称
- 开始分解任务

## 输入

- 技术设计文档路径（从 `tech-plan` 传递）
- 原始 PRD 内容
- 需求名称

## 执行流程

### 步骤 1：读取状态并验证

```bash
# 读取状态文件，确认 tech-plan 已完成
node claude/utils/state-manager.js get "{需求名称}"

# 检查 tech-plan 阶段是否为 completed
# 如果未完成或不存在，返回错误
```

### 步骤 2：读取技术设计文档

```bash
# 读取 tech-plan 生成的技术设计文档
Read(docs/{需求名称}/技术设计.md)
```

### 步骤 2：理解设计方案

分析技术设计文档，提取：
- 整体架构
- 核心模块
- 数据模型
- 接口定义
- 技术栈

### 步骤 3：分解任务

将设计分解为小任务，遵循以下原则：

**任务粒度：2-5 分钟可完成**

**任务结构：**
```
### 任务 N: [组件名称]

**文件：**
- 创建：`exact/path/to/file.py`
- 修改：`exact/path/to/existing.py:123-145`
- 测试：`tests/path/to/test.py`

**步骤 1：[具体操作]**

**代码：**
```python
# 完整的代码实现
def function_name():
    pass
```

**验证：**
```bash
# 验证命令
pytest tests/path/test.py -v
# 预期：PASS
```

**依赖：**
- 无 / 任务 X

**风险：**
- 低 / 中 / 高
```

### 步骤 4：创建任务列表文档

保存到：`docs/plans/YYYY-MM-DD-{feature-name}.md`

### 步骤 5：标记阶段进行中

```bash
# 标记 task-list 阶段为 in_progress
node claude/utils/state-manager.js update "{需求名称}" "task-list" "in_progress"
```

### 步骤 6：创建 TODO 列表

使用 TaskCreate 工具为每个任务创建 TODO 项。

### 步骤 7：展示计划并确认

分段展示任务列表，每段后询问用户是否正确。

### 步骤 8：保存任务统计

```bash
# 记录任务总数和预估时间
node claude/utils/state-manager.js decision "{需求名称}" "任务总数：{N}，预估时间：{X}小时"
```

### 步骤 9：标记阶段完成

用户确认后，标记阶段完成：

```bash
# 标记 task-list 阶段完成
node claude/utils/state-manager.js update "{需求名称}" "task-list" "completed" "docs/plans/YYYY-MM-DD-{feature-name}.md"
```

**输出完成摘要：**

```markdown
✅ Task-List 阶段完成

需求名称：{需求名称}
任务列表：docs/plans/YYYY-MM-DD-{feature-name}.md
总任务数：{N}
预估时间：{X}小时

[Enter] 开始 TDD 开发 | [r] 重新分解 | [m] 修改任务
```

### 步骤 10：过渡到下一步

分段展示任务列表，每段后询问用户是否正确。

### 步骤 7：过渡到下一步

**宣布：**"任务计划已完成并保存到 `docs/plans/{filename}.md`。两种执行选项："

**选项 A：TDD 开发（推荐）**
- 留在当前会话
- 逐任务 TDD 开发
- 持续代码评审

**选项 B：批量执行**
- 新会话使用 executing-plans
- 批量执行并设置检查点

等待用户选择。

## 任务模板

```markdown
### 任务 N: [组件名称]

**文件：**
- 创建：`src/service/UserService.java`
- 测试：`src/service/UserServiceTest.java`

**步骤 1：编写失败测试（TDD）**

```java
@Test
public void testCreateUser() {
    User user = userService.create("test@example.com", "password");
    assertNotNull(user.getId());
    assertEquals("test@example.com", user.getEmail());
}
```

**步骤 2：实现用户创建逻辑**

```java
@Service
public class UserService {
    public User create(String email, String password) {
        // 实现逻辑
    }
}
```

**步骤 3：验证测试通过**

```bash
./gradlew test --tests UserServiceTest
# 预期：PASS
```

**依赖：** 无

**风险：** 低
```

## 关键原则

1. **具体文件路径** - 必须包含精确的文件路径
2. **完整代码** - 每个任务包含完整的实现代码
3. **验证步骤** - 明确的验证命令和预期输出
4. **小任务粒度** - 每个任务 2-5 分钟可完成
5. **依赖关系** - 明确标注任务间的依赖

## 输出

| 输出物 | 路径 |
|------|------|
| 任务列表文档 | `docs/plans/YYYY-MM-DD-{feature-name}.md` |
| TODO 列表 | 当前会话 |

## 下一步

**调用 `tdd-implementation` skill** 开始 TDD 开发流程。
