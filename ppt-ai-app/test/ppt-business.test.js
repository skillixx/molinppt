import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app.js";
import { MockAiProvider } from "../src/ai-provider.js";
import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage } from "../src/files.js";
import { PromptManager } from "../src/prompt-manager.js";
import { PptExportService } from "../src/ppt-exporter.js";
import { PptService } from "../src/ppt-service.js";
import { MemoryTaskCenter } from "../src/tasks.js";
import { TemplateManager } from "../src/templates.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-ai-business-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("PptService completes topic to outline to editable deck to PPTX/PDF with billing and logs", async () => {
  const context = await createBusinessContext();

  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "AI sales enablement",
    slideCount: 3,
    templateId: "business",
    theme: "modern",
  });
  const edited = await context.pptService.updateOutline({
    ownerUserId: 7,
    outlineId: outline.id,
    slides: [
      { title: "Market context", bullets: ["Demand is shifting"] },
      { title: "AI workflow", bullets: ["Automate research"] },
      { title: "Next steps", bullets: ["Pilot with sales"] },
    ],
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: edited.id,
    entitlementId: 88,
  });
  const regenerated = await context.pptService.regenerateSlide({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    slideId: deckResult.deck.slides[1].id,
    instruction: "Make this more executive friendly",
    entitlementId: 88,
  });
  const pptx = await context.pptService.exportDeck({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    format: "pptx",
  });
  const pdf = await context.pptService.exportDeck({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    format: "pdf",
  });

  assert.equal(outline.status, "outline_ready");
  assert.equal(deckResult.task.status, "succeeded");
  assert.equal(deckResult.task.progress, 100);
  assert.equal(deckResult.deck.slides.length, 3);
  assert.equal(regenerated.slide.title.includes("executive"), true);
  assert.equal(pptx.file.mimeType, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.equal(pdf.file.mimeType, "application/pdf");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle", "balance", "reserve", "settle"]);
  assert.equal((await context.database.find("call_logs")).length >= 5, true);
});

test("PptService prefers rendered PPTX preview when a renderer is available", async () => {
  const renderCalls = [];
  const pptPreviewRenderer = {
    render: async (input) => {
      renderCalls.push(input);
      return "<!doctype html><body data-preview-source=\"rendered-pptx\">真实 PPTX</body>";
    },
  };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Rendered preview source",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /data-preview-source="rendered-pptx"/);
  assert.equal(renderCalls.length, 1);
  assert.equal(renderCalls[0].deck.id, deck.id);
  assert.equal(Buffer.isBuffer(renderCalls[0].pptx), true);
  assert.match(renderCalls[0].fileName, /\.pptx$/);
});

test("PptService falls back to HTML preview when PPTX renderer is unavailable", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Fallback preview source",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /Fallback preview source/);
  assert.doesNotMatch(preview, /data-preview-source="rendered-pptx"/);
});

test("PptService renders commercial template theme chips as decorative elements in HTML preview", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Market launch plan",
    slideCount: 2,
    templateId: "marketing-campaign",
    theme: "launch",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  // 主题风格名只保留在选择器里，预览页的角标只作为装饰图形存在。
  assert.match(preview, /<div class="marketing-chip" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(preview, /<div class="marketing-chip">/);
});

test("PptService applies a new template to an existing deck preview", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "季度经营复盘",
    slideCount: 4,
    templateId: "business",
    theme: "modern",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const updated = await context.pptService.applyTemplateToDeck({
    ownerUserId: 7,
    deckId: deck.id,
    templateId: "project-status",
    theme: "weekly",
  });
  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });
  const asset = await context.database.findOne("ppt_assets", (item) => item.deckId === deck.id);

  assert.equal(updated.templateId, "project-status");
  assert.equal(updated.theme, "weekly");
  assert.equal(asset.templateId, "project-status");
  assert.match(preview, /<body data-template="project-status" data-layout="status-report"/);
  assert.match(preview, /status-report-photo/);
  assert.doesNotMatch(preview, /<body[^>]+data-layout="top-band"/);
});

test("PptService renders industry research landscape preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "新能源汽车行业研究",
    slideCount: 6,
    templateId: "industry-research",
    theme: "industry-landscape",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="industry-research" data-layout="industry-research"/);
  assert.match(preview, /industry-map/);
  assert.match(preview, /industry-chain/);
  assert.match(preview, /industry-matrix/);
  assert.match(preview, /industry-opportunity-grid/);
  assert.doesNotMatch(preview, /<body[^>]+data-layout="top-band"/);
  assert.doesNotMatch(preview, />行业格局</);
});

test("PptService renders industry trend forecast preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "AI 应用行业趋势研判",
    slideCount: 5,
    templateId: "industry-research",
    theme: "trend-forecast",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="industry-research" data-layout="industry-trend-forecast"/);
  assert.match(preview, /trend-layer/);
  assert.match(preview, /trend-curve/);
  assert.match(preview, /trend-signal-grid/);
  assert.match(preview, /trend-driver-wheel|trend-risk-grid|trend-roadmap/);
  assert.doesNotMatch(preview, />趋势判断</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced industry research slug preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertIndustryResearchSlugTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "季度经营复盘",
    slideCount: 3,
    templateId: "strategy-industry-research-industry-landscape",
    theme: "industry-landscape",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="strategy-industry-research-industry-landscape" data-layout="industry-research"/);
  assert.match(preview, /<div class="industry-layer">/);
  assert.match(preview, /industry-map/);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced industry trend forecast slug preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertIndustryTrendForecastTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "AI 应用行业趋势研判",
    slideCount: 4,
    templateId: "strategy-industry-research-trend-forecast",
    theme: "trend-forecast",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="strategy-industry-research-trend-forecast" data-layout="industry-trend-forecast"/);
  assert.match(preview, /<div class="trend-layer">/);
  assert.match(preview, /trend-curve/);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced competition map preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertCompetitionMapTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "智能硬件竞品分析",
    slideCount: 6,
    templateId: "strategy-industry-research-competition-map",
    theme: "competition-map",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="strategy-industry-research-competition-map" data-layout="strategy-competition-map"/);
  assert.match(preview, /competition-layer/);
  assert.match(preview, /competition-map/);
  assert.match(preview, /competition-player-grid|competition-positioning|competition-segments/);
  assert.doesNotMatch(preview, />竞争地图</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders market entry strategy preview with dedicated region layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "华东区域市场进入策略",
    slideCount: 6,
    templateId: "market-entry-strategy",
    theme: "region-entry",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="market-entry-strategy" data-layout="strategy-region-entry"/);
  assert.match(preview, /region-entry-layer/);
  assert.match(preview, /region-entry-map/);
  assert.match(preview, /region-entry-path|region-entry-segments|region-entry-channels/);
  assert.doesNotMatch(preview, />区域进入</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders enterprise digital blueprint preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertEnterpriseDigitalBlueprintTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "集团数字化转型规划",
    slideCount: 6,
    templateId: "strategy-enterprise-transformation-digital-blueprint",
    theme: "digital-blueprint",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="strategy-enterprise-transformation-digital-blueprint" data-layout="enterprise-digital-blueprint"/);
  assert.match(preview, /enterprise-blueprint-layer/);
  assert.match(preview, /enterprise-blueprint-grid/);
  assert.match(preview, /enterprise-blueprint-stack|enterprise-blueprint-capabilities|enterprise-blueprint-roadmap|enterprise-blueprint-network/);
  assert.match(preview, /DIGITAL TRANSFORMATION BLUEPRINT|CURRENT STATE DIAGNOSIS|TARGET ARCHITECTURE|CAPABILITY UPGRADE/);
  assert.doesNotMatch(preview, />数字化蓝图</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders competitor SWOT map preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "智能硬件竞品 SWOT 分析",
    slideCount: 6,
    templateId: "competitor-analysis",
    theme: "swot-map",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="competitor-analysis" data-layout="strategy-swot-map"/);
  assert.match(preview, /swot-layer/);
  assert.match(preview, /swot-quadrant/);
  assert.match(preview, /swot-axis|swot-compare|swot-risk-grid|swot-strategy-roadmap/);
  assert.doesNotMatch(preview, />SWOT 地图</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders second curve strategy preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "第二增长曲线规划",
    slideCount: 5,
    templateId: "growth-strategy-planning",
    theme: "second-curve",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="growth-strategy-planning" data-layout="strategy-second-curve"/);
  assert.match(preview, /second-curve-layer/);
  assert.match(preview, /second-curve-chart/);
  assert.match(preview, /second-curve-matrix|second-curve-roadmap|second-curve-portfolio/);
  assert.doesNotMatch(preview, />第二曲线</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced SWOT map slug preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertSwotMapTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "智能硬件竞品 SWOT 分析",
    slideCount: 6,
    templateId: "strategy-competitor-analysis-swot-map",
    theme: "swot-map",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="strategy-competitor-analysis-swot-map" data-layout="strategy-swot-map"/);
  assert.match(preview, /<div class="swot-layer">/);
  assert.match(preview, /swot-quadrant/);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced product pain points preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertProductPainPointsTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "智能协作产品需求分析",
    slideCount: 6,
    templateId: "product-product-requirement-analysis-user-pain-points",
    theme: "user-pain-points",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="product-product-requirement-analysis-user-pain-points" data-layout="product-pain-points"/);
  assert.match(preview, /pain-layer/);
  assert.match(preview, /pain-persona/);
  assert.match(preview, /pain-card-grid|pain-matrix|pain-notes/);
  assert.doesNotMatch(preview, />用户痛点</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced user research interview insight preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertProductInterviewInsightTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "用户访谈研究总结",
    slideCount: 6,
    templateId: "product-user-research-report-interview-insight",
    theme: "interview-insight",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="product-user-research-report-interview-insight" data-layout="product-interview-insight"/);
  assert.match(preview, /interview-layer/);
  assert.match(preview, /interview-sample-card/);
  assert.match(preview, /interview-quote-wall|interview-cluster|interview-notes/);
  assert.doesNotMatch(preview, />访谈洞察</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced product release cadence preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertProductReleaseCadenceTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "产品版本节奏规划",
    slideCount: 6,
    templateId: "product-product-roadmap-release-cadence",
    theme: "release-cadence",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="product-product-roadmap-release-cadence" data-layout="product-release-cadence"/);
  assert.match(preview, /cadence-layer/);
  assert.match(preview, /cadence-wave/);
  assert.match(preview, /cadence-timeline|cadence-lanes|cadence-risk/);
  assert.doesNotMatch(preview, />版本节奏</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced feature priority matrix preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertFeaturePriorityMatrixTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "功能优先级评审",
    slideCount: 6,
    templateId: "product-feature-priority-review-value-matrix",
    theme: "value-matrix",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="product-feature-priority-review-value-matrix" data-layout="feature-priority-matrix"/);
  assert.match(preview, /priority-layer/);
  assert.match(preview, /priority-matrix/);
  assert.match(preview, /priority-ranking|priority-resource|priority-actions/);
  assert.doesNotMatch(preview, />价值矩阵</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced experience journey preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertExperienceJourneyTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "用户体验改版方案",
    slideCount: 6,
    templateId: "product-user-experience-redesign-experience-journey",
    theme: "experience-journey",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="product-user-experience-redesign-experience-journey" data-layout="experience-journey-map"/);
  assert.match(preview, /journey-layer/);
  assert.match(preview, /journey-map/);
  assert.match(preview, /journey-diagnosis|journey-redesign|journey-roadmap|journey-actions/);
  assert.doesNotMatch(preview, />体验旅程</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced capability radar preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertCapabilityRadarTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "竞品功能对比",
    slideCount: 6,
    templateId: "product-competitive-feature-comparison-capability-radar",
    theme: "capability-radar",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="product-competitive-feature-comparison-capability-radar" data-layout="capability-radar-map"/);
  assert.match(preview, /radar-layer/);
  assert.match(preview, /radar-panel/);
  assert.match(preview, /radar-matrix|radar-gap|radar-roadmap|radar-actions/);
  assert.doesNotMatch(preview, />能力雷达</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced experience gap preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertExperienceGapTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "竞品体验差距分析",
    slideCount: 6,
    templateId: "product-competitor-analysis-report-experience-gap",
    theme: "experience-gap",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="product-competitor-analysis-report-experience-gap" data-layout="experience-gap-map"/);
  assert.match(preview, /gap-layer/);
  assert.match(preview, /gap-browser-pair/);
  assert.match(preview, /gap-matrix|gap-path|gap-opportunities|gap-roadmap|gap-closing-loop/);
  assert.doesNotMatch(preview, />体验差距</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced budget planning preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertBudgetPlanningTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "年度预算规划",
    slideCount: 5,
    templateId: "finance-budget-management-report-budget-planning",
    theme: "budget-planning",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="finance-budget-management-report-budget-planning" data-layout="finance-budget-planning"/);
  assert.match(preview, /budget-dashboard|budget-allocation|budget-table|budget-flow/);
  assert.match(preview, /budget-surface/);
  assert.doesNotMatch(preview, />预算编制</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders cost control breakdown preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertCostControlTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "成本结构分析和降本增效方案",
    slideCount: 5,
    templateId: "finance-cost-control-plan-cost-breakdown",
    theme: "cost-breakdown",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="finance-cost-control-plan-cost-breakdown" data-layout="finance-cost-breakdown"/);
  assert.match(preview, /cost-dashboard|cost-tree|cost-waterfall|cost-roadmap|cost-loop|cost-matrix/);
  assert.match(preview, /cost-surface/);
  assert.doesNotMatch(preview, />成本拆解</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders cash flow forecast preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertCashFlowTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "现金流预测、资金周转分析和财务风险预警",
    slideCount: 5,
    templateId: "finance-cash-flow-analysis-report-cash-flow-forecast",
    theme: "cash-flow-forecast",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="finance-cash-flow-analysis-report-cash-flow-forecast" data-layout="finance-cash-flow-forecast"/);
  assert.match(preview, /cash-forecast|cash-waterfall|cash-cycle|cash-receivables|cash-risk|cash-dashboard/);
  assert.match(preview, /cash-surface/);
  assert.doesNotMatch(preview, />现金流预测</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced budget adjustment preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertBudgetAdjustmentTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "预算调整与资源重配",
    slideCount: 5,
    templateId: "finance-budget-management-report-budget-adjustment",
    theme: "budget-adjustment",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="finance-budget-management-report-budget-adjustment" data-layout="finance-budget-adjustment"/);
  assert.match(preview, /adjustment-dashboard|adjustment-reallocation|adjustment-approval|adjustment-impact/);
  assert.match(preview, /adjustment-surface/);
  assert.doesNotMatch(preview, />预算调整</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced budget variance preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertBudgetVarianceTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "预算执行偏差复盘",
    slideCount: 5,
    templateId: "finance-budget-management-report-execution-variance",
    theme: "execution-variance",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="finance-budget-management-report-execution-variance" data-layout="finance-budget-variance"/);
  assert.match(preview, /variance-ledger|variance-waterfall|variance-analysis|variance-actions/);
  assert.match(preview, /variance-surface/);
  assert.doesNotMatch(preview, />执行偏差</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced profit bridge preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertProfitBridgeTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "利润变化拆解与盈利改善复盘",
    slideCount: 5,
    templateId: "finance-profit-analysis-report-profit-bridge",
    theme: "profit-bridge",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="finance-profit-analysis-report-profit-bridge" data-layout="finance-profit-bridge"/);
  assert.match(preview, /profit-waterfall|profit-margin|profit-factors|profit-actions/);
  assert.match(preview, /profit-surface/);
  assert.doesNotMatch(preview, />利润桥</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced investment ROI preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertInvestmentRoiTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "项目投资分析、投入产出测算和回收周期说明",
    slideCount: 5,
    templateId: "finance-investment-return-analysis-roi-model",
    theme: "roi-model",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="finance-investment-return-analysis-roi-model" data-layout="finance-investment-roi-model"/);
  assert.match(preview, /roi-model|roi-curve|roi-payback|roi-scenarios/);
  assert.match(preview, /roi-surface/);
  assert.doesNotMatch(preview, />ROI 模型</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders financial industry solution preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertFinancialSolutionTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "金融客户解决方案",
    slideCount: 5,
    templateId: "sales-industry-solution-financial-industry",
    theme: "financial-industry",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="sales-industry-solution-financial-industry" data-layout="sales-financial-solution"/);
  assert.match(preview, /financial-solution-layer/);
  assert.match(preview, /financial-solution-shield|financial-solution-architecture|financial-solution-value/);
  assert.doesNotMatch(preview, />金融行业</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders channel recruitment policy preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertChannelRecruitmentPolicyTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "渠道招商合作政策",
    slideCount: 5,
    templateId: "sales-channel-recruitment-plan-cooperation-policy",
    theme: "cooperation-policy",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="sales-channel-recruitment-plan-cooperation-policy" data-layout="channel-recruitment-policy"/);
  assert.match(preview, /channel-policy-layer/);
  assert.match(preview, /channel-policy-network|channel-policy-matrix|channel-policy-revenue|channel-policy-process/);
  assert.doesNotMatch(preview, />合作政策</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders education industry solution preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertEducationSolutionTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "教育信息化解决方案",
    slideCount: 5,
    templateId: "sales-industry-solution-education-industry",
    theme: "education-industry",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="sales-industry-solution-education-industry" data-layout="sales-education-solution"/);
  assert.match(preview, /education-solution-layer/);
  assert.match(preview, /education-solution-platform|education-solution-path|education-solution-data/);
  assert.doesNotMatch(preview, />教育行业</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders manufacturing industry solution preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertManufacturingSolutionTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "制造业数字化解决方案",
    slideCount: 6,
    templateId: "sales-industry-solution-manufacturing-industry",
    theme: "manufacturing-industry",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="sales-industry-solution-manufacturing-industry" data-layout="sales-manufacturing-solution"/);
  assert.match(preview, /manufacturing-solution-layer/);
  assert.match(preview, /manufacturing-solution-factory|manufacturing-solution-process|manufacturing-solution-dashboard/);
  assert.doesNotMatch(preview, />制造行业</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders key account decision chain preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "大客户攻坚与决策链路推进",
    slideCount: 5,
    templateId: "key-account-plan",
    theme: "decision-chain",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="key-account-plan" data-layout="sales-key-account-decision-chain"/);
  assert.match(preview, /key-account-layer/);
  assert.match(preview, /key-account-network/);
  assert.match(preview, /key-account-path|key-account-matrix|key-account-roadmap/);
  assert.doesNotMatch(preview, />决策链路</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders synced key account decision chain preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertKeyAccountDecisionTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "重点客户组织图与赢单路径",
    slideCount: 5,
    templateId: "sales-key-account-plan-decision-chain",
    theme: "decision-chain",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="sales-key-account-plan-decision-chain" data-layout="sales-key-account-decision-chain"/);
  assert.match(preview, /<div class="key-account-layer">/);
  assert.match(preview, /key-account-network/);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders product commercialization pricing strategy preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertProductPricingStrategyTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "产品商业化定价方案",
    slideCount: 6,
    templateId: "product-product-commercialization-plan-pricing-strategy",
    theme: "pricing-strategy",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });
  const exported = await context.pptService.exportDeck({ ownerUserId: 7, deckId: deck.id, format: "pptx" });
  const downloaded = await context.storage.download({ fileId: exported.file.id, ownerUserId: 7 });
  const exportedText = downloaded.content.toString("latin1");

  assert.match(preview, /<body data-template="product-product-commercialization-plan-pricing-strategy" data-layout="product-pricing-strategy"/);
  assert.match(preview, /pricing-layer/);
  assert.match(preview, /pricing-mockup/);
  assert.match(preview, /pricing-card-row|pricing-anchor-grid|pricing-benefit-table|pricing-loop|pricing-actions/);
  assert.doesNotMatch(preview, />定价策略</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
  // 从业务服务实际导出的文件也必须保留和在线预览一致的专用信息层，而不是退回通用白底正文页。
  assert.match(exportedText, /name="Product Pricing Grid Vertical 1"/);
  assert.match(exportedText, /name="Product Pricing Dedicated Title"/);
  assert.match(exportedText, /name="Product Pricing Bullet Card 1"/);
  assert.match(exportedText, /name="Product Pricing Tag 1"/);
  assert.match(exportedText, /name="Product Pricing Tier Card 1"/);
  assert.match(exportedText, /name="Product Pricing Tier Price 1"/);
});

