from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from schemas.state_schema import TechPlanState


class StateBridge:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.script_path = project_root / "claude" / "utils" / "state-manager.js"

    def state_file_path(self, requirement_name: str) -> Path:
        return self.project_root / "docs" / requirement_name / "state.json"

    def exists(self, requirement_name: str) -> bool:
        result = self._run(["exists", requirement_name])
        return result.strip() == "true"

    def init_state(self, requirement_name: str, prd_url: str, description: str) -> TechPlanState:
        output = self._run(["init", requirement_name, prd_url, description])
        return TechPlanState.model_validate_json(output)

    def get_state(self, requirement_name: str) -> TechPlanState:
        output = self._run(["get", requirement_name])
        return TechPlanState.model_validate_json(output)

    def update_meta(self, requirement_name: str, metadata: dict) -> TechPlanState:
        output = self._run(["meta", requirement_name, json.dumps(metadata, ensure_ascii=False)])
        return TechPlanState.model_validate_json(output)

    def update_stage(
        self,
        requirement_name: str,
        stage_name: str,
        status: str,
        output_path: str | None = None,
        metadata: dict | None = None,
    ) -> TechPlanState:
        args = ["update", requirement_name, stage_name, status]
        if output_path is not None:
            args.append(output_path)
        if metadata is not None:
            if output_path is None:
                args.append("null")
            args.append(json.dumps(metadata, ensure_ascii=False))
        output = self._run(args)
        return TechPlanState.model_validate_json(output)

    def add_decision(self, requirement_name: str, decision: str) -> TechPlanState:
        output = self._run(["decision", requirement_name, decision])
        return TechPlanState.model_validate_json(output)

    def save_state(self, requirement_name: str, state: dict[str, Any] | TechPlanState) -> TechPlanState:
        payload = state.model_dump() if isinstance(state, TechPlanState) else dict(state)
        state_file = self.state_file_path(requirement_name)
        state_file.parent.mkdir(parents=True, exist_ok=True)
        state_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return TechPlanState.model_validate(payload)

    def _run(self, args: list[str]) -> str:
        completed = subprocess.run(
            ["node", str(self.script_path), *args],
            cwd=self.project_root,
            check=True,
            capture_output=True,
            text=True,
        )
        return completed.stdout
