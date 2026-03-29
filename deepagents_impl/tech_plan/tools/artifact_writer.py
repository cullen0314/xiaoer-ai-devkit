from __future__ import annotations

from pathlib import Path

from schemas.artifact_schema import ArtifactPaths


class ArtifactWriter:
    def __init__(self, project_root: Path, output_dir: str = "docs") -> None:
        self.project_root = project_root
        self.output_dir = output_dir

    def write_documents(self, requirement_name: str, tech_plan: str, dev_tasks: str) -> ArtifactPaths:
        base_dir = self.project_root / self.output_dir / requirement_name
        base_dir.mkdir(parents=True, exist_ok=True)

        tech_plan_path = base_dir / "技术设计.md"
        dev_task_path = base_dir / "开发任务.md"
        state_path = base_dir / "state.json"

        tech_plan_path.write_text(tech_plan, encoding="utf-8")
        dev_task_path.write_text(dev_tasks, encoding="utf-8")

        return ArtifactPaths(
            tech_plan_doc=str(tech_plan_path.relative_to(self.project_root)),
            tech_design_doc=str(tech_plan_path.relative_to(self.project_root)),
            dev_task_doc=str(dev_task_path.relative_to(self.project_root)),
            task_list_doc=str(dev_task_path.relative_to(self.project_root)),
            task_source_doc=str(tech_plan_path.relative_to(self.project_root)),
            state_file=str(state_path.relative_to(self.project_root)),
        )
