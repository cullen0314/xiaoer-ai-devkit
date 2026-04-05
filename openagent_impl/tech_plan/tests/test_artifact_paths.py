from tests import tempfile, unittest
from pathlib import Path

from tools.artifact_writer import ArtifactWriter


class TestArtifactPaths(unittest.TestCase):
    def test_artifact_writer_outputs_compatible_paths(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            writer = ArtifactWriter(Path(temp_dir), output_dir="docs")
            artifacts = writer.write_documents("需求B", "# 技术设计", "# 开发任务")
            self.assertEqual(artifacts.tech_plan_doc, "docs/需求B/技术设计.md")
            self.assertEqual(artifacts.dev_task_doc, "docs/需求B/开发任务.md")
            self.assertEqual(artifacts.state_file, "docs/需求B/state.json")


if __name__ == "__main__":
    unittest.main()
