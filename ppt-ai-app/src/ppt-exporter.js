import { readFileSync } from "node:fs";

import { AppError } from "./errors.js";
import { resolveTemplateVisual } from "./templates.js";
import {
  masterBackgroundFile,
  masterBusinessMedia,
  masterCanvasMetrics,
  masterFont,
  masterMediaFiles,
  resolveMasterDescriptor,
} from "./master-templates.js";

const DEFAULT_SLIDE_METRICS = { width: 9144000, height: 5143500, scaleX: 1, scaleY: 1, type: "screen16x9" };
const STATUS_REPORT_MEDIA = {
  weekly: {
    file: "status-report-weekly.jpeg",
    content: readFileSync(new URL("../../templates/official/dome/assets/dome-business-4.jpeg", import.meta.url)),
  },
  steering: {
    file: "status-report-steering.jpeg",
    content: readFileSync(new URL("../../templates/official/dome/assets/dome-business-2.jpeg", import.meta.url)),
  },
  delivery: {
    file: "status-report-delivery.jpeg",
    content: readFileSync(new URL("../../templates/official/dome/assets/dome-business-6.jpeg", import.meta.url)),
  },
};
const STRATEGY_CONSULTING_MEDIA = {
  board: {
    file: "strategy-board.jpeg",
    content: readFileSync(new URL("../../templates/official/dome/assets/dome-business-1.jpeg", import.meta.url)),
  },
  matrix: {
    file: "strategy-matrix.jpeg",
    content: readFileSync(new URL("../../templates/official/dome/assets/dome-business-5.jpeg", import.meta.url)),
  },
  workstream: {
    file: "strategy-workstream.jpeg",
    content: readFileSync(new URL("../../templates/official/dome/assets/dome-business-6.jpeg", import.meta.url)),
  },
};
// "Dome" 命名形状在无显式字体时的兜底中文重字体(仅 master 渲染代码会产生这类命名)。
const DOME_TEXT_FONT = "Source Han Sans CN Heavy";
const DOME_AGENDA_DEFAULT_ITEMS = ["工作汇报", "成果展示", "问题不足", "下步计划"];

function normalizeHexColor(hex) {
  const normalized = String(hex || "000000").replace(/^#/, "").trim().padEnd(6, "0").slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "000000";
  return normalized.toUpperCase();
}

function blendHexColor(base, blend, amount = 0.5) {
  const baseHex = normalizeHexColor(base);
  const blendHex = normalizeHexColor(blend);
  const ratio = Math.max(0, Math.min(1, amount));
  const baseR = Number.parseInt(baseHex.slice(0, 2), 16);
  const baseG = Number.parseInt(baseHex.slice(2, 4), 16);
  const baseB = Number.parseInt(baseHex.slice(4, 6), 16);
  const blendR = Number.parseInt(blendHex.slice(0, 2), 16);
  const blendG = Number.parseInt(blendHex.slice(2, 4), 16);
  const blendB = Number.parseInt(blendHex.slice(4, 6), 16);
  const r = Math.round(baseR * (1 - ratio) + blendR * ratio);
  const g = Math.round(baseG * (1 - ratio) + blendG * ratio);
  const b = Math.round(baseB * (1 - ratio) + blendB * ratio);
  return `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

function redGoldColorPalette(visual) {
  const primary = normalizeHexColor(visual?.primary);
  const accent = normalizeHexColor(visual?.accent);
  const surface = normalizeHexColor(visual?.surface || "FFFFFF");
  const neutralTint = blendHexColor(surface, "F8FAFC", 0.72);
  return {
    titleGradientStart: blendHexColor(primary, "FFFFFF", 0.55),
    titleGradientEnd: blendHexColor(primary, accent, 0.28),
    cardFill: blendHexColor(accent, surface, 0.24),
    cardFillStrong: blendHexColor(accent, surface, 0.34),
    contentPanel: blendHexColor(surface, neutralTint, 0.18),
    bottomGradientHigh: blendHexColor(primary, "FFFFFF", 0.70),
    bottomGradientMid: blendHexColor(accent, "FFFFFF", 0.30),
    bottomGradientLow: blendHexColor(primary, "0F172A", 0.48),
    surfaceText: "FFFFFF",
    surfaceHighlight: blendHexColor(surface, "FFFFFF", 0.10),
    surfaceDecor: blendHexColor(surface, primary, 0.05),
    surfaceStroke: blendHexColor(surface, primary, 0.09),
    softLine: blendHexColor(surface, primary, 0.12),
    cardStroke: blendHexColor(accent, "64748B", 0.22),
    frameStroke: blendHexColor(primary, accent, 0.16),
    softRgb: `${Number.parseInt(accent.slice(0, 2), 16)},${Number.parseInt(accent.slice(2, 4), 16)},${Number.parseInt(accent.slice(4, 6), 16)}`,
    primaryRgb: `${Number.parseInt(primary.slice(0, 2), 16)},${Number.parseInt(primary.slice(2, 4), 16)},${Number.parseInt(primary.slice(4, 6), 16)}`,
  };
}

function topBandColorPalette(visual) {
  const primary = normalizeHexColor(visual?.primary);
  const accent = normalizeHexColor(visual?.accent);
  const surface = normalizeHexColor(visual?.surface || "FFFFFF");
  const background = normalizeHexColor(visual?.background || "F8FAFC");
  return {
    surface: blendHexColor(surface, "FFFFFF", 0.08),
    panel: blendHexColor(surface, background, 0.26),
    panelFrame: blendHexColor(primary, accent, 0.28),
    panelSheen: blendHexColor(surface, primary, 0.07),
    ambient: blendHexColor(surface, "F8FAFC", 0.92),
    rail: blendHexColor(primary, "0F172A", 0.18),
    stripe: blendHexColor(accent, background, 0.34),
    sheen: blendHexColor(surface, primary, 0.12),
    footer: blendHexColor(surface, primary, 0.18),
    rule: blendHexColor(primary, accent, 0.50),
    indexTag: blendHexColor(primary, accent, 0.38),
    titleGradientStart: blendHexColor(primary, "FFFFFF", 0.56),
    titleGradientEnd: blendHexColor(primary, accent, 0.20),
    marker: blendHexColor(accent, primary, 0.45),
    ribbon: blendHexColor(primary, accent, 0.36),
    edge: blendHexColor(primary, background, 0.12),
    glow: blendHexColor(surface, accent, 0.18),
    lightLine: blendHexColor(background, "FFFFFF", 0.88),
    ruleLine: blendHexColor(accent, primary, 0.42),
    panelShadow: blendHexColor(accent, "1F2937", 0.12),
    focus: blendHexColor(primary, accent, 0.18),
    glass: blendHexColor(surface, "FFFFFF", 0.30),
  };
}

/**
 * 将生成后的 deck 导出为可下载文件。
 */
export class PptExportService {
  /**
   * 按请求格式导出 deck。
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
   * 创建最小可打开的 Office Open XML PPTX 包。
   * red-gold 模板会在这里注入 dome.pptx 的媒体资源、主题字体和版式装饰。
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
      fileName: exportFileName({ deck, format: "pptx" }),
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      content: createZip(files),
    };
  }

  /**
   * 创建带 xref 和 trailer 的最小 PDF。
   * PDF 导出是文本摘要，不承担 dome.pptx 视觉复刻职责。
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
      fileName: exportFileName({ deck, format: "pdf" }),
      mimeType: "application/pdf",
      content: Buffer.from(content, "utf8"),
    };
  }
}

/**
 * 构建 PDF 文本流，每行内容对应一个绝对定位的文本操作。
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
 * 解析 deck 使用的视觉配置，兼容用户模板保存下来的 visual 快照。
 * @param {object} deck
 * @returns {object}
 */
function resolveDeckVisual(deck) {
  return resolveTemplateVisual({
    templateId: deck.templateId,
    theme: deck.theme,
    template: { id: deck.templateId, name: deck.templateName, visual: deck.templateVisual },
  });
}

/**
 * 将六位十六进制颜色转换成 PDF 填充色操作。
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
 * 格式化 PDF 颜色通道，避免输出冗余小数。
 * @param {number} value
 * @returns {string}
 */
function formatPdfNumber(value) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0");
}

/**
 * 创建一条绝对定位的 PDF 文本操作。
 * @param {{text: unknown, size: number, x: number, y: number}} input
 * @returns {string}
 */
function pdfTextLine({ text, size, x, y }) {
  return `/F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm ${pdfUnicodeText(text)} Tj`;
}

/**
 * 将长文本切成较短的 PDF 行，避免一行撑出页面。
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
 * 创建 PPTX 内容类型清单。
 * @param {object} deck
 * @returns {string}
 */
function contentTypesXml(deck) {
  const slides = deck.slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides}<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`;
}

/**
 * 创建 PPTX 根 relationships 元数据。
 * @returns {string}
 */
function packageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`;
}

/**
 * 创建 presentation.xml。
 * red-gold 使用 dome.pptx 的真实画布尺寸，其他模板保持原 16:9 screen 尺寸。
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
 * 创建 presentation.xml.rels，把每页 slide 和 slide master 连接起来。
 * @param {object} deck
 * @returns {string}
 */
function presentationRelsXml(deck) {
  const rels = deck.slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${deck.slides.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`;
}

/**
 * 创建每页 slide XML 和对应 relationships。
 * 这里负责把结构化 slides 映射到 dome 角色、插入装饰层、文本层和媒体关系。
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
    const masterDescriptor = resolveMasterDescriptor(visual);
    const fontFace = masterDescriptor ? masterFont(masterDescriptor) : "";
    const titleFillStyle = visual.layout === "top-band" ? topBandTitleFillStyle(visual) : domeTitleFillStyle(visual, role);
    const renderBodyList = shouldRenderDomeBodyList(visual, role);
    const bullets = renderBodyList
      ? (slide.bullets || []).map((bullet) => `<a:p><a:pPr marL="342900" indent="-171450"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="zh-CN" sz="${bodySize}">${fontFaceXml(fontFace)}<a:solidFill><a:srgbClr val="${bodyColor}"/></a:solidFill></a:rPr><a:t>${escapeXml(bullet)}</a:t></a:r></a:p>`).join("")
      : "";
    // dome 模板页的 bullets 已经进入专用卡片/副标题/指标等占位符，不再输出空的普通正文框。
    const bodyShape = renderBodyList
      ? textShapeXml({ id: 21, name: "Content 2", ...layout.content, body: bullets || paragraphXml("", bodySize, false, bodyColor, fontFace), size: bodySize, bold: false, color: bodyColor, fontFace })
      : "";
    const titleName = domeTitleShapeName(visual, role);
    const titleSize = resolveTitleSize({ visual, index, title: slide.title, fallbackSize: layout.titleSize });
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${groupShapeXml()}${templateDecorationsXml(visual, index, layout, role, slide)}${textShapeXml({ id: 20, name: titleName, ...layout.title, text: slide.title, size: titleSize, bold: true, color: titleColor, fontFace, fillStyle: titleFillStyle })}${bodyShape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
    files[`ppt/slides/slide${index + 1}.xml`] = scaleTemplateGeometryXml(slideXml, visual);
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = slideRelsXml(visual, role);
  }
  return files;
}

/**
 * 判断 dome 标题是否需要使用封面同款金色渐变。
 * 内容页标题应使用深红实色；只有红底封面、目录、章节分隔和结束页使用金色渐变标题。
 * @param {object} visual
 * @param {string} role
 * @returns {string}
 */
function domeTitleFillStyle(visual, role) {
  if (visual.layout !== "red-gold") return "";
  if (!["cover", "agenda", "section-divider", "closing"].includes(role)) return "";
  const redGoldPalette = redGoldColorPalette(visual);
  return `dome-gold-gradient:${redGoldPalette.titleGradientStart}:${redGoldPalette.titleGradientEnd}`;
}

function topBandTitleFillStyle(visual) {
  if (visual.layout !== "top-band") return "";
  return "";
}

/**
 * 为 red-gold 标题对象设置可读名称，方便在 PPT 编辑器里识别 dome 页面层级。
 * @param {object} visual
 * @param {string} role
 * @returns {string}
 */
function resolveTitleSize({ visual, index, title, fallbackSize }) {
  if (!["top-band", "status-report"].includes(visual.layout)) return fallbackSize;
  const textLength = String(title || "").replace(/\s+/g, "").length;
  if (visual.layout === "status-report") {
    if (index === 0) {
      if (textLength >= 26) return 3000;
      if (textLength >= 18) return 3400;
      return Math.min(fallbackSize, 4000);
    }
    if (textLength >= 24) return 2400;
    if (textLength >= 16) return 2850;
    return Math.min(fallbackSize, 3300);
  }
  if (index === 0) {
    if (textLength >= 28) return 3000;
    if (textLength >= 20) return 3400;
    if (textLength >= 14) return 3800;
    return Math.min(fallbackSize, 4300);
  }
  if (textLength >= 28) return 2300;
  if (textLength >= 22) return 2600;
  if (textLength >= 16) return 3000;
  return Math.min(fallbackSize, 3400);
}

function domeTitleShapeName(visual, role) {
  if (visual.layout !== "red-gold") return "Title 1";
  const mapping = {
    cover: "Dome Cover Title",
    agenda: "Dome Agenda Title",
    "section-divider": "Dome Section Title",
    closing: "Dome Closing Title",
  };
  return mapping[role] || "Dome Content Title";
}

/**
 * 判断当前 dome 页面是否还需要普通正文列表。
 * 封面、目录、步骤、指标、复盘和计划页已经把 bullets 填进专用占位符，不再重复显示一份普通列表。
 * @param {object} visual
 * @param {string} role
 * @returns {boolean}
 */
function shouldRenderDomeBodyList(visual, role) {
  if (visual.layout !== "red-gold") return true;
  return !["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"].includes(role);
}

/**
 * 根据模板选择 PPT 画布尺寸。
 * dome.pptx 原始文件是 12192000 x 6858000；其他模板继续使用现有 16:9 screen 尺寸，避免影响旧导出。
 * @param {object} visual
 * @returns {{width: number, height: number, scaleX: number, scaleY: number, type?: string}}
 */
