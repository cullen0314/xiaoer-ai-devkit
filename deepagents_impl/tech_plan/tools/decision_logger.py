from __future__ import annotations

from tools.state_bridge import StateBridge


def log_default_decision(state_bridge: StateBridge, requirement_name: str, decision: str) -> None:
    state_bridge.add_decision(requirement_name, decision)
