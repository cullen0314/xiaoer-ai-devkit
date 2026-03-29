# DeepAgents Tech-Plan MVP

这是一个独立于现有 Claude Markdown Agent 的 DeepAgents 版 `tech-plan` MVP。

## 目标

- 不替换现有 `agent-xe-tech-plan.md`
- 不接管 `feature-flow`
- 仅作为项目内新增的一版可独立运行实现
- 继续兼容输出：
  - `docs/{需求名称}/技术设计.md`
  - `docs/{需求名称}/开发任务.md`
  - `docs/{需求名称}/state.json`

## 运行

```bash
cd deepagents_impl/tech_plan
uv run python runner.py --prd-url "https://example.feishu.cn/docx/xxx" --requirement-name "用户登录" --description "实现用户登录功能"
```

## 当前 MVP 能力

- 初始化或读取 `state.json`
- 通过现有飞书读取脚本获取 PRD Markdown
- 读取技术设计模板与开发任务模板
- 调用 DeepAgents 生成技术设计与开发任务文档
- 写入标准产物并输出结构化 JSON

## 非目标

当前版本暂不实现：

- 多轮澄清恢复
- waiting_for_approval 完整闭环
- 接入现有 `feature-flow`