test("PptService renders new product launch rhythm preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertLaunchRhythmTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "新品上市计划",
    slideCount: 5,
    templateId: "marketing-new-product-launch-launch-rhythm",
    theme: "launch-rhythm",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="marketing-new-product-launch-launch-rhythm" data-layout="marketing-launch-rhythm"/);
  assert.match(preview, /launch-rhythm-layer/);
  assert.match(preview, /launch-rhythm-stage|launch-rhythm-timeline|launch-rhythm-kpi/);
  assert.doesNotMatch(preview, />首发节奏</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders business plan model preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertBusinessPlanModelTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "创业融资增长计划",
    slideCount: 5,
    templateId: "pitch-business-plan-business-model",
    theme: "business-model",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="pitch-business-plan-business-model" data-layout="business-model-bp"/);
  assert.match(preview, /bp-hero-mockup/);
  assert.match(preview, /bp-canvas|bp-flow|bp-ecosystem/);
  assert.match(preview, /INVESTOR BUSINESS CASE|BUSINESS CANVAS|REVENUE LOOP|CAPITAL &amp; ECOSYSTEM/);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders seed round startup story preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertSeedRoundStartupStoryTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "早期项目种子轮融资",
    slideCount: 6,
    templateId: "pitch-seed-round-pitch-startup-story",
    theme: "startup-story",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="pitch-seed-round-pitch-startup-story" data-layout="seed-round-story"/);
  assert.match(preview, /seed-layer/);
  assert.match(preview, /seed-mockup/);
  assert.match(preview, /seed-pain-wall|seed-validation-board|seed-growth-chart|seed-team-cards|seed-funding-road/);
  assert.match(preview, /SEED ROUND NARRATIVE|PAIN DISCOVERY|MVP VALIDATION|EARLY TRACTION|WHY THIS TEAM|NEXT INVESTOR CONVERSATION/);
  assert.doesNotMatch(preview, />创业故事</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders growth funding flywheel preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertGrowthFundingFlywheelTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "A/B 轮增长融资路演",
    slideCount: 6,
    templateId: "pitch-growth-funding-pitch-growth-flywheel",
    theme: "growth-flywheel",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="pitch-growth-funding-pitch-growth-flywheel" data-layout="growth-funding-flywheel"/);
  assert.match(preview, /growth-funding-layer/);
  assert.match(preview, /growth-funding-flywheel/);
  assert.match(preview, /growth-funding-proof|growth-funding-roadmap|growth-funding-dashboard/);
  assert.match(preview, /GROWTH CAPITAL MEMO|GROWTH FLYWHEEL|COMMERCIAL PROOF|EXPANSION PLAN/);
  assert.doesNotMatch(preview, />增长飞轮</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders Pre-A market validation preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertPreAMarketValidationTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Pre-A 融资路演市场验证",
    slideCount: 6,
    templateId: "pitch-pre-a-funding-bp-market-validation",
    theme: "market-validation",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="pitch-pre-a-funding-bp-market-validation" data-layout="pre-a-market-validation"/);
  assert.match(preview, /pre-a-layer/);
  assert.match(preview, /pre-a-product-panel/);
  assert.match(preview, /pre-a-evidence-wall|pre-a-dashboard|pre-a-capital-plan/);
  assert.match(preview, /PRE-A INVESTOR BRIEF|CUSTOMER EVIDENCE|TRACTION DASHBOARD|CAPITAL ALLOCATION/);
  assert.doesNotMatch(preview, />市场验证</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders product funding highlights preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertProductFundingHighlightsTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "产品能力投资人演示",
    slideCount: 6,
    templateId: "pitch-product-funding-pitch-product-highlights",
    theme: "product-highlights",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="pitch-product-funding-pitch-product-highlights" data-layout="product-funding-highlights"/);
  assert.match(preview, /product-funding-layer/);
  assert.match(preview, /product-funding-console/);
  assert.match(preview, /product-funding-capability|product-funding-architecture|product-funding-journey|product-funding-dashboard/);
  assert.match(preview, /PRODUCT INVESTOR DEMO|CAPABILITY MAP|LIVE DEMO FLOW|TECH ADVANTAGE/);
  assert.doesNotMatch(preview, />产品亮点</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders investor update progress sync preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertInvestorUpdateProgressTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "月度投资人经营进展同步",
    slideCount: 6,
    templateId: "pitch-investor-update-report-progress-sync",
    theme: "progress-sync",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="pitch-investor-update-report-progress-sync" data-layout="investor-update-progress-sync"/);
  assert.match(preview, /investor-update-layer/);
  assert.match(preview, /investor-update-dashboard/);
  assert.match(preview, /investor-update-cards|investor-update-lanes|investor-update-risk|investor-update-roadmap/);
  assert.match(preview, /INVESTOR MONTHLY UPDATE|PROGRESS BRIEFING|METRICS DISCLOSURE|OPERATING TIMELINE/);
  assert.doesNotMatch(preview, />进展同步</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders BI executive cockpit preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertBiExecutiveCockpitTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "经营数据复盘",
    slideCount: 5,
    templateId: "data-bi-dashboard-executive-cockpit",
    theme: "executive-cockpit",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="data-bi-dashboard-executive-cockpit" data-layout="bi-executive-cockpit"/);
  assert.match(preview, /cockpit-layer/);
  assert.match(preview, /cockpit-hero|cockpit-trend|cockpit-rank|cockpit-alerts/);
  assert.match(preview, /EXECUTIVE DATA HUB|TREND MONITOR|BUSINESS RANKING|RISK SIGNAL/);
  assert.doesNotMatch(preview, />管理驾驶舱</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders user behavior path funnel preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertUserPathFunnelTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "用户转化路径复盘",
    slideCount: 5,
    templateId: "data-user-behavior-analysis-path-funnel",
    theme: "path-funnel",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="data-user-behavior-analysis-path-funnel" data-layout="user-path-funnel"/);
  assert.match(preview, /path-layer/);
  assert.match(preview, /path-map|path-funnel|path-experiment|path-actions/);
  assert.match(preview, /USER JOURNEY LAB|CONVERSION ROUTE|DROP-OFF DIAGNOSIS|GROWTH EXPERIMENT/);
  assert.doesNotMatch(preview, />路径漏斗</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders market trend radar preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertMarketTrendRadarTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "市场机会趋势分析",
    slideCount: 5,
    templateId: "data-market-trend-insight-trend-radar",
    theme: "trend-radar",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="data-market-trend-insight-trend-radar" data-layout="market-trend-radar"/);
  assert.match(preview, /trend-layer/);
  assert.match(preview, /trend-radar|trend-opportunity|trend-shift|trend-risk|trend-actions/);
  assert.match(preview, /MARKET SIGNAL SCAN|TREND SIGNALS|OPPORTUNITY WINDOW|COMPETITION SHIFT/);
  assert.doesNotMatch(preview, />趋势雷达</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders customer segmentation layering preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertCustomerSegmentationLayeringTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "客户分群画像分析",
    slideCount: 5,
    templateId: "data-customer-segmentation-persona-layering",
    theme: "persona-layering",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="data-customer-segmentation-persona-layering" data-layout="customer-segmentation-layering"/);
  assert.match(preview, /segment-layer/);
  assert.match(preview, /segment-pyramid|segment-persona|segment-matrix|segment-strategy|segment-action/);
  assert.match(preview, /CUSTOMER SEGMENT CANVAS|SEGMENT OVERVIEW|PERSONA PROFILE|RFM VALUE MAP/);
  assert.doesNotMatch(preview, />人群分层</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders metric anomaly attribution preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertMetricAnomalyAttributionTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "指标异常诊断复盘",
    slideCount: 5,
    templateId: "data-metric-anomaly-diagnosis-attribution-analysis",
    theme: "attribution-analysis",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="data-metric-anomaly-diagnosis-attribution-analysis" data-layout="metric-anomaly-attribution"/);
  assert.match(preview, /anomaly-layer/);
  assert.match(preview, /anomaly-signal|anomaly-cause-map|anomaly-impact|anomaly-loop/);
  assert.match(preview, /ANOMALY SIGNAL|THRESHOLD REVIEW|CAUSE NETWORK|IMPACT MATRIX/);
  assert.doesNotMatch(preview, />归因分析</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders market survey analysis preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertMarketSurveyAnalysisTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "市场调研结论汇报",
    slideCount: 6,
    templateId: "data-market-research-report-survey-analysis",
    theme: "survey-analysis",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="data-market-research-report-survey-analysis" data-layout="market-survey-analysis"/);
  assert.match(preview, /survey-layer/);
  assert.match(preview, /survey-form|survey-sample-grid|survey-bars|survey-cross|survey-findings|survey-strategy/);
  assert.match(preview, /RESEARCH BRIEF|SAMPLE STRUCTURE|QUESTION ITEM REVIEW|CROSS FINDINGS/);
  assert.doesNotMatch(preview, />问卷分析</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders corporate training preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertCorporateTrainingTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "员工能力提升计划",
    slideCount: 5,
    templateId: "education-corporate-training-management",
    theme: "management",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="education-corporate-training-management" data-layout="corporate-training"/);
  assert.match(preview, /training-layer/);
  assert.match(preview, /training-board|training-path|training-model|training-case|training-checklist/);
  assert.match(preview, /INTERNAL LEARNING PROGRAM|LEARNING MAP|MANAGEMENT MODEL|CASE WORKSHOP/);
  assert.doesNotMatch(preview, />管理培训</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders onboarding guide preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertOnboardingGuideTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "新员工入职计划",
    slideCount: 5,
    templateId: "education-onboarding-training-onboarding-guide",
    theme: "onboarding-guide",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="education-onboarding-training-onboarding-guide" data-layout="onboarding-guide"/);
  assert.match(preview, /onboarding-layer/);
  assert.match(preview, /onboarding-badge|onboarding-handbook|onboarding-culture|onboarding-checklist/);
  assert.match(preview, /NEW HIRE GUIDE|HANDBOOK MAP|CULTURE FIT|ONBOARDING CHECKLIST/);
  assert.doesNotMatch(preview, />Onboarding 指南</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders knowledge handout blackboard preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertKnowledgeBlackboardTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "函数概念讲义",
    slideCount: 5,
    templateId: "education-knowledge-handout-blackboard",
    theme: "blackboard",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="education-knowledge-handout-blackboard" data-layout="knowledge-blackboard"/);
  assert.match(preview, /blackboard-layer/);
  assert.match(preview, /blackboard-note|blackboard-formula|blackboard-steps|blackboard-summary/);
  assert.match(preview, /LESSON 01|CONCEPT MAP|CASE STUDY|STEP BY STEP/);
  assert.doesNotMatch(preview, />课堂板书</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders exam review courseware preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertExamReviewKeypointsTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "中考数学考点复习",
    slideCount: 5,
    templateId: "education-exam-review-courseware-key-points",
    theme: "key-points",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="education-exam-review-courseware-key-points" data-layout="exam-review-keypoints"/);
  assert.match(preview, /exam-review-layer/);
  assert.match(preview, /exam-review-card|exam-review-framework|exam-review-mistakes|exam-review-plan/);
  assert.match(preview, /EXAM REVIEW|KNOWLEDGE MAP|ERROR ANALYSIS|FINAL SPRINT/);
  assert.doesNotMatch(preview, />重点梳理</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders teaching achievement showcase preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertTeachingAchievementShowcaseTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "教学项目成果复盘",
    slideCount: 5,
    templateId: "education-teaching-achievement-report-showcase",
    theme: "showcase",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="education-teaching-achievement-report-showcase" data-layout="teaching-achievement-showcase"/);
  assert.match(preview, /achievement-layer/);
  assert.match(preview, /achievement-medal|achievement-wall|achievement-analysis|achievement-roadmap/);
  assert.match(preview, /LEARNING OUTCOMES|PORTFOLIO WALL|STUDENT INSIGHT|PROJECT REVIEW/);
  assert.doesNotMatch(preview, />成果展示</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService renders annual business summary preview with export-aligned layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertAnnualBusinessSummaryTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "年度经营总结",
    slideCount: 3,
    templateId: "annual-business-summary",
    theme: "blue-gold",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  // 年度总结模板必须命中专用预览布局，避免退回普通文本流导致和导出 PPTX 差异过大。
  assert.match(preview, /<body data-template="annual-business-summary" data-layout="annual-summary"/);
  assert.match(preview, /annual-summary-doc/);
  assert.match(preview, /annual-summary-metrics/);
  assert.match(preview, /annual-summary-text/);
  assert.match(preview, /--annual-title-size:/);
  assert.match(preview, /body\[data-layout="annual-summary"\] \.slide-content\{display:none;\}/);
  assert.match(preview, /body\[data-layout="annual-summary"\] \.slide-cover \.annual-summary-text\{left:8%;top:25\.8%;width:43\.33%;gap:16px;\}/);
  assert.doesNotMatch(preview, /<body[^>]+data-layout="top-band"/);
});

test("PptService renders quarterly action loop preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertQuarterlyActionLoopTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "季度业务复盘",
    slideCount: 4,
    templateId: "business-quarterly-business-review-action-loop",
    theme: "action-loop",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="business-quarterly-business-review-action-loop" data-layout="quarterly-action-loop"/);
  assert.match(preview, /quarterly-action-cover-board/);
  assert.match(preview, /quarterly-action-content-card/);
  assert.match(preview, /quarterly-action-progress/);
  assert.match(preview, /body\[data-layout="quarterly-action-loop"\] \.slide-content h2/);
  assert.doesNotMatch(preview, />行动闭环</);
  assert.doesNotMatch(preview, /<body[^>]+data-layout="top-band"/);
});

test("PptService renders operating problem diagnosis preview with problem tree layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertOperatingProblemDiagnosisTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "经营问题诊断",
    slideCount: 5,
    templateId: "business-operating-problem-diagnosis-problem-tree",
    theme: "problem-tree",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /<body data-template="business-operating-problem-diagnosis-problem-tree" data-layout="operating-problem-tree"/);
  assert.match(preview, /problem-tree-layer/);
  assert.match(preview, /problem-tree-board|problem-tree-risk-matrix|problem-tree-actions|problem-tree-lens/);
  assert.match(preview, /OPERATING DIAGNOSIS|ROOT CAUSE MAP|IMPACT PRIORITY|FIX LOOP/);
  assert.doesNotMatch(preview, />问题树</);
  assert.doesNotMatch(preview, /<div class="slide-content"><h2/);
});

test("PptService refreshes operating problem diagnosis visual before exporting stale decks", async () => {
  const context = await createBusinessContext();
  await insertOperatingProblemDiagnosisTemplate(context);
  const deck = await context.database.insert("decks", {
    id: "stale-operating-problem-deck",
    ownerUserId: 7,
    title: "季度经营复盘报告",
    templateId: "business-operating-problem-diagnosis-problem-tree",
    templateName: "经营问题诊断 - 问题树",
    // 模拟历史 deck 保存了通用 visual 快照，导出时必须重新按当前官方模板补齐专用布局。
    templateVisual: {
      primary: "0F172A",
      accent: "2563EB",
      background: "F8FAFC",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "top-band",
      variant: "legacy",
    },
    theme: "problem-tree",
    status: "ready",
    slides: [
      { title: "季度经营复盘报告：穿越波动，聚焦增长", bullets: ["报告周期：2024年Q4", "核心问题：营收未达标"] },
      { title: "增长放缓源于三大结构性矛盾", bullets: ["老客留存下降", "新客获取成本上升", "产品结构失衡"] },
      { title: "整改动作闭环", bullets: ["立即止损", "责任到人", "周度复盘", "机制固化"] },
    ],
  });
  await context.database.insert("ppt_assets", {
    id: "asset-stale-operating-problem-deck",
    ownerUserId: 7,
    deckId: deck.id,
    title: deck.title,
    status: "active",
    slideCount: deck.slides.length,
    templateId: deck.templateId,
    templateName: deck.templateName,
    theme: deck.theme,
  });

  const exported = await context.pptService.exportDeck({ ownerUserId: 7, deckId: deck.id, format: "pptx" });
  const downloaded = await context.storage.download({ ownerUserId: 7, fileId: exported.file.id });
  const text = downloaded.content.toString("latin1");

  assert.match(text, /name="Operating Problem Diagnosis Canvas"/);
  assert.match(text, /name="Operating Problem Tree Lens"|name="Operating Problem Tree Board"|name="Operating Problem Tree Fix Loop"/);
  assert.match(text, /val="E94B3C"/);
  assert.doesNotMatch(text, /name="Top Band Surface"/);
});

test("PptService renders business opportunity map preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertBusinessOpportunityMapTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "业务增长汇报",
    slideCount: 4,
    templateId: "business-business-growth-report-opportunity-map",
    theme: "opportunity-map",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  // 机会地图模板必须走专用地图/路径/动作卡布局，页面中不直接显示主题风格名称。
  assert.match(preview, /<body data-template="business-business-growth-report-opportunity-map" data-layout="business-opportunity-map"/);
  assert.match(preview, /business-opportunity-map/);
  assert.match(preview, /business-opportunity-metrics|business-opportunity-quadrants|business-opportunity-path/);
  assert.doesNotMatch(preview, />机会地图</);
  assert.doesNotMatch(preview, /<body[^>]+data-layout="top-band"/);
});

test("PptService renders department performance team preview with dedicated layout", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertDepartmentTeamPerformanceTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "部门述职报告",
    slideCount: 5,
    templateId: "business-department-performance-report-team-performance",
    theme: "team-performance",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  // 团队绩效模板由专用驾驶舱、雷达和成果卡承载内容，主题风格名不直接写入页面。
  assert.match(preview, /<body data-template="business-department-performance-report-team-performance" data-layout="department-team-performance"/);
  assert.match(preview, /dept-team-layer/);
  assert.match(preview, /dept-team-hero-card|dept-team-radar|dept-team-awards/);
  assert.doesNotMatch(preview, />团队绩效</);
  assert.doesNotMatch(preview, /<body[^>]+data-layout="top-band"/);
});

test("PptService keeps annual business summary long text in the dedicated preview layer", async () => {
  const pptPreviewRenderer = { render: async () => null };
  const context = await createBusinessContext({ pptPreviewRenderer });
  await insertAnnualBusinessSummaryTemplate(context);
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "年度经营总结",
    slideCount: 2,
    templateId: "annual-business-summary",
    theme: "blue-gold",
  });
  const edited = await context.pptService.updateOutline({
    ownerUserId: 7,
    outlineId: outline.id,
    slides: [
      {
        title: "年度经营复盘：收入增速放缓、利润承压与核心项目交付质量持续提升",
        bullets: [
          "总收入同比增长但低于年度目标，核心客户续费稳定，新客获取效率需要进一步优化",
          "净利率受到原材料和交付成本影响，后续需要通过产品组合调整和流程改善释放利润空间",
          "重点项目按期交付率提升，客户满意度保持稳定，为下一年度增长目标提供基础支撑",
        ],
      },
      {
        title: "营收增速放缓与利润承压并存，客户结构和价格杠杆需要系统性优化",
        bullets: [
          "大客户贡献保持稳定，但中小客户转化周期拉长，需要提升线索筛选和销售协同效率",
          "产品折扣率扩大压缩毛利空间，建议建立分层报价机制并同步优化成本科目",
          "交付团队复用能力提升，但跨部门资源协调仍需加强，避免关键项目利润回收滞后",
          "下一阶段重点围绕客户分层、价格体系和交付效率三个方向形成经营闭环",
        ],
      },
    ],
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: edited.id, entitlementId: 88 });

  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(preview, /annual-summary-text-title/);
  assert.match(preview, /营收增速放缓与利润承压并存/);
  assert.match(preview, /客户结构和价格杠杆需要系统性优化/);
  assert.match(preview, /--annual-title-size:\d+(?:\.\d+)?px/);
  assert.match(preview, /--annual-body-size:\d+(?:\.\d+)?px/);
  assert.match(preview, /body\[data-layout="annual-summary"\] \.slide-content\{display:none;\}/);
});

test("PptService returns provider failure for outline generation as AI_PROVIDER_FAILED", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.generateOutline = async () => {
    throw new Error("provider unavailable");
  };
  const context = await createBusinessContext({ aiProvider });

  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "outline fail",
      slideCount: 2,
      templateId: "business",
    }),
    { code: "AI_PROVIDER_FAILED" },
  );
});

test("PptService releases slide regeneration credits when AI fails", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async () => {
    throw new Error("slide provider failed");
  };
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Regeneration failure",
    slideCount: 2,
    templateId: "business",
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deckResult.deck.id,
      slideId: deckResult.deck.slides[0].id,
      instruction: "fail after reserve",
      entitlementId: 88,
    }),
    /AI_PROVIDER_FAILED/,
  );

  assert.deepEqual(context.billingCalls.map((call) => call[0]), [
    "balance",
    "reserve",
    "settle",
    "balance",
    "reserve",
    "release",
  ]);
});

test("PptService records slide release reconciliation when regeneration release fails", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async () => {
    throw new Error("slide provider failed");
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      releaseCredits: async (input) => {
        context.billingCalls.push(["release", input]);
        throw new Error("slide release unavailable");
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Slide release failure",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "fail release",
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const releaseEvent = await context.database.findOne("billing_events", (event) => event.eventType === "release" && event.status === "release_pending");
  const logs = await context.database.find("call_logs", (log) => log.action === "billing_release_pending");

  assert.equal(releaseEvent.taskId, deck.id);
  assert.equal(releaseEvent.amount, "0");
  assert.equal(logs.length, 1);
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle", "balance", "reserve", "release"]);
});

test("PptService blocks generation when entitlement is not usable", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      getBalance: async (input) => {
        context.billingCalls.push(["balance", input]);
        return { usable: false, status: "expired", remaining: "100" };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Blocked by entitlement status",
    slideCount: 2,
    templateId: "business",
  });
  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "ENTITLEMENT_NOT_USABLE" },
  );
  assert.deepEqual(context.billingCalls, [["balance", { userId: 7, entitlementId: 88 }]]);
});

test("PptService reports required credits when balance is insufficient", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      getBalance: async (input) => {
        context.billingCalls.push(["balance", input]);
        return { usable: true, remaining: "3.9" };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Insufficient credits detail",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 62,
    }),
    (error) => {
      assert.equal(error.code, "INSUFFICIENT_CREDITS");
      assert.equal(error.publicDetails.entitlement_id, 62);
      assert.equal(error.publicDetails.required_amount, "6");
      assert.equal(error.publicDetails.balance.remaining, "3.9");
      return true;
    },
  );
});

test("PptService maps platform insufficient-credit reserve errors before AI generation", async () => {
  let aiCalled = false;
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async () => {
    aiCalled = true;
    return [];
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      reserveCredits: async (input) => {
        context.billingCalls.push(["reserve", input]);
        const error = new Error("平台积分不足");
        error.code = "60005";
        error.status = 400;
        throw error;
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Reserve insufficient credits",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    (error) => {
      assert.equal(error.code, "INSUFFICIENT_CREDITS");
      assert.equal(error.status, 402);
      assert.equal(error.publicDetails.entitlement_id, 88);
      assert.equal(error.publicDetails.required_amount, "6");
      return true;
    },
  );

  assert.equal(aiCalled, false);
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve"]);
});

test("PptService persists deterministic generation billing idempotency keys", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Billing key persistence",
    slideCount: 2,
    templateId: "business",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });
  const events = await context.database.find("billing_events");

  assert.deepEqual(events.map((event) => event.eventType), ["reserve", "settle"]);
  assert.deepEqual(events.map((event) => event.idempotencyKey), [
    `${result.task.id}:ppt_generate:reserve`,
    `${result.task.id}:ppt_generate:settle`,
  ]);
  assert.deepEqual(context.billingCalls.filter((call) => call[0] !== "balance").map((call) => call[1].idempotencyKey), [
    `${result.task.id}:ppt_generate:reserve`,
    `${result.task.id}:ppt_generate:settle`,
  ]);
});

test("PptService reconciles pending slide release events", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async () => {
    throw new Error("slide provider failed");
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      releaseCredits: async (input) => {
        context.billingCalls.push(["release", input]);
        if (context.billingCalls.filter((call) => call[0] === "release").length === 1) {
          throw new Error("slide release unavailable");
        }
        return { status: "released", hold_id: input.holdId };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Slide release reconcile",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });
  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "fail release",
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const result = await context.pptService.reconcileBillingEvents({ limit: 10 });
  const releaseEvent = await context.database.findOne("billing_events", (event) => event.eventType === "release");

  assert.deepEqual(result, { checked: 1, settled: 0, released: 1, failed: 0 });
  assert.equal(releaseEvent.status, "released");
  assert.equal(context.billingCalls.filter((call) => call[0] === "release").length, 2);
});

test("PptService locks deck when slide regeneration settle fails", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        if (input.idempotencyKey.includes("ppt_slide_regenerate")) {
          throw new Error("slide settle unavailable");
        }
        return { status: "settled", hold_id: input.holdId, settled_amount: input.actualAmount };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Slide settle failure",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "paid edit",
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const lockedDeck = await context.database.findOne("decks", (item) => item.id === deck.id);
  const settleEvent = await context.database.findOne("billing_events", (event) => event.eventType === "settle" && event.status === "settle_pending");

  assert.equal(lockedDeck.status, "billing_pending");
  assert.equal(lockedDeck.slides[0].title.includes("paid edit"), true);
  assert.equal(settleEvent.taskId, deck.id);
  await assert.rejects(
    () => context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id }),
    { code: "DECK_BILLING_PENDING" },
  );
});

