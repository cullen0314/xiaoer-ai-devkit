---
name: repo-readme-zh-guide
description: 基于本地 GitHub 项目的 README 与目录结构，生成适合中国程序员阅读的中文 README 和轻量项目导读。适用于用户说“把这个 GitHub 项目翻成中文”“给这个仓库生成中文 README”“帮我做项目导读”“把本地 README 变成中文项目说明”时使用。
allowed-tools: [Read, Write, Bash]
---

# GitHub 项目中文 README 与导读生成器

## 核心定位

本技能用于把**本地仓库中的 README 与目录结构**整理为：

- `README.zh-CN.md`
- `PROJECT_GUIDE.zh-CN.md`

目标不是逐句机翻，而是输出**适合中国程序员阅读的中文 README**与**轻量项目导读**。

## 适用范围

本技能适用于：
- 用户提供本地仓库目录路径
- 仓库内存在 README，且希望生成中文版本
- 希望快速看懂项目定位、核心模块和建议阅读顺序

## 边界说明

本技能默认：
- 只读取 README 与仓库目录结构
- 不主动深读 `docs/`
- 不做源码级深度分析
- 不生成术语表
- 不补充 README 未明确提供的事实

如果 README 缺失：
- 允许做预览
- 默认不直接生成正式文件

## 使用方式

### 预览模式（推荐先执行）

```bash
bash ~/.claude/skills/repo-readme-zh-guide/run.sh --preview "/path/to/repo"
```

作用：
- 校验仓库路径
- 自动发现 README
- 提取轻量目录结构
- 输出本次将生成什么内容
- 不写任何文件

### 生成模式

```bash
bash ~/.claude/skills/repo-readme-zh-guide/run.sh --generate "/path/to/repo"
```

作用：
- 正式生成：
  - `README.zh-CN.md`
  - `PROJECT_GUIDE.zh-CN.md`
- 默认写到仓库同目录

### 覆盖已存在文件

```bash
bash ~/.claude/skills/repo-readme-zh-guide/run.sh --generate --force "/path/to/repo"
```

仅当目标文件已存在且用户明确同意覆盖时使用。

## 参数说明

| 参数 | 必填 | 说明 |
|---|---|---|
| `--preview` | 二选一 | 只预览，不写文件 |
| `--generate` | 二选一 | 正式生成输出文件 |
| `--force` | 否 | 允许覆盖已存在文件 |
| `repo_path` | 是 | 本地仓库目录路径 |

## 工作流程

### 第一步：识别输入范围

- 校验仓库目录是否存在
- 查找 README：
  - `README.md`
  - `readme.md`
  - `README`
- 提取轻量目录结构（忽略常见噪音目录）

### 第二步：预览（必须先做）

预览输出至少包含：
- 输入识别结果
- README 是否存在
- 目录结构摘要
- 项目理解摘要
- 将生成的两个文件及其侧重点
- 已知边界说明

**未经用户确认，不得进入生成。**

### 第三步：生成

仅在用户确认后执行。

固定输出：
- `README.zh-CN.md`
- `PROJECT_GUIDE.zh-CN.md`

默认写到 README 所在仓库目录。

## 输出规范

### 文件一：README.zh-CN.md

建议内容包括：
- 项目名
- 一句话中文介绍
- 项目简介
- 核心能力
- 适用场景
- 快速开始（仅在原 README 信息足够时）
- 项目结构概览
- 阅读建议
- 补充说明

### 文件二：PROJECT_GUIDE.zh-CN.md

建议内容包括：
- 这个项目是做什么的
- 仓库可以怎么理解
- 重点目录导读
- 推荐阅读路径
- 边界说明

## 写作规则

- 保持中文表达自然、专业、易懂
- 保留必要英文专有名词
- 以信息保真优先，不臆测实现细节
- 不把轻量导读写成架构设计文档
- 输出要能直接保存和复用

## 自检清单

交付前确认：
- 是否先执行了预览
- 是否已获得用户明确确认
- 是否只基于 README 与目录结构生成
- 是否未主动深读 `docs/`
- 是否产出双文件
- 是否明确边界来源
- 是否在目标文件已存在时避免误覆盖
