from pydantic import BaseModel, Field


class ClarificationSummary(BaseModel):
    known: list[str] = Field(default_factory=list)
    unknown: list[str] = Field(default_factory=list)
    why_blocked: str = ""
    next_question: str = ""


class ClarificationState(BaseModel):
    can_proceed_to_design: bool = False
    missing_categories: list[str] = Field(default_factory=list)
    known_facts: list[str] = Field(default_factory=list)
    blocking_points: list[str] = Field(default_factory=list)
    asked_questions: list[str] = Field(default_factory=list)
    resolved_questions: list[str] = Field(default_factory=list)
    new_facts: list[str] = Field(default_factory=list)
    remaining_blockers: list[str] = Field(default_factory=list)
    current_question: str = ""
    question_reason: str = ""
    clarification_summary: ClarificationSummary = Field(default_factory=ClarificationSummary)
