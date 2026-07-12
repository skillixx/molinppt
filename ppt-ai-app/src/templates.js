import { AppError } from "./errors.js";

/**
 * Built-in template categories used by the local template catalog.
 */
export const DEFAULT_TEMPLATE_CATEGORIES = [
  { id: "business", name: "商业汇报", sortOrder: 10 },
  { id: "strategy", name: "战略咨询", sortOrder: 20 },
  { id: "finance", name: "财务经营", sortOrder: 30 },
  { id: "sales", name: "销售方案", sortOrder: 40 },
  { id: "product", name: "产品规划", sortOrder: 50 },
  { id: "marketing", name: "市场营销", sortOrder: 60 },
  { id: "data", name: "数据洞察", sortOrder: 70 },
  { id: "education", name: "教育培训", sortOrder: 80 },
  { id: "pitch", name: "融资路演", sortOrder: 90 },
];

const EXECUTIVE_LAYOUT_SCHEMA = {
  defaultCoverLayout: "executive-cover",
  defaultContentLayout: "executive-content",
  allowedLayouts: ["executive-cover", "executive-content", "title", "content"],
};

const FINANCE_QUARTERLY_REVIEW_LAYOUT_SCHEMA = {
  defaultCoverLayout: "finance-quarterly-cover",
  defaultContentLayout: "finance-quarterly-overview",
  allowedLayouts: [
    "finance-quarterly-cover",
    "finance-quarterly-overview",
    "finance-quarterly-profit-bridge",
    "finance-quarterly-budget-variance",
    "finance-quarterly-risk-matrix",
    "finance-quarterly-action-loop",
    "finance-quarterly-closing",
    "title",
    "content",
  ],
};

const ACADEMY_LAYOUT_SCHEMA = {
  defaultCoverLayout: "academy-cover",
  defaultContentLayout: "academy-content",
  allowedLayouts: ["academy-cover", "academy-content", "lesson-title", "lesson-content"],
};

const VENTURE_LAYOUT_SCHEMA = {
  defaultCoverLayout: "venture-cover",
  defaultContentLayout: "venture-story",
  allowedLayouts: ["venture-cover", "venture-story", "hero", "story"],
};

const PITCH_DECK_LAYOUT_SCHEMA = {
  defaultCoverLayout: "venture-cover",
  defaultContentLayout: "venture-story",
  allowedLayouts: [
    "venture-cover",
    "venture-story",
    "hero",
    "story",
    "pitch-investor-memo-cover",
    "pitch-investor-memo-summary",
    "pitch-investor-memo-market",
    "pitch-investor-memo-revenue",
    "pitch-investor-memo-unit-economics",
    "pitch-investor-memo-moat",
    "pitch-investor-memo-funding",
    "pitch-investor-memo-closing",
    "content",
  ],
};

const MARKETING_LAYOUT_SCHEMA = {
  defaultCoverLayout: "campaign-cover",
  defaultContentLayout: "campaign-content",
  allowedLayouts: ["campaign-cover", "campaign-content", "brand-communication-cover", "brand-communication-proposition", "brand-communication-audience", "brand-communication-content-matrix", "brand-communication-media-matrix", "brand-communication-rhythm", "brand-communication-dashboard", "brand-communication-closing", "growth-lab-cover", "growth-lab-funnel", "growth-lab-channel-matrix", "growth-lab-experiment-card", "growth-lab-trend-roi", "growth-lab-action-priority", "growth-lab-closing", "hero", "story", "content"],
};

const DOME_LAYOUT_SCHEMA = {
  defaultCoverLayout: "cover",
  defaultContentLayout: "image-report",
  allowedLayouts: [
    "cover",
    "agenda",
    "section-divider",
    "image-report",
    "three-steps",
    "four-steps",
    "metrics",
    "showcase",
    "retrospective",
    "next-plan",
    "closing",
    "title",
    "content",
  ],
};

const COST_CONTROL_LAYOUT_SCHEMA = {
  defaultCoverLayout: "cost-breakdown-cover",
  defaultContentLayout: "cost-breakdown-content",
  allowedLayouts: [
    "cost-breakdown-cover",
    "cost-structure-overview",
    "cost-driver-analysis",
    "cost-saving-roadmap",
    "expense-control-loop",
    "responsibility-matrix",
    "cost-breakdown-closing",
    "title",
    "content",
  ],
};

const CASH_FLOW_FORECAST_LAYOUT_SCHEMA = {
  defaultCoverLayout: "cash-flow-forecast-cover",
  defaultContentLayout: "cash-flow-forecast-content",
  allowedLayouts: [
    "cash-flow-forecast-cover",
    "cash-flow-waterfall",
    "cash-turnover-cycle",
    "receivables-management",
    "cash-risk-warning",
    "cash-forecast-dashboard",
    "cash-flow-forecast-closing",
    "title",
    "content",
  ],
};

const KEY_ACCOUNT_DECISION_LAYOUT_SCHEMA = {
  defaultCoverLayout: "key-account-decision-cover",
  defaultContentLayout: "key-account-decision-content",
  allowedLayouts: [
    "key-account-decision-cover",
    "key-account-organization-map",
    "key-account-decision-path",
    "key-account-stakeholder-matrix",
    "key-account-win-roadmap",
    "key-account-closing",
    "title",
    "content",
  ],
};

const PRESALES_ARCHITECTURE_LAYOUT_SCHEMA = {
  defaultCoverLayout: "presales-architecture-cover",
  defaultContentLayout: "presales-architecture-content",
  allowedLayouts: [
    "presales-architecture-cover",
    "presales-requirement-map",
    "presales-architecture-blueprint",
    "presales-module-capability",
    "presales-deployment-topology",
    "presales-delivery-assurance",
    "presales-next-step",
    "title",
    "content",
  ],
};

const SALES_TRAINING_OBJECTION_LAYOUT_SCHEMA = {
  defaultCoverLayout: "sales-training-objection-cover",
  defaultContentLayout: "sales-training-objection-content",
  allowedLayouts: [
    "sales-training-objection-cover",
    "sales-training-objection-map",
    "sales-training-objection-path",
    "sales-training-objection-roleplay",
    "sales-training-objection-checklist",
    "sales-training-objection-closing",
    "title",
    "content",
  ],
};

const PRODUCT_COMMERCIALIZATION_LAYOUT_SCHEMA = {
  defaultCoverLayout: "product-pricing-cover",
  defaultContentLayout: "product-pricing-content",
  allowedLayouts: [
    "product-pricing-cover",
    "product-pricing-tier-cards",
    "product-pricing-value-anchor",
    "product-pricing-benefit-matrix",
    "product-pricing-commercial-loop",
    "product-pricing-closing",
    "title",
    "content",
  ],
};

