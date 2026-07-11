import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveBrandStoryScene,
  resolveDataInsightScene,
  resolveMarketingCampaignScene,
  resolvePitchDeckScene,
} from "../src/template-scenes/commercial-template-scenes.js";

const CASES = [
  [resolveMarketingCampaignScene, ["launch", "brand", "growth"]],
  [resolveBrandStoryScene, ["editorial", "premium", "identity"]],
  [resolveDataInsightScene, ["dashboard", "insight", "research"]],
  [resolvePitchDeckScene, ["startup", "investor"]],
];

test("目标商业模板的预览与导出共享完整场景定义", () => {
  for (const [resolver, variants] of CASES) {
    for (const variant of variants) {
      const scene = resolver({ variant });
      assert.equal(scene.variant, variant);
      assert.ok(scene.kicker);
      assert.ok(scene.section);
      assert.ok(scene.caption);
    }
  }
});

test("共享场景不把主题风格名称写入页面标签", () => {
  const forbidden = ["新品发布", "品牌传播", "增长营销", "编辑叙事", "品牌识别", "高端质感", "仪表盘", "洞察分析", "研究报告", "投资人版", "创业故事"];
  for (const [resolver, variants] of CASES) {
    for (const variant of variants) {
      const serialized = JSON.stringify(resolver({ variant }));
      for (const themeName of forbidden) assert.equal(serialized.includes(themeName), false, `${variant} 不应显示主题名 ${themeName}`);
    }
  }
});
