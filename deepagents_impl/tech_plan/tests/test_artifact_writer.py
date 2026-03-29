from pathlib import Path

from tools.artifact_writer import ArtifactWriter


def test_write_documents(tmp_path: Path) -> None:
    writer = ArtifactWriter(tmp_path)

    artifacts = writer.write_documents("demo", "# 技术设计", "# 开发任务")

    assert (tmp_path / "docs" / "demo" / "技术设计.md").read_text(encoding="utf-8") == "# 技术设计"
    assert (tmp_path / "docs" / "demo" / "开发任务.md").read_text(encoding="utf-8") == "# 开发任务"
    assert artifacts.tech_plan_doc == "docs/demo/技术设计.md"
    assert artifacts.tech_design_doc == "docs/demo/技术设计.md"
    assert artifacts.dev_task_doc == "docs/demo/开发任务.md"
    assert artifacts.state_file == "docs/demo/state.json"
