from __future__ import annotations

from dataclasses import dataclass, field

from schemas.artifact_schema import ArtifactPaths
from schemas.clarification_schema import ClarificationState
from schemas.schema_base import SimpleModel


@dataclass
class VerificationResult(SimpleModel):
    prd_read: str = "pending"
    clarification_completed: str = "pending"
    doc_generated: str = "pending"
    state_saved: str = "pending"


@dataclass
class TechPlanOutput(SimpleModel):
    status: str = ""
    stage: str = "tech-plan"
    summary: str = ""
    artifacts: ArtifactPaths = field(default_factory=ArtifactPaths)
    verification: VerificationResult = field(default_factory=VerificationResult)
    next_action: str = ""
    clarification: ClarificationState | None = None
    approval_note: str = ""
