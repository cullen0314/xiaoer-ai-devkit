from tests import unittest
from services.approval_service import ApprovalService


class TestApprovalFlow(unittest.TestCase):
    def test_approval_service_accepts_confirmation(self):
        service = ApprovalService()
        decision = service.decide("确认，继续")
        self.assertTrue(decision.approved)
        self.assertFalse(decision.needs_revision)

    def test_approval_service_detects_revision(self):
        service = ApprovalService()
        decision = service.decide("这里需要修改，去掉缓存")
        self.assertFalse(decision.approved)
        self.assertTrue(decision.needs_revision)


if __name__ == "__main__":
    unittest.main()
