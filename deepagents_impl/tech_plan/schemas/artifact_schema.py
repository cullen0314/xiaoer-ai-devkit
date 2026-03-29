from pydantic import BaseModel, Field


class ArtifactPaths(BaseModel):
    tech_plan_doc: str = Field(default="")
    tech_design_doc: str = Field(default="")
    dev_task_doc: str = Field(default="")
    task_list_doc: str = Field(default="")
    task_source_doc: str = Field(default="")
    state_file: str = Field(default="")
    feishu_doc_url: str = Field(default="")
