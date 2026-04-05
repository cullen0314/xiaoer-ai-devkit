from __future__ import annotations

from schemas.artifact_schema import ArtifactPaths
from schemas.clarification_schema import ClarificationState
from schemas.output_schema import TechPlanOutput, VerificationResult


class OutputBuilder:
    def completed(self, *, summary: str, artifacts: ArtifactPaths, verification: VerificationResult, next_action: str = "java-coding") -> TechPlanOutput:
        return TechPlanOutput(
            status="completed",
            summary=summary,
            artifacts=artifacts,
            verification=verification,
            next_action=next_action,
        )

    def need_clarification(self, *, summary: str, clarification: ClarificationState, verification: VerificationResult) -> TechPlanOutput:
        return TechPlanOutput(
            status="need_clarification",
            summary=summary,
            artifacts=ArtifactPaths(),
            verification=verification,
            next_action="clarify_requirement",
            clarification=clarification,
        )

    def waiting_for_approval(self, *, summary: str, clarification: ClarificationState | None, verification: VerificationResult, approval_note: str) -> TechPlanOutput:
        return TechPlanOutput(
            status="waiting_for_approval",
            summary=summary,
            artifacts=ArtifactPaths(),
            verification=verification,
            next_action="approve_plan",
            clarification=clarification,
            approval_note=approval_note,
        )

    def execution_failed(self, *, summary: str, verification: VerificationResult, next_action: str) -> TechPlanOutput:
        return TechPlanOutput(
            status="execution_failed",
            summary=summary,
            artifacts=ArtifactPaths(),
            verification=verification,
            next_action=next_action,
        )
