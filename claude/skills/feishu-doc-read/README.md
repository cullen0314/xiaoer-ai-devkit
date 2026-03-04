# 飞书文档转Markdown Skill (Node.js版)

这是一个 Claude Code Skill，用于将飞书文档（wiki/doc/docx 等多种格式）转换为 Markdown 格式。

**本版本使用 Node.js 实现**，完全依赖 Claude Code 内置的 Node.js 环境，无需用户额外安装 Python。

## 功能特性

- ✅ 支持多种飞书文档格式（wiki、doc、docx）
- ✅ 将文档内容转换为标准 Markdown 格式
- ✅ 保留文档结构（标题、段落、列表、代码块等）
- ✅ 支持 Mermaid 图表和代码块
- ✅ 生成原始 JSON 数据文件和 Markdown 文件
- ✅ **零额外依赖**：完全依赖 Claude Code 内置环境
- ✅ **自动依赖管理**：首次运行自动安装 npm 依赖
- ✅ **跨平台兼容**：完全兼容 Windows、macOS、Linux

## 技术优势

与 Python 版本相比，Node.js 版本具有以下优势：

| 特性 | Python 版 | Node.js 版 (本版本) |
|------|-----------|-------------------|
| **运行时依赖** | 需要用户安装 Python 3 | Claude Code 内置，无需安装 |
| **外部依赖** | requests (需手动安装) | axios (npm 自动管理) |
| **Windows 兼容** | Windows 默认无 Python | 完全兼容 ✅ |
| **依赖安装** | 可能失败（权限、网络） | 自动处理 ✅ |
| **首次运行** | 可能失败（缺依赖） | 自动安装依赖 ✅ |

## 环境要求

- ✅ Claude Code（已内置 Node.js，无需额外安装）
- ✅ 飞书应用凭证（App ID 和 App Secret）

## 环境变量配置

无需配置环境变量，Skill 内置了公共飞书应用凭证。

### 如何获取飞书应用凭证

本工具默认使用内置的公共应用凭证。如果您想使用自己的应用，请修改源码中的配置。

## 使用方法

### 在 Claude Code 中使用

在 Claude Code 中，当用户需要转换飞书文档时，可以直接提供文档 URL：

```
请将这个飞书文档转换为 Markdown：
https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld
```

Claude Code 会自动调用此 Skill 处理。

### 手动运行

你也可以直接在命令行中运行：

```bash
# 方式 1: 通过 run.sh
cd ~/.claude/skills/get_feishu_wiki_as_markdown
./run.sh "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"

# 方式 2: 直接运行 Node.js
cd ~/.claude/skills/get_feishu_wiki_as_markdown
node skill.js "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"
```

### 首次运行

首次运行时，脚本会自动安装 npm 依赖（axios），您会看到：

```
📦 首次运行，正在安装依赖...
✅ 依赖安装完成
```

## 输出文件

Skill 会在当前工作目录生成两个文件：

1. **`{文档标题}_raw.json`** - 包含原始文档数据的 JSON 文件
2. **`{文档标题}_content.md`** - 转换后的 Markdown 文件

## 支持的文档元素

- ✅ 标题（页面标题、一级标题、二级标题、三级标题）
- ✅ 文本段落
- ✅ 有序列表和无序列表
- ✅ 代码块（支持多种编程语言）
- ✅ Mermaid 图表
- ✅ 图片（以占位符形式）
- ✅ 分割线
- ✅ 文档引用

## 支持的飞书文档类型

### 1. 知识库文档 (Wiki)
```
https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld
```

### 2. 旧版文档 (Doc)
```
https://sample.feishu.cn/docs/2olt0Ts4Mds7j7iqzdwrqEUnO7q
```

### 3. 新版文档 (Docx)
```
https://sample.feishu.cn/docx/UXEAd6cRUoj5pexJZr0cdwaFnpd
```

## 工作原理

```
1. 用户提供飞书文档 URL
   ↓
2. 解析 URL 提取 token 和文档类型
   ↓
3. 获取 tenant_access_token（飞书 API 认证）
   ↓
4. 调用飞书 API 获取文档节点信息
   ↓
5. 获取文档所有内容块（blocks）
   ↓
6. 解析内容块并转换为 Markdown 格式
   ↓
7. 保存 JSON 和 Markdown 文件
   ↓
8. 在终端输出转换结果
```

## 依赖说明

本 Skill 仅依赖一个 npm 包：

- **axios** (^1.6.0) - HTTP 客户端，用于调用飞书 API

首次运行时会自动安装，无需手动操作。

## 故障排查

### 1. 提示"未找到 Node.js"

这种情况不应该发生（Claude Code 需要 Node.js）。如果出现：
- 确认 Claude Code 是否正常安装
- 检查 `node` 命令是否在系统 PATH 中

### 2. 依赖安装失败

如果自动安装依赖失败：
```bash
cd ~/.claude/skills/get_feishu_wiki_as_markdown
npm install
```

### 3. 获取文档失败

- 确认飞书应用有足够的权限 (如果是私有文档)
- 确认文档 URL 格式正确

### 4. 网络问题

如果遇到网络超时，可以尝试：
- 检查网络连接
- 配置 npm 代理（如果在企业网络环境）
- 增加超时时间（修改 skill.js 中的 timeout 参数）

## 文件结构

```
get_feishu_wiki_as_markdown/
├── SKILL.md          # Skill 配置和说明文件
├── package.json      # npm 依赖配置
├── skill.js          # 核心实现脚本 (Node.js)
├── run.sh            # 包装脚本（自动安装依赖 + 运行）
└── README.md         # 本文件
```

## 开发与测试

### 测试脚本

```bash
# 运行测试
./run.sh "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"
```

### 查看调试信息

脚本会输出详细的执行过程：
- 📄 正在解析 URL...
- 🔑 正在获取访问令牌...
- 📋 正在获取文档信息...
- 📦 正在获取文档内容...
- ✅ 处理完成！

## 许可证

MIT

## 相关资源

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [Claude Code 文档](https://claude.com/claude-code)
- [飞书 Wiki API](https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-overview)
- [飞书 Docx API](https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/document-docx/docx-overview)

## 更新日志

### v1.0.0 (2024-11-25)
- 🎉 初始版本发布
- ✅ 支持 wiki/doc/docx 三种文档类型
- ✅ 完整的 Markdown 转换功能
- ✅ 自动依赖管理
- ✅ 跨平台兼容
