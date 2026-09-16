#!/usr/bin/env python3

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("scan_skill.py")
SPEC = importlib.util.spec_from_file_location("scan_skill", MODULE_PATH)
assert SPEC and SPEC.loader
scan_skill = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(scan_skill)


def args_for(target: Path, **overrides):
    values = {
        "target": str(target),
        "platform": "auto",
        "runtime_check": False,
        "installed_root": [],
    }
    values.update(overrides)
    return type("Args", (), values)()


class ScanSkillTest(unittest.TestCase):
    def make_skill(self, root: Path, name: str, body: str, tools: str = "[Read]") -> Path:
        skill_root = root / name
        skill_root.mkdir(parents=True)
        (skill_root / "SKILL.md").write_text(
            "---\n"
            f"name: {name}\n"
            f"description: 评估测试 {name}\n"
            f"allowed-tools: {tools}\n"
            "---\n\n"
            + body,
            encoding="utf-8",
        )
        return skill_root

    def warning_codes(self, result):
        return {warning["code"] for warning in result["warnings"]}

    def test_resolves_directory_and_collects_metrics(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skill = self.make_skill(
                root,
                "healthy-skill",
                "# Healthy\n\n## 输入\n读取 `$ARGUMENTS`。\n\n"
                "### 8. 输出报告\n输出报告。\n\n## 完成条件\n完成后结束。\n\n"
                "失败或不可读时暂停。全程只读，不得修改。\n",
            )
            result = scan_skill.scan(args_for(skill))
            self.assertEqual("healthy-skill", result["frontmatter"]["name"])
            self.assertEqual("claude", result["platform"])
            self.assertGreater(result["metrics"]["estimated_tokens"], 0)
            self.assertTrue(result["signals"]["stop_conditions"])
            self.assertTrue(result["signals"]["output_contract"])

    def test_detects_name_mismatch_and_missing_reference(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skill = self.make_skill(
                root,
                "directory-name",
                "# Test\n\n## 输入\n输入。\n## 输出\n输出。\n"
                "## 完成条件\n结束。失败时暂停。只读，不得修改。\n"
                "读取 [规则](references/missing.md)。\n",
            )
            skill_file = skill / "SKILL.md"
            skill_file.write_text(
                skill_file.read_text(encoding="utf-8").replace(
                    "name: directory-name", "name: another-name"
                ),
                encoding="utf-8",
            )
            codes = self.warning_codes(scan_skill.scan(args_for(skill)))
            self.assertIn("NAME_DIRECTORY_MISMATCH", codes)
            self.assertIn("REFERENCE_MISSING", codes)

    def test_detects_quoted_tilde_and_broad_write_without_boundary(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skill = self.make_skill(
                root,
                "unsafe-path",
                "# Test\n\n## 输入\n输入。\n## 输出\n输出。\n"
                "## 完成条件\n结束。失败时停止。\n"
                'TEMPLATE="~/.claude/template.md"\n',
                tools="[Read, Write(*), Edit(*)]",
            )
            codes = self.warning_codes(scan_skill.scan(args_for(skill)))
            self.assertIn("QUOTED_TILDE", codes)
            self.assertIn("BROAD_WRITE_WITHOUT_BOUNDARY", codes)

    def test_detects_installed_drift(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source_root = root / "source"
            installed_root = root / "installed"
            source = self.make_skill(
                source_root,
                "drift-skill",
                "# Source\n\n## 输入\n输入。\n## 输出\n输出。\n"
                "## 完成条件\n结束。失败时暂停。只读，不得修改。\n",
            )
            installed = self.make_skill(
                installed_root,
                "drift-skill",
                "# Installed older version\n",
            )
            self.assertTrue(installed.is_dir())
            result = scan_skill.scan(
                args_for(
                    source,
                    runtime_check=True,
                    installed_root=[str(installed_root)],
                )
            )
            self.assertIn("INSTALLED_VERSION_DRIFT", self.warning_codes(result))

    def test_reports_over_500_lines_without_declaring_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            body = "# Long\n" + "有效步骤。\n" * 510
            skill = self.make_skill(root, "long-skill", body)
            result = scan_skill.scan(args_for(skill))
            self.assertIn("SKILL_BODY_OVER_500_LINES", self.warning_codes(result))
            self.assertIn("note", result)

    def test_checks_installed_agent_dependency(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.make_skill(
                root / "source",
                "agent-caller",
                "# Caller\n\n## 输入\n输入。\n## 输出\n输出。\n"
                "## 完成条件\n结束。失败时暂停。只读，不得修改。\n"
                "Task(worker-agent)\n",
                tools="[Read, Task(worker-agent)]",
            )
            installed_skills = root / "runtime" / "skills"
            installed_agents = root / "runtime" / "agents"
            installed_skills.mkdir(parents=True)
            installed_agents.mkdir(parents=True)
            (installed_agents / "worker-agent.md").write_text("# Worker\n", encoding="utf-8")
            result = scan_skill.scan(
                args_for(
                    source,
                    runtime_check=True,
                    installed_root=[str(installed_skills)],
                )
            )
            self.assertTrue(result["runtime"]["agent_dependencies"][0]["installed"])

    def test_detects_invalid_name_format(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skill = self.make_skill(root, "invalid_name", "# Test\n")
            self.assertIn(
                "NAME_FORMAT_INVALID",
                self.warning_codes(scan_skill.scan(args_for(skill))),
            )

    def test_detects_unquoted_colon_in_flow_sequence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skill = self.make_skill(
                root,
                "yaml-risk",
                "# Test\n",
                tools="[Read, Bash(python3:*)]",
            )
            self.assertIn(
                "FRONTMATTER_FLOW_COLON_UNQUOTED",
                self.warning_codes(scan_skill.scan(args_for(skill))),
            )


if __name__ == "__main__":
    unittest.main()
