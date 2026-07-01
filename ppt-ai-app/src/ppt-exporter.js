import { readFileSync } from "node:fs";

import { AppError } from "./errors.js";
import { resolveTemplateVisual } from "./templates.js";

const DOME_ASSET_BASE_URL = new URL("../../templates/official/dome/assets/", import.meta.url);
const DEFAULT_SLIDE_METRICS = { width: 9144000, height: 5143500, scaleX: 1, scaleY: 1, type: "screen16x9" };
const DOME_SLIDE_METRICS = {
  width: 12192000,
  height: 6858000,
  scaleX: 12192000 / 9144000,
  scaleY: 6858000 / 5143500,
};

// dome.pptx 的核心视觉不是程序绘制出来的色块，而是可复用的红金背景图。
// 导出器在启动时读取这些本仓库内资产，并在生成 PPTX 时作为 media part 写入。
const DOME_ASSETS = {
  cover: readFileSync(new URL("dome-cover.jpg", DOME_ASSET_BASE_URL)),
  content: readFileSync(new URL("dome-content.jpg", DOME_ASSET_BASE_URL)),
  business1: readFileSync(new URL("dome-business-1.jpeg", DOME_ASSET_BASE_URL)),
  business2: readFileSync(new URL("dome-business-2.jpeg", DOME_ASSET_BASE_URL)),
  business3: readFileSync(new URL("dome-business-3.jpeg", DOME_ASSET_BASE_URL)),
  business4: readFileSync(new URL("dome-business-4.jpeg", DOME_ASSET_BASE_URL)),
  business5: readFileSync(new URL("dome-business-5.jpeg", DOME_ASSET_BASE_URL)),
  business6: readFileSync(new URL("dome-business-6.jpeg", DOME_ASSET_BASE_URL)),
};

/**
 * Exports generated decks into downloadable document buffers.
 */
export class PptExportService {
  /**
   * Exports a deck to the requested format.
   * @param {{deck: object, format: string}} input
   * @returns {{fileName: string, mimeType: string, content: Buffer}}
   */
  exportDeck({ deck, format }) {
    if (format !== "pptx" && format !== "pdf") {
      throw new AppError({
        code: "EXPORT_FORMAT_UNSUPPORTED",
        status: 400,
        message: "Unsupported export format",
        publicDetails: { supported_formats: ["pptx", "pdf"] },
      });
    }
    if (format === "pdf") return this.#exportPdf(deck);
    return this.#exportPptx(deck);
  }

  /**
   * Creates a minimal Office Open XML PPTX package.
   * @param {object} deck
   * @returns {{fileName: string, mimeType: string, content: Buffer}}
   */
  #exportPptx(deck) {
    const visual = resolveDeckVisual(deck);
    const files = {
      "[Content_Types].xml": contentTypesXml(deck),
      "_rels/.rels": packageRelsXml(),
      "ppt/presentation.xml": presentationXml(deck, visual),
      "ppt/_rels/presentation.xml.rels": presentationRelsXml(deck),
      ...slideFiles(deck, visual),
      "ppt/slideLayouts/slideLayout1.xml": slideLayoutXml(visual),
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels": slideLayoutRelsXml(),
      "ppt/slideMasters/slideMaster1.xml": slideMasterXml(visual),
      "ppt/slideMasters/_rels/slideMaster1.xml.rels": slideMasterRelsXml(),
      "ppt/theme/theme1.xml": themeXml(visual),
      ...templateMediaFiles(visual),
    };
    return {
      fileName: `${safeFileName(deck.title)}.pptx`,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      content: createZip(files),
    };
  }

  /**
   * Creates a minimal PDF with xref and trailer sections.
   * @param {object} deck
   * @returns {{fileName: string, mimeType: string, content: Buffer}}
   */
  #exportPdf(deck) {
    const visual = resolveDeckVisual(deck);
    const stream = buildPdfTextStream(deck, visual);
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>",
      "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [5 0 R] >>",
      "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor 6 0 R >>",
      "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -254 /CapHeight 880 /StemV 80 >>",
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ];
    const content = buildPdf(objects);
    return {
      fileName: `${safeFileName(deck.title)}.pdf`,
      mimeType: "application/pdf",
      content: Buffer.from(content, "utf8"),
    };
  }
}

/**
 * Builds a PDF text content stream with one positioned text operation per line.
 * @param {object} deck
 * @returns {string}
 */
