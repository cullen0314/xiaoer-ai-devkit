#!/usr/bin/env python3
"""Read-only structural scanner for Claude, Codex, and generic Agent Skills."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
from pathlib import Path
from typing import Any


FRONTMATTER_RE = re.compile(r"\A\ufeff?---\s*\r?\n(.*?)\r?\n---\s*(?:\r?\n|$)", re.S)
KEY_RE = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$")
MARKDOWN_LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+['\"][^)]*['\"])?\)")
RESOURCE_PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_])((?:references?|scripts?|assets?)/[A-Za-z0-9_./@+-]+)"
)
SKILL_CALL_RE = re.compile(r"\bSkill\s*\(\s*[\"']?([A-Za-z0-9:_-]+)")
TASK_CALL_RE = re.compile(r"\b(?:Task|Agent)\s*\(\s*[\"']?([A-Za-z0-9:_-]+)")
ALLOWED_SKILL_RE = re.compile(r"\bSkill\(([^)]+)\)")
ALLOWED_TASK_RE = re.compile(r"\b(?:Task|Agent)\(([^)]+)\)")
BODY_TOOL_RE = re.compile(
    r"\b(Read|Write|Edit|Glob|Grep|Bash|AskUserQuestion|Skill|Task|Agent)\s*\("
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", help="SKILL.md path or skill directory")
    parser.add_argument(
        "--platform", choices=("auto", "claude", "codex", "generic"), default="auto"
    )
    parser.add_argument("--runtime-check", action="store_true")
    parser.add_argument(
        "--installed-root",
        action="append",
        default=[],
        help="Additional installed skill collection or exact skill directory",
    )
    return parser.parse_args(argv)


def resolve_target(raw_target: str) -> tuple[Path, Path]:
    target = Path(raw_target).expanduser().resolve()
    if target.is_dir():
        skill_file = target / "SKILL.md"
        skill_root = target
    else:
        skill_file = target
        skill_root = target.parent
    if not skill_file.is_file():
        raise ValueError(f"SKILL.md 不存在: {skill_file}")
    if not os.access(skill_file, os.R_OK):
        raise ValueError(f"SKILL.md 不可读: {skill_file}")
    return skill_file, skill_root


def extract_frontmatter(text: str) -> tuple[str, str, dict[str, str], list[str]]:
    match = FRONTMATTER_RE.search(text)
    if not match:
        return "", text, {}, ["缺少或无法识别 YAML frontmatter"]

    raw = match.group(1)
    values: dict[str, str] = {}
    errors: list[str] = []
    lines = raw.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip() or line.lstrip().startswith("#"):
            index += 1
            continue
        key_match = KEY_RE.match(line)
        if not key_match:
            if not line.startswith((" ", "\t", "-")):
                errors.append(f"无法识别的 frontmatter 行 {index + 1}: {line}")
            index += 1
            continue
        key, value = key_match.group(1), (key_match.group(2) or "").strip()
        if key in values:
            errors.append(f"重复的 frontmatter 字段 {key}: 第 {index + 1} 行")
        if value in {"|", ">", "|-", ">-", "|+", ">+"}:
            block: list[str] = []
            index += 1
            while index < len(lines) and (
                not lines[index].strip() or lines[index].startswith((" ", "\t"))
            ):
                block.append(lines[index].strip())
                index += 1
            values[key] = "\n".join(block).strip()
            continue
        values[key] = value.strip("'\"")
        index += 1
    return raw, text[match.end() :], values, errors


def estimate_tokens(text: str) -> int:
    ascii_count = sum(1 for char in text if ord(char) < 128)
    non_ascii_count = len(text) - ascii_count
    return max(1, math.ceil(ascii_count / 4 + non_ascii_count * 1.1))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def detect_platform(requested: str, values: dict[str, str], skill_root: Path) -> str:
    if requested != "auto":
        return requested
    claude_keys = {
        "model",
        "argument-hint",
        "allowed-tools",
        "disable-model-invocation",
        "user-invocable",
        "context",
        "agent",
    }
    if claude_keys.intersection(values) or "/claude/skills/" in str(skill_root):
        return "claude"
    if (skill_root / "agents" / "openai.yaml").is_file() or "/.codex/skills/" in str(
        skill_root
    ):
        return "codex"
    return "generic"


def is_external_link(value: str) -> bool:
    return value.startswith(("http://", "https://", "mailto:", "#", "data:"))


def normalize_reference(value: str) -> str:
    return value.split("#", 1)[0].split("?", 1)[0].strip("`<>")


def direct_references(body: str, skill_root: Path) -> list[dict[str, Any]]:
    candidates = {match.group(1) for match in MARKDOWN_LINK_RE.finditer(body)}
    candidates.update(match.group(1) for match in RESOURCE_PATH_RE.finditer(body))
    results: list[dict[str, Any]] = []
    for raw in sorted(candidates):
        if is_external_link(raw) or "{" in raw or "$" in raw:
            continue
        normalized = normalize_reference(raw)
        if not normalized:
            continue
        path = Path(normalized).expanduser()
        resolved = path.resolve() if path.is_absolute() else (skill_root / path).resolve()
        results.append(
            {
                "reference": raw,
                "resolved": str(resolved),
                "exists": resolved.exists(),
                "is_file": resolved.is_file(),
            }
        )
    return results


def resource_inventory(skill_root: Path) -> dict[str, Any]:
    inventory: dict[str, Any] = {}
    for resource in ("references", "scripts", "assets", "evals", "tests"):
        root = skill_root / resource
        files = (
            sorted(
                path
                for path in root.rglob("*")
                if path.is_file()
                and "__pycache__" not in path.parts
                and path.suffix not in {".pyc", ".pyo"}
            )
            if root.is_dir()
            else []
        )
        max_depth = 0
        longest: dict[str, Any] | None = None
        for path in files:
            depth = len(path.relative_to(root).parts)
            max_depth = max(max_depth, depth)
            try:
                line_count = len(path.read_text(encoding="utf-8", errors="replace").splitlines())
            except OSError:
                line_count = None
            if line_count is not None and (longest is None or line_count > longest["lines"]):
                longest = {"path": str(path), "lines": line_count}
        inventory[resource] = {
            "exists": root.is_dir(),
            "file_count": len(files),
            "max_depth": max_depth,
            "longest_file": longest,
        }
    return inventory


def extract_dependencies(frontmatter: str, body: str) -> dict[str, list[str]]:
    skill_names = set(SKILL_CALL_RE.findall(body))
    task_names = set(TASK_CALL_RE.findall(body))
    for value in ALLOWED_SKILL_RE.findall(frontmatter):
        name = value.strip(" \"'").split(":*", 1)[0]
        if name and name != "*":
            skill_names.add(name)
    for value in ALLOWED_TASK_RE.findall(frontmatter):
        name = value.strip(" \"'").split(":*", 1)[0]
        if name and name != "*":
            task_names.add(name)
    return {"skills": sorted(skill_names), "agents": sorted(task_names)}


def candidate_skill_roots(skill_root: Path) -> list[Path]:
    roots: list[Path] = []
    parts = skill_root.parts
    for index in range(len(parts) - 1):
        if parts[index] in {"skills", ".skills"}:
            candidate = Path(*parts[: index + 1])
            if candidate.is_dir():
                roots.append(candidate)
    return roots


def candidate_agent_roots(skill_root: Path) -> list[Path]:
    roots: list[Path] = []
    for skill_collection in candidate_skill_roots(skill_root):
        candidate = skill_collection.parent / "agents"
        if candidate.is_dir() and candidate not in roots:
            roots.append(candidate)
    return roots


def find_named_skill(name: str, roots: list[Path]) -> list[Path]:
    found: set[Path] = set()
    for root in roots:
        exact = root / name / "SKILL.md"
        if exact.is_file():
            found.add(exact.resolve())
        if root.is_dir():
            for candidate in root.glob(f"*/{name}/SKILL.md"):
                if candidate.is_file():
                    found.add(candidate.resolve())
    return sorted(found)


def find_named_agent(name: str, roots: list[Path]) -> list[Path]:
    found: set[Path] = set()
    for root in roots:
        exact = root / f"{name}.md"
        if exact.is_file():
            found.add(exact.resolve())
        if root.is_dir():
            for candidate in root.glob(f"*/{name}.md"):
                if candidate.is_file():
                    found.add(candidate.resolve())
    return sorted(found)


def installed_roots(explicit: list[str]) -> list[Path]:
    roots = [Path(value).expanduser().resolve() for value in explicit]
    roots.extend(
        [
            Path.home() / ".claude" / "skills",
            Path.home() / ".codex" / "skills",
            Path.home() / ".agents" / "skills",
        ]
    )
    unique: list[Path] = []
    for root in roots:
        resolved = root.resolve()
        if resolved not in unique and resolved.exists():
            unique.append(resolved)
    return unique


def installed_agent_roots(skill_roots: list[Path]) -> list[Path]:
    roots: list[Path] = []
    for skill_root in skill_roots:
        candidate = skill_root.parent / "agents"
        if candidate.is_dir() and candidate not in roots:
            roots.append(candidate)
    default = Path.home() / ".claude" / "agents"
    if default.is_dir() and default.resolve() not in roots:
        roots.append(default.resolve())
    return roots


def runtime_status(
    name: str,
    skill_file: Path,
    dependencies: dict[str, list[str]],
    explicit_roots: list[str],
) -> dict[str, Any]:
    roots = installed_roots(explicit_roots)
    source_hash = sha256(skill_file)
    same_name: list[dict[str, Any]] = []
    for root in roots:
        exact_skill = root if (root / "SKILL.md").is_file() else root / name
        installed = exact_skill / "SKILL.md"
        if not installed.is_file() or installed.resolve() == skill_file.resolve():
            continue
        installed_hash = sha256(installed)
        same_name.append(
            {
                "path": str(installed.resolve()),
                "same_content": installed_hash == source_hash,
                "source_sha256": source_hash,
                "installed_sha256": installed_hash,
                "source_mtime": skill_file.stat().st_mtime,
                "installed_mtime": installed.stat().st_mtime,
            }
        )

    dependency_status: list[dict[str, Any]] = []
    for dependency in dependencies["skills"]:
        matches = find_named_skill(dependency, roots)
        dependency_status.append(
            {
                "name": dependency,
                "installed": bool(matches),
                "paths": [str(path) for path in matches],
            }
        )
    agent_roots = installed_agent_roots(roots)
    agent_status: list[dict[str, Any]] = []
    for dependency in dependencies["agents"]:
        matches = find_named_agent(dependency, agent_roots)
        agent_status.append(
            {
                "name": dependency,
                "installed": bool(matches),
                "paths": [str(path) for path in matches],
            }
        )
    return {
        "checked": True,
        "installed_roots": [str(root) for root in roots],
        "installed_agent_roots": [str(root) for root in agent_roots],
        "same_name_installations": same_name,
        "skill_dependencies": dependency_status,
        "agent_dependencies": agent_status,
    }


def add_warning(
    warnings: list[dict[str, Any]], code: str, message: str, evidence: Any
) -> None:
    warnings.append({"code": code, "message": message, "evidence": evidence})


def scan(args: argparse.Namespace) -> dict[str, Any]:
    skill_file, skill_root = resolve_target(args.target)
    text = skill_file.read_text(encoding="utf-8", errors="replace")
    frontmatter, body, values, frontmatter_errors = extract_frontmatter(text)
    platform = detect_platform(args.platform, values, skill_root)
    references = direct_references(body, skill_root)
    inventory = resource_inventory(skill_root)
    dependencies = extract_dependencies(frontmatter, body)
    warnings: list[dict[str, Any]] = []

    if not frontmatter:
        add_warning(warnings, "FRONTMATTER_MISSING", "缺少可识别的 frontmatter", frontmatter_errors)
    elif frontmatter_errors:
        add_warning(
            warnings,
            "FRONTMATTER_SUSPICIOUS",
            "frontmatter 存在无法识别的顶层内容",
            frontmatter_errors,
        )
    unquoted_flow_colons = sorted(
        set(
            re.findall(
                r"(?<![\"'])\b[A-Za-z][A-Za-z0-9_-]*\([^,\]\n\"']*:[^,\]\n\"']*\)",
                frontmatter,
            )
        )
    )
    if unquoted_flow_colons:
        add_warning(
            warnings,
            "FRONTMATTER_FLOW_COLON_UNQUOTED",
            "YAML 流式数组中的含冒号值需要加引号",
            unquoted_flow_colons,
        )

    name = values.get("name", "")
    description = values.get("description", "")
    if not name:
        add_warning(warnings, "NAME_MISSING", "frontmatter 缺少 name", str(skill_file))
    elif name != skill_root.name:
        add_warning(
            warnings,
            "NAME_DIRECTORY_MISMATCH",
            "name 与 Skill 目录名不一致",
            {"name": name, "directory": skill_root.name},
        )
    if name and (len(name) > 64 or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name)):
        add_warning(
            warnings,
            "NAME_FORMAT_INVALID",
            "name 应使用不超过 64 字符的小写字母、数字和连字符",
            name,
        )
    if not description:
        add_warning(warnings, "DESCRIPTION_MISSING", "frontmatter 缺少 description", str(skill_file))
    elif len(description) > 1024:
        add_warning(
            warnings,
            "DESCRIPTION_OVER_1024_CHARS",
            "description 超过 1024 字符，需复核平台限制和常驻上下文成本",
            {"length": len(description)},
        )

    body_lines = len(body.splitlines())
    if body_lines > 500:
        add_warning(
            warnings,
            "SKILL_BODY_OVER_500_LINES",
            "SKILL.md 正文超过 500 行，需要结合信息密度复核渐进式披露",
            {"body_lines": body_lines},
        )

    missing_references = [reference for reference in references if not reference["exists"]]
    if missing_references:
        add_warning(
            warnings,
            "REFERENCE_MISSING",
            "存在无法解析的直接本地引用",
            missing_references,
        )

    quoted_tilde = sorted(set(re.findall(r"[\"'](~/(?:[^\"'\n]+))[\"']", text)))
    if quoted_tilde:
        add_warning(
            warnings,
            "QUOTED_TILDE",
            "引号内的 ~ 在 Shell 中不会展开",
            quoted_tilde,
        )

    fixed_home_paths = sorted(set(re.findall(r"/Users/[^/\s`\"']+/[^\s`\"']+", text)))
    if fixed_home_paths:
        add_warning(
            warnings,
            "FIXED_HOME_PATH",
            "正文包含固定用户目录，需复核可移植性",
            fixed_home_paths,
        )

    broad_write = bool(
        re.search(r"(?:Write|Edit)\(\*\)|(?:^|[\[,\s])(?:Write|Edit)(?:[,\]\s]|$)", frontmatter)
    )
    boundary_signal = bool(
        re.search(
            r"只读|不得修改|禁止修改|只允许写|写入范围|read[- ]only|do not (?:edit|modify|write)",
            body,
            re.I,
        )
    )
    if broad_write and not boundary_signal:
        add_warning(
            warnings,
            "BROAD_WRITE_WITHOUT_BOUNDARY",
            "放行了宽泛 Write/Edit，但正文未识别到写入边界",
            values.get("allowed-tools", ""),
        )

    signals = {
        "input_contract": bool(
            re.search(r"(^|\n)#{1,4}[^\n]*(?:输入|Input\b)|\$ARGUMENTS", body, re.I)
        ),
        "output_contract": bool(
            re.search(
                r"(^|\n)#{1,4}[^\n]*(?:输出|报告|产物|Output\b)|输出到|输出路径|DOC_PATH|生成[^\n]{0,24}文档",
                body,
                re.I,
            )
        ),
        "stop_conditions": bool(
            re.search(r"停止条件|完成条件|结束条件|暂停|终止|blocked|stop conditions?|completion", body, re.I)
        ),
        "failure_handling": bool(re.search(r"失败|缺失|不可读|无法|错误|failure|error|invalid", body, re.I)),
        "read_only_boundary": boundary_signal,
    }
    for signal, present in signals.items():
        if not present:
            add_warning(
                warnings,
                f"SIGNAL_{signal.upper()}_MISSING",
                f"未识别到 {signal} 信号，需人工判断是否适用",
                str(skill_file),
            )

    allowed_raw = values.get("allowed-tools", frontmatter)
    body_tools = sorted(set(BODY_TOOL_RE.findall(body)))
    undeclared_tools = [tool for tool in body_tools if tool not in allowed_raw]
    if undeclared_tools and "allowed-tools" in values:
        add_warning(
            warnings,
            "BODY_TOOL_NOT_DECLARED",
            "正文出现的工具未在 allowed-tools 文本中识别到",
            undeclared_tools,
        )

    has_validation_assets = any(
        inventory[name]["file_count"] > 0 for name in ("evals", "tests")
    ) or any("test" in path.name.lower() for path in (skill_root / "scripts").glob("*") if path.is_file())
    if not has_validation_assets:
        add_warning(
            warnings,
            "VALIDATION_ASSETS_MISSING",
            "未发现 eval 或测试资产；简单 Skill 可由人工判断为不适用",
            str(skill_root),
        )

    runtime: dict[str, Any] = {"checked": False}
    if args.runtime_check and name:
        runtime = runtime_status(name, skill_file, dependencies, args.installed_root)
        drift = [item for item in runtime["same_name_installations"] if not item["same_content"]]
        if drift:
            add_warning(
                warnings,
                "INSTALLED_VERSION_DRIFT",
                "同名安装 Skill 与当前源码不一致",
                drift,
            )
        missing_dependencies = [
            item for item in runtime["skill_dependencies"] if not item["installed"]
        ]
        if missing_dependencies:
            add_warning(
                warnings,
                "INSTALLED_DEPENDENCY_MISSING",
                "直接 Skill 依赖未在安装目录中找到",
                missing_dependencies,
            )
        missing_agents = [item for item in runtime["agent_dependencies"] if not item["installed"]]
        if missing_agents:
            add_warning(
                warnings,
                "INSTALLED_AGENT_MISSING",
                "直接 Agent 依赖未在安装目录中找到",
                missing_agents,
            )

    repo_dependency_roots = candidate_skill_roots(skill_root)
    source_dependencies = []
    for dependency in dependencies["skills"]:
        matches = find_named_skill(dependency, repo_dependency_roots)
        source_dependencies.append(
            {"name": dependency, "found": bool(matches), "paths": [str(path) for path in matches]}
        )
    repo_agent_roots = candidate_agent_roots(skill_root)
    source_agents = []
    for dependency in dependencies["agents"]:
        matches = find_named_agent(dependency, repo_agent_roots)
        source_agents.append(
            {"name": dependency, "found": bool(matches), "paths": [str(path) for path in matches]}
        )

    return {
        "schema_version": 1,
        "target": str(skill_file),
        "skill_root": str(skill_root),
        "platform": platform,
        "frontmatter": {
            "keys": sorted(values),
            "name": name,
            "description_length": len(description),
            "errors": frontmatter_errors,
        },
        "metrics": {
            "file_lines": len(text.splitlines()),
            "body_lines": body_lines,
            "characters": len(text),
            "words": len(re.findall(r"\b\w+\b", text, re.UNICODE)),
            "estimated_tokens": estimate_tokens(text),
        },
        "signals": signals,
        "resources": inventory,
        "direct_references": references,
        "dependencies": {
            **dependencies,
            "source_skill_status": source_dependencies,
            "source_agent_status": source_agents,
        },
        "tools": {
            "body_calls": body_tools,
            "undeclared_candidates": undeclared_tools,
            "broad_write_or_edit": broad_write,
        },
        "runtime": runtime,
        "warnings": warnings,
        "warning_count": len(warnings),
        "note": "warnings 是待人工复核的候选证据，不等同于正式缺陷或扣分。",
    }


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        result = scan(args)
    except (OSError, ValueError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
