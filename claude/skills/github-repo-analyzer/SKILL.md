---
name: github-repo-analyzer
description: 分析 GitHub 仓库并生成结构化项目解析文档，保存到 Obsidian 笔记库。当用户说"分析这个仓库"、"解析这个项目"、"帮我看看这个 GitHub 项目"、"总结一下这个仓库"、"/github-repo-analyzer"时触发。
allowed-tools: [Read, Write, Bash, Glob, Grep, WebFetch, Agent, AskUserQuestion]
---

# GitHub 仓库深度解析器

## 核心定位

分析 GitHub 仓库（远程 URL 或本地路径），生成结构化的项目解析文档，保存到 Obsidian 笔记库。

目标不是翻译 README，而是输出**对开发者有决策价值的项目深度解析**。

## 适用范围

- 输入：GitHub 仓库 URL 或本地仓库路径
- 输出：单个结构化 MD 文件
- 默认保存路径：`/Users/wangyijun/Documents/Notes/小二笔记/小二AI/AI优质项目解析/{repo-name}/`
- 不支持批量分析

## 使用方式

### 预览模式（必须先执行）

```bash
bash ~/.claude/skills/github-repo-analyzer/run.sh --preview "<url_or_path>"
```

采集仓库信息并输出 JSON 格式的原始素材，不写任何文件。

### 生成模式

```bash
echo "<md_content>" | bash ~/.claude/skills/github-repo-analyzer/run.sh --generate "<output_dir>" "<repo_name>"
```

将分析文档写入目标目录。

## 工作流程

### 第一步：输入解析

- 判断输入是 GitHub URL 还是本地路径
- URL 格式：`https://github.com/owner/repo` 或 `github.com/owner/repo`
- 如果是 URL，先执行克隆：
  ```bash
  bash ~/.claude/skills/github-repo-analyzer/run.sh --clone "<url>"
  ```
  返回本地临时路径

### 第二步：信息采集

执行预览命令采集原始信息：
```bash
bash ~/.claude/skills/github-repo-analyzer/run.sh --preview "<local_path>"
```

采集内容包括：
- README 全文
- 目录结构（3 层深度）
- 配置文件（package.json / pyproject.toml / pom.xml / Cargo.toml 等）
- 核心源码入口文件（从配置推断或 fallback 常见入口）
- docs/ 目录文档（最多 8 个文件 + 子目录各 3 个）
- 补充文档（CHANGELOG.md、CONTRIBUTING.md、ARCHITECTURE.md、API.md 等）
- examples/ 目录文件列表 + 前 3 个示例文件内容
- GitHub Actions 工作流配置
- GitHub 元信息（stars、forks、license、language、topics 等）

### 第三步：预览与确认

向用户展示：
- 项目名称与一句话定位
- 采集到的信息概要
- 默认保存路径

**必须等用户确认后才能进入生成阶段。**

### 第四步：撰写分析文档

基于采集的原始素材，按照输出规范撰写结构化分析文档。

### 第五步：保存文档

```bash
echo "<md_content>" | bash ~/.claude/skills/github-repo-analyzer/run.sh --generate "<output_dir>" "<repo_name>"
```

## 输出文档结构（固定）

```markdown
# {项目名}

> 一句话定位

## 基本信息

| 属性 | 值 |
|---|---|
| 仓库地址 | ... |
| Stars | ... |
| 语言 | ... |
| License | ... |
| 最近更新 | ... |
| Topics | ... |

## 项目概述

项目背景、解决什么问题、目标用户是谁。

## 核心功能

项目提供的主要能力，按重要性排列。每个功能要具体说明做什么、怎么用。

## 技术架构

技术栈、项目结构、核心模块职责。不需要源码级分析，但要说清楚整体架构。

## 核心知识点

从源码入口、配置文件和文档中提炼的技术要点。包括：
- 关键设计模式和技术选型
- 核心 API / 接口设计
- 重要的配置项和参数说明
- 值得学习的实现思路

## 快速上手

安装、配置、最小可运行示例。基于 README 和 docs 中的信息整理，尽量给出可直接复制执行的命令。

## 进阶用法

从 examples/ 和 docs/ 中提炼的高级操作和典型使用模式，包括：
- 常见使用场景的代码示例
- 高级配置和自定义方式
- 与其他工具/框架的集成方式

## 适用场景

什么情况下适合用这个项目，解决什么具体问题。给出 2-3 个典型场景。

## 价值评估

对开发效率、业务、团队的实际价值。优势和局限性。

## 个人笔记

（留空，供手动补充）
```

## 写作规则

- 中文表达，保留必要英文专有名词
- 基于采集到的事实撰写，不臆测未提及的实现细节
- 分析要有深度但不过度，重点是"对使用者有决策价值"
- 适用场景和价值评估要具体，不写空泛的套话
- 技术架构部分基于目录结构和配置文件推断，标注推断依据
- 核心知识点必须基于源码入口和文档中的实际内容提炼，不编造 API
- 快速上手要给出可直接复制执行的命令，不写伪代码
- 进阶用法优先引用 examples/ 中的真实示例代码，补充必要的中文说明
- 如果某个 section 因采集数据不足无法写出有价值内容，标注"（信息不足，待补充）"而非硬写

## 自检清单

交付前确认：
- 是否先执行了预览并获得用户确认
- 是否确认了保存路径
- 基本信息表格是否完整
- 核心功能是否具体而非泛泛
- 核心知识点是否基于源码和文档的真实内容
- 快速上手是否包含可直接执行的命令
- 进阶用法是否引用了真实示例代码
- 适用场景是否给出了具体例子
- 价值评估是否包含优势和局限
- 是否留了个人笔记区域
