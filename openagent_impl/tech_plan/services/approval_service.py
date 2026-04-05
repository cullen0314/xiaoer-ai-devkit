from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ApprovalDecision:
    approved: bool
    needs_revision: bool
    note: str = ""


class ApprovalService:
    APPROVE_KEYWORDS = ("确认", "同意", "通过", "ok", "OK", "继续")
    REVISION_KEYWORDS = ("修改", "调整", "改成", "去掉", "补充", "优化")

    def decide(self, user_response: str) -> ApprovalDecision:
        text = (user_response or "").strip()
        if not text:
            return ApprovalDecision(False, False, "尚未收到确认信息")
        if any(keyword in text for keyword in self.APPROVE_KEYWORDS):
            return ApprovalDecision(True, False, "用户已确认方案")
        if any(keyword in text for keyword in self.REVISION_KEYWORDS):
            return ApprovalDecision(False, True, f"用户提出修改意见：{text}")
        return ApprovalDecision(False, False, f"未识别为确认，保留等待审批状态：{text}")
