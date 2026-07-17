---
name: payment-compliance-review
description: 审查代码库是否符合支付平台审核政策，适用于 Dodo Payments、Creem、Stripe、Paddle、Lemon Squeezy 等支付或 MoR 平台；识别审核阻断项、平台接入差距、政策缺口、定价/订阅/退款风险、法务页面问题和 AI 内容审核要求，并输出可执行整改建议。
---

# 支付平台审核合规检查

## 目标

基于目标支付平台的最新官方审核政策和当前项目真实实现，判断项目是否具备提交审核条件，识别会导致审核失败、要求整改或触发风控复审的合规缺口，并输出可执行的整改优先级和验证清单。

## 适用场景

当用户提出以下需求时使用：

- 检查项目是否能通过 Dodo Payments / Creem / Stripe / Paddle / Lemon Squeezy 等支付平台审核。
- 分析支付平台拒审原因或 re-review 前的整改项。
- 审查 SaaS、MoR 数字产品、订阅产品、积分包、AI 图片/视频生成产品的支付合规风险。
- 输出支付平台审核阻断项、高风险项、整改清单或验证清单。

## 输入

尽量从用户描述、当前工作目录和项目代码中自动推断输入；缺少关键信息时再提问。

必需输入：

- `target_platform`：目标支付平台，例如 Dodo Payments、Creem、Stripe、Paddle、Lemon Squeezy。
- `project_path`：待审查项目路径；默认使用当前工作目录。

建议输入：

- `product_type`：产品类型，例如 SaaS、AI 视频生成、AI 图片生成、数字下载、API 服务、模板/素材等。
- `billing_model`：收费模式，例如订阅、一次性购买、积分包、混合模式、免费试用。
- `review_goal`：只输出审核报告，还是后续根据确认执行整改。
- `review_status`：尚未提交、已拒审、等待 re-review。
- `rejection_reason`：如果已有拒审邮件或平台反馈，优先作为审查线索。
- `target_region`：目标销售地区或主要用户地区；没有提供时不做地区法律细分。

## 输出

最终输出必须是结构化审核报告，至少包含：

- `结论`：当前通过概率、最大阻断点、是否建议立即提交审核。
- `平台政策依据`：列出本次引用的官方政策来源。
- `支付平台接入现状`：目标平台、当前代码实际 provider、checkout/webhook/portal/refund/invoice/subscription lifecycle 差距。
- `审核阻断项`：会直接导致审核失败或违反硬性要求的问题。
- `高风险项`：可能导致 changes requested、争议、拒付或风控复审的问题。
- `建议优化项`：提高通过率或运营稳定性的改进。
- `整改优先级`：P0 / P1 / P2。
- `验证清单`：提交审核前如何证明问题已修复。
- `无法确认项`：因为缺少环境、线上访问、后台配置或网络权限而无法验证的内容。

每条问题建议使用以下字段：

- `政策要求`：平台要求是什么。
- `项目证据`：文件路径、行号、页面路径、配置或无法定位说明。
- `风险判断`：为什么会影响审核。
- `整改建议`：具体改什么。
- `验证方式`：如何确认整改有效。

## 约束

- 默认只审查，不修改代码。
- 修改代码前必须先向用户列出计划并获得确认。
- 必须优先核对目标平台官方最新政策；支付平台政策不稳定，不能只靠记忆。
- 优先使用官方文档、政策页、平台后台说明、拒审邮件。第三方博客只能作为辅助线索。
- 结论必须区分“已从代码确认的事实”和“基于政策/实现的推断”。
- 每个具体问题必须尽量提供文件行号；无法定位时说明原因。
- 不把未使用组件、历史代码、文档示例当成线上已具备能力。
- 不泄露或写入真实 API key、token、密码等敏感信息。
- 涉及支付、退款、订阅、数据库写操作、发布、推送等敏感改动时必须二次确认。

## 执行流程

### 1. 复述与确认

简要复述用户目标，确认目标平台和项目路径。对于明确低歧义请求，可直接继续；如果目标平台或项目路径不明确，先提问。

### 2. 获取最新政策

联网查找目标平台官方政策，重点包括：

- Account / merchant review。
- Prohibited / restricted products。
- Pricing、refund、subscription、cancellation。
- Customer support 和 receipt 要求。
- Terms、Privacy、AUP 等法务页面要求。
- AI、UGC、生成式内容、moderation 等专项要求。

优先查找以下官方入口：

- 官网 legal / policy / terms / privacy / acceptable use 页面。
- 官方 docs 站、developer docs、merchant onboarding 文档。
- `llms.txt`、`llms-full.txt`、`.md` 机器可读页面。
- Merchant Acceptance、Review & Monitoring、Account Verification、Refunds、Disputes、Customer Portal、Subscriptions 等页面。