const PRODUCT_INTERVIEW_INSIGHT_LAYOUT_SCHEMA = {
  defaultCoverLayout: "product-interview-insight-cover",
  defaultContentLayout: "product-interview-insight-content",
  allowedLayouts: [
    "product-interview-insight-cover",
    "product-interview-insight-sample",
    "product-interview-insight-quotes",
    "product-interview-insight-cluster",
    "product-interview-insight-opportunity",
    "product-interview-insight-recommendation",
    "product-interview-insight-closing",
    "title",
    "content",
    "closing",
  ],
};

const CHANNEL_TRAFFIC_QUALITY_LAYOUT_SCHEMA = {
  defaultCoverLayout: "channel-quality-cover",
  defaultContentLayout: "channel-quality-diagnosis",
  allowedLayouts: [
    "channel-quality-cover",
    "channel-quality-source",
    "channel-quality-scorecard",
    "channel-quality-conversion",
    "channel-quality-actions",
    "channel-quality-closing",
    "title",
    "content",
    "closing",
  ],
};

/**
 * Built-in template catalog used when no external catalog is configured.
 */
export const DEFAULT_TEMPLATES = [
  {
    id: "business",
    name: "高管商务汇报",
    categoryId: "business",
    scope: "official",
    status: "active",
    style: "executive-report",
    description: "适合经营复盘、管理层汇报和董事会沟通的稳重商务模板。",
    themes: [
      {
        id: "minimal",
        name: "极简灰蓝",
        visual: {
          primary: "1E3A8A",
          accent: "6B7280",
          background: "E9EEF5",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "top-band",
        },
      },
      {
        id: "modern",
        name: "现代红金",
        visual: {
          primary: "B91C1C",
          accent: "D97706",
          background: "FFF1E6",
          surface: "FFFFFF",
          title: "3B0A0A",
          body: "5B3328",
          layout: "top-band",
        },
      },
      {
        id: "classic",
        name: "经典商务",
        visual: {
          primary: "1F2A37",
          accent: "B89B5E",
          background: "E8ECEF",
          surface: "FFFFFF",
          title: "111827",
          body: "374151",
          layout: "top-band",
        },
      },
      {
        id: "executive",
        name: "高管深蓝",
        visual: {
          primary: "102A43",
          accent: "BFA46A",
          background: "E6EDF5",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "334155",
          layout: "top-band",
        },
      },
    ],
    visual: {
      primary: "B91C1C",
      accent: "D97706",
      background: "FFF1E6",
      surface: "FFFFFF",
      title: "3B0A0A",
      body: "5B3328",
      layout: "top-band",
    },
    layoutSchema: DOME_LAYOUT_SCHEMA,
  },
  {
    id: "strategy-consulting",
    name: "战略咨询方案",
    categoryId: "strategy",
    scope: "official",
    status: "active",
    style: "consulting-case",
    description: "适合问题诊断、方案对比和高层决策的咨询风格模板。",
    themes: [
      {
        id: "board",
        name: "董事会汇报",
        visual: {
          primary: "18253A",
          accent: "C7A15A",
          background: "EEF1F5",
          surface: "FFFFFF",
          title: "111827",
          body: "334155",
          layout: "executive",
          variant: "board",
        },
      },
      {
        id: "matrix",
        name: "矩阵分类",
        visual: {
          primary: "203A5C",
          accent: "4C8F8A",
          background: "F0F5F7",
          surface: "FFFFFF",
          title: "12263A",
          body: "3D5366",
          layout: "executive",
          variant: "matrix",
        },
      },
      {
        id: "workstream",
        name: "工作流程推进",
        visual: {
          primary: "27364A",
          accent: "D29A45",
          background: "F4F1EA",
          surface: "FFFFFF",
          title: "182334",
          body: "4B5563",
          layout: "executive",
          variant: "workstream",
        },
      },
    ],
    visual: {
      primary: "1B365D",
      accent: "B88746",
      background: "F1F4F8",
      surface: "FEFEFD",
      title: "111C2E",
      body: "465568",
      layout: "executive",
    },
    layoutSchema: EXECUTIVE_LAYOUT_SCHEMA,
  },
  {
    id: "industry-research",
    name: "行业研究报告",
    categoryId: "strategy",
    scope: "official",
    status: "active",
    style: "consulting-report",
    description: "适合行业规模、产业链结构、竞争格局和市场机会分析的咨询白底风模板。",
    themes: [
      {
        id: "industry-landscape",
        name: "行业格局",
        visual: {
          primary: "12325A",
          accent: "18A7A7",
          background: "F3F7FA",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "334155",
          layout: "industry-research",
          variant: "industry-landscape",
        },
      },
      {
        id: "trend-forecast",
        name: "趋势判断",
        visual: {
          primary: "102A56",
          accent: "16A3B8",
          secondary: "22C55E",
          warning: "F59E0B",
          background: "F5F8FB",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "industry-trend-forecast",
          variant: "trend-forecast",
        },
      },
    ],
    visual: {
      primary: "12325A",
      accent: "18A7A7",
      background: "F3F7FA",
      surface: "FFFFFF",
      title: "0B1F33",
      body: "334155",
      layout: "industry-research",
      variant: "industry-landscape",
    },
    layoutSchema: {
      defaultCoverLayout: "industry-research-cover",
      defaultContentLayout: "industry-research-content",
      allowedLayouts: [
        "industry-research-cover",
        "industry-overview",
        "industry-value-chain",
        "industry-competition",
        "industry-opportunity-risk",
        "industry-research-closing",
        "title",
        "content",
      ],
    },
  },
  {
    id: "competitor-analysis",
    name: "竞争对手分析",
    categoryId: "strategy",
    scope: "official",
    status: "active",
    style: "consulting-report",
    description: "适合竞品分析、SWOT 评估、竞争坐标定位和差异化策略汇报的战略咨询模板。",
    themes: [
      {
        id: "swot-map",
        name: "SWOT 地图",
        visual: {
          primary: "102A43",
          accent: "12A5A6",
          secondary: "22C55E",
          warning: "F97316",
          background: "F5F8FB",
          surface: "FFFFFF",
          title: "071A2D",
          body: "3D5363",
          layout: "strategy-swot-map",
          variant: "swot-map",
        },
      },
    ],
    visual: {
      primary: "102A43",
      accent: "12A5A6",
      secondary: "22C55E",
      warning: "F97316",
      background: "F5F8FB",
      surface: "FFFFFF",
      title: "071A2D",
      body: "3D5363",
      layout: "strategy-swot-map",
      variant: "swot-map",
    },
    layoutSchema: {
      defaultCoverLayout: "swot-map-cover",
      defaultContentLayout: "swot-map-overview",
      allowedLayouts: [
        "swot-map-cover",
        "swot-map-overview",
        "swot-map-positioning",
        "swot-map-strength-weakness",
        "swot-map-opportunity-threat",
        "swot-map-strategy-actions",
        "swot-map-closing",
        "title",
        "content",
      ],
    },
  },
  {
    id: "growth-strategy-planning",
    name: "增长战略规划",
    categoryId: "strategy",
    scope: "official",
    status: "active",
    style: "strategy-growth",
    description: "适合第二增长曲线规划、新业务孵化、市场扩张策略和阶段投资汇报的战略咨询模板。",
    themes: [
      {
        id: "second-curve",
        name: "第二曲线",
        visual: {
          primary: "0E2A47",
          accent: "16B8A6",
          secondary: "F2B84B",
          background: "EEF6F4",
          surface: "FFFFFF",
          title: "071A2D",
          body: "315168",
          layout: "strategy-second-curve",
          variant: "second-curve",
        },
      },
    ],
    visual: {
      primary: "0E2A47",
      accent: "16B8A6",
      secondary: "F2B84B",
      background: "EEF6F4",
      surface: "FFFFFF",
      title: "071A2D",
      body: "315168",
      layout: "strategy-second-curve",
      variant: "second-curve",
    },
    layoutSchema: {
      defaultCoverLayout: "second-curve-cover",
      defaultContentLayout: "second-curve-content",
      allowedLayouts: [
        "second-curve-cover",
        "second-curve-context",
        "second-curve-opportunity",
        "second-curve-incubation",
        "second-curve-resource",
        "second-curve-closing",
        "title",
        "content",
      ],
    },
  },
  {
    id: "market-entry-strategy",
    name: "市场进入策略",
    categoryId: "strategy",
    scope: "official",
    status: "active",
    style: "strategy-region-entry",
    description: "适合新市场进入、区域拓展、渠道布局和客群切入策略的战略咨询模板。",
    themes: [
      {
        id: "region-entry",
        name: "区域进入",
        visual: {
          id: "strategy-market-entry-strategy-region-entry",
          primary: "102A43",
          accent: "14B8A6",
          secondary: "F2B84B",
          warning: "F97316",
          background: "EEF6F8",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "334155",
          layout: "strategy-region-entry",
          variant: "region-entry",
        },
      },
    ],
    visual: {
      id: "strategy-market-entry-strategy-region-entry",
      primary: "102A43",
      accent: "14B8A6",
      secondary: "F2B84B",
      warning: "F97316",
      background: "EEF6F8",
      surface: "FFFFFF",
      title: "0B1F33",
      body: "334155",
      layout: "strategy-region-entry",
      variant: "region-entry",
    },
    layoutSchema: {
      defaultCoverLayout: "region-entry-cover",
      defaultContentLayout: "region-entry-map",
      // 区域进入模板按战略咨询汇报节奏拆页，避免生成时退回通用三段式内容页。
      allowedLayouts: [
        "region-entry-cover",
        "region-entry-map",
        "region-entry-sequence",
        "region-entry-segments",
        "region-entry-channel",
        "region-entry-risk-plan",
        "region-entry-closing",
        "title",
        "content",
        "closing",
      ],
    },
  },
  {
    id: "financial-review",
    name: "财务经营复盘",
    categoryId: "finance",
    scope: "official",
    status: "active",
    style: "finance-report",
    description: "适合财务分析、经营指标和预算预测的专业复盘模板。",
    themes: [
      {
        id: "quarterly",
        name: "季度复盘",
        visual: {
          primary: "12263A",
          accent: "2F9E6D",
          secondary: "D9902F",
          warning: "C94B4B",
          background: "F5F7FA",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "finance-quarterly-review",
          variant: "quarterly",
        },
      },
      {
        id: "audit",
        name: "审计分析",
        visual: {
          primary: "172033",
          accent: "C2413A",
          secondary: "2D7F76",
          warning: "D9902F",
          background: "F4F6F8",
          surface: "FFFFFF",
          title: "101827",
          body: "3F4A5A",
          layout: "finance-audit-review",
          variant: "audit",
        },
      },
      {
        id: "forecast",
        name: "预测规划",
        visual: {
          primary: "0F2D3A",
          accent: "22A699",
          secondary: "3B82F6",
          warning: "F59E0B",
          danger: "E0564A",
          background: "F4F8F7",
          surface: "FFFFFF",
          title: "0B1F2A",
          body: "314B55",
          layout: "finance-fpa-forecast",
          variant: "forecast",
        },
      },
    ],
    visual: {
      primary: "12263A",
      accent: "2F9E6D",
      secondary: "D9902F",
      warning: "C94B4B",
      background: "F5F7FA",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "finance-quarterly-review",
      variant: "quarterly",
    },
    layoutSchema: FINANCE_QUARTERLY_REVIEW_LAYOUT_SCHEMA,
  },
  {
    id: "cost-control-plan",
    name: "成本控制方案",
    categoryId: "finance",
    scope: "official",
    status: "active",
    style: "cost-breakdown",
    description: "适合成本结构分析、降本增效方案、费用管控和责任矩阵汇报的专业财务经营模板。",
    themes: [
      {
        id: "cost-breakdown",
        name: "成本拆解",
        visual: {
          primary: "102A43",
          accent: "D59E3D",
          secondary: "2A9D8F",
          warning: "C8553D",
          background: "EEF3F6",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "334155",
          layout: "finance-cost-breakdown",
          variant: "cost-breakdown",
        },
      },
    ],
    visual: {
      primary: "102A43",
      accent: "D59E3D",
      secondary: "2A9D8F",
      warning: "C8553D",
      background: "EEF3F6",
      surface: "FFFFFF",
      title: "0B1F33",
      body: "334155",
      layout: "finance-cost-breakdown",
      variant: "cost-breakdown",
    },
    layoutSchema: COST_CONTROL_LAYOUT_SCHEMA,
  },
  {
    id: "cash-flow-analysis-report",
    name: "现金流分析报告",
    categoryId: "finance",
    scope: "official",
    status: "active",
    style: "cash-flow-forecast",
    description: "适合现金流预测、资金周转分析、回款管理和财务风险预警的专业财务模板。",
    themes: [
      {
        id: "cash-flow-forecast",
        name: "现金流预测",
        visual: {
          primary: "0F3D4A",
          accent: "20B486",
          secondary: "3A7BD5",
          warning: "E05F3F",
          background: "EAF4F2",
          surface: "FFFFFF",
          title: "082A35",
          body: "334155",
          layout: "finance-cash-flow-forecast",
          variant: "cash-flow-forecast",
        },
      },
    ],
    visual: {
      primary: "0F3D4A",
      accent: "20B486",
      secondary: "3A7BD5",
      warning: "E05F3F",
      background: "EAF4F2",
      surface: "FFFFFF",
      title: "082A35",
      body: "334155",
      layout: "finance-cash-flow-forecast",
      variant: "cash-flow-forecast",
    },
    layoutSchema: CASH_FLOW_FORECAST_LAYOUT_SCHEMA,
  },
  {
    id: "sales-proposal",
    name: "销售提案方案",
    categoryId: "sales",
    scope: "official",
    status: "active",
    style: "proposal",
    description: "适合客户提案、价值阐述、解决方案和下一步计划展示。",
    themes: [
      {
        id: "enterprise",
        name: "企业客户",
        visual: {
          primary: "14565A",
          accent: "D19A3E",
          background: "EEF7F6",
          surface: "FFFFFF",
          title: "123E42",
          body: "3E5A58",
          layout: "academy",
          variant: "enterprise",
        },
      },
      {
        id: "solution",
        name: "解决方案",
        visual: {
          primary: "123047",
          accent: "1AA6A6",
          secondary: "D99A2B",
          warning: "D9603B",
          background: "F4F7FA",
          surface: "FFFFFF",
          title: "0B2233",
          body: "40515F",
          layout: "sales-proposal-solution",
          variant: "solution",
        },
      },
      {
        id: "renewal",
        name: "续约增长",
        visual: {
          primary: "4B3F72",
          accent: "E0A33C",
          background: "F4F1FA",
          surface: "FFFFFF",
          title: "302A4D",
          body: "514A65",
          layout: "academy",
          variant: "renewal",
        },
      },
    ],
    visual: {
      primary: "0E5A57",
      accent: "C79A45",
      background: "EEF7F6",
      surface: "FCFEFD",
      title: "143E3D",
      body: "3E5A58",
      layout: "academy",
    },
    layoutSchema: ACADEMY_LAYOUT_SCHEMA,
  },
  {
    id: "key-account-plan",
    name: "大客户攻坚方案",
    categoryId: "sales",
    scope: "official",
    status: "active",
    style: "key-account-attack",
    description: "适合大客户销售、关键人识别、客户组织图、决策链路分析和赢单路径推进的商务作战模板。",
    themes: [
      {
        id: "decision-chain",
        name: "决策链路",
        visual: {
          primary: "102A43",
          accent: "F59E0B",
          secondary: "15A39A",
          warning: "E11D48",
          background: "EEF4F8",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "334155",
          layout: "sales-key-account-decision-chain",
          variant: "decision-chain",
        },
      },
    ],
    visual: {
      primary: "102A43",
      accent: "F59E0B",
      secondary: "15A39A",
      warning: "E11D48",
      background: "EEF4F8",
      surface: "FFFFFF",
      title: "0B1F33",
      body: "334155",
      layout: "sales-key-account-decision-chain",
      variant: "decision-chain",
    },
    layoutSchema: KEY_ACCOUNT_DECISION_LAYOUT_SCHEMA,
  },
  {
    id: "presales-technical-plan",
    name: "售前技术方案",
    categoryId: "sales",
    scope: "official",
    status: "active",
    style: "technical-blueprint",
    description: "适合售前方案、客户需求匹配、技术架构说明和交付保障汇报的技术型销售方案模板。",
    themes: [
      {
        id: "architecture-solution",
        name: "架构方案",
        visual: {
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
      },
    ],
    visual: {
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
    layoutSchema: PRESALES_ARCHITECTURE_LAYOUT_SCHEMA,
  },
  {
    id: "sales-training-course",
    name: "销售培训课件",
    categoryId: "sales",
    scope: "official",
    status: "active",
    style: "sales-roleplay-training",
    description: "适合销售培训、客户异议处理、话术框架拆解和场景演练的实战训练课件模板。",
    themes: [
      {
        id: "objection-handling",
        name: "异议处理",
        visual: {
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
      },
    ],
    visual: {
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
    layoutSchema: SALES_TRAINING_OBJECTION_LAYOUT_SCHEMA,
  },
  {
    id: "product-roadmap",
    name: "产品路线规划",
    categoryId: "product",
    scope: "official",
    status: "active",
    style: "product-strategy-roadmap",
    description: "适合产品路线图汇报、阶段目标、能力建设、里程碑、资源投入和跨团队协同沟通。",
    themes: [
      {
        id: "roadmap",
        name: "路线图",
        visual: {
          primary: "0B1F3A",
          accent: "14B8A6",
          secondary: "F59E0B",
          warning: "DC2626",
          background: "F6FAFC",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "product-strategy-roadmap",
          variant: "roadmap",
        },
      },
      {
        id: "release",
        name: "版本发布",
        visual: {
          primary: "0B1F3A",
          accent: "14B8A6",
          secondary: "F59E0B",
          warning: "DC2626",
          background: "EEF4F8",
          surface: "FFFFFF",
          title: "0A1730",
          body: "405166",
          layout: "product-release-committee",
          variant: "release",
        },
      },
      {
        id: "product-review",
        name: "产品复盘",
        visual: {
          primary: "173B3A",
          accent: "20B486",
          secondary: "F59E0B",
          warning: "E76F51",
          background: "F4F7F6",
          surface: "FFFFFF",
          title: "102A2A",
          body: "405A58",
          layout: "product-review-canvas",
          variant: "product-review",
        },
      },
    ],
    visual: {
      primary: "0B1F3A",
      accent: "14B8A6",
      secondary: "F59E0B",
      warning: "DC2626",
      background: "F6FAFC",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "product-strategy-roadmap",
      variant: "roadmap",
    },
    layoutSchema: {
      defaultCoverLayout: "product-strategy-roadmap-cover",
      defaultContentLayout: "product-strategy-roadmap-content",
      allowedLayouts: [
        "product-strategy-roadmap-cover",
        "product-strategy-roadmap-overview",
        "product-strategy-roadmap-capabilities",
        "product-strategy-roadmap-milestones",
        "product-strategy-roadmap-dependencies",
        "product-strategy-roadmap-priority",
        "product-strategy-roadmap-closing",
        "product-strategy-roadmap-content",
        "product-review-cover",
        "product-review-content",
        "goal-result-compare",
        "behavior-change",
        "feature-adoption",
        "feedback-cluster",
        "root-cause",
        "iteration-hypothesis",
        "product-review-closing",
        "title",
        "content",
        "closing",
      ],
    },
  },
  {
    id: "product-commercialization-plan",
    name: "产品商业化方案",
    categoryId: "product",
    scope: "official",
    status: "active",
    style: "product-commercialization",
    description: "适合产品定价设计、套餐权益说明、商业化路径和收入模型汇报的产品规划类官方模板。",
    themes: [
      {
        id: "pricing-strategy",
        name: "定价策略",
        visual: {
          primary: "14213D",
          accent: "F4B740",
          secondary: "2EC4B6",
          warning: "EF476F",
          background: "F3F6FA",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "334155",
          layout: "product-pricing-strategy",
          variant: "pricing-strategy",
        },
      },
    ],
    visual: {
      primary: "14213D",
      accent: "F4B740",
      secondary: "2EC4B6",
      warning: "EF476F",
      background: "F3F6FA",
      surface: "FFFFFF",
      title: "0B1F33",
      body: "334155",
      layout: "product-pricing-strategy",
      variant: "pricing-strategy",
    },
    layoutSchema: PRODUCT_COMMERCIALIZATION_LAYOUT_SCHEMA,
  },
  {
    id: "user-research-report",
    name: "用户研究报告",
    categoryId: "product",
    scope: "official",
    status: "active",
    style: "product-research",
    description: "适合用户访谈总结、用户画像、需求机会识别和产品优化建议的产品研究类模板。",
    themes: [
      {
        id: "interview-insight",
        name: "访谈洞察",
        visual: {
          primary: "155E75",
          accent: "F59E0B",
          secondary: "7C3AED",
          background: "F6F8FB",
          surface: "FFFFFF",
          title: "132238",
          body: "475569",
          layout: "product-interview-insight",
          variant: "interview-insight",
        },
      },
    ],
    visual: {
      primary: "155E75",
      accent: "F59E0B",
      secondary: "7C3AED",
      background: "F6F8FB",
      surface: "FFFFFF",
      title: "132238",
      body: "475569",
      layout: "product-interview-insight",
      variant: "interview-insight",
    },
    layoutSchema: PRODUCT_INTERVIEW_INSIGHT_LAYOUT_SCHEMA,
  },
  {
    id: "marketing-campaign",
    name: "营销活动方案",
    categoryId: "marketing",
    scope: "official",
    status: "active",
    style: "campaign-story",
    description: "适合新品发布、品牌传播、增长营销和渠道活动复盘的商业化市场营销模板。",
    themes: [
      {
        id: "launch",
        name: "新品发布",
        visual: {
          primary: "0B1020",
          accent: "FF3B5C",
          secondary: "22D3EE",
          warning: "F8C14A",
          background: "0B1020",
          surface: "FFFFFF",
          title: "F8FAFC",
          body: "CBD5E1",
          layout: "marketing-product-premiere",
          variant: "product-premiere",
        },
      },
      {
        id: "brand",
        name: "品牌传播",
        visual: {
          primary: "172033",
          accent: "E64B6A",
          secondary: "21A6A1",
          background: "F5F7FA",
          surface: "FFFFFF",
          title: "101827",
          body: "334155",
          layout: "marketing-brand-communication-console",
          variant: "brand-console",
        },
      },
      {
        id: "growth",
        name: "增长营销",
        visual: {
          primary: "047857",
          accent: "F97316",
          background: "ECFDF5",
          surface: "FFFFFF",
          title: "063327",
          body: "36594F",
          layout: "growth-marketing-lab",
          variant: "growth-lab",
        },
      },
    ],
    visual: {
      primary: "0B1020",
      accent: "FF3B5C",
      secondary: "22D3EE",
      warning: "F8C14A",
      background: "0B1020",
      surface: "FFFFFF",
      title: "F8FAFC",
      body: "CBD5E1",
      layout: "marketing-product-premiere",
      variant: "product-premiere",
    },
    layoutSchema: MARKETING_LAYOUT_SCHEMA,
  },
  {
    id: "data-insight",
    name: "数据洞察报告",
    categoryId: "data",
    scope: "official",
    status: "active",
    style: "analytics-report",
    description: "适合指标解读、数据发现、分析结论和行动建议。",
    themes: [
      {
        id: "dashboard",
        name: "仪表盘",
        visual: {
          primary: "07111F",
          accent: "36C5F0",
          secondary: "22C55E",
          warning: "F59E0B",
          danger: "EF4444",
          background: "07111F",
          surface: "101D31",
          title: "E5EDF7",
          body: "93A4B8",
          layout: "data-insight-dashboard-console",
          variant: "dashboard",
        },
      },
      {
        id: "insight",
        name: "洞察分析",
        visual: {
          primary: "172554",
          accent: "F59E0B",
          secondary: "14B8A6",
          warning: "EF4444",
          background: "F6F8FB",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "data-insight-workbench",
          variant: "insight",
        },
      },
      {
        id: "research",
        name: "研究报告",
        visual: {
          primary: "172033",
          accent: "315C7C",
          secondary: "B8822D",
          background: "F7F5EF",
          surface: "FFFFFF",
          title: "172033",
          body: "46515E",
          layout: "data-research-report",
          variant: "research",
        },
      },
    ],
    visual: {
      primary: "07111F",
      accent: "36C5F0",
      secondary: "22C55E",
      warning: "F59E0B",
      danger: "EF4444",
      background: "07111F",
      surface: "101D31",
      title: "E5EDF7",
      body: "93A4B8",
      layout: "data-insight-dashboard-console",
      variant: "dashboard",
    },
    // 数据洞察仪表盘使用管理驾驶舱专属页面类型，避免回落到普通三段式内容页。
    layoutSchema: {
      defaultCoverLayout: "data-console-cover",
      defaultContentLayout: "data-console-overview",
      allowedLayouts: ["data-console-cover", "data-console-overview", "data-console-trend", "data-console-alert", "data-console-ranking", "data-console-action", "title", "content", "closing"],
    },
  },
  {
    id: "channel-data-analysis",
    name: "渠道数据分析",
    categoryId: "data",
    scope: "official",
    status: "active",
    style: "channel-quality-diagnosis",
    description: "适合渠道来源分析、投放质量评估、转化链路诊断和渠道优化建议的数据洞悉官方模板。",
    themes: [
      {
        id: "traffic-quality",
        name: "流量质量",
        visual: {
          primary: "172554",
          accent: "22C55E",
          secondary: "38BDF8",
          warning: "F59E0B",
          danger: "EF4444",
          background: "F3F7FB",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "channel-traffic-quality",
          variant: "traffic-quality",
        },
      },
    ],
    visual: {
      primary: "172554",
      accent: "22C55E",
      secondary: "38BDF8",
      warning: "F59E0B",
      danger: "EF4444",
      background: "F3F7FB",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "channel-traffic-quality",
      variant: "traffic-quality",
    },
    layoutSchema: CHANNEL_TRAFFIC_QUALITY_LAYOUT_SCHEMA,
  },
  {
    id: "education",
    name: "教育培训课件",
    categoryId: "education",
    scope: "official",
    status: "active",
    style: "learning-workshop",
    description: "适合课程讲义、培训工作坊和知识分享的清晰课件模板。",
    themes: [
      {
        id: "lecture",
        name: "课题讲授",
        visual: {
          primary: "214E44",
          accent: "E6B84F",
          background: "EEF5F0",
          surface: "FFFEF7",
          title: "17352F",
          body: "415A53",
          layout: "education-course",
          variant: "lecture",
        },
      },
      {
        id: "workshop",
        name: "互动工作坊",
        visual: {
          primary: "3F4A8A",
          accent: "F28C6B",
          background: "F3F1FA",
          surface: "FFFFFF",
          title: "20264B",
          body: "515A7A",
          layout: "education-course",
          variant: "workshop",
        },
      },
      {
        id: "minimal",
        name: "简洁教学",
        visual: {
          primary: "2F5D73",
          accent: "7BBE9A",
          background: "F1F6F7",
          surface: "FFFFFF",
          title: "183544",
          body: "4B626B",
          layout: "education-course",
          variant: "minimal",
        },
      },
    ],
    visual: {
      primary: "214E44",
      accent: "E6B84F",
      background: "EEF5F0",
      surface: "FFFEF7",
      title: "17352F",
      body: "415A53",
      layout: "education-course",
      variant: "lecture",
    },
    layoutSchema: ACADEMY_LAYOUT_SCHEMA,
  },
  {
    id: "pitch",
    name: "创业融资路演",
    categoryId: "pitch",
    scope: "official",
    status: "active",
    style: "venture-story",
    description: "适合投资人沟通、创业项目介绍和商业计划书展示。",
    themes: [
      {
        id: "startup",
        name: "创业故事",
        visual: {
          primary: "16213E",
          accent: "F59E0B",
          background: "F7F1E8",
          surface: "FFFDF8",
          title: "121826",
          body: "3F4652",
          layout: "venture",
          variant: "startup",
        },
      },
      {
        id: "investor",
        name: "投资人版",
        visual: {
          primary: "101828",
          accent: "12B76A",
          background: "F8FAFC",
          surface: "FFFFFF",
          title: "101828",
          body: "475467",
          secondary: "F79009",
          layout: "pitch-investor-memo",
          variant: "investor",
        },
      },
      {
        id: "product",
        name: "产品亮点",
        visual: {
          primary: "0F172A",
          accent: "14B8A6",
          secondary: "22C55E",
          warning: "F59E0B",
          background: "F8FAFC",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "startup-product-highlights",
          variant: "product-highlights",
        },
      },
    ],
    visual: {
      primary: "111827",
      accent: "D96C3B",
      background: "F4EFE8",
      surface: "FFFEFC",
      title: "111827",
      body: "3F4652",
      layout: "venture",
      variant: "startup",
    },
    layoutSchema: PITCH_DECK_LAYOUT_SCHEMA,
  },
  {
    id: "investment-attraction-financing-plan",
    name: "招商融资方案",
    categoryId: "pitch",
    scope: "official",
    status: "active",
    style: "pitch-project-return",
    description: "适合项目招商、收益测算、合作模式说明和融资方案汇报。",
    themes: [
      {
        id: "project-return",
        name: "项目收益",
        visual: {
          primary: "111827",
          accent: "D6A84F",
          secondary: "1FB6A6",
          warning: "F59E0B",
          background: "E8EEF3",
          surface: "FFFFFF",
          title: "0F172A",
          body: "3A4656",
          layout: "pitch-project-return",
          variant: "project-return",
        },
      },
    ],
    visual: {
      primary: "111827",
      accent: "D6A84F",
      secondary: "1FB6A6",
      warning: "F59E0B",
      background: "E8EEF3",
      surface: "FFFFFF",
      title: "0F172A",
      body: "3A4656",
      layout: "pitch-project-return",
      variant: "project-return",
    },
    layoutSchema: {
      defaultCoverLayout: "pitch-project-return-cover",
      defaultContentLayout: "project-value-map",
      allowedLayouts: [
        "pitch-project-return-cover",
        "project-value-map",
        "return-calculation-model",
        "partner-rights-matrix",
        "cooperation-path",
        "funding-use-plan",
        "pitch-project-return-closing",
      ],
    },
  },
  {
    id: "brand-story",
    name: "品牌故事叙事",
    categoryId: "marketing",
    scope: "official",
    status: "active",
    style: "brand-narrative",
    description: "适合品牌定位、信息架构、客户故事和传播叙事。",
    themes: [
      {
        id: "editorial",
        name: "编辑叙事",
        visual: {
          primary: "2A2F3F",
          accent: "C7825A",
          background: "F6F1EA",
          surface: "FFFDFC",
          title: "171B26",
          body: "4A5160",
          layout: "brand-story-editorial",
          variant: "editorial",
        },
      },
      {
        id: "premium",
        name: "高端质感",
        visual: {
          primary: "181C24",
          accent: "BFA06A",
          background: "F6F1E8",
          surface: "FFFEFA",
          title: "151922",
          body: "474B55",
          secondary: "D8C7A5",
          layout: "luxury-brand-story",
          variant: "premium",
        },
      },
      {
        id: "identity",
        name: "品牌识别",
        visual: {
          primary: "121826",
          accent: "D84B3F",
          secondary: "D7A43A",
          background: "F6F0E7",
          surface: "FFFFFF",
          title: "111827",
          body: "4B5563",
          layout: "brand-identity-system",
          variant: "identity-manual",
        },
      },
    ],
    visual: {
      primary: "2A2F3F",
      accent: "C7825A",
      background: "F6F1EA",
      surface: "FFFDFC",
      title: "171B26",
      body: "4A5160",
      layout: "brand-story-editorial",
      variant: "editorial",
    },
    layoutSchema: VENTURE_LAYOUT_SCHEMA,
  },
  {
    id: "project-status",
    name: "项目状态汇报",
    categoryId: "business",
    scope: "official",
    status: "active",
    style: "status-update",
    description: "适合项目进展、风险依赖、里程碑和管理层周报。",
    themes: [
      {
        id: "weekly",
        name: "周报进展",
        visual: {
          primary: "163D59",
          accent: "2AA7A5",
          background: "EEF2F6",
          surface: "FFFFFF",
          title: "102A43",
          body: "334155",
          layout: "status-report",
          variant: "weekly",
        },
      },
      {
        id: "steering",
        name: "例会汇报",
        visual: {
          primary: "1F2F46",
          accent: "D59E3D",
          background: "EEF2F6",
          surface: "FFFFFF",
          title: "111827",
          body: "3F4A5A",
          layout: "status-report",
          variant: "steering",
        },
      },
      {
        id: "delivery",
        name: "交付跟踪",
        visual: {
          primary: "12324A",
          accent: "2BA6A0",
          background: "EEF2F6",
          surface: "FFFFFF",
          title: "0F2637",
          body: "3D5563",
          layout: "status-report",
          variant: "delivery",
        },
      },
    ],
    visual: {
      primary: "203F57",
      accent: "C7A03A",
      background: "EEF3F6",
      surface: "FCFEFF",
      title: "172B3B",
      body: "465866",
      layout: "executive",
    },
    layoutSchema: EXECUTIVE_LAYOUT_SCHEMA,
  },
];

const DEFAULT_VISUAL = DEFAULT_TEMPLATES[0].visual;

/**
 * Registry for PPT template metadata.
 */
export class TemplateManager {
  /**
   * Creates a template manager.
   * @param {{templates?: object[], categories?: object[], database?: object}} input
   */
  constructor({ templates = DEFAULT_TEMPLATES, categories = DEFAULT_TEMPLATE_CATEGORIES, database = null } = {}) {
    this.templates = templates;
    this.categories = categories;
    this.database = database;
  }

  /**
   * Lists all available templates.
   * @param {{ownerUserId?: number, categoryId?: string}} input
   * @returns {object[]}
   */
  listTemplates({ ownerUserId, categoryId } = {}) {
    return this.#visibleTemplates({ ownerUserId, categoryId });
  }

  /**
   * Lists template categories that still have at least one visible template.
   * @param {{ownerUserId?: number}} input
   * @returns {object[]}
   */
  listCategories({ ownerUserId } = {}) {
    const usedCategoryIds = new Set(
      this.#rawVisibleTemplates({ ownerUserId }).map((template) => resolveCategoryId(template)),
    );
    return this.#allCategories()
      .filter((category) => usedCategoryIds.has(category.id))
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  }

  /**
   * Returns one template by ID.
   * @param {string} templateId
   * @param {{ownerUserId?: number}} input
   * @returns {object}
   */
  getTemplate(templateId, { ownerUserId } = {}) {
    const lookupId = normalizeTemplateLookupId(templateId);
    const template = this.#visibleTemplates({ ownerUserId }).find((item) => item.id === templateId || item.id === lookupId);
    if (!template) throw new AppError({ code: "TEMPLATE_NOT_FOUND", status: 404, message: "Template not found" });
    return template;
  }

  /**
   * Returns visible official templates and the current user's active templates.
   * @param {{ownerUserId?: number, categoryId?: string}} input
   * @returns {object[]}
   */
  #visibleTemplates({ ownerUserId, categoryId } = {}) {
    const categories = this.#allCategories();
    return dedupeById(this.#rawVisibleTemplates({ ownerUserId, categoryId })).map((template) => normalizeTemplate(template, categories));
  }

  /**
   * Returns visible template records before API normalization.
   * @param {{ownerUserId?: number, categoryId?: string}} input
   * @returns {object[]}
   */
  #rawVisibleTemplates({ ownerUserId, categoryId } = {}) {
    const databaseTemplates = this.#databaseTemplates();
    const hasDatabaseOfficialTemplates = databaseTemplates.some((template) => (
      (template.scope || "official") === "official"
      && template.official === true
      && (template.status || "active") === "active"
      && !isOpenSourceTemplate(template)
    ));
    // 数据库已同步官方模板时，优先使用目录化模板，避免和内置 fallback 模板重复展示。
    const fallbackTemplates = hasDatabaseOfficialTemplates
      ? this.templates.filter((template) => (template.scope || "official") !== "official")
      : this.templates;
    return [...fallbackTemplates, ...databaseTemplates].filter((template) => {
      const status = template.status || "active";
      const scope = template.scope || "official";
      if (status !== "active") return false;
      if (scope === "user" && Number(template.ownerUserId ?? template.owner_user_id) !== Number(ownerUserId)) return false;
      if (scope !== "official" && scope !== "user") return false;
      if (isOpenSourceTemplate(template)) return false;
      if (categoryId && resolveCategoryId(template) !== categoryId) return false;
      return true;
    });
  }

  /**
   * Reads template records from the JSON database when the collection exists.
   * @returns {object[]}
   */
  #databaseTemplates() {
    return Array.isArray(this.database?.state?.templates) ? this.database.state.templates : [];
  }

  /**
   * Reads template category records from the JSON database when the collection exists.
   * @returns {object[]}
   */
  #databaseCategories() {
    return Array.isArray(this.database?.state?.template_categories) ? this.database.state.template_categories : [];
  }

  /**
   * Returns all known category records before removing empty categories.
   * @returns {object[]}
   */
  #allCategories() {
    return dedupeById([...this.categories, ...this.#databaseCategories()]);
  }
}

/**
 * Resolves presentation visual settings for a deck or template.
 * @param {{templateId?: string, template?: object, visual?: object, theme?: string}} input
 * @returns {{id: string, name: string, primary: string, accent: string, background: string, surface: string, title: string, body: string, layout: string, variant: string}}
 */
export function resolveTemplateVisual(input = {}) {
  const request = typeof input === "string" ? { templateId: input } : (input || {});
  const requestedTemplateId = normalizeTemplateLookupId(request.templateId);
  const baseTemplate = DEFAULT_TEMPLATES.find((item) => item.id === requestedTemplateId) || DEFAULT_TEMPLATES[0];
  const templateOverrides = request.template ? removeUndefinedValues(request.template) : null;
  const selectedTheme = String(request.theme || "").trim();
  // 非 business 官方模板的主题风格是模板版式来源，必须优先于 deck 里可能过期的 visual 快照。
  // business 下存在 red-gold 这类依赖 visual 快照的历史模板，不能被 modern/minimal 主题强行覆盖。
  const officialThemeVisual = baseTemplate.id !== "business" ? resolveThemeVisual(baseTemplate.themes || [], selectedTheme) : null;
  const template = request.template
    ? {
      ...baseTemplate,
      ...templateOverrides,
      visual: { ...(baseTemplate.visual || {}), ...(templateOverrides.visual || {}) },
    }
    : (request.visual ? { ...baseTemplate, visual: { ...(baseTemplate.visual || {}), ...request.visual } } : baseTemplate);
  const hasVisualOverride = hasVisualOverrideAgainstBase(template.visual, baseTemplate.visual || {});
  const themeVisual = officialThemeVisual || (!hasVisualOverride ? resolveThemeVisual(template.themes || baseTemplate.themes || [], selectedTheme) : null);
  const mergedVisual = { ...template.visual, ...(templateOverrides?.visual || {}), ...(themeVisual || {}) };
  const visual = { ...DEFAULT_VISUAL, ...(mergedVisual || {}) };
  return {
    id: template.id || "business",
    name: template.name || "Business",
    primary: normalizeHex(visual.primary, DEFAULT_VISUAL.primary),
    accent: normalizeHex(visual.accent, DEFAULT_VISUAL.accent),
    secondary: normalizeHex(visual.secondary, visual.accent || DEFAULT_VISUAL.accent),
    warning: normalizeHex(visual.warning, visual.secondary || visual.accent || DEFAULT_VISUAL.accent),
    background: normalizeHex(visual.background, DEFAULT_VISUAL.background),
    surface: normalizeHex(visual.surface, DEFAULT_VISUAL.surface),
    title: normalizeHex(visual.title, DEFAULT_VISUAL.title),
    body: normalizeHex(visual.body, DEFAULT_VISUAL.body),
    layout: visual.layout || DEFAULT_VISUAL.layout,
    variant: typeof visual.variant === "string" ? visual.variant : "",
  };
}

function normalizeTemplateLookupId(templateId) {
  const id = String(templateId || "").trim();
  // 官方模板同步后的 slug 会带分类和主题后缀，运行时只拿到 slug 时也要回到对应的内置模板视觉。
  const officialTemplateAliases = {
    "finance-cost-control-plan-cost-breakdown": "cost-control-plan",
    "finance-cash-flow-analysis-report-cash-flow-forecast": "cash-flow-analysis-report",
    "sales-key-account-plan-decision-chain": "key-account-plan",
    "sales-presales-technical-plan-architecture-solution": "presales-technical-plan",
    "sales-sales-training-course-objection-handling": "sales-training-course",
    "product-product-roadmap-roadmap": "product-roadmap",
    "product-product-commercialization-plan-pricing-strategy": "product-commercialization-plan",
    "product-user-research-report-interview-insight": "user-research-report",
    "data-channel-data-analysis-traffic-quality": "channel-data-analysis",
    "data-data-insight-dashboard": "data-insight",
    "data-data-insight-research": "data-insight",
    "marketing-marketing-campaign-launch": "marketing-campaign",
    "marketing-marketing-campaign-brand": "marketing-campaign",
    "marketing-marketing-campaign-growth": "marketing-campaign",
  };
  return officialTemplateAliases[id] || id;
}

function resolveThemeVisual(themes, themeId) {
  if (!themeId || !Array.isArray(themes) || themes.length === 0) return null;
  const match = themes.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const id = String(candidate.id || candidate.value || candidate.name || "").trim();
    return id === themeId;
  });
  if (!match || typeof match.visual !== "object") return null;
  return normalizeThemeVisual(match.visual);
}