function buildPdfTextStream(deck, visual = resolveDeckVisual(deck)) {
  const operations = [
    pdfColor(visual.primary),
    "0 774 612 18 re f",
    "BT",
    pdfColor(visual.title),
    pdfTextLine({ text: deck.title, size: 18, x: 72, y: 760 }),
  ];
  let y = 726;
  for (const [slideIndex, slide] of deck.slides.entries()) {
    operations.push(pdfColor(visual.title));
    operations.push(pdfTextLine({ text: `${slideIndex + 1}. ${slide.title}`, size: 13, x: 72, y }));
    y -= 22;
    operations.push(pdfColor(visual.body));
    for (const bullet of slide.bullets || []) {
      for (const line of wrapPdfLine(`- ${bullet}`)) {
        operations.push(pdfTextLine({ text: line, size: 11, x: 90, y }));
        y -= 18;
      }
    }
    y -= 10;
  }
  operations.push("ET");
  return operations.join(" ");
}

/**
 * Resolves deck visual settings including persisted user-template snapshots.
 * @param {object} deck
 * @returns {object}
 */
function resolveDeckVisual(deck) {
  return resolveTemplateVisual({
    templateId: deck.templateId,
    template: { id: deck.templateId, name: deck.templateName, visual: deck.templateVisual },
  });
}

/**
 * Creates a PDF fill color operation from a six-digit hex color.
 * @param {string} hex
 * @returns {string}
 */
function pdfColor(hex) {
  const normalized = String(hex || "000000").replace(/^#/, "").padEnd(6, "0").slice(0, 6);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return `${formatPdfNumber(red)} ${formatPdfNumber(green)} ${formatPdfNumber(blue)} rg`;
}

/**
 * Formats a PDF color channel.
 * @param {number} value
 * @returns {string}
 */
function formatPdfNumber(value) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0");
}

/**
 * Creates one absolute-positioned PDF text operation.
 * @param {{text: unknown, size: number, x: number, y: number}} input
 * @returns {string}
 */
function pdfTextLine({ text, size, x, y }) {
  return `/F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm ${pdfUnicodeText(text)} Tj`;
}

/**
 * Wraps long text into short PDF lines.
 * @param {unknown} value
 * @returns {string[]}
 */
function wrapPdfLine(value) {
  const text = String(value ?? "");
  const lines = [];
  for (let index = 0; index < text.length; index += 44) {
    lines.push(text.slice(index, index + 44));
  }
  return lines.length ? lines : [""];
}

/**
 * Creates content types metadata.
 * @param {object} deck
 * @returns {string}
 */
function contentTypesXml(deck) {
  const slides = deck.slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides}<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`;
}

/**
 * Creates package relationships metadata.
 * @returns {string}
 */
function packageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`;
}

/**
 * Creates presentation XML.
 * @param {object} deck
 * @param {object} visual
 * @returns {string}
 */
function presentationXml(deck, visual = resolveDeckVisual(deck)) {
  const metrics = slideMetrics(visual);
  const slideIds = deck.slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("");
  const type = metrics.type ? ` type="${metrics.type}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${deck.slides.length + 1}"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${metrics.width}" cy="${metrics.height}"${type}/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
}

/**
 * Creates presentation relationship XML.
 * @param {object} deck
 * @returns {string}
 */
function presentationRelsXml(deck) {
  const rels = deck.slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${deck.slides.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`;
}

/**
 * Creates slide XML files.
 * @param {object} deck
 * @param {object} visual
 * @returns {Record<string, string>}
 */
function slideFiles(deck, visual) {
  const files = {};
  for (const [index, slide] of deck.slides.entries()) {
    const role = resolveSlideRole(slide, index, deck.slides.length);
    const layout = templateLayout(visual, index, role);
    const titleColor = layout.titleColor || visual.title;
    const bodyColor = layout.bodyColor || visual.body;
    const bodySize = layout.bodySize || 2200;
    const bullets = (slide.bullets || []).map((bullet) => `<a:p><a:pPr marL="342900" indent="-171450"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="zh-CN" sz="${bodySize}"><a:solidFill><a:srgbClr val="${bodyColor}"/></a:solidFill></a:rPr><a:t>${escapeXml(bullet)}</a:t></a:r></a:p>`).join("");
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${groupShapeXml()}${templateDecorationsXml(visual, index, layout, role, slide)}${textShapeXml({ id: 20, name: "Title 1", ...layout.title, text: slide.title, size: layout.titleSize, bold: true, color: titleColor })}${textShapeXml({ id: 21, name: "Content 2", ...layout.content, body: bullets || paragraphXml("", bodySize, false, bodyColor), size: bodySize, bold: false, color: bodyColor })}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
    files[`ppt/slides/slide${index + 1}.xml`] = scaleTemplateGeometryXml(slideXml, visual);
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = slideRelsXml(visual, role);
  }
  return files;
}

