import assert from "node:assert/strict";
import { test } from "node:test";

import { PptExportService } from "../src/ppt-exporter.js";

const deck = {
  id: "deck-abcdef123456",
  title: "Executive Review",
  templateId: "business",
  createdAt: "2026-07-02T10:20:00.000Z",
  slides: [
    { title: "Overview", bullets: ["Revenue grew", "Retention improved"] },
    { title: "Next Steps", bullets: ["Launch pilot"] },
  ],
};

const DOME_VISUAL = {
  primary: "1F4E79",
  accent: "F4A261",
  background: "F1F5F9",
  surface: "FFFFFF",
  title: "0F2945",
  body: "334155",
  layout: "red-gold",
};

test("PptExportService creates a PPTX zip package with presentation parts", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({ deck, format: "pptx" });
  const text = result.content.toString("latin1");

  assert.equal(result.content.subarray(0, 2).toString("utf8"), "PK");
  assert.equal(result.fileName, "PPT-Executive-Review-business-2p-20260702-1820-123456.pptx");
  assert.match(text, /\[Content_Types\]\.xml/);
  assert.match(text, /ppt\/presentation\.xml/);
  assert.match(text, /ppt\/slides\/slide1\.xml/);
  assert.match(text, /Revenue grew/);
});

test("PptExportService creates PPTX relationship, layout, master, and theme parts required by Office apps", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({ deck, format: "pptx" });
  const text = result.content.toString("latin1");

  assert.match(text, /ppt\/slides\/_rels\/slide1\.xml\.rels/);
  assert.match(text, /ppt\/slideLayouts\/slideLayout1\.xml/);
  assert.match(text, /ppt\/slideLayouts\/_rels\/slideLayout1\.xml\.rels/);
  assert.match(text, /ppt\/slideMasters\/slideMaster1\.xml/);
  assert.match(text, /ppt\/slideMasters\/_rels\/slideMaster1\.xml\.rels/);
  assert.match(text, /ppt\/theme\/theme1\.xml/);
  assert.match(text, /application\/vnd\.openxmlformats-officedocument\.presentationml\.slideLayout\+xml/);
  assert.match(text, /application\/vnd\.openxmlformats-officedocument\.presentationml\.slideMaster\+xml/);
  assert.match(text, /application\/vnd\.openxmlformats-officedocument\.theme\+xml/);
  assert.match(text, /<p:sldMasterIdLst>/);
  assert.match(text, /<p:nvSpPr>/);
});

test("PptExportService applies template-specific visual colors to PPTX output", () => {
  const exporter = new PptExportService();
  const business = exporter.exportDeck({ deck: { ...deck, templateId: "business", theme: "modern" }, format: "pptx" });
  const pitch = exporter.exportDeck({ deck: { ...deck, templateId: "pitch", theme: "startup" }, format: "pptx" });
  const businessText = business.content.toString("latin1");
  const pitchText = pitch.content.toString("latin1");

  assert.match(businessText, /name="Moling Theme"/);
  assert.match(businessText, /val="B91C1C"/);
  assert.match(businessText, /name="Top Band Surface"/);
  assert.match(businessText, /name="Top Band Accent Ribbon"/);
  assert.match(businessText, /name="Top Band Cover Focus Frame"/);
  assert.match(pitchText, /name="Moling Theme"/);
  assert.match(pitchText, /val="16213E"/);
  assert.notEqual(businessText, pitchText);
});

test("PptExportService uses dedicated top-band decorations for business minimal theme", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "business", theme: "minimal" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Top Band Surface"/);
  assert.match(slide1, /name="Primary Rail"/);
  assert.match(slide1, /name="Top Band Outline"/);
  assert.match(slide1, /name="Top Band Hero Halo"/);
  assert.match(slide1, /name="Top Band Cover Accent Band"/);
  assert.match(slide1, /name="Top Band Cover Glow"/);
  assert.match(slide1, /name="Top Band Cover Focus Frame"/);
  assert.match(slide1, /name="Top Band Cover Detail Stripe"/);
  assert.match(slide1, /name="Top Band Accent Ribbon"/);
  assert.match(slide1, /name="Top Band Side Cap"/);
  assert.match(slide1, /name="Section Label"/);
  assert.match(slide2, /name="Top Band Content Divider"/);
  assert.match(slide1, /name="Content 2"[\s\S]*?<a:rPr[^>]* sz="1500"/);
  assert.match(slide1, /name="Content 2"[\s\S]*?<a:t>Revenue grew<\/a:t>/);
  assert.match(slide2, /name="Content 2"[\s\S]*?<a:rPr[^>]* sz="1450"/);
  assert.match(slide2, /name="Content 2"[\s\S]*?<a:t>Launch pilot<\/a:t>/);
  const coverTitleBlock = slide1.match(/name="Title 1"[\s\S]*?<\/p:txBody><\/p:sp>/)?.[0] || "";
  const contentTitleBlock = slide2.match(/name="Title 1"[\s\S]*?<\/p:txBody><\/p:sp>/)?.[0] || "";
  const coverTitleSize = Number((coverTitleBlock.match(/a:rPr[^>]* sz="(\d+)"/) || [])[1]);
  const contentTitleSize = Number((contentTitleBlock.match(/a:rPr[^>]* sz="(\d+)"/) || [])[1]);
  assert.equal(coverTitleSize > contentTitleSize, true);
  assert.equal(coverTitleSize, 4300);
});

test("PptExportService uses commercial project status weekly decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "project-status", theme: "weekly" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const rels1 = pptPartText(text, "ppt/slides/_rels/slide1.xml.rels");

  assert.match(slide1, /name="Status Report Surface"/);
  assert.match(slide1, /name="Status Report Business Image"/);
  assert.match(slide1, /name="Status Metric Card 1"/);
  assert.match(slide1, /name="Status weekly Sticker"/);
  assert.match(slide1, /name="Status Timeline Progress"/);
  assert.match(slide1, /val="163D59"/);
  assert.match(slide1, /val="2AA7A5"/);
  assert.match(rels1, /status-report-weekly\.jpeg/);
  assert.match(text, /ppt\/media\/status-report-weekly\.jpeg/);
});

test("PptExportService uses commercial project status steering decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "project-status", theme: "steering" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Status Report Surface"/);
  assert.match(slide1, /name="Status Report Business Image"/);
  assert.match(slide1, /name="Status Metric Card 1"/);
  assert.match(slide1, /name="Status steering Sticker"/);
  assert.match(slide1, /<a:t>4<\/a:t>/);
  assert.match(slide1, /val="1F2F46"/);
  assert.match(slide1, /val="D59E3D"/);
  assert.match(text, /ppt\/media\/status-report-steering\.jpeg/);
});

test("PptExportService uses commercial project status delivery decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "project-status", theme: "delivery" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Status Report Surface"/);
  assert.match(slide1, /name="Status Report Business Image"/);
  assert.match(slide1, /name="Status Timeline Progress"/);
  assert.match(slide1, /name="Status delivery Sticker"/);
  assert.match(slide1, /<a:t>12<\/a:t>/);
  assert.match(slide1, /val="12324A"/);
  assert.match(slide1, /val="2BA6A0"/);
  assert.match(text, /ppt\/media\/status-report-delivery\.jpeg/);
});

test("PptExportService uses commercial strategy consulting board decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "strategy-consulting", theme: "board" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Strategy Consulting Image"/);
  assert.match(slide1, /name="Strategy board Chip"/);
  assert.doesNotMatch(slide1, /name="Strategy Mark Card 1"/);
  assert.match(slide1, /val="18253A"/);
  assert.match(slide1, /val="C7A15A"/);
  assert.match(text, /ppt\/media\/strategy-board\.jpeg/);
});

test("PptExportService hides default page label for strategy consulting pages", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "strategy-consulting",
      theme: "board",
      slides: [
        { title: "Cover", bullets: ["Intro"] },
        { title: "Decision", bullets: ["Action"] },
        { title: "Summary", bullets: ["Close"] },
        { title: "Growth path and resourcing", bullets: ["Validate core scenario", "Expand priority channel", "Package repeatable playbook"] },
        { title: "Action board and owner loop", bullets: ["Assign channel owner", "Track conversion cadence", "Review weekly efficiency"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide2 = Buffer.from(pptPartText(text, "ppt/slides/slide2.xml"), "latin1").toString("utf8");

  assert.match(slide2, /name="Strategy Section Label"/);
  assert.doesNotMatch(slide2, /name="Section Label"[\s\S]*<a:t>02<\/a:t>/);
});

test("PptExportService uses commercial strategy consulting matrix decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "strategy-consulting", theme: "matrix" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Strategy Consulting Image"/);
  assert.match(slide1, /name="Strategy matrix Chip"/);
  assert.match(slide1, /val="203A5C"/);
  assert.match(slide1, /val="4C8F8A"/);
  assert.match(text, /ppt\/media\/strategy-matrix\.jpeg/);
});

test("PptExportService uses commercial strategy consulting workstream decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "strategy-consulting", theme: "workstream" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Strategy Consulting Image"/);
  assert.match(slide1, /name="Strategy workstream Chip"/);
  assert.match(slide1, /val="27364A"/);
  assert.match(slide1, /val="D29A45"/);
  assert.match(text, /ppt\/media\/strategy-workstream\.jpeg/);
});

