from __future__ import annotations

from pathlib import Path


class TemplateLoader:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.tech_plan_template = project_root / "claude" / "agents" / "templates" / "技术设计文档模板.md"
        self.dev_task_template = project_root / "claude" / "agents" / "templates" / "开发任务文档模板.md"

    def load_tech_plan_template(self) -> str:
        return self._read(self.tech_plan_template)

    def load_dev_task_template(self) -> str:
        return self._read(self.dev_task_template)

    def _read(self, path: Path) -> str:
        if not path.exists():
            raise FileNotFoundError(f"模板不存在: {path}")
        return path.read_text(encoding="utf-8")
