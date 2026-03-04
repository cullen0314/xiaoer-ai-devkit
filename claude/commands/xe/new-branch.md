---
description: "拉取最新的master分支，并根据用户需求描述创建符合规范的新分支"
allowed-tools: ["Bash"]
argument-hint: "分支描述"
model: haiku
---

# 创建分支命令

这个命令会自动拉取最新的 master 分支，并根据用户提供的需求描述智能判断分支类型并创建符合规范的新分支。

## Context

- 当前分支: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(空仓库)"`
- Git 用户名: !`git config user.name 2>/dev/null || echo "(未配置)"`
- 工作区状态: !`git status --porcelain 2>/dev/null | head -5 || echo "(无未提交更改)"`

## 分支命名规范

分支名称格式：`类型/author/desc`

### 类型判断规则（根据描述关键词）
- 包含"功能"、"新增"、"添加"等词汇 → `feature`
- 包含"修复"、"解决"、"bug"、"问题"等词汇 → `fix`
- 包含"重构"、"优化"、"改进"等词汇 → `refactor`
- 包含"文档"、"说明"、"readme"等词汇 → `docs`
- 包含"格式"、"样式"、"美化"等词汇 → `style`
- 包含"测试"、"test"、"验证"等词汇 → `test`
- 包含"构建"、"工具"、"配置"等词汇 → `chore`
- 默认情况 → `feature`

### Author 处理规则
- 获取 git config user.name
- 转换为小写
- 中文转换为拼音（过长则使用每个字首字母）

### 描述处理规则
- 使用用户提供的简短描述（3-10个单词）
- 转换为小写并用连字符分隔

## 用户输入

用户提供的分支描述：$ARGUMENTS

## 实现步骤

### 步骤1：检查工作区状态

检查当前是否有未提交的更改。如果有，提醒用户并询问是否继续：

```bash
git status --porcelain
```

如果有未提交的更改，输出警告并等待用户确认。

### 步骤2：切换到 master 分支

```bash
git checkout master
```

### 步骤3：拉取最新代码

```bash
git pull origin master
```

### 步骤4：获取并处理用户名

```bash
git config user.name
```

对用户名进行规范化处理：
- 转换为小写
- 如果是中文，转换为拼音或使用简化形式

### 步骤5：分析分支类型

根据用户输入的描述，判断分支类型：
- 功能相关 → `feature`
- 修复相关 → `fix`
- 重构相关 → `refactor`
- 文档相关 → `docs`
- 其他 → `feature`（默认）

### 步骤6：生成分支名称

按照格式 `类型/author/desc` 生成分支名称，例如：
- `feature/zhangsan/user-login`
- `fix/lisi/payment-error`
- `refactor/wangwu/db-connection`

### 步骤7：创建并切换到新分支

```bash
git checkout -b {分支名称}
```

### 步骤8：输出结果

输出新分支名称和创建成功信息，格式如下：

```
✅ 分支创建成功！

分支名称: {分支名称}
类型: {类型}
作者: {作者}
描述: {描述}

当前分支: !`git rev-parse --abbrev-ref HEAD`
```

## 使用示例

```bash
/xe:new-branch 实现用户登录功能
/xe:new-branch 修复订单支付失败问题
/xe:new-branch 重构数据库连接代码
```

## 注意事项

- 确保已经正确配置了 git 远程仓库
- 确保网络连接正常，能访问远程仓库
- 如果有未提交的更改，建议先保存或提交后再执行此命令
- 如果 master 分支不存在，尝试使用 main 分支
