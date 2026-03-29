from pydantic import BaseModel, Field

from schemas.artifact_schema import ArtifactPaths
from schemas.clarification_schema import ClarificationState


class RequirementMeta(BaseModel):
    name: str
    prd_url: str = ""
    description: str = ""
    created_at: str = ""


class StageStatus(BaseModel):
    status: str = "pending"
    output: str | None = None
    completed_at: str | None = None


class TechPlanState(BaseModel):
    requirement: RequirementMeta
    current_stage: str = "tech-plan"
    current_substage: str = "initializing"
    next_action: str = "read_prd"
    approved_sections: list[str] = Field(default_factory=list)
    artifacts: dict = Field(default_factory=dict)
    stages: dict[str, StageStatus] = Field(default_factory=dict)
    artifact_roles: dict[str, str] = Field(default_factory=dict)
    decisions: list[dict] = Field(default_factory=list)
    clarification: ClarificationState = Field(default_factory=ClarificationState)
