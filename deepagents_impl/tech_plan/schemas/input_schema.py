from pydantic import BaseModel, Field


class TechPlanInput(BaseModel):
    prd_url: str = Field(alias="prdUrl")
    requirement_name: str = Field(alias="requirementName")
    description: str = ""
    output_dir: str = "docs"

    model_config = {
        "populate_by_name": True,
        "extra": "ignore",
    }
