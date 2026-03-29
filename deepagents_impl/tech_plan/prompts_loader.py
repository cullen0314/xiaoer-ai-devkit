from __future__ import annotations

from pathlib import Path


def load_system_prompt(project_root: Path) -> str:
    path = project_root / "deepagents_impl" / "tech_plan" / "prompts" / "system_prompt.md"
    return path.read_text(encoding="utf-8")
