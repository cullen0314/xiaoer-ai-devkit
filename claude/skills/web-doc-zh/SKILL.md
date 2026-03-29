---
name: web-doc-zh
description: 抓取公开英文网页技术文档，抽取正文并生成适合中文工程师阅读的中文或双语 Markdown。适用于用户说“把这个英文官方文档翻成中文”“抓取这个 docs 页面并翻译”“把这个技术文档转成中文 Markdown”时使用。
allowed-tools: [Read, Write, Bash]
---

# 网页技术文档中文翻译器

## 核心定位

本技能用于把**公开可访问的英文网页技术文档**处理为适合中文工程师阅读的 Markdown 文档。

它分两段完成：

1. 脚本负责：抓取网页、抽取正文、转换为干净 Markdown
2. Claude 负责：按规则翻译成中文，并保存为最终文件

目标不是简单机翻，而是输出**结构清晰、术语准确、保留代码与命令原样**的中文技术文档。

## 适用范围

本技能适用于：
- 用户提供单个英文网页文档 URL
- 页面为公开可访问页面
- 需要翻译成中文 Markdown 方便阅读
- 希望保留标题层级、列表、代码块、链接等结构

## 边界说明

本技能第一版默认：
- 仅支持单个 URL
- 仅支持公开可访问页面
- 不支持登录态页面
- 不保证支持依赖浏览器渲染的复杂动态页面
- 不做整站递归抓取
- 不调用第三方翻译 API
- 不在代码中使用任何真实密钥

## 使用方式

### 第一步：预览模式（推荐先执行）

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --preview "https://example.com/docs/page"
```

作用：
- 校验 URL
- 抓取网页
- 抽取正文
- 转换为清洗后的 Markdown 摘要
- 输出标题、来源、建议文件名与正文节选
- 不写文件

### 第二步：生成模式

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate "https://example.com/docs/page"
```

作用：
- 获取完整英文 Markdown 源稿
- 由 Claude 按规则翻译为中文
- 保存为 `.zh-CN.md` 文件

### 生成双语版本

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate --bilingual "https://example.com/docs/page"
```

### 指定输出路径

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate --output "docs/react-use-effect.zh-CN.md" "https://example.com/docs/page"
```

### 指定文件名基础名

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate --name react-use-effect "https://example.com/docs/page"
```

## 参数说明

| 参数 | 必填 | 说明 |
|---|---|---|
| `--preview` | 二选一 | 只预览，不写文件 |
| `--generate` | 二选一 | 正式生成输出文件 |
| `--output <path>` | 否 | 指定输出文件路径 |
| `--name <slug>` | 否 | 指定输出基础文件名 |
| `--bilingual` | 否 | 生成双语版本 |
| `--force` | 否 | 允许覆盖已存在文件 |
| `--source-only` | 否 | 只输出清洗后的英文 Markdown，不做翻译 |
| `url` | 是 | 英文网页文档链接 |

## 工作流程

### 第一步：识别与抽取

先调用：

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --preview "URL"
```

预览输出至少应包含：
- 页面标题
- 原始 URL 与最终 URL
- 建议输出文件名
- 正文长度
- 正文节选
- 已知边界与异常提示

**未经用户确认，不得进入生成。**

### 第二步：生成英文源稿

用户确认后，调用：

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate "URL"
```

脚本会输出结构化结果，其中包含：
- 标题
- 来源 URL
- 建议输出文件名
- 完整英文 Markdown 正文

### 第三步：翻译与保存

Claude 负责把英文 Markdown 翻译成中文，并保存为目标文件。

生成模式输出中会带 5 个字段，必须直接使用：
- `OUTPUT_PATH=...`
- `OUTPUT_MODE=zh|bilingual`
- `TITLE=...`
- `SOURCE_URL=...`
- `SLUG=...`

执行要求：
1. 从生成结果中读取 `OUTPUT_PATH`
2. 按本文件的翻译规则组织中文或双语 Markdown
3. 使用 `Write` 工具写入 `OUTPUT_PATH`
4. 写入完成后告知用户输出文件路径

默认输出命名：
- 中文版：`<slug>.zh-CN.md`
- 双语版：`<slug>.bilingual.zh-CN.md`

若用户提供 `--output`，以该路径为准。

## 翻译规则

翻译时必须遵守：
- 保留 Markdown 标题层级、列表、表格、代码块、引用结构
- 代码、命令、路径、URL、API 名称、类名、函数名保持原样
- 必要术语保留英文，首次出现可中英并列
- 中文表达准确、自然、简洁，适合工程师阅读
- 不删减有效信息
- 不补充原文未明确说明的事实

## 输出规范

### 中文版

建议包含：
- 中文标题
- 原文标题（可放在副标题或说明中）
- 来源链接
- 正文中文翻译

推荐头部模板：

```markdown
# <中文标题>

> 原文：<英文标题>
>
> 来源：<SOURCE_URL>
```

### 双语版

建议包含：
- 中文标题
- 原文标题
- 来源链接
- 逐段中文 + 对应英文原文

推荐头部模板：

```markdown
# <中文标题>

> Original: <英文标题>
>
> Source: <SOURCE_URL>
```

## 自检清单

交付前确认：
- 是否先执行了 `--preview`
- 是否已获得用户明确确认
- 是否只处理公开网页
- 是否未引入外部翻译 API 或密钥
- 是否保留代码块、命令、路径、链接原样
- 是否遵守目标文件覆盖规则
