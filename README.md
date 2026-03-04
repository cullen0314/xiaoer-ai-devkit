# xiaoer-ai-devkit

> 企业级 AI 编程助手工具集 - Claude Code 扩展

## 简介

本项目是基于 Claude Code 的自定义工具集，提供 Commands、Agents、Skills 三层扩展能力，帮助团队提升开发效率。

## 目录结构

```
xiaoer-ai-devkit/
├── claude/
│   ├── commands/xe/      # 自定义命令 (xe 前缀)
│   ├── agents/           # Subagent 定义
│   ├── skills/           # 技能模块
│   └── plugins/          # 插件系统
├── setup.sh              # 安装脚本
├── README.md
└── CLAUDE.md
```

## 安装

```bash
cd /Users/wangyijun/Documents/common-project/xiaoer-ai-devkit
./setup.sh
```

## 使用

安装完成后，在 Claude Code 中即可使用：

- **Commands**: `/xe:command-name`
- **Agents**: 通过 Task 工具调用
- **Skills**: `Skill(skill-name)` 或 `bash run.sh`

## 可用组件

### Commands
- `new-branch` - 创建符合规范的 git 分支

### Agents
- `xe-task-executor` - 执行明确的代码任务

## 开发指南

### 添加新命令

1. 在 `claude/commands/xe/` 下创建 `{name}.md`
2. 运行 `./setup.sh` 更新配置

### 添加新 Agent

1. 在 `claude/agents/` 下创建 `{name}.md`
2. 运行 `./setup.sh` 更新配置

### 添加新 Skill

1. 在 `claude/skills/` 下创建 `{name}/` 目录
2. 创建 `SKILL.md` 和 `run.sh`
3. 运行 `./setup.sh` 更新配置

## License

MIT
