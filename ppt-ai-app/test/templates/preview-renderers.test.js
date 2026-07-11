import assert from "node:assert/strict";
import { test } from "node:test";

import { PptExportService } from "../../src/ppt-exporter.js";
import { PptService } from "../../src/ppt-service.js";
import { TemplateManager } from "../../src/templates.js";

test("internal control compliance preview uses dedicated risk inspection scenes", async () => {
  const deck = {
    id: "deck-risk-inspection-preview",
    ownerUserId: 7,
    title: "Internal control compliance review",
    templateId: "finance-internal-control-compliance-report-risk-inspection",
    theme: "risk-inspection",
    templateVisual: {
      id: "finance-internal-control-compliance-report-risk-inspection",
      primary: "14213D",
      accent: "F97316",
      secondary: "16A34A",
      warning: "DC2626",
      background: "EEF3F7",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "finance-risk-inspection",
      variant: "risk-inspection",
    },
    status: "ready",
    slides: [
      { title: "Control review dashboard", layout: "finance-risk-inspection-cover", bullets: ["32 audit items completed", "8 high risk findings", "100% remediation tracking"] },
      { title: "Checklist evidence review", layout: "finance-risk-inspection-checklist", bullets: ["Approval authority review", "Payment voucher sampling", "Contract archive trace"] },
      { title: "Key finding diagnosis", layout: "finance-risk-inspection-finding", bullets: ["Control gap in approval chain", "Evidence missing for sampling", "Remediation owner confirmed"] },
      { title: "Risk level matrix", layout: "finance-risk-inspection-rating", bullets: ["Likelihood and impact mapping", "High risk items prioritized", "Residual risk tracked weekly"] },
      { title: "Remediation closure path", layout: "finance-risk-inspection-remediation", bullets: ["Identify issue", "Assign owner", "Validate evidence", "Close and archive"] },
      { title: "Compliance conclusion", layout: "finance-risk-inspection-closing", bullets: ["Maintain monitoring rhythm", "Complete evidence archive", "Review closure quality"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager({
      templates: [{
        id: "finance-internal-control-compliance-report-risk-inspection",
        name: "Internal Control Compliance Report",
        categoryId: "finance",
        scope: "official",
        official: true,
        status: "active",
        themes: [{ id: "risk-inspection", visual: deck.templateVisual }],
        visual: deck.templateVisual,
      }],
    }),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="finance-risk-inspection"/);
  assert.match(html, /risk-layer/);
  assert.match(html, /risk-checklist/);
  assert.match(html, /risk-finding-card/);
  assert.match(html, /risk-heatmap/);
  assert.match(html, /risk-remediation/);
  assert.match(html, /risk-closing/);
  assert.doesNotMatch(html, />风险检查</);
  assert.doesNotMatch(html, /<div class="slide-content"><h2/);
});

test("business model system preview uses dedicated consulting scenes", async () => {
  const deck = {
    id: "deck-business-model-system-preview",
    ownerUserId: 7,
    title: "Business model redesign",
    templateId: "strategy-business-model-design-value-chain",
    theme: "value-chain",
    templateVisual: {
      id: "strategy-business-model-design-value-chain",
      primary: "10233D",
      accent: "18A999",
      secondary: "D6A756",
      warning: "F97316",
      background: "EEF5F3",
      surface: "FFFFFF",
      title: "102033",
      body: "334155",
      layout: "business-model-value-chain",
      variant: "value-chain",
    },
    status: "ready",
    slides: [
      { title: "Operating model redesign", layout: "business-model-system-cover", bullets: ["Key activities need to connect resources and profit pools", "Partner roles require clearer incentives", "Platform governance should support repeatable growth"] },
      { title: "Business system map", layout: "business-model-value-flow", bullets: ["Supply side", "Key activities", "Capability assets", "Product service", "Channel touchpoint", "Customer outcome"] },
      { title: "Profit model logic", layout: "profit-model-map", bullets: ["Recurring revenue source", "Cost structure control", "Gross margin space"] },
      { title: "Ecosystem platform mechanism", layout: "ecosystem-platform-map", bullets: ["User role", "Partner network", "Data asset", "Channel collaboration"] },
      { title: "Assumption and opportunity board", layout: "risk-opportunity-matrix", bullets: ["Core assumption", "Capability gap", "Growth opportunity", "Priority action"] },
      { title: "Execution path", layout: "business-model-roadmap", bullets: ["Validate assumption", "Rebuild process", "Design mechanism", "Align partners", "Review and scale"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager({
      templates: [{
        id: "strategy-business-model-design-value-chain",
        name: "Business Model Design",
        categoryId: "strategy",
        scope: "official",
        official: true,
        status: "active",
        themes: [{ id: "value-chain", visual: deck.templateVisual }],
        visual: deck.templateVisual,
      }],
    }),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="business-model-value-chain"/);
  assert.match(html, /bmvc-hero-network/);
  assert.match(html, /\.bmvc-metrics\{position:absolute;left:8\.2%;right:8\.2%;bottom:12%;height:14%;/);
  assert.match(html, /bmvc-flow/);
  assert.match(html, /bmvc-profit/);
  assert.match(html, /bmvc-ecosystem/);
  assert.match(html, /\.bmvc-cards\{position:absolute;left:8\.2%;right:8\.2%;bottom:12%;height:14%;/);
  assert.match(html, /bmvc-matrix/);
  assert.match(html, /bmvc-roadmap/);
  assert.doesNotMatch(html, />value-chain</);
  assert.doesNotMatch(html, /<div class="slide-content"><h2/);
});

test("sales training objection handling preview uses dedicated roleplay scenes", async () => {
  const deck = {
    id: "deck-sales-training-objection-preview",
    ownerUserId: 7,
    title: "Sales training workshop",
    templateId: "sales-sales-training-course-objection-handling",
    theme: "objection-handling",
    templateVisual: {
      id: "sales-sales-training-course-objection-handling",
      primary: "17324D",
      accent: "FF8A3D",
      secondary: "2AB7A9",
      warning: "E94B5F",
      background: "F2F7FA",
      surface: "FFFFFF",
      title: "10233B",
      body: "34445C",
      layout: "sales-training-objection-handling",
      variant: "roleplay",
    },
    status: "ready",
    slides: [
      { title: "客户异议回应训练", layout: "sales-training-objection-cover", bullets: ["识别客户真实顾虑", "复述并确认问题", "证据化回应价值"] },
      { title: "常见顾虑分类", layout: "sales-training-objection-map", bullets: ["预算压力", "效果怀疑", "决策延迟", "竞品比较"] },
      { title: "回应路径拆解", layout: "sales-training-objection-path", bullets: ["倾听确认", "复述问题", "价值回应", "推进下一步"] },
      { title: "场景对练安排", layout: "sales-training-objection-roleplay", bullets: ["客户提出疑问", "销售复述确认", "给出案例证据"] },
      { title: "复盘检查清单", layout: "sales-training-objection-checklist", bullets: ["回应有证据", "追问有层次", "收口有动作"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager({
      templates: [{
        id: "sales-sales-training-course-objection-handling",
        name: "Sales Training Course",
        categoryId: "sales",
        scope: "official",
        official: true,
        status: "active",
        themes: [{ id: "objection-handling", visual: deck.templateVisual }],
        visual: deck.templateVisual,
      }],
    }),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="sales-training-objection-handling"/);
  assert.match(html, /training-dialogue/);
  assert.match(html, /training-map/);
  assert.match(html, /training-path/);
  assert.match(html, /training-roleplay/);
  assert.match(html, /training-checklist/);
  assert.doesNotMatch(html, />异议处理</);
  assert.doesNotMatch(html, /<div class="slide-content"><h2/);
});

test("presales technical architecture preview uses dedicated blueprint scenes", async () => {
  const deck = {
    id: "deck-presales-architecture-preview",
    ownerUserId: 7,
    title: "Presales architecture solution",
    templateId: "sales-presales-technical-plan-architecture-solution",
    theme: "architecture-solution",
    templateVisual: {
      id: "sales-presales-technical-plan-architecture-solution",
      primary: "0B1F3A",
      accent: "22D3EE",
      secondary: "38BDF8",
      warning: "F59E0B",
      background: "EAF3FB",
      surface: "FFFFFF",
      title: "071827",
      body: "334155",
      layout: "presales-architecture-solution",
      variant: "architecture-solution",
    },
    status: "ready",
    slides: [
      { title: "Client technical solution overview", layout: "presales-architecture-cover", bullets: ["Match client requirements", "Design integration architecture", "Define delivery assurance"] },
      { title: "Requirement and capability fit", layout: "presales-requirement-map", bullets: ["Business goal", "Technical capability", "Integration boundary", "Expected value"] },
      { title: "Layered system architecture", layout: "presales-architecture-blueprint", bullets: ["User portal", "Business apps", "Platform services", "Data services", "Cloud resources"] },
      { title: "Capability module design", layout: "presales-module-capability", bullets: ["Identity access", "Workflow orchestration", "Data integration", "Security audit"] },
      { title: "Deployment topology", layout: "presales-deployment-topology", bullets: ["Client systems", "API gateway", "Data service", "Cloud resources"] },
      { title: "Delivery assurance path", layout: "presales-delivery-assurance", bullets: ["Scope confirmation", "Technical review", "POC validation", "Production handover"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager({
      templates: [{
        id: "sales-presales-technical-plan-architecture-solution",
        name: "Presales Technical Plan",
        categoryId: "sales",
        scope: "official",
        official: true,
        status: "active",
        themes: [{ id: "architecture-solution", visual: deck.templateVisual }],
        visual: deck.templateVisual,
      }],
    }),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="presales-architecture-solution"/);
  assert.match(html, /presales-arch-layer/);
  assert.match(html, /presales-arch-canvas/);
  assert.match(html, /presales-arch-map/);
  assert.match(html, /presales-arch-blueprint/);
  assert.match(html, /presales-arch-modules/);
  assert.match(html, /presales-arch-topology/);
  assert.match(html, /presales-arch-timeline/);
  assert.doesNotMatch(html, />架构方案</);
  assert.doesNotMatch(html, /<div class="slide-content"><h2/);
});

test("product pricing strategy online preview uses dedicated scenes", async () => {
  const deck = {
    id: "deck-product-pricing-preview",
    ownerUserId: 7,
    title: "产品商业化方案",
    templateId: "product-commercialization-plan",
    theme: "pricing-strategy",
    status: "ready",
    slides: [
      { title: "产品定价与商业化路径", layout: "product-pricing-cover", bullets: ["目标客户分层", "价值锚点设计", "收入模型验证"] },
      { title: "套餐层级与权益说明", layout: "product-pricing-tier-cards", bullets: ["基础版覆盖轻量使用", "专业版承接核心付费", "企业版支持定制服务"] },
      { title: "价值锚点和价格假设", layout: "product-pricing-value-anchor", bullets: ["客户价值提升", "成本结构可控", "竞品价格对标", "收入目标拆解"] },
      { title: "套餐权益矩阵", layout: "product-pricing-benefit-matrix", bullets: ["核心权益", "进阶权益", "服务支持", "数据能力", "安全权限"] },
      { title: "商业化转化闭环", layout: "product-pricing-commercial-loop", bullets: ["试用触达", "付费转化", "续费留存", "增购扩张"] },
      { title: "下一步商业化动作", layout: "product-pricing-closing", bullets: ["确认价格假设", "灰度套餐权益", "验证转化漏斗", "复盘收入模型"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager(),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="product-pricing-strategy"/);
  assert.match(html, /class="pricing-card-row"/);
  assert.match(html, /class="pricing-anchor-grid"/);
  assert.match(html, /class="pricing-benefit-table"/);
  assert.match(html, /class="pricing-loop"/);
  assert.match(html, /基础版覆盖轻量使用/);
  assert.match(html, /客户价值提升/);
  assert.match(html, /确认价格假设/);
  assert.doesNotMatch(html, /<body[^>]*data-layout="top-band"/);
});

test("product retention path preview uses dedicated growth scenes", async () => {
  const deck = {
    id: "deck-product-retention-preview",
    ownerUserId: 7,
    title: "Product growth retention plan",
    templateId: "product-product-growth-plan-retention-path",
    theme: "retention-path",
    templateVisual: {
      id: "product-product-growth-plan-retention-path",
      primary: "111827",
      accent: "16A3A6",
      secondary: "7C3AED",
      warning: "F97316",
      background: "EFF6FF",
      surface: "FFFFFF",
      title: "0B1220",
      body: "334155",
      layout: "product-retention-path",
      variant: "retention-path",
    },
    status: "ready",
    slides: [
      { title: "User retention growth plan", layout: "product-retention-path-cover", bullets: ["D1 retention reached 42%", "D7 retention improved to 28%", "Key behavior trigger rate +18%"] },
      { title: "Lifecycle path overview", layout: "product-retention-path-lifecycle", bullets: ["Activate first session", "Guide key behavior", "Create revisit moment", "Build habit loop"] },
      { title: "Retention curve diagnosis", layout: "product-retention-path-analysis", bullets: ["Early churn concentrated in first day", "Feature value not fully perceived", "Message touchpoint timing needs tuning"] },
      { title: "Touchpoint action matrix", layout: "product-retention-path-actions", bullets: ["New user task", "Benefit reminder", "Dormant user recall", "Experiment review"] },
      { title: "Next growth loop", layout: "product-retention-path-summary", bullets: ["Locate churn point", "Design touchpoint", "Launch experiment", "Review retention metrics"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager(),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="product-retention-path"/);
  assert.match(html, /retention-layer/);
  assert.match(html, /retention-curve/);
  assert.match(html, /retention-lifecycle/);
  assert.match(html, /retention-actions/);
  assert.match(html, /retention-roadmap/);
  assert.doesNotMatch(html, />留存路径</);
  assert.doesNotMatch(html, /<div class="slide-content"><h2/);
});

test("product pricing strategy preview respects explicit page layouts after structure changes", async () => {
  const deck = {
    id: "deck-product-pricing-reordered",
    ownerUserId: 7,
    title: "产品商业化方案",
    templateId: "product-commercialization-plan",
    theme: "pricing-strategy",
    status: "ready",
    slides: [
      { title: "商业化总览", layout: "product-pricing-cover", bullets: ["目标客户", "价值锚点", "收入模型"] },
      { title: "先看权益差异", layout: "product-pricing-benefit-matrix", bullets: ["核心权益", "进阶权益", "服务支持"] },
      { title: "再看价格锚点", layout: "product-pricing-value-anchor", bullets: ["客户价值", "成本结构", "竞品对标"] },
      { title: "最后确定套餐", layout: "product-pricing-tier-cards", bullets: ["基础版", "专业版", "企业版"] },
      { title: "转化与续费", layout: "product-pricing-commercial-loop", bullets: ["试用", "付费", "续费", "增购"] },
      { title: "下一步验证", layout: "product-pricing-closing", bullets: ["灰度验证", "跟踪转化", "复盘收入"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager(),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.ok(html.indexOf('class="pricing-benefit-table"') < html.indexOf('class="pricing-anchor-grid"'));
  assert.ok(html.indexOf('class="pricing-anchor-grid"') < html.indexOf('class="pricing-card-row"'));
  assert.ok(html.indexOf('class="pricing-card-row"') < html.indexOf('class="pricing-loop"'));
  assert.match(html, /class="pricing-closing-panel"/);
});

test("private domain operation member layering preview uses dedicated scenes", async () => {
  const deck = {
    id: "deck-private-domain-member-layering",
    ownerUserId: 7,
    title: "私域运营方案",
    templateId: "marketing-private-domain-operation-plan-member-layering",
    theme: "member-layering",
    templateVisual: {
      id: "marketing-private-domain-operation-plan-member-layering",
      primary: "123C35",
      accent: "D6A84F",
      secondary: "F06A4B",
      background: "F3F7F1",
      surface: "FFFFFF",
      title: "10231F",
      body: "43514C",
      layout: "private-domain-member-layering",
      variant: "member-layering",
    },
    status: "ready",
    slides: [
      { title: "私域增长运营总览", layout: "private-domain-member-layering-cover", bullets: ["识别不同价值会员与复购潜力", "规划社群和企微触达路径", "建立权益策略和复购闭环"] },
      { title: "用户价值层级设计", layout: "private-domain-member-layering-pyramid", bullets: ["高价值用户", "活跃会员", "成长会员", "沉睡用户"] },
      { title: "触达路径设计", layout: "private-domain-member-layering-touch-path", bullets: ["入群识别", "标签打标", "内容触达", "权益激活"] },
      { title: "复购闭环复盘", layout: "private-domain-member-layering-repurchase-loop", bullets: ["识别用户", "权益触发", "活动承接", "数据回流"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager(),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="private-domain-member-layering"/);
  assert.match(html, /class="private-domain-member-card"/);
  assert.match(html, /class="private-domain-pyramid"/);
  assert.match(html, /class="private-domain-path"/);
  assert.match(html, /class="private-domain-loop"/);
  assert.doesNotMatch(html, />会员分层</);
  assert.doesNotMatch(html, /<div class="slide-content"><h2/);
});

test("integrated campaign media mix preview uses dedicated scenes", async () => {
  const deck = {
    id: "deck-integrated-media-mix",
    ownerUserId: 7,
    title: "整合营销传播方案",
    templateId: "marketing-integrated-campaign-media-mix",
    theme: "media-mix",
    templateVisual: {
      id: "marketing-integrated-campaign-media-mix",
      primary: "12355B",
      secondary: "1D9BF0",
      accent: "F59E0B",
      warning: "EF4444",
      background: "F3F7FB",
      surface: "FFFFFF",
      title: "10233F",
      body: "334155",
      layout: "integrated-media-mix",
      variant: "media-mix",
    },
    status: "ready",
    slides: [
      { title: "整合传播控制台", layout: "integrated-media-mix-cover", bullets: ["明确目标人群与传播目标", "规划公域私域媒介矩阵", "分配预算和覆盖频次"] },
      { title: "媒介矩阵规划", layout: "integrated-media-mix-matrix", bullets: ["社媒触达", "搜索承接", "内容种草", "线下引爆"] },
      { title: "预算分配建议", layout: "integrated-media-mix-budget", bullets: ["品牌广告", "效果投放", "达人合作", "内容制作"] },
      { title: "传播节奏设计", layout: "integrated-media-mix-rhythm", bullets: ["预热种草", "集中爆发", "转化承接", "复盘优化"] },
      { title: "覆盖频次评估", layout: "integrated-media-mix-effect", bullets: ["覆盖人群", "触达频次", "转化效率", "复购线索"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager(),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="integrated-media-mix"/);
  assert.match(html, /class="integrated-media-matrix"/);
  assert.match(html, /class="integrated-media-budget"/);
  assert.match(html, /class="integrated-media-rhythm"/);
  assert.match(html, /class="integrated-media-radar"/);
  assert.doesNotMatch(html, />媒介组合</);
  assert.doesNotMatch(html, /<div class="slide-content"><h2/);
});

test("management meeting agenda decision preview uses dedicated scenes", async () => {
  const deck = {
    id: "deck-management-agenda-decision",
    ownerUserId: 7,
    title: "管理层会议材料",
    templateId: "business-management-meeting-materials-agenda-decision",
    theme: "agenda-decision",
    templateVisual: {
      id: "business-management-meeting-materials-agenda-decision",
      primary: "13233F",
      accent: "C99A3B",
      secondary: "2F6B7E",
      warning: "B64E3A",
      background: "EEF2F6",
      surface: "FFFFFF",
      title: "0B1426",
      body: "334155",
      layout: "management-agenda-decision",
      variant: "agenda-decision",
    },
    status: "ready",
    slides: [
      { title: "管理层会议材料", layout: "management-agenda-cover", bullets: ["确认本次会议关键议题", "形成可执行决策结论", "建立会后行动追踪"] },
      { title: "会议议题总览", layout: "management-agenda-overview", bullets: ["经营议题", "风险事项", "资源投入", "行动追踪"] },
      { title: "核心议题决策", layout: "management-agenda-topic", bullets: ["方案 A 快速推进", "方案 B 分阶段验证", "方案 C 保守观察"] },
      { title: "决策事项记录", layout: "management-agenda-decision-record", bullets: ["会议结论", "决策依据", "风险保留", "责任确认"] },
      { title: "行动事项追踪", layout: "management-agenda-action-track", bullets: ["事项确认", "责任人", "截止时间", "检查节点"] },
      { title: "下一次会议输入", layout: "management-agenda-closing", bullets: ["提出议题", "形成结论", "责任下发", "复盘追踪"] },
    ],
  };
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(deck) ? deck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager(),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-layout="management-agenda-decision"/);
  assert.match(html, /class="management-agenda-layer"/);
  assert.match(html, /class="management-board"/);
  assert.match(html, /class="management-agenda-card"/);
  assert.match(html, /class="management-option"/);
  assert.match(html, /class="management-track"/);
  assert.doesNotMatch(html, />议题决策</);
  assert.doesNotMatch(html, /<div class="slide-content"><h2/);
});