test("PptService reconciles pending slide settle events", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        if (input.idempotencyKey.includes("ppt_slide_regenerate")
          && context.billingCalls.filter((call) => call[0] === "settle" && call[1].idempotencyKey.includes("ppt_slide_regenerate")).length === 1) {
          throw new Error("slide settle unavailable");
        }
        return { status: "settled", hold_id: input.holdId, settled_amount: input.actualAmount };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Slide settle reconcile",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });
  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "paid edit",
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const result = await context.pptService.reconcileBillingEvents({ limit: 10 });
  const readyDeck = await context.database.findOne("decks", (item) => item.id === deck.id);
  const settleEvent = await context.database.findOne("billing_events", (event) => event.eventType === "settle" && event.taskId === deck.id);

  assert.deepEqual(result, { checked: 1, settled: 1, released: 0, failed: 0 });
  assert.equal(readyDeck.status, "ready");
  assert.equal(settleEvent.status, "settled");
  assert.equal(context.billingCalls.filter((call) => call[0] === "settle" && call[1].idempotencyKey.includes("ppt_slide_regenerate")).length, 2);
});

test("PptService rejects unsupported deck export formats", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Export validation",
    slideCount: 2,
    templateId: "business",
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  await assert.rejects(
    () => context.pptService.exportDeck({
      ownerUserId: 7,
      deckId: deckResult.deck.id,
      format: "docx",
    }),
    { code: "EXPORT_FORMAT_UNSUPPORTED" },
  );
});

test("PptService records release reconciliation when generation release fails", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async () => {
    throw new Error("provider failed before deck");
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      releaseCredits: async (input) => {
        context.billingCalls.push(["release", input]);
        throw new Error("release unavailable");
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Release failure",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const [task] = await context.database.find("generation_tasks");
  const events = await context.database.find("billing_events");

  assert.equal(task.status, "release_pending");
  assert.equal(task.retryable, false);
  assert.equal(task.errorCode, "RELEASE_FAILED");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "release"]);
  assert.deepEqual(events.map((event) => event.status), ["reserved", "release_pending"]);
});

test("PptService reconciles pending release events", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async () => {
    throw new Error("provider failed before deck");
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      releaseCredits: async (input) => {
        context.billingCalls.push(["release", input]);
        if (context.billingCalls.filter((call) => call[0] === "release").length === 1) {
          throw new Error("release unavailable");
        }
        return { status: "released", hold_id: input.holdId };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Release reconcile",
    slideCount: 2,
    templateId: "business",
  });
  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const result = await context.pptService.reconcileBillingEvents({ limit: 10 });
  const [task] = await context.database.find("generation_tasks");
  const releaseEvent = await context.database.findOne("billing_events", (event) => event.eventType === "release");

  assert.deepEqual(result, { checked: 1, settled: 0, released: 1, failed: 0 });
  assert.equal(task.status, "failed");
  assert.equal(task.retryable, true);
  assert.equal(releaseEvent.status, "released");
  assert.equal(context.billingCalls.filter((call) => call[0] === "release").length, 2);
});

test("PptService marks successful generation for reconciliation when settle fails", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        throw new Error("settle unavailable");
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Settle failure",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const [task] = await context.database.find("generation_tasks");
  const [deck] = await context.database.find("decks");
  const events = await context.database.find("billing_events");

  assert.equal(task.status, "reconcile_pending");
  assert.equal(task.retryable, false);
  assert.equal(task.deckId, deck.id);
  assert.equal(task.errorCode, "SETTLE_FAILED");
  assert.equal(deck.status, "billing_pending");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle"]);
  assert.deepEqual(events.map((event) => event.status), ["reserved", "settle_pending"]);
});

test("PptService blocks deck usage while billing settlement is pending", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        throw new Error("settle unavailable");
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Locked deck",
    slideCount: 2,
    templateId: "business",
  });
  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );
  const [deck] = await context.database.find("decks");

  await assert.rejects(
    () => context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id }),
    { code: "DECK_BILLING_PENDING" },
  );
  await assert.rejects(
    () => context.pptService.exportDeck({ ownerUserId: 7, deckId: deck.id, format: "pptx" }),
    { code: "DECK_BILLING_PENDING" },
  );
  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "change",
      entitlementId: 88,
    }),
    { code: "DECK_BILLING_PENDING" },
  );
});

test("PptService reconciles pending settle events", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        if (context.billingCalls.filter((call) => call[0] === "settle").length === 1) {
          throw new Error("settle unavailable");
        }
        return { status: "settled", settled_amount: input.actualAmount };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Reconcile settle",
    slideCount: 2,
    templateId: "business",
  });
  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const result = await context.pptService.reconcileBillingEvents({ limit: 10 });
  const [task] = await context.database.find("generation_tasks");
  const [deck] = await context.database.find("decks");
  const settleEvent = await context.database.findOne("billing_events", (event) => event.eventType === "settle");

  assert.deepEqual(result, { checked: 1, settled: 1, released: 0, failed: 0 });
  assert.equal(task.status, "succeeded");
  assert.equal(deck.status, "ready");
  assert.equal(settleEvent.status, "settled");
  assert.equal(context.billingCalls.filter((call) => call[0] === "settle").length, 2);
});

test("PptService routes slide regeneration through PromptManager", async () => {
  const promptCalls = [];
  const aiCalls = [];
  const promptManager = {
    buildOutlinePrompt: (input) => input,
    buildDeckPrompt: (input) => input,
    buildRegenerateSlidePrompt: (input) => {
      promptCalls.push(input);
      return { kind: "regenerate_slide", ...input };
    },
  };
  const aiProvider = {
    generateOutline: async ({ slideCount }) => Array.from({ length: slideCount }, (_, index) => ({
      title: `Slide ${index + 1}`,
      bullets: ["A"],
    })),
    generateSlides: async ({ outline }) => outline.slides.map((slide, index) => ({
      id: `slide_${index + 1}`,
      title: slide.title,
      bullets: slide.bullets,
    })),
    regenerateSlide: async (prompt) => {
      aiCalls.push(prompt);
      return { ...prompt.slide, title: "Prompted regeneration" };
    },
  };
  const context = await createBusinessContext({ promptManager, aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Prompt route",
    slideCount: 1,
    templateId: "business",
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  const regenerated = await context.pptService.regenerateSlide({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    slideId: "slide_1",
    instruction: "Use the prompt manager",
    entitlementId: 88,
  });

  assert.equal(promptCalls[0].instruction, "Use the prompt manager");
  assert.equal(aiCalls[0].kind, "regenerate_slide");
  assert.equal(regenerated.slide.title, "Prompted regeneration");
});

test("PptService regenerates a slide when the UI sends a one-based slide number", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Numbered slide regeneration",
    slideCount: 3,
    templateId: "business",
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  const regenerated = await context.pptService.regenerateSlide({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    slideId: "2",
    instruction: "Tighten this page",
    entitlementId: 88,
  });

  assert.equal(regenerated.slide.id, "slide_2");
  assert.equal(regenerated.slide.title.includes("Tighten this page"), true);
});

test("PptService preserves slide identity when regenerated slide omits ids", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async ({ slide, instruction }) => ({
    title: `${slide.title} regenerated`,
    bullets: [instruction],
  });
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Identity preservation",
    slideCount: 2,
    templateId: "business",
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  const regenerated = await context.pptService.regenerateSlide({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    slideId: deckResult.deck.slides[0].id,
    instruction: "Keep identity",
    entitlementId: 88,
  });

  assert.equal(regenerated.slide.id, "slide_1");
  assert.equal(regenerated.slide.sortOrder, 1);
  assert.equal(regenerated.deck.slides[0].id, "slide_1");
});

test("PptService preserves dome layout metadata during slide regeneration", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async ({ instruction }) => ({
    title: "成果展示 regenerated",
    bullets: [instruction, "客户反馈", "团队荣誉"],
    layout: "unknown-layout",
    sectionLabel: "",
  });
  const context = await createBusinessContext({ aiProvider });
  const deck = await context.database.insert("decks", {
    ownerUserId: 7,
    outlineId: "outline-dome-regenerate",
    title: "Dome regenerate",
    templateId: "business",
    templateName: "Executive Business",
    templateVisual: {
      primary: "1F4E79",
      accent: "F4A261",
      background: "8F0613",
      surface: "FFF8E6",
      title: "0F2945",
      body: "3C1F1F",
      layout: "red-gold",
    },
    theme: "modern",
    status: "ready",
    slides: [{
      id: "slide_1",
      sortOrder: 1,
      title: "成果展示",
      bullets: ["项目成果", "客户反馈", "团队荣誉"],
      layout: "showcase",
      sectionLabel: "PART 02",
    }],
  });

  const regenerated = await context.pptService.regenerateSlide({
    ownerUserId: 7,
    deckId: deck.id,
    slideId: "slide_1",
    instruction: "强化成果表达",
    entitlementId: 88,
  });

  assert.equal(regenerated.slide.layout, "showcase");
  assert.equal(regenerated.slide.sectionLabel, "PART 02");
});

test("PptService generates outline from uploaded document content", async () => {
  const context = await createBusinessContext();
  const sourceFile = await context.storage.upload({
    ownerUserId: 7,
    fileName: "brief.txt",
    mimeType: "text/plain",
    content: Buffer.from("Customer retention plan\nExpansion revenue\nRenewal risk"),
  });

  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    sourceFileId: sourceFile.id,
    slideCount: 2,
    templateId: "business",
    theme: "classic",
  });

  assert.equal(outline.input.sourceFileId, sourceFile.id);
  assert.equal(outline.slides.length, 2);
  assert.match(outline.slides[0].title, /Customer retention plan|Document insight/);
});

test("PptService enforces slide count and template theme rules", async () => {
  const context = await createBusinessContext();

  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "Too short",
      slideCount: 0,
      templateId: "business",
      theme: "modern",
    }),
    /SLIDE_COUNT_INVALID/,
  );
  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "Too long",
      slideCount: 33,
      templateId: "business",
      theme: "modern",
    }),
    /SLIDE_COUNT_INVALID/,
  );
  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "Wrong theme",
      slideCount: 3,
      templateId: "business",
      theme: "startup",
    }),
    /THEME_NOT_SUPPORTED/,
  );
});

test("PptService can apply a different template to an existing outline without regenerating it", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Market expansion",
    slideCount: 2,
    templateId: "business",
    theme: "modern",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
    templateId: "pitch",
    theme: "startup",
  });
  const persistedOutline = await context.database.findOne("outlines", (item) => item.id === outline.id);

  assert.equal(persistedOutline.templateId, "business");
  assert.equal(persistedOutline.theme, "modern");
  assert.equal(result.deck.templateId, "pitch");
  assert.equal(result.deck.theme, "startup");
  assert.equal(result.deck.slides.length, outline.slides.length);
  assert.match(result.deck.slides[0].title, /Market expansion - slide 1/);
  assert.match(result.deck.slides[0].bullets[0], /Pitch angle:/);
});

test("PptService retries slide generation when slide JSON fails schema validation", async () => {
  const calls = [];
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async (prompt) => {
    calls.push(prompt);
    if (calls.length === 1) {
      return prompt.outline.slides.map((slide) => ({ title: slide.title, bullets: "not an array" }));
    }
    return prompt.outline.slides.map((slide, index) => ({
      id: `retry_slide_${index + 1}`,
      sortOrder: index + 1,
      title: slide.title,
      bullets: slide.bullets.map((bullet) => `Retried: ${bullet}`),
      speakerNotes: `Retried notes for ${slide.title}`,
      layout: index === 0 ? "title" : "content",
      theme: prompt.outline.theme,
    }));
  };
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Schema retry",
    slideCount: 2,
    templateId: "business",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[1].validation.retry, true);
  assert.match(calls[1].validation.reason, /bullets/);
  assert.equal(result.deck.slides.length, outline.slides.length);
  assert.equal(result.deck.slides[0].id, "retry_slide_1");
  assert.equal(result.deck.slides[0].bullets[0], "Retried: Key point 1");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle"]);
});

test("PptService degrades to outline slides after repeated schema-invalid slide JSON", async () => {
  const calls = [];
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async (prompt) => {
    calls.push(prompt);
    return prompt.outline.slides.map((slide) => ({
      id: "",
      title: slide.title,
      bullets: ["valid looking extra slide"],
    })).concat([{ title: "unexpected extra", bullets: ["extra"] }]);
  };
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Schema fallback",
    slideCount: 2,
    templateId: "business",
    theme: "modern",
  });
  const edited = await context.pptService.updateOutline({
    ownerUserId: 7,
    outlineId: outline.id,
    slides: [
      { title: "Stable title one", bullets: ["Stable point one", "Stable point two"] },
      { title: "Stable title two", bullets: ["Stable point three"] },
    ],
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: edited.id,
    entitlementId: 88,
    templateId: "education",
    theme: "lecture",
  });

  assert.equal(calls.length, 2);
  assert.equal(result.deck.templateId, "education");
  assert.equal(result.deck.theme, "lecture");
  assert.equal(result.deck.slides.length, edited.slides.length);
  assert.deepEqual(result.deck.slides.map((slide) => slide.title), ["Stable title one", "Stable title two"]);
  assert.deepEqual(result.deck.slides[0].bullets, ["Stable point one", "Stable point two"]);
  assert.equal(result.deck.slides[0].fallback, true);
  assert.equal(result.deck.slides[0].theme, "lecture");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle"]);
});

test("PptService normalizes generated slide layouts with the selected template schema", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async ({ outline }) => outline.slides.map((slide, index) => ({
    id: `slide_${index + 1}`,
    sortOrder: index + 1,
    title: slide.title,
    bullets: slide.bullets,
    speakerNotes: "",
    layout: "unknown-layout",
    theme: outline.theme,
  }));
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Layout schema",
    slideCount: 2,
    templateId: "pitch",
    theme: "startup",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.equal(result.deck.slides[0].layout, "venture-cover");
  assert.equal(result.deck.slides[1].layout, "venture-story");
});

test("PptService keeps business modern on top-band-compatible roles when provider omits usable layouts", async () => {
  const outlineSlides = [
    { title: "年度工作汇报", bullets: ["2026 年度经营复盘"] },
    { title: "目录", bullets: ["工作汇报", "成果展示", "问题复盘", "下步计划"] },
    { title: "工作汇报", bullets: ["PART 01"] },
    { title: "年度工作概况", bullets: ["业务进展", "团队投入", "关键成果"] },
    { title: "三步骤流程", bullets: ["调研", "规划", "落地"] },
    { title: "四步骤流程", bullets: ["目标拆解", "资源配置", "执行跟踪", "复盘优化"] },
    { title: "数据指标", bullets: ["收入增长", "留存提升", "交付提速"] },
    { title: "成果展示", bullets: ["项目成果", "客户反馈", "团队荣誉"], sectionLabel: "PART 02" },
    { title: "问题复盘", bullets: ["风险信号", "原因分析", "改进措施"] },
    { title: "下一步计划", bullets: ["季度路线", "关键动作", "负责人复盘"] },
    { title: "汇报结束", bullets: ["感谢观看"] },
  ];
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async ({ outline }) => outline.slides.map((slide, index) => ({
    id: `slide_${index + 1}`,
    sortOrder: index + 1,
    title: slide.title,
    bullets: slide.bullets,
    speakerNotes: "",
    layout: "unknown-layout",
    theme: outline.theme,
  }));
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.database.insert("outlines", {
    ownerUserId: 7,
    topic: "Dome auto roles",
    templateId: "business",
    theme: "modern",
    status: "outline_ready",
    input: { topic: "Dome auto roles", slideCount: outlineSlides.length, templateId: "business", theme: "modern" },
    slides: outlineSlides,
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.deepEqual(result.deck.slides.map((slide) => slide.layout), [
    "cover",
    "image-report",
    "image-report",
    "image-report",
    "image-report",
    "image-report",
    "image-report",
    "image-report",
    "image-report",
    "image-report",
    "image-report",
  ]);
  assert.equal(result.deck.slides[7].sectionLabel, "PART 02");
});

test("PromptManager keeps business modern on generic top-band instructions", () => {
  const template = new TemplateManager().getTemplate("business", { ownerUserId: 7 });
  const prompt = new PromptManager().buildDeckPrompt({
    outline: {
      topic: "Dome prompt",
      theme: "modern",
      slides: [{ title: "年度工作汇报", bullets: ["2026 年度经营复盘"] }],
    },
    template,
  });

  assert.equal(prompt.templateInstructions?.templateSystem, "generic");
  assert.equal(prompt.templateInstructions?.layoutRoles, undefined);
  assert.equal(prompt.templateInstructions?.roleHints, undefined);
});

test("PromptManager keeps deck template context compact", () => {
  const template = new TemplateManager().getTemplate("business", { ownerUserId: 7 });
  const prompt = new PromptManager().buildDeckPrompt({
    outline: {
      topic: "季度经营复盘",
      theme: "modern",
      slides: [{ title: "增长概览", bullets: ["收入增长 18%"] }],
    },
    template: {
      ...template,
      description: "x".repeat(8000),
      thumbnailUrl: "https://example.test/large-thumbnail.png",
      extraMetadata: { raw: "y".repeat(8000) },
    },
  });

  assert.equal(prompt.template, undefined);
  assert.equal(prompt.templateContext.id, "business");
  assert.equal(prompt.templateContext.categoryId, "business");
  assert.equal(JSON.stringify(prompt).length < 5000, true);
});

test("PromptManager keeps deck outline context compact", () => {
  const template = new TemplateManager().getTemplate("business", { ownerUserId: 7 });
  const prompt = new PromptManager().buildDeckPrompt({
    outline: {
      id: "outline-long",
      ownerUserId: 7,
      topic: "季度经营复盘",
      theme: "modern",
      templateId: "business",
      status: "outline_edited",
      created_at: "2026-07-09T00:00:00.000Z",
      updated_at: "2026-07-09T00:00:00.000Z",
      input: { raw: "这段原始输入不应该进入生成 PPT 提示词。".repeat(300) },
      slides: Array.from({ length: 20 }, (_, index) => ({
        id: `slide-${index + 1}`,
        sortOrder: index + 1,
        title: `第 ${index + 1} 页经营复盘标题 ${"需要压缩".repeat(20)}`,
        layout: index === 0 ? "cover" : "content",
        bullets: Array.from({ length: 6 }, (__, bulletIndex) => (
          `第 ${bulletIndex + 1} 条经营分析要点，包含很长的业务背景、数据解释、原因推导和行动建议。`.repeat(8)
        )),
        speakerNotes: "很长的演讲备注不应该进入 deck 生成提示词。".repeat(200),
      })),
    },
    template,
  });

  assert.equal(prompt.outline.input, undefined);
  assert.equal(prompt.outline.ownerUserId, undefined);
  assert.equal(prompt.outline.status, undefined);
  assert.equal(prompt.outline.slides.length, 20);
  assert.equal(prompt.outline.slides[0].speakerNotes, undefined);
  assert.equal(JSON.stringify(prompt).length < 5000, true);
});

test("PromptManager auto-loads PPT design master skill for outline, deck, and slide polish", () => {
  const template = new TemplateManager().getTemplate("business", { ownerUserId: 7 });
  const manager = new PromptManager();
  const outlinePrompt = manager.buildOutlinePrompt({
    topic: "季度经营复盘",
    slideCount: 6,
    theme: "modern",
    template,
  });
  const deckPrompt = manager.buildDeckPrompt({
    outline: { topic: "季度经营复盘", theme: "modern", slides: [{ title: "增长概览", bullets: ["收入增长 18%"] }] },
    template,
  });
  const polishPrompt = manager.buildRegenerateSlidePrompt({
    slide: { id: "slide_1", title: "增长概览", bullets: ["收入增长 18%"] },
    instruction: "强化专业表达",
  });

  assert.equal(outlinePrompt.designSkill.id, "ppt-design-master");
  assert.equal(deckPrompt.designSkill.id, "ppt-design-master");
  assert.equal(polishPrompt.designSkill.id, "ppt-design-master");
  assert.match(outlinePrompt.designSkill.rules.join("\n"), /避免固定三段式/);
  assert.match(outlinePrompt.designSkill.rules.join("\n"), /避免从三段式滑向四段式卡片堆砌/);
  assert.match(outlinePrompt.designSkill.rules.join("\n"), /至少 25% 的内容页应该是详情展开页/);
  assert.match(outlinePrompt.designSkill.rules.join("\n"), /知识点详情挖掘页/);
  assert.match(outlinePrompt.designSkill.rules.join("\n"), /侧重点/);
  assert.match(deckPrompt.designSkill.rules.join("\n"), /版式化表达/);
  assert.match(deckPrompt.designSkill.rules.join("\n"), /detail-analysis/);
  assert.match(deckPrompt.designSkill.rules.join("\n"), /knowledge-detail/);
  assert.match(deckPrompt.designSkill.rules.join("\n"), /40-80 字重点解释/);
  assert.match(polishPrompt.designSkill.rules.join("\n"), /结论标题/);
  assert.match(polishPrompt.designSkill.rules.join("\n"), /详情展开页/);
  assert.match(polishPrompt.designSkill.rules.join("\n"), /解释某个知识点/);
  assert.deepEqual(outlinePrompt.designSkill.detailPageTypes, [
    "knowledge-detail",
    "detail-analysis",
    "deep-dive",
    "case-detail",
    "problem-detail",
    "plan-detail",
  ]);
  assert.match(outlinePrompt.designSkill.antiPatterns.join("\n"), /四段式卡片/);
  assert.match(outlinePrompt.designSkill.antiPatterns.join("\n"), /知识点只列名词/);
  assert.deepEqual(outlinePrompt.templateContext.allowedLayouts, template.layoutSchema.allowedLayouts);
});

test("PptService preserves dome layout roles for the business template", async () => {
  const roles = ["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"];
  const aiProvider = new MockAiProvider();
  aiProvider.generateOutline = async () => roles.map((role, index) => ({
    title: `Dome ${role}`,
    bullets: index === 0 ? ["年度汇报"] : ["要点一", "要点二", "要点三"],
    layout: role,
  }));
  aiProvider.generateSlides = async ({ outline }) => outline.slides.map((slide, index) => ({
    id: `slide_${index + 1}`,
    sortOrder: index + 1,
    title: slide.title,
    bullets: slide.bullets,
    speakerNotes: "",
    layout: roles[index],
    theme: outline.theme,
  }));
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Dome layout roles",
    slideCount: roles.length,
    templateId: "business",
    theme: "modern",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.deepEqual(result.deck.slides.map((slide) => slide.layout), roles);
});

test("PptService uses a user-owned template for preview and exports", async () => {
  const context = await createBusinessContext();
  await context.database.insert("template_categories", { id: "custom", name: "Custom", sortOrder: 20 });
  await context.database.insert("templates", {
    id: "user-template-7",
    name: "User Template 7",
    categoryId: "custom",
    scope: "user",
    status: "active",
    ownerUserId: 7,
    themes: [{ id: "custom-dark", name: "Custom Dark" }],
    visual: {
      primary: "123456",
      accent: "ABCDEF",
      background: "101820",
      surface: "FFFFFF",
      title: "F8FAFC",
      body: "E2E8F0",
      layout: "left-rail",
    },
    layoutSchema: {
      defaultCoverLayout: "lesson-title",
      defaultContentLayout: "lesson-content",
      allowedLayouts: ["lesson-title", "lesson-content"],
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "User template generation",
    slideCount: 2,
    templateId: "user-template-7",
    theme: "custom-dark",
  });
  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });
  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: result.deck.id });
  const pptx = await context.pptService.exportDeck({ ownerUserId: 7, deckId: result.deck.id, format: "pptx" });
  const pdf = await context.pptService.exportDeck({ ownerUserId: 7, deckId: result.deck.id, format: "pdf" });
  const pptxDownload = await context.storage.download({ ownerUserId: 7, fileId: pptx.file.id });
  const pdfDownload = await context.storage.download({ ownerUserId: 7, fileId: pdf.file.id });

  assert.match(preview, /data-template="user-template-7"/);
  assert.match(preview, /--template-primary:#123456/);
  assert.match(pptxDownload.content.toString("latin1"), /val="123456"/);
  assert.match(pdfDownload.content.toString("latin1"), /0\.071 0\.204 0\.337 rg/);
});

