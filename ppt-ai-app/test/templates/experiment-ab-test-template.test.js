import assert from "node:assert/strict";
import { test } from "node:test";

import { PptExportService } from "../../src/ppt-exporter.js";
import { PptService } from "../../src/ppt-service.js";
import { TemplateManager, resolveTemplateVisual } from "../../src/templates.js";

const experimentVisual = {
  id: "data-experiment-analysis-report-ab-test",
  name: "实验分析报告",
  layout: "experiment-ab-test",
  variant: "ab-test",
  primary: "12355B",
  accent: "16A3A3",
  secondary: "F59E0B",
  warning: "EF4444",
  background: "EEF7F8",
  surface: "FFFFFF",
  title: "0B172A",
  body: "334155",
};

const experimentTemplate = {
  id: "data-experiment-analysis-report-ab-test",
  name: "实验分析报告",
  categoryId: "data",
  categoryName: "数据洞悉",
  scope: "official",
  official: true,
  status: "active",
  visual: experimentVisual,
  themes: [
    { id: "ab-test", name: "A/B 测试", visual: experimentVisual },
  ],
  layoutSchema: {
    defaultCoverLayout: "experiment-ab-test-cover",
    defaultContentLayout: "experiment-ab-test-design",
    allowedLayouts: [
      "experiment-ab-test-cover",
      "experiment-ab-test-design",
      "experiment-ab-test-result",
      "experiment-ab-test-funnel",
      "experiment-ab-test-decision",
      "experiment-ab-test-next",
      "experiment-ab-test-summary",
    ],
  },
};

const experimentDeck = {
  id: "deck-experiment-ab-test",
  ownerUserId: 7,
  title: "增长实验复盘",
  templateId: "data-experiment-analysis-report-ab-test",
  templateName: "实验分析报告",
  theme: "ab-test",
  status: "ready",
  slides: [
    {
      title: "首页转化实验结果复盘",
      layout: "experiment-ab-test-cover",
      bullets: ["B 组转化率较 A 组提升 12.8%", "有效样本覆盖核心用户分层", "显著性结果支持继续放量"],
    },
    {
      title: "实验假设与分组设计",
      layout: "experiment-ab-test-design",
      bullets: ["假设：降低首屏理解成本可提升试用转化", "A 组延续原版页面", "B 组强化权益说明与行动按钮", "判定标准为 95% 置信水平"],
    },
    {
      title: "核心指标对比",
      layout: "experiment-ab-test-result",
      bullets: ["样本量 24800 覆盖三类渠道", "转化率提升 12.8%", "次日留存提升 3.6%", "客诉率无明显上升"],
    },
    {
      title: "转化漏斗变化",
      layout: "experiment-ab-test-funnel",
      bullets: ["访问到点击提升 9.1%", "点击到注册提升 7.4%", "注册到试用提升 5.2%"],
    },
    {
      title: "上线决策矩阵",
      layout: "experiment-ab-test-decision",
      bullets: ["保留 B 组首屏表达", "继续验证价格提示变量", "优化移动端按钮密度", "暂停低样本渠道判断"],
    },
    {
      title: "下一轮实验计划",
      layout: "experiment-ab-test-next",
      bullets: ["补充样本观察长周期留存", "拆分权益文案与视觉变量", "监控渠道质量与客诉风险", "复盘结论进入增长知识库"],
    },
  ],
};

test("experiment analysis official template resolves to dedicated A/B visual", () => {
  const visual = resolveTemplateVisual({
    templateId: experimentTemplate.id,
    theme: "ab-test",
    template: experimentTemplate,
  });

  assert.equal(visual.layout, "experiment-ab-test");
  assert.equal(visual.variant, "ab-test");
  assert.equal(visual.primary, "12355B");
});

test("experiment analysis online preview uses dedicated editable A/B scenes", async () => {
  const service = new PptService({
    database: { findOne: async (collection, predicate) => (collection === "decks" && predicate(experimentDeck) ? experimentDeck : null) },
    storage: {},
    taskCenter: {},
    templateManager: new TemplateManager({ templates: [experimentTemplate] }),
    aiProvider: {},
    promptManager: {},
    exporter: new PptExportService(),
    billingClient: {},
  });

  const html = await service.previewDeck({ ownerUserId: 7, deckId: experimentDeck.id });

  assert.match(html, /data-layout="experiment-ab-test"/);
  assert.match(html, /class="experiment-groups"/);
  assert.match(html, /class="experiment-flow"/);
  assert.match(html, /class="experiment-result"/);
  assert.match(html, /class="experiment-funnel"/);
  assert.match(html, /class="experiment-decision"/);
  assert.match(html, /class="experiment-next"/);
  assert.match(html, /B 组转化率较 A 组提升 12\.8%/);
  assert.doesNotMatch(html, />A\/B 测试</);
});

test("experiment analysis PPTX export uses the same dedicated A/B layout", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...experimentDeck,
      templateVisual: experimentVisual,
    },
    format: "pptx",
  });
  const text = result.content.toString("utf8");

  assert.match(text, /Experiment AB Canvas/);
  assert.match(text, /Experiment AB Group Stage/);
  assert.match(text, /Experiment AB Flow Step 1/);
  assert.match(text, /Experiment AB Result Card 1/);
  assert.match(text, /Experiment AB Funnel Top/);
  assert.match(text, /Experiment AB Decision Cell 1/);
  assert.match(text, /Experiment AB Next Card 1/);
  assert.match(text, /B 组转化率较 A 组提升 12\.8%/);
  assert.doesNotMatch(text, /A\/B 测试/);
});
