from __future__ import annotations

from pathlib import Path

from services.approval_service import ApprovalService
from services.clarification_service import ClarificationService
from services.output_builder import OutputBuilder
from tools.artifact_writer import ArtifactWriter
from tools.prd_reader import PrdReader
from tools.state_bridge import StateBridge
from tools.template_loader import TemplateLoader
from orchestrator import OpenAgentTechPlanOrchestrator


class OpenAgentTechPlanApp:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.template_loader = TemplateLoader(project_root)
        self.prd_reader = PrdReader(project_root)
        self.state_bridge = StateBridge(project_root)
        self.artifact_writer = ArtifactWriter(project_root)
        self.clarification_service = ClarificationService()
        self.approval_service = ApprovalService()
        self.output_builder = OutputBuilder()
        self.orchestrator = OpenAgentTechPlanOrchestrator(
            project_root=project_root,
            template_loader=self.template_loader,
            prd_reader=self.prd_reader,
            state_bridge=self.state_bridge,
            artifact_writer=self.artifact_writer,
            clarification_service=self.clarification_service,
            approval_service=self.approval_service,
            output_builder=self.output_builder,
        )

    def run(self, raw_input: dict):
        return self.orchestrator.run(raw_input)
