from __future__ import annotations

import subprocess
from pathlib import Path


class PrdReader:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.script_path = project_root / "claude" / "skills" / "feishu-doc-read" / "run.sh"

    def read(self, prd_url: str) -> str:
        completed = subprocess.run(
            ["bash", str(self.script_path), "--no-save", prd_url],
            cwd=self.project_root,
            check=True,
            capture_output=True,
            text=True,
        )
        return completed.stdout.strip()
