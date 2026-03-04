# 使用示例

本文档提供飞书文档转Markdown Skill的详细使用示例。

## 示例 1：在 Claude Code 中使用

### 用户请求
```
请帮我将这个飞书文档转换为 Markdown：
https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld
```

### Claude Code 响应
Claude Code 会自动识别这是一个飞书文档转换请求，调用此 Skill，并返回转换结果。

### 输出示例
```
✓ 使用 Node.js 版本: v18.17.0
🚀 开始处理飞书文档...

📄 正在解析 URL...
🔑 正在获取访问令牌...
📋 正在获取文档信息...
   文档标题: SaaS接入智付技术方案
📦 正在获取文档内容...

########## SaaS接入智付技术方案_content.md文件的内容: ##########
# SaaS接入智付技术方案

## 背景

本文档描述了...

## 技术架构

...
########## Markdown内容已经展示完毕 ##########

文档已成功转换并保存到以下文件：
1. 原始JSON数据: SaaS接入智付技术方案_raw.json
2. Markdown内容: SaaS接入智付技术方案_content.md

✅ 处理完成！
```

---

## 示例 2：命令行直接使用

### 通过 run.sh 运行

```bash
cd ~/.claude/skills/get_feishu_wiki_as_markdown
./run.sh "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"
```

### 首次运行（自动安装依赖）

```bash
$ ./run.sh "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"

✓ 使用 Node.js 版本: v18.17.0
📦 首次运行，正在安装依赖...

added 5 packages in 2s
✅ 依赖安装完成
🚀 开始处理飞书文档...

📄 正在解析 URL...
🔑 正在获取访问令牌...
📋 正在获取文档信息...
   文档标题: 项目技术文档
📦 正在获取文档内容...
...
✅ 处理完成！
```

### 后续运行（跳过依赖安装）

```bash
$ ./run.sh "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"

✓ 使用 Node.js 版本: v18.17.0
🚀 开始处理飞书文档...
...
```

---

## 示例 3：直接运行 Node.js 脚本

```bash
cd ~/.claude/skills/get_feishu_wiki_as_markdown
node skill.js "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"
```

---

## 示例 4：处理不同类型的飞书文档

### Wiki 文档
```bash
./run.sh "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"
```

### 旧版 Doc 文档
```bash
./run.sh "https://sample.feishu.cn/docs/2olt0Ts4Mds7j7iqzdwrqEUnO7q"
```

### 新版 Docx 文档
```bash
./run.sh "https://sample.feishu.cn/docx/UXEAd6cRUoj5pexJZr0cdwaFnpd"
```

---

## 示例 5：使用自定义环境变量
(已弃用，现已内置公共凭证，无需配置环境变量)

---

## 示例 6：生成的文件内容

### JSON 文件示例（部分）
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "items": [
      {
        "block_id": "doxcn...",
        "block_type": 1,
        "page": {
          "elements": [
            {
              "text_run": {
                "content": "技术方案文档"
              }
            }
          ]
        }
      },
      ...
    ]
  }
}
```

### Markdown 文件示例
```markdown
# 技术方案文档

## 概述

本文档描述了项目的技术架构和实现方案。

## 系统架构

### 前端架构

- React 18
- TypeScript
- Vite

### 后端架构

- Node.js
- Express
- PostgreSQL

## 部署方案

1. 构建前端资源
2. 部署到 CDN
3. 启动后端服务

---

[图片]

## 总结

...
```

---

## 示例 7：错误处理

### 无效的 URL
```bash
$ ./run.sh "https://invalid-url.com"

✓ 使用 Node.js 版本: v18.17.0
🚀 开始处理飞书文档...

📄 正在解析 URL...
❌ 处理过程中发生错误: 无法从URL中提取token，请检查URL格式: https://invalid-url.com

❌ 处理失败，退出码: 1
```

### 网络错误
```bash
$ ./run.sh "https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"

✓ 使用 Node.js 版本: v18.17.0
🚀 开始处理飞书文档...

📄 正在解析 URL...
🔑 正在获取访问令牌...
❌ 处理过程中发生错误: 请求失败: 网络错误

❌ 处理失败，退出码: 1
```

---

## 示例 8：在脚本中集成

### Bash 脚本集成
```bash
#!/bin/bash

# 批量转换多个飞书文档
DOCS=(
    "https://summerfarm.feishu.cn/wiki/doc1"
    "https://summerfarm.feishu.cn/wiki/doc2"
    "https://summerfarm.feishu.cn/wiki/doc3"
)

SKILL_PATH="$HOME/.claude/skills/get_feishu_wiki_as_markdown"

for doc in "${DOCS[@]}"; do
    echo "正在处理: $doc"
    "$SKILL_PATH/run.sh" "$doc"
    echo "---"
done
```

### Node.js 脚本集成
```javascript
const { processFeishuDocument } = require('./skill.js');

// 飞书应用配置 (使用内置默认值)
const APP_ID = 'cli_a9af30aa13395cb5';
const APP_SECRET = 'UUdRNKo0cH7nk2QgxBbwec6jTLSk4Wj5';

async function batchConvert(urls) {
    for (const url of urls) {
        console.log(`处理: ${url}`);
        const result = await processFeishuDocument(url, APP_ID, APP_SECRET);
        if (result.success) {
            console.log('✅ 成功');
        } else {
            console.error('❌ 失败:', result.error);
        }
    }
}

const urls = [
    'https://summerfarm.feishu.cn/wiki/doc1',
    'https://summerfarm.feishu.cn/wiki/doc2',
];

batchConvert(urls);
```

---

## 示例 9：与其他工具配合

### 转换后自动提交到 Git
```bash
#!/bin/bash

SKILL_PATH="$HOME/.claude/skills/get_feishu_wiki_as_markdown"
DOC_URL="https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"

# 转换文档
"$SKILL_PATH/run.sh" "$DOC_URL"

# 提交到 Git
git add *.md
git commit -m "更新文档: $(date '+%Y-%m-%d')"
git push
```

### 转换后自动部署到网站
```bash
#!/bin/bash

SKILL_PATH="$HOME/.claude/skills/get_feishu_wiki_as_markdown"
DOC_URL="https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld"
WEB_DIR="/var/www/docs"

# 转换文档
"$SKILL_PATH/run.sh" "$DOC_URL"

# 复制到网站目录
cp *_content.md "$WEB_DIR/"

# 重新生成静态网站
cd "$WEB_DIR"
hugo build
```

---

## 总结

本 Skill 提供了灵活的使用方式：
1. ✅ 在 Claude Code 中自动调用
2. ✅ 命令行手动运行
3. ✅ 集成到自动化脚本
4. ✅ 批量处理文档
5. ✅ 与其他工具配合使用

选择最适合你工作流程的方式即可！
