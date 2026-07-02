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
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${groupShapeXml()}${templateDecorationsXml(visual, index, layout, role, slide)}${textShapeXml({ id: 20, name: titleName, ...layout.title, text: slide.title, size: layout.titleSize, bold: true, color: titleColor, fontFace, fillStyle: titleFillStyle })}${bodyShape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
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
  if (["executive", "academy", "venture"].includes(visual.layout)) {
    return base
      + rectShapeXml({ id: 8, name: "Soft Page Layer", x: 342900, y: 342900, cx: 8458200, cy: 4457700, fill: visual.surface })
      + rectShapeXml({ id: 3, name: "Hero Surface", ...layout.surface, fill: visual.surface })
      + rectShapeXml({ id: 4, name: "Primary Accent", ...layout.accent, fill: visual.primary })
      + rectShapeXml({ id: 5, name: "Secondary Accent", ...layout.secondaryAccent, fill: visual.accent })
      + rectShapeXml({ id: 6, name: "Top Rule", x: 685800, y: 342900, cx: 7772400, cy: 30480, fill: visual.accent })
      + rectShapeXml({ id: 9, name: "Fine Divider", x: 914400, y: index === 0 ? 2743200 : 1516380, cx: 4267200, cy: 15240, fill: visual.accent })
      // 封面不再写模板名称；非封面仍保留页序标签。
      + textShapeXml({ id: 7, name: "Section Label", ...layout.label, text: index === 0 ? "" : `0${index + 1}`, size: 1200, bold: true, color: index === 0 ? visual.surface : visual.accent });
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
          + lineFrameShapeXml({
            id: 28,
            name: "Top Band Content Accent Band",
            x: 1143000,
            y: panelY + 3009900,
            cx: 5829300,
            cy: 914400,
            stroke: palette.ruleLine,
            width: 3810,
          })
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
      + roleDecor
      + solidShapeXml({ id: 15, name: "Top Band Index Dot", geom: "ellipse", x: 171450, y: panelBottom - 548640, cx: 685800, cy: 685800, fill: palette.indexTag })
      + textShapeXml({
        id: 16,
        name: "Top Band Index Badge",
        x: 685800,
        y: panelBottom - 457200,
        cx: 3657600,
        cy: 304800,
        text: isCover ? "EXECUTIVE BRIEFING" : `PAGE ${index + 1}`,
        size: 900,
        bold: true,
        color: palette.surface,
      })
      + lineFrameShapeXml({
        id: 19,
        name: "Top Band Index Ring",
        geom: "ellipse",
        x: 685800,
        y: panelBottom - 1270000,
        cx: 431800,
        cy: 431800,
        stroke: palette.rule,
      })
      + textShapeXml({
        id: 20,
        name: "Top Band Ring Number",
        x: 771525,
        y: panelBottom - 1219200,
        cx: 260000,
        cy: 165100,
        text: String(index + 1).padStart(2, "0"),
        size: 1200,
        bold: true,
        color: visual.title,
      })
      + textShapeXml({
        id: 7,
        name: "Section Label",
        ...layout.label,
        text: index === 0 ? "" : `0${index + 1}`,
        size: 1100,
        bold: true,
        color: index === 0 ? visual.surface : visual.accent,
      })
      + rectShapeXml({ id: 8, name: "Top Band Footer", x: 0, y: 4800600, cx: 9144000, cy: 342900, fill: visual.background });
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
  return descriptor ? masterMediaFiles(descriptor) : {};
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
  if (visual.layout === "top-band") {
    if (index === 0) {
      return {
        surface: { x: 685800, y: 914400, cx: 8289600, cy: 3657600 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 514350 },
        secondaryAccent: { x: 914400, y: 3886200, cx: 7772400, cy: 365760 },
        label: { x: 685800, y: 685800, cx: 2438400, cy: 365760 },
        title: { x: 1663700, y: 1295400, cx: 6464300, cy: 1047750 },
        content: { x: 1663700, y: 2616200, cx: 6464300, cy: 1016000 },
        titleSize: 5200,
        bodySize: 2000,
      };
    }
    return {
      surface: { x: 685800, y: 685800, cx: 8289600, cy: 4114800 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 457200 },
      secondaryAccent: { x: 914400, y: 4000500, cx: 7772400, cy: 304800 },
      label: { x: 685800, y: 685800, cx: 2209800, cy: 365760 },
      title: { x: 1663700, y: 1270000, cx: 6400800, cy: 914400 },
      content: { x: 1663700, y: 2387600, cx: 6515100, cy: 1097280 },
      titleSize: 4080,
      bodySize: 1860,
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
  const imageRel = backgroundFile
    ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${backgroundFile}"/>`
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
function solidShapeXml({ id, name, geom, x, y, cx, cy, fill }) {
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
