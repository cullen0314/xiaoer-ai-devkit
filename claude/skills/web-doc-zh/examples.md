# 使用示例

本文档提供 web-doc-zh Skill 的常见使用示例。

## 示例 1：先预览文档

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --preview "https://react.dev/reference/react/useEffect"
```

预期：
- 输出页面标题
- 输出来源 URL
- 输出建议文件名
- 输出正文节选
- 不写文件

## 示例 2：生成中文版本

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate "https://react.dev/reference/react/useEffect"
```

预期：
- 输出完整英文 Markdown 源稿
- 输出 `OUTPUT_PATH` 等字段
- Claude 根据规则翻译并写入 `OUTPUT_PATH`
- 默认生成基于页面标题或 URL 生成的 `.zh-CN.md` 文件

## 示例 3：生成双语版本

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate --bilingual "https://react.dev/reference/react/useEffect"
```

预期：
- 生成双语 Markdown
- 默认命名为 `<slug>.bilingual.zh-CN.md`

## 示例 4：指定输出路径

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate --output "docs/react-use-effect.zh-CN.md" "https://react.dev/reference/react/useEffect"
```

## 示例 5：只获取英文源稿

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --generate --source-only "https://react.dev/reference/react/useEffect"
```

用途：
- 调试正文抽取效果
- 手动检查 Markdown 结构
- 暂不生成中文版本

## 示例 6：动态页面或登录页失败

```bash
bash ~/.claude/skills/web-doc-zh/run.sh --preview "https://example.com/private-doc"
```

可能结果：
- 提示页面不可访问
- 提示正文抽取失败
- 提示该页面可能依赖登录态或动态渲染
