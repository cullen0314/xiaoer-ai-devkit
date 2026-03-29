from pathlib import Path

from tools.template_loader import TemplateLoader


def test_load_templates(tmp_path: Path) -> None:
    template_dir = tmp_path / "claude" / "agents" / "templates"
    template_dir.mkdir(parents=True)
    (template_dir / "技术设计文档模板.md").write_text("# 技术设计模板", encoding="utf-8")
    (template_dir / "开发任务文档模板.md").write_text("# 开发任务模板", encoding="utf-8")

    loader = TemplateLoader(tmp_path)

    assert loader.load_tech_plan_template() == "# 技术设计模板"
    assert loader.load_dev_task_template() == "# 开发任务模板"