/**
 * 根据模板选择 PPT 画布尺寸。
 * dome.pptx 原始文件是 12192000 x 6858000；其他模板继续使用现有 16:9 screen 尺寸，避免影响旧导出。
 * @param {object} visual
 * @returns {{width: number, height: number, scaleX: number, scaleY: number, type?: string}}
 */
function slideMetrics(visual) {
  return visual.layout === "red-gold" ? DOME_SLIDE_METRICS : DEFAULT_SLIDE_METRICS;
}

/**
 * 将 red-gold 页面坐标从旧的标准 16:9 基准等比放大到 dome.pptx 的真实画布。
 * 字号不在这里缩放，因为字号本身是 pt 值；这里只处理 OOXML 里的位置和尺寸。
 * @param {string} xml
 * @param {object} visual
 * @returns {string}
 */
function scaleTemplateGeometryXml(xml, visual) {
  const metrics = slideMetrics(visual);
  if (metrics.scaleX === 1 && metrics.scaleY === 1) return xml;
  return xml.replace(/<a:(off|ext|chOff|chExt)\b([^>]*)\/>/g, (tag, element, attributes) => {
    const scaled = attributes.replace(/\b(x|y|cx|cy)="(-?\d+)"/g, (_, name, rawValue) => {
      const scale = name === "x" || name === "cx" ? metrics.scaleX : metrics.scaleY;
      return `${name}="${Math.round(Number(rawValue) * scale)}"`;
    });
    return `<a:${element}${scaled}/>`;
  });
}

