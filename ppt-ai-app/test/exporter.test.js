import assert from "node:assert/strict";
import { test } from "node:test";

import { PptExportService } from "../src/ppt-exporter.js";

const deck = {
  title: "Executive Review",
  slides: [
    { title: "Overview", bullets: ["Revenue grew", "Retention improved"] },
    { title: "Next Steps", bullets: ["Launch pilot"] },
  ],
};

test("PptExportService creates a PPTX zip package with presentation parts", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({ deck, format: "pptx" });
  const text = result.content.toString("latin1");

  assert.equal(result.content.subarray(0, 2).toString("utf8"), "PK");
  assert.equal(result.fileName, "Executive_Review.pptx");
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

  assert.match(businessText, /name="Moling Executive Business"/);
  assert.match(businessText, /val="1F4E79"/);
  assert.match(businessText, /name="Lower Gold Wave"/);
  assert.match(businessText, /name="Dome Gold Wave Arc"[\s\S]*<a:prstGeom prst="arc"/);
  assert.match(businessText, /name="Dome Light Wave Arc"[\s\S]*<a:prstGeom prst="arc"/);
  assert.match(businessText, /name="Content Placement Card"/);
  assert.match(businessText, /name="Right Golden Motif"/);
  assert.match(pitchText, /name="Moling Venture Pitch"/);
  assert.match(pitchText, /val="111827"/);
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

  assert.match(slide1, /name="Top Band Surface"/);
  assert.match(slide1, /name="Primary Rail"/);
  assert.match(slide1, /name="Top Band Outline"/);
  assert.match(slide1, /name="Top Band Accent Ribbon"/);
  assert.match(slide1, /name="Top Band Side Cap"/);
  assert.match(slide1, /name="Top Band Index Ring"/);
  assert.match(slide1, /name="Top Band Ring Number"/);
  assert.match(slide1, /name="Top Band Footer"/);
  assert.match(slide1, /name="Section Label"/);
});

test("PptExportService reuses dome visual assets and page layout roles for red-gold PPTX output", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({
    deck: {
      title: "年度工作汇报",
      templateId: "business",
      theme: "modern",
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

test("PptExportService applies template-specific visual colors to PDF output", () => {
  const exporter = new PptExportService();
  const business = exporter.exportDeck({ deck: { ...deck, templateId: "business", theme: "modern" }, format: "pdf" });
  const pitch = exporter.exportDeck({ deck: { ...deck, templateId: "pitch", theme: "startup" }, format: "pdf" });
  const businessText = business.content.toString("latin1");
  const pitchText = pitch.content.toString("latin1");

  assert.match(businessText, /0\.122 0\.306 0\.475 rg/);
  assert.match(pitchText, /0\.067 0\.094 0\.153 rg/);
  assert.notEqual(businessText, pitchText);
});

test("PptExportService creates a minimal PDF document with xref and trailer", () => {
  const exporter = new PptExportService();
  const result = exporter.exportDeck({ deck, format: "pdf" });
  const text = result.content.toString("utf8");

  assert.equal(result.fileName, "Executive_Review.pdf");
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
