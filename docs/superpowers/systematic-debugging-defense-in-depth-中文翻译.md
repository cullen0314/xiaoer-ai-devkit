# 纵深防御式校验

## 概述

当你修复了一个由非法数据引起的 bug 时，只在一个位置加校验，看起来似乎已经足够。但单点校验很容易被其他代码路径、重构或 mock 绕过。

**核心原则：** 在数据流经的**每一层**都做校验，让这个 bug 从结构上变得不可能发生。

## 为什么需要多层

单一校验："我们修好了这个 bug"
多层校验："我们让这个 bug 不再可能出现"

不同层会拦住不同类型的问题：
- 入口校验能拦住大多数明显错误
- 业务逻辑校验能拦住边界情况
- 环境守卫能阻止特定上下文中的危险操作
- 调试日志能在其他层失效时帮助取证

## 四层防线

### 第 1 层：入口校验
**目的：** 在 API 边界拦截明显非法的输入

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory 不能为空');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory 不存在: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory 不是目录: ${workingDirectory}`);
  }
  // ... 继续执行
}
```

### 第 2 层：业务逻辑校验
**目的：** 确保数据对于当前操作来说是有意义的

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('初始化工作区时必须提供 projectDir');
  }
  // ... 继续执行
}
```

### 第 3 层：环境守卫
**目的：** 在特定上下文中阻止危险操作

```typescript
async function gitInit(directory: string) {
  // 在测试环境中，拒绝在临时目录之外执行 git init
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `测试期间拒绝在临时目录之外执行 git init: ${directory}`
      );
    }
  }
  // ... 继续执行
}
```

### 第 4 层：调试埋点
**目的：** 捕获上下文，便于取证分析

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('即将执行 git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
  // ... 继续执行
}
```

## 如何应用这个模式

当你发现一个 bug：

1. **追踪数据流** —— 错误值从哪里来？在哪里被使用？
2. **列出所有检查点** —— 把数据经过的每个节点都列出来
3. **在每层加校验** —— 入口层、业务层、环境层、调试层
4. **分别验证每一层** —— 尝试绕过第 1 层，确认第 2 层还能接住

## 会话中的真实例子

Bug：空的 `projectDir` 导致 `git init` 在源码目录中执行

**数据流：**
1. 测试初始化 → 空字符串
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init` 在 `process.cwd()` 中执行

**增加的四层防线：**
- 第 1 层：`Project.create()` 校验非空 / 存在 / 可写
- 第 2 层：`WorkspaceManager` 校验 projectDir 非空
- 第 3 层：`WorktreeManager` 在测试中拒绝在 tmpdir 外执行 git init
- 第 4 层：在 git init 前打印堆栈日志

**结果：** 1847 个测试全部通过，问题无法再复现

## 关键洞察

四层防线缺一不可。在测试过程中，每一层都抓住了其他层漏掉的问题：
- 不同代码路径绕过了入口校验
- Mock 绕过了业务逻辑检查
- 不同平台上的边界情况需要环境守卫
- 调试日志帮助定位结构性误用

**不要只停留在一个校验点。** 要在每一层都补上检查。
