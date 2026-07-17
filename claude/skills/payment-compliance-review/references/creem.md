# Creem 审核合规参考

本文件是 Creem 专项检查清单。使用前必须先核对 Creem 官方最新文档；如官方政策变化，以官方为准。

官方文档入口：

- Account Reviews: `https://docs.creem.io/merchant-of-record/account-reviews/account-reviews`
- AI Wrapper Compliance: `https://docs.creem.io/merchant-of-record/account-reviews/ai-wrapper-compliance`
- Moderation API: `https://docs.creem.io/features/moderation`
- Customer Portal: `https://docs.creem.io/features/customer-portal`
- Test Mode: `https://docs.creem.io/getting-started/test-mode`

## 1. Account Review 基础审核

### 审核项

Creem 会检查产品是否真实、可访问、可理解、可支持，并且不属于禁止/高风险类目。

### 代码/产品检查点

- 官网是否可公开访问，不需要密码或内测白名单。
- 首页或 landing page 是否能清楚说明卖什么。
- Pricing 是否公开可见。
- Footer 是否有 Terms 和 Privacy。
- 支持邮箱是否公开展示。
- 是否存在假评论、假用户数、夸大客户数。
- 产品名、域名、SEO 页面是否造成商标或第三方品牌混淆。

### 常见不符合

- 产品还没上线，只是模板页或 Coming soon。
- 价格页藏得很深，或 checkout 前看不到价格/周期。
- Terms/Privacy 存在但 footer 没有入口。
- 使用通用 Gmail/QQ 邮箱，或官网邮箱与 Creem 后台不一致。
- 首页写 “Loved by thousands” 但没有真实证据。

### 整改建议

- 确保审核人员能从公开 URL 访问完整购买路径。
- 在主导航或 footer 暴露 Pricing、Terms、Privacy、Support。
- 使用品牌域名邮箱，例如 `support@yourdomain.com`。
- 删除无法证明的评论、用户数、收入、客户 logo。

### 验证方式

- 无登录访问首页和价格页。
- 点击 footer 法务链接能正常打开。
- 向支持邮箱发送测试邮件可收到。
- Creem 后台 Business Details 邮箱与官网展示一致。

## 2. 禁止和受限产品

### 审核项

产品不得命中 Creem prohibited products；受限产品需要额外尽调。

### 代码/产品检查点

搜索营销文案、路由、配置、prompt 模板、gallery、FAQ：

```bash
rg -n "NSFW|adult|18\\+|uncensored|no filter|unfiltered|deepfake|face[- ]?swap|porn|sex"
rg -n "crypto|NFT|gambling|loan|essay|homework|dating|IPTV|downloader|ripper"
```

### 常见不符合

- AI 生成产品使用 “uncensored”“no filter”“NSFW” 营销词。
- 支持 face-swap、deepfake、换脸、真人脸部操控。
- 销售没有授权的第三方素材、下载器或平台内容抓取工具。
- API 转售但没有成熟转售商证明和拒付率材料。

### 整改建议

- 移除所有禁止类目能力和营销词。
- 如果业务接近 restricted 类目，准备合规说明、授权证明、拒付率和交易量证明。
- 对不确定类目，先向 Creem support 提供产品说明确认。

### 验证方式

- 全仓和线上页面搜索禁止词。
- 人工检查 gallery、demo、模板 prompt。
- 确认产品功能不支持 face manipulation 或受限用途。

## 3. AI 图片/视频 Wrapper

### 审核项

AI 图片/视频生成产品有额外要求：独立品牌、第三方模型披露、AUP、明确禁止内容、生产环境 Moderation API。

### 代码/产品检查点

- 产品名是否独立于模型名，避免 `VEO3Studio`、`SoraMaker` 这类命名。
- 如果页面出现 OpenAI / Google / Veo / Sora / Seedance 等模型名，是否有“不隶属、不背书”的说明。
- 是否存在公开 AUP 页面。
- Terms 是否明确禁止 NSFW、性暗示、deepfake、face-swap、face-manipulation、违法、有害、侵权内容。
- gallery、demo、prompt 模板是否存在擦边内容。

### 常见不符合

- 只有泛化 “illegal, harmful, obscene”，没有明确 AI 内容边界。
- SEO 页以模型名作为主品牌，缺少独立产品说明。
- Terms/FAQ 承诺商业使用权，但没有说明用户负责权利合规。

### 整改建议

- 新增 `/acceptable-use` 或等价 AUP。
- Terms 中增加 AI 内容禁止清单和用户责任。
- 在模型页、FAQ 或生成器附近加入第三方模型集成免责声明。
- 移除 suggestive/borderline gallery 内容。

### 验证方式

- 无登录访问 AUP。
- 搜索 Terms 中是否出现 NSFW、deepfake、face manipulation 等明确禁止项。
- 检查模型页是否有清晰免责声明。

## 4. Moderation API

### 审核项

AI 图片/视频生成产品必须在每个用户 prompt 到达模型前调用 Creem Moderation API。`allow` 才能生成；`flag`、`deny`、异常都必须阻断。

