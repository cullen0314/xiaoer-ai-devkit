# Awesome OpenClaw Skills 技能清单

## 项目简介

**Awesome OpenClaw Skills** 是一个精选的 OpenClaw 技能列表仓库，由 VoltAgent 维护。

### 核心数据

- **收录技能数量**: 5,366 个社区构建的技能
- **官方注册表规模**: 13,729 个技能（已过滤掉约 7,060 个低质量/重复/可疑的技能）
- **分类数量**: 30 个主要类别

### 什么是 OpenClaw？

OpenClaw 是一个**本地运行的 AI 助手**，直接在你的机器上运行。Skills（技能）扩展了它的能力，使其能够与外部服务交互、自动化工作流程和执行专业任务。

---

## 安装方式

### 方式一：通过 ClawHub CLI（推荐）

```bash
clawhub install <skill-slug>
```

### 方式二：手动安装

将技能文件夹复制到以下位置之一：

| 位置 | 路径 |
|------|------|
| 全局 | `~/.openclaw/skills/` |
| 工作区 | `<项目>/skills/` |

**优先级**: 工作区 > 本地 > 内置

### 方式三：直接粘贴链接

将技能的 GitHub 仓库链接直接粘贴到助手对话中，助手会自动处理设置。

---

## 技能分类概览

### 🖥️ 开发相关

#### Coding Agents & IDEs (1,222 个技能)
编程代理和 IDE 集成相关技能，包括：
- 代码审计和安全扫描
- 多代理协作系统
- 代码库导航和理解
- 测试生成和运行
- 框架特定的最佳实践（NestJS、Spring Boot 等）

#### Web & Frontend Development (938 个技能)
Web 和前端开发相关技能，包括：
- React/Next.js 开发
- UI/UX 设计模式
- 前端性能优化
- Web 自动化测试
- CSS/样式生成

#### Git & GitHub (170 个技能)
Git 和 GitHub 集成相关技能，包括：
- 仓库自动化操作
- PR 管理
- 代码审查流程
- CI/CD 集成

#### DevOps & Cloud (409 个技能)
DevOps 和云服务相关技能，包括：
- Docker 容器管理
- Kubernetes 集成
- AWS/Azure/GCP 集成
- 监控和日志
- 基础设施即代码

#### Browser & Automation (335 个技能)
浏览器自动化相关技能，包括：
- Web 抓取
- 表单自动填充
- E2E 测试
- CAPTCHA 解决
- 浏览器脚本自动化

#### iOS & macOS Development (29 个技能)
苹果平台开发相关技能

---

### 🤖 AI 与 LLM

#### AI & LLMs (197 个技能)
AI 和大语言模型相关技能，包括：
- 多模型路由和成本优化
- 提示工程
- Agent 编排和协作
- 模型性能监控
- 文本转语音/语音识别
- 安全防护（提示注入检测）

---

### 📊 数据与分析

#### Data & Analytics (28 个技能)
数据和分析相关技能

#### Search & Research (352 个技能)
搜索和研究相关技能，包括：
- 学术论文搜索
- 网络研究
- arXiv 集成
- 知识管理

---

### 📱 通信与协作

#### Communication (149 个技能)
通信相关技能，包括：
- 邮件集成（Gmail、Apple Mail）
- 聊天应用（Slack、Discord）
- 社交媒体管理

#### Calendar & Scheduling (65 个技能)
日历和调度相关技能，包括：
- 会议安排
- 日程管理
- 提醒设置

#### Notes & PKM (71 个技能)
笔记和个人知识管理相关技能

---

### 🎨 创意与媒体

#### Image & Video Generation (169 个技能)
图像和视频生成相关技能，包括：
- AI 图像生成
- 视频编辑
- 头像/人像生成
- 专辑封面设计
- 算法艺术

#### Media & Streaming (85 个技能)
媒体和流媒体相关技能

#### PDF & Documents (111 个技能)
PDF 和文档处理相关技能

---

### 🏢 生产力工具

#### Productivity & Tasks (206 个技能)
生产力和任务管理相关技能，包括：
- 任务跟踪
- 项目管理
- 工作流自动化
- 时间管理

#### CLI Utilities (186 个技能)
命令行工具相关技能

---

### 🛒 电商与营销

#### Marketing & Sales (105 个技能)
营销和销售相关技能，包括：
- Google Ads 管理
- 内容生成
- SEO 优化
- 社交媒体营销

#### Shopping & E-commerce (105 个技能)
购物和电商相关技能

---

### 🏠 生活与个人

#### Apple Apps & Services (44 个技能)
苹果应用和服务集成，包括：
- Apple Music
- Apple Photos
- Apple Health
- Apple Reminders
- Find My

#### Smart Home & IoT (43 个技能)
智能家居和物联网相关技能

#### Health & Fitness (88 个技能)
健康与健身相关技能

#### Personal Development (51 个技能)
个人发展相关技能

#### Transportation (110 个技能)
交通出行相关技能

#### Gaming (36 个技能)
游戏相关技能

---

### 🔒 安全

#### Security & Passwords (54 个技能)
安全和密码管理相关技能，包括：
- 密码管理器集成
- 安全审计
- 漏洞扫描
- 凭证管理

---

### 🔧 其他工具

#### Clawdbot Tools (37 个技能)
Clawdbot 专用工具

#### Moltbook (29 个技能)
Moltbook 平台相关技能

#### Self-Hosted & Automation (33 个技能)
自托管和自动化相关技能

#### Speech & Transcription (45 个技能)
语音和转录相关技能

---

## 安全说明

本列表中的技能是**精选而非审计**的。它们可能会在添加后被原始维护者随时更新、修改或替换。

在安装或使用任何 Agent Skill 之前，请审查潜在的安全风险并自行验证来源。OpenClaw 与 VirusTotal 合作提供安全扫描，请访问 ClawHub 上的技能页面查看 VirusTotal 报告，确认其是否被标记为有风险。

## 贡献指南

### 添加技能

1. 技能必须已发布到 [OpenClaw 官方技能仓库](https://github.com/openclaw/skills/tree/main/skills)
2. 在 `README.md` 中找到匹配的分类，在末尾添加技能条目
3. 描述必须简洁（10 个词以内）
4. 技能必须有真实的社区使用
5. 不接受加密货币、区块链、DeFi 或金融相关技能

### 条目格式

```markdown
- [skill-name](https://github.com/openclaw/skills/tree/main/skills/author/skill-name/SKILL.md) - 简短描述
```

## 相关链接

- [官方仓库](https://github.com/VoltAgent/awesome-openclaw-skills)
- [OpenClaw 官方技能仓库](https://github.com/openclaw/skills)
- [ClawHub](https://www.clawhub.ai/)
- [Discord 社区](https://s.voltagent.dev/discord)

---

*文档生成时间: 2026-03-19*
