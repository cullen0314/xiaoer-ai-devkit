from tests import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class TestIsolationContract(unittest.TestCase):
    def test_existing_feature_flow_files_still_exist(self):
        self.assertTrue((PROJECT_ROOT / "claude/commands/xe/feature-flow.md").exists())
        self.assertTrue((PROJECT_ROOT / "claude/commands/xe/feature-flow-resume.md").exists())
        self.assertTrue((PROJECT_ROOT / "claude/agents/agent-xe-tech-plan.md").exists())

    def test_new_implementation_is_isolated_under_openagent_impl(self):
        self.assertTrue((PROJECT_ROOT / "openagent_impl/tech_plan/runner.py").exists())
        self.assertFalse((PROJECT_ROOT / "claude/agents/agent-openagent-tech-plan.md").exists())


if __name__ == "__main__":
    unittest.main()
