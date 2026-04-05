from __future__ import annotations

import argparse
import json
from pathlib import Path

from app import OpenAgentTechPlanApp


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run OpenAgent tech-plan")
    parser.add_argument("--prd-url", default="")
    parser.add_argument("--requirement-name", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--user-response", default="")
    parser.add_argument("--resume", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_root = Path(__file__).resolve().parents[2]
    app = OpenAgentTechPlanApp(project_root)
    result = app.run(
        {
            "prdUrl": args.prd_url,
            "requirementName": args.requirement_name,
            "description": args.description,
            "userResponse": args.user_response,
            "resume": args.resume,
        }
    )
    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