test("PptService persists generated decks as owner-scoped PPT assets", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Managed asset",
    slideCount: 2,
    templateId: "business",
  });
  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  const assets = await context.pptService.listAssets({ ownerUserId: 7 });
  const detail = await context.pptService.getAsset({ ownerUserId: 7, assetId: assets[0].id });

  assert.equal(assets.length, 1);
  assert.equal(assets[0].deckId, result.deck.id);
  assert.equal(assets[0].title, "Managed asset");
  assert.equal(assets[0].status, "active");
  assert.equal(detail.asset.deckId, result.deck.id);
  assert.equal(detail.deck.id, result.deck.id);
  assert.equal((await context.pptService.listAssets({ ownerUserId: 9 })).length, 0);
  await assert.rejects(
    () => context.pptService.getAsset({ ownerUserId: 9, assetId: assets[0].id }),
    { code: "ASSET_NOT_FOUND" },
  );
});

test("PptService stores exported files in storage_objects with deck and asset metadata", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Indexed export",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });
  const [asset] = await context.pptService.listAssets({ ownerUserId: 7 });

  const pptx = await context.pptService.exportDeck({ ownerUserId: 7, deckId: deck.id, format: "pptx" });
  const pdf = await context.pptService.exportDeck({ ownerUserId: 7, deckId: deck.id, format: "pdf" });
  const objects = await context.database.find("storage_objects", (object) => object.ownerUserId === 7);

  assert.deepEqual(objects.map((object) => object.fileRole), ["generated_pptx", "generated_pdf"]);
  assert.deepEqual(objects.map((object) => object.assetId), [asset.id, asset.id]);
  assert.deepEqual(objects.map((object) => object.deckId), [deck.id, deck.id]);
  assert.deepEqual(objects.map((object) => object.fileId), [pptx.file.id, pdf.file.id]);
  assert.equal(objects.every((object) => object.visibility === "private" && object.status === "available"), true);
});

test("PptService enforces a 100 active PPT asset quota and soft delete releases a slot", async () => {
  const context = await createBusinessContext();
  for (let index = 0; index < 100; index += 1) {
    await context.database.insert("ppt_assets", {
      ownerUserId: 7,
      deckId: `deck_${index}`,
      outlineId: `outline_${index}`,
      title: `Asset ${index}`,
      status: "active",
      slideCount: 1,
      templateId: "business",
      theme: "modern",
    });
  }
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Quota blocked",
    slideCount: 1,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    (error) => {
      assert.equal(error.code, "PPT_ASSET_LIMIT_REACHED");
      assert.equal(error.status, 409);
      assert.equal(error.publicDetails.limit, 100);
      return true;
    },
  );
  assert.deepEqual(context.billingCalls, []);

  const [firstAsset] = await context.pptService.listAssets({ ownerUserId: 7 });
  const deleted = await context.pptService.deleteAsset({ ownerUserId: 7, assetId: firstAsset.id });
  const generated = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });
  const assets = await context.pptService.listAssets({ ownerUserId: 7 });

  assert.equal(deleted.status, "deleted");
  assert.equal(generated.deck.status, "ready");
  assert.equal(assets.length, 100);
  assert.equal(assets.some((asset) => asset.id === firstAsset.id), false);
});

test("PptService marks failed generation retryable and retry succeeds", async () => {
  const context = await createBusinessContext({
    aiProvider: new MockAiProvider({ failNextDeck: true }),
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Risk review",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 }),
    /AI_PROVIDER_FAILED/,
  );
  const failedTask = (await context.database.find("generation_tasks"))[0];
  const retried = await context.pptService.retryTask({
    ownerUserId: 7,
    taskId: failedTask.id,
    entitlementId: 88,
  });

  assert.equal(failedTask.status, "failed");
  assert.equal(retried.task.status, "succeeded");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "release", "balance", "reserve", "settle"]);
});

