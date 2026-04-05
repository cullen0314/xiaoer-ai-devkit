from __future__ import annotations

from typing import Any

from schemas.artifact_schema import ArtifactPaths
from schemas.clarification_schema import ClarificationState


def _ensure_stage_defaults(stages: dict[str, Any] | None) -> dict[str, Any]:
    stages = dict(stages or {})
    for stage_name in ("tech-plan", "java-coding", "evaluator"):
        stages.setdefault(stage_name, {"status": "pending" if stage_name != "tech-plan" else "in_progress"})
    return stages


def ensure_protocol_state(raw_state: dict[str, Any], *, state_file: str = "") -> dict[str, Any]:
    state = dict(raw_state)
    state.setdefault("current_stage", "tech-plan")
    state.setdefault("current_substage", "initializing")
    state.setdefault("next_action", "read_prd")
    state.setdefault("approved_sections", [])
    state["stages"] = _ensure_stage_defaults(state.get("stages"))

    artifacts = ArtifactPaths.model_validate(state.get("artifacts") or {})
    if state_file and not artifacts.state_file:
        artifacts.state_file = state_file
    state["artifacts"] = artifacts.model_dump()

    state.setdefault(
        "artifact_roles",
        {
            "design": "tech_plan_doc",
            "task": "dev_task_doc",
            "taskSource": "task_source_doc",
            "state": "state_file",
        },
    )
    state.setdefault("decisions", [])
    clarification = ClarificationState.model_validate(state.get("clarification") or {})
    state["clarification"] = clarification.model_dump()
    return state


def merge_clarification_state(current: dict[str, Any] | None, updates: ClarificationState) -> dict[str, Any]:
    merged = ClarificationState.model_validate(current or {})
    update_data = updates.model_dump()
    merged = ClarificationState.model_validate({**merged.model_dump(), **update_data})
    return merged.model_dump()
