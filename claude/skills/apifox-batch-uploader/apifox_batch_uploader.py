#!/usr/bin/env python3
"""Dry-run Apifox batch uploader.

Scans Java Spring controllers, matches requested method/path pairs, and writes
minimal OpenAPI plus markdown reports. Upload is available only when explicitly
requested.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


HTTP_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}
OVERWRITE_BEHAVIORS = {"OVERWRITE_EXISTING", "AUTO_MERGE", "KEEP_EXISTING", "CREATE_NEW"}
MAPPING_METHODS = {
    "GetMapping": "GET",
    "PostMapping": "POST",
    "PutMapping": "PUT",
    "DeleteMapping": "DELETE",
    "PatchMapping": "PATCH",
}


@dataclass(frozen=True)
class PathSpec:
    line_no: int
    raw: str
    method: str | None
    path: str
    normalized_path: str


@dataclass(frozen=True)
class ControllerApi:
    method: str
    path: str
    full_path: str
    source_path: str
    line_no: int
    class_name: str
    method_name: str
    summary: str
    request_type: str | None
    response_type: str | None


@dataclass(frozen=True)
class MatchResult:
    spec: PathSpec
    matches: tuple[ControllerApi, ...]


@dataclass(frozen=True)
class JavaField:
    name: str
    type_name: str
    description: str | None


@dataclass(frozen=True)
class JavaClass:
    simple_name: str
    qualified_name: str
    package: str
    imports: dict[str, str]
    wildcard_imports: tuple[str, ...]
    extends_type: str | None
    fields: tuple[JavaField, ...]
    source_path: str


@dataclass(frozen=True)
class TypeRef:
    name: str
    args: tuple["TypeRef", ...] = ()
    array: bool = False


def normalize_path(path: str, context_path: str = "") -> str:
    path = path.strip().strip('"').strip("'")
    if not path:
        return "/"
    if not path.startswith("/"):
        path = "/" + path
    path = re.sub(r"/+", "/", path)
    if len(path) > 1:
        path = path.rstrip("/")

    context_path = context_path.strip()
    if context_path:
        if not context_path.startswith("/"):
            context_path = "/" + context_path
        context_path = context_path.rstrip("/")
        if path == context_path:
            return "/"
        if path.startswith(context_path + "/"):
            path = path[len(context_path) :]
    return path or "/"


def full_path(path: str, context_path: str = "") -> str:
    path = normalize_path(path)
    context_path = context_path.strip()
    if not context_path:
        return path
    if not context_path.startswith("/"):
        context_path = "/" + context_path
    context_path = context_path.rstrip("/")
    return normalize_path(context_path + path)


def load_path_specs(path_file: Path, context_path: str) -> list[PathSpec]:
    specs: list[PathSpec] = []
    for idx, raw_line in enumerate(path_file.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "#" in line:
            line = line.split("#", 1)[0].strip()
        parts = line.split()
        method: str | None = None
        path: str
        if len(parts) >= 2 and parts[0].upper() in HTTP_METHODS:
            method = parts[0].upper()
            path = parts[1]
        else:
            path = parts[0]
        specs.append(
            PathSpec(
                line_no=idx,
                raw=raw_line,
                method=method,
                path=path,
                normalized_path=normalize_path(path, context_path),
            )
        )
    return specs


def strip_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    return re.sub(r"//.*", "", text)


def split_top_level(value: str, delimiter: str = ",") -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    for idx, char in enumerate(value):
        if char == "<":
            depth += 1
        elif char == ">":
            depth -= 1
        elif char == delimiter and depth == 0:
            part = value[start:idx].strip()
            if part:
                parts.append(part)
            start = idx + 1
    tail = value[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def normalize_type_name(type_name: str) -> str:
    type_name = re.sub(r"@\w+(?:\([^)]*\))?\s*", "", type_name)
    type_name = re.sub(r"\b(final|volatile|transient)\b", "", type_name)
    return " ".join(type_name.replace("\n", " ").split()).strip()


def parse_type_ref(type_name: str) -> TypeRef:
    type_name = normalize_type_name(type_name)
    if type_name.startswith("? extends "):
        type_name = type_name[len("? extends ") :].strip()
    if type_name.startswith("? super "):
        type_name = type_name[len("? super ") :].strip()
    if type_name == "?":
        return TypeRef("Object")

    array = False
    while type_name.endswith("[]"):
        array = True
        type_name = type_name[:-2].strip()

    generic_start = type_name.find("<")
    if generic_start >= 0 and type_name.endswith(">"):
        name = type_name[:generic_start].strip()
        inner = type_name[generic_start + 1 : -1].strip()
        args = tuple(parse_type_ref(part) for part in split_top_level(inner))
        return TypeRef(name=name, args=args, array=array)
    return TypeRef(name=type_name, array=array)


def iter_java_files(project_dir: Path) -> Iterable[Path]:
    ignored_parts = {".git", "target", "build", "out", ".idea", "node_modules"}
    for file_path in project_dir.rglob("*.java"):
        if ignored_parts.intersection(file_path.parts):
            continue
        yield file_path


def extract_annotation_block(lines: list[str], index: int) -> str:
    block: list[str] = []
    cursor = index - 1
    while cursor >= 0:
        line = lines[cursor].strip()
        if not line:
            cursor -= 1
            continue
        if line.startswith("@"):
            annotation_lines = [line]
            balance = line.count("(") - line.count(")")
            while balance > 0 and cursor + 1 < index:
                cursor += 1
                next_line = lines[cursor].strip()
                annotation_lines.append(next_line)
                balance += next_line.count("(") - next_line.count(")")
            block[0:0] = [" ".join(annotation_lines)]
            cursor -= 1
            continue
        break
    return "\n".join(block)


def extract_paths(annotation: str) -> list[str]:
    values: list[str] = []
    array_match = re.search(r"(?:value|path)\s*=\s*\{([^}]*)}", annotation, re.S)
    if array_match:
        values.extend(re.findall(r'"([^"]+)"', array_match.group(1)))
    values.extend(re.findall(r'(?:value|path)\s*=\s*"([^"]+)"', annotation))
    if not values:
        paren_match = re.search(r"\((.*)\)", annotation, re.S)
        if paren_match:
            inner = paren_match.group(1)
            if "=" not in inner or inner.strip().startswith('"') or inner.strip().startswith("{"):
                values.extend(re.findall(r'"([^"]+)"', inner))
    return values or [""]


def extract_request_methods(annotation: str) -> list[str]:
    methods = [m.upper() for m in re.findall(r"RequestMethod\.([A-Z]+)", annotation)]
    return [m for m in methods if m in HTTP_METHODS]


def extract_summary(annotation_block: str, default: str) -> str:
    for ann_name in ("ApiOperation", "Operation"):
        match = re.search(rf"@{ann_name}\s*\((.*?)\)", annotation_block, re.S)
        if not match:
            continue
        inner = match.group(1)
        for key in ("value", "summary"):
            value_match = re.search(rf"{key}\s*=\s*\"([^\"]+)\"", inner)
            if value_match:
                return value_match.group(1)
        quoted = re.search(r'"([^"]+)"', inner)
        if quoted:
            return quoted.group(1)
    return default


def java_path_to_class_name(java_file: Path) -> str:
    return java_file.stem


def parse_method_signature(signature: str) -> tuple[str, str | None, str | None]:
    compact = " ".join(signature.split())
    before_paren = compact.split("(", 1)[0]
    name_match = re.search(r"([A-Za-z_$][\w$]*)\s*$", before_paren)
    method_name = name_match.group(1) if name_match else "unknownMethod"
    response = None
    if name_match:
        prefix = before_paren[: name_match.start()].strip()
        prefix = re.sub(r"^(public|protected|private)\s+", "", prefix)
        prefix = re.sub(r"\b(static|final|synchronized|abstract)\b", "", prefix).strip()
        if prefix:
            response = prefix
    request_type = None
    params_match = re.search(r"\((.*)\)", compact)
    if params_match:
        params = params_match.group(1)
        request_body = re.search(r"@RequestBody(?:\([^)]*\))?\s+(.+?)\s+\w+(?:\s*,|$)", params)
        if request_body:
            request_type = normalize_type_name(request_body.group(1))
    return method_name, request_type, response


def parse_imports(text: str) -> tuple[dict[str, str], tuple[str, ...]]:
    imports: dict[str, str] = {}
    wildcard_imports: list[str] = []
    for match in re.finditer(r"^\s*import\s+([\w.]+)(\.\*)?\s*;", text, re.M):
        name = match.group(1)
        if match.group(2):
            wildcard_imports.append(name)
        else:
            imports[name.rsplit(".", 1)[-1]] = name
    return imports, tuple(wildcard_imports)


def clean_javadoc(lines: list[str]) -> str | None:
    cleaned: list[str] = []
    for line in lines:
        line = line.strip()
        line = re.sub(r"^/\*\*?", "", line)
        line = re.sub(r"\*/$", "", line)
        line = re.sub(r"^\*", "", line).strip()
        line = line.strip("*").strip()
        if not line or line.startswith("@"):
            continue
        cleaned.append(line)
    return " ".join(cleaned).strip() or None


def extract_field_description(raw_lines: list[str], index: int) -> str | None:
    block: list[str] = []
    cursor = index - 1
    while cursor >= 0:
        line = raw_lines[cursor].strip()
        if not line:
            cursor -= 1
            if block:
                continue
            break
        if line.startswith("@"):
            annotation_lines = [line]
            balance = line.count("(") - line.count(")")
            while balance > 0 and cursor + 1 < index:
                cursor += 1
                next_line = raw_lines[cursor].strip()
                annotation_lines.append(next_line)
                balance += next_line.count("(") - next_line.count(")")
            block[0:0] = [" ".join(annotation_lines)]
            cursor -= 1
            continue
        if line.endswith("*/"):
            comment_lines = [raw_lines[cursor]]
            if line.startswith("/**") or line.startswith("/*"):
                block[0:0] = comment_lines
                break
            cursor -= 1
            while cursor >= 0:
                comment_lines.insert(0, raw_lines[cursor])
                if raw_lines[cursor].strip().startswith("/**") or raw_lines[cursor].strip().startswith("/*"):
                    break
                cursor -= 1
            block[0:0] = comment_lines
            break
        break

    block_text = "\n".join(block)
    api_model = re.search(r"@ApiModelProperty\s*\((.*?)\)", block_text, re.S)
    if api_model:
        inner = api_model.group(1)
        for key in ("value", "notes", "name"):
            value_match = re.search(rf"{key}\s*=\s*\"([^\"]+)\"", inner)
            if value_match:
                return value_match.group(1)
        quoted = re.search(r'"([^"]+)"', inner)
        if quoted:
            return quoted.group(1)

    comment_lines = [line for line in block if line.strip().startswith(("/", "*"))]
    return clean_javadoc(comment_lines)


def parse_java_class(java_file: Path, project_dir: Path) -> JavaClass | None:
    raw_text = java_file.read_text(encoding="utf-8", errors="ignore")
    package_match = re.search(r"^\s*package\s+([\w.]+)\s*;", raw_text, re.M)
    package = package_match.group(1) if package_match else ""
    imports, wildcard_imports = parse_imports(raw_text)

    class_match = re.search(
        r"\b(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?(?:<[^>{}]+>)?))?",
        strip_comments(raw_text),
        re.S,
    )
    if not class_match:
        return None
    simple_name = class_match.group(1)
    qualified_name = f"{package}.{simple_name}" if package else simple_name
    extends_type = normalize_type_name(class_match.group(2)) if class_match.group(2) else None

    raw_lines = raw_text.splitlines()
    fields: list[JavaField] = []
    field_pattern = re.compile(
        r"^\s*(?:private|protected|public)\s+(?!static\b)(?!final\b)(?:transient\s+)?"
        r"(?P<type>[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\s*<[^;=]+>)?(?:\[\])?)\s+"
        r"(?P<name>[A-Za-z_$][\w$]*)\s*(?:=[^;]*)?;",
    )
    for idx, line in enumerate(raw_lines):
        match = field_pattern.search(line)
        if not match:
            continue
        field_type = normalize_type_name(match.group("type"))
        field_name = match.group("name")
        fields.append(
            JavaField(
                name=field_name,
                type_name=field_type,
                description=extract_field_description(raw_lines, idx),
            )
        )

    return JavaClass(
        simple_name=simple_name,
        qualified_name=qualified_name,
        package=package,
        imports=imports,
        wildcard_imports=wildcard_imports,
        extends_type=extends_type,
        fields=tuple(fields),
        source_path=str(java_file.relative_to(project_dir)),
    )


def scan_java_file(java_file: Path, project_dir: Path, context_path: str) -> list[ControllerApi]:
    raw_text = java_file.read_text(encoding="utf-8", errors="ignore")
    text = strip_comments(raw_text)
    lines = text.splitlines()
    apis: list[ControllerApi] = []

    class_index = -1
    class_name = java_path_to_class_name(java_file)
    for i, line in enumerate(lines):
        if re.search(r"\b(class|interface)\s+[A-Za-z_$][\w$]*", line):
            class_index = i
            class_match = re.search(r"\b(?:class|interface)\s+([A-Za-z_$][\w$]*)", line)
            if class_match:
                class_name = class_match.group(1)
            break
    if class_index < 0:
        return apis

    class_annotations = extract_annotation_block(lines, class_index)
    if "@RestController" not in class_annotations and "@Controller" not in class_annotations:
        return apis
    class_paths: list[str] = [""]
    class_req = re.search(r"@RequestMapping\s*\((.*?)\)", class_annotations, re.S)
    if class_req:
        class_paths = extract_paths(class_req.group(0))

    method_pattern = re.compile(
        r"\b(public|protected|private)\s+(?:static\s+)?(?:final\s+)?[\w.$<>\[\]?,\s]+\s+([A-Za-z_$][\w$]*)\s*\("
    )
    for i, line in enumerate(lines):
        if i <= class_index:
            continue
        if not method_pattern.search(line):
            continue
        annotations = extract_annotation_block(lines, i)
        mapping_annotations = re.findall(
            r"@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(?:\((.*?)\))?",
            annotations,
            re.S,
        )
        if not mapping_annotations:
            continue

        method_line = line
        cursor = i
        while ")" not in method_line and cursor + 1 < len(lines):
            cursor += 1
            method_line += " " + lines[cursor].strip()
        method_name, request_type, response_type = parse_method_signature(method_line)
        summary = extract_summary(annotations, method_name)

        for ann_name, _inner in mapping_annotations:
            ann_match = re.search(rf"@{ann_name}\s*(?:\((.*?)\))?", annotations, re.S)
            if not ann_match:
                continue
            ann_text = ann_match.group(0)
            methods = [MAPPING_METHODS[ann_name]] if ann_name in MAPPING_METHODS else extract_request_methods(ann_text)
            if ann_name == "RequestMapping" and not methods:
                methods = ["GET", "POST"]
            method_paths = extract_paths(ann_text)
            for class_path in class_paths:
                for method_path in method_paths:
                    combined = normalize_path("/".join([class_path.strip("/"), method_path.strip("/")]))
                    for http_method in methods:
                        apis.append(
                            ControllerApi(
                                method=http_method,
                                path=combined,
                                full_path=full_path(combined, context_path),
                                source_path=str(java_file.relative_to(project_dir)),
                                line_no=i + 1,
                                class_name=class_name,
                                method_name=method_name,
                                summary=summary,
                                request_type=request_type,
                                response_type=response_type,
                            )
                        )
    return apis


def scan_project(project_dir: Path, context_path: str) -> list[ControllerApi]:
    apis: list[ControllerApi] = []
    for java_file in iter_java_files(project_dir):
        apis.extend(scan_java_file(java_file, project_dir, context_path))
    unique: dict[tuple[str, str, str, int], ControllerApi] = {}
    for api in apis:
        unique[(api.method, api.path, api.source_path, api.line_no)] = api
    return sorted(unique.values(), key=lambda item: (item.path, item.method, item.source_path, item.line_no))


def match_specs(specs: list[PathSpec], apis: list[ControllerApi]) -> tuple[list[MatchResult], list[MatchResult], list[MatchResult]]:
    matched: list[MatchResult] = []
    unmatched: list[MatchResult] = []
    ambiguous: list[MatchResult] = []
    for spec in specs:
        candidates = [api for api in apis if api.path == spec.normalized_path]
        if spec.method:
            candidates = [api for api in candidates if api.method == spec.method]
        result = MatchResult(spec=spec, matches=tuple(candidates))
        if len(candidates) == 1:
            matched.append(result)
        elif len(candidates) == 0:
            unmatched.append(result)
        else:
            ambiguous.append(result)
    return matched, unmatched, ambiguous


def write_markdown_reports(out_dir: Path, matched: list[MatchResult], unmatched: list[MatchResult], ambiguous: list[MatchResult]) -> None:
    matched_lines = [
        "| Method | Path | Controller | Source | Summary |",
        "|---|---|---|---|---|",
    ]
    for result in matched:
        api = result.matches[0]
        matched_lines.append(
            f"| {api.method} | `{api.full_path}` | `{api.class_name}#{api.method_name}` | "
            f"`{api.source_path}:{api.line_no}` | {api.summary} |"
        )
    (out_dir / "matched-apis.md").write_text("\n".join(matched_lines) + "\n", encoding="utf-8")

    unmatched_lines = ["| Line | Method | Path | Raw |", "|---|---|---|---|"]
    for result in unmatched:
        spec = result.spec
        unmatched_lines.append(f"| {spec.line_no} | {spec.method or ''} | `{spec.path}` | `{spec.raw}` |")
    (out_dir / "unmatched-paths.md").write_text("\n".join(unmatched_lines) + "\n", encoding="utf-8")

    ambiguous_lines = ["| Line | Input | Candidates |", "|---|---|---|"]
    for result in ambiguous:
        candidates = "<br>".join(
            f"{api.method} `{api.full_path}` `{api.class_name}#{api.method_name}` `{api.source_path}:{api.line_no}`"
            for api in result.matches
        )
        ambiguous_lines.append(f"| {result.spec.line_no} | `{result.spec.raw}` | {candidates} |")
    (out_dir / "ambiguous-paths.md").write_text("\n".join(ambiguous_lines) + "\n", encoding="utf-8")


class JavaSchemaResolver:
    PRIMITIVE_SCHEMAS: dict[str, dict[str, str]] = {
        "String": {"type": "string"},
        "CharSequence": {"type": "string"},
        "UUID": {"type": "string"},
        "Integer": {"type": "integer", "format": "int32"},
        "int": {"type": "integer", "format": "int32"},
        "Short": {"type": "integer", "format": "int32"},
        "short": {"type": "integer", "format": "int32"},
        "Byte": {"type": "integer", "format": "int32"},
        "byte": {"type": "integer", "format": "int32"},
        "Long": {"type": "integer", "format": "int64"},
        "long": {"type": "integer", "format": "int64"},
        "BigInteger": {"type": "integer", "format": "int64"},
        "Float": {"type": "number", "format": "float"},
        "float": {"type": "number", "format": "float"},
        "Double": {"type": "number", "format": "double"},
        "double": {"type": "number", "format": "double"},
        "BigDecimal": {"type": "number"},
        "Boolean": {"type": "boolean"},
        "boolean": {"type": "boolean"},
        "LocalDate": {"type": "string", "format": "date"},
        "LocalDateTime": {"type": "string", "format": "date-time"},
        "Date": {"type": "string", "format": "date-time"},
        "Timestamp": {"type": "string", "format": "date-time"},
    }
    COLLECTION_TYPES = {"List", "ArrayList", "LinkedList", "Set", "HashSet", "Collection", "Iterable"}
    MAP_TYPES = {"Map", "HashMap", "LinkedHashMap"}

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.classes: dict[str, JavaClass] = {}
        self.by_simple: dict[str, list[JavaClass]] = {}
        for java_file in iter_java_files(project_dir):
            java_class = parse_java_class(java_file, project_dir)
            if not java_class:
                continue
            self.classes[java_class.qualified_name] = java_class
            self.by_simple.setdefault(java_class.simple_name, []).append(java_class)

    def class_for_source(self, source_path: str) -> JavaClass | None:
        for java_class in self.classes.values():
            if java_class.source_path == source_path:
                return java_class
        return None

    def resolve_class(self, type_ref: TypeRef, context_class: JavaClass | None) -> JavaClass | None:
        name = type_ref.name.rsplit(".", 1)[-1] if type_ref.name.startswith("java.") else type_ref.name
        if type_ref.name in self.classes:
            return self.classes[type_ref.name]
        if "." in type_ref.name and type_ref.name not in self.PRIMITIVE_SCHEMAS:
            return self.classes.get(type_ref.name)
        if context_class:
            imported = context_class.imports.get(name)
            if imported and imported in self.classes:
                return self.classes[imported]
            same_package = f"{context_class.package}.{name}" if context_class.package else name
            if same_package in self.classes:
                return self.classes[same_package]
            for package in context_class.wildcard_imports:
                candidate = f"{package}.{name}"
                if candidate in self.classes:
                    return self.classes[candidate]
        candidates = self.by_simple.get(name, [])
        if len(candidates) == 1:
            return candidates[0]
        return None

    def schema_for_type_name(self, type_name: str | None, context_class: JavaClass | None = None) -> dict:
        if not type_name:
            return {"type": "object"}
        return self.schema_for_type(parse_type_ref(type_name), context_class, set(), 0)

    def schema_for_type(
        self,
        type_ref: TypeRef,
        context_class: JavaClass | None,
        seen: set[str],
        depth: int,
    ) -> dict:
        if type_ref.array:
            item_ref = TypeRef(name=type_ref.name, args=type_ref.args)
            return {"type": "array", "items": self.schema_for_type(item_ref, context_class, seen, depth)}

        simple_name = type_ref.name.rsplit(".", 1)[-1]
        primitive = self.PRIMITIVE_SCHEMAS.get(simple_name)
        if primitive:
            return dict(primitive)
        if simple_name in {"Object", "Serializable"}:
            return {"type": "object"}
        if simple_name in self.COLLECTION_TYPES:
            item_ref = type_ref.args[0] if type_ref.args else TypeRef("Object")
            return {"type": "array", "items": self.schema_for_type(item_ref, context_class, seen, depth)}
        if simple_name in self.MAP_TYPES:
            value_ref = type_ref.args[1] if len(type_ref.args) >= 2 else TypeRef("Object")
            return {
                "type": "object",
                "additionalProperties": self.schema_for_type(value_ref, context_class, seen, depth),
            }
        if simple_name == "CommonResult":
            data_ref = type_ref.args[0] if type_ref.args else TypeRef("Object")
            return {
                "type": "object",
                "properties": {
                    "code": {"type": "integer", "format": "int32", "description": "状态码"},
                    "message": {"type": "string", "description": "响应消息"},
                    "data": self.schema_for_type(data_ref, context_class, seen, depth),
                },
            }
        if simple_name == "PageInfo":
            item_ref = type_ref.args[0] if type_ref.args else TypeRef("Object")
            return {
                "type": "object",
                "properties": {
                    "total": {"type": "integer", "format": "int64", "description": "总数"},
                    "list": {
                        "type": "array",
                        "description": "分页数据",
                        "items": self.schema_for_type(item_ref, context_class, seen, depth),
                    },
                    "pageNum": {"type": "integer", "format": "int32", "description": "当前页"},
                    "pageSize": {"type": "integer", "format": "int32", "description": "每页条数"},
                    "size": {"type": "integer", "format": "int32"},
                    "pages": {"type": "integer", "format": "int32", "description": "总页数"},
                    "hasPreviousPage": {"type": "boolean"},
                    "hasNextPage": {"type": "boolean"},
                    "isFirstPage": {"type": "boolean"},
                    "isLastPage": {"type": "boolean"},
                },
            }

        java_class = self.resolve_class(type_ref, context_class)
        if not java_class:
            return {"type": "object", "x-java-type": type_ref.name}
        if java_class.qualified_name in seen or depth > 6:
            return {"type": "object", "x-java-type": java_class.qualified_name}

        next_seen = set(seen)
        next_seen.add(java_class.qualified_name)
        properties: dict[str, dict] = {}

        if java_class.extends_type:
            parent = self.resolve_class(parse_type_ref(java_class.extends_type), java_class)
            if parent:
                parent_schema = self.schema_for_type(parse_type_ref(java_class.extends_type), java_class, next_seen, depth + 1)
                properties.update(parent_schema.get("properties", {}))

        for field in java_class.fields:
            field_schema = self.schema_for_type(parse_type_ref(field.type_name), java_class, next_seen, depth + 1)
            if field.description and "description" not in field_schema:
                field_schema = dict(field_schema)
                field_schema["description"] = field.description
            properties[field.name] = field_schema

        return {
            "type": "object",
            "description": java_class.simple_name,
            "properties": properties,
            "x-java-type": java_class.qualified_name,
        }


def build_openapi(
    matched: list[MatchResult],
    title: str,
    context_path: str,
    path_mode: str,
    schema_resolver: JavaSchemaResolver,
) -> dict:
    paths: dict[str, dict] = {}
    for result in matched:
        api = result.matches[0]
        openapi_path = api.full_path if path_mode == "full" else api.path
        path_item = paths.setdefault(openapi_path, {})
        context_class = schema_resolver.class_for_source(api.source_path)
        response_schema = schema_resolver.schema_for_type_name(api.response_type, context_class)
        operation: dict = {
            "summary": api.summary,
            "operationId": f"{api.class_name}_{api.method_name}",
            "x-controller": f"{api.class_name}#{api.method_name}",
            "x-source": f"{api.source_path}:{api.line_no}",
            "x-request-type": api.request_type,
            "x-response-type": api.response_type,
            "responses": {
                "200": {
                    "description": "OK",
                    "content": {
                        "application/json": {
                            "schema": response_schema,
                        }
                    },
                }
            },
        }
        if api.request_type:
            operation["requestBody"] = {
                "required": False,
                "content": {
                    "application/json": {
                        "schema": schema_resolver.schema_for_type_name(api.request_type, context_class),
                    }
                },
            }
        path_item[api.method.lower()] = operation
    return {
        "openapi": "3.0.3",
        "info": {"title": title, "version": "1.0.0"},
        "servers": [{"url": "/" if path_mode == "full" else context_path or "/"}],
        "paths": paths,
    }


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upload_openapi(
    openapi: dict,
    args: argparse.Namespace,
    out_dir: Path,
) -> dict:
    token = os.environ.get(args.token_env)
    if not token:
        raise SystemExit(f"Missing Apifox token. Set environment variable {args.token_env}.")
    if not args.apifox_project_id:
        raise SystemExit("--apifox-project-id is required when --upload is used.")

    options: dict[str, object] = {
        "endpointOverwriteBehavior": args.endpoint_overwrite_behavior,
        "schemaOverwriteBehavior": args.schema_overwrite_behavior,
        "updateFolderOfChangedEndpoint": args.update_folder_of_changed_endpoint,
        "prependBasePath": args.prepend_base_path,
        "deleteUnmatchedResources": args.delete_unmatched_resources,
    }
    if args.target_endpoint_folder_id is not None:
        options["targetEndpointFolderId"] = args.target_endpoint_folder_id
    if args.target_schema_folder_id is not None:
        options["targetSchemaFolderId"] = args.target_schema_folder_id
    if args.target_branch_id is not None:
        options["targetBranchId"] = args.target_branch_id
    if args.module_id is not None:
        options["moduleId"] = args.module_id

    payload = {
        "input": json.dumps(openapi, ensure_ascii=False),
        "options": options,
    }
    write_json(out_dir / "upload-payload.json", payload)

    server = args.apifox_server.rstrip("/")
    url = f"{server}/v1/projects/{args.apifox_project_id}/import-openapi?locale=zh-CN"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "X-Apifox-Api-Version": "2024-03-28",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            response_text = response.read().decode("utf-8", errors="replace")
            status = response.status
    except urllib.error.HTTPError as exc:
        response_text = exc.read().decode("utf-8", errors="replace")
        result = {
            "ok": False,
            "status": exc.code,
            "reason": exc.reason,
            "responseText": response_text,
        }
        write_json(out_dir / "upload-result.json", result)
        return result
    except urllib.error.URLError as exc:
        result = {
            "ok": False,
            "error": str(exc.reason),
        }
        write_json(out_dir / "upload-result.json", result)
        return result

    try:
        parsed: object = json.loads(response_text) if response_text else {}
    except json.JSONDecodeError:
        parsed = {"responseText": response_text}
    result = {
        "ok": 200 <= status < 300,
        "status": status,
        "response": parsed,
    }
    write_json(out_dir / "upload-result.json", result)
    return result


def extract_endpoint_id(operation: dict) -> str | None:
    for key in ("x-apifox-id", "x-apifox-endpoint-id", "x-apifox-api-id"):
        value = operation.get(key)
        if value:
            return str(value)
    run_link = operation.get("x-run-in-apifox")
    if isinstance(run_link, str):
        match = re.search(r"/api-(\d+)(?:-|$)", run_link)
        if match:
            return match.group(1)
    return None


def export_openapi_from_apifox(args: argparse.Namespace) -> dict:
    token = os.environ.get(args.token_env)
    if not token:
        raise SystemExit(f"Missing Apifox token. Set environment variable {args.token_env}.")
    if not args.apifox_project_id:
        raise SystemExit("--apifox-project-id is required when fetching Apifox links.")

    body: dict[str, object] = {
        "scope": {"type": "ALL"},
        "options": {
            "includeApifoxExtensionProperties": True,
            "addFoldersToTags": False,
        },
        "oasVersion": "3.0",
        "exportFormat": "JSON",
    }
    if args.target_branch_id is not None:
        body["branchId"] = args.target_branch_id
    if args.module_id is not None:
        body["moduleId"] = args.module_id

    server = args.apifox_server.rstrip("/")
    url = f"{server}/v1/projects/{args.apifox_project_id}/export-openapi?locale=zh-CN"
    request = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "X-Apifox-Api-Version": "2024-03-28",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=args.timeout) as response:
        response_text = response.read().decode("utf-8", errors="replace")
    return json.loads(response_text) if response_text else {}


def write_apifox_link_reports(out_dir: Path, rows: list[dict]) -> None:
    write_json(out_dir / "apifox-links.json", rows)
    lines = [
        "| Method | Path | Endpoint ID | Apifox Link | Run Link | Source |",
        "|---|---|---|---|---|---|",
    ]
    for row in rows:
        link = f"[打开]({row['link']})" if row.get("link") else ""
        run_link = f"[运行]({row['runLink']})" if row.get("runLink") else ""
        endpoint_id = row.get("endpointId") or ""
        source = row.get("source") or ""
        lines.append(
            f"| {row['method']} | `{row['path']}` | `{endpoint_id}` | {link} | {run_link} | `{source}` |"
        )
    (out_dir / "apifox-links.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def fetch_apifox_links(matched: list[MatchResult], args: argparse.Namespace, out_dir: Path) -> dict:
    last_error: str | None = None
    exported: dict = {}
    for attempt in range(args.link_lookup_retries):
        try:
            exported = export_openapi_from_apifox(args)
            last_error = None
            break
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            if attempt + 1 < args.link_lookup_retries:
                time.sleep(args.link_lookup_delay)

    if last_error:
        result = {"ok": False, "error": last_error, "linksFile": str(out_dir / "apifox-links.json")}
        write_json(out_dir / "apifox-links.json", [])
        write_apifox_link_reports(out_dir, [])
        return result

    rows: list[dict] = []
    paths = exported.get("paths", {}) if isinstance(exported, dict) else {}
    for result in matched:
        api = result.matches[0]
        candidate_paths = [api.full_path if args.apifox_path_mode == "full" else api.path, api.full_path, api.path]
        operation: dict | None = None
        resolved_path = candidate_paths[0]
        for candidate_path in dict.fromkeys(candidate_paths):
            path_item = paths.get(candidate_path, {})
            if isinstance(path_item, dict) and isinstance(path_item.get(api.method.lower()), dict):
                operation = path_item[api.method.lower()]
                resolved_path = candidate_path
                break

        endpoint_id = extract_endpoint_id(operation) if operation else None
        run_link = operation.get("x-run-in-apifox") if operation else None
        link = args.link_template.format(projectId=args.apifox_project_id, endpointId=endpoint_id) if endpoint_id else None
        rows.append(
            {
                "method": api.method,
                "path": resolved_path,
                "inputPath": result.spec.path,
                "summary": api.summary,
                "controller": f"{api.class_name}#{api.method_name}",
                "source": f"{api.source_path}:{api.line_no}",
                "endpointId": endpoint_id,
                "link": link,
                "runLink": run_link,
                "found": bool(endpoint_id),
            }
        )

    write_apifox_link_reports(out_dir, rows)
    found = sum(1 for row in rows if row.get("found"))
    return {
        "ok": found == len(rows),
        "found": found,
        "missing": len(rows) - found,
        "linksFile": str(out_dir / "apifox-links.json"),
        "linksMarkdown": str(out_dir / "apifox-links.md"),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scan Java controllers and generate Apifox/OpenAPI dry-run reports.")
    parser.add_argument("--project-dir", required=True, help="Backend project root directory.")
    parser.add_argument("--paths", required=True, help="API path list file.")
    parser.add_argument("--context-path", default="", help="Service context path, e.g. /pms-service.")
    parser.add_argument(
        "--apifox-path-mode",
        choices=("full", "relative"),
        default="full",
        help="Use full paths with context path for Apifox import, or relative paths with server base path.",
    )
    parser.add_argument("--out", default=".apifox-upload", help="Output directory.")
    parser.add_argument("--title", default="Generated API", help="OpenAPI title.")
    parser.add_argument("--dry-run", action="store_true", help="Generate reports only. This is the default behavior.")
    parser.add_argument("--upload", action="store_true", help="Upload generated OpenAPI to Apifox.")
    parser.add_argument("--apifox-server", default="https://api.apifox.com", help="Apifox OpenAPI server.")
    parser.add_argument("--apifox-project-id", help="Apifox project ID.")
    parser.add_argument("--target-endpoint-folder-id", type=int, help="Target endpoint folder ID. Use 0 for root.")
    parser.add_argument("--target-schema-folder-id", type=int, help="Target schema folder ID. Use 0 for root.")
    parser.add_argument("--target-branch-id", type=int, help="Target branch ID.")
    parser.add_argument("--module-id", type=int, help="Target module ID.")
    parser.add_argument(
        "--endpoint-overwrite-behavior",
        choices=sorted(OVERWRITE_BEHAVIORS),
        default="OVERWRITE_EXISTING",
        help="Endpoint overwrite behavior.",
    )
    parser.add_argument(
        "--schema-overwrite-behavior",
        choices=sorted(OVERWRITE_BEHAVIORS),
        default="OVERWRITE_EXISTING",
        help="Schema overwrite behavior.",
    )
    parser.add_argument("--update-folder-of-changed-endpoint", action="store_true", help="Update folder when endpoint exists.")
    parser.add_argument("--prepend-base-path", action="store_true", help="Ask Apifox to prepend base path to endpoint path.")
    parser.add_argument("--delete-unmatched-resources", action="store_true", help="Delete resources absent from the import source.")
    parser.add_argument("--fetch-links", action="store_true", help="Fetch Apifox endpoint links without uploading.")
    parser.add_argument("--skip-fetch-links", action="store_true", help="Do not fetch Apifox links after upload.")
    parser.add_argument(
        "--link-template",
        default="https://app.apifox.com/link/project/{projectId}/apis/api-{endpointId}",
        help="Endpoint link template. Available placeholders: {projectId}, {endpointId}.",
    )
    parser.add_argument("--link-lookup-retries", type=int, default=3, help="Retry count for exporting Apifox links.")
    parser.add_argument("--link-lookup-delay", type=float, default=1.0, help="Seconds between Apifox link lookup retries.")
    parser.add_argument("--token-env", default="APIFOX_TOKEN", help="Environment variable containing Apifox token.")
    parser.add_argument("--timeout", type=int, default=60, help="Upload HTTP timeout in seconds.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    project_dir = Path(args.project_dir).expanduser().resolve()
    path_file = Path(args.paths).expanduser().resolve()
    out_dir = Path(args.out).expanduser().resolve()

    if not project_dir.is_dir():
        raise SystemExit(f"Project directory does not exist: {project_dir}")
    if not path_file.is_file():
        raise SystemExit(f"Path list file does not exist: {path_file}")

    out_dir.mkdir(parents=True, exist_ok=True)
    specs = load_path_specs(path_file, args.context_path)
    apis = scan_project(project_dir, args.context_path)
    matched, unmatched, ambiguous = match_specs(specs, apis)
    schema_resolver = JavaSchemaResolver(project_dir)

    write_markdown_reports(out_dir, matched, unmatched, ambiguous)
    openapi = build_openapi(matched, args.title, args.context_path, args.apifox_path_mode, schema_resolver)
    write_json(out_dir / "openapi.generated.json", openapi)
    upload_result = None
    link_result = None
    if args.upload:
        if not matched:
            raise SystemExit("No matched API to upload.")
        upload_result = upload_openapi(openapi, args, out_dir)
    should_fetch_links = args.fetch_links or (args.upload and not args.skip_fetch_links)
    if should_fetch_links:
        if upload_result is None or upload_result.get("ok"):
            link_result = fetch_apifox_links(matched, args, out_dir)
    summary = {
        "projectDir": str(project_dir),
        "pathFile": str(path_file),
        "contextPath": args.context_path,
        "apifoxPathMode": args.apifox_path_mode,
        "scannedApis": len(apis),
        "scannedJavaClasses": len(schema_resolver.classes),
        "inputPaths": len(specs),
        "matched": len(matched),
        "unmatched": len(unmatched),
        "ambiguous": len(ambiguous),
        "outputDir": str(out_dir),
    }
    if upload_result is not None:
        summary["upload"] = {
            "ok": upload_result.get("ok"),
            "status": upload_result.get("status"),
            "resultFile": str(out_dir / "upload-result.json"),
        }
    if link_result is not None:
        summary["links"] = link_result
    write_json(out_dir / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
