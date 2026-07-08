---
name: apifox-batch-uploader
description: 根据后端接口路径清单批量扫描 Java Spring Controller，生成 Apifox/OpenAPI dry-run 报告；用户要求“批量上传 Apifox”“根据接口路径上传接口”“生成 Apifox 链接”时使用。默认只 dry-run，线上上传必须在用户明确确认后才允许执行。
allowed-tools: [Bash, Read, Write]
---

# apifox-batch-uploader

根据接口路径清单扫描后端 Java Spring Controller，生成匹配报告和 OpenAPI 文件；在用户明确确认后，可调用 Apifox OpenAPI 导入接口做批量上传。

## 什么时候用

在这些场景使用：
- 用户提供一批后端接口路径，希望批量整理/上传到 Apifox
- 用户希望根据后端路径清单自动找到 Controller 方法
- 用户希望生成 Apifox 上传前的匹配报告或 OpenAPI 文件
- 用户提到“批量上传 Apifox”“接口路径上传 Apifox”“生成 Apifox 链接”

不要在这些场景使用：
- 用户只是想从 Apifox 导入前端 TypeScript 接口定义（使用 `xm-import-api`）
- 用户只是查询接口最近请求日志（使用 `api-latest-log`）

## 安全规则

- 默认必须 dry-run，不得上传 Apifox。
- 没有用户明确说“执行上传”“确认上传”“上传到 Apifox”，不得调用任何写入 Apifox 的接口。
- 不得输出 Apifox token。
- 不得把 token 写入文件。
- 上传前必须先 dry-run，确认 `matched`、`unmatched`、`ambiguous` 数量。
- 上传前必须向用户说明目标项目 ID、目标目录 ID、覆盖策略、即将上传接口数量。
- 上传成功后默认会通过 Apifox 导出接口反查 endpointId 并生成链接报告；这是只读请求。

## 标准调用

### 1) dry-run 生成报告

```bash
bash ~/.claude/skills/apifox-batch-uploader/run.sh \
  --project-dir /path/to/backend-project \
  --paths /path/to/api-paths.txt \
  --context-path /pms-service \
  --dry-run
```

### 2) 上传到 Apifox

用户明确确认后才允许执行。Token 只允许通过环境变量传入：

```bash
APIFOX_TOKEN="***" bash ~/.claude/skills/apifox-batch-uploader/run.sh \
  --project-dir /path/to/backend-project \
  --paths /path/to/api-paths.txt \
  --context-path /pms-service \
  --apifox-path-mode full \
  --apifox-project-id 1164725 \
  --target-endpoint-folder-id 0 \
  --target-schema-folder-id 0 \
  --endpoint-overwrite-behavior OVERWRITE_EXISTING \
  --schema-overwrite-behavior OVERWRITE_EXISTING \
  --upload
```

上传后默认生成 `apifox-links.md` 和 `apifox-links.json`。如需跳过链接反查，追加：

```bash
--skip-fetch-links
```

只反查已有接口链接，不上传：

```bash
APIFOX_TOKEN="***" bash ~/.claude/skills/apifox-batch-uploader/run.sh \
  --project-dir /path/to/backend-project \
  --paths /path/to/api-paths.txt \
  --context-path /pms-service \
  --apifox-project-id 1164725 \
  --fetch-links
```

在本仓库开发态可把 `~/.claude/skills/apifox-batch-uploader/run.sh` 替换为：

```bash
bash claude/skills/backend/apifox-batch-uploader/run.sh ...
```

## 输入格式

接口路径清单每行一个接口：

```text
POST /pms-service/supplier/update-name
POST /supplier/selectSupplierName/page
GET /pms-service/foo/detail
```

规则：
- 空行会忽略。
- `#` 开头的注释行会忽略。
- method 可省略；省略时只按 path 匹配，若匹配到多个 method 会标记为 ambiguous。
- path 可带 context-path，也可不带；脚本会根据 `--context-path` 归一化。
- 上传到 Apifox 时默认使用 `--apifox-path-mode full`，OpenAPI `paths` 会包含完整 context-path，例如 `/pms-service/supplier/update-name`。
- 如需保留旧行为，可使用 `--apifox-path-mode relative`：OpenAPI `servers.url` 使用 `--context-path`，`paths` 使用去掉 context-path 的相对路径。

## 输出文件

默认输出目录：`<当前目录>/.apifox-upload`

```text
matched-apis.md
unmatched-paths.md
ambiguous-paths.md
openapi.generated.json
upload-payload.json       # 仅 --upload 时生成，不含 token
upload-result.json        # 仅 --upload 时生成
apifox-links.md           # --upload 默认生成，或 --fetch-links 时生成
apifox-links.json         # --upload 默认生成，或 --fetch-links 时生成
summary.json
```

## 输出理解

- `matched`：路径和 method 唯一匹配到 Controller 方法。
- `unmatched`：路径没有匹配到任何 Controller 方法。
- `ambiguous`：路径匹配到多个 Controller 方法，需补 method 或人工判断。
- `openapi.generated.json`：只包含 matched 接口的最小 OpenAPI 文档；默认 path 已带 context-path。

## 当前能力边界

- 支持 Java Spring MVC 常见注解：`@RestController`、`@Controller`、`@RequestMapping`、`@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping`、`@PatchMapping`。
- 支持 `@RequestMapping(method = RequestMethod.POST)`。
- 支持静态解析 `@RequestBody` 请求 DTO 和 Controller 返回类型。
- 支持解析 Java 私有字段、父类字段、`List<T>`、`Map<K,V>`、基础类型、日期类型、BigDecimal。
- 支持用 Javadoc 和 `@ApiModelProperty(value = "...")` 填充字段描述。
- 内置展开常见响应包装：`CommonResult<T>`、`PageInfo<T>`。
- 上传后默认调用 Apifox `export-openapi` 只读接口，按 method + path 反查 `endpointId`，生成 Apifox 链接。
- 当前不解析方法体里的动态响应结构，也不解析复杂 Jackson 注解和 Bean Validation 约束。
