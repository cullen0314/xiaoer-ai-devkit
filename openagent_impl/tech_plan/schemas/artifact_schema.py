from __future__ import annotations

from dataclasses import dataclass

from schemas.schema_base import SimpleModel


@dataclass
class ArtifactPaths(SimpleModel):
    tech_plan_doc: str = ""
    tech_design_doc: str = ""
    dev_task_doc: str = ""
    task_list_doc: str = ""
    task_source_doc: str = ""
    state_file: str = ""
    feishu_doc_url: str = ""
