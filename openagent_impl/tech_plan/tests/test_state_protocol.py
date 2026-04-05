from pathlib import Path
from tests import tempfile, unittest
from tools.state_protocol_adapter import ensure_protocol_state
from tools.state_bridge import StateBridge


class TestStateProtocol(unittest.TestCase):
    def test_ensure_protocol_state_fills_required_fields(self):
        state = ensure_protocol_state({"artifacts": {}}, state_file="docs/需求A/state.json")
        self.assertEqual(state["current_stage"], "tech-plan")
        self.assertEqual(state["current_substage"], "initializing")
        self.assertEqual(state["next_action"], "read_prd")
        self.assertEqual(state["artifacts"]["state_file"], "docs/需求A/state.json")
        self.assertIn("clarification", state)
        self.assertFalse(state["clarification"]["can_proceed_to_design"])

    def test_ensure_protocol_state_normalizes_null_clarification_lists(self):
        state = ensure_protocol_state(
            {
                "artifacts": {},
                "clarification": {
                    "asked_questions": None,
                    "resolved_questions": None,
                    "missing_categories": None,
                },
            },
            state_file="docs/需求A/state.json",
        )
        self.assertEqual(state["clarification"]["asked_questions"], [])
        self.assertEqual(state["clarification"]["resolved_questions"], [])
        self.assertEqual(state["clarification"]["missing_categories"], [])

    def test_state_bridge_save_state_preserves_clarification(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            project_root = Path(temp_dir)
            bridge = StateBridge(project_root)
            state = ensure_protocol_state(
                {
                    "requirement": {"name": "需求A", "prd_url": "https://example.com", "description": "描述", "created_at": "2026-03-30T00:00:00Z"},
                    "clarification": {
                        "can_proceed_to_design": True,
                        "known_facts": ["已知事实"],
                    },
                },
                state_file="docs/需求A/state.json",
            )
            saved = bridge.save_state("需求A", state)
            self.assertTrue((project_root / "docs" / "需求A" / "state.json").exists())
            self.assertTrue(saved.clarification.can_proceed_to_design)
            self.assertEqual(saved.clarification.known_facts, ["已知事实"])


if __name__ == "__main__":
    unittest.main()
