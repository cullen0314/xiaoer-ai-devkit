from __future__ import annotations

from dataclasses import dataclass

from schemas.schema_base import SimpleModel


@dataclass
class TechPlanInput(SimpleModel):
    prd_url: str = ""
    requirement_name: str = ""
    description: str = ""
    output_dir: str = "docs"
    user_response: str = ""
    resume: bool = False

    @classmethod
    def model_validate(cls, data):
        if isinstance(data, cls):
            return data
        data = dict(data or {})
        normalized = {
            "prd_url": data.get("prdUrl", data.get("prd_url", "")),
            "requirement_name": data.get("requirementName", data.get("requirement_name", "")),
            "description": data.get("description", ""),
            "output_dir": data.get("output_dir", data.get("outputDir", "docs")),
            "user_response": data.get("userResponse", data.get("user_response", "")),
            "resume": bool(data.get("resume", False)),
        }
        return super().model_validate(normalized)
