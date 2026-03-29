from services.verification_service import build_verification


def test_build_verification_all_passed() -> None:
    result = build_verification(prd_read=True, docs_generated=True, state_saved=True)

    assert result.prd_read == "passed"
    assert result.clarification_completed == "passed"
    assert result.doc_generated == "passed"
    assert result.state_saved == "passed"


def test_build_verification_partial_failure() -> None:
    result = build_verification(
        prd_read=False,
        docs_generated=False,
        state_saved=True,
        clarification_completed=False,
    )

    assert result.prd_read == "failed"
    assert result.clarification_completed == "pending"
    assert result.doc_generated == "failed"
    assert result.state_saved == "passed"
