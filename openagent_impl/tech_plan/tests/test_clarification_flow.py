from tests import unittest
from services.clarification_service import ClarificationService


class TestClarificationFlow(unittest.TestCase):
    def test_clarification_returns_need_more_info_for_sparse_input(self):
        service = ClarificationService()
        result = service.analyze(prd_markdown="这是一个简单需求", description="")
        self.assertFalse(result.can_proceed_to_design)
        self.assertTrue(result.current_question)
        self.assertTrue(result.blocking_points)

    def test_clarification_can_proceed_when_keywords_are_present(self):
        service = ClarificationService()
        text = "需求目标明确，功能范围清晰，包含关键流程、接口输入输出以及性能约束。"
        result = service.analyze(prd_markdown=text, description="补充背景")
        self.assertTrue(result.can_proceed_to_design)
        self.assertEqual(result.current_question, "")


if __name__ == "__main__":
    unittest.main()
