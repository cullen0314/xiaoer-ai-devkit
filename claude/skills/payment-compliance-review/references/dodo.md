# Dodo Payments 审核合规参考

本文件是 Dodo Payments 专项检查清单。使用前必须先核对 Dodo Payments 官方最新文档；如官方政策变化，以官方为准。

官方文档入口：

- Documentation Index: `https://docs.dodopayments.com/llms.txt`
- Merchant Acceptance Policy: `https://docs.dodopayments.com/miscellaneous/merchant-acceptance`
- Review & Monitoring Policy: `https://docs.dodopayments.com/miscellaneous/review-monitoring-policy`
- Account Verification: `https://docs.dodopayments.com/miscellaneous/verification-process`
- Refunds: `https://docs.dodopayments.com/features/transactions/refunds`
- Disputes: `https://docs.dodopayments.com/features/transactions/disputes`
- Subscriptions: `https://docs.dodopayments.com/features/subscription`
- Customer Portal: `https://docs.dodopayments.com/features/customer-portal`
- Create Customer Portal Session API: `https://docs.dodopayments.com/api-reference/customers/create-customer-portal-session`
- Merchant Acceptance Countries: `https://docs.dodopayments.com/miscellaneous/accepted-countries-and-territories`
- Payment Acceptance Countries: `https://docs.dodopayments.com/miscellaneous/list-of-countries-we-accept-payments-from`

## 1. Merchant Acceptance 基础审核

### 审核项

Dodo Payments 作为 Merchant of Record，会检查产品是否为可交付的数字产品，是否真实、有明确价值、符合法律和支付合作方限制。

### 代码/产品检查点

- 官网是否公开可访问，审核人员无需白名单或密码即可理解产品。
- 首页、工具页、Pricing 是否清楚说明卖什么、价格、周期、权益、限制。
- 产品是否为自动化数字交付，而不是人工服务、线下服务、实物、电商、市场撮合或转售。
- 是否存在高退款/拒付风险的夸大承诺、虚假紧迫感、低价值内容或 coming soon 占位产品。
- 是否存在假评论、假用户数、无法证明的客户 logo、收入或生成量宣传。

### 常见不符合

- 产品只是模板页或预发布页面，付款后没有即时可用价值。
- 定价页可见，但权益、积分有效期、续费和取消规则不清楚。
- 业务实质是人工定制、咨询、代运营、市场撮合或第三方转售。
- 营销文案承诺“无限制”“无过滤”“保证收益”“100% 成功”等无法验证结果。

### 整改建议

- 确保无需登录即可访问首页、Pricing、Terms、Privacy、Refund Policy、AUP、Support。
- 删除无法证明的营销数字和评论。
- 把产品描述写成具体可交付能力，不使用模糊包装或夸大收益。
- 对积分、订阅、一次性购买分别说明交付内容和限制。

### 验证方式

- 无登录访问公开页面，确认能理解产品和价格。
- 从首页到 checkout 前完整走查购买路径。
- 搜索全仓和线上页面中的夸大宣传、coming soon、unlimited、no filter 等词。

## 2. 禁止和需额外审核业务

### 审核项

Dodo 明确禁止成人/NSFW、人工数字服务、低价值数字产品、实物、非法或年龄限制产品、金融/法律/医疗/专业服务、旅行/移民、健康、误导性承诺、社交匹配、赌博、游戏虚拟物品、加密资产、盗版/IP 侵权、隐私侵犯/监控、托管/VPN/代理、群发/抓取、规避平台规则、作弊工具、捐赠/筹款、市场/转售、票务预订、武器暴力内容等。

AI 内容生成、营销外联、招聘/考试、音频/音乐/chatbot、电子书、产品化服务等通常需要额外审核。

### 代码/产品检查点

```bash
rg -n "NSFW|adult|18\\+|uncensored|no filter|unfiltered|deepfake|face[- ]?swap|porn|sex"
rg -n "crypto|NFT|gambling|loan|tax|legal|medical|visa|immigration|dating|IPTV|proxy|VPN|scraping|spam|mass outreach|cheat"
rg -n "marketplace|reseller|resale|license flipping|donation|fundraising|ticket|booking"
```

### 常见不符合

