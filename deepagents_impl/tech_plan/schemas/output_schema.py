from pydantic import BaseModel, Field

from schemas.artifact_schema import ArtifactPaths


class VerificationResult(BaseModel):
    prd_read: str = "pending"
    clarification_completed: str = "pending"
    doc_generated: str = "pending"
    state_saved: str = "pending"


class TechPlanOutput(BaseModel):
    status: str
    stage: str = "tech-plan"
    summary: str
    artifacts: ArtifactPaths = Field(default_factory=ArtifactPaths)
    verification: VerificationResult = Field(default_factory=VerificationResult)
    next_action: str
