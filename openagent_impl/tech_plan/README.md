# OpenAgent Tech-Plan

这是一个独立于现有 `agent-xe-tech-plan.md` 和 `feature-flow` 的 openagent 风格 tech-plan 实现。

## 目标

- 不替换现有正式链路
- 不接管 `feature-flow`
- 独立输出兼容工件：
  - `docs/{需求名称}/技术设计.md`
  - `docs/{需求名称}/开发任务.md`
  - `docs/{需求名称}/state.json`

## 运行

```bash
cd openagent_impl/tech_plan
python runner.py --prd-url "https://example.feishu.cn/docx/xxx" --requirement-name "用户登录" --description "实现用户登录功能"
```

如果当前处于澄清或审批阶段，可继续传入：

```bash
python runner.py --requirement-name "用户登录" --user-response "本期仅支持账号密码登录" --resume
```

## 输出状态

统一输出以下四种状态之一：

- `completed`
- `need_clarification`
- `waiting_for_approval`
- `execution_failed`

## 隔离原则

本实现不会修改以下现有文件：

- `claude/commands/xe/feature-flow.md`
- `claude/commands/xe/feature-flow-resume.md`
- `claude/agents/agent-xe-tech-plan.md`
