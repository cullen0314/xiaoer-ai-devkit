from schemas.output_schema import VerificationResult


def build_verification(*, prd_read: bool, docs_generated: bool, state_saved: bool, clarification_completed: bool = False) -> VerificationResult:
    return VerificationResult(
        prd_read="passed" if prd_read else "failed",
        clarification_completed="passed" if clarification_completed else "pending",
        doc_generated="passed" if docs_generated else "failed",
        state_saved="passed" if state_saved else "failed",
    )
