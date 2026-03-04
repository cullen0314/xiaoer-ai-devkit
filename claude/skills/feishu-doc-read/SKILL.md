---
name: feishu-doc-read
description: 获取飞书文档内容并转换为 Markdown 格式
allowed-tools: [Read, Write, Bash]
---

# 飞书文档读取工具

## 功能描述

此 Skill 的核心能力是**从飞书文档链接提取内容并转换为 Markdown 格式**：

- 支持多种飞书文档格式：wiki（知识库）、docs（旧版）、docx（新版）
- 可选择只查看内容或导出保存为本地文件
- 返回标准 Markdown 格式，便于后续处理

## 使用方式

### 命令格式

**只查看内容（不保存文件，推荐）**：

```bash
bash ~/.claude/skills/feishu-doc-read/run.sh --no-save "飞书文档URL"
```

**导出并保存文件**：

```bash
bash ~/.claude/skills/feishu-doc-read/run.sh "飞书文档URL"
```

**包含图片（需要多模态模型）**：

```bash
bash ~/.claude/skills/feishu-doc-read/run.sh --with-images --no-save "飞书文档URL"
```

### 参数说明

| 参数            | 必填 | 说明                                   |
| --------------- | ---- | -------------------------------------- |
| `URL`           | 是   | 飞书文档链接                           |
| `--no-save`     | 否   | 只输出内容，不保存文件（推荐用于查看） |
| `--with-images` | 否   | 包含图片（需要多模态模型支持）         |

### 输出说明

**使用 --no-save 时**：直接在终端输出 Markdown 内容

**不使用 --no-save 时**：生成两个文件

- `{文档标题}_raw.json` - 原始 JSON 数据
- `{文档标题}_content.md` - Markdown 格式文件

## 使用示例

### 示例 1：查看文档内容（推荐方式）

```
用户：帮我读取这个飞书文档的内容 https://xxx.feishu.cn/wiki/xxx

执行步骤：
1. 调用：bash ~/.claude/skills/feishu-doc-read/run.sh --no-save "https://xxx.feishu.cn/wiki/xxx"
2. 直接显示 Markdown 内容
```

### 示例 2：导出文档为本地文件

```
用户：把这个飞书文档导出为 Markdown 文件 https://xxx.feishu.cn/wiki/xxx

执行步骤：
1. 调用：bash ~/.claude/skills/feishu-doc-read/run.sh "https://xxx.feishu.cn/wiki/xxx"
2. 生成 xxx_content.md 文件
```

## 模式选择指南

根据用户意图选择合适的模式：

| 用户意图关键词                         | 使用模式                       |
| -------------------------------------- | ------------------------------ |
| 读取、查看、看看、获取内容、浏览、预览 | `--no-save`                    |
| 导出、保存、下载、转换、生成文件       | 不加参数（保存模式）           |
| 意图不明确时                           | 默认使用 `--no-save`（更轻量） |

## 注意事项

1. **务必通过脚本运行**：请务必通过 run.sh 脚本运行，这是唯一正确的使用方式