function slideMetrics(visual) {
  const descriptor = resolveMasterDescriptor(visual);
  return descriptor ? masterCanvasMetrics(descriptor) : DEFAULT_SLIDE_METRICS;
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
    const redGoldPalette = redGoldColorPalette(visual);
    const isCover = ["cover", "closing"].includes(role);
    const background = pictureXml({
      id: 3,
      name: isCover ? "Dome Cover Sailboat Background" : "Dome Red Gold Background",
      relId: "rId2",
      x: 0,
      y: 0,
      cx: 9144000,
      cy: 5143500,
    });
    const frame = lineFrameShapeXml({
      id: 17,
      name: "Dome Outer Frame",
      x: 120650,
      y: 120650,
      cx: 8902700,
      cy: 4902200,
      stroke: redGoldPalette.frameStroke,
      width: 19050,
    });
    const contentFrame = ["cover", "closing"].includes(role)
      ? ""
      : lineFrameShapeXml({
          id: 18,
          name: "Dome Content Frame",
          x: 609600,
          y: 457200,
          cx: 7924800,
          cy: 4219260,
          stroke: redGoldPalette.surfaceStroke,
          width: 15240,
        });
    // dome.pptx 底部是多层金色弧线和色块叠出的波浪，不只是单块红色背景；这里保留色带并补充圆弧线条层。
    const topGuard = solidShapeXml({ id: 4, name: "Dome Top Guard", x: 0, y: 0, cx: 9144000, cy: 365760, fill: redGoldPalette.surfaceStroke })
      + solidShapeXml({ id: 12, name: "Dome Edge Accent", x: 685800, y: 114300, cx: 7772400, cy: 45720, fill: redGoldPalette.surfaceText });
    const waves = solidShapeXml({ id: 5, name: "Lower Gold Wave", geom: "parallelogram", x: -304800, y: 3921120, cx: 4876800, cy: 889540, fill: redGoldPalette.surfaceDecor })
      + solidShapeXml({ id: 6, name: "Lower Light Wave", geom: "parallelogram", x: 2590800, y: 3695328, cx: 5181600, cy: 889540, fill: blendHexColor(redGoldPalette.surfaceDecor, redGoldPalette.surfaceText, 0.15) })
      + solidShapeXml({ id: 7, name: "Lower Red Wave", geom: "parallelogram", x: 0, y: 4495800, cx: 9144000, cy: 762000, fill: redGoldPalette.bottomGradientLow })
      + arcLineShapeXml({ id: 13, name: "Dome Gold Wave Arc", x: -533400, y: 3505200, cx: 4876800, cy: 1447800, stroke: redGoldPalette.titleGradientStart, width: 57150 })
      + arcLineShapeXml({ id: 14, name: "Dome Light Wave Arc", x: 2514600, y: 3333750, cx: 5486400, cy: 1629416, stroke: redGoldPalette.titleGradientEnd, width: 45720 });
    // 页脚只保留装饰线，不写入模板名称，避免下载后的 PPTX 页面出现模板来源文字。
    const footer = rectShapeXml({ id: 15, name: "Gold Hairline", x: 0, y: isCover ? 4572000 : 685800, cx: 9144000, cy: 30480, fill: visual.accent });
    const roleDecoration = domeRoleDecorationXml({ role, index, layout, visual, slide });
    return base
      + background
      + frame
      + contentFrame
      + topGuard
      + waves
      + footer
      + roleDecoration;
  }
  if (visual.layout === "status-report") {
    const isCover = index === 0;
    const palette = statusReportColorPalette(visual);
    const scene = statusReportScene(visual);
    const sectionLabel = isCover ? scene.kicker : scene.section;
    const metrics = isCover
      ? statusReportMetricCardsXml({ visual, palette, metrics: scene.metrics })
      : statusReportChecklistXml({ visual, palette });
    const sticker = statusReportStickerXml({ visual, palette, scene });
    return base
      + solidShapeXml({ id: 3, name: "Status Report Surface", geom: "roundRect", ...layout.surface, fill: visual.surface })
      + solidShapeXml({ id: 4, name: "Status Report Header", x: 0, y: 0, cx: 9144000, cy: 609600, fill: visual.primary })
      + rectShapeXml({ id: 5, name: "Status Report Header Accent", x: 0, y: 579120, cx: 9144000, cy: 30480, fill: visual.accent })
      + rectShapeXml({ id: 6, name: "Status Report Leading Rule", x: 685800, y: 685800, cx: 1676400, cy: 38100, fill: visual.accent })
      + lineFrameShapeXml({ id: 7, name: "Status Report Content Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
      + pictureXml({ id: 8, name: "Status Report Business Image", relId: "rId2", x: 6172200, y: 1371600, cx: 2133600, cy: 1524000 })
      + lineFrameShapeXml({ id: 9, name: "Status Report Image Frame", geom: "roundRect", x: 6065520, y: 1264920, cx: 2133600, cy: 1524000, stroke: visual.accent, width: 15240 })
      + solidShapeXml({ id: 10, name: "Status Report Side Motif", geom: "roundRect", ...layout.secondaryAccent, fill: visual.accent })
      + textShapeXml({ id: 11, name: "Status Report Section Label", ...layout.label, text: sectionLabel, size: 1050, bold: true, color: visual.accent })
      + statusReportTimelineXml({ visual, palette })
      + sticker
      + metrics;
  }
  if (visual.layout === "marketing") {
    const isCover = index === 0;
    const palette = marketingCampaignColorPalette(visual);
    const scene = marketingCampaignScene(visual);
    const sectionLabel = isCover ? scene.kicker : scene.section;
    const coverWash = isCover
      ? solidShapeXml({ id: 301, name: "Marketing Cover Wash", geom: "roundRect", x: 609600, y: 609600, cx: 7924800, cy: 3886200, fill: palette.coverWash })
      : solidShapeXml({ id: 301, name: "Marketing Content Wash", geom: "roundRect", x: 571500, y: 800100, cx: 8001000, cy: 3771900, fill: palette.coverWash });
    const metrics = isCover
      ? marketingCampaignMetricCardsXml({ visual, palette, metrics: scene.metrics })
      : marketingCampaignChannelCardsXml({ visual, palette });
    return base
      + coverWash
      + solidShapeXml({ id: 302, name: "Marketing Primary Strip", x: 0, y: 0, cx: 9144000, cy: isCover ? 609600 : 342900, fill: visual.primary })
      + solidShapeXml({ id: 303, name: "Marketing Accent Beam", geom: "parallelogram", x: isCover ? 5486400 : 6096000, y: isCover ? 914400 : 609600, cx: 2133600, cy: 304800, fill: visual.accent })
      + lineFrameShapeXml({ id: 304, name: "Marketing Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
      + textShapeXml({ id: 305, name: "Marketing Section Label", ...layout.label, text: sectionLabel, size: 980, bold: true, color: visual.accent })
      + solidShapeXml({ id: 306, name: "Marketing Chip", geom: "roundRect", x: isCover ? 6934200 : 7002780, y: isCover ? 914400 : 914400, cx: isCover ? 1066800 : 914400, cy: 304800, fill: palette.chip })
      + textShapeXml({ id: 307, name: "Marketing Chip Text", x: isCover ? 7086600 : 7132320, y: 975360, cx: isCover ? 762000 : 640080, cy: 152400, text: scene.chip, size: 780, bold: true, color: "FFFFFF" })
      + solidShapeXml({ id: 308, name: "Marketing Focus Line", x: 914400, y: isCover ? 3345180 : 1577340, cx: 3657600, cy: 22860, fill: visual.accent })
      + marketingCampaignVisualXml({ visual, palette, scene, isCover })
      + metrics
      + textShapeXml({ id: 340, name: "Marketing Caption", x: isCover ? 6248400 : 6248400, y: isCover ? 3429000 : 3200400, cx: isCover ? 2133600 : 1981200, cy: 182880, text: scene.caption, size: isCover ? 820 : 760, bold: true, color: visual.body });
  }
  if (visual.layout === "brand-story") {
    const isCover = index === 0;
    const palette = brandStoryColorPalette(visual);
    const scene = brandStoryScene(visual);
    const surface = isCover
      ? solidShapeXml({ id: 401, name: "Brand Story Cover Canvas", x: 609600, y: 609600, cx: 7924800, cy: 3886200, fill: palette.coverWash })
      : solidShapeXml({ id: 401, name: "Brand Story Content Canvas", x: 571500, y: 762000, cx: 8001000, cy: 3810000, fill: palette.coverWash });
    const narrativeStrip = isCover
      ? brandStoryPointCardsXml({ visual, palette, scene })
      : brandStoryIndexCardsXml({ visual, palette });
    return base
      + surface
      + solidShapeXml({ id: 402, name: "Brand Story Spine", x: 0, y: 0, cx: 1158240, cy: 5143500, fill: visual.primary })
      + rectShapeXml({ id: 403, name: "Brand Story Header Rule", x: 685800, y: isCover ? 708660 : 609600, cx: 7772400, cy: 30480, fill: visual.accent })
      + lineFrameShapeXml({ id: 404, name: "Brand Story Editorial Frame", ...layout.surface, stroke: palette.frame, width: 15240 })
      + textShapeXml({ id: 405, name: "Brand Story Kicker", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 900, bold: true, color: visual.accent })
      + solidShapeXml({ id: 406, name: `Brand Story ${scene.variant} Chip`, x: isCover ? 6888480 : 6979920, y: isCover ? 876300 : 800100, cx: 1066800, cy: 304800, fill: palette.chip })
      + textShapeXml({ id: 407, name: "Brand Story Chip Text", x: isCover ? 7040880 : 7132320, y: isCover ? 937260 : 861060, cx: 762000, cy: 152400, text: scene.chip, size: 760, bold: true, color: "FFFFFF" })
      + textShapeXml({ id: 408, name: "Brand Story Monogram", x: 7040880, y: isCover ? 1173480 : 1066800, cx: 1066800, cy: 365760, text: scene.mark, size: isCover ? 2200 : 1700, bold: true, color: palette.monogram })
      + solidShapeXml({ id: 409, name: "Brand Story Focus Rule", x: 914400, y: isCover ? 3345180 : 1630680, cx: 3810000, cy: 22860, fill: visual.accent })
      + brandStoryVisualXml({ visual, palette, scene, isCover })
      + narrativeStrip
      + textShapeXml({ id: 450, name: "Brand Story Caption", x: isCover ? 6248400 : 6248400, y: isCover ? 3497580 : 3230880, cx: 2133600, cy: 182880, text: scene.caption, size: isCover ? 800 : 740, bold: true, color: visual.body });
  }
  if (visual.layout === "data-insight") {
    const isCover = index === 0;
    const palette = dataInsightColorPalette(visual);
    const scene = dataInsightScene(visual);
    const surface = isCover
      ? solidShapeXml({ id: 501, name: "Data Insight Cover Dashboard Canvas", geom: "roundRect", x: 609600, y: 609600, cx: 7924800, cy: 3886200, fill: palette.coverWash })
      : solidShapeXml({ id: 501, name: "Data Insight Content Analysis Canvas", geom: "roundRect", x: 571500, y: 762000, cx: 8001000, cy: 3810000, fill: palette.coverWash });
    const lowerData = isCover
      ? dataInsightMetricCardsXml({ visual, palette, metrics: scene.metrics })
      : dataInsightSignalCardsXml({ visual, palette });
    return base
      + surface
      + solidShapeXml({ id: 502, name: "Data Insight Top Bar", x: 0, y: 0, cx: 9144000, cy: isCover ? 609600 : 365760, fill: visual.primary })
      + rectShapeXml({ id: 503, name: "Data Insight Accent Rule", x: 685800, y: isCover ? 708660 : 609600, cx: 7772400, cy: 30480, fill: visual.accent })
      + lineFrameShapeXml({ id: 504, name: "Data Insight Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
      + textShapeXml({ id: 505, name: "Data Insight Kicker", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 880, bold: true, color: visual.accent })
      + solidShapeXml({ id: 506, name: `Data Insight ${scene.variant} Chip`, geom: "roundRect", x: isCover ? 6979920 : 7040880, y: isCover ? 899160 : 800100, cx: 944880, cy: 304800, fill: palette.chip })
      + textShapeXml({ id: 507, name: "Data Insight Chip Text", x: isCover ? 7132320 : 7193280, y: isCover ? 960120 : 861060, cx: 640080, cy: 152400, text: scene.chip, size: 760, bold: true, color: "FFFFFF" })
      + rectShapeXml({ id: 508, name: "Data Insight Scan Line", x: 914400, y: isCover ? 3337560 : 1577340, cx: 3657600, cy: 22860, fill: visual.accent })
      + dataInsightVisualXml({ visual, palette, scene, isCover })
      + lowerData
      + textShapeXml({ id: 550, name: "Data Insight Caption", x: isCover ? 6248400 : 6248400, y: isCover ? 3505200 : 3230880, cx: 2133600, cy: 182880, text: scene.caption, size: isCover ? 800 : 740, bold: true, color: visual.body });
  }
  if (visual.layout === "education-course") {
    const isCover = index === 0;
    const palette = educationCourseColorPalette(visual);
    const scene = educationCourseScene(visual);
    const surface = isCover
      ? solidShapeXml({ id: 601, name: "Education Course Cover Canvas", geom: "roundRect", x: 731520, y: 762000, cx: 7680960, cy: 3604260, fill: palette.board })
      : solidShapeXml({ id: 601, name: "Education Course Content Canvas", x: 804672, y: 685800, cx: 7533648, cy: 3810000, fill: palette.coverWash });
    const lowerItems = isCover
      ? educationCourseOutcomeCardsXml({ visual, palette, outcomes: scene.outcomes })
      : educationCourseNoteCardsXml({ visual, palette });
    return base
      + surface
      + (isCover
        ? rectShapeXml({ id: 602, name: "Education Course Chalk Tray", x: 914400, y: 4008120, cx: 7315200, cy: 60960, fill: visual.accent })
        : rectShapeXml({ id: 602, name: "Education Course Binder Rail", x: 804672, y: 685800, cx: 91440, cy: 3810000, fill: visual.primary }))
      + rectShapeXml({ id: 603, name: "Education Course Lesson Rule", x: isCover ? 1097280 : 1097280, y: isCover ? 4038600 : 914400, cx: isCover ? 6705600 : 6096000, cy: 22860, fill: visual.accent })
      + textShapeXml({ id: 605, name: "Education Course Kicker", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 880, bold: true, color: isCover ? visual.accent : visual.primary })
      + solidShapeXml({ id: 606, name: `Education Course ${scene.variant} Chip`, x: isCover ? 6812280 : 6812280, y: isCover ? 1051560 : 822960, cx: 1066800, cy: 274320, fill: isCover ? visual.accent : palette.chip })
      + textShapeXml({ id: 607, name: "Education Course Chip Text", x: isCover ? 6957060 : 6964680, y: isCover ? 1104900 : 876300, cx: 731520, cy: 137160, text: scene.chip, size: 720, bold: true, color: isCover ? visual.primary : "FFFFFF" })
      + educationCourseVisualXml({ visual, palette, scene, isCover })
      + lowerItems
      + textShapeXml({ id: 650, name: "Education Course Caption", x: isCover ? 6126480 : 6126480, y: isCover ? 3474720 : 3657600, cx: 1828800, cy: 182880, text: scene.caption, size: isCover ? 740 : 720, bold: true, color: isCover ? palette.chalk : visual.body });
  }
  if (["executive", "academy", "venture"].includes(visual.layout)) {
    if (isPitchDeckVisual(visual)) {
      return base + pitchDeckDecorationsXml({ visual, index, layout });
    }
    const strategyDecorations = isStrategyConsultingVisual(visual)
      ? strategyConsultingDecorationsXml({ visual, index, layout })
      : "";
    const financeDecorations = isFinancialReviewVisual(visual)
      ? financialReviewDecorationsXml({ visual, index, layout })
      : "";
    const salesDecorations = isSalesProposalVisual(visual)
      ? salesProposalDecorationsXml({ visual, index, layout })
      : "";
    const productDecorations = isProductRoadmapVisual(visual)
      ? productRoadmapDecorationsXml({ visual, index, layout })
      : "";
    const secondaryAccent = isSalesProposalVisual(visual) || isProductRoadmapVisual(visual)
      ? ""
      : rectShapeXml({ id: 5, name: "Secondary Accent", ...layout.secondaryAccent, fill: visual.accent });
    return base
      + rectShapeXml({ id: 8, name: "Soft Page Layer", x: 342900, y: 342900, cx: 8458200, cy: 4457700, fill: visual.surface })
      + rectShapeXml({ id: 3, name: "Hero Surface", ...layout.surface, fill: visual.surface })
      + rectShapeXml({ id: 4, name: "Primary Accent", ...layout.accent, fill: visual.primary })
      + secondaryAccent
      + rectShapeXml({ id: 6, name: "Top Rule", x: 685800, y: 342900, cx: 7772400, cy: 30480, fill: visual.accent })
      + rectShapeXml({ id: 9, name: "Fine Divider", x: 914400, y: index === 0 ? 2743200 : 1516380, cx: 4267200, cy: 15240, fill: visual.accent })
      + strategyDecorations
      + financeDecorations
      + salesDecorations
      + productDecorations
      // 封面不再写模板名称；非封面仍保留页序标签。
      + textShapeXml({ id: 7, name: "Section Label", ...layout.label, text: isStrategyConsultingVisual(visual) || isFinancialReviewVisual(visual) || isSalesProposalVisual(visual) || isProductRoadmapVisual(visual) || index === 0 ? "" : `0${index + 1}`, size: 1200, bold: true, color: index === 0 ? visual.surface : visual.accent });
  }
  if (visual.layout === "top-band") {
    const isCover = index === 0;
    const panelY = isCover ? 914400 : 685800;
    const panelHeight = isCover ? 3657600 : 4114800;
    const panelBottom = panelY + panelHeight;
    const palette = topBandColorPalette(visual);
    const ambientY = isCover ? 228600 : panelY + 228600;
    const ambientHeight = isCover ? 365760 : 182880;
    const ambientSweep = solidShapeXml({ id: 35, name: "Top Band Ambient Sweep", x: 685800, y: ambientY, cx: 7772400, cy: ambientHeight, fill: palette.ambient });
    const roleDecor = isCover
      ? (
          solidShapeXml({ id: 24, name: "Top Band Hero Halo", geom: "roundRect", x: 457200, y: 457200, cx: 8229600, cy: 742950, fill: palette.glow })
          + rectShapeXml({ id: 25, name: "Top Band Cover Accent Band", x: 0, y: 120650, cx: 9144000, cy: 121920, fill: palette.lightLine })
          + solidShapeXml({ id: 26, name: "Top Band Cover Glow", geom: "ellipse", x: 1600200, y: panelY + 228600, cx: 450000, cy: 450000, fill: palette.glass })
          + solidShapeXml({ id: 29, name: "Top Band Cover Halo", x: 685800, y: 365760, cx: 7772400, cy: 182880, fill: palette.panelSheen })
          + lineFrameShapeXml({
            id: 27,
            name: "Top Band Cover Focus Frame",
            geom: "roundRect",
            x: 285750,
            y: 685800,
            cx: 8572500,
            cy: 3327400,
            stroke: palette.ruleLine,
            width: 15240,
          })
          + lineFrameShapeXml({
            id: 28,
            name: "Top Band Cover Detail Stripe",
            x: 342900,
            y: 1714500,
            cx: 8382000,
            cy: 152400,
            stroke: palette.panelShadow,
            width: 7620,
          })
          + lineFrameShapeXml({
            id: 30,
            name: "Top Band Cover Accent Ring",
            geom: "ellipse",
            x: 685800,
            y: 685800,
            cx: 1778000,
            cy: 228600,
            stroke: palette.rule,
            width: 11430,
          })
          + solidShapeXml({ id: 31, name: "Top Band Executive Visual Panel", geom: "roundRect", x: 6553200, y: 1295400, cx: 1549400, cy: 2019300, fill: palette.rail })
          + lineFrameShapeXml({ id: 32, name: "Top Band Executive Visual Inner Frame", geom: "roundRect", x: 6667500, y: 1409700, cx: 1320800, cy: 1790700, stroke: palette.glass, width: 7620 })
          + rectShapeXml({ id: 33, name: "Top Band Executive Visual Accent", x: 6858000, y: 3009900, cx: 952500, cy: 38100, fill: visual.accent })
          + topBandMetricCardXml({ id: 37, x: 1282700, y: 3657600, number: "01", label: "战略", visual, palette })
          + topBandMetricCardXml({ id: 40, x: 3200400, y: 3657600, number: "02", label: "复盘", visual, palette })
          + topBandMetricCardXml({ id: 43, x: 5118100, y: 3657600, number: "03", label: "行动", visual, palette })
        )
      : (
          rectShapeXml({ id: 24, name: "Top Band Side Rail", x: 0, y: panelY + 685800, cx: 171450, cy: 3657600, fill: palette.glass })
          + solidShapeXml({ id: 29, name: "Top Band Content Glow", x: 2286000, y: panelY + 165100, cx: 4572000, cy: 228600, fill: palette.panelSheen })
          + lineFrameShapeXml({ id: 25, name: "Top Band Content Rule", x: 228600, y: panelBottom - 685800, cx: 431800, cy: 120650, stroke: palette.rule, width: 7620 })
          + lineFrameShapeXml({
            id: 27,
            name: "Top Band Content Divider",
            x: 685800,
            y: panelY + 1302000,
            cx: 6400800,
            cy: 101600,
            stroke: palette.lightLine,
            width: 5715,
          })
          + solidShapeXml({ id: 31, name: "Top Band Content Visual Panel", geom: "roundRect", x: 6720840, y: 1543050, cx: 1270000, cy: 2133600, fill: palette.rail })
          + solidShapeXml({ id: 32, name: "Top Band Insight Card", geom: "roundRect", x: 6416040, y: 1847850, cx: 1676400, cy: 1117600, fill: palette.glass })
          + textShapeXml({ id: 33, name: "Top Band Insight Title", x: 6553200, y: 2076450, cx: 1219200, cy: 228600, text: "重点关注", size: 1050, bold: true, color: visual.title })
          + textShapeXml({ id: 34, name: "Top Band Insight Caption", x: 6553200, y: 2350000, cx: 1219200, cy: 365760, text: "高管决策视图", size: 800, bold: false, color: visual.body })
          + arcLineShapeXml({ id: 37, name: "Top Band Content Wave", x: 6248400, y: 3657600, cx: 2133600, cy: 762000, stroke: visual.accent, width: 19050 })
        );
    const contentPanelY = isCover ? panelY + 114300 : panelY + 152400;
    const contentPanelHeight = isCover ? panelHeight : panelHeight - 228600;
    return base
      + rectShapeXml({ id: 3, name: "Top Band Surface", ...layout.surface, fill: visual.surface })
      + ambientSweep
      + solidShapeXml({ id: 13, name: "Top Band Surface Sheen", x: 685800, y: contentPanelY, cx: 7772400, cy: contentPanelHeight, fill: palette.sheen })
      + solidShapeXml({ id: 9, name: "Top Band Content Panel", geom: "roundRect", x: 685800, y: contentPanelY, cx: 7772400, cy: contentPanelHeight, fill: palette.panel })
      + lineFrameShapeXml({ id: 10, name: "Top Band Panel Frame", geom: "roundRect", x: 571500, y: contentPanelY - 120650, cx: 7995900, cy: contentPanelHeight + 241300, stroke: palette.panelFrame, width: 15240 })
      + rectShapeXml({ id: 11, name: "Top Band Focus Stripe", x: 685800, y: isCover ? 228600 : 228600, cx: 8289600, cy: isCover ? 304800 : 228600, fill: palette.stripe })
      + rectShapeXml({ id: 4, name: "Primary Rail", x: 0, y: 0, cx: 228600, cy: 5143500, fill: palette.rail })
      + rectShapeXml({ id: 5, name: "Accent Header", ...layout.accent, fill: visual.accent })
      + lineFrameShapeXml({ id: 6, name: "Top Band Outline", x: 114300, y: 342900, cx: 8915400, cy: 4478700, stroke: palette.rule, width: 19050 })
      + rectShapeXml({ id: 12, name: "Top Band Signature", x: 914400, y: contentPanelY + (isCover ? 0 : 152400), cx: 228600, cy: 304800, fill: palette.footer })
      + rectShapeXml({ id: 14, name: "Top Band Marker Band", x: 4572000, y: contentPanelY + 228600, cx: 4064000, cy: isCover ? 152400 : 228600, fill: palette.marker })
      + solidShapeXml({ id: 17, name: "Top Band Accent Ribbon", geom: "parallelogram", x: 6553200, y: isCover ? 548640 : 365760, cx: 2311400, cy: 304800, fill: palette.ribbon })
      + rectShapeXml({ id: 18, name: "Top Band Side Cap", x: 114300, y: isCover ? 228600 : 152400, cx: 285750, cy: 685800, fill: palette.edge })
      + lineFrameShapeXml({ id: 36, name: "Top Band Panel Shadow", x: 628650, y: panelY - 120650, cx: 7886700, cy: panelHeight + 152400, stroke: palette.panelShadow, width: 5715 })
      + topBandGridXml({ id: 52, visual, palette })
      + roleDecor
      + textShapeXml({
        id: 7,
        name: "Section Label",
        ...layout.label,
        text: index === 0 ? "" : `0${index + 1}`,
        size: 1100,
        bold: true,
        color: index === 0 ? visual.surface : visual.accent,
      });
  }
  return base + rectShapeXml({ id: 3, name: "Template Accent", ...layout.accent, fill: visual.primary });
}

/**
 * 添加模板所需的媒体文件。
 * red-gold 会把从 dome.pptx 提取出的封面、内容背景和商务图片写入 ppt/media。
 * @param {object} visual
 * @returns {Record<string, Buffer>}
 */
function templateMediaFiles(visual) {
  const descriptor = resolveMasterDescriptor(visual);
  if (descriptor) return masterMediaFiles(descriptor);
  if (visual.layout === "status-report") {
    const media = statusReportMedia(visual);
    return { [`ppt/media/${media.file}`]: media.content };
  }
  if (isStrategyConsultingVisual(visual)) {
    const media = strategyConsultingMedia(visual);
    return { [`ppt/media/${media.file}`]: media.content };
  }
  return {};
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
  if (["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"].includes(explicit)) {
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
  if (/概况|汇报|图文|进展/i.test(String(slide?.title || ""))) return "image-report";
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
  const palette = redGoldColorPalette(visual);
  if (role === "cover") {
    const [subtitle] = normalizeDomeBulletItems(slide, 1);
    // 封面页用专用副标题承载用户输入，避免普通列表破坏 dome.pptx 的帆船封面留白。
    return rectShapeXml({ id: 8, name: "Dome Cover Halo", x: 0, y: 0, cx: 12192000, cy: 182880, fill: palette.surfaceStroke })
      + rectShapeXml({ id: 9, name: "Dome Cover Accent", x: 0, y: 6680200, cx: 12192000, cy: 120650, fill: palette.surfaceStroke })
      + textShapeXml({ id: 10, name: "Dome Cover Series Label", x: 609600, y: 4114800, cx: 3048000, cy: 365760, text: "BUSINESS REPORT", size: 1500, bold: true, color: palette.surfaceText })
      + textShapeXml({ id: 11, name: "Dome Cover Subtitle", x: 2971800, y: 3048000, cx: 3962400, cy: 365760, text: subtitle, size: 1500, bold: true, color: palette.surfaceText });
  }
  if (role === "agenda") {
    // 目录页固定输出 4 个卡片槽位，保持 dome.pptx 的卡片式目录骨架不因用户少填内容而变化。
    const agendaItems = normalizeDomeAgendaItems(slide);
    return agendaItems.map((item, itemIndex) => {
      const column = itemIndex % 2;
      const row = Math.floor(itemIndex / 2);
      const x = 1219200 + column * 3429000;
      const y = 1371600 + row * 1219200;
      return solidShapeXml({ id: 30 + itemIndex, name: `Dome Agenda Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 2743200, cy: 838200, fill: itemIndex % 2 === 0 ? palette.cardFill : palette.cardFillStrong })
        + lineFrameShapeXml({ id: 60 + itemIndex, name: `Dome Agenda Card Frame ${itemIndex + 1}`, geom: "roundRect", x: x - 60960, y: y - 60960, cx: 2865120, cy: 960120, stroke: palette.cardStroke, width: 19050 })
        + textShapeXml({ id: 40 + itemIndex, name: `Dome Agenda Number ${itemIndex + 1}`, x: x + 304800, y: y + 152400, cx: 609600, cy: 304800, text: `0${itemIndex + 1}`, size: 1800, bold: true, color: visual.title })
        + textShapeXml({ id: 50 + itemIndex, name: `Dome Agenda Text ${itemIndex + 1}`, x: x + 914400, y: y + 213360, cx: 1524000, cy: 365760, text: String(item), size: 1900, bold: true, color: visual.title });
    }).join("");
  }
  if (role === "section-divider") {
    return rectShapeXml({ id: 30, name: "Dome Section Divider Frame", x: 304800, y: 1238250, cx: 8534400, cy: 228600, fill: palette.surfaceStroke })
      + lineFrameShapeXml({ id: 33, name: "Dome Section Divider Frame Border", x: 273050, y: 1178560, cx: 8607600, cy: 353060, stroke: palette.cardStroke, width: 19050 })
      + textShapeXml({ id: 31, name: "Dome Section Number", ...layout.label, text: domeSectionNumberText(slide, index), size: 1800, bold: true, color: palette.surfaceText })
      + rectShapeXml({ id: 32, name: "Dome Section Divider Line", x: 3429000, y: 2743200, cx: 2286000, cy: 30480, fill: palette.surfaceStroke });
  }
  if (role === "three-steps" || role === "four-steps" || role === "next-plan") {
    const count = role === "three-steps" ? 3 : 4;
    const bulletItems = normalizeDomeBulletItems(slide, count);
    const planItems = role === "next-plan" ? normalizeDomePlanItems(slide, count) : [];
    // 流程和计划页也需要 dome.pptx 的浅色内容承载面，否则卡片会直接漂在红金背景上。
    const contentSurface = solidShapeXml({ id: 28, name: "Content Placement Card", geom: "roundRect", ...layout.surface, fill: palette.contentPanel });
    const sectionLabel = textShapeXml({ id: 80, name: "Section Label", ...layout.label, text: domeContentSectionLabelText(slide, index), size: 1500, bold: true, color: visual.accent });
    const steps = Array.from({ length: count }, (_, stepIndex) => {
      const x = 1219200 + stepIndex * (count === 3 ? 2286000 : 1752600);
      const y = 2895600;
      const cardWidth = count === 3 ? 1676400 : 1371600;
      const card = solidShapeXml({ id: 30 + stepIndex, name: `Dome Step ${stepIndex + 1}`, geom: "roundRect", x, y, cx: cardWidth, cy: 914400, fill: stepIndex % 2 === 0 ? palette.cardFill : palette.cardFillStrong })
        + lineFrameShapeXml({ id: 90 + stepIndex, name: `Dome Step Card Frame ${stepIndex + 1}`, geom: "roundRect", x: x - 76200, y: y - 76200, cx: cardWidth + 152400, cy: 1066800, stroke: palette.cardStroke, width: 19050 });
      if (role === "next-plan") {
        const planItem = planItems[stepIndex];
        return card
          + textShapeXml({ id: 40 + stepIndex, name: `Dome Next Plan Phase ${stepIndex + 1}`, x: x + 228600, y: y + 152400, cx: 914400, cy: 304800, text: planItem.phase, size: 1800, bold: true, color: visual.title })
          + textShapeXml({ id: 50 + stepIndex, name: `Dome Next Plan Action ${stepIndex + 1}`, x: x + 182880, y: y + 487680, cx: 1005840, cy: 304800, text: planItem.action, size: 1100, bold: true, color: visual.title });
      }
      return card
        + textShapeXml({ id: 40 + stepIndex, name: `Dome Step Number ${stepIndex + 1}`, x: x + 228600, y: y + 152400, cx: 914400, cy: 304800, text: `0${stepIndex + 1}`, size: 2200, bold: true, color: visual.title })
        + textShapeXml({ id: 50 + stepIndex, name: `Dome Step Text ${stepIndex + 1}`, x: x + 182880, y: y + 487680, cx: count === 3 ? 1310640 : 1005840, cy: 304800, text: bulletItems[stepIndex], size: 1200, bold: true, color: visual.title });
    }).join("");
    // 三/四步骤流程页增加横向连接线，让独立卡片形成清晰的流程关系。
    const stepConnector = role === "next-plan"
      ? ""
      : rectShapeXml({ id: 72, name: `Dome Step Connector ${count}`, x: 1371600, y: 3352800, cx: count === 3 ? 5638800 : 6553200, cy: 30480, fill: palette.surfaceStroke });
    // 三步骤流程页补齐商务图片层，保持流程类内容页也有 dome.pptx 的图文商务气质。
    const threeStepsImage = role === "three-steps"
      ? pictureXml({ id: 69, name: "Dome Three Steps Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    // 四步骤流程页复用 dome.pptx 的第 4 张商务图，避免提取出的业务视觉资产闲置。
    const fourStepsImage = role === "four-steps"
      ? pictureXml({ id: 70, name: "Dome Four Steps Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    // 下一步计划页复用 dome.pptx 的第 6 张商务图，与预览端的 next-plan 视觉保持一致。
    const nextPlanImage = role === "next-plan"
      ? pictureXml({ id: 71, name: "Dome Next Plan Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    return role === "next-plan"
      ? contentSurface + sectionLabel + nextPlanImage + steps + rectShapeXml({ id: 70, name: "Dome Next Plan Timeline", x: 1219200, y: 2438400, cx: 6400800, cy: 30480, fill: visual.accent })
      : contentSurface + sectionLabel + threeStepsImage + fourStepsImage + stepConnector + steps;
  }
  if (role === "metrics") {
    const metricItems = normalizeDomeMetricItems(slide, 3);
    // 指标页保留浅色承载面和右上章节标签，使数据卡片与 dome.pptx 内容页层级一致。
    return solidShapeXml({ id: 28, name: "Content Placement Card", geom: "roundRect", ...layout.surface, fill: palette.contentPanel })
      + textShapeXml({ id: 33, name: "Section Label", ...layout.label, text: domeContentSectionLabelText(slide, index), size: 1500, bold: true, color: visual.accent })
      + pictureXml({ id: 29, name: "Dome Business Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      + Array.from({ length: 3 }, (_, metricIndex) => {
      const x = 1219200 + metricIndex * 2286000;
      const metricY = 2590800;
      const metric = metricItems[metricIndex];
      return solidShapeXml({ id: 30 + metricIndex, name: `Dome Metric Card ${metricIndex + 1}`, geom: "roundRect", x, y: metricY, cx: 1828800, cy: 1066800, fill: palette.cardFill })
        + lineFrameShapeXml({ id: 80 + metricIndex, name: `Dome Metric Card Frame ${metricIndex + 1}`, geom: "roundRect", x: x - 60960, y: metricY - 10560, cx: 1950720, cy: 1085760, stroke: palette.cardStroke, width: 19050 })
        + textShapeXml({ id: 40 + metricIndex, name: `Dome Metric Number ${metricIndex + 1}`, x: x + 228600, y: 2743200, cx: 1219200, cy: 304800, text: `0${metricIndex + 1}`, size: 1800, bold: true, color: visual.title })
        + textShapeXml({ id: 60 + metricIndex, name: `Dome Metric Value ${metricIndex + 1}`, x: x + 228600, y: 3048000, cx: 1371600, cy: 365760, text: metric.value, size: 2100, bold: true, color: visual.title })
        + textShapeXml({ id: 70 + metricIndex, name: `Dome Metric Label ${metricIndex + 1}`, x: x + 228600, y: 3505200, cx: 1371600, cy: 304800, text: metric.label, size: 1100, bold: true, color: visual.body });
    }).join("");
  }
  if (role === "showcase") {
    const showcaseItems = normalizeDomeBulletItems(slide, 3);
    // 成果展示页拆成编号和正文两个占位符，贴近 dome.pptx 的成果卡层级，而不是整段文本列表。
    const showcaseCards = Array.from({ length: 3 }, (_, cardIndex) => {
      const y = 2438400 + cardIndex * 640080;
      return solidShapeXml({ id: 34 + cardIndex, name: `Dome Showcase Card ${cardIndex + 1}`, geom: "roundRect", x: 1219200, y, cx: 3352800, cy: 457200, fill: cardIndex % 2 === 0 ? palette.cardFill : palette.cardFillStrong })
        + lineFrameShapeXml({ id: 64 + cardIndex, name: `Dome Showcase Card Frame ${cardIndex + 1}`, geom: "roundRect", x: 1158240, y: y - 30480, cx: 3464560, cy: 518160, stroke: palette.cardStroke, width: 19050 })
        + textShapeXml({ id: 44 + cardIndex, name: `Dome Showcase Number ${cardIndex + 1}`, x: 1447800, y: y + 121920, cx: 457200, cy: 213360, text: `0${cardIndex + 1}`, size: 1300, bold: true, color: visual.title })
        + textShapeXml({ id: 54 + cardIndex, name: `Dome Showcase Text ${cardIndex + 1}`, x: 1981200, y: y + 121920, cx: 2133600, cy: 213360, text: showcaseItems[cardIndex], size: 1200, bold: true, color: visual.title });
    }).join("");
    return solidShapeXml({ id: 31, name: "Content Placement Card", geom: "roundRect", ...layout.surface, fill: palette.contentPanel })
      + pictureXml({ id: 30, name: "Dome Showcase Image", relId: "rId3", x: 5334000, y: 1371600, cx: 2438400, cy: 1828800 })
      + solidShapeXml({ id: 32, name: "Right Golden Motif", geom: "roundRect", ...layout.secondaryAccent, fill: visual.accent })
      + textShapeXml({ id: 33, name: "Section Label", ...layout.label, text: domeContentSectionLabelText(slide, index), size: 1500, bold: true, color: visual.accent })
      + showcaseCards;
  }
  if (role === "retrospective") {
    const riskItems = normalizeDomeBulletItems(slide, 3);
    const retrospectiveLabels = ["风险", "原因", "措施"];
    // 问题复盘页将复盘语义标签和正文拆成固定占位符，便于结构化内容稳定落位。
    const retrospectiveCards = Array.from({ length: 3 }, (_, cardIndex) => {
      const y = 2438400 + cardIndex * 640080;
      return solidShapeXml({ id: 35 + cardIndex, name: `Dome Retrospective Card ${cardIndex + 1}`, geom: "roundRect", x: 1219200, y, cx: 3352800, cy: 457200, fill: cardIndex % 2 === 0 ? palette.cardFill : palette.cardFillStrong })
        + lineFrameShapeXml({ id: 67 + cardIndex, name: `Dome Retrospective Card Frame ${cardIndex + 1}`, geom: "roundRect", x: 1158240, y: y - 30480, cx: 3464560, cy: 518160, stroke: palette.cardStroke, width: 19050 })
        + textShapeXml({ id: 45 + cardIndex, name: `Dome Retrospective Label ${cardIndex + 1}`, x: 1447800, y: y + 106680, cx: 609600, cy: 243840, text: retrospectiveLabels[cardIndex], size: 1100, bold: true, color: visual.title })
        + textShapeXml({ id: 55 + cardIndex, name: `Dome Retrospective Text ${cardIndex + 1}`, x: 2133600, y: y + 121920, cx: 1981200, cy: 213360, text: riskItems[cardIndex], size: 1200, bold: true, color: visual.title });
    }).join("");
    return solidShapeXml({ id: 31, name: "Content Placement Card", geom: "roundRect", ...layout.surface, fill: palette.contentPanel })
      + pictureXml({ id: 30, name: "Dome Business Image", relId: "rId3", x: 5486400, y: 1524000, cx: 2133600, cy: 1371600 })
      + solidShapeXml({ id: 32, name: "Dome Retrospective Risk Card", geom: "roundRect", x: 5486400, y: 3200400, cx: 2133600, cy: 609600, fill: palette.cardFillStrong })
      + lineFrameShapeXml({ id: 70, name: "Dome Retrospective Risk Card Frame", geom: "roundRect", x: 5425440, y: 3193920, cx: 2255520, cy: 685800, stroke: palette.cardStroke, width: 19050 })
      + textShapeXml({ id: 34, name: "Dome Retrospective Risk Text", x: 5715000, y: 3352800, cx: 1676400, cy: 304800, text: riskItems[0], size: 1300, bold: true, color: visual.title })
      + textShapeXml({ id: 33, name: "Section Label", ...layout.label, text: domeContentSectionLabelText(slide, index), size: 1500, bold: true, color: visual.accent })
      + retrospectiveCards;
  }
  if (role === "closing") {
    const [subtitle] = normalizeDomeBulletItems(slide, 1);
    // 结束页使用专用副标题承载用户输入，不再退回普通项目符号列表。
    return textShapeXml({ id: 30, name: "Dome Closing Mark", x: 3200400, y: 2438400, cx: 2743200, cy: 457200, text: "THANKS", size: 2200, bold: true, color: palette.surfaceText })
      + textShapeXml({ id: 31, name: "Dome Closing Subtitle", x: 3200400, y: 3048000, cx: 2743200, cy: 365760, text: subtitle, size: 1300, bold: true, color: palette.surfaceText });
  }
  const imageReportItems = normalizeDomeBulletItems(slide, 3);
  // 工作汇报图文页使用三张汇报卡片承载结构化要点，右侧继续复用 dome.pptx 的商务配图。
  const imageReportCards = Array.from({ length: 3 }, (_, cardIndex) => {
    const y = 2438400 + cardIndex * 640080;
    return solidShapeXml({ id: 35 + cardIndex, name: `Dome Image Report Card ${cardIndex + 1}`, geom: "roundRect", x: 1219200, y, cx: 3352800, cy: 457200, fill: cardIndex % 2 === 0 ? palette.cardFill : palette.cardFillStrong })
      + lineFrameShapeXml({ id: 60 + cardIndex, name: `Dome Image Report Card Frame ${cardIndex + 1}`, geom: "roundRect", x: 1158240, y: y - 30480, cx: 3464560, cy: 518160, stroke: palette.cardStroke, width: 19050 })
      + textShapeXml({ id: 45 + cardIndex, name: `Dome Image Report Text ${cardIndex + 1}`, x: 1524000, y: y + 121920, cx: 2590800, cy: 213360, text: imageReportItems[cardIndex], size: 1200, bold: true, color: visual.title });
  }).join("");
  return solidShapeXml({ id: 31, name: "Content Placement Card", geom: "roundRect", ...layout.surface, fill: palette.contentPanel })
    + solidShapeXml({ id: 34, name: "Dome Image Placeholder", geom: "roundRect", x: 5486400, y: 1524000, cx: 2133600, cy: 1828800, fill: visual.accent })
    + pictureXml({ id: 30, name: "Dome Business Image", relId: domeRoleBusinessMedia(visual, role) ? "rId3" : "rId2", x: 5486400, y: 1524000, cx: 2133600, cy: 1828800 })
    + solidShapeXml({ id: 32, name: "Right Golden Motif", geom: "roundRect", ...layout.secondaryAccent, fill: visual.accent })
    + textShapeXml({ id: 33, name: "Section Label", ...layout.label, text: domeContentSectionLabelText(slide, index), size: 1500, bold: true, color: visual.accent })
    + imageReportCards;
}

/**
 * 生成 dome 目录页的 4 个卡片文案。
 * 用户输入优先；不足 4 项时使用 dome.pptx 的四段目录默认文案补齐，避免卡片式目录出现空槽。
 * @param {object} slide
 * @returns {string[]}
 */
function normalizeDomeAgendaItems(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: 4 }, (_, index) => domeStructuredText(bullets[index], ["text", "title", "label", "name"]) || DOME_AGENDA_DEFAULT_ITEMS[index] || "");
}

/**
 * 读取章节分隔页的结构化编号。
 * 用户传入 bullets[0] 时优先作为 PART 编号占位符；缺省时才按页序生成兜底文案。
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function domeSectionNumberText(slide, index) {
  const [sectionNumber] = normalizeDomeBulletItems(slide, 1);
  return sectionNumber || `PART ${String(index).padStart(2, "0")}`;
}

/**
 * 读取内容页右上角章节标签。
 * 优先使用 outline 里的结构化章节字段，缺省时按页序兜底，保证旧数据仍能稳定导出。
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function domeContentSectionLabelText(slide, index) {
  return String(slide?.sectionLabel || slide?.section || `PART ${String(index).padStart(2, "0")}`);
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
  return Array.from({ length: count }, (_, index) => domeStructuredText(bullets[index], ["text", "title", "label", "name", "action", "task"]));
}

/**
 * 解析下一步计划页的结构化要点。
 * 推荐输入为“阶段: 动作”；旧数据没有分隔符时，用序号作阶段、原文作动作。
 * @param {object} slide
 * @param {number} count
 * @returns {{phase: string, action: string}[]}
 */
function normalizeDomePlanItems(slide, count) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: count }, (_, index) => {
    const rawItem = bullets[index];
    if (isPlainObject(rawItem)) {
      return {
        phase: domeStructuredText(rawItem, ["phase", "stage", "name", "label", "title"]) || `0${index + 1}`,
        action: domeStructuredText(rawItem, ["action", "task", "text", "description", "value"]) || "",
      };
    }
    const item = domeStructuredText(rawItem, ["text"]);
    const match = item.match(/^(.+?)\s*[:：|]\s*(.*)$/);
    if (!match) return { phase: `0${index + 1}`, action: item };
    return { phase: match[1].trim(), action: match[2].trim() };
  });
}

/**
 * 解析 dome 指标页的结构化要点。
 * 推荐输入为“指标名: 指标值”；旧数据没有分隔符时，用序号作数值、原文作标签，避免历史 deck 失去内容。
 * @param {object} slide
 * @param {number} count
 * @returns {{label: string, value: string}[]}
 */
function normalizeDomeMetricItems(slide, count) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: count }, (_, index) => {
    const rawItem = bullets[index];
    if (isPlainObject(rawItem)) {
      return {
        label: domeStructuredText(rawItem, ["label", "name", "title", "text"]) || "",
        value: domeStructuredText(rawItem, ["value", "amount", "metric", "number"]) || `0${index + 1}`,
      };
    }
    const item = domeStructuredText(rawItem, ["text"]);
    const match = item.match(/^(.+?)\s*[:：|]\s*(.+)$/);
    if (!match) return { label: item, value: `0${index + 1}` };
    return { label: match[1].trim(), value: match[2].trim() };
  });
}

/**
 * 从对象或普通字符串中读取 dome 占位符文本。
 * 支持模型直接返回结构化 bullet 对象，避免 PPTX 中出现 [object Object]。
 * @param {unknown} value
 * @param {string[]} preferredKeys
 * @returns {string}
 */
function domeStructuredText(value, preferredKeys) {
  if (value == null) return "";
  if (!isPlainObject(value)) return String(value);
  for (const key of preferredKeys) {
    if (value[key] != null && value[key] !== "") return String(value[key]);
  }
  return "";
}

/**
 * 判断值是否为普通对象，数组和 null 不按结构化 bullet 处理。
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 为不同内容角色挑选 dome.pptx 中的商务图片。
 * @param {string} role
 * @returns {string}
 */
function domeRoleBusinessMedia(visual, role) {
  const descriptor = resolveMasterDescriptor(visual);
  return descriptor ? masterBusinessMedia(descriptor, role) : "";
}

/**
 * 返回当前模板的页面几何布局。
 * red-gold 分支按 dome 角色拆出封面、目录、章节、内容、流程、指标和结束页的位置。
 * @param {object} visual
 * @param {number} index
 * @returns {{accent: object, title: object, content: object, titleSize: number}}
 */
function templateLayout(visual, index, role = index === 0 ? "cover" : "content") {
  const redGoldPalette = redGoldColorPalette(visual);
  if (visual.layout === "red-gold") {
    if (role === "cover" || role === "closing") {
      return {
        surface: { x: 2438400, y: 1066800, cx: 4267200, cy: 2438400 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 5143500 },
        secondaryAccent: { x: 6781800, y: 1600200, cx: 914400, cy: 2057400 },
        label: { x: 5943600, y: 914400, cx: 1524000, cy: 365760 },
        // 封面标题原框窄(cx 3962400)且右缘伸进帆船区,长标题会从词中间断行;加宽并左移避开帆船,降字号让长标题在净区内均衡换行。
        title: role === "closing"
          ? { x: 3048000, y: 1371600, cx: 3962400, cy: 914400 }
          : { x: 609600, y: 1219200, cx: 5334000, cy: 1371600 },
        content: { x: 2971800, y: 2514600, cx: 3886200, cy: 914400 },
        titleSize: role === "closing" ? 5200 : 4400,
        bodySize: 2100,
        titleColor: redGoldPalette.surfaceText,
        bodyColor: redGoldPalette.surfaceText,
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
        titleColor: redGoldPalette.surfaceText,
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
        titleColor: redGoldPalette.surfaceText,
        bodyColor: redGoldPalette.surfaceText,
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
      // 顶部卡片版式的内容页标题压在红底上,深色标题几乎不可读,改用浅色(与预览一致)。
      titleColor: ["image-report", "showcase", "retrospective"].includes(role) ? redGoldPalette.surfaceText : visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "executive") {
    if (isFinancialReviewVisual(visual)) {
      if (index === 0) {
        return {
          surface: { x: 457200, y: 571500, cx: 8229600, cy: 3886200 },
          accent: { x: 0, y: 0, cx: 9144000, cy: 514350 },
          secondaryAccent: { x: 7315200, y: 571500, cx: 914400, cy: 2971800 },
          label: { x: 914400, y: 800100, cx: 2133600, cy: 304800 },
          title: { x: 914400, y: 1219200, cx: 4267200, cy: 1066800 },
          content: { x: 1066800, y: 2667000, cx: 3962400, cy: 990600 },
          titleSize: 3100,
          bodySize: 1350,
        };
      }
      return {
        surface: { x: 571500, y: 914400, cx: 8001000, cy: 3657600 },
        accent: { x: 0, y: 0, cx: 342900, cy: 5143500 },
        secondaryAccent: { x: 571500, y: 914400, cx: 114300, cy: 3657600 },
        label: { x: 6858000, y: 457200, cx: 1371600, cy: 304800 },
        title: { x: 914400, y: 800100, cx: 4267200, cy: 914400 },
        content: { x: 1066800, y: 1981200, cx: 3962400, cy: 1524000 },
        titleSize: 2700,
        bodySize: 1250,
      };
    }
    if (isStrategyConsultingVisual(visual)) {
      if (index === 0) {
        return {
          surface: { x: 457200, y: 571500, cx: 8229600, cy: 3886200 },
          accent: { x: 0, y: 0, cx: 9144000, cy: 514350 },
          secondaryAccent: { x: 7315200, y: 571500, cx: 914400, cy: 2971800 },
          label: { x: 914400, y: 800100, cx: 2133600, cy: 304800 },
          title: { x: 914400, y: 1188720, cx: 4419600, cy: 1066800 },
          content: { x: 1066800, y: 2667000, cx: 3962400, cy: 990600 },
          titleSize: 2850,
          bodySize: 1350,
        };
      }
      return {
        surface: { x: 571500, y: 914400, cx: 8001000, cy: 3657600 },
        accent: { x: 0, y: 0, cx: 342900, cy: 5143500 },
        secondaryAccent: { x: 571500, y: 914400, cx: 114300, cy: 3657600 },
        label: { x: 6858000, y: 457200, cx: 1371600, cy: 304800 },
        title: { x: 914400, y: 800100, cx: 4572000, cy: 914400 },
        content: { x: 1066800, y: 2019300, cx: 3962400, cy: 1524000 },
        titleSize: 2450,
        bodySize: 1200,
      };
    }
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
  if (visual.layout === "status-report") {
    if (index === 0) {
      return {
        surface: { x: 487680, y: 685800, cx: 8168640, cy: 3657600 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 609600 },
        secondaryAccent: { x: 7429500, y: 3017520, cx: 685800, cy: 1097280 },
        label: { x: 731520, y: 822960, cx: 2133600, cy: 304800 },
        title: { x: 914400, y: 1371600, cx: 4495800, cy: 1097280 },
        content: { x: 914400, y: 2667000, cx: 4495800, cy: 762000 },
        titleSize: 4000,
        bodySize: 1500,
      };
    }
    return {
      surface: { x: 487680, y: 685800, cx: 8168640, cy: 3657600 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 609600 },
      secondaryAccent: { x: 7429500, y: 3017520, cx: 685800, cy: 1097280 },
      label: { x: 731520, y: 822960, cx: 2133600, cy: 304800 },
      title: { x: 914400, y: 1219200, cx: 4648200, cy: 914400 },
      content: { x: 1066800, y: 2286000, cx: 4267200, cy: 1219200 },
      titleSize: 3300,
      bodySize: 1450,
    };
  }
  if (visual.layout === "marketing") {
    if (index === 0) {
      return {
        surface: { x: 609600, y: 609600, cx: 7924800, cy: 3886200 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 609600 },
        secondaryAccent: { x: 914400, y: 3345180, cx: 3657600, cy: 22860 },
        label: { x: 914400, y: 914400, cx: 2743200, cy: 304800 },
        title: { x: 914400, y: 1325880, cx: 4114800, cy: 1219200 },
        content: { x: 1066800, y: 2743200, cx: 3810000, cy: 762000 },
        titleSize: 3450,
        bodySize: 1320,
      };
    }
    return {
      surface: { x: 571500, y: 800100, cx: 8001000, cy: 3771900 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
      secondaryAccent: { x: 914400, y: 1577340, cx: 3657600, cy: 22860 },
      label: { x: 914400, y: 609600, cx: 2133600, cy: 304800 },
      title: { x: 914400, y: 914400, cx: 4267200, cy: 762000 },
      content: { x: 1066800, y: 1981200, cx: 3962400, cy: 1371600 },
      titleSize: 2800,
      bodySize: 1250,
    };
  }
  if (visual.layout === "brand-story") {
    if (index === 0) {
      return {
        surface: { x: 609600, y: 609600, cx: 7924800, cy: 3886200 },
        accent: { x: 0, y: 0, cx: 1158240, cy: 5143500 },
        secondaryAccent: { x: 914400, y: 3345180, cx: 3810000, cy: 22860 },
        label: { x: 914400, y: 914400, cx: 2743200, cy: 304800 },
        title: { x: 914400, y: 1325880, cx: 3962400, cy: 1219200 },
        content: { x: 1066800, y: 2743200, cx: 3657600, cy: 762000 },
        titleSize: 3450,
        bodySize: 1280,
      };
    }
    return {
      surface: { x: 571500, y: 762000, cx: 8001000, cy: 3810000 },
      accent: { x: 0, y: 0, cx: 1158240, cy: 5143500 },
      secondaryAccent: { x: 914400, y: 1630680, cx: 3810000, cy: 22860 },
      label: { x: 914400, y: 609600, cx: 2438400, cy: 304800 },
      title: { x: 914400, y: 914400, cx: 4114800, cy: 762000 },
      content: { x: 1066800, y: 1981200, cx: 3962400, cy: 1371600 },
      titleSize: 2800,
      bodySize: 1220,
    };
  }
  if (visual.layout === "data-insight") {
    if (index === 0) {
      return {
        surface: { x: 609600, y: 609600, cx: 7924800, cy: 3886200 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 609600 },
        secondaryAccent: { x: 914400, y: 3337560, cx: 3657600, cy: 22860 },
        label: { x: 914400, y: 914400, cx: 2743200, cy: 304800 },
        title: { x: 914400, y: 1325880, cx: 4114800, cy: 1219200 },
        content: { x: 1066800, y: 2743200, cx: 3810000, cy: 762000 },
        titleSize: 3350,
        bodySize: 1280,
      };
    }
    return {
      surface: { x: 571500, y: 762000, cx: 8001000, cy: 3810000 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 365760 },
      secondaryAccent: { x: 914400, y: 1577340, cx: 3657600, cy: 22860 },
      label: { x: 914400, y: 609600, cx: 2438400, cy: 304800 },
      title: { x: 914400, y: 914400, cx: 4267200, cy: 762000 },
      content: { x: 1066800, y: 1981200, cx: 3962400, cy: 1371600 },
      titleSize: 2750,
      bodySize: 1220,
    };
  }
  if (visual.layout === "education-course") {
    if (index === 0) {
      return {
        surface: { x: 731520, y: 762000, cx: 7680960, cy: 3604260 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 609600 },
        secondaryAccent: { x: 914400, y: 3337560, cx: 3657600, cy: 22860 },
        label: { x: 1097280, y: 982980, cx: 2743200, cy: 304800 },
        title: { x: 1097280, y: 1386840, cx: 4876800, cy: 1219200 },
        content: { x: 1219200, y: 2781300, cx: 4267200, cy: 762000 },
        titleColor: "FFFFFF",
        bodyColor: "EAF4EE",
        titleSize: 3500,
        bodySize: 1280,
      };
    }
    return {
      surface: { x: 804672, y: 685800, cx: 7533648, cy: 3810000 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 365760 },
      secondaryAccent: { x: 914400, y: 1577340, cx: 3657600, cy: 22860 },
      label: { x: 1097280, y: 640080, cx: 2438400, cy: 304800 },
      title: { x: 1219200, y: 982980, cx: 5486400, cy: 762000 },
      content: { x: 1371600, y: 1905000, cx: 5181600, cy: 1371600 },
      titleSize: 2750,
      bodySize: 1240,
    };
  }
  if (visual.layout === "academy") {
    if (isProductRoadmapVisual(visual)) {
      if (index === 0) {
        return {
          surface: { x: 457200, y: 685800, cx: 8229600, cy: 3657600 },
          accent: { x: 0, y: 0, cx: 9144000, cy: 609600 },
          secondaryAccent: { x: 914400, y: 3566160, cx: 3962400, cy: 60960 },
          label: { x: 914400, y: 914400, cx: 2743200, cy: 304800 },
          title: { x: 914400, y: 1325880, cx: 3962400, cy: 1219200 },
          content: { x: 1066800, y: 2788920, cx: 3810000, cy: 914400 },
          titleSize: 3400,
          bodySize: 1350,
        };
      }
      return {
        surface: { x: 685800, y: 1028700, cx: 7772400, cy: 3429000 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 365760 },
        secondaryAccent: { x: 7162800, y: 1066800, cx: 822960, cy: 3429000 },
        label: { x: 6858000, y: 457200, cx: 1371600, cy: 304800 },
        title: { x: 914400, y: 792480, cx: 4114800, cy: 914400 },
        content: { x: 1066800, y: 1981200, cx: 3962400, cy: 1524000 },
        titleSize: 2650,
        bodySize: 1250,
      };
    }
    if (isSalesProposalVisual(visual)) {
      if (index === 0) {
        return {
          surface: { x: 457200, y: 685800, cx: 8229600, cy: 3657600 },
          accent: { x: 0, y: 0, cx: 9144000, cy: 609600 },
          secondaryAccent: { x: 914400, y: 3566160, cx: 3962400, cy: 60960 },
          label: { x: 914400, y: 914400, cx: 2743200, cy: 304800 },
          title: { x: 914400, y: 1371600, cx: 4114800, cy: 1219200 },
          content: { x: 1066800, y: 2819400, cx: 3810000, cy: 914400 },
          titleSize: 3500,
          bodySize: 1350,
        };
      }
      return {
        surface: { x: 685800, y: 1028700, cx: 7772400, cy: 3429000 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
        secondaryAccent: { x: 7315200, y: 1028700, cx: 685800, cy: 3429000 },
        label: { x: 6858000, y: 457200, cx: 1371600, cy: 304800 },
        title: { x: 914400, y: 800100, cx: 4267200, cy: 914400 },
        content: { x: 1066800, y: 1981200, cx: 3962400, cy: 1524000 },
        titleSize: 2700,
        bodySize: 1250,
      };
    }
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
    if (isPitchDeckVisual(visual)) {
      if (index === 0) {
        return {
          surface: { x: 609600, y: 609600, cx: 7924800, cy: 3886200 },
          accent: { x: 0, y: 0, cx: 9144000, cy: 5143500 },
          secondaryAccent: { x: 914400, y: 3345180, cx: 3657600, cy: 30480 },
          label: { x: 914400, y: 914400, cx: 2743200, cy: 304800 },
          title: { x: 914400, y: 1325880, cx: 4114800, cy: 1219200 },
          content: { x: 1066800, y: 2743200, cx: 3810000, cy: 762000 },
          titleSize: 3450,
          bodySize: 1320,
        };
      }
      return {
        surface: { x: 571500, y: 762000, cx: 8001000, cy: 3810000 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
        secondaryAccent: { x: 914400, y: 1577340, cx: 3657600, cy: 22860 },
        label: { x: 914400, y: 609600, cx: 2438400, cy: 304800 },
        title: { x: 914400, y: 914400, cx: 4114800, cy: 762000 },
        content: { x: 1066800, y: 1981200, cx: 3962400, cy: 1371600 },
        titleSize: 2800,
        bodySize: 1220,
      };
    }
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
  if (visual.layout === "top-band") {
    if (index === 0) {
      return {
        surface: { x: 685800, y: 914400, cx: 8289600, cy: 3657600 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 514350 },
        secondaryAccent: { x: 914400, y: 3886200, cx: 7772400, cy: 365760 },
        label: { x: 685800, y: 685800, cx: 2438400, cy: 365760 },
        title: { x: 1663700, y: 1270000, cx: 4267200, cy: 1219200 },
        content: { x: 1663700, y: 2921000, cx: 4267200, cy: 838200 },
        titleSize: 4300,
        bodySize: 1500,
      };
    }
    return {
      surface: { x: 685800, y: 685800, cx: 8289600, cy: 4114800 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 457200 },
      secondaryAccent: { x: 914400, y: 4000500, cx: 7772400, cy: 304800 },
      label: { x: 685800, y: 685800, cx: 2209800, cy: 365760 },
      title: { x: 1663700, y: 1120000, cx: 4724400, cy: 1371600 },
      content: { x: 1663700, y: 2819400, cx: 4419600, cy: 1447800 },
      titleSize: 3400,
      bodySize: 1450,
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
 * 创建 slide relationships。
 * red-gold 页面会把 rId2 绑定到 dome 背景图，部分角色再用 rId3 绑定商务配图。
 * @returns {string}
 */
function slideRelsXml(visual, role = "content") {
  const descriptor = resolveMasterDescriptor(visual);
  const backgroundFile = descriptor ? masterBackgroundFile(descriptor, role) : "";
  const statusReportImage = visual.layout === "status-report" ? statusReportMedia(visual).file : "";
  const strategyImage = isStrategyConsultingVisual(visual) ? strategyConsultingMedia(visual).file : "";
  const imageFile = backgroundFile || statusReportImage || strategyImage;
  const imageRel = imageFile
    ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imageFile}"/>`
    : "";
  const businessImage = domeRoleBusinessMedia(visual, role);
  const businessImageRel = businessImage
    ? `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${businessImage}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${imageRel}${businessImageRel}</Relationships>`;
}

/**
 * 创建空白 slide layout。
 * 实际视觉内容都在每页 slide XML 中生成，layout 只提供 Office 所需结构。
 * @returns {string}
 */
function slideLayoutXml(visual) {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${groupShapeXml()}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

/**
 * 创建 slide layout relationship XML。
 * @returns {string}
 */
function slideLayoutRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
}

/**
 * 创建最小 slide master。
 * 主题色从 visual 注入，具体 dome 装饰不放在 master，便于每页按角色差异化。
 * @returns {string}
 */
function slideMasterXml(visual) {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${visual.background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${groupShapeXml()}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
}

/**
 * 创建 slide master relationship XML。
 * @returns {string}
 */
function slideMasterRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
}

/**
 * 创建最小 Office theme。
 * red-gold 在这里复用 dome.pptx 的 588ku 字体方案。
 * @returns {string}
 */
function themeXml(visual) {
  const redGoldPalette = visual.layout === "red-gold" ? redGoldColorPalette(visual) : null;
  const accent4 = redGoldPalette ? redGoldPalette.titleGradientEnd : "DC2626";
  const accent5 = redGoldPalette ? redGoldPalette.titleGradientStart : "7C3AED";
  const accent6 = redGoldPalette ? visual.body : "0891B2";
  const accent3 = redGoldPalette ? redGoldPalette.cardFill : "F59E0B";
  return `<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Moling Theme"><a:themeElements><a:clrScheme name="Moling Theme"><a:dk1><a:srgbClr val="${visual.title}"/></a:dk1><a:lt1><a:srgbClr val="${visual.surface}"/></a:lt1><a:dk2><a:srgbClr val="${visual.body}"/></a:dk2><a:lt2><a:srgbClr val="${visual.background}"/></a:lt2><a:accent1><a:srgbClr val="${visual.primary}"/></a:accent1><a:accent2><a:srgbClr val="${visual.accent}"/></a:accent2><a:accent3><a:srgbClr val="${accent3}"/></a:accent3><a:accent4><a:srgbClr val="${accent4}"/></a:accent4><a:accent5><a:srgbClr val="${accent5}"/></a:accent5><a:accent6><a:srgbClr val="${accent6}"/></a:accent6><a:hlink><a:srgbClr val="${visual.primary}"/></a:hlink><a:folHlink><a:srgbClr val="${visual.accent}"/></a:folHlink></a:clrScheme>${fontSchemeXml(visual)}<a:fmtScheme name="Moling"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"/><a:gradFill rotWithShape="1"/></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

/**
 * 生成主题字体配置。
 * red-gold 复用 dome.pptx 的 588ku 字体方案，其他模板保留原 Moling 字体方案。
 * @param {object} visual
 * @returns {string}
 */
function fontSchemeXml(visual) {
  if (visual.layout === "red-gold") {
    return `<a:fontScheme name="588ku"><a:majorFont><a:latin typeface="Arial Black"/><a:ea typeface="思源黑体 CN Bold"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="思源黑体 CN Regular"/><a:cs typeface=""/></a:minorFont></a:fontScheme>`;
  }
  return `<a:fontScheme name="Moling"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme>`;
}

/**
 * 创建 PPTX slide 必需的根 group shape 元数据。
 * @returns {string}
 */
function groupShapeXml() {
  return `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
}

/**
 * 创建填充矩形形状。
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, fill: string}} input
 * @returns {string}
 */
function rectShapeXml({ id, name, x, y, cx, cy, fill }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

/**
 * 创建填充的预设几何形状。
 * 用于金色波浪、红色底浪、卡片和右侧装饰块。
 * @param {{id: number, name: string, geom: string, x: number, y: number, cx: number, cy: number, fill: string}} input
 * @returns {string}
 */
function solidShapeXml({ id, name, geom = "rect", x, y, cx, cy, fill }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${escapeXml(geom)}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

/**
 * 创建仅描边形状（用于卡片边框/外框）.
 * @param {{id: number, name: string, geom: string, x: number, y: number, cx: number, cy: number, stroke: string, width?: number}} input
 * @returns {string}
 */
function lineFrameShapeXml({ id, name, geom, x, y, cx, cy, stroke, width = 19050 }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${escapeXml(geom)}"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="${width}" cap="round"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln></p:spPr></p:sp>`;
}

/**
 * 创建 dome 底部波浪用的圆弧线条。
 * 线条层叠在底部色带上，用来模拟 dome.pptx 里更柔和的金色波浪走势。
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, stroke: string, width: number}} input
 * @returns {string}
 */
function arcLineShapeXml({ id, name, x, y, cx, cy, stroke, width }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="arc"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="${width}" cap="round"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln></p:spPr></p:sp>`;
}

/**
 * 创建绑定到 slide relationship id 的 OOXML 图片形状。
 * @param {{id: number, name: string, relId: string, x: number, y: number, cx: number, cy: number}} input
 * @returns {string}
 */
/**
 * 创建 top-band 封面的三枚指标卡，用来把极简灰蓝模板升级为高管汇报的商业化封面结构。
 * @param {{id: number, x: number, y: number, number: string, label: string, visual: object, palette: object}} input
 * @returns {string}
 */
function topBandMetricCardXml({ id, x, y, number, label, visual, palette }) {
  return solidShapeXml({ id, name: `Top Band Metric Card ${number}`, geom: "roundRect", x, y, cx: 1485900, cy: 571500, fill: palette.glass })
    + textShapeXml({ id: id + 1, name: `Top Band Metric Number ${number}`, x: x + 152400, y: y + 114300, cx: 365760, cy: 190500, text: number, size: 1500, bold: true, color: visual.title })
    + textShapeXml({ id: id + 2, name: `Top Band Metric Label ${number}`, x: x + 152400, y: y + 312420, cx: 990600, cy: 190500, text: label, size: 900, bold: true, color: visual.body });
}

function statusReportMetricCardsXml({ visual, palette, metrics }) {
  return metrics.map((card, index) => {
    const x = 914400 + index * 1645920;
    return solidShapeXml({ id: 60 + index * 4, name: `Status Metric Card ${index + 1}`, geom: "roundRect", x, y: 3619500, cx: 1371600, cy: 609600, fill: palette.card })
      + lineFrameShapeXml({ id: 61 + index * 4, name: `Status Metric Frame ${index + 1}`, geom: "roundRect", x, y: 3619500, cx: 1371600, cy: 609600, stroke: palette.frame, width: 7620 })
      + textShapeXml({ id: 62 + index * 4, name: `Status Metric Value ${index + 1}`, x: x + 152400, y: 3741420, cx: 914400, cy: 274320, text: card.value, size: 1800, bold: true, color: visual.title })
      + textShapeXml({ id: 63 + index * 4, name: `Status Metric Label ${index + 1}`, x: x + 152400, y: 4046220, cx: 914400, cy: 213360, text: card.label, size: 900, bold: true, color: visual.body });
  }).join("");
}

function statusReportChecklistXml({ visual, palette }) {
  return [0, 1, 2].map((index) => {
    const width = [1371600, 1066800, 792480][index];
    return solidShapeXml({ id: 72 + index, name: `Status Checklist Line ${index + 1}`, geom: "roundRect", x: 6400800, y: 3276600 + index * 213360, cx: width, cy: 76200, fill: index === 0 ? visual.primary : palette.soft });
  }).join("");
}

function statusReportTimelineXml({ visual, palette }) {
  const dots = [914400, 3108960, 5303520, 7498080].map((x, index) => (
    solidShapeXml({ id: 83 + index, name: `Status Timeline Dot ${index + 1}`, geom: "ellipse", x, y: 4312920, cx: 152400, cy: 152400, fill: index < 3 ? visual.accent : palette.soft })
  )).join("");
  return rectShapeXml({ id: 80, name: "Status Timeline Base", x: 914400, y: 4366260, cx: 7162800, cy: 30480, fill: palette.soft })
    + rectShapeXml({ id: 81, name: "Status Timeline Progress", x: 914400, y: 4366260, cx: 5080000, cy: 30480, fill: visual.accent })
    + dots;
}

function salesProposalDecorationsXml({ visual, index, layout }) {
  const scene = salesProposalScene(visual);
  const palette = salesProposalColorPalette(visual);
  const isCover = index === 0;
  const panel = isCover
    ? { x: 6172200, y: 1447800, cx: 2194560, cy: 1661160 }
    : { x: 6233160, y: 1394460, cx: 2011680, cy: 1463040 };
  const frame = isCover
    ? { x: 6065520, y: 1325880, cx: 2194560, cy: 1661160 }
    : { x: 6141720, y: 1303020, cx: 2011680, cy: 1463040 };
  const chip = isCover
    ? { x: 7086600, y: 914400, cx: 990600, cy: 320040 }
    : { x: 7040880, y: 914400, cx: 822960, cy: 274320 };
  const chipText = isCover
    ? { x: 7239000, y: 982980, cx: 609600, cy: 152400 }
    : { x: 7162800, y: 967740, cx: 548640, cy: 152400 };
  const coverChrome = isCover
    ? solidShapeXml({ id: 150, name: "Sales Cover Hero Band", geom: "roundRect", x: 457200, y: 685800, cx: 8229600, cy: 3657600, fill: palette.coverWash })
      + solidShapeXml({ id: 151, name: "Sales Cover Signal Bar", geom: "roundRect", x: 914400, y: 3512820, cx: 3962400, cy: 60960, fill: visual.accent })
      + lineFrameShapeXml({ id: 152, name: "Sales Cover Hero Frame", geom: "roundRect", x: 609600, y: 762000, cx: 7924800, cy: 3429000, stroke: palette.frame, width: 15240 })
    : solidShapeXml({ id: 150, name: "Sales Content Anchor", geom: "roundRect", x: 655320, y: 1066800, cx: 76200, cy: 2743200, fill: visual.accent });
  return coverChrome
    + solidShapeXml({ id: 160, name: "Sales Visual Panel", geom: "roundRect", ...panel, fill: palette.panel })
    + lineFrameShapeXml({ id: 161, name: "Sales Visual Frame", geom: "roundRect", ...frame, stroke: visual.accent, width: 15240 })
    + solidShapeXml({ id: 162, name: `Sales ${scene.variant} Chip`, geom: isCover ? "roundRect" : scene.chipShape, ...chip, fill: palette.chip })
    + textShapeXml({ id: 163, name: "Sales Chip Text", ...chipText, text: scene.chip, size: 800, bold: true, color: "FFFFFF" })
    + textShapeXml({ id: 164, name: "Sales Section Label", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 1000, bold: true, color: visual.accent })
    + solidShapeXml({ id: 165, name: "Sales Focus Line", x: 914400, y: isCover ? 3322320 : 1516380, cx: 3505200, cy: 22860, fill: visual.accent })
    + salesProposalVisualXml({ visual, palette, scene })
    + textShapeXml({ id: 186, name: "Sales Caption", x: isCover ? 6423660 : 6370320, y: isCover ? 3429000 : 3200400, cx: isCover ? 1981200 : 1676400, cy: 182880, text: scene.caption, size: isCover ? 820 : 760, bold: true, color: visual.body });
}

function salesProposalVisualXml({ visual, palette, scene }) {
  if (scene.variant === "solution") {
    return solidShapeXml({ id: 170, name: "Sales Solution Hub", geom: "roundRect", x: 7002780, y: 1950720, cx: 304800, cy: 487680, fill: visual.primary })
      + solidShapeXml({ id: 171, name: "Sales Solution Node 1", geom: "roundRect", x: 6454140, y: 1661160, cx: 548640, cy: 304800, fill: visual.accent })
      + solidShapeXml({ id: 172, name: "Sales Solution Node 2", geom: "roundRect", x: 7467600, y: 1661160, cx: 548640, cy: 304800, fill: palette.soft })
      + solidShapeXml({ id: 173, name: "Sales Solution Node 3", geom: "roundRect", x: 6454140, y: 2415540, cx: 548640, cy: 304800, fill: palette.soft })
      + solidShapeXml({ id: 174, name: "Sales Solution Node 4", geom: "roundRect", x: 7467600, y: 2415540, cx: 548640, cy: 304800, fill: visual.primary })
      + solidShapeXml({ id: 175, name: "Sales Solution Connector X", x: 6766560, y: 2103120, cx: 1127760, cy: 22860, fill: palette.line })
      + solidShapeXml({ id: 176, name: "Sales Solution Connector Y", x: 7147560, y: 1767840, cx: 22860, cy: 944880, fill: palette.line });
  }
  if (scene.variant === "renewal") {
    return solidShapeXml({ id: 170, name: "Sales Renewal Baseline", geom: "roundRect", x: 6454140, y: 2484120, cx: 1432560, cy: 22860, fill: palette.line })
      + solidShapeXml({ id: 171, name: "Sales Renewal Trend Line 1", geom: "roundRect", x: 6522720, y: 2316480, cx: 335280, cy: 38100, fill: visual.accent })
      + solidShapeXml({ id: 172, name: "Sales Renewal Trend Line 2", geom: "roundRect", x: 6934200, y: 2164080, cx: 335280, cy: 38100, fill: visual.accent })
      + solidShapeXml({ id: 173, name: "Sales Renewal Trend Line 3", geom: "roundRect", x: 7345680, y: 1935480, cx: 365760, cy: 38100, fill: visual.accent })
      + [0, 1, 2, 3].map((itemIndex) => solidShapeXml({ id: 174 + itemIndex, name: `Sales Renewal Dot ${itemIndex + 1}`, geom: "ellipse", x: 6484620 + itemIndex * 419100, y: 2354580 - itemIndex * 152400, cx: 121920, cy: 121920, fill: itemIndex === 3 ? visual.accent : visual.primary })).join("");
  }
  return solidShapeXml({ id: 170, name: "Sales Account Card", geom: "roundRect", x: 6484620, y: 1645920, cx: 1371600, cy: 731520, fill: palette.soft })
    + solidShapeXml({ id: 171, name: "Sales Account Avatar", geom: "ellipse", x: 6606540, y: 1805940, cx: 243840, cy: 243840, fill: visual.accent })
    + solidShapeXml({ id: 172, name: "Sales Account Line 1", geom: "roundRect", x: 6964680, y: 1836420, cx: 640080, cy: 60960, fill: visual.primary })
    + solidShapeXml({ id: 173, name: "Sales Account Line 2", geom: "roundRect", x: 6964680, y: 1973580, cx: 487680, cy: 45720, fill: palette.line })
    + solidShapeXml({ id: 174, name: "Sales Buying Center", geom: "roundRect", x: 6568440, y: 2491740, cx: 1219200, cy: 243840, fill: palette.card });
}

function salesProposalColorPalette(visual) {
  return {
    panel: blendHexColor(visual.surface, visual.background, 0.26),
    card: blendHexColor(visual.accent, visual.background, 0.72),
    chip: visual.variant === "renewal" ? blendHexColor(visual.primary, visual.accent, 0.24) : visual.primary,
    coverWash: blendHexColor(visual.surface, visual.primary, 0.08),
    frame: blendHexColor(visual.accent, visual.surface, 0.36),
    line: blendHexColor(visual.primary, visual.background, 0.55),
    soft: blendHexColor(visual.accent, visual.background, 0.68),
  };
}

function salesProposalScene(visual) {
  const variant = salesProposalVariant(visual);
  const scenes = {
    enterprise: {
      variant: "enterprise",
      kicker: "ENTERPRISE ACCOUNT",
      section: "CUSTOMER PROFILE",
      chip: "客户",
      chipShape: "roundRect",
      caption: "客户画像与采购角色",
    },
    solution: {
      variant: "solution",
      kicker: "SOLUTION MAP",
      section: "VALUE ARCHITECTURE",
      chip: "方案",
      chipShape: "rect",
      caption: "模块组合与交付路径",
    },
    renewal: {
      variant: "renewal",
      kicker: "RENEWAL GROWTH",
      section: "EXPANSION PLAN",
      chip: "增长",
      chipShape: "parallelogram",
      caption: "续约机会与增购曲线",
    },
  };
  return scenes[variant] || scenes.enterprise;
}

function salesProposalVariant(visual) {
  return ["enterprise", "solution", "renewal"].includes(visual?.variant) ? visual.variant : "enterprise";
}

function isSalesProposalVisual(visual) {
  return visual?.id === "sales-proposal" && visual?.layout === "academy";
}

function productRoadmapDecorationsXml({ visual, index, layout }) {
  const scene = productRoadmapScene(visual);
  const palette = productRoadmapColorPalette(visual);
  const isCover = index === 0;
  const coverChrome = isCover
    ? (
        solidShapeXml({ id: 220, name: "Product Cover Strategy Field", geom: "roundRect", x: 365760, y: 548640, cx: 8412480, cy: 3802380, fill: palette.coverWash })
        + lineFrameShapeXml({ id: 221, name: "Product Cover Field Frame", geom: "roundRect", x: 457200, y: 685800, cx: 8229600, cy: 3657600, stroke: palette.frame, width: 15240 })
      )
    : (
        solidShapeXml({ id: 220, name: "Product Content Anchor", x: 0, y: 0, cx: 9144000, cy: 365760, fill: visual.primary })
        + rectShapeXml({ id: 221, name: "Product Content Accent Rule", x: 0, y: 342900, cx: 9144000, cy: 30480, fill: visual.accent })
      );
  const panel = isCover
    ? { x: 6324600, y: 1394460, cx: 1981200, cy: 1752600 }
    : { x: 6256020, y: 1432560, cx: 1950720, cy: 1524000 };
  const frame = isCover
    ? { x: 6202680, y: 1280160, cx: 1981200, cy: 1752600 }
    : { x: 6141720, y: 1325880, cx: 1950720, cy: 1524000 };
  const chip = isCover
    ? { x: 6964680, y: 914400, cx: 975360, cy: 304800 }
    : { x: 7040880, y: 914400, cx: 822960, cy: 274320 };
  const chipText = isCover
    ? { x: 7101840, y: 975360, cx: 701040, cy: 182880 }
    : { x: 7162800, y: 967740, cx: 548640, cy: 152400 };
  return coverChrome
    + solidShapeXml({ id: 222, name: "Product Visual Panel", geom: "roundRect", ...panel, fill: palette.panel })
    + lineFrameShapeXml({ id: 223, name: "Product Visual Frame", geom: "roundRect", ...frame, stroke: visual.accent, width: 15240 })
    + solidShapeXml({ id: 224, name: `Product ${scene.variant} Chip`, geom: isCover ? "roundRect" : scene.chipShape, ...chip, fill: palette.chip })
    + textShapeXml({ id: 225, name: "Product Chip Text", ...chipText, text: scene.chip, size: 820, bold: true, color: "FFFFFF" })
    + textShapeXml({ id: 226, name: "Product Section Label", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 1000, bold: true, color: visual.accent })
    + solidShapeXml({ id: 227, name: "Product Focus Line", x: 914400, y: isCover ? 3322320 : 1516380, cx: 3505200, cy: 22860, fill: visual.accent })
    + productRoadmapVisualXml({ visual, palette, scene, isCover })
    + textShapeXml({ id: 246, name: "Product Caption", x: isCover ? 6316980 : 6347460, y: isCover ? 3429000 : 3200400, cx: isCover ? 2133600 : 1828800, cy: 182880, text: scene.caption, size: isCover ? 820 : 760, bold: true, color: visual.body });
}

function productRoadmapVisualXml({ visual, palette, scene, isCover }) {
  const dx = isCover ? 0 : -45720;
  if (scene.variant === "release") {
    return solidShapeXml({ id: 230, name: "Product Release Shelf", geom: "roundRect", x: 6507480 + dx, y: 1661160, cx: 1371600, cy: 396240, fill: palette.soft })
      + [0, 1, 2].map((itemIndex) => solidShapeXml({ id: 231 + itemIndex, name: `Product Release Card ${itemIndex + 1}`, geom: "roundRect", x: 6606540 + dx + itemIndex * 396240, y: 1760220, cx: 274320, cy: 228600, fill: itemIndex === 1 ? visual.primary : visual.accent })).join("")
      + solidShapeXml({ id: 235, name: "Product Release Timeline", geom: "roundRect", x: 6537960 + dx, y: 2461260, cx: 1310640, cy: 38100, fill: palette.line })
      + [0, 1, 2].map((itemIndex) => solidShapeXml({ id: 236 + itemIndex, name: `Product Release Milestone ${itemIndex + 1}`, geom: "ellipse", x: 6583680 + dx + itemIndex * 426720, y: 2415540, cx: 121920, cy: 121920, fill: itemIndex === 2 ? visual.accent : visual.primary })).join("");
  }
  if (scene.variant === "product-review") {
    return solidShapeXml({ id: 230, name: "Product Review Ring Outer", geom: "ellipse", x: 6675120 + dx, y: 1623060, cx: 914400, cy: 914400, fill: palette.soft })
      + solidShapeXml({ id: 231, name: "Product Review Ring Inner", geom: "ellipse", x: 6888480 + dx, y: 1836420, cx: 487680, cy: 487680, fill: visual.surface })
      + arcLineShapeXml({ id: 232, name: "Product Review Progress Arc", x: 6675120 + dx, y: 1623060, cx: 914400, cy: 914400, stroke: visual.accent, width: 53340 })
      + [0, 1, 2].map((itemIndex) => solidShapeXml({ id: 233 + itemIndex, name: `Product Review Feedback Line ${itemIndex + 1}`, geom: "roundRect", x: 6507480 + dx, y: 2743200 + itemIndex * 152400, cx: 1219200 - itemIndex * 213360, cy: 38100, fill: itemIndex === 0 ? visual.primary : palette.line })).join("");
  }
  return solidShapeXml({ id: 230, name: "Product Roadmap Rail", geom: "roundRect", x: 6507480 + dx, y: 2324100, cx: 1371600, cy: 38100, fill: palette.line })
    + [0, 1, 2, 3].map((itemIndex) => solidShapeXml({ id: 231 + itemIndex, name: `Product Roadmap Node ${itemIndex + 1}`, geom: "ellipse", x: 6545580 + dx + itemIndex * 365760, y: 2263140 - itemIndex * 91440, cx: 121920, cy: 121920, fill: itemIndex === 3 ? visual.accent : visual.primary })).join("")
    + solidShapeXml({ id: 236, name: "Product Roadmap Feature Card", geom: "roundRect", x: 6553200 + dx, y: 2667000, cx: 1219200, cy: 304800, fill: palette.card });
}

function productRoadmapColorPalette(visual) {
  return {
    panel: blendHexColor(visual.surface, visual.background, 0.24),
    card: blendHexColor(visual.accent, visual.background, 0.72),
    chip: visual.variant === "release" ? blendHexColor(visual.primary, visual.accent, 0.24) : visual.primary,
    coverWash: blendHexColor(visual.surface, visual.primary, 0.07),
    frame: blendHexColor(visual.accent, visual.surface, 0.34),
    line: blendHexColor(visual.primary, visual.background, 0.52),
    soft: blendHexColor(visual.accent, visual.background, 0.68),
  };
}

function productRoadmapScene(visual) {
  const variant = productRoadmapVariant(visual);
  const scenes = {
    roadmap: {
      variant: "roadmap",
      kicker: "PRODUCT ROADMAP",
      section: "MILESTONE MAP",
      chip: "路线图",
      chipShape: "roundRect",
      caption: "阶段里程碑与能力优先级",
    },
    release: {
      variant: "release",
      kicker: "VERSION RELEASE",
      section: "RELEASE PLAN",
      chip: "发布",
      chipShape: "rect",
      caption: "发布节奏与关键特性组合",
    },
    "product-review": {
      variant: "product-review",
      kicker: "PRODUCT REVIEW",
      section: "ITERATION REVIEW",
      chip: "复盘",
      chipShape: "parallelogram",
      caption: "用户反馈、指标变化和迭代机会",
    },
  };
  return scenes[variant] || scenes.roadmap;
}

function productRoadmapVariant(visual) {
  return ["roadmap", "release", "product-review"].includes(visual?.variant) ? visual.variant : "roadmap";
}

function isProductRoadmapVisual(visual) {
  return visual?.id === "product-roadmap" && visual?.layout === "academy";
}

function pitchDeckDecorationsXml({ visual, index, layout }) {
  const scene = pitchDeckScene(visual);
  const palette = pitchDeckColorPalette(visual);
  const isCover = index === 0;
  const surface = isCover
    ? solidShapeXml({ id: 700, name: "Pitch Stage Canvas", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.primary })
    : solidShapeXml({ id: 700, name: "Pitch Memo Board", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.board });
  const paper = isCover
    ? solidShapeXml({ id: 701, name: "Pitch Founder Story Sheet", geom: "roundRect", x: 685800, y: 762000, cx: 5334000, cy: 3124200, fill: visual.surface })
    : solidShapeXml({ id: 701, name: "Pitch Investor Memo Sheet", geom: "roundRect", x: 685800, y: 685800, cx: 5334000, cy: 3505200, fill: visual.surface });
  const stage = isCover
    ? solidShapeXml({ id: 702, name: "Pitch Stage Spotlight", geom: "parallelogram", x: 5715000, y: 0, cx: 3429000, cy: 5143500, fill: palette.spotlight })
      + solidShapeXml({ id: 703, name: "Pitch Stage Rail", x: 0, y: 0, cx: 365760, cy: 5143500, fill: palette.rail })
      + solidShapeXml({ id: 704, name: "Pitch Stage Floor", geom: "parallelogram", x: 0, y: 4114800, cx: 9144000, cy: 1028700, fill: palette.floor })
    : solidShapeXml({ id: 702, name: "Pitch Memo Top Clip", geom: "roundRect", x: 883920, y: 533400, cx: 1371600, cy: 243840, fill: visual.accent })
      + solidShapeXml({ id: 703, name: "Pitch Memo Side Ledger", x: 6400800, y: 0, cx: 2743200, cy: 5143500, fill: palette.ledger })
      + solidShapeXml({ id: 704, name: "Pitch Memo Divider", x: 6172200, y: 685800, cx: 30480, cy: 3505200, fill: visual.accent });
  const lowerItems = isCover
    ? pitchDeckMetricCardsXml({ visual, palette, metrics: scene.metrics })
    : pitchDeckProofCardsXml({ visual, palette });
  return surface
    + stage
    + paper
    + lineFrameShapeXml({ id: 705, name: "Pitch Sheet Hairline", geom: "roundRect", x: isCover ? 685800 : 685800, y: isCover ? 762000 : 685800, cx: isCover ? 5334000 : 5334000, cy: isCover ? 3124200 : 3505200, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 706, name: "Pitch Focus Rule", x: 914400, y: isCover ? 3345180 : 1577340, cx: 3657600, cy: 22860, fill: visual.accent })
    + textShapeXml({ id: 707, name: "Pitch Kicker", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 880, bold: true, color: visual.accent })
    + solidShapeXml({ id: 708, name: `Pitch ${scene.variant} Chip`, geom: "roundRect", x: isCover ? 6979920 : 7040880, y: isCover ? 899160 : 800100, cx: 1066800, cy: 304800, fill: palette.chip })
    + textShapeXml({ id: 709, name: "Pitch Chip Text", x: isCover ? 7124700 : 7193280, y: isCover ? 960120 : 861060, cx: 731520, cy: 152400, text: scene.chip, size: 740, bold: true, color: palette.chipText })
    + pitchDeckVisualXml({ visual, palette, scene, isCover })
    + lowerItems
    + textShapeXml({ id: 750, name: "Pitch Caption", x: isCover ? 6248400 : 6248400, y: isCover ? 3505200 : 3230880, cx: 2133600, cy: 182880, text: scene.caption, size: isCover ? 800 : 740, bold: true, color: visual.body });
}

function pitchDeckVisualXml({ visual, palette, scene, isCover }) {
  const panel = isCover
    ? { x: 6172200, y: 1447800, cx: 2133600, cy: 1676400 }
    : { x: 6172200, y: 1371600, cx: 2011680, cy: 1524000 };
  const frame = isCover
    ? { x: 6042660, y: 1325880, cx: 2133600, cy: 1676400 }
    : { x: 6065520, y: 1257300, cx: 2011680, cy: 1524000 };
  const basePanel = solidShapeXml({ id: 720, name: "Pitch Visual Panel", geom: "roundRect", ...panel, fill: palette.panel })
    + lineFrameShapeXml({ id: 721, name: "Pitch Visual Frame", geom: "roundRect", ...frame, stroke: palette.frame, width: 15240 });
  if (scene.variant === "investor") {
    return basePanel
      + rectShapeXml({ id: 722, name: "Pitch Investor Axis", x: panel.x + 274320, y: panel.y + 1203960, cx: 1432560, cy: 30480, fill: palette.line })
      + solidShapeXml({ id: 723, name: "Pitch Investor Bar 1", geom: "roundRect", x: panel.x + 426720, y: panel.y + 838200, cx: 182880, cy: 365760, fill: visual.primary })
      + solidShapeXml({ id: 724, name: "Pitch Investor Bar 2", geom: "roundRect", x: panel.x + 792480, y: panel.y + 609600, cx: 182880, cy: 594360, fill: visual.accent })
      + solidShapeXml({ id: 725, name: "Pitch Investor Bar 3", geom: "roundRect", x: panel.x + 1158240, y: panel.y + 381000, cx: 182880, cy: 822960, fill: visual.primary })
      + solidShapeXml({ id: 726, name: "Pitch Investor Market Dot", geom: "ellipse", x: panel.x + 1463040, y: panel.y + 274320, cx: 304800, cy: 304800, fill: palette.soft });
  }
  if (scene.variant === "product") {
    return basePanel
      + solidShapeXml({ id: 722, name: "Pitch Product Screen", geom: "roundRect", x: panel.x + 396240, y: panel.y + 304800, cx: 1219200, cy: 792480, fill: visual.primary })
      + solidShapeXml({ id: 723, name: "Pitch Product Glow", geom: "ellipse", x: panel.x + 1310640, y: panel.y + 335280, cx: 335280, cy: 335280, fill: visual.accent })
      + rectShapeXml({ id: 724, name: "Pitch Product Feature Line 1", x: panel.x + 457200, y: panel.y + 1173480, cx: 914400, cy: 45720, fill: palette.line })
      + rectShapeXml({ id: 725, name: "Pitch Product Feature Line 2", x: panel.x + 457200, y: panel.y + 1325880, cx: 640080, cy: 38100, fill: palette.soft });
  }
  return basePanel
    + rectShapeXml({ id: 722, name: "Pitch Story Headline Line", x: panel.x + 304800, y: panel.y + 365760, cx: 1219200, cy: 60960, fill: visual.primary })
    + rectShapeXml({ id: 723, name: "Pitch Story Proof Line 1", x: panel.x + 304800, y: panel.y + 670560, cx: 1432560, cy: 45720, fill: palette.line })
    + rectShapeXml({ id: 724, name: "Pitch Story Proof Line 2", x: panel.x + 304800, y: panel.y + 899160, cx: 1066800, cy: 45720, fill: palette.soft })
    + solidShapeXml({ id: 725, name: "Pitch Story Founder Card", geom: "roundRect", x: panel.x + 335280, y: panel.y + 1188720, cx: 640080, cy: 335280, fill: visual.accent })
    + solidShapeXml({ id: 726, name: "Pitch Story Product Card", geom: "roundRect", x: panel.x + 1127760, y: panel.y + 1188720, cx: 487680, cy: 335280, fill: palette.card });
}

function pitchDeckMetricCardsXml({ visual, palette, metrics }) {
  return metrics.map((metric, index) => {
    const x = 1066800 + index * 1219200;
    return solidShapeXml({ id: 760 + index * 3, name: `Pitch Metric Card ${index + 1}`, geom: "roundRect", x, y: 3581400, cx: 1066800, cy: 548640, fill: index === 1 ? palette.soft : palette.card })
      + textShapeXml({ id: 761 + index * 3, name: `Pitch Metric Value ${index + 1}`, x: x + 121920, y: 3688080, cx: 822960, cy: 182880, text: metric.value, size: 1180, bold: true, color: visual.title })
      + textShapeXml({ id: 762 + index * 3, name: `Pitch Metric Label ${index + 1}`, x: x + 121920, y: 3893820, cx: 822960, cy: 152400, text: metric.label, size: 700, bold: true, color: visual.body });
  }).join("");
}

function pitchDeckProofCardsXml({ visual, palette }) {
  return [0, 1, 2].map((itemIndex) => {
    const x = 1066800 + itemIndex * 1219200;
    return solidShapeXml({ id: 780 + itemIndex * 2, name: `Pitch Proof Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3581400, cx: 1066800, cy: 396240, fill: itemIndex === 1 ? palette.soft : palette.card })
      + rectShapeXml({ id: 781 + itemIndex * 2, name: `Pitch Proof Rule ${itemIndex + 1}`, x: x + 152400, y: 3718560, cx: 762000, cy: 30480, fill: itemIndex === 1 ? visual.accent : visual.primary });
  }).join("");
}

function pitchDeckColorPalette(visual) {
  return {
    board: blendHexColor(visual.background, visual.primary, 0.08),
    card: blendHexColor(visual.surface, visual.background, 0.24),
    chip: visual.variant === "startup" ? visual.accent : blendHexColor(visual.primary, visual.accent, 0.18),
    chipText: visual.variant === "startup" ? visual.primary : "FFFFFF",
    coverWash: blendHexColor(visual.surface, visual.background, 0.18),
    floor: blendHexColor(visual.primary, "000000", 0.34),
    frame: blendHexColor(visual.primary, visual.surface, 0.28),
    ledger: blendHexColor(visual.primary, visual.background, 0.34),
    line: blendHexColor(visual.primary, visual.background, 0.54),
    panel: blendHexColor(visual.surface, visual.accent, 0.10),
    rail: blendHexColor(visual.primary, "000000", 0.22),
    soft: blendHexColor(visual.accent, visual.background, 0.66),
    spotlight: blendHexColor(visual.primary, visual.accent, 0.22),
  };
}

function pitchDeckScene(visual) {
  const variant = pitchDeckVariant(visual);
  const scenes = {
    startup: {
      variant: "startup",
      kicker: "FOUNDER STORY",
      section: "TRACTION PATH",
      chip: "创业故事",
      caption: "从用户痛点到可规模化增长的融资叙事",
      metrics: [
        { value: "痛点", label: "创始洞察" },
        { value: "PMF", label: "验证路径" },
        { value: "增长", label: "规模化机会" },
      ],
    },
    investor: {
      variant: "investor",
      kicker: "INVESTOR MEMO",
      section: "CAPITAL PLAN",
      chip: "投资人版",
      caption: "市场空间、商业模型和资金用途的决策视图",
      metrics: [
        { value: "TAM", label: "市场空间" },
        { value: "ARR", label: "收入模型" },
        { value: "Runway", label: "资金计划" },
      ],
    },
    product: {
      variant: "product",
      kicker: "PRODUCT EDGE",
      section: "VALUE PROOF",
      chip: "产品亮点",
      caption: "核心能力、场景价值和差异化证据",
      metrics: [
        { value: "01", label: "核心功能" },
        { value: "3X", label: "效率提升" },
        { value: "NPS", label: "用户口碑" },
      ],
    },
  };
  return scenes[variant] || scenes.startup;
}

function pitchDeckVariant(visual) {
  return ["startup", "investor", "product"].includes(visual?.variant) ? visual.variant : "startup";
}

function isPitchDeckVisual(visual) {
  return visual?.id === "pitch" && visual?.layout === "venture";
}

function marketingCampaignVisualXml({ visual, palette, scene, isCover }) {
  const panel = isCover
    ? { x: 6172200, y: 1447800, cx: 2133600, cy: 1676400 }
    : { x: 6172200, y: 1371600, cx: 2011680, cy: 1524000 };
  const frame = isCover
    ? { x: 6042660, y: 1325880, cx: 2133600, cy: 1676400 }
    : { x: 6065520, y: 1257300, cx: 2011680, cy: 1524000 };
  const basePanel = solidShapeXml({ id: 320, name: "Marketing Visual Panel", geom: "roundRect", ...panel, fill: palette.panel })
    + lineFrameShapeXml({ id: 321, name: "Marketing Visual Frame", geom: "roundRect", ...frame, stroke: palette.frame, width: 15240 });
  if (scene.variant === "brand") {
    return basePanel
      + solidShapeXml({ id: 322, name: "Marketing Brand Circle A", geom: "ellipse", x: panel.x + 274320, y: panel.y + 274320, cx: 457200, cy: 457200, fill: visual.primary })
      + solidShapeXml({ id: 323, name: "Marketing Brand Circle B", geom: "ellipse", x: panel.x + 1188720, y: panel.y + 274320, cx: 457200, cy: 457200, fill: visual.accent })
      + solidShapeXml({ id: 324, name: "Marketing Brand Signal", geom: "roundRect", x: panel.x + 304800, y: panel.y + 1036320, cx: 1371600, cy: 137160, fill: palette.chip })
      + solidShapeXml({ id: 325, name: "Marketing Brand Subline", geom: "roundRect", x: panel.x + 304800, y: panel.y + 1257300, cx: 914400, cy: 60960, fill: palette.line });
  }
  if (scene.variant === "growth") {
    return basePanel
      + solidShapeXml({ id: 322, name: "Marketing Growth Axis", geom: "roundRect", x: panel.x + 274320, y: panel.y + 1203960, cx: 1432560, cy: 30480, fill: palette.line })
      + solidShapeXml({ id: 323, name: "Marketing Growth Bar 1", geom: "roundRect", x: panel.x + 426720, y: panel.y + 838200, cx: 182880, cy: 365760, fill: visual.primary })
      + solidShapeXml({ id: 324, name: "Marketing Growth Bar 2", geom: "roundRect", x: panel.x + 792480, y: panel.y + 609600, cx: 182880, cy: 594360, fill: visual.accent })
      + solidShapeXml({ id: 325, name: "Marketing Growth Bar 3", geom: "roundRect", x: panel.x + 1158240, y: panel.y + 381000, cx: 182880, cy: 822960, fill: visual.primary })
      + arcLineShapeXml({ id: 326, name: "Marketing Growth Arc", x: panel.x + 304800, y: panel.y + 365760, cx: 1371600, cy: 914400, stroke: visual.accent, width: 30480 });
  }
  return basePanel
    + solidShapeXml({ id: 322, name: "Marketing Launch Hero Card", geom: "roundRect", x: panel.x + 304800, y: panel.y + 304800, cx: 1219200, cy: 457200, fill: visual.primary })
    + solidShapeXml({ id: 323, name: "Marketing Launch CTA", geom: "roundRect", x: panel.x + 396240, y: panel.y + 960120, cx: 914400, cy: 91440, fill: visual.accent })
    + solidShapeXml({ id: 324, name: "Marketing Launch Product Dot", geom: "ellipse", x: panel.x + 1402080, y: panel.y + 1036320, cx: 335280, cy: 335280, fill: palette.soft })
    + solidShapeXml({ id: 325, name: "Marketing Launch Tile", geom: "roundRect", x: panel.x + 274320, y: panel.y + 1257300, cx: 335280, cy: 274320, fill: palette.card });
}

function marketingCampaignMetricCardsXml({ visual, palette, metrics }) {
  return metrics.map((metric, index) => {
    const x = 1066800 + index * 1219200;
    return solidShapeXml({ id: 350 + index * 3, name: `Marketing Metric Card ${index + 1}`, geom: "roundRect", x, y: 3581400, cx: 1066800, cy: 548640, fill: palette.card })
      + textShapeXml({ id: 351 + index * 3, name: `Marketing Metric Value ${index + 1}`, x: x + 121920, y: 3688080, cx: 822960, cy: 182880, text: metric.value, size: 1300, bold: true, color: visual.title })
      + textShapeXml({ id: 352 + index * 3, name: `Marketing Metric Label ${index + 1}`, x: x + 121920, y: 3893820, cx: 822960, cy: 152400, text: metric.label, size: 700, bold: true, color: visual.body });
  }).join("");
}

function marketingCampaignChannelCardsXml({ visual, palette }) {
  return [0, 1, 2].map((itemIndex) => {
    const x = 1066800 + itemIndex * 1219200;
    return solidShapeXml({ id: 370 + itemIndex, name: `Marketing Channel Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3581400, cx: 1066800, cy: 396240, fill: itemIndex === 1 ? palette.soft : palette.card })
      + solidShapeXml({ id: 374 + itemIndex, name: `Marketing Channel Marker ${itemIndex + 1}`, geom: "ellipse", x: x + 152400, y: 3718560, cx: 91440, cy: 91440, fill: itemIndex === 1 ? visual.accent : visual.primary });
  }).join("");
}

function marketingCampaignColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.accent, 0.12),
    chip: blendHexColor(visual.primary, visual.accent, visual.variant === "growth" ? 0.25 : 0.15),
    coverWash: blendHexColor(visual.surface, visual.background, 0.22),
    frame: blendHexColor(visual.primary, visual.surface, 0.32),
    line: blendHexColor(visual.primary, visual.background, 0.56),
    panel: blendHexColor(visual.surface, visual.background, 0.28),
    soft: blendHexColor(visual.accent, visual.background, 0.62),
  };
}

function marketingCampaignScene(visual) {
  const variant = marketingCampaignVariant(visual);
  const scenes = {
    launch: {
      variant: "launch",
      kicker: "PRODUCT LAUNCH",
      section: "GO TO MARKET",
      chip: "新品首发",
      caption: "首发卖点、场景化素材与发布节奏",
      metrics: [
        { value: "01", label: "首发卖点" },
        { value: "3", label: "核心场景" },
        { value: "7D", label: "发布节奏" },
      ],
    },
    brand: {
      variant: "brand",
      kicker: "BRAND VOICE",
      section: "CONTENT MATRIX",
      chip: "品牌声量",
      caption: "品牌识别、传播主张与内容矩阵",
      metrics: [
        { value: "VI", label: "识别系统" },
        { value: "3", label: "传播主张" },
        { value: "全域", label: "内容触点" },
      ],
    },
    growth: {
      variant: "growth",
      kicker: "GROWTH LOOP",
      section: "CHANNEL FUNNEL",
      chip: "增长转化",
      caption: "渠道漏斗、转化路径与复购闭环",
      metrics: [
        { value: "AARRR", label: "增长模型" },
        { value: "5", label: "关键触点" },
        { value: "ROI", label: "投放复盘" },
      ],
    },
  };
  return scenes[variant] || scenes.launch;
}

function marketingCampaignVariant(visual) {
  return ["launch", "brand", "growth"].includes(visual?.variant) ? visual.variant : "launch";
}

function isMarketingCampaignVisual(visual) {
  return visual?.id === "marketing-campaign" && visual?.layout === "marketing";
}

function dataInsightVisualXml({ visual, palette, scene, isCover }) {
  const panel = isCover
    ? { x: 6172200, y: 1447800, cx: 2133600, cy: 1676400 }
    : { x: 6172200, y: 1371600, cx: 2011680, cy: 1524000 };
  const frame = isCover
    ? { x: 6042660, y: 1325880, cx: 2133600, cy: 1676400 }
    : { x: 6065520, y: 1257300, cx: 2011680, cy: 1524000 };
  const basePanel = solidShapeXml({ id: 520, name: "Data Insight Visual Panel", geom: scene.variant === "insight" ? "ellipse" : "roundRect", ...panel, fill: palette.panel })
    + lineFrameShapeXml({ id: 521, name: "Data Insight Visual Frame", geom: scene.variant === "insight" ? "ellipse" : "roundRect", ...frame, stroke: palette.frame, width: 15240 });
  if (scene.variant === "insight") {
    return basePanel
      + lineFrameShapeXml({ id: 522, name: "Data Insight Magnifier Ring", geom: "ellipse", x: panel.x + 457200, y: panel.y + 304800, cx: 914400, cy: 914400, stroke: visual.accent, width: 38100 })
      + solidShapeXml({ id: 523, name: "Data Insight Magnifier Handle", geom: "parallelogram", x: panel.x + 1188720, y: panel.y + 1036320, cx: 579120, cy: 91440, fill: visual.primary })
      + arcLineShapeXml({ id: 524, name: "Data Insight Finding Curve", x: panel.x + 335280, y: panel.y + 457200, cx: 1219200, cy: 822960, stroke: visual.accent, width: 30480 })
      + solidShapeXml({ id: 525, name: "Data Insight Signal Dot A", geom: "ellipse", x: panel.x + 594360, y: panel.y + 792480, cx: 91440, cy: 91440, fill: visual.primary })
      + solidShapeXml({ id: 526, name: "Data Insight Signal Dot B", geom: "ellipse", x: panel.x + 960120, y: panel.y + 609600, cx: 91440, cy: 91440, fill: visual.accent });
  }
  if (scene.variant === "research") {
    return basePanel
      + rectShapeXml({ id: 522, name: "Data Insight Research Header Line", x: panel.x + 304800, y: panel.y + 304800, cx: 1219200, cy: 45720, fill: visual.accent })
      + rectShapeXml({ id: 523, name: "Data Insight Research Evidence Line 1", x: panel.x + 304800, y: panel.y + 609600, cx: 1371600, cy: 30480, fill: palette.line })
      + rectShapeXml({ id: 524, name: "Data Insight Research Evidence Line 2", x: panel.x + 304800, y: panel.y + 838200, cx: 1066800, cy: 30480, fill: palette.soft })
      + solidShapeXml({ id: 525, name: "Data Insight Research Quote Card", geom: "roundRect", x: panel.x + 304800, y: panel.y + 1066800, cx: 914400, cy: 335280, fill: palette.card })
      + rectShapeXml({ id: 526, name: "Data Insight Research Footnote Rule", x: panel.x + 304800, y: panel.y + 1463040, cx: 1280160, cy: 22860, fill: visual.primary });
  }
  return basePanel
    + rectShapeXml({ id: 522, name: "Data Insight Dashboard Axis", x: panel.x + 304800, y: panel.y + 1219200, cx: 1371600, cy: 30480, fill: palette.line })
    + solidShapeXml({ id: 523, name: "Data Insight Dashboard Bar 1", geom: "roundRect", x: panel.x + 396240, y: panel.y + 853440, cx: 167640, cy: 365760, fill: visual.accent })
    + solidShapeXml({ id: 524, name: "Data Insight Dashboard Bar 2", geom: "roundRect", x: panel.x + 701040, y: panel.y + 609600, cx: 167640, cy: 609600, fill: visual.primary })
    + solidShapeXml({ id: 525, name: "Data Insight Dashboard Bar 3", geom: "roundRect", x: panel.x + 1005840, y: panel.y + 762000, cx: 167640, cy: 457200, fill: visual.accent })
    + solidShapeXml({ id: 526, name: "Data Insight Dashboard Bar 4", geom: "roundRect", x: panel.x + 1310640, y: panel.y + 426720, cx: 167640, cy: 792480, fill: visual.primary })
    + solidShapeXml({ id: 527, name: "Data Insight Dashboard Alert Dot", geom: "ellipse", x: panel.x + 1478280, y: panel.y + 365760, cx: 243840, cy: 243840, fill: palette.alert });
}

function dataInsightMetricCardsXml({ visual, palette, metrics }) {
  return metrics.map((metric, index) => {
    const x = 1066800 + index * 1219200;
    return solidShapeXml({ id: 560 + index * 3, name: `Data Insight Metric Card ${index + 1}`, geom: "roundRect", x, y: 3581400, cx: 1066800, cy: 548640, fill: index === 1 ? palette.soft : palette.card })
      + textShapeXml({ id: 561 + index * 3, name: `Data Insight Metric Value ${index + 1}`, x: x + 121920, y: 3688080, cx: 822960, cy: 182880, text: metric.value, size: 1260, bold: true, color: visual.title })
      + textShapeXml({ id: 562 + index * 3, name: `Data Insight Metric Label ${index + 1}`, x: x + 121920, y: 3893820, cx: 822960, cy: 152400, text: metric.label, size: 700, bold: true, color: visual.body });
  }).join("");
}

function dataInsightSignalCardsXml({ visual, palette }) {
  return [0, 1, 2].map((itemIndex) => {
    const x = 1066800 + itemIndex * 1219200;
    return solidShapeXml({ id: 580 + itemIndex * 2, name: `Data Insight Signal Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3581400, cx: 1066800, cy: 396240, fill: itemIndex === 1 ? palette.soft : palette.card })
      + rectShapeXml({ id: 581 + itemIndex * 2, name: `Data Insight Signal Rule ${itemIndex + 1}`, x: x + 152400, y: 3718560, cx: 762000, cy: 30480, fill: itemIndex === 1 ? visual.accent : visual.primary });
  }).join("");
}

function dataInsightColorPalette(visual) {
  return {
    alert: blendHexColor(visual.accent, "FFFFFF", 0.24),
    card: blendHexColor(visual.surface, visual.background, 0.22),
    chip: blendHexColor(visual.primary, visual.accent, dataInsightVariant(visual) === "insight" ? 0.22 : 0.14),
    coverWash: blendHexColor(visual.surface, visual.background, 0.18),
    frame: blendHexColor(visual.primary, visual.surface, 0.28),
    line: blendHexColor(visual.primary, visual.background, 0.54),
    panel: blendHexColor(visual.surface, visual.accent, 0.10),
    soft: blendHexColor(visual.accent, visual.surface, 0.72),
  };
}

function dataInsightScene(visual) {
  const variant = dataInsightVariant(visual);
  const scenes = {
    dashboard: {
      variant: "dashboard",
      kicker: "DATA COMMAND CENTER",
      section: "KPI DASHBOARD",
      chip: "仪表盘",
      caption: "核心指标、异常波动与经营信号",
      metrics: [
        { value: "KPI", label: "指标总览" },
        { value: "24H", label: "数据刷新" },
        { value: "3", label: "异常信号" },
      ],
    },
    insight: {
      variant: "insight",
      kicker: "INSIGHT FINDINGS",
      section: "SIGNAL ANALYSIS",
      chip: "洞察分析",
      caption: "趋势拆解、原因定位与行动优先级",
      metrics: [
        { value: "01", label: "关键发现" },
        { value: "4", label: "影响因子" },
        { value: "Next", label: "行动建议" },
      ],
    },
    research: {
      variant: "research",
      kicker: "RESEARCH NOTE",
      section: "EVIDENCE REVIEW",
      chip: "研究报告",
      caption: "样本、结论和可追溯的研究证据",
      metrics: [
        { value: "N", label: "样本说明" },
        { value: "CI", label: "置信区间" },
        { value: "Ref", label: "证据索引" },
      ],
    },
  };
  return scenes[variant] || scenes.dashboard;
}

function dataInsightVariant(visual) {
  return ["dashboard", "insight", "research"].includes(visual?.variant) ? visual.variant : "dashboard";
}

function isDataInsightVisual(visual) {
  return visual?.id === "data-insight" && visual?.layout === "data-insight";
}

function educationCourseVisualXml({ visual, palette, scene, isCover }) {
  const panel = isCover
    ? { x: 6172200, y: 1463040, cx: 2133600, cy: 1676400 }
    : { x: 6286500, y: 1371600, cx: 1371600, cy: 1066800 };
  const frame = isCover
    ? { x: 6042660, y: 1325880, cx: 2133600, cy: 1676400 }
    : { x: 6210300, y: 1295400, cx: 1371600, cy: 1066800 };
  const basePanel = solidShapeXml({ id: 620, name: "Education Course Visual Panel", geom: "roundRect", ...panel, fill: palette.panel })
    + lineFrameShapeXml({ id: 621, name: "Education Course Visual Frame", geom: "roundRect", ...frame, stroke: palette.frame, width: 15240 });
  if (scene.variant === "workshop") {
    return basePanel
      + solidShapeXml({ id: 622, name: "Education Course Sticky Note 1", geom: "roundRect", x: panel.x + 228600, y: panel.y + 259080, cx: 594360, cy: 457200, fill: palette.soft })
      + solidShapeXml({ id: 623, name: "Education Course Sticky Note 2", geom: "roundRect", x: panel.x + 1112520, y: panel.y + 335280, cx: 594360, cy: 457200, fill: palette.card })
      + rectShapeXml({ id: 624, name: "Education Course Workshop Path", x: panel.x + 457200, y: panel.y + 891540, cx: 1219200, cy: 22860, fill: palette.line })
      + solidShapeXml({ id: 625, name: "Education Course Group A", geom: "ellipse", x: panel.x + 350520, y: panel.y + 1013460, cx: 182880, cy: 182880, fill: visual.accent })
      + solidShapeXml({ id: 626, name: "Education Course Group B", geom: "ellipse", x: panel.x + 883920, y: panel.y + 1013460, cx: 182880, cy: 182880, fill: visual.primary })
      + solidShapeXml({ id: 627, name: "Education Course Group C", geom: "ellipse", x: panel.x + 1417320, y: panel.y + 1013460, cx: 182880, cy: 182880, fill: palette.alert });
  }
  if (scene.variant === "minimal") {
    return basePanel
      + rectShapeXml({ id: 622, name: "Education Course Note Title Line", x: panel.x + 304800, y: panel.y + 350520, cx: 1219200, cy: 38100, fill: visual.primary })
      + rectShapeXml({ id: 623, name: "Education Course Note Rule 1", x: panel.x + 304800, y: panel.y + 670560, cx: 1524000, cy: 30480, fill: palette.line })
      + rectShapeXml({ id: 624, name: "Education Course Note Rule 2", x: panel.x + 304800, y: panel.y + 929640, cx: 1219200, cy: 30480, fill: palette.line })
      + solidShapeXml({ id: 625, name: "Education Course Highlight", geom: "roundRect", x: panel.x + 304800, y: panel.y + 1219200, cx: 914400, cy: 243840, fill: palette.soft });
  }
  return basePanel
    + solidShapeXml({ id: 622, name: "Education Course Board Surface", geom: "roundRect", x: panel.x + 259080, y: panel.y + 274320, cx: 1524000, cy: 944880, fill: blendHexColor(visual.primary, "000000", 0.14) })
    + rectShapeXml({ id: 623, name: "Education Course Chalk Line 1", x: panel.x + 441960, y: panel.y + 548640, cx: 990600, cy: 38100, fill: palette.chalk })
    + rectShapeXml({ id: 624, name: "Education Course Chalk Line 2", x: panel.x + 441960, y: panel.y + 731520, cx: 746760, cy: 30480, fill: palette.chalk })
    + rectShapeXml({ id: 625, name: "Education Course Chalk Tray", x: panel.x + 609600, y: panel.y + 1135380, cx: 762000, cy: 45720, fill: visual.accent })
    + solidShapeXml({ id: 626, name: "Education Course Lesson Dot", geom: "ellipse", x: panel.x + 1447800, y: panel.y + 388620, cx: 167640, cy: 167640, fill: visual.accent });
}

function educationCourseOutcomeCardsXml({ visual, palette, outcomes }) {
  return outcomes.map((item, itemIndex) => {
    const x = 1066800 + itemIndex * 1219200;
    return solidShapeXml({ id: 660 + itemIndex * 2, name: `Education Course Outcome Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3550920, cx: 1066800, cy: 457200, fill: itemIndex === 1 ? palette.soft : palette.card })
      + textShapeXml({ id: 661 + itemIndex * 2, name: `Education Course Outcome Text ${itemIndex + 1}`, x: x + 91440, y: 3680460, cx: 883920, cy: 152400, text: item, size: 760, bold: true, color: visual.title });
  }).join("");
}

function educationCourseNoteCardsXml({ visual, palette }) {
  return [0, 1, 2].map((itemIndex) => {
    const x = 1066800 + itemIndex * 1219200;
    return solidShapeXml({ id: 680 + itemIndex * 2, name: `Education Course Note Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3581400, cx: 1066800, cy: 396240, fill: itemIndex === 1 ? palette.soft : palette.card })
      + rectShapeXml({ id: 681 + itemIndex * 2, name: `Education Course Note Rule ${itemIndex + 1}`, x: x + 152400, y: 3718560, cx: 762000, cy: 30480, fill: itemIndex === 1 ? visual.accent : visual.primary });
  }).join("");
}

function educationCourseColorPalette(visual) {
  return {
    alert: blendHexColor(visual.accent, visual.primary, 0.16),
    card: blendHexColor(visual.surface, visual.background, 0.18),
    chalk: blendHexColor("FFFFFF", visual.accent, 0.12),
    chip: blendHexColor(visual.primary, visual.accent, educationCourseVariant(visual) === "workshop" ? 0.24 : 0.14),
    coverWash: blendHexColor(visual.surface, visual.background, 0.16),
    frame: blendHexColor(visual.primary, visual.surface, 0.28),
    line: blendHexColor(visual.primary, visual.background, 0.52),
    panel: blendHexColor(visual.surface, visual.accent, 0.10),
    soft: blendHexColor(visual.accent, visual.surface, 0.72),
  };
}

function educationCourseScene(visual) {
  const variant = educationCourseVariant(visual);
  const scenes = {
    lecture: {
      variant: "lecture",
      kicker: "CLASSROOM BRIEF",
      section: "LESSON POINTS",
      chip: "课题讲授",
      caption: "概念讲解、板书结构与课堂小结",
      outcomes: ["目标导入", "概念讲授", "课堂总结"],
    },
    workshop: {
      variant: "workshop",
      kicker: "WORKSHOP MAP",
      section: "GROUP ACTIVITY",
      chip: "互动工作坊",
      caption: "分组任务、讨论反馈与共创产出",
      outcomes: ["分组协作", "互动练习", "成果共创"],
    },
    minimal: {
      variant: "minimal",
      kicker: "TEACHING NOTE",
      section: "KEY TAKEAWAYS",
      chip: "简洁教学",
      caption: "清晰讲义、重点标注与复习路径",
      outcomes: ["知识框架", "重点提示", "练习巩固"],
    },
  };
  return scenes[variant] || scenes.lecture;
}

function educationCourseVariant(visual) {
  return ["lecture", "workshop", "minimal"].includes(visual?.variant) ? visual.variant : "lecture";
}

function isEducationCourseVisual(visual) {
  return visual?.id === "education" && visual?.layout === "education-course";
}

function brandStoryVisualXml({ visual, palette, scene, isCover }) {
  const panel = isCover
    ? { x: 6172200, y: 1463040, cx: 2133600, cy: 1676400 }
    : { x: 6172200, y: 1371600, cx: 2011680, cy: 1524000 };
  const frame = isCover
    ? { x: 6042660, y: 1325880, cx: 2133600, cy: 1676400 }
    : { x: 6065520, y: 1257300, cx: 2011680, cy: 1524000 };
  const basePanel = solidShapeXml({ id: 420, name: "Brand Story Image Panel", geom: scene.variant === "identity" ? "ellipse" : "rect", ...panel, fill: palette.panel })
    + lineFrameShapeXml({ id: 421, name: "Brand Story Image Frame", geom: scene.variant === "identity" ? "ellipse" : "roundRect", ...frame, stroke: palette.frame, width: 15240 });
  if (scene.variant === "premium") {
    return basePanel
      + solidShapeXml({ id: 422, name: "Brand Story Premium Texture Block", geom: "roundRect", x: panel.x + 304800, y: panel.y + 274320, cx: 822960, cy: 304800, fill: palette.soft })
      + solidShapeXml({ id: 423, name: "Brand Story Premium Gold Slab", x: panel.x + 1257300, y: panel.y + 548640, cx: 335280, cy: 762000, fill: visual.accent })
      + solidShapeXml({ id: 424, name: "Brand Story Premium Shadow Card", geom: "roundRect", x: panel.x + 274320, y: panel.y + 960120, cx: 853440, cy: 335280, fill: palette.card })
      + rectShapeXml({ id: 425, name: "Brand Story Premium Fine Rule", x: panel.x + 304800, y: panel.y + 1341120, cx: 1188720, cy: 30480, fill: palette.line });
  }
  if (scene.variant === "identity") {
    return basePanel
      + solidShapeXml({ id: 422, name: "Brand Story Identity Symbol Core", geom: "ellipse", x: panel.x + 670560, y: panel.y + 396240, cx: 640080, cy: 640080, fill: visual.primary })
      + solidShapeXml({ id: 423, name: "Brand Story Identity Accent Tile", geom: "roundRect", x: panel.x + 1158240, y: panel.y + 990600, cx: 487680, cy: 426720, fill: visual.accent })
      + lineFrameShapeXml({ id: 424, name: "Brand Story Identity Orbit", geom: "ellipse", x: panel.x + 365760, y: panel.y + 213360, cx: 1280160, cy: 1280160, stroke: palette.frame, width: 22860 })
      + rectShapeXml({ id: 425, name: "Brand Story Identity Baseline", x: panel.x + 426720, y: panel.y + 1417320, cx: 1127760, cy: 30480, fill: palette.line });
  }
  return basePanel
    + rectShapeXml({ id: 422, name: "Brand Story Editorial Lead Line", x: panel.x + 304800, y: panel.y + 365760, cx: 1219200, cy: 60960, fill: visual.accent })
    + rectShapeXml({ id: 423, name: "Brand Story Editorial Sub Line", x: panel.x + 304800, y: panel.y + 609600, cx: 822960, cy: 60960, fill: palette.line })
    + solidShapeXml({ id: 424, name: "Brand Story Editorial Photo Tone", geom: "roundRect", x: panel.x + 304800, y: panel.y + 990600, cx: 792480, cy: 426720, fill: palette.soft })
    + solidShapeXml({ id: 425, name: "Brand Story Editorial Color Field", x: panel.x + 1249680, y: panel.y + 899160, cx: 426720, cy: 548640, fill: palette.chip });
}

function brandStoryPointCardsXml({ visual, palette, scene }) {
  return scene.points.map((point, index) => {
    const x = 1066800 + index * 1219200;
    return solidShapeXml({ id: 460 + index * 2, name: `Brand Story Point Card ${index + 1}`, x, y: 3581400, cx: 1066800, cy: 548640, fill: index === 1 ? palette.soft : palette.card })
      + textShapeXml({ id: 461 + index * 2, name: `Brand Story Point Text ${index + 1}`, x: x + 121920, y: 3749040, cx: 822960, cy: 182880, text: point, size: 760, bold: true, color: visual.title });
  }).join("");
}

function brandStoryIndexCardsXml({ visual, palette }) {
  return [0, 1, 2].map((itemIndex) => {
    const x = 1066800 + itemIndex * 1219200;
    return solidShapeXml({ id: 470 + itemIndex * 2, name: `Brand Story Index Card ${itemIndex + 1}`, x, y: 3581400, cx: 1066800, cy: 396240, fill: itemIndex === 1 ? palette.soft : palette.card })
      + rectShapeXml({ id: 471 + itemIndex * 2, name: `Brand Story Index Rule ${itemIndex + 1}`, x, y: 3581400, cx: 1066800, cy: 30480, fill: visual.accent })
      + textShapeXml({ id: 477 + itemIndex, name: `Brand Story Index Number ${itemIndex + 1}`, x: x + 426720, y: 3688080, cx: 213360, cy: 152400, text: `0${itemIndex + 1}`, size: 760, bold: true, color: visual.title });
  }).join("");
}

function brandStoryColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.22),
    chip: blendHexColor(visual.primary, visual.accent, brandStoryVariant(visual) === "premium" ? 0.22 : 0.14),
    coverWash: blendHexColor(visual.surface, visual.background, 0.18),
    frame: blendHexColor(visual.primary, visual.surface, 0.26),
    line: blendHexColor(visual.primary, visual.background, 0.50),
    monogram: blendHexColor(visual.accent, visual.surface, 0.24),
    panel: blendHexColor(visual.surface, visual.accent, 0.10),
    soft: blendHexColor(visual.accent, visual.surface, 0.72),
    spine: blendHexColor(visual.primary, "0F172A", 0.16),
  };
}

function brandStoryScene(visual) {
  const variant = brandStoryVariant(visual);
  const scenes = {
    editorial: {
      variant: "editorial",
      kicker: "EDITORIAL STORY",
      section: "NARRATIVE ARC",
      chip: "编辑叙事",
      caption: "品牌主张、故事线与传播语境",
      mark: "ST",
      points: ["品牌起点", "核心主张", "传播语境"],
    },
    premium: {
      variant: "premium",
      kicker: "PREMIUM MOOD",
      section: "TEXTURE SYSTEM",
      chip: "高端质感",
      caption: "材质、影调与高级视觉秩序",
      mark: "PR",
      points: ["品质证据", "高级影调", "信任资产"],
    },
    identity: {
      variant: "identity",
      kicker: "BRAND IDENTITY",
      section: "VISUAL CODES",
      chip: "品牌识别",
      caption: "识别符号、色彩系统与触点一致性",
      mark: "ID",
      points: ["识别符号", "色彩系统", "触点规范"],
    },
  };
  return scenes[variant] || scenes.editorial;
}

function brandStoryVariant(visual) {
  return ["editorial", "premium", "identity"].includes(visual?.variant) ? visual.variant : "editorial";
}

function isBrandStoryVisual(visual) {
  return visual?.id === "brand-story" && visual?.layout === "brand-story";
}

function financialReviewDecorationsXml({ visual, index, layout }) {
  const scene = financialReviewScene(visual);
  const palette = financialReviewColorPalette(visual);
  const isCover = index === 0;
  return solidShapeXml({ id: 100, name: "Financial Visual Panel", geom: "roundRect", x: 6233160, y: 1394460, cx: 2011680, cy: 1463040, fill: palette.panel })
    + lineFrameShapeXml({ id: 101, name: "Financial Visual Frame", geom: "roundRect", x: 6141720, y: 1303020, cx: 2011680, cy: 1463040, stroke: visual.accent, width: 15240 })
    + solidShapeXml({ id: 102, name: `Financial ${scene.variant} Chip`, geom: scene.chipShape, x: 7040880, y: 914400, cx: 822960, cy: 274320, fill: palette.chip })
    + textShapeXml({ id: 103, name: "Financial Chip Text", x: 7162800, y: 967740, cx: 548640, cy: 152400, text: scene.chip, size: 800, bold: true, color: "FFFFFF" })
    + textShapeXml({ id: 104, name: "Financial Section Label", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 1000, bold: true, color: visual.accent })
    + solidShapeXml({ id: 105, name: "Financial Focus Line", x: 914400, y: isCover ? 3322320 : 1516380, cx: 3505200, cy: 22860, fill: visual.accent })
    + financialReviewVisualXml({ visual, palette, scene });
}

function financialReviewVisualXml({ visual, palette, scene }) {
  if (scene.variant === "audit") {
    return [0, 1, 2].map((itemIndex) => {
      const y = 1699260 + itemIndex * 304800;
      return solidShapeXml({ id: 110 + itemIndex * 4, name: `Financial Audit Dot ${itemIndex + 1}`, geom: "ellipse", x: 6423660, y, cx: 121920, cy: 121920, fill: visual.accent })
        + solidShapeXml({ id: 111 + itemIndex * 4, name: `Financial Audit Rule ${itemIndex + 1}`, x: 6652260, y: y + 45720, cx: 1257300, cy: 30480, fill: palette.line })
        + solidShapeXml({ id: 112 + itemIndex * 4, name: `Financial Audit Subrule ${itemIndex + 1}`, x: 6652260, y: y + 121920, cx: 914400, cy: 22860, fill: palette.soft });
    }).join("");
  }
  if (scene.variant === "forecast") {
    return solidShapeXml({ id: 110, name: "Financial Forecast Base Line", x: 6454140, y: 2476500, cx: 1424940, cy: 22860, fill: palette.line })
      + solidShapeXml({ id: 111, name: "Financial Forecast Segment 1", geom: "parallelogram", x: 6484620, y: 2232660, cx: 457200, cy: 45720, fill: visual.accent })
      + solidShapeXml({ id: 112, name: "Financial Forecast Segment 2", geom: "parallelogram", x: 6903720, y: 2072640, cx: 457200, cy: 45720, fill: visual.accent })
      + solidShapeXml({ id: 113, name: "Financial Forecast Segment 3", geom: "parallelogram", x: 7322820, y: 1844040, cx: 487680, cy: 45720, fill: visual.accent })
      + [0, 1, 2, 3].map((itemIndex) => solidShapeXml({ id: 114 + itemIndex, name: `Financial Forecast Dot ${itemIndex + 1}`, geom: "ellipse", x: 6484620 + itemIndex * 419100, y: 2263140 - itemIndex * 152400, cx: 121920, cy: 121920, fill: itemIndex === 3 ? visual.primary : visual.accent })).join("");
  }
  return [0, 1, 2, 3].map((itemIndex) => {
    const heights = [365760, 609600, 487680, 762000];
    const x = 6454140 + itemIndex * 335280;
    const y = 2484120 - heights[itemIndex];
    return solidShapeXml({ id: 110 + itemIndex, name: `Financial Bar ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 152400, cy: heights[itemIndex], fill: itemIndex === 3 ? visual.primary : visual.accent });
  }).join("") + solidShapeXml({ id: 116, name: "Financial Bar Baseline", x: 6385560, y: 2506980, cx: 1524000, cy: 22860, fill: palette.line });
}

function financialReviewColorPalette(visual) {
  return {
    panel: blendHexColor(visual.surface, visual.background, 0.28),
    chip: visual.variant === "audit" ? blendHexColor(visual.primary, visual.accent, 0.22) : visual.primary,
    line: blendHexColor(visual.primary, visual.background, 0.55),
    soft: blendHexColor(visual.accent, visual.background, 0.68),
  };
}

function financialReviewScene(visual) {
  const variant = financialReviewVariant(visual);
  const scenes = {
    quarterly: {
      variant: "quarterly",
      kicker: "FINANCE REVIEW",
      section: "QUARTERLY RESULT",
      chip: "复盘",
      chipShape: "roundRect",
      points: ["收入结构", "利润质量", "现金效率"],
    },
    audit: {
      variant: "audit",
      kicker: "AUDIT CHECK",
      section: "RISK REVIEW",
      chip: "审计",
      chipShape: "rect",
      points: ["差异核验", "风险底稿", "整改闭环"],
    },
    forecast: {
      variant: "forecast",
      kicker: "FORECAST PLAN",
      section: "BUDGET OUTLOOK",
      chip: "预测",
      chipShape: "parallelogram",
      points: ["滚动预测", "预算校准", "情景假设"],
    },
  };
  return scenes[variant] || scenes.quarterly;
}

function financialReviewVariant(visual) {
  return ["quarterly", "audit", "forecast"].includes(visual?.variant) ? visual.variant : "quarterly";
}

function isFinancialReviewVisual(visual) {
  return visual?.id === "financial-review" && visual?.layout === "executive";
}

function strategyConsultingDecorationsXml({ visual, index, layout }) {
  const scene = strategyConsultingScene(visual);
  const palette = strategyConsultingColorPalette(visual);
  const isCover = index === 0;
  return pictureXml({ id: 60, name: "Strategy Consulting Image", relId: "rId2", x: 6431280, y: 1470660, cx: 1828800, cy: 1280160 })
    + lineFrameShapeXml({ id: 61, name: "Strategy Consulting Image Frame", geom: "roundRect", x: 6339840, y: 1379220, cx: 1828800, cy: 1280160, stroke: visual.accent, width: 15240 })
    + solidShapeXml({ id: 62, name: `Strategy ${scene.variant} Chip`, geom: scene.chipShape, x: 7040880, y: 914400, cx: 822960, cy: 274320, fill: palette.chip })
    + textShapeXml({ id: 63, name: "Strategy Chip Text", x: 7162800, y: 967740, cx: 548640, cy: 152400, text: scene.chip, size: 800, bold: true, color: "FFFFFF" })
    + textShapeXml({ id: 64, name: "Strategy Section Label", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 1000, bold: true, color: visual.accent })
    + solidShapeXml({ id: 65, name: "Strategy Consulting Focus Line", x: 914400, y: isCover ? 3322320 : 1516380, cx: 3505200, cy: 22860, fill: visual.accent });
}

function strategyConsultingColorPalette(visual) {
  return {
    chip: visual.variant === "matrix" ? visual.accent : blendHexColor(visual.primary, visual.accent, visual.variant === "workstream" ? 0.42 : 0.24),
  };
}

function strategyConsultingScene(visual) {
  const variant = strategyConsultingVariant(visual);
  const scenes = {
    board: {
      variant: "board",
      kicker: "BOARD BRIEFING",
      section: "DECISION MEMO",
      chip: "决策",
      chipShape: "roundRect",
      marks: ["议题优先级", "经营结论", "行动授权"],
    },
    matrix: {
      variant: "matrix",
      kicker: "MATRIX MODEL",
      section: "PORTFOLIO VIEW",
      chip: "分类",
      chipShape: "ellipse",
      marks: ["象限判断", "机会排序", "资源匹配"],
    },
    workstream: {
      variant: "workstream",
      kicker: "WORKSTREAM",
      section: "ROADMAP TRACK",
      chip: "推进",
      chipShape: "parallelogram",
      marks: ["阶段路径", "责任分工", "里程碑"],
    },
  };
  return scenes[variant] || scenes.board;
}

function strategyConsultingMedia(visual) {
  return STRATEGY_CONSULTING_MEDIA[strategyConsultingVariant(visual)] || STRATEGY_CONSULTING_MEDIA.board;
}

function strategyConsultingVariant(visual) {
  return ["board", "matrix", "workstream"].includes(visual?.variant) ? visual.variant : "board";
}

function isStrategyConsultingVisual(visual) {
  return visual?.id === "strategy-consulting" && visual?.layout === "executive";
}

function statusReportStickerXml({ visual, palette, scene }) {
  const shape = scene.variant === "weekly" ? "roundRect" : scene.variant === "steering" ? "rect" : "parallelogram";
  const width = scene.variant === "delivery" ? 914400 : 762000;
  return solidShapeXml({ id: 92, name: `Status ${scene.variant} Sticker`, geom: shape, x: 7437120, y: 838200, cx: width, cy: 335280, fill: scene.variant === "steering" ? palette.sticker : visual.accent })
    + textShapeXml({ id: 93, name: "Status Sticker Text", x: 7543800, y: 899160, cx: 609600, cy: 182880, text: scene.sticker, size: 900, bold: true, color: "FFFFFF" });
}

function statusReportColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.18),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.78),
    soft: blendHexColor(visual.primary, visual.background, 0.36),
    sticker: blendHexColor(visual.accent, visual.primary, 0.22),
  };
}

function statusReportScene(visual) {
  const variant = statusReportVariant(visual);
  const scenes = {
    weekly: {
      variant: "weekly",
      kicker: "PROJECT WEEKLY",
      section: "WEEKLY UPDATE",
      sticker: "进度",
      metrics: [
        { value: "95%", label: "进度达成" },
        { value: "3", label: "关键风险" },
        { value: "7", label: "本周事项" },
      ],
    },
    steering: {
      variant: "steering",
      kicker: "STEERING MEETING",
      section: "DECISION REVIEW",
      sticker: "决策",
      metrics: [
        { value: "4", label: "核心议题" },
        { value: "2", label: "待决事项" },
        { value: "8", label: "行动责任" },
      ],
    },
    delivery: {
      variant: "delivery",
      kicker: "DELIVERY TRACK",
      section: "MILESTONE CHECK",
      sticker: "验收",
      metrics: [
        { value: "12", label: "交付节点" },
        { value: "96%", label: "验收通过" },
        { value: "5", label: "风险闭环" },
      ],
    },
  };
  return scenes[variant] || scenes.weekly;
}

function statusReportMedia(visual) {
  return STATUS_REPORT_MEDIA[statusReportVariant(visual)] || STATUS_REPORT_MEDIA.weekly;
}

function statusReportVariant(visual) {
  return ["weekly", "steering", "delivery"].includes(visual?.variant) ? visual.variant : "weekly";
}

/**
 * 创建 top-band 底部细网格，让页面有正式 PPT 模板常见的版心和工程感装饰。
 * @param {{id: number, palette: object}} input
 * @returns {string}
 */
function topBandGridXml({ id, palette }) {
  const lines = [];
  for (let offset = 0; offset < 8; offset += 1) {
    lines.push(rectShapeXml({
      id: id + offset,
      name: `Top Band Bottom Grid ${offset + 1}`,
      x: 1005840 + offset * 685800,
      y: 4425950,
      cx: 7620,
      cy: 571500,
      fill: palette.lightLine,
    }));
  }
  return lines.join("");
}

function pictureXml({ id, name, relId, x, y, cx, cy }) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${escapeXml(relId)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></p:spPr></p:pic>`;
}

/**
 * 创建绝对定位文本框。
 * dome 相关文本框默认写入 Source Han Sans 字体声明，贴近原模板字形。
 * 主标题可传入 dome-gold-gradient，复用 dome.pptx 的金色渐变文字。
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, text?: string, body?: string, size: number, bold: boolean, color?: string}} input
 * @returns {string}
 */
function textShapeXml({ id, name, x, y, cx, cy, text, body, size, bold, color = "1F2937", fontFace = "", fillStyle = "" }) {
  const resolvedFontFace = fontFace || (String(name).startsWith("Dome") ? DOME_TEXT_FONT : "");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>${body || paragraphXml(text, size, bold, color, resolvedFontFace, fillStyle)}</p:txBody></p:sp>`;
}

/**
 * 创建一个 DrawingML 段落。
 * @param {unknown} value
 * @param {number} [size]
 * @param {boolean} [bold]
 * @param {string} [color]
 * @returns {string}
 */
function paragraphXml(value, size = 2200, bold = false, color = "1F2937", fontFace = "", fillStyle = "") {
  return `<a:p><a:r><a:rPr lang="zh-CN" sz="${size}"${bold ? ' b="1"' : ""}>${fontFaceXml(fontFace)}${textFillXml(color, fillStyle)}</a:rPr><a:t>${escapeXml(value)}</a:t></a:r></a:p>`;
}

/**
 * 为文本 run 写入字体族。
 * @param {string} fontFace
 * @returns {string}
 */
function fontFaceXml(fontFace) {
  if (!fontFace) return "";
  const escaped = escapeXml(fontFace);
  return `<a:latin typeface="${escaped}"/><a:ea typeface="${escaped}"/>`;
}

/**
 * 生成文本 run 的填充效果。
 * dome-gold-gradient 使用当前 red-gold 色板参数生成过渡色，方向为 5400000。
 * @param {string} color
 * @param {string} fillStyle
 * @returns {string}
 */
function textFillXml(color, fillStyle = "") {
  if (fillStyle.startsWith("dome-gold-gradient")) {
    const [, rawStart = "FFF8CC", rawEnd = "FCD696"] = fillStyle.split(":");
    const start = normalizeHexColor(rawStart);
    const end = normalizeHexColor(rawEnd);
    return `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="${start}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${end}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>`;
  }
  if (fillStyle.startsWith("top-band-title-gradient")) {
    const [, rawStart = "FFFFFF", rawEnd = "F8FAFC"] = fillStyle.split(":");
    const start = normalizeHexColor(rawStart);
    const end = normalizeHexColor(rawEnd);
    return `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="${start}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${end}"/></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill>`;
  }
  return `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
}

/**
 * 创建 store-only ZIP 包。
 * 这里不压缩文件内容，直接拼出 PPTX 需要的 ZIP 结构和 CRC。
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
 * 构建最小 PDF 文件。
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
 * 构建用户下载文件名。
 * 规则: PPT-标题-模板ID-页数p-生成时间-短ID.ext，既方便用户区分，也保持 HTTP 头和对象存储的 ASCII 安全。
 * @param {{deck: object, format: string}} input
 * @returns {string}
 */
function exportFileName({ deck, format }) {
  const title = safeFileNameSegment(deck?.title || "deck", { maxLength: 48 });
  const template = safeFileNameSegment(deck?.templateId || "template", { maxLength: 24 });
  const slideCount = Array.isArray(deck?.slides) && deck.slides.length > 0 ? deck.slides.length : 0;
  const timestamp = exportTimestamp(deck?.createdAt || deck?.updatedAt || deck?.created_at || deck?.updated_at);
  const shortId = safeFileNameSegment(shortDeckId(deck?.id), { maxLength: 12 });
  const parts = ["PPT", title, template, `${slideCount}p`, timestamp, shortId].filter(Boolean);
  return `${parts.join("-")}.${format}`;
}

/**
 * 生成文件名片段，移除中文、空格和特殊字符，避免 Content-Disposition 在部分浏览器中乱码。
 * @param {string} value
 * @param {{maxLength?: number}} options
 * @returns {string}
 */
function safeFileNameSegment(value, { maxLength = 64 } = {}) {
  const segment = String(value || "")
    .trim()
    .replaceAll(/[^a-zA-Z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replaceAll(/-+$/g, "");
  return segment || "untitled";
}

/**
 * 将 deck 时间标准化为北京时间友好的紧凑格式。
 * @param {string | number | Date | undefined} value
 * @returns {string}
 */
function exportTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(safeDate).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

/**
 * 从 deck ID 中提取短标识，便于定位记录且不让文件名过长。
 * @param {string | undefined} id
 * @returns {string}
 */
function shortDeckId(id) {
  const compact = String(id || "").replaceAll(/[^a-zA-Z0-9]/g, "");
  return compact ? compact.slice(-6) : "";
}
