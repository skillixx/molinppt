import assert from "node:assert/strict";
import { test } from "node:test";

import { PptExportService } from "../src/ppt-exporter.js";
import {
  getTemplatePageRoles,
  getTemplateVisual,
} from "../../templates/official/marketing/brand-story/editorial/renderer.js";

const slides = [
  { title: "我们为何出发", layout: "editorial-cover", bullets: ["从真实问题出发，建立长期价值判断"] },
  { title: "故事从这里开始", layout: "editorial-opener", bullets: ["创始初心来自用户需求", "团队用行动验证主张"] },
  { title: "十年品牌历程", layout: "editorial-timeline", bullets: ["品牌创立", "产品成型", "用户增长", "走向长期"] },
  { title: "与创始人对话", layout: "editorial-interview", bullets: ["品牌不是一句话，而是一系列选择"] },
  { title: "我们始终相信", layout: "editorial-manifesto", bullets: ["真实", "长期", "共同创造"] },
  { title: "人与品牌的连接", layout: "editorial-feature", bullets: ["真实场景形成传播内容", "用户故事沉淀品牌资产"] },
  { title: "被验证的品牌价值", layout: "editorial-evidence", bullets: ["用户认知持续提升", "品牌资产长期增长", "传播效率不断优化"] },
  { title: "下一段故事", layout: "editorial-closing", bullets: ["让长期主义继续发生"] },
];

test("编辑叙事模板声明完整的商业杂志页面角色", () => {
  const visual = getTemplateVisual();
  const roles = getTemplatePageRoles();

  assert.equal(visual.layout, "brand-story-editorial");
  assert.deepEqual(roles.map((item) => item.id), ["cover", "opener", "timeline", "interview", "manifesto", "feature", "evidence", "closing"]);
  assert.equal(new Set(roles.map((item) => item.layout)).size, 8);
});

test("编辑叙事 PPTX 为八类页面输出独立且可编辑的 DrawingML 图层", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      id: "editorial-contract-deck",
      title: "品牌年度故事",
      templateId: "brand-story",
      theme: "editorial",
      slides,
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");

  for (const marker of [
    "Editorial Cover Title",
    "Editorial Opener Title",
    "Editorial Timeline Title",
    "Editorial Interview Title",
    "Editorial Manifesto Title",
    "Editorial Feature Title",
    "Editorial Evidence Title",
    "Editorial Closing Title",
  ]) {
    assert.match(text, new RegExp(marker));
  }
  assert.match(text, /Editorial Portrait Field/);
  assert.match(text, /Editorial Timeline Node 1/);
  assert.match(text, /Editorial Evidence Card 1/);
  assert.doesNotMatch(text, />编辑叙事</);
});
