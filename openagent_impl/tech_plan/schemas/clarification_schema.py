from __future__ import annotations

from dataclasses import dataclass, field

from schemas.schema_base import SimpleModel


@dataclass
class ClarificationSummary(SimpleModel):
    known: list[str] = field(default_factory=list)
    unknown: list[str] = field(default_factory=list)
    why_blocked: str = ""
    next_question: str = ""


@dataclass
class ClarificationState(SimpleModel):
    can_proceed_to_design: bool = False
    missing_categories: list[str] = field(default_factory=list)
    known_facts: list[str] = field(default_factory=list)
    blocking_points: list[str] = field(default_factory=list)
    asked_questions: list[str] = field(default_factory=list)
    resolved_questions: list[str] = field(default_factory=list)
    new_facts: list[str] = field(default_factory=list)
    remaining_blockers: list[str] = field(default_factory=list)
    current_question: str = ""
    question_reason: str = ""
    clarification_summary: ClarificationSummary = field(default_factory=ClarificationSummary)
