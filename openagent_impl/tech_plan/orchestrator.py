from __future__ import annotations

import json
from pathlib import Path

from schemas.artifact_schema import ArtifactPaths
from schemas.clarification_schema import ClarificationState
from schemas.input_schema import TechPlanInput
from schemas.output_schema import TechPlanOutput
from services.verification_service import build_verification
from tools.decision_logger import log_default_decision
from tools.state_protocol_adapter import ensure_protocol_state


class OpenAgentTechPlanOrchestrator:
    def __init__(self, *, project_root: Path, template_loader, prd_reader, state_bridge, artifact_writer, clarification_service, approval_service, output_builder) -> None:
        self.project_root = project_root
        self.template_loader = template_loader
        self.prd_reader = prd_reader
        self.state_bridge = state_bridge
        self.artifact_writer = artifact_writer
        self.clarification_service = clarification_service
        self.approval_service = approval_service
        self.output_builder = output_builder

    def run(self, raw_input: dict) -> TechPlanOutput:
        payload = TechPlanInput.model_validate(raw_input)
        try:
            state = self._ensure_state(payload)
        except Exception as exc:
            return self.output_builder.execution_failed(
                summary=f"状态初始化失败：{exc}",
                verification=build_verification(prd_read=False, docs_generated=False, state_saved=False),
                next_action="repair_state",
            )

        try:
            if payload.resume and state.current_substage == "waiting_for_approval":
                return self._resume_approval(payload, state)
            if payload.resume and state.current_substage == "clarifying_requirement":
                return self._resume_clarification(payload, state)

            prd_markdown = self.prd_reader.read(payload.prd_url)
            self.state_bridge.update_meta(payload.requirement_name, {"current_substage": "reading_prd", "next_action": "clarify_requirement"})
            clarification = self.clarification_service.analyze(
                prd_markdown=prd_markdown,
                description=payload.description,
                previous=ClarificationState.model_validate(state.clarification),
            )
            state_path = self._state_file_for(payload.requirement_name)
            current_state = self.state_bridge.get_state(payload.requirement_name).model_dump()
            self.state_bridge.save_state(
                payload.requirement_name,
                ensure_protocol_state(
                    {
                        **current_state,
                        "current_substage": "designing_solution" if clarification.can_proceed_to_design else "clarifying_requirement",
                        "next_action": "approve_plan" if clarification.can_proceed_to_design else "clarify_requirement",
                        "clarification": clarification.model_dump(),
                        "artifacts": {**(current_state.get("artifacts") or {}), "state_file": state_path},
                    },
                    state_file=state_path,
                ),
            )
            if not clarification.can_proceed_to_design:
                return self.output_builder.need_clarification(
                    summary="需求信息不足，暂不能进入技术方案设计",
                    clarification=clarification,
                    verification=build_verification(prd_read=True, docs_generated=False, state_saved=True, clarification_completed=False),
                )

            tech_template = self.template_loader.load_tech_plan_template()
            dev_template = self.template_loader.load_dev_task_template()
            approval_note = self._build_plan_note(payload.requirement_name, payload.description, clarification, tech_template, dev_template)
            self.state_bridge.update_meta(payload.requirement_name, {"current_substage": "waiting_for_approval", "next_action": "approve_plan"})
            return self.output_builder.waiting_for_approval(
                summary="技术方案草案已生成，等待用户确认",
                clarification=clarification,
                verification=build_verification(prd_read=True, docs_generated=False, state_saved=True, clarification_completed=True),
                approval_note=approval_note,
            )
        except Exception as exc:
            return self.output_builder.execution_failed(
                summary=f"执行失败：{exc}",
                verification=build_verification(prd_read=False, docs_generated=False, state_saved=False),
                next_action="fix_environment",
            )

    def _ensure_state(self, payload: TechPlanInput):
        if self.state_bridge.exists(payload.requirement_name):
            state = self.state_bridge.get_state(payload.requirement_name)
        else:
            if not payload.prd_url:
                raise ValueError("缺少 prdUrl，无法初始化状态")
            state = self.state_bridge.init_state(payload.requirement_name, payload.prd_url, payload.description)
        state_path = self._state_file_for(payload.requirement_name)
        patched = ensure_protocol_state(state.model_dump(), state_file=state_path)
        return self.state_bridge.save_state(payload.requirement_name, patched)

    def _resume_clarification(self, payload: TechPlanInput, state) -> TechPlanOutput:
        clarification = self.clarification_service.analyze(
            prd_markdown="",
            description=payload.description or state.requirement.description,
            user_response=payload.user_response,
            previous=ClarificationState.model_validate(state.clarification),
        )
        updated_state = ensure_protocol_state(
            {
                **state.model_dump(),
                "current_substage": "designing_solution" if clarification.can_proceed_to_design else "clarifying_requirement",
                "next_action": "approve_plan" if clarification.can_proceed_to_design else "clarify_requirement",
                "clarification": clarification.model_dump(),
            },
            state_file=self._state_file_for(payload.requirement_name),
        )
        self.state_bridge.save_state(payload.requirement_name, updated_state)
        if not clarification.can_proceed_to_design:
            return self.output_builder.need_clarification(
                summary="仍有阻塞信息待确认，暂不能进入技术方案设计",
                clarification=clarification,
                verification=build_verification(prd_read=True, docs_generated=False, state_saved=True, clarification_completed=False),
            )
        approval_note = self._build_plan_note(payload.requirement_name, payload.description or state.requirement.description, clarification, "", "")
        self.state_bridge.update_meta(payload.requirement_name, {"current_substage": "waiting_for_approval", "next_action": "approve_plan"})
        return self.output_builder.waiting_for_approval(
            summary="需求澄清已满足设计条件，等待用户确认方案",
            clarification=clarification,
            verification=build_verification(prd_read=True, docs_generated=False, state_saved=True, clarification_completed=True),
            approval_note=approval_note,
        )

    def _resume_approval(self, payload: TechPlanInput, state) -> TechPlanOutput:
        decision = self.approval_service.decide(payload.user_response)
        clarification = ClarificationState.model_validate(state.clarification)
        if not decision.approved:
            return self.output_builder.waiting_for_approval(
                summary="技术方案仍在等待确认",
                clarification=clarification,
                verification=build_verification(prd_read=True, docs_generated=False, state_saved=True, clarification_completed=True),
                approval_note=decision.note,
            )

        tech_plan_markdown = self._build_tech_plan_markdown(payload.requirement_name, state.requirement.description, clarification)
        dev_task_markdown = self._build_dev_task_markdown(payload.requirement_name, state.requirement.description, clarification)
        artifacts = self.artifact_writer.write_documents(payload.requirement_name, tech_plan_markdown, dev_task_markdown)
        stage_state = self.state_bridge.update_stage(
            payload.requirement_name,
            "tech-plan",
            "completed",
            artifacts.tech_plan_doc,
            {
                "substage": "completed",
                "next_action": "java-coding",
                "artifacts": artifacts.model_dump(),
                "clarification": clarification.model_dump(),
            },
        )
        final_state = ensure_protocol_state(stage_state.model_dump(), state_file=artifacts.state_file)
        final_state["clarification"] = clarification.model_dump()
        self.state_bridge.save_state(payload.requirement_name, final_state)
        log_default_decision(self.state_bridge, payload.requirement_name, decision.note)
        return self.output_builder.completed(
            summary="已生成技术方案文档、开发任务文档并写入状态文件",
            artifacts=artifacts,
            verification=build_verification(prd_read=True, docs_generated=True, state_saved=True, clarification_completed=True),
            next_action="java-coding",
        )

    def _state_file_for(self, requirement_name: str) -> str:
        return str((Path("docs") / requirement_name / "state.json").as_posix())

    def _build_plan_note(self, requirement_name: str, description: str, clarification: ClarificationState, tech_template: str, dev_template: str) -> str:
        summary = {
            "requirement": requirement_name,
            "description": description,
            "known_facts": clarification.known_facts,
            "blocking_points": clarification.blocking_points,
            "templates_loaded": bool(tech_template or dev_template),
        }
        return "请确认以下技术方案方向：\n" + json.dumps(summary, ensure_ascii=False, indent=2)

    def _build_tech_plan_markdown(self, requirement_name: str, description: str, clarification: ClarificationState) -> str:
        known = "\n".join(f"- {item}" for item in clarification.known_facts) or "- 待确认"
        return f"# {requirement_name} 技术设计\n\n## 1. 背景\n{description or '待确认'}\n\n## 2. 当前已知\n{known}\n\n## 3. 方案概述\n基于现有信息，建议先按最小可行范围落地，并在实现阶段复核细节。\n\n## 4. 风险与待确认\n- 无\n"

    def _build_dev_task_markdown(self, requirement_name: str, description: str, clarification: ClarificationState) -> str:
        facts = "\n".join(f"- {item}" for item in clarification.known_facts) or "- 待确认"
        return f"# {requirement_name} 开发任务\n\n## 1. 目标\n{description or '待确认'}\n\n## 2. 输入事实\n{facts}\n\n## 3. 任务清单\n- [ ] 根据技术设计完成代码实现\n- [ ] 补充必要测试与验证\n"
