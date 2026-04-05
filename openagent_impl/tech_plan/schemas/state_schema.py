from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from schemas.artifact_schema import ArtifactPaths
from schemas.clarification_schema import ClarificationState
from schemas.schema_base import SimpleModel


@dataclass
class RequirementMeta(SimpleModel):
    name: str = ""
    prd_url: str = ""
    description: str = ""
    created_at: str = ""


@dataclass
class StageStatus(SimpleModel):
    status: str = "pending"
    output: str | None = None
    completed_at: str | None = None


@dataclass
class TechPlanState(SimpleModel):
    requirement: RequirementMeta = field(default_factory=RequirementMeta)
    current_stage: str = "tech-plan"
    current_substage: str = "initializing"
    next_action: str = "read_prd"
    approved_sections: list[str] = field(default_factory=list)
    artifacts: dict[str, Any] = field(default_factory=dict)
    stages: dict[str, Any] = field(default_factory=dict)
    artifact_roles: dict[str, str] = field(default_factory=dict)
    decisions: list[dict] = field(default_factory=list)
    clarification: ClarificationState = field(default_factory=ClarificationState)

    def artifact_paths(self) -> ArtifactPaths:
        return ArtifactPaths.model_validate(self.artifacts or {})