function hasVisualOverrideAgainstBase(visual, baseVisual) {
  if (!visual || !baseVisual) return false;
  const keys = ["primary", "accent", "background", "surface", "title", "body", "layout"];
  for (const key of keys) {
    if (key === "layout") {
      if (String(visual.layout || "").trim() !== String(baseVisual.layout || "").trim()) return true;
      continue;
    }
    if (normalizeHex(visual[key] || "") !== normalizeHex(baseVisual[key] || "")) return true;
  }
  return false;
}

function normalizeThemeVisual(themeVisual) {
  return {
    primary: normalizeHex(themeVisual.primary),
    accent: normalizeHex(themeVisual.accent),
    secondary: normalizeHex(themeVisual.secondary),
    warning: normalizeHex(themeVisual.warning),
    background: normalizeHex(themeVisual.background),
    surface: normalizeHex(themeVisual.surface),
    title: normalizeHex(themeVisual.title),
    body: normalizeHex(themeVisual.body),
    layout: typeof themeVisual.layout === "string" ? themeVisual.layout : "",
    variant: typeof themeVisual.variant === "string" ? themeVisual.variant : "",
  };
}

/**
 * Normalizes a template record for API, generation, preview, and export consumers.
 * @param {object} template
 * @param {object[]} categories
 * @returns {object}
 */
