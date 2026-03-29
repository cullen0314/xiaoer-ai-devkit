import json
from pathlib import Path
from unittest.mock import Mock, patch

from tools.state_bridge import StateBridge


STATE_JSON = json.dumps(
    {
        "requirement": {
            "name": "demo",
            "prd_url": "https://example.com/prd",
            "description": "desc",
            "created_at": "2026-03-30T00:00:00Z",
        },
        "current_stage": "tech-plan",
        "current_substage": "reading_prd",
        "next_action": "analyze_prd",
        "approved_sections": [],
        "artifacts": {},
        "stages": {
            "tech-plan": {"status": "in_progress", "output": None, "completed_at": None}
        },
        "artifact_roles": {},
        "decisions": [],
        "clarification": {},
    }
)


def _completed(stdout: str) -> Mock:
    return Mock(stdout=stdout)


@patch("tools.state_bridge.subprocess.run")
def test_exists_returns_true(mock_run: Mock) -> None:
    mock_run.return_value = _completed("true\n")
    bridge = StateBridge(Path("/tmp/project"))

    assert bridge.exists("demo") is True
    mock_run.assert_called_once()


@patch("tools.state_bridge.subprocess.run")
def test_init_state_parses_json(mock_run: Mock) -> None:
    mock_run.return_value = _completed(STATE_JSON)
    bridge = StateBridge(Path("/tmp/project"))

    state = bridge.init_state("demo", "https://example.com/prd", "desc")

    assert state.requirement.name == "demo"
    assert state.current_substage == "reading_prd"


@patch("tools.state_bridge.subprocess.run")
def test_update_stage_serializes_metadata(mock_run: Mock) -> None:
    mock_run.return_value = _completed(STATE_JSON)
    bridge = StateBridge(Path("/tmp/project"))

    bridge.update_stage(
        "demo",
        "tech-plan",
        "completed",
        "docs/demo/技术设计.md",
        {"next_action": "java-coding"},
    )

    args = mock_run.call_args.args[0]
    assert args[:4] == ["node", "/tmp/project/claude/utils/state-manager.js", "update", "demo"]
    assert args[4:7] == ["tech-plan", "completed", "docs/demo/技术设计.md"]
    assert json.loads(args[7]) == {"next_action": "java-coding"}
