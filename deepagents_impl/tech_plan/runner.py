from __future__ import annotations

import argparse
import json
from pathlib import Path

from agent import TechPlanAgentApp


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DeepAgents tech-plan MVP")
    parser.add_argument("--prd-url", required=True)
    parser.add_argument("--requirement-name", required=True)
    parser.add_argument("--description", default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_root = Path(__file__).resolve().parents[2]
    app = TechPlanAgentApp(project_root)
    result = app.run(
        {
            "prdUrl": args.prd_url,
            "requirementName": args.requirement_name,
            "description": args.description,
        }
    )
    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