test("PptExportService uses industry research landscape decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "industry-research",
      theme: "industry-landscape",
      slides: [
        { title: "新能源行业规模与格局判断", bullets: ["市场容量持续扩张", "头部玩家分层明显"] },
        { title: "产业链利润向核心环节集中", bullets: ["上游资源价格波动", "渠道与客户结构变化"] },
        { title: "竞争格局呈现双轴分化", bullets: ["产品能力与市场覆盖决定位置"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");

  assert.match(slide1, /name="Industry Research Consulting Canvas"/);
  assert.match(slide1, /name="Industry Map Panel"/);
  assert.match(slide3, /name="Industry Chain Node 1"|name="Industry Competition Matrix"/);
  assert.doesNotMatch(slide1, /industry-landscape/);
});

test("PptExportService uses industry trend forecast decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "industry-research",
      theme: "trend-forecast",
      slides: [
        { title: "AI 应用行业未来增长方向研判", bullets: ["需求侧预算向效率工具集中", "模型能力成熟带来新场景扩散", "渠道生态出现结构性机会"] },
        { title: "趋势信号进入验证窗口", bullets: ["客户试点密度提升", "产品供给形态快速变化"] },
        { title: "驱动因素决定机会优先级", bullets: ["客户需求", "供给能力", "资本投入"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");

  assert.match(slide1, /name="Industry Trend Forecast Canvas"/);
  assert.match(slide1, /name="Industry Trend Curve Panel"/);
  assert.match(slide1, /name="Industry Trend Signal Card 1"/);
  assert.match(slide3, /name="Industry Trend Driver Wheel Outer"/);
  assert.doesNotMatch(slide1, /trend-forecast/);
});

test("PptExportService uses competition map decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "strategy-industry-research-competition-map",
      theme: "competition-map",
      templateVisual: {
        primary: "102A43",
        accent: "12A5A6",
        background: "F4F8FB",
        surface: "FFFFFF",
        title: "071A2D",
        body: "3D5363",
        layout: "strategy-competition-map",
        variant: "competition-map",
      },
      slides: [
        { title: "竞品格局判断与差异化机会", bullets: ["头部玩家强化平台能力", "挑战者聚焦垂直场景", "价格带竞争逐步分化"] },
        { title: "竞争象限呈现能力与覆盖分层", bullets: ["产品能力决定高端位置", "渠道覆盖影响市场纵深", "服务生态形成壁垒"] },
        { title: "主要竞品能力卡片", bullets: ["竞品A覆盖广但成本高", "竞品B场景深但渠道弱", "竞品C价格敏感"] },
        { title: "差异化定位建议", bullets: ["围绕行业场景建立证据", "强化交付服务能力", "形成价值主张"] },
        { title: "市场区隔机会", bullets: ["中高端客户关注可靠性", "低线市场关注成本", "空白机会在服务闭环"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");

  assert.match(slide1, /name="Competition Map Consulting Canvas"/);
  assert.match(slide1, /name="Competition Position Matrix"/);
  assert.match(slide3, /name="Competition Player Card 1"/);
  assert.doesNotMatch(slide1, /competition-map/);
});

test("PptExportService uses second curve strategy decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "strategy-growth-strategy-planning-second-curve",
      theme: "second-curve",
      templateVisual: {
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
      slides: [
        { title: "新业务增长曲线规划", bullets: ["增长目标：三年形成新增收入来源", "增长假设：目标客群愿意为效率提升付费", "资源配置：先试点再扩大投入"] },
        { title: "机会池与目标客群判断", bullets: ["高价值客户集中在存量升级场景", "渠道伙伴具备试点入口", "产品能力需要快速验证"] },
        { title: "孵化路径和阶段投入", bullets: ["验证问题价值", "完成 PMF", "规模化复制", "独立经营单元"] },
        { title: "资源组合和阶段决策", bullets: ["设置阶段投资门槛", "跟踪验证指标", "形成复盘机制"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Second Curve Consulting Canvas"/);
  assert.match(slide1, /name="Second Curve Growth Chart"/);
  assert.match(slide1, /name="Second Curve Metric Card 1"/);
  assert.match(slide3, /name="Second Curve Opportunity Matrix"/);
  assert.match(slide4, /name="Second Curve Roadmap Step 1"/);
  assert.doesNotMatch(slide1, /second-curve/);
});

test("PptExportService uses enterprise digital blueprint decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "strategy-enterprise-transformation-digital-blueprint",
      theme: "digital-blueprint",
      templateVisual: {
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
      slides: [
        { title: "Enterprise transformation blueprint", bullets: ["Systems are fragmented", "Data flow needs governance", "Operating model needs upgrade"] },
        { title: "Current state diagnosis", bullets: ["System silos", "Data quality gaps", "Process offline", "Governance unclear"] },
        { title: "Target digital blueprint", bullets: ["Experience layer", "Process layer", "Data platform", "AI automation"] },
        { title: "Capability upgrade map", bullets: ["Online process", "Data asset", "Intelligent decision", "Agile organization"] },
        { title: "System roadmap", bullets: ["0-3 month foundation", "3-6 month platform", "6-12 month scale"] },
        { title: "Organization governance", bullets: ["Transformation committee", "Business owner", "Data governance", "PMO"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");
  const slide6 = pptPartText(text, "ppt/slides/slide6.xml");

  assert.match(slide1, /name="Enterprise Blueprint Content Surface"/);
  assert.match(slide1, /name="Enterprise Blueprint Architecture Frame"/);
  assert.match(slide1, /name="Enterprise Blueprint Planned Content"/);
  assert.match(slide4, /name="Enterprise Blueprint Capability Card 1"/);
  assert.match(slide5, /name="Enterprise Blueprint Roadmap Node 1"/);
  assert.match(slide6, /name="Enterprise Blueprint Governance Node 1"/);
  assert.doesNotMatch(slide1, /digital-blueprint/);
});

test("PptExportService uses competitor SWOT map decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "competitor-analysis",
      theme: "swot-map",
      slides: [
        { title: "从增长瓶颈到破局行动：2026 年 Q2 竞品复盘", bullets: ["竞品能力分布呈现强弱分化", "差异化机会集中在高价值场景", "需要建立可验证的策略动作"] },
        { title: "SWOT 要素拆解与竞争判断", bullets: ["核心优势来自交付速度", "关键短板是渠道覆盖不足", "机会窗口集中在行业场景"] },
        { title: "竞争坐标定位与机会空白", bullets: ["产品能力形成高端定位", "市场机会来自存量替换", "服务闭环决定差异化"] },
        { title: "能力差距与补位方向", bullets: ["补齐行业方案能力", "强化客户成功体系", "建立策略跟踪机制"] },
        { title: "机会威胁响应与行动优先级", bullets: ["优先放大优势场景", "建立价格战防守线", "锁定重点客户验证"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="SWOT Map Consulting Canvas"/);
  assert.match(slide1, /name="SWOT Quadrant Matrix"/);
  assert.match(slide1, /name="SWOT Strategy Card 1"/);
  assert.match(slide3, /name="SWOT Position Axis"/);
  assert.match(slide4, /name="SWOT Compare Card 1"/);
  assert.doesNotMatch(slide1, /swot-map/);
});

test("PptExportService uses commercial financial quarterly decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "financial-review", theme: "quarterly" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Financial Visual Panel"/);
  assert.match(slide1, /name="Financial quarterly Chip"/);
  assert.match(slide1, /name="Financial Bar 4"/);
  assert.doesNotMatch(slide1, /name="Financial Point Card/);
  assert.match(slide1, /val="18344E"/);
  assert.match(slide1, /val="3B8C62"/);
});

test("PptExportService uses commercial financial audit decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "financial-review", theme: "audit" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Financial Visual Panel"/);
  assert.match(slide1, /name="Financial audit Chip"/);
  assert.match(slide1, /name="Financial Audit Dot 1"/);
  assert.match(slide1, /val="243447"/);
  assert.match(slide1, /val="A56A43"/);
});

test("PptExportService uses commercial financial forecast decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "financial-review", theme: "forecast" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Financial Visual Panel"/);
  assert.match(slide1, /name="Financial forecast Chip"/);
  assert.match(slide1, /name="Financial Forecast Dot 4"/);
  assert.match(slide1, /val="123B4D"/);
  assert.match(slide1, /val="2F9E9A"/);
});

test("PptExportService uses cost control breakdown decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "finance-cost-control-plan-cost-breakdown",
      theme: "cost-breakdown",
      templateVisual: {
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
      slides: [
        { title: "成本控制方案", bullets: ["总成本下降 18%", "采购节约 ￥2.4M", "治理周期 12周"] },
        { title: "成本结构拆解", bullets: ["固定成本占比 42%", "变动成本占比 37%", "可优化费用池 21%"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Cost Breakdown Dashboard"/);
  assert.match(slide1, /name="Cost Breakdown Metric Card 1"/);
  assert.match(slide2, /name="Cost Breakdown Structure Panel"/);
  assert.doesNotMatch(slide1, /Bullet List/);
  assert.match(slide1, /val="102A43"/);
  assert.match(slide1, /val="D59E3D"/);
});

test("PptExportService uses budget planning decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "finance-budget-management-report-budget-planning",
      theme: "budget-planning",
      templateVisual: {
        primary: "102A43",
        accent: "2A9D8F",
        background: "EEF4F8",
        surface: "FFFFFF",
        title: "0B1F33",
        body: "405163",
        layout: "finance-budget-planning",
        variant: "budget-planning",
      },
      slides: [
        { title: "年度预算编制规划", bullets: ["总预算 1.2 亿", "研发投入 3200 万", "市场费用 1800 万"] },
        { title: "部门预算分配", bullets: ["研发中心 3200 万", "市场中心 1800 万", "销售中心 2600 万"] },
        { title: "预算科目明细", bullets: ["人员成本 5200 万", "营销费用 1800 万", "系统建设 900 万"] },
        { title: "编制流程安排", bullets: ["需求提交", "部门初审", "财务复核", "管理审批"] },
        { title: "预算审批节奏", bullets: ["完成业务需求确认", "进入财务复核", "提交管理层审批"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");

  assert.match(slide1, /name="Budget Planning Workspace"/);
  assert.match(slide1, /name="Budget Planning Dashboard Panel"/);
  assert.match(slide3, /name="Budget Planning Allocation Panel"/);
  assert.match(slide4, /name="Budget Planning Subject Table"/);
  assert.match(slide5, /name="Budget Planning Approval Step 1"/);
  assert.doesNotMatch(slide1, /budget-planning/);
});

test("PptExportService uses budget adjustment decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "finance-budget-management-report-budget-adjustment",
      theme: "budget-adjustment",
      templateVisual: {
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
      slides: [
        { title: "预算调整方案", bullets: ["调增预算 1200 万", "冻结低效费用 300 万", "资源转投重点项目"] },
        { title: "资源重配总览", bullets: ["研发项目调增 800 万", "渠道费用调减 300 万", "管理费用冻结 120 万"] },
        { title: "偏差原因与调整建议", bullets: ["收入节奏延后", "关键项目资源不足", "调整后保障重点投入"] },
        { title: "审批路径安排", bullets: ["业务部门提交", "财务复核口径", "管理层审批", "预算系统落账"] },
        { title: "经营影响分析", bullets: ["收入影响可控", "成本结构优化", "现金流维持安全", "项目进度加快"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");

  assert.match(slide1, /name="Budget Adjustment Workspace"/);
  assert.match(slide1, /name="Budget Adjustment Decision Panel"/);
  assert.match(slide2, /name="Budget Adjustment Reallocation Panel"/);
  assert.match(slide4, /name="Budget Adjustment Approval Step 1"/);
  assert.match(slide5, /name="Budget Adjustment Impact Card 1"/);
  assert.match(slide1, /val="18233F"/);
  assert.match(slide1, /val="F59E0B"/);
  assert.doesNotMatch(slide1, /budget-adjustment/);
});

test("PptExportService uses budget variance decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "finance-budget-management-report-execution-variance",
      theme: "execution-variance",
      templateVisual: {
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
      slides: [
        { title: "预算执行偏差复盘", bullets: ["预算达成率 86%", "超支金额 1280 万", "纠偏进度 +24%"] },
        { title: "预算与实际对比", bullets: ["营销费用超支 15%", "人员成本节约 6%", "项目投入延后 800 万"] },
        { title: "偏差原因分析", bullets: ["业务量变化导致收入确认延后", "采购单价上浮带来成本压力", "重点项目排期提前"] },
        { title: "纠偏建议安排", bullets: ["冻结低效费用", "重排项目优先级", "建立周度偏差复盘", "责任部门跟进"] },
        { title: "闭环复盘机制", bullets: ["确认口径", "锁定责任", "调整节奏", "复盘闭环"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");

  assert.match(slide1, /name="Budget Variance Workspace"/);
  assert.match(slide1, /name="Budget Variance Ledger Panel"/);
  assert.match(slide2, /name="Budget Variance Ledger Panel"/);
  assert.match(slide3, /name="Budget Variance Waterfall Panel"/);
  assert.match(slide4, /name="Budget Variance Reason Card 1"/);
  assert.match(slide5, /name="Budget Variance Action Card 1"/);
  assert.match(slide1, /val="16213E"/);
  assert.match(slide1, /val="E9574F"/);
  assert.doesNotMatch(slide1, /execution-variance/);
});

test("PptExportService uses financial industry solution decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "sales-industry-solution-financial-industry",
      theme: "financial-industry",
      templateVisual: {
        primary: "0B2A4A",
        accent: "18A0A6",
        background: "EAF3F7",
        surface: "FFFFFF",
        title: "071D33",
        body: "385269",
        layout: "sales-financial-solution",
        variant: "financial-industry",
      },
      slides: [
        { title: "金融客户数字化解决方案", bullets: ["合规安全能力建设", "核心业务系统升级", "数据风控体系完善"] },
        { title: "金融客户场景痛点", bullets: ["监管要求持续提升", "业务系统割裂明显", "客户体验需要升级"] },
        { title: "解决方案总体架构", bullets: ["客户触点统一", "业务中台支撑", "数据风控联动", "合规审计闭环"] },
        { title: "合规安全价值", bullets: ["监管合规", "数据安全", "流程提效", "客户体验"] },
        { title: "下一步合作计划", bullets: ["完成场景确认", "推进试点部署", "沉淀长期运营"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Financial Solution Workspace"/);
  assert.match(slide1, /name="Financial Solution Security Shield"/);
  assert.match(slide3, /name="Financial Solution Architecture Layer 1"/);
  assert.match(slide4, /name="Financial Solution Value Panel"/);
  assert.doesNotMatch(slide1, /financial-industry/);
});

test("PptExportService uses manufacturing industry solution decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "sales-industry-solution-manufacturing-industry",
      theme: "manufacturing-industry",
      templateVisual: {
        primary: "123A5A",
        accent: "17A7B8",
        background: "E6ECF2",
        surface: "FFFFFF",
        title: "1F2933",
        body: "4B5B68",
        layout: "sales-manufacturing-solution",
        variant: "manufacturing-industry",
      },
      slides: [
        { title: "制造业数字化整体解决方案", bullets: ["产线设备数据统一采集", "工厂流程瓶颈持续优化", "交付效率和质量稳定提升"] },
        { title: "制造现场流程与设备痛点", bullets: ["设备停机影响产能释放", "计划生产质检衔接不足", "现场数据难以形成闭环"] },
        { title: "工厂数字化方案架构", bullets: ["设备接入", "数据采集", "过程分析", "管理看板"] },
        { title: "生产流程优化路径", bullets: ["计划", "生产", "质检", "仓储", "交付"] },
        { title: "设备数据看板价值", bullets: ["OEE提升", "故障预警", "质量追溯", "产能透明"] },
        { title: "制造客户业务价值", bullets: ["降本", "提效", "稳质", "追溯"] },
        { title: "制造客户实施路线", bullets: ["诊断", "试点", "集成", "推广", "运营"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");
  const slide6 = pptPartText(text, "ppt/slides/slide6.xml");
  const slide7 = pptPartText(text, "ppt/slides/slide7.xml");

  assert.match(slide1, /name="Manufacturing Solution Workspace"/);
  assert.match(slide1, /name="Manufacturing Solution Factory Panel"/);
  assert.match(slide3, /name="Manufacturing Solution Process Step 1"/);
  assert.match(slide4, /name="Manufacturing Solution Process Step 1"/);
  assert.match(slide5, /name="Manufacturing Solution Dashboard Panel"/);
  assert.match(slide6, /name="Manufacturing Solution Value Card 1"/);
  assert.match(slide7, /name="Manufacturing Solution Roadmap Step 1"/);
  assert.doesNotMatch(slide1, /manufacturing-industry/);
});

test("PptExportService uses education industry solution decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "sales-industry-solution-education-industry",
      theme: "education-industry",
      templateVisual: {
        primary: "155E75",
        accent: "22C55E",
        background: "EAF7F7",
        surface: "FFFFFF",
        title: "0F2F3A",
        body: "365A64",
        layout: "sales-education-solution",
        variant: "education-industry",
      },
      slides: [
        { title: "教育信息化整体解决方案", bullets: ["统一教学平台建设", "学习数据分析闭环", "教育客户服务体系"] },
        { title: "教学与管理场景痛点", bullets: ["资源分散影响复用", "学习过程缺少洞察", "运营服务响应滞后"] },
        { title: "教学平台总体架构", bullets: ["课程资源", "教学互动", "学情分析", "运营服务"] },
        { title: "教学服务场景", bullets: ["教师备课", "学生学习", "管理决策"] },
        { title: "学习数据分析价值", bullets: ["活跃度提升", "完课率跟踪", "风险学生预警"] },
        { title: "项目实施路线", bullets: ["调研", "试点", "推广", "运营"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");
  const slide6 = pptPartText(text, "ppt/slides/slide6.xml");

  assert.match(slide1, /name="Education Solution Workspace"/);
  assert.match(slide1, /name="Education Solution Platform Panel"/);
  assert.match(slide3, /name="Education Solution Service Path 1"/);
  assert.match(slide4, /name="Education Solution Scenario Card 1"/);
  assert.match(slide5, /name="Education Solution Learning Data Panel"/);
  assert.match(slide6, /SERVICE ROADMAP/);
  assert.match(slide6, /name="Education Solution Platform Panel"/);
  assert.doesNotMatch(slide1, /education-industry/);
});

test("PptExportService uses commercial sales enterprise decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "sales-proposal", theme: "enterprise" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Sales Cover Hero Band"/);
  assert.match(slide1, /name="Sales Visual Panel"/);
  assert.match(slide1, /name="Sales enterprise Chip"/);
  assert.match(slide1, /name="Sales Account Card"/);
  assert.match(slide2, /name="Sales Content Anchor"/);
  assert.doesNotMatch(slide2, /name="Sales Cover Hero Band"/);
  assert.match(slide1, /val="14565A"/);
  assert.match(slide1, /val="D19A3E"/);
});

test("PptExportService uses commercial sales solution decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "sales-proposal", theme: "solution" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Sales Visual Panel"/);
  assert.match(slide1, /name="Sales solution Chip"/);
  assert.match(slide1, /name="Sales Solution Hub"/);
  assert.doesNotMatch(slide1, /name="Secondary Accent"/);
  assert.match(slide1, /val="1E4F76"/);
  assert.match(slide1, /val="39A7A0"/);
});

test("PptExportService uses commercial sales renewal decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "sales-proposal", theme: "renewal" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Sales Visual Panel"/);
  assert.match(slide1, /name="Sales renewal Chip"/);
  assert.match(slide1, /name="Sales Renewal Trend Line 1"/);
  assert.match(slide1, /name="Sales Renewal Dot 4"/);
  assert.doesNotMatch(slide1, /name="Sales Renewal Segment/);
  assert.match(slide1, /val="4B3F72"/);
  assert.match(slide1, /val="E0A33C"/);
});

test("PptExportService uses commercial product roadmap decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "product-roadmap", theme: "roadmap" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Product Cover Strategy Field"/);
  assert.match(slide1, /name="Product Visual Panel"/);
  assert.match(slide1, /name="Product roadmap Chip"/);
  assert.match(slide1, /name="Product Roadmap Node 4"/);
  assert.match(slide2, /name="Product Content Anchor"/);
  assert.doesNotMatch(slide2, /name="Product Cover Strategy Field"/);
  assert.doesNotMatch(slide1, /name="Secondary Accent"/);
  assert.match(slide1, /val="145A7A"/);
  assert.match(slide1, /val="2FB7A3"/);
});

test("PptExportService uses product pain points decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "product-product-requirement-analysis-user-pain-points",
      theme: "user-pain-points",
      templateVisual: {
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
      slides: [
        {
          title: "用户场景痛点与需求机会",
          bullets: ["目标用户在关键流程中频繁中断", "反馈证据集中在效率和理解成本", "机会点需要进入原型验证"],
        },
        {
          title: "核心用户场景路径",
          bullets: ["触发需求", "使用过程", "遇到阻碍", "产生诉求"],
        },
        {
          title: "痛点证据与影响",
          bullets: ["访谈反馈显示流程复杂", "行为数据出现高流失", "客服工单集中在同一问题"],
        },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");

  assert.match(slide1, /name="Product Pain Point Canvas"/);
  assert.match(slide1, /name="Product Pain Persona Panel"/);
  assert.match(slide3, /name="Product Pain Evidence Card 1"/);
  assert.doesNotMatch(slide1, /user-pain-points/);
});

test("PptExportService uses product release cadence decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "product-product-roadmap-release-cadence",
      theme: "release-cadence",
      templateVisual: {
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
      slides: [
        {
          title: "季度产品版本节奏规划",
          bullets: ["明确版本范围和关键功能包", "按季度节奏推进研发联调与验收", "跨团队同步发布窗口和风险依赖"],
        },
        {
          title: "Q2 到 Q4 版本发布波次",
          bullets: ["V1 完成基础能力", "V2 进入联调", "V3 发布增长能力", "V4 复盘迭代"],
        },
        {
          title: "跨团队协同泳道",
          bullets: ["产品范围冻结", "研发交付排期", "设计验收节点", "运营发布准备"],
        },
        {
          title: "版本风险与依赖",
          bullets: ["范围变更影响节奏", "联调依赖需要提前锁定", "发布窗口需统一确认", "资源冲突进入周会处理"],
        },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Product Cadence Canvas"/);
  assert.match(slide1, /name="Product Cadence Release Wave Panel"/);
  assert.match(slide3, /name="Product Cadence Team Lane 1"/);
  assert.match(slide4, /name="Product Cadence Risk Card 1"/);
  assert.doesNotMatch(slide1, /release-cadence/);
});

test("PptExportService uses feature priority value matrix decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "product-feature-priority-review-value-matrix",
      theme: "value-matrix",
      templateVisual: {
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
      slides: [
        {
          title: "功能优先级评审与取舍",
          bullets: ["高价值低成本功能进入立即投入", "高价值高成本需求拆分验证", "低价值高成本功能暂缓排期"],
        },
        {
          title: "功能价值成本矩阵",
          bullets: ["搜索增强提升核心转化", "报表导出成本可控", "消息提醒需要验证频次", "复杂自动化需拆分"],
        },
        {
          title: "评分排序与资源评估",
          bullets: ["用户价值 9 分", "商业价值 8 分", "研发成本中等", "风险依赖可控"],
        },
        {
          title: "资源分配与决策闭环",
          bullets: ["研发投入双周评审", "设计完成关键流程", "测试覆盖高价值功能", "运营准备灰度发布"],
        },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Feature Priority Canvas"/);
  assert.match(slide1, /name="Feature Priority Value Matrix Panel"/);
  assert.match(slide3, /name="Feature Priority Ranking Bar 1"/);
  assert.match(slide4, /name="Feature Priority Resource Card 1"|name="Feature Priority Next Action 1"/);
  assert.doesNotMatch(slide1, /value-matrix/);
});

test("PptExportService uses experience journey redesign decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "product-user-experience-redesign-experience-journey",
      theme: "experience-journey",
      templateVisual: {
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
      slides: [
        {
          title: "用户体验改版方案与旅程诊断",
          bullets: ["新用户进入路径存在信息断点", "核心操作流程步骤偏长", "关键转化前缺少信任说明"],
        },
        {
          title: "关键触点旅程梳理",
          bullets: ["首页认知触点不够清晰", "试用流程存在重复确认", "反馈入口位置不明显"],
        },
        {
          title: "体验断点与问题诊断",
          bullets: ["注册步骤导致流失", "权限说明理解成本高", "空状态缺少下一步引导", "反馈闭环不足"],
        },
        {
          title: "改版方案与验证路径",
          bullets: ["缩短关键路径", "强化信息层级", "补充原型验证", "灰度观察转化指标"],
        },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Experience Journey Canvas"/);
  assert.match(slide1, /name="Experience Journey Map Panel"/);
  assert.match(slide3, /name="Experience Journey Friction Card 1"/);
  assert.match(slide4, /name="Experience Journey Redesign Card 1"|name="Experience Journey Next Action 1"/);
  assert.doesNotMatch(slide1, /experience-journey/);
});

test("PptExportService uses capability radar comparison decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "product-competitive-feature-comparison-capability-radar",
      theme: "capability-radar",
      templateVisual: {
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
      slides: [
        {
          title: "竞品功能对比与能力差距判断",
          bullets: ["围绕核心场景拆解竞品功能能力", "比较我方与竞品在体验、效率和生态上的差异", "输出可进入路线规划的优先级建议"],
        },
        {
          title: "核心功能矩阵对比",
          bullets: ["我方基础能力覆盖完整", "竞品A在自动化效率上领先", "竞品B在生态连接上更成熟"],
        },
        {
          title: "能力雷达评分",
          bullets: ["体验完整度差距较小", "协同效率仍需补齐", "数据能力可形成差异化"],
        },
        {
          title: "差距诊断和路线输入",
          bullets: ["功能差距集中在智能化辅助", "用户影响体现在高频操作成本", "优先补齐影响转化的基础能力", "验证长期差异化机会点"],
        },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Capability Radar Canvas"/);
  assert.match(slide1, /name="Capability Radar Panel"/);
  assert.match(slide2, /name="Capability Radar Matrix Card 1"/);
  assert.match(slide4, /name="Capability Radar Gap Node 1"|name="Capability Radar Next Action 1"/);
  assert.doesNotMatch(slide1, /capability-radar/);
});

test("PptExportService uses commercial product release decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "product-roadmap", theme: "release" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Product Visual Panel"/);
  assert.match(slide1, /name="Product release Chip"/);
  assert.match(slide1, /name="Product Release Card 2"/);
  assert.match(slide1, /name="Product Release Milestone 3"/);
  assert.match(slide1, /val="3B4A8F"/);
  assert.match(slide1, /val="F2A65A"/);
});

test("PptExportService uses commercial product review decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "product-roadmap", theme: "product-review" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Product Visual Panel"/);
  assert.match(slide1, /name="Product product-review Chip"/);
  assert.match(slide1, /name="Product Review Ring Outer"/);
  assert.match(slide1, /name="Product Review Feedback Line 3"/);
  assert.match(slide1, /val="263D4A"/);
  assert.match(slide1, /val="E07A5F"/);
});

test("PptExportService uses commercial marketing launch decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "marketing-campaign", theme: "launch" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Marketing Cover Wash"/);
  assert.match(slide1, /name="Marketing Visual Panel"/);
  assert.match(slide1, /name="Marketing Launch Hero Card"/);
  assert.match(slide1, /name="Marketing Metric Card 1"/);
  assert.match(slide2, /name="Marketing Content Wash"/);
  assert.match(slide2, /name="Marketing Channel Card 1"/);
  assert.match(slide1, /val="E11D48"/);
  assert.match(slide1, /val="F59E0B"/);
});

test("PptExportService uses new product launch rhythm decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "marketing-new-product-launch-launch-rhythm",
      theme: "launch-rhythm",
      templateVisual: {
        primary: "101828",
        accent: "FF5A3D",
        background: "111827",
        surface: "FFFFFF",
        title: "FFFFFF",
        body: "D7DEE8",
        layout: "marketing-launch-rhythm",
        variant: "launch-rhythm",
      },
      slides: [
        { title: "新品上市首发计划", bullets: ["核心卖点确认", "渠道预热排期", "上市 KPI 对齐"] },
        { title: "上市节奏时间轴", bullets: ["T-30 预热启动", "T-14 内容种草", "T-7 渠道蓄水", "Launch 首发上线"] },
        { title: "渠道预热铺排", bullets: ["内容渠道", "社媒渠道", "销售渠道", "私域渠道"] },
        { title: "上市 KPI 看板", bullets: ["曝光目标", "预约目标", "转化目标", "成交目标"] },
        { title: "复盘增长动作", bullets: ["首发复盘", "增长优化", "渠道加码"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Launch Rhythm Dark Stage Background"/);
  assert.match(slide1, /name="Launch Rhythm Product Mockup"/);
  assert.match(slide2, /name="Launch Rhythm Timeline Card 1"/);
  assert.match(slide4, /name="Launch Rhythm KPI Panel"/);
  assert.doesNotMatch(slide1, /launch-rhythm/);
});

test("PptExportService uses commercial marketing brand decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "marketing-campaign", theme: "brand" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Marketing Visual Panel"/);
  assert.match(slide1, /name="Marketing Brand Circle A"/);
  assert.match(slide1, /name="Marketing Brand Circle B"/);
  assert.match(slide1, /name="Marketing Brand Signal"/);
  assert.match(slide1, /val="5B21B6"/);
  assert.match(slide1, /val="06B6D4"/);
});

test("PptExportService uses commercial marketing growth decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "marketing-campaign", theme: "growth" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Marketing Visual Panel"/);
  assert.match(slide1, /name="Marketing Growth Bar 1"/);
  assert.match(slide1, /name="Marketing Growth Arc"/);
  assert.match(slide1, /val="047857"/);
  assert.match(slide1, /val="F97316"/);
});

test("PptExportService keeps annual summary export text aligned with preview sizing", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      id: "annual-long-text",
      title: "年度经营总结",
      templateId: "annual-business-summary",
      templateName: "年度经营总结",
      theme: "blue-gold",
      templateVisual: {
        primary: "3159F6",
        accent: "39D5E8",
        background: "F7FBFF",
        surface: "FFFFFF",
        title: "052E7A",
        body: "1F4B83",
        layout: "annual-summary",
        variant: "blue-gold",
      },
      createdAt: "2026-07-02T10:20:00.000Z",
      slides: [
        {
          title: "年度经营复盘：收入增速放缓、利润承压与核心项目交付质量持续提升",
          bullets: [
            "总收入同比增长但低于年度目标，核心客户续费稳定，新客获取效率需要进一步优化",
            { text: "净利率受到原材料和交付成本影响，后续需要通过产品组合调整和流程改善释放利润空间" },
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
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Annual Summary Metric Card 1"/);
  assert.match(slide2, /name="Annual Summary Dashboard Header"/);
  const objectBulletText = Buffer.from("净利率受到原材料和交付成本影响", "utf8").toString("latin1");
  assert.match(slide1, new RegExp(objectBulletText));
  assert.doesNotMatch(slide1, /\[object Object\]/);
  assert.match(pptShapeByName(slide1, "Content 2"), /<a:rPr[^>]* sz="850"/);
  assert.match(pptShapeByName(slide2, "Content 2"), /<a:rPr[^>]* sz="780"/);
});

test("PptExportService uses quarterly action loop decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "quarterly-business-review",
      theme: "action-loop",
      templateVisual: {
        id: "quarterly-business-review",
        primary: "1F5FBF",
        accent: "1CC8A0",
        background: "F3F7FE",
        surface: "FFFFFF",
        title: "10233F",
        body: "40516C",
        layout: "quarterly-action-loop",
        variant: "action-loop",
      },
      slides: [
        { title: "季度业务复盘", bullets: ["明确下季度行动计划", "责任到人并按周追踪"] },
        { title: "重点行动拆解", bullets: ["行动项一：优化转化流程", "行动项二：补齐协同资源"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Quarterly Action Loop V2 Canvas"/);
  assert.match(slide1, /name="Quarterly Action Loop V2 Core Orbit A"/);
  assert.match(slide1, /name="Quarterly Action Loop V2 Task Card 1-1"/);
  assert.match(slide2, /name="Quarterly Action Loop V2 Owner Matrix 1"/);
  assert.match(slide2, /name="Quarterly Action Loop V2 Roadmap Arrow 1"/);
  assert.doesNotMatch(slide1, /行动闭环/);
});

test("PptExportService uses business opportunity map decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "business-business-growth-report-opportunity-map",
      theme: "opportunity-map",
      templateVisual: {
        id: "business-business-growth-report-opportunity-map",
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
      slides: [
        { title: "业务增长分析与突破路径", bullets: ["重点区域需求提升", "渠道转化存在改善空间", "关键动作需要形成闭环"] },
        { title: "市场机会识别与优先级", bullets: ["高潜客户集中在核心城市", "存量客户复购空间扩大", "新渠道线索成本下降"] },
        { title: "增长路径拆解与资源投入", bullets: ["先验证核心场景", "再扩大重点渠道", "最后沉淀复制打法"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");

  // 导出的 PPTX 也必须由可编辑形状绘制机会地图、指标卡和增长路径，不依赖整页背景图。
  assert.match(slide1, /name="Business Opportunity Map Panel"/);
  assert.match(slide1, /name="Business Opportunity Metric 1"/);
  assert.match(slide2, /name="Business Opportunity Map Panel"/);
  assert.match(slide3, /name="Business Opportunity Quadrant 1"/);
  assert.doesNotMatch(slide1, /机会地图/);
});

test("PptExportService keeps commercial template theme chips decorative", () => {
  const exporter = new PptExportService();
  const cases = [
    { templateId: "strategy-consulting", theme: "board", shapeName: "Strategy Chip Text" },
    { templateId: "financial-review", theme: "quarterly", shapeName: "Financial Chip Text" },
    { templateId: "sales-proposal", theme: "enterprise", shapeName: "Sales Chip Text" },
    { templateId: "product-roadmap", theme: "release", shapeName: "Product Chip Text" },
    { templateId: "marketing-campaign", theme: "launch", shapeName: "Marketing Chip Text" },
    { templateId: "data-insight", theme: "dashboard", shapeName: "Data Insight Chip Text" },
    { templateId: "education", theme: "lecture", shapeName: "Education Course Chip Text" },
    { templateId: "pitch", theme: "startup", shapeName: "Pitch Chip Text" },
  ];

  for (const item of cases) {
    const result = exporter.exportDeck({
      deck: { ...deck, templateId: item.templateId, theme: item.theme },
      format: "pptx",
    });
    const slide1 = pptPartText(result.content.toString("latin1"), "ppt/slides/slide1.xml");
    const chipTextShape = pptShapeByName(slide1, item.shapeName);

    // 主题风格只用于选择样式，不能作为页面上的可见角标文字写进 PPTX。
    assert.match(chipTextShape, /<a:t><\/a:t>/, `${item.templateId}/${item.theme} should render an empty decorative chip`);
  }
});

test("PptExportService uses commercial pitch startup decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "pitch", theme: "startup" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Pitch Stage Canvas"/);
  assert.match(slide1, /name="Pitch Founder Story Sheet"/);
  assert.match(slide1, /name="Pitch Stage Spotlight"/);
  assert.match(slide1, /name="Pitch Visual Panel"/);
  assert.match(slide1, /name="Pitch Story Founder Card"/);
  assert.match(slide1, /name="Pitch Metric Card 1"/);
  assert.match(slide2, /name="Pitch Memo Board"/);
  assert.match(slide2, /name="Pitch Investor Memo Sheet"/);
  assert.match(slide2, /name="Pitch Memo Side Ledger"/);
  assert.match(slide2, /name="Pitch Proof Card 1"/);
  assert.match(slide1, /val="16213E"/);
  assert.match(slide1, /val="F59E0B"/);
});

test("PptExportService uses commercial pitch investor decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "pitch", theme: "investor" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Pitch Stage Canvas"/);
  assert.match(slide1, /name="Pitch Visual Panel"/);
  assert.match(slide1, /name="Pitch Investor Bar 1"/);
  assert.match(slide1, /name="Pitch Investor Market Dot"/);
  assert.match(slide1, /val="0F2D3A"/);
  assert.match(slide1, /val="19A0A5"/);
});

test("PptExportService uses commercial pitch product decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "pitch", theme: "product" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Pitch Stage Canvas"/);
  assert.match(slide1, /name="Pitch Visual Panel"/);
  assert.match(slide1, /name="Pitch Product Screen"/);
  assert.match(slide1, /name="Pitch Product Glow"/);
  assert.match(slide1, /val="3B1D5A"/);
  assert.match(slide1, /val="E879F9"/);
});

test("PptExportService uses business plan model decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "pitch-business-plan-business-model",
      theme: "business-model",
      templateVisual: {
        id: "pitch-business-plan-business-model",
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
      slides: [
        { title: "融资增长计划", bullets: ["用一页讲清客户、价值、收入和增长闭环"] },
        { title: "商业画布总览", bullets: ["客户群体", "价值主张", "渠道路径", "关键资源"] },
        { title: "收入模型", bullets: ["获客", "转化", "付费", "复购"] },
        { title: "生态网络", bullets: ["客户", "渠道", "数据", "伙伴"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Business Model BP Canvas"/);
  assert.match(slide1, /name="Business Model Product Mockup"/);
  assert.match(slide1, /name="Business Model Metric Card 1"/);
  assert.match(slide2, /name="Business Canvas Cell 1"/);
  assert.match(slide3, /name="Business Revenue Step 1"/);
  assert.match(slide4, /name="Business Ecosystem Platform"/);
  assert.doesNotMatch(slide1, /business-model/);
});

test("PptExportService uses seed round startup story decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "pitch-seed-round-pitch-startup-story",
      theme: "startup-story",
      templateVisual: {
        id: "pitch-seed-round-pitch-startup-story",
        primary: "172033",
        accent: "F97316",
        background: "F6F4EF",
        surface: "FFFFFF",
        title: "172033",
        body: "465266",
        layout: "seed-round-story",
        variant: "startup-story",
      },
      slides: [
        { title: "种子轮融资计划", bullets: ["真实用户痛点已经被反复验证", "MVP retention plan visible", "早期增长信号支持种子轮融资"] },
        { title: "痛点发现", bullets: ["高频场景", "强烈付费意愿", "替代方案低效"] },
        { title: "MVP 验证", bullets: ["核心路径", "首批客户", "体验指标"] },
        { title: "早期增长", bullets: ["用户增长", "留存改善", "转介绍"] },
        { title: "团队能力", bullets: ["行业洞察", "产品交付", "增长经验"] },
        { title: "融资计划", bullets: ["资金用途", "18个月里程碑", "核心招聘"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide6 = pptPartText(text, "ppt/slides/slide6.xml");

  assert.match(slide1, /name="Seed Round Story Canvas"/);
  assert.match(slide1, /name="Seed Round Content Panel"/);
  assert.match(slide1, /name="Seed Round Planned Content"/);
  assert.match(slide1, /name="Seed Round MVP Mockup"/);
  assert.match(slide1, /name="Seed Round Storyline"/);
  assert.match(slide1, /MVP retention plan visible/);
  assert.match(slide2, /name="Seed Round Pain Evidence 1"/);
  assert.match(slide3, /name="Seed Round MVP Board"/);
  assert.match(slide4, /name="Seed Round Traction Chart"/);
  assert.match(slide6, /name="Seed Round Funding Road"/);
  assert.doesNotMatch(slide1, /startup-story/);
});

test("PptExportService uses growth funding flywheel decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "pitch-growth-funding-pitch-growth-flywheel",
      theme: "growth-flywheel",
      templateVisual: {
        id: "pitch-growth-funding-pitch-growth-flywheel",
        primary: "0B1220",
        accent: "22C55E",
        background: "EAF1F8",
        surface: "FFFFFF",
        title: "0F172A",
        body: "334155",
        layout: "growth-funding-flywheel",
        variant: "growth-flywheel",
      },
      slides: [
        { title: "A/B 轮增长融资计划", bullets: ["ARR 增长和留存指标证明增长飞轮有效", "LTV/CAC 已经进入可规模化区间", "融资用于放大获客、产品和区域扩张"] },
        { title: "增长飞轮模型", bullets: ["获客效率提升", "激活转化稳定", "留存扩张增强", "收入模型验证"] },
        { title: "商业化进展复盘", bullets: ["收入结构改善", "客户分层清晰", "复购扩张增强"] },
        { title: "增长数据证明", bullets: ["留存曲线稳定", "转化漏斗清晰", "CAC 回收周期缩短", "收入扩张可预测"] },
        { title: "扩张计划", bullets: ["核心市场加速", "渠道模型复制", "产品能力升级", "区域扩张推进"] },
        { title: "资金用途与里程碑", bullets: ["产品研发", "增长投放", "团队建设", "商业化验证"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");

  assert.match(slide1, /name="Growth Funding Content Surface"/);
  assert.match(slide1, /name="Growth Funding Flywheel Halo"/);
  assert.match(slide1, /name="Growth Funding Metric Card 1"/);
  assert.match(slide1, /name="Growth Funding Planned Content"/);
  assert.match(slide1, /ARR/);
  assert.match(slide2, /name="Growth Funding Flywheel Node 1"/);
  assert.match(slide3, /name="Growth Funding Proof Card 1"|name="Growth Funding Data Dashboard"/);
  assert.match(slide4, /name="Growth Funding Proof Card 1"|name="Growth Funding Data Dashboard"/);
  assert.match(slide5, /name="Growth Funding Roadmap Node 1"/);
  assert.doesNotMatch(slide1, /growth-flywheel/);
});

test("PptExportService uses product funding highlights decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "pitch-product-funding-pitch-product-highlights",
      theme: "product-highlights",
      templateVisual: {
        id: "pitch-product-funding-pitch-product-highlights",
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
      slides: [
        { title: "Product funding demo", bullets: ["Product console proves investor value", "Technical moat is visible", "User value can be measured"] },
        { title: "Capability map", bullets: ["Workflow automation", "AI orchestration", "Data asset", "Open API"] },
        { title: "Demo flow", bullets: ["Input goal", "Analyze context", "Recommend actions", "Export result"] },
        { title: "Technical advantage", bullets: ["Data layer", "Model routing", "Workflow engine", "Integration layer"] },
        { title: "User value journey", bullets: ["Pain point", "Product intervention", "Efficiency gain", "Business result"] },
        { title: "Market validation", bullets: ["Retention", "Activation", "Conversion", "Case proof"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");

  assert.match(slide1, /name="Product Funding Content Surface"/);
  assert.match(slide1, /name="Product Funding Demo Console"/);
  assert.match(slide1, /name="Product Funding Product Mockup"/);
  assert.match(slide1, /name="Product Funding Planned Content"/);
  assert.match(slide2, /name="Product Funding Capability Card 1"/);
  assert.match(slide4, /name="Product Funding Technical Chain 1"/);
  assert.match(slide5, /name="Product Funding Value Journey Node 1"/);
  assert.doesNotMatch(slide1, /product-highlights/);
});

test("PptExportService uses investor update progress sync decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "pitch-investor-update-report-progress-sync",
      theme: "progress-sync",
      templateVisual: {
        id: "pitch-investor-update-report-progress-sync",
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
      slides: [
        { title: "Investor monthly update", bullets: ["MRR continued to improve", "Retention remained stable", "Runway is fourteen months"] },
        { title: "Progress briefing", bullets: ["Product shipped new workflow", "Sales pipeline expanded", "Team hiring is on track"] },
        { title: "Metrics disclosure", bullets: ["Revenue growth", "Retention quality", "Cash burn", "Pipeline"] },
        { title: "Operating timeline", bullets: ["Product iteration", "Sales progress", "Team building", "Finance cadence"] },
        { title: "Risks and asks", bullets: ["Delivery risk", "Hiring gap", "Customer intro", "Financing preparation"] },
        { title: "Next plan", bullets: ["30 day risk fix", "60 day growth validation", "90 day financing materials"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");

  assert.match(slide1, /name="Investor Update Content Surface"/);
  assert.match(slide1, /name="Investor Update KPI Dashboard"/);
  assert.match(slide1, /name="Investor Update Metric Card 1"/);
  assert.match(slide1, /name="Investor Update Planned Content"/);
  assert.match(slide2, /name="Investor Update Progress Card 1"/);
  assert.match(slide4, /name="Investor Update Operating Lane 1"/);
  assert.match(slide5, /name="Investor Update Risk Ask Card 1"/);
  assert.doesNotMatch(slide1, /progress-sync/);
});

test("PptExportService uses BI executive cockpit decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "data-bi-dashboard-executive-cockpit",
      theme: "executive-cockpit",
      templateVisual: {
        id: "data-bi-dashboard-executive-cockpit",
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
      slides: [
        { title: "经营数据总览", bullets: ["收入 1.2 亿达成率 92%", "利润率 18%", "风险 3 项"] },
        { title: "趋势变化监控", bullets: ["收入环比增长 12%", "利润改善 3%", "成本下降 5%"] },
        { title: "部门表现排行", bullets: ["华东区域领先", "渠道贡献提升", "客户留存稳定"] },
        { title: "异常指标预警", bullets: ["回款周期延长", "费用率抬升", "库存周转放缓"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="BI Cockpit Main Console"/);
  assert.match(slide1, /name="BI Cockpit Gauge Panel"/);
  assert.match(slide1, /name="BI Cockpit KPI Card 1"/);
  assert.match(slide2, /name="BI Cockpit Trend Panel"/);
  assert.match(slide3, /name="BI Cockpit Ranking Row 1"/);
  assert.match(slide4, /name="BI Cockpit Alert Card 1"/);
  assert.match(slide1, /val="08111F"/);
  assert.match(slide1, /val="22D3EE"/);
  assert.doesNotMatch(slide1, /管理驾驶舱/);
});

test("PptExportService uses user behavior path funnel decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "data-user-behavior-analysis-path-funnel",
      theme: "path-funnel",
      templateVisual: {
        id: "data-user-behavior-analysis-path-funnel",
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
      slides: [
        { title: "用户转化路径复盘", bullets: ["访问用户 12.8K 进入核心功能", "关键转化率 38%", "实验提升 +12%"] },
        { title: "路径节点总览", bullets: ["访问入口", "功能浏览", "提交试用", "留存回访"] },
        { title: "流失断点诊断", bullets: ["激活步骤转化率下降 24%", "表单耗时偏长", "权益说明不清晰"] },
        { title: "增长实验复盘", bullets: ["新手引导 A 版", "权益提示 B 版", "样本覆盖 5 千"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="User Path Analysis Canvas"/);
  assert.match(slide1, /name="User Path Route Panel"/);
  assert.match(slide1, /name="User Path Node 1"/);
  assert.match(slide1, /name="User Path Metric Card 1"/);
  assert.match(slide3, /name="User Path Funnel Step 1"/);
  assert.match(slide4, /name="User Path Experiment Card 1"/);
  assert.match(slide1, /val="F6FAFF"/);
  assert.match(slide1, /val="06B6D4"/);
  assert.doesNotMatch(slide1, /路径漏斗/);
});

test("PptExportService uses market trend radar decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "data-market-trend-insight-trend-radar",
      theme: "trend-radar",
      templateVisual: {
        id: "data-market-trend-insight-trend-radar",
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
      slides: [
        { title: "市场机会趋势分析", bullets: ["行业需求 CAGR 18% 持续提升", "机会窗口 3 个垂直场景", "竞争格局变化 +12%"] },
        { title: "趋势信号总览", bullets: ["需求升温", "技术拐点", "渠道迁移", "供给重构"] },
        { title: "机会窗口判断", bullets: ["高增长低渗透", "进入门槛提升", "客户预算释放"] },
        { title: "竞争格局变化", bullets: ["头部厂商调价", "新进入者加速", "渠道资源重分配"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Market Trend Console"/);
  assert.match(slide1, /name="Market Trend Radar Panel"/);
  assert.match(slide1, /name="Market Trend Signal Dot A"/);
  assert.match(slide1, /name="Market Trend KPI Card 1"/);
  assert.match(slide3, /name="Market Trend Opportunity Matrix"/);
  assert.match(slide4, /name="Market Trend Competitor Lane 1"/);
  assert.match(slide1, /val="050B18"/);
  assert.match(slide1, /val="38BDF8"/);
  assert.doesNotMatch(slide1, /趋势雷达/);
});

test("PptExportService uses customer segmentation layering decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "data-customer-segmentation-persona-layering",
      theme: "persona-layering",
      templateVisual: {
        id: "data-customer-segmentation-persona-layering",
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
      slides: [
        { title: "客户分群画像分析", layout: "customer-segmentation-layering-cover", bullets: ["高价值客户 24K", "核心客群 4 类", "复购提升 18%"] },
        { title: "分层结构总览", layout: "customer-segmentation-layering-overview", bullets: ["高价值客户", "成长潜力客群", "价格敏感人群", "沉睡风险人群"] },
        { title: "典型画像拆解", layout: "customer-segmentation-layering-persona", bullets: ["身份标签", "行为偏好", "消费频次", "触达策略"] },
        { title: "RFM 价值矩阵", layout: "customer-segmentation-layering-analysis", bullets: ["高价值高频", "高潜低频", "价格敏感", "沉睡风险"] },
        { title: "精准运营策略", layout: "customer-segmentation-layering-strategy", bullets: ["权益匹配", "渠道触达", "内容推荐", "转化目标"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");

  assert.match(slide1, /name="Customer Segmentation Canvas"/);
  assert.match(slide1, /name="Customer Segmentation Pyramid Panel"/);
  assert.match(slide1, /name="Customer Segmentation KPI Card 1"/);
  assert.match(slide3, /name="Customer Persona Card 1"/);
  assert.match(slide4, /name="Customer Segmentation RFM Matrix"/);
  assert.match(slide5, /name="Customer Segmentation Strategy Table"/);
  assert.match(slide1, /val="F6FAFC"/);
  assert.match(slide1, /val="14B8A6"/);
  assert.doesNotMatch(slide1, /人群分层/);
});

test("PptExportService uses metric anomaly attribution decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "data-metric-anomaly-diagnosis-attribution-analysis",
      theme: "attribution-analysis",
      templateVisual: {
        id: "data-metric-anomaly-diagnosis-attribution-analysis",
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
      slides: [
        { title: "指标异常诊断复盘", layout: "metric-anomaly-attribution-cover", bullets: ["GMV 环比下降 18.6%", "影响 3 条关键链路", "修复优先级 P1"] },
        { title: "阈值波动概览", layout: "metric-anomaly-attribution-overview", bullets: ["流量入口低于阈值", "转化效率连续 3 日下滑", "客单结构偏离预期"] },
        { title: "根因归因网络", layout: "metric-anomaly-attribution-diagnosis", bullets: ["投放质量下降", "价格敏感用户增加", "履约时效波动", "客服响应滞后"] },
        { title: "影响范围矩阵", layout: "metric-anomaly-attribution-impact", bullets: ["高影响高紧急", "持续时间 72 小时", "责任模块明确", "业务损失可控"] },
        { title: "修复动作闭环", layout: "metric-anomaly-attribution-action", bullets: ["立即止损", "短期修复", "长期治理", "监控复盘"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");
  const slide5 = pptPartText(text, "ppt/slides/slide5.xml");

  assert.match(slide1, /name="Metric Anomaly Diagnosis Canvas"/);
  assert.match(slide1, /name="Metric Anomaly Wave Panel"/);
  assert.match(slide1, /name="Metric Anomaly KPI Card 1"/);
  assert.match(slide3, /name="Metric Anomaly Cause Network Panel"/);
  assert.match(slide4, /name="Metric Anomaly Impact Matrix"/);
  assert.match(slide5, /name="Metric Anomaly Fix Loop"/);
  assert.match(slide1, /val="F4F8FB"/);
  assert.match(slide1, /val="06B6D4"/);
  assert.doesNotMatch(slide1, /归因分析/);
});

test("PptExportService uses editorial brand story decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "brand-story", theme: "editorial" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Brand Story Cover Canvas"/);
  assert.match(slide1, /name="Brand Story Image Panel"/);
  assert.match(slide1, /name="Brand Story editorial Chip"/);
  assert.match(slide1, /name="Brand Story Editorial Photo Tone"/);
  assert.match(slide1, /name="Brand Story Point Card 1"/);
  assert.match(slide2, /name="Brand Story Content Canvas"/);
  assert.match(slide2, /name="Brand Story Index Card 1"/);
  assert.match(slide1, /val="2A2F3F"/);
  assert.match(slide1, /val="C7825A"/);
});

test("PptExportService uses premium brand story decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "brand-story", theme: "premium" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Brand Story Image Panel"/);
  assert.match(slide1, /name="Brand Story premium Chip"/);
  assert.match(slide1, /name="Brand Story Premium Texture Block"/);
  assert.match(slide1, /name="Brand Story Premium Gold Slab"/);
  assert.match(slide1, /val="181C24"/);
  assert.match(slide1, /val="BFA06A"/);
});

test("PptExportService uses identity brand story decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "brand-story", theme: "identity" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Brand Story Image Panel"/);
  assert.match(slide1, /name="Brand Story identity Chip"/);
  assert.match(slide1, /name="Brand Story Identity Symbol Core"/);
  assert.match(slide1, /name="Brand Story Identity Orbit"/);
  assert.match(slide1, /val="123D4A"/);
  assert.match(slide1, /val="E56F4F"/);
});

test("PptExportService uses dashboard data insight decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "data-insight", theme: "dashboard" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Data Insight Cover Dashboard Canvas"/);
  assert.match(slide1, /name="Data Insight Visual Panel"/);
  assert.match(slide1, /name="Data Insight dashboard Chip"/);
  assert.match(slide1, /name="Data Insight Dashboard Bar 1"/);
  assert.match(slide1, /name="Data Insight Metric Card 1"/);
  assert.match(slide2, /name="Data Insight Content Analysis Canvas"/);
  assert.match(slide2, /name="Data Insight Signal Card 1"/);
  assert.match(slide1, /val="123B63"/);
  assert.match(slide1, /val="18A0A6"/);
});

test("PptExportService uses insight analysis data insight decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "data-insight", theme: "insight" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Data Insight Visual Panel"/);
  assert.match(slide1, /name="Data Insight insight Chip"/);
  assert.match(slide1, /name="Data Insight Magnifier Ring"/);
  assert.match(slide1, /name="Data Insight Finding Curve"/);
  assert.match(slide1, /val="273C75"/);
  assert.match(slide1, /val="F6A623"/);
});

test("PptExportService uses research report data insight decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "data-insight", theme: "research" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Data Insight Visual Panel"/);
  assert.match(slide1, /name="Data Insight research Chip"/);
  assert.match(slide1, /name="Data Insight Research Evidence Line 1"/);
  assert.match(slide1, /name="Data Insight Research Quote Card"/);
  assert.match(slide1, /val="2F3A4A"/);
  assert.match(slide1, /val="7C9A92"/);
});

test("PptExportService reuses dome visual assets and page layout roles for red-gold PPTX output", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "年度工作汇报",
      templateId: "business",
      theme: "modern",
      templateVisual: DOME_VISUAL,
      slides: [
        { title: "年度工作汇报", bullets: ["2026 年度经营复盘"] },
        { title: "目录", bullets: ["工作汇报", "成果展示"], layout: "agenda" },
        { title: "工作汇报", bullets: ["PART 01"], layout: "section-divider" },
        { title: "年度工作概况", bullets: ["核心目标达成情况", "关键业务指标完成率", "团队协作与资源投入概况"], layout: "image-report" },
        { title: "下步计划", bullets: ["目标拆解", "资源配置", "执行跟踪", "复盘优化"], layout: "four-steps" },
        { title: "汇报结束", bullets: ["感谢观看"], layout: "closing" },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const utf8Text = result.content.toString("utf8");

  assert.match(text, /ppt\/media\/dome-cover\.jpg/);
  assert.match(text, /ppt\/media\/dome-content\.jpg/);
  assert.match(text, /Target="\.\.\/media\/dome-cover\.jpg"/);
  assert.match(text, /Target="\.\.\/media\/dome-content\.jpg"/);
  assert.match(text, /<p:sldSz cx="12192000" cy="6858000"\/>/);
  assert.match(text, /name="Dome Cover Sailboat Background"[\s\S]*<a:ext cx="12192000" cy="6858000"\/>/);
  assert.match(text, /<a:fontScheme name="588ku">/);
  assert.match(text, /<a:latin typeface="Arial Black"\/>/);
  assert.match(text, /typeface="Source Han Sans CN Heavy"/);
  assert.match(
    text,
    /name="Dome Cover Title"[\s\S]*<a:gradFill>[\s\S]*<a:srgbClr val="[0-9A-Fa-f]{6}"\/>[\s\S]*<a:srgbClr val="[0-9A-Fa-f]{6}"\/>/,
  );
  assert.match(text, /name="Dome Cover Sailboat Background"/);
  assert.match(utf8Text, /name="Dome Cover Subtitle"[\s\S]*<a:t>2026 年度经营复盘<\/a:t>/);
  assert.match(text, /name="Dome Agenda Card 1"/);
  assert.match(text, /name="Dome Agenda Card 4"/);
  assert.match(text, /name="Dome Agenda Number 1"[\s\S]*<a:t>01<\/a:t>/);
  assert.match(text, /name="Dome Agenda Number 4"[\s\S]*<a:t>04<\/a:t>/);
  assert.match(utf8Text, /name="Dome Agenda Text 3"[\s\S]*<a:t>问题不足<\/a:t>/);
  assert.match(utf8Text, /name="Dome Agenda Text 4"[\s\S]*<a:t>下步计划<\/a:t>/);
  assert.match(text, /name="Dome Section Number"/);
  assert.match(text, /name="Dome Image Placeholder"/);
  assert.match(utf8Text, /name="Section Label"(?:(?!<\/p:sp>).)*<a:t>PART 03<\/a:t>/s);
  const slide4Title = utf8Text.match(/ppt\/slides\/slide4\.xml<\?xml[\s\S]*?name="Dome Content Title"[\s\S]*?<\/p:sp>/)?.[0] || "";
  assert.match(slide4Title, /<a:solidFill><a:srgbClr val="0F2945"\/><\/a:solidFill>/);
  assert.doesNotMatch(slide4Title, /<a:gradFill>/);
  assert.match(text, /name="Dome Step 4"/);
  assert.match(text, /name="Dome Closing Mark"/);
});

test("PptExportService maps structured dome roles to business image and data placeholders", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "经营复盘",
      templateId: "business",
      theme: "modern",
      templateVisual: DOME_VISUAL,
      slides: [
        { title: "封面", bullets: ["年度汇报"], layout: "cover" },
        { title: "目录", bullets: ["工作汇报", "成果展示", "问题不足", "下步计划"], layout: "agenda" },
        { title: "第一章", bullets: ["PART 01"], layout: "section-divider" },
        { title: "工作汇报图文页", bullets: ["Business progress", "Team investment", "Key result"], layout: "image-report" },
        { title: "三步骤流程", bullets: ["Discovery", "Planning", "Launch"], layout: "three-steps" },
        { title: "四步骤流程", bullets: ["Target split", "Resource plan", "Process tracking", "Review loop"], layout: "four-steps" },
        { title: "数据指标", bullets: ["Revenue growth: 32%", "Retention rate: 88%", "Delivery speed: 2.4d"], layout: "metrics" },
        { title: "成果展示", bullets: ["Project wins", "Client feedback", "Team awards"], layout: "showcase", sectionLabel: "PART 02" },
        { title: "问题复盘", bullets: ["Risk signal", "Root cause", "Mitigation"], layout: "retrospective" },
        { title: "下一步计划", bullets: ["Q1: Quarter roadmap", "Q2: Key action", "Q3: Owner review"], layout: "next-plan" },
        { title: "汇报结束", bullets: ["感谢观看"], layout: "closing" },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const utf8Text = result.content.toString("utf8");
  const coverSlide = pptPartText(text, "ppt/slides/slide1.xml");
  const threeStepsSlide = pptPartText(text, "ppt/slides/slide5.xml");
  const fourStepsSlide = pptPartText(text, "ppt/slides/slide6.xml");
  const metricsSlide = pptPartText(text, "ppt/slides/slide7.xml");
  const nextPlanSlide = pptPartText(text, "ppt/slides/slide10.xml");

  assert.match(text, /ppt\/media\/dome-business-1\.jpeg/);
  assert.match(text, /ppt\/media\/dome-business-2\.jpeg/);
  assert.match(text, /Target="\.\.\/media\/dome-business-1\.jpeg"/);
  assert.match(text, /Target="\.\.\/media\/dome-business-2\.jpeg"/);
  assert.match(text, /ppt\/slides\/_rels\/slide5\.xml\.rels[\s\S]*Target="\.\.\/media\/dome-business-3\.jpeg"/);
  assert.match(text, /Target="\.\.\/media\/dome-business-4\.jpeg"/);
  assert.match(text, /name="Dome Business Image"/);
  assert.match(utf8Text, /name="Dome Cover Subtitle"[\s\S]*<a:t>年度汇报<\/a:t>/);
  assert.match(coverSlide, /name="Dome Cover Title"/);
  assert.match(text, /name="Dome Image Report Card 3"/);
  assert.match(text, /name="Dome Image Report Text 2"[\s\S]*<a:t>Team investment<\/a:t>/);
  assert.match(text, /name="Dome Section Number"(?:(?!<\/p:sp>).)*<a:t>PART 01<\/a:t>/s);
  assert.match(text, /name="Dome Step 3"/);
  assert.match(threeStepsSlide, /name="Dome Content Title"/);
  assert.match(threeStepsSlide, /name="Dome Three Steps Image"/);
  assert.match(text, /name="Dome Step 4"/);
  assert.match(text, /name="Dome Step Connector 3"/);
  assert.match(text, /name="Dome Step Connector 4"/);
  assert.match(text, /name="Dome Four Steps Image"/);
  assert.match(text, /name="Dome Step Text 1"[\s\S]*<a:t>Discovery<\/a:t>/);
  assert.match(text, /name="Dome Step Text 4"[\s\S]*<a:t>Review loop<\/a:t>/);
  assert.match(text, /ppt\/slides\/slide5\.xml<\?xml[\s\S]*name="Section Label"(?:(?!<\/p:sp>).)*<a:t>PART 04<\/a:t>/s);
  assert.match(text, /ppt\/slides\/slide6\.xml<\?xml[\s\S]*name="Section Label"(?:(?!<\/p:sp>).)*<a:t>PART 05<\/a:t>/s);
  assert.match(threeStepsSlide, /name="Content Placement Card"/);
  assert.match(fourStepsSlide, /name="Content Placement Card"/);
  assert.doesNotMatch(threeStepsSlide, /name="Content 2"/);
  assert.doesNotMatch(fourStepsSlide, /name="Content 2"/);
  assert.equal((text.match(/<a:t>Discovery<\/a:t>/g) || []).length, 1);
  assert.equal((text.match(/<a:t>Retention rate<\/a:t>/g) || []).length, 1);
  assert.match(text, /name="Dome Metric Card 3"/);
  assert.match(text, /name="Dome Metric Value 2"[\s\S]*<a:t>88%<\/a:t>/);
  assert.match(text, /name="Dome Metric Label 2"[\s\S]*<a:t>Retention rate<\/a:t>/);
  assert.match(text, /ppt\/slides\/slide7\.xml<\?xml[\s\S]*name="Section Label"(?:(?!<\/p:sp>).)*<a:t>PART 06<\/a:t>/s);
  assert.match(metricsSlide, /name="Content Placement Card"/);
  assert.doesNotMatch(metricsSlide, /name="Content 2"/);
  assert.match(text, /name="Dome Showcase Image"/);
  assert.match(text, /name="Section Label"(?:(?!<\/p:sp>).)*<a:t>PART 02<\/a:t>/s);
  assert.match(text, /name="Dome Showcase Card 3"/);
  assert.match(text, /name="Dome Showcase Number 1"[\s\S]*<a:t>01<\/a:t>/);
  assert.match(text, /name="Dome Showcase Number 3"[\s\S]*<a:t>03<\/a:t>/);
  assert.match(text, /name="Dome Showcase Text 2"[\s\S]*<a:t>Client feedback<\/a:t>/);
  assert.match(text, /name="Dome Retrospective Risk Card"/);
  assert.match(text, /name="Dome Retrospective Risk Text"[\s\S]*<a:t>Risk signal<\/a:t>/);
  assert.match(text, /name="Dome Retrospective Card 3"/);
  assert.match(utf8Text, /name="Dome Retrospective Label 1"[\s\S]*<a:t>风险<\/a:t>/);
  assert.match(utf8Text, /name="Dome Retrospective Label 2"[\s\S]*<a:t>原因<\/a:t>/);
  assert.match(utf8Text, /name="Dome Retrospective Label 3"[\s\S]*<a:t>措施<\/a:t>/);
  assert.match(text, /name="Dome Retrospective Text 2"[\s\S]*<a:t>Root cause<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Timeline"/);
  assert.match(text, /name="Dome Next Plan Image"/);
  assert.match(text, /name="Dome Next Plan Phase 1"[\s\S]*<a:t>Q1<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Action 1"[\s\S]*<a:t>Quarter roadmap<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Phase 3"[\s\S]*<a:t>Q3<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Action 3"[\s\S]*<a:t>Owner review<\/a:t>/);
  assert.match(text, /ppt\/slides\/slide10\.xml<\?xml[\s\S]*name="Section Label"(?:(?!<\/p:sp>).)*<a:t>PART 09<\/a:t>/s);
  assert.match(nextPlanSlide, /name="Content Placement Card"/);
  assert.doesNotMatch(nextPlanSlide, /name="Content 2"/);
  assert.match(text, /name="Dome Closing Subtitle"/);
});

test("PptExportService fills dome placeholders from object structured bullets", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "对象结构内容",
      templateId: "business",
      theme: "modern",
      templateVisual: DOME_VISUAL,
      slides: [
        { title: "封面", bullets: ["年度汇报"], layout: "cover" },
        { title: "数据指标", bullets: [{ label: "复购率", value: "76%" }, { name: "交付周期", amount: "5d" }], layout: "metrics" },
        { title: "下一步计划", bullets: [{ phase: "Q1", action: "完成样板客户" }, { stage: "Q2", task: "扩展行业方案" }], layout: "next-plan" },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("utf8");

  assert.match(text, /name="Dome Metric Value 1"[\s\S]*<a:t>76%<\/a:t>/);
  assert.match(text, /name="Dome Metric Label 1"[\s\S]*<a:t>复购率<\/a:t>/);
  assert.match(text, /name="Dome Metric Value 2"[\s\S]*<a:t>5d<\/a:t>/);
  assert.match(text, /name="Dome Metric Label 2"[\s\S]*<a:t>交付周期<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Phase 1"[\s\S]*<a:t>Q1<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Action 1"[\s\S]*<a:t>完成样板客户<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Phase 2"[\s\S]*<a:t>Q2<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Action 2"[\s\S]*<a:t>扩展行业方案<\/a:t>/);
  assert.doesNotMatch(text, /\[object Object\]/);
});

test("PptExportService respects an explicit dome cover layout on any slide", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "显式封面",
      templateId: "business",
      theme: "modern",
      templateVisual: DOME_VISUAL,
      slides: [
        { title: "工作汇报图文页", bullets: ["Progress"], layout: "image-report" },
        { title: "追加封面", bullets: ["Manual cover"], layout: "cover" },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");

  assert.match(text, /ppt\/slides\/_rels\/slide2\.xml\.rels[\s\S]*Target="\.\.\/media\/dome-cover\.jpg"/);
  assert.match(text, /ppt\/slides\/slide2\.xml[\s\S]*name="Dome Cover Sailboat Background"/);
});

test("PptExportService uses the sailboat background for dome closing slides", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "结束页背景",
      templateId: "business",
      theme: "modern",
      templateVisual: DOME_VISUAL,
      slides: [
        { title: "工作汇报图文页", bullets: ["Progress"], layout: "image-report" },
        { title: "汇报结束", bullets: ["感谢观看"], layout: "closing" },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");

  assert.match(text, /ppt\/slides\/_rels\/slide2\.xml\.rels[\s\S]*Target="\.\.\/media\/dome-cover\.jpg"/);
  assert.match(text, /ppt\/slides\/slide2\.xml[\s\S]*name="Dome Cover Sailboat Background"/);
  assert.match(text, /ppt\/slides\/slide2\.xml[\s\S]*name="Dome Closing Mark"/);
});

test("PptExportService fills a default dome section number when omitted", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "默认章节编号",
      templateId: "business",
      theme: "modern",
      templateVisual: DOME_VISUAL,
      slides: [
        { title: "封面", bullets: ["年度汇报"], layout: "cover" },
        { title: "第一章", bullets: [], layout: "section-divider" },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("utf8");

  assert.match(text, /ppt\/slides\/slide2\.xml[\s\S]*name="Dome Section Number"(?:(?!<\/p:sp>).)*<a:t>PART 01<\/a:t>/s);
});

test("PptExportService infers image-report role from work summary titles", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "隐式工作概况",
      templateId: "business",
      theme: "modern",
      templateVisual: DOME_VISUAL,
      slides: [
        { title: "封面", bullets: ["年度汇报"] },
        { title: "年度工作概况", bullets: ["业务进展", "团队投入", "关键成果"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");

  assert.match(text, /ppt\/slides\/slide2\.xml[\s\S]*name="Dome Image Report Card 1"/);
  assert.doesNotMatch(text, /ppt\/slides\/slide2\.xml[\s\S]*name="Dome Step 1"/);
});

test("PptExportService uses education lecture course decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "education", theme: "lecture" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");

  assert.match(slide1, /name="Education Course Cover Canvas"/);
  assert.match(slide1, /name="Education Course Board Surface"/);
  assert.match(slide1, /name="Education Course Outcome Card 1"/);
  assert.match(slide2, /name="Education Course Content Canvas"/);
  assert.match(slide2, /name="Education Course Note Card 1"/);
});

test("PptExportService uses education workshop course decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "education", theme: "workshop" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Education Course Sticky Note 1"/);
  assert.match(slide1, /name="Education Course Group B"/);
  assert.match(slide1, /val="3F4A8A"/);
});

test("PptExportService uses education minimal course decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: { ...deck, templateId: "education", theme: "minimal" },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");

  assert.match(slide1, /name="Education Course Note Title Line"/);
  assert.match(slide1, /name="Education Course Highlight"/);
  assert.match(slide1, /val="2F5D73"/);
});

test("PptExportService uses corporate training management decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "education-corporate-training-management",
      theme: "management",
      templateVisual: {
        id: "education-corporate-training-management",
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
      slides: [
        { title: "课程目标与收益", layout: "corporate-training-cover", bullets: ["统一管理语言", "掌握辅导工具", "输出行动计划"] },
        { title: "学习路径安排", layout: "corporate-training-agenda", bullets: ["导入业务场景", "讲解管理模型", "小组研讨演练", "沉淀行动承诺"] },
        { title: "管理模型拆解", layout: "corporate-training-model", bullets: ["目标设定", "过程反馈", "授权协同", "复盘迭代"] },
        { title: "案例研讨任务", layout: "corporate-training-case", bullets: ["案例背景", "关键问题", "小组任务"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Corporate Training Learning Canvas"/);
  assert.match(slide1, /name="Corporate Training Board"/);
  assert.match(slide1, /name="Corporate Training Outcome Card 1"/);
  assert.match(slide2, /name="Corporate Training Learning Path 1"/);
  assert.match(slide3, /name="Corporate Training Model Card 1"/);
  assert.match(slide4, /name="Corporate Training Case Panel"/);
  assert.match(slide1, /val="1F3A5F"/);
  assert.match(slide1, /val="20A39E"/);
  assert.doesNotMatch(slide1, /Management Training/);
});

test("PptExportService uses onboarding guide decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "education-onboarding-training-onboarding-guide",
      theme: "onboarding-guide",
      templateVisual: {
        id: "education-onboarding-training-onboarding-guide",
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
      slides: [
        { title: "新人入职全景", layout: "onboarding-cover", bullets: ["入职准备", "制度学习", "岗位融入", "成长反馈"] },
        { title: "学习路径安排", layout: "onboarding-journey", bullets: ["公司介绍", "制度手册", "工具权限", "导师沟通"] },
        { title: "团队文化融入", layout: "onboarding-culture", bullets: ["价值观共识", "协作方式", "沟通节奏", "反馈机制"] },
        { title: "入职清单确认", layout: "onboarding-checklist", bullets: ["账号权限", "制度签收", "岗位目标", "试用期计划"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Onboarding Guide Canvas"/);
  assert.match(slide1, /name="Onboarding Guide Badge Card"/);
  assert.match(slide1, /name="Onboarding Guide Journey Step 1"/);
  assert.match(slide2, /name="Onboarding Guide Journey Step 1"/);
  assert.match(slide3, /name="Onboarding Guide Culture Card 1"/);
  assert.match(slide4, /name="Onboarding Guide Checklist Card 1"/);
  assert.match(slide1, /val="1E3A5F"/);
  assert.match(slide1, /val="14B8A6"/);
  assert.doesNotMatch(slide1, /Onboarding Guide<\/a:t>/);
});

test("PptExportService uses knowledge handout blackboard decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "education-knowledge-handout-blackboard",
      theme: "blackboard",
      templateVisual: {
        id: "education-knowledge-handout-blackboard",
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
      slides: [
        { title: "函数概念拆解", layout: "blackboard-cover", bullets: ["定义域和值域边界", "函数关系与图像表达", "课堂例题和练习安排"] },
        { title: "核心定义推导", layout: "blackboard-concept", bullets: ["输入集合和输出集合", "对应关系保持唯一", "用图像辅助理解"] },
        { title: "例题讲解过程", layout: "blackboard-case", bullets: ["识别题干条件", "列出关键变量", "验证结果合理性"] },
        { title: "课后练习安排", layout: "blackboard-steps", bullets: ["观察题型", "拆解条件", "推导公式", "完成反馈"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Knowledge Blackboard Canvas"/);
  assert.match(slide1, /name="Knowledge Blackboard Paper Note"/);
  assert.match(slide1, /name="Knowledge Blackboard Concept Card 1"/);
  assert.match(slide2, /name="Knowledge Blackboard Formula Panel"/);
  assert.match(slide3, /name="Knowledge Blackboard Paper Note"/);
  assert.match(slide4, /name="Knowledge Blackboard Step 1"/);
  assert.match(slide1, /val="173B33"/);
  assert.match(slide1, /val="FACC15"/);
  assert.doesNotMatch(slide1, /课堂板书/);
});

test("PptExportService uses exam review courseware decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "education-exam-review-courseware-key-points",
      theme: "key-points",
      templateVisual: {
        id: "education-exam-review-courseware-key-points",
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
      slides: [
        { title: "考点框架总览", layout: "exam-review-cover", bullets: ["函数图像和方程思想", "必背公式与易错条件", "冲刺练习安排"] },
        { title: "知识框架拆解", layout: "exam-review-framework", bullets: ["定义边界", "公式适用条件", "典型题型"] },
        { title: "错题归因分析", layout: "exam-review-mistakes", bullets: ["审题遗漏", "计算误差", "条件误判"] },
        { title: "冲刺学习计划", layout: "exam-review-plan", bullets: ["回看框架", "限时训练", "订正错题", "考前复盘"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Exam Review Canvas"/);
  assert.match(slide1, /name="Exam Review Answer Card"/);
  assert.match(slide1, /name="Exam Review Plan Step 1"/);
  assert.match(slide2, /name="Exam Review Framework Card 1"/);
  assert.match(slide3, /name="Exam Review Mistake Card 1"/);
  assert.match(slide4, /name="Exam Review Plan Step 1"/);
  assert.match(slide1, /val="1E2A78"/);
  assert.match(slide1, /val="F59E0B"/);
  assert.doesNotMatch(slide1, /重点梳理/);
});

test("PptExportService uses teaching achievement showcase decorations", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      ...deck,
      templateId: "education-teaching-achievement-report-showcase",
      theme: "showcase",
      templateVisual: {
        id: "education-teaching-achievement-report-showcase",
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
      slides: [
        { title: "教学项目成果复盘", layout: "teaching-achievement-showcase-cover", bullets: ["课程目标达成率超过预期", "学生项目作品沉淀完成", "课堂反馈形成改进闭环"] },
        { title: "课程作品成果墙", layout: "teaching-achievement-showcase-gallery", bullets: ["优秀课程作品展示", "项目任务完成情况", "学生协作亮点"] },
        { title: "学生表现分析", layout: "teaching-achievement-showcase-analysis", bullets: ["出勤与完成率提升", "课堂互动明显增加", "能力评价持续改善"] },
        { title: "教育项目复盘", layout: "teaching-achievement-showcase-review", bullets: ["目标复核", "过程证据", "评估反馈", "下一轮迭代"] },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");
  const slide1 = pptPartText(text, "ppt/slides/slide1.xml");
  const slide2 = pptPartText(text, "ppt/slides/slide2.xml");
  const slide3 = pptPartText(text, "ppt/slides/slide3.xml");
  const slide4 = pptPartText(text, "ppt/slides/slide4.xml");

  assert.match(slide1, /name="Teaching Achievement Canvas"/);
  assert.match(slide1, /name="Teaching Achievement Medal Panel"/);
  assert.match(slide1, /name="Teaching Achievement Metric Card 1"/);
  assert.match(slide2, /name="Teaching Achievement Wall Card 1"/);
  assert.match(slide3, /name="Teaching Achievement Analysis Panel"/);
  assert.match(slide4, /name="Teaching Achievement Roadmap Panel"/);
  assert.match(slide1, /val="1E3A8A"/);
  assert.match(slide1, /val="14B8A6"/);
  assert.doesNotMatch(slide1, /成果展示/);
});

test("PptExportService applies template-specific visual colors to PDF output", () => {
  const exporter = new PptExportService();
  const business = exporter.exportDeck({ deck: { ...deck, templateId: "business", theme: "modern" }, format: "pdf" });
  const pitch = exporter.exportDeck({ deck: { ...deck, templateId: "pitch", theme: "startup" }, format: "pdf" });
  const businessText = business.content.toString("latin1");
  const pitchText = pitch.content.toString("latin1");

  assert.match(businessText, /0\.725 0\.110 0\.110 rg|0\.725 0\.11 0\.11 rg/);
  assert.match(pitchText, /0\.086 0\.129 0\.243 rg/);
  assert.notEqual(businessText, pitchText);
});

test("PptExportService creates a minimal PDF document with xref and trailer", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({ deck, format: "pdf" });
  const text = result.content.toString("utf8");

  assert.equal(result.fileName, "PPT-Executive-Review-business-2p-20260702-1820-123456.pdf");
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /xref/);
  assert.match(text, /trailer/);
  assert.match(text, /%%EOF$/);
  assert.match(text, /<FEFF0045007800650063007500740069007600650020005200650076006900650077>/);
});

test("PptExportService writes slide titles and bullet content as separate PDF text lines", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({ deck, format: "pdf" });
  const text = result.content.toString("latin1");

  assert.match(text, new RegExp(pdfHex("1. Overview")));
  assert.match(text, new RegExp(pdfHex("- Revenue grew")));
  assert.match(text, new RegExp(pdfHex("- Retention improved")));
  assert.match(text, new RegExp(pdfHex("2. Next Steps")));
  assert.match(text, new RegExp(pdfHex("- Launch pilot")));
  assert.equal((text.match(/ Tj/g) || []).length >= 6, true);
});

test("PptExportService encodes Chinese PDF text with a Unicode CID font", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "中文汇报",
      slides: [{ title: "市场机会", bullets: ["增长明显"] }],
    },
    format: "pdf",
  });
  const text = result.content.toString("latin1");

  assert.match(text, /\/Subtype \/Type0/);
  assert.match(text, /\/Encoding \/UniGB-UCS2-H/);
  assert.match(text, /\/BaseFont \/STSong-Light/);
  assert.match(text, /<FEFF4E2D65876C4762A5>/);
  assert.doesNotMatch(text, /\(中文汇报\)/);
});

test("PptExportService rejects unsupported export formats", () => {
  const exporter = new PptExportService();

  assert.throws(
    () => exporter.exportDeck({ deck, format: "docx" }),
    { code: "EXPORT_FORMAT_UNSUPPORTED" },
  );
});

function pdfHex(value) {
  const utf16le = Buffer.from(`\uFEFF${value}`, "utf16le");
  const utf16be = Buffer.alloc(utf16le.length);
  for (let index = 0; index < utf16le.length; index += 2) {
    utf16be[index] = utf16le[index + 1];
    utf16be[index + 1] = utf16le[index];
  }
  return `<${utf16be.toString("hex").toUpperCase()}>`;
}

function pptPartText(zipText, partPath) {
  const marker = "PK\x03\x04";
  const start = zipText.indexOf(`${partPath}<?xml`);
  if (start === -1) return "";
  const nextPart = zipText.indexOf(marker, start + partPath.length);
  return zipText.slice(start, nextPart === -1 ? undefined : nextPart);
}

function pptShapeByName(slideXml, shapeName) {
  const nameStart = slideXml.indexOf(`name="${shapeName}"`);
  if (nameStart === -1) return "";
  const shapeStart = slideXml.lastIndexOf("<p:sp>", nameStart);
  const shapeEnd = slideXml.indexOf("</p:sp>", nameStart);
  return slideXml.slice(shapeStart, shapeEnd === -1 ? undefined : shapeEnd + "</p:sp>".length);
}
