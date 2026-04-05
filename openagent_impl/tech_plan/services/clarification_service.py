from __future__ import annotations

from schemas.clarification_schema import ClarificationState, ClarificationSummary


class ClarificationService:
    REQUIRED_HINTS = {
        "goal": ["目标", "目的", "解决", "背景"],
        "scope": ["范围", "支持", "包含", "不包含"],
        "flow": ["流程", "步骤", "时序", "操作"],
        "io": ["接口", "输入", "输出", "返回", "参数"],
        "constraint": ["约束", "权限", "性能", "兼容", "幂等", "审计"],
    }

    QUESTIONS = {
        "goal": ("本期需求要解决的核心目标是什么？", "目标不明确会导致方案边界和验收标准无法确定"),
        "scope": ("本期功能范围具体包含什么、不包含什么？", "范围不明确会直接影响技术方案边界与任务拆解"),
        "flow": ("关键业务流程和异常分支是怎样的？", "流程不明确会影响接口设计、状态流转和异常处理"),
        "io": ("关键输入输出是什么？是否涉及接口、消息或外部系统交互？", "输入输出不明确会影响接口定义和数据结构设计"),
        "constraint": ("是否有性能、权限、兼容性、幂等或审计等特殊约束？", "关键约束不明确会导致方案不可落地或返工"),
    }

    def analyze(self, *, prd_markdown: str, description: str, user_response: str = "", previous: ClarificationState | None = None) -> ClarificationState:
        text = "\n".join(part for part in [prd_markdown, description, user_response] if part).strip()
        missing = [name for name, hints in self.REQUIRED_HINTS.items() if not any(hint in text for hint in hints)]
        if user_response and previous and previous.current_question:
            resolved = list(dict.fromkeys([*previous.resolved_questions, previous.current_question]))
            asked = list(dict.fromkeys([*previous.asked_questions, previous.current_question]))
        else:
            resolved = list(previous.resolved_questions) if previous else []
            asked = list(previous.asked_questions) if previous else []

        known_facts = []
        if description:
            known_facts.append(f"需求描述：{description}")
        if "登录" in text:
            known_facts.append("需求与登录相关")
        if user_response:
            known_facts.append(f"用户补充：{user_response}")

        if not missing:
            return ClarificationState(
                can_proceed_to_design=True,
                missing_categories=[],
                known_facts=known_facts,
                blocking_points=[],
                asked_questions=asked,
                resolved_questions=resolved,
                new_facts=[user_response] if user_response else [],
                remaining_blockers=[],
                current_question="",
                question_reason="",
                clarification_summary=ClarificationSummary(
                    known=known_facts,
                    unknown=[],
                    why_blocked="",
                    next_question="",
                ),
            )

        current_missing = missing[0]
        question, reason = self.QUESTIONS[current_missing]
        blocking_points = [f"缺少 {name} 相关信息" for name in missing]
        asked = list(dict.fromkeys([*asked, question]))
        return ClarificationState(
            can_proceed_to_design=False,
            missing_categories=missing,
            known_facts=known_facts,
            blocking_points=blocking_points,
            asked_questions=asked,
            resolved_questions=resolved,
            new_facts=[user_response] if user_response else [],
            remaining_blockers=blocking_points,
            current_question=question,
            question_reason=reason,
            clarification_summary=ClarificationSummary(
                known=known_facts,
                unknown=blocking_points,
                why_blocked=reason,
                next_question=question,
            ),
        )