平台参考文件读取规则：

- 如果目标平台是 Creem，在查官方文档后读取 `references/creem.md`。
- 如果目标平台是 Dodo Payments，在查官方文档后读取 `references/dodo.md`。
- 如果目标平台没有本地 reference，只基于官方最新政策审查，并在报告中标记“暂无本地平台参考”。

### 3. 识别项目真实业务路径

优先使用 `rg` 搜索，再读取代码。必须确认哪些页面/组件/API 是生产真实路径，哪些只是未使用残留。

重点搜索：

```bash
rg -n "creem|stripe|paddle|checkout|subscription|billing|portal|cancel|refund|webhook|productId|price|pricing"
rg -n "dodo|dodopayments|merchant of record|MoR|customer portal|invoice|dispute"
rg -n "terms|privacy|acceptable|AUP|policy|support@|refund|non-refundable|cancel anytime"
rg -n "moderation|NSFW|deepfake|impersonat|face[- ]?swap|uncensored|no filter|18\\+|adult|scraping|privacy|prompt"
rg -n "Sora|Veo|Gemini|OpenAI|Google|ByteDance|Seedance|Wan|model|provider"
```

准备报告证据时，用 `nl -ba` 获取行号。

### 4. 按检查维度审查

至少覆盖以下维度：

- 产品可访问性：是否上线、是否能看懂卖什么、是否有真实产品入口。
- 平台接入一致性：目标平台与当前实际支付 provider、SDK、API、webhook、Customer Portal、refund、invoice、订阅生命周期是否一致。
- 定价与结算：价格、币种、计费周期、额度、续费、税费/支付方披露。
- 订阅管理：取消订阅、管理订阅、Customer Portal、续费停止时点。
- 退款与争议：退款规则、失败任务返还、支持处理时限、口径一致性。
- 法务页面：Terms、Privacy、AUP、footer 链接、内容完整性。
- 客服支持：支持邮箱是否可见、品牌一致、dashboard 是否可达。
- 禁止/受限业务：是否命中平台 prohibited 或 restricted 类目。
- AI/UGC 风险：prompt moderation、上传图片/文件审核、NSFW/deepfake/impersonation/scraping/IP 侵权/隐私侵犯禁止、fail closed、审核日志、第三方模型披露。
- 营销真实性：是否有假评论、夸大用户数、未实现承诺、无限制宣传。
- 技术集成：SDK、webhook、test/live mode、Product ID、幂等、错误处理。

### 5. 分级与归因

按以下标准分级：

- `审核阻断项`：明确违反官方硬性要求，或几乎必然导致审核失败。
- `高风险项`：可能导致平台要求整改、人工复审、退款/拒付风险或用户投诉。
- `建议优化项`：不一定导致拒审，但能提高审核通过率和运营稳定性。

### 6. 输出报告

报告要先结论后证据，避免只给清单不判断。每条发现应尽量有文件链接和行号。

## 报告模板

```markdown
结论：当前项目 [大概率可过/需整改后提交/大概率不过]。最大阻断点是 ...

平台政策依据
- 官方来源 1：...
- 官方来源 2：...

支付平台接入现状
- 目标平台：...
- 当前实现：...
- 接入差距：...

审核阻断项
1. 标题
   - 政策要求：...
   - 项目证据：[file](path:line) ...
   - 风险判断：...
   - 整改建议：...
   - 验证方式：...

高风险项
1. ...

建议优化项
1. ...

整改优先级
- P0：...
- P1：...
- P2：...

验证清单
- [ ] ...

无法确认项
- ...
```

## Creem 专项说明

Creem 审核时，AI 图片/视频生成产品默认按高风险处理。除基础支付审核外，还要重点检查：

- 是否接入 Creem Moderation API，并在每个用户 prompt 生成前调用。
- `deny`、`flag`、moderation 异常是否阻断生成。
- 是否有公开 AUP。
- Terms 是否明确禁止 NSFW、deepfake、face manipulation 等。
- 用户是否能从产品内进入 Creem Customer Portal 或取消订阅。
- 支持邮箱是否公开、可达、品牌一致。
- 产品品牌是否独立于 OpenAI、Google、Veo、Sora 等模型品牌。

详细检查点见 `references/creem.md`。

## 失败与降级处理

- 如果无法联网：说明政策未核对最新版本，只输出临时风险分析。
- 如果无法运行项目：基于静态代码审查，标记需要线上验证的项。
- 如果无法访问支付后台：把 Product ID、receipt、Business Details、webhook 配置列入无法确认项。
- 如果用户只提供拒审原因：优先围绕拒审原因定位，再补充完整审核清单。