- AI 生成产品支持或暗示可生成 NSFW、deepfake、真人冒充、换脸、名人素材。
- 工具支持抓取、群发、规避平台限制或批量生成垃圾内容。
- 以“AI wrapper”形式转售第三方 API，但没有明确权利、合规边界和用户价值。
- 销售低价值 AI 生成 PDF、薄模板、未完成网站或高价再包装免费内容。

### 整改建议

- 删除禁止类目能力、模板、示例、SEO 页面和营销词。
- 对受限业务准备清楚的合规说明、AUP、demo access、免责声明和操作边界。
- 不确定时先联系 `compliance@dodopayments.com` 说明业务模式。

### 验证方式

- 全仓和线上页面搜索禁止词。
- 人工检查 gallery、demo、prompt 模板、上传示例和 SEO 页面。
- 确认产品付款后交付内容与 onboarding 披露一致。

## 3. AI 内容生成专项

### 审核项

Dodo 把 AI text/image/video/voice generation 归为可能支持但需额外审核类别，重点关注 impersonation、scraping、deepfakes、NSFW、IP 侵权、虚假承诺、隐私侵犯和客户体验。

### 代码/产品检查点

- 服务端生成入口是否对 prompt 做内容审核，而不是只做长度校验。
- image-to-video/reference-to-video 是否对上传图片或引用图做安全检查。
- 审核失败、超时或异常是否 fail closed，不创建 provider 任务、不扣费或及时释放积分。
- Terms/AUP 是否明确禁止 NSFW、deepfake、impersonation、face manipulation、未授权人物/IP、隐私侵犯、暴力和违法内容。
- 是否披露使用第三方 AI 模型或 provider，避免用户误以为平台拥有或被第三方品牌背书。
- 是否保存必要审核日志和任务交付证据，但避免把敏感 prompt 明文写入普通日志。

### 常见不符合

- API route 只做 `zod` 校验，然后直接调用视频生成服务。
- 上传接口只检查 MIME 和大小，不检查图片内容和来源风险。
- 只有 Terms 泛化禁止 illegal/harmful/obscene，没有 AI 生成边界。
- FAQ 承诺完整商业许可，但没有说明用户对上传素材、肖像、商标、版权负责。

### 整改建议

- 增加 `moderatePrompt()` 和 `moderateImage()` 服务端检查。
- 对 deny、flag、审核异常、超时全部阻断生成并展示可理解错误。
- 在 AUP 和 Terms 中明确 AI 禁止内容、用户责任和平台处置权。
- 在模型页或 FAQ 披露第三方模型集成和非隶属关系。

### 验证方式

- 安全 prompt 能正常生成。
- NSFW/deepfake/impersonation prompt 被阻断。
- 模拟审核服务 5xx/timeout，确认不生成、不扣费或释放积分。
- 上传高风险图片时被拒绝或进入人工/自动审核流程。

## 4. Account Verification 与持续监控

### 审核项

Dodo Account Verification 需要 Product Information Form、KYC、KYB、银行验证和合规团队复核。Review & Monitoring 会在激活、首笔交易、首笔打款前、业务变化、退款/争议上升、域名/产品/交付渠道变化时触发。

### 代码/产品检查点

- 网站 URL、产品描述、产品类别、交付方式、自动化程度与 Dodo 表单一致。
- 品牌、域名、支持邮箱、社媒、产品阶段与后台提交信息一致。
- 代码和文档中是否仍暴露其他支付平台作为主支付，导致目标平台和实际实现不一致。
- 是否有后台/admin 能提供交易、用户、生成任务、退款、投诉证据。

### 常见不符合

- 申请 Dodo，但代码实际仍使用 Creem/Stripe checkout、webhook 和 customer portal。
- Product Information Form 写 SaaS 自动化交付，但实际靠人工服务或私下交付。
- 官网支持邮箱和后台资料不一致。

### 整改建议

- 提交前确认目标平台和实际支付实现一致。
- 准备一份产品说明：卖什么、如何交付、用户付款后获得什么、如何退款/取消。
- 对域名、品牌、支持邮箱、社媒和后台信息做一致性检查。

### 验证方式

- 搜索 `dodo|dodopayments|creem|stripe|checkout|webhook|portal`。
- 检查 checkout 是否创建 Dodo session，webhook 是否验签并处理 Dodo 事件。
- 检查 Dodo dashboard 提交信息与官网一致。