### 代码/产品检查点

- 找到所有生成入口：API route、server action、queue producer、provider service。
- 确认 moderation 发生在以下动作之前：
  - 创建 provider 任务。
  - 排队生成。
  - 冻结/扣除积分。
  - 写入不可回滚任务状态。
- 确认客户端无法绕过 moderation。
- 确认生产环境使用 production endpoint/key，不只是 sandbox。
- 请求中包含可审计的 `external_id`。

### 常见不符合

- route 只做 `zod` 长度校验，然后直接调用 `videoService.generate()`。
- moderation 只在前端检查。
- moderation 出错后 `catch` 记录日志但继续生成。
- `flag` 被当成可通过。

### 整改建议

- 在服务端生成入口最前面封装 `moderatePrompt()`。
- `allow` 之外全部返回明确错误，不进入生成流程。
- moderation 网络失败或超时返回 503/可重试错误。
- 记录 moderation id、decision、external_id，避免记录敏感 prompt 明文到普通日志。

### 验证方式

- 用安全 prompt 触发一次生产请求，确认先调用 moderation 再调用模型。
- 模拟 `deny` / `flag`，确认不生成、不扣积分、不创建 provider 任务。
- 模拟 moderation timeout/5xx，确认 fail closed。
- 检查生产环境 key 前缀和 endpoint。

## 5. 订阅和 Customer Portal

### 审核项

用户必须能从产品内取消订阅，通常通过 Creem Customer Portal 或 Cancel Subscription API。

### 代码/产品检查点

- 当前生产实际渲染的 account/settings/billing 页面是否有 `Manage Subscription`。
- 按钮是否调用 `creem.createPortal()` 或等价 API。
- 活跃订阅状态是否正确加载。
- 未使用组件中的 portal 按钮不能算已满足。

### 常见不符合

- 有 `createPortal()` 代码，但组件没有被页面引用。
- 价格页定义了 `hasAccess`，但没有调用 `hasAccessGranted()`，导致订阅用户看不到管理按钮。
- FAQ 写“随时取消”，但产品内没有取消入口。

### 整改建议

- 在 dashboard/settings/billing 中增加稳定的 Manage Subscription 入口。
- 对订阅用户加载真实订阅状态。
- portal 创建失败时展示支持邮箱和可重试提示。

### 验证方式

- 使用订阅账号登录，确认能看到 Manage Subscription。
- 点击后进入 Creem Customer Portal。
- 在 portal 中能看到取消订阅入口。

## 6. 定价、积分和退款

### 审核项

购买前必须清楚展示价格、周期、权益、限制、退款/取消规则。所有页面口径要一致。

### 代码/产品检查点

- Pricing 是否显示币种、金额、月付/年付、续费周期。
- 积分包和订阅是否区分清楚。
- 积分有效期是否在购买前披露。
- 年付折扣是否与价格计算一致。
- Terms、FAQ、Pricing 是否对退款规则一致。
- 失败生成是否返还积分，并有用户可理解说明。

### 常见不符合

- Terms 写 “all fees are non-refundable”，FAQ 又写 7 天满意退款。
- 积分过期只在代码配置里存在，购买前不展示。
- 年付标注折扣与实际价格不一致。

### 整改建议

- 统一退款口径：现金退款、积分返还、系统失败、用户不满意分别说明。
- 在 Pricing 或 FAQ 说明积分有效期。
- 订阅取消后何时停止续费、已发积分如何处理，要写清楚。

### 验证方式

- 对比 Terms、FAQ、Pricing、checkout 前文案。
- 用配置计算年付折扣是否一致。
- 模拟生成失败，确认积分释放或返还逻辑。

## 7. 法务页面和隐私

### 审核项

至少需要 Terms 和 Privacy；AI 图片/视频产品还需要 AUP。

### 代码/产品检查点

- `/terms`、`/privacy`、`/acceptable-use` 是否存在。
- Footer 是否链接到这些页面。
- Privacy 是否提及 prompt、上传图片/视频、生成结果、AI provider、支付处理方。
- Terms 是否提及支付处理方、订阅、取消、退款、积分有效期、AI 输出限制。

### 常见不符合

- Terms/Privacy 是模板文本，未覆盖真实业务。
- Privacy 只写 cloud hosting / payment processing，没有写 AI provider 或生成内容处理。
- 没有 AUP。

### 整改建议

- 按真实数据流更新 Privacy。
- 按真实收费模式更新 Terms。
- 新增 AUP 并从 footer 链接。

### 验证方式

- 无登录访问所有法务页面。
- 对照项目真实数据流检查 Privacy。
- 对照收费配置检查 Terms。

## 8. 报告输出要求

Creem 审核报告中，每个发现都尽量按以下格式输出：

```markdown
1. 标题
   - 政策要求：...
   - 项目证据：[file](path:line) ...
   - 风险判断：...
   - 整改建议：...
   - 验证方式：...
```

如果某项只能通过 Creem 后台确认，例如 receipt 邮箱、Business Details、生产 Product ID、webhook 事件配置，应放入 `无法确认项`，不要假设已配置正确。