function normalizeTemplate(template, categories) {
  const categoryId = resolveCategoryId(template);
  const category = categories.find((item) => item.id === categoryId) || { id: categoryId, name: categoryId || "General" };
  return {
    ...template,
    categoryId,
    category,
    scope: template.scope || "official",
    status: template.status || "active",
    themes: normalizeThemes(template.themes),
    visual: { ...DEFAULT_VISUAL, ...(template.visual || {}) },
    layoutSchema: normalizeLayoutSchema(template.layoutSchema),
  };
}

/**
 * Resolves a template category ID.
 * @param {object} template
 * @returns {string}
 */
function resolveCategoryId(template) {
  return template.categoryId || template.category_id || template.category?.id || "business";
}

/**
 * 判断模板是否属于历史开源样例模板，避免不好看的开源模板重新出现在前台。
 * @param {object} template
 * @returns {boolean}
 */
function isOpenSourceTemplate(template) {
  const source = template?.source && typeof template.source === "object" ? template.source : {};
  const values = [
    template?.id,
    template?.slug,
    template?.name,
    template?.description,
    template?.sourceType,
    template?.source_type,
    template?.license,
    template?.sourceLicense,
    template?.source_license,
    source.type,
    source.repository,
    source.license,
    source.file,
  ].map((value) => String(value || "").toLowerCase());
  return values.some((value) => (
    value.includes("开源")
    || value.includes("open-source")
    || value.includes("opensource")
    || value.includes("open source")
    || value.includes("城市展示")
    || value.includes("通用演示")
    || value.includes("city-showcase")
    || value.includes("general-demo")
  ));
}