function templateDecorationsXml(visual, index, layout, role, slide) {
  const base = rectShapeXml({ id: 2, name: "Template Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background });
  if (visual.layout === "red-gold") {
    const isCover = role === "cover";
    const background = pictureXml({
      id: 3,
      name: isCover ? "Dome Cover Sailboat Background" : "Dome Red Gold Background",
      relId: "rId2",
      x: 0,
      y: 0,
      cx: 9144000,
      cy: 5143500,
    });
    const waves = solidShapeXml({ id: 4, name: "Lower Gold Wave", geom: "parallelogram", x: -304800, y: 3886200, cx: 4876800, cy: 914400, fill: "FFE8B0" })
      + solidShapeXml({ id: 5, name: "Lower Light Wave", geom: "parallelogram", x: 2590800, y: 3657600, cx: 5181600, cy: 914400, fill: visual.accent })
      + solidShapeXml({ id: 6, name: "Lower Red Wave", geom: "parallelogram", x: 0, y: 4495800, cx: 9144000, cy: 762000, fill: "9D0612" });
    const footer = rectShapeXml({ id: 7, name: "Gold Hairline", x: 0, y: isCover ? 4572000 : 685800, cx: 9144000, cy: 30480, fill: visual.accent })
      + textShapeXml({ id: 8, name: "Dome Footer Decoration", x: 609600, y: isCover ? 4572000 : 4686300, cx: 3048000, cy: 365760, text: "商务办公系列 PPT 模板", size: 1200, bold: false, color: "FFE8B0" });
    const roleDecoration = domeRoleDecorationXml({ role, index, layout, visual, slide });
    return base
      + background
      + waves
      + footer
      + roleDecoration;
  }
  if (["executive", "academy", "venture"].includes(visual.layout)) {
    return base
      + rectShapeXml({ id: 8, name: "Soft Page Layer", x: 342900, y: 342900, cx: 8458200, cy: 4457700, fill: visual.surface })
      + rectShapeXml({ id: 3, name: "Hero Surface", ...layout.surface, fill: visual.surface })
      + rectShapeXml({ id: 4, name: "Primary Accent", ...layout.accent, fill: visual.primary })
      + rectShapeXml({ id: 5, name: "Secondary Accent", ...layout.secondaryAccent, fill: visual.accent })
      + rectShapeXml({ id: 6, name: "Top Rule", x: 685800, y: 342900, cx: 7772400, cy: 30480, fill: visual.accent })
      + rectShapeXml({ id: 9, name: "Fine Divider", x: 914400, y: index === 0 ? 2743200 : 1516380, cx: 4267200, cy: 15240, fill: visual.accent })
      + textShapeXml({ id: 7, name: "Section Label", ...layout.label, text: index === 0 ? visual.name : `0${index + 1}`, size: 1200, bold: true, color: index === 0 ? visual.surface : visual.accent });
  }
  return base + rectShapeXml({ id: 3, name: "Template Accent", ...layout.accent, fill: visual.primary });
}

/**
 * Adds media files required by a template.
 * @param {object} visual
 * @returns {Record<string, Buffer>}
 */
function templateMediaFiles(visual) {
  if (visual.layout !== "red-gold") return {};
  return {
    "ppt/media/dome-cover.jpg": DOME_ASSETS.cover,
    "ppt/media/dome-content.jpg": DOME_ASSETS.content,
    "ppt/media/dome-business-1.jpeg": DOME_ASSETS.business1,
    "ppt/media/dome-business-2.jpeg": DOME_ASSETS.business2,
    "ppt/media/dome-business-3.jpeg": DOME_ASSETS.business3,
    "ppt/media/dome-business-4.jpeg": DOME_ASSETS.business4,
    "ppt/media/dome-business-5.jpeg": DOME_ASSETS.business5,
    "ppt/media/dome-business-6.jpeg": DOME_ASSETS.business6,
  };
}

/**
 * 将结构化页面映射到 dome 模板角色。
 * 这里优先尊重 AI 或前端传入的 slide.layout；没有显式布局时，再按页序和标题关键词兜底。
 * @param {object} slide
 * @param {number} index
 * @param {number} total
 * @returns {string}
 */
function resolveSlideRole(slide, index, total) {
  const explicit = String(slide?.layout || "").toLowerCase();
  if (["agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"].includes(explicit)) {
    return explicit;
  }
  if (index === 0) return "cover";
  if (index === total - 1 && /结束|谢谢|感谢|thanks/i.test(String(slide?.title || ""))) return "closing";
  if (/目录|contents?/i.test(String(slide?.title || ""))) return "agenda";
  if (/part|章节|工作汇报|成果展示|问题不足|下步计划/i.test(String(slide?.title || "")) && (slide?.bullets || []).length <= 1) return "section-divider";
  if (/指标|数据|kpi|metric/i.test(String(slide?.title || ""))) return "metrics";
  if (/成果|展示|亮点/i.test(String(slide?.title || ""))) return "showcase";
  if (/问题|复盘|不足|风险/i.test(String(slide?.title || ""))) return "retrospective";
  if (/计划|下一步|下步/i.test(String(slide?.title || ""))) return "next-plan";
  if ((slide?.bullets || []).length >= 4) return "four-steps";
  if ((slide?.bullets || []).length === 3) return "three-steps";
  return "image-report";
}

/**
 * 根据 dome 页面角色生成装饰层和占位符。
 * 这些形状的命名用于测试和后续维护，也让 PPT 编辑器里能看出每个层级的用途。
 * @param {{role: string, index: number, layout: object, visual: object, slide: object}} input
 * @returns {string}
 */
function domeRoleDecorationXml({ role, index, layout, visual, slide }) {
  if (role === "cover") {
    return textShapeXml({ id: 10, name: "Dome Cover Series Label", x: 609600, y: 4114800, cx: 3048000, cy: 365760, text: "BUSINESS REPORT", size: 1500, bold: true, color: "FFE8B0" });
  }
  if (role === "agenda") {
    const agendaItems = (slide.bullets || ["工作汇报", "成果展示", "问题不足", "下步计划"]).slice(0, 4);
    return agendaItems.map((item, itemIndex) => {
      const column = itemIndex % 2;
      const row = Math.floor(itemIndex / 2);
      const x = 1219200 + column * 3429000;
      const y = 1371600 + row * 1219200;
      return solidShapeXml({ id: 30 + itemIndex, name: `Dome Agenda Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 2743200, cy: 838200, fill: visual.accent })
        + textShapeXml({ id: 40 + itemIndex, name: `Dome Agenda Text ${itemIndex + 1}`, x: x + 304800, y: y + 213360, cx: 1828800, cy: 365760, text: String(item), size: 2000, bold: true, color: visual.title });
    }).join("");
  }
  if (role === "section-divider") {
    return textShapeXml({ id: 30, name: "Dome Section Number", ...layout.label, text: `PART ${String(index).padStart(2, "0")}`, size: 1800, bold: true, color: "FFE8B0" })
      + rectShapeXml({ id: 31, name: "Dome Section Divider Line", x: 3429000, y: 2743200, cx: 2286000, cy: 30480, fill: visual.accent });
  }
  if (role === "three-steps" || role === "four-steps" || role === "next-plan") {
    const count = role === "three-steps" ? 3 : 4;
    const bulletItems = normalizeDomeBulletItems(slide, count);
    const steps = Array.from({ length: count }, (_, stepIndex) => {
      const x = 1219200 + stepIndex * (count === 3 ? 2286000 : 1752600);
      const y = 2895600;
      const textName = role === "next-plan" ? `Dome Next Plan Text ${stepIndex + 1}` : `Dome Step Text ${stepIndex + 1}`;
      return solidShapeXml({ id: 30 + stepIndex, name: `Dome Step ${stepIndex + 1}`, geom: "roundRect", x, y, cx: count === 3 ? 1676400 : 1371600, cy: 914400, fill: stepIndex % 2 === 0 ? "FFF8E6" : visual.accent })
        + textShapeXml({ id: 40 + stepIndex, name: `Dome Step Number ${stepIndex + 1}`, x: x + 228600, y: y + 152400, cx: 914400, cy: 304800, text: `0${stepIndex + 1}`, size: 2200, bold: true, color: visual.title })
        + textShapeXml({ id: 50 + stepIndex, name: textName, x: x + 182880, y: y + 487680, cx: count === 3 ? 1310640 : 1005840, cy: 304800, text: bulletItems[stepIndex], size: 1200, bold: true, color: visual.title });
    }).join("");
    return role === "next-plan"
      ? steps + rectShapeXml({ id: 70, name: "Dome Next Plan Timeline", x: 1219200, y: 2438400, cx: 6400800, cy: 30480, fill: visual.accent })
      : steps;
  }
  if (role === "metrics") {
    const metricItems = normalizeDomeBulletItems(slide, 3);
    return pictureXml({ id: 29, name: "Dome Business Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      + Array.from({ length: 3 }, (_, metricIndex) => {
      const x = 1219200 + metricIndex * 2286000;
      return solidShapeXml({ id: 30 + metricIndex, name: `Dome Metric Card ${metricIndex + 1}`, geom: "roundRect", x, y: 2590800, cx: 1828800, cy: 1066800, fill: "FFF8E6" })
        + textShapeXml({ id: 40 + metricIndex, name: `Dome Metric Number ${metricIndex + 1}`, x: x + 228600, y: 2743200, cx: 1219200, cy: 304800, text: `0${metricIndex + 1}`, size: 1800, bold: true, color: visual.title })
        + textShapeXml({ id: 50 + metricIndex, name: `Dome Metric Text ${metricIndex + 1}`, x: x + 228600, y: 3200400, cx: 1371600, cy: 304800, text: metricItems[metricIndex], size: 1200, bold: true, color: visual.body });
    }).join("");
  }
  if (role === "showcase") {
    return solidShapeXml({ id: 31, name: "Content Placement Card", geom: "roundRect", ...layout.surface, fill: visual.surface })
      + pictureXml({ id: 30, name: "Dome Showcase Image", relId: "rId3", x: 5334000, y: 1371600, cx: 2438400, cy: 1828800 })
      + solidShapeXml({ id: 32, name: "Right Golden Motif", geom: "roundRect", ...layout.secondaryAccent, fill: visual.accent })
      + textShapeXml({ id: 33, name: "Section Label", ...layout.label, text: `PART ${String(index).padStart(2, "0")}`, size: 1500, bold: true, color: visual.accent });
  }
  if (role === "retrospective") {
    const riskItems = normalizeDomeBulletItems(slide, 1);
    return solidShapeXml({ id: 31, name: "Content Placement Card", geom: "roundRect", ...layout.surface, fill: visual.surface })
      + pictureXml({ id: 30, name: "Dome Business Image", relId: "rId3", x: 5486400, y: 1524000, cx: 2133600, cy: 1371600 })
      + solidShapeXml({ id: 32, name: "Dome Retrospective Risk Card", geom: "roundRect", x: 5486400, y: 3200400, cx: 2133600, cy: 609600, fill: visual.accent })
      + textShapeXml({ id: 34, name: "Dome Retrospective Risk Text", x: 5715000, y: 3352800, cx: 1676400, cy: 304800, text: riskItems[0], size: 1300, bold: true, color: visual.title })
      + textShapeXml({ id: 33, name: "Section Label", ...layout.label, text: `PART ${String(index).padStart(2, "0")}`, size: 1500, bold: true, color: visual.accent });
  }
  if (role === "closing") {
    return textShapeXml({ id: 30, name: "Dome Closing Mark", x: 3200400, y: 2438400, cx: 2743200, cy: 457200, text: "THANKS", size: 2200, bold: true, color: "FFE8B0" });
  }
  return solidShapeXml({ id: 31, name: "Content Placement Card", geom: "roundRect", ...layout.surface, fill: visual.surface })
    + solidShapeXml({ id: 34, name: "Dome Image Placeholder", geom: "roundRect", x: 5486400, y: 1524000, cx: 2133600, cy: 1828800, fill: visual.accent })
    + pictureXml({ id: 30, name: "Dome Business Image", relId: domeRoleBusinessMedia(role) ? "rId3" : "rId2", x: 5486400, y: 1524000, cx: 2133600, cy: 1828800 })
    + solidShapeXml({ id: 32, name: "Right Golden Motif", geom: "roundRect", ...layout.secondaryAccent, fill: visual.accent })
    + textShapeXml({ id: 33, name: "Section Label", ...layout.label, text: `PART ${String(index).padStart(2, "0")}`, size: 1500, bold: true, color: visual.accent });
}

/**
 * 从用户结构化 bullets 中取出当前版式需要的占位文案。
 * bullets 不足时使用空字符串，保证卡片数量和模板版式稳定。
 * @param {object} slide
 * @param {number} count
 * @returns {string[]}
 */
function normalizeDomeBulletItems(slide, count) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: count }, (_, index) => String(bullets[index] ?? ""));
}

/**
 * 为不同内容角色挑选 dome.pptx 中的商务图片。
 * @param {string} role
 * @returns {string}
 */
function domeRoleBusinessMedia(role) {
  const mapping = {
    "image-report": "dome-business-1.jpeg",
    metrics: "dome-business-5.jpeg",
    showcase: "dome-business-2.jpeg",
    retrospective: "dome-business-3.jpeg",
    "next-plan": "dome-business-6.jpeg",
  };
  return mapping[role] || "";
}

/**
 * Returns slide geometry for the selected visual template.
 * @param {object} visual
 * @param {number} index
 * @returns {{accent: object, title: object, content: object, titleSize: number}}
 */
function templateLayout(visual, index, role = index === 0 ? "cover" : "content") {
  if (visual.layout === "red-gold") {
    if (role === "cover" || role === "closing") {
      return {
        surface: { x: 2438400, y: 1066800, cx: 4267200, cy: 2438400 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 5143500 },
        secondaryAccent: { x: 6781800, y: 1600200, cx: 914400, cy: 2057400 },
        label: { x: 5943600, y: 914400, cx: 1524000, cy: 365760 },
        title: { x: role === "closing" ? 3048000 : 2895600, y: 1371600, cx: 3962400, cy: 914400 },
        content: { x: 2971800, y: 2514600, cx: 3886200, cy: 914400 },
        titleSize: 5200,
        bodySize: 2100,
        titleColor: "FFF2B8",
        bodyColor: "FFE8B0",
      };
    }
    if (role === "agenda") {
      return {
        surface: { x: 914400, y: 1143000, cx: 7315200, cy: 2667000 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 685800 },
        secondaryAccent: { x: 0, y: 0, cx: 0, cy: 0 },
        label: { x: 609600, y: 304800, cx: 1524000, cy: 365760 },
        title: { x: 3657600, y: 457200, cx: 1828800, cy: 609600 },
        content: { x: 1371600, y: 1371600, cx: 6400800, cy: 2133600 },
        titleSize: 3600,
        bodySize: 1900,
        titleColor: "FFF2B8",
        bodyColor: visual.body,
      };
    }
    if (role === "section-divider") {
      return {
        surface: { x: 0, y: 0, cx: 0, cy: 0 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 685800 },
        secondaryAccent: { x: 0, y: 0, cx: 0, cy: 0 },
        label: { x: 3200400, y: 1295400, cx: 2743200, cy: 457200 },
        title: { x: 2743200, y: 1905000, cx: 3657600, cy: 822960 },
        content: { x: 2743200, y: 2895600, cx: 3657600, cy: 609600 },
        titleSize: 5000,
        bodySize: 2100,
        titleColor: "FFF2B8",
        bodyColor: "FFE8B0",
      };
    }
    return {
      surface: { x: 914400, y: 914400, cx: 7162800, cy: 3429000 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 685800 },
      secondaryAccent: { x: 6934200, y: 1828800, cx: 762000, cy: 1828800 },
      label: { x: 609600, y: 304800, cx: 1524000, cy: 365760 },
      title: { x: 1371600, y: 1219200, cx: 4343400, cy: 762000 },
      content: { x: 1524000, y: 2133600, cx: 4876800, cy: 1371600 },
      titleSize: 3600,
      bodySize: 2100,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "executive") {
    if (index === 0) {
      return {
        surface: { x: 457200, y: 571500, cx: 8229600, cy: 3886200 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 514350 },
        secondaryAccent: { x: 7315200, y: 571500, cx: 1371600, cy: 3886200 },
        label: { x: 914400, y: 800100, cx: 3048000, cy: 365760 },
        title: { x: 914400, y: 1371600, cx: 5486400, cy: 1219200 },
        content: { x: 914400, y: 2895600, cx: 5486400, cy: 1219200 },
        titleSize: 4300,
      };
    }
    return {
      surface: { x: 571500, y: 914400, cx: 8001000, cy: 3657600 },
      accent: { x: 0, y: 0, cx: 342900, cy: 5143500 },
      secondaryAccent: { x: 571500, y: 914400, cx: 114300, cy: 3657600 },
      label: { x: 7315200, y: 457200, cx: 914400, cy: 365760 },
      title: { x: 914400, y: 571500, cx: 6400800, cy: 822960 },
      content: { x: 1143000, y: 1828800, cx: 6629400, cy: 2438400 },
      titleSize: 3300,
    };
  }
  if (visual.layout === "academy") {
    if (index === 0) {
      return {
        surface: { x: 571500, y: 685800, cx: 8001000, cy: 3657600 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 457200 },
        secondaryAccent: { x: 571500, y: 3886200, cx: 8001000, cy: 342900 },
        label: { x: 914400, y: 1028700, cx: 2743200, cy: 365760 },
        title: { x: 914400, y: 1524000, cx: 6858000, cy: 1097280 },
        content: { x: 914400, y: 2895600, cx: 6858000, cy: 914400 },
        titleSize: 4000,
      };
    }
    return {
      surface: { x: 685800, y: 1028700, cx: 7772400, cy: 3429000 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
      secondaryAccent: { x: 7315200, y: 1028700, cx: 685800, cy: 3429000 },
      label: { x: 7315200, y: 457200, cx: 914400, cy: 365760 },
      title: { x: 914400, y: 571500, cx: 6400800, cy: 822960 },
      content: { x: 1143000, y: 1828800, cx: 5791200, cy: 2286000 },
      titleSize: 3300,
    };
  }
  if (visual.layout === "venture") {
    if (index === 0) {
      return {
        surface: { x: 457200, y: 457200, cx: 8229600, cy: 3886200 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 5143500 },
        secondaryAccent: { x: 457200, y: 4114800, cx: 8229600, cy: 274320 },
        label: { x: 914400, y: 800100, cx: 2743200, cy: 365760 },
        title: { x: 914400, y: 1371600, cx: 6858000, cy: 1219200 },
        content: { x: 914400, y: 3048000, cx: 6400800, cy: 914400 },
        titleSize: 4400,
      };
    }
    return {
      surface: { x: 571500, y: 800100, cx: 8001000, cy: 3771900 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
      secondaryAccent: { x: 685800, y: 1143000, cx: 274320, cy: 3048000 },
      label: { x: 7315200, y: 457200, cx: 914400, cy: 365760 },
      title: { x: 1028700, y: 571500, cx: 6400800, cy: 822960 },
      content: { x: 1371600, y: 1828800, cx: 6400800, cy: 2286000 },
      titleSize: 3400,
    };
  }
  if (visual.layout === "hero" && index === 0) {
    return {
      accent: { x: 0, y: 0, cx: 9144000, cy: 228600 },
      title: { x: 685800, y: 914400, cx: 7772400, cy: 1219200 },
      content: { x: 914400, y: 2438400, cx: 7315200, cy: 2057400 },
      titleSize: 4300,
    };
  }
  if (visual.layout === "left-rail") {
    return {
      accent: { x: 0, y: 0, cx: 342900, cy: 5143500 },
      title: { x: 914400, y: 457200, cx: 7315200, cy: 914400 },
      content: { x: 914400, y: 1676400, cx: 7315200, cy: 2895600 },
      titleSize: 3600,
    };
  }
  return {
    accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
    title: { x: 685800, y: 571500, cx: 7772400, cy: 914400 },
    content: { x: 914400, y: 1676400, cx: 7315200, cy: 2895600 },
    titleSize: 3600,
  };
}

/**
 * Creates slide relationship XML.
 * @returns {string}
 */
function slideRelsXml(visual, role = "content") {
  const imageRel = visual.layout === "red-gold"
    ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${role === "cover" ? "dome-cover" : "dome-content"}.jpg"/>`
    : "";
  const businessImage = visual.layout === "red-gold" ? domeRoleBusinessMedia(role) : "";
  const businessImageRel = businessImage
    ? `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${businessImage}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${imageRel}${businessImageRel}</Relationships>`;
}

/**
 * Creates a blank slide layout part.
 * @returns {string}
 */
function slideLayoutXml(visual) {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="${escapeXml(visual.name)}"><p:spTree>${groupShapeXml()}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

/**
 * Creates slide layout relationship XML.
 * @returns {string}
 */
function slideLayoutRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
}

/**
 * Creates a minimal slide master part.
 * @returns {string}
 */
function slideMasterXml(visual) {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${visual.background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${groupShapeXml()}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
}

/**
 * Creates slide master relationship XML.
 * @returns {string}
 */
function slideMasterRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
}

/**
 * Creates a minimal Office theme part.
 * @returns {string}
 */
function themeXml(visual) {
  return `<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Moling ${escapeXml(visual.name)}"><a:themeElements><a:clrScheme name="Moling ${escapeXml(visual.name)}"><a:dk1><a:srgbClr val="${visual.title}"/></a:dk1><a:lt1><a:srgbClr val="${visual.surface}"/></a:lt1><a:dk2><a:srgbClr val="${visual.body}"/></a:dk2><a:lt2><a:srgbClr val="${visual.background}"/></a:lt2><a:accent1><a:srgbClr val="${visual.primary}"/></a:accent1><a:accent2><a:srgbClr val="${visual.accent}"/></a:accent2><a:accent3><a:srgbClr val="F59E0B"/></a:accent3><a:accent4><a:srgbClr val="DC2626"/></a:accent4><a:accent5><a:srgbClr val="7C3AED"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="${visual.primary}"/></a:hlink><a:folHlink><a:srgbClr val="${visual.accent}"/></a:folHlink></a:clrScheme><a:fontScheme name="Moling"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Moling"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"/><a:gradFill rotWithShape="1"/></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

/**
 * Creates required root group shape metadata.
 * @returns {string}
 */
function groupShapeXml() {
  return `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
}

/**
 * Creates a filled rectangle shape.
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, fill: string}} input
 * @returns {string}
 */
function rectShapeXml({ id, name, x, y, cx, cy, fill }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

/**
 * Creates a filled preset geometry shape.
 * @param {{id: number, name: string, geom: string, x: number, y: number, cx: number, cy: number, fill: string}} input
 * @returns {string}
 */
function solidShapeXml({ id, name, geom, x, y, cx, cy, fill }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${escapeXml(geom)}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

/**
 * Creates an OOXML picture shape bound to a slide relationship id.
 * @param {{id: number, name: string, relId: string, x: number, y: number, cx: number, cy: number}} input
 * @returns {string}
 */
function pictureXml({ id, name, relId, x, y, cx, cy }) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${escapeXml(relId)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></p:spPr></p:pic>`;
}

/**
 * Creates a positioned text box shape.
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, text?: string, body?: string, size: number, bold: boolean, color?: string}} input
 * @returns {string}
 */
function textShapeXml({ id, name, x, y, cx, cy, text, body, size, bold, color = "1F2937" }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>${body || paragraphXml(text, size, bold, color)}</p:txBody></p:sp>`;
}

/**
 * Creates one DrawingML paragraph.
 * @param {unknown} value
 * @param {number} [size]
 * @param {boolean} [bold]
 * @param {string} [color]
 * @returns {string}
 */
function paragraphXml(value, size = 2200, bold = false, color = "1F2937") {
  return `<a:p><a:r><a:rPr lang="zh-CN" sz="${size}"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${escapeXml(value)}</a:t></a:r></a:p>`;
}

/**
 * Creates a store-only ZIP archive.
 * @param {Record<string, string>} files
 * @returns {Buffer}
 */
function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = 0x0021;
  for (const [name, value] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(value);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...localParts, centralBuffer, end]);
}

/**
 * Calculates CRC32 for ZIP entries.
 * @param {Buffer} buffer
 * @returns {number}
 */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a minimal PDF file.
 * @param {string[]} objects
 * @returns {string}
 */
function buildPdf(objects) {
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return output;
}

/**
 * Escapes XML text.
 * @param {unknown} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Encodes PDF text as a UTF-16BE hexadecimal string with BOM.
 * @param {unknown} value
 * @returns {string}
 */
function pdfUnicodeText(value) {
  const utf16le = Buffer.from(`\uFEFF${String(value ?? "")}`, "utf16le");
  const utf16be = Buffer.alloc(utf16le.length);
  for (let index = 0; index < utf16le.length; index += 2) {
    utf16be[index] = utf16le[index + 1];
    utf16be[index + 1] = utf16le[index];
  }
  return `<${utf16be.toString("hex").toUpperCase()}>`;
}

/**
 * Produces a filesystem-safe export base name.
 * @param {string} value
 * @returns {string}
 */
function safeFileName(value) {
  return String(value || "deck").replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}
