---
name: feishu-doc-write
description: 将本地 Markdown 文件导入为飞书在线文档
allowed-tools: [Read, Write, Bash]
---

# 飞书文档写入工具

## 功能描述

此 Skill 的核心能力是**将本地 Markdown 文件导入为飞书在线文档**：

- 读取本地 Markdown 文件内容
- 自动上传并转换为飞书文档格式
- 返回可直接访问的飞书文档 URL

## 使用方式

### ⭐ 推荐工作流程（优先使用 --file 参数）

1. **先将 Markdown 内容写入本地临时文件**（如 `/tmp/xxx.md`）
2. **再使用 --file 参数调用此 Skill 导入到飞书**

这种方式的优势：

- 避免命令行参数过长导致的问题
- 本地文件作为备份，导入失败时可重试
- 更适合长文档

### 命令格式

**推荐方式（使用 --file）**：

```bash
bash ~/.claude/skills/feishu-doc-write/run.sh --title "文档标题" --file "/tmp/your_document.md"
```

备选方式（适合短内容）：

```bash
bash ~/.claude/skills/feishu-doc-write/run.sh --title "文档标题" --markdown "Markdown格式的文档内容"
```

### 参数说明

| 参数         | 必填   | 说明                                  |
| ------------ | ------ | ------------------------------------- |
| `--title`    | 是     | 文档标题                              |
| `--file`     | 二选一 | 本地 Markdown 文件路径（推荐）        |
| `--markdown` | 二选一 | Markdown 格式的文档内容（适合短内容） |

## 输出结果

### 成功时

```json
{
  "success": true,
  "documentId": "文档ID",
  "documentUrl": "https://xxx.feishu.cn/docx/xxx",
  "title": "文档标题",
  "localFile": "/tmp/feishu_doc_xxx.md"
}
```

### 失败时

```json
{
  "success": false,
  "error": "错误信息",
  "localFile": "/tmp/feishu_doc_xxx.md"
}
```

## 使用示例

### 示例 1：创建技术文档（推荐方式）

```
用户：帮我写一个用户认证模块的技术方案文档

执行步骤：
1. 撰写完整的技术方案内容
2. 将内容写入 /tmp/auth_design.md
3. 调用：bash ~/.claude/skills/feishu-doc-write/run.sh --title "用户认证模块技术方案" --file "/tmp/auth_design.md"
4. 返回飞书文档链接
```

### 示例 2：转换现有 Markdown 文件

```
用户：把 README.md 转成飞书文档

执行步骤：
1. 调用：bash ~/.claude/skills/feishu-doc-write/run.sh --title "README" --file "./README.md"
2. 返回飞书文档链接
```

## 注意事项

1. **务必通过脚本运行**：请务必通过 run.sh 脚本运行，这是唯一正确的使用方式
2. **本地备份**：所有操作都会在 `/tmp` 目录保留 Markdown 源文件
