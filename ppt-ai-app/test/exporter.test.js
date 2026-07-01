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
  assert.match(businessText, /val="B80F1A"/);
  assert.match(businessText, /name="Lower Gold Wave"/);
  assert.match(businessText, /name="Content Placement Card"/);
  assert.match(businessText, /name="Right Golden Motif"/);
  assert.match(pitchText, /name="Moling Venture Pitch"/);
  assert.match(pitchText, /val="111827"/);
  assert.notEqual(businessText, pitchText);
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
        { title: "目录", bullets: ["工作汇报", "成果展示", "问题不足", "下步计划"], layout: "agenda" },
        { title: "工作汇报", bullets: ["PART 01"], layout: "section-divider" },
        { title: "年度工作概况", bullets: ["核心目标达成情况", "关键业务指标完成率", "团队协作与资源投入概况"], layout: "image-report" },
        { title: "下步计划", bullets: ["目标拆解", "资源配置", "执行跟踪", "复盘优化"], layout: "four-steps" },
        { title: "汇报结束", bullets: ["感谢观看"], layout: "closing" },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");

  assert.match(text, /ppt\/media\/dome-cover\.jpg/);
  assert.match(text, /ppt\/media\/dome-content\.jpg/);
  assert.match(text, /Target="\.\.\/media\/dome-cover\.jpg"/);
  assert.match(text, /Target="\.\.\/media\/dome-content\.jpg"/);
  assert.match(text, /<p:sldSz cx="12192000" cy="6858000"\/>/);
  assert.match(text, /name="Dome Cover Sailboat Background"[\s\S]*<a:ext cx="12192000" cy="6858000"\/>/);
  assert.match(text, /<a:fontScheme name="588ku">/);
  assert.match(text, /<a:latin typeface="Arial Black"\/>/);
  assert.match(text, /typeface="Source Han Sans CN Heavy"/);
  assert.match(text, /name="Title 1"[\s\S]*<a:gradFill>[\s\S]*val="FFF8CC"[\s\S]*val="FCD696"/);
  assert.match(text, /name="Dome Cover Sailboat Background"/);
  assert.match(text, /name="Dome Agenda Card 1"/);
  assert.match(text, /name="Dome Section Number"/);
  assert.match(text, /name="Dome Image Placeholder"/);
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
        { title: "工作汇报图文页", bullets: ["业务进展", "团队投入", "关键成果"], layout: "image-report" },
        { title: "三步骤流程", bullets: ["Discovery", "Planning", "Launch"], layout: "three-steps" },
        { title: "四步骤流程", bullets: ["Target split", "Resource plan", "Process tracking", "Review loop"], layout: "four-steps" },
        { title: "数据指标", bullets: ["Revenue growth", "Retention rate", "Delivery speed"], layout: "metrics" },
        { title: "成果展示", bullets: ["项目成果", "客户反馈", "团队荣誉"], layout: "showcase" },
        { title: "问题复盘", bullets: ["Risk signal", "Root cause", "Mitigation"], layout: "retrospective" },
        { title: "下一步计划", bullets: ["Quarter roadmap", "Key action", "Owner review"], layout: "next-plan" },
        { title: "汇报结束", bullets: ["感谢观看"], layout: "closing" },
      ],
    },
    format: "pptx",
  });
  const text = result.content.toString("latin1");

  assert.match(text, /ppt\/media\/dome-business-1\.jpeg/);
  assert.match(text, /ppt\/media\/dome-business-2\.jpeg/);
  assert.match(text, /Target="\.\.\/media\/dome-business-1\.jpeg"/);
  assert.match(text, /Target="\.\.\/media\/dome-business-2\.jpeg"/);
  assert.match(text, /name="Dome Business Image"/);
  assert.match(text, /name="Dome Section Number"(?:(?!<\/p:sp>).)*<a:t>PART 01<\/a:t>/s);
  assert.match(text, /name="Dome Step 3"/);
  assert.match(text, /name="Dome Step 4"/);
  assert.match(text, /name="Dome Step Text 1"[\s\S]*<a:t>Discovery<\/a:t>/);
  assert.match(text, /name="Dome Step Text 4"[\s\S]*<a:t>Review loop<\/a:t>/);
  assert.equal((text.match(/<a:t>Discovery<\/a:t>/g) || []).length, 1);
  assert.equal((text.match(/<a:t>Retention rate<\/a:t>/g) || []).length, 1);
  assert.match(text, /name="Dome Metric Card 3"/);
  assert.match(text, /name="Dome Metric Text 2"[\s\S]*<a:t>Retention rate<\/a:t>/);
  assert.match(text, /name="Dome Showcase Image"/);
  assert.match(text, /name="Dome Retrospective Risk Card"/);
  assert.match(text, /name="Dome Retrospective Risk Text"[\s\S]*<a:t>Risk signal<\/a:t>/);
  assert.match(text, /name="Dome Next Plan Timeline"/);
  assert.match(text, /name="Dome Next Plan Text 1"[\s\S]*<a:t>Quarter roadmap<\/a:t>/);
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

test("PptExportService applies template-specific visual colors to PDF output", () => {
  const exporter = new PptExportService();
  const business = exporter.exportDeck({ deck: { ...deck, templateId: "business", theme: "modern" }, format: "pdf" });
  const pitch = exporter.exportDeck({ deck: { ...deck, templateId: "pitch", theme: "startup" }, format: "pdf" });
  const businessText = business.content.toString("latin1");
  const pitchText = pitch.content.toString("latin1");

  assert.match(businessText, /0\.722 0\.059 0\.102 rg/);
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
