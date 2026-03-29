from __future__ import annotations

from pathlib import Path


def build_repo_context(project_root: Path) -> str:
    summary = []
    for rel_path in [
        "README.md",
        "AGENTS.md",
        "claude/agents/agent-xe-tech-plan.md",
        "claude/agents/agent-xe-java-coding.md",
        "claude/utils/state-manager.js",
    ]:
        path = project_root / rel_path
        if path.exists():
            content = path.read_text(encoding="utf-8")
            summary.append(f"## 文件: {rel_path}\n{content[:4000]}")
    return "\n\n".join(summary)