/**
 * Normalizes theme config while accepting legacy string themes.
 * @param {unknown} themes
 * @returns {{id: string, name: string}[]}
 */
function normalizeThemes(themes) {
  const values = Array.isArray(themes) && themes.length ? themes : ["modern"];
  return values.map((theme) => {
    if (theme && typeof theme === "object") {
      const id = String(theme.id || theme.value || theme.name || "").trim();
      return { ...theme, id, name: theme.name || id };
    }
    const id = String(theme || "").trim();
    return { id, name: id };
  }).filter((theme) => theme.id);
}

/**
 * Normalizes template layout schema.
 * @param {unknown} layoutSchema
 * @returns {{defaultCoverLayout: string, defaultContentLayout: string, allowedLayouts: string[]}}
 */
function normalizeLayoutSchema(layoutSchema) {
  const schema = layoutSchema && typeof layoutSchema === "object" ? layoutSchema : {};
  const defaultCoverLayout = String(schema.defaultCoverLayout || "title");
  const defaultContentLayout = String(schema.defaultContentLayout || "content");
  const allowedLayouts = Array.isArray(schema.allowedLayouts) && schema.allowedLayouts.length
    ? schema.allowedLayouts.map((layout) => String(layout))
    : [defaultCoverLayout, defaultContentLayout];
  return { ...schema, defaultCoverLayout, defaultContentLayout, allowedLayouts };
}

/**
 * Deduplicates records by stable ID while preserving first-seen order.
 * @param {object[]} records
 * @returns {object[]}
 */
function dedupeById(records) {
  const seen = new Set();
  const result = [];
  for (const record of records) {
    if (!record?.id || seen.has(record.id)) continue;
    seen.add(record.id);
    result.push(record);
  }
  return result;
}

/**
 * Removes undefined/null fields so partial template snapshots do not erase built-in metadata.
 * @param {object} value
 * @returns {object}
 */
function removeUndefinedValues(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, entry]) => entry !== undefined && entry !== null));
}

/**
 * Returns a safe six-digit uppercase hex value without a leading hash.
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function normalizeHex(value, fallback) {
  const normalized = String(value || "").replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}
