import assert from "node:assert/strict";
import { test } from "node:test";

import { PptExportService } from "../../src/ppt-exporter.js";
import { PptService } from "../../src/ppt-service.js";
import { TemplateManager } from "../../src/templates.js";

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
