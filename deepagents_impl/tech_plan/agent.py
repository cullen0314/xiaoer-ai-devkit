from __future__ import annotations

import json
from pathlib import Path

from deepagents import create_deep_agent
from langchain.chat_models import init_chat_model

from prompts_loader import load_system_prompt
from schemas.input_schema import TechPlanInput
from schemas.output_schema import TechPlanOutput
from services.verification_service import build_verification
from tools.artifact_writer import ArtifactWriter
from tools.decision_logger import log_default_decision
from tools.prd_reader import PrdReader
from tools.repo_explorer import build_repo_context
from tools.state_bridge import StateBridge
from tools.template_loader import TemplateLoader


class TechPlanAgentApp:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.template_loader = TemplateLoader(project_root)
        self.prd_reader = PrdReader(project_root)
        self.state_bridge = StateBridge(project_root)
        self.artifact_writer = ArtifactWriter(project_root)
        self.system_prompt = load_system_prompt(project_root)
        self.agent = create_deep_agent(
            model=init_chat_model("anthropic:claude-sonnet-4-6", temperature=0.0),
            system_prompt=self.system_prompt,
            tools=[],
            name="xiaoer-tech-plan-mvp",
        )

    def run(self, raw_input: dict) -> TechPlanOutput:
        payload = TechPlanInput.model_validate(raw_input)

        if self.state_bridge.exists(payload.requirement_name):
            self.state_bridge.get_state(payload.requirement_name)
        else:
            self.state_bridge.init_state(payload.requirement_name, payload.prd_url, payload.description)

        self.state_bridge.update_meta(
            payload.requirement_name,
            {"current_substage": "reading_prd", "next_action": "analyze_prd"},
        )

        prd_markdown = self.prd_reader.read(payload.prd_url)
        repo_context = build_repo_context(self.project_root)
        tech_template = self.template_loader.load_tech_plan_template()
        dev_template = self.template_loader.load_dev_task_template()

        prompt = self._build_prompt(
            payload=payload,
            prd_markdown=prd_markdown,
            repo_context=repo_context,
            tech_template=tech_template,
            dev_template=dev_template,
        )

        result = self.agent.invoke({"messages": [{"role": "user", "content": prompt}]})
        result_text = self._extract_text(result)
        parsed = json.loads(result_text)

        artifacts = self.artifact_writer.write_documents(
            payload.requirement_name,
            parsed["tech_plan_markdown"],
            parsed["dev_task_markdown"],
        )

        self.state_bridge.update_stage(
            payload.requirement_name,
            "tech-plan",
            "completed",
            artifacts.tech_plan_doc,
            {
                "substage": "completed",
                "next_action": "java-coding",
                "artifacts": artifacts.model_dump(),
            },
        )
        log_default_decision(
            self.state_bridge,
            payload.requirement_name,
            "DeepAgents MVP 已生成技术设计与开发任务文档",
        )

        verification = build_verification(prd_read=True, docs_generated=True, state_saved=True)
        return TechPlanOutput(
            status="completed",
            summary="已生成技术方案文档、开发任务文档并写入状态文件",
            artifacts=artifacts,
            verification=verification,
            next_action="java-coding",
        )

    def _build_prompt(
        self,
        *,
        payload: TechPlanInput,
        prd_markdown: str,
        repo_context: str,
        tech_template: str,
        dev_template: str,
    ) -> str:
        return f"""
请基于以下信息生成两个 Markdown 文档，并返回 JSON：

要求：
1. 返回 JSON，不要附加额外说明。
2. JSON 结构必须是：
{{
  \"tech_plan_markdown\": \"...\",
  \"dev_task_markdown\": \"...\"
}}
3. `tech_plan_markdown` 必须按技术设计模板章节顺序生成。
4. `dev_task_markdown` 必须按开发任务模板章节顺序生成。
5. 如信息不足，使用“待确认”明确标注，不要编造。
6. 文档语言为中文。

需求名称：{payload.requirement_name}
需求描述：{payload.description}
PRD URL：{payload.prd_url}

# PRD Markdown
{prd_markdown}

# 仓库上下文
{repo_context}

# 技术设计模板
{tech_template}

# 开发任务模板
{dev_template}
""".strip()

    def _extract_text(self, result: object) -> str:
        if isinstance(result, dict):
            messages = result.get("messages") or []
            if messages:
                last = messages[-1]
                content = last.content if hasattr(last, "content") else last.get("content")
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    parts = []
                    for item in content:
                        if isinstance(item, dict) and item.get("type") == "text":
                            parts.append(item.get("text", ""))
                    return "\n".join(parts)
        return str(result)