test("HTTP API returns retryable task ID when deck generation fails", async () => {
  const context = await createBusinessContext({
    aiProvider: new MockAiProvider({ failNextDeck: true }),
  });
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Retryable failure",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const failedResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const failedBody = await failedResponse.json();

    assert.equal(failedResponse.status, 502);
    assert.equal(failedBody.error.code, "AI_PROVIDER_FAILED");
    assert.match(failedBody.error.details.task_id, /^[0-9a-f-]+$/);
    const taskResponse = await fetch(`${baseUrl}/api/ppt/tasks/${failedBody.error.details.task_id}`, { headers: { cookie } });
    const taskBody = await taskResponse.json();
    assert.equal(taskResponse.status, 200);
    assert.equal(taskBody.task.status, "failed");
    assert.equal(taskBody.task.retryable, true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API runs acceptance flow from login to outline, deck, preview, exports, billing, and logs", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Board update",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outline = await outlineResponse.json();
    const editedResponse = await fetch(`${baseUrl}/api/ppt/outlines/${outline.outline.id}`, {
      method: "PATCH",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ slides: outline.outline.slides }),
    });
    assert.equal(editedResponse.status, 200);
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
    });
    const deckBody = await deckResponse.json();
    const taskResponse = await fetch(`${baseUrl}/api/ppt/tasks/${deckBody.task.id}`, { headers: { cookie } });
    const taskBody = await taskResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });
    const pptx = await postJson(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/exports`, cookie, { format: "pptx" });
    const pdf = await postJson(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/exports`, cookie, { format: "pdf" });
    const pptxBody = await pptx.json();
    const pdfBody = await pdf.json();
    const downloadedPptx = await fetch(`${baseUrl}/api/files/${pptxBody.file.id}`, { headers: { cookie } });
    const logs = await fetch(`${baseUrl}/api/logs`, { headers: { cookie } });
    const logsBody = await logs.json();

    assert.equal(deckBody.task.status, "succeeded");
    assert.equal(taskResponse.status, 200);
    assert.equal(taskBody.task.status, "succeeded");
    assert.equal(taskBody.task.progress, 100);
    assert.equal(taskBody.task.deckId, deckBody.deck.id);
    assert.match(await preview.text(), /Board update/);
    assert.equal(pptxBody.file.mimeType.includes("presentationml"), true);
    assert.equal(pdfBody.file.mimeType, "application/pdf");
    assert.equal(downloadedPptx.status, 200);
    assert.match(downloadedPptx.headers.get("content-disposition"), /filename="PPT-Board-update-business-2p-\d{8}-\d{4}-[a-zA-Z0-9]+\.pptx"/);
    assert.equal((await downloadedPptx.arrayBuffer()).byteLength > 0, true);
    assert.equal(logsBody.logs.some((log) => log.action === "file_downloaded" && log.resourceId === pptxBody.file.id), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API supports document upload based outline and deck generation", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const upload = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "source.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("Source document\nUsed for outline generation").toString("base64"),
      }),
    });
    const uploadBody = await upload.json();
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      source_file_id: uploadBody.file.id,
      slide_count: 3,
      template_id: "business",
      theme: "modern",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
    });
    const deckBody = await deckResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });

    assert.equal(upload.status, 201);
    assert.equal(outlineResponse.status, 201);
    assert.equal(outline.outline.slides[0].title, "Source document");
    assert.equal(outline.outline.slides.length, 3);
    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.task.status, "succeeded");
    const previewBody = await preview.text();
    assert.equal(preview.status, 200);
    assert.match(previewBody, /Source document/);
    assert.match(preview.headers.get("content-type"), /text\/html/);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].entitlementId === 88 && call[1].userId === 7), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API preview exposes selected template visual styling", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Business styling",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
    });
    const deckBody = await deckResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });
    const html = await preview.text();

    assert.equal(preview.status, 200);
    assert.match(html, /data-template="business"/);
    assert.match(html, /--template-primary:#B91C1C/);
    assert.match(html, /--template-accent:#D97706/);
    assert.match(html, /--template-bg:#FFF1E6/);
    assert.match(html, /data-layout="top-band"/);
    assert.match(html, /data-dome-role="cover"/);
    assert.match(html, /class="top-band-cover-frame"/);
    assert.match(html, /class="top-band-cover-metrics"/);
    assert.match(html, /class="preview-page"/);
    assert.match(html, /aspect-ratio:16\/9/);
    assert.match(html, /class="page-number">1 \/ 2/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API preview reflects business minimal theme layout override", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Minimal template validation",
      slide_count: 2,
      template_id: "business",
      theme: "minimal",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
    });
    const deckBody = await deckResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });
    const html = await preview.text();

    assert.equal(deckBody.deck.templateId, "business");
    assert.equal(deckBody.deck.theme, "minimal");
    assert.equal(preview.status, 200);
    assert.match(html, /data-layout="top-band"/);
    assert.match(html, /--template-accent:#6B7280/);
    assert.match(html, /class="top-band-cover-glow"/);
    assert.match(html, /class="top-band-cover-kicker"/);
    assert.match(html, /class="top-band-cover-frame"/);
    assert.match(html, /class="top-band-cover-sheen"/);
    assert.match(html, /class="top-band-cover-label"/);
    assert.match(html, /class="top-band-cover-title"/);
    assert.match(html, /class="top-band-content-title"/);
    assert.match(html, /class="top-band-cover-bullets"/);
    assert.match(html, /class="top-band-content-bullets"/);
    assert.match(html, /class="top-band-content-rail"/);
    assert.match(html, /class="top-band-content-wave"/);
    assert.match(html, /class="top-band-content-rule"/);
    assert.match(html, /class="top-band-ribbon"/);
    assert.match(html, /class="top-band-page-chip"/);
    assert.match(html, />01<\//);
    assert.doesNotMatch(html, /class="dome-role-decor/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("PptService preview renders dome role classes and business image assets", async () => {
  const context = await createBusinessContext();
  const deck = await context.database.insert("decks", {
    ownerUserId: 7,
    outlineId: "outline-dome-preview",
    title: "Dome preview",
    templateId: "business",
    templateName: "Executive Business",
    templateVisual: {
      primary: "1F4E79",
      accent: "F4A261",
      background: "8F0613",
      surface: "FFF8E6",
      title: "0F2945",
      body: "3C1F1F",
      layout: "red-gold",
    },
    theme: "modern",
    status: "ready",
    slides: [
      { title: "封面", bullets: [{ text: "年度汇报" }], layout: "cover" },
      { title: "目录", bullets: ["工作汇报", "成果展示"], layout: "agenda" },
      { title: "第一章", bullets: ["PART 01"], layout: "section-divider" },
      { title: "工作汇报图文页", bullets: [{ text: "业务进展" }, { title: "团队投入" }, { label: "关键成果" }], layout: "image-report" },
      { title: "追加封面", bullets: ["Manual cover"], layout: "cover" },
      { title: "三步骤流程", bullets: [{ text: "Discovery" }, { title: "Planning" }, { label: "Launch" }], layout: "three-steps" },
      { title: "四步骤流程", bullets: [{ text: "Target split" }, { title: "Resource plan" }, { label: "Process tracking" }, { name: "Review loop" }], layout: "four-steps" },
      { title: "数据指标", bullets: [{ label: "Revenue growth", value: "32%" }, { name: "Retention rate", amount: "88%" }, { label: "Delivery speed", value: "2.4d" }], layout: "metrics" },
      { title: "成果展示", bullets: [{ text: "项目成果" }, { title: "客户反馈" }, { label: "团队荣誉" }], layout: "showcase", sectionLabel: "PART 02" },
      { title: "问题复盘", bullets: [{ text: "Risk signal" }, { title: "Root cause" }, { label: "Mitigation" }], layout: "retrospective" },
      { title: "下一步计划", bullets: [{ phase: "Q1", action: "Quarter roadmap" }, { stage: "Q2", task: "Key action" }, { phase: "Q3", action: "Owner review" }], layout: "next-plan" },
      { title: "汇报结束", bullets: [{ text: "感谢观看" }], layout: "closing" },
    ],
  });

  const html = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  for (const role of ["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"]) {
    assert.match(html, new RegExp(`data-dome-role="${role}"`));
  }
  assert.match(html, /--dome-business-1:url\("data:image\/jpeg;base64,/);
  assert.match(html, /--dome-business-4:url\("data:image\/jpeg;base64,/);
  assert.match(html, /--dome-business-6:url\("data:image\/jpeg;base64,/);
  assert.match(html, /\.slide\[data-dome-role="three-steps"\] \.dome-role-visual\{background-image:var\(--dome-business-3\);\}/);
  assert.match(html, /\.slide\[data-dome-role="four-steps"\] \.dome-role-visual\{background-image:var\(--dome-business-4\);\}/);
  assert.match(html, /class="dome-role-visual"/);
  assert.equal([...html.matchAll(/class="dome-role-decor dome-content-frame"/g)].length, 9);
  assert.equal([...html.matchAll(/class="dome-role-decor dome-content-surface"/g)].length, 7);
  assert.match(html, /\.dome-wave-arc\.dome-wave-gold/);
  assert.match(html, /\.dome-wave-arc\.dome-wave-light/);
  assert.equal([...html.matchAll(/class="dome-role-decor dome-wave-arc dome-wave-gold"/g)].length, 12);
  assert.equal([...html.matchAll(/class="dome-role-decor dome-wave-arc dome-wave-light"/g)].length, 12);
  assert.equal([...html.matchAll(/class="dome-role-decor dome-footer-decoration"/g)].length, 12);
  assert.doesNotMatch(html, /商务办公系列 PPT 模板/);
  assert.doesNotMatch(html, /Executive Business/);
  assert.match(html, /dome-agenda-card/);
  assert.equal([...html.matchAll(/class="dome-agenda-card"/g)].length, 4);
  assert.equal([...html.matchAll(/class="dome-agenda-number"/g)].length, 4);
  assert.match(html, /<span class="dome-agenda-number">01<\/span><span class="dome-agenda-text">工作汇报<\/span>/);
  assert.match(html, /<span class="dome-agenda-text">问题不足<\/span>/);
  assert.match(html, /<span class="dome-agenda-text">下步计划<\/span>/);
  assert.equal([...html.matchAll(/class="dome-image-report-card"/g)].length, 3);
  assert.match(html, /class="dome-role-decor dome-section-number">PART 01<\/div>/);
  assert.match(html, /data-dome-role="section-divider"[\s\S]*class="dome-role-decor dome-section-divider-line"/);
  assert.match(html, /data-dome-role="image-report"[\s\S]*class="dome-role-decor dome-section-label">PART 03<\/div>/);
  assert.match(html, /data-dome-role="three-steps"[\s\S]*class="dome-role-decor dome-section-label">PART 05<\/div>/);
  assert.match(html, /data-dome-role="three-steps"[\s\S]*class="dome-role-visual"/);
  assert.match(html, /data-dome-role="four-steps"[\s\S]*class="dome-role-decor dome-section-label">PART 06<\/div>/);
  assert.equal([...html.matchAll(/class="dome-role-decor dome-step-connector"/g)].length, 2);
  assert.match(html, /data-dome-role="three-steps"[\s\S]*class="dome-role-decor dome-step-connector"/);
  assert.match(html, /data-dome-role="four-steps"[\s\S]*class="dome-role-decor dome-step-connector"/);
  assert.match(html, /data-dome-role="metrics"[\s\S]*class="dome-role-decor dome-section-label">PART 07<\/div>/);
  assert.match(html, /class="dome-role-decor dome-section-label">PART 02<\/div>/);
  assert.match(html, /data-dome-role="next-plan"[\s\S]*class="dome-role-decor dome-section-label">PART 10<\/div>/);
  assert.match(html, /dome-metric-card/);
  assert.match(html, /<span class="dome-metric-value">88%<\/span><span class="dome-metric-label">Retention rate<\/span>/);
  assert.equal([...html.matchAll(/class="dome-showcase-card"/g)].length, 3);
  assert.equal([...html.matchAll(/class="dome-showcase-number"/g)].length, 3);
  assert.match(html, /<span class="dome-showcase-number">01<\/span><span class="dome-showcase-text">项目成果<\/span>/);
  assert.match(html, /<span class="dome-showcase-number">03<\/span><span class="dome-showcase-text">团队荣誉<\/span>/);
  assert.match(html, /dome-risk-card/);
  assert.equal([...html.matchAll(/class="dome-retrospective-card"/g)].length, 3);
  assert.equal([...html.matchAll(/class="dome-retrospective-label"/g)].length, 3);
  assert.match(html, /dome-plan-timeline/);
  assert.equal([...html.matchAll(/class="dome-next-plan-phase"/g)].length, 4);
  assert.equal([...html.matchAll(/class="dome-next-plan-action"/g)].length, 4);
  assert.match(html, /class="dome-role-decor dome-cover-subtitle">年度汇报<\/div>/);
  assert.match(html, /<span class="dome-card-index">01<\/span><span class="dome-card-text">Discovery<\/span>/);
  assert.match(html, /<span class="dome-metric-value">2\.4d<\/span><span class="dome-metric-label">Delivery speed<\/span>/);
  assert.match(html, /<span class="dome-card-text">团队投入<\/span>/);
  assert.match(html, /<span class="dome-retrospective-label">风险<\/span><span class="dome-card-text">Risk signal<\/span>/);
  assert.match(html, /<span class="dome-retrospective-label">原因<\/span><span class="dome-card-text">Root cause<\/span>/);
  assert.match(html, /<span class="dome-retrospective-label">措施<\/span><span class="dome-card-text">Mitigation<\/span>/);
  assert.match(html, /<span class="dome-next-plan-phase">Q1<\/span><span class="dome-next-plan-action">Quarter roadmap<\/span>/);
  assert.match(html, /<span class="dome-next-plan-phase">Q3<\/span><span class="dome-next-plan-action">Owner review<\/span>/);
  assert.doesNotMatch(html, /\[object Object\]/);
  for (const role of ["cover", "three-steps", "metrics", "closing"]) {
    assert.doesNotMatch(previewRoleHtml(html, role), /<ul><\/ul>/);
  }
  assert.doesNotMatch(html, /data-dome-role="three-steps"[\s\S]*<li>Discovery<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="metrics"[\s\S]*<li>Retention rate<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="image-report"[\s\S]*<li>团队投入<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="showcase"[\s\S]*<li>客户反馈<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="retrospective"[\s\S]*<li>Root cause<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="closing"[\s\S]*<li>感谢观看<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="cover"[\s\S]*<li>年度汇报<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="section-divider"[\s\S]*<li>PART 01<\/li>/);
  const previewSlides = [...html.matchAll(/<div class="([^"]*\bslide\b[^"]*)" data-dome-role="([^"]+)"[\s\S]*?<h2(?:\s[^>]*)?>([^<]+)<\/h2>/g)];
  const explicitCoverSlide = previewSlides.find(([, , , title]) => title === "追加封面");
  assert.equal(explicitCoverSlide?.[2], "cover");
  assert.match(explicitCoverSlide?.[1] || "", /\bslide-cover\b/);
  const closingSlide = previewSlides.find(([, , , title]) => title === "汇报结束");
  assert.equal(closingSlide?.[2], "closing");
  assert.match(closingSlide?.[1] || "", /\bslide-cover\b/);
});

test("PptService preview infers image-report role from work summary titles", async () => {
  const context = await createBusinessContext();
  const deck = await context.database.insert("decks", {
    ownerUserId: 7,
    outlineId: "outline-dome-implicit-summary",
    title: "Dome implicit summary",
    templateId: "business",
    templateName: "Executive Business",
    templateVisual: {
      primary: "1F4E79",
      accent: "F4A261",
      background: "8F0613",
      surface: "FFF8E6",
      title: "0F2945",
      body: "3C1F1F",
      layout: "red-gold",
    },
    theme: "modern",
    status: "ready",
    slides: [
      { title: "封面", bullets: ["年度汇报"] },
      { title: "年度工作概况", bullets: ["业务进展", "团队投入", "关键成果"] },
    ],
  });

  const html = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  const previewSlides = [...html.matchAll(/<div class="([^"]*\bslide\b[^"]*)" data-dome-role="([^"]+)"[\s\S]*?<h2(?:\s[^>]*)?>([^<]+)<\/h2>/g)];
  const summarySlide = previewSlides.find(([, , , title]) => title === "年度工作概况");
  assert.equal(summarySlide?.[2], "image-report");
});

test("PptService preview fills a default dome section number when omitted", async () => {
  const context = await createBusinessContext();
  const deck = await context.database.insert("decks", {
    ownerUserId: 7,
    outlineId: "outline-dome-default-section",
    title: "Dome default section",
    templateId: "business",
    templateName: "Executive Business",
    templateVisual: {
      primary: "1F4E79",
      accent: "F4A261",
      background: "8F0613",
      surface: "FFF8E6",
      title: "0F2945",
      body: "3C1F1F",
      layout: "red-gold",
    },
    theme: "modern",
    status: "ready",
    slides: [
      { title: "封面", bullets: ["年度汇报"], layout: "cover" },
      { title: "第一章", bullets: [], layout: "section-divider" },
    ],
  });

  const html = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-dome-role="section-divider"[\s\S]*class="dome-role-decor dome-section-number">PART 01<\/div>/);
  assert.doesNotMatch(html, /class="dome-role-decor dome-section-number">PART 00<\/div>/);
});

test("HTTP API generates a new deck from an existing outline with the currently selected template", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Template switch",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
      template_id: "pitch",
      theme: "startup",
    });
    const deckBody = await deckResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });
    const html = await preview.text();

    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.deck.templateId, "pitch");
    assert.equal(deckBody.deck.theme, "startup");
    assert.equal(deckBody.deck.slides.length, outline.outline.slides.length);
    assert.match(deckBody.deck.slides[0].bullets[0], /Pitch angle:/);
    assert.match(html, /data-template="pitch"/);
    assert.match(html, /--template-primary:#16213E/);
    assert.match(html, /data-layout="venture"/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API lists template categories and merges official active templates with owner templates", async () => {
  const context = await createBusinessContext();
  await context.database.insert("template_categories", { id: "custom", name: "Custom", sortOrder: 20 });
  const officialThumbnail = await context.storage.upload({
    ownerUserId: 0,
    fileName: "official-custom-thumbnail.png",
    mimeType: "image/png",
    content: Buffer.from("official-thumbnail"),
    fileRole: "official_template_thumbnail",
    visibility: "official",
    templateSlug: "official-custom",
  });
  await context.database.insert("templates", {
    id: "official-custom",
    name: "Official Custom",
    categoryId: "custom",
    scope: "official",
    status: "active",
    thumbnailFileId: officialThumbnail.id,
    themes: [{ id: "clean", name: "Clean" }],
  });
  await context.database.insert("templates", {
    id: "disabled-custom",
    name: "Disabled Custom",
    categoryId: "custom",
    scope: "official",
    status: "disabled",
  });
  await context.database.insert("templates", {
    id: "my-custom",
    name: "My Custom",
    categoryId: "custom",
    scope: "user",
    status: "active",
    ownerUserId: 7,
    themes: [{ id: "mine", name: "Mine" }],
  });
  await context.database.insert("templates", {
    id: "their-custom",
    name: "Their Custom",
    categoryId: "custom",
    scope: "user",
    status: "active",
    ownerUserId: 9,
  });
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const categoriesResponse = await fetch(`${baseUrl}/api/template-categories`, { headers: { cookie } });
    const templatesResponse = await fetch(`${baseUrl}/api/templates?category_id=custom`, { headers: { cookie } });
    const categories = await categoriesResponse.json();
    const templates = await templatesResponse.json();

    assert.equal(categoriesResponse.status, 200);
    assert.equal(categories.categories.some((category) => category.id === "custom"), true);
    assert.equal(templatesResponse.status, 200);
    assert.deepEqual(templates.templates.map((template) => template.id), ["official-custom", "my-custom"]);
    assert.equal(templates.templates[0].category.id, "custom");
    assert.equal(templates.templates[0].thumbnailUrl, "/api/templates/official-custom/thumbnail");
    assert.equal(templates.templates[1].scope, "user");

    const thumbnailResponse = await fetch(`${baseUrl}${templates.templates[0].thumbnailUrl}`, { headers: { cookie } });
    assert.equal(thumbnailResponse.status, 200);
    assert.equal(thumbnailResponse.headers.get("content-type"), "image/png");
    assert.equal(await thumbnailResponse.text(), "official-thumbnail");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API persists generated PPT assets across sessions and isolates owners", async () => {
  const context = await createBusinessContext();
  let nextIdentity = { user_id: 7, app_id: 15, product_id: 73 };
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => nextIdentity },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const firstEnter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const firstCookie = firstEnter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, firstCookie, {
      topic: "Persistent history",
      slide_count: 2,
      template_id: "business",
    });
    const outlineBody = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, firstCookie, {
      outline_id: outlineBody.outline.id,
    });
    assert.equal(deckResponse.status, 201);

    const secondEnter = await fetch(`${baseUrl}/enter?ticket=again`, { redirect: "manual" });
    const secondCookie = secondEnter.headers.get("set-cookie").split(";")[0];
    const listResponse = await fetch(`${baseUrl}/api/ppt/assets`, { headers: { cookie: secondCookie } });
    const listBody = await listResponse.json();
    const detailResponse = await fetch(`${baseUrl}/api/ppt/assets/${listBody.assets[0].id}`, { headers: { cookie: secondCookie } });
    const detailBody = await detailResponse.json();

    nextIdentity = { user_id: 9, app_id: 15, product_id: 73 };
    const otherEnter = await fetch(`${baseUrl}/enter?ticket=other`, { redirect: "manual" });
    const otherCookie = otherEnter.headers.get("set-cookie").split(";")[0];
    const otherListResponse = await fetch(`${baseUrl}/api/ppt/assets`, { headers: { cookie: otherCookie } });
    const otherListBody = await otherListResponse.json();
    const forbiddenDetail = await fetch(`${baseUrl}/api/ppt/assets/${listBody.assets[0].id}`, { headers: { cookie: otherCookie } });

    const deleteResponse = await fetch(`${baseUrl}/api/ppt/assets/${listBody.assets[0].id}`, {
      method: "DELETE",
      headers: { cookie: secondCookie },
    });
    const afterDeleteResponse = await fetch(`${baseUrl}/api/ppt/assets`, { headers: { cookie: secondCookie } });
    const afterDeleteBody = await afterDeleteResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.assets.length, 1);
    assert.equal(listBody.assets[0].title, "Persistent history");
    assert.equal(detailResponse.status, 200);
    assert.equal(detailBody.asset.title, "Persistent history");
    assert.equal(detailBody.deck.id, listBody.assets[0].deckId);
    assert.deepEqual(otherListBody.assets, []);
    assert.equal(forbiddenDetail.status, 404);
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(afterDeleteBody.assets, []);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API blocks downloads for files belonging to deleted PPT assets", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    internalToken: "download-secret",
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Deleted download",
      slide_count: 2,
      template_id: "business",
    });
    const outlineBody = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outlineBody.outline.id,
    });
    const deckBody = await deckResponse.json();
    const [asset] = await context.pptService.listAssets({ ownerUserId: 7 });
    const exportResponse = await postJson(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/exports`, cookie, { format: "pdf" });
    const exportBody = await exportResponse.json();
    const signedResponse = await fetch(`${baseUrl}/api/files/${exportBody.file.id}/download-url`, { headers: { cookie } });
    const signedBody = await signedResponse.json();

    const deleteResponse = await fetch(`${baseUrl}/api/ppt/assets/${asset.id}`, { method: "DELETE", headers: { cookie } });
    const directDownload = await fetch(`${baseUrl}/api/files/${exportBody.file.id}`, { headers: { cookie } });
    const signedDownload = await fetch(`${baseUrl}${signedBody.url}`);
    const directBody = await directDownload.json();
    const signedDownloadBody = await signedDownload.json();

    assert.equal(exportResponse.status, 201);
    assert.equal(signedResponse.status, 200);
    assert.equal(deleteResponse.status, 200);
    assert.equal(directDownload.status, 404);
    assert.equal(directBody.error.code, "FILE_NOT_FOUND");
    assert.equal(signedDownload.status, 404);
    assert.equal(signedDownloadBody.error.code, "FILE_NOT_FOUND");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API rejects invalid outline edits before deck generation", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Invalid outline edit",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outlineBody = await outlineResponse.json();
    const editResponse = await fetch(`${baseUrl}/api/ppt/outlines/${outlineBody.outline.id}`, {
      method: "PATCH",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ slides: [{ title: "Missing bullets" }] }),
    });
    const editBody = await editResponse.json();
    const storedOutline = await context.database.findOne("outlines", (outline) => outline.id === outlineBody.outline.id);

    assert.equal(editResponse.status, 400);
    assert.equal(editBody.error.code, "OUTLINE_INVALID");
    assert.equal(storedOutline.status, "outline_ready");
    assert.equal(storedOutline.slides.length, 2);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API keeps edited outline slide count within page limits", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Too many edited slides",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outlineBody = await outlineResponse.json();
    const tooManySlides = Array.from({ length: 33 }, (_, index) => ({
      title: `Slide ${index + 1}`,
      bullets: ["A"],
    }));
    const editResponse = await fetch(`${baseUrl}/api/ppt/outlines/${outlineBody.outline.id}`, {
      method: "PATCH",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ slides: tooManySlides }),
    });
    const editBody = await editResponse.json();
    const storedOutline = await context.database.findOne("outlines", (outline) => outline.id === outlineBody.outline.id);

    assert.equal(editResponse.status, 400);
    assert.equal(editBody.error.code, "OUTLINE_INVALID");
    assert.equal(storedOutline.slides.length, 2);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("workspace page exposes the AI PPT generation controls after login", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(html, /AI PPT 工作台/);
    assert.match(html, /生成工作台/);
    assert.match(html, /模板管理/);
    assert.match(html, /资产库/);
    assert.match(html, /状态中心/);
    assert.match(html, /id="topic"/);
    assert.match(html, /PPT 生成步骤/);
    assert.match(html, /输入生成需求/);
    assert.match(html, /确认内容大纲/);
    assert.match(html, /套用商业模板/);
    assert.match(html, /预览并导出/);
    assert.match(html, /data-flow-step="download"/);
    assert.match(html, /data-flow-panel="input outline preview"/);
    assert.match(html, /data-flow-panel="outline"/);
    assert.match(html, /data-flow-panel="preview"/);
    assert.match(html, /data-flow-panel="outline preview"/);
    assert.match(html, /setFlowStep/);
    assert.match(html, /setFlowStage/);
    assert.match(html, /applyWorkspaceVisibility/);
    assert.match(html, /id="outline-editor"/);
    assert.match(html, /id="outline-board"/);
    assert.match(html, /id="outline-summary"/);
    assert.match(html, /id="back-to-outline"/);
    assert.match(html, /setFlowStage\("outline"\)/);
    assert.match(html, /返回资产库/);
    assert.match(html, /已返回资产库/);
    assert.match(html, /大纲信息/);
    assert.match(html, /大纲确认/);
    assert.match(html, /当前状态/);
    assert.match(html, /可编辑要点/);
    assert.match(html, /class="outline-shell"/);
    assert.match(html, /body\[data-workspace-page="create"\]\[data-flow-stage="input"\] main \{ grid-template-columns: minmax\(0, 760px\); justify-content: center/);
    assert.match(html, /body\[data-workspace-page="create"\]\[data-flow-stage="outline"\] main \{ grid-template-columns: minmax\(0, 1180px\); justify-content: center/);
    assert.match(html, /data-flow-panel="input outline"/);
    assert.match(html, /\.workflow > \.panel\[data-flow-panel~="input"\]/);
    assert.match(html, /\.workflow > \.panel\[data-flow-panel~="outline"\]/);
    assert.match(html, /\.outline-shell\[data-flow-panel="input"\] \{ display: none !important; \}/);
    assert.match(html, /body\[data-workspace-page="create"\]\[data-flow-stage="outline"\] \.outline-shell \{ margin-top: 18px; \}/);
    assert.match(html, /renderOutlineBoard/);
    assert.match(html, /renderOutlineLoading/);
    assert.match(html, /loading-spinner/);
    assert.match(html, /正在生成大纲/);
    assert.match(html, /理解主题和文档内容/);
    assert.match(html, /OUTLINE_REVEAL_INTERVAL_MS = 620/);
    assert.match(html, /revealOutlineCards/);
    assert.match(html, /data-outline-reveal-list/);
    assert.match(html, /is-revealing/);
    assert.match(html, /stagger: true/);
    assert.match(html, /requireEditableOutlineSlides/);
    assert.match(html, /loadTemplates/);
    assert.match(html, /\/api\/templates/);
    assert.match(html, /id="template-gallery"/);
    assert.match(html, /id="template-search"/);
    assert.match(html, /type="search"/);
    assert.match(html, /templateSearchQuery/);
    assert.match(html, /templateMatchesSearch/);
    assert.match(html, /TEMPLATE_CATEGORY_PREVIEW_LIMIT = 10/);
    assert.match(html, /expandedTemplateCategoryId/);
    assert.match(html, /data-template-category-toggle/);
    assert.match(html, /data-create-template-card-list/);
    assert.match(html, /data-create-template-category-toggle/);
    assert.match(html, /create-template-grid/);
    assert.match(html, /选择模板分类后，下方会展示该分类的模板缩略图/);
    assert.match(html, /selectedTemplateCategoryName/);
    assert.match(html, /先展示前 10 个模板/);
    assert.match(html, /模板内容样式预览/);
    assert.match(html, /class="template-card"/);
    assert.match(html, /class="template-thumb"/);
    assert.match(html, /template-thumb-back/);
    assert.match(html, /template-thumb-cover/);
    assert.match(html, /template-thumb-image/);
    assert.match(html, /template-thumb-wave/);
    assert.match(html, /--dome-template-thumb:url\("data:image\/jpeg;base64,/);
    assert.match(html, /data-has-dome-asset="true"/);
    assert.match(html, /data-template-card/);
    assert.match(html, /renderTemplateGallery/);
    assert.match(html, /selectTemplateCard/);
    assert.match(html, /normalizedTemplateVisual/);
    assert.match(html, /id="generate-outline"/);
    assert.match(html, /<select id="slide-count">/);
    assert.match(html, /<option value="32">32 页<\/option>/);
    assert.match(html, /setButtonWaiting\(generateButton, true, "生成中\.\.\."\)/);
    assert.match(html, /id="save-outline"/);
    assert.match(html, /每行一个要点/);
    assert.match(html, /\/api\/ppt\/outlines\/" \+ state\.outlineId/);
    assert.match(html, /id="preview"/);
    assert.match(html, /data-page-panel="create assets"/);
    assert.match(html, /生成后可直接查看排版效果/);
    assert.match(html, /下载文件/);
    assert.match(html, /download-button/);
    assert.match(html, /PPT 结构调整/);
    assert.match(html, /id="structure-slide-title"/);
    assert.match(html, /id="structure-slide-layout"/);
    assert.match(html, /id="structure-slide-bullets"/);
    assert.match(html, /id="apply-structure-preview"/);
    assert.match(html, /id="slide-edit-modal"/);
    assert.match(html, /id="single-page-ai-toggle"/);
    assert.match(html, /AI 优化本页/);
    assert.match(html, /structure-side-panel/);
    assert.match(html, /ai-polish-side-panel/);
    assert.match(html, /应用结构并重新预览/);
    assert.match(html, /renderStructureEditor/);
    assert.match(html, /applyStructureEditorToSelectedSlide/);
    assert.match(html, /AI 单页润色/);
    assert.match(html, /在中间预览中点击要优化的页面/);
    assert.doesNotMatch(html, /id="selected-slide-label"/);
    assert.match(html, /未选择页面/);
    assert.match(html, /attachPreviewSlidePicker/);
    assert.match(html, /selectPreviewSlide/);
    assert.match(html, /点击第 /);
    assert.match(html, /润色建议/);
    assert.match(html, /请先勾选需要 AI 单页优化/);
    assert.match(html, /setSlideRegenerationBusy/);
    assert.match(html, /preview-polish-loading/);
    assert.match(html, /polish-spinner/);
    assert.match(html, /button-spinner/);
    assert.match(html, /button-waiting-sheen/);
    assert.match(html, /button-label/);
    assert.match(html, /function setButtonWaiting/);
    assert.match(html, /classList\.toggle\("is-waiting"/);
    assert.match(html, /is-polishing/);
    assert.match(html, /请先应用模板生成 PPT，再使用 AI 润色单页/);
    assert.match(html, /请先用鼠标在在线预览中选择要润色的页面/);
    assert.match(html, /class="preview-frame"/);
    assert.match(html, /deck-loading/);
    assert.match(html, /正在应用当前模板生成 PPT/);
    assert.match(html, /deck-progress-bar/);
    assert.match(html, /deck-loading-slide/);
    assert.match(html, /renderDeckGeneratingPreview/);
    assert.match(html, /updateDeckGeneratingPreview/);
    assert.match(html, /setDeckGenerationBusy/);
    assert.match(html, /DECK_REVEAL_INTERVAL_MS = 700/);
    assert.match(html, /DECK_MIN_LOADING_MS = 2200/);
    assert.match(html, /waitForDeckLoadingRhythm/);
    assert.match(html, /\.preview-stage \{ position: relative; display: grid; min-height: 0;/);
    assert.match(html, /\.preview\.is-deck-loaded \{ height: 100%; min-height: 0;/);
    assert.match(html, /\.preview\.is-deck-loaded \.preview-frame \{ height: 100%; min-height: 0;/);
    assert.match(html, /\.preview, \.preview-frame, \.preview\.is-deck-loaded, \.preview\.is-deck-loaded \.preview-frame \{ min-height: 420px;/);
    assert.match(html, /renderDeckPreviewFrame/);
    assert.doesNotMatch(html, /fetch\("\/api\/ppt\/decks\/" \+ state\.deckId \+ "\/preview"\)\.then\(\(res\) => res\.text\(\)\)/);
    assert.match(html, /id="asset-list"/);
    assert.match(html, /id="asset-search"/);
    assert.match(html, /id="asset-time-filter"/);
    assert.match(html, /全部时间/);
    assert.match(html, /近 7 天/);
    assert.match(html, /assetMatchesTimeFilter/);
    assert.match(html, /assetTimeFilter/);
    assert.match(html, /id="asset-pagination"/);
    assert.match(html, /ASSET_PAGE_SIZE = 20/);
    assert.match(html, /function assetThumbHtml/);
    assert.match(html, /asset-thumb-title/);
    assert.match(html, /assetSearchQuery/);
    assert.match(html, /renderAssetPagination/);
    assert.match(html, /loadAssets/);
    assert.match(html, /assetPreviewOpen/);
    assert.match(html, /data-asset-preview-panel="true"/);
    assert.match(html, /data-asset-preview-open="false"/);
    assert.match(html, /打开预览/);
    assert.match(html, /assetCatalog = data\.assets \|\| \[\]/);
    assert.match(html, /state\.assetPreviewOpen = true/);
    assert.match(html, /setTemplateSelectionFromDeck/);
    assert.doesNotMatch(html, /syncTemplateScope/);
    assert.match(html, /state\.outlineId = deck\.outlineId \|\| null/);
    assert.match(html, /renderOutlineBoard\(deck\.slides \|\| \[\]\)/);
    assert.match(html, /previewRevision/);
    assert.match(html, /function slideIdForNumber/);
    assert.match(html, /function updateCurrentPreviewSlide/);
    assert.match(html, /updateCurrentPreviewSlide\(data\.slide\)/);
    assert.match(html, /dome-showcase-text/);
    assert.match(html, /async function refreshDeckPreviewFrame/);
    assert.match(html, /frame\.srcdoc = html/);
    assert.match(html, /await refreshDeckPreviewFrame\(state\.deckId\)/);
    assert.match(html, /renderDeckPreviewFrame\(state\.deckId, \{ bustCache: true \}\)/);
    assert.match(html, /}, 1500\);/);
    assert.match(html, /\/preview\?v=/);
    assert.match(html, /state\.outlineSlides = normalizeOutlineSlides\(data\.deck\.slides\)/);
    assert.match(html, /已打开历史 PPT，可继续调整结构、AI 润色单页并重新下载/);
    assert.match(html, /data-page-panel="create assets" data-flow-panel="preview"/);
    assert.match(html, /\/api\/ppt\/assets/);
    assert.match(html, /id="entitlement" type="hidden" value="62"/);
    assert.match(html, /id="regenerate-slide"/);
    assert.match(html, /\/slides\/" \+ slideId \+ "\/regenerate/);
    assert.match(html, /id="retry-task"/);
    assert.match(html, /setWorkspacePage/);
    assert.match(html, /PPTX/);
    assert.match(html, /PDF/);
    assert.match(html, /请先应用模板生成 PPT，再下载文件/);
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => new Function(script));
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API uses default entitlement ID when request omits entitlement_id", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Default entitlement",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const deckBody = await deckResponse.json();

    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.task.status, "succeeded");
    assert.equal(context.billingCalls[0][1].entitlementId, 62);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API rejects invalid entitlement IDs before billing", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Invalid entitlement",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: "not-a-number",
    });
    const body = await deckResponse.json();

    assert.equal(deckResponse.status, 400);
    assert.equal(body.error.code, "ENTITLEMENT_INVALID");
    assert.deepEqual(context.billingCalls, []);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API blocks generation when launch entitlement is not usable", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      getBalance: async (input) => {
        context.billingCalls.push(["balance", input]);
        return { usable: "0", status: "paused", remaining: "100" };
      },
    },
  });
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({
        user_id: 7,
        app_id: 15,
        product_id: 73,
        entitlements: [{ entitlement_id: 88, product_id: 73, status: "active", usable: true }],
      }),
    },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Entitlement not usable",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const body = await deckResponse.json();

    assert.equal(deckResponse.status, 403);
    assert.equal(body.error.code, "ENTITLEMENT_NOT_USABLE");
    assert.deepEqual(context.billingCalls[0], ["balance", { userId: 7, entitlementId: 88 }]);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve"), false);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API prefers the launch identity entitlement over the configured default", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({
        user_id: 9,
        app_id: 15,
        product_id: 73,
        entitlements: [
          { entitlement_id: 91, product_id: 73, status: "active", usable: true },
        ],
      }),
    },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "User-specific entitlement",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const deckBody = await deckResponse.json();

    assert.match(html, /id="entitlement" type="hidden" value="91"/);
    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.task.status, "succeeded");
    assert.equal(context.billingCalls[0][1].entitlementId, 91);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API resolves entitlement through Moling user entitlement lookup", async () => {
  const context = await createBusinessContext();
  const lookupCalls = [];
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }),
      listUserEntitlements: async ({ userId, productId }) => {
        lookupCalls.push({ userId, productId });
        return {
          entitlements: [
            { entitlement_id: 90, product_id: 73, status: "expired", usable: false },
            { entitlement_id: 88, product_id: 73, status: "active", usable: true },
          ],
        };
      },
    },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    const body = await me.json();

    assert.equal(enter.status, 302);
    assert.deepEqual(lookupCalls, [{ userId: 7, productId: 73 }]);
    assert.equal(body.user.entitlement_id, 88);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API uses configured user entitlement map when Moling lookup is unavailable", async () => {
  const context = await createBusinessContext();
  const warnings = [];
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    userEntitlementMap: new Map([[7, 88]]),
    logger: { info() {}, error() {}, warn(event, details) { warnings.push({ event, details }); }, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }),
      listUserEntitlements: async () => {
        throw new Error("not deployed");
      },
    },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    const body = await me.json();

    assert.equal(enter.status, 302);
    assert.equal(body.user.entitlement_id, 88);
    assert.equal(warnings[0].event, "entitlement_lookup_failed");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API resolves camelCase entitlement fields from launch identity", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({
        user_id: 9,
        app_id: 15,
        productId: 73,
        entitlements: [
          { entitlementId: 91, productId: 73, status: "active", usable: true },
        ],
      }),
    },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "CamelCase entitlement",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const deckBody = await deckResponse.json();

    assert.match(html, /id="entitlement" type="hidden" value="91"/);
    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.task.status, "succeeded");
    assert.equal(context.billingCalls[0][1].entitlementId, 91);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API exposes session entitlement balance for package checks", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const response = await fetch(`${baseUrl}/api/billing/balance`, { headers: { cookie } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.entitlement_id, 62);
    assert.equal(body.balance.remaining, "100");
    assert.deepEqual(context.billingCalls[0], ["balance", { userId: 7, entitlementId: 62 }]);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API keeps separate users in different sessions with separate entitlement and user id", async () => {
  const context = await createBusinessContext();
  const identities = {
    ok1: { user_id: 7, app_id: 15, product_id: 73, entitlements: [{ entitlement_id: 88, product_id: 73, status: "active", usable: true }] },
    ok2: { user_id: 9, app_id: 15, product_id: 73, entitlements: [{ entitlement_id: 91, product_id: 73, status: "active", usable: true }] },
  };
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async (ticket) => identities[ticket],
    },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter1 = await fetch(`${baseUrl}/enter?ticket=ok1`, { redirect: "manual" });
    const cookie1 = enter1.headers.get("set-cookie").split(";")[0];
    const enter2 = await fetch(`${baseUrl}/enter?ticket=ok2`, { redirect: "manual" });
    const cookie2 = enter2.headers.get("set-cookie").split(";")[0];

    const balance1 = await fetch(`${baseUrl}/api/billing/balance`, { headers: { cookie: cookie1 } });
    const balance1Body = await balance1.json();
    const balance2 = await fetch(`${baseUrl}/api/billing/balance`, { headers: { cookie: cookie2 } });
    const balance2Body = await balance2.json();

    const outline1Response = await postJson(`${baseUrl}/api/ppt/outlines`, cookie1, { topic: "User7", slide_count: 2, template_id: "business" });
    const outline1 = await outline1Response.json();
    await postJson(`${baseUrl}/api/ppt/decks`, cookie1, { outline_id: outline1.outline.id });

    const outline2Response = await postJson(`${baseUrl}/api/ppt/outlines`, cookie2, { topic: "User9", slide_count: 2, template_id: "business" });
    const outline2 = await outline2Response.json();
    await postJson(`${baseUrl}/api/ppt/decks`, cookie2, { outline_id: outline2.outline.id });

    assert.equal(balance1.status, 200);
    assert.equal(balance1Body.entitlement_id, 88);
    assert.equal(balance2.status, 200);
    assert.equal(balance2Body.entitlement_id, 91);
    assert.equal(context.billingCalls.some((call) => call[0] === "balance" && call[1].userId === 7 && call[1].entitlementId === 88), true);
    assert.equal(context.billingCalls.some((call) => call[0] === "balance" && call[1].userId === 9 && call[1].entitlementId === 91), true);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].userId === 7 && call[1].entitlementId === 88), true);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].userId === 9 && call[1].entitlementId === 91), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API keeps uploaded-document outlines isolated by user for billing", async () => {
  const context = await createBusinessContext();
  const identities = {
    user7: {
      user_id: 7,
      app_id: 15,
      product_id: 73,
      entitlements: [{ entitlement_id: 88, product_id: 73, status: "active", usable: true }],
    },
    user9: {
      user_id: 9,
      app_id: 15,
      product_id: 73,
      entitlements: [{ entitlement_id: 91, product_id: 73, status: "active", usable: true }],
    },
  };
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async (ticket) => identities[ticket],
    },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter7 = await fetch(`${baseUrl}/enter?ticket=user7`, { redirect: "manual" });
    const cookie7 = enter7.headers.get("set-cookie").split(";")[0];
    const enter9 = await fetch(`${baseUrl}/enter?ticket=user9`, { redirect: "manual" });
    const cookie9 = enter9.headers.get("set-cookie").split(";")[0];

    const upload7 = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie: cookie7, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "user7.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("User7 source for outline").toString("base64"),
      }),
    });
    const file7 = await upload7.json();
    const upload9 = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie: cookie9, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "user9.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("User9 source for outline").toString("base64"),
      }),
    });
    const file9 = await upload9.json();
    const outline7Response = await postJson(`${baseUrl}/api/ppt/outlines`, cookie7, {
      source_file_id: file7.file.id,
      slide_count: 2,
      template_id: "business",
    });
    const outline9Response = await postJson(`${baseUrl}/api/ppt/outlines`, cookie9, {
      source_file_id: file9.file.id,
      slide_count: 2,
      template_id: "business",
    });
    assert.equal(outline7Response.status, 201);
    assert.equal(outline9Response.status, 201);
    const outline7 = await outline7Response.json();
    const outline9 = await outline9Response.json();
    const deck7Response = await postJson(`${baseUrl}/api/ppt/decks`, cookie7, {
      outline_id: outline7.outline.id,
    });
    const deck9Response = await postJson(`${baseUrl}/api/ppt/decks`, cookie9, {
      outline_id: outline9.outline.id,
    });
    assert.equal(deck7Response.status, 201);
    assert.equal(deck9Response.status, 201);
    const deck7 = await deck7Response.json();
    const deck9 = await deck9Response.json();
    const task7 = await fetch(`${baseUrl}/api/ppt/tasks/${deck7.task.id}`, { headers: { cookie: cookie7 } }).then((response) => response.json());
    const task9 = await fetch(`${baseUrl}/api/ppt/tasks/${deck9.task.id}`, { headers: { cookie: cookie9 } }).then((response) => response.json());

    assert.equal(upload7.status, 201);
    assert.equal(upload9.status, 201);
    assert.equal(outline7.outline.slides[0].title, "User7 source for outline");
    assert.equal(outline9.outline.slides[0].title, "User9 source for outline");
    assert.equal(deck7.task.status, "succeeded");
    assert.equal(deck9.task.status, "succeeded");
    assert.equal(task7.task.status, "succeeded");
    assert.equal(task9.task.status, "succeeded");
    assert.equal(task7.task.deckId, deck7.deck.id);
    assert.equal(task9.task.deckId, deck9.deck.id);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].userId === 7 && call[1].entitlementId === 88), true);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].userId === 9 && call[1].entitlementId === 91), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("workspace page exposes package balance status", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(html, /id="balance-status"/);
    assert.match(html, /\/api\/billing\/balance/);
    assert.match(html, /balance-progress/);
    assert.match(html, /套餐正常/);
    assert.match(html, /总额 /);
    assert.ok(
      html.indexOf("\n    loadBalance();") < html.indexOf('document.querySelector("#template").addEventListener'),
      "balance should start loading before optional control event binding",
    );
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("workspace page explains missing entitlement resolution", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(html, /未识别到权益 ID/);
    assert.match(html, /formatApiError/);
    assert.match(html, /ENTITLEMENT_REQUIRED/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API falls back to configured entitlement for restored sessions without entitlement", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const storedSession = await context.database.insert("sessions", {
      id: "legacy-session",
      identity: { user_id: 7, app_id: 15, product_id: 73 },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const cookie = `sid=${storedSession.id}`;

    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();
    const balance = await fetch(`${baseUrl}/api/billing/balance`, { headers: { cookie } });
    const balanceBody = await balance.json();

    assert.equal(page.status, 200);
    assert.match(html, /id="entitlement" type="hidden" value="62"/);
    assert.equal(balance.status, 200);
    assert.equal(balanceBody.entitlement_id, 62);
    assert.equal(context.billingCalls[0][1].entitlementId, 62);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

async function createBusinessContext(options = {}) {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks", "outlines", "decks", "generation_tasks", "billing_events", "call_logs", "templates", "template_categories", "ppt_assets", "storage_objects"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database });
  const taskCenter = new MemoryTaskCenter();
  const templateManager = new TemplateManager({ database });
  const billingCalls = [];
  const billingClient = {
    getBalance: async (input) => {
      billingCalls.push(["balance", input]);
      return { usable: true, remaining: "100" };
    },
    reserveCredits: async (input) => {
      billingCalls.push(["reserve", input]);
      return { hold_id: 501, reserved: input.amount };
    },
    settleCredits: async (input) => {
      billingCalls.push(["settle", input]);
      return { status: "settled", settled_amount: input.actualAmount };
    },
    releaseCredits: async (input) => {
      billingCalls.push(["release", input]);
      return { status: "released", hold_id: input.holdId };
    },
    consumeCredits: async (input) => {
      billingCalls.push(["consume", input]);
      return { status: "consumed", amount: input.amount };
    },
    ...(options.billingOverrides || {}),
  };
  const aiProvider = options.aiProvider || new MockAiProvider();
  const pptService = new PptService({
    database,
    storage,
    taskCenter,
    templateManager,
    aiProvider,
    promptManager: options.promptManager || new PromptManager(),
    exporter: new PptExportService(),
    pptPreviewRenderer: options.pptPreviewRenderer,
    billingClient,
  });

  return { database, storage, taskCenter, templateManager, aiProvider, pptService, billingClient, billingCalls };
}

async function insertAnnualBusinessSummaryTemplate(context) {
  // 测试数据库模拟官方模板同步后的年度总结模板，确保预览走 annual-summary 专用布局。
  await context.database.insert("templates", {
    id: "annual-business-summary",
    name: "年度经营总结",
    categoryId: "business",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "blue-gold",
        name: "蓝金年度版",
        visual: {
          primary: "3159F6",
          accent: "39D5E8",
          background: "F7FBFF",
          surface: "FFFFFF",
          title: "052E7A",
          body: "1F4B83",
          layout: "annual-summary",
          variant: "blue-gold",
        },
      },
    ],
    visual: {
      primary: "3159F6",
      accent: "39D5E8",
      background: "F7FBFF",
      surface: "FFFFFF",
      title: "052E7A",
      body: "1F4B83",
      layout: "annual-summary",
      variant: "blue-gold",
    },
  });
}

async function insertQuarterlyActionLoopTemplate(context) {
  // 测试数据库模拟官方模板同步后的季度业务复盘行动计划模板，确保预览走专用执行追踪布局。
  await context.database.insert("templates", {
    id: "business-quarterly-business-review-action-loop",
    slug: "business-quarterly-business-review-action-loop",
    name: "季度业务复盘",
    categoryId: "business",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "action-loop",
        name: "行动闭环",
        visual: {
          primary: "1F5FBF",
          accent: "1CC8A0",
          background: "F3F7FE",
          surface: "FFFFFF",
          title: "10233F",
          body: "40516C",
          layout: "quarterly-action-loop",
          variant: "action-loop",
        },
      },
    ],
    visual: {
      primary: "1F5FBF",
      accent: "1CC8A0",
      background: "F3F7FE",
      surface: "FFFFFF",
      title: "10233F",
      body: "40516C",
      layout: "quarterly-action-loop",
      variant: "action-loop",
    },
    layoutSchema: {
      defaultCoverLayout: "quarterly-action-cover",
      defaultContentLayout: "quarterly-action-content",
      allowedLayouts: ["quarterly-action-cover", "quarterly-action-summary", "quarterly-action-matrix", "quarterly-action-roadmap", "quarterly-action-closing", "title", "content", "closing"],
    },
  });
}

async function insertIndustryResearchSlugTemplate(context) {
  // 测试数据库模拟官方模板同步后的 slug 记录，避免在线预览退回普通标题层。
  await context.database.insert("templates", {
    id: "strategy-industry-research-industry-landscape",
    slug: "strategy-industry-research-industry-landscape",
    name: "行业研究报告 - 行业格局",
    categoryId: "strategy",
    scope: "official",
    official: true,
    status: "active",
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
      allowedLayouts: ["industry-research-cover", "industry-overview", "industry-value-chain", "industry-competition", "industry-opportunity-risk", "industry-research-closing", "title", "content"],
    },
  });
}

async function insertOperatingProblemDiagnosisTemplate(context) {
  // 测试数据库模拟官方模板同步后的经营问题诊断模板，确保主题名称只用于选择器，不直接写进 PPT 页面。
  await context.database.insert("templates", {
    id: "business-operating-problem-diagnosis-problem-tree",
    slug: "business-operating-problem-diagnosis-problem-tree",
    name: "经营问题诊断",
    categoryId: "business",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "problem-tree",
        name: "问题树",
        visual: {
          primary: "17233B",
          accent: "E94B3C",
          secondary: "0EA5A8",
          warning: "F59E0B",
          background: "F5F7FB",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "operating-problem-tree",
          variant: "problem-tree",
        },
      },
    ],
    visual: {
      primary: "17233B",
      accent: "E94B3C",
      secondary: "0EA5A8",
      warning: "F59E0B",
      background: "F5F7FB",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "operating-problem-tree",
      variant: "problem-tree",
    },
    layoutSchema: {
      defaultCoverLayout: "operating-problem-tree-cover",
      defaultContentLayout: "operating-problem-tree-diagnosis",
      allowedLayouts: [
        "operating-problem-tree-cover",
        "operating-problem-tree-overview",
        "operating-problem-tree-diagnosis",
        "operating-problem-tree-root-cause",
        "operating-problem-tree-impact",
        "operating-problem-tree-action",
        "operating-problem-tree-summary",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function insertBusinessOpportunityMapTemplate(context) {
  // 测试数据库模拟官方模板同步后的业务增长机会地图模板，确保预览走专用增长路径布局。
  await context.database.insert("templates", {
    id: "business-business-growth-report-opportunity-map",
    slug: "business-business-growth-report-opportunity-map",
    name: "业务增长汇报",
    categoryId: "business",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "opportunity-map",
        name: "机会地图",
        visual: {
          primary: "123A5A",
          accent: "17A673",
          secondary: "D9A441",
          background: "EEF5F7",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "33475B",
          layout: "business-opportunity-map",
          variant: "opportunity-map",
        },
      },
    ],
    visual: {
      primary: "123A5A",
      accent: "17A673",
      secondary: "D9A441",
      background: "EEF5F7",
      surface: "FFFFFF",
      title: "0B1F33",
      body: "33475B",
      layout: "business-opportunity-map",
      variant: "opportunity-map",
    },
    layoutSchema: {
      defaultCoverLayout: "growth-map-cover",
      defaultContentLayout: "growth-map-analysis",
      allowedLayouts: ["growth-map-cover", "growth-map-overview", "growth-map-analysis", "growth-map-path", "growth-map-actions", "growth-map-closing", "title", "content", "closing"],
    },
  });
}

async function insertDepartmentTeamPerformanceTemplate(context) {
  // 测试数据库模拟官方模板同步后的部门述职报告模板，确保预览走团队绩效专用布局。
  await context.database.insert("templates", {
    id: "business-department-performance-report-team-performance",
    slug: "business-department-performance-report-team-performance",
    name: "部门述职报告",
    categoryId: "business",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "team-performance",
        name: "团队绩效",
        visual: {
          primary: "173B73",
          accent: "F5B84B",
          secondary: "24B8A8",
          background: "F5F8FC",
          surface: "FFFFFF",
          title: "102033",
          body: "334155",
          layout: "department-team-performance",
          variant: "team-performance",
        },
      },
    ],
    visual: {
      primary: "173B73",
      accent: "F5B84B",
      secondary: "24B8A8",
      background: "F5F8FC",
      surface: "FFFFFF",
      title: "102033",
      body: "334155",
      layout: "department-team-performance",
      variant: "team-performance",
    },
    layoutSchema: {
      defaultCoverLayout: "department-team-cover",
      defaultContentLayout: "department-team-content",
      allowedLayouts: [
        "department-team-cover",
        "department-team-goals",
        "department-team-radar",
        "department-team-results",
        "department-team-improvement",
        "department-team-closing",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function insertEnterpriseDigitalBlueprintTemplate(context) {
  // 测试数据库模拟官方模板同步后的企业转型模板，确保预览走蓝图专用布局。
  await context.database.insert("templates", {
    id: "strategy-enterprise-transformation-digital-blueprint",
    slug: "strategy-enterprise-transformation-digital-blueprint",
    name: "企业转型方案 - 数字化蓝图",
    categoryId: "strategy",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "digital-blueprint",
        name: "数字化蓝图",
        visual: {
          id: "strategy-enterprise-transformation-digital-blueprint",
          primary: "0B1F3A",
          accent: "22D3EE",
          secondary: "38BDF8",
          warning: "F59E0B",
          background: "EAF4FB",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "enterprise-digital-blueprint",
          variant: "digital-blueprint",
        },
      },
    ],
    visual: {
      id: "strategy-enterprise-transformation-digital-blueprint",
      primary: "0B1F3A",
      accent: "22D3EE",
      secondary: "38BDF8",
      warning: "F59E0B",
      background: "EAF4FB",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "enterprise-digital-blueprint",
      variant: "digital-blueprint",
    },
    layoutSchema: {
      defaultCoverLayout: "digital-blueprint-cover",
      defaultContentLayout: "transformation-blueprint",
      allowedLayouts: ["digital-blueprint-cover", "current-state-diagnosis", "target-digital-blueprint", "capability-upgrade-map", "system-roadmap", "organization-governance", "risk-and-enablement", "transformation-next-actions", "title", "content"],
    },
  });
}

async function insertCompetitionMapTemplate(context) {
  // 模拟官方模板同步后的竞争地图模板，验证生成工作台可以直接使用完整 slug。
  await context.database.insert("templates", {
    id: "strategy-industry-research-competition-map",
    slug: "strategy-industry-research-competition-map",
    name: "行业研究报告 - 竞争地图",
    categoryId: "strategy",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "competition-map",
        name: "竞争地图",
        visual: {
          primary: "102A43",
          accent: "12A5A6",
          background: "F4F8FB",
          surface: "FFFFFF",
          title: "071A2D",
          body: "3D5363",
          layout: "strategy-competition-map",
          variant: "competition-map",
        },
      },
    ],
    visual: {
      primary: "102A43",
      accent: "12A5A6",
      background: "F4F8FB",
      surface: "FFFFFF",
      title: "071A2D",
      body: "3D5363",
      layout: "strategy-competition-map",
      variant: "competition-map",
    },
    layoutSchema: {
      defaultCoverLayout: "competition-map-cover",
      defaultContentLayout: "competition-map-content",
      allowedLayouts: ["competition-map-cover", "competition-map-overview", "competition-map-players", "competition-map-positioning", "competition-map-segments", "competition-map-closing", "title", "content"],
    },
  });
}

async function insertSwotMapTemplate(context) {
  // 模拟官方模板同步后的 SWOT 地图模板，验证数据库 slug 和内置模板走同一套预览布局。
  await context.database.insert("templates", {
    id: "strategy-competitor-analysis-swot-map",
    slug: "strategy-competitor-analysis-swot-map",
    name: "竞争对手分析 - SWOT 地图",
    categoryId: "strategy",
    scope: "official",
    official: true,
    status: "active",
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
      allowedLayouts: ["swot-map-cover", "swot-map-overview", "swot-map-positioning", "swot-map-strength-weakness", "swot-map-opportunity-threat", "swot-map-strategy-actions", "swot-map-closing", "title", "content"],
    },
  });
}

async function insertProductPainPointsTemplate(context) {
  // 测试数据库模拟官方模板同步后的产品需求用户痛点模板，确保预览使用专用产品洞察布局。
  await context.database.insert("templates", {
    id: "product-product-requirement-analysis-user-pain-points",
    slug: "product-product-requirement-analysis-user-pain-points",
    name: "产品需求分析 - 用户痛点",
    categoryId: "product",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "user-pain-points",
        name: "用户痛点",
        visual: {
          primary: "1D4ED8",
          accent: "F97316",
          secondary: "14B8A6",
          background: "F4F7FB",
          surface: "FFFFFF",
          title: "10233F",
          body: "405166",
          layout: "product-pain-points",
          variant: "user-pain-points",
        },
      },
    ],
    visual: {
      primary: "1D4ED8",
      accent: "F97316",
      secondary: "14B8A6",
      background: "F4F7FB",
      surface: "FFFFFF",
      title: "10233F",
      body: "405166",
      layout: "product-pain-points",
      variant: "user-pain-points",
    },
    layoutSchema: {
      defaultCoverLayout: "product-pain-points-cover",
      defaultContentLayout: "product-pain-points-content",
      allowedLayouts: ["product-pain-points-cover", "product-pain-points-scenario", "product-pain-points-evidence", "product-pain-points-distribution", "product-pain-points-opportunity", "product-pain-points-closing", "title", "content"],
    },
  });
}

async function insertProductPricingStrategyTemplate(context) {
  // 测试数据库模拟官方模板同步后的产品商业化定价策略模板，覆盖生成工作台选择完整 slug 的路径。
  await context.database.insert("templates", {
    id: "product-product-commercialization-plan-pricing-strategy",
    slug: "product-product-commercialization-plan-pricing-strategy",
    name: "产品商业化方案 - 定价策略",
    categoryId: "product",
    scope: "official",
    official: true,
    status: "active",
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
    layoutSchema: {
      defaultCoverLayout: "product-pricing-cover",
      defaultContentLayout: "product-pricing-content",
      allowedLayouts: ["product-pricing-cover", "product-pricing-tier-cards", "product-pricing-value-anchor", "product-pricing-benefit-matrix", "product-pricing-commercial-loop", "product-pricing-closing", "title", "content", "closing"],
    },
  });
}

async function insertProductInterviewInsightTemplate(context) {
  // 模拟官方模板同步后的用户研究访谈洞察模板，确保生成工作台使用访谈研究专属布局。
  await context.database.insert("templates", {
    id: "product-user-research-report-interview-insight",
    slug: "product-user-research-report-interview-insight",
    name: "用户研究报告 - 访谈洞察",
    categoryId: "product",
    scope: "official",
    official: true,
    status: "active",
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
    layoutSchema: {
      defaultCoverLayout: "product-interview-insight-cover",
      defaultContentLayout: "product-interview-insight-content",
      allowedLayouts: ["product-interview-insight-cover", "product-interview-insight-sample", "product-interview-insight-quotes", "product-interview-insight-cluster", "product-interview-insight-opportunity", "product-interview-insight-recommendation", "product-interview-insight-closing", "title", "content", "closing"],
    },
  });
}

async function insertProductReleaseCadenceTemplate(context) {
  // 测试数据库模拟官方模板同步后的产品路线图版本节奏模板，确保完整 slug 命中专用发布节奏布局。
  await context.database.insert("templates", {
    id: "product-product-roadmap-release-cadence",
    slug: "product-product-roadmap-release-cadence",
    name: "产品路线图 - 版本节奏",
    categoryId: "product",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "release-cadence",
        name: "版本节奏",
        visual: {
          primary: "0B1F3A",
          accent: "22D3EE",
          secondary: "F97316",
          background: "EFF6FF",
          surface: "FFFFFF",
          title: "0A1730",
          body: "405166",
          layout: "product-release-cadence",
          variant: "release-cadence",
        },
      },
    ],
    visual: {
      primary: "0B1F3A",
      accent: "22D3EE",
      secondary: "F97316",
      background: "EFF6FF",
      surface: "FFFFFF",
      title: "0A1730",
      body: "405166",
      layout: "product-release-cadence",
      variant: "release-cadence",
    },
    layoutSchema: {
      defaultCoverLayout: "product-release-cadence-cover",
      defaultContentLayout: "product-release-cadence-content",
      allowedLayouts: ["product-release-cadence-cover", "product-release-cadence-content", "product-release-cadence-analysis", "product-release-cadence-lanes", "product-release-cadence-risk", "product-release-cadence-summary", "title", "content", "closing"],
    },
  });
}

async function insertFeaturePriorityMatrixTemplate(context) {
  // 测试数据库模拟官方模板同步后的功能优先级评审模板，确保预览使用独立价值矩阵布局。
  await context.database.insert("templates", {
    id: "product-feature-priority-review-value-matrix",
    slug: "product-feature-priority-review-value-matrix",
    name: "功能优先级评审 - 价值矩阵",
    categoryId: "product",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "value-matrix",
        name: "价值矩阵",
        visual: {
          primary: "172554",
          accent: "10B981",
          secondary: "F97316",
          background: "EEF4F8",
          surface: "FFFFFF",
          title: "0B1736",
          body: "405166",
          layout: "feature-priority-matrix",
          variant: "value-matrix",
        },
      },
    ],
    visual: {
      primary: "172554",
      accent: "10B981",
      secondary: "F97316",
      background: "EEF4F8",
      surface: "FFFFFF",
      title: "0B1736",
      body: "405166",
      layout: "feature-priority-matrix",
      variant: "value-matrix",
    },
    layoutSchema: {
      defaultCoverLayout: "feature-priority-matrix-cover",
      defaultContentLayout: "feature-priority-matrix-content",
      allowedLayouts: ["feature-priority-matrix-cover", "feature-priority-matrix-content", "feature-priority-matrix-analysis", "feature-priority-matrix-ranking", "feature-priority-matrix-resource", "feature-priority-matrix-summary", "title", "content", "closing"],
    },
  });
}

async function insertExperienceJourneyTemplate(context) {
  // 测试数据库模拟官方模板同步后的体验旅程模板，确保预览使用独立旅程地图布局。
  await context.database.insert("templates", {
    id: "product-user-experience-redesign-experience-journey",
    slug: "product-user-experience-redesign-experience-journey",
    name: "用户体验改版方案 - 体验旅程",
    categoryId: "product",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "experience-journey",
        name: "体验旅程",
        visual: {
          primary: "1E2A5A",
          accent: "18B7A6",
          secondary: "F9735B",
          background: "EEF5FA",
          surface: "FFFFFF",
          title: "102033",
          body: "405166",
          layout: "experience-journey-map",
          variant: "experience-journey",
        },
      },
    ],
    visual: {
      primary: "1E2A5A",
      accent: "18B7A6",
      secondary: "F9735B",
      background: "EEF5FA",
      surface: "FFFFFF",
      title: "102033",
      body: "405166",
      layout: "experience-journey-map",
      variant: "experience-journey",
    },
    layoutSchema: {
      defaultCoverLayout: "experience-journey-cover",
      defaultContentLayout: "experience-journey-content",
      allowedLayouts: ["experience-journey-cover", "experience-journey-content", "experience-journey-diagnosis", "experience-journey-redesign", "experience-journey-roadmap", "experience-journey-summary", "title", "content", "closing"],
    },
  });
}

async function insertCapabilityRadarTemplate(context) {
  // 测试数据库模拟官方模板同步后的竞品能力雷达模板，确保预览使用独立竞品对比布局。
  await context.database.insert("templates", {
    id: "product-competitive-feature-comparison-capability-radar",
    slug: "product-competitive-feature-comparison-capability-radar",
    name: "竞品功能对比 - 能力雷达",
    categoryId: "product",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "capability-radar",
        name: "能力雷达",
        visual: {
          primary: "17233F",
          accent: "16B8A6",
          secondary: "FF8A3D",
          background: "EEF4F8",
          surface: "FFFFFF",
          title: "0D1B2A",
          body: "3D4B5C",
          layout: "capability-radar-map",
          variant: "capability-radar",
        },
      },
    ],
    visual: {
      primary: "17233F",
      accent: "16B8A6",
      secondary: "FF8A3D",
      background: "EEF4F8",
      surface: "FFFFFF",
      title: "0D1B2A",
      body: "3D4B5C",
      layout: "capability-radar-map",
      variant: "capability-radar",
    },
    layoutSchema: {
      defaultCoverLayout: "capability-radar-cover",
      defaultContentLayout: "capability-radar-content",
      allowedLayouts: ["capability-radar-cover", "capability-radar-comparison", "capability-radar-analysis", "capability-radar-gap", "capability-radar-roadmap", "capability-radar-summary", "title", "content", "closing"],
    },
  });
}

async function insertExperienceGapTemplate(context) {
  // 测试数据库模拟官方模板同步后的竞品体验差距模板，确保生成后预览不退回通用版式。
  await context.database.insert("templates", {
    id: "product-competitor-analysis-report-experience-gap",
    slug: "product-competitor-analysis-report-experience-gap",
    name: "竞品分析报告 - 体验差距",
    categoryId: "product",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "experience-gap",
        name: "体验差距",
        visual: {
          primary: "18233F",
          accent: "2F80ED",
          secondary: "F9735B",
          background: "EEF4FA",
          surface: "FFFFFF",
          title: "101828",
          body: "405166",
          layout: "experience-gap-map",
          variant: "experience-gap",
        },
      },
    ],
    visual: {
      primary: "18233F",
      accent: "2F80ED",
      secondary: "F9735B",
      background: "EEF4FA",
      surface: "FFFFFF",
      title: "101828",
      body: "405166",
      layout: "experience-gap-map",
      variant: "experience-gap",
    },
    layoutSchema: {
      defaultCoverLayout: "experience-gap-cover",
      defaultContentLayout: "experience-gap-content",
      allowedLayouts: ["experience-gap-cover", "experience-gap-comparison", "experience-gap-path", "experience-gap-diagnosis", "experience-gap-opportunity", "experience-gap-summary", "title", "content", "closing"],
    },
  });
}

async function insertIndustryTrendForecastTemplate(context) {
  // 测试数据库模拟官方模板同步后的趋势判断主题，确保 slug 模板也能走独立趋势研判布局。
  await context.database.insert("templates", {
    id: "strategy-industry-research-trend-forecast",
    slug: "strategy-industry-research-trend-forecast",
    name: "行业研究报告 - 趋势判断",
    categoryId: "strategy",
    scope: "official",
    official: true,
    status: "active",
    themes: [
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
    layoutSchema: {
      defaultCoverLayout: "industry-trend-cover",
      defaultContentLayout: "industry-trend-content",
      allowedLayouts: ["industry-trend-cover", "trend-overview", "trend-signal-matrix", "trend-driver-wheel", "trend-opportunity-risk", "trend-roadmap", "industry-trend-closing", "title", "content"],
    },
  });
}

async function insertBudgetPlanningTemplate(context) {
  // 测试数据库模拟官方模板同步后的预算编制模板，确保预览和导出都走专用财务计划布局。
  await context.database.insert("templates", {
    id: "finance-budget-management-report-budget-planning",
    slug: "finance-budget-management-report-budget-planning",
    name: "预算管理报告 - 预算编制",
    categoryId: "finance",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "budget-planning",
        name: "预算编制",
        visual: {
          primary: "102A43",
          accent: "2A9D8F",
          background: "EEF4F8",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "405163",
          layout: "finance-budget-planning",
          variant: "budget-planning",
        },
      },
    ],
    visual: {
      primary: "102A43",
      accent: "2A9D8F",
      background: "EEF4F8",
      surface: "FFFFFF",
      title: "0B1F33",
      body: "405163",
      layout: "finance-budget-planning",
      variant: "budget-planning",
    },
    layoutSchema: {
      defaultCoverLayout: "finance-budget-planning-cover",
      defaultContentLayout: "finance-budget-planning-content",
      allowedLayouts: ["finance-budget-planning-cover", "finance-budget-planning-overview", "finance-budget-planning-allocation", "finance-budget-planning-table", "finance-budget-planning-flow", "finance-budget-planning-closing", "title", "content"],
    },
  });
}

async function insertCostControlTemplate(context) {
  // 测试数据库模拟官方模板同步后的成本控制方案，确保在线预览走成本拆解专用布局。
  await context.database.insert("templates", {
    id: "finance-cost-control-plan-cost-breakdown",
    slug: "finance-cost-control-plan-cost-breakdown",
    name: "成本控制方案 - 成本拆解",
    categoryId: "finance",
    scope: "official",
    official: true,
    status: "active",
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
    layoutSchema: {
      defaultCoverLayout: "cost-breakdown-cover",
      defaultContentLayout: "cost-breakdown-content",
      allowedLayouts: ["cost-breakdown-cover", "cost-structure-overview", "cost-driver-analysis", "cost-saving-roadmap", "expense-control-loop", "responsibility-matrix", "cost-breakdown-closing", "title", "content"],
    },
  });
}

async function insertCashFlowTemplate(context) {
  // 测试数据库模拟官方模板同步后的现金流分析报告，确保预览走现金流预测专用布局。
  await context.database.insert("templates", {
    id: "finance-cash-flow-analysis-report-cash-flow-forecast",
    slug: "finance-cash-flow-analysis-report-cash-flow-forecast",
    name: "现金流分析报告 - 现金流预测",
    categoryId: "finance",
    scope: "official",
    official: true,
    status: "active",
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
    layoutSchema: {
      defaultCoverLayout: "cash-flow-forecast-cover",
      defaultContentLayout: "cash-flow-forecast-content",
      allowedLayouts: ["cash-flow-forecast-cover", "cash-flow-waterfall", "cash-turnover-cycle", "receivables-management", "cash-risk-warning", "cash-forecast-dashboard", "cash-flow-forecast-closing", "title", "content"],
    },
  });
}

async function insertBudgetAdjustmentTemplate(context) {
  // 测试数据库模拟官方模板同步后的预算调整模板，确保预览和导出都走专用预算决策布局。
  await context.database.insert("templates", {
    id: "finance-budget-management-report-budget-adjustment",
    slug: "finance-budget-management-report-budget-adjustment",
    name: "预算管理报告 - 预算调整",
    categoryId: "finance",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "budget-adjustment",
        name: "预算调整",
        visual: {
          primary: "18233F",
          accent: "F59E0B",
          background: "F4F7FB",
          surface: "FFFFFF",
          title: "111827",
          body: "3B4658",
          layout: "finance-budget-adjustment",
          variant: "budget-adjustment",
          secondary: "14B8A6",
          risk: "B91C1C",
        },
      },
    ],
    visual: {
      primary: "18233F",
      accent: "F59E0B",
      background: "F4F7FB",
      surface: "FFFFFF",
      title: "111827",
      body: "3B4658",
      layout: "finance-budget-adjustment",
      variant: "budget-adjustment",
      secondary: "14B8A6",
      risk: "B91C1C",
    },
    layoutSchema: {
      defaultCoverLayout: "finance-budget-adjustment-cover",
      defaultContentLayout: "finance-budget-adjustment-content",
      allowedLayouts: ["finance-budget-adjustment-cover", "finance-budget-adjustment-content", "finance-budget-adjustment-analysis", "finance-budget-adjustment-reallocation", "finance-budget-adjustment-approval", "finance-budget-adjustment-impact", "finance-budget-adjustment-summary", "title", "content"],
    },
  });
}

async function insertBudgetVarianceTemplate(context) {
  // 测试数据库模拟官方模板同步后的执行偏差模板，确保预算复盘主题命中专用偏差分析布局。
  await context.database.insert("templates", {
    id: "finance-budget-management-report-execution-variance",
    slug: "finance-budget-management-report-execution-variance",
    name: "预算管理报告 - 执行偏差",
    categoryId: "finance",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "execution-variance",
        name: "执行偏差",
        visual: {
          primary: "16213E",
          accent: "E9574F",
          background: "F3F6FA",
          surface: "FFFFFF",
          title: "172036",
          body: "3D4B5F",
          layout: "finance-budget-variance",
          variant: "execution-variance",
          warning: "F6B84B",
          positive: "2FA879",
        },
      },
    ],
    visual: {
      primary: "16213E",
      accent: "E9574F",
      background: "F3F6FA",
      surface: "FFFFFF",
      title: "172036",
      body: "3D4B5F",
      layout: "finance-budget-variance",
      variant: "execution-variance",
      warning: "F6B84B",
      positive: "2FA879",
    },
    layoutSchema: {
      defaultCoverLayout: "finance-budget-variance-cover",
      defaultContentLayout: "finance-budget-variance-content",
      allowedLayouts: ["finance-budget-variance-cover", "finance-budget-variance-overview", "finance-budget-variance-comparison", "finance-budget-variance-analysis", "finance-budget-variance-correction", "finance-budget-variance-loop", "title", "content"],
    },
  });
}

async function insertProfitBridgeTemplate(context) {
  // 测试数据库模拟官方模板同步后的利润桥模板，确保预览和下载都使用利润归因专用布局。
  await context.database.insert("templates", {
    id: "finance-profit-analysis-report-profit-bridge",
    slug: "finance-profit-analysis-report-profit-bridge",
    name: "利润分析报告 - 利润桥",
    categoryId: "finance",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "profit-bridge",
        name: "利润桥",
        visual: {
          primary: "14213D",
          accent: "C99A2E",
          secondary: "2E7D7A",
          negative: "C65A42",
          background: "EEF3F7",
          surface: "FFFFFF",
          title: "0B1528",
          body: "334155",
          layout: "finance-profit-bridge",
          variant: "profit-bridge",
        },
      },
    ],
    visual: {
      primary: "14213D",
      accent: "C99A2E",
      secondary: "2E7D7A",
      negative: "C65A42",
      background: "EEF3F7",
      surface: "FFFFFF",
      title: "0B1528",
      body: "334155",
      layout: "finance-profit-bridge",
      variant: "profit-bridge",
    },
    layoutSchema: {
      defaultCoverLayout: "finance-profit-bridge-cover",
      defaultContentLayout: "finance-profit-bridge-content",
      allowedLayouts: ["finance-profit-bridge-cover", "finance-profit-bridge-waterfall", "finance-profit-bridge-margin-structure", "finance-profit-bridge-factor-analysis", "finance-profit-bridge-improvement", "finance-profit-bridge-closing", "title", "content"],
    },
  });
}

async function insertInvestmentRoiTemplate(context) {
  // 测试数据库模拟官方模板同步后的投资回报分析模板，确保生成、预览和导出命中投入产出模型专用布局。
  await context.database.insert("templates", {
    id: "finance-investment-return-analysis-roi-model",
    slug: "finance-investment-return-analysis-roi-model",
    name: "投资回报分析 - ROI 模型",
    categoryId: "finance",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "roi-model",
        name: "ROI 模型",
        visual: {
          primary: "0F2742",
          accent: "16A34A",
          secondary: "F59E0B",
          warning: "EF4444",
          background: "F5F8FB",
          surface: "FFFFFF",
          title: "0B1726",
          body: "334155",
          layout: "finance-investment-roi-model",
          variant: "roi-model",
        },
      },
    ],
    visual: {
      primary: "0F2742",
      accent: "16A34A",
      secondary: "F59E0B",
      warning: "EF4444",
      background: "F5F8FB",
      surface: "FFFFFF",
      title: "0B1726",
      body: "334155",
      layout: "finance-investment-roi-model",
      variant: "roi-model",
    },
    layoutSchema: {
      defaultCoverLayout: "finance-roi-model-cover",
      defaultContentLayout: "finance-roi-model-content",
      allowedLayouts: ["finance-roi-model-cover", "finance-roi-model-overview", "finance-roi-model-formula", "finance-roi-model-return-curve", "finance-roi-model-payback", "finance-roi-model-scenario", "finance-roi-model-decision", "title", "content"],
    },
  });
}

async function insertFinancialSolutionTemplate(context) {
  // 测试数据库模拟官方模板同步后的金融行业解决方案模板，确保生成、预览和导出都命中专用销售方案布局。
  await context.database.insert("templates", {
    id: "sales-industry-solution-financial-industry",
    slug: "sales-industry-solution-financial-industry",
    name: "行业解决方案 - 金融行业",
    categoryId: "sales",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "financial-industry",
        name: "金融行业",
        visual: {
          primary: "0B2A4A",
          accent: "18A0A6",
          background: "EAF3F7",
          surface: "FFFFFF",
          title: "071D33",
          body: "385269",
          layout: "sales-financial-solution",
          variant: "financial-industry",
        },
      },
    ],
    visual: {
      primary: "0B2A4A",
      accent: "18A0A6",
      background: "EAF3F7",
      surface: "FFFFFF",
      title: "071D33",
      body: "385269",
      layout: "sales-financial-solution",
      variant: "financial-industry",
    },
    layoutSchema: {
      defaultCoverLayout: "sales-financial-solution-cover",
      defaultContentLayout: "sales-financial-solution-content",
      allowedLayouts: ["sales-financial-solution-cover", "sales-financial-solution-painpoints", "sales-financial-solution-architecture", "sales-financial-solution-compliance", "sales-financial-solution-value", "sales-financial-solution-closing", "title", "content"],
    },
  });
}

async function insertChannelRecruitmentPolicyTemplate(context) {
  // 测试数据库模拟官方模板同步后的渠道招商模板，确保合作政策主题使用专属招商版式。
  await context.database.insert("templates", {
    id: "sales-channel-recruitment-plan-cooperation-policy",
    slug: "sales-channel-recruitment-plan-cooperation-policy",
    name: "渠道招商方案 - 合作政策",
    categoryId: "sales",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "cooperation-policy",
        name: "合作政策",
        visual: {
          primary: "0F2D4A",
          accent: "10B981",
          secondary: "D9A441",
          warning: "F97316",
          background: "F3F8F7",
          surface: "FFFFFF",
          title: "10233D",
          body: "40566D",
          layout: "channel-recruitment-policy",
          variant: "cooperation-policy",
        },
      },
    ],
    visual: {
      primary: "0F2D4A",
      accent: "10B981",
      secondary: "D9A441",
      warning: "F97316",
      background: "F3F8F7",
      surface: "FFFFFF",
      title: "10233D",
      body: "40566D",
      layout: "channel-recruitment-policy",
      variant: "cooperation-policy",
    },
    layoutSchema: {
      defaultCoverLayout: "channel-recruitment-policy-cover",
      defaultContentLayout: "channel-recruitment-policy-content",
      allowedLayouts: ["channel-recruitment-policy-cover", "channel-recruitment-policy-overview", "channel-recruitment-policy-rights-matrix", "channel-recruitment-policy-revenue-model", "channel-recruitment-policy-process", "channel-recruitment-policy-closing", "title", "content"],
    },
  });
}

async function insertKeyAccountDecisionTemplate(context) {
  // 测试数据库模拟官方模板同步后的大客户攻坚模板，确保官方 slug 也能命中决策链路专用布局。
  await context.database.insert("templates", {
    id: "sales-key-account-plan-decision-chain",
    slug: "sales-key-account-plan-decision-chain",
    name: "大客户攻坚方案 - 决策链路",
    categoryId: "sales",
    scope: "official",
    official: true,
    status: "active",
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
    layoutSchema: {
      defaultCoverLayout: "key-account-decision-cover",
      defaultContentLayout: "key-account-decision-content",
      allowedLayouts: ["key-account-decision-cover", "key-account-organization-map", "key-account-decision-path", "key-account-stakeholder-matrix", "key-account-win-roadmap", "key-account-closing", "title", "content"],
    },
  });
}

async function insertEducationSolutionTemplate(context) {
  // 测试数据库模拟官方模板同步后的教育行业解决方案模板，确保教育客户提案使用独立的方案布局。
  await context.database.insert("templates", {
    id: "sales-industry-solution-education-industry",
    slug: "sales-industry-solution-education-industry",
    name: "行业解决方案 - 教育行业",
    categoryId: "sales",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "education-industry",
        name: "教育行业",
        visual: {
          primary: "155E75",
          accent: "22C55E",
          background: "EAF7F7",
          surface: "FFFFFF",
          title: "0F2F3A",
          body: "365A64",
          layout: "sales-education-solution",
          variant: "education-industry",
        },
      },
    ],
    visual: {
      primary: "155E75",
      accent: "22C55E",
      background: "EAF7F7",
      surface: "FFFFFF",
      title: "0F2F3A",
      body: "365A64",
      layout: "sales-education-solution",
      variant: "education-industry",
    },
    layoutSchema: {
      defaultCoverLayout: "sales-education-solution-cover",
      defaultContentLayout: "sales-education-solution-content",
      allowedLayouts: ["sales-education-solution-cover", "sales-education-solution-painpoints", "sales-education-solution-platform", "sales-education-solution-scenarios", "sales-education-solution-data", "sales-education-solution-roadmap", "title", "content"],
    },
  });
}

async function insertManufacturingSolutionTemplate(context) {
  // 测试数据库模拟官方模板同步后的制造行业解决方案模板，确保生成、预览和导出都命中工业流程专用布局。
  await context.database.insert("templates", {
    id: "sales-industry-solution-manufacturing-industry",
    slug: "sales-industry-solution-manufacturing-industry",
    name: "行业解决方案 - 制造行业",
    categoryId: "sales",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "manufacturing-industry",
        name: "制造行业",
        visual: {
          primary: "123A5A",
          accent: "17A7B8",
          background: "E6ECF2",
          surface: "FFFFFF",
          title: "1F2933",
          body: "4B5B68",
          layout: "sales-manufacturing-solution",
          variant: "manufacturing-industry",
        },
      },
    ],
    visual: {
      primary: "123A5A",
      accent: "17A7B8",
      background: "E6ECF2",
      surface: "FFFFFF",
      title: "1F2933",
      body: "4B5B68",
      layout: "sales-manufacturing-solution",
      variant: "manufacturing-industry",
    },
    layoutSchema: {
      defaultCoverLayout: "sales-manufacturing-solution-cover",
      defaultContentLayout: "sales-manufacturing-solution-content",
      allowedLayouts: ["sales-manufacturing-solution-cover", "sales-manufacturing-solution-painpoints", "sales-manufacturing-solution-architecture", "sales-manufacturing-solution-process", "sales-manufacturing-solution-dashboard", "sales-manufacturing-solution-value", "sales-manufacturing-solution-roadmap", "sales-manufacturing-solution-closing", "title", "content"],
    },
  });
}

async function insertLaunchRhythmTemplate(context) {
  // 测试数据库模拟官方模板同步后的新品上市首发节奏模板，确保预览和导出都走专用发布节奏布局。
  await context.database.insert("templates", {
    id: "marketing-new-product-launch-launch-rhythm",
    slug: "marketing-new-product-launch-launch-rhythm",
    name: "新品上市方案 - 首发节奏",
    categoryId: "marketing",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "launch-rhythm",
        name: "首发节奏",
        visual: {
          primary: "101828",
          accent: "FF5A3D",
          background: "111827",
          surface: "FFFFFF",
          title: "FFFFFF",
          body: "D7DEE8",
          layout: "marketing-launch-rhythm",
          variant: "launch-rhythm",
        },
      },
    ],
    visual: {
      primary: "101828",
      accent: "FF5A3D",
      background: "111827",
      surface: "FFFFFF",
      title: "FFFFFF",
      body: "D7DEE8",
      layout: "marketing-launch-rhythm",
      variant: "launch-rhythm",
    },
    layoutSchema: {
      defaultCoverLayout: "marketing-launch-rhythm-cover",
      defaultContentLayout: "marketing-launch-rhythm-content",
      allowedLayouts: ["marketing-launch-rhythm-cover", "marketing-launch-rhythm-timeline", "marketing-launch-rhythm-selling-points", "marketing-launch-rhythm-channel", "marketing-launch-rhythm-kpi", "marketing-launch-rhythm-closing", "title", "content"],
    },
  });
}

async function insertBusinessPlanModelTemplate(context) {
  // 测试数据库模拟官方模板同步后的商业计划书-商业模式模板，确保生成、预览和导出都走 BP 商业画布专用布局。
  await context.database.insert("templates", {
    id: "pitch-business-plan-business-model",
    slug: "pitch-business-plan-business-model",
    name: "商业计划书 - 商业模式",
    categoryId: "pitch",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "business-model",
        name: "商业模式",
        visual: {
          primary: "10213F",
          accent: "16A34A",
          secondary: "D6A84F",
          background: "F5F7FB",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "business-model-bp",
          variant: "business-model",
        },
      },
    ],
    visual: {
      primary: "10213F",
      accent: "16A34A",
      secondary: "D6A84F",
      background: "F5F7FB",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "business-model-bp",
      variant: "business-model",
    },
    layoutSchema: {
      defaultCoverLayout: "bp-cover",
      defaultContentLayout: "bp-canvas",
      allowedLayouts: ["bp-cover", "bp-canvas", "bp-revenue", "bp-cost", "bp-value-chain", "bp-ecosystem", "bp-capital-plan", "hero", "content"],
    },
  });
}

async function insertSeedRoundStartupStoryTemplate(context) {
  // 测试数据库模拟官方模板同步后的种子轮融资路演模板，确保页面内容和主题选择元数据分离。
  await context.database.insert("templates", {
    id: "pitch-seed-round-pitch-startup-story",
    slug: "pitch-seed-round-pitch-startup-story",
    name: "种子轮融资路演 - 创业故事",
    categoryId: "pitch",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "startup-story",
        name: "创业故事",
        visual: {
          primary: "172033",
          accent: "F97316",
          background: "F6F4EF",
          surface: "FFFFFF",
          title: "172033",
          body: "465266",
          layout: "seed-round-story",
          variant: "startup-story",
        },
      },
    ],
    visual: {
      primary: "172033",
      accent: "F97316",
      background: "F6F4EF",
      surface: "FFFFFF",
      title: "172033",
      body: "465266",
      layout: "seed-round-story",
      variant: "startup-story",
    },
    layoutSchema: {
      defaultCoverLayout: "seed-story-cover",
      defaultContentLayout: "seed-story-content",
      allowedLayouts: ["seed-story-cover", "founder-story", "pain-discovery", "mvp-validation", "early-traction", "team-belief", "funding-roadmap", "seed-story-closing", "title", "content"],
    },
  });
}

async function insertGrowthFundingFlywheelTemplate(context) {
  // 测试数据库模拟官方模板同步后的增长融资路演模板，确保增长飞轮主题只用于选择，不直接写进预览页面。
  await context.database.insert("templates", {
    id: "pitch-growth-funding-pitch-growth-flywheel",
    slug: "pitch-growth-funding-pitch-growth-flywheel",
    name: "增长融资路演 - 增长飞轮",
    categoryId: "pitch",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "growth-flywheel",
        name: "增长飞轮",
        visual: {
          primary: "0B1220",
          accent: "22C55E",
          background: "EAF1F8",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "growth-funding-flywheel",
          variant: "growth-flywheel",
        },
      },
    ],
    visual: {
      primary: "0B1220",
      accent: "22C55E",
      background: "EAF1F8",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "growth-funding-flywheel",
      variant: "growth-flywheel",
    },
    layoutSchema: {
      defaultCoverLayout: "growth-funding-cover",
      defaultContentLayout: "growth-funding-content",
      allowedLayouts: ["growth-funding-cover", "growth-overview-dashboard", "growth-flywheel-model", "commercialization-progress", "growth-data-proof", "market-expansion-plan", "funding-use-milestones", "growth-funding-closing", "title", "content"],
    },
  });
}

async function insertPreAMarketValidationTemplate(context) {
  // 测试数据库模拟官方模板同步后的 Pre-A 融资 BP，确保主题名只用于选择器，不直接写进预览页面。
  await context.database.insert("templates", {
    id: "pitch-pre-a-funding-bp-market-validation",
    slug: "pitch-pre-a-funding-bp-market-validation",
    name: "Pre-A 融资 BP - 市场验证",
    categoryId: "pitch",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "market-validation",
        name: "市场验证",
        visual: {
          primary: "0B1220",
          accent: "14B8A6",
          secondary: "38BDF8",
          warning: "F59E0B",
          background: "EAF2F8",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "pre-a-market-validation",
          variant: "market-validation",
        },
      },
    ],
    visual: {
      primary: "0B1220",
      accent: "14B8A6",
      secondary: "38BDF8",
      warning: "F59E0B",
      background: "EAF2F8",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "pre-a-market-validation",
      variant: "market-validation",
    },
    layoutSchema: {
      defaultCoverLayout: "pre-a-validation-cover",
      defaultContentLayout: "pre-a-validation-content",
      allowedLayouts: ["pre-a-validation-cover", "pre-a-evidence-wall", "pre-a-traction-dashboard", "pre-a-business-model", "pre-a-moat-map", "pre-a-capital-plan", "pre-a-team-closing", "title", "content"],
    },
  });
}

async function insertProductFundingHighlightsTemplate(context) {
  // 测试数据库模拟官方模板同步后的产品融资路演模板，确保产品亮点主题只用于选择器，不直接写进 PPT 页面。
  await context.database.insert("templates", {
    id: "pitch-product-funding-pitch-product-highlights",
    slug: "pitch-product-funding-pitch-product-highlights",
    name: "产品融资路演 - 产品亮点",
    categoryId: "pitch",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "product-highlights",
        name: "产品亮点",
        visual: {
          primary: "0B1220",
          accent: "06B6D4",
          secondary: "22C55E",
          warning: "F59E0B",
          background: "EAF2F8",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "product-funding-highlights",
          variant: "product-highlights",
        },
      },
    ],
    visual: {
      primary: "0B1220",
      accent: "06B6D4",
      secondary: "22C55E",
      warning: "F59E0B",
      background: "EAF2F8",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "product-funding-highlights",
      variant: "product-highlights",
    },
    layoutSchema: {
      defaultCoverLayout: "product-funding-cover",
      defaultContentLayout: "product-capability-map",
      allowedLayouts: ["product-funding-cover", "product-capability-map", "product-demo-flow", "technical-advantage", "user-value-journey", "validation-dashboard", "funding-roadmap", "product-funding-closing", "title", "content"],
    },
  });
}

async function insertInvestorUpdateProgressTemplate(context) {
  // 测试数据库模拟官方模板同步后的投资人更新报告，确保进展同步主题只用于选择器，不直接写进 PPT 页面。
  await context.database.insert("templates", {
    id: "pitch-investor-update-report-progress-sync",
    slug: "pitch-investor-update-report-progress-sync",
    name: "投资人更新报告 - 进展同步",
    categoryId: "pitch",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "progress-sync",
        name: "进展同步",
        visual: {
          primary: "111827",
          accent: "14B8A6",
          secondary: "F59E0B",
          warning: "EF4444",
          background: "EEF4F8",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "investor-update-progress-sync",
          variant: "progress-sync",
        },
      },
    ],
    visual: {
      primary: "111827",
      accent: "14B8A6",
      secondary: "F59E0B",
      warning: "EF4444",
      background: "EEF4F8",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "investor-update-progress-sync",
      variant: "progress-sync",
    },
    layoutSchema: {
      defaultCoverLayout: "investor-update-cover",
      defaultContentLayout: "investor-progress-briefing",
      allowedLayouts: ["investor-update-cover", "investor-progress-briefing", "investor-metrics-disclosure", "investor-operating-timeline", "investor-risk-asks", "investor-next-plan", "investor-update-closing", "title", "content"],
    },
  });
}

async function insertBiExecutiveCockpitTemplate(context) {
  // 测试数据库模拟官方模板同步后的 BI 数据看板，确保预览走深色驾驶舱专用布局。
  await context.database.insert("templates", {
    id: "data-bi-dashboard-executive-cockpit",
    slug: "data-bi-dashboard-executive-cockpit",
    name: "BI 数据看板 - 管理驾驶舱",
    categoryId: "data",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "executive-cockpit",
        name: "管理驾驶舱",
        visual: {
          primary: "071A2F",
          accent: "22D3EE",
          secondary: "A3E635",
          background: "08111F",
          surface: "0E2238",
          title: "E6F7FF",
          body: "A8C7D8",
          layout: "bi-executive-cockpit",
          variant: "executive-cockpit",
        },
      },
    ],
    visual: {
      primary: "071A2F",
      accent: "22D3EE",
      secondary: "A3E635",
      background: "08111F",
      surface: "0E2238",
      title: "E6F7FF",
      body: "A8C7D8",
      layout: "bi-executive-cockpit",
      variant: "executive-cockpit",
    },
    layoutSchema: {
      defaultCoverLayout: "cockpit-cover",
      defaultContentLayout: "cockpit-dashboard",
      allowedLayouts: ["cockpit-cover", "cockpit-dashboard", "cockpit-trend", "cockpit-distribution", "cockpit-alert", "cockpit-closing", "title", "content", "closing"],
    },
  });
}

async function insertUserPathFunnelTemplate(context) {
  // 测试数据库模拟官方模板同步后的用户行为分析模板，确保预览进入路径转化专属布局。
  await context.database.insert("templates", {
    id: "data-user-behavior-analysis-path-funnel",
    slug: "data-user-behavior-analysis-path-funnel",
    name: "用户行为分析 - 路径漏斗",
    categoryId: "data",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "path-funnel",
        name: "路径漏斗",
        visual: {
          primary: "172554",
          accent: "06B6D4",
          secondary: "22C55E",
          warning: "F97316",
          background: "F6FAFF",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "user-path-funnel",
          variant: "path-funnel",
        },
      },
    ],
    visual: {
      primary: "172554",
      accent: "06B6D4",
      secondary: "22C55E",
      warning: "F97316",
      background: "F6FAFF",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "user-path-funnel",
      variant: "path-funnel",
    },
    layoutSchema: {
      defaultCoverLayout: "path-cover",
      defaultContentLayout: "path-analysis",
      allowedLayouts: ["path-cover", "path-overview", "path-funnel", "path-experiment", "path-actions", "title", "content", "closing"],
    },
  });
}

async function insertMarketTrendRadarTemplate(context) {
  // 测试数据库模拟官方模板同步后的市场趋势洞察模板，确保预览进入趋势雷达专属布局。
  await context.database.insert("templates", {
    id: "data-market-trend-insight-trend-radar",
    slug: "data-market-trend-insight-trend-radar",
    name: "市场趋势洞察 - 趋势雷达",
    categoryId: "data",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "trend-radar",
        name: "趋势雷达",
        visual: {
          primary: "08111F",
          accent: "38BDF8",
          secondary: "A78BFA",
          warning: "F59E0B",
          background: "050B18",
          surface: "0F1E33",
          title: "E6F7FF",
          body: "B7C9DA",
          layout: "market-trend-radar",
          variant: "trend-radar",
        },
      },
    ],
    visual: {
      primary: "08111F",
      accent: "38BDF8",
      secondary: "A78BFA",
      warning: "F59E0B",
      background: "050B18",
      surface: "0F1E33",
      title: "E6F7FF",
      body: "B7C9DA",
      layout: "market-trend-radar",
      variant: "trend-radar",
    },
    layoutSchema: {
      defaultCoverLayout: "trend-radar-cover",
      defaultContentLayout: "trend-radar-scan",
      allowedLayouts: ["trend-radar-cover", "trend-radar-scan", "trend-opportunity-map", "trend-competition-shift", "trend-risk-signal", "trend-action-roadmap", "title", "content", "closing"],
    },
  });
}

async function insertCustomerSegmentationLayeringTemplate(context) {
  // 测试数据库模拟官方模板同步后的客户分群画像模板，覆盖人群分层预览和动态版式解析。
  await context.database.insert("templates", {
    id: "data-customer-segmentation-persona-layering",
    slug: "data-customer-segmentation-persona-layering",
    name: "客户分群画像 - 人群分层",
    categoryId: "data",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "persona-layering",
        name: "人群分层",
        visual: {
          primary: "111827",
          accent: "14B8A6",
          secondary: "F59E0B",
          warning: "A855F7",
          background: "F6FAFC",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "customer-segmentation-layering",
          variant: "persona-layering",
        },
      },
    ],
    visual: {
      primary: "111827",
      accent: "14B8A6",
      secondary: "F59E0B",
      warning: "A855F7",
      background: "F6FAFC",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "customer-segmentation-layering",
      variant: "persona-layering",
    },
    layoutSchema: {
      defaultCoverLayout: "customer-segmentation-layering-cover",
      defaultContentLayout: "customer-segmentation-layering-persona",
      allowedLayouts: [
        "customer-segmentation-layering-cover",
        "customer-segmentation-layering-overview",
        "customer-segmentation-layering-persona",
        "customer-segmentation-layering-matrix",
        "customer-segmentation-layering-analysis",
        "customer-segmentation-layering-strategy",
        "customer-segmentation-layering-action",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function insertMetricAnomalyAttributionTemplate(context) {
  // 测试数据库模拟官方模板同步后的指标异常诊断模板，覆盖归因分析的预览和动态版式解析。
  await context.database.insert("templates", {
    id: "data-metric-anomaly-diagnosis-attribution-analysis",
    slug: "data-metric-anomaly-diagnosis-attribution-analysis",
    name: "指标异常诊断 - 归因分析",
    categoryId: "data",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "attribution-analysis",
        name: "归因分析",
        visual: {
          primary: "0F172A",
          accent: "06B6D4",
          secondary: "F97316",
          warning: "EF4444",
          background: "F4F8FB",
          surface: "FFFFFF",
          title: "0B1220",
          body: "334155",
          layout: "metric-anomaly-attribution",
          variant: "attribution-analysis",
        },
      },
    ],
    visual: {
      primary: "0F172A",
      accent: "06B6D4",
      secondary: "F97316",
      warning: "EF4444",
      background: "F4F8FB",
      surface: "FFFFFF",
      title: "0B1220",
      body: "334155",
      layout: "metric-anomaly-attribution",
      variant: "attribution-analysis",
    },
    layoutSchema: {
      defaultCoverLayout: "metric-anomaly-attribution-cover",
      defaultContentLayout: "metric-anomaly-attribution-diagnosis",
      allowedLayouts: [
        "metric-anomaly-attribution-cover",
        "metric-anomaly-attribution-overview",
        "metric-anomaly-attribution-diagnosis",
        "metric-anomaly-attribution-analysis",
        "metric-anomaly-attribution-impact",
        "metric-anomaly-attribution-action",
        "metric-anomaly-attribution-summary",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function insertMarketSurveyAnalysisTemplate(context) {
  // 测试数据库模拟官方模板同步后的市场调研报告模板，覆盖问卷分析专属预览布局。
  await context.database.insert("templates", {
    id: "data-market-research-report-survey-analysis",
    slug: "data-market-research-report-survey-analysis",
    name: "市场调研报告 - 问卷分析",
    categoryId: "data",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "survey-analysis",
        name: "问卷分析",
        visual: {
          primary: "155E75",
          accent: "14B8A6",
          secondary: "F97316",
          warning: "F59E0B",
          background: "F5FAFC",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "market-survey-analysis",
          variant: "survey-analysis",
        },
      },
    ],
    visual: {
      primary: "155E75",
      accent: "14B8A6",
      secondary: "F97316",
      warning: "F59E0B",
      background: "F5FAFC",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "market-survey-analysis",
      variant: "survey-analysis",
    },
    layoutSchema: {
      defaultCoverLayout: "market-survey-analysis-cover",
      defaultContentLayout: "market-survey-analysis-question",
      allowedLayouts: [
        "market-survey-analysis-cover",
        "market-survey-analysis-sample",
        "market-survey-analysis-question",
        "market-survey-analysis-cross",
        "market-survey-analysis-finding",
        "market-survey-analysis-strategy",
        "market-survey-analysis-summary",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function insertCorporateTrainingTemplate(context) {
  // 测试数据库模拟官方模板同步后的企业内训课程模板，确保预览走内训课件专用布局。
  await context.database.insert("templates", {
    id: "education-corporate-training-management",
    slug: "education-corporate-training-management",
    name: "企业内训课程 - 管理培训",
    categoryId: "education",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "management",
        name: "管理培训",
        visual: {
          primary: "1F3A5F",
          accent: "20A39E",
          secondary: "F3A712",
          background: "F4F7FA",
          surface: "FFFFFF",
          title: "10233D",
          body: "40516A",
          layout: "corporate-training",
          variant: "management",
        },
      },
    ],
    visual: {
      primary: "1F3A5F",
      accent: "20A39E",
      secondary: "F3A712",
      background: "F4F7FA",
      surface: "FFFFFF",
      title: "10233D",
      body: "40516A",
      layout: "corporate-training",
      variant: "management",
    },
    layoutSchema: {
      defaultCoverLayout: "corporate-training-cover",
      defaultContentLayout: "corporate-training-content",
      allowedLayouts: [
        "corporate-training-cover",
        "corporate-training-agenda",
        "corporate-training-chapter",
        "corporate-training-model",
        "corporate-training-case",
        "corporate-training-tool",
        "corporate-training-practice",
        "corporate-training-summary",
        "title",
        "content",
      ],
    },
  });
}

async function insertOnboardingGuideTemplate(context) {
  // 测试数据库模拟官方模板同步后的新员工入职模板，避免大纲阶段出现 TEMPLATE_NOT_FOUND。
  await context.database.insert("templates", {
    id: "education-onboarding-training-onboarding-guide",
    slug: "education-onboarding-training-onboarding-guide",
    name: "新员工入职培训 - Onboarding 指南",
    categoryId: "education",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "onboarding-guide",
        name: "Onboarding 指南",
        visual: {
          primary: "1E3A5F",
          accent: "14B8A6",
          secondary: "F59E0B",
          background: "F4F8FB",
          surface: "FFFFFF",
          title: "102033",
          body: "41516A",
          layout: "onboarding-guide",
          variant: "onboarding-guide",
        },
      },
    ],
    visual: {
      primary: "1E3A5F",
      accent: "14B8A6",
      secondary: "F59E0B",
      background: "F4F8FB",
      surface: "FFFFFF",
      title: "102033",
      body: "41516A",
      layout: "onboarding-guide",
      variant: "onboarding-guide",
    },
    layoutSchema: {
      defaultCoverLayout: "onboarding-cover",
      defaultContentLayout: "onboarding-journey",
      allowedLayouts: [
        "onboarding-cover",
        "onboarding-journey",
        "onboarding-policy",
        "onboarding-role",
        "onboarding-culture",
        "onboarding-checklist",
        "onboarding-summary",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function insertKnowledgeBlackboardTemplate(context) {
  // 测试数据库模拟官方模板同步后的课堂讲义模板，覆盖大纲、预览和动态版式解析。
  await context.database.insert("templates", {
    id: "education-knowledge-handout-blackboard",
    slug: "education-knowledge-handout-blackboard",
    name: "知识课程讲义 - 课堂板书",
    categoryId: "education",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "blackboard",
        name: "课堂板书",
        visual: {
          primary: "173B33",
          accent: "FACC15",
          secondary: "60A5FA",
          warning: "F87171",
          background: "F4F1E8",
          surface: "FFFDF5",
          title: "F8FAE7",
          body: "E8F3DF",
          layout: "knowledge-blackboard",
          variant: "blackboard",
        },
      },
    ],
    visual: {
      primary: "173B33",
      accent: "FACC15",
      secondary: "60A5FA",
      warning: "F87171",
      background: "F4F1E8",
      surface: "FFFDF5",
      title: "F8FAE7",
      body: "E8F3DF",
      layout: "knowledge-blackboard",
      variant: "blackboard",
    },
    layoutSchema: {
      defaultCoverLayout: "blackboard-cover",
      defaultContentLayout: "blackboard-note",
      allowedLayouts: [
        "blackboard-cover",
        "blackboard-outline",
        "blackboard-concept",
        "blackboard-detail",
        "blackboard-case",
        "blackboard-steps",
        "blackboard-summary",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function insertExamReviewKeypointsTemplate(context) {
  // 测试数据库模拟官方模板同步后的考试复习模板，确保生成工作台能按新目录模板解析视觉布局。
  await context.database.insert("templates", {
    id: "education-exam-review-courseware-key-points",
    slug: "education-exam-review-courseware-key-points",
    name: "考试复习课件 - 重点梳理",
    categoryId: "education",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "key-points",
        name: "重点梳理",
        visual: {
          primary: "1E2A78",
          accent: "F59E0B",
          secondary: "06B6D4",
          warning: "EF4444",
          background: "F4F7FB",
          surface: "FFFFFF",
          title: "172554",
          body: "334155",
          layout: "exam-review-keypoints",
          variant: "key-points",
        },
      },
    ],
    visual: {
      primary: "1E2A78",
      accent: "F59E0B",
      secondary: "06B6D4",
      warning: "EF4444",
      background: "F4F7FB",
      surface: "FFFFFF",
      title: "172554",
      body: "334155",
      layout: "exam-review-keypoints",
      variant: "key-points",
    },
    layoutSchema: {
      defaultCoverLayout: "exam-review-cover",
      defaultContentLayout: "exam-review-keypoints",
      allowedLayouts: [
        "exam-review-cover",
        "exam-review-roadmap",
        "exam-review-framework",
        "exam-review-keypoints",
        "exam-review-mistakes",
        "exam-review-plan",
        "exam-review-summary",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function insertTeachingAchievementShowcaseTemplate(context) {
  // 测试数据库模拟官方模板同步后的教学成果汇报模板，覆盖大纲生成和在线预览的专用版式。
  await context.database.insert("templates", {
    id: "education-teaching-achievement-report-showcase",
    slug: "education-teaching-achievement-report-showcase",
    name: "教学成果汇报 - 成果展示",
    categoryId: "education",
    scope: "official",
    official: true,
    status: "active",
    themes: [
      {
        id: "showcase",
        name: "成果展示",
        visual: {
          primary: "1E3A8A",
          accent: "14B8A6",
          secondary: "F59E0B",
          success: "22C55E",
          background: "F4F8FB",
          surface: "FFFFFF",
          title: "172554",
          body: "334155",
          layout: "teaching-achievement-showcase",
          variant: "showcase",
        },
      },
    ],
    visual: {
      primary: "1E3A8A",
      accent: "14B8A6",
      secondary: "F59E0B",
      success: "22C55E",
      background: "F4F8FB",
      surface: "FFFFFF",
      title: "172554",
      body: "334155",
      layout: "teaching-achievement-showcase",
      variant: "showcase",
    },
    layoutSchema: {
      defaultCoverLayout: "teaching-achievement-showcase-cover",
      defaultContentLayout: "teaching-achievement-showcase-content",
      allowedLayouts: [
        "teaching-achievement-showcase-cover",
        "teaching-achievement-showcase-gallery",
        "teaching-achievement-showcase-content",
        "teaching-achievement-showcase-analysis",
        "teaching-achievement-showcase-review",
        "teaching-achievement-showcase-summary",
        "title",
        "content",
        "closing",
      ],
    },
  });
}

async function postJson(url, cookie, body) {
  return fetch(url, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function previewRoleHtml(html, role) {
  const start = html.indexOf(`data-dome-role="${role}"`);
  if (start === -1) return "";
  const articleEnd = html.indexOf("</article>", start);
  return html.slice(start, articleEnd === -1 ? undefined : articleEnd);
}