## 5. 订阅、Customer Portal 与取消

### 审核项

Dodo Customer Portal 支持客户查看发票、管理订阅、更新支付方式、取消订阅。订阅产品必须清楚说明续费周期、取消方式、试用和权益变更。

### 代码/产品检查点

- Account/Settings/Billing 页面是否稳定显示 Manage Subscription。
- 是否通过 Dodo Customer Portal 或等价 API 创建 portal session。
- 用户是否能取消订阅，取消后停止续费时点是否清楚。
- 订阅状态 `active/on_hold/cancelled/failed/expired` 是否驱动权益变化。
- 价格页 FAQ 中“随时取消”是否与产品内能力一致。

### 常见不符合

- 有 portal 代码但生产页面没有引用。
- 定价页有 `hasAccess` 状态但没有真实加载订阅状态，订阅用户看不到管理入口。
- webhook 只处理支付成功，不处理取消、退款、续费失败、on_hold。

### 整改建议

- 在 dashboard/settings 固定提供 Customer Portal 入口。
- webhook 处理订阅生命周期，及时授予、撤销或暂停权益。
- 失败时展示支持邮箱和重试提示。

### 验证方式

- 使用订阅账号登录，确认能进入 Dodo Customer Portal。
- 在 portal 中能取消订阅并收到对应 webhook。
- 取消后应用内权益和续费状态正确变化。

## 6. 退款、争议和证据

### 审核项

Dodo Refunds 支持成功支付后 30 天内发起全额或部分退款，并退回原支付方式。Disputes 要求商户准备 invoice、访问日志、交付证据、产品描述、已接受的 Terms/Refund Policy 和客户沟通记录。

### 代码/产品检查点

- 是否有公开 Refund Policy，且 Terms、FAQ、Pricing 口径一致。
- 是否保存真实 payment/order/subscription id、金额、币种、产品名、状态、invoice URL。
- 是否记录用户接受 Terms/Refund Policy 的版本、时间、IP/UA。
- 是否能证明数字产品已交付：登录、生成任务、下载、访问时间、邮件或系统日志。
- 生成失败是否自动返还积分或触发清晰的补偿逻辑。

### 常见不符合

- Terms 写 no refund，FAQ 写 7 天满意退款。
- Billing history 金额按积分估算，不是支付平台真实订单金额。
- 只记录积分流水，不记录支付订单、invoice、退款、争议。
- 没有 dispute evidence 所需的用户访问和交付证据。

### 整改建议

- 新增 Refund Policy，明确现金退款、积分返还、系统失败、用户不满意、滥用和已消耗权益的边界。
- 建立 payment/order/refund/dispute 记录表或同步 Dodo 订单数据。
- 在争议处理后台或脚本中能导出证据包。

### 验证方式

- 对比 Terms、FAQ、Pricing、Refund Policy 文案一致性。
- 完成一笔测试支付，确认后台能看到真实金额、币种、订单号、invoice。
- 模拟失败生成，确认积分释放或补偿记录可查。

## 7. 法务页面与隐私

### 审核项

Dodo 审核会关注 Terms、Privacy、Refund Policy、AUP、Support 是否公开、完整、一致，并与产品实际行为匹配。

### 代码/产品检查点

- Footer 是否链接 Terms、Privacy、Refund Policy、AUP、Contact/Support。
- Privacy 是否披露支付平台、AI provider、对象存储、邮件服务、OAuth、内容审核、日志和数据保留。
- Terms 是否明确用户内容权利、AI 输出限制、商业使用边界、禁止内容、账号封禁和退款关系。
- 注册或 checkout 前是否提示并记录用户同意条款。

### 常见不符合

- 只有 Terms/Privacy，没有 AUP、Refund Policy、Contact。
- Privacy 只写“支付处理商”，没有列明 Dodo 或第三方服务类别。
- 商业使用权承诺过宽，没有 IP/肖像/商标限制。

### 整改建议

- 补齐公开政策页面并放入 footer。
- 增加条款版本和用户同意记录。
- 将 AI 内容安全、第三方模型、商业使用边界写入 Terms/AUP。

### 验证方式

- 无登录打开全部法务链接。
- 注册、checkout、生成入口能看到或跳转到关键政策。
- 审查隐私政策是否覆盖实际第三方服务。
