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
