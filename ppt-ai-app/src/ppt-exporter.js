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
const BUSINESS_MODERN_ASSET_BASE_URL = new URL("../../templates/official/business/business/modern/assets/", import.meta.url);
const STATUS_REPORT_MEDIA = {
  weekly: {
    file: "status-report-weekly.jpeg",
    content: readFileSync(new URL("dome-business-4.jpeg", BUSINESS_MODERN_ASSET_BASE_URL)),
  },
  steering: {
    file: "status-report-steering.jpeg",
    content: readFileSync(new URL("dome-business-2.jpeg", BUSINESS_MODERN_ASSET_BASE_URL)),
  },
  delivery: {
    file: "status-report-delivery.jpeg",
    content: readFileSync(new URL("dome-business-6.jpeg", BUSINESS_MODERN_ASSET_BASE_URL)),
  },
};
const STRATEGY_CONSULTING_MEDIA = {
  board: {
    file: "strategy-board.jpeg",
    content: readFileSync(new URL("dome-business-1.jpeg", BUSINESS_MODERN_ASSET_BASE_URL)),
  },
  matrix: {
    file: "strategy-matrix.jpeg",
    content: readFileSync(new URL("dome-business-5.jpeg", BUSINESS_MODERN_ASSET_BASE_URL)),
  },
  workstream: {
    file: "strategy-workstream.jpeg",
    content: readFileSync(new URL("dome-business-6.jpeg", BUSINESS_MODERN_ASSET_BASE_URL)),
  },
};
// "Dome" 鍛藉悕褰㈢姸鍦ㄦ棤鏄惧紡瀛椾綋鏃剁殑鍏滃簳涓枃閲嶅瓧浣?浠?master 娓叉煋浠ｇ爜浼氫骇鐢熻繖绫诲懡鍚?銆?
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
 * 灏嗙敓鎴愬悗鐨?deck 瀵煎嚭涓哄彲涓嬭浇鏂囦欢銆?
 */
export class PptExportService {
  /**
   * 鎸夎姹傛牸寮忓鍑?deck銆?
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
   * 鍒涘缓鏈€灏忓彲鎵撳紑鐨?Office Open XML PPTX 鍖呫€?
   * red-gold 妯℃澘浼氬湪杩欓噷娉ㄥ叆 dome.pptx 鐨勫獟浣撹祫婧愩€佷富棰樺瓧浣撳拰鐗堝紡瑁呴グ銆?
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
   * 鍒涘缓甯?xref 鍜?trailer 鐨勬渶灏?PDF銆?
   * PDF 瀵煎嚭鏄枃鏈憳瑕侊紝涓嶆壙鎷?dome.pptx 瑙嗚澶嶅埢鑱岃矗銆?
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
 * 鏋勫缓 PDF 鏂囨湰娴侊紝姣忚鍐呭瀵瑰簲涓€涓粷瀵瑰畾浣嶇殑鏂囨湰鎿嶄綔銆?
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
 * 瑙ｆ瀽 deck 浣跨敤鐨勮瑙夐厤缃紝鍏煎鐢ㄦ埛妯℃澘淇濆瓨涓嬫潵鐨?visual 蹇収銆?
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
 * 将六位十六进制颜色转换成 PDF 濉厖鑹叉搷浣溿€?
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
 * 鏍煎紡鍖?PDF 棰滆壊閫氶亾锛岄伩鍏嶈緭鍑哄啑浣欏皬鏁般€?
 * @param {number} value
 * @returns {string}
 */
function formatPdfNumber(value) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0");
}

/**
 * 鍒涘缓涓€鏉＄粷瀵瑰畾浣嶇殑 PDF 鏂囨湰鎿嶄綔銆?
 * @param {{text: unknown, size: number, x: number, y: number}} input
 * @returns {string}
 */
function pdfTextLine({ text, size, x, y }) {
  return `/F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm ${pdfUnicodeText(text)} Tj`;
}

/**
 * 灏嗛暱鏂囨湰鍒囨垚杈冪煭鐨?PDF 琛岋紝閬垮厤涓€琛屾拺鍑洪〉闈€?
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
 * 鍒涘缓 PPTX 鍐呭绫诲瀷娓呭崟銆?
 * @param {object} deck
 * @returns {string}
 */
function contentTypesXml(deck) {
  const slides = deck.slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides}<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`;
}

/**
 * 鍒涘缓 PPTX 鏍?relationships 鍏冩暟鎹€?
 * @returns {string}
 */
function packageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`;
}

/**
 * 鍒涘缓 presentation.xml銆?
 * red-gold 浣跨敤 dome.pptx 鐨勭湡瀹炵敾甯冨昂瀵革紝鍏朵粬妯℃澘淇濇寔鍘?16:9 screen 灏哄銆?
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
 * 鍒涘缓 presentation.xml.rels锛屾妸姣忛〉 slide 鍜?slide master 杩炴帴璧锋潵銆?
 * @param {object} deck
 * @returns {string}
 */
function presentationRelsXml(deck) {
  const rels = deck.slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${deck.slides.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`;
}

/**
 * 鍒涘缓姣忛〉 slide XML 鍜屽搴?relationships銆?
 * 杩欓噷璐熻矗鎶婄粨鏋勫寲 slides 鏄犲皠鍒?dome 瑙掕壊銆佹彃鍏ヨ楗板眰銆佹枃鏈眰鍜屽獟浣撳叧绯汇€?
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
    const bodySize = resolveBodySize({ visual, index, slide, fallbackSize: layout.bodySize || 2200 });
    const masterDescriptor = resolveMasterDescriptor(visual);
    const fontFace = masterDescriptor ? masterFont(masterDescriptor) : "";
    const titleFillStyle = visual.layout === "top-band" ? topBandTitleFillStyle(visual) : domeTitleFillStyle(visual, role);
    const renderBodyList = shouldRenderTemplateBodyList(visual, role);
    const bullets = renderBodyList
      ? (slide.bullets || []).map((bullet) => `<a:p><a:pPr marL="342900" indent="-171450"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="zh-CN" sz="${bodySize}">${fontFaceXml(fontFace)}<a:solidFill><a:srgbClr val="${bodyColor}"/></a:solidFill></a:rPr><a:t>${escapeXml(exportTextValue(bullet))}</a:t></a:r></a:p>`).join("")
      : "";
    // dome 妯℃澘椤电殑 bullets 宸茬粡杩涘叆涓撶敤鍗＄墖/鍓爣棰?鎸囨爣绛夊崰浣嶇锛屼笉鍐嶈緭鍑虹┖鐨勬櫘閫氭鏂囨銆?
    const bodyShape = renderBodyList
      ? textShapeXml({ id: 21, name: "Content 2", ...layout.content, body: bullets || paragraphXml("", bodySize, false, bodyColor, fontFace), size: bodySize, bold: false, color: bodyColor, fontFace })
      : "";
    const titleName = domeTitleShapeName(visual, role);
    const titleSize = resolveTitleSize({ visual, index, title: slide.title, fallbackSize: layout.titleSize });
    const titleShape = shouldRenderTemplateTitle(visual, role)
      ? textShapeXml({ id: 20, name: titleName, ...layout.title, text: slide.title, size: titleSize, bold: true, color: titleColor, fontFace, fillStyle: titleFillStyle })
      : "";
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${groupShapeXml()}${templateDecorationsXml(visual, index, layout, role, slide)}${titleShape}${bodyShape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
    files[`ppt/slides/slide${index + 1}.xml`] = scaleTemplateGeometryXml(slideXml, visual);
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = slideRelsXml(visual, role);
  }
  return files;
}

/**
 * 鍒ゆ柇 dome 鏍囬鏄惁闇€瑕佷娇鐢ㄥ皝闈㈠悓娆鹃噾鑹叉笎鍙樸€?
 * 鍐呭椤垫爣棰樺簲浣跨敤娣辩孩瀹炶壊锛涘彧鏈夌孩搴曞皝闈€佺洰褰曘€佺珷鑺傚垎闅斿拰缁撴潫椤典娇鐢ㄩ噾鑹叉笎鍙樻爣棰樸€?
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
 * 涓?red-gold 标题对象设置可读名称，方便在 PPT 缂栬緫鍣ㄩ噷璇嗗埆 dome 椤甸潰灞傜骇銆?
 * @param {object} visual
 * @param {string} role
 * @returns {string}
 */
function resolveTitleSize({ visual, index, title, fallbackSize }) {
  if (!["top-band", "status-report", "annual-summary", "operating-problem-tree", "industry-research", "industry-trend-forecast", "strategy-competition-map", "strategy-second-curve", "strategy-swot-map", "enterprise-digital-blueprint", "product-release-cadence", "product-pain-points", "product-interview-insight", "product-pricing-strategy", "feature-priority-matrix", "experience-journey-map", "capability-radar-map", "investor-update-progress-sync", "finance-budget-planning", "finance-cost-breakdown", "finance-cash-flow-forecast", "finance-profit-bridge", "finance-budget-variance", "finance-budget-adjustment", "sales-financial-solution", "sales-manufacturing-solution", "sales-education-solution", "sales-key-account-decision-chain", "channel-recruitment-policy", "corporate-training", "onboarding-guide", "knowledge-blackboard", "exam-review-keypoints", "teaching-achievement-showcase", "marketing-launch-rhythm", "seed-round-story", "growth-funding-flywheel", "product-funding-highlights"].includes(visual.layout)) return fallbackSize;
  const textLength = String(title || "").replace(/\s+/g, "").length;
  if (visual.layout === "operating-problem-tree") {
    if (index === 0) {
      if (textLength >= 30) return 2050;
      if (textLength >= 22) return 2320;
      return Math.min(fallbackSize, 2680);
    }
    if (textLength >= 30) return 1400;
    if (textLength >= 22) return 1600;
    return Math.min(fallbackSize, 1860);
  }
  if (visual.layout === "enterprise-digital-blueprint") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2520);
    }
    if (textLength >= 30) return 1360;
    if (textLength >= 22) return 1540;
    return Math.min(fallbackSize, 1800);
  }
  if (visual.layout === "knowledge-blackboard") {
    if (index === 0) {
      if (textLength >= 30) return 1900;
      if (textLength >= 22) return 2180;
      return Math.min(fallbackSize, 2480);
    }
    if (textLength >= 30) return 1280;
    if (textLength >= 22) return 1480;
    return Math.min(fallbackSize, 1760);
  }
  if (visual.layout === "exam-review-keypoints") {
    if (index === 0) {
      if (textLength >= 30) return 1900;
      if (textLength >= 22) return 2180;
      return Math.min(fallbackSize, 2520);
    }
    if (textLength >= 30) return 1300;
    if (textLength >= 22) return 1500;
    return Math.min(fallbackSize, 1780);
  }
  if (visual.layout === "teaching-achievement-showcase") {
    if (index === 0) {
      if (textLength >= 30) return 1850;
      if (textLength >= 22) return 2100;
      return Math.min(fallbackSize, 2460);
    }
    if (textLength >= 30) return 1280;
    if (textLength >= 22) return 1480;
    return Math.min(fallbackSize, 1760);
  }
  if (visual.layout === "growth-funding-flywheel") {
    if (index === 0) {
      if (textLength >= 30) return 2050;
      if (textLength >= 22) return 2300;
      return Math.min(fallbackSize, 2600);
    }
    if (textLength >= 30) return 1420;
    if (textLength >= 22) return 1600;
    return Math.min(fallbackSize, 1880);
  }
  if (visual.layout === "product-funding-highlights") {
    if (index === 0) {
      if (textLength >= 30) return 2000;
      if (textLength >= 22) return 2250;
      return Math.min(fallbackSize, 2520);
    }
    if (textLength >= 30) return 1360;
    if (textLength >= 22) return 1540;
    return Math.min(fallbackSize, 1800);
  }
  if (visual.layout === "investor-update-progress-sync") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2500);
    }
    if (textLength >= 30) return 1340;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1780);
  }
  if (visual.layout === "seed-round-story") {
    if (index === 0) {
      if (textLength >= 30) return 2050;
      if (textLength >= 22) return 2300;
      return Math.min(fallbackSize, 2600);
    }
    if (textLength >= 30) return 1360;
    if (textLength >= 22) return 1560;
    return Math.min(fallbackSize, 1840);
  }
  if (visual.layout === "marketing-launch-rhythm") {
    if (index === 0) {
      if (textLength >= 30) return 2050;
      if (textLength >= 22) return 2350;
      return Math.min(fallbackSize, 2850);
    }
    if (textLength >= 30) return 1400;
    if (textLength >= 22) return 1600;
    return Math.min(fallbackSize, 1900);
  }
  if (visual.layout === "sales-financial-solution") {
    if (index === 0) {
      if (textLength >= 30) return 2100;
      if (textLength >= 22) return 2350;
      return Math.min(fallbackSize, 2700);
    }
    if (textLength >= 30) return 1450;
    if (textLength >= 22) return 1650;
    return Math.min(fallbackSize, 1900);
  }
  if (visual.layout === "sales-education-solution") {
    if (index === 0) {
      if (textLength >= 30) return 2050;
      if (textLength >= 22) return 2300;
      return Math.min(fallbackSize, 2700);
    }
    if (textLength >= 30) return 1400;
    if (textLength >= 22) return 1600;
    return Math.min(fallbackSize, 1880);
  }
  if (visual.layout === "sales-manufacturing-solution") {
    if (index === 0) {
      if (textLength >= 30) return 2050;
      if (textLength >= 22) return 2300;
      return Math.min(fallbackSize, 2650);
    }
    if (textLength >= 30) return 1400;
    if (textLength >= 22) return 1600;
    return Math.min(fallbackSize, 1850);
  }
  if (visual.layout === "sales-key-account-decision-chain") {
    if (index === 0) {
      if (textLength >= 30) return 1380;
      if (textLength >= 22) return 1520;
      return Math.min(fallbackSize, 1680);
    }
    // 大客户攻坚内容页标题不能按封面大字处理，否则会压住正文和右侧图形。
    if (textLength >= 30) return 980;
    if (textLength >= 22) return 1080;
    return Math.min(fallbackSize, 1220);
  }
  if (visual.layout === "finance-budget-planning") {
    if (index === 0) {
      if (textLength >= 30) return 2100;
      if (textLength >= 22) return 2350;
      return Math.min(fallbackSize, 2700);
    }
    if (textLength >= 30) return 1450;
    if (textLength >= 22) return 1650;
    return Math.min(fallbackSize, 1900);
  }
  if (visual.layout === "finance-cost-breakdown") {
    if (index === 0) {
      if (textLength >= 30) return 2120;
      if (textLength >= 22) return 2360;
      return Math.min(fallbackSize, 2720);
    }
    if (textLength >= 30) return 1440;
    if (textLength >= 22) return 1640;
    return Math.min(fallbackSize, 1880);
  }
  if (visual.layout === "finance-cash-flow-forecast") {
    if (index === 0) {
      if (textLength >= 30) return 2100;
      if (textLength >= 22) return 2380;
      return Math.min(fallbackSize, 2720);
    }
    if (textLength >= 30) return 1420;
    if (textLength >= 22) return 1600;
    return Math.min(fallbackSize, 1880);
  }
  if (visual.layout === "finance-profit-bridge") {
    if (index === 0) {
      if (textLength >= 30) return 1740;
      if (textLength >= 22) return 1960;
      return Math.min(fallbackSize, 2180);
    }
    if (textLength >= 30) return 1260;
    if (textLength >= 22) return 1420;
    return Math.min(fallbackSize, 1640);
  }
  if (visual.layout === "finance-budget-variance") {
    if (index === 0) {
      if (textLength >= 30) return 2080;
      if (textLength >= 22) return 2320;
      return Math.min(fallbackSize, 2660);
    }
    if (textLength >= 30) return 1420;
    if (textLength >= 22) return 1620;
    return Math.min(fallbackSize, 1880);
  }
  if (visual.layout === "finance-budget-adjustment") {
    if (index === 0) {
      if (textLength >= 30) return 2050;
      if (textLength >= 22) return 2320;
      return Math.min(fallbackSize, 2660);
    }
    if (textLength >= 30) return 1420;
    if (textLength >= 22) return 1620;
    return Math.min(fallbackSize, 1880);
  }
  if (visual.layout === "industry-research") {
    if (index === 0) {
      if (textLength >= 30) return 2050;
      if (textLength >= 22) return 2250;
      return Math.min(fallbackSize, 2500);
    }
    if (textLength >= 30) return 1350;
    if (textLength >= 22) return 1550;
    return Math.min(fallbackSize, 1850);
  }
  if (visual.layout === "industry-trend-forecast") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2200;
      return Math.min(fallbackSize, 2420);
    }
    if (textLength >= 30) return 1320;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1780);
  }
  if (visual.layout === "strategy-competition-map") {
    if (index === 0) {
      if (textLength >= 30) return 2000;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2460);
    }
    if (textLength >= 30) return 1320;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1820);
  }
  if (visual.layout === "strategy-second-curve") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2200;
      return Math.min(fallbackSize, 2460);
    }
    if (textLength >= 30) return 1320;
    if (textLength >= 22) return 1500;
    return Math.min(fallbackSize, 1800);
  }
  if (visual.layout === "strategy-swot-map") {
    if (index === 0) {
      if (textLength >= 30) return 1940;
      if (textLength >= 22) return 2160;
      return Math.min(fallbackSize, 2400);
    }
    if (textLength >= 30) return 1280;
    if (textLength >= 22) return 1480;
    return Math.min(fallbackSize, 1780);
  }
  if (visual.layout === "product-pain-points") {
    if (index === 0) {
      if (textLength >= 30) return 2000;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2480);
    }
    if (textLength >= 30) return 1320;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1820);
  }
  if (visual.layout === "product-pricing-strategy") {
    if (index === 0) {
      if (textLength >= 34) return 1960;
      if (textLength >= 24) return 2220;
      return Math.min(fallbackSize, 2520);
    }
    if (textLength >= 32) return 1320;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1840);
  }
  if (visual.layout === "feature-priority-matrix") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2480);
    }
    if (textLength >= 30) return 1320;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1820);
  }
  if (visual.layout === "experience-journey-map") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2480);
    }
    if (textLength >= 30) return 1320;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1820);
  }
  if (visual.layout === "capability-radar-map") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2480);
    }
    if (textLength >= 30) return 1320;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1820);
  }
  if (visual.layout === "product-release-cadence") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2480);
    }
    if (textLength >= 30) return 1320;
    if (textLength >= 22) return 1520;
    return Math.min(fallbackSize, 1820);
  }
  if (visual.layout === "corporate-training") {
    if (index === 0) {
      if (textLength >= 30) return 2000;
      if (textLength >= 22) return 2240;
      return Math.min(fallbackSize, 2520);
    }
    if (textLength >= 30) return 1360;
    if (textLength >= 22) return 1560;
    return Math.min(fallbackSize, 1840);
  }
  if (visual.layout === "onboarding-guide") {
    if (index === 0) {
      if (textLength >= 30) return 1980;
      if (textLength >= 22) return 2220;
      return Math.min(fallbackSize, 2500);
    }
    if (textLength >= 30) return 1340;
    if (textLength >= 22) return 1540;
    return Math.min(fallbackSize, 1820);
  }
  if (visual.layout === "annual-summary") {
    const textUnits = estimateTextUnits(title);
    if (index === 0) {
      if (textUnits > 88) return 2000;
      if (textUnits > 68) return 2400;
      if (textUnits > 48) return 2800;
      return Math.min(fallbackSize, 3900);
    }
    if (textUnits > 82) return 1300;
    if (textUnits > 62) return 1600;
    if (textUnits > 42) return 1900;
    return Math.min(fallbackSize, 3000);
  }
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

/**
 * 根据正文内容动态调整 PPTX 正文字号。
 * 年度总结模板的在线预览也会按内容长度降字号，这里保持同一方向，避免预览完整而下载溢出。
 * @param {{visual: object, index: number, slide: object, fallbackSize: number}} input
 * @returns {number}
 */
function resolveBodySize({ visual, index, slide, fallbackSize }) {
  if (visual.layout !== "annual-summary") return fallbackSize;
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  const units = bullets.reduce((sum, item) => sum + estimateTextUnits(item), 0);
  if (index === 0) {
    if (units > 180) return 850;
    if (units > 140) return 950;
    if (units > 100) return 1050;
    if (units > 70) return 1150;
    return Math.min(fallbackSize, 1240);
  }
  if (units > 180) return 780;
  if (units > 140) return 860;
  if (units > 100) return 980;
  if (units > 70) return 1060;
  return Math.min(fallbackSize, 1160);
}

/**
 * 将导出文本统一归一化，避免结构化 bullet 写成 [object Object]。
 * @param {unknown} value
 * @returns {string}
 */
function exportTextValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object") {
    for (const key of ["text", "title", "label", "name", "value", "summary", "description"]) {
      if (value[key] != null) return String(value[key]).trim();
    }
  }
  return "";
}

/**
 * 估算中英文混排文本长度，中文按更宽字符处理。
 * @param {string} text
 * @returns {number}
 */
function estimateTextUnits(text) {
  return Array.from(String(text || "")).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 2 : 1), 0);
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
 * 鍒ゆ柇褰撳墠 dome 椤甸潰鏄惁杩橀渶瑕佹櫘閫氭鏂囧垪琛ㄣ€?
 * 灏侀潰銆佺洰褰曘€佹楠ゃ€佹寚鏍囥€佸鐩樺拰璁″垝椤靛凡缁忔妸 bullets 濉繘涓撶敤鍗犱綅绗︼紝涓嶅啀閲嶅鏄剧ず涓€浠芥櫘閫氬垪琛ㄣ€?
 * @param {object} visual
 * @param {string} role
 * @returns {boolean}
 */
function shouldRenderDomeBodyList(visual, role) {
  if (visual.layout !== "red-gold") return true;
  return !["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"].includes(role);
}

/**
 * 鍒ゆ柇 PPTX 瀵煎嚭鏃舵槸鍚﹁繕闇€瑕佹櫘閫氭鏂囧垪琛ㄣ€? * 琛屽姩闂幆妯℃澘鐨勬鏂囦俊鎭敱涓撶敤鐗堝紡鍥惧舰琛ㄨ揪锛岀户缁緭鍑烘櫘閫?bullets 浼氳鐩栧浘琛ㄥ拰鍗＄墖銆? * @param {object} visual
 * @param {string} role
 * @returns {boolean}
 */
function shouldRenderTemplateBodyList(visual, role) {
  if (visual.layout === "growth-funding-flywheel") return false;
  if (visual.layout === "product-funding-highlights") return false;
  if (visual.layout === "investor-update-progress-sync") return false;
  if (visual.layout === "seed-round-story") return false;
  if (visual.layout === "quarterly-action-loop") return false;
  if (visual.layout === "operating-problem-tree") return false;
  if (visual.layout === "business-opportunity-map") return false;
  if (visual.layout === "quarterly-dashboard") return false;
  if (visual.layout === "finance-budget-planning") return false;
  if (visual.layout === "finance-cost-breakdown") return false;
  if (visual.layout === "finance-profit-bridge") return false;
  if (visual.layout === "finance-budget-variance") return false;
  if (visual.layout === "finance-budget-adjustment") return false;
  if (visual.layout === "industry-trend-forecast") return false;
  if (visual.layout === "strategy-competition-map") return false;
  if (visual.layout === "strategy-second-curve") return false;
  if (visual.layout === "strategy-swot-map") return false;
  if (visual.layout === "enterprise-digital-blueprint") return false;
  if (visual.layout === "product-release-cadence") return false;
  if (visual.layout === "product-pain-points") return false;
  if (visual.layout === "product-interview-insight") return false;
  if (visual.layout === "finance-cash-flow-forecast") return false;
  if (visual.layout === "product-pricing-strategy") return false;
  if (visual.layout === "feature-priority-matrix") return false;
  if (visual.layout === "experience-journey-map") return false;
  if (visual.layout === "capability-radar-map") return false;
  if (visual.layout === "bi-executive-cockpit") return false;
  if (visual.layout === "user-path-funnel") return false;
  if (visual.layout === "market-trend-radar") return false;
  if (visual.layout === "customer-segmentation-layering") return false;
  if (visual.layout === "metric-anomaly-attribution") return false;
  if (visual.layout === "sales-financial-solution") return false;
  if (visual.layout === "sales-manufacturing-solution") return false;
  if (visual.layout === "sales-education-solution") return false;
  if (visual.layout === "sales-key-account-decision-chain") return false;
  if (visual.layout === "finance-profit-bridge") return false;
  if (visual.layout === "channel-recruitment-policy") return false;
  if (visual.layout === "product-interview-insight") return false;
  if (visual.layout === "channel-recruitment-policy") return false;
  if (visual.layout === "corporate-training") return false;
  if (visual.layout === "onboarding-guide") return false;
  if (visual.layout === "knowledge-blackboard") return false;
  if (visual.layout === "exam-review-keypoints") return false;
  if (visual.layout === "teaching-achievement-showcase") return false;
  if (visual.layout === "marketing-launch-rhythm") return false;
  return shouldRenderDomeBodyList(visual, role);
}

/**
 * 专属模板的标题由模板图层自行控制，避免导出端通用标题与预览专属布局错位。
 * @param {object} visual
 * @param {string} role
 * @returns {boolean}
 */
function shouldRenderTemplateTitle(visual, role) {
  if (visual.layout === "finance-profit-bridge") return false;
  if (visual.layout === "product-interview-insight") return false;
  return true;
}

/**
 * 鏍规嵁妯℃澘閫夋嫨 PPT 鐢诲竷灏哄銆?
 * dome.pptx 鍘熷鏂囦欢鏄?12192000 x 6858000锛涘叾浠栨ā鏉跨户缁娇鐢ㄧ幇鏈?16:9 screen 灏哄锛岄伩鍏嶅奖鍝嶆棫瀵煎嚭銆?
 * @param {object} visual
 * @returns {{width: number, height: number, scaleX: number, scaleY: number, type?: string}}
 */
function slideMetrics(visual) {
  const descriptor = resolveMasterDescriptor(visual);
  return descriptor ? masterCanvasMetrics(descriptor) : DEFAULT_SLIDE_METRICS;
}

/**
 * 灏?red-gold 椤甸潰鍧愭爣浠庢棫鐨勬爣鍑?16:9 鍩哄噯绛夋瘮鏀惧ぇ鍒?dome.pptx 鐨勭湡瀹炵敾甯冦€?
 * 字号不在这里缩放，因为字号本身是 pt 鍊硷紱杩欓噷鍙鐞?OOXML 閲岀殑浣嶇疆鍜屽昂瀵搞€?
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
    // dome.pptx 搴曢儴鏄灞傞噾鑹插姬绾垮拰鑹插潡鍙犲嚭鐨勬尝娴紝涓嶅彧鏄崟鍧楃孩鑹茶儗鏅紱杩欓噷淇濈暀鑹插甫骞惰ˉ鍏呭渾寮х嚎鏉″眰銆?
    const topGuard = solidShapeXml({ id: 4, name: "Dome Top Guard", x: 0, y: 0, cx: 9144000, cy: 365760, fill: redGoldPalette.surfaceStroke })
      + solidShapeXml({ id: 12, name: "Dome Edge Accent", x: 685800, y: 114300, cx: 7772400, cy: 45720, fill: redGoldPalette.surfaceText });
    const waves = solidShapeXml({ id: 5, name: "Lower Gold Wave", geom: "parallelogram", x: -304800, y: 3921120, cx: 4876800, cy: 889540, fill: redGoldPalette.surfaceDecor })
      + solidShapeXml({ id: 6, name: "Lower Light Wave", geom: "parallelogram", x: 2590800, y: 3695328, cx: 5181600, cy: 889540, fill: blendHexColor(redGoldPalette.surfaceDecor, redGoldPalette.surfaceText, 0.15) })
      + solidShapeXml({ id: 7, name: "Lower Red Wave", geom: "parallelogram", x: 0, y: 4495800, cx: 9144000, cy: 762000, fill: redGoldPalette.bottomGradientLow })
      + arcLineShapeXml({ id: 13, name: "Dome Gold Wave Arc", x: -533400, y: 3505200, cx: 4876800, cy: 1447800, stroke: redGoldPalette.titleGradientStart, width: 57150 })
      + arcLineShapeXml({ id: 14, name: "Dome Light Wave Arc", x: 2514600, y: 3333750, cx: 5486400, cy: 1629416, stroke: redGoldPalette.titleGradientEnd, width: 45720 });
    // 椤佃剼鍙繚鐣欒楗扮嚎锛屼笉鍐欏叆妯℃澘鍚嶇О锛岄伩鍏嶄笅杞藉悗鐨?PPTX 椤甸潰鍑虹幇妯℃澘鏉ユ簮鏂囧瓧銆?
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
  if (visual.layout === "annual-summary") {
    return base + annualSummaryDecorationsXml({ visual, index, layout });
  }
  if (visual.layout === "quarterly-dashboard") {
    return base + quarterlyDashboardDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "quarterly-diagnosis") {
    return base + quarterlyDiagnosisDecorationsXml({ visual, index, layout });
  }
  if (visual.layout === "quarterly-action-loop") {
    return base + quarterlyActionLoopDecorationsXmlV2({ visual, index, layout, slide });
  }
  if (visual.layout === "operating-problem-tree") {
    return base + operatingProblemTreeDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "business-opportunity-map") {
    return base + businessOpportunityMapDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "industry-research") {
    return base + industryResearchDecorationsXml({ visual, index, layout, role });
  }
  if (visual.layout === "industry-trend-forecast") {
    return base + industryTrendForecastDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "strategy-competition-map") {
    return base + competitionMapDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "strategy-second-curve") {
    return base + secondCurveDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "strategy-swot-map") {
    return base + swotMapDecorationsXml({ visual, index, layout, role, slide });
  }
  if (isEnterpriseDigitalBlueprintVisual(visual)) {
    return base + enterpriseDigitalBlueprintDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "product-release-cadence") {
    return base + productReleaseCadenceDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "product-pain-points") {
    return base + productPainPointsDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "product-interview-insight") {
    return base + productInterviewInsightDecorationsXml({ visual, index, role, slide });
  }
  if (visual.layout === "product-pricing-strategy") {
    return base + productPricingStrategyDecorationsXml({ visual, index, role, slide });
  }
  if (visual.layout === "feature-priority-matrix") {
    return base + featurePriorityMatrixDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "experience-journey-map") {
    return base + experienceJourneyDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "capability-radar-map") {
    return base + capabilityRadarDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "bi-executive-cockpit") {
    return base + biExecutiveCockpitDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "user-path-funnel") {
    return base + userPathFunnelDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "market-trend-radar") {
    return base + marketTrendRadarDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "customer-segmentation-layering") {
    return base + customerSegmentationLayeringDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "metric-anomaly-attribution") {
    return base + metricAnomalyAttributionDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "finance-budget-planning") {
    return base + budgetPlanningDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "finance-cost-breakdown") {
    return base + costBreakdownDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "finance-cash-flow-forecast") {
    return base + cashFlowForecastDecorationsXml({ visual, index, role, slide });
  }
  if (visual.layout === "finance-profit-bridge") {
    return base + profitBridgeDecorationsXml({ visual, index, role, slide });
  }
  if (visual.layout === "finance-budget-variance") {
    return base + budgetVarianceDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "finance-budget-adjustment") {
    return base + budgetAdjustmentDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "sales-financial-solution") {
    return base + financialSolutionDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "sales-manufacturing-solution") {
    return base + manufacturingSolutionDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "sales-education-solution") {
    return base + educationSolutionDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "channel-recruitment-policy") {
    return base + channelRecruitmentPolicyDecorationsXml({ visual, index, role, slide });
  }
  if (visual.layout === "sales-key-account-decision-chain") {
    return base + keyAccountDecisionDecorationsXml({ visual, index, role, slide });
  }
  if (visual.layout === "corporate-training") {
    return base + corporateTrainingDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "onboarding-guide") {
    return base + onboardingGuideDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "knowledge-blackboard") {
    return base + knowledgeBlackboardDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "exam-review-keypoints") {
    return base + examReviewKeypointsDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "teaching-achievement-showcase") {
    return base + teachingAchievementDecorationsXml({ visual, index, layout, role, slide });
  }
  if (visual.layout === "marketing-launch-rhythm") {
    return base + launchRhythmDecorationsXml({ visual, index, layout, role, slide });
  }
  if (isGrowthFundingFlywheelVisual(visual)) {
    return base + growthFundingFlywheelDecorationsXml({ visual, index, layout, role, slide });
  }
  if (isProductFundingHighlightsVisual(visual)) {
    return base + productFundingHighlightsDecorationsXml({ visual, index, layout, role, slide });
  }
  if (isInvestorUpdateProgressVisual(visual)) {
    return base + investorUpdateProgressDecorationsXml({ visual, index, layout, role, slide });
  }
  if (isSeedRoundStoryVisual(visual)) {
    return base + seedRoundStoryDecorationsXml({ visual, index, layout, role, slide });
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
      + textShapeXml({ id: 307, name: "Marketing Chip Text", x: isCover ? 7086600 : 7132320, y: 975360, cx: isCover ? 762000 : 640080, cy: 152400, text: "", size: 780, bold: true, color: "FFFFFF" })
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
      + textShapeXml({ id: 407, name: "Brand Story Chip Text", x: isCover ? 7040880 : 7132320, y: isCover ? 937260 : 861060, cx: 762000, cy: 152400, text: "", size: 760, bold: true, color: "FFFFFF" })
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
      + textShapeXml({ id: 507, name: "Data Insight Chip Text", x: isCover ? 7132320 : 7193280, y: isCover ? 960120 : 861060, cx: 640080, cy: 152400, text: "", size: 760, bold: true, color: "FFFFFF" })
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
      + textShapeXml({ id: 607, name: "Education Course Chip Text", x: isCover ? 6957060 : 6964680, y: isCover ? 1104900 : 876300, cx: 731520, cy: 137160, text: "", size: 720, bold: true, color: isCover ? visual.primary : "FFFFFF" })
      + educationCourseVisualXml({ visual, palette, scene, isCover })
      + lowerItems
      + textShapeXml({ id: 650, name: "Education Course Caption", x: isCover ? 6126480 : 6126480, y: isCover ? 3474720 : 3657600, cx: 1828800, cy: 182880, text: scene.caption, size: isCover ? 740 : 720, bold: true, color: isCover ? palette.chalk : visual.body });
  }
  if (isBusinessModelBpVisual(visual)) {
    return base + businessModelBpDecorationsXml({ visual, index, layout });
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
      // 灏侀潰涓嶅啀鍐欐ā鏉垮悕绉帮紱闈炲皝闈粛淇濈暀椤靛簭鏍囩銆?      + textShapeXml({ id: 7, name: "Section Label", ...layout.label, text: isStrategyConsultingVisual(visual) || isFinancialReviewVisual(visual) || isSalesProposalVisual(visual) || isProductRoadmapVisual(visual) || index === 0 ? "" : `0${index + 1}`, size: 1200, bold: true, color: index === 0 ? visual.surface : visual.accent });
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
 * 娣诲姞妯℃澘鎵€闇€鐨勫獟浣撴枃浠躲€?
 * red-gold 浼氭妸浠?dome.pptx 提取出的封面、内容背景和商务图片写入 ppt/media銆?
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
 * 灏嗙粨鏋勫寲椤甸潰鏄犲皠鍒?dome 妯℃澘瑙掕壊銆?
 * 杩欓噷浼樺厛灏婇噸 AI 或前端传入的 slide.layout锛涙病鏈夋樉寮忓竷灞€鏃讹紝鍐嶆寜椤靛簭鍜屾爣棰樺叧閿瘝鍏滃簳銆?
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
 * 鏍规嵁 dome 椤甸潰瑙掕壊鐢熸垚瑁呴グ灞傚拰鍗犱綅绗︺€?
 * 杩欎簺褰㈢姸鐨勫懡鍚嶇敤浜庢祴璇曞拰鍚庣画缁存姢锛屼篃璁?PPT 缂栬緫鍣ㄩ噷鑳界湅鍑烘瘡涓眰绾х殑鐢ㄩ€斻€?
 * @param {{role: string, index: number, layout: object, visual: object, slide: object}} input
 * @returns {string}
 */
function domeRoleDecorationXml({ role, index, layout, visual, slide }) {
  const palette = redGoldColorPalette(visual);
  if (role === "cover") {
    const [subtitle] = normalizeDomeBulletItems(slide, 1);
    // 灏侀潰椤电敤涓撶敤鍓爣棰樻壙杞界敤鎴疯緭鍏ワ紝閬垮厤鏅€氬垪琛ㄧ牬鍧?dome.pptx 鐨勫竼鑸瑰皝闈㈢暀鐧姐€?
    return rectShapeXml({ id: 8, name: "Dome Cover Halo", x: 0, y: 0, cx: 12192000, cy: 182880, fill: palette.surfaceStroke })
      + rectShapeXml({ id: 9, name: "Dome Cover Accent", x: 0, y: 6680200, cx: 12192000, cy: 120650, fill: palette.surfaceStroke })
      + textShapeXml({ id: 10, name: "Dome Cover Series Label", x: 609600, y: 4114800, cx: 3048000, cy: 365760, text: "BUSINESS REPORT", size: 1500, bold: true, color: palette.surfaceText })
      + textShapeXml({ id: 11, name: "Dome Cover Subtitle", x: 2971800, y: 3048000, cx: 3962400, cy: 365760, text: subtitle, size: 1500, bold: true, color: palette.surfaceText });
  }
  if (role === "agenda") {
    // 鐩綍椤靛浐瀹氳緭鍑?4 个卡片槽位，保持 dome.pptx 鐨勫崱鐗囧紡鐩綍楠ㄦ灦涓嶅洜鐢ㄦ埛灏戝～鍐呭鑰屽彉鍖栥€?
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
    // 娴佺▼鍜岃鍒掗〉涔熼渶瑕?dome.pptx 鐨勬祬鑹插唴瀹规壙杞介潰锛屽惁鍒欏崱鐗囦細鐩存帴婕傚湪绾㈤噾鑳屾櫙涓娿€?
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
    // 涓?鍥涙楠ゆ祦绋嬮〉澧炲姞妯悜杩炴帴绾匡紝璁╃嫭绔嬪崱鐗囧舰鎴愭竻鏅扮殑娴佺▼鍏崇郴銆?
    const stepConnector = role === "next-plan"
      ? ""
      : rectShapeXml({ id: 72, name: `Dome Step Connector ${count}`, x: 1371600, y: 3352800, cx: count === 3 ? 5638800 : 6553200, cy: 30480, fill: palette.surfaceStroke });
    // 三步骤流程页补齐商务图片层，保持流程类内容页也有 dome.pptx 鐨勫浘鏂囧晢鍔℃皵璐ㄣ€?
    const threeStepsImage = role === "three-steps"
      ? pictureXml({ id: 69, name: "Dome Three Steps Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    // 四步骤流程页复用 dome.pptx 的第 4 寮犲晢鍔″浘锛岄伩鍏嶆彁鍙栧嚭鐨勪笟鍔¤瑙夎祫浜ч棽缃€?
    const fourStepsImage = role === "four-steps"
      ? pictureXml({ id: 70, name: "Dome Four Steps Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    // 下一步计划页复用 dome.pptx 的第 6 张商务图，与预览端的 next-plan 瑙嗚淇濇寔涓€鑷淬€?
    const nextPlanImage = role === "next-plan"
      ? pictureXml({ id: 71, name: "Dome Next Plan Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    return role === "next-plan"
      ? contentSurface + sectionLabel + nextPlanImage + steps + rectShapeXml({ id: 70, name: "Dome Next Plan Timeline", x: 1219200, y: 2438400, cx: 6400800, cy: 30480, fill: visual.accent })
      : contentSurface + sectionLabel + threeStepsImage + fourStepsImage + stepConnector + steps;
  }
  if (role === "metrics") {
    const metricItems = normalizeDomeMetricItems(slide, 3);
    // 指标页保留浅色承载面和右上章节标签，使数据卡片与 dome.pptx 鍐呭椤靛眰绾т竴鑷淬€?
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
    // 鎴愭灉灞曠ず椤垫媶鎴愮紪鍙峰拰姝ｆ枃涓や釜鍗犱綅绗︼紝璐磋繎 dome.pptx 鐨勬垚鏋滃崱灞傜骇锛岃€屼笉鏄暣娈垫枃鏈垪琛ㄣ€?
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
    // 闂澶嶇洏椤靛皢澶嶇洏璇箟鏍囩鍜屾鏂囨媶鎴愬浐瀹氬崰浣嶇锛屼究浜庣粨鏋勫寲鍐呭绋冲畾钀戒綅銆?
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
    // 缁撴潫椤典娇鐢ㄤ笓鐢ㄥ壇鏍囬鎵胯浇鐢ㄦ埛杈撳叆锛屼笉鍐嶉€€鍥炴櫘閫氶」鐩鍙峰垪琛ㄣ€?
    return textShapeXml({ id: 30, name: "Dome Closing Mark", x: 3200400, y: 2438400, cx: 2743200, cy: 457200, text: "THANKS", size: 2200, bold: true, color: palette.surfaceText })
      + textShapeXml({ id: 31, name: "Dome Closing Subtitle", x: 3200400, y: 3048000, cx: 2743200, cy: 365760, text: subtitle, size: 1300, bold: true, color: palette.surfaceText });
  }
  const imageReportItems = normalizeDomeBulletItems(slide, 3);
  // 宸ヤ綔姹囨姤鍥炬枃椤典娇鐢ㄤ笁寮犳眹鎶ュ崱鐗囨壙杞界粨鏋勫寲瑕佺偣锛屽彸渚х户缁鐢?dome.pptx 鐨勫晢鍔￠厤鍥俱€?
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
 * 鐢熸垚 dome 目录页的 4 涓崱鐗囨枃妗堛€?
 * 鐢ㄦ埛杈撳叆浼樺厛锛涗笉瓒?4 椤规椂浣跨敤 dome.pptx 鐨勫洓娈电洰褰曢粯璁ゆ枃妗堣ˉ榻愶紝閬垮厤鍗＄墖寮忕洰褰曞嚭鐜扮┖妲姐€?
 * @param {object} slide
 * @returns {string[]}
 */
function normalizeDomeAgendaItems(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: 4 }, (_, index) => domeStructuredText(bullets[index], ["text", "title", "label", "name"]) || DOME_AGENDA_DEFAULT_ITEMS[index] || "");
}

/**
 * 璇诲彇绔犺妭鍒嗛殧椤电殑缁撴瀯鍖栫紪鍙枫€?
 * 鐢ㄦ埛浼犲叆 bullets[0] 鏃朵紭鍏堜綔涓?PART 缂栧彿鍗犱綅绗︼紱缂虹渷鏃舵墠鎸夐〉搴忕敓鎴愬厹搴曟枃妗堛€?
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function domeSectionNumberText(slide, index) {
  const [sectionNumber] = normalizeDomeBulletItems(slide, 1);
  return sectionNumber || `PART ${String(index).padStart(2, "0")}`;
}

/**
 * 璇诲彇鍐呭椤靛彸涓婅绔犺妭鏍囩銆?
 * 浼樺厛浣跨敤 outline 閲岀殑缁撴瀯鍖栫珷鑺傚瓧娈碉紝缂虹渷鏃舵寜椤靛簭鍏滃簳锛屼繚璇佹棫鏁版嵁浠嶈兘绋冲畾瀵煎嚭銆?
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function domeContentSectionLabelText(slide, index) {
  return String(slide?.sectionLabel || slide?.section || `PART ${String(index).padStart(2, "0")}`);
}

/**
 * 浠庣敤鎴风粨鏋勫寲 bullets 涓彇鍑哄綋鍓嶇増寮忛渶瑕佺殑鍗犱綅鏂囨銆?
 * bullets 涓嶈冻鏃朵娇鐢ㄧ┖瀛楃涓诧紝淇濊瘉鍗＄墖鏁伴噺鍜屾ā鏉跨増寮忕ǔ瀹氥€?
 * @param {object} slide
 * @param {number} count
 * @returns {string[]}
 */
function normalizeDomeBulletItems(slide, count) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: count }, (_, index) => domeStructuredText(bullets[index], ["text", "title", "label", "name", "action", "task"]));
}

/**
 * 瑙ｆ瀽涓嬩竴姝ヨ鍒掗〉鐨勭粨鏋勫寲瑕佺偣銆?
 * 鎺ㄨ崘杈撳叆涓衡€滈樁娈? 鍔ㄤ綔鈥濓紱鏃ф暟鎹病鏈夊垎闅旂鏃讹紝鐢ㄥ簭鍙蜂綔闃舵銆佸師鏂囦綔鍔ㄤ綔銆?
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
 * 瑙ｆ瀽 dome 鎸囨爣椤电殑缁撴瀯鍖栬鐐广€?
 * 鎺ㄨ崘杈撳叆涓衡€滄寚鏍囧悕: 鎸囨爣鍊尖€濓紱鏃ф暟鎹病鏈夊垎闅旂鏃讹紝鐢ㄥ簭鍙蜂綔鏁板€笺€佸師鏂囦綔鏍囩锛岄伩鍏嶅巻鍙?deck 澶卞幓鍐呭銆?
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
 * 浠庡璞℃垨鏅€氬瓧绗︿覆涓鍙?dome 鍗犱綅绗︽枃鏈€?
 * 鏀寔妯″瀷鐩存帴杩斿洖缁撴瀯鍖?bullet 瀵硅薄锛岄伩鍏?PPTX 涓嚭鐜?[object Object]銆?
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
 * 鍒ゆ柇鍊兼槸鍚︿负鏅€氬璞★紝鏁扮粍鍜?null 涓嶆寜缁撴瀯鍖?bullet 澶勭悊銆?
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 涓轰笉鍚屽唴瀹硅鑹叉寫閫?dome.pptx 涓殑鍟嗗姟鍥剧墖銆?
 * @param {string} role
 * @returns {string}
 */
function domeRoleBusinessMedia(visual, role) {
  const descriptor = resolveMasterDescriptor(visual);
  return descriptor ? masterBusinessMedia(descriptor, role) : "";
}

/**
 * 杩斿洖褰撳墠妯℃澘鐨勯〉闈㈠嚑浣曞竷灞€銆?
 * red-gold 鍒嗘敮鎸?dome 瑙掕壊鎷嗗嚭灏侀潰銆佺洰褰曘€佺珷鑺傘€佸唴瀹广€佹祦绋嬨€佹寚鏍囧拰缁撴潫椤电殑浣嶇疆銆?
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
        // 灏侀潰鏍囬鍘熸绐?cx 3962400)涓斿彸缂樹几杩涘竼鑸瑰尯,长标题会从词中间断行;鍔犲骞跺乏绉婚伩寮€甯嗚埞,闄嶅瓧鍙疯闀挎爣棰樺湪鍑€鍖哄唴鍧囪　鎹㈣銆?
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
      // 椤堕儴鍗＄墖鐗堝紡鐨勫唴瀹归〉鏍囬鍘嬪湪绾㈠簳涓?娣辫壊鏍囬鍑犱箮涓嶅彲璇?鏀圭敤娴呰壊(涓庨瑙堜竴鑷?銆?
      titleColor: ["image-report", "showcase", "retrospective"].includes(role) ? redGoldPalette.surfaceText : visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "annual-summary") {
    if (index === 0) {
      return {
        surface: { x: 0, y: 0, cx: 9144000, cy: 5143500 },
        accent: { x: 0, y: 0, cx: 9144000, cy: 5143500 },
        secondaryAccent: { x: 914400, y: 3802380, cx: 2438400, cy: 30480 },
        label: { x: 731520, y: 914400, cx: 2743200, cy: 304800 },
        title: { x: 731520, y: 1325880, cx: 3962400, cy: 1219200 },
        content: { x: 914400, y: 2827020, cx: 3657600, cy: 762000 },
        titleSize: 3650,
        bodySize: 1240,
        titleColor: "FFFFFF",
        bodyColor: "E9FBFF",
      };
    }
    return {
      surface: { x: 1371600, y: 609600, cx: 7239000, cy: 3962400 },
      accent: { x: 0, y: 0, cx: 1170432, cy: 5143500 },
      secondaryAccent: { x: 1524000, y: 1706880, cx: 3657600, cy: 22860 },
      label: { x: 1524000, y: 731520, cx: 2438400, cy: 304800 },
      title: { x: 1264920, y: 1036320, cx: 4622800, cy: 762000 },
      content: { x: 1264920, y: 1981200, cx: 4622800, cy: 1371600 },
      titleSize: 2750,
      bodySize: 1160,
    };
  }
  if (visual.layout === "quarterly-dashboard") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 109728, y: 777240, cx: 8924544, cy: 4213860 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 685800 },
      secondaryAccent: { x: 685800, y: 822960, cx: 1828800, cy: 45720 },
      label: { x: 274320, y: 914400, cx: 2133600, cy: 304800 },
      title: isCover || isClosing
        ? { x: 731520, y: 1325880, cx: 4114800, cy: 1219200 }
        : { x: 548640, y: 167640, cx: 5638800, cy: 365760 },
      content: isCover || isClosing
        ? { x: 914400, y: 2827020, cx: 4267200, cy: 762000 }
        : { x: 548640, y: 1219200, cx: 3048000, cy: 914400 },
      titleSize: isCover || isClosing ? 3600 : 1450,
      bodySize: isCover || isClosing ? 1500 : 850,
      titleColor: isCover || isClosing ? "FFFFFF" : "FFFFFF",
      bodyColor: isCover || isClosing ? "E8F2FF" : visual.body,
    };
  }
  if (visual.layout === "quarterly-diagnosis") {
    const isCover = index === 0;
    return {
      surface: { x: 219456, y: 822960, cx: 8705088, cy: 4114800 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 685800 },
      secondaryAccent: { x: 365760, y: 777240, cx: 8412480, cy: 22860 },
      label: { x: 365760, y: 304800, cx: 2133600, cy: 304800 },
      title: isCover
        ? { x: 731520, y: 1066800, cx: 3352800, cy: 1524000 }
        : { x: 731520, y: 914400, cx: 3200400, cy: 609600 },
      content: isCover
        ? { x: 914400, y: 2895600, cx: 2590800, cy: 762000 }
        : { x: 731520, y: 1600200, cx: 2590800, cy: 1066800 },
      titleSize: isCover ? 2050 : 1850,
      bodySize: isCover ? 820 : 900,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "quarterly-action-loop") {
    const isCover = index === 0;
    return {
      surface: { x: 228600, y: 838200, cx: 8686800, cy: 4038600 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 685800 },
      secondaryAccent: { x: 365760, y: 807720, cx: 8412480, cy: 22860 },
      label: { x: 365760, y: 304800, cx: 2590800, cy: 304800 },
      title: isCover
        ? { x: 640080, y: 853440, cx: 4267200, cy: 457200 }
        : { x: 640080, y: 914400, cx: 3657600, cy: 609600 },
      content: isCover
        ? { x: 762000, y: 3886200, cx: 2743200, cy: 365760 }
        : { x: 731520, y: 1645920, cx: 2895600, cy: 914400 },
      titleSize: isCover ? 1550 : 1720,
      bodySize: isCover ? 560 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "operating-problem-tree") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 475488, y: 431292, cx: 8193024, cy: 4267200 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 609600 },
      secondaryAccent: { x: 731520, y: isCover ? 2225040 : 2164080, cx: 2743200, cy: 30480 },
      label: { x: 731520, y: 655320, cx: 2895600, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1219200, cx: 4267200, cy: 822960 }
        : isCover
          ? { x: 731520, y: 1074420, cx: 3962400, cy: 1066800 }
          : { x: 731520, y: 914400, cx: 3810000, cy: 792480 },
      content: isCover
        ? { x: 777240, y: 2590800, cx: 3352800, cy: 762000 }
        : { x: 777240, y: 1905000, cx: 3352800, cy: 990600 },
      titleSize: isCover ? 2680 : isClosing ? 2360 : 1860,
      bodySize: isCover ? 820 : 720,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "enterprise-digital-blueprint") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 493776, y: 421640, cx: 8153400, cy: 4366260 },
      accent: { x: 493776, y: 421640, cx: 8153400, cy: 53340 },
      secondaryAccent: { x: 731520, y: isCover ? 2125980 : 1905000, cx: 3200400, cy: 38100 },
      label: { x: 731520, y: 640080, cx: 3352800, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1112520, cx: 4572000, cy: 762000 }
        : isCover
          ? { x: 731520, y: 1051560, cx: 3886200, cy: 975360 }
          : { x: 731520, y: 899160, cx: 3886200, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2103120, cx: 3657600, cy: 762000 }
        : isCover
          ? { x: 777240, y: 2385060, cx: 3352800, cy: 701040 }
          : { x: 777240, y: 1783080, cx: 3352800, cy: 914400 },
      titleSize: isCover ? 2520 : isClosing ? 2280 : 1800,
      bodySize: isCover ? 800 : 680,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "business-opportunity-map") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 512064, y: 442976, cx: 8120000, cy: 4260000 },
      accent: { x: 512064, y: 442976, cx: 8120000, cy: 57150 },
      secondaryAccent: { x: 768096, y: isCover ? 2148840 : 1996440, cx: 3169920, cy: 30480 },
      label: { x: 768096, y: 731520, cx: 2438400, cy: 274320 },
      title: isClosing
        ? { x: 768096, y: 1219200, cx: 4724400, cy: 822960 }
        : isCover
          ? { x: 768096, y: 1066800, cx: 3962400, cy: 1066800 }
          : { x: 768096, y: 914400, cx: 3810000, cy: 792480 },
      content: isCover
        ? { x: 792480, y: 2514600, cx: 3429000, cy: 762000 }
        : { x: 792480, y: 1889760, cx: 3429000, cy: 1066800 },
      titleSize: isCover ? 2450 : isClosing ? 2480 : 1800,
      bodySize: isCover ? 820 : 720,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "industry-research") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 475488, y: 452628, cx: 8193024, cy: 4248531 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 298320 },
      secondaryAccent: { x: 731520, y: isCover ? 2000250 : 1905000, cx: 3800040, cy: 22860 },
      label: { x: 731520, y: 668655, cx: 2286000, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1219200, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 731520, y: 1080135, cx: 4389120, cy: 1219200 }
          : { x: 731520, y: 914400, cx: 4389120, cy: 914400 },
      content: isClosing
        ? { x: 749808, y: 2438400, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 749808, y: 2623185, cx: 3931920, cy: 762000 }
          : { x: 749808, y: 2133600, cx: 3931920, cy: 1219200 },
      titleSize: isCover ? 2500 : isClosing ? 2600 : 1850,
      bodySize: isCover ? 1050 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "industry-trend-forecast") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 493776, y: 432816, cx: 8156448, cy: 4297680 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 320040 },
      secondaryAccent: { x: 731520, y: isCover ? 2155440 : 1905000, cx: 3200400, cy: 22860 },
      label: { x: 731520, y: 640080, cx: 2286000, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1219200, cx: 5334000, cy: 914400 }
        : isCover
          ? { x: 731520, y: 1036320, cx: 3962400, cy: 1219200 }
          : { x: 731520, y: 914400, cx: 3901440, cy: 914400 },
      content: { x: 749808, y: 2438400, cx: 3505200, cy: 914400 },
      titleSize: isCover ? 2420 : isClosing ? 2500 : 1780,
      bodySize: isCover ? 900 : 720,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "strategy-competition-map") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 475488, y: 452628, cx: 8193024, cy: 4248531 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 304800 },
      secondaryAccent: { x: 731520, y: isCover ? 2103120 : 1973580, cx: 3200400, cy: 22860 },
      label: { x: 731520, y: 701040, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1219200, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 731520, y: 1135380, cx: 3931920, cy: 1066800 }
          : { x: 731520, y: 914400, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2362200, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 749808, y: 2545080, cx: 3505200, cy: 792480 }
          : { x: 749808, y: 1905000, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2460 : isClosing ? 2480 : 1820,
      bodySize: isCover ? 920 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "strategy-second-curve") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 475488, y: 452628, cx: 8193024, cy: 4248531 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 320040 },
      secondaryAccent: { x: 731520, y: isCover ? 2103120 : 1973580, cx: 3200400, cy: 30480 },
      label: { x: 731520, y: 701040, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1188720, cx: 5334000, cy: 822960 }
        : isCover
          ? { x: 731520, y: 1082040, cx: 3931920, cy: 1066800 }
          : { x: 731520, y: 914400, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2324100, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 749808, y: 2545080, cx: 3505200, cy: 792480 }
          : { x: 749808, y: 1905000, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2460 : isClosing ? 2480 : 1800,
      bodySize: isCover ? 900 : 740,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "strategy-swot-map") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 475488, y: 452628, cx: 8193024, cy: 4248531 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 304800 },
      secondaryAccent: { x: 731520, y: isCover ? 2103120 : 1973580, cx: 3200400, cy: 22860 },
      label: { x: 731520, y: 701040, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1219200, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 731520, y: 1135380, cx: 3931920, cy: 1066800 }
          : { x: 731520, y: 914400, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2362200, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 749808, y: 2545080, cx: 3505200, cy: 792480 }
          : { x: 749808, y: 1905000, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2400 : isClosing ? 2440 : 1780,
      bodySize: isCover ? 900 : 740,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "product-release-cadence") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 493776, y: 452628, cx: 8156448, cy: 4248531 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 335280 },
      secondaryAccent: { x: 768096, y: isCover ? 2103120 : 1973580, cx: 3200400, cy: 30480 },
      label: { x: 768096, y: 701040, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 768096, y: 1219200, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 768096, y: 1135380, cx: 3931920, cy: 1066800 }
          : { x: 768096, y: 914400, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 768096, y: 2362200, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 786384, y: 2545080, cx: 3505200, cy: 792480 }
          : { x: 786384, y: 1905000, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2480 : isClosing ? 2480 : 1820,
      bodySize: isCover ? 920 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "product-pain-points") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 493776, y: 452628, cx: 8156448, cy: 4248531 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 304800 },
      secondaryAccent: { x: 731520, y: isCover ? 2103120 : 1973580, cx: 3200400, cy: 22860 },
      label: { x: 731520, y: 701040, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1219200, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 731520, y: 1135380, cx: 3931920, cy: 1066800 }
          : { x: 731520, y: 914400, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2362200, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 749808, y: 2545080, cx: 3505200, cy: 792480 }
          : { x: 749808, y: 1905000, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2480 : isClosing ? 2480 : 1820,
      bodySize: isCover ? 920 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "product-pricing-strategy") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      // 定价策略模板右侧保留商业化示意区，文本只占左侧，避免导出 PPTX 中标题和图形互相挤压。
      surface: { x: 548640, y: 609600, cx: 8046720, cy: 4114800 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
      secondaryAccent: { x: 731520, y: isCover ? 2103120 : 1981200, cx: 3505200, cy: 30480 },
      label: { x: 731520, y: 746760, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 1005840, y: 1371600, cx: 4419600, cy: 914400 }
        : { x: 731520, y: isCover ? 990600 : 944880, cx: 4267200, cy: isCover ? 960120 : 838200 },
      content: isCover
        ? { x: 914400, y: 2301240, cx: 3810000, cy: 1219200 }
        : { x: 914400, y: 2216400, cx: 3505200, cy: 1447800 },
      titleSize: isCover ? 2520 : 1840,
      bodySize: isCover ? 1250 : 1080,
      fontFace: "Microsoft YaHei",
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "feature-priority-matrix") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 576072, y: 514350, cx: 7991856, cy: 4114800 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 335280 },
      secondaryAccent: { x: 823056, y: isCover ? 2286000 : 2148840, cx: 3383280, cy: 30480 },
      label: { x: 823056, y: 731520, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 823056, y: 1219200, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 823056, y: 1165860, cx: 3931920, cy: 1066800 }
          : { x: 823056, y: 914400, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 823056, y: 2362200, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 841344, y: 2674620, cx: 3505200, cy: 792480 }
          : { x: 841344, y: 2057400, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2480 : isClosing ? 2480 : 1820,
      bodySize: isCover ? 920 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "experience-journey-map") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 566928, y: 473964, cx: 8010144, cy: 4142136 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 335280 },
      secondaryAccent: { x: 823056, y: isCover ? 2209800 : 2057400, cx: 3474720, cy: 30480 },
      label: { x: 823056, y: 701040, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 823056, y: 1112520, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 823056, y: 1066800, cx: 3931920, cy: 1066800 }
          : { x: 823056, y: 884000, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 823056, y: 2286000, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 841344, y: 2514600, cx: 3505200, cy: 853440 }
          : { x: 841344, y: 1943100, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2480 : isClosing ? 2480 : 1820,
      bodySize: isCover ? 920 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "capability-radar-map") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 585216, y: 488204, cx: 7973568, cy: 4127856 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 335280 },
      secondaryAccent: { x: 823056, y: isCover ? 2209800 : 2057400, cx: 3474720, cy: 30480 },
      label: { x: 823056, y: 701040, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 823056, y: 1112520, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 823056, y: 1066800, cx: 3931920, cy: 1066800 }
          : { x: 823056, y: 884000, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 823056, y: 2286000, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 841344, y: 2514600, cx: 3505200, cy: 853440 }
          : { x: 841344, y: 1943100, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2480 : isClosing ? 2480 : 1820,
      bodySize: isCover ? 920 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "seed-round-story") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 512064, y: 411480, cx: 8129024, cy: 4343400 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 274320 },
      secondaryAccent: { x: 777240, y: isCover ? 2164080 : 1905000, cx: 3048000, cy: 38100 },
      label: { x: 777240, y: 655320, cx: 3200400, cy: 274320 },
      title: isClosing
        ? { x: 777240, y: 1112520, cx: 4876800, cy: 762000 }
        : isCover
          ? { x: 777240, y: 1043940, cx: 4053840, cy: 1066800 }
          : { x: 777240, y: 914400, cx: 4053840, cy: 792480 },
      content: isClosing
        ? { x: 777240, y: 2118360, cx: 3962400, cy: 762000 }
        : isCover
          ? { x: 795528, y: 2438400, cx: 3429000, cy: 731520 }
          : { x: 795528, y: 1866900, cx: 3429000, cy: 1005840 },
      titleSize: isCover ? 2600 : isClosing ? 2400 : 1840,
      bodySize: isCover ? 840 : 720,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "growth-funding-flywheel") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 493776, y: 457200, cx: 8153400, cy: 4343400 },
      accent: { x: 493776, y: 457200, cx: 8153400, cy: 45720 },
      secondaryAccent: { x: 731520, y: isCover ? 2225040 : 1973580, cx: 3124200, cy: 38100 },
      label: { x: 731520, y: 701040, cx: 3048000, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1173480, cx: 4724400, cy: 762000 }
        : isCover
          ? { x: 731520, y: 1066800, cx: 4038600, cy: 1066800 }
          : { x: 731520, y: 914400, cx: 4038600, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2194560, cx: 3962400, cy: 762000 }
        : isCover
          ? { x: 777240, y: 2468880, cx: 3505200, cy: 731520 }
          : { x: 777240, y: 1844040, cx: 3505200, cy: 1005840 },
      titleSize: isCover ? 2600 : isClosing ? 2400 : 1880,
      bodySize: isCover ? 860 : 740,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "product-funding-highlights") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 438912, y: 421640, cx: 8266176, cy: 4366260 },
      accent: { x: 438912, y: 421640, cx: 8266176, cy: 53340 },
      secondaryAccent: { x: 731520, y: isCover ? 2103120 : 1859280, cx: 3048000, cy: 38100 },
      label: { x: 731520, y: 655320, cx: 3200400, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1112520, cx: 4572000, cy: 762000 }
        : isCover
          ? { x: 731520, y: 1051560, cx: 3810000, cy: 975360 }
          : { x: 731520, y: 899160, cx: 3810000, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2103120, cx: 3657600, cy: 762000 }
        : isCover
          ? { x: 777240, y: 2377440, cx: 3352800, cy: 701040 }
          : { x: 777240, y: 1783080, cx: 3352800, cy: 914400 },
      titleSize: isCover ? 2520 : isClosing ? 2320 : 1800,
      bodySize: isCover ? 820 : 700,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "investor-update-progress-sync") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 530352, y: 452120, cx: 8083296, cy: 4239260 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 320040 },
      secondaryAccent: { x: 762000, y: isCover ? 2164080 : 1943100, cx: 3048000, cy: 38100 },
      label: { x: 762000, y: 640080, cx: 3200400, cy: 274320 },
      title: isClosing
        ? { x: 762000, y: 1112520, cx: 4572000, cy: 762000 }
        : isCover
          ? { x: 762000, y: 1051560, cx: 3886200, cy: 975360 }
          : { x: 762000, y: 899160, cx: 3886200, cy: 792480 },
      content: isClosing
        ? { x: 762000, y: 2103120, cx: 3657600, cy: 762000 }
        : isCover
          ? { x: 777240, y: 2385060, cx: 3352800, cy: 701040 }
          : { x: 777240, y: 1783080, cx: 3352800, cy: 914400 },
      titleSize: isCover ? 2500 : isClosing ? 2280 : 1780,
      bodySize: isCover ? 800 : 680,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "corporate-training") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 475488, y: 432816, cx: 8193024, cy: 4297680 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 320040 },
      secondaryAccent: { x: 731520, y: isCover ? 2125980 : 1943100, cx: 3200400, cy: 30480 },
      label: { x: 731520, y: 685800, cx: 2895600, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1219200, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 731520, y: 1097280, cx: 3931920, cy: 1066800 }
          : { x: 731520, y: 899160, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2362200, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 749808, y: 2529840, cx: 3505200, cy: 792480 }
          : { x: 749808, y: 1905000, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2520 : isClosing ? 2480 : 1840,
      bodySize: isCover ? 920 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "onboarding-guide") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 493776, y: 411480, cx: 8156448, cy: 4312920 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 365760 },
      secondaryAccent: { x: 731520, y: isCover ? 2125980 : 1927860, cx: 2926080, cy: 30480 },
      label: { x: 731520, y: 685800, cx: 2895600, cy: 274320 },
      title: isClosing
        ? { x: 731520, y: 1188720, cx: 5486400, cy: 822960 }
        : isCover
          ? { x: 731520, y: 1082040, cx: 3931920, cy: 1066800 }
          : { x: 731520, y: 884000, cx: 3931920, cy: 792480 },
      content: isClosing
        ? { x: 731520, y: 2316480, cx: 3962400, cy: 914400 }
        : isCover
          ? { x: 749808, y: 2499360, cx: 3505200, cy: 792480 }
          : { x: 749808, y: 1874520, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2500 : isClosing ? 2460 : 1820,
      bodySize: isCover ? 900 : 740,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "knowledge-blackboard") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 475488, y: 365760, cx: 8193024, cy: 4427220 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 0 },
      secondaryAccent: { x: 823056, y: isCover ? 2247900 : 1973580, cx: 1706880, cy: 60960 },
      label: { x: 823056, y: 685800, cx: 2438400, cy: 243840 },
      title: isClosing
        ? { x: 823056, y: 1097280, cx: 4267200, cy: 762000 }
        : isCover
          ? { x: 823056, y: 1066800, cx: 4267200, cy: 1066800 }
          : { x: 823056, y: 914400, cx: 3962400, cy: 792480 },
      content: isClosing
        ? { x: 823056, y: 2118360, cx: 3657600, cy: 822960 }
        : isCover
          ? { x: 841344, y: 2468880, cx: 3657600, cy: 731520 }
          : { x: 841344, y: 1844040, cx: 3657600, cy: 1005840 },
      titleSize: isCover ? 2480 : isClosing ? 2280 : 1760,
      bodySize: isCover ? 820 : 700,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "exam-review-keypoints") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 530352, y: 411480, cx: 8083296, cy: 4312920 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 396240 },
      secondaryAccent: { x: 786384, y: isCover ? 2159000 : 1905000, cx: 2834640, cy: 60960 },
      label: { x: 786384, y: 670560, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 786384, y: 1127760, cx: 4572000, cy: 792480 }
        : isCover
          ? { x: 786384, y: 1036320, cx: 3962400, cy: 1036320 }
          : { x: 786384, y: 884000, cx: 3962400, cy: 792480 },
      content: isClosing
        ? { x: 804672, y: 2186940, cx: 3657600, cy: 822960 }
        : isCover
          ? { x: 804672, y: 2385060, cx: 3505200, cy: 762000 }
          : { x: 804672, y: 1798320, cx: 3505200, cy: 1066800 },
      titleSize: isCover ? 2520 : isClosing ? 2380 : 1780,
      bodySize: isCover ? 820 : 720,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "teaching-achievement-showcase") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 530352, y: 411480, cx: 8083296, cy: 4312920 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 365760 },
      secondaryAccent: { x: 786384, y: isCover ? 2194560 : 1905000, cx: 2895600, cy: 53340 },
      label: { x: 786384, y: 670560, cx: 3048000, cy: 274320 },
      title: isClosing
        ? { x: 786384, y: 1127760, cx: 4724400, cy: 792480 }
        : isCover
          ? { x: 786384, y: 1036320, cx: 3962400, cy: 1036320 }
          : { x: 786384, y: 884000, cx: 3962400, cy: 792480 },
      content: isClosing
        ? { x: 804672, y: 2186940, cx: 3657600, cy: 822960 }
        : isCover
          ? { x: 804672, y: 2423160, cx: 3505200, cy: 762000 }
          : { x: 804672, y: 1844040, cx: 3505200, cy: 1005840 },
      titleSize: isCover ? 2460 : isClosing ? 2320 : 1760,
      bodySize: isCover ? 780 : 690,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "finance-budget-planning") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 621792, y: 627888, cx: 7900416, cy: 4069080 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 320040 },
      secondaryAccent: { x: 841248, y: isCover ? 2316480 : 2057400, cx: 3291840, cy: 22860 },
      label: { x: 841248, y: 822960, cx: 2133600, cy: 274320 },
      title: isClosing
        ? { x: 841248, y: 1219200, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 841248, y: 1219200, cx: 4114800, cy: 1219200 }
          : { x: 841248, y: 914400, cx: 4389120, cy: 731520 },
      content: isClosing
        ? { x: 841248, y: 2438400, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 841248, y: 2621280, cx: 3505200, cy: 762000 }
          : { x: 841248, y: 1828800, cx: 3474720, cy: 914400 },
      titleSize: isCover ? 2700 : isClosing ? 2550 : 1900,
      bodySize: isCover ? 960 : 780,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "finance-cost-breakdown") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 566928, y: 606552, cx: 8016240, cy: 4107180 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 304800 },
      secondaryAccent: { x: 822960, y: isCover ? 2286000 : 2034540, cx: 3200400, cy: 30480 },
      label: { x: 822960, y: 807720, cx: 2286000, cy: 274320 },
      title: isClosing
        ? { x: 822960, y: 1188720, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 822960, y: 1188720, cx: 4114800, cy: 1219200 }
          : { x: 822960, y: 899160, cx: 4267200, cy: 731520 },
      content: isClosing
        ? { x: 822960, y: 2407920, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 822960, y: 2590800, cx: 3505200, cy: 762000 }
          : { x: 822960, y: 1798320, cx: 3474720, cy: 914400 },
      titleSize: isCover ? 2720 : isClosing ? 2520 : 1880,
      bodySize: isCover ? 940 : 740,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "finance-cash-flow-forecast") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      // 现金流模板的正文由专用图表和卡片承载，标题只占左侧，右侧留给预测图/表格。
      surface: { x: 566928, y: 591312, cx: 8001000, cy: 4145280 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
      secondaryAccent: { x: 804672, y: isCover ? 2286000 : 2057400, cx: 3352800, cy: 30480 },
      label: { x: 804672, y: 792480, cx: 2438400, cy: 274320 },
      title: isClosing
        ? { x: 804672, y: 1173480, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 804672, y: 1165860, cx: 3962400, cy: 1219200 }
          : { x: 804672, y: 914400, cx: 4267200, cy: 731520 },
      content: isClosing
        ? { x: 804672, y: 2407920, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 804672, y: 2537460, cx: 3413760, cy: 762000 }
          : { x: 804672, y: 1767840, cx: 3352800, cy: 914400 },
      titleSize: isCover ? 2720 : isClosing ? 2520 : 1880,
      bodySize: isCover ? 900 : 740,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "finance-profit-bridge") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      // 利润桥模板左侧承载结论和指标，右侧承载瀑布/结构/行动图，字号和坐标需要贴近在线预览。
      surface: { x: 566928, y: 591312, cx: 8001000, cy: 4145280 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 342900 },
      secondaryAccent: { x: 804672, y: isCover ? 2476500 : 1805940, cx: 3200400, cy: 30480 },
      label: { x: 804672, y: 792480, cx: 2286000, cy: 274320 },
      title: isClosing
        ? { x: 804672, y: 1173480, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 804672, y: 1165860, cx: 3886200, cy: 1127760 }
          : { x: 804672, y: 929640, cx: 4267200, cy: 670560 },
      content: isClosing
        ? { x: 804672, y: 2407920, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 804672, y: 2644140, cx: 3505200, cy: 731520 }
          : { x: 804672, y: 1882140, cx: 3505200, cy: 975360 },
      titleSize: isCover ? 2180 : isClosing ? 2200 : 1640,
      bodySize: isCover ? 760 : 620,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "finance-budget-variance") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 566928, y: 591312, cx: 8001000, cy: 4145280 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 320040 },
      secondaryAccent: { x: 804672, y: isCover ? 2232660 : 2011680, cx: 3108960, cy: 30480 },
      label: { x: 804672, y: 792480, cx: 2286000, cy: 274320 },
      title: isClosing
        ? { x: 804672, y: 1173480, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 804672, y: 1173480, cx: 3931920, cy: 1219200 }
          : { x: 804672, y: 883920, cx: 4114800, cy: 731520 },
      content: isClosing
        ? { x: 804672, y: 2407920, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 804672, y: 2560320, cx: 3413760, cy: 762000 }
          : { x: 804672, y: 1767840, cx: 3352800, cy: 914400 },
      titleSize: isCover ? 2660 : isClosing ? 2520 : 1880,
      bodySize: isCover ? 940 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "finance-budget-adjustment") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 585216, y: 617220, cx: 7979664, cy: 4099560 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 335280 },
      secondaryAccent: { x: 822960, y: isCover ? 2263140 : 2034540, cx: 3200400, cy: 30480 },
      label: { x: 822960, y: 807720, cx: 2286000, cy: 274320 },
      title: isClosing
        ? { x: 822960, y: 1188720, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 822960, y: 1188720, cx: 4114800, cy: 1219200 }
          : { x: 822960, y: 899160, cx: 4267200, cy: 731520 },
      content: isClosing
        ? { x: 822960, y: 2407920, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 822960, y: 2590800, cx: 3505200, cy: 762000 }
          : { x: 822960, y: 1798320, cx: 3474720, cy: 914400 },
      titleSize: isCover ? 2660 : isClosing ? 2520 : 1880,
      bodySize: isCover ? 940 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "sales-financial-solution") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 585216, y: 640080, cx: 7979664, cy: 4069080 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 335280 },
      secondaryAccent: { x: 841248, y: isCover ? 2331720 : 2087880, cx: 3200400, cy: 22860 },
      label: { x: 841248, y: 838200, cx: 2316480, cy: 274320 },
      title: isClosing
        ? { x: 841248, y: 1219200, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 841248, y: 1219200, cx: 4114800, cy: 1219200 }
          : { x: 841248, y: 914400, cx: 4267200, cy: 731520 },
      content: isClosing
        ? { x: 841248, y: 2438400, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 841248, y: 2644140, cx: 3505200, cy: 762000 }
          : { x: 841248, y: 1859280, cx: 3474720, cy: 914400 },
      titleSize: isCover ? 2700 : isClosing ? 2550 : 1900,
      bodySize: isCover ? 960 : 760,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "sales-education-solution") {
    const isCover = index === 0;
    const isRoadmap = role === "closing" || String(role || "").includes("roadmap");
    return {
      surface: { x: 566928, y: 627888, cx: 8016240, cy: 4072128 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 365760 },
      secondaryAccent: { x: 832104, y: isCover ? 2255520 : 2065020, cx: 3200400, cy: 22860 },
      label: { x: 832104, y: 838200, cx: 2438400, cy: 274320 },
      title: isRoadmap
        ? { x: 832104, y: 1188720, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 832104, y: 1188720, cx: 4114800, cy: 1219200 }
          : { x: 832104, y: 914400, cx: 4267200, cy: 731520 },
      content: isRoadmap
        ? { x: 832104, y: 2324100, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 832104, y: 2537460, cx: 3505200, cy: 762000 }
          : { x: 832104, y: 1813560, cx: 3474720, cy: 914400 },
      titleSize: isCover ? 2700 : isRoadmap ? 2500 : 1880,
      bodySize: isCover ? 930 : 740,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "sales-manufacturing-solution") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 530352, y: 627888, cx: 8089392, cy: 4072128 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 365760 },
      secondaryAccent: { x: 768096, y: isCover ? 2301240 : 2057400, cx: 3200400, cy: 30480 },
      label: { x: 768096, y: 838200, cx: 2590800, cy: 274320 },
      title: isClosing
        ? { x: 768096, y: 1188720, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 768096, y: 1188720, cx: 4114800, cy: 1219200 }
          : { x: 768096, y: 914400, cx: 4267200, cy: 731520 },
      content: isClosing
        ? { x: 768096, y: 2324100, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 768096, y: 2537460, cx: 3505200, cy: 762000 }
          : { x: 768096, y: 1813560, cx: 3474720, cy: 914400 },
      titleSize: isCover ? 2650 : isClosing ? 2500 : 1850,
      bodySize: isCover ? 930 : 740,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "channel-recruitment-policy") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      // 渠道招商模板采用在线预览同款左文右图结构，标题框控制在左侧，避免下载 PPTX 回退成通用大标题页面。
      surface: { x: 530352, y: 472440, cx: 8089392, cy: 4236720 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 320040 },
      secondaryAccent: { x: 804672, y: isCover ? 2156460 : 1973580, cx: 3200400, cy: 30480 },
      label: { x: 804672, y: 762000, cx: 2743200, cy: 243840 },
      title: isClosing
        ? { x: 804672, y: 1036320, cx: 4114800, cy: 701040 }
        : isCover
          ? { x: 804672, y: 1066800, cx: 3962400, cy: 975360 }
          : { x: 804672, y: 1036320, cx: 3962400, cy: 701040 },
      content: isClosing
        ? { x: 804672, y: 2103120, cx: 3810000, cy: 1219200 }
        : isCover
          ? { x: 804672, y: 2377440, cx: 3505200, cy: 914400 }
          : { x: 804672, y: 1981200, cx: 3505200, cy: 1219200 },
      titleSize: isCover ? 1760 : isClosing ? 1260 : 1280,
      bodySize: isCover ? 760 : 720,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "sales-key-account-decision-chain") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 548640, y: 609600, cx: 8046720, cy: 4114800 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 304800 },
      secondaryAccent: { x: 792480, y: isCover ? 2156460 : 1706880, cx: isCover ? 3048000 : 2743200, cy: 30480 },
      label: { x: 792480, y: 762000, cx: 2743200, cy: 274320 },
      title: isClosing
        ? { x: 792480, y: 1036320, cx: 4114800, cy: 701040 }
        : isCover
          ? { x: 792480, y: 1066800, cx: 3962400, cy: 975360 }
          : { x: 792480, y: 1036320, cx: 4114800, cy: 701040 },
      content: isClosing
        ? { x: 792480, y: 2103120, cx: 3962400, cy: 1219200 }
        : isCover
          ? { x: 792480, y: 2377440, cx: 3505200, cy: 914400 }
          : { x: 792480, y: 1981200, cx: 3962400, cy: 1219200 },
      titleSize: isCover ? 1680 : isClosing ? 1220 : 1220,
      bodySize: isCover ? 780 : 780,
      titleColor: visual.title,
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
  if (visual.layout === "marketing-launch-rhythm") {
    const isCover = index === 0;
    const isClosing = role === "closing";
    return {
      surface: { x: 0, y: 0, cx: 9144000, cy: 5143500 },
      accent: { x: 0, y: 0, cx: 0, cy: 0 },
      secondaryAccent: { x: 804672, y: isCover ? 2230120 : 2057400, cx: 3200400, cy: 30480 },
      label: { x: 804672, y: 701040, cx: 2133600, cy: 274320 },
      title: isClosing
        ? { x: 804672, y: 1097280, cx: 5486400, cy: 914400 }
        : isCover
          ? { x: 804672, y: 1097280, cx: 4114800, cy: 1219200 }
          : { x: 804672, y: 914400, cx: 4267200, cy: 731520 },
      content: isClosing
        ? { x: 804672, y: 2438400, cx: 4267200, cy: 914400 }
        : isCover
          ? { x: 804672, y: 2545080, cx: 3505200, cy: 762000 }
          : { x: 804672, y: 1828800, cx: 3474720, cy: 914400 },
      titleSize: isCover ? 2850 : isClosing ? 2550 : 1900,
      bodySize: isCover ? 900 : 720,
      titleColor: "FFFFFF",
      bodyColor: "D7DEE8",
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
  if (visual.layout === "business-model-bp") {
    if (index === 0) {
      return {
        surface: { x: 411480, y: 365760, cx: 8321040, cy: 4411980 },
        accent: { x: 411480, y: 365760, cx: 8321040, cy: 76200 },
        secondaryAccent: { x: 914400, y: 3810000, cx: 7315200, cy: 30480 },
        label: { x: 640080, y: 548640, cx: 2133600, cy: 274320 },
        title: { x: 640080, y: 1043940, cx: 4267200, cy: 914400 },
        content: { x: 731520, y: 2438400, cx: 3810000, cy: 685800 },
        titleSize: 3000,
        bodySize: 1120,
      };
    }
    return {
      surface: { x: 411480, y: 365760, cx: 8321040, cy: 4411980 },
      accent: { x: 411480, y: 365760, cx: 8321040, cy: 76200 },
      secondaryAccent: { x: 914400, y: 3810000, cx: 7315200, cy: 30480 },
      label: { x: 640080, y: 548640, cx: 2133600, cy: 274320 },
      title: { x: 640080, y: 838200, cx: 3962400, cy: 670560 },
      content: { x: 685800, y: 3962400, cx: 7772400, cy: 457200 },
      titleSize: 2300,
      bodySize: 980,
    };
  }
  if (visual.layout === "bi-executive-cockpit") {
    return {
      surface: { x: 438912, y: 411480, cx: 8266176, cy: 4373880 },
      accent: { x: 438912, y: 411480, cx: 8266176, cy: 45720 },
      secondaryAccent: { x: 731520, y: 3048000, cx: 3657600, cy: 30480 },
      label: { x: 731520, y: 670560, cx: 2438400, cy: 243840 },
      title: { x: 731520, y: 990600, cx: 3962400, cy: 914400 },
      content: { x: 731520, y: 2438400, cx: 3657600, cy: 914400 },
      titleSize: index === 0 ? 3000 : 2520,
      bodySize: 980,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "user-path-funnel") {
    return {
      surface: { x: 530352, y: 462280, cx: 8083296, cy: 4213860 },
      accent: { x: 0, y: 0, cx: 9144000, cy: 365760 },
      secondaryAccent: { x: 768096, y: 2235200, cx: 3200400, cy: 30480 },
      label: { x: 768096, y: 701040, cx: 2438400, cy: 243840 },
      title: { x: 768096, y: 1066800, cx: 3810000, cy: 853440 },
      content: { x: 853440, y: 2514600, cx: 3505200, cy: 914400 },
      titleSize: index === 0 ? 2920 : 2440,
      bodySize: 900,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "market-trend-radar") {
    return {
      surface: { x: 457200, y: 411480, cx: 8229600, cy: 4381500 },
      accent: { x: 457200, y: 411480, cx: 5486400, cy: 45720 },
      secondaryAccent: { x: 731520, y: 3048000, cx: 3657600, cy: 30480 },
      label: { x: 731520, y: 670560, cx: 2895600, cy: 243840 },
      title: { x: 731520, y: 990600, cx: 3962400, cy: 914400 },
      content: { x: 731520, y: 2438400, cx: 3657600, cy: 914400 },
      titleSize: index === 0 ? 3000 : 2520,
      bodySize: 940,
      titleColor: visual.title,
      bodyColor: visual.body,
    };
  }
  if (visual.layout === "metric-anomaly-attribution") {
    return {
      surface: { x: 521208, y: 411480, cx: 8101584, cy: 4381500 },
      accent: { x: 521208, y: 411480, cx: 6096000, cy: 54864 },
      secondaryAccent: { x: 777240, y: 2423160, cx: 3505200, cy: 30480 },
      label: { x: 777240, y: 670560, cx: 2895600, cy: 243840 },
      title: { x: 777240, y: 990600, cx: 3810000, cy: 914400 },
      content: { x: 777240, y: 2438400, cx: 3505200, cy: 914400 },
      titleSize: index === 0 ? 3000 : 2480,
      bodySize: 920,
      titleColor: visual.title,
      bodyColor: visual.body,
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
 * 鍒涘缓 slide relationships銆?
 * red-gold 椤甸潰浼氭妸 rId2 缁戝畾鍒?dome 鑳屾櫙鍥撅紝閮ㄥ垎瑙掕壊鍐嶇敤 rId3 缁戝畾鍟嗗姟閰嶅浘銆?
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
 * 鍒涘缓绌虹櫧 slide layout銆?
 * 实际视觉内容都在每页 slide XML 中生成，layout 鍙彁渚?Office 鎵€闇€缁撴瀯銆?
 * @returns {string}
 */
function slideLayoutXml(visual) {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${groupShapeXml()}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

/**
 * 鍒涘缓 slide layout relationship XML銆?
 * @returns {string}
 */
function slideLayoutRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
}

/**
 * 鍒涘缓鏈€灏?slide master銆?
 * 主题色从 visual 娉ㄥ叆锛屽叿浣?dome 瑁呴グ涓嶆斁鍦?master锛屼究浜庢瘡椤垫寜瑙掕壊宸紓鍖栥€?
 * @returns {string}
 */
function slideMasterXml(visual) {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${visual.background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${groupShapeXml()}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
}

/**
 * 鍒涘缓 slide master relationship XML銆?
 * @returns {string}
 */
function slideMasterRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
}

/**
 * 鍒涘缓鏈€灏?Office theme銆?
 * red-gold 鍦ㄨ繖閲屽鐢?dome.pptx 鐨?588ku 瀛椾綋鏂规銆?
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
 * 鐢熸垚涓婚瀛椾綋閰嶇疆銆?
 * red-gold 澶嶇敤 dome.pptx 鐨?588ku 字体方案，其他模板保留原 Moling 瀛椾綋鏂规銆?
 * @param {object} visual
 * @returns {string}
 */
function fontSchemeXml(visual) {
  if (visual.layout === "red-gold") {
    return `<a:fontScheme name="588ku"><a:majorFont><a:latin typeface="Arial Black"/><a:ea typeface="鎬濇簮榛戜綋 CN Bold"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="鎬濇簮榛戜綋 CN Regular"/><a:cs typeface=""/></a:minorFont></a:fontScheme>`;
  }
  return `<a:fontScheme name="Moling"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme>`;
}

/**
 * 鍒涘缓 PPTX slide 蹇呴渶鐨勬牴 group shape 鍏冩暟鎹€?
 * @returns {string}
 */
function groupShapeXml() {
  return `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
}

/**
 * 鍒涘缓濉厖鐭╁舰褰㈢姸銆?
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, fill: string, transparency?: number}} input
 * @returns {string}
 */
function rectShapeXml({ id, name, x, y, cx, cy, fill, transparency = 0 }) {
  const alpha = transparency > 0 ? `<a:alpha val="${Math.max(0, Math.min(100000, 100000 - transparency))}"/>` : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}">${alpha}</a:srgbClr></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

/**
 * 鍒涘缓濉厖鐨勯璁惧嚑浣曞舰鐘躲€?
 * 鐢ㄤ簬閲戣壊娉㈡氮銆佺孩鑹插簳娴€佸崱鐗囧拰鍙充晶瑁呴グ鍧椼€?
 * @param {{id: number, name: string, geom: string, x: number, y: number, cx: number, cy: number, fill: string}} input
 * @returns {string}
 */
function solidShapeXml({ id, name, geom = "rect", x, y, cx, cy, fill }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${escapeXml(geom)}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

/**
 * 创建仅描边形状（用于卡片边框/澶栨锛?
 * @param {{id: number, name: string, geom: string, x: number, y: number, cx: number, cy: number, stroke: string, width?: number, dash?: string, transparency?: number, rotation?: number}} input
 * @returns {string}
 */
function lineFrameShapeXml({ id, name, geom, x, y, cx, cy, stroke, width = 19050, dash = "", transparency = 0, rotation = 0 }) {
  const alpha = transparency > 0 ? `<a:alpha val="${Math.max(0, Math.min(100000, 100000 - transparency))}"/>` : "";
  const dashXml = dash ? `<a:prstDash val="${escapeXml(dash)}"/>` : "";
  const rotationXml = rotation ? ` rot="${rotation}"` : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm${rotationXml}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${escapeXml(geom)}"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="${width}" cap="round"><a:solidFill><a:srgbClr val="${stroke}">${alpha}</a:srgbClr></a:solidFill>${dashXml}</a:ln></p:spPr></p:sp>`;
}

/**
 * 鍒涘缓 dome 搴曢儴娉㈡氮鐢ㄧ殑鍦嗗姬绾挎潯銆?
 * 绾挎潯灞傚彔鍦ㄥ簳閮ㄨ壊甯︿笂锛岀敤鏉ユā鎷?dome.pptx 閲屾洿鏌斿拰鐨勯噾鑹叉尝娴蛋鍔裤€?
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, stroke: string, width: number}} input
 * @returns {string}
 */
function arcLineShapeXml({ id, name, x, y, cx, cy, stroke, width }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="arc"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="${width}" cap="round"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln></p:spPr></p:sp>`;
}

/**
 * 鍒涘缓缁戝畾鍒?slide relationship id 鐨?OOXML 鍥剧墖褰㈢姸銆?
 * @param {{id: number, name: string, relId: string, x: number, y: number, cx: number, cy: number}} input
 * @returns {string}
 */
/**
 * 鍒涘缓 top-band 灏侀潰鐨勪笁鏋氭寚鏍囧崱锛岀敤鏉ユ妸鏋佺畝鐏拌摑妯℃澘鍗囩骇涓洪珮绠℃眹鎶ョ殑鍟嗕笟鍖栧皝闈㈢粨鏋勩€?
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

function annualSummaryDecorationsXml({ visual, index, layout }) {
  const isCover = index === 0;
  const palette = annualSummaryColorPalette(visual);
  const scene = annualSummaryScene(visual);
  // 灏侀潰閲囩敤鍙傝€冨浘鐨勮摑闈掓笎鍙樺ぇ搴曪紱鍐呭椤电户缁娇鐢ㄨ交閲忔姤鍛婄焊寮狅紝淇濊瘉涓嬭浇 PPT 鍙紪杈戙€?
  const surface = isCover
    ? annualSummaryCoverBackdropXml({ visual, palette })
    : solidShapeXml({ id: 701, name: "Annual Summary Report Sheet", x: layout.surface.x, y: layout.surface.y, cx: layout.surface.cx, cy: layout.surface.cy, fill: palette.coverWash });
  const lowerItems = isCover
    ? annualSummaryMetricCardsXml({ visual, palette, metrics: scene.metrics })
    : annualSummaryDiagnosticCardsXml({ visual, palette });
  return surface
    + (isCover ? "" : rectShapeXml({ id: 702, name: "Annual Summary Module Rule", x: 685800, y: 723900, cx: 7772400, cy: 22860, fill: visual.accent }))
    + (isCover ? "" : rectShapeXml({ id: 705, name: "Annual Summary Sheet Accent", x: layout.surface.x, y: layout.surface.y, cx: layout.surface.cx, cy: 38100, fill: visual.accent }))
    + textShapeXml({ id: 706, name: "Annual Summary Kicker", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 900, bold: true, color: isCover ? "E9FBFF" : visual.accent })
    + textShapeXml({ id: 707, name: "Annual Summary Year Mark", x: isCover ? 7010400 : 7162800, y: isCover ? 731520 : 800100, cx: 1066800, cy: 365760, text: scene.year, size: isCover ? 2500 : 2300, bold: true, color: isCover ? palette.coverYear : palette.year })
    + annualSummaryDashboardXml({ visual, palette, isCover })
    + lowerItems
    + (isCover ? "" : annualSummaryTimelineXml({ visual, palette }));
}

function quarterlyDashboardDecorationsXml({ visual, index, role, slide }) {
  const palette = quarterlyDashboardColorPalette(visual);
  const scene = quarterlyDashboardSceneFromSlide(slide, index);
  const isCover = index === 0;
  const isClosing = role === "closing";
  if (isCover || isClosing) {
    return quarterlyDashboardDarkBackgroundXml({ visual, palette, isClosing })
      + quarterlyDashboardHeroVisualXml({ palette, isClosing })
      + quarterlyDashboardHeroBarsXml({ palette })
      + (isCover
        ? textShapeXml({ id: 532, name: "Quarterly Dashboard Kicker", x: 731520, y: 914400, cx: 3962400, cy: 243840, text: scene.kicker, size: 900, bold: true, color: palette.softText })
          + solidShapeXml({ id: 533, name: "Quarterly Dashboard Cover Card", geom: "roundRect", x: 6400800, y: 3657600, cx: 2514600, cy: 640080, fill: "F4F7FB" })
          + lineFrameShapeXml({ id: 534, name: "Quarterly Dashboard Cover Card Border", geom: "roundRect", x: 6400800, y: 3657600, cx: 2514600, cy: 640080, stroke: palette.lightBlue, width: 11430 })
          + textShapeXml({ id: 535, name: "Quarterly Dashboard Report Year", x: 6629400, y: 3787140, cx: 914400, cy: 152400, text: scene.reportYear, size: 760, bold: true, color: visual.title })
          + textShapeXml({ id: 536, name: "Quarterly Dashboard Report Scope", x: 6629400, y: 4053840, cx: 1905000, cy: 182880, text: scene.coverCaption, size: 880, bold: true, color: visual.title })
        : textShapeXml({ id: 538, name: "Quarterly Dashboard Closing Caption", x: 914400, y: 2514600, cx: 3657600, cy: 304800, text: scene.endingCaption, size: 1260, bold: true, color: "E8F2FF" })
          + solidShapeXml({ id: 539, name: "Quarterly Dashboard Closing Meta Card", geom: "roundRect", x: 914400, y: 3375660, cx: 2971800, cy: 457200, fill: "F4F7FB" })
          + textShapeXml({ id: 540, name: "Quarterly Dashboard Closing Meta", x: 1143000, y: 3505200, cx: 2438400, cy: 182880, text: scene.closingMeta, size: 980, bold: true, color: visual.title }));
  }
  return quarterlyDashboardContentBackgroundXml({ visual, palette })
    + quarterlyDashboardSectionLabelXml({ visual, text: scene.section })
    + quarterlyDashboardCommandStripXml({ palette })
    + quarterlyDashboardInsightLensXml({ palette })
    + quarterlyDashboardRingXml({ idBase: 545, x: 609600, y: 1524000, value: scene.metrics[0].value, label: scene.metrics[0].label, visual })
    + quarterlyDashboardRingXml({ idBase: 555, x: 1828800, y: 1524000, value: scene.metrics[1].value, label: scene.metrics[1].label, visual })
    + quarterlyDashboardProductBarsXml({ visual, title: scene.barTitle })
    + quarterlyDashboardClientPanelXml({ visual, title: scene.clientTitle })
    + quarterlyDashboardRegionCardsXml({ visual, regions: scene.regions })
    + quarterlyDashboardComboChartXml({ visual, title: scene.comboTitle })
    + quarterlyDashboardPieXml({ visual, title: scene.pieTitle });
}

function quarterlyDashboardDarkBackgroundXml({ visual, palette }) {
  return solidShapeXml({ id: 501, name: "Quarterly Dashboard Dark Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: "173861" })
    + solidShapeXml({ id: 502, name: "Quarterly Dashboard Top Band", x: 0, y: 0, cx: 9144000, cy: 800100, fill: "102B4C" })
    + solidShapeXml({ id: 503, name: "Quarterly Dashboard Footer Band", x: 0, y: 4686300, cx: 9144000, cy: 457200, fill: "0F2745" })
    + arcLineShapeXml({ id: 504, name: "Quarterly Dashboard Data Ring A", x: 5989320, y: 1584960, cx: 1778000, cy: 1778000, stroke: "5D91CD", width: 38100 })
    + arcLineShapeXml({ id: 505, name: "Quarterly Dashboard Data Ring B", x: 6705600, y: 2217420, cx: 1066800, cy: 1066800, stroke: "C4D8EF", width: 30480 })
    + rectShapeXml({ id: 506, name: "Quarterly Dashboard Diagonal Line A", x: 609600, y: 4114800, cx: 914400, cy: 15240, fill: palette.lightBlue })
    + rectShapeXml({ id: 507, name: "Quarterly Dashboard Diagonal Line B", x: 1600200, y: 3992880, cx: 1219200, cy: 15240, fill: palette.lightBlue });
}

function quarterlyDashboardHeroBarsXml({ palette }) {
  const bars = [
    [6705600, 2796540, 167640, 502920],
    [7071360, 2606040, 167640, 693420],
    [7437120, 2857500, 167640, 441960],
    [7802880, 2392680, 167640, 906780],
    [8168640, 2697480, 167640, 601980],
  ];
  return solidShapeXml({ id: 508, name: "Quarterly Dashboard Hero Glass Panel", geom: "roundRect", x: 6400800, y: 2011680, cx: 2286000, cy: 1371600, fill: "2A5A98" })
    + lineFrameShapeXml({ id: 509, name: "Quarterly Dashboard Hero Panel Frame", geom: "roundRect", x: 6400800, y: 2011680, cx: 2286000, cy: 1371600, stroke: "C4D8EF", width: 9525 })
    + rectShapeXml({ id: 518, name: "Quarterly Dashboard Hero Panel Header", x: 6629400, y: 2164080, cx: 1676400, cy: 68580, fill: "C4D8EF" })
    + rectShapeXml({ id: 519, name: "Quarterly Dashboard Hero Axis", x: 6629400, y: 3307080, cx: 1752600, cy: 15240, fill: "8BB2DB" })
    + bars.map(([x, y, cx, cy], index) => solidShapeXml({ id: 510 + index, name: `Quarterly Dashboard Hero Bar ${index + 1}`, geom: "roundRect", x, y, cx, cy, fill: palette.barBlue })).join("");
}

function quarterlyDashboardHeroVisualXml({ palette, isClosing }) {
  const panelHeight = isClosing ? 2590800 : 2819400;
  const shadowY = isClosing ? 3337560 : 3566160;
  return solidShapeXml({ id: 650, name: "Quarterly Dashboard Business Illustration Panel", geom: "roundRect", x: 5486400, y: 792480, cx: 3352800, cy: panelHeight, fill: "D7E8F7" })
    + lineFrameShapeXml({ id: 651, name: "Quarterly Dashboard Business Illustration Frame", geom: "roundRect", x: 5486400, y: 792480, cx: 3352800, cy: panelHeight, stroke: "FFFFFF", width: 11430 })
    + solidShapeXml({ id: 652, name: "Quarterly Dashboard Executive Screen", geom: "roundRect", x: 5791200, y: 1127760, cx: 1676400, cy: 990600, fill: "FFFFFF" })
    + rectShapeXml({ id: 653, name: "Quarterly Dashboard Screen Accent A", x: 5943600, y: 1310640, cx: 167640, cy: 106680, fill: "39D5E8" })
    + rectShapeXml({ id: 654, name: "Quarterly Dashboard Screen Line A", x: 6195060, y: 1341120, cx: 640080, cy: 38100, fill: "C4D8EF" })
    + rectShapeXml({ id: 655, name: "Quarterly Dashboard Screen Accent B", x: 5943600, y: 1584960, cx: 167640, cy: 106680, fill: "D7A650" })
    + rectShapeXml({ id: 656, name: "Quarterly Dashboard Screen Line B", x: 6195060, y: 1615440, cx: 762000, cy: 38100, fill: "C4D8EF" })
    + solidShapeXml({ id: 657, name: "Quarterly Dashboard Executive Portrait", geom: "roundRect", x: 7620000, y: 1158240, cx: 762000, cy: 929640, fill: "173861" })
    + solidShapeXml({ id: 658, name: "Quarterly Dashboard Portrait Head", geom: "ellipse", x: 7856220, y: 1303020, cx: 289560, cy: 289560, fill: "D7A650" })
    + solidShapeXml({ id: 659, name: "Quarterly Dashboard Portrait Body", geom: "roundRect", x: 7787640, y: 1623060, cx: 426720, cy: 335280, fill: palette.softText })
    + arcLineShapeXml({ id: 660, name: "Quarterly Dashboard Insight Lens Ring", x: 7162800, y: 2286000, cx: 762000, cy: 762000, stroke: "FFFFFF", width: 38100 })
    + rectShapeXml({ id: 661, name: "Quarterly Dashboard Insight Lens Handle", x: 7772400, y: 2941320, cx: 106680, cy: 457200, fill: "173861" })
    + rectShapeXml({ id: 662, name: "Quarterly Dashboard Illustration Shadow", x: 5867400, y: shadowY, cx: 2438400, cy: 38100, fill: "8BB2DB" });
}

function quarterlyDashboardContentBackgroundXml({ visual, palette }) {
  return solidShapeXml({ id: 520, name: "Quarterly Dashboard Light Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: "EEF3F9" })
    + solidShapeXml({ id: 521, name: "Quarterly Dashboard Header", x: 0, y: 0, cx: 9144000, cy: 685800, fill: "173861" })
    + rectShapeXml({ id: 527, name: "Quarterly Dashboard Header Accent", x: 0, y: 655320, cx: 9144000, cy: 30480, fill: "D7A650" })
    + solidShapeXml({ id: 522, name: "Quarterly Dashboard Canvas", x: 365760, y: 853440, cx: 8412480, cy: 3962400, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 523, name: "Quarterly Dashboard Canvas Frame", x: 365760, y: 853440, cx: 8412480, cy: 3962400, stroke: palette.frame, width: 9525 });
}

function quarterlyDashboardSectionLabelXml({ visual, text }) {
  return solidShapeXml({ id: 524, name: "Quarterly Dashboard Section Label", geom: "roundRect", x: 548640, y: 944880, cx: 1447800, cy: 243840, fill: "173861" })
    + textShapeXml({ id: 526, name: "Quarterly Dashboard Section Text", x: 701040, y: 998220, cx: 1066800, cy: 121920, text, size: 600, bold: true, color: "FFFFFF" });
}

function quarterlyDashboardCommandStripXml({ palette }) {
  return solidShapeXml({ id: 645, name: "Quarterly Dashboard Executive Command Strip", geom: "roundRect", x: 5943600, y: 944880, cx: 2590800, cy: 213360, fill: "173861" })
    + rectShapeXml({ id: 646, name: "Quarterly Dashboard Command Signal A", x: 6172200, y: 1028700, cx: 457200, cy: 30480, fill: "FFFFFF" })
    + rectShapeXml({ id: 647, name: "Quarterly Dashboard Command Signal B", x: 7010400, y: 1028700, cx: 457200, cy: 30480, fill: "D7A650" })
    + rectShapeXml({ id: 648, name: "Quarterly Dashboard Command Signal C", x: 7848600, y: 1028700, cx: 457200, cy: 30480, fill: palette.softText });
}

function quarterlyDashboardInsightLensXml({ palette }) {
  return arcLineShapeXml({ id: 649, name: "Quarterly Dashboard Content Insight Lens", x: 5791200, y: 2895600, cx: 944880, cy: 944880, stroke: palette.lightBlue, width: 45720 })
    + rectShapeXml({ id: 663, name: "Quarterly Dashboard Content Lens Handle", x: 6537960, y: 3672840, cx: 91440, cy: 426720, fill: "8BB2DB" });
}

function quarterlyDashboardRingXml({ idBase, x, y, value, label, visual }) {
  return solidShapeXml({ id: idBase, name: `Quarterly Dashboard KPI Card ${value}`, geom: "roundRect", x, y, cx: 1066800, cy: 640080, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: idBase + 3, name: `Quarterly Dashboard KPI Card Frame ${value}`, geom: "roundRect", x, y, cx: 1066800, cy: 640080, stroke: "D8E2ED", width: 7620 })
    + rectShapeXml({ id: idBase + 4, name: `Quarterly Dashboard KPI Accent ${value}`, x, y, cx: 53340, cy: 640080, fill: "D7A650" })
    + textShapeXml({ id: idBase + 1, name: `Quarterly Dashboard KPI Value ${value}`, x: x + 152400, y: y + 152400, cx: 762000, cy: 182880, text: value, size: 1280, bold: true, color: "173861" })
    + textShapeXml({ id: idBase + 2, name: `Quarterly Dashboard KPI Label ${value}`, x: x + 152400, y: y + 396240, cx: 762000, cy: 121920, text: label, size: 560, bold: true, color: visual.body });
}

function quarterlyDashboardProductBarsXml({ visual, title }) {
  const bars = [0.42, 0.28, 0.58, 0.34, 0.58, 0.36];
  const barXml = bars.map((ratio, index) => {
    const x = 3718560 + index * 487680;
    const cy = Math.round(883920 * ratio);
    return solidShapeXml({ id: 570 + index, name: `Quarterly Dashboard Product Bar ${index + 1}`, geom: "roundRect", x, y: 2590800 - cy, cx: 213360, cy, fill: index === 3 ? "D7A650" : "173861" });
  }).join("");
  return solidShapeXml({ id: 569, name: "Quarterly Dashboard Product Panel", geom: "roundRect", x: 3352800, y: 1219200, cx: 3505200, cy: 1676400, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 568, name: "Quarterly Dashboard Product Panel Frame", geom: "roundRect", x: 3352800, y: 1219200, cx: 3505200, cy: 1676400, stroke: "D8E2ED", width: 9525 })
    + textShapeXml({ id: 567, name: "Quarterly Dashboard Product Panel Title", x: 3505200, y: 1371600, cx: 2133600, cy: 152400, text: title, size: 640, bold: true, color: visual.title })
    + rectShapeXml({ id: 566, name: "Quarterly Dashboard Product Grid A", x: 3657600, y: 2133600, cx: 2743200, cy: 9525, fill: "EEF3F9" })
    + rectShapeXml({ id: 565, name: "Quarterly Dashboard Product Grid B", x: 3657600, y: 2438400, cx: 2743200, cy: 9525, fill: "EEF3F9" })
    + rectShapeXml({ id: 564, name: "Quarterly Dashboard Product Axis", x: 3657600, y: 2590800, cx: 2743200, cy: 15240, fill: "D8E2ED" })
    + barXml;
}

function quarterlyDashboardClientPanelXml({ visual, title }) {
  const icons = [0, 1, 2, 3, 4, 5].map((item, index) => {
    const row = index < 3 ? 0 : 1;
    const col = index % 3;
    return solidShapeXml({ id: 590 + index, name: `Quarterly Dashboard Client Icon ${index + 1}`, x: 914400 + col * 243840, y: 3749040 + row * 243840, cx: 91440, cy: 198120, fill: row === 0 ? visual.primary : visual.accent });
  }).join("");
  return solidShapeXml({ id: 589, name: "Quarterly Dashboard Client Panel", geom: "roundRect", x: 548640, y: 3444240, cx: 2438400, cy: 914400, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 588, name: "Quarterly Dashboard Client Panel Frame", geom: "roundRect", x: 548640, y: 3444240, cx: 2438400, cy: 914400, stroke: "D8E2ED", width: 9525 })
    + textShapeXml({ id: 587, name: "Quarterly Dashboard Client Title", x: 701040, y: 3573780, cx: 1371600, cy: 152400, text: title, size: 600, bold: true, color: visual.title })
    + icons;
}

function quarterlyDashboardRegionCardsXml({ visual, regions }) {
  const fills = ["173861", "2F64A4", "A95646", "7FA5CF"];
  const cards = regions.map((region, index) => [region.name, region.rate, fills[index] || visual.primary]);
  return cards.map(([name, rate, fill], index) => {
    const x = 7162800;
    const y = 1219200 + index * 487680;
    return solidShapeXml({ id: 610 + index * 3, name: `Quarterly Dashboard Region ${name}`, geom: "roundRect", x, y, cx: 1524000, cy: 365760, fill })
      + textShapeXml({ id: 611 + index * 3, name: `Quarterly Dashboard Region Name ${name}`, x: x + 152400, y: y + 91440, cx: 792480, cy: 137160, text: name, size: 620, bold: true, color: "FFFFFF" })
      + textShapeXml({ id: 612 + index * 3, name: `Quarterly Dashboard Region Rate ${name}`, x: x + 990600, y: y + 76200, cx: 365760, cy: 182880, text: rate, size: 900, bold: true, color: "FFFFFF" });
  }).join("");
}

function quarterlyDashboardComboChartXml({ visual, title }) {
  const bars = [0.38, 0.52, 0.18, 0.76, 0.4, 0.58].map((ratio, index) => {
    const cy = Math.round(853440 * ratio);
    return solidShapeXml({ id: 630 + index, name: `Quarterly Dashboard Combo Bar ${index + 1}`, geom: "roundRect", x: 3505200 + index * 396240, y: 4236720 - cy, cx: 167640, cy, fill: "173861" });
  }).join("");
  return solidShapeXml({ id: 629, name: "Quarterly Dashboard Combo Panel", geom: "roundRect", x: 3200400, y: 3444240, cx: 2743200, cy: 914400, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 628, name: "Quarterly Dashboard Combo Panel Frame", geom: "roundRect", x: 3200400, y: 3444240, cx: 2743200, cy: 914400, stroke: "D8E2ED", width: 9525 })
    + textShapeXml({ id: 627, name: "Quarterly Dashboard Combo Title", x: 3352800, y: 3573780, cx: 1676400, cy: 152400, text: title, size: 600, bold: true, color: visual.title })
    + bars
    + rectShapeXml({ id: 637, name: "Quarterly Dashboard Trend Line", x: 3505200, y: 4053840, cx: 2133600, cy: 19050, fill: "D7A650" });
}

function quarterlyDashboardPieXml({ visual, title }) {
  return solidShapeXml({ id: 640, name: "Quarterly Dashboard Pie Panel", geom: "roundRect", x: 6096000, y: 3444240, cx: 2438400, cy: 914400, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 641, name: "Quarterly Dashboard Pie Panel Frame", geom: "roundRect", x: 6096000, y: 3444240, cx: 2438400, cy: 914400, stroke: "D8E2ED", width: 9525 })
    + solidShapeXml({ id: 642, name: "Quarterly Dashboard Pie Blue", geom: "pie", x: 6324600, y: 3733800, cx: 609600, cy: 457200, fill: "173861" })
    + solidShapeXml({ id: 644, name: "Quarterly Dashboard Pie Accent", geom: "pie", x: 6324600, y: 3733800, cx: 609600, cy: 457200, fill: "D7A650" })
    + textShapeXml({ id: 643, name: "Quarterly Dashboard Pie Title", x: 7162800, y: 3802380, cx: 914400, cy: 182880, text: title, size: 600, bold: true, color: visual.title });
}

function quarterlyDashboardSceneFromSlide(slide, index) {
  const bullets = quarterlyDashboardBulletTexts(slide);
  const title = quarterlyDashboardCompactText(slide?.title, `Page ${index + 1}`, 16);
  const metrics = [0, 1].map((item) => quarterlyDashboardMetricFromText(bullets[item], item));
  const regions = [2, 3, 4, 5].map((bulletIndex, itemIndex) => {
    const metric = quarterlyDashboardMetricFromText(bullets[bulletIndex], itemIndex + 2);
    return { name: metric.label, rate: metric.value };
  });
  return {
    // 装饰层全部从当前页内容派生，避免下载 PPTX 中出现固定示例文字。
    kicker: quarterlyDashboardCompactText(bullets[0], title, 30),
    section: title,
    reportYear: quarterlyDashboardCompactText(bullets[0], title, 24),
    coverCaption: quarterlyDashboardCompactText(bullets.slice(1, 4).join(" / "), title, 28),
    endingTitle: title,
    endingCaption: quarterlyDashboardCompactText(bullets[0], title, 30),
    closingMeta: quarterlyDashboardCompactText(bullets.slice(0, 2).join(" / "), title, 30),
    metrics,
    barTitle: quarterlyDashboardCompactText(bullets[0], title, 18),
    clientTitle: quarterlyDashboardCompactText(bullets[1], title, 18),
    comboTitle: quarterlyDashboardCompactText(bullets[2], title, 18),
    pieTitle: quarterlyDashboardCompactText(bullets[3], title, 12),
    regions,
  };
}

function quarterlyDashboardBulletTexts(slide) {
  return Array.isArray(slide?.bullets)
    ? slide.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
    : [];
}

function quarterlyDashboardMetricFromText(text, index) {
  const fallbackValue = String(index + 1).padStart(2, "0");
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValue, label: `Item ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*%?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValue;
  const label = quarterlyDashboardCompactText(raw.replace(match?.[1] || "", "").replace(/[：:，,。]/g, " ").trim(), raw, 12);
  return { value, label };
}

function quarterlyDashboardCompactText(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function quarterlyDashboardColorPalette(visual) {
  return {
    header: blendHexColor(visual.primary, "FFFFFF", 0.05),
    footer: blendHexColor(visual.primary, "0F172A", 0.34),
    barBlue: blendHexColor(visual.primary, "FFFFFF", 0.20),
    lightBlue: "8BB2DB",
    softText: "C4D8EF",
    frame: "D9E2EE",
  };
}

function budgetPlanningDecorationsXml({ visual, index, role, slide }) {
  const scene = budgetPlanningSceneFromSlide({ slide, index, role });
  const palette = budgetPlanningColorPalette(visual);
  // 背景层和在线预览保持同一套浅青灰财务底色，避免导出后只剩白底。
  const backdrop = rectShapeXml({ id: 550, name: "Budget Planning Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 551, name: "Budget Planning Left Tint Plane", geom: "parallelogram", x: -548640, y: 571500, cx: 2057400, cy: 4572000, fill: palette.tint })
    + solidShapeXml({ id: 552, name: "Budget Planning Soft Accent Circle", geom: "ellipse", x: 7315200, y: 335280, cx: 1828800, cy: 1828800, fill: palette.softAccent })
    + solidShapeXml({ id: 553, name: "Budget Planning Warm Balance Circle", geom: "ellipse", x: 7315200, y: 4038600, cx: 1676400, cy: 1219200, fill: palette.warmWash });
  const surface = solidShapeXml({ id: 560, name: "Budget Planning Workspace", geom: "roundRect", x: 621792, y: 627888, cx: 7900416, cy: 4069080, fill: visual.surface })
    + lineFrameShapeXml({ id: 561, name: "Budget Planning Workspace Border", geom: "roundRect", x: 621792, y: 627888, cx: 7900416, cy: 4069080, stroke: palette.frame, width: 15240 });
  const header = solidShapeXml({ id: 562, name: "Budget Planning Header", x: 0, y: 0, cx: 9144000, cy: 320040, fill: visual.primary })
    + rectShapeXml({ id: 563, name: "Budget Planning Header Accent", x: 0, y: 320040, cx: 9144000, cy: 22860, fill: visual.accent })
    + rectShapeXml({ id: 564, name: "Budget Planning Focus Rule", x: 841248, y: index === 0 ? 2316480 : 2057400, cx: 3291840, cy: 22860, fill: visual.accent })
    + textShapeXml({ id: 565, name: "Budget Planning Kicker", x: 841248, y: 822960, cx: 2133600, cy: 274320, text: scene.kicker, size: 780, bold: true, color: visual.accent });
  const bullets = budgetPlanningBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "flow") return backdrop + surface + header + bullets + budgetPlanningFlowXml({ visual, palette, steps: scene.flowSteps });
  if (scene.role === "table") return backdrop + surface + header + bullets + budgetPlanningTableXml({ visual, palette, rows: scene.tableRows });
  if (scene.role === "allocation") return backdrop + surface + header + bullets + budgetPlanningAllocationXml({ visual, palette, scene });
  if (scene.role === "closing") return backdrop + surface + header + bullets + budgetPlanningClosingCardsXml({ visual, palette, items: scene.bullets });
  return backdrop + surface + header + bullets + budgetPlanningDashboardXml({ visual, palette }) + budgetPlanningMetricCardsXml({ visual, metrics: scene.metrics });
}

function budgetPlanningDashboardXml({ visual, palette }) {
  return solidShapeXml({ id: 570, name: "Budget Planning Dashboard Panel", geom: "roundRect", x: 5780520, y: 1021080, cx: 2926080, cy: 2286000, fill: palette.panel })
    + lineFrameShapeXml({ id: 571, name: "Budget Planning Dashboard Border", geom: "roundRect", x: 5780520, y: 1021080, cx: 2926080, cy: 2286000, stroke: palette.frame, width: 12700 })
    + arcLineShapeXml({ id: 572, name: "Budget Planning Allocation Ring Accent", x: 6096000, y: 1356360, cx: 914400, cy: 914400, stroke: visual.accent, width: 91440 })
    + arcLineShapeXml({ id: 573, name: "Budget Planning Allocation Ring Gold", x: 6096000, y: 1356360, cx: 914400, cy: 914400, stroke: palette.gold, width: 60960 })
    + rectShapeXml({ id: 574, name: "Budget Planning Table Line 1", x: 7306320, y: 1280160, cx: 914400, cy: 38100, fill: visual.primary, transparency: 23000 })
    + rectShapeXml({ id: 575, name: "Budget Planning Table Line 2", x: 7306320, y: 1600200, cx: 1219200, cy: 38100, fill: visual.accent, transparency: 20000 })
    + rectShapeXml({ id: 576, name: "Budget Planning Table Line 3", x: 7306320, y: 1920240, cx: 762000, cy: 38100, fill: palette.gold, transparency: 18000 })
    + rectShapeXml({ id: 577, name: "Budget Planning Table Line 4", x: 7306320, y: 2240280, cx: 1066800, cy: 38100, fill: visual.primary, transparency: 38000 });
}

function budgetPlanningMetricCardsXml({ visual, metrics }) {
  return metrics.map((metric, index) => {
    const x = 841248 + index * 1257300;
    return solidShapeXml({ id: 580 + index * 3, name: `Budget Planning Metric Card ${index + 1}`, geom: "roundRect", x, y: 3723648, cx: 1066800, cy: 579120, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 581 + index * 3, name: `Budget Planning Metric Card Border ${index + 1}`, geom: "roundRect", x, y: 3723648, cx: 1066800, cy: 579120, stroke: blendHexColor(visual.primary, visual.surface, 0.75), width: 10160 })
      + textShapeXml({ id: 582 + index * 3, name: `Budget Planning Metric Text ${index + 1}`, x: x + 137160, y: 3837948, cx: 792480, cy: 274320, text: `${metric.value}\n${metric.label}`, size: 780, bold: true, color: visual.title });
  }).join("");
}

function budgetPlanningBulletCardsXml({ visual, scene, isCover }) {
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = (isCover ? 2621280 : 1828800) + index * 259080;
    return rectShapeXml({ id: 600 + index * 2, name: `Budget Planning Bullet Rule ${index + 1}`, x: 841248, y: y + 30480, cx: 45720, cy: 152400, fill: visual.accent })
      + textShapeXml({ id: 601 + index * 2, name: `Budget Planning Bullet Text ${index + 1}`, x: 1013460, y, cx: 3444240, cy: 198120, text: budgetPlanningCompactText(item, scene.title, 32), size: isCover ? 820 : 720, bold: false, color: visual.body });
  }).join("");
}

function budgetPlanningTableXml({ visual, palette, rows }) {
  const tableX = 853440;
  const tableY = 2606040;
  const rowH = 335280;
  const tableW = 7437120;
  const header = solidShapeXml({ id: 620, name: "Budget Planning Subject Table", geom: "roundRect", x: tableX, y: tableY, cx: tableW, cy: rowH * rows.length, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 621, name: "Budget Planning Subject Table Border", geom: "roundRect", x: tableX, y: tableY, cx: tableW, cy: rowH * rows.length, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 622, name: "Budget Planning Subject Table Header", x: tableX, y: tableY, cx: tableW, cy: rowH, fill: visual.primary });
  const rowXml = rows.map((row, rowIndex) => {
    const y = tableY + rowIndex * rowH;
    const color = rowIndex === 0 ? "FFFFFF" : visual.body;
    const cells = row.map((cell, cellIndex) => textShapeXml({
      id: 630 + rowIndex * 8 + cellIndex,
      name: `Budget Planning Table Cell ${rowIndex + 1}-${cellIndex + 1}`,
      x: tableX + 182880 + cellIndex * 1752600,
      y: y + 76200,
      cx: 1524000,
      cy: 152400,
      text: budgetPlanningCompactText(cell, "", 12),
      size: rowIndex === 0 ? 720 : 660,
      bold: true,
      color,
    })).join("");
    const rule = rowIndex > 0 ? rectShapeXml({ id: 670 + rowIndex, name: `Budget Planning Table Row Rule ${rowIndex}`, x: tableX, y, cx: tableW, cy: 7620, fill: blendHexColor(visual.primary, visual.surface, 0.82) }) : "";
    return rule + cells;
  }).join("");
  return header + rowXml;
}

function budgetPlanningFlowXml({ visual, palette, steps }) {
  return steps.map((step, index) => {
    const x = 853440 + index * 1524000;
    const arrow = index < steps.length - 1 ? rectShapeXml({ id: 710 + index, name: `Budget Planning Flow Connector ${index + 1}`, x: x + 990600, y: 3571248, cx: 365760, cy: 22860, fill: visual.accent }) : "";
    return solidShapeXml({ id: 690 + index * 4, name: `Budget Planning Approval Step ${index + 1}`, geom: "roundRect", x, y: 3190248, cx: 1066800, cy: 762000, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 691 + index * 4, name: `Budget Planning Approval Step Border ${index + 1}`, geom: "roundRect", x, y: 3190248, cx: 1066800, cy: 762000, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 692 + index * 4, name: `Budget Planning Approval Step Dot ${index + 1}`, geom: "ellipse", x: x + 137160, y: 3342648, cx: 213360, cy: 213360, fill: visual.accent })
      + textShapeXml({ id: 693 + index * 4, name: `Budget Planning Approval Step Text ${index + 1}`, x: x + 137160, y: 3655068, cx: 792480, cy: 182880, text: step, size: 700, bold: true, color: visual.title })
      + arrow;
  }).join("");
}

function budgetPlanningAllocationXml({ visual, palette, scene }) {
  const bars = scene.metrics.map((metric, index) => {
    const width = [1676400, 1280160, 1463040][index] || 1066800;
    return rectShapeXml({ id: 730 + index, name: `Budget Planning Department Bar ${index + 1}`, x: 5699760, y: 1432560 + index * 441960, cx: width, cy: 152400, fill: index === 1 ? palette.gold : visual.accent })
      + textShapeXml({ id: 740 + index, name: `Budget Planning Department Label ${index + 1}`, x: 5699760, y: 1219200 + index * 441960, cx: 1828800, cy: 152400, text: metric.label, size: 700, bold: true, color: visual.title });
  }).join("");
  return solidShapeXml({ id: 725, name: "Budget Planning Allocation Panel", geom: "roundRect", x: 5486400, y: 1066800, cx: 3048000, cy: 2438400, fill: palette.panel })
    + lineFrameShapeXml({ id: 726, name: "Budget Planning Allocation Panel Border", geom: "roundRect", x: 5486400, y: 1066800, cx: 3048000, cy: 2438400, stroke: palette.frame, width: 12700 })
    + bars;
}

function budgetPlanningClosingCardsXml({ visual, palette, items }) {
  const values = [items[0] || "明确预算责任", items[1] || "完成审批节奏", items[2] || "建立滚动跟踪"];
  return values.slice(0, 3).map((item, index) => {
    const x = 853440 + index * 2438400;
    return solidShapeXml({ id: 760 + index * 3, name: `Budget Planning Closing Card ${index + 1}`, geom: "roundRect", x, y: 2819400, cx: 2133600, cy: 914400, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 761 + index * 3, name: `Budget Planning Closing Card Border ${index + 1}`, geom: "roundRect", x, y: 2819400, cx: 2133600, cy: 914400, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 762 + index * 3, name: `Budget Planning Closing Card Accent ${index + 1}`, x: x + 152400, y: 2971800, cx: 45720, cy: 457200, fill: visual.accent })
      + textShapeXml({ id: 763 + index * 3, name: `Budget Planning Closing Card Text ${index + 1}`, x: x + 289560, y: 3048000, cx: 1524000, cy: 304800, text: budgetPlanningCompactText(item, "", 24), size: 760, bold: true, color: visual.title });
  }).join("");
}

function budgetPlanningSceneFromSlide({ slide, index, role }) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  const title = budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, 24);
  const resolvedRole = index === 0 ? "cover" : role === "closing" ? "closing" : ["overview", "allocation", "table", "flow"][(index - 1) % 4];
  const metrics = [0, 1, 2].map((itemIndex) => budgetPlanningMetricFromText(bullets[itemIndex], itemIndex));
  return {
    role: resolvedRole,
    kicker: resolvedRole === "cover" ? "FINANCIAL PLAN" : "BUDGET WORKBOOK",
    title,
    bullets: bullets.slice(0, resolvedRole === "cover" ? 3 : 4),
    metrics,
    flowSteps: ["需求提交", "部门初审", "财务复核", "管理审批", "定稿发布"],
    tableRows: [
      ["科目", "预算值", "依据", "负责人"],
      ...[0, 1, 2].map((rowIndex) => {
        const metric = metrics[rowIndex];
        return [metric.label || `预算科目 ${rowIndex + 1}`, metric.value, "业务计划", `部门 ${rowIndex + 1}`];
      }),
    ],
  };
}

function budgetPlanningMetricFromText(text, index) {
  const fallbackValues = ["01", "02", "03"];
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValues[index] || "00", label: `预算项 ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*(?:万|亿|%|元)?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValues[index] || "00";
  const labelSource = match ? raw.replace(match[1], "") : raw;
  const label = budgetPlanningCompactText(labelSource.replace(/[：:，,。]/g, " ").trim(), raw, 10);
  return { value, label };
}

function budgetPlanningCompactText(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function budgetPlanningColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.32),
    tint: blendHexColor(visual.accent, visual.background, 0.86),
    softAccent: blendHexColor(visual.accent, visual.surface, 0.76),
    warmWash: blendHexColor("D6A84F", visual.background, 0.82),
    panel: blendHexColor(visual.background, visual.surface, 0.68),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    gold: "D6A84F",
  };
}

function isBudgetPlanningVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "finance-budget-planning" && (id === "budget-management-report" || id === "finance-budget-management-report-budget-planning");
}

function costBreakdownDecorationsXml({ visual, index, role, slide }) {
  const scene = costBreakdownSceneFromSlide({ slide, index, role });
  const palette = costBreakdownColorPalette(visual);
  // 成本拆解模板全部用可编辑图形表达结构树、瀑布图和责任矩阵，避免下载 PPTX 与在线预览不一致。
  const backdrop = rectShapeXml({ id: 780, name: "Cost Breakdown Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 781, name: "Cost Breakdown Left Plane", geom: "parallelogram", x: -487680, y: 548640, cx: 1981200, cy: 4572000, fill: palette.tint })
    + solidShapeXml({ id: 782, name: "Cost Breakdown Gold Halo", geom: "ellipse", x: 7246620, y: -243840, cx: 2133600, cy: 2133600, fill: palette.goldWash })
    + solidShapeXml({ id: 783, name: "Cost Breakdown Control Halo", geom: "ellipse", x: 7467600, y: 3924300, cx: 1524000, cy: 1066800, fill: palette.controlWash });
  const surface = solidShapeXml({ id: 784, name: "Cost Breakdown Workspace", geom: "roundRect", x: 566928, y: 606552, cx: 8016240, cy: 4107180, fill: visual.surface })
    + lineFrameShapeXml({ id: 785, name: "Cost Breakdown Workspace Border", geom: "roundRect", x: 566928, y: 606552, cx: 8016240, cy: 4107180, stroke: palette.frame, width: 15240 });
  const header = solidShapeXml({ id: 786, name: "Cost Breakdown Header", x: 0, y: 0, cx: 9144000, cy: 304800, fill: visual.primary })
    + rectShapeXml({ id: 787, name: "Cost Breakdown Header Accent", x: 0, y: 304800, cx: 9144000, cy: 22860, fill: visual.accent })
    + rectShapeXml({ id: 788, name: "Cost Breakdown Focus Rule", x: 822960, y: index === 0 ? 2286000 : 2034540, cx: 3200400, cy: 30480, fill: visual.accent })
    + textShapeXml({ id: 789, name: "Cost Breakdown Kicker", x: 822960, y: 807720, cx: 2286000, cy: 274320, text: scene.kicker, size: 780, bold: true, color: visual.accent });
  const bullets = costBreakdownBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "structure") return backdrop + surface + header + bullets + costBreakdownTreeXml({ visual, palette, nodes: scene.treeNodes });
  if (scene.role === "drivers") return backdrop + surface + header + bullets + costBreakdownWaterfallXml({ visual, palette });
  if (scene.role === "roadmap") return backdrop + surface + header + bullets + costBreakdownRoadmapXml({ visual, palette, steps: scene.roadmap });
  if (scene.role === "loop") return backdrop + surface + header + bullets + costBreakdownLoopXml({ visual, palette, steps: scene.loopSteps });
  if (scene.role === "matrix") return backdrop + surface + header + costBreakdownMatrixXml({ visual, palette, rows: scene.matrixRows });
  if (scene.role === "closing") return backdrop + surface + header + bullets + costBreakdownClosingXml({ visual, palette, items: scene.roadmap });
  return backdrop + surface + header + bullets + costBreakdownDashboardXml({ visual, palette }) + costBreakdownMetricCardsXml({ visual, metrics: scene.metrics });
}

function costBreakdownDashboardXml({ visual, palette }) {
  return solidShapeXml({ id: 790, name: "Cost Breakdown Dashboard", geom: "roundRect", x: 5780520, y: 997200, cx: 3048000, cy: 2362200, fill: palette.panel })
    + lineFrameShapeXml({ id: 791, name: "Cost Breakdown Dashboard Border", geom: "roundRect", x: 5780520, y: 997200, cx: 3048000, cy: 2362200, stroke: palette.frame, width: 12700 })
    + arcLineShapeXml({ id: 792, name: "Cost Breakdown Cost Ring Risk", x: 6096000, y: 1325880, cx: 914400, cy: 914400, stroke: visual.warning || "C8553D", width: 91440 })
    + arcLineShapeXml({ id: 793, name: "Cost Breakdown Cost Ring Gold", x: 6096000, y: 1325880, cx: 914400, cy: 914400, stroke: visual.accent, width: 60960 })
    + rectShapeXml({ id: 794, name: "Cost Breakdown Ledger Line 1", x: 7306320, y: 1272540, cx: 990600, cy: 38100, fill: visual.primary, transparency: 24000 })
    + rectShapeXml({ id: 795, name: "Cost Breakdown Ledger Line 2", x: 7306320, y: 1584960, cx: 1219200, cy: 38100, fill: visual.accent, transparency: 17000 })
    + rectShapeXml({ id: 796, name: "Cost Breakdown Ledger Line 3", x: 7306320, y: 1897380, cx: 762000, cy: 38100, fill: visual.secondary || visual.accent, transparency: 18000 })
    + rectShapeXml({ id: 797, name: "Cost Breakdown Ledger Line 4", x: 7306320, y: 2209800, cx: 1066800, cy: 38100, fill: visual.primary, transparency: 38000 });
}

function costBreakdownMetricCardsXml({ visual, metrics }) {
  return metrics.map((metric, index) => {
    const x = 822960 + index * 1257300;
    return solidShapeXml({ id: 800 + index * 3, name: `Cost Breakdown Metric Card ${index + 1}`, geom: "roundRect", x, y: 3716028, cx: 1066800, cy: 579120, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 801 + index * 3, name: `Cost Breakdown Metric Card Border ${index + 1}`, geom: "roundRect", x, y: 3716028, cx: 1066800, cy: 579120, stroke: blendHexColor(visual.primary, visual.surface, 0.76), width: 10160 })
      + textShapeXml({ id: 802 + index * 3, name: `Cost Breakdown Metric Text ${index + 1}`, x: x + 137160, y: 3830328, cx: 792480, cy: 274320, text: `${metric.value}\n${metric.label}`, size: 780, bold: true, color: visual.title });
  }).join("");
}

function costBreakdownBulletCardsXml({ visual, scene, isCover }) {
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = (isCover ? 2590800 : 1798320) + index * 259080;
    return rectShapeXml({ id: 820 + index * 2, name: `Cost Breakdown Bullet Rule ${index + 1}`, x: 822960, y: y + 30480, cx: 45720, cy: 152400, fill: visual.accent })
      + textShapeXml({ id: 821 + index * 2, name: `Cost Breakdown Bullet Text ${index + 1}`, x: 990600, y, cx: 3444240, cy: 198120, text: budgetPlanningCompactText(item, scene.title, 32), size: isCover ? 820 : 720, bold: false, color: visual.body });
  }).join("");
}

function costBreakdownTreeXml({ visual, palette, nodes }) {
  const boxes = [
    { x: 6451600, y: 1158240, text: nodes[0] },
    { x: 5791200, y: 2209800, text: nodes[1] },
    { x: 7315200, y: 2209800, text: nodes[2] },
    { x: 6451600, y: 3261360, text: nodes[3] },
  ];
  const lines = rectShapeXml({ id: 835, name: "Cost Breakdown Tree Spine", x: 7025640, y: 1722120, cx: 30480, cy: 1775460, fill: visual.secondary || visual.accent })
    + rectShapeXml({ id: 836, name: "Cost Breakdown Tree Cross", x: 6250940, y: 2484120, cx: 1554480, cy: 22860, fill: visual.secondary || visual.accent });
  return solidShapeXml({ id: 830, name: "Cost Breakdown Structure Panel", geom: "roundRect", x: 5486400, y: 1066800, cx: 3048000, cy: 2590800, fill: palette.panel })
    + lineFrameShapeXml({ id: 831, name: "Cost Breakdown Structure Border", geom: "roundRect", x: 5486400, y: 1066800, cx: 3048000, cy: 2590800, stroke: palette.frame, width: 12700 })
    + lines
    + boxes.map((box, index) => solidShapeXml({ id: 840 + index * 2, name: `Cost Breakdown Tree Node ${index + 1}`, geom: "roundRect", x: box.x, y: box.y, cx: 1143000, cy: 411480, fill: "FFFFFF" })
      + textShapeXml({ id: 841 + index * 2, name: `Cost Breakdown Tree Text ${index + 1}`, x: box.x + 91440, y: box.y + 106680, cx: 960120, cy: 152400, text: box.text, size: 720, bold: true, color: visual.title })).join("");
}

function costBreakdownWaterfallXml({ visual, palette }) {
  const heights = [1371600, 914400, 701040, 518160, 1097280];
  const colors = [visual.primary, visual.warning || "C8553D", visual.accent, visual.secondary || visual.accent, visual.primary];
  const bars = heights.map((height, index) => {
    const x = 5699760 + index * 548640;
    return rectShapeXml({ id: 870 + index, name: `Cost Breakdown Driver Bar ${index + 1}`, x, y: 3284220 - height, cx: 365760, cy: height, fill: colors[index] });
  }).join("");
  return solidShapeXml({ id: 865, name: "Cost Breakdown Waterfall Panel", geom: "roundRect", x: 5486400, y: 1112520, cx: 3048000, cy: 2514600, fill: palette.panel })
    + lineFrameShapeXml({ id: 866, name: "Cost Breakdown Waterfall Border", geom: "roundRect", x: 5486400, y: 1112520, cx: 3048000, cy: 2514600, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 867, name: "Cost Breakdown Waterfall Baseline", x: 5699760, y: 3284220, cx: 2499360, cy: 22860, fill: palette.frame })
    + bars;
}

function costBreakdownRoadmapXml({ visual, palette, steps }) {
  return steps.slice(0, 4).map((step, index) => {
    const x = 853440 + index * 1905000;
    const connector = index < 3 ? rectShapeXml({ id: 900 + index, name: `Cost Breakdown Roadmap Connector ${index + 1}`, x: x + 1257300, y: 3642360, cx: 457200, cy: 22860, fill: visual.accent }) : "";
    return solidShapeXml({ id: 885 + index * 4, name: `Cost Breakdown Roadmap Step ${index + 1}`, geom: "roundRect", x, y: 3220728, cx: 1371600, cy: 822960, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 886 + index * 4, name: `Cost Breakdown Roadmap Border ${index + 1}`, geom: "roundRect", x, y: 3220728, cx: 1371600, cy: 822960, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 887 + index * 4, name: `Cost Breakdown Roadmap Dot ${index + 1}`, geom: "ellipse", x: x + 137160, y: 3373128, cx: 213360, cy: 213360, fill: visual.accent })
      + textShapeXml({ id: 888 + index * 4, name: `Cost Breakdown Roadmap Text ${index + 1}`, x: x + 411480, y: 3380748, cx: 792480, cy: 304800, text: budgetPlanningCompactText(step, "", 14), size: 700, bold: true, color: visual.title })
      + connector;
  }).join("");
}

function costBreakdownLoopXml({ visual, palette, steps }) {
  const nodes = [
    { x: 6705600, y: 1234440 },
    { x: 7543800, y: 2194560 },
    { x: 6705600, y: 3154680 },
    { x: 5867400, y: 2194560 },
  ];
  return solidShapeXml({ id: 930, name: "Cost Breakdown Control Loop Panel", geom: "roundRect", x: 5486400, y: 1112520, cx: 3048000, cy: 2590800, fill: palette.panel })
    + lineFrameShapeXml({ id: 931, name: "Cost Breakdown Control Loop Border", geom: "roundRect", x: 5486400, y: 1112520, cx: 3048000, cy: 2590800, stroke: palette.frame, width: 12700 })
    + arcLineShapeXml({ id: 932, name: "Cost Breakdown Loop Arc", x: 6250940, y: 1600200, cx: 1524000, cy: 1524000, stroke: visual.secondary || visual.accent, width: 60960 })
    + nodes.map((node, index) => solidShapeXml({ id: 935 + index * 2, name: `Cost Breakdown Loop Node ${index + 1}`, geom: "roundRect", x: node.x, y: node.y, cx: 762000, cy: 365760, fill: "FFFFFF" })
      + textShapeXml({ id: 936 + index * 2, name: `Cost Breakdown Loop Text ${index + 1}`, x: node.x + 76200, y: node.y + 91440, cx: 609600, cy: 137160, text: steps[index], size: 680, bold: true, color: visual.title })).join("");
}

function costBreakdownMatrixXml({ visual, palette, rows }) {
  const tableX = 822960;
  const tableY = 2506980;
  const rowH = 335280;
  const tableW = 7467600;
  const shell = solidShapeXml({ id: 960, name: "Cost Breakdown Responsibility Matrix", geom: "roundRect", x: tableX, y: tableY, cx: tableW, cy: rowH * rows.length, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 961, name: "Cost Breakdown Responsibility Matrix Border", geom: "roundRect", x: tableX, y: tableY, cx: tableW, cy: rowH * rows.length, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 962, name: "Cost Breakdown Responsibility Matrix Header", x: tableX, y: tableY, cx: tableW, cy: rowH, fill: visual.primary });
  const cells = rows.map((row, rowIndex) => {
    const y = tableY + rowIndex * rowH;
    const color = rowIndex === 0 ? "FFFFFF" : visual.body;
    const rule = rowIndex > 0 ? rectShapeXml({ id: 970 + rowIndex, name: `Cost Breakdown Matrix Row Rule ${rowIndex}`, x: tableX, y, cx: tableW, cy: 7620, fill: blendHexColor(visual.primary, visual.surface, 0.82) }) : "";
    return rule + row.map((cell, cellIndex) => textShapeXml({
      id: 980 + rowIndex * 8 + cellIndex,
      name: `Cost Breakdown Matrix Cell ${rowIndex + 1}-${cellIndex + 1}`,
      x: tableX + 182880 + cellIndex * 1752600,
      y: y + 76200,
      cx: 1524000,
      cy: 152400,
      text: budgetPlanningCompactText(cell, "", 12),
      size: rowIndex === 0 ? 720 : 660,
      bold: true,
      color,
    })).join("");
  }).join("");
  return shell + cells;
}

function costBreakdownClosingXml({ visual, palette, items }) {
  const values = [items[0] || "明确成本责任", items[1] || "固化费用管控", items[2] || "持续追踪收益"];
  return values.slice(0, 3).map((item, index) => {
    const x = 853440 + index * 2438400;
    return solidShapeXml({ id: 1020 + index * 3, name: `Cost Breakdown Closing Card ${index + 1}`, geom: "roundRect", x, y: 2819400, cx: 2133600, cy: 914400, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1021 + index * 3, name: `Cost Breakdown Closing Card Border ${index + 1}`, geom: "roundRect", x, y: 2819400, cx: 2133600, cy: 914400, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1022 + index * 3, name: `Cost Breakdown Closing Card Accent ${index + 1}`, x: x + 152400, y: 2971800, cx: 45720, cy: 457200, fill: visual.accent })
      + textShapeXml({ id: 1023 + index * 3, name: `Cost Breakdown Closing Card Text ${index + 1}`, x: x + 289560, y: 3048000, cx: 1524000, cy: 304800, text: budgetPlanningCompactText(item, "", 24), size: 760, bold: true, color: visual.title });
  }).join("");
}

function costBreakdownSceneFromSlide({ slide, index, role }) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  const title = budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, 26);
  const resolvedRole = costBreakdownRoleFromSlide({ slide, index, role });
  const metrics = [0, 1, 2].map((itemIndex) => costBreakdownMetricFromText(bullets[itemIndex], itemIndex));
  return {
    role: resolvedRole,
    kicker: resolvedRole === "cover" ? "COST CONTROL" : "COST BREAKDOWN",
    title,
    bullets: bullets.slice(0, resolvedRole === "cover" ? 3 : 4),
    metrics,
    treeNodes: ["总成本", "固定成本", "变动成本", "可优化项"],
    roadmap: [
      budgetPlanningCompactText(bullets[0], "识别成本池", 14),
      budgetPlanningCompactText(bullets[1], "锁定驱动因子", 14),
      budgetPlanningCompactText(bullets[2], "制定降本动作", 14),
      budgetPlanningCompactText(bullets[3], "复盘节约收益", 14),
    ],
    loopSteps: ["预算", "审批", "执行", "复盘"],
    matrixRows: [
      ["事项", "Owner", "目标", "节奏"],
      ...[0, 1, 2].map((rowIndex) => {
        const metric = metrics[rowIndex];
        return [budgetPlanningCompactText(bullets[rowIndex], `成本项 ${rowIndex + 1}`, 12), ["财务", "业务", "采购"][rowIndex], metric.value, ["周", "月", "季"][rowIndex]];
      }),
    ],
  };
}

function costBreakdownRoleFromSlide({ slide, index, role }) {
  const layout = String(slide?.layout || "").toLowerCase();
  // 导出时同样优先使用页面布局语义，保证和 HTML 在线预览的成本拆解场景一致。
  if (index === 0 || layout.includes("cover")) return "cover";
  if (role === "closing" || layout.includes("closing")) return "closing";
  if (layout.includes("responsibility") || layout.includes("matrix")) return "matrix";
  if (layout.includes("roadmap") || layout.includes("saving")) return "roadmap";
  if (layout.includes("driver") || layout.includes("analysis")) return "drivers";
  if (layout.includes("loop") || layout.includes("control")) return "loop";
  if (layout.includes("structure") || layout.includes("overview")) return "structure";
  return ["structure", "drivers", "roadmap", "loop", "matrix"][(index - 1) % 5];
}

function costBreakdownMetricFromText(text, index) {
  const fallbackValues = ["18%", "￥2.4M", "12周"];
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValues[index] || "00", label: ["成本压降", "节约空间", "治理周期"][index] || `指标 ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*(?:万|亿|%|元|M|m|周|月)?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValues[index] || "00";
  const labelSource = match ? raw.replace(match[1], "") : raw;
  return { value, label: budgetPlanningCompactText(labelSource.replace(/[：:，,。]/g, " ").trim(), raw, 10) };
}

function costBreakdownColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.30),
    tint: blendHexColor(visual.primary, visual.background, 0.88),
    goldWash: blendHexColor(visual.accent, visual.background, 0.80),
    controlWash: blendHexColor(visual.secondary || visual.accent, visual.background, 0.84),
    panel: blendHexColor(visual.background, visual.surface, 0.68),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
  };
}

function isCostBreakdownVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "finance-cost-breakdown" && (id === "cost-control-plan" || id === "finance-cost-control-plan-cost-breakdown");
}

function budgetVarianceDecorationsXml({ visual, index, role, slide }) {
  const scene = budgetVarianceSceneFromSlide({ slide, index, role });
  const palette = budgetVarianceColorPalette(visual);
  // 执行偏差模板用可编辑图形模拟预算表、偏差瀑布图和纠偏看板，不使用整页背景图。
  const backdrop = rectShapeXml({ id: 880, name: "Budget Variance Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 881, name: "Budget Variance Warning Plane", geom: "parallelogram", x: -502920, y: 533400, cx: 2011680, cy: 4602480, fill: palette.tint })
    + solidShapeXml({ id: 882, name: "Budget Variance Risk Glow", geom: "ellipse", x: 7246620, y: 365760, cx: 1828800, cy: 1676400, fill: palette.riskWash })
    + solidShapeXml({ id: 883, name: "Budget Variance Positive Glow", geom: "ellipse", x: 7246620, y: 3977640, cx: 1676400, cy: 1219200, fill: palette.positiveWash });
  const surface = solidShapeXml({ id: 884, name: "Budget Variance Workspace", geom: "roundRect", x: 566928, y: 591312, cx: 8001000, cy: 4145280, fill: visual.surface })
    + lineFrameShapeXml({ id: 885, name: "Budget Variance Workspace Border", geom: "roundRect", x: 566928, y: 591312, cx: 8001000, cy: 4145280, stroke: palette.frame, width: 15240 });
  const header = solidShapeXml({ id: 886, name: "Budget Variance Header", x: 0, y: 0, cx: 9144000, cy: 320040, fill: visual.primary })
    + rectShapeXml({ id: 887, name: "Budget Variance Header Accent", x: 0, y: 320040, cx: 9144000, cy: 22860, fill: visual.accent })
    + textShapeXml({ id: 888, name: "Budget Variance Kicker", x: 804672, y: 792480, cx: 2286000, cy: 274320, text: scene.kicker, size: 780, bold: true, color: visual.accent })
    + rectShapeXml({ id: 889, name: "Budget Variance Focus Rule", x: 804672, y: index === 0 ? 2232660 : 2011680, cx: 3108960, cy: 30480, fill: visual.accent })
    + rectShapeXml({ id: 890, name: "Budget Variance Warning Rule", x: 804672, y: (index === 0 ? 2232660 : 2011680) + 45720, cx: 1676400, cy: 15240, fill: palette.warning });
  const bullets = budgetVarianceBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "comparison") return backdrop + surface + header + bullets + budgetVarianceWaterfallXml({ visual, palette });
  if (scene.role === "analysis") return backdrop + surface + header + bullets + budgetVarianceReasonCardsXml({ visual, palette, items: scene.reasons });
  if (scene.role === "correction") return backdrop + surface + header + bullets + budgetVarianceActionCardsXml({ visual, palette, steps: scene.actions });
  if (scene.role === "loop") return backdrop + surface + header + bullets + budgetVarianceLoopXml({ visual, palette, steps: scene.actions });
  return backdrop + surface + header + bullets + budgetVarianceLedgerXml({ visual, palette }) + budgetVarianceMetricCardsXml({ visual, metrics: scene.metrics, palette });
}

function budgetVarianceLedgerXml({ visual, palette }) {
  return solidShapeXml({ id: 900, name: "Budget Variance Ledger Panel", geom: "roundRect", x: 5638800, y: 975360, cx: 3169920, cy: 2514600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 901, name: "Budget Variance Ledger Panel Border", geom: "roundRect", x: 5638800, y: 975360, cx: 3169920, cy: 2514600, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 902, name: "Budget Variance Ledger Header", x: 5638800, y: 975360, cx: 3169920, cy: 381000, fill: visual.primary })
    + rectShapeXml({ id: 903, name: "Budget Variance Budget Row", x: 5943600, y: 1623060, cx: 1981200, cy: 121920, fill: blendHexColor(visual.primary, visual.surface, 0.72) })
    + rectShapeXml({ id: 904, name: "Budget Variance Actual Row", x: 5943600, y: 2026920, cx: 1432560, cy: 121920, fill: visual.accent })
    + rectShapeXml({ id: 905, name: "Budget Variance Warning Row", x: 5943600, y: 2430780, cx: 1737360, cy: 121920, fill: palette.warning })
    + rectShapeXml({ id: 906, name: "Budget Variance Saved Row", x: 5943600, y: 2834640, cx: 1219200, cy: 121920, fill: palette.positive })
    + arcLineShapeXml({ id: 907, name: "Budget Variance Gauge Ring", x: 7528560, y: 2377440, cx: 792480, cy: 792480, stroke: visual.accent, width: 76200 });
}

function budgetVarianceMetricCardsXml({ visual, metrics, palette }) {
  return metrics.map((metric, index) => {
    const x = 804672 + index * 1257300;
    const color = [visual.accent, palette.warning, palette.positive][index] || visual.accent;
    return solidShapeXml({ id: 920 + index * 4, name: `Budget Variance Metric Card ${index + 1}`, geom: "roundRect", x, y: 3723648, cx: 1066800, cy: 609600, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 921 + index * 4, name: `Budget Variance Metric Card Border ${index + 1}`, geom: "roundRect", x, y: 3723648, cx: 1066800, cy: 609600, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 922 + index * 4, name: `Budget Variance Metric Card Accent ${index + 1}`, x, y: 3723648, cx: 1066800, cy: 45720, fill: color })
      + textShapeXml({ id: 923 + index * 4, name: `Budget Variance Metric Text ${index + 1}`, x: x + 137160, y: 3853188, cx: 792480, cy: 274320, text: `${metric.value}\n${metric.label}`, size: 760, bold: true, color: visual.title });
  }).join("");
}

function budgetVarianceBulletCardsXml({ visual, scene, isCover }) {
  return scene.bullets.slice(0, isCover ? 3 : 4).map((item, index) => {
    const y = (isCover ? 2560320 : 1767840) + index * 259080;
    const color = index === 1 ? "F6B84B" : index === 2 ? "2FA879" : visual.accent;
    return rectShapeXml({ id: 940 + index * 2, name: `Budget Variance Bullet Rule ${index + 1}`, x: 804672, y: y + 30480, cx: 45720, cy: 152400, fill: color })
      + textShapeXml({ id: 941 + index * 2, name: `Budget Variance Bullet Text ${index + 1}`, x: 972312, y, cx: 3352800, cy: 198120, text: budgetPlanningCompactText(item, scene.title, 32), size: isCover ? 820 : 720, bold: false, color: visual.body });
  }).join("");
}

function budgetVarianceWaterfallXml({ visual, palette }) {
  const bars = [
    { x: 5943600, h: 426720, c: palette.positive, n: "Saved" },
    { x: 6400800, h: 701040, c: palette.warning, n: "Warning" },
    { x: 6858000, h: 335280, c: visual.accent, n: "Overrun" },
    { x: 7315200, h: 853440, c: palette.warning, n: "Pending" },
    { x: 7772400, h: 518160, c: visual.accent, n: "Risk" },
  ].map((bar, index) => rectShapeXml({ id: 960 + index, name: `Budget Variance Waterfall ${bar.n}`, x: bar.x, y: 3048000 - bar.h, cx: 335280, cy: bar.h, fill: bar.c })).join("");
  return solidShapeXml({ id: 955, name: "Budget Variance Waterfall Panel", geom: "roundRect", x: 5486400, y: 1066800, cx: 3352800, cy: 2743200, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 956, name: "Budget Variance Waterfall Border", geom: "roundRect", x: 5486400, y: 1066800, cx: 3352800, cy: 2743200, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 957, name: "Budget Variance Waterfall Axis", x: 5791200, y: 3048000, cx: 2590800, cy: 22860, fill: blendHexColor(visual.primary, visual.surface, 0.55) })
    + bars;
}

function budgetVarianceReasonCardsXml({ visual, palette, items }) {
  const trend = solidShapeXml({ id: 980, name: "Budget Variance Trend Panel", geom: "roundRect", x: 5486400, y: 1066800, cx: 1447800, cy: 2286000, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 981, name: "Budget Variance Trend Border", geom: "roundRect", x: 5486400, y: 1066800, cx: 1447800, cy: 2286000, stroke: palette.frame, width: 10160 })
    + arcLineShapeXml({ id: 982, name: "Budget Variance Trend Curve", x: 5730240, y: 1661160, cx: 944880, cy: 944880, stroke: visual.accent, width: 76200 });
  const cards = items.slice(0, 3).map((item, index) => {
    const y = 1066800 + index * 731520;
    const color = [visual.accent, palette.warning, palette.positive][index] || visual.accent;
    return solidShapeXml({ id: 990 + index * 4, name: `Budget Variance Reason Card ${index + 1}`, geom: "roundRect", x: 7162800, y, cx: 1524000, cy: 548640, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 991 + index * 4, name: `Budget Variance Reason Border ${index + 1}`, geom: "roundRect", x: 7162800, y, cx: 1524000, cy: 548640, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 992 + index * 4, name: `Budget Variance Reason Accent ${index + 1}`, x: 7162800, y, cx: 76200, cy: 548640, fill: color })
      + textShapeXml({ id: 993 + index * 4, name: `Budget Variance Reason Text ${index + 1}`, x: 7330440, y: y + 182880, cx: 1066800, cy: 182880, text: budgetPlanningCompactText(item, "", 12), size: 720, bold: true, color: visual.title });
  }).join("");
  return trend + cards;
}

function budgetVarianceActionCardsXml({ visual, palette, steps }) {
  return steps.map((step, index) => {
    const x = 804672 + index * 1905000;
    return solidShapeXml({ id: 1020 + index * 4, name: `Budget Variance Action Card ${index + 1}`, geom: "roundRect", x, y: 3190248, cx: 1524000, cy: 822960, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1021 + index * 4, name: `Budget Variance Action Border ${index + 1}`, geom: "roundRect", x, y: 3190248, cx: 1524000, cy: 822960, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1022 + index * 4, name: `Budget Variance Action Dot ${index + 1}`, geom: "ellipse", x: x + 152400, y: 3352800, cx: 228600, cy: 228600, fill: index === 1 ? palette.warning : index === 2 ? palette.positive : visual.accent })
      + textShapeXml({ id: 1023 + index * 4, name: `Budget Variance Action Text ${index + 1}`, x: x + 152400, y: 3695700, cx: 1066800, cy: 182880, text: step, size: 700, bold: true, color: visual.title });
  }).join("");
}

function budgetVarianceLoopXml({ visual, palette, steps }) {
  const nodes = steps.map((step, index) => {
    const x = 5486400 + index * 853440;
    const color = [visual.accent, palette.warning, palette.positive, visual.primary][index] || visual.accent;
    return solidShapeXml({ id: 1050 + index * 3, name: `Budget Variance Loop Node ${index + 1}`, geom: "ellipse", x, y: 1798320, cx: 365760, cy: 365760, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1051 + index * 3, name: `Budget Variance Loop Node Border ${index + 1}`, geom: "ellipse", x, y: 1798320, cx: 365760, cy: 365760, stroke: color, width: 60960 })
      + textShapeXml({ id: 1052 + index * 3, name: `Budget Variance Loop Label ${index + 1}`, x: x - 152400, y: 2293620, cx: 670560, cy: 152400, text: budgetPlanningCompactText(step, "", 6), size: 620, bold: true, color: visual.title });
  }).join("");
  return rectShapeXml({ id: 1049, name: "Budget Variance Loop Rail", x: 5486400, y: 1981200, cx: 2926080, cy: 45720, fill: palette.warning }) + nodes + budgetVarianceActionCardsXml({ visual, palette, steps });
}

function budgetVarianceSceneFromSlide({ slide, index, role }) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  const title = budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, 24);
  const resolvedRole = index === 0 ? "cover" : role === "closing" ? "loop" : ["overview", "comparison", "analysis", "correction"][(index - 1) % 4];
  const metrics = [0, 1, 2].map((itemIndex) => budgetVarianceMetricFromText(bullets[itemIndex], itemIndex));
  return {
    role: resolvedRole,
    kicker: resolvedRole === "cover" ? "BUDGET REVIEW" : "VARIANCE BOARD",
    title,
    bullets: bullets.slice(0, resolvedRole === "cover" ? 3 : 4),
    metrics,
    reasons: [
      budgetPlanningCompactText(bullets[0], "关键洞察", 12),
      budgetPlanningCompactText(bullets[1], "原因拆解", 12),
      budgetPlanningCompactText(bullets[2], "策略判断", 12),
    ],
    actions: ["确认口径", "锁定责任", "调整节奏", "复盘闭环"],
  };
}

function budgetVarianceMetricFromText(text, index) {
  const fallbackValues = ["86%", "12.8", "+24%"];
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValues[index] || "00", label: ["预算达成", "偏差金额", "纠偏进度"][index] || `指标 ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*(?:万|亿|%|元|天)?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValues[index] || "00";
  const labelSource = match ? raw.replace(match[1], "") : raw;
  return { value, label: budgetPlanningCompactText(labelSource.replace(/[：:，,。]/g, " ").trim(), raw, 10) };
}

function budgetVarianceColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.30),
    tint: blendHexColor(visual.primary, visual.background, 0.90),
    riskWash: blendHexColor(visual.accent, visual.background, 0.86),
    positiveWash: blendHexColor(visual.positive || "2FA879", visual.background, 0.88),
    panel: blendHexColor(visual.background, visual.surface, 0.64),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    warning: visual.warning || "F6B84B",
    positive: visual.positive || "2FA879",
  };
}

function isBudgetVarianceVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "finance-budget-variance" && (id === "budget-management-report" || id === "finance-budget-management-report-execution-variance");
}

function budgetAdjustmentDecorationsXml({ visual, index, role, slide }) {
  const scene = budgetAdjustmentSceneFromSlide({ slide, index, role });
  const palette = budgetAdjustmentColorPalette(visual);
  // 预算调整模板用代码绘制财务表格底纹、决策工作台和预算重配图形，保证 PPTX 下载后仍可编辑。
  const backdrop = rectShapeXml({ id: 900, name: "Budget Adjustment Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 901, name: "Budget Adjustment Left Decision Plane", geom: "parallelogram", x: -548640, y: 548640, cx: 2072640, cy: 4587240, fill: palette.tint })
    + solidShapeXml({ id: 902, name: "Budget Adjustment Warm Decision Glow", geom: "ellipse", x: 7208520, y: 274320, cx: 1905000, cy: 1828800, fill: palette.warmWash })
    + solidShapeXml({ id: 903, name: "Budget Adjustment Impact Glow", geom: "ellipse", x: 7246620, y: 3977640, cx: 1676400, cy: 1219200, fill: palette.tealWash });
  const surface = solidShapeXml({ id: 904, name: "Budget Adjustment Workspace", geom: "roundRect", x: 585216, y: 617220, cx: 7979664, cy: 4099560, fill: visual.surface })
    + lineFrameShapeXml({ id: 905, name: "Budget Adjustment Workspace Border", geom: "roundRect", x: 585216, y: 617220, cx: 7979664, cy: 4099560, stroke: palette.frame, width: 15240 });
  const header = solidShapeXml({ id: 906, name: "Budget Adjustment Header", x: 0, y: 0, cx: 9144000, cy: 335280, fill: visual.primary })
    + rectShapeXml({ id: 907, name: "Budget Adjustment Header Accent", x: 0, y: 335280, cx: 9144000, cy: 22860, fill: visual.accent })
    + textShapeXml({ id: 908, name: "Budget Adjustment Kicker", x: 822960, y: 807720, cx: 2286000, cy: 274320, text: scene.kicker, size: 780, bold: true, color: visual.accent })
    + rectShapeXml({ id: 909, name: "Budget Adjustment Focus Rule", x: 822960, y: index === 0 ? 2263140 : 2034540, cx: 3200400, cy: 30480, fill: visual.accent })
    + rectShapeXml({ id: 910, name: "Budget Adjustment Secondary Focus Rule", x: 822960, y: (index === 0 ? 2263140 : 2034540) + 45720, cx: 1828800, cy: 15240, fill: palette.secondary });
  const bullets = budgetAdjustmentBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "approval") return backdrop + surface + header + bullets + budgetAdjustmentApprovalXml({ visual, palette, steps: scene.approvalSteps });
  if (scene.role === "analysis") return backdrop + surface + header + bullets + budgetAdjustmentBridgeXml({ visual, palette, items: scene.bridge });
  if (scene.role === "reallocation") return backdrop + surface + header + bullets + budgetAdjustmentReallocationXml({ visual, palette, scene });
  if (scene.role === "impact") return backdrop + surface + header + bullets + budgetAdjustmentImpactXml({ visual, palette, items: scene.impacts });
  if (scene.role === "closing") return backdrop + surface + header + bullets + budgetAdjustmentClosingXml({ visual, palette, items: scene.bullets });
  return backdrop + surface + header + bullets + budgetAdjustmentDashboardXml({ visual, palette }) + budgetAdjustmentMetricCardsXml({ visual, metrics: scene.metrics, palette });
}

function budgetAdjustmentDashboardXml({ visual, palette }) {
  return solidShapeXml({ id: 920, name: "Budget Adjustment Decision Panel", geom: "roundRect", x: 5699760, y: 990600, cx: 3048000, cy: 2438400, fill: palette.panel })
    + lineFrameShapeXml({ id: 921, name: "Budget Adjustment Decision Panel Border", geom: "roundRect", x: 5699760, y: 990600, cx: 3048000, cy: 2438400, stroke: palette.frame, width: 12700 })
    + arcLineShapeXml({ id: 922, name: "Budget Adjustment Reallocation Ring Teal", x: 6050280, y: 1333500, cx: 990600, cy: 990600, stroke: palette.secondary, width: 99060 })
    + arcLineShapeXml({ id: 923, name: "Budget Adjustment Reallocation Ring Orange", x: 6050280, y: 1333500, cx: 990600, cy: 990600, stroke: visual.accent, width: 60960 })
    + solidShapeXml({ id: 924, name: "Budget Adjustment Arrow Body", geom: "parallelogram", x: 7315200, y: 1691640, cx: 822960, cy: 365760, fill: visual.accent })
    + solidShapeXml({ id: 925, name: "Budget Adjustment Arrow Head", geom: "triangle", x: 8077200, y: 1623060, cx: 365760, cy: 502920, fill: visual.accent })
    + solidShapeXml({ id: 926, name: "Budget Adjustment Approval Badge", geom: "roundRect", x: 7315200, y: 2514600, cx: 944880, cy: 228600, fill: visual.primary })
    + textShapeXml({ id: 927, name: "Budget Adjustment Approval Badge Text", x: 7482840, y: 2560320, cx: 609600, cy: 121920, text: "审批中", size: 660, bold: true, color: "FFFFFF" });
}

function budgetAdjustmentMetricCardsXml({ visual, metrics, palette }) {
  return metrics.map((metric, index) => {
    const x = 822960 + index * 1257300;
    const color = [palette.secondary, visual.accent, palette.risk][index] || visual.accent;
    return solidShapeXml({ id: 930 + index * 4, name: `Budget Adjustment Metric Card ${index + 1}`, geom: "roundRect", x, y: 3723648, cx: 1066800, cy: 609600, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 931 + index * 4, name: `Budget Adjustment Metric Card Border ${index + 1}`, geom: "roundRect", x, y: 3723648, cx: 1066800, cy: 609600, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 932 + index * 4, name: `Budget Adjustment Metric Card Accent ${index + 1}`, x, y: 3723648, cx: 60960, cy: 609600, fill: color })
      + textShapeXml({ id: 933 + index * 4, name: `Budget Adjustment Metric Text ${index + 1}`, x: x + 167640, y: 3853188, cx: 762000, cy: 274320, text: `${metric.value}\n${metric.label}`, size: 760, bold: true, color: visual.title });
  }).join("");
}

function budgetAdjustmentBulletCardsXml({ visual, scene, isCover }) {
  return scene.bullets.slice(0, isCover ? 3 : 4).map((item, index) => {
    const y = (isCover ? 2590800 : 1798320) + index * 259080;
    return rectShapeXml({ id: 950 + index * 2, name: `Budget Adjustment Bullet Rule ${index + 1}`, x: 822960, y: y + 30480, cx: 45720, cy: 152400, fill: index === 1 ? "14B8A6" : visual.accent })
      + textShapeXml({ id: 951 + index * 2, name: `Budget Adjustment Bullet Text ${index + 1}`, x: 990600, y, cx: 3444240, cy: 198120, text: budgetPlanningCompactText(item, scene.title, 32), size: isCover ? 820 : 720, bold: false, color: visual.body });
  }).join("");
}

function budgetAdjustmentReallocationXml({ visual, palette, scene }) {
  const bars = scene.metrics.map((metric, index) => {
    const width = [1767840, 1257300, 1539240][index] || 1066800;
    const color = [palette.secondary, visual.accent, palette.risk][index] || visual.accent;
    return rectShapeXml({ id: 970 + index, name: `Budget Adjustment Reallocation Bar ${index + 1}`, x: 5928360, y: 1424940 + index * 472440, cx: width, cy: 182880, fill: color })
      + textShapeXml({ id: 980 + index, name: `Budget Adjustment Reallocation Label ${index + 1}`, x: 5928360, y: 1196340 + index * 472440, cx: 1905000, cy: 152400, text: metric.label, size: 700, bold: true, color: visual.title });
  }).join("");
  return solidShapeXml({ id: 965, name: "Budget Adjustment Reallocation Panel", geom: "roundRect", x: 5638800, y: 1036320, cx: 3169920, cy: 2590800, fill: palette.panel })
    + lineFrameShapeXml({ id: 966, name: "Budget Adjustment Reallocation Panel Border", geom: "roundRect", x: 5638800, y: 1036320, cx: 3169920, cy: 2590800, stroke: palette.frame, width: 12700 })
    + bars;
}

function budgetAdjustmentBridgeXml({ visual, palette, items }) {
  const labels = [items[0] || "原预算基线", items[1] || "偏差原因", items[2] || "调整后方案"];
  return solidShapeXml({ id: 1000, name: "Budget Adjustment Before Card", geom: "roundRect", x: 5486400, y: 1371600, cx: 1127760, cy: 1219200, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1001, name: "Budget Adjustment Before Card Border", geom: "roundRect", x: 5486400, y: 1371600, cx: 1127760, cy: 1219200, stroke: palette.frame, width: 10160 })
    + textShapeXml({ id: 1002, name: "Budget Adjustment Before Text", x: 5669280, y: 1798320, cx: 762000, cy: 304800, text: budgetPlanningCompactText(labels[0], "", 14), size: 720, bold: true, color: visual.title })
    + solidShapeXml({ id: 1003, name: "Budget Adjustment Cause Bridge", geom: "parallelogram", x: 6797040, y: 1798320, cx: 792480, cy: 426720, fill: visual.accent })
    + textShapeXml({ id: 1004, name: "Budget Adjustment Cause Text", x: 6896100, y: 1935480, cx: 548640, cy: 152400, text: budgetPlanningCompactText(labels[1], "偏差原因", 8), size: 620, bold: true, color: "FFFFFF" })
    + solidShapeXml({ id: 1005, name: "Budget Adjustment After Card", geom: "roundRect", x: 7772400, y: 1371600, cx: 1127760, cy: 1219200, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1006, name: "Budget Adjustment After Card Border", geom: "roundRect", x: 7772400, y: 1371600, cx: 1127760, cy: 1219200, stroke: palette.frame, width: 10160 })
    + textShapeXml({ id: 1007, name: "Budget Adjustment After Text", x: 7955280, y: 1798320, cx: 762000, cy: 304800, text: budgetPlanningCompactText(labels[2], "", 14), size: 720, bold: true, color: visual.title });
}

function budgetAdjustmentApprovalXml({ visual, palette, steps }) {
  return steps.map((step, index) => {
    const x = 792480 + index * 1554480;
    const arrow = index < steps.length - 1 ? rectShapeXml({ id: 1030 + index, name: `Budget Adjustment Approval Connector ${index + 1}`, x: x + 1066800, y: 3571248, cx: 365760, cy: 22860, fill: visual.primary }) : "";
    return solidShapeXml({ id: 1010 + index * 4, name: `Budget Adjustment Approval Step ${index + 1}`, geom: "roundRect", x, y: 3169920, cx: 1127760, cy: 792480, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1011 + index * 4, name: `Budget Adjustment Approval Step Border ${index + 1}`, geom: "roundRect", x, y: 3169920, cx: 1127760, cy: 792480, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1012 + index * 4, name: `Budget Adjustment Approval Step Dot ${index + 1}`, geom: "ellipse", x: x + 137160, y: 3337560, cx: 213360, cy: 213360, fill: index < 2 ? palette.secondary : visual.accent })
      + textShapeXml({ id: 1013 + index * 4, name: `Budget Adjustment Approval Step Text ${index + 1}`, x: x + 137160, y: 3655068, cx: 853440, cy: 182880, text: step, size: 680, bold: true, color: visual.title })
      + arrow;
  }).join("");
}

function budgetAdjustmentImpactXml({ visual, palette, items }) {
  const values = [items[0] || "收入影响", items[1] || "成本影响", items[2] || "现金流影响", items[3] || "项目进度影响"];
  return values.map((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5486400 + col * 1524000;
    const y = 1219200 + row * 944880;
    const color = [visual.accent, palette.secondary, visual.primary, palette.risk][index];
    return solidShapeXml({ id: 1040 + index * 4, name: `Budget Adjustment Impact Card ${index + 1}`, geom: "roundRect", x, y, cx: 1280160, cy: 701040, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1041 + index * 4, name: `Budget Adjustment Impact Card Border ${index + 1}`, geom: "roundRect", x, y, cx: 1280160, cy: 701040, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1042 + index * 4, name: `Budget Adjustment Impact Accent ${index + 1}`, x, y, cx: 76200, cy: 701040, fill: color })
      + textShapeXml({ id: 1043 + index * 4, name: `Budget Adjustment Impact Text ${index + 1}`, x: x + 182880, y: y + 228600, cx: 853440, cy: 243840, text: budgetPlanningCompactText(item, "", 16), size: 700, bold: true, color: visual.title });
  }).join("");
}

function budgetAdjustmentClosingXml({ visual, palette, items }) {
  const values = [items[0] || "确认调整口径", items[1] || "完成审批落账", items[2] || "持续跟踪影响"];
  return values.map((item, index) => {
    const x = 792480 + index * 2514600;
    return solidShapeXml({ id: 1070 + index * 4, name: `Budget Adjustment Closing Card ${index + 1}`, geom: "roundRect", x, y: 2796540, cx: 2194560, cy: 944880, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1071 + index * 4, name: `Budget Adjustment Closing Card Border ${index + 1}`, geom: "roundRect", x, y: 2796540, cx: 2194560, cy: 944880, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1072 + index * 4, name: `Budget Adjustment Closing Card Accent ${index + 1}`, x: x + 152400, y: 2948940, cx: 45720, cy: 487680, fill: index === 1 ? palette.secondary : visual.accent })
      + textShapeXml({ id: 1073 + index * 4, name: `Budget Adjustment Closing Card Text ${index + 1}`, x: x + 289560, y: 3025140, cx: 1584960, cy: 304800, text: budgetPlanningCompactText(item, "", 24), size: 760, bold: true, color: visual.title });
  }).join("");
}

function budgetAdjustmentSceneFromSlide({ slide, index, role }) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  const title = budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, 24);
  const resolvedRole = index === 0 ? "cover" : role === "closing" ? "closing" : ["reallocation", "analysis", "approval", "impact"][(index - 1) % 4];
  const metrics = [0, 1, 2].map((itemIndex) => budgetPlanningMetricFromText(bullets[itemIndex], itemIndex));
  return {
    role: resolvedRole,
    kicker: resolvedRole === "cover" ? "BUDGET DECISION" : "ADJUSTMENT BOARD",
    title,
    bullets: bullets.slice(0, resolvedRole === "cover" ? 3 : 4),
    metrics,
    approvalSteps: ["业务申请", "财务复核", "影响评估", "管理审批", "预算落账"],
    bridge: [
      budgetPlanningCompactText(bullets[0], "原预算基线", 16),
      budgetPlanningCompactText(bullets[1], "偏差原因", 16),
      budgetPlanningCompactText(bullets[2], "调整后方案", 16),
    ],
    impacts: [
      budgetPlanningCompactText(bullets[0], "收入影响", 14),
      budgetPlanningCompactText(bullets[1], "成本影响", 14),
      budgetPlanningCompactText(bullets[2], "现金流影响", 14),
      budgetPlanningCompactText(bullets[3], "项目进度影响", 14),
    ],
  };
}

function budgetAdjustmentColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.28),
    tint: blendHexColor(visual.primary, visual.background, 0.88),
    warmWash: blendHexColor(visual.accent, visual.background, 0.82),
    tealWash: blendHexColor("14B8A6", visual.background, 0.86),
    panel: blendHexColor(visual.background, visual.surface, 0.62),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    secondary: "14B8A6",
    risk: "B91C1C",
  };
}

function isBudgetAdjustmentVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "finance-budget-adjustment" && (id === "budget-management-report" || id === "finance-budget-management-report-budget-adjustment");
}

function financialSolutionDecorationsXml({ visual, index, role, slide }) {
  const scene = financialSolutionSceneFromSlide({ slide, index, role });
  const palette = financialSolutionColorPalette(visual);
  // 背景、卡片和装饰均用 DrawingML 绘制，保证下载 PPTX 后仍然可编辑。
  const backdrop = rectShapeXml({ id: 800, name: "Financial Solution Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 801, name: "Financial Solution Left Security Plane", geom: "parallelogram", x: -548640, y: 533400, cx: 2011680, cy: 4602480, fill: palette.tint })
    + solidShapeXml({ id: 802, name: "Financial Solution Compliance Glow", geom: "ellipse", x: 7315200, y: 304800, cx: 1828800, cy: 1828800, fill: palette.softAccent })
    + solidShapeXml({ id: 803, name: "Financial Solution Value Glow", geom: "ellipse", x: 7246620, y: 4038600, cx: 1676400, cy: 1219200, fill: palette.warmWash });
  const surface = solidShapeXml({ id: 804, name: "Financial Solution Workspace", geom: "roundRect", x: 585216, y: 640080, cx: 7979664, cy: 4069080, fill: visual.surface })
    + lineFrameShapeXml({ id: 805, name: "Financial Solution Workspace Border", geom: "roundRect", x: 585216, y: 640080, cx: 7979664, cy: 4069080, stroke: palette.frame, width: 15240 });
  const header = solidShapeXml({ id: 806, name: "Financial Solution Header", x: 0, y: 0, cx: 9144000, cy: 335280, fill: visual.primary })
    + rectShapeXml({ id: 807, name: "Financial Solution Header Accent", x: 0, y: 335280, cx: 9144000, cy: 22860, fill: visual.accent })
    + textShapeXml({ id: 808, name: "Financial Solution Kicker", x: 841248, y: 838200, cx: 2316480, cy: 274320, text: scene.kicker, size: 780, bold: true, color: visual.accent })
    + rectShapeXml({ id: 809, name: "Financial Solution Focus Rule", x: 841248, y: index === 0 ? 2331720 : 2087880, cx: 3200400, cy: 22860, fill: visual.accent });
  const bullets = financialSolutionBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "architecture") return backdrop + surface + header + bullets + financialSolutionArchitectureXml({ visual, palette, items: scene.architecture });
  if (scene.role === "compliance" || scene.role === "value") return backdrop + surface + header + bullets + financialSolutionValueXml({ visual, palette, items: scene.matrix });
  if (scene.role === "closing") return backdrop + surface + header + bullets + financialSolutionClosingXml({ visual, palette, items: scene.matrix });
  return backdrop + surface + header + bullets + financialSolutionShieldXml({ visual, palette }) + financialSolutionTagCardsXml({ visual, tags: scene.tags });
}

function financialSolutionShieldXml({ visual, palette }) {
  return solidShapeXml({ id: 820, name: "Financial Solution Shield Panel", geom: "roundRect", x: 5780520, y: 1021080, cx: 2743200, cy: 2438400, fill: palette.panel })
    + lineFrameShapeXml({ id: 821, name: "Financial Solution Shield Panel Border", geom: "roundRect", x: 5780520, y: 1021080, cx: 2743200, cy: 2438400, stroke: palette.frame, width: 12700 })
    + solidShapeXml({ id: 822, name: "Financial Solution Security Shield", geom: "pentagon", x: 6461760, y: 1272540, cx: 1219200, cy: 1447800, fill: palette.shield })
    + lineFrameShapeXml({ id: 823, name: "Financial Solution Security Shield Border", geom: "pentagon", x: 6461760, y: 1272540, cx: 1219200, cy: 1447800, stroke: visual.primary, width: 25400 })
    + rectShapeXml({ id: 824, name: "Financial Solution Shield Vertical Rule", x: 7063740, y: 1546860, cx: 30480, cy: 883920, fill: visual.accent })
    + rectShapeXml({ id: 825, name: "Financial Solution Shield Cross Rule", x: 6781800, y: 1836420, cx: 640080, cy: 22860, fill: visual.primary })
    + solidShapeXml({ id: 826, name: "Financial Solution Gold Node", geom: "ellipse", x: 6987540, y: 1386840, cx: 121920, cy: 121920, fill: palette.gold })
    + solidShapeXml({ id: 827, name: "Financial Solution Security Node Left", geom: "ellipse", x: 6256020, y: 2514600, cx: 137160, cy: 137160, fill: visual.accent })
    + solidShapeXml({ id: 828, name: "Financial Solution Security Node Right", geom: "ellipse", x: 7802880, y: 2514600, cx: 137160, cy: 137160, fill: visual.accent });
}

function financialSolutionTagCardsXml({ visual, tags }) {
  return tags.slice(0, 3).map((tag, index) => {
    const x = 841248 + index * 1257300;
    return rectShapeXml({ id: 830 + index * 3, name: `Financial Solution Tag Rail ${index + 1}`, x, y: 3764280, cx: 60960, cy: 350520, fill: visual.accent })
      + solidShapeXml({ id: 831 + index * 3, name: `Financial Solution Tag Card ${index + 1}`, geom: "roundRect", x: x + 91440, y: 3703320, cx: 914400, cy: 472440, fill: "FFFFFF" })
      + textShapeXml({ id: 832 + index * 3, name: `Financial Solution Tag Text ${index + 1}`, x: x + 198120, y: 3817620, cx: 685800, cy: 182880, text: financialSolutionCompactText(tag, "", 8), size: 760, bold: true, color: visual.title });
  }).join("");
}

function financialSolutionBulletCardsXml({ visual, scene, isCover }) {
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = (isCover ? 2644140 : 1859280) + index * 243840;
    return rectShapeXml({ id: 850 + index * 2, name: `Financial Solution Bullet Rule ${index + 1}`, x: 841248, y: y + 30480, cx: 45720, cy: 137160, fill: visual.accent })
      + textShapeXml({ id: 851 + index * 2, name: `Financial Solution Bullet Text ${index + 1}`, x: 1013460, y, cx: 3444240, cy: 198120, text: financialSolutionCompactText(item, scene.title, 32), size: isCover ? 820 : 720, bold: false, color: visual.body });
  }).join("");
}

function financialSolutionArchitectureXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const y = 1112520 + index * 548640;
    return solidShapeXml({ id: 870 + index * 4, name: `Financial Solution Architecture Layer ${index + 1}`, geom: "roundRect", x: 5780520, y, cx: 2743200, cy: 396240, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 871 + index * 4, name: `Financial Solution Architecture Border ${index + 1}`, geom: "roundRect", x: 5780520, y, cx: 2743200, cy: 396240, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 872 + index * 4, name: `Financial Solution Architecture Node ${index + 1}`, geom: "ellipse", x: 5963400, y: y + 121920, cx: 121920, cy: 121920, fill: index === 2 ? palette.gold : visual.accent })
      + textShapeXml({ id: 873 + index * 4, name: `Financial Solution Architecture Text ${index + 1}`, x: 6217920, y: y + 91440, cx: 1828800, cy: 182880, text: financialSolutionCompactText(item, "", 12), size: 760, bold: true, color: visual.title });
  }).join("");
}

function financialSolutionValueXml({ visual, palette, items }) {
  const panel = solidShapeXml({ id: 900, name: "Financial Solution Value Panel", geom: "roundRect", x: 5943600, y: 1219200, cx: 2438400, cy: 2133600, fill: visual.primary })
    + rectShapeXml({ id: 901, name: "Financial Solution Value Line 1", x: 6324600, y: 1691640, cx: 914400, cy: 60960, fill: "FFFFFF", transparency: 22000 })
    + rectShapeXml({ id: 902, name: "Financial Solution Value Line 2", x: 6324600, y: 2057400, cx: 1219200, cy: 60960, fill: visual.accent, transparency: 12000 })
    + rectShapeXml({ id: 903, name: "Financial Solution Value Line 3", x: 6324600, y: 2423160, cx: 762000, cy: 60960, fill: palette.gold, transparency: 8000 });
  const cards = items.slice(0, 4).map((item, index) => {
    const x = 841248 + index * 1828800;
    return solidShapeXml({ id: 910 + index * 3, name: `Financial Solution Value Card ${index + 1}`, geom: "roundRect", x, y: 3611880, cx: 1524000, cy: 609600, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 911 + index * 3, name: `Financial Solution Value Card Border ${index + 1}`, geom: "roundRect", x, y: 3611880, cx: 1524000, cy: 609600, stroke: palette.frame, width: 10160 })
      + textShapeXml({ id: 912 + index * 3, name: `Financial Solution Value Card Text ${index + 1}`, x: x + 152400, y: 3794760, cx: 1219200, cy: 182880, text: financialSolutionCompactText(item, "", 10), size: 720, bold: true, color: visual.title });
  }).join("");
  return panel + cards;
}

function financialSolutionClosingXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 975360 + index * 2286000;
    return solidShapeXml({ id: 940 + index * 4, name: `Financial Solution Closing Card ${index + 1}`, geom: "roundRect", x, y: 2926080, cx: 1828800, cy: 914400, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 941 + index * 4, name: `Financial Solution Closing Card Border ${index + 1}`, geom: "roundRect", x, y: 2926080, cx: 1828800, cy: 914400, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 942 + index * 4, name: `Financial Solution Closing Card Accent ${index + 1}`, x: x + 182880, y: 3215640, cx: 365760, cy: 30480, fill: index === 1 ? palette.gold : visual.accent })
      + textShapeXml({ id: 943 + index * 4, name: `Financial Solution Closing Card Text ${index + 1}`, x: x + 182880, y: 3329940, cx: 1371600, cy: 243840, text: financialSolutionCompactText(item, "", 14), size: 760, bold: true, color: visual.title });
  }).join("");
}

function financialSolutionSceneFromSlide({ slide, index, role }) {
  const bullets = financialSolutionBulletTexts(slide);
  const title = financialSolutionCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const sceneRole = index === 0
    ? "cover"
    : role === "closing"
      ? "closing"
      : String(role || "").includes("architecture")
        ? "architecture"
        : String(role || "").includes("compliance")
          ? "compliance"
          : String(role || "").includes("value")
            ? "value"
            : ["painpoints", "architecture", "compliance", "value"][(index - 1) % 4];
  const tags = ["合规安全", "架构升级", "价值增长"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 8));
  const architecture = ["客户触点", "业务中台", "数据风控", "合规审计"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 12));
  const matrix = ["监管合规", "数据安全", "流程提效", "客户体验"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 10));
  return {
    role: sceneRole,
    kicker: sceneRole === "cover" ? "FINANCIAL SOLUTION" : sceneRole === "architecture" ? "SOLUTION ARCHITECTURE" : sceneRole === "compliance" ? "COMPLIANCE VALUE" : sceneRole === "value" ? "BUSINESS VALUE" : "CLIENT NEXT STEP",
    title,
    bullets,
    tags,
    architecture,
    matrix,
  };
}

function financialSolutionBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["金融客户场景痛点与合规要求", "安全可靠的数字化方案架构", "业务效率提升与客户体验增长"];
}

function financialSolutionCompactText(text, fallback, maxLength) {
  const raw = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(1, maxLength - 1))}…`;
}

function financialSolutionColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.28),
    tint: blendHexColor(visual.accent, visual.background, 0.86),
    softAccent: blendHexColor(visual.accent, visual.surface, 0.76),
    warmWash: blendHexColor("D6A84F", visual.background, 0.84),
    panel: blendHexColor(visual.background, visual.surface, 0.66),
    shield: blendHexColor(visual.accent, visual.surface, 0.88),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    gold: "D6A84F",
  };
}

function isFinancialSolutionVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "sales-financial-solution" && (id === "industry-solution" || id === "sales-industry-solution-financial-industry");
}

function profitBridgeDecorationsXml({ visual, index, role, slide }) {
  const scene = profitBridgeSceneFromSlide({ slide, index, role });
  const palette = profitBridgeColorPalette(visual);
  // 利润桥模板导出端复刻在线预览的网格底、白色工作台、结论 bullet 和可编辑图表，避免下载后退回普通大标题页。
  const ruleY = index === 0 ? 2476500 : 1805940;
  const titleBox = profitBridgeTitleBox({ index, role: scene.role });
  const backdrop = rectShapeXml({ id: 1080, name: "Profit Bridge Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 1081, name: "Profit Bridge Profit Glow", geom: "ellipse", x: 6705600, y: 365760, cx: 2057400, cy: 1676400, fill: palette.goldWash })
    + solidShapeXml({ id: 1082, name: "Profit Bridge Quality Glow", geom: "ellipse", x: 6705600, y: 3657600, cx: 2438400, cy: 1676400, fill: palette.tealWash })
    + profitBridgeGridXml({ palette });
  const workspace = solidShapeXml({ id: 1090, name: "Profit Bridge Workspace", geom: "roundRect", x: 566928, y: 591312, cx: 8001000, cy: 4145280, fill: visual.surface })
    + lineFrameShapeXml({ id: 1091, name: "Profit Bridge Workspace Border", geom: "roundRect", x: 566928, y: 591312, cx: 8001000, cy: 4145280, stroke: palette.frame, width: 15240 })
    + solidShapeXml({ id: 1092, name: "Profit Bridge Header Bar", x: 0, y: 0, cx: 9144000, cy: 342900, fill: visual.primary })
    + rectShapeXml({ id: 1093, name: "Profit Bridge Header Accent", x: 0, y: 342900, cx: 9144000, cy: 22860, fill: visual.accent })
    + textShapeXml({ id: 1094, name: "Profit Bridge Kicker", x: 804672, y: 792480, cx: 2286000, cy: 274320, text: scene.kicker, size: 760, bold: true, color: visual.accent })
    + rectShapeXml({ id: 1095, name: "Profit Bridge Focus Rule", x: 804672, y: ruleY, cx: index === 0 ? 3200400 : 2590800, cy: 30480, fill: visual.accent })
    + rectShapeXml({ id: 1096, name: "Profit Bridge Secondary Rule", x: 804672, y: ruleY + 53340, cx: index === 0 ? 1828800 : 1371600, cy: 15240, fill: visual.secondary || visual.accent })
    + textShapeXml({ id: 1097, name: "Profit Bridge Dedicated Title", ...titleBox, text: scene.title, bold: true, color: visual.title });
  const bullets = profitBridgeBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "margin") return backdrop + workspace + bullets + profitBridgeMarginXml({ visual, palette });
  if (scene.role === "factor") return backdrop + workspace + bullets + profitBridgeFactorCardsXml({ visual, palette, items: scene.factors });
  if (scene.role === "improvement") return backdrop + workspace + bullets + profitBridgeActionCardsXml({ visual, palette, items: scene.actions });
  if (scene.role === "closing") return backdrop + workspace + profitBridgeClosingCardsXml({ visual, palette, items: scene.actions });
  return backdrop + workspace + bullets + profitBridgeWaterfallXml({ visual, palette }) + profitBridgeMetricCardsXml({ visual, palette, metrics: scene.metrics });
}

function profitBridgeTitleBox({ index, role }) {
  const isCover = index === 0;
  if (role === "closing") return { x: 804672, y: 1112520, cx: 5943600, cy: 701040, size: 1460 };
  if (isCover) return { x: 804672, y: 1127760, cx: 3886200, cy: 944880, size: 1320 };
  return { x: 804672, y: 944880, cx: 4114800, cy: 609600, size: 1120 };
}

function profitBridgeGridXml({ palette }) {
  const vertical = [914400, 1371600, 1828800, 2286000, 2743200, 3200400, 3657600, 4114800, 4572000, 5029200, 5486400, 5943600, 6400800, 6858000, 7315200, 7772400, 8229600]
    .map((x, itemIndex) => rectShapeXml({ id: 1120 + itemIndex, name: `Profit Bridge Grid Vertical ${itemIndex + 1}`, x, y: 365760, cx: 7620, cy: 4419600, fill: palette.grid })).join("");
  const horizontal = [762000, 1143000, 1524000, 1905000, 2286000, 2667000, 3048000, 3429000, 3810000, 4191000, 4572000]
    .map((y, itemIndex) => rectShapeXml({ id: 1140 + itemIndex, name: `Profit Bridge Grid Horizontal ${itemIndex + 1}`, x: 457200, y, cx: 8229600, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal;
}

function profitBridgeBulletCardsXml({ visual, scene, isCover }) {
  return scene.bullets.slice(0, isCover ? 3 : 4).map((item, itemIndex) => {
    const y = (isCover ? 2674620 : 2164080) + itemIndex * (isCover ? 281940 : 396240);
    const cardWidth = isCover ? 3352800 : 3505200;
    const cardHeight = isCover ? 243840 : 304800;
    const accent = itemIndex % 2 === 1 ? visual.secondary || visual.accent : visual.accent;
    // 下载端将 bullet 做成浅底信息条，避免 WPS 中正文裸排导致大面积空白和文本错位。
    return solidShapeXml({ id: 1160 + itemIndex * 4, name: `Profit Bridge Bullet Card ${itemIndex + 1}`, geom: "roundRect", x: 804672, y, cx: cardWidth, cy: cardHeight, fill: blendHexColor(visual.background, visual.surface, 0.76) })
      + rectShapeXml({ id: 1161 + itemIndex * 4, name: `Profit Bridge Bullet Accent ${itemIndex + 1}`, x: 804672, y, cx: 45720, cy: cardHeight, fill: accent })
      + textShapeXml({ id: 1162 + itemIndex * 4, name: `Profit Bridge Bullet Text ${itemIndex + 1}`, x: 990600, y: y + (isCover ? 45720 : 60960), cx: cardWidth - 304800, cy: isCover ? 152400 : 182880, text: budgetPlanningCompactText(item, scene.title, isCover ? 30 : 26), size: isCover ? 660 : 600, bold: true, color: visual.body });
  }).join("");
}

function profitBridgeMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 3).map((metric, itemIndex) => {
    const x = 804672 + itemIndex * 1257300;
    const color = [visual.accent, visual.secondary || visual.accent, visual.negative || "C65A42"][itemIndex] || visual.accent;
    return solidShapeXml({ id: 1180 + itemIndex * 5, name: `Profit Bridge Metric Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3749040, cx: 1066800, cy: 640080, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1181 + itemIndex * 5, name: `Profit Bridge Metric Card Border ${itemIndex + 1}`, geom: "roundRect", x, y: 3749040, cx: 1066800, cy: 640080, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1182 + itemIndex * 5, name: `Profit Bridge Metric Accent ${itemIndex + 1}`, x, y: 3749040, cx: 1066800, cy: 45720, fill: color })
      + textShapeXml({ id: 1183 + itemIndex * 5, name: `Profit Bridge Metric Value ${itemIndex + 1}`, x: x + 121920, y: 3893820, cx: 822960, cy: 228600, text: metric.value, size: 1180, bold: true, color: visual.title })
      + textShapeXml({ id: 1184 + itemIndex * 5, name: `Profit Bridge Metric Label ${itemIndex + 1}`, x: x + 121920, y: 4160520, cx: 822960, cy: 182880, text: metric.label, size: 620, bold: true, color: visual.body });
  }).join("");
}

function profitBridgeWaterfallXml({ visual, palette }) {
  const heights = [914400, 1493520, 762000, 1188720, 1371600];
  const colors = [visual.primary, visual.accent, visual.negative || "C65A42", visual.secondary || visual.accent, visual.primary];
  const bars = heights.map((height, itemIndex) => {
    const x = 5791200 + itemIndex * 457200;
    return rectShapeXml({ id: 1200 + itemIndex, name: `Profit Bridge Waterfall Bar ${itemIndex + 1}`, x, y: 3200400 - height, cx: 335280, cy: height, fill: colors[itemIndex] });
  }).join("");
  return solidShapeXml({ id: 1195, name: "Profit Bridge Waterfall Panel", geom: "roundRect", x: 5486400, y: 975360, cx: 3048000, cy: 2514600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1196, name: "Profit Bridge Waterfall Border", geom: "roundRect", x: 5486400, y: 975360, cx: 3048000, cy: 2514600, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 1197, name: "Profit Bridge Waterfall Axis", x: 5791200, y: 3200400, cx: 2438400, cy: 22860, fill: palette.frame })
    + bars;
}

function profitBridgeMarginXml({ visual, palette }) {
  const stack = solidShapeXml({ id: 1220, name: "Profit Bridge Margin Stack Panel", geom: "roundRect", x: 5486400, y: 1219200, cx: 1371600, cy: 2286000, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1221, name: "Profit Bridge Margin Stack Border", geom: "roundRect", x: 5486400, y: 1219200, cx: 1371600, cy: 2286000, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 1222, name: "Profit Bridge Margin Stack 1", x: 5791200, y: 2743200, cx: 762000, cy: 457200, fill: visual.primary })
    + rectShapeXml({ id: 1223, name: "Profit Bridge Margin Stack 2", x: 5791200, y: 2225040, cx: 762000, cy: 426720, fill: visual.secondary || visual.accent })
    + rectShapeXml({ id: 1224, name: "Profit Bridge Margin Stack 3", x: 5791200, y: 1874520, cx: 762000, cy: 274320, fill: visual.negative || "C65A42" });
  const trend = solidShapeXml({ id: 1230, name: "Profit Bridge Margin Trend Panel", geom: "roundRect", x: 7086600, y: 1219200, cx: 1447800, cy: 2286000, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1231, name: "Profit Bridge Margin Trend Border", geom: "roundRect", x: 7086600, y: 1219200, cx: 1447800, cy: 2286000, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 1232, name: "Profit Bridge Margin Trend Line 1", x: 7299960, y: 2590800, cx: 914400, cy: 45720, fill: visual.accent })
    + rectShapeXml({ id: 1233, name: "Profit Bridge Margin Trend Line 2", x: 7543800, y: 2217420, cx: 701040, cy: 45720, fill: visual.secondary || visual.accent })
    + rectShapeXml({ id: 1234, name: "Profit Bridge Margin Trend Line 3", x: 7772400, y: 1905000, cx: 457200, cy: 45720, fill: visual.negative || "C65A42" });
  return stack + trend;
}

function profitBridgeFactorCardsXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, itemIndex) => {
    const x = 5262880 + (itemIndex % 2) * 1630680;
    const y = 1447800 + Math.floor(itemIndex / 2) * 944880;
    const color = [visual.accent, visual.secondary || visual.accent, visual.negative || "C65A42", visual.primary][itemIndex] || visual.accent;
    return solidShapeXml({ id: 1240 + itemIndex * 4, name: `Profit Bridge Factor Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1447800, cy: 731520, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1241 + itemIndex * 4, name: `Profit Bridge Factor Card Border ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1447800, cy: 731520, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1242 + itemIndex * 4, name: `Profit Bridge Factor Accent ${itemIndex + 1}`, x, y, cx: 60960, cy: 731520, fill: color })
      + textShapeXml({ id: 1243 + itemIndex * 4, name: `Profit Bridge Factor Text ${itemIndex + 1}`, x: x + 198120, y: y + 243840, cx: 1036320, cy: 228600, text: budgetPlanningCompactText(item, "", 14), size: 660, bold: true, color: visual.title });
  }).join("");
}

function profitBridgeActionCardsXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, itemIndex) => {
    const x = 1066800 + itemIndex * 1905000;
    return solidShapeXml({ id: 1260 + itemIndex * 5, name: `Profit Bridge Action Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3505200, cx: 1524000, cy: 731520, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1261 + itemIndex * 5, name: `Profit Bridge Action Card Border ${itemIndex + 1}`, geom: "roundRect", x, y: 3505200, cx: 1524000, cy: 731520, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1262 + itemIndex * 5, name: `Profit Bridge Action Number ${itemIndex + 1}`, geom: "ellipse", x: x + 137160, y: 3657600, cx: 289560, cy: 289560, fill: itemIndex % 2 ? visual.secondary || visual.accent : visual.accent })
      + textShapeXml({ id: 1263 + itemIndex * 5, name: `Profit Bridge Action Number Text ${itemIndex + 1}`, x: x + 137160, y: 3733800, cx: 289560, cy: 91440, text: String(itemIndex + 1), size: 520, bold: true, color: "FFFFFF" })
      + textShapeXml({ id: 1264 + itemIndex * 5, name: `Profit Bridge Action Text ${itemIndex + 1}`, x: x + 502920, y: 3672840, cx: 822960, cy: 243840, text: budgetPlanningCompactText(item, "", 12), size: 650, bold: true, color: visual.title });
  }).join("");
}

function profitBridgeClosingCardsXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, itemIndex) => {
    const x = 914400 + itemIndex * 2316480;
    return solidShapeXml({ id: 1290 + itemIndex * 4, name: `Profit Bridge Closing Card ${itemIndex + 1}`, geom: "roundRect", x, y: 2895600, cx: 1859280, cy: 914400, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1291 + itemIndex * 4, name: `Profit Bridge Closing Card Border ${itemIndex + 1}`, geom: "roundRect", x, y: 2895600, cx: 1859280, cy: 914400, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1292 + itemIndex * 4, name: `Profit Bridge Closing Card Accent ${itemIndex + 1}`, x: x + 182880, y: 3192780, cx: 365760, cy: 30480, fill: itemIndex === 1 ? visual.secondary || visual.accent : visual.accent })
      + textShapeXml({ id: 1293 + itemIndex * 4, name: `Profit Bridge Closing Card Text ${itemIndex + 1}`, x: x + 182880, y: 3314700, cx: 1371600, cy: 243840, text: budgetPlanningCompactText(item, "", 14), size: 720, bold: true, color: visual.title });
  }).join("");
}

function profitBridgeSceneFromSlide({ slide, index, role }) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  const resolvedRole = profitBridgeExportRoleFromSlide({ slide, index, role });
  const metrics = [0, 1, 2].map((itemIndex) => profitBridgeMetricFromText(bullets[itemIndex], itemIndex));
  return {
    role: resolvedRole,
    kicker: resolvedRole === "cover" ? "PROFIT ANALYSIS" : "PROFIT ATTRIBUTION",
    title: budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 28 : 24),
    bullets: bullets.slice(0, resolvedRole === "cover" ? 3 : 4),
    metrics,
    factors: [
      budgetPlanningCompactText(bullets[0], "收入增长贡献", 14),
      budgetPlanningCompactText(bullets[1], "成本结构变化", 14),
      budgetPlanningCompactText(bullets[2], "费用投入影响", 14),
      budgetPlanningCompactText(bullets[3], "盈利质量判断", 14),
    ],
    actions: [
      budgetPlanningCompactText(bullets[0], "优化价格结构", 12),
      budgetPlanningCompactText(bullets[1], "压降关键成本", 12),
      budgetPlanningCompactText(bullets[2], "聚焦高毛利业务", 12),
      budgetPlanningCompactText(bullets[3], "建立利润复盘节奏", 12),
    ],
  };
}

function profitBridgeExportRoleFromSlide({ slide, index, role }) {
  const layout = String(slide?.layout || "").toLowerCase();
  const title = String(slide?.title || "");
  if (index === 0 || layout.includes("cover")) return "cover";
  if (role === "closing" || layout.includes("closing")) return "closing";
  if (layout.includes("margin") || layout.includes("structure") || title.includes("毛利")) return "margin";
  if (layout.includes("factor") || layout.includes("analysis") || title.includes("因素")) return "factor";
  if (layout.includes("improve") || layout.includes("action") || title.includes("行动")) return "improvement";
  if (layout.includes("bridge") || layout.includes("waterfall") || layout.includes("overview")) return "waterfall";
  return ["waterfall", "margin", "factor", "improvement"][(index - 1) % 4];
}

function profitBridgeMetricFromText(text, index) {
  const fallbackValues = ["+12%", "38%", "￥2.6M"];
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValues[index] || "00", label: ["利润变化", "毛利水平", "改善空间"][index] || `指标 ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*(?:万|亿|%|元|M|m)?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValues[index] || "00";
  const labelSource = match ? raw.replace(match[1], "") : raw;
  return { value, label: budgetPlanningCompactText(labelSource.replace(/[：:，,。]/g, " ").trim(), raw, 10) };
}

function profitBridgeColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.28),
    goldWash: blendHexColor(visual.accent, visual.background, 0.86),
    tealWash: blendHexColor(visual.secondary || visual.accent, visual.background, 0.86),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    grid: blendHexColor(visual.primary, visual.surface, 0.91),
  };
}

function productPricingStrategyDecorationsXml({ visual, index, role, slide }) {
  const scene = productPricingExportScene({ slide, index, role });
  const bullets = scene.bullets;
  const palette = {
    panel: blendHexColor(visual.background, visual.surface, 0.52),
    softAccent: blendHexColor(visual.accent, visual.surface, 0.78),
    softSecondary: blendHexColor(visual.secondary || visual.accent, visual.surface, 0.78),
  };
  // 产品商业化定价模板用可编辑的套餐卡、权益矩阵和闭环图承载信息，避免回退到普通三段文字。
  const canvas = solidShapeXml({ id: 1200, name: "Product Pricing Canvas", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, fill: visual.surface })
    + lineFrameShapeXml({ id: 1201, name: "Product Pricing Canvas Border", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, stroke: blendHexColor(visual.primary, visual.surface, 0.78), width: 10160 })
    + rectShapeXml({ id: 1202, name: "Product Pricing Header Rule", x: 731520, y: 807720, cx: 7680960, cy: 30480, fill: visual.accent });
  if (scene.kind === "tiers") {
    return canvas + [0, 1, 2].map((itemIndex) => {
      const x = 4876800 + itemIndex * 1036320;
      return solidShapeXml({ id: 1210 + itemIndex * 3, name: `Product Pricing Tier Card ${itemIndex + 1}`, geom: "roundRect", x, y: 1524000 - (itemIndex === 1 ? 121920 : 0), cx: 853440, cy: 1524000, fill: itemIndex === 1 ? palette.softAccent : "FFFFFF" })
        + rectShapeXml({ id: 1211 + itemIndex * 3, name: `Product Pricing Tier Accent ${itemIndex + 1}`, x: x + 121920, y: 1767840 - (itemIndex === 1 ? 121920 : 0), cx: 609600, cy: 91440, fill: itemIndex === 1 ? visual.accent : visual.primary })
        + textShapeXml({ id: 1212 + itemIndex * 3, name: `Product Pricing Tier Text ${itemIndex + 1}`, x: x + 91440, y: 2362200 - (itemIndex === 1 ? 121920 : 0), cx: 670560, cy: 365760, text: scene.cards[itemIndex] || `Package ${itemIndex + 1}`, size: 660, bold: true, color: visual.title });
    }).join("");
  }
  if (scene.kind === "anchor") {
    return canvas + [0, 1, 2, 3].map((itemIndex) => {
      const x = 4876800 + (itemIndex % 2) * 1447800;
      const y = 1371600 + Math.floor(itemIndex / 2) * 914400;
      return solidShapeXml({ id: 1240 + itemIndex * 3, name: `Product Pricing Anchor Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 670560, fill: itemIndex % 2 ? palette.softSecondary : "FFFFFF" })
        + rectShapeXml({ id: 1241 + itemIndex * 3, name: `Product Pricing Anchor Rule ${itemIndex + 1}`, x: x + 137160, y: y + 137160, cx: 396240, cy: 60960, fill: itemIndex % 2 ? visual.secondary || visual.accent : visual.accent })
        + textShapeXml({ id: 1242 + itemIndex * 3, name: `Product Pricing Anchor Text ${itemIndex + 1}`, x: x + 137160, y: y + 289560, cx: 914400, cy: 182880, text: scene.cards[itemIndex] || `Anchor ${itemIndex + 1}`, size: 640, bold: true, color: visual.title });
    }).join("");
  }
  if (scene.kind === "matrix") {
    return canvas + solidShapeXml({ id: 1220, name: "Product Pricing Benefit Matrix", geom: "roundRect", x: 4876800, y: 1371600, cx: 3048000, cy: 2133600, fill: "FFFFFF" })
      + [0, 1, 2, 3, 4].map((itemIndex) => {
        const y = 1600200 + itemIndex * 335280;
        return rectShapeXml({ id: 1221 + itemIndex * 2, name: `Product Pricing Matrix Row ${itemIndex + 1}`, x: 5105400, y, cx: 2438400, cy: 213360, fill: itemIndex % 2 ? palette.panel : "F8FAFC" })
          + textShapeXml({ id: 1222 + itemIndex * 3, name: `Product Pricing Matrix Text ${itemIndex + 1}`, x: 5257800, y: y + 53340, cx: 975360, cy: 121920, text: scene.cards[itemIndex] || `Benefit ${itemIndex + 1}`, size: 560, bold: true, color: visual.title })
          + rectShapeXml({ id: 1223 + itemIndex * 3, name: `Product Pricing Matrix Signal ${itemIndex + 1}`, x: 6705600, y: y + 60960, cx: 609600, cy: 60960, fill: itemIndex % 2 ? visual.accent : visual.secondary || visual.primary });
      }).join("");
  }
  if (scene.kind === "loop" || scene.kind === "closing") {
    return canvas + solidShapeXml({ id: 1230, name: "Product Pricing Commercial Loop", geom: "ellipse", x: 5029200, y: 1371600, cx: 2438400, cy: 2133600, fill: palette.softSecondary })
      + solidShapeXml({ id: 1231, name: "Product Pricing Loop Core", geom: "ellipse", x: 5791200, y: 1981200, cx: 914400, cy: 914400, fill: visual.surface })
      + [0, 1, 2, 3].map((itemIndex) => {
        const positions = [
          [6004560, 1371600],
          [7162800, 2286000],
          [6004560, 3352800],
          [4876800, 2286000],
        ];
        const [x, y] = positions[itemIndex];
        return solidShapeXml({ id: 1232 + itemIndex * 2, name: `Product Pricing Loop Node ${itemIndex + 1}`, geom: "ellipse", x, y, cx: 304800, cy: 304800, fill: itemIndex % 2 ? visual.secondary || visual.accent : visual.accent })
          + textShapeXml({ id: 1233 + itemIndex * 2, name: `Product Pricing Loop Text ${itemIndex + 1}`, x: x - 182880, y: y + 335280, cx: 670560, cy: 182880, text: scene.cards[itemIndex] || `Step ${itemIndex + 1}`, size: 560, bold: true, color: visual.title });
      }).join("");
  }
  return canvas + solidShapeXml({ id: 1205, name: "Product Pricing Mockup Panel", geom: "roundRect", x: 4876800, y: 1371600, cx: 3048000, cy: 2133600, fill: palette.panel })
    + rectShapeXml({ id: 1206, name: "Product Pricing Mockup Header", x: 5181600, y: 1691640, cx: 1371600, cy: 121920, fill: visual.primary })
    + rectShapeXml({ id: 1207, name: "Product Pricing Mockup Bar 1", x: 5181600, y: 2148840, cx: 1828800, cy: 91440, fill: visual.accent })
    + rectShapeXml({ id: 1208, name: "Product Pricing Mockup Bar 2", x: 5181600, y: 2468880, cx: 1219200, cy: 91440, fill: visual.secondary || visual.primary })
    + solidShapeXml({ id: 1209, name: "Product Pricing Mockup Badge", geom: "ellipse", x: 6705600, y: 2819400, cx: 548640, cy: 548640, fill: visual.accent });
}

function productPricingExportScene({ slide, index, role }) {
  const bullets = productPricingExportBulletTexts(slide);
  const layout = String(slide?.layout || "").toLowerCase();
  const title = String(slide?.title || "");
  const isClosing = role === "closing" || layout.includes("closing") || title.includes("总结") || title.includes("下一步");
  if (index === 0 || layout.includes("cover")) return productPricingExportSceneByKind("cover", bullets);
  if (isClosing) return productPricingExportSceneByKind("closing", bullets);
  if (layout.includes("matrix") || title.includes("矩阵") || title.includes("对比")) return productPricingExportSceneByKind("matrix", bullets);
  if (layout.includes("anchor") || title.includes("锚点") || title.includes("价值")) return productPricingExportSceneByKind("anchor", bullets);
  if (layout.includes("tier") || title.includes("套餐") || title.includes("权益")) return productPricingExportSceneByKind("tiers", bullets);
  if (layout.includes("loop") || title.includes("闭环") || title.includes("路径") || title.includes("转化")) return productPricingExportSceneByKind("loop", bullets);
  return productPricingExportSceneByKind(["tiers", "anchor", "matrix", "loop"][(index - 1) % 4], bullets);
}

function productPricingExportSceneByKind(kind, bullets) {
  const defaults = {
    cover: ["目标客户", "价值锚点", "收入模型"],
    tiers: ["基础版", "专业版", "企业版"],
    anchor: ["客户价值", "成本结构", "竞品价格", "收入目标"],
    matrix: ["核心权益", "进阶权益", "服务支持", "数据能力", "安全权限"],
    loop: ["试用触达", "付费转化", "续费留存", "增购扩张"],
    closing: ["确认价格假设", "灰度套餐权益", "验证转化漏斗", "复盘收入模型"],
  };
  const maxLength = kind === "cover" ? 8 : 12;
  return {
    kind,
    bullets,
    cards: (defaults[kind] || defaults.cover).map((fallback, itemIndex) => productPricingExportCompactText(bullets[itemIndex], fallback, maxLength)),
  };
}

function productPricingExportBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["围绕目标客户和价值感知设计价格锚点", "用套餐权益区分基础、专业和企业版本", "结合转化路径、成本结构和续费模型评估收入"];
}

function productPricingExportCompactText(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return Array.from(normalized).length > maxLength ? `${Array.from(normalized).slice(0, Math.max(1, maxLength - 1)).join("")}…` : normalized;
}

function productInterviewInsightDecorationsXml({ visual, index, role, slide }) {
  const scene = productInterviewInsightExportScene({ slide, index, role });
  const palette = productInterviewInsightPalette(visual);
  // 用户访谈模板使用样本卡、原声卡和聚类面板，和在线预览的研究报告结构保持一致。
  const surface = solidShapeXml({ id: 1250, name: "Interview Insight Surface", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, fill: visual.surface })
    + lineFrameShapeXml({ id: 1251, name: "Interview Insight Border", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, stroke: blendHexColor(visual.primary, visual.surface, 0.78), width: 10160 })
    + rectShapeXml({ id: 1252, name: "Interview Insight Header Rule", x: 731520, y: 807720, cx: 7680960, cy: 30480, fill: visual.accent });
  const leftText = textShapeXml({ id: 1253, name: "Interview Insight Kicker", x: 731520, y: 1021080, cx: 1981200, cy: 182880, text: scene.kicker, size: 620, bold: true, color: visual.accent })
    + textShapeXml({ id: 1254, name: "Interview Insight Title", x: 731520, y: 1280160, cx: 3505200, cy: 990600, text: scene.title, size: 1900, bold: true, color: visual.title })
    + rectShapeXml({ id: 1255, name: "Interview Insight Title Rule", x: 731520, y: 2423160, cx: 2895600, cy: 30480, fill: visual.accent })
    + productInterviewInsightBulletCardsXml({ visual, bullets: scene.bullets, palette });
  const tags = productInterviewInsightTagsXml({ visual, tags: scene.tags, palette });
  if (scene.kind === "quotes") {
    return surface + leftText + [0, 1, 2, 3].map((itemIndex) => {
      const y = 1371600 + itemIndex * 731520;
      return solidShapeXml({ id: 1270 + itemIndex * 3, name: `Interview Quote Card ${itemIndex + 1}`, geom: "roundRect", x: 4876800, y, cx: 3048000, cy: 548640, fill: palette.card })
        + textShapeXml({ id: 1271 + itemIndex * 3, name: `Interview Quote Mark ${itemIndex + 1}`, x: 5105400, y: y + 76200, cx: 243840, cy: 182880, text: "“", size: 1200, bold: true, color: visual.accent })
        + textShapeXml({ id: 1272 + itemIndex * 3, name: `Interview Quote Text ${itemIndex + 1}`, x: 5387340, y: y + 167640, cx: 2133600, cy: 243840, text: productInterviewInsightExportCompact(scene.cards[itemIndex], `用户原声 ${itemIndex + 1}`, 18), size: 680, bold: true, color: visual.title });
    }).join("") + tags;
  }
  if (scene.kind === "cluster") {
    return surface + leftText + solidShapeXml({ id: 1290, name: "Interview Cluster Panel", geom: "roundRect", x: 4876800, y: 1371600, cx: 3048000, cy: 2133600, fill: blendHexColor(visual.primary, visual.surface, 0.9) })
      + rectShapeXml({ id: 1291, name: "Interview Cluster Link A", x: 5516880, y: 2186940, cx: 1905000, cy: 30480, fill: blendHexColor(visual.primary, visual.surface, 0.34), transparency: 18000 })
      + rectShapeXml({ id: 1292, name: "Interview Cluster Link B", x: 5516880, y: 2712720, cx: 1905000, cy: 30480, fill: blendHexColor(visual.secondary || visual.primary, visual.surface, 0.34), transparency: 18000 })
      + [0, 1, 2, 3].map((itemIndex) => {
        const x = 5105400 + (itemIndex % 2) * 1219200;
        const y = 1600200 + Math.floor(itemIndex / 2) * 792480;
        return solidShapeXml({ id: 1293 + itemIndex * 2, name: `Interview Cluster Node ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 914400, cy: 487680, fill: itemIndex % 2 ? visual.accent : visual.primary })
          + textShapeXml({ id: 1294 + itemIndex * 2, name: `Interview Cluster Text ${itemIndex + 1}`, x: x + 91440, y: y + 167640, cx: 731520, cy: 152400, text: productInterviewInsightExportCompact(scene.cards[itemIndex], `主题 ${itemIndex + 1}`, 8), size: 620, bold: true, color: itemIndex % 2 ? visual.title : "FFFFFF" });
      }).join("") + tags;
  }
  if (scene.kind === "opportunity") {
    return surface + leftText + [0, 1, 2, 3].map((itemIndex) => {
      const x = 4876800 + (itemIndex % 2) * 1524000;
      const y = 1447800 + Math.floor(itemIndex / 2) * 914400;
      return solidShapeXml({ id: 1310 + itemIndex * 3, name: `Interview Opportunity Note ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1371600, cy: 670560, fill: itemIndex % 2 ? "FFFBEB" : "ECFEFF" })
        + rectShapeXml({ id: 1311 + itemIndex * 3, name: `Interview Opportunity Pin ${itemIndex + 1}`, x: x + 121920, y: y + 121920, cx: 182880, cy: 182880, fill: itemIndex % 2 ? visual.accent : visual.primary })
        + textShapeXml({ id: 1312 + itemIndex * 3, name: `Interview Opportunity Text ${itemIndex + 1}`, x: x + 396240, y: y + 198120, cx: 792480, cy: 243840, text: productInterviewInsightExportCompact(scene.cards[itemIndex], `机会 ${itemIndex + 1}`, 10), size: 620, bold: true, color: visual.title });
    }).join("");
  }
  if (scene.kind === "closing") {
    return surface + leftText + solidShapeXml({ id: 1330, name: "Interview Next Actions Path", geom: "roundRect", x: 4876800, y: 1371600, cx: 3048000, cy: 2133600, fill: palette.card })
      + rectShapeXml({ id: 1331, name: "Interview Next Actions Rail", x: 5181600, y: 2438400, cx: 2438400, cy: 45720, fill: visual.accent })
      + scene.cards.map((item, itemIndex) => {
        const x = 5105400 + itemIndex * 609600;
        return solidShapeXml({ id: 1332 + itemIndex * 3, name: `Interview Next Action Node ${itemIndex + 1}`, geom: "ellipse", x, y: 2217420, cx: 487680, cy: 487680, fill: itemIndex % 2 ? visual.secondary || visual.primary : visual.primary })
          + textShapeXml({ id: 1333 + itemIndex * 3, name: `Interview Next Action Text ${itemIndex + 1}`, x: x - 60960, y: 2819400, cx: 609600, cy: 182880, text: productInterviewInsightExportCompact(item, `行动 ${itemIndex + 1}`, 6), size: 560, bold: true, color: visual.title });
      }).join("") + tags;
  }
  return surface + leftText + solidShapeXml({ id: 1260, name: "Interview Sample Card", geom: "roundRect", x: 4876800, y: 1447800, cx: 3048000, cy: 1905000, fill: palette.card })
    + solidShapeXml({ id: 1261, name: "Interview Sample Avatar", geom: "ellipse", x: 5181600, y: 1828800, cx: 609600, cy: 609600, fill: visual.primary })
    + solidShapeXml({ id: 1262, name: "Interview Sample Body", geom: "arc", x: 5105400, y: 2438400, cx: 914400, cy: 609600, fill: visual.primary })
    + [0, 1, 2].map((itemIndex) => rectShapeXml({ id: 1263 + itemIndex, name: `Interview Sample Bar ${itemIndex + 1}`, x: 6324600, y: 1828800 + itemIndex * 426720, cx: 1219200 + itemIndex * 304800, cy: 91440, fill: itemIndex % 2 ? visual.accent : visual.primary })).join("")
    + tags;
}

function productInterviewInsightExportScene({ slide, index, role }) {
  const bullets = channelPolicyBulletTexts(slide);
  const title = productInterviewInsightExportCompact(slide?.title, "用户研究洞察", index === 0 ? 26 : 24);
  const cards = ["访谈对象", "关键摘录", "主题归类", "产品建议"].map((fallback, itemIndex) => productInterviewInsightExportCompact(bullets[itemIndex], fallback, 12));
  const tags = ["样本", "原声", "机会"].map((fallback, itemIndex) => productInterviewInsightExportCompact(bullets[itemIndex], fallback, 7));
  const layout = String(slide?.layout || "").toLowerCase();
  const kind = role === "closing" || layout.includes("closing")
    ? "closing"
    : layout.includes("quote") || String(slide?.title || "").includes("原声")
      ? "quotes"
      : layout.includes("cluster") || String(slide?.title || "").includes("聚类")
        ? "cluster"
        : layout.includes("opportunity") || String(slide?.title || "").includes("机会")
          ? "opportunity"
          : index === 1
            ? "quotes"
            : index === 2
              ? "cluster"
              : index === 3
                ? "opportunity"
                : index >= 4
                  ? "closing"
                  : "sample";
  const kickerMap = {
    sample: "RESEARCH SAMPLE",
    quotes: "VOICE BANK",
    cluster: "THEME CLUSTER",
    opportunity: "OPPORTUNITY NOTES",
    closing: "NEXT ACTIONS",
  };
  return {
    kind,
    kicker: index === 0 ? "FIELD NOTES" : kickerMap[kind],
    title,
    bullets: bullets.length ? bullets : ["受访用户在核心流程中反复提到效率阻碍", "真实原声集中在理解成本、信任感和操作路径", "需求机会需要结合样本证据进入原型验证"],
    cards,
    tags,
  };
}

function productInterviewInsightPalette(visual) {
  return {
    card: blendHexColor(visual.background, visual.surface, 0.62),
    muted: blendHexColor(visual.body, visual.surface, 0.16),
  };
}

function productInterviewInsightBulletCardsXml({ visual, bullets, palette }) {
  return bullets.slice(0, 3).map((item, itemIndex) => {
    const y = 2743200 + itemIndex * 426720;
    return solidShapeXml({ id: 1350 + itemIndex * 4, name: `Interview Insight Bullet Card ${itemIndex + 1}`, geom: "roundRect", x: 731520, y, cx: 3505200, cy: 304800, fill: palette.card })
      + rectShapeXml({ id: 1351 + itemIndex * 4, name: `Interview Insight Bullet Accent ${itemIndex + 1}`, x: 731520, y, cx: 60960, cy: 304800, fill: itemIndex % 2 ? visual.secondary || visual.primary : visual.accent })
      + textShapeXml({ id: 1352 + itemIndex * 4, name: `Interview Insight Bullet Text ${itemIndex + 1}`, x: 914400, y: y + 68580, cx: 3124200, cy: 152400, text: productInterviewInsightExportCompact(item, "", 36), size: 660, bold: true, color: visual.body });
  }).join("");
}

function productInterviewInsightTagsXml({ visual, tags, palette }) {
  return tags.slice(0, 3).map((tag, itemIndex) => {
    const x = 731520 + itemIndex * 883920;
    return solidShapeXml({ id: 1370 + itemIndex * 3, name: `Interview Insight Tag ${itemIndex + 1}`, geom: "roundRect", x, y: 4046220, cx: 731520, cy: 304800, fill: "FFFFFF" })
      + rectShapeXml({ id: 1371 + itemIndex * 3, name: `Interview Insight Tag Rule ${itemIndex + 1}`, x, y: 4046220, cx: 731520, cy: 45720, fill: itemIndex === 1 ? visual.secondary || visual.primary : visual.accent })
      + textShapeXml({ id: 1372 + itemIndex * 3, name: `Interview Insight Tag Text ${itemIndex + 1}`, x: x + 76200, y: 4160520, cx: 579120, cy: 121920, text: tag, size: 560, bold: true, color: visual.title });
  }).join("");
}

function productInterviewInsightExportCompact(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(1, maxLength - 1))}…` : normalized;
}

function channelRecruitmentPolicyDecorationsXml({ visual, index, role, slide }) {
  const bullets = channelPolicyBulletTexts(slide);
  const sceneRole = channelPolicyExportRoleFromSlide({ slide, index, role });
  const palette = {
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    panel: blendHexColor(visual.background, visual.surface, 0.58),
    gold: visual.secondary || "D9A441",
    softGold: blendHexColor(visual.secondary || "D9A441", visual.surface, 0.74),
    softGreen: blendHexColor(visual.accent, visual.surface, 0.78),
  };
  const metrics = [0, 1, 2].map((itemIndex) => channelPolicyMetricFromText(bullets[itemIndex], itemIndex));
  const kicker = channelPolicyKicker(sceneRole);
  // 渠道招商合作政策模板用可编辑的网络、权益矩阵、收益模型和流程箭头，避免预览和下载版式脱节。
  const workspace = rectShapeXml({ id: 1298, name: "Channel Policy Background Grid", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + solidShapeXml({ id: 1300, name: "Channel Policy Workspace", geom: "roundRect", x: 530352, y: 472440, cx: 8089392, cy: 4236720, fill: visual.surface })
    + lineFrameShapeXml({ id: 1301, name: "Channel Policy Workspace Border", geom: "roundRect", x: 530352, y: 472440, cx: 8089392, cy: 4236720, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 1302, name: "Channel Policy Top Rule", x: 530352, y: 472440, cx: 8089392, cy: 60960, fill: visual.accent })
    + rectShapeXml({ id: 1303, name: "Channel Policy Title Rule", x: 804672, y: sceneRole === "cover" ? 2156460 : 1973580, cx: 3200400, cy: 30480, fill: visual.accent })
    + textShapeXml({ id: 1304, name: "Channel Policy Kicker", x: 804672, y: 762000, cx: 2743200, cy: 243840, text: kicker, size: 620, bold: true, color: visual.accent })
    + channelPolicyBulletShapesXml({ bullets, visual });
  if (sceneRole === "matrix") {
    return workspace + channelPolicyRightsMatrixXml({ bullets, visual, palette });
  }
  if (sceneRole === "revenue") {
    return workspace + channelPolicyRevenuePanelXml({ bullets, visual, palette }) + channelPolicyMetricsXml({ metrics, visual, palette });
  }
  if (sceneRole === "process" || sceneRole === "closing") {
    return workspace + channelPolicyProcessXml({ bullets, visual }) + (sceneRole === "closing" ? channelPolicyNetworkXml({ visual, palette, startId: 1360 }) : "");
  }
  if (sceneRole === "overview") {
    return workspace + channelPolicyOverviewCardsXml({ bullets, visual, palette }) + channelPolicyNetworkXml({ visual, palette, startId: 1310 });
  }
  return workspace + channelPolicyNetworkXml({ visual, palette, startId: 1310 }) + channelPolicyMetricsXml({ metrics, visual, palette });
}

function channelPolicyBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["明确合作准入条件与授权范围", "展示渠道权益和总部扶持政策", "说明收益模型、签约流程和复盘机制"];
}

function channelPolicyCompactText(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(1, maxLength - 1))}…` : normalized;
}

function channelPolicyExportRoleFromSlide({ slide, index, role }) {
  const layout = String(slide?.layout || "").toLowerCase();
  if (index === 0 || layout.includes("cover")) return "cover";
  if (role === "closing" || layout.includes("closing")) return "closing";
  if (layout.includes("matrix") || layout.includes("rights") || layout.includes("equity")) return "matrix";
  if (layout.includes("revenue") || layout.includes("income") || layout.includes("benefit")) return "revenue";
  if (layout.includes("process") || layout.includes("roadmap") || layout.includes("timeline")) return "process";
  if (layout.includes("policy") || layout.includes("overview")) return "overview";
  return ["overview", "matrix", "revenue", "process"][(Math.max(1, index) - 1) % 4];
}

function channelPolicyKicker(role) {
  if (role === "cover") return "PARTNER PROGRAM";
  if (role === "matrix") return "PARTNER RIGHTS";
  if (role === "revenue") return "REVENUE MODEL";
  if (role === "process") return "JOINING ROADMAP";
  if (role === "closing") return "NEXT STEP";
  return "POLICY OVERVIEW";
}

function channelPolicyMetricFromText(text, index) {
  const fallbackValues = ["3级", "6项", "90天"];
  const fallbackLabels = ["伙伴等级", "扶持权益", "启动周期"];
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValues[index] || "01", label: fallbackLabels[index] || `指标 ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*(?:万|亿|%|天|月|年|级|项)?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValues[index] || "01";
  const labelSource = match ? raw.replace(match[1], "") : raw;
  return { value, label: channelPolicyCompactText(labelSource.replace(/[：:，,。]/g, " ").trim(), raw, 8) };
}

function channelPolicyBulletShapesXml({ bullets, visual }) {
  return bullets.slice(0, 4).map((item, itemIndex) => {
    const y = 2217420 + itemIndex * 304800;
    return solidShapeXml({ id: 1370 + itemIndex * 2, name: `Channel Policy Bullet Dot ${itemIndex + 1}`, geom: "ellipse", x: 823000, y: y + 54864, cx: 73152, cy: 73152, fill: itemIndex % 2 ? visual.accent : visual.secondary || visual.accent })
      + textShapeXml({ id: 1371 + itemIndex * 2, name: `Channel Policy Bullet Text ${itemIndex + 1}`, x: 932688, y, cx: 3352800, cy: 182880, text: channelPolicyCompactText(item, `政策要点 ${itemIndex + 1}`, 34), size: 700, bold: true, color: visual.body });
  }).join("");
}

function channelPolicyMetricsXml({ metrics, visual, palette }) {
  return metrics.map((metric, itemIndex) => {
    const x = 804672 + itemIndex * 1219200;
    return solidShapeXml({ id: 1380 + itemIndex * 3, name: `Channel Policy Metric Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3810000, cx: 1036320, cy: 609600, fill: "FFFFFF" })
      + rectShapeXml({ id: 1381 + itemIndex * 3, name: `Channel Policy Metric Accent ${itemIndex + 1}`, x, y: 3810000, cx: 1036320, cy: 60960, fill: itemIndex % 2 ? palette.gold : visual.accent })
      + textShapeXml({ id: 1382 + itemIndex * 3, name: `Channel Policy Metric Text ${itemIndex + 1}`, x: x + 121920, y: 3977640, cx: 792480, cy: 243840, text: `${metric.value} ${metric.label}`, size: 700, bold: true, color: visual.title });
  }).join("");
}

function channelPolicyNetworkXml({ visual, palette, startId }) {
  const nodes = [[5288280, 1546860, visual.accent], [7162800, 1600200, palette.gold], [5486400, 3154680, visual.warning || visual.accent], [7277100, 3185160, visual.accent], [6225540, 2324100, "FFFFFF"]];
  return solidShapeXml({ id: startId, name: "Channel Policy Network Panel", geom: "roundRect", x: 4876800, y: 1371600, cx: 3048000, cy: 2133600, fill: palette.panel })
    + arcLineShapeXml({ id: startId + 1, name: "Channel Policy Network Arc 1", x: 5265420, y: 1600200, cx: 1828800, cy: 1219200, stroke: visual.accent, width: 60960 })
    + arcLineShapeXml({ id: startId + 2, name: "Channel Policy Network Arc 2", x: 5554980, y: 1836420, cx: 1371600, cy: 914400, stroke: visual.primary, width: 45720 })
    + solidShapeXml({ id: startId + 3, name: "Channel Policy Partner Hub", geom: "roundRect", x: 6126480, y: 2209800, cx: 609600, cy: 609600, fill: visual.primary })
    + nodes.map(([x, y, fill], itemIndex) => solidShapeXml({ id: startId + 4 + itemIndex, name: `Channel Policy Network Node ${itemIndex + 1}`, geom: "ellipse", x, y, cx: 182880, cy: 182880, fill })).join("");
}

function channelPolicyOverviewCardsXml({ bullets, visual, palette }) {
  const fallbacks = ["准入门槛", "授权范围", "扶持政策"];
  return fallbacks.map((fallback, itemIndex) => {
    const y = 1371600 + itemIndex * 731520;
    return solidShapeXml({ id: 1390 + itemIndex * 3, name: `Channel Policy Overview Card ${itemIndex + 1}`, geom: "roundRect", x: 4876800, y, cx: 3048000, cy: 548640, fill: "FFFFFF" })
      + solidShapeXml({ id: 1391 + itemIndex * 3, name: `Channel Policy Overview Icon ${itemIndex + 1}`, geom: "roundRect", x: 5105400, y: y + 152400, cx: 304800, cy: 243840, fill: itemIndex % 2 ? palette.gold : visual.accent })
      + textShapeXml({ id: 1392 + itemIndex * 3, name: `Channel Policy Overview Text ${itemIndex + 1}`, x: 5577840, y: y + 167640, cx: 1981200, cy: 182880, text: channelPolicyCompactText(bullets[itemIndex], fallback, 16), size: 760, bold: true, color: visual.title });
  }).join("");
}

function channelPolicyRightsMatrixXml({ bullets, visual, palette }) {
  return [0, 1, 2, 3].map((itemIndex) => {
    const x = 4876800 + (itemIndex % 2) * 1447800;
    const y = 1371600 + Math.floor(itemIndex / 2) * 914400;
    return solidShapeXml({ id: 1320 + itemIndex * 3, name: `Channel Policy Rights Cell ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 670560, fill: itemIndex % 2 ? palette.softGold : palette.softGreen })
      + rectShapeXml({ id: 1321 + itemIndex * 3, name: `Channel Policy Rights Rule ${itemIndex + 1}`, x: x + 152400, y: y + 152400, cx: 426720, cy: 60960, fill: itemIndex % 2 ? palette.gold : visual.accent })
      + textShapeXml({ id: 1322 + itemIndex * 3, name: `Channel Policy Rights Text ${itemIndex + 1}`, x: x + 152400, y: y + 304800, cx: 914400, cy: 182880, text: channelPolicyCompactText(bullets[itemIndex], `权益 ${itemIndex + 1}`, 10), size: 720, bold: true, color: visual.title });
  }).join("");
}

function channelPolicyRevenuePanelXml({ bullets, visual, palette }) {
  return solidShapeXml({ id: 1330, name: "Channel Policy Revenue Panel", geom: "roundRect", x: 4876800, y: 1371600, cx: 3048000, cy: 2133600, fill: visual.primary })
    + [0, 1, 2, 3].map((itemIndex) => {
      const y = 1706880 + itemIndex * 365760;
      const width = [2286000, 1981200, 1676400, 1371600][itemIndex];
      return solidShapeXml({ id: 1331 + itemIndex * 2, name: `Channel Policy Revenue Bar ${itemIndex + 1}`, geom: "roundRect", x: 5257800, y, cx: width, cy: 243840, fill: itemIndex === 2 ? palette.gold : itemIndex % 2 ? visual.accent : "FFFFFF" })
        + textShapeXml({ id: 1332 + itemIndex * 2, name: `Channel Policy Revenue Text ${itemIndex + 1}`, x: 5486400, y: y + 45720, cx: 1524000, cy: 121920, text: channelPolicyCompactText(bullets[itemIndex], `收益 ${itemIndex + 1}`, 10), size: 620, bold: true, color: itemIndex % 2 ? "FFFFFF" : visual.title });
    }).join("");
}

function channelPolicyProcessXml({ bullets, visual }) {
  const fallbacks = ["提交申请", "资质审核", "政策确认", "签约授权", "启动赋能", "季度复盘"];
  return fallbacks.map((fallback, itemIndex) => {
    const x = 804672 + itemIndex * 1250000;
    return solidShapeXml({ id: 1340 + itemIndex * 2, name: `Channel Policy Process Arrow ${itemIndex + 1}`, geom: "chevron", x, y: 3665220, cx: 1036320, cy: 533400, fill: itemIndex % 2 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1341 + itemIndex * 2, name: `Channel Policy Process Text ${itemIndex + 1}`, x: x + 106680, y: 3840480, cx: 640080, cy: 152400, text: channelPolicyCompactText(bullets[itemIndex], fallback, 6), size: 560, bold: true, color: "FFFFFF" });
  }).join("");
}

function keyAccountDecisionDecorationsXml({ visual, index, role, slide }) {
  const scene = keyAccountDecisionSceneFromSlide({ slide, index, role });
  const palette = keyAccountDecisionColorPalette(visual);
  // 大客户攻坚模板导出端对齐在线预览：浅网格背景、白色工作区、左文右图，全部保留为可编辑形状。
  const backdrop = rectShapeXml({ id: 1120, name: "Key Account Decision Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + rectShapeXml({ id: 1121, name: "Key Account Decision Top Band", x: 0, y: 0, cx: 9144000, cy: 304800, fill: visual.primary })
    + rectShapeXml({ id: 1122, name: "Key Account Decision Top Accent", x: 0, y: 304800, cx: 9144000, cy: 30480, fill: visual.accent })
    + rectShapeXml({ id: 1126, name: "Key Account Decision Grid X", x: 944880, y: 365760, cx: 7620, cy: 4145280, fill: palette.grid, transparency: 45000 })
    + rectShapeXml({ id: 1127, name: "Key Account Decision Grid Y", x: 609600, y: 914400, cx: 7924800, cy: 7620, fill: palette.grid, transparency: 45000 });
  const workspace = solidShapeXml({ id: 1123, name: "Key Account Decision Workspace", geom: "roundRect", x: 609600, y: 670560, cx: 7924800, cy: 3657600, fill: visual.surface })
    + lineFrameShapeXml({ id: 1124, name: "Key Account Decision Workspace Border", geom: "roundRect", x: 609600, y: 670560, cx: 7924800, cy: 3657600, stroke: palette.frame, width: 10160 })
    + textShapeXml({ id: 1125, name: "Key Account Decision Kicker", x: 792480, y: 777240, cx: 2743200, cy: 274320, text: scene.kicker, size: 700, bold: true, color: visual.secondary || visual.accent });
  const bullets = keyAccountDecisionBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "matrix") return backdrop + workspace + bullets + keyAccountDecisionMatrixXml({ visual, palette, items: scene.matrix });
  if (scene.role === "roadmap") return backdrop + workspace + bullets + keyAccountDecisionRoadmapXml({ visual, palette, items: scene.path });
  if (scene.role === "closing") return backdrop + workspace + bullets + keyAccountDecisionClosingXml({ visual, palette, items: scene.matrix });
  if (scene.role === "path") return backdrop + workspace + bullets + keyAccountDecisionPathXml({ visual, palette, items: scene.path });
  return backdrop + workspace + bullets + keyAccountDecisionNetworkXml({ visual, palette }) + keyAccountDecisionTagCardsXml({ visual, tags: scene.tags });
}

function keyAccountDecisionNetworkXml({ visual, palette }) {
  const panel = solidShapeXml({ id: 1130, name: "Key Account Decision Network Panel", geom: "roundRect", x: 5359400, y: 975360, cx: 3200400, cy: 2286000, fill: palette.panel })
    + lineFrameShapeXml({ id: 1131, name: "Key Account Decision Network Border", geom: "roundRect", x: 5359400, y: 975360, cx: 3200400, cy: 2286000, stroke: palette.frame, width: 12700 });
  return panel
    // 右侧插画采用预览里的抽象链路风格，避免下载端出现另一套组织结构图。
    + rectShapeXml({ id: 1132, name: "Key Account Decision Link One", x: 5867400, y: 1584960, cx: 1905000, cy: 38100, fill: visual.accent, transparency: 9000 })
    + rectShapeXml({ id: 1133, name: "Key Account Decision Link Two", x: 5943600, y: 2255520, cx: 1905000, cy: 38100, fill: palette.line, transparency: 25000 })
    + rectShapeXml({ id: 1134, name: "Key Account Decision Link Three", x: 6096000, y: 2872740, cx: 1752600, cy: 38100, fill: visual.secondary || palette.teal, transparency: 32000 })
    + keyAccountDecisionNodeXml({ id: 1135, name: "Key Account Decision Center Node", x: 6652260, y: 1653540, cx: 701040, cy: 701040, fill: visual.accent, label: "", color: "FFFFFF" })
    + keyAccountDecisionRingNodeXml({ id: 1138, name: "Key Account Decision Left Ring", x: 5768340, y: 1493520, fill: visual.secondary || palette.teal })
    + keyAccountDecisionRingNodeXml({ id: 1141, name: "Key Account Decision Top Ring", x: 7673340, y: 1493520, fill: visual.primary })
    + keyAccountDecisionRingNodeXml({ id: 1144, name: "Key Account Decision Bottom Ring", x: 6065520, y: 2674620, fill: visual.accent })
    + solidShapeXml({ id: 1147, name: "Key Account Decision Deep Dot", geom: "ellipse", x: 8077200, y: 2926080, cx: 365760, cy: 365760, fill: palette.deep })
    + solidShapeXml({ id: 1148, name: "Key Account Decision Teal Dot", geom: "ellipse", x: 5707380, y: 2827020, cx: 365760, cy: 365760, fill: visual.secondary || palette.teal });
}

function keyAccountDecisionNodeXml({ id, name, x, y, cx, cy, fill, label, color }) {
  return solidShapeXml({ id, name, geom: "ellipse", x, y, cx, cy, fill })
    + textShapeXml({ id: id + 1, name: `${name} Label`, x, y: y + cy * 0.30, cx, cy: cy * 0.36, text: label, size: 720, bold: true, color });
}

function keyAccountDecisionRingNodeXml({ id, name, x, y, fill }) {
  return solidShapeXml({ id, name, geom: "ellipse", x, y, cx: 320040, cy: 320040, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: id + 1, name: `${name} Border`, geom: "ellipse", x, y, cx: 320040, cy: 320040, stroke: fill, width: 38100 })
    + solidShapeXml({ id: id + 2, name: `${name} Core`, geom: "ellipse", x: x + 99060, y: y + 99060, cx: 121920, cy: 121920, fill });
}

function keyAccountDecisionTagCardsXml({ visual, tags }) {
  return tags.slice(0, 3).map((tag, index) => {
    const x = 792480 + index * 853440;
    return solidShapeXml({ id: 1150 + index * 3, name: `Key Account Decision Tag Card ${index + 1}`, geom: "roundRect", x, y: 3505200, cx: 731520, cy: 396240, fill: "FFFFFF" })
      + rectShapeXml({ id: 1151 + index * 3, name: `Key Account Decision Tag Accent ${index + 1}`, x, y: 3505200, cx: 731520, cy: 45720, fill: index === 1 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1152 + index * 3, name: `Key Account Decision Tag Text ${index + 1}`, x: x + 76200, y: 3665220, cx: 579120, cy: 182880, text: keyAccountDecisionCompactText(tag, "", 9), size: 620, bold: true, color: visual.title });
  }).join("");
}

function keyAccountDecisionBulletCardsXml({ visual, scene, isCover }) {
  return scene.bullets.slice(0, isCover ? 3 : 4).map((item, index) => {
    const y = (isCover ? 2385060 : 1981200) + index * (isCover ? 320040 : 411480);
    const cardWidth = isCover ? 3505200 : 3962400;
    const cardHeight = isCover ? 259080 : 335280;
    const accent = index % 2 ? visual.accent : visual.primary;
    // 下载端正文用卡片行强化信息层级，避免主内容看起来比标题弱很多。
    return solidShapeXml({ id: 1160 + index * 4, name: `Key Account Decision Bullet Card ${index + 1}`, geom: "roundRect", x: 792480, y: y - 45720, cx: cardWidth, cy: cardHeight, fill: blendHexColor(visual.background, visual.surface, 0.76) })
      + rectShapeXml({ id: 1161 + index * 4, name: `Key Account Decision Bullet Rule ${index + 1}`, x: 792480, y: y - 45720, cx: 60960, cy: cardHeight, fill: accent })
      + textShapeXml({ id: 1162 + index * 4, name: `Key Account Decision Bullet Text ${index + 1}`, x: 990600, y: y + 30480, cx: cardWidth - 304800, cy: cardHeight - 91440, text: keyAccountDecisionCompactText(item, scene.title, isCover ? 34 : 40), size: isCover ? 720 : 760, bold: true, color: visual.body });
  }).join("");
}

function keyAccountDecisionPathXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 5006340 + index * 883920;
    return solidShapeXml({ id: 1180 + index * 4, name: `Key Account Decision Path Step ${index + 1}`, geom: "chevron", x, y: 1950720, cx: 792480, cy: 609600, fill: index % 2 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1181 + index * 4, name: `Key Account Decision Path Step Text ${index + 1}`, x: x + 91440, y: 2118360, cx: 579120, cy: 182880, text: keyAccountDecisionCompactText(item, `阶段 ${index + 1}`, 8), size: 660, bold: true, color: "FFFFFF" });
  }).join("");
}

function keyAccountDecisionMatrixXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 5173980 + (index % 2) * 1516380;
    const y = 1516380 + Math.floor(index / 2) * 792480;
    return solidShapeXml({ id: 1200 + index * 3, name: `Key Account Decision Matrix Card ${index + 1}`, geom: "roundRect", x, y, cx: 1371600, cy: 640080, fill: palette.panel })
      + rectShapeXml({ id: 1201 + index * 3, name: `Key Account Decision Matrix Accent ${index + 1}`, x, y, cx: 60960, cy: 640080, fill: index % 2 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1202 + index * 3, name: `Key Account Decision Matrix Text ${index + 1}`, x: x + 152400, y: y + 167640, cx: 1066800, cy: 243840, text: keyAccountDecisionCompactText(item, `角色 ${index + 1}`, 12), size: 720, bold: true, color: visual.title });
  }).join("");
}

function keyAccountDecisionRoadmapXml({ visual, palette, items }) {
  const rail = rectShapeXml({ id: 1220, name: "Key Account Decision Roadmap Rail", x: 5082540, y: 2590800, cx: 2895600, cy: 45720, fill: palette.frame });
  return rail + items.slice(0, 4).map((item, index) => {
    const x = 4930140 + index * 838200;
    return solidShapeXml({ id: 1221 + index * 4, name: `Key Account Decision Roadmap Card ${index + 1}`, geom: "roundRect", x, y: 1661160, cx: 701040, cy: 731520, fill: index % 2 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1222 + index * 4, name: `Key Account Decision Roadmap Text ${index + 1}`, x: x + 76200, y: 1828800, cx: 548640, cy: 274320, text: keyAccountDecisionCompactText(item, `推进 ${index + 1}`, 8), size: 650, bold: true, color: "FFFFFF" });
  }).join("");
}

function keyAccountDecisionClosingXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 5036820 + index * 1036320;
    return solidShapeXml({ id: 1240 + index * 3, name: `Key Account Decision Closing Card ${index + 1}`, geom: "roundRect", x, y: 2506980, cx: 914400, cy: 731520, fill: palette.panel })
      + rectShapeXml({ id: 1241 + index * 3, name: `Key Account Decision Closing Accent ${index + 1}`, x: x + 121920, y: 2667000, cx: 45720, cy: 320040, fill: visual.accent })
      + textShapeXml({ id: 1242 + index * 3, name: `Key Account Decision Closing Text ${index + 1}`, x: x + 228600, y: 2636520, cx: 548640, cy: 274320, text: keyAccountDecisionCompactText(item, `行动 ${index + 1}`, 10), size: 690, bold: true, color: visual.title });
  }).join("");
}

function keyAccountDecisionSceneFromSlide({ slide, index, role }) {
  const bullets = keyAccountDecisionBulletTexts(slide);
  const title = keyAccountDecisionCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const layout = String(slide?.layout || "").toLowerCase();
  const resolvedRole = role === "closing" || layout.includes("closing")
    ? "closing"
    : layout.includes("organization")
      ? "organization"
    : layout.includes("matrix") || layout.includes("stakeholder")
      ? "matrix"
      : layout.includes("roadmap") || layout.includes("win")
        ? "roadmap"
        : layout.includes("path") || layout.includes("decision")
          ? "path"
      : index === 0
        ? "cover"
        : index === 1
          ? "organization"
        : index === 2
          ? "path"
          : index === 3
            ? "matrix"
            : index >= 4
              ? "roadmap"
              : "organization";
  return {
    role: resolvedRole,
    kicker: resolvedRole === "cover" ? "KEY ACCOUNT COMMAND MAP" : resolvedRole === "organization" ? "STAKEHOLDER NETWORK" : resolvedRole === "path" ? "DECISION PATH" : resolvedRole === "matrix" ? "INFLUENCE MATRIX" : resolvedRole === "roadmap" ? "WIN PLAN ROADMAP" : "NEXT ACTION",
    title,
    bullets: bullets.length > 0 ? bullets : ["识别关键决策人和影响链路", "拆解客户组织关系与采购路径", "明确推进节奏、责任人和赢单动作"],
    tags: ["决策人", "影响者", "推进动作"].map((fallback, itemIndex) => keyAccountDecisionCompactText(bullets[itemIndex], fallback, 8)),
    path: ["需求确认", "技术评估", "商务测算", "高层拍板", "合同推进"].map((fallback, itemIndex) => keyAccountDecisionCompactText(bullets[itemIndex], fallback, 8)),
    matrix: ["重点突破", "维持支持", "风险转化", "持续观察"].map((fallback, itemIndex) => keyAccountDecisionCompactText(bullets[itemIndex], fallback, 10)),
  };
}

function keyAccountDecisionBulletTexts(slide) {
  return Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
}

function keyAccountDecisionCompactText(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function keyAccountDecisionColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.35),
    panel: blendHexColor(visual.background, visual.surface, 0.70),
    frame: blendHexColor(visual.primary, visual.surface, 0.72),
    grid: blendHexColor(visual.secondary || "15A39A", visual.surface, 0.78),
    line: blendHexColor(visual.primary, visual.surface, 0.82),
    teal: visual.secondary || "15A39A",
    deep: blendHexColor(visual.primary, "000000", 0.14),
  };
}

function isKeyAccountDecisionVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "sales-key-account-decision-chain" && (id === "key-account-plan" || id === "sales-key-account-plan-decision-chain");
}

function simpleProfitBridgeDecorationsXml({ visual, index }) {
  // 利润桥模板先补齐可编辑核心图层，保证导出端不会退回普通正文页。
  const base = solidShapeXml({ id: 1260, name: "Profit Bridge Workspace", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, fill: visual.surface })
    + lineFrameShapeXml({ id: 1261, name: "Profit Bridge Workspace Border", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, stroke: visual.primary, width: 10160 })
    + rectShapeXml({ id: 1264, name: "Profit Bridge Accent Rule", x: 548640, y: 609600, cx: 8046720, cy: 45720, fill: visual.accent });
  if (index === 2) return base + solidShapeXml({ id: 1262, name: "Profit Bridge Margin Stack Panel", geom: "roundRect", x: 5359400, y: 1371600, cx: 2590800, cy: 2133600, fill: blendHexColor(visual.background, visual.surface, 0.62) });
  if (index === 3) return base + simpleNamedCardsXml({ prefix: "Profit Bridge Factor Card", startId: 1270, visual, x: 5173980, y: 1516380 });
  if (index >= 4) return base + simpleNamedCardsXml({ prefix: "Profit Bridge Action Card", startId: 1280, visual, x: 5173980, y: 1516380 });
  return base + solidShapeXml({ id: 1263, name: "Profit Bridge Waterfall Panel", geom: "roundRect", x: 5173980, y: 1219200, cx: 2895600, cy: 2286000, fill: blendHexColor(visual.background, visual.surface, 0.72) });
}

function simpleChannelPolicyDecorationsXml({ visual, index }) {
  // 渠道招商合作政策模板补齐政策网络、权益矩阵、收益模型和流程箭头。
  const base = solidShapeXml({ id: 1300, name: "Channel Policy Workspace", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, fill: visual.surface })
    + lineFrameShapeXml({ id: 1301, name: "Channel Policy Workspace Border", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, stroke: blendHexColor(visual.primary, visual.surface, 0.70), width: 10160 });
  if (index === 2) return base + simpleNamedCardsXml({ prefix: "Channel Policy Rights Cell", startId: 1310, visual, x: 5173980, y: 1516380 });
  if (index === 3) return base + solidShapeXml({ id: 1320, name: "Channel Policy Revenue Panel", geom: "roundRect", x: 5173980, y: 1371600, cx: 2743200, cy: 2133600, fill: blendHexColor(visual.background, visual.surface, 0.62) });
  if (index >= 4) return base + simpleArrowStepsXml({ prefix: "Channel Policy Process Arrow", startId: 1330, visual, x: 4930140, y: 2057400 });
  return base + solidShapeXml({ id: 1302, name: "Channel Policy Network Panel", geom: "roundRect", x: 5359400, y: 1219200, cx: 2590800, cy: 2286000, fill: blendHexColor(visual.background, visual.surface, 0.72) });
}

function simpleInterviewInsightDecorationsXml({ visual, index }) {
  // 用户访谈洞察模板补齐样本卡、原声卡和聚类面板，导出后仍然是可编辑形状。
  const base = solidShapeXml({ id: 1360, name: "Interview Insight Surface", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, fill: visual.surface })
    + lineFrameShapeXml({ id: 1361, name: "Interview Insight Surface Border", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, stroke: visual.primary, width: 10160 })
    + rectShapeXml({ id: 1363, name: "Interview Insight Accent Rule", x: 548640, y: 609600, cx: 8046720, cy: 45720, fill: visual.accent });
  if (index === 1) return base + simpleNamedCardsXml({ prefix: "Interview Quote Card", startId: 1370, visual, x: 5173980, y: 1516380 });
  if (index >= 2) return base + solidShapeXml({ id: 1380, name: "Interview Cluster Panel", geom: "roundRect", x: 5173980, y: 1371600, cx: 2743200, cy: 2133600, fill: blendHexColor(visual.background, visual.surface, 0.62) });
  return base + solidShapeXml({ id: 1362, name: "Interview Sample Card", geom: "roundRect", x: 5359400, y: 1371600, cx: 2438400, cy: 1828800, fill: blendHexColor(visual.background, visual.surface, 0.72) });
}

function simpleProductPricingDecorationsXml({ visual, index }) {
  // 定价策略模板补齐套餐卡、权益矩阵和商业闭环，导出端不再退回通用正文页。
  const base = solidShapeXml({ id: 1420, name: "Product Pricing Canvas", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, fill: visual.surface })
    + lineFrameShapeXml({ id: 1421, name: "Product Pricing Canvas Border", geom: "roundRect", x: 548640, y: 609600, cx: 8046720, cy: 4114800, stroke: visual.primary, width: 10160 })
    + rectShapeXml({ id: 1422, name: "Product Pricing Accent Rule", x: 548640, y: 609600, cx: 8046720, cy: 45720, fill: visual.accent });
  if (index === 1) return base + simpleNamedCardsXml({ prefix: "Product Pricing Tier Card", startId: 1430, visual, x: 5173980, y: 1371600 });
  if (index === 3) return base + solidShapeXml({ id: 1440, name: "Product Pricing Benefit Matrix", geom: "roundRect", x: 5173980, y: 1371600, cx: 2743200, cy: 2133600, fill: blendHexColor(visual.background, visual.surface, 0.62) });
  if (index >= 4) return base + solidShapeXml({ id: 1441, name: "Product Pricing Commercial Loop", geom: "ellipse", x: 5359400, y: 1371600, cx: 2133600, cy: 2133600, fill: blendHexColor(visual.background, visual.surface, 0.72) });
  return base + solidShapeXml({ id: 1423, name: "Product Pricing Mockup Panel", geom: "roundRect", x: 5359400, y: 1371600, cx: 2438400, cy: 1828800, fill: blendHexColor(visual.background, visual.surface, 0.72) });
}

function cashFlowForecastDecorationsXml({ visual, index, role, slide }) {
  const scene = cashFlowForecastSceneFromSlide({ slide, index, role });
  const palette = cashFlowForecastColorPalette(visual);
  // 现金流模板导出端复刻在线预览的网格底、白色工作台和财务图表区域，避免退回空白占位图形。
  const backdrop = rectShapeXml({ id: 1390, name: "Cash Flow Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 1391, name: "Cash Flow Left Liquidity Glow", geom: "ellipse", x: -457200, y: 3200400, cx: 4876800, cy: 2057400, fill: palette.tealWash })
    + solidShapeXml({ id: 1392, name: "Cash Flow Right Forecast Glow", geom: "ellipse", x: 6807200, y: 365760, cx: 2057400, cy: 1828800, fill: palette.blueWash })
    + cashFlowGridXml({ visual, palette });
  const surface = solidShapeXml({ id: 1398, name: "Cash Flow Workspace", geom: "roundRect", x: 566928, y: 591312, cx: 8001000, cy: 4145280, fill: visual.surface })
    + lineFrameShapeXml({ id: 1399, name: "Cash Flow Workspace Border", geom: "roundRect", x: 566928, y: 591312, cx: 8001000, cy: 4145280, stroke: palette.frame, width: 15240 });
  const ruleY = index === 0 ? 2286000 : 1684020;
  const header = solidShapeXml({ id: 1400, name: "Cash Flow Header Bar", x: 0, y: 0, cx: 9144000, cy: 342900, fill: visual.primary })
    + rectShapeXml({ id: 1401, name: "Cash Flow Header Accent", x: 0, y: 342900, cx: 9144000, cy: 22860, fill: visual.accent })
    + textShapeXml({ id: 1402, name: "Cash Flow Kicker", x: 804672, y: 792480, cx: 2438400, cy: 274320, text: scene.kicker, size: 760, bold: true, color: visual.accent })
    + rectShapeXml({ id: 1403, name: "Cash Flow Focus Rule", x: 804672, y: ruleY, cx: index === 0 ? 3200400 : 2590800, cy: 30480, fill: visual.accent })
    + rectShapeXml({ id: 1404, name: "Cash Flow Secondary Rule", x: 804672, y: ruleY + 53340, cx: index === 0 ? 1828800 : 1371600, cy: 15240, fill: visual.secondary || visual.accent });
  const bullets = cashFlowBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "cycle") return backdrop + surface + header + bullets + cashFlowCycleXml({ visual, palette, steps: scene.cycleSteps });
  if (scene.role === "receivables") return backdrop + surface + header + bullets + cashFlowReceivablesXml({ visual, palette, rows: scene.receivableRows });
  if (scene.role === "risk") return backdrop + surface + header + bullets + cashFlowRiskCardsXml({ visual, palette, cards: scene.riskCards });
  if (scene.role === "dashboard") return backdrop + surface + header + bullets + cashFlowDashboardXml({ visual, palette, cards: scene.riskCards });
  if (scene.role === "closing") return backdrop + surface + header + cashFlowClosingXml({ visual, palette, items: scene.riskCards });
  if (scene.role === "waterfall") return backdrop + surface + header + bullets + cashFlowWaterfallXml({ visual, palette });
  return backdrop + surface + header + bullets + cashFlowForecastChartXml({ visual, palette }) + cashFlowMetricCardsXml({ visual, metrics: scene.metrics, palette });
}

function cashFlowGridXml({ visual, palette }) {
  // 用浅色细线模拟在线预览的网格背景，控制数量避免导出体积过大。
  const vertical = [914400, 1371600, 1828800, 2286000, 2743200, 3200400, 3657600, 4114800, 4572000, 5029200, 5486400, 5943600, 6400800, 6858000, 7315200, 7772400, 8229600]
    .map((x, itemIndex) => rectShapeXml({ id: 1410 + itemIndex, name: `Cash Flow Grid Vertical ${itemIndex + 1}`, x, y: 365760, cx: 7620, cy: 4419600, fill: palette.grid })).join("");
  const horizontal = [762000, 1143000, 1524000, 1905000, 2286000, 2667000, 3048000, 3429000, 3810000, 4191000, 4572000]
    .map((y, itemIndex) => rectShapeXml({ id: 1430 + itemIndex, name: `Cash Flow Grid Horizontal ${itemIndex + 1}`, x: 457200, y, cx: 8229600, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal + solidShapeXml({ id: 1445, name: "Cash Flow Grid Soft Mask", geom: "roundRect", x: 566928, y: 591312, cx: 8001000, cy: 4145280, fill: blendHexColor(visual.surface, visual.background, 0.24) });
}

function cashFlowForecastChartXml({ visual, palette }) {
  const panel = solidShapeXml({ id: 1450, name: "Cash Flow Forecast Chart", geom: "roundRect", x: 5486400, y: 975360, cx: 3048000, cy: 2514600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1451, name: "Cash Flow Forecast Chart Border", geom: "roundRect", x: 5486400, y: 975360, cx: 3048000, cy: 2514600, stroke: palette.frame, width: 10160 });
  const grid = [0, 1, 2, 3, 4].map((itemIndex) => rectShapeXml({ id: 1455 + itemIndex, name: `Cash Flow Chart Grid Row ${itemIndex + 1}`, x: 5791200, y: 1371600 + itemIndex * 365760, cx: 2438400, cy: 7620, fill: palette.grid })).join("")
    + [0, 1, 2, 3, 4].map((itemIndex) => rectShapeXml({ id: 1465 + itemIndex, name: `Cash Flow Chart Grid Column ${itemIndex + 1}`, x: 5943600 + itemIndex * 457200, y: 1219200, cx: 7620, cy: 1676400, fill: palette.grid })).join("");
  const trend = rectShapeXml({ id: 1475, name: "Cash Flow Forecast Trend Line", x: 5943600, y: 2514600, cx: 2438400, cy: 76200, fill: visual.accent })
    + rectShapeXml({ id: 1476, name: "Cash Flow Forecast Target Line", x: 6858000, y: 1905000, cx: 1371600, cy: 38100, fill: visual.secondary || visual.accent })
    + rectShapeXml({ id: 1477, name: "Cash Flow Forecast Risk Line", x: 6858000, y: 1676400, cx: 1371600, cy: 38100, fill: visual.warning || "E05F3F" });
  return panel + grid + trend;
}

function cashFlowMetricCardsXml({ visual, metrics, palette }) {
  return metrics.slice(0, 3).map((metric, itemIndex) => {
    const x = 804672 + itemIndex * 1257300;
    const color = [visual.accent, visual.secondary || visual.accent, visual.warning || "E05F3F"][itemIndex] || visual.accent;
    return solidShapeXml({ id: 1485 + itemIndex * 5, name: `Cash Flow Metric Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3749040, cx: 1066800, cy: 640080, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1486 + itemIndex * 5, name: `Cash Flow Metric Card Border ${itemIndex + 1}`, geom: "roundRect", x, y: 3749040, cx: 1066800, cy: 640080, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1487 + itemIndex * 5, name: `Cash Flow Metric Accent ${itemIndex + 1}`, x, y: 3749040, cx: 1066800, cy: 45720, fill: color })
      + textShapeXml({ id: 1488 + itemIndex * 5, name: `Cash Flow Metric Value ${itemIndex + 1}`, x: x + 121920, y: 3893820, cx: 822960, cy: 228600, text: metric.value, size: 1180, bold: true, color: visual.title })
      + textShapeXml({ id: 1489 + itemIndex * 5, name: `Cash Flow Metric Label ${itemIndex + 1}`, x: x + 121920, y: 4160520, cx: 822960, cy: 182880, text: metric.label, size: 620, bold: true, color: visual.body });
  }).join("");
}

function cashFlowBulletCardsXml({ visual, scene, isCover }) {
  return scene.bullets.slice(0, isCover ? 3 : 4).map((item, itemIndex) => {
    const y = (isCover ? 2537460 : 2164080) + itemIndex * (isCover ? 243840 : 396240);
    const cardWidth = isCover ? 3352800 : 3505200;
    const accent = itemIndex % 2 === 1 ? visual.secondary || visual.accent : visual.accent;
    // 内容页把 bullet 放入浅色卡片，避免长句和分隔线、右侧图表互相压住。
    return solidShapeXml({ id: 1510 + itemIndex * 4, name: `Cash Flow Bullet Card ${itemIndex + 1}`, geom: "roundRect", x: 804672, y: y - 45720, cx: cardWidth, cy: isCover ? 259080 : 304800, fill: blendHexColor(visual.background, visual.surface, 0.72) })
      + rectShapeXml({ id: 1511 + itemIndex * 4, name: `Cash Flow Bullet Accent ${itemIndex + 1}`, x: 804672, y: y - 45720, cx: 45720, cy: isCover ? 259080 : 304800, fill: accent })
      + textShapeXml({ id: 1512 + itemIndex * 4, name: `Cash Flow Bullet Text ${itemIndex + 1}`, x: 990600, y: y + (isCover ? 15240 : 45720), cx: cardWidth - 304800, cy: isCover ? 182880 : 213360, text: budgetPlanningCompactText(item, scene.title, isCover ? 32 : 28), size: isCover ? 760 : 650, bold: true, color: visual.body });
  }).join("");
}

function cashFlowWaterfallXml({ visual, palette }) {
  const heights = [1371600, 914400, 1219200, 670560, 1036320, 1524000];
  const colors = [visual.primary, visual.accent, visual.secondary || visual.accent, visual.warning || "E05F3F", visual.accent, visual.primary];
  const bars = heights.map((height, itemIndex) => {
    const x = 5783580 + itemIndex * 396240;
    return rectShapeXml({ id: 1530 + itemIndex, name: `Cash Flow Waterfall Bar ${itemIndex + 1}`, x, y: 3192780 - height, cx: 274320, cy: height, fill: colors[itemIndex] });
  }).join("");
  return solidShapeXml({ id: 1525, name: "Cash Flow Waterfall Panel", geom: "roundRect", x: 5486400, y: 1066800, cx: 3048000, cy: 2514600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1526, name: "Cash Flow Waterfall Border", geom: "roundRect", x: 5486400, y: 1066800, cx: 3048000, cy: 2514600, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 1527, name: "Cash Flow Waterfall Axis", x: 5783580, y: 3192780, cx: 2438400, cy: 22860, fill: palette.frame })
    + bars;
}

function cashFlowCycleXml({ visual, palette, steps }) {
  const nodes = [
    { x: 6553200, y: 1219200 },
    { x: 7467600, y: 2133600 },
    { x: 6553200, y: 3048000 },
    { x: 5638800, y: 2133600 },
  ];
  const cards = nodes.map((node, itemIndex) => solidShapeXml({ id: 1560 + itemIndex * 3, name: `Cash Flow Cycle Node ${itemIndex + 1}`, geom: "roundRect", x: node.x, y: node.y, cx: 853440, cy: 426720, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1561 + itemIndex * 3, name: `Cash Flow Cycle Node Border ${itemIndex + 1}`, geom: "roundRect", x: node.x, y: node.y, cx: 853440, cy: 426720, stroke: itemIndex % 2 ? visual.secondary || visual.accent : visual.accent, width: 12700 })
    + textShapeXml({ id: 1562 + itemIndex * 3, name: `Cash Flow Cycle Text ${itemIndex + 1}`, x: node.x + 91440, y: node.y + 121920, cx: 670560, cy: 152400, text: budgetPlanningCompactText(steps[itemIndex], "", 8), size: 660, bold: true, color: visual.title })).join("");
  return solidShapeXml({ id: 1550, name: "Cash Flow Turnover Cycle", geom: "ellipse", x: 5943600, y: 1371600, cx: 1981200, cy: 1981200, fill: palette.panel })
    + arcLineShapeXml({ id: 1551, name: "Cash Flow Cycle Arc", x: 6065520, y: 1493520, cx: 1737360, cy: 1737360, stroke: visual.accent, width: 76200 })
    + cards;
}

function cashFlowReceivablesXml({ visual, palette, rows }) {
  const tableX = 5486400;
  const tableY = 1219200;
  const rowH = 457200;
  const tableW = 3048000;
  const shell = solidShapeXml({ id: 1585, name: "Cash Flow Receivables Table", geom: "roundRect", x: tableX, y: tableY, cx: tableW, cy: rowH * rows.length, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1586, name: "Cash Flow Receivables Table Border", geom: "roundRect", x: tableX, y: tableY, cx: tableW, cy: rowH * rows.length, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 1587, name: "Cash Flow Receivables Header", x: tableX, y: tableY, cx: tableW, cy: rowH, fill: visual.primary });
  const cells = rows.map((row, rowIndex) => {
    const y = tableY + rowIndex * rowH;
    const rule = rowIndex > 0 ? rectShapeXml({ id: 1590 + rowIndex, name: `Cash Flow Receivables Row Rule ${rowIndex}`, x: tableX, y, cx: tableW, cy: 7620, fill: palette.grid }) : "";
    return rule + row.map((cell, cellIndex) => textShapeXml({
      id: 1600 + rowIndex * 8 + cellIndex,
      name: `Cash Flow Receivables Cell ${rowIndex + 1}-${cellIndex + 1}`,
      x: tableX + 137160 + cellIndex * 701040,
      y: y + 137160,
      cx: 640080,
      cy: 152400,
      text: budgetPlanningCompactText(cell, "", cellIndex === 0 ? 9 : 6),
      size: rowIndex === 0 ? 620 : 560,
      bold: true,
      color: rowIndex === 0 ? "FFFFFF" : visual.body,
    })).join("");
  }).join("");
  return shell + cells;
}

function cashFlowRiskCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, itemIndex) => {
    const x = 5262880 + (itemIndex % 2) * 1630680;
    const y = 1905000 + Math.floor(itemIndex / 2) * 914400;
    const color = [visual.accent, visual.secondary || visual.accent, visual.warning || "E05F3F", visual.primary][itemIndex] || visual.accent;
    return solidShapeXml({ id: 1640 + itemIndex * 4, name: `Cash Flow Risk Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1447800, cy: 670560, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1641 + itemIndex * 4, name: `Cash Flow Risk Card Border ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1447800, cy: 670560, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1642 + itemIndex * 4, name: `Cash Flow Risk Accent ${itemIndex + 1}`, x, y, cx: 60960, cy: 670560, fill: color })
      + textShapeXml({ id: 1643 + itemIndex * 4, name: `Cash Flow Risk Text ${itemIndex + 1}`, x: x + 198120, y: y + 213360, cx: 1036320, cy: 228600, text: budgetPlanningCompactText(card, "", 16), size: 620, bold: true, color: visual.title });
  }).join("");
}

function cashFlowDashboardXml({ visual, palette, cards }) {
  const main = solidShapeXml({ id: 1670, name: "Cash Flow Dashboard Main Card", geom: "roundRect", x: 5262880, y: 1905000, cx: 1447800, cy: 1584960, fill: visual.primary })
    + textShapeXml({ id: 1671, name: "Cash Flow Dashboard Main Text", x: 5430520, y: 2545080, cx: 1066800, cy: 304800, text: budgetPlanningCompactText(cards[0], "", 12), size: 680, bold: true, color: "FFFFFF" });
  const side = cards.slice(1, 3).map((card, itemIndex) => {
    const y = 1905000 + itemIndex * 838200;
    return solidShapeXml({ id: 1680 + itemIndex * 3, name: `Cash Flow Dashboard Side Card ${itemIndex + 1}`, geom: "roundRect", x: 7010400, y, cx: 1447800, cy: 670560, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1681 + itemIndex * 3, name: `Cash Flow Dashboard Side Border ${itemIndex + 1}`, geom: "roundRect", x: 7010400, y, cx: 1447800, cy: 670560, stroke: palette.frame, width: 10160 })
      + textShapeXml({ id: 1682 + itemIndex * 3, name: `Cash Flow Dashboard Side Text ${itemIndex + 1}`, x: 7162800, y: y + 228600, cx: 1066800, cy: 182880, text: budgetPlanningCompactText(card, "", 12), size: 620, bold: true, color: visual.title });
  }).join("");
  return main + side;
}

function cashFlowClosingXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, itemIndex) => {
    const x = 914400 + itemIndex * 2316480;
    return solidShapeXml({ id: 1700 + itemIndex * 4, name: `Cash Flow Closing Card ${itemIndex + 1}`, geom: "roundRect", x, y: 2895600, cx: 1859280, cy: 914400, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1701 + itemIndex * 4, name: `Cash Flow Closing Card Border ${itemIndex + 1}`, geom: "roundRect", x, y: 2895600, cx: 1859280, cy: 914400, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1702 + itemIndex * 4, name: `Cash Flow Closing Card Accent ${itemIndex + 1}`, x: x + 182880, y: 3192780, cx: 365760, cy: 30480, fill: itemIndex === 1 ? visual.secondary || visual.accent : visual.accent })
      + textShapeXml({ id: 1703 + itemIndex * 4, name: `Cash Flow Closing Card Text ${itemIndex + 1}`, x: x + 182880, y: 3314700, cx: 1371600, cy: 243840, text: budgetPlanningCompactText(item, "", 14), size: 720, bold: true, color: visual.title });
  }).join("");
}

function cashFlowForecastSceneFromSlide({ slide, index, role }) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  const resolvedRole = cashFlowForecastRoleFromSlide({ slide, index, role });
  const metrics = [0, 1, 2].map((itemIndex) => cashFlowMetricFromText(bullets[itemIndex], itemIndex));
  return {
    role: resolvedRole,
    kicker: resolvedRole === "cover" ? "CASH FLOW REPORT" : "LIQUIDITY BOARD",
    title: budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 28 : 24),
    bullets: bullets.slice(0, resolvedRole === "cover" ? 3 : 4),
    metrics,
    cycleSteps: [
      budgetPlanningCompactText(bullets[0], "销售确认", 10),
      budgetPlanningCompactText(bullets[1], "开票回款", 10),
      budgetPlanningCompactText(bullets[2], "资金调拨", 10),
      budgetPlanningCompactText(bullets[3], "风险复盘", 10),
    ],
    receivableRows: [
      ["客户/账期", "金额", "状态", "动作"],
      ...[0, 1, 2].map((rowIndex) => [
        budgetPlanningCompactText(bullets[rowIndex], `回款项 ${rowIndex + 1}`, 12),
        metrics[rowIndex].value,
        ["跟进", "预警", "确认"][rowIndex],
        ["催收", "对账", "锁定"][rowIndex],
      ]),
    ],
    riskCards: [
      budgetPlanningCompactText(bullets[0], "现金缺口预警", 14),
      budgetPlanningCompactText(bullets[1], "大客户回款延迟", 14),
      budgetPlanningCompactText(bullets[2], "资金周转压力", 14),
      budgetPlanningCompactText(bullets[3], "融资窗口判断", 14),
    ],
  };
}

function cashFlowForecastRoleFromSlide({ slide, index, role }) {
  const layout = String(slide?.layout || "").toLowerCase();
  if (index === 0 || layout.includes("cover")) return "cover";
  if (role === "closing" || layout.includes("closing")) return "closing";
  if (layout.includes("waterfall")) return "waterfall";
  if (layout.includes("turnover") || layout.includes("cycle")) return "cycle";
  if (layout.includes("receivable") || layout.includes("collection")) return "receivables";
  if (layout.includes("risk") || layout.includes("warning")) return "risk";
  if (layout.includes("dashboard") || layout.includes("forecast")) return "dashboard";
  return ["waterfall", "cycle", "receivables", "risk", "dashboard"][(index - 1) % 5];
}

function cashFlowMetricFromText(text, index) {
  const fallbackValues = ["13周", "￥8.6M", "42天"];
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValues[index] || "00", label: ["预测周期", "安全余额", "回款账期"][index] || `指标 ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*(?:万|亿|%|元|M|m|周|天|月)?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValues[index] || "00";
  const labelSource = match ? raw.replace(match[1], "") : raw;
  return { value, label: budgetPlanningCompactText(labelSource.replace(/[：:，,。]/g, " ").trim(), raw, 10) };
}

function cashFlowForecastColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.28),
    tealWash: blendHexColor(visual.accent, visual.background, 0.86),
    blueWash: blendHexColor(visual.secondary || visual.accent, visual.background, 0.86),
    panel: blendHexColor(visual.background, visual.surface, 0.68),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    grid: blendHexColor(visual.primary, visual.surface, 0.90),
  };
}

function simpleNamedCardsXml({ prefix, startId, visual, x, y }) {
  return [0, 1, 2, 3].map((itemIndex) => {
    const cardX = x + (itemIndex % 2) * 1371600;
    const cardY = y + Math.floor(itemIndex / 2) * 731520;
    return solidShapeXml({ id: startId + itemIndex * 2, name: `${prefix} ${itemIndex + 1}`, geom: "roundRect", x: cardX, y: cardY, cx: 1219200, cy: 548640, fill: blendHexColor(visual.background, visual.surface, 0.62) })
      + rectShapeXml({ id: startId + itemIndex * 2 + 1, name: `${prefix} Accent ${itemIndex + 1}`, x: cardX, y: cardY, cx: 60960, cy: 548640, fill: itemIndex % 2 ? visual.accent : visual.primary });
  }).join("");
}

function simpleArrowStepsXml({ prefix, startId, visual, x, y }) {
  return [0, 1, 2, 3].map((itemIndex) => solidShapeXml({ id: startId + itemIndex, name: `${prefix} ${itemIndex + 1}`, geom: "chevron", x: x + itemIndex * 746760, y, cx: 670560, cy: 609600, fill: itemIndex % 2 ? visual.accent : visual.primary })).join("");
}

function manufacturingSolutionDecorationsXml({ visual, index, role, slide }) {
  const scene = manufacturingSolutionSceneFromSlide({ slide, index, role });
  const palette = manufacturingSolutionColorPalette(visual);
  // 制造行业模板全部用 DrawingML 形状绘制，工厂、流程、看板都保持可编辑。
  const backdrop = rectShapeXml({ id: 960, name: "Manufacturing Solution Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 961, name: "Manufacturing Solution Steel Plane", geom: "parallelogram", x: 6858000, y: 609600, cx: 2133600, cy: 3657600, fill: palette.tint })
    + solidShapeXml({ id: 962, name: "Manufacturing Solution Equipment Glow", geom: "ellipse", x: 7040880, y: 609600, cx: 1676400, cy: 1676400, fill: palette.softAccent })
    + solidShapeXml({ id: 963, name: "Manufacturing Solution Energy Glow", geom: "ellipse", x: 7162800, y: 3840480, cx: 1524000, cy: 1066800, fill: palette.warmWash });
  const surface = solidShapeXml({ id: 964, name: "Manufacturing Solution Workspace", geom: "roundRect", x: 530352, y: 627888, cx: 8089392, cy: 4072128, fill: visual.surface })
    + lineFrameShapeXml({ id: 965, name: "Manufacturing Solution Workspace Border", geom: "roundRect", x: 530352, y: 627888, cx: 8089392, cy: 4072128, stroke: palette.frame, width: 15240 });
  const header = solidShapeXml({ id: 966, name: "Manufacturing Solution Header", x: 0, y: 0, cx: 9144000, cy: 365760, fill: visual.primary })
    + rectShapeXml({ id: 967, name: "Manufacturing Solution Header Accent", x: 0, y: 365760, cx: 9144000, cy: 22860, fill: visual.accent })
    + textShapeXml({ id: 968, name: "Manufacturing Solution Kicker", x: 768096, y: 838200, cx: 2590800, cy: 274320, text: scene.kicker, size: 760, bold: true, color: visual.accent })
    + rectShapeXml({ id: 969, name: "Manufacturing Solution Focus Rule", x: 768096, y: index === 0 ? 2301240 : 2057400, cx: 3200400, cy: 30480, fill: palette.orange });
  const bullets = manufacturingSolutionBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "process" || scene.role === "architecture") return backdrop + surface + header + bullets + manufacturingSolutionProcessXml({ visual, palette, items: scene.process }) + manufacturingSolutionValueCardsXml({ visual, palette, items: scene.matrix });
  if (scene.role === "dashboard" || scene.role === "value") return backdrop + surface + header + bullets + manufacturingSolutionDashboardXml({ visual, palette }) + manufacturingSolutionValueCardsXml({ visual, palette, items: scene.matrix });
  if (scene.role === "roadmap") return backdrop + surface + header + bullets + manufacturingSolutionRoadmapXml({ visual, palette, items: scene.process });
  if (scene.role === "closing") return backdrop + surface + header + bullets + manufacturingSolutionClosingXml({ visual, palette, items: scene.matrix });
  return backdrop + surface + header + bullets + manufacturingSolutionFactoryXml({ visual, palette }) + manufacturingSolutionTagCardsXml({ visual, tags: scene.tags });
}

function manufacturingSolutionFactoryXml({ visual, palette }) {
  return solidShapeXml({ id: 980, name: "Manufacturing Solution Factory Panel", geom: "roundRect", x: 5780520, y: 1066800, cx: 2895600, cy: 2286000, fill: palette.panel })
    + lineFrameShapeXml({ id: 981, name: "Manufacturing Solution Factory Panel Border", geom: "roundRect", x: 5780520, y: 1066800, cx: 2895600, cy: 2286000, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 982, name: "Manufacturing Solution Conveyor Line", x: 6075320, y: 2651760, cx: 2296000, cy: 60960, fill: visual.primary })
    + solidShapeXml({ id: 983, name: "Manufacturing Solution Factory Block One", x: 6233160, y: 2087880, cx: 457200, cy: 563880, fill: visual.primary })
    + solidShapeXml({ id: 984, name: "Manufacturing Solution Factory Block Two", x: 6842760, y: 1844040, cx: 563880, cy: 807720, fill: visual.accent })
    + solidShapeXml({ id: 985, name: "Manufacturing Solution Factory Block Three", x: 7574280, y: 2186940, cx: 472440, cy: 464820, fill: palette.orange })
    + solidShapeXml({ id: 986, name: "Manufacturing Solution Device Node One", geom: "ellipse", x: 6195060, y: 1455420, cx: 121920, cy: 121920, fill: visual.accent })
    + solidShapeXml({ id: 987, name: "Manufacturing Solution Device Node Two", geom: "ellipse", x: 7124700, y: 1516380, cx: 121920, cy: 121920, fill: palette.orange })
    + solidShapeXml({ id: 988, name: "Manufacturing Solution Device Node Three", geom: "ellipse", x: 8061960, y: 1455420, cx: 121920, cy: 121920, fill: visual.accent });
}

function manufacturingSolutionTagCardsXml({ visual, tags }) {
  return tags.slice(0, 3).map((tag, index) => {
    const x = 768096 + index * 1257300;
    return rectShapeXml({ id: 1000 + index * 3, name: `Manufacturing Solution Tag Rail ${index + 1}`, x, y: 3749040, cx: 914400, cy: 45720, fill: index === 1 ? "F59E0B" : visual.accent })
      + solidShapeXml({ id: 1001 + index * 3, name: `Manufacturing Solution Tag Card ${index + 1}`, geom: "roundRect", x, y: 3825240, cx: 990600, cy: 441960, fill: "FFFFFF" })
      + textShapeXml({ id: 1002 + index * 3, name: `Manufacturing Solution Tag Text ${index + 1}`, x: x + 121920, y: 3947160, cx: 746760, cy: 182880, text: financialSolutionCompactText(tag, "", 8), size: 740, bold: true, color: visual.title });
  }).join("");
}

function manufacturingSolutionBulletCardsXml({ visual, scene, isCover }) {
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = (isCover ? 2537460 : 1813560) + index * 243840;
    return rectShapeXml({ id: 1020 + index * 2, name: `Manufacturing Solution Bullet Rule ${index + 1}`, x: 768096, y: y + 30480, cx: 45720, cy: 137160, fill: index === 1 ? "F59E0B" : visual.accent })
      + textShapeXml({ id: 1021 + index * 2, name: `Manufacturing Solution Bullet Text ${index + 1}`, x: 940308, y, cx: 3474720, cy: 198120, text: financialSolutionCompactText(item, scene.title, 32), size: isCover ? 800 : 700, bold: false, color: visual.body });
  }).join("");
}

function manufacturingSolutionProcessXml({ visual, palette, items }) {
  return items.slice(0, 5).map((item, index) => {
    const x = 5262880 + index * 655320;
    const connector = index < 4 ? rectShapeXml({ id: 1040 + index * 5, name: `Manufacturing Solution Process Connector ${index + 1}`, x: x + 579120, y: 1706880, cx: 152400, cy: 30480, fill: palette.orange }) : "";
    return connector
      + solidShapeXml({ id: 1041 + index * 5, name: `Manufacturing Solution Process Step ${index + 1}`, geom: "roundRect", x, y: 1508760, cx: 579120, cy: 426720, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1042 + index * 5, name: `Manufacturing Solution Process Step Border ${index + 1}`, geom: "roundRect", x, y: 1508760, cx: 579120, cy: 426720, stroke: palette.frame, width: 10160 })
      + textShapeXml({ id: 1043 + index * 5, name: `Manufacturing Solution Process Text ${index + 1}`, x: x + 60960, y: 1645920, cx: 457200, cy: 152400, text: financialSolutionCompactText(item, "", 8), size: 650, bold: true, color: visual.title });
  }).join("");
}

function manufacturingSolutionDashboardXml({ visual, palette }) {
  return solidShapeXml({ id: 1070, name: "Manufacturing Solution Dashboard Panel", geom: "roundRect", x: 5943600, y: 1112520, cx: 2514600, cy: 2286000, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1071, name: "Manufacturing Solution Dashboard Border", geom: "roundRect", x: 5943600, y: 1112520, cx: 2514600, cy: 2286000, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 1072, name: "Manufacturing Solution Dashboard Header", x: 5943600, y: 1112520, cx: 2514600, cy: 304800, fill: visual.primary })
    + rectShapeXml({ id: 1073, name: "Manufacturing Solution Dashboard Axis", x: 6278880, y: 2827020, cx: 1676400, cy: 15240, fill: palette.frame })
    + rectShapeXml({ id: 1074, name: "Manufacturing Solution Dashboard Bar One", x: 6400800, y: 2446020, cx: 137160, cy: 381000, fill: visual.accent })
    + rectShapeXml({ id: 1075, name: "Manufacturing Solution Dashboard Bar Two", x: 6713220, y: 2225040, cx: 137160, cy: 601980, fill: visual.primary })
    + rectShapeXml({ id: 1076, name: "Manufacturing Solution Dashboard Bar Three", x: 7025640, y: 2034540, cx: 137160, cy: 792480, fill: palette.orange })
    + rectShapeXml({ id: 1077, name: "Manufacturing Solution Dashboard Bar Four", x: 7338060, y: 2316480, cx: 137160, cy: 510540, fill: visual.accent })
    + rectShapeXml({ id: 1078, name: "Manufacturing Solution Dashboard Bar Five", x: 7650480, y: 1958340, cx: 137160, cy: 868680, fill: visual.primary });
}

function manufacturingSolutionValueCardsXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 768096 + index * 1859280;
    return solidShapeXml({ id: 1090 + index * 3, name: `Manufacturing Solution Value Card ${index + 1}`, geom: "roundRect", x, y: 3695700, cx: 1546860, cy: 609600, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1091 + index * 3, name: `Manufacturing Solution Value Card Border ${index + 1}`, geom: "roundRect", x, y: 3695700, cx: 1546860, cy: 609600, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1092 + index * 3, name: `Manufacturing Solution Value Card Accent ${index + 1}`, x: x + 152400, y: 3947160, cx: 365760, cy: 30480, fill: index === 1 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1093 + index * 3, name: `Manufacturing Solution Value Card Text ${index + 1}`, x: x + 152400, y: 4015740, cx: 1219200, cy: 182880, text: financialSolutionCompactText(item, "", 10), size: 700, bold: true, color: visual.title });
  }).join("");
}

function manufacturingSolutionRoadmapXml({ visual, palette, items }) {
  return items.slice(0, 5).map((item, index) => {
    const x = 975360 + index * 1371600;
    return solidShapeXml({ id: 1120 + index * 4, name: `Manufacturing Solution Roadmap Step ${index + 1}`, geom: "roundRect", x, y: 2956560, cx: 1066800, cy: 640080, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1121 + index * 4, name: `Manufacturing Solution Roadmap Border ${index + 1}`, geom: "roundRect", x, y: 2956560, cx: 1066800, cy: 640080, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1122 + index * 4, name: `Manufacturing Solution Roadmap Accent ${index + 1}`, x: x + 137160, y: 3192780, cx: 274320, cy: 30480, fill: index === 2 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1123 + index * 4, name: `Manufacturing Solution Roadmap Text ${index + 1}`, x: x + 137160, y: 3307080, cx: 792480, cy: 182880, text: financialSolutionCompactText(item, "", 8), size: 690, bold: true, color: visual.title });
  }).join("");
}

function manufacturingSolutionClosingXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 914400 + index * 2316480;
    return solidShapeXml({ id: 1150 + index * 4, name: `Manufacturing Solution Closing Card ${index + 1}`, geom: "roundRect", x, y: 2926080, cx: 1859280, cy: 914400, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1151 + index * 4, name: `Manufacturing Solution Closing Card Border ${index + 1}`, geom: "roundRect", x, y: 2926080, cx: 1859280, cy: 914400, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1152 + index * 4, name: `Manufacturing Solution Closing Card Accent ${index + 1}`, x: x + 182880, y: 3215640, cx: 365760, cy: 30480, fill: index === 1 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1153 + index * 4, name: `Manufacturing Solution Closing Card Text ${index + 1}`, x: x + 182880, y: 3329940, cx: 1371600, cy: 243840, text: financialSolutionCompactText(item, "", 14), size: 740, bold: true, color: visual.title });
  }).join("");
}

function manufacturingSolutionSceneFromSlide({ slide, index, role }) {
  const bullets = manufacturingSolutionBulletTexts(slide);
  const title = financialSolutionCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const roleText = String(role || "");
  const sceneRole = index === 0
    ? "cover"
    : role === "closing"
      ? "closing"
      : roleText.includes("architecture")
        ? "architecture"
        : roleText.includes("process")
          ? "process"
          : roleText.includes("dashboard")
            ? "dashboard"
            : roleText.includes("value")
              ? "value"
              : roleText.includes("roadmap")
                ? "roadmap"
                : ["painpoints", "architecture", "process", "dashboard", "value", "roadmap"][(index - 1) % 6];
  const tags = ["流程提效", "设备联机", "交付闭环"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 8));
  const process = ["计划", "生产", "质检", "仓储", "交付"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 8));
  const matrix = ["降本", "提效", "稳质", "追溯"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 10));
  return {
    role: sceneRole,
    kicker: sceneRole === "cover" ? "SMART FACTORY SOLUTION" : sceneRole === "architecture" ? "DIGITAL ARCHITECTURE" : sceneRole === "process" ? "PROCESS OPTIMIZATION" : sceneRole === "dashboard" ? "EQUIPMENT DASHBOARD" : sceneRole === "roadmap" ? "DELIVERY ROADMAP" : sceneRole === "value" ? "BUSINESS VALUE" : "CLIENT NEXT STEP",
    title,
    bullets,
    tags,
    process,
    matrix,
  };
}

function manufacturingSolutionBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["制造现场流程瓶颈与设备数据孤岛", "产线联机和工厂流程优化方案", "效率提升、质量稳定和交付收益"];
}

function manufacturingSolutionColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.3),
    tint: blendHexColor(visual.primary, visual.background, 0.86),
    softAccent: blendHexColor(visual.accent, visual.surface, 0.78),
    warmWash: blendHexColor("F59E0B", visual.background, 0.84),
    panel: blendHexColor(visual.background, visual.surface, 0.68),
    frame: blendHexColor(visual.primary, visual.surface, 0.76),
    orange: "F59E0B",
  };
}

function isManufacturingSolutionVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "sales-manufacturing-solution" && (id === "industry-solution" || id === "sales-industry-solution-manufacturing-industry");
}

function corporateTrainingDecorationsXml({ visual, index, role, slide }) {
  const scene = corporateTrainingSceneFromSlide({ slide, index, role });
  const palette = corporateTrainingColorPalette(visual);
  // 企业内训模板主体全部使用可编辑形状绘制，导出后可继续二次调整文本和图形。
  const backdrop = rectShapeXml({ id: 1200, name: "Corporate Training Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 1201, name: "Corporate Training Glow", geom: "ellipse", x: 7040880, y: 274320, cx: 1767840, cy: 1524000, fill: palette.softAccent })
    + rectShapeXml({ id: 1202, name: "Corporate Training Header", x: 0, y: 0, cx: 9144000, cy: 365760, fill: visual.primary })
    + rectShapeXml({ id: 1203, name: "Corporate Training Header Accent", x: 0, y: 365760, cx: 9144000, cy: 30480, fill: visual.accent });
  const surface = solidShapeXml({ id: 1204, name: "Corporate Training Learning Canvas", geom: "roundRect", x: 475488, y: 432816, cx: 8193024, cy: 4297680, fill: visual.surface })
    + lineFrameShapeXml({ id: 1205, name: "Corporate Training Canvas Border", geom: "roundRect", x: 475488, y: 432816, cx: 8193024, cy: 4297680, stroke: palette.frame, width: 12700 });
  const header = textShapeXml({ id: 1206, name: "Corporate Training Kicker", x: 731520, y: 685800, cx: 2895600, cy: 274320, text: scene.kicker, size: 760, bold: true, color: visual.accent })
    + rectShapeXml({ id: 1207, name: "Corporate Training Focus Rule", x: 731520, y: index === 0 ? 2164080 : 1973580, cx: 3200400, cy: 30480, fill: palette.orange });
  const bullets = corporateTrainingBulletCardsXml({ visual, palette, scene, isCover: index === 0 });
  if (scene.role === "agenda") return backdrop + surface + header + bullets + corporateTrainingBoardXml({ visual, palette }) + corporateTrainingPathXml({ visual, palette, items: scene.path });
  if (scene.role === "model") return backdrop + surface + header + bullets + corporateTrainingModelXml({ visual, palette, items: scene.model }) + corporateTrainingOutcomeCardsXml({ visual, palette, items: scene.outcomes });
  if (scene.role === "case") return backdrop + surface + header + bullets + corporateTrainingCaseXml({ visual, palette }) + corporateTrainingChecklistXml({ visual, palette, items: scene.checklist });
  if (scene.role === "tool" || scene.role === "practice") return backdrop + surface + header + bullets + corporateTrainingModelXml({ visual, palette, items: scene.model }) + corporateTrainingChecklistXml({ visual, palette, items: scene.checklist });
  if (scene.role === "summary") return backdrop + surface + header + bullets + corporateTrainingSummaryXml({ visual, palette, items: scene.path });
  return backdrop + surface + header + bullets + corporateTrainingBoardXml({ visual, palette }) + corporateTrainingOutcomeCardsXml({ visual, palette, items: scene.outcomes });
}

function corporateTrainingBoardXml({ visual, palette }) {
  return solidShapeXml({ id: 1220, name: "Corporate Training Board", geom: "roundRect", x: 5780520, y: 975360, cx: 2743200, cy: 2514600, fill: palette.panel })
    + lineFrameShapeXml({ id: 1221, name: "Corporate Training Board Border", geom: "roundRect", x: 5780520, y: 975360, cx: 2743200, cy: 2514600, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 1222, name: "Corporate Training Board Header Line", x: 6065520, y: 1272540, cx: 1828800, cy: 91440, fill: visual.primary })
    + rectShapeXml({ id: 1223, name: "Corporate Training Board Accent Line", x: 6065520, y: 1844040, cx: 914400, cy: 60960, fill: visual.accent })
    + solidShapeXml({ id: 1224, name: "Corporate Training Coach Node", geom: "ellipse", x: 7444740, y: 1661160, cx: 701040, cy: 701040, fill: palette.softAccent })
    + solidShapeXml({ id: 1225, name: "Corporate Training Practice Panel", geom: "roundRect", x: 6096000, y: 2468880, cx: 1905000, cy: 640080, fill: palette.tint });
}

function corporateTrainingOutcomeCardsXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 731520 + index * 1257300;
    return solidShapeXml({ id: 1240 + index * 3, name: `Corporate Training Outcome Card ${index + 1}`, geom: "roundRect", x, y: 3764280, cx: 1005840, cy: 487680, fill: "FFFFFF" })
      + rectShapeXml({ id: 1241 + index * 3, name: `Corporate Training Outcome Accent ${index + 1}`, x, y: 3764280, cx: 1005840, cy: 38100, fill: index === 1 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1242 + index * 3, name: `Corporate Training Outcome Text ${index + 1}`, x: x + 121920, y: 3901440, cx: 762000, cy: 198120, text: corporateTrainingCompactText(item, "", 8), size: 720, bold: true, color: visual.title });
  }).join("");
}

function corporateTrainingBulletCardsXml({ visual, palette, scene, isCover }) {
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = (isCover ? 2514600 : 1813560) + index * 243840;
    return rectShapeXml({ id: 1260 + index * 2, name: `Corporate Training Bullet Rule ${index + 1}`, x: 749808, y: y + 30480, cx: 45720, cy: 137160, fill: index === 1 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1261 + index * 2, name: `Corporate Training Bullet Text ${index + 1}`, x: 914400, y, cx: 3505200, cy: 198120, text: corporateTrainingCompactText(item, scene.title, 32), size: isCover ? 800 : 700, bold: false, color: visual.body });
  }).join("");
}

function corporateTrainingPathXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 853440 + index * 1973580;
    return solidShapeXml({ id: 1280 + index * 4, name: `Corporate Training Learning Path ${index + 1}`, geom: "roundRect", x, y: 3444240, cx: 1524000, cy: 746760, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1281 + index * 4, name: `Corporate Training Path Border ${index + 1}`, geom: "roundRect", x, y: 3444240, cx: 1524000, cy: 746760, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1282 + index * 4, name: `Corporate Training Path Marker ${index + 1}`, geom: "ellipse", x: x + 167640, y: 3611880, cx: 243840, cy: 243840, fill: index % 2 === 0 ? visual.accent : palette.orange })
      + textShapeXml({ id: 1283 + index * 4, name: `Corporate Training Path Text ${index + 1}`, x: x + 487680, y: 3657600, cx: 822960, cy: 243840, text: corporateTrainingCompactText(item, "", 10), size: 740, bold: true, color: visual.title });
  }).join("");
}

function corporateTrainingModelXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5943600 + col * 1219200;
    const y = 1120140 + row * 914400;
    return solidShapeXml({ id: 1310 + index * 4, name: `Corporate Training Model Card ${index + 1}`, geom: "roundRect", x, y, cx: 1005840, cy: 670560, fill: index === 0 ? palette.tint : "FFFFFF" })
      + lineFrameShapeXml({ id: 1311 + index * 4, name: `Corporate Training Model Border ${index + 1}`, geom: "roundRect", x, y, cx: 1005840, cy: 670560, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1312 + index * 4, name: `Corporate Training Model Rule ${index + 1}`, x: x + 121920, y: y + 152400, cx: 365760, cy: 38100, fill: index === 2 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1313 + index * 4, name: `Corporate Training Model Text ${index + 1}`, x: x + 121920, y: y + 274320, cx: 731520, cy: 182880, text: corporateTrainingCompactText(item, "", 12), size: 720, bold: true, color: visual.title });
  }).join("");
}

function corporateTrainingCaseXml({ visual, palette }) {
  return solidShapeXml({ id: 1340, name: "Corporate Training Case Panel", geom: "roundRect", x: 5780520, y: 1120140, cx: 2743200, cy: 2194560, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1341, name: "Corporate Training Case Border", geom: "roundRect", x: 5780520, y: 1120140, cx: 2743200, cy: 2194560, stroke: palette.frame, width: 10160 })
    + solidShapeXml({ id: 1342, name: "Corporate Training Case Visual", geom: "roundRect", x: 6096000, y: 1402080, cx: 2133600, cy: 670560, fill: palette.tint })
    + rectShapeXml({ id: 1343, name: "Corporate Training Case Line 1", x: 6096000, y: 2362200, cx: 1828800, cy: 60960, fill: visual.primary, transparency: 18000 })
    + rectShapeXml({ id: 1344, name: "Corporate Training Case Line 2", x: 6096000, y: 2636520, cx: 1371600, cy: 60960, fill: visual.accent, transparency: 8000 })
    + rectShapeXml({ id: 1345, name: "Corporate Training Case Line 3", x: 6096000, y: 2910840, cx: 1676400, cy: 60960, fill: palette.orange, transparency: 8000 });
}

function corporateTrainingChecklistXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 914400 + index * 2316480;
    return solidShapeXml({ id: 1360 + index * 4, name: `Corporate Training Checklist Card ${index + 1}`, geom: "roundRect", x, y: 3657600, cx: 1828800, cy: 579120, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1361 + index * 4, name: `Corporate Training Checklist Border ${index + 1}`, geom: "roundRect", x, y: 3657600, cx: 1828800, cy: 579120, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1362 + index * 4, name: `Corporate Training Checklist Marker ${index + 1}`, geom: "roundRect", x: x + 152400, y: 3825240, cx: 152400, cy: 152400, fill: index === 1 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1363 + index * 4, name: `Corporate Training Checklist Text ${index + 1}`, x: x + 381000, y: 3802380, cx: 1219200, cy: 213360, text: corporateTrainingCompactText(item, "", 14), size: 720, bold: true, color: visual.title });
  }).join("");
}

function corporateTrainingSummaryXml({ visual, palette, items }) {
  const line = rectShapeXml({ id: 1390, name: "Corporate Training Summary Line", x: 731520, y: 3200400, cx: 6705600, cy: 38100, fill: visual.accent })
    + rectShapeXml({ id: 1391, name: "Corporate Training Summary Warm Line", x: 4267200, y: 3200400, cx: 2286000, cy: 38100, fill: palette.orange });
  return line + corporateTrainingPathXml({ visual, palette, items });
}

function corporateTrainingSceneFromSlide({ slide, index, role }) {
  const bullets = corporateTrainingBulletTexts(slide);
  const rawRole = String(role || "");
  const sceneRole = index === 0
    ? "cover"
    : rawRole.includes("agenda")
      ? "agenda"
      : rawRole.includes("model")
        ? "model"
        : rawRole.includes("case")
          ? "case"
          : rawRole.includes("tool")
            ? "tool"
            : rawRole.includes("practice")
              ? "practice"
              : rawRole.includes("summary") || rawRole === "closing"
                ? "summary"
                : ["agenda", "model", "case", "tool", "practice"][(index - 1) % 5];
  return {
    role: sceneRole,
    kicker: sceneRole === "cover" ? "INTERNAL LEARNING PROGRAM" : sceneRole === "agenda" ? "LEARNING MAP" : sceneRole === "model" ? "MANAGEMENT MODEL" : sceneRole === "case" ? "CASE DISCUSSION" : sceneRole === "tool" ? "TOOLKIT PRACTICE" : sceneRole === "practice" ? "WORKSHOP TASK" : "ACTION COMMITMENT",
    title: corporateTrainingCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28),
    bullets,
    outcomes: ["目标", "模型", "练习"].map((fallback, itemIndex) => corporateTrainingCompactText(bullets[itemIndex], fallback, 8)),
    path: ["导入", "讲解", "研讨", "行动"].map((fallback, itemIndex) => corporateTrainingCompactText(bullets[itemIndex], fallback, 10)),
    model: ["原则", "方法", "工具", "输出"].map((fallback, itemIndex) => corporateTrainingCompactText(bullets[itemIndex], fallback, 12)),
    checklist: ["案例背景", "关键问题", "小组任务"].map((fallback, itemIndex) => corporateTrainingCompactText(bullets[itemIndex], fallback, 14)),
  };
}

function corporateTrainingBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text || item.title || item.label || item.value || "").trim();
    return "";
  }).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["明确管理角色和团队协作目标", "掌握可复用的管理模型与沟通方法", "通过案例研讨形成课后行动计划"];
}

function corporateTrainingCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}…`;
}

function corporateTrainingColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.3),
    panel: blendHexColor(visual.background, visual.surface, 0.68),
    tint: blendHexColor(visual.accent, visual.surface, 0.82),
    softAccent: blendHexColor(visual.accent, visual.surface, 0.76),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    orange: "F3A712",
  };
}

function isCorporateTrainingVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "corporate-training" && (id === "corporate-training" || id === "education-corporate-training-management");
}

function onboardingGuideDecorationsXml({ visual, index, role, slide }) {
  const scene = onboardingGuideSceneFromSlide({ slide, index, role });
  const palette = onboardingGuideColorPalette(visual);
  // 入职模板用可编辑图形表达工牌、手册和路径，不使用整页模板截图作为背景。
  const backdrop = rectShapeXml({ id: 1500, name: "Onboarding Guide Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 1501, name: "Onboarding Guide Glow", geom: "ellipse", x: 6934200, y: 243840, cx: 1828800, cy: 1524000, fill: palette.softAccent })
    + rectShapeXml({ id: 1502, name: "Onboarding Guide Header", x: 0, y: 0, cx: 9144000, cy: 365760, fill: visual.primary })
    + rectShapeXml({ id: 1503, name: "Onboarding Guide Header Accent", x: 0, y: 365760, cx: 9144000, cy: 30480, fill: visual.accent });
  const surface = solidShapeXml({ id: 1504, name: "Onboarding Guide Canvas", geom: "roundRect", x: 493776, y: 411480, cx: 8156448, cy: 4312920, fill: visual.surface })
    + lineFrameShapeXml({ id: 1505, name: "Onboarding Guide Canvas Border", geom: "roundRect", x: 493776, y: 411480, cx: 8156448, cy: 4312920, stroke: palette.frame, width: 12700 });
  const header = textShapeXml({ id: 1506, name: "Onboarding Guide Kicker", x: 731520, y: 685800, cx: 2895600, cy: 274320, text: scene.kicker, size: 760, bold: true, color: visual.accent })
    + rectShapeXml({ id: 1507, name: "Onboarding Guide Focus Rule", x: 731520, y: index === 0 ? 2164080 : 1958340, cx: 2926080, cy: 30480, fill: palette.orange });
  const bullets = onboardingGuideBulletCardsXml({ visual, palette, scene, isCover: index === 0 });
  if (scene.role === "handbook" || scene.role === "policy" || scene.role === "role") return backdrop + surface + header + bullets + onboardingGuideHandbookXml({ visual, palette }) + onboardingGuideStepsXml({ visual, palette, items: scene.steps });
  if (scene.role === "culture") return backdrop + surface + header + bullets + onboardingGuideCultureXml({ visual, palette, items: scene.cards });
  if (scene.role === "checklist") return backdrop + surface + header + bullets + onboardingGuideChecklistXml({ visual, palette, items: scene.cards });
  if (scene.role === "summary") return backdrop + surface + header + bullets + onboardingGuideSummaryXml({ visual, palette, items: scene.steps });
  return backdrop + surface + header + bullets + onboardingGuideBadgeXml({ visual, palette }) + onboardingGuideStepsXml({ visual, palette, items: scene.steps });
}

function onboardingGuideBadgeXml({ visual, palette }) {
  return solidShapeXml({ id: 1520, name: "Onboarding Guide Badge Card", geom: "roundRect", x: 5867400, y: 975360, cx: 2590800, cy: 2453640, fill: palette.panel })
    + lineFrameShapeXml({ id: 1521, name: "Onboarding Guide Badge Border", geom: "roundRect", x: 5867400, y: 975360, cx: 2590800, cy: 2453640, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 1522, name: "Onboarding Guide Badge Header", x: 5867400, y: 975360, cx: 2590800, cy: 487680, fill: visual.primary })
    + solidShapeXml({ id: 1523, name: "Onboarding Guide Avatar", geom: "ellipse", x: 6156960, y: 1767840, cx: 670560, cy: 670560, fill: palette.softAccent })
    + rectShapeXml({ id: 1524, name: "Onboarding Guide Badge Name Line", x: 7063740, y: 1684020, cx: 944880, cy: 76200, fill: visual.primary })
    + rectShapeXml({ id: 1525, name: "Onboarding Guide Badge Role Line", x: 7063740, y: 2034540, cx: 1219200, cy: 60960, fill: visual.accent })
    + rectShapeXml({ id: 1526, name: "Onboarding Guide Badge Entry Line", x: 7063740, y: 2377440, cx: 822960, cy: 60960, fill: palette.orange });
}

function onboardingGuideHandbookXml({ visual, palette }) {
  return solidShapeXml({ id: 1540, name: "Onboarding Guide Handbook", geom: "roundRect", x: 5867400, y: 1120140, cx: 2590800, cy: 2133600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1541, name: "Onboarding Guide Handbook Border", geom: "roundRect", x: 5867400, y: 1120140, cx: 2590800, cy: 2133600, stroke: palette.frame, width: 10160 })
    + rectShapeXml({ id: 1542, name: "Onboarding Guide Handbook Title Rule", x: 6172200, y: 1455420, cx: 1828800, cy: 91440, fill: visual.primary })
    + rectShapeXml({ id: 1543, name: "Onboarding Guide Handbook Policy Line", x: 6172200, y: 1965960, cx: 1524000, cy: 60960, fill: visual.accent })
    + rectShapeXml({ id: 1544, name: "Onboarding Guide Handbook Role Line", x: 6172200, y: 2346960, cx: 1828800, cy: 60960, fill: palette.orange })
    + solidShapeXml({ id: 1545, name: "Onboarding Guide Handbook Stamp", geom: "roundRect", x: 7665720, y: 1805940, cx: 426720, cy: 914400, fill: palette.softAccent });
}

function onboardingGuideStepsXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 853440 + index * 1973580;
    return solidShapeXml({ id: 1560 + index * 4, name: `Onboarding Guide Journey Step ${index + 1}`, geom: "roundRect", x, y: 3474720, cx: 1524000, cy: 746760, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1561 + index * 4, name: `Onboarding Guide Journey Border ${index + 1}`, geom: "roundRect", x, y: 3474720, cx: 1524000, cy: 746760, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1562 + index * 4, name: `Onboarding Guide Step Marker ${index + 1}`, geom: "ellipse", x: x + 167640, y: 3642360, cx: 243840, cy: 243840, fill: index % 2 === 0 ? visual.accent : palette.orange })
      + textShapeXml({ id: 1563 + index * 4, name: `Onboarding Guide Step Text ${index + 1}`, x: x + 487680, y: 3688080, cx: 822960, cy: 243840, text: onboardingGuideCompactText(item, "", 10), size: 720, bold: true, color: visual.title });
  }).join("");
}

function onboardingGuideCultureXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5943600 + col * 1219200;
    const y = 1120140 + row * 914400;
    return solidShapeXml({ id: 1590 + index * 4, name: `Onboarding Guide Culture Card ${index + 1}`, geom: "roundRect", x, y, cx: 1005840, cy: 670560, fill: index === 0 ? palette.tint : "FFFFFF" })
      + lineFrameShapeXml({ id: 1591 + index * 4, name: `Onboarding Guide Culture Border ${index + 1}`, geom: "roundRect", x, y, cx: 1005840, cy: 670560, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1592 + index * 4, name: `Onboarding Guide Culture Rule ${index + 1}`, x: x + 121920, y: y + 152400, cx: 365760, cy: 38100, fill: index === 2 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1593 + index * 4, name: `Onboarding Guide Culture Text ${index + 1}`, x: x + 121920, y: y + 274320, cx: 731520, cy: 182880, text: onboardingGuideCompactText(item, "", 12), size: 720, bold: true, color: visual.title });
  }).join("");
}

function onboardingGuideChecklistXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 914400 + index * 2316480;
    return solidShapeXml({ id: 1620 + index * 4, name: `Onboarding Guide Checklist Card ${index + 1}`, geom: "roundRect", x, y: 3657600, cx: 1828800, cy: 609600, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1621 + index * 4, name: `Onboarding Guide Checklist Border ${index + 1}`, geom: "roundRect", x, y: 3657600, cx: 1828800, cy: 609600, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1622 + index * 4, name: `Onboarding Guide Checklist Marker ${index + 1}`, geom: "roundRect", x: x + 152400, y: 3825240, cx: 152400, cy: 152400, fill: index === 1 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1623 + index * 4, name: `Onboarding Guide Checklist Text ${index + 1}`, x: x + 381000, y: 3794760, cx: 1219200, cy: 243840, text: onboardingGuideCompactText(item, "", 14), size: 720, bold: true, color: visual.title });
  }).join("");
}

function onboardingGuideSummaryXml({ visual, palette, items }) {
  const line = rectShapeXml({ id: 1650, name: "Onboarding Guide Summary Line", x: 731520, y: 3200400, cx: 6705600, cy: 38100, fill: visual.accent })
    + rectShapeXml({ id: 1651, name: "Onboarding Guide Summary Warm Line", x: 4267200, y: 3200400, cx: 2286000, cy: 38100, fill: palette.orange });
  return line + onboardingGuideStepsXml({ visual, palette, items });
}

function onboardingGuideBulletCardsXml({ visual, palette, scene, isCover }) {
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = (isCover ? 2484120 : 1813560) + index * 243840;
    return rectShapeXml({ id: 1670 + index * 2, name: `Onboarding Guide Bullet Rule ${index + 1}`, x: 749808, y: y + 30480, cx: 45720, cy: 137160, fill: index === 1 ? palette.orange : visual.accent })
      + textShapeXml({ id: 1671 + index * 2, name: `Onboarding Guide Bullet Text ${index + 1}`, x: 914400, y, cx: 3505200, cy: 198120, text: onboardingGuideCompactText(item, scene.title, 32), size: isCover ? 780 : 690, bold: false, color: visual.body });
  }).join("");
}

function onboardingGuideSceneFromSlide({ slide, index, role }) {
  const bullets = onboardingGuideBulletTexts(slide);
  const rawRole = String(slide?.layout || role || "");
  const sceneRole = index === 0
    ? "cover"
    : rawRole.includes("policy") || rawRole.includes("role") || rawRole.includes("handbook")
      ? "handbook"
      : rawRole.includes("culture")
        ? "culture"
        : rawRole.includes("checklist")
          ? "checklist"
          : rawRole.includes("summary") || rawRole === "closing"
            ? "summary"
            : rawRole.includes("journey") || rawRole.includes("steps")
              ? "steps"
              : ["handbook", "culture", "checklist", "steps"][(index - 1) % 4];
  return {
    role: sceneRole,
    kicker: sceneRole === "cover" ? "NEW HIRE GUIDE" : sceneRole === "handbook" ? "HANDBOOK MAP" : sceneRole === "culture" ? "CULTURE FIT" : sceneRole === "checklist" ? "ONBOARDING CHECKLIST" : sceneRole === "steps" ? "FIRST 30 DAYS" : "GROWTH NEXT STEP",
    title: onboardingGuideCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28),
    bullets,
    steps: ["入职准备", "制度熟悉", "业务融入", "成长反馈"].map((fallback, itemIndex) => onboardingGuideCompactText(bullets[itemIndex], fallback, 10)),
    cards: ["组织介绍", "岗位职责", "工具权限", "导师机制"].map((fallback, itemIndex) => onboardingGuideCompactText(bullets[itemIndex], fallback, 12)),
  };
}

function onboardingGuideBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text || item.title || item.label || item.value || "").trim();
    return "";
  }).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["了解组织文化与关键制度", "完成岗位工具和权限配置", "建立导师沟通和试用期目标"];
}

function onboardingGuideCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}…`;
}

function onboardingGuideColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.34),
    panel: blendHexColor(visual.background, visual.surface, 0.68),
    tint: blendHexColor(visual.accent, visual.surface, 0.84),
    softAccent: blendHexColor(visual.accent, visual.surface, 0.76),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    orange: "F59E0B",
  };
}

function isOnboardingGuideVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "onboarding-guide" && (id === "onboarding-training" || id === "education-onboarding-training-onboarding-guide");
}

function knowledgeBlackboardDecorationsXml({ visual, index, role, slide }) {
  const scene = knowledgeBlackboardSceneFromSlide({ slide, index, role });
  const palette = knowledgeBlackboardColorPalette(visual);
  // 课堂讲义模板全部使用可编辑形状搭建黑板、粉笔和便签，避免导出 PPTX 变成不可编辑整页图片。
  const board = rectShapeXml({ id: 1900, name: "Knowledge Blackboard Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + knowledgeBlackboardGridXml({ palette })
    + solidShapeXml({ id: 1910, name: "Knowledge Blackboard Canvas", x: 475488, y: 365760, cx: 8193024, cy: 4427220, fill: visual.primary })
    + lineFrameShapeXml({ id: 1911, name: "Knowledge Blackboard Wood Frame", geom: "rect", x: 475488, y: 365760, cx: 8193024, cy: 4427220, stroke: palette.wood, width: 76200 })
    + rectShapeXml({ id: 1912, name: "Knowledge Blackboard Chalk Tray", x: 914400, y: 4335780, cx: 7315200, cy: 60960, fill: palette.wood })
    + rectShapeXml({ id: 1913, name: "Knowledge Blackboard Chalk Yellow", x: 6553200, y: 4450080, cx: 670560, cy: 45720, fill: visual.accent })
    + rectShapeXml({ id: 1914, name: "Knowledge Blackboard Chalk Blue", x: 7345680, y: 4450080, cx: 487680, cy: 45720, fill: visual.secondary || "60A5FA" });
  const header = textShapeXml({ id: 1920, name: "Knowledge Blackboard Lesson Label", x: 823056, y: 685800, cx: 2438400, cy: 243840, text: scene.kicker, size: 760, bold: true, color: visual.secondary || "60A5FA" })
    + rectShapeXml({ id: 1921, name: "Knowledge Blackboard Chalk Underline", x: 823056, y: index === 0 ? 2247900 : 1973580, cx: 1706880, cy: 60960, fill: visual.accent })
    + rectShapeXml({ id: 1922, name: "Knowledge Blackboard Soft Smudge", x: 2331720, y: index === 0 ? 2194560 : 1920240, cx: 975360, cy: 38100, fill: visual.title, transparency: 43000 });
  const bullets = knowledgeBlackboardBulletXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "concept") return board + header + bullets + knowledgeBlackboardFormulaXml({ visual, scene }) + knowledgeBlackboardCardsXml({ visual, scene, palette });
  if (scene.role === "case") return board + header + bullets + knowledgeBlackboardPaperNoteXml({ visual, scene, palette }) + knowledgeBlackboardCardsXml({ visual, scene, palette });
  if (scene.role === "steps") return board + header + bullets + knowledgeBlackboardFormulaXml({ visual, scene }) + knowledgeBlackboardStepsXml({ visual, scene });
  if (scene.role === "summary") return board + header + bullets + knowledgeBlackboardSummaryXml({ visual, scene, palette }) + knowledgeBlackboardStepsXml({ visual, scene });
  return board + header + bullets + knowledgeBlackboardPaperNoteXml({ visual, scene, palette }) + knowledgeBlackboardCardsXml({ visual, scene, palette });
}

function knowledgeBlackboardGridXml({ palette }) {
  const vertical = [914400, 1676400, 2438400, 3200400, 3962400, 4724400, 5486400, 6248400, 7010400, 7772400].map((x, index) =>
    rectShapeXml({ id: 1901 + index, name: `Knowledge Blackboard Grid Vertical ${index + 1}`, x, y: 548640, cx: 7620, cy: 3840480, fill: palette.grid, transparency: 69000 }),
  ).join("");
  const horizontal = [914400, 1371600, 1828800, 2286000, 2743200, 3200400, 3657600, 4114800].map((y, index) =>
    rectShapeXml({ id: 1924 + index, name: `Knowledge Blackboard Grid Horizontal ${index + 1}`, x: 670560, y, cx: 7802880, cy: 7620, fill: palette.grid, transparency: 72000 }),
  ).join("");
  return vertical + horizontal;
}

function knowledgeBlackboardBulletXml({ visual, scene, isCover }) {
  const yStart = isCover ? 2468880 : 1844040;
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = yStart + index * 259080;
    return solidShapeXml({ id: 1940 + index * 3, name: `Knowledge Blackboard Bullet Dot ${index + 1}`, geom: "ellipse", x: 841344, y: y + 53340, cx: 83820, cy: 83820, fill: index % 2 === 0 ? visual.accent : visual.secondary || "60A5FA" })
      + textShapeXml({ id: 1941 + index * 3, name: `Knowledge Blackboard Bullet Text ${index + 1}`, x: 990600, y, cx: 3352800, cy: 198120, text: knowledgeBlackboardCompactText(item, scene.title, 34), size: isCover ? 760 : 680, bold: false, color: visual.body });
  }).join("");
}

function knowledgeBlackboardPaperNoteXml({ visual, scene, palette }) {
  return solidShapeXml({ id: 1960, name: "Knowledge Blackboard Paper Note", geom: "roundRect", x: 5943600, y: 1043940, cx: 2133600, cy: 2072640, fill: visual.surface })
    + lineFrameShapeXml({ id: 1961, name: "Knowledge Blackboard Paper Note Border", geom: "roundRect", x: 5943600, y: 1043940, cx: 2133600, cy: 2072640, stroke: palette.paperFrame, width: 12700 })
    + rectShapeXml({ id: 1962, name: "Knowledge Blackboard Paper Line 1", x: 6263640, y: 1432560, cx: 1402080, cy: 60960, fill: palette.paperInk })
    + rectShapeXml({ id: 1963, name: "Knowledge Blackboard Paper Line 2", x: 6263640, y: 1805940, cx: 1158240, cy: 60960, fill: visual.accent })
    + rectShapeXml({ id: 1964, name: "Knowledge Blackboard Paper Line 3", x: 6263640, y: 2179320, cx: 1280160, cy: 60960, fill: palette.paperInk })
    + solidShapeXml({ id: 1965, name: "Knowledge Blackboard Paper Diagram", geom: "ellipse", x: 7284720, y: 2331720, cx: 381000, cy: 381000, fill: visual.secondary || "60A5FA" })
    + textShapeXml({ id: 1966, name: "Knowledge Blackboard Paper Caption", x: 6156960, y: 2712720, cx: 1676400, cy: 243840, text: knowledgeBlackboardCompactText(scene.note, "课程内容拆解", 14), size: 660, bold: true, color: visual.primary });
}

function knowledgeBlackboardFormulaXml({ visual, scene }) {
  return lineFrameShapeXml({ id: 1980, name: "Knowledge Blackboard Formula Panel", geom: "roundRect", x: 5844540, y: 1097280, cx: 2324100, cy: 1905000, stroke: visual.title, width: 22860, dash: "dash", transparency: 42000 })
    + textShapeXml({ id: 1981, name: "Knowledge Blackboard Formula First", x: 6149340, y: 1394460, cx: 609600, cy: 274320, text: "A", size: 1500, bold: true, color: visual.accent })
    + textShapeXml({ id: 1982, name: "Knowledge Blackboard Formula Plus", x: 6858000, y: 1767840, cx: 609600, cy: 274320, text: "+", size: 1350, bold: true, color: visual.secondary || "60A5FA" })
    + textShapeXml({ id: 1983, name: "Knowledge Blackboard Formula Result", x: 6377940, y: 2232660, cx: 914400, cy: 274320, text: "B", size: 1500, bold: true, color: visual.warning || "F87171" })
    + textShapeXml({ id: 1984, name: "Knowledge Blackboard Formula Caption", x: 6096000, y: 2705100, cx: 1828800, cy: 243840, text: knowledgeBlackboardCompactText(scene.note, "概念推导和例题迁移", 16), size: 640, bold: true, color: visual.body });
}

function knowledgeBlackboardCardsXml({ visual, scene, palette }) {
  return scene.cards.slice(0, 3).map((item, index) => {
    const x = 823056 + index * 1524000;
    return solidShapeXml({ id: 2000 + index * 4, name: `Knowledge Blackboard Concept Card ${index + 1}`, geom: "roundRect", x, y: 3596640, cx: 1219200, cy: 533400, fill: palette.card })
      + lineFrameShapeXml({ id: 2001 + index * 4, name: `Knowledge Blackboard Concept Card Border ${index + 1}`, geom: "roundRect", x, y: 3596640, cx: 1219200, cy: 533400, stroke: visual.title, width: 7620, transparency: 52000 })
      + rectShapeXml({ id: 2002 + index * 4, name: `Knowledge Blackboard Concept Card Rule ${index + 1}`, x: x + 137160, y: 3756660, cx: 548640, cy: 38100, fill: index === 1 ? visual.secondary || "60A5FA" : visual.accent })
      + textShapeXml({ id: 2003 + index * 4, name: `Knowledge Blackboard Concept Card Text ${index + 1}`, x: x + 137160, y: 3870960, cx: 853440, cy: 152400, text: knowledgeBlackboardCompactText(item, "", 10), size: 620, bold: true, color: visual.title });
  }).join("");
}

function knowledgeBlackboardStepsXml({ visual, scene }) {
  return scene.steps.slice(0, 4).map((item, index) => {
    const x = 792576 + index * 1905000;
    return solidShapeXml({ id: 2030 + index * 4, name: `Knowledge Blackboard Step ${index + 1}`, geom: "roundRect", x, y: 3657600, cx: 1524000, cy: 609600, fill: index % 2 === 0 ? "234C42" : "21483F" })
      + solidShapeXml({ id: 2031 + index * 4, name: `Knowledge Blackboard Step Number ${index + 1}`, geom: "ellipse", x: x + 152400, y: 3825240, cx: 243840, cy: 243840, fill: visual.accent })
      + textShapeXml({ id: 2032 + index * 4, name: `Knowledge Blackboard Step Number Text ${index + 1}`, x: x + 201168, y: 3870960, cx: 152400, cy: 121920, text: String(index + 1).padStart(2, "0"), size: 520, bold: true, color: visual.primary })
      + textShapeXml({ id: 2033 + index * 4, name: `Knowledge Blackboard Step Text ${index + 1}`, x: x + 487680, y: 3825240, cx: 853440, cy: 243840, text: knowledgeBlackboardCompactText(item, "", 10), size: 640, bold: true, color: visual.title });
  }).join("");
}

function knowledgeBlackboardSummaryXml({ visual, scene, palette }) {
  return scene.cards.slice(0, 3).map((item, index) => {
    const y = 1127760 + index * 670560;
    return solidShapeXml({ id: 2060 + index * 3, name: `Knowledge Blackboard Summary Note ${index + 1}`, geom: "roundRect", x: 5943600, y, cx: 2133600, cy: 457200, fill: visual.surface })
      + rectShapeXml({ id: 2061 + index * 3, name: `Knowledge Blackboard Summary Pin ${index + 1}`, x: 6111240, y: y + 152400, cx: 121920, cy: 121920, fill: index === 1 ? visual.secondary || "60A5FA" : visual.accent })
      + textShapeXml({ id: 2062 + index * 3, name: `Knowledge Blackboard Summary Text ${index + 1}`, x: 6340320, y: y + 121920, cx: 1371600, cy: 182880, text: knowledgeBlackboardCompactText(item, "", 12), size: 660, bold: true, color: visual.primary });
  }).join("") + rectShapeXml({ id: 2075, name: "Knowledge Blackboard Summary Chalk", x: 6195060, y: 3154680, cx: 1447800, cy: 53340, fill: palette.wood });
}

function knowledgeBlackboardSceneFromSlide({ slide, index, role }) {
  const bullets = knowledgeBlackboardBulletTexts(slide);
  const rawRole = String(slide?.layout || role || "");
  const sceneRole = index === 0
    ? "cover"
    : rawRole.includes("concept") || rawRole.includes("outline")
      ? "concept"
      : rawRole.includes("case")
        ? "case"
        : rawRole.includes("step")
          ? "steps"
          : rawRole.includes("summary") || rawRole === "closing"
            ? "summary"
            : ["concept", "detail", "case", "steps", "summary"][(index - 1) % 5];
  return {
    role: sceneRole,
    kicker: sceneRole === "cover" ? "LESSON 01" : sceneRole === "concept" ? "CONCEPT MAP" : sceneRole === "case" ? "CASE STUDY" : sceneRole === "steps" ? "STEP BY STEP" : sceneRole === "summary" ? "LESSON REVIEW" : "KEY POINT",
    title: knowledgeBlackboardCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28),
    bullets,
    note: knowledgeBlackboardCompactText(bullets[0], "课程内容拆解", 18),
    cards: ["定义边界", "原理结构", "例题迁移"].map((fallback, itemIndex) => knowledgeBlackboardCompactText(bullets[itemIndex], fallback, 12)),
    steps: ["观察", "拆解", "推导", "练习"].map((fallback, itemIndex) => knowledgeBlackboardCompactText(bullets[itemIndex], fallback, 10)),
  };
}

function knowledgeBlackboardBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text || item.title || item.label || item.value || "").trim();
    return "";
  }).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["拆解核心概念和定义边界", "补充原理结构和例题过程", "整理练习任务与课堂反馈"];
}

function knowledgeBlackboardCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function knowledgeBlackboardColorPalette(visual) {
  return {
    grid: blendHexColor(visual.primary, visual.background, 0.42),
    wood: "C8B88F",
    card: "234C42",
    paperInk: "8A7B5D",
    paperFrame: "D8CDAF",
  };
}

function isKnowledgeBlackboardVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "knowledge-blackboard" && (id === "knowledge-handout" || id === "education-knowledge-handout-blackboard");
}

function examReviewKeypointsDecorationsXml({ visual, index, role, slide }) {
  const scene = examReviewKeypointsSceneFromSlide({ slide, index, role });
  const palette = examReviewKeypointsColorPalette(visual);
  // 考试复习模板使用可编辑图形模拟答题卡、错题夹和复习计划，避免下载后只有整页图片。
  const base = rectShapeXml({ id: 2201, name: "Exam Review Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.background })
    + examReviewGridXml({ palette })
    + solidShapeXml({ id: 2208, name: "Exam Review Canvas", geom: "roundRect", x: 530352, y: 411480, cx: 8083296, cy: 4312920, fill: palette.surface })
    + lineFrameShapeXml({ id: 2209, name: "Exam Review Canvas Frame", geom: "roundRect", x: 530352, y: 411480, cx: 8083296, cy: 4312920, stroke: palette.frame, width: 9525 })
    + rectShapeXml({ id: 2210, name: "Exam Review Header Strip", x: 0, y: 0, cx: 9144000, cy: 396240, fill: visual.primary })
    + textShapeXml({ id: 2211, name: "Exam Review Kicker", x: 786384, y: 670560, cx: 2743200, cy: 274320, text: scene.kicker, size: 820, bold: true, color: visual.accent })
    + solidShapeXml({ id: 2212, name: "Exam Review Highlight Bar", geom: "roundRect", x: 786384, y: index === 0 ? 2225040 : 1950720, cx: 2895600, cy: 76200, fill: visual.accent });
  const bullets = examReviewBulletXml({ visual, scene, index });
  if (scene.role === "framework" || scene.role === "keypoints") return base + bullets + examReviewFrameworkXml({ visual, scene, palette }) + examReviewPlanXml({ visual, scene, palette });
  if (scene.role === "mistakes") return base + bullets + examReviewMistakeXml({ visual, scene, palette }) + examReviewPlanXml({ visual, scene, palette });
  if (scene.role === "plan" || scene.role === "roadmap") return base + bullets + examReviewAnswerCardXml({ visual, palette }) + examReviewPlanXml({ visual, scene, palette });
  if (scene.role === "summary") return base + bullets + examReviewSummaryXml({ visual, scene, palette }) + examReviewPlanXml({ visual, scene, palette });
  return base + bullets + examReviewAnswerCardXml({ visual, palette }) + examReviewPlanXml({ visual, scene, palette });
}

function examReviewGridXml({ palette }) {
  const vertical = [914400, 1325880, 1737360, 2148840, 2560320, 2971800, 3383280, 3794760, 4206240, 4617720, 5029200, 5440680, 5852160, 6263640, 6675120, 7086600, 7498080, 7909560]
    .map((x, index) => rectShapeXml({ id: 2220 + index, name: `Exam Review Grid V ${index + 1}`, x, y: 411480, cx: 7620, cy: 4312920, fill: palette.grid })).join("");
  const horizontal = [792480, 1188720, 1584960, 1981200, 2377440, 2773680, 3169920, 3566160, 3962400, 4358640]
    .map((y, index) => rectShapeXml({ id: 2245 + index, name: `Exam Review Grid H ${index + 1}`, x: 530352, y, cx: 8083296, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal;
}

function examReviewBulletXml({ visual, scene, index }) {
  return scene.bullets.slice(0, 4).map((item, itemIndex) => {
    const y = (index === 0 ? 2514600 : 1912620) + itemIndex * 243840;
    return solidShapeXml({ id: 2260 + itemIndex * 3, name: `Exam Review Bullet Dot ${itemIndex + 1}`, geom: "ellipse", x: 804672, y: y + 45720, cx: 68580, cy: 68580, fill: visual.accent })
      + textShapeXml({ id: 2261 + itemIndex * 3, name: `Exam Review Bullet Text ${itemIndex + 1}`, x: 914400, y, cx: 3352800, cy: 198120, text: examReviewCompactText(item, scene.title, 34), size: index === 0 ? 760 : 680, bold: false, color: visual.body });
  }).join("");
}

function examReviewAnswerCardXml({ visual, palette }) {
  return solidShapeXml({ id: 2280, name: "Exam Review Answer Card", geom: "roundRect", x: 5638800, y: 914400, cx: 2590800, cy: 2133600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 2281, name: "Exam Review Answer Card Frame", geom: "roundRect", x: 5638800, y: 914400, cx: 2590800, cy: 2133600, stroke: palette.frame, width: 9525 })
    + solidShapeXml({ id: 2282, name: "Exam Review Answer Line 1", geom: "roundRect", x: 5996940, y: 1341120, cx: 1219200, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 2283, name: "Exam Review Answer Line 2", geom: "roundRect", x: 5996940, y: 1905000, cx: 1066800, cy: 121920, fill: visual.accent })
    + solidShapeXml({ id: 2284, name: "Exam Review Answer Circle", geom: "ellipse", x: 7353300, y: 2476500, cx: 472440, cy: 472440, fill: visual.secondary || visual.accent })
    + solidShapeXml({ id: 2285, name: "Exam Review Answer Mark", geom: "roundRect", x: 5996940, y: 2567940, cx: 548640, cy: 304800, fill: palette.warningSoft });
}

function examReviewFrameworkXml({ visual, scene, palette }) {
  return scene.cards.concat(scene.steps.slice(0, 1)).slice(0, 4).map((item, index) => {
    const x = 5638800 + (index % 2) * 1325880;
    const y = 914400 + Math.floor(index / 2) * 1066800;
    return solidShapeXml({ id: 2290 + index * 4, name: `Exam Review Framework Card ${index + 1}`, geom: "roundRect", x, y, cx: 1188720, cy: 899160, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 2291 + index * 4, name: `Exam Review Framework Frame ${index + 1}`, geom: "roundRect", x, y, cx: 1188720, cy: 899160, stroke: palette.frame, width: 9525 })
      + solidShapeXml({ id: 2292 + index * 4, name: `Exam Review Framework Rule ${index + 1}`, geom: "roundRect", x: x + 152400, y: y + 182880, cx: 396240, cy: 60960, fill: visual.accent })
      + textShapeXml({ id: 2293 + index * 4, name: `Exam Review Framework Text ${index + 1}`, x: x + 152400, y: y + 365760, cx: 822960, cy: 243840, text: examReviewCompactText(item, "", 12), size: 660, bold: true, color: visual.title });
  }).join("");
}

function examReviewMistakeXml({ visual, scene, palette }) {
  return scene.cards.slice(0, 3).map((item, index) => {
    const y = 990600 + index * 670560;
    return solidShapeXml({ id: 2320 + index * 4, name: `Exam Review Mistake Card ${index + 1}`, geom: "roundRect", x: 5638800, y, cx: 2590800, cy: 518160, fill: palette.warningBg })
      + lineFrameShapeXml({ id: 2321 + index * 4, name: `Exam Review Mistake Frame ${index + 1}`, geom: "roundRect", x: 5638800, y, cx: 2590800, cy: 518160, stroke: palette.warningFrame, width: 9525 })
      + solidShapeXml({ id: 2322 + index * 4, name: `Exam Review Mistake Dot ${index + 1}`, geom: "ellipse", x: 5867400, y: y + 167640, cx: 167640, cy: 167640, fill: visual.warning || "EF4444" })
      + textShapeXml({ id: 2323 + index * 4, name: `Exam Review Mistake Text ${index + 1}`, x: 6156960, y: y + 137160, cx: 1676400, cy: 213360, text: examReviewCompactText(item, "", 14), size: 660, bold: true, color: visual.title });
  }).join("");
}

function examReviewPlanXml({ visual, scene, palette }) {
  return scene.steps.slice(0, 4).map((item, index) => {
    const x = 731520 + index * 2011680;
    return solidShapeXml({ id: 2350 + index * 5, name: `Exam Review Plan Step ${index + 1}`, geom: "roundRect", x, y: 3924300, cx: 1767840, cy: 579120, fill: palette.plan })
      + lineFrameShapeXml({ id: 2351 + index * 5, name: `Exam Review Plan Frame ${index + 1}`, geom: "roundRect", x, y: 3924300, cx: 1767840, cy: 579120, stroke: palette.frame, width: 7620 })
      + solidShapeXml({ id: 2352 + index * 5, name: `Exam Review Plan Number ${index + 1}`, geom: "ellipse", x: x + 152400, y: 4084320, cx: 243840, cy: 243840, fill: visual.primary })
      + textShapeXml({ id: 2353 + index * 5, name: `Exam Review Plan Number Text ${index + 1}`, x: x + 198120, y: 4122420, cx: 152400, cy: 121920, text: String(index + 1), size: 620, bold: true, color: "FFFFFF" })
      + textShapeXml({ id: 2354 + index * 5, name: `Exam Review Plan Text ${index + 1}`, x: x + 487680, y: 4053840, cx: 990600, cy: 228600, text: examReviewCompactText(item, "", 10), size: 640, bold: true, color: visual.title });
  }).join("");
}

function examReviewSummaryXml({ visual, scene }) {
  return scene.cards.slice(0, 3).map((item, index) => {
    const y = 990600 + index * 655320;
    return solidShapeXml({ id: 2380 + index * 3, name: `Exam Review Summary Card ${index + 1}`, geom: "roundRect", x: 5638800, y, cx: 2590800, cy: 502920, fill: "FFFFFF" })
      + rectShapeXml({ id: 2381 + index * 3, name: `Exam Review Summary Accent ${index + 1}`, x: 5638800, y, cx: 60960, cy: 502920, fill: visual.accent })
      + textShapeXml({ id: 2382 + index * 3, name: `Exam Review Summary Text ${index + 1}`, x: 5867400, y: y + 137160, cx: 1676400, cy: 213360, text: examReviewCompactText(item, "", 14), size: 660, bold: true, color: visual.title });
  }).join("");
}

function examReviewKeypointsSceneFromSlide({ slide, index, role }) {
  const bullets = examReviewKeypointTexts(slide);
  const rawRole = String(slide?.layout || role || "");
  const sceneRole = index === 0
    ? "cover"
    : rawRole.includes("roadmap")
      ? "roadmap"
      : rawRole.includes("framework")
        ? "framework"
        : rawRole.includes("mistake")
          ? "mistakes"
          : rawRole.includes("plan")
            ? "plan"
            : rawRole.includes("summary") || rawRole === "closing"
              ? "summary"
              : ["keypoints", "framework", "mistakes", "plan", "summary"][(index - 1) % 5];
  const kickerMap = { cover: "EXAM REVIEW", roadmap: "REVIEW PATH", framework: "KNOWLEDGE MAP", mistakes: "ERROR ANALYSIS", plan: "FINAL SPRINT", summary: "REVIEW SUMMARY", keypoints: "KEY TAKEAWAYS" };
  return {
    role: sceneRole,
    kicker: kickerMap[sceneRole] || "KEY TAKEAWAYS",
    bullets,
    cards: ["考点结构", "必背方法", "练习反馈"].map((fallback, itemIndex) => examReviewCompactText(bullets[itemIndex], fallback, 12)),
    steps: ["框架", "考点", "错题", "计划"].map((fallback, itemIndex) => examReviewCompactText(bullets[itemIndex], fallback, 10)),
  };
}

function examReviewKeypointTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["梳理高频考点和必背公式", "归因错题类型并建立修正方法", "安排冲刺练习和查漏补缺节奏"];
}

function examReviewCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function examReviewKeypointsColorPalette(visual) {
  return {
    background: normalizeHexColor(visual.background || "F4F7FB"),
    surface: normalizeHexColor(visual.surface || "FFFFFF"),
    frame: "C7D2FE",
    grid: "E8EEF9",
    plan: "EEF6FF",
    warningBg: "FFF7ED",
    warningFrame: "FED7AA",
    warningSoft: normalizeHexColor(visual.warning || "EF4444"),
  };
}

function isExamReviewKeypointsVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "exam-review-keypoints" && (id === "exam-review-courseware" || id === "education-exam-review-courseware-key-points");
}

function teachingAchievementDecorationsXml({ visual, index, role, slide }) {
  const scene = teachingAchievementSceneFromSlide({ slide, index, role });
  const palette = teachingAchievementColorPalette(visual);
  // 教学成果汇报模板的页面骨架用 DrawingML 绘制，保证在线预览和下载 PPTX 都能保留可编辑结构。
  const base = rectShapeXml({ id: 2701, name: "Teaching Achievement Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.background })
    + teachingAchievementGridXml({ palette })
    + solidShapeXml({ id: 2710, name: "Teaching Achievement Canvas", geom: "roundRect", x: 530352, y: 411480, cx: 8083296, cy: 4312920, fill: palette.surface })
    + lineFrameShapeXml({ id: 2711, name: "Teaching Achievement Canvas Frame", geom: "roundRect", x: 530352, y: 411480, cx: 8083296, cy: 4312920, stroke: palette.frame, width: 9525 })
    + rectShapeXml({ id: 2712, name: "Teaching Achievement Header", x: 0, y: 0, cx: 9144000, cy: 365760, fill: visual.primary })
    + solidShapeXml({ id: 2713, name: "Teaching Achievement Glow", geom: "ellipse", x: 6217920, y: 182880, cx: 2438400, cy: 1676400, fill: palette.glow })
    + solidShapeXml({ id: 2714, name: "Teaching Achievement Corner Tag", geom: "roundRect", x: 7437120, y: 571500, cx: 533400, cy: 1277640, fill: palette.mint })
    + textShapeXml({ id: 2715, name: "Teaching Achievement Kicker", x: 786384, y: 670560, cx: 3048000, cy: 274320, text: scene.kicker, size: 780, bold: true, color: visual.accent })
    + rectShapeXml({ id: 2716, name: "Teaching Achievement Focus Rule", x: 786384, y: index === 0 ? 2194560 : 1905000, cx: 2895600, cy: 53340, fill: visual.accent });
  const bullets = teachingAchievementBulletXml({ visual, scene, index });
  if (scene.role === "gallery") return base + bullets + teachingAchievementWallXml({ visual, scene, palette }) + teachingAchievementMetricsXml({ visual, scene, palette });
  if (scene.role === "analysis") return base + bullets + teachingAchievementAnalysisXml({ visual, scene, palette }) + teachingAchievementFeedbackXml({ visual, scene, palette });
  if (scene.role === "review") return base + bullets + teachingAchievementRoadmapXml({ visual, scene, palette }) + teachingAchievementFeedbackXml({ visual, scene, palette });
  if (scene.role === "summary") return base + bullets + teachingAchievementSummaryXml({ visual, scene, palette }) + teachingAchievementRoadmapXml({ visual, scene, palette });
  return base + bullets + teachingAchievementMedalXml({ visual, scene, palette }) + teachingAchievementMetricsXml({ visual, scene, palette });
}

function teachingAchievementGridXml({ palette }) {
  const vertical = [914400, 1371600, 1828800, 2286000, 2743200, 3200400, 3657600, 4114800, 4572000, 5029200, 5486400, 5943600, 6400800, 6858000, 7315200, 7772400, 8229600]
    .map((x, index) => rectShapeXml({ id: 2720 + index, name: `Teaching Achievement Grid V ${index + 1}`, x, y: 411480, cx: 7620, cy: 4312920, fill: palette.grid })).join("");
  const horizontal = [792480, 1188720, 1584960, 1981200, 2377440, 2773680, 3169920, 3566160, 3962400, 4358640]
    .map((y, index) => rectShapeXml({ id: 2745 + index, name: `Teaching Achievement Grid H ${index + 1}`, x: 530352, y, cx: 8083296, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal;
}

function teachingAchievementBulletXml({ visual, scene, index }) {
  return scene.bullets.slice(0, 4).map((item, itemIndex) => {
    const y = (index === 0 ? 2476500 : 1844040) + itemIndex * 243840;
    return solidShapeXml({ id: 2760 + itemIndex * 3, name: `Teaching Achievement Bullet Dot ${itemIndex + 1}`, geom: "ellipse", x: 804672, y: y + 45720, cx: 68580, cy: 68580, fill: visual.accent })
      + textShapeXml({ id: 2761 + itemIndex * 3, name: `Teaching Achievement Bullet Text ${itemIndex + 1}`, x: 914400, y, cx: 3444240, cy: 198120, text: teachingAchievementCompactText(item, scene.title, 34), size: index === 0 ? 740 : 660, bold: false, color: visual.body });
  }).join("");
}

function teachingAchievementMedalXml({ visual, scene, palette }) {
  return solidShapeXml({ id: 2780, name: "Teaching Achievement Medal Panel", geom: "roundRect", x: 5638800, y: 914400, cx: 2590800, cy: 2133600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 2781, name: "Teaching Achievement Medal Frame", geom: "roundRect", x: 5638800, y: 914400, cx: 2590800, cy: 2133600, stroke: palette.frame, width: 9525 })
    + solidShapeXml({ id: 2782, name: "Teaching Achievement Medal Ribbon Left", geom: "parallelogram", x: 6339840, y: 2217420, cx: 381000, cy: 822960, fill: visual.primary })
    + solidShapeXml({ id: 2783, name: "Teaching Achievement Medal Ribbon Right", geom: "parallelogram", x: 6804660, y: 2217420, cx: 381000, cy: 822960, fill: visual.accent })
    + solidShapeXml({ id: 2784, name: "Teaching Achievement Medal Disc", geom: "ellipse", x: 6256020, y: 1188720, cx: 1143000, cy: 1143000, fill: visual.secondary || "F59E0B" })
    + solidShapeXml({ id: 2785, name: "Teaching Achievement Medal Inner Disc", geom: "ellipse", x: 6507480, y: 1440180, cx: 640080, cy: 640080, fill: palette.goldSoft })
    + textShapeXml({ id: 2786, name: "Teaching Achievement Medal Label", x: 5913120, y: 3337560, cx: 2133600, cy: 243840, text: teachingAchievementCompactText(scene.cards[0], "Learning Milestone", 16), size: 700, bold: true, color: visual.title });
}

function teachingAchievementMetricsXml({ visual, scene, palette }) {
  return scene.metrics.slice(0, 3).map((item, index) => {
    const x = 731520 + index * 2011680;
    return solidShapeXml({ id: 2800 + index * 5, name: `Teaching Achievement Metric Card ${index + 1}`, geom: "roundRect", x, y: 3893820, cx: 1767840, cy: 609600, fill: palette.metric })
      + lineFrameShapeXml({ id: 2801 + index * 5, name: `Teaching Achievement Metric Frame ${index + 1}`, geom: "roundRect", x, y: 3893820, cx: 1767840, cy: 609600, stroke: palette.frame, width: 7620 })
      + textShapeXml({ id: 2802 + index * 5, name: `Teaching Achievement Metric Number ${index + 1}`, x: x + 167640, y: 4015740, cx: 502920, cy: 213360, text: ["92%", "36", "4.8"][index], size: 820, bold: true, color: visual.primary })
      + rectShapeXml({ id: 2803 + index * 5, name: `Teaching Achievement Metric Rule ${index + 1}`, x: x + 167640, y: 4282440, cx: 457200, cy: 30480, fill: visual.accent })
      + textShapeXml({ id: 2804 + index * 5, name: `Teaching Achievement Metric Text ${index + 1}`, x: x + 746760, y: 4038600, cx: 807720, cy: 274320, text: teachingAchievementCompactText(item, "", 10), size: 610, bold: true, color: visual.title });
  }).join("");
}

function teachingAchievementWallXml({ visual, scene, palette }) {
  return scene.cards.slice(0, 4).map((item, index) => {
    const x = 5486400 + (index % 2) * 1325880;
    const y = 914400 + Math.floor(index / 2) * 1066800;
    return solidShapeXml({ id: 2820 + index * 4, name: `Teaching Achievement Wall Card ${index + 1}`, geom: "roundRect", x, y, cx: 1188720, cy: 899160, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 2821 + index * 4, name: `Teaching Achievement Wall Frame ${index + 1}`, geom: "roundRect", x, y, cx: 1188720, cy: 899160, stroke: palette.frame, width: 7620 })
      + rectShapeXml({ id: 2822 + index * 4, name: `Teaching Achievement Wall Color Strip ${index + 1}`, x, y, cx: 1188720, cy: 76200, fill: index % 2 === 0 ? visual.primary : visual.accent })
      + textShapeXml({ id: 2823 + index * 4, name: `Teaching Achievement Wall Text ${index + 1}`, x: x + 137160, y: y + 259080, cx: 853440, cy: 274320, text: teachingAchievementCompactText(item, "", 12), size: 650, bold: true, color: visual.title });
  }).join("");
}

function teachingAchievementAnalysisXml({ visual, scene, palette }) {
  const bars = scene.metrics.slice(0, 4).map((item, index) => {
    const y = 1303020 + index * 396240;
    const width = [1524000, 1219200, 1676400, 1066800][index];
    return textShapeXml({ id: 2840 + index * 4, name: `Teaching Achievement Chart Label ${index + 1}`, x: 5638800, y: y - 30480, cx: 914400, cy: 167640, text: teachingAchievementCompactText(item, "", 6), size: 560, bold: true, color: visual.body })
      + solidShapeXml({ id: 2841 + index * 4, name: `Teaching Achievement Chart Track ${index + 1}`, geom: "roundRect", x: 6629400, y, cx: 1524000, cy: 152400, fill: palette.track })
      + solidShapeXml({ id: 2842 + index * 4, name: `Teaching Achievement Chart Bar ${index + 1}`, geom: "roundRect", x: 6629400, y, cx: width, cy: 152400, fill: index % 2 === 0 ? visual.accent : visual.secondary || "F59E0B" });
  }).join("");
  return solidShapeXml({ id: 2836, name: "Teaching Achievement Analysis Panel", geom: "roundRect", x: 5486400, y: 944880, cx: 2895600, cy: 2133600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 2837, name: "Teaching Achievement Analysis Frame", geom: "roundRect", x: 5486400, y: 944880, cx: 2895600, cy: 2133600, stroke: palette.frame, width: 7620 })
    + textShapeXml({ id: 2838, name: "Teaching Achievement Analysis Title", x: 5715000, y: 1097280, cx: 2133600, cy: 213360, text: "Outcome Index", size: 720, bold: true, color: visual.title })
    + bars;
}

function teachingAchievementFeedbackXml({ visual, scene, palette }) {
  return scene.cards.slice(0, 3).map((item, index) => {
    const x = 5638800 + index * 914400;
    return solidShapeXml({ id: 2860 + index * 4, name: `Teaching Achievement Feedback Bubble ${index + 1}`, geom: "roundRect", x, y: 3413760, cx: 762000, cy: 548640, fill: palette.feedback })
      + solidShapeXml({ id: 2861 + index * 4, name: `Teaching Achievement Feedback Dot ${index + 1}`, geom: "ellipse", x: x + 259080, y: 4053840, cx: 213360, cy: 213360, fill: index % 2 === 0 ? visual.accent : visual.secondary || "F59E0B" })
      + textShapeXml({ id: 2862 + index * 4, name: `Teaching Achievement Feedback Text ${index + 1}`, x: x + 106680, y: 3566160, cx: 548640, cy: 182880, text: teachingAchievementCompactText(item, "", 8), size: 560, bold: true, color: visual.title });
  }).join("");
}

function teachingAchievementRoadmapXml({ visual, scene, palette }) {
  const rail = rectShapeXml({ id: 2870, name: "Teaching Achievement Roadmap Rail", x: 5524500, y: 2484120, cx: 2743200, cy: 38100, fill: palette.frame });
  const steps = scene.metrics.slice(0, 4).map((item, index) => {
    const x = 5638800 + index * 655320;
    return solidShapeXml({ id: 2871 + index * 4, name: `Teaching Achievement Roadmap Node ${index + 1}`, geom: "ellipse", x, y: 2362200, cx: 281940, cy: 281940, fill: index % 2 === 0 ? visual.primary : visual.accent })
      + textShapeXml({ id: 2872 + index * 4, name: `Teaching Achievement Roadmap Text ${index + 1}`, x: x - 121920, y: 2788920, cx: 548640, cy: 228600, text: teachingAchievementCompactText(item, "", 8), size: 560, bold: true, color: visual.title });
  }).join("");
  return solidShapeXml({ id: 2869, name: "Teaching Achievement Roadmap Panel", geom: "roundRect", x: 5486400, y: 914400, cx: 2895600, cy: 2743200, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 2879, name: "Teaching Achievement Roadmap Frame", geom: "roundRect", x: 5486400, y: 914400, cx: 2895600, cy: 2743200, stroke: palette.frame, width: 7620 })
    + textShapeXml({ id: 2880, name: "Teaching Achievement Roadmap Label", x: 5715000, y: 1127760, cx: 1981200, cy: 213360, text: "Project Review", size: 720, bold: true, color: visual.title })
    + rail
    + steps;
}

function teachingAchievementSummaryXml({ visual, scene, palette }) {
  return scene.cards.slice(0, 3).map((item, index) => {
    const y = 1066800 + index * 701040;
    return solidShapeXml({ id: 2890 + index * 4, name: `Teaching Achievement Summary Card ${index + 1}`, geom: "roundRect", x: 5638800, y, cx: 2590800, cy: 548640, fill: "FFFFFF" })
      + rectShapeXml({ id: 2891 + index * 4, name: `Teaching Achievement Summary Accent ${index + 1}`, x: 5638800, y, cx: 76200, cy: 548640, fill: index % 2 === 0 ? visual.primary : visual.accent })
      + textShapeXml({ id: 2892 + index * 4, name: `Teaching Achievement Summary Text ${index + 1}`, x: 5867400, y: y + 152400, cx: 1676400, cy: 213360, text: teachingAchievementCompactText(item, "", 14), size: 650, bold: true, color: visual.title });
  }).join("");
}

function teachingAchievementSceneFromSlide({ slide, index, role }) {
  const bullets = teachingAchievementTexts(slide);
  const rawRole = String(slide?.layout || role || "");
  const sceneRole = index === 0
    ? "cover"
    : rawRole.includes("gallery")
      ? "gallery"
      : rawRole.includes("analysis")
        ? "analysis"
        : rawRole.includes("review")
          ? "review"
          : rawRole.includes("summary") || rawRole === "closing"
            ? "summary"
            : ["gallery", "analysis", "review", "summary"][(index - 1) % 4];
  const kickerMap = { cover: "LEARNING OUTCOMES", gallery: "PORTFOLIO WALL", analysis: "STUDENT INSIGHT", review: "PROJECT REVIEW", summary: "NEXT ACTION" };
  return {
    role: sceneRole,
    title: exportTextValue(slide?.title) || "教学成果汇报",
    kicker: kickerMap[sceneRole] || "LEARNING OUTCOMES",
    bullets,
    cards: ["课堂作品", "能力提升", "评价反馈", "优秀案例"].map((fallback, itemIndex) => teachingAchievementCompactText(bullets[itemIndex], fallback, 12)),
    metrics: ["完成率", "作品数", "满意度", "改进项"].map((fallback, itemIndex) => teachingAchievementCompactText(bullets[itemIndex], fallback, 10)),
  };
}

function teachingAchievementTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["沉淀课程项目成果与课堂作品", "呈现学生表现和能力提升数据", "复盘教学过程并形成改进建议"];
}

function teachingAchievementCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function teachingAchievementColorPalette(visual) {
  return {
    background: normalizeHexColor(visual.background || "F4F8FB"),
    surface: normalizeHexColor(visual.surface || "FFFFFF"),
    frame: "C7D2FE",
    grid: "E7EEF8",
    glow: blendHexColor(normalizeHexColor(visual.accent || "14B8A6"), normalizeHexColor(visual.background || "F4F8FB"), 0.78),
    mint: "CCFBF1",
    metric: "F8FAFC",
    track: "E2E8F0",
    feedback: "F0FDFA",
    goldSoft: "FEF3C7",
  };
}

function isTeachingAchievementShowcaseVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "teaching-achievement-showcase" && (id === "teaching-achievement-report" || id === "education-teaching-achievement-report-showcase");
}

function educationSolutionDecorationsXml({ visual, index, role, slide }) {
  const scene = educationSolutionSceneFromSlide({ slide, index, role });
  const palette = educationSolutionColorPalette(visual);
  // 教育行业模板的主体结构全部用可编辑形状绘制，局部图形只承担装饰表达。
  const backdrop = rectShapeXml({ id: 960, name: "Education Solution Background Wash", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 961, name: "Education Solution Campus Glow", geom: "ellipse", x: 6949440, y: 274320, cx: 1905000, cy: 1600200, fill: palette.softAccent })
    + solidShapeXml({ id: 962, name: "Education Solution Learning Plane", geom: "parallelogram", x: -365760, y: 3505200, cx: 4724400, cy: 883920, fill: palette.tint })
    + rectShapeXml({ id: 963, name: "Education Solution Header", x: 0, y: 0, cx: 9144000, cy: 365760, fill: visual.primary })
    + rectShapeXml({ id: 964, name: "Education Solution Header Accent", x: 0, y: 365760, cx: 9144000, cy: 22860, fill: visual.accent });
  const surface = solidShapeXml({ id: 965, name: "Education Solution Workspace", geom: "roundRect", x: 566928, y: 627888, cx: 8016240, cy: 4072128, fill: visual.surface })
    + lineFrameShapeXml({ id: 966, name: "Education Solution Workspace Border", geom: "roundRect", x: 566928, y: 627888, cx: 8016240, cy: 4072128, stroke: palette.frame, width: 15240 });
  const header = textShapeXml({ id: 967, name: "Education Solution Kicker", x: 832104, y: 838200, cx: 2438400, cy: 274320, text: scene.kicker, size: 760, bold: true, color: visual.accent })
    + rectShapeXml({ id: 968, name: "Education Solution Focus Rule", x: 832104, y: index === 0 ? 2255520 : 2065020, cx: 3200400, cy: 22860, fill: visual.accent });
  const bullets = educationSolutionBulletCardsXml({ visual, scene, isCover: index === 0 });
  if (scene.role === "platform") return backdrop + surface + header + bullets + educationSolutionPathXml({ visual, palette, items: scene.path });
  if (scene.role === "scenarios") return backdrop + surface + header + bullets + educationSolutionScenarioXml({ visual, palette, items: scene.scenes }) + educationSolutionPlatformXml({ visual, palette });
  if (scene.role === "data") return backdrop + surface + header + bullets + educationSolutionDataXml({ visual, palette, items: scene.scenes });
  if (scene.role === "roadmap") return backdrop + surface + header + bullets + educationSolutionRoadmapXml({ visual, palette, items: scene.roadmap }) + educationSolutionPlatformXml({ visual, palette });
  return backdrop + surface + header + bullets + educationSolutionPlatformXml({ visual, palette }) + educationSolutionTagCardsXml({ visual, tags: scene.tags });
}

function educationSolutionPlatformXml({ visual, palette }) {
  return solidShapeXml({ id: 980, name: "Education Solution Platform Panel", geom: "roundRect", x: 5780520, y: 1021080, cx: 2743200, cy: 2438400, fill: palette.panel })
    + lineFrameShapeXml({ id: 981, name: "Education Solution Platform Border", geom: "roundRect", x: 5780520, y: 1021080, cx: 2743200, cy: 2438400, stroke: palette.frame, width: 12700 })
    + solidShapeXml({ id: 982, name: "Education Solution Course Card", geom: "roundRect", x: 6065520, y: 1303020, cx: 853440, cy: 1524000, fill: palette.courseCard })
    + solidShapeXml({ id: 983, name: "Education Solution Data Card Top", geom: "roundRect", x: 7155180, y: 1303020, cx: 914400, cy: 396240, fill: "FFFFFF" })
    + solidShapeXml({ id: 984, name: "Education Solution Data Card Middle", geom: "roundRect", x: 7155180, y: 1943100, cx: 914400, cy: 396240, fill: "FFFFFF" })
    + solidShapeXml({ id: 985, name: "Education Solution Data Card Bottom", geom: "roundRect", x: 7155180, y: 2583180, cx: 914400, cy: 396240, fill: "FFFFFF" })
    + rectShapeXml({ id: 986, name: "Education Solution Course Line 1", x: 6225540, y: 1600200, cx: 457200, cy: 45720, fill: visual.primary })
    + rectShapeXml({ id: 987, name: "Education Solution Course Line 2", x: 6225540, y: 1859280, cx: 548640, cy: 45720, fill: visual.accent })
    + solidShapeXml({ id: 988, name: "Education Solution Student Node", geom: "ellipse", x: 7795260, y: 1996440, cx: 137160, cy: 137160, fill: visual.accent })
    + solidShapeXml({ id: 989, name: "Education Solution Teacher Node", geom: "ellipse", x: 7482840, y: 2705100, cx: 137160, cy: 137160, fill: visual.primary });
}

function educationSolutionTagCardsXml({ visual, tags }) {
  return tags.slice(0, 3).map((tag, index) => {
    const x = 832104 + index * 1257300;
    return solidShapeXml({ id: 1000 + index * 3, name: `Education Solution Tag Card ${index + 1}`, geom: "roundRect", x, y: 3764280, cx: 1005840, cy: 472440, fill: "FFFFFF" })
      + rectShapeXml({ id: 1001 + index * 3, name: `Education Solution Tag Accent ${index + 1}`, x, y: 3764280, cx: 1005840, cy: 38100, fill: visual.accent })
      + textShapeXml({ id: 1002 + index * 3, name: `Education Solution Tag Text ${index + 1}`, x: x + 121920, y: 3901440, cx: 762000, cy: 182880, text: educationSolutionCompactText(tag, "", 8), size: 720, bold: true, color: visual.title });
  }).join("");
}

function educationSolutionBulletCardsXml({ visual, scene, isCover }) {
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = (isCover ? 2537460 : 1813560) + index * 243840;
    return rectShapeXml({ id: 1020 + index * 2, name: `Education Solution Bullet Rule ${index + 1}`, x: 832104, y: y + 30480, cx: 45720, cy: 137160, fill: visual.accent })
      + textShapeXml({ id: 1021 + index * 2, name: `Education Solution Bullet Text ${index + 1}`, x: 1005840, y, cx: 3444240, cy: 198120, text: educationSolutionCompactText(item, scene.title, 32), size: isCover ? 800 : 700, bold: false, color: visual.body });
  }).join("");
}

function educationSolutionPathXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const y = 1120140 + index * 548640;
    return solidShapeXml({ id: 1040 + index * 4, name: `Education Solution Service Path ${index + 1}`, geom: "roundRect", x: 5780520, y, cx: 2743200, cy: 396240, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1041 + index * 4, name: `Education Solution Service Path Border ${index + 1}`, geom: "roundRect", x: 5780520, y, cx: 2743200, cy: 396240, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1042 + index * 4, name: `Education Solution Path Node ${index + 1}`, geom: "roundRect", x: 5963400, y: y + 121920, cx: 121920, cy: 121920, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1043 + index * 4, name: `Education Solution Path Text ${index + 1}`, x: 6217920, y: y + 91440, cx: 1828800, cy: 182880, text: educationSolutionCompactText(item, "", 12), size: 740, bold: true, color: visual.title });
  }).join("");
}

function educationSolutionScenarioXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 975360 + index * 2286000;
    return solidShapeXml({ id: 1070 + index * 4, name: `Education Solution Scenario Card ${index + 1}`, geom: "roundRect", x, y: 3444240, cx: 1828800, cy: 792480, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1071 + index * 4, name: `Education Solution Scenario Border ${index + 1}`, geom: "roundRect", x, y: 3444240, cx: 1828800, cy: 792480, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1072 + index * 4, name: `Education Solution Scenario Icon ${index + 1}`, geom: "ellipse", x: x + 182880, y: 3657600, cx: 213360, cy: 213360, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1073 + index * 4, name: `Education Solution Scenario Text ${index + 1}`, x: x + 487680, y: 3657600, cx: 1066800, cy: 243840, text: educationSolutionCompactText(item, "", 12), size: 760, bold: true, color: visual.title });
  }).join("");
}

function educationSolutionDataXml({ visual, palette, items }) {
  const panel = solidShapeXml({ id: 1100, name: "Education Solution Learning Data Panel", geom: "roundRect", x: 5943600, y: 1219200, cx: 2438400, cy: 2133600, fill: visual.primary })
    + rectShapeXml({ id: 1101, name: "Education Solution Data Bar 1", x: 6324600, y: 2537460, cx: 243840, cy: 518160, fill: "FFFFFF", transparency: 18000 })
    + rectShapeXml({ id: 1102, name: "Education Solution Data Bar 2", x: 6713220, y: 2232660, cx: 243840, cy: 822960, fill: visual.accent, transparency: 6000 })
    + rectShapeXml({ id: 1103, name: "Education Solution Data Bar 3", x: 7101840, y: 2415540, cx: 243840, cy: 640080, fill: "FFFFFF", transparency: 14000 })
    + rectShapeXml({ id: 1104, name: "Education Solution Data Bar 4", x: 7490460, y: 2034540, cx: 243840, cy: 1021080, fill: "FFFFFF", transparency: 4000 });
  const cards = items.slice(0, 3).map((item, index) => {
    const x = 975360 + index * 2286000;
    return solidShapeXml({ id: 1110 + index * 3, name: `Education Solution Data Insight Card ${index + 1}`, geom: "roundRect", x, y: 3611880, cx: 1828800, cy: 609600, fill: "FFFFFF" })
      + rectShapeXml({ id: 1111 + index * 3, name: `Education Solution Data Insight Accent ${index + 1}`, x: x + 182880, y: 3840480, cx: 365760, cy: 30480, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1112 + index * 3, name: `Education Solution Data Insight Text ${index + 1}`, x: x + 182880, y: 3947160, cx: 1371600, cy: 182880, text: educationSolutionCompactText(item, "", 12), size: 740, bold: true, color: visual.title });
  }).join("");
  return panel + cards;
}

function educationSolutionRoadmapXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 853440 + index * 1973580;
    return solidShapeXml({ id: 1140 + index * 4, name: `Education Solution Roadmap Step ${index + 1}`, geom: "roundRect", x, y: 3444240, cx: 1524000, cy: 731520, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1141 + index * 4, name: `Education Solution Roadmap Border ${index + 1}`, geom: "roundRect", x, y: 3444240, cx: 1524000, cy: 731520, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 1142 + index * 4, name: `Education Solution Roadmap Marker ${index + 1}`, geom: "ellipse", x: x + 167640, y: 3611880, cx: 243840, cy: 243840, fill: index % 2 === 0 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1143 + index * 4, name: `Education Solution Roadmap Text ${index + 1}`, x: x + 487680, y: 3657600, cx: 822960, cy: 243840, text: educationSolutionCompactText(item, "", 10), size: 740, bold: true, color: visual.title });
  }).join("");
}

function educationSolutionSceneFromSlide({ slide, index, role }) {
  const bullets = educationSolutionBulletTexts(slide);
  const title = educationSolutionCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const rawRole = String(role || "");
  const sceneRole = index === 0
    ? "cover"
    : rawRole.includes("platform")
      ? "platform"
      : rawRole.includes("scenarios")
        ? "scenarios"
        : rawRole.includes("data")
          ? "data"
          : rawRole.includes("roadmap") || rawRole === "closing"
            ? "roadmap"
            : ["painpoints", "platform", "scenarios", "data"][(index - 1) % 4];
  const tags = ["教学场景", "平台服务", "数据洞察"].map((fallback, itemIndex) => educationSolutionCompactText(bullets[itemIndex], fallback, 8));
  const path = ["课程资源", "教学互动", "学情分析", "运营服务"].map((fallback, itemIndex) => educationSolutionCompactText(bullets[itemIndex], fallback, 12));
  const scenes = ["教师备课", "学生学习", "管理决策"].map((fallback, itemIndex) => educationSolutionCompactText(bullets[itemIndex], fallback, 12));
  const roadmap = ["调研", "试点", "推广", "运营"].map((fallback, itemIndex) => educationSolutionCompactText(bullets[itemIndex], fallback, 10));
  return {
    role: sceneRole,
    kicker: sceneRole === "cover" ? "SMART CAMPUS SOLUTION" : sceneRole === "platform" ? "PLATFORM ARCHITECTURE" : sceneRole === "scenarios" ? "TEACHING SCENARIOS" : sceneRole === "data" ? "LEARNING DATA" : "SERVICE ROADMAP",
    title,
    bullets,
    tags,
    path,
    scenes,
    roadmap,
  };
}

function educationSolutionBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["教育客户教学与管理场景痛点", "统一教学平台与服务体系建设", "学习数据分析带来运营改进"];
}

function educationSolutionCompactText(text, fallback, maxLength) {
  const raw = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(1, maxLength - 1))}…`;
}

function educationSolutionColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.32),
    tint: blendHexColor(visual.accent, visual.background, 0.86),
    softAccent: blendHexColor(visual.accent, visual.surface, 0.76),
    panel: blendHexColor(visual.background, visual.surface, 0.66),
    courseCard: blendHexColor(visual.accent, visual.surface, 0.86),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
  };
}

function isEducationSolutionVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "sales-education-solution" && (id === "industry-solution" || id === "sales-industry-solution-education-industry");
}

function annualSummaryCoverBackdropXml({ visual, palette }) {
  return solidShapeXml({ id: 701, name: "Annual Summary Cover Blue Base", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.primary })
    + solidShapeXml({ id: 702, name: "Annual Summary Cover Cyan Plane", geom: "parallelogram", x: 5029200, y: 0, cx: 4114800, cy: 5143500, fill: visual.accent })
    + solidShapeXml({ id: 703, name: "Annual Summary Cover Glass Plane One", geom: "parallelogram", x: 5791200, y: 571500, cx: 2514600, cy: 3657600, fill: palette.coverPlane })
    + solidShapeXml({ id: 704, name: "Annual Summary Cover Glass Plane Two", geom: "parallelogram", x: 6903720, y: 0, cx: 1600200, cy: 5143500, fill: palette.coverPlaneSoft })
    + rectShapeXml({ id: 705, name: "Annual Summary Cover White Rule", x: 731520, y: 3886200, cx: 2133600, cy: 30480, fill: "E9FBFF" });
}

function annualSummaryDashboardXml({ visual, palette, isCover }) {
  if (isCover) {
    return solidShapeXml({ id: 710, name: "Annual Summary Document Mockup", x: 6141720, y: 1447800, cx: 1295400, cy: 1676400, fill: "FFFFFF" })
      + rectShapeXml({ id: 711, name: "Annual Summary Doc Item Cyan", x: 6324600, y: 1691640, cx: 182880, cy: 137160, fill: visual.accent })
      + rectShapeXml({ id: 712, name: "Annual Summary Doc Line One", x: 6629400, y: 1722120, cx: 548640, cy: 60960, fill: "9FE6F0" })
      + rectShapeXml({ id: 713, name: "Annual Summary Doc Item Green", x: 6324600, y: 2125980, cx: 182880, cy: 137160, fill: "A8F05A" })
      + rectShapeXml({ id: 714, name: "Annual Summary Doc Line Two", x: 6629400, y: 2156460, cx: 609600, cy: 60960, fill: "9FE6F0" })
      + lineFrameShapeXml({ id: 715, name: "Annual Summary Magnifier Lens", geom: "ellipse", x: 7132320, y: 2446020, cx: 822960, cy: 822960, stroke: "DDFBFF", width: 76200 })
      + solidShapeXml({ id: 716, name: "Annual Summary Magnifier Handle", geom: "parallelogram", x: 7795260, y: 3063240, cx: 152400, cy: 548640, fill: "5AA7C8" });
  }
  return solidShapeXml({ id: 710, name: "Annual Summary Analysis Panel", x: 6324600, y: 1577340, cx: 1828800, cy: 1371600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 711, name: "Annual Summary Analysis Panel Stroke", x: 6324600, y: 1577340, cx: 1828800, cy: 1371600, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 712, name: "Annual Summary Dashboard Header", x: 6553200, y: 1828800, cx: 1066800, cy: 76200, fill: visual.primary })
    + rectShapeXml({ id: 713, name: "Annual Summary Dashboard Axis", x: 6553200, y: 2636520, cx: 1066800, cy: 15240, fill: palette.rule })
    + solidShapeXml({ id: 714, name: "Annual Summary Content Bar One", x: 6637020, y: 2415540, cx: 137160, cy: 220980, fill: visual.accent })
    + solidShapeXml({ id: 715, name: "Annual Summary Content Bar Two", x: 6903720, y: 2286000, cx: 137160, cy: 350520, fill: visual.primary })
    + solidShapeXml({ id: 716, name: "Annual Summary Content Bar Three", x: 7170420, y: 2141220, cx: 137160, cy: 495300, fill: visual.accent })
    + solidShapeXml({ id: 717, name: "Annual Summary Content Dot", geom: "ellipse", x: 7650480, y: 2171700, cx: 335280, cy: 335280, fill: palette.softGold });
}

function annualSummaryMetricCardsXml({ visual, palette, metrics }) {
  return metrics.map((metric, itemIndex) => {
    const x = 1524000 + itemIndex * 1371600;
    return solidShapeXml({ id: 730 + itemIndex * 4, name: `Annual Summary Metric Card ${itemIndex + 1}`, x, y: 3596640, cx: 1219200, cy: 563880, fill: palette.cardFill })
      + rectShapeXml({ id: 731 + itemIndex * 4, name: `Annual Summary Metric Gold Rule ${itemIndex + 1}`, x, y: 3596640, cx: 1219200, cy: 38100, fill: visual.accent })
      + textShapeXml({ id: 732 + itemIndex * 4, name: `Annual Summary Metric Value ${itemIndex + 1}`, x: x + 121920, y: 3695700, cx: 975360, cy: 182880, text: metric.value, size: 1180, bold: true, color: visual.title })
      + textShapeXml({ id: 733 + itemIndex * 4, name: `Annual Summary Metric Label ${itemIndex + 1}`, x: x + 121920, y: 3901440, cx: 975360, cy: 137160, text: metric.label, size: 680, bold: true, color: visual.body });
  }).join("");
}

function annualSummaryDiagnosticCardsXml({ visual, palette }) {
  const labels = ["经营亮点", "风险诊断", "来年行动"];
  return labels.map((label, itemIndex) => {
    const x = 1524000 + itemIndex * 1371600;
    return solidShapeXml({ id: 750 + itemIndex * 3, name: `Annual Summary Diagnostic Card ${itemIndex + 1}`, x, y: 3543300, cx: 1219200, cy: 426720, fill: palette.cardFill })
      + rectShapeXml({ id: 751 + itemIndex * 3, name: `Annual Summary Diagnostic Gold Rule ${itemIndex + 1}`, x, y: 3543300, cx: 1219200, cy: 38100, fill: visual.accent })
      + textShapeXml({ id: 752 + itemIndex * 3, name: `Annual Summary Diagnostic Text ${itemIndex + 1}`, x: x + 121920, y: 3688080, cx: 975360, cy: 152400, text: label, size: 820, bold: true, color: visual.title });
  }).join("");
}

function annualSummaryTimelineXml({ visual, palette }) {
  const dots = [1524000, 3657600, 5791200, 7924800].map((x, itemIndex) => (
    solidShapeXml({ id: 780 + itemIndex, name: `Annual Summary Timeline Dot ${itemIndex + 1}`, geom: "ellipse", x, y: 4328160, cx: 121920, cy: 121920, fill: itemIndex === 0 ? visual.primary : visual.accent })
  )).join("");
  return rectShapeXml({ id: 779, name: "Annual Summary Timeline Rule", x: 1524000, y: 4389120, cx: 6400800, cy: 22860, fill: palette.rule }) + dots;
}

function annualSummaryScene(visual) {
  const variant = annualSummaryVariant(visual);
  const scenes = {
    "blue-gold": {
      variant: "blue-gold",
      year: "2026",
      kicker: "ANNUAL REVIEW",
      section: "OPERATING INSIGHT",
      metrics: [
        { value: "128%", label: "目标达成" },
        { value: "36%", label: "业务增长" },
        { value: "12", label: "项目落地" },
      ],
    },
  };
  return scenes[variant] || scenes["blue-gold"];
}

function annualSummaryVariant(visual) {
  return ["blue-gold"].includes(visual?.variant) ? visual.variant : "blue-gold";
}

function annualSummaryColorPalette(visual) {
  return {
    coverWash: blendHexColor(visual.surface, visual.background, 0.12),
    sweep: blendHexColor(visual.accent, visual.surface, 0.35),
    frame: blendHexColor(visual.primary, visual.surface, 0.78),
    glass: blendHexColor(visual.surface, visual.primary, 0.28),
    glassStrong: blendHexColor(visual.surface, visual.primary, 0.42),
    year: blendHexColor(visual.primary, visual.surface, 0.18),
    rule: blendHexColor(visual.primary, visual.accent, 0.34),
    softGold: blendHexColor(visual.accent, visual.surface, 0.22),
    cardFill: blendHexColor(visual.surface, visual.accent, 0.08),
    coverPlane: blendHexColor(visual.accent, visual.surface, 0.42),
    coverPlaneSoft: blendHexColor(visual.accent, visual.surface, 0.66),
    coverYear: blendHexColor(visual.surface, visual.primary, 0.58),
  };
}

function isAnnualSummaryVisual(visual) {
  return visual?.id === "annual-business-summary" && visual?.layout === "annual-summary";
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
    + textShapeXml({ id: 163, name: "Sales Chip Text", ...chipText, text: "", size: 800, bold: true, color: "FFFFFF" })
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
    + textShapeXml({ id: 225, name: "Product Chip Text", ...chipText, text: "", size: 820, bold: true, color: "FFFFFF" })
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

function productReleaseCadenceDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = productReleaseCadenceScene({ slide, index, role });
  const palette = productReleaseCadenceColorPalette(visual);
  const isClosing = role === "closing";
  const surface = solidShapeXml({ id: 1681, name: "Product Cadence Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1682, name: "Product Cadence Header Bar", x: 0, y: 0, cx: 9144000, cy: 335280, fill: visual.primary })
    + rectShapeXml({ id: 1683, name: "Product Cadence Cyan Rule", x: 0, y: 304800, cx: 9144000, cy: 30480, fill: visual.accent })
    + rectShapeXml({ id: 1684, name: "Product Cadence Orange Rule", x: 0, y: 335280, cx: 9144000, cy: 15240, fill: visual.secondary || "F97316" })
    + lineFrameShapeXml({ id: 1685, name: "Product Cadence Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1686, name: "Product Cadence Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 1687, name: "Product Cadence Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  const bulletCards = productReleaseCadenceBulletCardsXml({ visual, items: scene.bullets, isClosing });

  if (isClosing) {
    return surface + header + focusRule + bulletCards + productReleaseCadenceActionCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "timeline") {
    return surface + header + focusRule + bulletCards + productReleaseCadenceWaveXml({ visual, palette }) + productReleaseCadenceTimelineXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "lanes") {
    return surface + header + focusRule + bulletCards + productReleaseCadenceLaneXml({ visual, palette, items: scene.cards }) + productReleaseCadenceTagCardsXml({ visual, palette, items: scene.tags });
  }
  if (scene.kind === "risk") {
    return surface + header + focusRule + bulletCards + productReleaseCadenceRiskXml({ visual, palette, items: scene.cards }) + productReleaseCadenceTagCardsXml({ visual, palette, items: scene.tags });
  }
  return surface + header + focusRule + bulletCards + productReleaseCadenceWaveXml({ visual, palette }) + productReleaseCadenceTagCardsXml({ visual, palette, items: scene.tags });
}

function productReleaseCadenceWaveXml({ visual, palette }) {
  const x = 5486400;
  const y = 1051560;
  const w = 2827020;
  const h = 1828800;
  const secondary = visual.secondary || "F97316";
  return solidShapeXml({ id: 1690, name: "Product Cadence Release Wave Panel", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.panel })
    + lineFrameShapeXml({ id: 1691, name: "Product Cadence Release Wave Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1692, name: "Product Cadence Wave Base", x: x + 365760, y: y + 990600, cx: w - 731520, cy: 38100, fill: palette.line })
    + rectShapeXml({ id: 1693, name: "Product Cadence Wave Segment 1", x: x + 426720, y: y + 1005840, cx: 670560, cy: 38100, fill: visual.accent })
    + rectShapeXml({ id: 1694, name: "Product Cadence Wave Segment 2", x: x + 1066800, y: y + 777240, cx: 670560, cy: 38100, fill: visual.accent })
    + rectShapeXml({ id: 1695, name: "Product Cadence Wave Segment 3", x: x + 1676400, y: y + 548640, cx: 670560, cy: 38100, fill: secondary })
    + [0, 1, 2, 3].map((itemIndex) => {
      const offsetX = x + 457200 + itemIndex * 548640;
      const offsetY = y + 960120 - itemIndex * 152400;
      return solidShapeXml({ id: 1696 + itemIndex, name: `Product Cadence Milestone Node ${itemIndex + 1}`, geom: "ellipse", x: offsetX, y: offsetY, cx: 152400, cy: 152400, fill: itemIndex === 2 ? secondary : visual.accent });
    }).join("");
}

function productReleaseCadenceBulletCardsXml({ visual, items, isClosing }) {
  const x = 768096;
  const y = isClosing ? 2217420 : 2438400;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 335280;
    return rectShapeXml({ id: 1710 + index * 3, name: `Product Cadence Insight Accent ${index + 1}`, x, y: offsetY + 38100, cx: 60960, cy: 198120, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1711 + index * 3, name: `Product Cadence Insight Text ${index + 1}`, x: x + 121920, y: offsetY, cx: 3444240, cy: 243840, text: productReleaseCadenceCompactText(item, "", 36), size: 720, bold: false, color: visual.body });
  }).join("");
}

function productReleaseCadenceTagCardsXml({ visual, palette, items }) {
  const x = 768096;
  const y = 3825240;
  const width = 1280160;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * 1432560;
    return solidShapeXml({ id: 1720 + index * 3, name: `Product Cadence Tag ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: width, cy: 518160, fill: palette.card })
      + rectShapeXml({ id: 1721 + index * 3, name: `Product Cadence Tag Accent ${index + 1}`, x: offsetX, y, cx: 60960, cy: 518160, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1722 + index * 3, name: `Product Cadence Tag Text ${index + 1}`, x: offsetX + 152400, y: y + 167640, cx: width - 274320, cy: 182880, text: productReleaseCadenceCompactText(item, "", 8), size: 760, bold: true, color: visual.title });
  }).join("");
}

function productReleaseCadenceTimelineXml({ visual, palette, items }) {
  const x = 768096;
  const y = 3543300;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 1981200;
    return solidShapeXml({ id: 1730 + index * 3, name: `Product Cadence Timeline Stage ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1676400, cy: 670560, fill: palette.card })
      + solidShapeXml({ id: 1731 + index * 3, name: `Product Cadence Timeline Dot ${index + 1}`, geom: "ellipse", x: offsetX + 152400, y: y + 121920, cx: 167640, cy: 167640, fill: index % 2 ? visual.secondary || "F97316" : visual.accent })
      + textShapeXml({ id: 1732 + index * 3, name: `Product Cadence Timeline Text ${index + 1}`, x: offsetX + 152400, y: y + 365760, cx: 1371600, cy: 182880, text: productReleaseCadenceCompactText(item, "", 12), size: 740, bold: true, color: visual.title });
  }).join("");
}

function productReleaseCadenceLaneXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1188720;
  return items.slice(0, 4).map((item, index) => {
    const offsetY = y + index * 563880;
    return solidShapeXml({ id: 1740 + index * 3, name: `Product Cadence Team Lane ${index + 1}`, geom: "roundRect", x, y: offsetY, cx: 2743200, cy: 426720, fill: palette.card })
      + rectShapeXml({ id: 1741 + index * 3, name: `Product Cadence Lane Progress ${index + 1}`, x: x + 182880, y: offsetY + 274320, cx: 1219200 + index * 182880, cy: 30480, fill: index % 2 ? visual.secondary || "F97316" : visual.accent })
      + textShapeXml({ id: 1742 + index * 3, name: `Product Cadence Lane Text ${index + 1}`, x: x + 182880, y: offsetY + 106680, cx: 2286000, cy: 137160, text: productReleaseCadenceCompactText(item, "", 14), size: 720, bold: true, color: visual.title });
  }).join("");
}

function productReleaseCadenceRiskXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1219200;
  const width = 1280160;
  const height = 731520;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + (index % 2) * (width + 182880);
    const offsetY = y + Math.floor(index / 2) * (height + 152400);
    return solidShapeXml({ id: 1750 + index * 4, name: `Product Cadence Risk Card ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: width, cy: height, fill: palette.risk })
      + solidShapeXml({ id: 1751 + index * 4, name: `Product Cadence Risk Dot ${index + 1}`, geom: "ellipse", x: offsetX + 152400, y: offsetY + 152400, cx: 152400, cy: 152400, fill: visual.secondary || "F97316" })
      + rectShapeXml({ id: 1752 + index * 4, name: `Product Cadence Risk Rule ${index + 1}`, x: offsetX + 365760, y: offsetY + 205740, cx: 579120, cy: 30480, fill: palette.line })
      + textShapeXml({ id: 1753 + index * 4, name: `Product Cadence Risk Text ${index + 1}`, x: offsetX + 152400, y: offsetY + 426720, cx: width - 304800, cy: 167640, text: productReleaseCadenceCompactText(item, "", 10), size: 660, bold: true, color: visual.title });
  }).join("");
}

function productReleaseCadenceActionCardsXml({ visual, palette, items }) {
  const x = 768096;
  const y = 3543300;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 1981200;
    return solidShapeXml({ id: 1770 + index * 3, name: `Product Cadence Next Action ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1676400, cy: 609600, fill: palette.card })
      + rectShapeXml({ id: 1771 + index * 3, name: `Product Cadence Next Action Rule ${index + 1}`, x: offsetX + 152400, y: y + 152400, cx: 426720, cy: 45720, fill: index % 2 ? visual.secondary || "F97316" : visual.accent })
      + textShapeXml({ id: 1772 + index * 3, name: `Product Cadence Next Action Text ${index + 1}`, x: offsetX + 152400, y: y + 335280, cx: 1371600, cy: 182880, text: productReleaseCadenceCompactText(item, "", 12), size: 740, bold: true, color: visual.title });
  }).join("");
}

function productReleaseCadenceScene({ slide, index, role }) {
  const bullets = productReleaseCadenceBulletTexts(slide);
  const tags = ["范围", "节奏", "协同"].map((fallback, itemIndex) => productReleaseCadenceCompactText(bullets[itemIndex], fallback, 8));
  const cards = ["范围冻结", "研发联调", "发布验证", "复盘迭代"].map((fallback, itemIndex) => productReleaseCadenceCompactText(bullets[itemIndex], fallback, 12));
  if (role === "closing") {
    return { kind: "closing", kicker: "NEXT RELEASE ACTIONS", bullets, tags, cards };
  }
  const scenes = [
    { kind: "cover", kicker: "PRODUCT CADENCE", bullets, tags, cards },
    { kind: "timeline", kicker: "RELEASE WAVES", bullets, tags, cards },
    { kind: "lanes", kicker: "TEAM LANES", bullets, tags, cards: ["产品范围", "研发交付", "设计验收", "运营发布"].map((fallback, itemIndex) => productReleaseCadenceCompactText(bullets[itemIndex], fallback, 12)) },
    { kind: "risk", kicker: "DEPENDENCY RISK", bullets, tags, cards: ["范围变化", "联调阻塞", "发布风险", "资源冲突"].map((fallback, itemIndex) => productReleaseCadenceCompactText(bullets[itemIndex], fallback, 12)) },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function productReleaseCadenceBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["明确版本范围和关键功能包", "按季度节奏推进研发联调与验收", "跨团队同步发布窗口和风险依赖"];
}

function productReleaseCadenceCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function productReleaseCadenceColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.12),
    panel: blendHexColor(visual.background, visual.surface, 0.48),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.74),
    line: blendHexColor(visual.primary, visual.background, 0.52),
    risk: blendHexColor(visual.secondary || "F97316", visual.surface, 0.14),
  };
}

function featurePriorityMatrixDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = featurePriorityMatrixScene({ slide, index, role });
  const palette = featurePriorityMatrixColorPalette(visual);
  const isClosing = role === "closing";
  // 价值矩阵模板只用可编辑形状绘制主体，避免整页图片造成预览和下载不一致。
  const surface = solidShapeXml({ id: 1801, name: "Feature Priority Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1802, name: "Feature Priority Header Bar", x: 0, y: 0, cx: 9144000, cy: 335280, fill: visual.primary })
    + rectShapeXml({ id: 1803, name: "Feature Priority Green Rule", x: 0, y: 304800, cx: 9144000, cy: 30480, fill: visual.accent })
    + lineFrameShapeXml({ id: 1804, name: "Feature Priority Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1805, name: "Feature Priority Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 1806, name: "Feature Priority Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  const bulletCards = featurePriorityBulletCardsXml({ visual, items: scene.bullets, isClosing });

  if (isClosing) {
    return surface + header + focusRule + bulletCards + featurePriorityDecisionLoopXml({ visual, palette }) + featurePriorityActionCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "ranking") {
    return surface + header + focusRule + bulletCards + featurePriorityRankingXml({ visual, palette }) + featurePriorityTagCardsXml({ visual, palette, items: scene.tags });
  }
  if (scene.kind === "resource") {
    return surface + header + focusRule + bulletCards + featurePriorityResourceXml({ visual, palette, items: scene.cards }) + featurePriorityTagCardsXml({ visual, palette, items: scene.tags });
  }
  return surface + header + focusRule + bulletCards + featurePriorityMatrixChartXml({ visual, palette }) + featurePriorityTagCardsXml({ visual, palette, items: scene.tags });
}

function featurePriorityMatrixChartXml({ visual, palette }) {
  const x = 5486400;
  const y = 1051560;
  const w = 2827020;
  const h = 1905000;
  return solidShapeXml({ id: 1810, name: "Feature Priority Value Matrix Panel", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.panel })
    + lineFrameShapeXml({ id: 1811, name: "Feature Priority Matrix Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1812, name: "Feature Priority Vertical Axis", x: x + Math.round(w / 2), y: y + 274320, cx: 15240, cy: h - 548640, fill: palette.axis })
    + rectShapeXml({ id: 1813, name: "Feature Priority Horizontal Axis", x: x + 365760, y: y + Math.round(h / 2), cx: w - 731520, cy: 15240, fill: palette.axis })
    + rectShapeXml({ id: 1814, name: "Feature Priority High Value Zone", x: x + 1524000, y: y + 228600, cx: 975360, cy: 533400, fill: palette.greenZone, transparency: 35000 })
    + rectShapeXml({ id: 1815, name: "Feature Priority High Cost Zone", x: x + 304800, y: y + 1143000, cx: 914400, cy: 457200, fill: palette.orangeZone, transparency: 30000 })
    + [
      { x: x + 1866900, y: y + 502920, fill: visual.primary },
      { x: x + 731520, y: y + 1219200, fill: visual.accent },
      { x: x + 2156460, y: y + 1226820, fill: "14B8A6" },
      { x: x + 822960, y: y + 579120, fill: visual.secondary || "F97316" },
    ].map((dot, itemIndex) => solidShapeXml({ id: 1816 + itemIndex, name: `Feature Priority Decision Dot ${itemIndex + 1}`, geom: "ellipse", x: dot.x, y: dot.y, cx: 152400, cy: 152400, fill: dot.fill })).join("");
}

function featurePriorityBulletCardsXml({ visual, items, isClosing }) {
  const x = 823056;
  const y = isClosing ? 2217420 : 2552700;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 312420;
    return rectShapeXml({ id: 1830 + index * 3, name: `Feature Priority Insight Accent ${index + 1}`, x, y: offsetY + 38100, cx: 60960, cy: 190500, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1831 + index * 3, name: `Feature Priority Insight Text ${index + 1}`, x: x + 121920, y: offsetY, cx: 3444240, cy: 228600, text: featurePriorityMatrixCompactText(item, "", 36), size: 700, bold: false, color: visual.body });
  }).join("");
}

function featurePriorityTagCardsXml({ visual, palette, items }) {
  const x = 823056;
  const y = 3832860;
  const width = 1280160;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * 1432560;
    return solidShapeXml({ id: 1840 + index * 3, name: `Feature Priority Tag Card ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: width, cy: 518160, fill: palette.card })
      + rectShapeXml({ id: 1841 + index * 3, name: `Feature Priority Tag Rule ${index + 1}`, x: offsetX, y, cx: 60960, cy: 518160, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1842 + index * 3, name: `Feature Priority Tag Text ${index + 1}`, x: offsetX + 152400, y: y + 167640, cx: width - 274320, cy: 182880, text: featurePriorityMatrixCompactText(item, "", 8), size: 760, bold: true, color: visual.title });
  }).join("");
}

function featurePriorityRankingXml({ visual, palette }) {
  const x = 5486400;
  const y = 1188720;
  const widths = [2133600, 1828800, 1524000, 1219200];
  return solidShapeXml({ id: 1850, name: "Feature Priority Ranking Panel", geom: "roundRect", x, y, cx: 2827020, cy: 1828800, fill: palette.panel })
    + lineFrameShapeXml({ id: 1851, name: "Feature Priority Ranking Frame", geom: "roundRect", x, y, cx: 2827020, cy: 1828800, stroke: palette.frame, width: 15240 })
    + widths.map((width, index) => {
      const offsetY = y + 335280 + index * 304800;
      const fill = index === 1 ? visual.primary : index === 3 ? visual.secondary || "F97316" : visual.accent;
      return rectShapeXml({ id: 1852 + index, name: `Feature Priority Ranking Bar ${index + 1}`, x: x + 304800, y: offsetY, cx: width, cy: 106680, fill });
    }).join("");
}

function featurePriorityResourceXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1143000;
  const cellW = 1295400;
  const cellH = 731520;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + (index % 2) * 1447800;
    const offsetY = y + Math.floor(index / 2) * 853440;
    return solidShapeXml({ id: 1860 + index * 3, name: `Feature Priority Resource Card ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: cellW, cy: cellH, fill: palette.card })
      + solidShapeXml({ id: 1861 + index * 3, name: `Feature Priority Resource Icon ${index + 1}`, geom: "roundRect", x: offsetX + 152400, y: offsetY + 121920, cx: 213360, cy: 213360, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1862 + index * 3, name: `Feature Priority Resource Text ${index + 1}`, x: offsetX + 152400, y: offsetY + 411480, cx: cellW - 304800, cy: 182880, text: featurePriorityMatrixCompactText(item, "", 12), size: 720, bold: true, color: visual.title });
  }).join("");
}

function featurePriorityDecisionLoopXml({ visual, palette }) {
  const x = 5791200;
  const y = 1264920;
  return solidShapeXml({ id: 1875, name: "Feature Priority Decision Loop", geom: "ellipse", x, y, cx: 1828800, cy: 1828800, fill: palette.greenZone })
    + solidShapeXml({ id: 1876, name: "Feature Priority Decision Core", geom: "ellipse", x: x + 579120, y: y + 579120, cx: 670560, cy: 670560, fill: visual.surface })
    + solidShapeXml({ id: 1877, name: "Feature Priority Decision Node", geom: "ellipse", x: x + 1371600, y: y + 365760, cx: 152400, cy: 152400, fill: visual.accent });
}

function featurePriorityActionCardsXml({ visual, palette, items }) {
  const x = 823056;
  const y = 3764280;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 1905000;
    return solidShapeXml({ id: 1880 + index * 3, name: `Feature Priority Next Action ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1600200, cy: 609600, fill: palette.card })
      + solidShapeXml({ id: 1881 + index * 3, name: `Feature Priority Next Action Dot ${index + 1}`, geom: "ellipse", x: offsetX + 152400, y: y + 137160, cx: 167640, cy: 167640, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1882 + index * 3, name: `Feature Priority Next Action Text ${index + 1}`, x: offsetX + 152400, y: y + 365760, cx: 1295400, cy: 167640, text: featurePriorityMatrixCompactText(item, "", 12), size: 700, bold: true, color: visual.title });
  }).join("");
}

function featurePriorityMatrixScene({ slide, index, role }) {
  const bullets = featurePriorityMatrixBulletTexts(slide);
  const tags = ["价值", "成本", "优先级"].map((fallback, itemIndex) => featurePriorityMatrixCompactText(bullets[itemIndex], fallback, 8));
  const cards = ["立即投入", "拆分验证", "暂缓排期", "复盘迭代"].map((fallback, itemIndex) => featurePriorityMatrixCompactText(bullets[itemIndex], fallback, 12));
  if (role === "closing") {
    return { kind: "closing", kicker: "DECISION LOOP", bullets, tags, cards };
  }
  const scenes = [
    { kind: "cover", kicker: "PRIORITY DECISION", bullets, tags, cards },
    { kind: "matrix", kicker: "VALUE COST MATRIX", bullets, tags, cards },
    { kind: "ranking", kicker: "SCORE RANKING", bullets, tags, cards },
    { kind: "resource", kicker: "RESOURCE REVIEW", bullets, tags, cards: ["研发投入", "设计验证", "测试覆盖", "运营协同"].map((fallback, itemIndex) => featurePriorityMatrixCompactText(bullets[itemIndex], fallback, 12)) },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function featurePriorityMatrixBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["按用户价值和商业价值评估功能收益", "结合研发成本与依赖风险判断投入顺序", "形成明确的保留、拆分、暂缓和验证结论"];
}

function featurePriorityMatrixCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function featurePriorityMatrixColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.12),
    panel: blendHexColor(visual.background, visual.surface, 0.48),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.76),
    axis: blendHexColor(visual.primary, visual.background, 0.48),
    greenZone: blendHexColor(visual.accent, visual.surface, 0.18),
    orangeZone: blendHexColor(visual.secondary || "F97316", visual.surface, 0.20),
  };
}

function experienceJourneyDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = experienceJourneyScene({ slide, index, role });
  const palette = experienceJourneyColorPalette(visual);
  const isClosing = role === "closing";
  // 体验旅程模板主体全部用可编辑 DrawingML 形状绘制，避免整页图片造成下载后不可编辑或与预览不一致。
  const surface = solidShapeXml({ id: 1901, name: "Experience Journey Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1902, name: "Experience Journey Header Bar", x: 0, y: 0, cx: 9144000, cy: 335280, fill: visual.primary })
    + rectShapeXml({ id: 1903, name: "Experience Journey Teal Rule", x: 0, y: 304800, cx: 9144000, cy: 30480, fill: visual.accent })
    + lineFrameShapeXml({ id: 1904, name: "Experience Journey Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1905, name: "Experience Journey Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 1906, name: "Experience Journey Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  const bulletCards = experienceJourneyBulletCardsXml({ visual, items: scene.bullets, isClosing });

  if (isClosing) {
    return surface + header + focusRule + bulletCards + experienceJourneyLoopXml({ visual, palette }) + experienceJourneyActionCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "diagnosis") {
    return surface + header + focusRule + bulletCards + experienceJourneyDiagnosisXml({ visual, palette, items: scene.cards }) + experienceJourneyStageCardsXml({ visual, palette, items: scene.stages });
  }
  if (scene.kind === "redesign") {
    return surface + header + focusRule + bulletCards + experienceJourneyRedesignXml({ visual, palette, items: scene.cards }) + experienceJourneyStageCardsXml({ visual, palette, items: scene.stages });
  }
  if (scene.kind === "roadmap") {
    return surface + header + focusRule + bulletCards + experienceJourneyRoadmapXml({ visual, palette, items: scene.cards }) + experienceJourneyStageCardsXml({ visual, palette, items: scene.stages });
  }
  return surface + header + focusRule + bulletCards + experienceJourneyMapXml({ visual, palette }) + experienceJourneyStageCardsXml({ visual, palette, items: scene.stages });
}

function experienceJourneyMapXml({ visual, palette }) {
  const x = 5486400;
  const y = 1051560;
  const w = 2895600;
  const h = 1965960;
  const points = [
    { x: x + 426720, y: y + 1196340, fill: visual.accent },
    { x: x + 944880, y: y + 701040, fill: visual.primary },
    { x: x + 1493520, y: y + 1112520, fill: visual.secondary || "F9735B" },
    { x: x + 2011680, y: y + 746760, fill: visual.accent },
    { x: x + 2392680, y: y + 518160, fill: visual.primary },
  ];
  return solidShapeXml({ id: 1910, name: "Experience Journey Map Panel", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.panel })
    + lineFrameShapeXml({ id: 1911, name: "Experience Journey Map Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1912, name: "Experience Journey Route Segment 1", x: x + 457200, y: y + 1066800, cx: 609600, cy: 45720, fill: visual.accent, rotation: -20 })
    + rectShapeXml({ id: 1913, name: "Experience Journey Route Segment 2", x: x + 990600, y: y + 899160, cx: 609600, cy: 45720, fill: visual.secondary || "F9735B", rotation: 18 })
    + rectShapeXml({ id: 1914, name: "Experience Journey Route Segment 3", x: x + 1554480, y: y + 929640, cx: 609600, cy: 45720, fill: visual.accent, rotation: -18 })
    + rectShapeXml({ id: 1915, name: "Experience Journey Route Segment 4", x: x + 2072640, y: y + 685800, cx: 457200, cy: 45720, fill: visual.primary, rotation: -18 })
    + points.map((point, itemIndex) => solidShapeXml({ id: 1916 + itemIndex, name: `Experience Journey Touchpoint ${itemIndex + 1}`, geom: "ellipse", x: point.x, y: point.y, cx: 167640, cy: 167640, fill: point.fill })).join("");
}

function experienceJourneyBulletCardsXml({ visual, items, isClosing }) {
  const x = 823056;
  const y = isClosing ? 2156460 : 2453640;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 312420;
    return rectShapeXml({ id: 1930 + index * 3, name: `Experience Journey Insight Accent ${index + 1}`, x, y: offsetY + 38100, cx: 60960, cy: 190500, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1931 + index * 3, name: `Experience Journey Insight Text ${index + 1}`, x: x + 121920, y: offsetY, cx: 3444240, cy: 228600, text: experienceJourneyCompactText(item, "", 36), size: 700, bold: false, color: visual.body });
  }).join("");
}

function experienceJourneyStageCardsXml({ visual, palette, items }) {
  const x = 823056;
  const y = 3832860;
  const width = 1280160;
  return items.slice(0, 5).map((item, index) => {
    const offsetX = x + index * 1516380;
    return solidShapeXml({ id: 1940 + index * 3, name: `Experience Journey Stage Card ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: width, cy: 518160, fill: palette.card })
      + rectShapeXml({ id: 1941 + index * 3, name: `Experience Journey Stage Rule ${index + 1}`, x: offsetX, y, cx: 60960, cy: 518160, fill: index === 2 ? visual.secondary || "F9735B" : visual.accent })
      + textShapeXml({ id: 1942 + index * 3, name: `Experience Journey Stage Text ${index + 1}`, x: offsetX + 137160, y: y + 167640, cx: width - 228600, cy: 182880, text: experienceJourneyCompactText(item, "", 8), size: 700, bold: true, color: visual.title });
  }).join("");
}

function experienceJourneyDiagnosisXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1127760;
  const cellW = 1295400;
  const cellH = 731520;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + (index % 2) * 1447800;
    const offsetY = y + Math.floor(index / 2) * 853440;
    return solidShapeXml({ id: 1950 + index * 3, name: `Experience Journey Friction Card ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: cellW, cy: cellH, fill: palette.card })
      + solidShapeXml({ id: 1951 + index * 3, name: `Experience Journey Friction Dot ${index + 1}`, geom: "ellipse", x: offsetX + 152400, y: offsetY + 121920, cx: 213360, cy: 213360, fill: visual.secondary || "F9735B" })
      + textShapeXml({ id: 1952 + index * 3, name: `Experience Journey Friction Text ${index + 1}`, x: offsetX + 152400, y: offsetY + 411480, cx: cellW - 304800, cy: 182880, text: experienceJourneyCompactText(item, "", 12), size: 700, bold: true, color: visual.title });
  }).join("");
}

function experienceJourneyRedesignXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1127760;
  const cellW = 1295400;
  const cellH = 731520;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + (index % 2) * 1447800;
    const offsetY = y + Math.floor(index / 2) * 853440;
    const accent = index % 2 ? visual.accent : visual.secondary || "F9735B";
    return solidShapeXml({ id: 1965 + index * 3, name: `Experience Journey Redesign Card ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: cellW, cy: cellH, fill: palette.card })
      + rectShapeXml({ id: 1966 + index * 3, name: `Experience Journey Redesign Rule ${index + 1}`, x: offsetX + 152400, y: offsetY + 548640, cx: 792480, cy: 45720, fill: accent })
      + textShapeXml({ id: 1967 + index * 3, name: `Experience Journey Redesign Text ${index + 1}`, x: offsetX + 152400, y: offsetY + 182880, cx: cellW - 304800, cy: 243840, text: experienceJourneyCompactText(item, "", 12), size: 730, bold: true, color: visual.title });
  }).join("");
}

function experienceJourneyRoadmapXml({ visual, palette, items }) {
  const x = 5638800;
  const y = 1188720;
  return solidShapeXml({ id: 1980, name: "Experience Journey Roadmap Panel", geom: "roundRect", x, y, cx: 2590800, cy: 1676400, fill: palette.panel })
    + lineFrameShapeXml({ id: 1981, name: "Experience Journey Roadmap Frame", geom: "roundRect", x, y, cx: 2590800, cy: 1676400, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1982, name: "Experience Journey Roadmap Axis", x: x + 335280, y: y + 274320, cx: 22860, cy: 1127760, fill: palette.axis })
    + items.slice(0, 4).map((item, index) => {
      const offsetY = y + 243840 + index * 304800;
      return solidShapeXml({ id: 1983 + index * 3, name: `Experience Journey Roadmap Node ${index + 1}`, geom: "ellipse", x: x + 274320, y: offsetY, cx: 152400, cy: 152400, fill: index === 2 ? visual.secondary || "F9735B" : visual.accent })
        + textShapeXml({ id: 1984 + index * 3, name: `Experience Journey Roadmap Text ${index + 1}`, x: x + 548640, y: offsetY - 22860, cx: 1524000, cy: 182880, text: experienceJourneyCompactText(item, "", 12), size: 700, bold: true, color: visual.title });
    }).join("");
}

function experienceJourneyLoopXml({ visual, palette }) {
  const x = 5791200;
  const y = 1219200;
  return solidShapeXml({ id: 1995, name: "Experience Journey Iteration Loop", geom: "ellipse", x, y, cx: 1828800, cy: 1828800, fill: palette.loop })
    + solidShapeXml({ id: 1996, name: "Experience Journey Loop Core", geom: "ellipse", x: x + 579120, y: y + 579120, cx: 670560, cy: 670560, fill: visual.surface })
    + solidShapeXml({ id: 1997, name: "Experience Journey Loop Node", geom: "ellipse", x: x + 1371600, y: y + 365760, cx: 152400, cy: 152400, fill: visual.accent });
}

function experienceJourneyActionCardsXml({ visual, palette, items }) {
  const x = 823056;
  const y = 3764280;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 1905000;
    return solidShapeXml({ id: 2000 + index * 3, name: `Experience Journey Next Action ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1600200, cy: 609600, fill: palette.card })
      + solidShapeXml({ id: 2001 + index * 3, name: `Experience Journey Next Action Icon ${index + 1}`, geom: "roundRect", x: offsetX + 152400, y: y + 137160, cx: 167640, cy: 167640, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 2002 + index * 3, name: `Experience Journey Next Action Text ${index + 1}`, x: offsetX + 152400, y: y + 365760, cx: 1295400, cy: 167640, text: experienceJourneyCompactText(item, "", 12), size: 700, bold: true, color: visual.title });
  }).join("");
}

function experienceJourneyScene({ slide, index, role }) {
  const bullets = experienceJourneyBulletTexts(slide);
  const stages = ["进入", "浏览", "决策", "使用", "反馈"].map((fallback, itemIndex) => experienceJourneyCompactText(bullets[itemIndex], fallback, 8));
  const cards = ["触点阻塞", "情绪下滑", "路径绕行", "转化损失"].map((fallback, itemIndex) => experienceJourneyCompactText(bullets[itemIndex], fallback, 12));
  if (role === "closing") {
    return { kind: "closing", kicker: "NEXT EXPERIENCE LOOP", bullets, stages, cards: ["确认问题", "设计方案", "上线验证", "持续迭代"].map((fallback, itemIndex) => experienceJourneyCompactText(bullets[itemIndex], fallback, 12)) };
  }
  const scenes = [
    { kind: "cover", kicker: "EXPERIENCE JOURNEY", bullets, stages, cards },
    { kind: "journey", kicker: "TOUCHPOINT MAP", bullets, stages, cards },
    { kind: "diagnosis", kicker: "FRICTION DIAGNOSIS", bullets, stages, cards },
    { kind: "redesign", kicker: "REDESIGN PLAN", bullets, stages, cards: ["当前体验", "目标体验", "设计改动", "预期收益"].map((fallback, itemIndex) => experienceJourneyCompactText(bullets[itemIndex], fallback, 12)) },
    { kind: "roadmap", kicker: "ITERATION ROADMAP", bullets, stages, cards: ["快速修复", "原型验证", "灰度上线", "数据复盘"].map((fallback, itemIndex) => experienceJourneyCompactText(bullets[itemIndex], fallback, 12)) },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function experienceJourneyBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["梳理用户从进入到反馈的关键触点", "识别高频阻塞、情绪下滑和转化损失", "输出可验证的体验改版方案和迭代节奏"];
}

function experienceJourneyCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function experienceJourneyColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.10),
    panel: blendHexColor(visual.background, visual.surface, 0.50),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.76),
    axis: blendHexColor(visual.primary, visual.background, 0.50),
    loop: blendHexColor(visual.accent, visual.surface, 0.18),
  };
}

function capabilityRadarDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = capabilityRadarScene({ slide, index, role });
  const palette = capabilityRadarColorPalette(visual);
  const isClosing = role === "closing";
  // 能力雷达模板主体全部使用可编辑 DrawingML 图形绘制，保证下载后的 PPTX 和在线预览保持同一套结构。
  const surface = solidShapeXml({ id: 2010, name: "Capability Radar Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 2011, name: "Capability Radar Header Bar", x: 0, y: 0, cx: 9144000, cy: 335280, fill: visual.primary })
    + rectShapeXml({ id: 2012, name: "Capability Radar Teal Rule", x: 0, y: 304800, cx: 9144000, cy: 30480, fill: visual.accent })
    + lineFrameShapeXml({ id: 2013, name: "Capability Radar Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 2014, name: "Capability Radar Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 2015, name: "Capability Radar Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  const bulletCards = capabilityRadarBulletCardsXml({ visual, items: scene.bullets, isClosing });

  if (isClosing) {
    return surface + header + focusRule + bulletCards + capabilityRadarLoopXml({ visual, palette }) + capabilityRadarActionCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "matrix") {
    return surface + header + focusRule + bulletCards + capabilityRadarMatrixXml({ visual, palette, items: scene.cards }) + capabilityRadarTagCardsXml({ visual, palette, items: scene.tags });
  }
  if (scene.kind === "gap") {
    return surface + header + focusRule + bulletCards + capabilityRadarGapXml({ visual, palette, items: scene.cards }) + capabilityRadarTagCardsXml({ visual, palette, items: scene.tags });
  }
  if (scene.kind === "roadmap") {
    return surface + header + focusRule + bulletCards + capabilityRadarRoadmapXml({ visual, palette, items: scene.cards }) + capabilityRadarTagCardsXml({ visual, palette, items: scene.tags });
  }
  return surface + header + focusRule + bulletCards + capabilityRadarPanelXml({ visual, palette }) + capabilityRadarTagCardsXml({ visual, palette, items: scene.tags });
}

function capabilityRadarPanelXml({ visual, palette }) {
  const x = 5486400;
  const y = 1051560;
  const w = 2895600;
  const h = 1965960;
  const cx = x + 1447800;
  const cy = y + 982980;
  return solidShapeXml({ id: 2020, name: "Capability Radar Panel", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.panel })
    + lineFrameShapeXml({ id: 2021, name: "Capability Radar Panel Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + lineFrameShapeXml({ id: 2022, name: "Capability Radar Outer Ring", geom: "ellipse", x: cx - 685800, y: cy - 685800, cx: 1371600, cy: 1371600, stroke: palette.axis, width: 11430 })
    + lineFrameShapeXml({ id: 2023, name: "Capability Radar Middle Ring", geom: "ellipse", x: cx - 487680, y: cy - 487680, cx: 975360, cy: 975360, stroke: palette.axis, width: 9525 })
    + lineFrameShapeXml({ id: 2024, name: "Capability Radar Inner Ring", geom: "ellipse", x: cx - 289560, y: cy - 289560, cx: 579120, cy: 579120, stroke: palette.axis, width: 7620 })
    + rectShapeXml({ id: 2025, name: "Capability Radar Axis Vertical", x: cx - 7620, y: cy - 746760, cx: 15240, cy: 1493520, fill: palette.axis })
    + rectShapeXml({ id: 2026, name: "Capability Radar Axis Horizontal", x: cx - 746760, y: cy - 7620, cx: 1493520, cy: 15240, fill: palette.axis })
    + rectShapeXml({ id: 2027, name: "Capability Radar Our Capability Bar 1", x: cx - 38100, y: cy - 655320, cx: 76200, cy: 655320, fill: visual.accent })
    + rectShapeXml({ id: 2028, name: "Capability Radar Our Capability Bar 2", x: cx, y: cy - 38100, cx: 640080, cy: 76200, fill: visual.accent, rotation: 28 })
    + rectShapeXml({ id: 2029, name: "Capability Radar Competitor Bar", x: cx - 609600, y: cy + 228600, cx: 914400, cy: 60960, fill: visual.secondary || "FF8A3D", rotation: -20 })
    + solidShapeXml({ id: 2030, name: "Capability Radar Point 1", geom: "ellipse", x: cx - 76200, y: cy - 716280, cx: 152400, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 2031, name: "Capability Radar Point 2", geom: "ellipse", x: cx + 548640, y: cy - 274320, cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 2032, name: "Capability Radar Point 3", geom: "ellipse", x: cx + 426720, y: cy + 487680, cx: 152400, cy: 152400, fill: visual.secondary || "FF8A3D" })
    + solidShapeXml({ id: 2033, name: "Capability Radar Point 4", geom: "ellipse", x: cx - 548640, y: cy + 548640, cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 2034, name: "Capability Radar Point 5", geom: "ellipse", x: cx - 792480, y: cy - 152400, cx: 152400, cy: 152400, fill: visual.primary });
}

function capabilityRadarBulletCardsXml({ visual, items, isClosing }) {
  const x = 823056;
  const y = isClosing ? 2156460 : 2453640;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 312420;
    return rectShapeXml({ id: 2040 + index * 3, name: `Capability Radar Insight Accent ${index + 1}`, x, y: offsetY + 38100, cx: 60960, cy: 190500, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 2041 + index * 3, name: `Capability Radar Insight Text ${index + 1}`, x: x + 121920, y: offsetY, cx: 3444240, cy: 228600, text: capabilityRadarCompactText(item, "", 36), size: 700, bold: false, color: visual.body });
  }).join("");
}

function capabilityRadarTagCardsXml({ visual, palette, items }) {
  const x = 823056;
  const y = 3832860;
  const width = 2217420;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * 2667000;
    return solidShapeXml({ id: 2050 + index * 3, name: `Capability Radar Tag Card ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: width, cy: 518160, fill: palette.card })
      + rectShapeXml({ id: 2051 + index * 3, name: `Capability Radar Tag Rule ${index + 1}`, x: offsetX, y, cx: 60960, cy: 518160, fill: index === 2 ? visual.secondary || "FF8A3D" : visual.accent })
      + textShapeXml({ id: 2052 + index * 3, name: `Capability Radar Tag Text ${index + 1}`, x: offsetX + 137160, y: y + 167640, cx: width - 228600, cy: 182880, text: capabilityRadarCompactText(item, "", 8), size: 760, bold: true, color: visual.title });
  }).join("");
}

function capabilityRadarMatrixXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1051560;
  const cellW = 853440;
  const cellH = 655320;
  return items.slice(0, 6).map((item, index) => {
    const offsetX = x + (index % 3) * 960120;
    const offsetY = y + Math.floor(index / 3) * 792480;
    const fill = index % 3 === 0 ? visual.accent : index % 3 === 1 ? visual.primary : visual.secondary || "FF8A3D";
    return solidShapeXml({ id: 2060 + index * 4, name: `Capability Radar Matrix Card ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: cellW, cy: cellH, fill: palette.card })
      + textShapeXml({ id: 2061 + index * 4, name: `Capability Radar Matrix Text ${index + 1}`, x: offsetX + 91440, y: offsetY + 106680, cx: cellW - 182880, cy: 213360, text: capabilityRadarCompactText(item, "", 12), size: 660, bold: true, color: visual.title })
      + rectShapeXml({ id: 2062 + index * 4, name: `Capability Radar Score Track ${index + 1}`, x: offsetX + 91440, y: offsetY + 426720, cx: cellW - 182880, cy: 60960, fill: palette.axis })
      + rectShapeXml({ id: 2063 + index * 4, name: `Capability Radar Score Fill ${index + 1}`, x: offsetX + 91440, y: offsetY + 426720, cx: Math.round((cellW - 182880) * (0.52 + (index % 3) * 0.14)), cy: 60960, fill });
  }).join("");
}

function capabilityRadarGapXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1051560;
  return solidShapeXml({ id: 2090, name: "Capability Radar Gap Chain Panel", geom: "roundRect", x, y, cx: 2895600, cy: 1965960, fill: palette.panel })
    + lineFrameShapeXml({ id: 2091, name: "Capability Radar Gap Chain Frame", geom: "roundRect", x, y, cx: 2895600, cy: 1965960, stroke: palette.frame, width: 15240 })
    + items.slice(0, 4).map((item, index) => {
      const offsetY = y + 243840 + index * 381000;
      return solidShapeXml({ id: 2092 + index * 3, name: `Capability Radar Gap Node ${index + 1}`, geom: "roundRect", x: x + 213360, y: offsetY, cx: 243840, cy: 243840, fill: index === 0 ? visual.secondary || "FF8A3D" : visual.accent })
        + textShapeXml({ id: 2093 + index * 3, name: `Capability Radar Gap Text ${index + 1}`, x: x + 579120, y: offsetY + 30480, cx: 1828800, cy: 182880, text: capabilityRadarCompactText(item, "", 12), size: 700, bold: true, color: visual.title })
        + (index < 3 ? rectShapeXml({ id: 2094 + index * 3, name: `Capability Radar Gap Connector ${index + 1}`, x: x + 327660, y: offsetY + 243840, cx: 15240, cy: 137160, fill: palette.axis }) : "");
    }).join("");
}

function capabilityRadarRoadmapXml({ visual, palette, items }) {
  const x = 5638800;
  const y = 1188720;
  return solidShapeXml({ id: 2110, name: "Capability Radar Roadmap Panel", geom: "roundRect", x, y, cx: 2590800, cy: 1676400, fill: palette.panel })
    + lineFrameShapeXml({ id: 2111, name: "Capability Radar Roadmap Frame", geom: "roundRect", x, y, cx: 2590800, cy: 1676400, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 2112, name: "Capability Radar Roadmap Axis", x: x + 335280, y: y + 274320, cx: 22860, cy: 1127760, fill: palette.axis })
    + items.slice(0, 4).map((item, index) => {
      const offsetY = y + 243840 + index * 304800;
      return solidShapeXml({ id: 2113 + index * 3, name: `Capability Radar Roadmap Node ${index + 1}`, geom: "ellipse", x: x + 274320, y: offsetY, cx: 152400, cy: 152400, fill: index === 2 ? visual.secondary || "FF8A3D" : visual.accent })
        + textShapeXml({ id: 2114 + index * 3, name: `Capability Radar Roadmap Text ${index + 1}`, x: x + 548640, y: offsetY - 22860, cx: 1524000, cy: 182880, text: capabilityRadarCompactText(item, "", 12), size: 700, bold: true, color: visual.title });
    }).join("");
}

function capabilityRadarLoopXml({ visual, palette }) {
  const x = 5791200;
  const y = 1219200;
  return solidShapeXml({ id: 2130, name: "Capability Radar Decision Loop", geom: "ellipse", x, y, cx: 1828800, cy: 1828800, fill: palette.loop })
    + solidShapeXml({ id: 2131, name: "Capability Radar Loop Core", geom: "ellipse", x: x + 579120, y: y + 579120, cx: 670560, cy: 670560, fill: visual.surface })
    + solidShapeXml({ id: 2132, name: "Capability Radar Loop Node", geom: "ellipse", x: x + 1371600, y: y + 365760, cx: 152400, cy: 152400, fill: visual.accent });
}

function capabilityRadarActionCardsXml({ visual, palette, items }) {
  const x = 823056;
  const y = 3764280;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 1905000;
    return solidShapeXml({ id: 2140 + index * 3, name: `Capability Radar Next Action ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1600200, cy: 609600, fill: palette.card })
      + solidShapeXml({ id: 2141 + index * 3, name: `Capability Radar Next Action Icon ${index + 1}`, geom: "roundRect", x: offsetX + 152400, y: y + 137160, cx: 167640, cy: 167640, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 2142 + index * 3, name: `Capability Radar Next Action Text ${index + 1}`, x: offsetX + 152400, y: y + 365760, cx: 1295400, cy: 167640, text: capabilityRadarCompactText(item, "", 12), size: 700, bold: true, color: visual.title });
  }).join("");
}

function capabilityRadarScene({ slide, index, role }) {
  const bullets = capabilityRadarBulletTexts(slide);
  const tags = ["核心能力", "差异机会", "路线输入"].map((fallback, itemIndex) => capabilityRadarCompactText(bullets[itemIndex], fallback, 8));
  const cards = ["我方能力", "竞品A", "竞品B", "领先项", "短板项", "机会点"].map((fallback, itemIndex) => capabilityRadarCompactText(bullets[itemIndex % bullets.length], fallback, 12));
  if (role === "closing") {
    return { kind: "closing", kicker: "NEXT PRODUCT MOVES", bullets, tags, cards: ["确认维度", "评审差距", "转入需求池", "跟踪竞品"].map((fallback, itemIndex) => capabilityRadarCompactText(bullets[itemIndex], fallback, 12)) };
  }
  const scenes = [
    { kind: "cover", kicker: "COMPETITIVE RADAR", bullets, tags, cards },
    { kind: "matrix", kicker: "FEATURE MATRIX", bullets, tags, cards },
    { kind: "radar", kicker: "CAPABILITY SCORE", bullets, tags, cards },
    { kind: "gap", kicker: "GAP DIAGNOSIS", bullets, tags, cards: ["功能差距", "用户影响", "定位风险", "机会切入"].map((fallback, itemIndex) => capabilityRadarCompactText(bullets[itemIndex], fallback, 12)) },
    { kind: "roadmap", kicker: "ROADMAP INPUT", bullets, tags, cards: ["补齐基础项", "强化差异点", "验证机会点", "沉淀壁垒"].map((fallback, itemIndex) => capabilityRadarCompactText(bullets[itemIndex], fallback, 12)) },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function capabilityRadarBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["围绕核心场景拆解竞品功能能力", "比较我方与竞品在体验、效率和生态上的差异", "输出可进入路线规划的优先级建议"];
}

function capabilityRadarCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function capabilityRadarColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.10),
    panel: blendHexColor(visual.background, visual.surface, 0.50),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.76),
    axis: blendHexColor(visual.primary, visual.background, 0.50),
    loop: blendHexColor(visual.accent, visual.surface, 0.18),
  };
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
    + textShapeXml({ id: 709, name: "Pitch Chip Text", x: isCover ? 7124700 : 7193280, y: isCover ? 960120 : 861060, cx: 731520, cy: 152400, text: "", size: 740, bold: true, color: palette.chipText })
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

function growthFundingFlywheelDecorationsXml({ visual, index, role, slide }) {
  const scene = growthFundingFlywheelScene({ slide, index, role });
  const palette = growthFundingFlywheelPalette(visual);
  const isClosing = scene.role === "closing";
  const shell = rectShapeXml({ id: 900, name: "Growth Funding Dark Canvas", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.dark })
    + solidShapeXml({ id: 901, name: "Growth Funding Content Surface", geom: "roundRect", x: 493776, y: 457200, cx: 8153400, cy: 4343400, fill: visual.surface })
    + rectShapeXml({ id: 902, name: "Growth Funding Top Spectrum", x: 493776, y: 457200, cx: 8153400, cy: 45720, fill: visual.accent })
    + rectShapeXml({ id: 903, name: "Growth Funding Blue Accent", x: 3810000, y: 457200, cx: 1828800, cy: 45720, fill: palette.blue })
    + rectShapeXml({ id: 904, name: "Growth Funding Amber Accent", x: 5638800, y: 457200, cx: 2438400, cy: 45720, fill: palette.amber })
    + textShapeXml({ id: 905, name: "Growth Funding Kicker", x: 731520, y: 701040, cx: 3048000, cy: 274320, text: scene.kicker, size: 880, bold: true, color: visual.accent });
  const content = growthFundingFlywheelContentXml({ visual, palette, scene, slide });
  if (scene.role === "cover" || scene.role === "flywheel") {
    return shell
      + content
      + growthFundingFlywheelWheelXml({ visual, palette, nodes: scene.nodes })
      + growthFundingFlywheelMetricCardsXml({ visual, palette, metrics: scene.metrics });
  }
  if (scene.role === "commercial" || scene.role === "proof") {
    return shell
      + content
      + growthFundingFlywheelProofCardsXml({ visual, palette, slide, cards: scene.cards })
      + growthFundingFlywheelDashboardXml({ visual, palette });
  }
  if (scene.role === "roadmap" || scene.role === "funding") {
    return shell
      + content
      + growthFundingFlywheelRoadmapXml({ visual, palette, slide, cards: scene.cards });
  }
  return shell
    + content
    + solidShapeXml({ id: 960, name: "Growth Funding Closing Panel", geom: "roundRect", x: 5638800, y: 1219200, cx: 2514600, cy: 2286000, fill: palette.dark })
    + rectShapeXml({ id: 961, name: "Growth Funding Closing Signal", x: 5943600, y: 1676400, cx: 1905000, cy: 76200, fill: visual.accent })
    + rectShapeXml({ id: 962, name: "Growth Funding Closing Data Band", x: 6248400, y: 2545080, cx: 1295400, cy: 533400, fill: palette.blue, transparency: 34000 })
    + (isClosing ? growthFundingFlywheelMetricCardsXml({ visual, palette, metrics: scene.metrics }) : "");
}

function growthFundingFlywheelContentXml({ visual, palette, scene, slide }) {
  const bullets = growthFundingFlywheelBulletTexts(slide);
  const summary = growthFundingFlywheelCompactText(bullets[0], scene.summary, 40);
  const bulletBody = bullets.slice(0, 4).map((item) => paragraphXml(growthFundingFlywheelCompactText(item, scene.summary, 34), 760, false, visual.body)).join("");
  return rectShapeXml({ id: 910, name: "Growth Funding Summary Rule", x: 731520, y: scene.role === "cover" ? 2232660 : 1905000, cx: 3124200, cy: 38100, fill: visual.accent })
    + textShapeXml({ id: 911, name: "Growth Funding Summary", x: 731520, y: scene.role === "cover" ? 2468880 : 1912620, cx: 3505200, cy: 396240, text: summary, size: scene.role === "cover" ? 880 : 780, bold: true, color: visual.body })
    + textShapeXml({ id: 912, name: "Growth Funding Planned Content", x: 777240, y: scene.role === "cover" ? 3002280 : 2392680, cx: 3429000, cy: 899160, body: bulletBody, size: 760, bold: false, color: visual.body })
    + rectShapeXml({ id: 913, name: "Growth Funding Content Glow", x: 731520, y: 4213860, cx: 3505200, cy: 30480, fill: palette.blue });
}

function growthFundingFlywheelWheelXml({ visual, palette, nodes }) {
  const nodeTexts = nodes.slice(0, 5);
  const nodePositions = [
    { x: 6522720, y: 929640 },
    { x: 7650480, y: 1653540 },
    { x: 7208520, y: 3048000 },
    { x: 5707380, y: 3048000 },
    { x: 5265420, y: 1653540 },
  ];
  const nodeXml = nodeTexts.map((node, itemIndex) => {
    const pos = nodePositions[itemIndex];
    return solidShapeXml({ id: 930 + itemIndex, name: `Growth Funding Flywheel Node ${itemIndex + 1}`, geom: "roundRect", x: pos.x, y: pos.y, cx: 716280, cy: 289560, fill: visual.surface })
      + lineFrameShapeXml({ id: 940 + itemIndex, name: `Growth Funding Flywheel Node Frame ${itemIndex + 1}`, geom: "roundRect", x: pos.x, y: pos.y, cx: 716280, cy: 289560, stroke: itemIndex % 2 ? palette.blue : visual.accent, width: 15240 })
      + textShapeXml({ id: 950 + itemIndex, name: `Growth Funding Flywheel Node Text ${itemIndex + 1}`, x: pos.x + 91440, y: pos.y + 68580, cx: 533400, cy: 152400, text: node, size: 760, bold: true, color: visual.title });
  }).join("");
  return solidShapeXml({ id: 920, name: "Growth Funding Flywheel Halo", geom: "ellipse", x: 5532120, y: 1112520, cx: 2133600, cy: 2133600, fill: palette.lightGreen })
    + arcLineShapeXml({ id: 921, name: "Growth Funding Flywheel Arc 1", x: 5638800, y: 1219200, cx: 1905000, cy: 1905000, stroke: visual.accent, width: 45720 })
    + arcLineShapeXml({ id: 922, name: "Growth Funding Flywheel Arc 2", x: 5791200, y: 1371600, cx: 1600200, cy: 1600200, stroke: palette.blue, width: 38100 })
    + solidShapeXml({ id: 923, name: "Growth Funding Flywheel Core", geom: "ellipse", x: 6324600, y: 1905000, cx: 533400, cy: 533400, fill: palette.dark })
    + nodeXml;
}

function growthFundingFlywheelMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 3).map((metric, itemIndex) => {
    const x = 731520 + itemIndex * 1219200;
    return solidShapeXml({ id: 970 + itemIndex, name: `Growth Funding Metric Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3870960, cx: 1066800, cy: 609600, fill: itemIndex === 1 ? palette.lightGreen : visual.surface })
      + lineFrameShapeXml({ id: 975 + itemIndex, name: `Growth Funding Metric Frame ${itemIndex + 1}`, geom: "roundRect", x, y: 3870960, cx: 1066800, cy: 609600, stroke: itemIndex === 1 ? visual.accent : palette.frame, width: 12700 })
      + textShapeXml({ id: 980 + itemIndex, name: `Growth Funding Metric Value ${itemIndex + 1}`, x: x + 152400, y: 3992880, cx: 762000, cy: 198120, text: metric.value, size: 1380, bold: true, color: visual.title })
      + textShapeXml({ id: 985 + itemIndex, name: `Growth Funding Metric Label ${itemIndex + 1}`, x: x + 152400, y: 4236720, cx: 762000, cy: 152400, text: metric.label, size: 620, bold: true, color: visual.body });
  }).join("");
}

function growthFundingFlywheelProofCardsXml({ visual, palette, slide, cards }) {
  const bullets = growthFundingFlywheelBulletTexts(slide);
  return cards.slice(0, 4).map((card, itemIndex) => {
    const column = itemIndex % 2;
    const row = Math.floor(itemIndex / 2);
    const x = 5638800 + column * 1371600;
    const y = 1219200 + row * 1005840;
    return solidShapeXml({ id: 990 + itemIndex, name: `Growth Funding Proof Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 822960, fill: visual.surface })
      + lineFrameShapeXml({ id: 995 + itemIndex, name: `Growth Funding Proof Frame ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 822960, stroke: palette.frame, width: 12700 })
      + rectShapeXml({ id: 1000 + itemIndex, name: `Growth Funding Proof Bar ${itemIndex + 1}`, x: x + 152400, y: y + 152400, cx: 426720, cy: 45720, fill: itemIndex % 2 ? palette.blue : visual.accent })
      + textShapeXml({ id: 1005 + itemIndex, name: `Growth Funding Proof Text ${itemIndex + 1}`, x: x + 152400, y: y + 304800, cx: 914400, cy: 304800, text: growthFundingFlywheelCompactText(bullets[itemIndex] || card, card, 20), size: 760, bold: true, color: visual.title });
  }).join("");
}

function growthFundingFlywheelDashboardXml({ visual, palette }) {
  return solidShapeXml({ id: 1020, name: "Growth Funding Data Dashboard", geom: "roundRect", x: 5638800, y: 3497580, cx: 2590800, cy: 716280, fill: palette.dark })
    + rectShapeXml({ id: 1021, name: "Growth Funding Dashboard Trend", x: 5943600, y: 3680460, cx: 1828800, cy: 45720, fill: visual.accent })
    + rectShapeXml({ id: 1022, name: "Growth Funding Dashboard Blue Segment", x: 6705600, y: 3680460, cx: 762000, cy: 45720, fill: palette.blue })
    + rectShapeXml({ id: 1023, name: "Growth Funding Dashboard Amber Segment", x: 7467600, y: 3680460, cx: 457200, cy: 45720, fill: palette.amber })
    + rectShapeXml({ id: 1024, name: "Growth Funding Dashboard Bar 1", x: 5943600, y: 4008120, cx: 304800, cy: 304800, fill: visual.accent })
    + rectShapeXml({ id: 1025, name: "Growth Funding Dashboard Bar 2", x: 6553200, y: 3901440, cx: 304800, cy: 411480, fill: palette.blue })
    + rectShapeXml({ id: 1026, name: "Growth Funding Dashboard Bar 3", x: 7162800, y: 3794760, cx: 304800, cy: 518160, fill: palette.amber });
}

function growthFundingFlywheelRoadmapXml({ visual, palette, slide, cards }) {
  const bullets = growthFundingFlywheelBulletTexts(slide);
  const connector = rectShapeXml({ id: 1030, name: "Growth Funding Roadmap Connector", x: 1066800, y: 3657600, cx: 6858000, cy: 30480, fill: palette.frame });
  const nodes = cards.slice(0, 4).map((card, itemIndex) => {
    const x = 1066800 + itemIndex * 1752600;
    return solidShapeXml({ id: 1035 + itemIndex, name: `Growth Funding Roadmap Node ${itemIndex + 1}`, geom: "roundRect", x, y: 3048000, cx: 1371600, cy: 838200, fill: visual.surface })
      + lineFrameShapeXml({ id: 1045 + itemIndex, name: `Growth Funding Roadmap Frame ${itemIndex + 1}`, geom: "roundRect", x, y: 3048000, cx: 1371600, cy: 838200, stroke: itemIndex % 2 ? palette.blue : visual.accent, width: 15240 })
      + textShapeXml({ id: 1055 + itemIndex, name: `Growth Funding Roadmap Text ${itemIndex + 1}`, x: x + 167640, y: 3276600, cx: 1036320, cy: 304800, text: growthFundingFlywheelCompactText(bullets[itemIndex] || card, card, 20), size: 760, bold: true, color: visual.title })
      + rectShapeXml({ id: 1065 + itemIndex, name: `Growth Funding Roadmap Progress ${itemIndex + 1}`, x: x + 167640, y: 3695700, cx: 914400, cy: 45720, fill: itemIndex % 2 ? palette.blue : visual.accent });
  }).join("");
  return connector + nodes;
}

function growthFundingFlywheelPalette(visual) {
  return {
    dark: visual.primary || "0B1220",
    blue: "38BDF8",
    amber: "F59E0B",
    frame: "CBD5E1",
    lightGreen: "DCFCE7",
  };
}

function growthFundingFlywheelScene({ slide, index, role }) {
  const bullets = growthFundingFlywheelBulletTexts(slide);
  const metrics = [
    { value: "ARR", label: "商业化收入" },
    { value: "NRR", label: "留存扩张" },
    { value: "LTV/CAC", label: "增长效率" },
  ];
  const baseCards = ["获客效率提升", "激活转化稳定", "留存扩张增强", "收入模型验证"].map((fallback, itemIndex) => growthFundingFlywheelCompactText(bullets[itemIndex], fallback, 16));
  const scenes = [
    { role: "cover", kicker: "GROWTH CAPITAL MEMO", summary: "用增长数据、商业化进展和扩张计划说明融资放大效率。", metrics, cards: baseCards, nodes: ["获客", "激活", "留存", "付费", "扩张"] },
    { role: "flywheel", kicker: "GROWTH FLYWHEEL", summary: "把获客、激活、留存、付费和扩张串成可持续循环。", metrics, cards: baseCards, nodes: ["获客", "激活", "留存", "付费", "扩张"] },
    { role: "commercial", kicker: "COMMERCIAL PROOF", summary: "用收入、客户分层和复购扩张证明商业化不是单点突破。", metrics, cards: baseCards },
    { role: "proof", kicker: "DATA EVIDENCE", summary: "展示留存、转化、LTV/CAC 和增长效率的关键证据。", metrics, cards: ["留存曲线稳定", "转化漏斗清晰", "CAC 回收周期缩短", "收入扩张可预测"] },
    { role: "roadmap", kicker: "EXPANSION PLAN", summary: "把融资后的市场、渠道、产品和团队扩张放在同一条路线中。", metrics, cards: ["核心市场加速", "渠道模型复制", "产品能力升级", "区域扩张推进"] },
    { role: "funding", kicker: "CAPITAL ALLOCATION", summary: "说明资金用途和 12-18 个月关键里程碑。", metrics, cards: ["产品研发", "增长投放", "团队建设", "商业化验证"] },
  ];
  if (role === "closing") return { role: "closing", kicker: "INVESTOR NEXT STEP", summary: "用投资亮点、资金诉求和下一步沟通推动投资决策。", metrics, cards: baseCards, nodes: [] };
  return scenes[Math.min(index, scenes.length - 1)];
}

function growthFundingFlywheelBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).map((item) => item.trim()).filter(Boolean) : [];
  return values.length ? values : ["增长飞轮已形成稳定循环", "收入和留存指标持续改善", "融资将用于放大获客、产品和区域扩张"];
}

function growthFundingFlywheelCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function isGrowthFundingFlywheelVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "growth-funding-flywheel" && (id === "growth-funding-pitch" || id === "pitch-growth-funding-pitch-growth-flywheel");
}

function productFundingHighlightsDecorationsXml({ visual, index, role, slide }) {
  const scene = productFundingHighlightsScene({ slide, index, role });
  const palette = productFundingHighlightsPalette(visual);
  const shell = rectShapeXml({ id: 1100, name: "Product Funding Soft Canvas", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + solidShapeXml({ id: 1101, name: "Product Funding Content Surface", geom: "roundRect", x: 438912, y: 421640, cx: 8266176, cy: 4366260, fill: visual.surface })
    + lineFrameShapeXml({ id: 1102, name: "Product Funding Surface Frame", geom: "roundRect", x: 438912, y: 421640, cx: 8266176, cy: 4366260, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 1103, name: "Product Funding Top Spectrum", x: 438912, y: 421640, cx: 8266176, cy: 53340, fill: visual.primary })
    + rectShapeXml({ id: 1104, name: "Product Funding Cyan Spectrum", x: 3352800, y: 421640, cx: 2286000, cy: 53340, fill: visual.accent })
    + rectShapeXml({ id: 1105, name: "Product Funding Green Spectrum", x: 5638800, y: 421640, cx: 1676400, cy: 53340, fill: palette.green })
    + rectShapeXml({ id: 1106, name: "Product Funding Amber Spectrum", x: 7315200, y: 421640, cx: 914400, cy: 53340, fill: palette.amber })
    + solidShapeXml({ id: 1107, name: "Product Funding Cyan Glow", geom: "ellipse", x: 6934200, y: 533400, cx: 1524000, cy: 1524000, fill: palette.cyanGlow })
    + solidShapeXml({ id: 1108, name: "Product Funding Green Glow", geom: "ellipse", x: -213360, y: 3581400, cx: 1295400, cy: 1295400, fill: palette.greenGlow })
    + textShapeXml({ id: 1109, name: "Product Funding Kicker", x: 731520, y: 655320, cx: 3200400, cy: 274320, text: scene.kicker, size: 760, bold: true, color: visual.accent });
  const content = productFundingHighlightsContentXml({ visual, palette, scene, slide });
  if (scene.role === "cover" || scene.role === "demo") {
    return shell
      + content
      + productFundingHighlightsConsoleXml({ visual, palette })
      + productFundingHighlightsMetricCardsXml({ visual, palette, metrics: scene.metrics });
  }
  if (scene.role === "capability") {
    return shell + content + productFundingHighlightsCapabilityXml({ visual, palette, slide, cards: scene.cards });
  }
  if (scene.role === "technology") {
    return shell + content + productFundingHighlightsArchitectureXml({ visual, palette, slide, cards: scene.cards });
  }
  if (scene.role === "journey") {
    return shell + content + productFundingHighlightsJourneyXml({ visual, palette, slide, cards: scene.cards });
  }
  if (scene.role === "validation") {
    return shell
      + content
      + productFundingHighlightsDashboardXml({ visual, palette })
      + productFundingHighlightsMetricCardsXml({ visual, palette, metrics: scene.metrics });
  }
  if (scene.role === "roadmap" || scene.role === "funding") {
    return shell + content + productFundingHighlightsRoadmapXml({ visual, palette, slide, cards: scene.cards });
  }
  return shell
    + content
    + solidShapeXml({ id: 1190, name: "Product Funding Closing Panel", geom: "roundRect", x: 5791200, y: 1219200, cx: 2438400, cy: 2133600, fill: visual.primary })
    + rectShapeXml({ id: 1191, name: "Product Funding Closing Signal", x: 6096000, y: 1676400, cx: 1828800, cy: 76200, fill: visual.accent })
    + rectShapeXml({ id: 1192, name: "Product Funding Closing Data Band", x: 6400800, y: 2484120, cx: 1219200, cy: 533400, fill: palette.green, transparency: 28000 })
    + productFundingHighlightsMetricCardsXml({ visual, palette, metrics: scene.metrics });
}

function productFundingHighlightsContentXml({ visual, palette, scene, slide }) {
  const bullets = productFundingHighlightsBulletTexts(slide);
  const summary = productFundingHighlightsCompactText(bullets[0], scene.summary, 40);
  const bulletBody = bullets.slice(0, 4).map((item) => paragraphXml(productFundingHighlightsCompactText(item, scene.summary, 30), 700, false, visual.body)).join("");
  return rectShapeXml({ id: 1110, name: "Product Funding Summary Rule", x: 731520, y: scene.role === "cover" ? 2103120 : 1859280, cx: 3048000, cy: 38100, fill: visual.accent })
    + textShapeXml({ id: 1111, name: "Product Funding Summary", x: 731520, y: scene.role === "cover" ? 2324100 : 1905000, cx: 3352800, cy: 396240, text: summary, size: scene.role === "cover" ? 820 : 740, bold: true, color: visual.body })
    + textShapeXml({ id: 1112, name: "Product Funding Planned Content", x: 777240, y: scene.role === "cover" ? 2842260 : 2354580, cx: 3352800, cy: 838200, body: bulletBody, size: 700, bold: false, color: visual.body })
    + rectShapeXml({ id: 1113, name: "Product Funding Content Glow", x: 731520, y: 4145280, cx: 3352800, cy: 30480, fill: palette.cyan });
}

function productFundingHighlightsConsoleXml({ visual, palette }) {
  return solidShapeXml({ id: 1120, name: "Product Funding Demo Console", geom: "roundRect", x: 5638800, y: 929640, cx: 2743200, cy: 2667000, fill: visual.surface })
    + lineFrameShapeXml({ id: 1121, name: "Product Funding Demo Console Frame", geom: "roundRect", x: 5638800, y: 929640, cx: 2743200, cy: 2667000, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1122, name: "Product Funding Product Mockup", x: 5943600, y: 1219200, cx: 2133600, cy: 137160, fill: visual.primary })
    + rectShapeXml({ id: 1123, name: "Product Funding Demo Input", x: 5943600, y: 1676400, cx: 1066800, cy: 76200, fill: visual.accent })
    + rectShapeXml({ id: 1124, name: "Product Funding Demo Output", x: 7162800, y: 1676400, cx: 762000, cy: 76200, fill: palette.green })
    + arcLineShapeXml({ id: 1125, name: "Product Funding Demo Flow Arc", x: 6096000, y: 1752600, cx: 1219200, cy: 1066800, stroke: visual.accent, width: 45720 })
    + solidShapeXml({ id: 1126, name: "Product Funding Demo Insight Card", geom: "roundRect", x: 5943600, y: 2354580, cx: 1066800, cy: 685800, fill: palette.lightCyan })
    + solidShapeXml({ id: 1127, name: "Product Funding Demo Action Card", geom: "roundRect", x: 7162800, y: 2202180, cx: 762000, cy: 914400, fill: palette.lightGreen });
}

function productFundingHighlightsMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 3).map((metric, itemIndex) => {
    const x = 731520 + itemIndex * 1219200;
    return solidShapeXml({ id: 1130 + itemIndex, name: `Product Funding Metric Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3810000, cx: 1066800, cy: 609600, fill: itemIndex === 1 ? palette.lightGreen : visual.surface })
      + lineFrameShapeXml({ id: 1135 + itemIndex, name: `Product Funding Metric Frame ${itemIndex + 1}`, geom: "roundRect", x, y: 3810000, cx: 1066800, cy: 609600, stroke: itemIndex === 1 ? palette.green : palette.frame, width: 12700 })
      + textShapeXml({ id: 1140 + itemIndex, name: `Product Funding Metric Value ${itemIndex + 1}`, x: x + 152400, y: 3931920, cx: 762000, cy: 198120, text: metric.value, size: 1340, bold: true, color: visual.title })
      + textShapeXml({ id: 1145 + itemIndex, name: `Product Funding Metric Label ${itemIndex + 1}`, x: x + 152400, y: 4175760, cx: 762000, cy: 152400, text: metric.label, size: 600, bold: true, color: visual.body });
  }).join("");
}

function productFundingHighlightsCapabilityXml({ visual, palette, slide, cards }) {
  const bullets = productFundingHighlightsBulletTexts(slide);
  return cards.slice(0, 4).map((card, itemIndex) => {
    const column = itemIndex % 2;
    const row = Math.floor(itemIndex / 2);
    const x = 5638800 + column * 1371600;
    const y = 1219200 + row * 990600;
    return solidShapeXml({ id: 1150 + itemIndex, name: `Product Funding Capability Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 792480, fill: visual.surface })
      + lineFrameShapeXml({ id: 1155 + itemIndex, name: `Product Funding Capability Frame ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 792480, stroke: palette.frame, width: 12700 })
      + rectShapeXml({ id: 1160 + itemIndex, name: `Product Funding Capability Bar ${itemIndex + 1}`, x: x + 152400, y: y + 137160, cx: 381000, cy: 45720, fill: itemIndex % 2 ? palette.green : visual.accent })
      + textShapeXml({ id: 1165 + itemIndex, name: `Product Funding Capability Text ${itemIndex + 1}`, x: x + 152400, y: y + 304800, cx: 914400, cy: 274320, text: productFundingHighlightsCompactText(bullets[itemIndex] || card, card, 20), size: 740, bold: true, color: visual.title });
  }).join("");
}

function productFundingHighlightsArchitectureXml({ visual, palette, slide, cards }) {
  const bullets = productFundingHighlightsBulletTexts(slide);
  return cards.slice(0, 4).map((card, itemIndex) => {
    const y = 1219200 + itemIndex * 655320;
    return solidShapeXml({ id: 1170 + itemIndex, name: `Product Funding Technical Chain ${itemIndex + 1}`, geom: "roundRect", x: 5638800, y, cx: 2667000, cy: 487680, fill: itemIndex % 2 ? palette.cyan : visual.primary })
      + textShapeXml({ id: 1175 + itemIndex, name: `Product Funding Technical Chain Text ${itemIndex + 1}`, x: 5943600, y: y + 121920, cx: 2057400, cy: 198120, text: productFundingHighlightsCompactText(bullets[itemIndex] || card, card, 22), size: 760, bold: true, color: "FFFFFF" });
  }).join("");
}

function productFundingHighlightsJourneyXml({ visual, palette, slide, cards }) {
  const bullets = productFundingHighlightsBulletTexts(slide);
  const connector = rectShapeXml({ id: 1200, name: "Product Funding Value Journey Connector", x: 1066800, y: 3657600, cx: 6858000, cy: 30480, fill: palette.frame });
  const nodes = cards.slice(0, 4).map((card, itemIndex) => {
    const x = 1066800 + itemIndex * 1752600;
    return solidShapeXml({ id: 1205 + itemIndex, name: `Product Funding Value Journey Node ${itemIndex + 1}`, geom: "roundRect", x, y: 3048000, cx: 1371600, cy: 838200, fill: visual.surface })
      + lineFrameShapeXml({ id: 1215 + itemIndex, name: `Product Funding Value Journey Frame ${itemIndex + 1}`, geom: "roundRect", x, y: 3048000, cx: 1371600, cy: 838200, stroke: itemIndex % 2 ? palette.green : visual.accent, width: 15240 })
      + textShapeXml({ id: 1225 + itemIndex, name: `Product Funding Value Journey Text ${itemIndex + 1}`, x: x + 167640, y: 3276600, cx: 1036320, cy: 304800, text: productFundingHighlightsCompactText(bullets[itemIndex] || card, card, 18), size: 740, bold: true, color: visual.title })
      + rectShapeXml({ id: 1235 + itemIndex, name: `Product Funding Value Journey Progress ${itemIndex + 1}`, x: x + 167640, y: 3695700, cx: 914400, cy: 45720, fill: itemIndex % 2 ? palette.green : visual.accent });
  }).join("");
  return connector + nodes;
}

function productFundingHighlightsDashboardXml({ visual, palette }) {
  return solidShapeXml({ id: 1240, name: "Product Funding Validation Dashboard", geom: "roundRect", x: 5638800, y: 1219200, cx: 2743200, cy: 2217420, fill: visual.primary })
    + rectShapeXml({ id: 1241, name: "Product Funding Dashboard Trend", x: 5943600, y: 1485900, cx: 1905000, cy: 53340, fill: visual.accent })
    + rectShapeXml({ id: 1242, name: "Product Funding Dashboard Green Segment", x: 6705600, y: 1485900, cx: 762000, cy: 53340, fill: palette.green })
    + rectShapeXml({ id: 1243, name: "Product Funding Dashboard Amber Segment", x: 7467600, y: 1485900, cx: 457200, cy: 53340, fill: palette.amber })
    + rectShapeXml({ id: 1244, name: "Product Funding Dashboard Bar 1", x: 5943600, y: 2743200, cx: 304800, cy: 304800, fill: visual.accent })
    + rectShapeXml({ id: 1245, name: "Product Funding Dashboard Bar 2", x: 6553200, y: 2590800, cx: 304800, cy: 457200, fill: palette.green })
    + rectShapeXml({ id: 1246, name: "Product Funding Dashboard Bar 3", x: 7162800, y: 2407920, cx: 304800, cy: 640080, fill: palette.amber })
    + solidShapeXml({ id: 1247, name: "Product Funding Dashboard Insight", geom: "roundRect", x: 5943600, y: 1798320, cx: 1905000, cy: 518160, fill: palette.darkCard });
}

function productFundingHighlightsRoadmapXml({ visual, palette, slide, cards }) {
  const bullets = productFundingHighlightsBulletTexts(slide);
  const connector = rectShapeXml({ id: 1250, name: "Product Funding Roadmap Connector", x: 1066800, y: 3657600, cx: 6858000, cy: 30480, fill: palette.frame });
  const nodes = cards.slice(0, 4).map((card, itemIndex) => {
    const x = 1066800 + itemIndex * 1752600;
    return solidShapeXml({ id: 1255 + itemIndex, name: `Product Funding Roadmap Node ${itemIndex + 1}`, geom: "roundRect", x, y: 3048000, cx: 1371600, cy: 838200, fill: visual.surface })
      + lineFrameShapeXml({ id: 1265 + itemIndex, name: `Product Funding Roadmap Frame ${itemIndex + 1}`, geom: "roundRect", x, y: 3048000, cx: 1371600, cy: 838200, stroke: itemIndex % 2 ? palette.green : visual.accent, width: 15240 })
      + textShapeXml({ id: 1275 + itemIndex, name: `Product Funding Roadmap Text ${itemIndex + 1}`, x: x + 167640, y: 3276600, cx: 1036320, cy: 304800, text: productFundingHighlightsCompactText(bullets[itemIndex] || card, card, 18), size: 740, bold: true, color: visual.title })
      + rectShapeXml({ id: 1285 + itemIndex, name: `Product Funding Roadmap Progress ${itemIndex + 1}`, x: x + 167640, y: 3695700, cx: 914400, cy: 45720, fill: itemIndex % 2 ? palette.green : visual.accent });
  }).join("");
  return connector + nodes;
}

function productFundingHighlightsPalette(visual) {
  return {
    cyan: visual.accent || "06B6D4",
    green: visual.secondary || "22C55E",
    amber: visual.warning || "F59E0B",
    frame: "CBD5E1",
    lightCyan: "E0F7FE",
    lightGreen: "DCFCE7",
    cyanGlow: "BAE6FD",
    greenGlow: "BBF7D0",
    darkCard: "12324D",
  };
}

function productFundingHighlightsScene({ slide, index, role }) {
  const bullets = productFundingHighlightsBulletTexts(slide);
  const metrics = [
    { value: "PMF", label: "产品市场契合" },
    { value: "NPS", label: "用户价值验证" },
    { value: "API", label: "技术可扩展性" },
  ];
  const baseCards = ["核心能力清晰", "技术壁垒可验证", "用户价值可量化", "演示路径完整"].map((fallback, itemIndex) => productFundingHighlightsCompactText(bullets[itemIndex], fallback, 18));
  const scenes = [
    { role: "cover", kicker: "PRODUCT INVESTOR DEMO", summary: "用产品控制台、能力矩阵和用户价值证据说明融资后的放大空间。", metrics, cards: baseCards },
    { role: "capability", kicker: "CAPABILITY MAP", summary: "把核心功能、关键场景、业务收益和交付能力拆成可投资判断的产品证据。", metrics, cards: baseCards },
    { role: "demo", kicker: "LIVE DEMO FLOW", summary: "展示输入、分析、推荐和输出的完整演示链路，帮助投资人快速理解产品效率。", metrics, cards: ["输入业务目标", "生成策略分析", "输出行动方案", "沉淀数据资产"] },
    { role: "technology", kicker: "TECH ADVANTAGE", summary: "从数据层、模型层、工作流和集成能力说明产品护城河。", metrics, cards: ["数据层沉淀", "模型能力调度", "业务工作流", "开放集成能力"] },
    { role: "journey", kicker: "USER VALUE JOURNEY", summary: "用用户旅程说明从痛点到效率提升再到业务结果的价值闭环。", metrics, cards: ["发现痛点", "产品介入", "效率提升", "结果验证"] },
    { role: "validation", kicker: "MARKET VALIDATION", summary: "用留存、活跃、转化和客户案例说明产品已经被市场验证。", metrics, cards: baseCards },
    { role: "roadmap", kicker: "PRODUCT ROADMAP", summary: "把融资后的研发、技术升级、客户交付和市场拓展放进一条路线。", metrics, cards: ["研发迭代", "技术升级", "客户交付", "市场扩张"] },
    { role: "funding", kicker: "CAPITAL PLAN", summary: "说明资金用途与 12-18 个月的产品、技术和商业化里程碑。", metrics, cards: ["产品研发", "AI 能力", "解决方案交付", "增长渠道"] },
  ];
  if (role === "closing") return { role: "closing", kicker: "INVESTOR NEXT STEP", summary: "用投资亮点、产品证据和资金计划推动下一轮投资沟通。", metrics, cards: baseCards };
  return scenes[Math.min(index, scenes.length - 1)];
}

function productFundingHighlightsBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).map((item) => item.trim()).filter(Boolean) : [];
  return values.length ? values : ["产品能力已经形成清晰演示路径", "技术优势和用户价值可以被量化验证", "融资将用于产品迭代、技术壁垒和商业化扩张"];
}

function productFundingHighlightsCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function isProductFundingHighlightsVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "product-funding-highlights" && (id === "product-funding-pitch" || id === "pitch-product-funding-pitch-product-highlights");
}

function investorUpdateProgressDecorationsXml({ visual, index, role, slide }) {
  const scene = investorUpdateProgressScene({ slide, index, role });
  const palette = investorUpdateProgressPalette(visual);
  const shell = rectShapeXml({ id: 1300, name: "Investor Update Soft Canvas", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + solidShapeXml({ id: 1301, name: "Investor Update Content Surface", geom: "roundRect", x: 530352, y: 452120, cx: 8083296, cy: 4239260, fill: visual.surface })
    + lineFrameShapeXml({ id: 1302, name: "Investor Update Surface Frame", geom: "roundRect", x: 530352, y: 452120, cx: 8083296, cy: 4239260, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 1303, name: "Investor Update Top Guard", x: 0, y: 0, cx: 9144000, cy: 320040, fill: visual.primary })
    + rectShapeXml({ id: 1304, name: "Investor Update Teal Accent", x: 2895600, y: 320040, cx: 3048000, cy: 38100, fill: visual.accent })
    + rectShapeXml({ id: 1305, name: "Investor Update Amber Accent", x: 5943600, y: 320040, cx: 1219200, cy: 38100, fill: palette.amber })
    + solidShapeXml({ id: 1306, name: "Investor Update Teal Glow", geom: "ellipse", x: 6858000, y: 579120, cx: 1447800, cy: 1447800, fill: palette.tealGlow })
    + textShapeXml({ id: 1307, name: "Investor Update Kicker", x: 762000, y: 640080, cx: 3200400, cy: 274320, text: scene.kicker, size: 760, bold: true, color: visual.accent });
  const content = investorUpdateProgressContentXml({ visual, palette, scene, slide });
  if (scene.role === "cover" || scene.role === "metrics") {
    return shell + content + investorUpdateDashboardXml({ visual, palette }) + investorUpdateMetricCardsXml({ visual, palette, metrics: scene.metrics });
  }
  if (scene.role === "progress") {
    return shell + content + investorUpdateCardsXml({ visual, palette, slide, cards: scene.cards }) + investorUpdateMetricCardsXml({ visual, palette, metrics: scene.metrics });
  }
  if (scene.role === "timeline") {
    return shell + content + investorUpdateLanesXml({ visual, palette, slide, cards: scene.cards }) + investorUpdateMetricCardsXml({ visual, palette, metrics: scene.metrics });
  }
  if (scene.role === "risk") {
    return shell + content + investorUpdateRiskXml({ visual, palette, slide, cards: scene.cards }) + investorUpdateMetricCardsXml({ visual, palette, metrics: scene.metrics });
  }
  if (scene.role === "plan") {
    return shell + content + investorUpdateRoadmapXml({ visual, palette, slide, cards: scene.cards });
  }
  return shell
    + content
    + solidShapeXml({ id: 1370, name: "Investor Update Closing Loop", geom: "ellipse", x: 5943600, y: 1371600, cx: 1752600, cy: 1752600, fill: palette.tealGlow })
    + arcLineShapeXml({ id: 1371, name: "Investor Update Closing Arc", x: 5943600, y: 1371600, cx: 1752600, cy: 1752600, stroke: visual.primary, width: 45720 })
    + investorUpdateRoadmapXml({ visual, palette, slide, cards: scene.cards });
}

function investorUpdateProgressContentXml({ visual, palette, scene, slide }) {
  const bullets = investorUpdateBulletTexts(slide);
  const summary = investorUpdateCompactText(bullets[0], scene.summary, 38);
  const bulletBody = bullets.slice(0, 3).map((item) => paragraphXml(investorUpdateCompactText(item, scene.summary, 28), 680, false, visual.body)).join("");
  return rectShapeXml({ id: 1310, name: "Investor Update Summary Rule", x: 762000, y: scene.role === "cover" ? 2232660 : 1905000, cx: 3048000, cy: 38100, fill: visual.accent })
    + textShapeXml({ id: 1311, name: "Investor Update Summary", x: 762000, y: scene.role === "cover" ? 2468880 : 1950720, cx: 3505200, cy: 335280, text: summary, size: scene.role === "cover" ? 820 : 740, bold: true, color: visual.body })
    + textShapeXml({ id: 1312, name: "Investor Update Planned Content", x: 807720, y: scene.role === "cover" ? 3002280 : 2392680, cx: 3352800, cy: 762000, body: bulletBody || paragraphXml("", 680, false, visual.body), size: 680, bold: false, color: visual.body })
    + rectShapeXml({ id: 1313, name: "Investor Update Content Hairline", x: 762000, y: 4213860, cx: 3505200, cy: 30480, fill: palette.lightTeal });
}

function investorUpdateDashboardXml({ visual, palette }) {
  const bars = [
    { x: 5943600, y: 3307080, h: 381000, fill: visual.accent },
    { x: 6400800, y: 3124200, h: 563880, fill: visual.primary },
    { x: 6858000, y: 3200400, h: 487680, fill: visual.accent },
    { x: 7315200, y: 2941320, h: 746760, fill: palette.amber },
  ].map((bar, itemIndex) => rectShapeXml({ id: 1335 + itemIndex, name: `Investor Update Dashboard Bar ${itemIndex + 1}`, x: bar.x, y: bar.y, cx: 259080, cy: bar.h, fill: bar.fill })).join("");
  return solidShapeXml({ id: 1320, name: "Investor Update KPI Dashboard", geom: "roundRect", x: 5638800, y: 1066800, cx: 2514600, cy: 2286000, fill: palette.panel })
    + lineFrameShapeXml({ id: 1321, name: "Investor Update Dashboard Frame", geom: "roundRect", x: 5638800, y: 1066800, cx: 2514600, cy: 2286000, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 1322, name: "Investor Update Dashboard Header", x: 5943600, y: 1280160, cx: 1905000, cy: 91440, fill: visual.primary })
    + rectShapeXml({ id: 1323, name: "Investor Update Dashboard Teal Rule", x: 5943600, y: 1645920, cx: 975360, cy: 53340, fill: visual.accent })
    + rectShapeXml({ id: 1324, name: "Investor Update Dashboard Amber Rule", x: 7010400, y: 1645920, cx: 838200, cy: 53340, fill: palette.amber })
    + rectShapeXml({ id: 1325, name: "Investor Update Dashboard Axis", x: 5867400, y: 3695700, cx: 2057400, cy: 22860, fill: palette.frame })
    + bars;
}

function investorUpdateMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 4).map((metric, itemIndex) => {
    const x = 762000 + itemIndex * 1905000;
    return solidShapeXml({ id: 1345 + itemIndex, name: `Investor Update Metric Card ${itemIndex + 1}`, geom: "roundRect", x, y: 3870960, cx: 1676400, cy: 609600, fill: itemIndex === 2 ? palette.lightAmber : visual.surface })
      + lineFrameShapeXml({ id: 1350 + itemIndex, name: `Investor Update Metric Frame ${itemIndex + 1}`, geom: "roundRect", x, y: 3870960, cx: 1676400, cy: 609600, stroke: itemIndex === 2 ? palette.amber : palette.frame, width: 12700 })
      + textShapeXml({ id: 1355 + itemIndex, name: `Investor Update Metric Value ${itemIndex + 1}`, x: x + 152400, y: 3992880, cx: 914400, cy: 198120, text: metric.value, size: 1280, bold: true, color: visual.title })
      + textShapeXml({ id: 1360 + itemIndex, name: `Investor Update Metric Label ${itemIndex + 1}`, x: x + 152400, y: 4236720, cx: 1219200, cy: 152400, text: metric.label, size: 600, bold: true, color: visual.body });
  }).join("");
}

function investorUpdateCardsXml({ visual, palette, slide, cards }) {
  const bullets = investorUpdateBulletTexts(slide);
  return cards.slice(0, 4).map((card, itemIndex) => {
    const column = itemIndex % 2;
    const row = Math.floor(itemIndex / 2);
    const x = 5638800 + column * 1371600;
    const y = 1219200 + row * 914400;
    return solidShapeXml({ id: 1380 + itemIndex, name: `Investor Update Progress Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 746760, fill: visual.surface })
      + lineFrameShapeXml({ id: 1385 + itemIndex, name: `Investor Update Progress Frame ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 746760, stroke: palette.frame, width: 12700 })
      + rectShapeXml({ id: 1390 + itemIndex, name: `Investor Update Progress Bar ${itemIndex + 1}`, x: x + 152400, y: y + 152400, cx: 426720, cy: 45720, fill: itemIndex % 2 ? palette.amber : visual.accent })
      + textShapeXml({ id: 1395 + itemIndex, name: `Investor Update Progress Text ${itemIndex + 1}`, x: x + 152400, y: y + 304800, cx: 914400, cy: 274320, text: investorUpdateCompactText(bullets[itemIndex] || card, card, 18), size: 720, bold: true, color: visual.title });
  }).join("");
}

function investorUpdateLanesXml({ visual, palette, slide, cards }) {
  const bullets = investorUpdateBulletTexts(slide);
  return cards.slice(0, 4).map((card, itemIndex) => {
    const y = 1143000 + itemIndex * 624840;
    return solidShapeXml({ id: 1410 + itemIndex, name: `Investor Update Operating Lane ${itemIndex + 1}`, geom: "roundRect", x: 5638800, y, cx: 2514600, cy: 441960, fill: visual.surface })
      + lineFrameShapeXml({ id: 1415 + itemIndex, name: `Investor Update Operating Lane Frame ${itemIndex + 1}`, geom: "roundRect", x: 5638800, y, cx: 2514600, cy: 441960, stroke: itemIndex % 2 ? palette.amber : visual.accent, width: 12700 })
      + solidShapeXml({ id: 1420 + itemIndex, name: `Investor Update Lane Dot ${itemIndex + 1}`, geom: "ellipse", x: 5867400, y: y + 121920, cx: 152400, cy: 152400, fill: itemIndex % 2 ? palette.amber : visual.accent })
      + textShapeXml({ id: 1425 + itemIndex, name: `Investor Update Lane Text ${itemIndex + 1}`, x: 6172200, y: y + 121920, cx: 1676400, cy: 182880, text: investorUpdateCompactText(bullets[itemIndex] || card, card, 20), size: 720, bold: true, color: visual.title });
  }).join("");
}

function investorUpdateRiskXml({ visual, palette, slide, cards }) {
  const bullets = investorUpdateBulletTexts(slide);
  return cards.slice(0, 4).map((card, itemIndex) => {
    const column = itemIndex % 2;
    const row = Math.floor(itemIndex / 2);
    const x = 5638800 + column * 1371600;
    const y = 1219200 + row * 914400;
    const isAsk = itemIndex > 1;
    return solidShapeXml({ id: 1440 + itemIndex, name: `Investor Update Risk Ask Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 746760, fill: isAsk ? palette.lightTeal : palette.lightAmber })
      + lineFrameShapeXml({ id: 1445 + itemIndex, name: `Investor Update Risk Ask Frame ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 746760, stroke: isAsk ? visual.accent : palette.amber, width: 12700 })
      + textShapeXml({ id: 1450 + itemIndex, name: `Investor Update Risk Ask Text ${itemIndex + 1}`, x: x + 152400, y: y + 213360, cx: 914400, cy: 304800, text: investorUpdateCompactText(bullets[itemIndex] || card, card, 18), size: 720, bold: true, color: visual.title });
  }).join("");
}

function investorUpdateRoadmapXml({ visual, palette, slide, cards }) {
  const bullets = investorUpdateBulletTexts(slide);
  const connector = rectShapeXml({ id: 1460, name: "Investor Update Roadmap Connector", x: 1219200, y: 3657600, cx: 6553200, cy: 30480, fill: palette.frame });
  const nodes = cards.slice(0, 3).map((card, itemIndex) => {
    const x = 1219200 + itemIndex * 2286000;
    return solidShapeXml({ id: 1465 + itemIndex, name: `Investor Update Roadmap Node ${itemIndex + 1}`, geom: "roundRect", x, y: 3048000, cx: 1905000, cy: 838200, fill: visual.surface })
      + lineFrameShapeXml({ id: 1470 + itemIndex, name: `Investor Update Roadmap Frame ${itemIndex + 1}`, geom: "roundRect", x, y: 3048000, cx: 1905000, cy: 838200, stroke: itemIndex === 1 ? visual.accent : palette.frame, width: 12700 })
      + textShapeXml({ id: 1475 + itemIndex, name: `Investor Update Roadmap Text ${itemIndex + 1}`, x: x + 182880, y: 3284220, cx: 1524000, cy: 304800, text: investorUpdateCompactText(bullets[itemIndex] || card, card, 20), size: 720, bold: true, color: visual.title })
      + rectShapeXml({ id: 1480 + itemIndex, name: `Investor Update Roadmap Progress ${itemIndex + 1}`, x: x + 182880, y: 3710940, cx: 1219200, cy: 45720, fill: itemIndex === 1 ? visual.accent : palette.amber });
  }).join("");
  return connector + nodes;
}

function investorUpdateProgressPalette(visual) {
  return {
    frame: "CBD5E1",
    panel: "F8FAFC",
    amber: visual.secondary || "F59E0B",
    lightTeal: "CCFBF1",
    lightAmber: "FEF3C7",
    tealGlow: "D5F5F0",
  };
}

function investorUpdateProgressScene({ slide, index, role }) {
  const bullets = investorUpdateBulletTexts(slide);
  const metrics = [
    { value: "MRR", label: "收入进展" },
    { value: "92%", label: "核心留存" },
    { value: "14m", label: "现金 runway" },
    { value: "3", label: "本月请求" },
  ];
  const cards = ["本月完成", "关键指标", "风险事项", "下月重点"].map((fallback, itemIndex) => investorUpdateCompactText(bullets[itemIndex], fallback, 18));
  const scenes = [
    { role: "cover", kicker: "INVESTOR MONTHLY UPDATE", summary: "用经营进展、关键数据、风险请求和下一阶段计划支持月度投资人沟通。", metrics, cards },
    { role: "progress", kicker: "PROGRESS BRIEFING", summary: "把产品、销售、团队和财务进展整理成投资人能快速扫描的经营摘要。", metrics, cards },
    { role: "metrics", kicker: "METRICS DISCLOSURE", summary: "披露收入、留存、转化、现金消耗和 pipeline，让经营质量可持续跟踪。", metrics, cards },
    { role: "timeline", kicker: "OPERATING TIMELINE", summary: "用多泳道同步已完成、进行中和需要关注的经营事项。", metrics, cards: ["产品迭代", "销售推进", "团队建设", "财务节奏"] },
    { role: "risk", kicker: "RISKS AND ASKS", summary: "把关键风险和需要投资人协助的事项放在同一页，便于会后行动。", metrics, cards: ["交付风险", "招聘缺口", "客户引荐", "融资准备"] },
    { role: "plan", kicker: "30 / 60 / 90 PLAN", summary: "明确下一阶段目标、资源投入和投资人关注的决策节点。", metrics, cards: ["30 天修复关键风险", "60 天验证增长假设", "90 天形成融资材料"] },
  ];
  if (role === "closing") return { role: "closing", kicker: "NEXT INVESTOR ACTION", summary: "用明确请求和下一步计划推动投资人沟通持续向前。", metrics, cards: ["确认本月判断", "安排资源协助", "跟踪关键指标"] };
  return scenes[Math.min(index, scenes.length - 1)];
}

function investorUpdateBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).map((item) => item.trim()).filter(Boolean) : [];
  return values.length ? values : ["本月核心经营进展和关键指标变化", "需要向投资人披露的风险、请求和资源协同", "下一阶段 30/60/90 天计划与目标"];
}

function investorUpdateCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function isInvestorUpdateProgressVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "investor-update-progress-sync" && (id === "investor-update-report" || id === "pitch-investor-update-report-progress-sync");
}

function seedRoundStoryDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = seedRoundStoryScene({ slide, index, role });
  const palette = seedRoundStoryColorPalette(visual);
  const shell = solidShapeXml({ id: 1800, name: "Seed Round Story Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface })
    + lineFrameShapeXml({ id: 1801, name: "Seed Round Story Paper Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 1802, name: "Seed Round Story Top Rule", x: layout.surface.x, y: layout.surface.y, cx: layout.surface.cx, cy: 68580, fill: visual.accent })
    + rectShapeXml({ id: 1803, name: "Seed Round Story Focus Rule", ...layout.secondaryAccent, fill: visual.accent })
    + solidShapeXml({ id: 1804, name: "Seed Round Story Warm Glow", geom: "ellipse", x: 6705600, y: 396240, cx: 1828800, cy: 1828800, fill: palette.glow })
    + solidShapeXml({ id: 1805, name: "Seed Round Story Blue Glow", geom: "ellipse", x: -304800, y: 3505200, cx: 1371600, cy: 1371600, fill: palette.blueGlow })
    + textShapeXml({ id: 1806, name: "Seed Round Story Section Label", ...layout.label, text: scene.kicker, size: 760, bold: true, color: visual.accent });

  const notes = seedRoundStoryInsightCardsXml({ visual, palette, items: scene.insights, y: role === "closing" ? 3124200 : 3505200 });
  const content = seedRoundStoryContentXml({ visual, palette, scene, slide, index, role });
  if (index === 0) {
    return shell
      + content
      + seedRoundStoryMockupXml({ visual, palette })
      + seedRoundStoryMetricsXml({ visual, palette, metrics: scene.metrics })
      + seedRoundStoryLineXml({ visual, palette, items: scene.roadmap });
  }
  if (scene.kind === "pain") {
    return shell + content + seedRoundStoryPainWallXml({ visual, palette, items: scene.cards }) + notes;
  }
  if (scene.kind === "mvp") {
    return shell + content + seedRoundStoryValidationBoardXml({ visual, palette, items: scene.cards }) + notes;
  }
  if (scene.kind === "traction") {
    return shell + content + seedRoundStoryGrowthChartXml({ visual, palette, items: scene.metrics }) + notes;
  }
  if (scene.kind === "team") {
    return shell + content + seedRoundStoryTeamCardsXml({ visual, palette, items: scene.cards }) + notes;
  }
  return shell + content + seedRoundStoryFundingRoadXml({ visual, palette, items: scene.roadmap }) + notes;
}

function seedRoundStoryContentXml({ visual, palette, scene, slide, index, role }) {
  const bullets = seedRoundStoryBulletTexts(slide);
  const summary = seedRoundStoryCompactText(bullets[0], seedRoundStorySceneSummary(scene), 42);
  const items = bullets.slice(0, index === 0 ? 3 : 4)
    .map((item) => seedRoundStoryReadableText(item, 36))
    .filter(Boolean);
  const y = index === 0 ? 2263140 : role === "closing" ? 2057400 : 1783080;
  const height = index === 0 ? 990600 : role === "closing" ? 731520 : 1036320;
  const itemBody = items.map((item) => `<a:p><a:pPr marL="228600" indent="-114300"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="zh-CN" sz="${index === 0 ? 700 : 640}"><a:solidFill><a:srgbClr val="${visual.body}"/></a:solidFill></a:rPr><a:t>${escapeXml(item)}</a:t></a:r></a:p>`).join("");
  // 种子轮模板关闭了默认正文层，这里用专属文本面板承接用户规划内容，避免导出后只剩装饰图形。
  return solidShapeXml({ id: 1840, name: "Seed Round Content Panel", geom: "roundRect", x: 777240, y, cx: 3657600, cy: height, fill: blendHexColor(visual.surface, visual.background, 0.10) })
    + lineFrameShapeXml({ id: 1841, name: "Seed Round Content Panel Frame", geom: "roundRect", x: 777240, y, cx: 3657600, cy: height, stroke: palette.frame, width: 7620 })
    + rectShapeXml({ id: 1842, name: "Seed Round Content Panel Accent", x: 929640, y: y + 137160, cx: 701040, cy: 38100, fill: visual.accent })
    + textShapeXml({ id: 1843, name: "Seed Round Content Summary", x: 929640, y: y + 243840, cx: 3200400, cy: 182880, text: summary, size: index === 0 ? 760 : 700, bold: true, color: visual.title })
    + textShapeXml({ id: 1844, name: "Seed Round Planned Content", x: 929640, y: y + 502920, cx: 3200400, cy: Math.max(243840, height - 594360), body: itemBody || paragraphXml("", 640, false, visual.body), size: 640, bold: false, color: visual.body });
}

function seedRoundStoryMockupXml({ visual, palette }) {
  return solidShapeXml({ id: 1810, name: "Seed Round MVP Mockup", geom: "roundRect", x: 5486400, y: 1127760, cx: 2743200, cy: 1905000, fill: palette.panel })
    + lineFrameShapeXml({ id: 1811, name: "Seed Round MVP Mockup Frame", geom: "roundRect", x: 5486400, y: 1127760, cx: 2743200, cy: 1905000, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 1812, name: "Seed Round MVP Header", x: 5775960, y: 1371600, cx: 2164080, cy: 91440, fill: visual.primary })
    + rectShapeXml({ id: 1813, name: "Seed Round MVP Signal", x: 5775960, y: 1691640, cx: 944880, cy: 76200, fill: visual.accent })
    + rectShapeXml({ id: 1814, name: "Seed Round MVP Signal Secondary", x: 6934200, y: 1691640, cx: 701040, cy: 76200, fill: palette.green })
    + solidShapeXml({ id: 1815, name: "Seed Round MVP Product Card", geom: "roundRect", x: 5806440, y: 2057400, cx: 944880, cy: 609600, fill: visual.surface })
    + solidShapeXml({ id: 1816, name: "Seed Round MVP User Card", geom: "roundRect", x: 6964680, y: 2057400, cx: 944880, cy: 609600, fill: palette.soft })
    + arcLineShapeXml({ id: 1817, name: "Seed Round MVP Story Arc", x: 5928360, y: 1828800, cx: 1524000, cy: 1066800, stroke: visual.accent, width: 38100 });
}

function seedRoundStoryMetricsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 3).map((metric, index) => {
    const x = 777240 + index * 1371600;
    return solidShapeXml({ id: 1820 + index * 3, name: `Seed Round Metric Card ${index + 1}`, geom: "roundRect", x, y: 3543300, cx: 1219200, cy: 640080, fill: index === 1 ? palette.soft : visual.surface })
      + textShapeXml({ id: 1821 + index * 3, name: `Seed Round Metric Value ${index + 1}`, x: x + 152400, y: 3642360, cx: 914400, cy: 198120, text: metric.value, size: 1300, bold: true, color: visual.title })
      + textShapeXml({ id: 1822 + index * 3, name: `Seed Round Metric Label ${index + 1}`, x: x + 152400, y: 3886200, cx: 914400, cy: 167640, text: metric.label, size: 640, bold: true, color: visual.body });
  }).join("");
}

function seedRoundStoryLineXml({ visual, palette, items }) {
  const y = 4305300;
  return rectShapeXml({ id: 1830, name: "Seed Round Storyline", x: 868680, y: y + 121920, cx: 7467600, cy: 38100, fill: palette.line })
    + items.slice(0, 5).map((item, index) => {
      const x = 914400 + index * 1714500;
      return solidShapeXml({ id: 1831 + index * 3, name: `Seed Round Storyline Node ${index + 1}`, geom: "ellipse", x, y, cx: 274320, cy: 274320, fill: index === 2 ? visual.accent : visual.surface })
        + lineFrameShapeXml({ id: 1832 + index * 3, name: `Seed Round Storyline Node Frame ${index + 1}`, geom: "ellipse", x, y, cx: 274320, cy: 274320, stroke: index === 3 ? palette.green : visual.accent, width: 30480 })
        + textShapeXml({ id: 1833 + index * 3, name: `Seed Round Storyline Text ${index + 1}`, x: x - 198120, y: y + 335280, cx: 670560, cy: 152400, text: item, size: 560, bold: true, color: visual.title });
    }).join("");
}

function seedRoundStoryPainWallXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 5364480 + (index % 2) * 1371600;
    const y = 1226820 + Math.floor(index / 2) * 1021080;
    return solidShapeXml({ id: 1850 + index * 4, name: `Seed Round Pain Evidence ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 792480, fill: index % 2 ? palette.blueSoft : palette.orangeSoft })
      + rectShapeXml({ id: 1851 + index * 4, name: `Seed Round Pain Evidence Pin ${index + 1}`, x: x + 137160, y: y + 137160, cx: 381000, cy: 45720, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1852 + index * 4, name: `Seed Round Pain Evidence Text ${index + 1}`, x: x + 137160, y: y + 335280, cx: 944880, cy: 182880, text: item, size: 700, bold: true, color: visual.title });
  }).join("");
}

function seedRoundStoryValidationBoardXml({ visual, palette, items }) {
  const x = 5334000;
  const y = 1127760;
  return solidShapeXml({ id: 1870, name: "Seed Round MVP Board", geom: "roundRect", x, y, cx: 2895600, cy: 2133600, fill: palette.panel })
    + lineFrameShapeXml({ id: 1871, name: "Seed Round MVP Board Frame", geom: "roundRect", x, y, cx: 2895600, cy: 2133600, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 1872, name: "Seed Round MVP Board Header", x: x + 243840, y: y + 274320, cx: 2407920, cy: 76200, fill: visual.primary })
    + items.slice(0, 3).map((item, index) => {
      const rowY = y + 640080 + index * 457200;
      return solidShapeXml({ id: 1873 + index * 4, name: `Seed Round MVP Check ${index + 1}`, geom: "ellipse", x: x + 274320, y: rowY, cx: 198120, cy: 198120, fill: index === 1 ? visual.accent : palette.green })
        + rectShapeXml({ id: 1874 + index * 4, name: `Seed Round MVP Check Rule ${index + 1}`, x: x + 579120, y: rowY + 60960, cx: 1524000, cy: 45720, fill: palette.line })
        + textShapeXml({ id: 1875 + index * 4, name: `Seed Round MVP Check Text ${index + 1}`, x: x + 579120, y: rowY + 137160, cx: 1828800, cy: 152400, text: item, size: 660, bold: true, color: visual.title });
    }).join("");
}

function seedRoundStoryGrowthChartXml({ visual, palette, items }) {
  const x = 5364480;
  const y = 1257300;
  const bars = [365760, 563880, 792480];
  return solidShapeXml({ id: 1890, name: "Seed Round Traction Chart", geom: "roundRect", x, y, cx: 2804160, cy: 1905000, fill: palette.panel })
    + lineFrameShapeXml({ id: 1891, name: "Seed Round Traction Chart Frame", geom: "roundRect", x, y, cx: 2804160, cy: 1905000, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 1892, name: "Seed Round Traction Axis", x: x + 365760, y: y + 1478280, cx: 2011680, cy: 30480, fill: palette.line })
    + bars.map((height, index) => {
      const barX = x + 579120 + index * 548640;
      return solidShapeXml({ id: 1893 + index * 3, name: `Seed Round Traction Bar ${index + 1}`, geom: "roundRect", x: barX, y: y + 1478280 - height, cx: 228600, cy: height, fill: index === 2 ? visual.accent : visual.primary })
        + textShapeXml({ id: 1894 + index * 3, name: `Seed Round Traction Label ${index + 1}`, x: barX - 91440, y: y + 1539240, cx: 426720, cy: 137160, text: items[index]?.label || "", size: 540, bold: true, color: visual.body });
    }).join("")
    + rectShapeXml({ id: 1905, name: "Seed Round Traction Growth Line", x: x + 548640, y: y + 777240, cx: 1676400, cy: 38100, fill: palette.green });
}

function seedRoundStoryTeamCardsXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 5257800 + index * 960120;
    return solidShapeXml({ id: 1910 + index * 4, name: `Seed Round Founder Card ${index + 1}`, geom: "roundRect", x, y: 1371600, cx: 822960, cy: 1371600, fill: index === 1 ? palette.soft : visual.surface })
      + solidShapeXml({ id: 1911 + index * 4, name: `Seed Round Founder Avatar ${index + 1}`, geom: "ellipse", x: x + 228600, y: 1584960, cx: 365760, cy: 365760, fill: index === 1 ? visual.accent : visual.primary })
      + rectShapeXml({ id: 1912 + index * 4, name: `Seed Round Founder Rule ${index + 1}`, x: x + 152400, y: 2301240, cx: 518160, cy: 38100, fill: palette.line })
      + textShapeXml({ id: 1913 + index * 4, name: `Seed Round Founder Text ${index + 1}`, x: x + 121920, y: 2514600, cx: 579120, cy: 167640, text: item, size: 620, bold: true, color: visual.title });
  }).join("");
}

function seedRoundStoryFundingRoadXml({ visual, palette, items }) {
  const y = 2971800;
  return rectShapeXml({ id: 1930, name: "Seed Round Funding Road", x: 944880, y: y + 335280, cx: 7193280, cy: 45720, fill: palette.line })
    + items.slice(0, 4).map((item, index) => {
      const x = 914400 + index * 1981200;
      return solidShapeXml({ id: 1931 + index * 4, name: `Seed Round Funding Milestone ${index + 1}`, geom: "roundRect", x, y, cx: 1524000, cy: 731520, fill: index === 2 ? palette.orangeSoft : visual.surface })
        + solidShapeXml({ id: 1932 + index * 4, name: `Seed Round Funding Dot ${index + 1}`, geom: "ellipse", x: x + 152400, y: y + 152400, cx: 213360, cy: 213360, fill: index === 2 ? visual.accent : visual.primary })
        + textShapeXml({ id: 1933 + index * 4, name: `Seed Round Funding Text ${index + 1}`, x: x + 426720, y: y + 198120, cx: 914400, cy: 182880, text: item, size: 700, bold: true, color: visual.title });
    }).join("");
}

function seedRoundStoryInsightCardsXml({ visual, palette, items, y }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 777240 + index * 1371600;
    return solidShapeXml({ id: 1950 + index * 3, name: `Seed Round Insight Card ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 548640, fill: visual.surface })
      + rectShapeXml({ id: 1951 + index * 3, name: `Seed Round Insight Rule ${index + 1}`, x: x + 137160, y: y + 137160, cx: 548640, cy: 38100, fill: index === 1 ? palette.green : visual.accent })
      + textShapeXml({ id: 1952 + index * 3, name: `Seed Round Insight Text ${index + 1}`, x: x + 137160, y: y + 304800, cx: 914400, cy: 137160, text: item, size: 620, bold: true, color: visual.title });
  }).join("");
}

function seedRoundStoryColorPalette(visual) {
  return {
    blueGlow: blendHexColor(visual.primary, visual.background, 0.82),
    blueSoft: blendHexColor(visual.primary, visual.surface, 0.82),
    frame: blendHexColor(visual.primary, visual.background, 0.62),
    glow: blendHexColor(visual.accent, visual.background, 0.78),
    green: "16A34A",
    line: blendHexColor(visual.primary, visual.background, 0.58),
    orangeSoft: blendHexColor(visual.accent, visual.surface, 0.78),
    panel: blendHexColor(visual.surface, visual.background, 0.16),
    soft: blendHexColor(visual.accent, visual.surface, 0.84),
  };
}

function seedRoundStoryScene({ slide, index, role }) {
  const bullets = seedRoundStoryBulletTexts(slide);
  const compact = (fallback, itemIndex, maxLength = 10) => seedRoundStoryCompactText(bullets[itemIndex], fallback, maxLength);
  const insights = [
    compact("真实访谈", 0, 8),
    compact("留存验证", 1, 8),
    compact("转化信号", 2, 8),
  ];
  if (index === 0) {
    return {
      kind: "cover",
      kicker: "SEED ROUND NARRATIVE",
      insights,
      roadmap: ["发现痛点", "访谈验证", "MVP", "早期用户", "融资计划"],
      metrics: [
        { value: "37", label: "用户访谈" },
        { value: "12%", label: "周留存" },
        { value: "3.4x", label: "转介绍" },
      ],
    };
  }
  if (role === "closing" || index >= 5) {
    return {
      kind: "funding",
      kicker: "NEXT INVESTOR CONVERSATION",
      insights,
      roadmap: ["资金用途", "18个月里程碑", "核心招聘", "下一轮准备"],
    };
  }
  const scenes = [
    { kind: "pain", kicker: "PAIN DISCOVERY", cards: ["高频场景", "强烈付费意愿", "替代方案低效", "决策链清晰"] },
    { kind: "mvp", kicker: "MVP VALIDATION", cards: ["核心路径", "首批客户", "体验指标"] },
    { kind: "traction", kicker: "EARLY TRACTION", metrics: [{ label: "M1" }, { label: "M2" }, { label: "M3" }] },
    { kind: "team", kicker: "WHY THIS TEAM", cards: ["行业洞察", "产品交付", "增长经验"] },
  ];
  return { ...scenes[Math.min(index - 1, scenes.length - 1)], insights };
}

function seedRoundStoryBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["真实用户痛点已经被反复验证", "MVP 形成稳定可复用的产品路径", "早期增长信号支持种子轮融资"];
}

function seedRoundStorySceneSummary(scene) {
  if (scene.kind === "cover") return "用真实用户问题、MVP 验证和早期信号建立投资人信任";
  if (scene.kind === "pain") return "把创始团队看到的问题转成可验证的用户证据";
  if (scene.kind === "mvp") return "用最小可行产品证明关键假设已经被用户理解";
  if (scene.kind === "traction") return "展示早期用户、留存、转介绍和复购意向等可信信号";
  if (scene.kind === "team") return "说明团队为什么适合解决这个问题";
  return "把融资金额、资金用途和下一阶段验证目标放在同一条路径上";
}

function seedRoundStoryCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, "");
  if (Array.from(value).length <= maxLength) return value;
  return Array.from(value).slice(0, maxLength).join("");
}

function seedRoundStoryReadableText(text, maxLength) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}…`;
}

function isSeedRoundStoryVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "seed-round-story" && (id === "seed-round-pitch" || id === "pitch-seed-round-pitch-startup-story");
}

function businessModelBpDecorationsXml({ visual, index, layout }) {
  const scene = businessModelBpScene(index);
  const palette = businessModelBpColorPalette(visual);
  const base = solidShapeXml({ id: 820, name: "Business Model BP Canvas", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + solidShapeXml({ id: 821, name: "Business Model BP Paper", x: 411480, y: 365760, cx: 8321040, cy: 4411980, fill: visual.surface })
    + lineFrameShapeXml({ id: 822, name: "Business Model BP Paper Frame", x: 411480, y: 365760, cx: 8321040, cy: 4411980, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 823, name: "Business Model BP Accent Rule", x: 411480, y: 365760, cx: 8321040, cy: 76200, fill: visual.accent })
    + rectShapeXml({ id: 824, name: "Business Model BP Gold Rule", x: 4267200, y: 365760, cx: 1600200, cy: 76200, fill: palette.gold })
    + textShapeXml({ id: 825, name: "Business Model BP Kicker", ...layout.label, text: scene.kicker, size: 720, bold: true, color: visual.accent });
  if (index === 0) {
    return base
      + businessModelBpMockupXml({ visual, palette })
      + businessModelBpMetricCardsXml({ visual, palette, metrics: scene.metrics });
  }
  if (scene.role === "canvas") {
    return base + businessModelBpCanvasGridXml({ visual, palette, labels: scene.canvas });
  }
  if (scene.role === "ecosystem") {
    return base + businessModelBpEcosystemXml({ visual, palette, nodes: scene.nodes });
  }
  return base
    + businessModelBpRevenueFlowXml({ visual, palette, flow: scene.flow })
    + businessModelBpSideCardsXml({ visual, palette, cards: scene.cards });
}

function businessModelBpMockupXml({ visual, palette }) {
  return solidShapeXml({ id: 830, name: "Business Model Product Mockup", geom: "roundRect", x: 5715000, y: 1143000, cx: 2743200, cy: 1828800, fill: palette.panel })
    + lineFrameShapeXml({ id: 831, name: "Business Model Product Frame", geom: "roundRect", x: 5715000, y: 1143000, cx: 2743200, cy: 1828800, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 832, name: "Business Model Mockup Header", x: 5943600, y: 1371600, cx: 1828800, cy: 91440, fill: visual.primary })
    + rectShapeXml({ id: 833, name: "Business Model Mockup Growth Line", x: 5943600, y: 2209800, cx: 2133600, cy: 60960, fill: visual.accent })
    + solidShapeXml({ id: 834, name: "Business Model Mockup Revenue Block", geom: "roundRect", x: 6019800, y: 2468880, cx: 609600, cy: 457200, fill: palette.soft })
    + solidShapeXml({ id: 835, name: "Business Model Mockup Cost Block", geom: "roundRect", x: 6781800, y: 2468880, cx: 609600, cy: 457200, fill: palette.goldSoft })
    + solidShapeXml({ id: 836, name: "Business Model Mockup Profit Block", geom: "roundRect", x: 7543800, y: 2468880, cx: 609600, cy: 457200, fill: visual.accent });
}

function businessModelBpMetricCardsXml({ visual, palette, metrics }) {
  return metrics.map((metric, index) => {
    const x = 731520 + index * 2590800;
    return solidShapeXml({ id: 840 + index * 3, name: `Business Model Metric Card ${index + 1}`, geom: "roundRect", x, y: 3810000, cx: 2286000, cy: 640080, fill: index === 1 ? palette.soft : visual.surface })
      + textShapeXml({ id: 841 + index * 3, name: `Business Model Metric Value ${index + 1}`, x: x + 182880, y: 3924300, cx: 914400, cy: 182880, text: metric.value, size: 1280, bold: true, color: visual.title })
      + textShapeXml({ id: 842 + index * 3, name: `Business Model Metric Label ${index + 1}`, x: x + 182880, y: 4145280, cx: 1676400, cy: 152400, text: metric.label, size: 720, bold: true, color: visual.body });
  }).join("");
}

function businessModelBpCanvasGridXml({ visual, palette, labels }) {
  return labels.map((label, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 731520 + col * 2560320;
    const y = 1371600 + row * 822960;
    const wide = index === 5;
    return solidShapeXml({ id: 860 + index * 3, name: `Business Canvas Cell ${index + 1}`, geom: "roundRect", x, y, cx: wide ? 2438400 : 2286000, cy: 670560, fill: index === 1 ? palette.soft : visual.surface })
      + rectShapeXml({ id: 861 + index * 3, name: `Business Canvas Rule ${index + 1}`, x: x + 152400, y: y + 487680, cx: 457200, cy: 38100, fill: index === 5 ? palette.gold : visual.accent })
      + textShapeXml({ id: 862 + index * 3, name: `Business Canvas Label ${index + 1}`, x: x + 152400, y: y + 121920, cx: 1828800, cy: 213360, text: label, size: 820, bold: true, color: visual.title });
  }).join("");
}

function businessModelBpRevenueFlowXml({ visual, palette, flow }) {
  return flow.map((item, index) => {
    const x = 792480 + index * 1600200;
    const connector = index < flow.length - 1
      ? rectShapeXml({ id: 901 + index * 4, name: `Business Revenue Connector ${index + 1}`, x: x + 1188720, y: 2004060, cx: 304800, cy: 30480, fill: visual.accent })
      : "";
    return solidShapeXml({ id: 900 + index * 4, name: `Business Revenue Step ${index + 1}`, geom: "roundRect", x, y: 1775460, cx: 1219200, cy: 548640, fill: index === 2 ? palette.soft : visual.surface })
      + connector
      + textShapeXml({ id: 902 + index * 4, name: `Business Revenue Step Text ${index + 1}`, x: x + 152400, y: 1943100, cx: 914400, cy: 152400, text: item, size: 760, bold: true, color: visual.title });
  }).join("");
}

function businessModelBpSideCardsXml({ visual, palette, cards }) {
  return cards.map((card, index) => {
    const x = 914400 + index * 2438400;
    return solidShapeXml({ id: 930 + index * 3, name: `Business Model Side Card ${index + 1}`, geom: "roundRect", x, y: 3200400, cx: 2133600, cy: 685800, fill: visual.surface })
      + rectShapeXml({ id: 931 + index * 3, name: `Business Model Side Card Rule ${index + 1}`, x: x + 152400, y: 3375660, cx: 609600, cy: 38100, fill: index === 1 ? palette.gold : visual.accent })
      + textShapeXml({ id: 932 + index * 3, name: `Business Model Side Card Text ${index + 1}`, x: x + 152400, y: 3573780, cx: 1828800, cy: 152400, text: card, size: 760, bold: true, color: visual.title });
  }).join("");
}

function businessModelBpEcosystemXml({ visual, palette, nodes }) {
  const centerX = 6858000;
  const centerY = 2438400;
  const nodePositions = [
    { x: 6446520, y: 1219200 },
    { x: 7650480, y: 2133600 },
    { x: 6446520, y: 3352800 },
    { x: 5242560, y: 2133600 },
  ];
  return solidShapeXml({ id: 960, name: "Business Ecosystem Orbit", geom: "ellipse", x: 5334000, y: 1143000, cx: 3048000, cy: 2743200, fill: palette.orbit })
    + solidShapeXml({ id: 961, name: "Business Ecosystem Platform", geom: "ellipse", x: centerX - 457200, y: centerY - 457200, cx: 914400, cy: 914400, fill: visual.primary })
    + textShapeXml({ id: 962, name: "Business Ecosystem Platform Text", x: centerX - 304800, y: centerY - 91440, cx: 609600, cy: 182880, text: "平台", size: 800, bold: true, color: "FFFFFF" })
    + nodes.map((node, index) => {
      const pos = nodePositions[index];
      return solidShapeXml({ id: 970 + index * 2, name: `Business Ecosystem Node ${index + 1}`, geom: "roundRect", x: pos.x, y: pos.y, cx: 822960, cy: 365760, fill: visual.surface })
        + textShapeXml({ id: 971 + index * 2, name: `Business Ecosystem Node Text ${index + 1}`, x: pos.x + 91440, y: pos.y + 91440, cx: 640080, cy: 152400, text: node, size: 700, bold: true, color: visual.title });
    }).join("");
}

function businessModelBpColorPalette(visual) {
  return {
    frame: blendHexColor(visual.primary, visual.background, 0.72),
    gold: visual.secondary || "D6A84F",
    goldSoft: blendHexColor(visual.secondary || "D6A84F", visual.surface, 0.70),
    orbit: blendHexColor(visual.accent, visual.background, 0.78),
    panel: blendHexColor(visual.surface, visual.background, 0.18),
    soft: blendHexColor(visual.accent, visual.surface, 0.78),
  };
}

function businessModelBpScene(index) {
  if (index === 0) {
    return {
      role: "cover",
      kicker: "INVESTOR BUSINESS CASE",
      metrics: [
        { value: "客户", label: "目标人群" },
        { value: "收入", label: "变现路径" },
        { value: "增长", label: "规模化逻辑" },
      ],
    };
  }
  if (index === 3 || index % 4 === 0) {
    return {
      role: "ecosystem",
      kicker: "CAPITAL & ECOSYSTEM",
      nodes: ["客户", "渠道", "数据", "伙伴"],
    };
  }
  if (index % 3 === 1) {
    return {
      role: "canvas",
      kicker: "BUSINESS CANVAS",
      canvas: ["客户群体", "价值主张", "渠道路径", "关键资源", "收入来源", "成本结构", "合作伙伴"],
    };
  }
  return {
    role: "revenue",
    kicker: "REVENUE LOOP",
    flow: ["获客", "转化", "付费", "复购", "扩张"],
    cards: ["收入结构", "成本结构", "利润机制"],
  };
}

function isBusinessModelBpVisual(visual) {
  return ["business-plan", "pitch-business-plan-business-model"].includes(visual?.id) && visual?.layout === "business-model-bp";
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

function launchRhythmDecorationsXml({ visual, index, role, slide }) {
  const scene = launchRhythmSceneFromSlide({ slide, index, role });
  const palette = launchRhythmColorPalette(visual);
  // 深色发布会背景、光斑和网格全部用可编辑形状绘制，避免导出后退化成图片底图。
  const backdrop = rectShapeXml({ id: 980, name: "Launch Rhythm Dark Stage Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 981, name: "Launch Rhythm Orange Spotlight", geom: "ellipse", x: 6553200, y: -365760, cx: 2057400, cy: 2057400, fill: palette.orangeGlow })
    + solidShapeXml({ id: 982, name: "Launch Rhythm Purple Glow", geom: "ellipse", x: 365760, y: 3505200, cx: 1905000, cy: 1295400, fill: palette.purpleGlow })
    + solidShapeXml({ id: 983, name: "Launch Rhythm Stage Beam", geom: "trapezoid", x: 5905500, y: 762000, cx: 2438400, cy: 3048000, fill: palette.beam });
  const header = textShapeXml({ id: 984, name: "Launch Rhythm Kicker", x: 804672, y: 701040, cx: 2133600, cy: 274320, text: scene.kicker, size: 780, bold: true, color: palette.cyan })
    + rectShapeXml({ id: 985, name: "Launch Rhythm Focus Rule", x: 804672, y: index === 0 ? 2230120 : 2057400, cx: 3200400, cy: 30480, fill: visual.accent });
  const bullets = launchRhythmBulletCardsXml({ scene, isCover: index === 0 });
  if (scene.role === "timeline") return backdrop + header + bullets + launchRhythmTimelineXml({ scene, palette });
  if (scene.role === "channel" || scene.role === "selling-points") return backdrop + header + bullets + launchRhythmChannelGridXml({ scene, palette });
  if (scene.role === "kpi") return backdrop + header + bullets + launchRhythmKpiXml({ scene, palette, visual });
  if (scene.role === "closing") return backdrop + header + bullets + launchRhythmClosingXml({ scene, palette });
  return backdrop + header + bullets + launchRhythmStageXml({ palette, visual }) + launchRhythmCoverTagsXml({ palette, visual });
}

function launchRhythmStageXml({ palette, visual }) {
  return textShapeXml({ id: 990, name: "Launch Rhythm Countdown", x: 804672, y: 3467100, cx: 1066800, cy: 579120, text: "T-7", size: 3000, bold: true, color: visual.accent })
    + lineFrameShapeXml({ id: 991, name: "Launch Rhythm Stage Platform", geom: "trapezoid", x: 5943600, y: 2514600, cx: 1828800, cy: 914400, stroke: palette.cyan, width: 25400 })
    + solidShapeXml({ id: 992, name: "Launch Rhythm Product Mockup", geom: "roundRect", x: 6355080, y: 1371600, cx: 944880, cy: 640080, fill: palette.glass })
    + lineFrameShapeXml({ id: 993, name: "Launch Rhythm Product Mockup Border", geom: "roundRect", x: 6355080, y: 1371600, cx: 944880, cy: 640080, stroke: "FFFFFF", width: 10160, transparency: 54000 })
    + solidShapeXml({ id: 994, name: "Launch Rhythm Center Light", geom: "ellipse", x: 6804660, y: 838200, cx: 137160, cy: 137160, fill: visual.accent })
    + rectShapeXml({ id: 995, name: "Launch Rhythm Light Stem", x: 6865620, y: 960120, cx: 30480, cy: 396240, fill: visual.accent })
    + lineFrameShapeXml({ id: 996, name: "Launch Rhythm Purple Beam", geom: "line", x: 5334000, y: 1188720, cx: 1021080, cy: 670560, stroke: palette.purple, width: 30480 })
    + lineFrameShapeXml({ id: 997, name: "Launch Rhythm Cyan Beam", geom: "line", x: 7277100, y: 1188720, cx: 1021080, cy: -670560, stroke: palette.cyan, width: 30480 });
}

function launchRhythmCoverTagsXml({ palette }) {
  return ["预热", "首发", "转化"].map((item, index) => {
    const x = 804672 + index * 914400;
    return solidShapeXml({ id: 1000 + index * 3, name: `Launch Rhythm Tag Card ${index + 1}`, geom: "roundRect", x, y: 4130040, cx: 716280, cy: 320040, fill: palette.glass })
      + lineFrameShapeXml({ id: 1001 + index * 3, name: `Launch Rhythm Tag Border ${index + 1}`, geom: "roundRect", x, y: 4130040, cx: 716280, cy: 320040, stroke: "FFFFFF", width: 10160, transparency: 66000 })
      + textShapeXml({ id: 1002 + index * 3, name: `Launch Rhythm Tag Text ${index + 1}`, x: x + 137160, y: 4213860, cx: 441960, cy: 137160, text: item, size: 640, bold: true, color: "FFFFFF" });
  }).join("");
}

function launchRhythmBulletCardsXml({ scene, isCover }) {
  const items = scene.bullets.slice(0, isCover ? 3 : 4);
  return items.map((item, index) => {
    const y = (isCover ? 2545080 : 1828800) + index * 236220;
    return rectShapeXml({ id: 1020 + index * 2, name: `Launch Rhythm Bullet Rule ${index + 1}`, x: 804672, y: y + 30480, cx: 45720, cy: 137160, fill: "FF5A3D" })
      + textShapeXml({ id: 1021 + index * 2, name: `Launch Rhythm Bullet Text ${index + 1}`, x: 975360, y, cx: 3444240, cy: 198120, text: launchRhythmCompactText(item, scene.title, 32), size: isCover ? 780 : 700, bold: false, color: "D7DEE8" });
  }).join("");
}

function launchRhythmTimelineXml({ scene, palette }) {
  return scene.timeline.map((item, index) => {
    const x = 804672 + index * 1280160;
    return solidShapeXml({ id: 1040 + index * 3, name: `Launch Rhythm Timeline Card ${index + 1}`, geom: "roundRect", x, y: 3718560, cx: 1066800, cy: 701040, fill: palette.glass })
      + lineFrameShapeXml({ id: 1041 + index * 3, name: `Launch Rhythm Timeline Border ${index + 1}`, geom: "roundRect", x, y: 3718560, cx: 1066800, cy: 701040, stroke: "FFFFFF", width: 10160, transparency: 68000 })
      + textShapeXml({ id: 1042 + index * 3, name: `Launch Rhythm Timeline Text ${index + 1}`, x: x + 106680, y: 3848100, cx: 853440, cy: 274320, text: `${item.step}\n${launchRhythmCompactText(item.text, "", 10)}`, size: 660, bold: true, color: index === 4 ? "FF5A3D" : "FFFFFF" });
  }).join("");
}

function launchRhythmChannelGridXml({ scene, palette }) {
  return scene.cards.slice(0, 4).map((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5577840 + col * 1447800;
    const y = 1257300 + row * 990600;
    return solidShapeXml({ id: 1070 + index * 4, name: `Launch Rhythm Channel Card ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 792480, fill: palette.glass })
      + lineFrameShapeXml({ id: 1071 + index * 4, name: `Launch Rhythm Channel Border ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 792480, stroke: "FFFFFF", width: 10160, transparency: 68000 })
      + rectShapeXml({ id: 1072 + index * 4, name: `Launch Rhythm Channel Accent ${index + 1}`, x: x + 152400, y: y + 518160, cx: 365760, cy: 30480, fill: index === 1 ? palette.cyan : "FF5A3D" })
      + textShapeXml({ id: 1073 + index * 4, name: `Launch Rhythm Channel Text ${index + 1}`, x: x + 152400, y: y + 213360, cx: 914400, cy: 182880, text: launchRhythmCompactText(item, "", 10), size: 720, bold: true, color: "FFFFFF" });
  }).join("");
}

function launchRhythmKpiXml({ scene, palette, visual }) {
  const panel = solidShapeXml({ id: 1100, name: "Launch Rhythm KPI Panel", geom: "roundRect", x: 5577840, y: 1188720, cx: 2743200, cy: 2286000, fill: palette.glass })
    + lineFrameShapeXml({ id: 1101, name: "Launch Rhythm KPI Panel Border", geom: "roundRect", x: 5577840, y: 1188720, cx: 2743200, cy: 2286000, stroke: "FFFFFF", width: 10160, transparency: 68000 })
    + rectShapeXml({ id: 1102, name: "Launch Rhythm KPI Bar 1", x: 5943600, y: 2827020, cx: 259080, cy: 518160, fill: visual.accent })
    + rectShapeXml({ id: 1103, name: "Launch Rhythm KPI Bar 2", x: 6400800, y: 2514600, cx: 259080, cy: 830580, fill: palette.purple })
    + rectShapeXml({ id: 1104, name: "Launch Rhythm KPI Bar 3", x: 6858000, y: 2179320, cx: 259080, cy: 1165860, fill: visual.accent })
    + rectShapeXml({ id: 1105, name: "Launch Rhythm KPI Bar 4", x: 7315200, y: 2392680, cx: 259080, cy: 952500, fill: palette.cyan });
  const cards = scene.cards.slice(0, 3).map((item, index) => {
    const x = 804672 + index * 1280160;
    return solidShapeXml({ id: 1110 + index * 3, name: `Launch Rhythm KPI Card ${index + 1}`, geom: "roundRect", x, y: 3764280, cx: 1066800, cy: 594360, fill: palette.glass })
      + lineFrameShapeXml({ id: 1111 + index * 3, name: `Launch Rhythm KPI Card Border ${index + 1}`, geom: "roundRect", x, y: 3764280, cx: 1066800, cy: 594360, stroke: "FFFFFF", width: 10160, transparency: 68000 })
      + textShapeXml({ id: 1112 + index * 3, name: `Launch Rhythm KPI Card Text ${index + 1}`, x: x + 121920, y: 3947160, cx: 822960, cy: 182880, text: launchRhythmCompactText(item, "", 10), size: 660, bold: true, color: "FFFFFF" });
  }).join("");
  return panel + cards;
}

function launchRhythmClosingXml({ scene, palette }) {
  return scene.cards.slice(0, 3).map((item, index) => {
    const x = 975360 + index * 2286000;
    return solidShapeXml({ id: 1140 + index * 4, name: `Launch Rhythm Closing Card ${index + 1}`, geom: "roundRect", x, y: 2926080, cx: 1828800, cy: 914400, fill: palette.glass })
      + lineFrameShapeXml({ id: 1141 + index * 4, name: `Launch Rhythm Closing Border ${index + 1}`, geom: "roundRect", x, y: 2926080, cx: 1828800, cy: 914400, stroke: "FFFFFF", width: 10160, transparency: 68000 })
      + rectShapeXml({ id: 1142 + index * 4, name: `Launch Rhythm Closing Accent ${index + 1}`, x: x + 182880, y: 3215640, cx: 365760, cy: 30480, fill: index === 1 ? palette.cyan : "FF5A3D" })
      + textShapeXml({ id: 1143 + index * 4, name: `Launch Rhythm Closing Text ${index + 1}`, x: x + 182880, y: 3329940, cx: 1371600, cy: 243840, text: launchRhythmCompactText(item, "", 14), size: 760, bold: true, color: "FFFFFF" });
  }).join("");
}

function launchRhythmSceneFromSlide({ slide, index, role }) {
  const bullets = launchRhythmBulletTexts(slide);
  const title = launchRhythmCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const sceneRole = index === 0 ? "cover" : role === "closing" ? "closing" : String(role || "").includes("timeline") ? "timeline" : String(role || "").includes("channel") ? "channel" : String(role || "").includes("kpi") ? "kpi" : String(role || "").includes("selling") ? "selling-points" : ["timeline", "channel", "kpi", "selling-points"][(index - 1) % 4];
  const timeline = ["T-30", "T-14", "T-7", "T-1", "Launch", "T+7"].map((step, itemIndex) => ({
    step,
    text: launchRhythmCompactText(bullets[itemIndex], ["预热启动", "内容种草", "渠道蓄水", "发布准备", "首发上线", "复盘增长"][itemIndex], 10),
  }));
  const cards = ["产品卖点", "渠道动作", "转化目标", "复盘增长"].map((fallback, itemIndex) => launchRhythmCompactText(bullets[itemIndex], fallback, 10));
  return {
    role: sceneRole,
    kicker: sceneRole === "cover" ? "LAUNCH RHYTHM" : sceneRole === "timeline" ? "T-MINUS TIMELINE" : sceneRole === "channel" ? "CHANNEL WARM-UP" : sceneRole === "kpi" ? "LAUNCH KPI" : "NEXT WAVE",
    title,
    bullets,
    timeline,
    cards,
  };
}

function launchRhythmBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["新品核心卖点与上市目标", "发布前预热与渠道蓄水", "首发转化 KPI 与复盘动作"];
}

function launchRhythmCompactText(text, fallback, maxLength) {
  const raw = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(1, maxLength - 1))}…`;
}

function launchRhythmColorPalette(visual) {
  return {
    backdrop: visual.background,
    orangeGlow: blendHexColor(visual.accent, visual.background, 0.66),
    purpleGlow: blendHexColor("7C3AED", visual.background, 0.72),
    beam: blendHexColor("FFFFFF", visual.background, 0.90),
    glass: blendHexColor("FFFFFF", visual.background, 0.88),
    cyan: "22D3EE",
    purple: "7C3AED",
  };
}

function isLaunchRhythmVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "marketing-launch-rhythm" && (id === "new-product-launch" || id === "marketing-new-product-launch-launch-rhythm");
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

function biExecutiveCockpitDecorationsXml({ visual, index, role, slide }) {
  const scene = biExecutiveCockpitScene({ slide, index, role });
  const palette = biCockpitColorPalette(visual);
  const isCover = index === 0;
  const base = solidShapeXml({ id: 1200, name: "BI Cockpit Dark Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + biCockpitGridXml({ visual, palette })
    + solidShapeXml({ id: 1201, name: "BI Cockpit Main Console", geom: "roundRect", x: 438912, y: 411480, cx: 8266176, cy: 4373880, fill: palette.console })
    + lineFrameShapeXml({ id: 1202, name: "BI Cockpit Console Frame", geom: "roundRect", x: 438912, y: 411480, cx: 8266176, cy: 4373880, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1203, name: "BI Cockpit Neon Header", x: 438912, y: 411480, cx: 5181600, cy: 45720, fill: visual.accent })
    + rectShapeXml({ id: 1204, name: "BI Cockpit Lime Pulse", x: 5334000, y: 411480, cx: 1524000, cy: 45720, fill: palette.lime })
    + textShapeXml({ id: 1205, name: "BI Cockpit Section Kicker", x: 731520, y: 670560, cx: 2438400, cy: 198120, text: scene.kicker, size: 760, bold: true, color: visual.accent });
  const visualPanel = scene.role === "trend"
    ? biCockpitTrendPanelXml({ visual, palette })
    : scene.role === "distribution"
      ? biCockpitRankingPanelXml({ visual, palette, cards: scene.cards })
      : scene.role === "alert"
        ? biCockpitAlertPanelXml({ visual, palette, cards: scene.cards })
        : scene.role === "closing"
          ? biCockpitActionCardsXml({ visual, palette, cards: scene.cards })
          : biCockpitGaugePanelXml({ visual, palette });
  return base
    + visualPanel
    + (scene.role !== "closing" ? biCockpitMetricCardsXml({ visual, palette, metrics: scene.metrics, isCover }) : "")
    + biCockpitBulletCardsXml({ visual, palette, bullets: scene.bullets });
}

function biCockpitGridXml({ visual, palette }) {
  const vertical = [0, 1, 2, 3, 4, 5].map((itemIndex) => rectShapeXml({ id: 1210 + itemIndex, name: `BI Cockpit Vertical Grid ${itemIndex + 1}`, x: 914400 + itemIndex * 1219200, y: 609600, cx: 7620, cy: 3962400, fill: palette.grid })).join("");
  const horizontal = [0, 1, 2, 3].map((itemIndex) => rectShapeXml({ id: 1220 + itemIndex, name: `BI Cockpit Horizontal Grid ${itemIndex + 1}`, x: 609600, y: 1066800 + itemIndex * 762000, cx: 7924800, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal
    + solidShapeXml({ id: 1228, name: "BI Cockpit Cyan Glow", geom: "ellipse", x: 6553200, y: 365760, cx: 1676400, cy: 1676400, fill: palette.glow })
    + solidShapeXml({ id: 1229, name: "BI Cockpit Lime Glow", geom: "ellipse", x: 304800, y: 3581400, cx: 1219200, cy: 1219200, fill: blendHexColor(visual.secondary || "A3E635", visual.background, 0.78) });
}

function biCockpitGaugePanelXml({ visual, palette }) {
  return solidShapeXml({ id: 1230, name: "BI Cockpit Gauge Panel", geom: "roundRect", x: 5715000, y: 1165860, cx: 2667000, cy: 1905000, fill: palette.panel })
    + lineFrameShapeXml({ id: 1231, name: "BI Cockpit Gauge Frame", geom: "roundRect", x: 5715000, y: 1165860, cx: 2667000, cy: 1905000, stroke: palette.frame, width: 11430 })
    + arcLineShapeXml({ id: 1232, name: "BI Cockpit Gauge Arc", x: 6096000, y: 1546860, cx: 1905000, cy: 1219200, stroke: visual.accent, width: 53340 })
    + arcLineShapeXml({ id: 1233, name: "BI Cockpit Gauge Lime Arc", x: 6324600, y: 1623060, cx: 1447800, cy: 914400, stroke: palette.lime, width: 30480 })
    + rectShapeXml({ id: 1234, name: "BI Cockpit Gauge Needle", x: 6934200, y: 2225040, cx: 914400, cy: 45720, fill: palette.lime })
    + solidShapeXml({ id: 1235, name: "BI Cockpit Gauge Center", geom: "ellipse", x: 6858000, y: 2156460, cx: 182880, cy: 182880, fill: visual.title })
    + [0, 1, 2, 3].map((itemIndex) => solidShapeXml({ id: 1236 + itemIndex, name: `BI Cockpit Mini Bar ${itemIndex + 1}`, geom: "roundRect", x: 6096000 + itemIndex * 335280, y: 2613660 - itemIndex * 121920, cx: 137160, cy: 335280 + itemIndex * 121920, fill: itemIndex % 2 ? palette.lime : visual.accent })).join("");
}

function biCockpitTrendPanelXml({ visual, palette }) {
  return solidShapeXml({ id: 1250, name: "BI Cockpit Trend Panel", geom: "roundRect", x: 5334000, y: 1165860, cx: 3200400, cy: 2057400, fill: palette.panel })
    + lineFrameShapeXml({ id: 1251, name: "BI Cockpit Trend Frame", geom: "roundRect", x: 5334000, y: 1165860, cx: 3200400, cy: 2057400, stroke: palette.frame, width: 11430 })
    + [0, 1, 2].map((itemIndex) => rectShapeXml({ id: 1252 + itemIndex, name: `BI Cockpit Trend Baseline ${itemIndex + 1}`, x: 5638800, y: 2575560 - itemIndex * 426720, cx: 2514600, cy: 15240, fill: palette.grid })).join("")
    + arcLineShapeXml({ id: 1260, name: "BI Cockpit Trend Neon Curve", x: 5638800, y: 1546860, cx: 2438400, cy: 990600, stroke: visual.accent, width: 38100 })
    + arcLineShapeXml({ id: 1261, name: "BI Cockpit Trend Lime Curve", x: 5791200, y: 1714500, cx: 2286000, cy: 762000, stroke: palette.lime, width: 30480 })
    + [0, 1, 2, 3].map((itemIndex) => solidShapeXml({ id: 1262 + itemIndex, name: `BI Cockpit Trend Dot ${itemIndex + 1}`, geom: "ellipse", x: 5867400 + itemIndex * 533400, y: 2476500 - itemIndex * 198120, cx: 121920, cy: 121920, fill: itemIndex % 2 ? palette.lime : visual.accent })).join("");
}

function biCockpitRankingPanelXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const y = 1219200 + index * 426720;
    return solidShapeXml({ id: 1280 + index * 3, name: `BI Cockpit Ranking Row ${index + 1}`, geom: "roundRect", x: 5486400, y, cx: 2895600, cy: 304800, fill: palette.panel })
      + textShapeXml({ id: 1281 + index * 3, name: `BI Cockpit Ranking Text ${index + 1}`, x: 5684520, y: y + 76200, cx: 1066800, cy: 137160, text: card, size: 720, bold: true, color: visual.title })
      + rectShapeXml({ id: 1282 + index * 3, name: `BI Cockpit Ranking Bar ${index + 1}`, x: 6964680, y: y + 121920, cx: 944880 - index * 121920, cy: 38100, fill: index === 0 ? palette.lime : visual.accent });
  }).join("");
}

function biCockpitAlertPanelXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5486400 + col * 1447800;
    const y = 1219200 + row * 914400;
    return solidShapeXml({ id: 1300 + index * 4, name: `BI Cockpit Alert Card ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 685800, fill: palette.warningPanel })
      + solidShapeXml({ id: 1301 + index * 4, name: `BI Cockpit Alert Beacon ${index + 1}`, geom: "ellipse", x: x + 152400, y: y + 121920, cx: 152400, cy: 152400, fill: index === 0 ? "F59E0B" : visual.accent })
      + textShapeXml({ id: 1302 + index * 4, name: `BI Cockpit Alert Text ${index + 1}`, x: x + 152400, y: y + 365760, cx: 914400, cy: 152400, text: card, size: 700, bold: true, color: visual.title })
      + rectShapeXml({ id: 1303 + index * 4, name: `BI Cockpit Alert Rule ${index + 1}`, x: x + 152400, y: y + 579120, cx: 762000, cy: 30480, fill: index === 0 ? "F59E0B" : visual.accent });
  }).join("");
}

function biCockpitActionCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 3).map((card, index) => {
    const x = 914400 + index * 2438400;
    return solidShapeXml({ id: 1320 + index * 3, name: `BI Cockpit Action Card ${index + 1}`, geom: "roundRect", x, y: 3200400, cx: 2133600, cy: 822960, fill: palette.panel })
      + rectShapeXml({ id: 1321 + index * 3, name: `BI Cockpit Action Rule ${index + 1}`, x: x + 152400, y: 3383280, cx: 762000, cy: 38100, fill: index === 1 ? palette.lime : visual.accent })
      + textShapeXml({ id: 1322 + index * 3, name: `BI Cockpit Action Text ${index + 1}`, x: x + 152400, y: 3634740, cx: 1676400, cy: 182880, text: card, size: 820, bold: true, color: visual.title });
  }).join("");
}

function biCockpitMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 4).map((metric, index) => {
    const x = 731520 + index * 1981200;
    return solidShapeXml({ id: 1340 + index * 4, name: `BI Cockpit KPI Card ${index + 1}`, geom: "roundRect", x, y: 3771900, cx: 1676400, cy: 609600, fill: palette.card })
      + textShapeXml({ id: 1341 + index * 4, name: `BI Cockpit KPI Value ${index + 1}`, x: x + 137160, y: 3886200, cx: 731520, cy: 182880, text: metric.value, size: 1180, bold: true, color: visual.title })
      + textShapeXml({ id: 1342 + index * 4, name: `BI Cockpit KPI Label ${index + 1}`, x: x + 137160, y: 4130040, cx: 1066800, cy: 137160, text: metric.label, size: 680, bold: true, color: visual.body })
      + rectShapeXml({ id: 1343 + index * 4, name: `BI Cockpit KPI Pulse ${index + 1}`, x: x + 137160, y: 4328160, cx: 670560 + index * 91440, cy: 30480, fill: index === 1 ? palette.lime : visual.accent });
  }).join("");
}

function biCockpitBulletCardsXml({ visual, palette, bullets }) {
  return bullets.slice(0, 3).map((bullet, index) => {
    const y = 2240280 + index * 365760;
    return solidShapeXml({ id: 1370 + index * 3, name: `BI Cockpit Insight Card ${index + 1}`, geom: "roundRect", x: 731520, y, cx: 3505200, cy: 243840, fill: palette.card })
      + solidShapeXml({ id: 1371 + index * 3, name: `BI Cockpit Insight Dot ${index + 1}`, geom: "ellipse", x: 883920, y: y + 76200, cx: 91440, cy: 91440, fill: index === 1 ? palette.lime : visual.accent })
      + textShapeXml({ id: 1372 + index * 3, name: `BI Cockpit Insight Text ${index + 1}`, x: 1066800, y: y + 60960, cx: 2895600, cy: 121920, text: biCockpitCompactText(bullet, "关键经营信号", 28), size: 700, bold: true, color: visual.body });
  }).join("");
}

function biExecutiveCockpitScene({ slide, index, role }) {
  const bullets = biCockpitBulletTexts(slide);
  const metrics = ["收入", "利润", "达成率", "风险项"].map((fallback, itemIndex) => biCockpitMetricFromText(bullets[itemIndex], fallback, itemIndex));
  const cards = ["业务排行", "区域表现", "渠道贡献", "异常波动"].map((fallback, itemIndex) => biCockpitCompactText(bullets[itemIndex], fallback, 12));
  const sceneRole = role === "closing" || index >= 5 ? "closing" : ["cover", "trend", "distribution", "alert"][Math.min(index, 3)];
  const kickerMap = {
    cover: "EXECUTIVE DATA HUB",
    trend: "TREND MONITOR",
    distribution: "BUSINESS RANKING",
    alert: "RISK SIGNAL",
    closing: "NEXT ACTIONS",
  };
  return {
    role: sceneRole,
    kicker: kickerMap[sceneRole],
    bullets,
    metrics,
    cards: sceneRole === "closing" ? ["持续增长", "风险修复", "资源投入"].map((fallback, itemIndex) => biCockpitCompactText(bullets[itemIndex], fallback, 14)) : cards,
  };
}

function biCockpitBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text || item.title || item.label || item.value || "").trim();
    return "";
  }).filter(Boolean) : [];
  return values.length ? values : ["核心经营指标保持稳定增长", "部门关键数据需要持续跟踪", "异常指标已进入管理层关注清单"];
}

function biCockpitMetricFromText(text, fallback, index) {
  const raw = String(text || "").trim();
  const match = raw.match(/([+-]?\d+(?:\.\d+)?%?|[A-Za-z]{2,}|[零一二三四五六七八九十百千万亿]+项?)/);
  const value = match?.[1] || ["KPI", "ROI", "92%", "3"][index] || "KPI";
  const label = biCockpitCompactText(raw.replace(value, "").replace(/[：:，,。]/g, " ").trim(), fallback, 8);
  return { value, label };
}

function biCockpitCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function biCockpitColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.26),
    console: blendHexColor(visual.surface, visual.background, 0.18),
    frame: blendHexColor(visual.accent, visual.surface, 0.62),
    glow: blendHexColor(visual.accent, visual.background, 0.74),
    grid: blendHexColor(visual.accent, visual.background, 0.82),
    lime: visual.secondary || "A3E635",
    panel: blendHexColor(visual.surface, visual.background, 0.08),
    warningPanel: blendHexColor("F59E0B", visual.surface, 0.84),
  };
}

function userPathFunnelDecorationsXml({ visual, index, role, slide }) {
  const scene = userPathFunnelScene({ slide, index, role });
  const palette = userPathFunnelColorPalette(visual);
  // 路径漏斗模板用代码绘制节点、漏斗和实验卡，保证下载后每个元素都可以继续编辑。
  const base = rectShapeXml({ id: 1500, name: "User Path Workbench Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + userPathGridXml({ palette })
    + solidShapeXml({ id: 1501, name: "User Path Analysis Canvas", geom: "roundRect", x: 530352, y: 462280, cx: 8083296, cy: 4213860, fill: visual.surface })
    + lineFrameShapeXml({ id: 1502, name: "User Path Canvas Frame", geom: "roundRect", x: 530352, y: 462280, cx: 8083296, cy: 4213860, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 1503, name: "User Path Header Band", x: 0, y: 0, cx: 9144000, cy: 365760, fill: visual.primary })
    + rectShapeXml({ id: 1504, name: "User Path Header Accent", x: 0, y: 365760, cx: 9144000, cy: 30480, fill: visual.accent })
    + textShapeXml({ id: 1505, name: "User Path Kicker", x: 768096, y: 701040, cx: 2438400, cy: 198120, text: scene.kicker, size: 720, bold: true, color: visual.accent })
    + rectShapeXml({ id: 1506, name: "User Path Insight Rule", x: 768096, y: 2235200, cx: 3200400, cy: 30480, fill: visual.accent });
  const mainVisual = scene.kind === "funnel"
    ? userPathFunnelBarsXml({ visual, palette, steps: scene.steps })
    : scene.kind === "experiment"
      ? userPathExperimentCardsXml({ visual, palette, cards: scene.cards })
      : scene.kind === "actions"
        ? userPathActionCardsXml({ visual, palette, cards: scene.cards })
        : userPathMapXml({ visual, palette });
  return base
    + mainVisual
    + (scene.kind !== "actions" ? userPathMetricCardsXml({ visual, palette, metrics: scene.metrics }) : "")
    + userPathBulletCardsXml({ visual, palette, bullets: scene.bullets });
}

function userPathGridXml({ palette }) {
  const vertical = [0, 1, 2, 3, 4, 5].map((itemIndex) => rectShapeXml({ id: 1510 + itemIndex, name: `User Path Vertical Grid ${itemIndex + 1}`, x: 762000 + itemIndex * 1371600, y: 609600, cx: 7620, cy: 3962400, fill: palette.grid })).join("");
  const horizontal = [0, 1, 2, 3].map((itemIndex) => rectShapeXml({ id: 1520 + itemIndex, name: `User Path Horizontal Grid ${itemIndex + 1}`, x: 609600, y: 1066800 + itemIndex * 762000, cx: 7924800, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal;
}

function userPathMapXml({ visual, palette }) {
  const nodeXs = [5715000, 6256020, 6804660, 7353300];
  const nodeYs = [2697480, 2301240, 2468880, 1973580];
  const lines = nodeXs.slice(0, -1).map((x, index) => rectShapeXml({ id: 1530 + index, name: `User Path Connector ${index + 1}`, x: x + 182880, y: nodeYs[index] + 76200, cx: 426720, cy: 45720, fill: index === 1 ? visual.secondary || "22C55E" : visual.accent })).join("");
  const nodes = nodeXs.map((x, index) => solidShapeXml({ id: 1540 + index * 3, name: `User Path Node ${index + 1}`, geom: "ellipse", x, y: nodeYs[index], cx: 304800, cy: 304800, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1541 + index * 3, name: `User Path Node Frame ${index + 1}`, geom: "ellipse", x, y: nodeYs[index], cx: 304800, cy: 304800, stroke: index === 3 ? palette.warning : visual.accent, width: 25400 })
    + solidShapeXml({ id: 1542 + index * 3, name: `User Path Node Glow ${index + 1}`, geom: "ellipse", x: x - 45720, y: nodeYs[index] - 45720, cx: 396240, cy: 396240, fill: index === 3 ? palette.warningGlow : palette.glow })).join("");
  return solidShapeXml({ id: 1528, name: "User Path Route Panel", geom: "roundRect", x: 5334000, y: 1165860, cx: 3200400, cy: 2057400, fill: palette.panel })
    + lineFrameShapeXml({ id: 1529, name: "User Path Route Frame", geom: "roundRect", x: 5334000, y: 1165860, cx: 3200400, cy: 2057400, stroke: palette.frame, width: 11430 })
    + lines
    + nodes;
}

function userPathFunnelBarsXml({ visual, palette, steps }) {
  const widths = [2438400, 2057400, 1600200, 1066800];
  return steps.slice(0, 4).map((step, index) => {
    const x = 5486400 + index * 152400;
    const y = 1219200 + index * 426720;
    const fill = index === 0 ? visual.primary : index === 1 ? visual.accent : index === 2 ? visual.secondary || "22C55E" : palette.warning;
    return solidShapeXml({ id: 1570 + index * 4, name: `User Path Funnel Step ${index + 1}`, geom: "roundRect", x, y, cx: widths[index], cy: 304800, fill })
      + textShapeXml({ id: 1571 + index * 4, name: `User Path Funnel Label ${index + 1}`, x: x + 152400, y: y + 76200, cx: 914400, cy: 137160, text: step.label, size: 700, bold: true, color: "FFFFFF" })
      + textShapeXml({ id: 1572 + index * 4, name: `User Path Funnel Value ${index + 1}`, x: x + widths[index] - 670560, y: y + 76200, cx: 457200, cy: 137160, text: step.value, size: 760, bold: true, color: "FFFFFF" })
      + rectShapeXml({ id: 1573 + index * 4, name: `User Path Funnel Shine ${index + 1}`, x: x + 152400, y: y + 228600, cx: Math.max(304800, widths[index] - 609600), cy: 22860, fill: palette.shine });
  }).join("");
}

function userPathExperimentCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5486400 + col * 1447800;
    const y = 1219200 + row * 914400;
    return solidShapeXml({ id: 1600 + index * 4, name: `User Path Experiment Card ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 685800, fill: index === 0 ? palette.cardAccent : "FFFFFF" })
      + lineFrameShapeXml({ id: 1601 + index * 4, name: `User Path Experiment Frame ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 685800, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 1602 + index * 4, name: `User Path Experiment Rule ${index + 1}`, x: x + 152400, y: y + 152400, cx: 609600, cy: 45720, fill: index === 2 ? visual.secondary || "22C55E" : visual.accent })
      + textShapeXml({ id: 1603 + index * 4, name: `User Path Experiment Text ${index + 1}`, x: x + 152400, y: y + 350520, cx: 914400, cy: 152400, text: card, size: 720, bold: true, color: visual.title });
  }).join("");
}

function userPathActionCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const x = 914400 + index * 1905000;
    return solidShapeXml({ id: 1630 + index * 3, name: `User Path Action Card ${index + 1}`, geom: "roundRect", x, y: 3352800, cx: 1676400, cy: 701040, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 1631 + index * 3, name: `User Path Action Frame ${index + 1}`, geom: "roundRect", x, y: 3352800, cx: 1676400, cy: 701040, stroke: palette.frame, width: 10160 })
      + textShapeXml({ id: 1632 + index * 3, name: `User Path Action Text ${index + 1}`, x: x + 152400, y: 3627120, cx: 1219200, cy: 167640, text: card, size: 820, bold: true, color: visual.title });
  }).join("");
}

function userPathMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 3).map((metric, index) => {
    const x = 768096 + index * 1219200;
    return solidShapeXml({ id: 1660 + index * 4, name: `User Path Metric Card ${index + 1}`, geom: "roundRect", x, y: 3893820, cx: 1005840, cy: 548640, fill: "FFFFFF" })
      + rectShapeXml({ id: 1661 + index * 4, name: `User Path Metric Accent ${index + 1}`, x, y: 3893820, cx: 1005840, cy: 45720, fill: index === 2 ? palette.warning : visual.accent })
      + textShapeXml({ id: 1662 + index * 4, name: `User Path Metric Value ${index + 1}`, x: x + 121920, y: 4015740, cx: 609600, cy: 167640, text: metric.value, size: 1040, bold: true, color: visual.title })
      + textShapeXml({ id: 1663 + index * 4, name: `User Path Metric Label ${index + 1}`, x: x + 121920, y: 4236720, cx: 762000, cy: 121920, text: metric.label, size: 620, bold: true, color: visual.body });
  }).join("");
}

function userPathBulletCardsXml({ visual, palette, bullets }) {
  return bullets.slice(0, 3).map((bullet, index) => {
    const y = 2514600 + index * 289560;
    return solidShapeXml({ id: 1690 + index * 3, name: `User Path Insight Row ${index + 1}`, geom: "roundRect", x: 853440, y, cx: 3505200, cy: 213360, fill: palette.card })
      + solidShapeXml({ id: 1691 + index * 3, name: `User Path Insight Dot ${index + 1}`, geom: "ellipse", x: 1005840, y: y + 68580, cx: 76200, cy: 76200, fill: index === 1 ? visual.secondary || "22C55E" : visual.accent })
      + textShapeXml({ id: 1692 + index * 3, name: `User Path Insight Text ${index + 1}`, x: 1158240, y: y + 53340, cx: 2895600, cy: 121920, text: userPathCompactText(bullet, "关键路径洞察", 30), size: 660, bold: true, color: visual.body });
  }).join("");
}

function userPathFunnelScene({ slide, index, role }) {
  const bullets = userPathBulletTexts(slide);
  const values = userPathMetricValues(bullets);
  const metrics = [
    { value: values[0], label: userPathCompactText(bullets[0], "访问用户", 8) },
    { value: values[1], label: userPathCompactText(bullets[1], "关键转化", 8) },
    { value: values[2], label: userPathCompactText(bullets[2], "实验提升", 8) },
  ];
  const steps = ["访问", "激活", "提交", "留存"].map((label, stepIndex) => ({
    label: userPathCompactText(bullets[stepIndex], label, 8),
    value: values[stepIndex] || `${Math.max(24, 92 - stepIndex * 18)}%`,
  }));
  const cards = ["断点假设", "实验方案", "样本观察", "下一步动作"].map((fallback, cardIndex) => userPathCompactText(bullets[cardIndex], fallback, 14));
  const sceneKind = role === "closing" || index >= 5 ? "actions" : ["cover", "overview", "funnel", "experiment"][Math.min(index, 3)];
  const kickerMap = {
    cover: "USER JOURNEY LAB",
    overview: "CONVERSION ROUTE",
    funnel: "DROP-OFF DIAGNOSIS",
    experiment: "GROWTH EXPERIMENT",
    actions: "NEXT OPTIMIZATION",
  };
  return {
    kind: sceneKind,
    kicker: kickerMap[sceneKind],
    bullets,
    metrics,
    steps,
    cards: sceneKind === "actions" ? ["优化入口", "缩短路径", "验证假设", "复盘数据"].map((fallback, cardIndex) => userPathCompactText(bullets[cardIndex], fallback, 14)) : cards,
  };
}

function userPathBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text || item.title || item.label || item.value || "").trim();
    return "";
  }).filter(Boolean) : [];
  return values.length ? values : ["访问用户进入核心功能路径", "关键步骤转化率出现明显下降", "增长实验带来留存和提交率提升"];
}

function userPathMetricValues(bullets) {
  const matches = bullets.flatMap((item) => String(item).match(/\d+(?:\.\d+)?%|\d+(?:\.\d+)?[万千]?/g) || []);
  return [matches[0] || "12.8K", matches[1] || "38%", matches[2] || "+12%", matches[3] || "24%"];
}

function userPathCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function userPathFunnelColorPalette(visual) {
  return {
    card: blendHexColor(visual.background, "FFFFFF", 0.32),
    cardAccent: blendHexColor(visual.accent, "FFFFFF", 0.84),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.78),
    glow: blendHexColor(visual.accent, visual.background, 0.66),
    grid: blendHexColor(visual.primary, visual.background, 0.86),
    panel: blendHexColor(visual.background, "FFFFFF", 0.42),
    shine: blendHexColor("FFFFFF", visual.accent, 0.78),
    warning: visual.warning || "F97316",
    warningGlow: blendHexColor(visual.warning || "F97316", visual.background, 0.74),
  };
}

function marketTrendRadarDecorationsXml({ visual, index, role, slide }) {
  const scene = marketTrendRadarScene({ slide, index, role });
  const palette = marketTrendRadarColorPalette(visual);
  // 趋势雷达模板用可编辑图形绘制扫描舱、雷达环和市场信号点，不使用整页截图。
  const shell = rectShapeXml({ id: 1700, name: "Market Trend Intelligence Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + marketTrendRadarGridXml({ palette })
    + solidShapeXml({ id: 1701, name: "Market Trend Console", geom: "roundRect", x: 457200, y: 411480, cx: 8229600, cy: 4381500, fill: palette.console })
    + lineFrameShapeXml({ id: 1702, name: "Market Trend Console Frame", geom: "roundRect", x: 457200, y: 411480, cx: 8229600, cy: 4381500, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1703, name: "Market Trend Signal Header", x: 457200, y: 411480, cx: 5486400, cy: 45720, fill: visual.accent })
    + rectShapeXml({ id: 1704, name: "Market Trend Violet Header", x: 5943600, y: 411480, cx: 1524000, cy: 45720, fill: palette.violet })
    + rectShapeXml({ id: 1705, name: "Market Trend Amber Header", x: 7467600, y: 411480, cx: 1066800, cy: 45720, fill: palette.amber })
    + textShapeXml({ id: 1706, name: "Market Trend Section Kicker", x: 731520, y: 670560, cx: 2895600, cy: 198120, text: scene.kicker, size: 760, bold: true, color: visual.accent });
  const panel = scene.kind === "opportunity"
    ? marketTrendOpportunityMatrixXml({ visual, palette })
    : scene.kind === "competition"
      ? marketTrendCompetitionShiftXml({ visual, palette, cards: scene.cards })
      : scene.kind === "risk"
        ? marketTrendRiskCardsXml({ visual, palette, cards: scene.cards })
        : scene.kind === "actions"
          ? marketTrendActionCardsXml({ visual, palette, cards: scene.cards })
          : marketTrendRadarPanelXml({ visual, palette });
  return shell
    + panel
    + (scene.kind !== "actions" ? marketTrendMetricCardsXml({ visual, palette, metrics: scene.metrics }) : "")
    + marketTrendInsightRowsXml({ visual, palette, bullets: scene.bullets });
}

function marketTrendRadarGridXml({ palette }) {
  const vertical = [0, 1, 2, 3, 4, 5].map((itemIndex) => rectShapeXml({ id: 1710 + itemIndex, name: `Market Trend Vertical Grid ${itemIndex + 1}`, x: 914400 + itemIndex * 1219200, y: 609600, cx: 7620, cy: 3962400, fill: palette.grid })).join("");
  const horizontal = [0, 1, 2, 3].map((itemIndex) => rectShapeXml({ id: 1720 + itemIndex, name: `Market Trend Horizontal Grid ${itemIndex + 1}`, x: 609600, y: 1066800 + itemIndex * 762000, cx: 7924800, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal
    + solidShapeXml({ id: 1728, name: "Market Trend Cyan Glow", geom: "ellipse", x: 6400800, y: 365760, cx: 1828800, cy: 1828800, fill: palette.glow })
    + solidShapeXml({ id: 1729, name: "Market Trend Violet Glow", geom: "ellipse", x: 274320, y: 3505200, cx: 1371600, cy: 1371600, fill: blendHexColor(palette.violet, visualColorFallback(palette.background, "050B18"), 0.80) });
}

function marketTrendRadarPanelXml({ visual, palette }) {
  const cx = 6858000;
  const cy = 2148840;
  return solidShapeXml({ id: 1730, name: "Market Trend Radar Panel", geom: "ellipse", x: 5715000, y: 1005840, cx: 2286000, cy: 2286000, fill: palette.panel })
    + lineFrameShapeXml({ id: 1731, name: "Market Trend Radar Outer Ring", geom: "ellipse", x: 5715000, y: 1005840, cx: 2286000, cy: 2286000, stroke: palette.frame, width: 15240 })
    + lineFrameShapeXml({ id: 1732, name: "Market Trend Radar Middle Ring", geom: "ellipse", x: 6027420, y: 1318260, cx: 1661160, cy: 1661160, stroke: palette.frameSoft, width: 10160 })
    + lineFrameShapeXml({ id: 1733, name: "Market Trend Radar Inner Ring", geom: "ellipse", x: 6347460, y: 1638300, cx: 1021080, cy: 1021080, stroke: palette.frameSoft, width: 10160 })
    + rectShapeXml({ id: 1734, name: "Market Trend Radar Scan Beam", x: cx, y: cy - 22860, cx: 1066800, cy: 45720, fill: visual.accent })
    + arcLineShapeXml({ id: 1735, name: "Market Trend Signal Arc Cyan", x: 6096000, y: 1424940, cx: 1524000, cy: 1066800, stroke: visual.accent, width: 30480 })
    + arcLineShapeXml({ id: 1736, name: "Market Trend Signal Arc Violet", x: 6172200, y: 1546860, cx: 1371600, cy: 762000, stroke: palette.violet, width: 25400 })
    + solidShapeXml({ id: 1737, name: "Market Trend Signal Dot A", geom: "ellipse", x: 6370320, y: 1623060, cx: 137160, cy: 137160, fill: visual.accent })
    + solidShapeXml({ id: 1738, name: "Market Trend Signal Dot B", geom: "ellipse", x: 7162800, y: 1424940, cx: 137160, cy: 137160, fill: palette.amber })
    + solidShapeXml({ id: 1739, name: "Market Trend Signal Dot C", geom: "ellipse", x: 7010400, y: 2606040, cx: 137160, cy: 137160, fill: palette.violet });
}

function marketTrendOpportunityMatrixXml({ visual, palette }) {
  return solidShapeXml({ id: 1750, name: "Market Trend Opportunity Matrix", geom: "roundRect", x: 5334000, y: 1120140, cx: 3200400, cy: 2133600, fill: palette.panel })
    + lineFrameShapeXml({ id: 1751, name: "Market Trend Opportunity Frame", geom: "roundRect", x: 5334000, y: 1120140, cx: 3200400, cy: 2133600, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 1752, name: "Market Trend Matrix Axis X", x: 5638800, y: 2194560, cx: 2514600, cy: 15240, fill: palette.grid })
    + rectShapeXml({ id: 1753, name: "Market Trend Matrix Axis Y", x: 6858000, y: 1325880, cx: 15240, cy: 1600200, fill: palette.grid })
    + solidShapeXml({ id: 1754, name: "Market Trend Opportunity Point A", geom: "ellipse", x: 6096000, y: 2354580, cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 1755, name: "Market Trend Opportunity Point B", geom: "ellipse", x: 7239000, y: 1546860, cx: 167640, cy: 167640, fill: palette.amber })
    + solidShapeXml({ id: 1756, name: "Market Trend Opportunity Point C", geom: "ellipse", x: 7467600, y: 2506980, cx: 137160, cy: 137160, fill: palette.violet })
    + textShapeXml({ id: 1757, name: "Market Trend Matrix Label", x: 5638800, y: 2941320, cx: 1981200, cy: 152400, text: "Opportunity Window", size: 700, bold: true, color: visual.title });
}

function marketTrendCompetitionShiftXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const y = 1219200 + index * 426720;
    return solidShapeXml({ id: 1770 + index * 4, name: `Market Trend Competitor Lane ${index + 1}`, geom: "roundRect", x: 5486400, y, cx: 2895600, cy: 304800, fill: palette.panel })
      + textShapeXml({ id: 1771 + index * 4, name: `Market Trend Competitor Text ${index + 1}`, x: 5684520, y: y + 76200, cx: 1066800, cy: 137160, text: card, size: 720, bold: true, color: visual.title })
      + rectShapeXml({ id: 1772 + index * 4, name: `Market Trend Shift Bar ${index + 1}`, x: 6995160, y: y + 121920, cx: 914400 - index * 121920, cy: 38100, fill: index === 1 ? palette.violet : visual.accent })
      + solidShapeXml({ id: 1773 + index * 4, name: `Market Trend Shift Dot ${index + 1}`, geom: "ellipse", x: 8031480 - index * 121920, y: y + 76200, cx: 121920, cy: 121920, fill: index === 0 ? palette.amber : visual.accent });
  }).join("");
}

function marketTrendRiskCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5486400 + col * 1447800;
    const y = 1219200 + row * 914400;
    return solidShapeXml({ id: 1800 + index * 4, name: `Market Trend Risk Card ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 685800, fill: palette.warningPanel })
      + solidShapeXml({ id: 1801 + index * 4, name: `Market Trend Risk Beacon ${index + 1}`, geom: "ellipse", x: x + 152400, y: y + 121920, cx: 152400, cy: 152400, fill: index === 0 ? palette.amber : visual.accent })
      + textShapeXml({ id: 1802 + index * 4, name: `Market Trend Risk Text ${index + 1}`, x: x + 152400, y: y + 365760, cx: 914400, cy: 152400, text: card, size: 700, bold: true, color: visual.title })
      + rectShapeXml({ id: 1803 + index * 4, name: `Market Trend Risk Rule ${index + 1}`, x: x + 152400, y: y + 579120, cx: 762000, cy: 30480, fill: index === 0 ? palette.amber : visual.accent });
  }).join("");
}

function marketTrendActionCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 3).map((card, index) => {
    const x = 914400 + index * 2438400;
    return solidShapeXml({ id: 1830 + index * 3, name: `Market Trend Action Card ${index + 1}`, geom: "roundRect", x, y: 3200400, cx: 2133600, cy: 822960, fill: palette.panel })
      + rectShapeXml({ id: 1831 + index * 3, name: `Market Trend Action Rule ${index + 1}`, x: x + 152400, y: 3383280, cx: 762000, cy: 38100, fill: index === 1 ? palette.violet : visual.accent })
      + textShapeXml({ id: 1832 + index * 3, name: `Market Trend Action Text ${index + 1}`, x: x + 152400, y: 3634740, cx: 1676400, cy: 182880, text: card, size: 820, bold: true, color: visual.title });
  }).join("");
}

function marketTrendMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 4).map((metric, index) => {
    const x = 731520 + index * 1981200;
    return solidShapeXml({ id: 1860 + index * 4, name: `Market Trend KPI Card ${index + 1}`, geom: "roundRect", x, y: 3771900, cx: 1676400, cy: 609600, fill: palette.card })
      + textShapeXml({ id: 1861 + index * 4, name: `Market Trend KPI Value ${index + 1}`, x: x + 137160, y: 3886200, cx: 731520, cy: 182880, text: metric.value, size: 1180, bold: true, color: visual.title })
      + textShapeXml({ id: 1862 + index * 4, name: `Market Trend KPI Label ${index + 1}`, x: x + 137160, y: 4130040, cx: 1066800, cy: 137160, text: metric.label, size: 680, bold: true, color: visual.body })
      + rectShapeXml({ id: 1863 + index * 4, name: `Market Trend KPI Pulse ${index + 1}`, x: x + 137160, y: 4328160, cx: 670560 + index * 91440, cy: 30480, fill: index === 2 ? palette.violet : visual.accent });
  }).join("");
}

function marketTrendInsightRowsXml({ visual, palette, bullets }) {
  return bullets.slice(0, 3).map((bullet, index) => {
    const y = 2240280 + index * 365760;
    return solidShapeXml({ id: 1890 + index * 3, name: `Market Trend Insight Row ${index + 1}`, geom: "roundRect", x: 731520, y, cx: 3505200, cy: 243840, fill: palette.card })
      + solidShapeXml({ id: 1891 + index * 3, name: `Market Trend Insight Dot ${index + 1}`, geom: "ellipse", x: 883920, y: y + 76200, cx: 91440, cy: 91440, fill: index === 1 ? palette.violet : visual.accent })
      + textShapeXml({ id: 1892 + index * 3, name: `Market Trend Insight Text ${index + 1}`, x: 1066800, y: y + 60960, cx: 2895600, cy: 121920, text: marketTrendCompactText(bullet, "关键市场信号", 30), size: 700, bold: true, color: visual.body });
  }).join("");
}

function marketTrendRadarScene({ slide, index, role }) {
  const bullets = marketTrendBulletTexts(slide);
  const values = marketTrendMetricValues(bullets);
  const metrics = ["市场增速", "机会窗口", "竞争变化", "风险信号"].map((fallback, itemIndex) => ({
    value: values[itemIndex] || ["CAGR", "3", "+18%", "2"][itemIndex],
    label: marketTrendCompactText(bullets[itemIndex], fallback, 8),
  }));
  const cards = ["需求升温", "技术拐点", "渠道迁移", "供给重构"].map((fallback, itemIndex) => marketTrendCompactText(bullets[itemIndex], fallback, 14));
  const sceneKind = role === "closing" || index >= 5 ? "actions" : ["cover", "scan", "opportunity", "competition", "risk"][Math.min(index, 4)];
  const kickerMap = {
    cover: "MARKET SIGNAL SCAN",
    scan: "TREND SIGNALS",
    opportunity: "OPPORTUNITY WINDOW",
    competition: "COMPETITION SHIFT",
    risk: "RISK SIGNALS",
    actions: "NEXT MARKET MOVES",
  };
  return {
    kind: sceneKind,
    kicker: kickerMap[sceneKind],
    bullets,
    metrics,
    cards: sceneKind === "actions" ? ["持续观察", "小样本验证", "资源投入"].map((fallback, itemIndex) => marketTrendCompactText(bullets[itemIndex], fallback, 14)) : cards,
  };
}

function marketTrendBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text || item.title || item.label || item.value || "").trim();
    return "";
  }).filter(Boolean) : [];
  return values.length ? values : ["行业需求正在从试点进入规模化采购", "技术成熟度提升带来新的进入窗口", "头部竞争者开始调整渠道和价格策略", "政策和供应链变量需要持续跟踪"];
}

function marketTrendMetricValues(bullets) {
  const matches = bullets.flatMap((item) => String(item).match(/[+-]?\d+(?:\.\d+)?%|\d+(?:\.\d+)?[万千亿]?|TAM|SAM|CAGR/gi) || []);
  return [matches[0] || "CAGR", matches[1] || "3", matches[2] || "+18%", matches[3] || "2"];
}

function marketTrendCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function marketTrendRadarColorPalette(visual) {
  return {
    amber: visual.warning || "F59E0B",
    background: visual.background,
    card: blendHexColor(visual.surface, visual.background, 0.25),
    console: blendHexColor(visual.surface, visual.background, 0.16),
    frame: blendHexColor(visual.accent, visual.surface, 0.60),
    frameSoft: blendHexColor(visual.accent, visual.background, 0.72),
    glow: blendHexColor(visual.accent, visual.background, 0.76),
    grid: blendHexColor(visual.accent, visual.background, 0.84),
    panel: blendHexColor(visual.surface, visual.background, 0.08),
    violet: visual.secondary || "A78BFA",
    warningPanel: blendHexColor(visual.warning || "F59E0B", visual.surface, 0.84),
  };
}

function customerSegmentationLayeringDecorationsXml({ visual, index, role, slide }) {
  const scene = customerSegmentationLayeringScene({ slide, index, role });
  const palette = customerSegmentationLayeringColorPalette(visual);
  // 客户分群模板用可编辑图形绘制分层金字塔、画像卡和 RFM 矩阵，避免把用户画像做成不可编辑截图。
  const shell = rectShapeXml({ id: 2100, name: "Customer Segmentation Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + customerSegmentationGridXml({ palette })
    + solidShapeXml({ id: 2101, name: "Customer Segmentation Canvas", geom: "roundRect", x: 457200, y: 411480, cx: 8229600, cy: 4381500, fill: palette.canvas })
    + lineFrameShapeXml({ id: 2102, name: "Customer Segmentation Canvas Frame", geom: "roundRect", x: 457200, y: 411480, cx: 8229600, cy: 4381500, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 2103, name: "Customer Segmentation Header Teal", x: 457200, y: 411480, cx: 5486400, cy: 45720, fill: visual.accent })
    + rectShapeXml({ id: 2104, name: "Customer Segmentation Header Amber", x: 5943600, y: 411480, cx: 1524000, cy: 45720, fill: palette.amber })
    + rectShapeXml({ id: 2105, name: "Customer Segmentation Header Violet", x: 7467600, y: 411480, cx: 1066800, cy: 45720, fill: palette.violet })
    + textShapeXml({ id: 2106, name: "Customer Segmentation Section Kicker", x: 731520, y: 670560, cx: 3200400, cy: 198120, text: scene.kicker, size: 760, bold: true, color: visual.accent });
  const panel = scene.kind === "persona"
    ? customerSegmentationPersonaCardsXml({ visual, palette, cards: scene.cards })
    : scene.kind === "matrix"
      ? customerSegmentationRfmMatrixXml({ visual, palette })
      : scene.kind === "strategy"
        ? customerSegmentationStrategyTableXml({ visual, palette, cards: scene.cards })
        : scene.kind === "action"
          ? customerSegmentationActionLoopXml({ visual, palette })
          : customerSegmentationPyramidXml({ visual, palette, layers: scene.layers });
  return shell
    + panel
    + (scene.kind !== "action" ? customerSegmentationMetricCardsXml({ visual, palette, metrics: scene.metrics }) : "")
    + customerSegmentationInsightRowsXml({ visual, palette, bullets: scene.bullets })
    + (scene.kind === "action" ? customerSegmentationStrategyCardsXml({ visual, palette, cards: scene.cards }) : "");
}

function customerSegmentationGridXml({ palette }) {
  const vertical = [0, 1, 2, 3, 4, 5].map((itemIndex) => rectShapeXml({ id: 2110 + itemIndex, name: `Customer Segmentation Vertical Grid ${itemIndex + 1}`, x: 914400 + itemIndex * 1219200, y: 609600, cx: 7620, cy: 3962400, fill: palette.grid })).join("");
  const horizontal = [0, 1, 2, 3].map((itemIndex) => rectShapeXml({ id: 2120 + itemIndex, name: `Customer Segmentation Horizontal Grid ${itemIndex + 1}`, x: 609600, y: 1066800 + itemIndex * 762000, cx: 7924800, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal
    + solidShapeXml({ id: 2128, name: "Customer Segmentation Teal Glow", geom: "ellipse", x: 6400800, y: 365760, cx: 1828800, cy: 1828800, fill: palette.glow })
    + solidShapeXml({ id: 2129, name: "Customer Segmentation Violet Glow", geom: "ellipse", x: 274320, y: 3505200, cx: 1371600, cy: 1371600, fill: blendHexColor(palette.violet, visualColorFallback(palette.background, "F6FAFC"), 0.84) });
}

function customerSegmentationPyramidXml({ visual, palette, layers }) {
  const widths = [1066800, 1524000, 1981200, 2438400];
  const fills = [visual.primary, visual.accent, palette.amber, palette.violet];
  return solidShapeXml({ id: 2130, name: "Customer Segmentation Pyramid Panel", geom: "roundRect", x: 5486400, y: 1036320, cx: 2895600, cy: 2286000, fill: palette.panel })
    + lineFrameShapeXml({ id: 2131, name: "Customer Segmentation Pyramid Frame", geom: "roundRect", x: 5486400, y: 1036320, cx: 2895600, cy: 2286000, stroke: palette.frame, width: 11430 })
    + layers.slice(0, 4).map((layer, index) => {
      const width = widths[index];
      const x = 6934200 - Math.round(width / 2);
      const y = 1280160 + index * 426720;
      return solidShapeXml({ id: 2140 + index * 3, name: `Customer Segment Layer ${index + 1}`, geom: "roundRect", x, y, cx: width, cy: 304800, fill: fills[index] })
        + textShapeXml({ id: 2141 + index * 3, name: `Customer Segment Layer Text ${index + 1}`, x: x + 121920, y: y + 76200, cx: width - 243840, cy: 137160, text: layer, size: 660, bold: true, color: "FFFFFF" });
    }).join("");
}

function customerSegmentationPersonaCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5486400 + col * 1447800;
    const y = 1219200 + row * 914400;
    return solidShapeXml({ id: 2170 + index * 5, name: `Customer Persona Card ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 685800, fill: palette.panel })
      + solidShapeXml({ id: 2171 + index * 5, name: `Customer Persona Avatar ${index + 1}`, geom: "ellipse", x: x + 152400, y: y + 121920, cx: 182880, cy: 182880, fill: index % 2 ? palette.amber : visual.accent })
      + textShapeXml({ id: 2172 + index * 5, name: `Customer Persona Text ${index + 1}`, x: x + 152400, y: y + 365760, cx: 914400, cy: 152400, text: card, size: 700, bold: true, color: visual.title })
      + rectShapeXml({ id: 2173 + index * 5, name: `Customer Persona Tag ${index + 1}`, x: x + 396240, y: y + 182880, cx: 548640, cy: 38100, fill: palette.tag })
      + rectShapeXml({ id: 2174 + index * 5, name: `Customer Persona Rule ${index + 1}`, x: x + 152400, y: y + 579120, cx: 762000, cy: 30480, fill: index === 2 ? palette.violet : visual.accent });
  }).join("");
}

function customerSegmentationRfmMatrixXml({ visual, palette }) {
  return solidShapeXml({ id: 2200, name: "Customer Segmentation RFM Matrix", geom: "roundRect", x: 5486400, y: 1120140, cx: 2895600, cy: 2133600, fill: palette.panel })
    + lineFrameShapeXml({ id: 2201, name: "Customer Segmentation RFM Frame", geom: "roundRect", x: 5486400, y: 1120140, cx: 2895600, cy: 2133600, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 2202, name: "Customer Segmentation RFM Axis X", x: 5791200, y: 2194560, cx: 2286000, cy: 15240, fill: palette.grid })
    + rectShapeXml({ id: 2203, name: "Customer Segmentation RFM Axis Y", x: 6934200, y: 1325880, cx: 15240, cy: 1600200, fill: palette.grid })
    + solidShapeXml({ id: 2204, name: "Customer Segmentation RFM High Value", geom: "ellipse", x: 7162800, y: 1470660, cx: 182880, cy: 182880, fill: visual.primary })
    + solidShapeXml({ id: 2205, name: "Customer Segmentation RFM Growth", geom: "ellipse", x: 6248400, y: 1630680, cx: 167640, cy: 167640, fill: visual.accent })
    + solidShapeXml({ id: 2206, name: "Customer Segmentation RFM Price Sensitive", geom: "ellipse", x: 7086600, y: 2522220, cx: 152400, cy: 152400, fill: palette.amber })
    + solidShapeXml({ id: 2207, name: "Customer Segmentation RFM Dormant", geom: "ellipse", x: 6172200, y: 2598420, cx: 152400, cy: 152400, fill: palette.violet })
    + textShapeXml({ id: 2208, name: "Customer Segmentation RFM Label", x: 5791200, y: 2926080, cx: 1981200, cy: 152400, text: "RFM Value Map", size: 700, bold: true, color: visual.title });
}

function customerSegmentationStrategyTableXml({ visual, palette, cards }) {
  return solidShapeXml({ id: 2230, name: "Customer Segmentation Strategy Table", geom: "roundRect", x: 5181600, y: 1120140, cx: 3352800, cy: 2286000, fill: palette.panel })
    + lineFrameShapeXml({ id: 2231, name: "Customer Segmentation Strategy Frame", geom: "roundRect", x: 5181600, y: 1120140, cx: 3352800, cy: 2286000, stroke: palette.frame, width: 11430 })
    + cards.slice(0, 4).map((card, index) => {
      const y = 1325880 + index * 426720;
      return solidShapeXml({ id: 2240 + index * 4, name: `Customer Strategy Row ${index + 1}`, geom: "roundRect", x: 5486400, y, cx: 2743200, cy: 304800, fill: index % 2 ? palette.rowAlt : palette.card })
        + solidShapeXml({ id: 2241 + index * 4, name: `Customer Strategy Dot ${index + 1}`, geom: "ellipse", x: 5669280, y: y + 91440, cx: 121920, cy: 121920, fill: index === 1 ? palette.amber : visual.accent })
        + textShapeXml({ id: 2242 + index * 4, name: `Customer Strategy Text ${index + 1}`, x: 5897880, y: y + 76200, cx: 1828800, cy: 137160, text: card, size: 700, bold: true, color: visual.title })
        + rectShapeXml({ id: 2243 + index * 4, name: `Customer Strategy Progress ${index + 1}`, x: 7620000, y: y + 121920, cx: 365760 + index * 121920, cy: 38100, fill: index === 2 ? palette.violet : visual.accent });
    }).join("");
}

function customerSegmentationActionLoopXml({ visual, palette }) {
  return lineFrameShapeXml({ id: 2270, name: "Customer Segmentation Operation Loop", geom: "ellipse", x: 5791200, y: 1219200, cx: 2133600, cy: 2133600, stroke: visual.accent, width: 68580 })
    + lineFrameShapeXml({ id: 2271, name: "Customer Segmentation Operation Loop Amber", geom: "ellipse", x: 6065520, y: 1493520, cx: 1584960, cy: 1584960, stroke: palette.amber, width: 38100 })
    + solidShapeXml({ id: 2272, name: "Customer Segmentation Operation Core", geom: "roundRect", x: 6705600, y: 2072640, cx: 548640, cy: 548640, fill: visual.primary })
    + textShapeXml({ id: 2273, name: "Customer Segmentation Operation Core Text", x: 6644640, y: 2263140, cx: 670560, cy: 137160, text: "CRM", size: 760, bold: true, color: "FFFFFF" });
}

function customerSegmentationStrategyCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const x = 731520 + index * 1981200;
    return solidShapeXml({ id: 2290 + index * 3, name: `Customer Segmentation Action Card ${index + 1}`, geom: "roundRect", x, y: 3596640, cx: 1676400, cy: 609600, fill: palette.card })
      + rectShapeXml({ id: 2291 + index * 3, name: `Customer Segmentation Action Rule ${index + 1}`, x: x + 137160, y: 3764280, cx: 579120, cy: 38100, fill: index === 1 ? palette.amber : visual.accent })
      + textShapeXml({ id: 2292 + index * 3, name: `Customer Segmentation Action Text ${index + 1}`, x: x + 137160, y: 3985260, cx: 1219200, cy: 182880, text: card, size: 760, bold: true, color: visual.title });
  }).join("");
}

function customerSegmentationMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 3).map((metric, index) => {
    const x = 731520 + index * 1524000;
    return solidShapeXml({ id: 2320 + index * 4, name: `Customer Segmentation KPI Card ${index + 1}`, geom: "roundRect", x, y: 3771900, cx: 1219200, cy: 609600, fill: palette.card })
      + textShapeXml({ id: 2321 + index * 4, name: `Customer Segmentation KPI Value ${index + 1}`, x: x + 137160, y: 3886200, cx: 579120, cy: 182880, text: metric.value, size: 1080, bold: true, color: visual.title })
      + textShapeXml({ id: 2322 + index * 4, name: `Customer Segmentation KPI Label ${index + 1}`, x: x + 137160, y: 4130040, cx: 853440, cy: 137160, text: metric.label, size: 640, bold: true, color: visual.body })
      + rectShapeXml({ id: 2323 + index * 4, name: `Customer Segmentation KPI Pulse ${index + 1}`, x: x + 137160, y: 4328160, cx: 487680 + index * 91440, cy: 30480, fill: index === 2 ? palette.violet : visual.accent });
  }).join("");
}

function customerSegmentationInsightRowsXml({ visual, palette, bullets }) {
  return bullets.slice(0, 3).map((bullet, index) => {
    const y = 2240280 + index * 365760;
    return solidShapeXml({ id: 2350 + index * 3, name: `Customer Segmentation Insight Row ${index + 1}`, geom: "roundRect", x: 731520, y, cx: 3505200, cy: 243840, fill: palette.card })
      + solidShapeXml({ id: 2351 + index * 3, name: `Customer Segmentation Insight Dot ${index + 1}`, geom: "ellipse", x: 883920, y: y + 76200, cx: 91440, cy: 91440, fill: index === 1 ? palette.amber : visual.accent })
      + textShapeXml({ id: 2352 + index * 3, name: `Customer Segmentation Insight Text ${index + 1}`, x: 1066800, y: y + 60960, cx: 2895600, cy: 121920, text: customerSegmentationCompactText(bullet, "关键客户洞察", 30), size: 700, bold: true, color: visual.body });
  }).join("");
}

function customerSegmentationLayeringScene({ slide, index, role }) {
  const bullets = customerSegmentationBulletTexts(slide);
  const values = customerSegmentationMetricValues(bullets);
  const metrics = [
    { value: values[0], label: customerSegmentationCompactText(bullets[0], "用户规模", 8) },
    { value: values[1], label: customerSegmentationCompactText(bullets[1], "核心客群", 8) },
    { value: values[2], label: customerSegmentationCompactText(bullets[2], "提升目标", 8) },
  ];
  const layers = ["高价值客户", "成长潜力客群", "价格敏感人群", "沉睡风险人群"].map((fallback, itemIndex) => customerSegmentationCompactText(bullets[itemIndex], fallback, 10));
  const sceneKind = index === 0 ? "cover" : role === "closing" ? "action" : String(role || "").includes("persona") ? "persona" : String(role || "").includes("matrix") || String(role || "").includes("analysis") ? "matrix" : String(role || "").includes("strategy") ? "strategy" : String(role || "").includes("overview") ? "overview" : String(role || "").includes("action") ? "action" : ["overview", "persona", "matrix", "strategy"][(index - 1) % 4];
  const cards = sceneKind === "strategy" || sceneKind === "action"
    ? ["权益匹配", "渠道触达", "内容推荐", "转化目标"].map((fallback, itemIndex) => customerSegmentationCompactText(bullets[itemIndex], fallback, 12))
    : ["身份标签", "行为偏好", "消费频次", "触达策略"].map((fallback, itemIndex) => customerSegmentationCompactText(bullets[itemIndex], fallback, 12));
  return {
    kind: sceneKind,
    kicker: sceneKind === "cover" ? "CUSTOMER SEGMENT CANVAS" : sceneKind === "overview" ? "SEGMENT OVERVIEW" : sceneKind === "persona" ? "PERSONA PROFILE" : sceneKind === "matrix" ? "RFM VALUE MAP" : sceneKind === "strategy" ? "PRECISION OPERATION" : "NEXT OPERATION LOOP",
    bullets,
    metrics,
    layers,
    cards,
  };
}

function customerSegmentationBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text || item.title || item.label || item.value || "").trim();
    return "";
  }).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["识别高价值用户与成长潜力客群", "结合 RFM、偏好标签和消费频次建立分层", "匹配触达渠道、权益策略和转化目标"];
}

function customerSegmentationMetricValues(bullets) {
  const fallback = ["24K", "4类", "+18%"];
  return fallback.map((value, index) => {
    const match = String(bullets[index] || "").match(/(\d+(?:\.\d+)?\s*(?:%|万|k|K|类|层|人)?)/);
    return match ? match[1].replace(/\s+/g, "") : value;
  });
}

function customerSegmentationCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}…`;
}

function customerSegmentationLayeringColorPalette(visual) {
  return {
    background: visual.background,
    canvas: blendHexColor(visual.surface, visual.background, 0.92),
    panel: blendHexColor(visual.surface, visual.background, 0.88),
    card: blendHexColor("FFFFFF", visual.background, 0.90),
    rowAlt: blendHexColor(visual.accent, visual.background, 0.86),
    frame: blendHexColor(visual.primary, visual.background, 0.72),
    grid: blendHexColor(visual.primary, visual.background, 0.88),
    glow: blendHexColor(visual.accent, visual.background, 0.82),
    tag: blendHexColor(visual.accent, "FFFFFF", 0.72),
    amber: visual.secondary || "F59E0B",
    violet: visual.warning || "A855F7",
  };
}

function visualColorFallback(value, fallback) {
  return /^[0-9A-Fa-f]{6}$/.test(String(value || "")) ? value : fallback;
}

function metricAnomalyAttributionDecorationsXml({ visual, index, role, slide }) {
  const scene = metricAnomalyAttributionScene({ slide, index, role });
  const palette = metricAnomalyAttributionColorPalette(visual);
  // 指标异常诊断模板全部用可编辑图形绘制，保留异常波形、归因节点和修复动作的结构一致性。
  const shell = rectShapeXml({ id: 2400, name: "Metric Anomaly Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + metricAnomalyGridXml({ palette })
    + solidShapeXml({ id: 2401, name: "Metric Anomaly Diagnosis Canvas", geom: "roundRect", x: 521208, y: 411480, cx: 8101584, cy: 4381500, fill: palette.canvas })
    + lineFrameShapeXml({ id: 2402, name: "Metric Anomaly Diagnosis Canvas Frame", geom: "roundRect", x: 521208, y: 411480, cx: 8101584, cy: 4381500, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 2403, name: "Metric Anomaly Alert Header", x: 521208, y: 411480, cx: 1828800, cy: 54864, fill: visual.warning || "EF4444" })
    + rectShapeXml({ id: 2404, name: "Metric Anomaly Attribution Header", x: 2350010, y: 411480, cx: 2438400, cy: 54864, fill: visual.secondary || "F97316" })
    + rectShapeXml({ id: 2405, name: "Metric Anomaly Monitor Header", x: 4788410, y: 411480, cx: 3352800, cy: 54864, fill: visual.accent })
    + textShapeXml({ id: 2406, name: "Metric Anomaly Section Kicker", x: 777240, y: 670560, cx: 3200400, cy: 198120, text: scene.kicker, size: 760, bold: true, color: visual.accent });
  const rightPanel = scene.kind === "cause"
    ? metricAnomalyCauseMapXml({ visual, palette, cards: scene.cards })
    : scene.kind === "impact"
      ? metricAnomalyImpactMatrixXml({ visual, palette })
      : scene.kind === "action" || scene.kind === "closing"
        ? metricAnomalyLoopXml({ visual, palette })
        : metricAnomalySignalPanelXml({ visual, palette });
  return shell
    + rightPanel
    + metricAnomalyInsightRowsXml({ visual, palette, bullets: scene.bullets })
    + (scene.kind === "impact" || scene.kind === "action" || scene.kind === "closing" ? metricAnomalyActionCardsXml({ visual, palette, cards: scene.cards }) : metricAnomalyMetricCardsXml({ visual, palette, metrics: scene.metrics }));
}

function metricAnomalyGridXml({ palette }) {
  const vertical = [0, 1, 2, 3, 4, 5].map((itemIndex) => rectShapeXml({ id: 2410 + itemIndex, name: `Metric Anomaly Vertical Grid ${itemIndex + 1}`, x: 914400 + itemIndex * 1219200, y: 609600, cx: 7620, cy: 3962400, fill: palette.grid })).join("");
  const horizontal = [0, 1, 2, 3].map((itemIndex) => rectShapeXml({ id: 2420 + itemIndex, name: `Metric Anomaly Horizontal Grid ${itemIndex + 1}`, x: 609600, y: 1066800 + itemIndex * 762000, cx: 7924800, cy: 7620, fill: palette.grid })).join("");
  return vertical + horizontal
    + solidShapeXml({ id: 2428, name: "Metric Anomaly Red Glow", geom: "ellipse", x: 6705600, y: 411480, cx: 1676400, cy: 1676400, fill: palette.redGlow })
    + solidShapeXml({ id: 2429, name: "Metric Anomaly Cyan Glow", geom: "ellipse", x: 228600, y: 3352800, cx: 1524000, cy: 1524000, fill: palette.cyanGlow });
}

function metricAnomalySignalPanelXml({ visual, palette }) {
  return solidShapeXml({ id: 2430, name: "Metric Anomaly Wave Panel", geom: "roundRect", x: 5334000, y: 975360, cx: 3048000, cy: 2133600, fill: visual.primary })
    + lineFrameShapeXml({ id: 2431, name: "Metric Anomaly Wave Panel Frame", geom: "roundRect", x: 5334000, y: 975360, cx: 3048000, cy: 2133600, stroke: palette.cyanFrame, width: 11430 })
    + rectShapeXml({ id: 2432, name: "Metric Anomaly Threshold Line", x: 5638800, y: 1798320, cx: 2438400, cy: 15240, fill: visual.secondary || "F97316" })
    + rectShapeXml({ id: 2433, name: "Metric Anomaly Baseline", x: 5638800, y: 2286000, cx: 2438400, cy: 15240, fill: palette.softLine })
    + metricAnomalyWaveBarsXml({ visual, palette })
    + solidShapeXml({ id: 2438, name: "Metric Anomaly Peak Dot", geom: "ellipse", x: 6766560, y: 1424940, cx: 182880, cy: 182880, fill: visual.warning || "EF4444" })
    + lineFrameShapeXml({ id: 2439, name: "Metric Anomaly Peak Ring", geom: "ellipse", x: 6682740, y: 1341120, cx: 350520, cy: 350520, stroke: visual.warning || "EF4444", width: 19050, transparency: 42000 })
    + solidShapeXml({ id: 2440, name: "Metric Anomaly Risk Badge", geom: "roundRect", x: 7315200, y: 1120140, cx: 762000, cy: 274320, fill: visual.secondary || "F97316" })
    + textShapeXml({ id: 2441, name: "Metric Anomaly Risk Badge Text", x: 7429500, y: 1181100, cx: 533400, cy: 106680, text: "高风险", size: 640, bold: true, color: "FFFFFF" });
}

function metricAnomalyWaveBarsXml({ visual, palette }) {
  const bars = [
    { x: 5638800, y: 2072640, cx: 304800, cy: 457200, fill: visual.accent },
    { x: 6103620, y: 1965960, cx: 304800, cy: 563880, fill: visual.accent },
    { x: 6568440, y: 1516380, cx: 304800, cy: 1013460, fill: visual.warning || "EF4444" },
    { x: 7033260, y: 1828800, cx: 304800, cy: 701040, fill: visual.accent },
    { x: 7498080, y: 1706880, cx: 304800, cy: 822960, fill: visual.secondary || "F97316" },
  ];
  return bars.map((bar, index) => solidShapeXml({ id: 2446 + index, name: `Metric Anomaly Wave Bar ${index + 1}`, geom: "roundRect", ...bar })).join("")
    + rectShapeXml({ id: 2452, name: "Metric Anomaly Trend Segment A", x: 5654040, y: 1965960, cx: 746760, cy: 38100, fill: palette.cyanFrame })
    + rectShapeXml({ id: 2453, name: "Metric Anomaly Trend Segment B", x: 6362700, y: 1744980, cx: 746760, cy: 38100, fill: visual.warning || "EF4444" })
    + rectShapeXml({ id: 2454, name: "Metric Anomaly Trend Segment C", x: 7071360, y: 1905000, cx: 746760, cy: 38100, fill: palette.cyanFrame });
}

function metricAnomalyCauseMapXml({ visual, palette, cards }) {
  const nodes = cards.slice(0, 4);
  const positions = [
    { x: 5486400, y: 1158240, fill: visual.accent },
    { x: 7467600, y: 1158240, fill: visual.secondary || "F97316" },
    { x: 5486400, y: 2743200, fill: palette.violet },
    { x: 7467600, y: 2743200, fill: "22C55E" },
  ];
  return solidShapeXml({ id: 2460, name: "Metric Anomaly Cause Network Panel", geom: "roundRect", x: 5181600, y: 990600, cx: 3352800, cy: 2438400, fill: visual.primary })
    + lineFrameShapeXml({ id: 2461, name: "Metric Anomaly Cause Network Frame", geom: "roundRect", x: 5181600, y: 990600, cx: 3352800, cy: 2438400, stroke: palette.cyanFrame, width: 11430 })
    + rectShapeXml({ id: 2462, name: "Metric Anomaly Cause Link H", x: 5943600, y: 2194560, cx: 1981200, cy: 22860, fill: palette.cyanFrame })
    + rectShapeXml({ id: 2463, name: "Metric Anomaly Cause Link V", x: 6918960, y: 1394460, cx: 22860, cy: 1600200, fill: palette.cyanFrame })
    + solidShapeXml({ id: 2464, name: "Metric Anomaly Root Cause Core", geom: "ellipse", x: 6598920, y: 1866900, cx: 670560, cy: 670560, fill: visual.warning || "EF4444" })
    + textShapeXml({ id: 2465, name: "Metric Anomaly Root Cause Text", x: 6637020, y: 2103120, cx: 594360, cy: 106680, text: "异常", size: 700, bold: true, color: "FFFFFF" })
    + positions.map((position, index) => solidShapeXml({ id: 2470 + index * 3, name: `Metric Anomaly Cause Node ${index + 1}`, geom: "ellipse", x: position.x, y: position.y, cx: 548640, cy: 548640, fill: position.fill })
      + textShapeXml({ id: 2471 + index * 3, name: `Metric Anomaly Cause Node Text ${index + 1}`, x: position.x + 76200, y: position.y + 205740, cx: 396240, cy: 121920, text: nodes[index] || "原因", size: 620, bold: true, color: "FFFFFF" })).join("");
}

function metricAnomalyImpactMatrixXml({ visual, palette }) {
  return solidShapeXml({ id: 2490, name: "Metric Anomaly Impact Matrix", geom: "roundRect", x: 5486400, y: 1120140, cx: 2895600, cy: 2133600, fill: palette.panel })
    + lineFrameShapeXml({ id: 2491, name: "Metric Anomaly Impact Matrix Frame", geom: "roundRect", x: 5486400, y: 1120140, cx: 2895600, cy: 2133600, stroke: palette.frame, width: 11430 })
    + rectShapeXml({ id: 2492, name: "Metric Anomaly Impact Axis X", x: 5791200, y: 2194560, cx: 2286000, cy: 15240, fill: palette.axis })
    + rectShapeXml({ id: 2493, name: "Metric Anomaly Impact Axis Y", x: 6934200, y: 1325880, cx: 15240, cy: 1600200, fill: palette.axis })
    + solidShapeXml({ id: 2494, name: "Metric Anomaly Impact Critical", geom: "ellipse", x: 7246620, y: 1470660, cx: 198120, cy: 198120, fill: visual.warning || "EF4444" })
    + solidShapeXml({ id: 2495, name: "Metric Anomaly Impact Medium", geom: "ellipse", x: 6248400, y: 1653540, cx: 167640, cy: 167640, fill: visual.accent })
    + solidShapeXml({ id: 2496, name: "Metric Anomaly Impact Cost", geom: "ellipse", x: 7086600, y: 2522220, cx: 152400, cy: 152400, fill: visual.secondary || "F97316" })
    + textShapeXml({ id: 2497, name: "Metric Anomaly Impact Label", x: 5791200, y: 2926080, cx: 1981200, cy: 152400, text: "Impact / Urgency", size: 700, bold: true, color: visual.title });
}

function metricAnomalyLoopXml({ visual, palette }) {
  return lineFrameShapeXml({ id: 2510, name: "Metric Anomaly Fix Loop", geom: "ellipse", x: 5943600, y: 1270000, cx: 1981200, cy: 1981200, stroke: visual.accent, width: 68580 })
    + lineFrameShapeXml({ id: 2511, name: "Metric Anomaly Fix Loop Orange", geom: "ellipse", x: 6248400, y: 1574800, cx: 1371600, cy: 1371600, stroke: visual.secondary || "F97316", width: 38100 })
    + solidShapeXml({ id: 2512, name: "Metric Anomaly Fix Core", geom: "roundRect", x: 6781800, y: 2072640, cx: 548640, cy: 548640, fill: visual.primary })
    + textShapeXml({ id: 2513, name: "Metric Anomaly Fix Core Text", x: 6743700, y: 2263140, cx: 655320, cy: 137160, text: "FIX", size: 760, bold: true, color: "FFFFFF" });
}

function metricAnomalyMetricCardsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 3).map((metric, index) => {
    const x = 777240 + index * 1524000;
    return solidShapeXml({ id: 2530 + index * 4, name: `Metric Anomaly KPI Card ${index + 1}`, geom: "roundRect", x, y: 3771900, cx: 1219200, cy: 609600, fill: palette.card })
      + textShapeXml({ id: 2531 + index * 4, name: `Metric Anomaly KPI Value ${index + 1}`, x: x + 137160, y: 3886200, cx: 579120, cy: 182880, text: metric.value, size: 1080, bold: true, color: index === 0 ? (visual.warning || "EF4444") : visual.title })
      + textShapeXml({ id: 2532 + index * 4, name: `Metric Anomaly KPI Label ${index + 1}`, x: x + 137160, y: 4130040, cx: 853440, cy: 137160, text: metric.label, size: 640, bold: true, color: visual.body })
      + rectShapeXml({ id: 2533 + index * 4, name: `Metric Anomaly KPI Pulse ${index + 1}`, x: x + 137160, y: 4328160, cx: 487680 + index * 91440, cy: 30480, fill: index === 0 ? (visual.warning || "EF4444") : visual.accent });
  }).join("");
}

function metricAnomalyActionCardsXml({ visual, palette, cards }) {
  return cards.slice(0, 4).map((card, index) => {
    const x = 731520 + index * 1981200;
    return solidShapeXml({ id: 2550 + index * 3, name: `Metric Anomaly Action Card ${index + 1}`, geom: "roundRect", x, y: 3596640, cx: 1676400, cy: 609600, fill: palette.card })
      + rectShapeXml({ id: 2551 + index * 3, name: `Metric Anomaly Action Rule ${index + 1}`, x: x + 137160, y: 3764280, cx: 579120, cy: 38100, fill: index === 0 ? (visual.warning || "EF4444") : visual.accent })
      + textShapeXml({ id: 2552 + index * 3, name: `Metric Anomaly Action Text ${index + 1}`, x: x + 137160, y: 3985260, cx: 1219200, cy: 182880, text: card, size: 760, bold: true, color: visual.title });
  }).join("");
}

function metricAnomalyInsightRowsXml({ visual, palette, bullets }) {
  return bullets.slice(0, 3).map((bullet, index) => {
    const y = 2240280 + index * 365760;
    return solidShapeXml({ id: 2570 + index * 3, name: `Metric Anomaly Evidence Row ${index + 1}`, geom: "roundRect", x: 777240, y, cx: 3505200, cy: 243840, fill: palette.card })
      + solidShapeXml({ id: 2571 + index * 3, name: `Metric Anomaly Evidence Dot ${index + 1}`, geom: "ellipse", x: 929640, y: y + 76200, cx: 91440, cy: 91440, fill: index === 0 ? (visual.warning || "EF4444") : visual.accent })
      + textShapeXml({ id: 2572 + index * 3, name: `Metric Anomaly Evidence Text ${index + 1}`, x: 1112520, y: y + 60960, cx: 2895600, cy: 121920, text: metricAnomalyCompactText(bullet, "异常诊断证据", 30), size: 700, bold: true, color: visual.body });
  }).join("");
}

function metricAnomalyAttributionScene({ slide, index, role }) {
  const bullets = metricAnomalyBulletTexts(slide);
  const values = metricAnomalyMetricValues(bullets);
  const metrics = [
    { value: values[0], label: metricAnomalyCompactText(bullets[0], "异常幅度", 8) },
    { value: values[1], label: metricAnomalyCompactText(bullets[1], "影响范围", 8) },
    { value: values[2], label: metricAnomalyCompactText(bullets[2], "修复优先级", 8) },
  ];
  const roleText = String(role || "");
  const kind = index === 0 ? "cover" : roleText.includes("diagnosis") || roleText.includes("analysis") ? "cause" : roleText.includes("impact") ? "impact" : roleText.includes("action") ? "action" : roleText.includes("summary") || roleText.includes("closing") ? "closing" : ["overview", "cause", "impact", "action"][(index - 1) % 4];
  const cards = kind === "impact"
    ? ["影响等级", "持续时间", "责任模块", "业务损失"].map((fallback, itemIndex) => metricAnomalyCompactText(bullets[itemIndex], fallback, 12))
    : kind === "action" || kind === "closing"
      ? ["立即止损", "短期修复", "长期治理", "监控复盘"].map((fallback, itemIndex) => metricAnomalyCompactText(bullets[itemIndex], fallback, 12))
      : ["流量入口", "转化效率", "客单结构", "履约体验"].map((fallback, itemIndex) => metricAnomalyCompactText(bullets[itemIndex], fallback, 12));
  return {
    kind,
    kicker: kind === "cover" ? "ANOMALY SIGNAL" : kind === "overview" ? "THRESHOLD REVIEW" : kind === "cause" ? "CAUSE NETWORK" : kind === "impact" ? "IMPACT MATRIX" : kind === "action" ? "FIX ACTIONS" : "NEXT DIAGNOSIS LOOP",
    bullets,
    metrics,
    cards,
  };
}

function metricAnomalyBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.text || item.title || item.label || item.value || "").trim();
    return "";
  }).filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["核心指标偏离阈值并影响关键业务链路", "从流量、转化、客单和履约拆解潜在原因", "输出止损动作、责任模块和后续监控机制"];
}

function metricAnomalyMetricValues(bullets) {
  const matches = bullets.flatMap((item) => String(item).match(/[+-]?\d+(?:\.\d+)?%|\d+(?:\.\d+)?[万千亿]?|P[0-3]|S[1-4]/gi) || []);
  return [matches[0] || "-18.6%", matches[1] || "3条", matches[2] || "P1"];
}

function metricAnomalyCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}…`;
}

function metricAnomalyAttributionColorPalette(visual) {
  return {
    canvas: blendHexColor(visual.surface, visual.background, 0.94),
    panel: blendHexColor(visual.surface, visual.background, 0.88),
    card: blendHexColor("FFFFFF", visual.background, 0.90),
    frame: blendHexColor(visual.primary, visual.background, 0.74),
    grid: blendHexColor(visual.primary, visual.background, 0.88),
    axis: blendHexColor(visual.primary, visual.background, 0.72),
    softLine: blendHexColor("FFFFFF", visual.primary, 0.54),
    cyanFrame: blendHexColor(visual.accent, "FFFFFF", 0.10),
    redGlow: blendHexColor(visual.warning || "EF4444", visual.background, 0.84),
    cyanGlow: blendHexColor(visual.accent, visual.background, 0.84),
    violet: "8B5CF6",
  };
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

function operatingProblemTreeDecorationsXml({ visual, index, role, slide }) {
  // 经营问题诊断模板的导出图层用 DrawingML 直接绘制，保证下载 PPTX 和在线预览的主体结构一致。
  const palette = operatingProblemTreeColorPalette(visual);
  const scene = operatingProblemTreeExportScene({ slide, index, role });
  const header = rectShapeXml({ id: 2300, name: "Operating Problem Diagnosis Header", x: 0, y: 0, cx: 9144000, cy: 609600, fill: visual.primary })
    + rectShapeXml({ id: 2301, name: "Operating Problem Diagnosis Header Accent", x: 0, y: 579120, cx: 9144000, cy: 30480, fill: visual.accent })
    + solidShapeXml({ id: 2302, name: "Operating Problem Diagnosis Canvas", geom: "roundRect", x: 475488, y: 431292, cx: 8193024, cy: 4267200, fill: palette.canvas })
    + lineFrameShapeXml({ id: 2303, name: "Operating Problem Diagnosis Canvas Frame", geom: "roundRect", x: 475488, y: 431292, cx: 8193024, cy: 4267200, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 2304, name: "Operating Problem Diagnosis Rule", x: 731520, y: 2225040, cx: 2743200, cy: 30480, fill: visual.accent });
  const bullets = operatingProblemTreeBulletXml({ visual, scene });
  const base = header
    + textShapeXml({ id: 2305, name: "Operating Problem Diagnosis Kicker", x: 731520, y: 655320, cx: 2895600, cy: 274320, text: scene.kicker, size: 820, bold: true, color: visual.accent })
    + bullets;
  if (scene.kind === "cover" || scene.kind === "overview") {
    return base
      + operatingProblemTreeLensXml({ visual, palette })
      + operatingProblemTreeMetricCardsXml({ visual, scene, palette });
  }
  if (scene.kind === "impact") {
    return base
      + operatingProblemTreeRiskMatrixXml({ visual, palette })
      + operatingProblemTreeMetricCardsXml({ visual, scene, palette });
  }
  if (scene.kind === "action" || scene.kind === "closing") {
    return base
      + operatingProblemTreeActionCardsXml({ visual, scene, palette })
      + operatingProblemTreeLoopXml({ visual, palette });
  }
  return base
    + operatingProblemTreeBoardXml({ visual, scene, palette })
    + operatingProblemTreeLoopXml({ visual, palette });
}

function operatingProblemTreeBulletXml({ visual, scene }) {
  const body = scene.bullets.slice(0, 4).map((item) => paragraphXml(`• ${operatingProblemTreeCompactText(item, scene.title, 44)}`, 780, false, visual.body)).join("");
  return textShapeXml({ id: 2310, name: "Operating Problem Diagnosis Bullet List", x: 777240, y: 2514600, cx: 3352800, cy: 914400, body: body || paragraphXml("", 780, false, visual.body), size: 780, bold: false, color: visual.body });
}

function operatingProblemTreeLensXml({ visual, palette }) {
  return lineFrameShapeXml({ id: 2320, name: "Operating Problem Tree Lens", geom: "ellipse", x: 6248400, y: 1371600, cx: 1371600, cy: 1371600, stroke: visual.accent, width: 68580, transparency: 15000 })
    + lineFrameShapeXml({ id: 2321, name: "Operating Problem Tree Lens Inner", geom: "ellipse", x: 6446520, y: 1569720, cx: 975360, cy: 975360, stroke: palette.frame, width: 22860, transparency: 24000 })
    + lineFrameShapeXml({ id: 2322, name: "Operating Problem Tree Lens Handle", geom: "roundRect", x: 7406640, y: 2667000, cx: 822960, cy: 99060, stroke: visual.primary, width: 76200, rotation: 2700000 });
}

function operatingProblemTreeMetricCardsXml({ visual, scene, palette }) {
  return scene.metrics.slice(0, 3).map((metric, index) => {
    const x = 731520 + index * 1219200;
    return solidShapeXml({ id: 2330 + index * 3, name: `Operating Problem Tree Metric Card ${index + 1}`, geom: "roundRect", x, y: 3810000, cx: 1036320, cy: 533400, fill: palette.card })
      + rectShapeXml({ id: 2331 + index * 3, name: `Operating Problem Tree Metric Accent ${index + 1}`, x, y: 3810000, cx: 1036320, cy: 38100, fill: index === 1 ? visual.warning || visual.secondary : visual.accent })
      + textShapeXml({ id: 2332 + index * 3, name: `Operating Problem Tree Metric Text ${index + 1}`, x: x + 91440, y: 3924300, cx: 853440, cy: 304800, text: `${metric.value}\n${metric.label}`, size: 820, bold: true, color: visual.title });
  }).join("");
}

function operatingProblemTreeBoardXml({ visual, scene, palette }) {
  const board = solidShapeXml({ id: 2350, name: "Operating Problem Tree Board", geom: "roundRect", x: 5669280, y: 975360, cx: 2895600, cy: 2743200, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 2351, name: "Operating Problem Tree Board Frame", geom: "roundRect", x: 5669280, y: 975360, cx: 2895600, cy: 2743200, stroke: palette.frame, width: 15240 })
    + solidShapeXml({ id: 2352, name: "Operating Problem Tree Root Node", geom: "roundRect", x: 6477000, y: 1280160, cx: 1280160, cy: 518160, fill: visual.primary })
    + textShapeXml({ id: 2353, name: "Operating Problem Tree Root Text", x: 6576060, y: 1394460, cx: 1082040, cy: 243840, text: scene.root, size: 780, bold: true, color: "FFFFFF" })
    + rectShapeXml({ id: 2354, name: "Operating Problem Tree Trunk", x: 7117080, y: 1798320, cx: 22860, cy: 533400, fill: palette.frame })
    + rectShapeXml({ id: 2355, name: "Operating Problem Tree Branch Line", x: 6096000, y: 2331720, cx: 2133600, cy: 22860, fill: palette.frame });
  const branches = scene.branches.slice(0, 3).map((item, index) => {
    const x = 5928360 + index * 838200;
    return rectShapeXml({ id: 2360 + index * 4, name: `Operating Problem Tree Branch Connector ${index + 1}`, x: x + 381000, y: 2331720, cx: 22860, cy: 274320, fill: palette.frame })
      + solidShapeXml({ id: 2361 + index * 4, name: `Operating Problem Tree Branch ${index + 1}`, geom: "roundRect", x, y: 2606040, cx: 701040, cy: 655320, fill: palette.card })
      + rectShapeXml({ id: 2362 + index * 4, name: `Operating Problem Tree Branch Accent ${index + 1}`, x, y: 2606040, cx: 701040, cy: 45720, fill: index === 1 ? visual.warning || visual.secondary : visual.accent })
      + textShapeXml({ id: 2363 + index * 4, name: `Operating Problem Tree Branch Text ${index + 1}`, x: x + 60960, y: 2804160, cx: 579120, cy: 243840, text: item, size: 700, bold: true, color: visual.title });
  }).join("");
  return board + branches;
}

function operatingProblemTreeRiskMatrixXml({ visual, palette }) {
  const x = 5974080;
  const y = 1219200;
  return solidShapeXml({ id: 2380, name: "Operating Problem Tree Risk Matrix", geom: "roundRect", x, y, cx: 2438400, cy: 2286000, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 2381, name: "Operating Problem Tree Risk Matrix Frame", geom: "roundRect", x, y, cx: 2438400, cy: 2286000, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 2382, name: "Operating Problem Tree Risk Matrix X Axis", x: x + 274320, y: y + 1143000, cx: 1890000, cy: 19050, fill: palette.frame })
    + rectShapeXml({ id: 2383, name: "Operating Problem Tree Risk Matrix Y Axis", x: x + 1219200, y: y + 274320, cx: 19050, cy: 1737360, fill: palette.frame })
    + solidShapeXml({ id: 2384, name: "Operating Problem Tree Risk Dot 1", geom: "ellipse", x: x + 548640, y: y + 1371600, cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 2385, name: "Operating Problem Tree Risk Dot 2", geom: "ellipse", x: x + 1371600, y: y + 624840, cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 2386, name: "Operating Problem Tree Risk Dot 3", geom: "ellipse", x: x + 1767840, y: y + 883920, cx: 152400, cy: 152400, fill: visual.warning || visual.secondary })
    + solidShapeXml({ id: 2387, name: "Operating Problem Tree Risk Dot 4", geom: "ellipse", x: x + 1524000, y: y + 1554480, cx: 152400, cy: 152400, fill: visual.primary });
}

function operatingProblemTreeActionCardsXml({ visual, scene, palette }) {
  return scene.actions.slice(0, 4).map((item, index) => {
    const x = 5943600 + (index % 2) * 1219200;
    const y = 1219200 + Math.floor(index / 2) * 807720;
    return solidShapeXml({ id: 2400 + index * 2, name: `Operating Problem Tree Action Card ${index + 1}`, geom: "roundRect", x, y, cx: 1066800, cy: 609600, fill: palette.card })
      + textShapeXml({ id: 2401 + index * 2, name: `Operating Problem Tree Action Text ${index + 1}`, x: x + 91440, y: y + 198120, cx: 883920, cy: 243840, text: item, size: 760, bold: true, color: visual.title });
  }).join("");
}

function operatingProblemTreeLoopXml({ visual, palette }) {
  const y = 4152900;
  const xs = [1112520, 3429000, 5745480, 8061960];
  return rectShapeXml({ id: 2420, name: "Operating Problem Tree Fix Loop", x: 731520, y, cx: 7620000, cy: 30480, fill: visual.accent })
    + xs.map((x, index) => solidShapeXml({ id: 2421 + index, name: `Operating Problem Tree Fix Loop Node ${index + 1}`, geom: "ellipse", x, y: y - 76200, cx: 182880, cy: 182880, fill: index === 1 ? visual.warning || visual.secondary : index === 2 ? visual.primary : palette.card })).join("");
}

function operatingProblemTreeExportScene({ slide, index, role }) {
  const bullets = operatingProblemTreeExportBullets(slide);
  const kind = index === 0 ? "cover" : role === "closing" ? "closing" : ["overview", "diagnosis", "impact", "action"][(index - 1) % 4];
  return {
    kind,
    kicker: kind === "cover" ? "OPERATING DIAGNOSIS" : kind === "impact" ? "IMPACT PRIORITY" : kind === "action" ? "FIX LOOP" : kind === "closing" ? "NEXT REVIEW LOOP" : "ROOT CAUSE MAP",
    title: operatingProblemTreeCompactText(slide?.title, "经营问题诊断", 26),
    bullets,
    root: operatingProblemTreeCompactText(bullets[0], "核心问题", 12),
    branches: ["收入端", "成本端", "效率端"].map((fallback, itemIndex) => operatingProblemTreeCompactText(bullets[itemIndex], fallback, 12)),
    metrics: operatingProblemTreeExportMetrics(bullets),
    actions: ["止损动作", "责任归属", "周度复盘", "机制固化"].map((fallback, itemIndex) => operatingProblemTreeCompactText(bullets[itemIndex], fallback, 10)),
  };
}

function operatingProblemTreeExportBullets(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["经营指标出现异常，需要定位关键影响链路", "围绕收入、成本、效率拆解根因", "明确责任人与整改节奏形成闭环"];
}

function operatingProblemTreeExportMetrics(bullets) {
  const joined = bullets.join(" ");
  const matches = Array.from(joined.matchAll(/(?:同比|环比|下降|增长|提升|降低|利润|收入|成本|转化|流失)[^0-9%]{0,8}([+-]?\d+(?:\.\d+)?%?)/g)).map((match) => match[1]);
  const values = matches.length ? matches.slice(0, 3) : ["P1", "3", "7天"];
  return ["影响等级", "关键链路", "闭环周期"].map((label, index) => ({ label, value: values[index] || values[values.length - 1] || "-" }));
}

function operatingProblemTreeCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function operatingProblemTreeColorPalette(visual) {
  return {
    canvas: blendHexColor(visual.surface || "FFFFFF", visual.background || "F5F7FB", 0.16),
    card: blendHexColor(visual.surface || "FFFFFF", visual.background || "F5F7FB", 0.28),
    frame: blendHexColor(visual.primary || "17233B", visual.accent || "E94B3C", 0.22),
  };
}

function quarterlyDiagnosisDecorationsXml({ visual, index, layout }) {
  const scene = quarterlyDiagnosisScene(visual);
  const palette = quarterlyDiagnosisColorPalette(visual);
  const isCover = index === 0;
  const isClosing = index >= 3;
  const model = isCover
    ? quarterlyDiagnosisCoreModelXml({ visual, palette, x: 3749040, y: 1600200, cx: 2743200, cy: 1295400, idBase: 920, withText: true })
    : isClosing
      ? quarterlyDiagnosisActionPathXml({ visual, palette })
      : quarterlyDiagnosisCoreModelXml({ visual, palette, x: 3505200, y: 1524000, cx: 2743200, cy: 1447800, idBase: 920, withText: false });
  const sideCards = isCover
    ? quarterlyDiagnosisCoverNoteXml({ visual, scene })
    : isClosing
      ? quarterlyDiagnosisClosingTextXml({ visual, scene })
      : quarterlyDiagnosisSideCardsXml({ visual, scene, palette });
  return solidShapeXml({ id: 900, name: "Quarterly Diagnosis Surface", ...layout.surface, fill: visual.background })
    + rectShapeXml({ id: 901, name: "Quarterly Diagnosis Header", x: 0, y: 0, cx: 9144000, cy: 685800, fill: visual.surface })
    + rectShapeXml({ id: 902, name: "Quarterly Diagnosis Header Rule", x: 365760, y: 777240, cx: 8412480, cy: 22860, fill: visual.title })
    + textShapeXml({ id: 903, name: "Quarterly Diagnosis Section Label", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 850, bold: true, color: visual.title })
    + model
    + sideCards
    + rectShapeXml({ id: 904, name: "Quarterly Diagnosis Footer Rule", x: 365760, y: 4724400, cx: 8412480, cy: 15240, fill: palette.rule });
}

function quarterlyDiagnosisCoreModelXml({ visual, palette, x, y, cx, cy, idBase, withText }) {
  const leftWidth = Math.round(cx * 0.44);
  const rightWidth = Math.round(cx * 0.44);
  const centerX = x + Math.round(cx * 0.43);
  const rightX = x + cx - rightWidth;
  const labelXml = withText
    // 中文标签拆成独立文本框，避免 PowerPoint 在较窄三角区域中自动竖排或重叠。
    ? textShapeXml({ id: idBase + 10, name: "Quarterly Diagnosis Problem Text A", x: x + 289560, y: y + 472440, cx: 701040, cy: 182880, text: "存在", size: 1050, bold: true, color: "FFFFFF", fontFace: "Microsoft YaHei" })
      + textShapeXml({ id: idBase + 11, name: "Quarterly Diagnosis Problem Text B", x: x + 289560, y: y + 716280, cx: 701040, cy: 182880, text: "问题", size: 1050, bold: true, color: "FFFFFF", fontFace: "Microsoft YaHei" })
      + textShapeXml({ id: idBase + 12, name: "Quarterly Diagnosis Method Text A", x: rightX + 228600, y: y + 472440, cx: 701040, cy: 182880, text: "改进", size: 1050, bold: true, color: "FFFFFF", fontFace: "Microsoft YaHei" })
      + textShapeXml({ id: idBase + 13, name: "Quarterly Diagnosis Method Text B", x: rightX + 228600, y: y + 716280, cx: 701040, cy: 182880, text: "方法", size: 1050, bold: true, color: "FFFFFF", fontFace: "Microsoft YaHei" })
    : "";
  return solidShapeXml({ id: idBase, name: "Quarterly Diagnosis Problem Triangle", geom: "triangle", x, y: y + 152400, cx: leftWidth, cy: cy - 304800, fill: visual.primary })
    + solidShapeXml({ id: idBase + 1, name: "Quarterly Diagnosis Method Triangle", geom: "triangle", x: rightX, y: y + 152400, cx: rightWidth, cy: cy - 304800, fill: visual.accent })
    + solidShapeXml({ id: idBase + 2, name: "Quarterly Diagnosis Center Pivot", geom: "ellipse", x: centerX, y: y + Math.round(cy * 0.41), cx: 365760, cy: 365760, fill: visual.surface })
    + lineFrameShapeXml({ id: idBase + 3, name: "Quarterly Diagnosis Pivot Ring", geom: "ellipse", x: centerX, y: y + Math.round(cy * 0.41), cx: 365760, cy: 365760, stroke: palette.rule, width: 15240 })
    + solidShapeXml({ id: idBase + 4, name: "Quarterly Diagnosis Up Arrow", geom: "upArrow", x: x + Math.round(cx * 0.46), y: y - 30480, cx: 304800, cy: 365760, fill: palette.softGreen })
    + solidShapeXml({ id: idBase + 5, name: "Quarterly Diagnosis Down Arrow", geom: "downArrow", x: x + Math.round(cx * 0.46), y: y + cy - 335280, cx: 304800, cy: 365760, fill: palette.softBlue })
    + labelXml;
}

function quarterlyDiagnosisCoverNoteXml({ visual, scene }) {
  return solidShapeXml({ id: 950, name: "Quarterly Diagnosis Left Note", x: 731520, y: 1752600, cx: 2072640, cy: 396240, fill: visual.surface })
    + rectShapeXml({ id: 951, name: "Quarterly Diagnosis Left Note Stripe", x: 731520, y: 1752600, cx: 76200, cy: 396240, fill: visual.primary })
    + textShapeXml({ id: 952, name: "Quarterly Diagnosis Left Note Text", x: 883920, y: 1859280, cx: 1676400, cy: 152400, text: scene.leftCards[0], size: 760, bold: true, color: visual.title })
    + solidShapeXml({ id: 953, name: "Quarterly Diagnosis Right Note", x: 6751320, y: 3048000, cx: 2072640, cy: 396240, fill: visual.surface })
    + rectShapeXml({ id: 954, name: "Quarterly Diagnosis Right Note Stripe", x: 6751320, y: 3048000, cx: 76200, cy: 396240, fill: visual.accent })
    + textShapeXml({ id: 955, name: "Quarterly Diagnosis Right Note Text", x: 6903720, y: 3154680, cx: 1676400, cy: 152400, text: scene.rightCards[0], size: 760, bold: true, color: visual.title });
}

function quarterlyDiagnosisSideCardsXml({ visual, scene, palette }) {
  const leftCards = scene.leftCards.map((text, itemIndex) => {
    const y = 1371600 + itemIndex * 502920;
    return solidShapeXml({ id: 960 + itemIndex * 4, name: `Quarterly Diagnosis Problem Card ${itemIndex + 1}`, x: 518160, y, cx: 2133600, cy: 335280, fill: visual.surface })
      + rectShapeXml({ id: 961 + itemIndex * 4, name: `Quarterly Diagnosis Problem Stripe ${itemIndex + 1}`, x: 518160, y, cx: 76200, cy: 335280, fill: visual.primary })
      + textShapeXml({ id: 962 + itemIndex * 4, name: `Quarterly Diagnosis Problem Card Text ${itemIndex + 1}`, x: 670560, y: y + 91440, cx: 1676400, cy: 152400, text, size: 760, bold: true, color: visual.title });
  }).join("");
  const rightCards = scene.rightCards.map((text, itemIndex) => {
    const y = 1371600 + itemIndex * 502920;
    return solidShapeXml({ id: 980 + itemIndex * 4, name: `Quarterly Diagnosis Method Card ${itemIndex + 1}`, x: 6492240, y, cx: 2133600, cy: 335280, fill: visual.surface })
      + rectShapeXml({ id: 981 + itemIndex * 4, name: `Quarterly Diagnosis Method Stripe ${itemIndex + 1}`, x: 6492240, y, cx: 76200, cy: 335280, fill: visual.accent })
      + textShapeXml({ id: 982 + itemIndex * 4, name: `Quarterly Diagnosis Method Card Text ${itemIndex + 1}`, x: 6644640, y: y + 91440, cx: 1676400, cy: 152400, text, size: 760, bold: true, color: visual.title });
  }).join("");
  return leftCards + rightCards
    + [0, 1, 2, 3].map((itemIndex) => solidShapeXml({ id: 1000 + itemIndex, name: `Quarterly Diagnosis Evidence Pill ${itemIndex + 1}`, geom: "roundRect", x: 3185160 + itemIndex * 670560, y: 3810000, cx: 518160, cy: 198120, fill: itemIndex % 2 ? visual.accent : palette.softBlue })).join("");
}

function quarterlyDiagnosisActionPathXml({ visual, palette }) {
  return solidShapeXml({ id: 1040, name: "Quarterly Diagnosis Action Arrow 1", geom: "rightArrow", x: 4267200, y: 1524000, cx: 2133600, cy: 426720, fill: visual.primary })
    + solidShapeXml({ id: 1041, name: "Quarterly Diagnosis Action Arrow 2", geom: "rightArrow", x: 5029200, y: 2179320, cx: 2133600, cy: 426720, fill: visual.accent })
    + solidShapeXml({ id: 1042, name: "Quarterly Diagnosis Action Arrow 3", geom: "rightArrow", x: 5791200, y: 2834640, cx: 1524000, cy: 426720, fill: palette.softBlue });
}

function quarterlyDiagnosisClosingTextXml({ visual, scene }) {
  return textShapeXml({ id: 1050, name: "Quarterly Diagnosis Closing Title", x: 731520, y: 3200400, cx: 3200400, cy: 304800, text: scene.endingTitle, size: 1500, bold: true, color: visual.title })
    + textShapeXml({ id: 1051, name: "Quarterly Diagnosis Closing Caption", x: 731520, y: 3581400, cx: 3200400, cy: 243840, text: scene.endingCaption, size: 900, bold: true, color: visual.body });
}

function quarterlyDiagnosisColorPalette(visual) {
  return {
    rule: blendHexColor(visual.title, visual.background, 0.38),
    softBlue: blendHexColor(visual.primary, visual.background, 0.58),
    softGreen: blendHexColor(visual.accent, visual.background, 0.56),
  };
}

function quarterlyDiagnosisScene(visual) {
  const variant = quarterlyDiagnosisVariant(visual);
  const scenes = {
    "problem-diagnosis": {
      variant: "problem-diagnosis",
      kicker: "DIAGNOSIS REVIEW",
      section: "ISSUE ANALYSIS",
      endingTitle: "诊断结论与改善方向",
      endingCaption: "问题闭环 / 责任到人 / 下季追踪",
      leftCards: ["目标偏差", "过程断点", "资源瓶颈", "协同低效"],
      rightCards: ["原因归因", "优先级排序", "整改动作", "跟踪机制"],
    },
  };
  return scenes[variant] || scenes["problem-diagnosis"];
}

function quarterlyDiagnosisVariant(visual) {
  return ["problem-diagnosis"].includes(visual?.variant) ? visual.variant : "problem-diagnosis";
}

function quarterlyActionLoopDecorationsXml({ visual, index, layout, slide }) {
  const scene = quarterlyActionLoopScene(visual);
  const palette = quarterlyActionLoopColorPalette(visual);
  const isCover = index === 0;
  const isClosing = index >= 3;
  // 行动闭环模板参考用户提供的蓝白商务预览，主体全部用可编辑形状绘制。
  const base = solidShapeXml({ id: 1100, name: "Quarterly Action Loop Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + rectShapeXml({ id: 1101, name: "Quarterly Action Loop Header", x: 0, y: 0, cx: 9144000, cy: 685800, fill: visual.surface })
    + rectShapeXml({ id: 1102, name: "Quarterly Action Loop Header Rule", x: 365760, y: 777240, cx: 8412480, cy: 22860, fill: visual.primary })
    + solidShapeXml({ id: 1103, name: "Quarterly Action Loop Canvas", x: layout.surface.x, y: layout.surface.y, cx: layout.surface.cx, cy: layout.surface.cy, fill: visual.surface })
    + lineFrameShapeXml({ id: 1104, name: "Quarterly Action Loop Canvas Frame", geom: "rect", x: layout.surface.x, y: layout.surface.y, cx: layout.surface.cx, cy: layout.surface.cy, stroke: palette.frame, width: 11430 })
    + textShapeXml({ id: 1105, name: "Quarterly Action Loop Section Label", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 850, bold: true, color: visual.title })
    + rectShapeXml({ id: 1106, name: "Quarterly Action Loop Footer Rule", x: 365760, y: 4724400, cx: 8412480, cy: 22860, fill: visual.accent });

  if (isCover) {
    return base
      + solidShapeXml({ id: 1111, name: "Quarterly Action Loop Cover Pill", geom: "roundRect", x: 5265420, y: 1363980, cx: 2438400, cy: 228600, fill: visual.primary })
      + textShapeXml({ id: 1112, name: "Quarterly Action Loop Cover Pill Text", x: 5501640, y: 1409700, cx: 1905000, cy: 106680, text: "建立弹性化流程，提升精细化管理水平", size: 620, bold: true, color: "FFFFFF" })
      + quarterlyActionLoopContentCardXml({ visual, palette, slide, role: "cover" })
      + quarterlyActionLoopThreeColumnXml({ visual, palette, scene })
      + quarterlyActionLoopCoreXml({ visual, palette, x: 3505200, y: 2087880, cx: 2057400, cy: 1676400, idBase: 1160 });
  }

  if (isClosing) {
    return base
      + textShapeXml({ id: 1120, name: "Quarterly Action Loop Closing Title", x: 640080, y: 1600200, cx: 3505200, cy: 304800, text: scene.endingTitle, size: 1520, bold: true, color: visual.title })
      + textShapeXml({ id: 1121, name: "Quarterly Action Loop Closing Caption", x: 640080, y: 2057400, cx: 3657600, cy: 243840, text: scene.endingCaption, size: 900, bold: true, color: visual.body })
      + quarterlyActionLoopContentCardXml({ visual, palette, slide, role: "closing" })
      + quarterlyActionLoopRoadmapXml({ visual, palette, x: 4572000, y: 1676400, idBase: 1130 });
  }

  return base
    + quarterlyActionLoopContentCardXml({ visual, palette, slide, role: "content" })
    + quarterlyActionLoopPlanArrowXml({ visual, palette })
    + quarterlyActionLoopMatrixXml({ visual, palette, scene })
    + quarterlyActionLoopProgressXml({ visual, palette });
}

function quarterlyActionLoopContentCardXml({ visual, palette, slide, role }) {
  // 把用户编辑的标题和要点统一放进安全内容卡，避免默认标题/正文层和装饰图形互相覆盖。
  const bullets = Array.isArray(slide?.bullets)
    ? slide.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
    : [];
  const fallback = quarterlyActionLoopCompactText(slide?.title, "本页重点", 22);
  const title = quarterlyActionLoopCompactText(slide?.title, "本页重点", role === "cover" ? 42 : 48);
  const items = [title, ...bullets].filter(Boolean).slice(0, role === "cover" ? 3 : 4);
  const position = role === "cover"
    ? { x: 640080, y: 1379220, cx: 3505200, cy: 640080 }
    : role === "closing"
      ? { x: 640080, y: 2438400, cx: 3352800, cy: 944880 }
      : { x: 640080, y: 1714500, cx: 3505200, cy: 975360 };
  const textXml = items.map((item, index) => {
    const lineGap = role === "cover" ? 137160 : 167640;
    const y = position.y + 106680 + index * lineGap;
    const isTitle = index === 0;
    const text = isTitle
      ? quarterlyActionLoopCompactText(item, fallback, role === "cover" ? 38 : 44)
      : quarterlyActionLoopCompactText(item, fallback, role === "cover" ? 34 : 40);
    return textShapeXml({ id: 1322 + index, name: `Quarterly Action Loop Content Text ${index + 1}`, x: position.x + 198120, y, cx: position.cx - 396240, cy: isTitle ? 152400 : 121920, text, size: isTitle ? 680 : role === "cover" ? 520 : 560, bold: true, color: isTitle ? visual.title : visual.body })
      + rectShapeXml({ id: 1328 + index, name: `Quarterly Action Loop Content Stripe ${index + 1}`, x: position.x + 106680, y: y + 15240, cx: 30480, cy: isTitle ? 106680 : 91440, fill: isTitle ? visual.primary : visual.accent });
  }).join("");
  return solidShapeXml({ id: 1320, name: "Quarterly Action Loop Content Card", geom: "roundRect", ...position, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1321, name: "Quarterly Action Loop Content Card Frame", geom: "roundRect", ...position, stroke: palette.frame, width: 9525 })
    + textXml;
}

function quarterlyActionLoopThreeColumnXml({ visual, palette, scene }) {
  const columns = scene.columns.map((column, columnIndex) => {
    const x = 670560 + columnIndex * 2895600;
    const headerX = x + 670560;
    const cardXml = column.items.map((item, itemIndex) => {
      const y = 2240280 + itemIndex * 335280;
      return solidShapeXml({ id: 1200 + columnIndex * 30 + itemIndex * 3, name: `Quarterly Action Loop Task Card ${columnIndex + 1}-${itemIndex + 1}`, x: x + 152400, y, cx: 1676400, cy: 228600, fill: palette.card })
        + rectShapeXml({ id: 1201 + columnIndex * 30 + itemIndex * 3, name: `Quarterly Action Loop Task Card Rule ${columnIndex + 1}-${itemIndex + 1}`, x: x + 152400, y: y + 198120, cx: 1676400, cy: 30480, fill: columnIndex === 1 ? visual.accent : visual.primary })
        + textShapeXml({ id: 1202 + columnIndex * 30 + itemIndex * 3, name: `Quarterly Action Loop Task Text ${columnIndex + 1}-${itemIndex + 1}`, x: x + 304800, y: y + 60960, cx: 1371600, cy: 106680, text: item, size: 650, bold: true, color: visual.body });
    }).join("");
    return solidShapeXml({ id: 1190 + columnIndex * 3, name: `Quarterly Action Loop Column ${columnIndex + 1}`, x, y: 1866900, cx: 1981200, cy: 1981200, fill: "F8FBFF" })
      + lineFrameShapeXml({ id: 1191 + columnIndex * 3, name: `Quarterly Action Loop Column Frame ${columnIndex + 1}`, geom: "rect", x, y: 1866900, cx: 1981200, cy: 1981200, stroke: palette.frame, width: 9525 })
      + solidShapeXml({ id: 1192 + columnIndex * 3, name: `Quarterly Action Loop Column Header ${columnIndex + 1}`, geom: "roundRect", x: headerX, y: 1752600, cx: 914400, cy: 243840, fill: columnIndex === 1 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1193 + columnIndex * 3, name: `Quarterly Action Loop Column Header Text ${columnIndex + 1}`, x: headerX + 121920, y: 1813560, cx: 670560, cy: 106680, text: column.title, size: 660, bold: true, color: "FFFFFF" })
      + cardXml;
  }).join("");
  return columns;
}

function quarterlyActionLoopCoreXml({ visual, palette, x, y, cx, cy, idBase }) {
  return arcLineShapeXml({ id: idBase, name: "Quarterly Action Loop Core Spiral A", x, y, cx, cy, stroke: visual.accent, width: 38100 })
    + arcLineShapeXml({ id: idBase + 1, name: "Quarterly Action Loop Core Spiral B", x: x + 152400, y: y + 304800, cx: cx - 304800, cy: cy - 609600, stroke: visual.primary, width: 30480 })
    + solidShapeXml({ id: idBase + 2, name: "Quarterly Action Loop Core Dot", geom: "ellipse", x: x + Math.round(cx * 0.44), y: y + Math.round(cy * 0.42), cx: 243840, cy: 243840, fill: palette.softBlue })
    + textShapeXml({ id: idBase + 3, name: "Quarterly Action Loop Core Text", x: x + 426720, y: y + 731520, cx: 1219200, cy: 365760, text: "计划\n执行\n检查\n复盘", size: 780, bold: true, color: visual.title });
}

function quarterlyActionLoopPlanArrowXml({ visual, palette }) {
  const labels = ["计划", "执行", "检查", "复盘"];
  return labels.map((label, itemIndex) => {
    const x = 685800 + itemIndex * 1981200;
    return solidShapeXml({ id: 1260 + itemIndex * 3, name: `Quarterly Action Loop Roadmap Arrow ${itemIndex + 1}`, geom: "rightArrow", x, y: 3657600, cx: 1905000, cy: 365760, fill: itemIndex % 2 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1261 + itemIndex * 3, name: `Quarterly Action Loop Roadmap Text ${itemIndex + 1}`, x: x + 533400, y: 3764280, cx: 670560, cy: 121920, text: label, size: 760, bold: true, color: "FFFFFF" });
  }).join("")
    + rectShapeXml({ id: 1274, name: "Quarterly Action Loop Roadmap Baseline", x: 670560, y: 4267200, cx: 7772400, cy: 30480, fill: palette.softBlue });
}

function quarterlyActionLoopMatrixXml({ visual, palette, scene }) {
  return scene.owners.map((owner, itemIndex) => {
    const x = 4572000 + itemIndex * 1219200;
    return solidShapeXml({ id: 1280 + itemIndex * 3, name: `Quarterly Action Loop Owner Matrix ${itemIndex + 1}`, geom: "roundRect", x, y: 1600200, cx: 1066800, cy: 731520, fill: "FFFFFF" })
      + rectShapeXml({ id: 1281 + itemIndex * 3, name: `Quarterly Action Loop Owner Matrix Rule ${itemIndex + 1}`, x, y: 1600200, cx: 1066800, cy: 60960, fill: itemIndex === 1 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1282 + itemIndex * 3, name: `Quarterly Action Loop Owner Matrix Text ${itemIndex + 1}`, x: x + 152400, y: 1905000, cx: 762000, cy: 152400, text: owner, size: 820, bold: true, color: visual.title });
  }).join("");
}

function quarterlyActionLoopProgressXml({ visual, palette }) {
  const bars = [0.32, 0.5, 0.7, 0.48, 0.82].map((ratio, index) => {
    const cy = Math.round(640080 * ratio);
    return solidShapeXml({ id: 1300 + index, name: `Quarterly Action Loop Progress Bar ${index + 1}`, geom: "roundRect", x: 1066800 + index * 426720, y: 3406140 - cy, cx: 182880, cy, fill: index > 2 ? visual.accent : visual.primary });
  }).join("");
  return solidShapeXml({ id: 1290, name: "Quarterly Action Loop Progress Panel", geom: "roundRect", x: 731520, y: 2590800, cx: 3048000, cy: 990600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 1291, name: "Quarterly Action Loop Progress Frame", geom: "roundRect", x: 731520, y: 2590800, cx: 3048000, cy: 990600, stroke: palette.frame, width: 9525 })
    + textShapeXml({ id: 1292, name: "Quarterly Action Loop Progress Title", x: 914400, y: 2743200, cx: 1371600, cy: 152400, text: "执行进度", size: 760, bold: true, color: visual.title })
    + bars;
}

function quarterlyActionLoopRoadmapXml({ visual, palette, x, y, idBase }) {
  const labels = ["目标拆解", "执行追踪", "结果复盘", "下季优化"];
  return labels.map((label, itemIndex) => {
    const cardX = x + itemIndex * 990600;
    return solidShapeXml({ id: idBase + itemIndex * 3, name: `Quarterly Action Loop Closing Card ${itemIndex + 1}`, geom: "roundRect", x: cardX, y, cx: 838200, cy: 609600, fill: itemIndex % 2 ? palette.card : "FFFFFF" })
      + lineFrameShapeXml({ id: idBase + itemIndex * 3 + 1, name: `Quarterly Action Loop Closing Card Frame ${itemIndex + 1}`, geom: "roundRect", x: cardX, y, cx: 838200, cy: 609600, stroke: palette.frame, width: 9525 })
      + textShapeXml({ id: idBase + itemIndex * 3 + 2, name: `Quarterly Action Loop Closing Card Text ${itemIndex + 1}`, x: cardX + 91440, y: y + 228600, cx: 655320, cy: 121920, text: label, size: 700, bold: true, color: visual.title });
  }).join("");
}

function quarterlyActionLoopColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.28),
    frame: blendHexColor(visual.primary, visual.surface, 0.34),
    softBlue: blendHexColor(visual.accent, visual.background, 0.58),
  };
}

function quarterlyActionLoopCompactText(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function quarterlyActionLoopScene(visual) {
  const variant = quarterlyActionLoopVariant(visual);
  const scenes = {
    "action-loop": {
      variant: "action-loop",
      kicker: "ACTION LOOP REVIEW",
      section: "EXECUTION CLOSED LOOP",
      coverTitle: "2026-2025 季度重点工作行动闭环",
      endingTitle: "复盘沉淀与下一步行动",
      endingCaption: "目标拆解 / 执行追踪 / 结果复盘 / 持续优化",
      columns: [
        { title: "目标拆解", items: ["完成经营目标", "明确关键动作", "分解重点项目", "沉淀检查标准"] },
        { title: "执行追踪", items: ["任务看板", "周度同步", "风险预警", "资源协调"] },
        { title: "结果复盘", items: ["目标达成", "经验沉淀", "问题修复", "下季计划"] },
      ],
      owners: ["负责人", "协同部门", "截止日期"],
    },
  };
  return scenes[variant] || scenes["action-loop"];
}

function quarterlyActionLoopVariant(visual) {
  return ["action-loop"].includes(visual?.variant) ? visual.variant : "action-loop";
}

function quarterlyActionLoopDecorationsXmlV2({ visual, index, layout, slide }) {
  const scene = quarterlyActionLoopSceneV2();
  const palette = quarterlyActionLoopColorPalette(visual);
  const isCover = index === 0;
  const isClosing = index >= 3;
  // 新版行动闭环模板采用“复盘作战室”布局，预览与 PPTX 共用同一套结构语义。
  const base = solidShapeXml({ id: 2100, name: "Quarterly Action Loop V2 Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: visual.background })
    + rectShapeXml({ id: 2101, name: "Quarterly Action Loop V2 Top Bar", x: 0, y: 0, cx: 9144000, cy: 594360, fill: visual.surface })
    + rectShapeXml({ id: 2102, name: "Quarterly Action Loop V2 Rule", x: 396240, y: 716280, cx: 8351520, cy: 24384, fill: visual.primary })
    + solidShapeXml({ id: 2103, name: "Quarterly Action Loop V2 Canvas", geom: "roundRect", x: layout.surface.x, y: layout.surface.y, cx: layout.surface.cx, cy: layout.surface.cy, fill: visual.surface })
    + lineFrameShapeXml({ id: 2104, name: "Quarterly Action Loop V2 Canvas Frame", geom: "roundRect", x: layout.surface.x, y: layout.surface.y, cx: layout.surface.cx, cy: layout.surface.cy, stroke: palette.frame, width: 11430 })
    + textShapeXml({ id: 2105, name: "Quarterly Action Loop V2 Section Label", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 850, bold: true, color: visual.title })
    + rectShapeXml({ id: 2106, name: "Quarterly Action Loop V2 Footer Rule", x: 396240, y: 4724400, cx: 8351520, cy: 24384, fill: visual.accent })
    + quarterlyActionLoopCornerMarksXmlV2({ visual, palette });

  if (isCover) {
    return base
      + solidShapeXml({ id: 2110, name: "Quarterly Action Loop V2 Cover Pill", geom: "roundRect", x: 5265420, y: 1333500, cx: 2438400, cy: 243840, fill: visual.primary })
      + textShapeXml({ id: 2111, name: "Quarterly Action Loop V2 Cover Pill Text", x: 5501640, y: 1394460, cx: 1905000, cy: 106680, text: "复盘结论转行动，责任节点可追踪", size: 620, bold: true, color: "FFFFFF" })
      + quarterlyActionLoopContentCardXmlV2({ visual, palette, slide, role: "cover" })
      + quarterlyActionLoopThreeColumnXmlV2({ visual, palette, scene })
      + quarterlyActionLoopCoreXmlV2({ visual, palette, x: 3505200, y: 2087880, cx: 2057400, cy: 1676400, idBase: 2160 });
  }

  if (isClosing) {
    return base
      + textShapeXml({ id: 2120, name: "Quarterly Action Loop V2 Closing Title", x: 640080, y: 1600200, cx: 3505200, cy: 304800, text: scene.endingTitle, size: 1520, bold: true, color: visual.title })
      + textShapeXml({ id: 2121, name: "Quarterly Action Loop V2 Closing Caption", x: 640080, y: 2057400, cx: 3657600, cy: 243840, text: scene.endingCaption, size: 900, bold: true, color: visual.body })
      + quarterlyActionLoopContentCardXmlV2({ visual, palette, slide, role: "closing" })
      + quarterlyActionLoopRoadmapXmlV2({ visual, palette, x: 4572000, y: 1676400, idBase: 2130 });
  }

  return base
    + quarterlyActionLoopContentCardXmlV2({ visual, palette, slide, role: "content" })
    + quarterlyActionLoopPlanArrowXmlV2({ visual })
    + quarterlyActionLoopMatrixXmlV2({ visual, palette, scene })
    + quarterlyActionLoopProgressXmlV2({ visual, palette });
}

function quarterlyActionLoopCornerMarksXmlV2({ visual, palette }) {
  return solidShapeXml({ id: 2180, name: "Quarterly Action Loop V2 Left Rail", x: 274320, y: 396240, cx: 457200, cy: 1371600, fill: visual.primary })
    + solidShapeXml({ id: 2181, name: "Quarterly Action Loop V2 Top Tab", x: 8382000, y: 350520, cx: 487680, cy: 320040, fill: visual.primary })
    + solidShapeXml({ id: 2182, name: "Quarterly Action Loop V2 Soft Tab", x: 7924800, y: 426720, cx: 762000, cy: 259080, fill: palette.softBlue })
    + solidShapeXml({ id: 2183, name: "Quarterly Action Loop V2 Accent Dot", geom: "ellipse", x: 823000, y: 4244340, cx: 152400, cy: 152400, fill: visual.accent });
}

function quarterlyActionLoopContentCardXmlV2({ visual, palette, slide, role }) {
  // 用户输入标题与要点集中进入内容卡片，避免和任务矩阵、时间轴装饰层重叠。
  const bullets = Array.isArray(slide?.bullets)
    ? slide.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
    : [];
  const fallback = quarterlyActionLoopCompactTextV2(slide?.title, "本页重点", 22);
  const title = quarterlyActionLoopCompactTextV2(slide?.title, "本页重点", role === "cover" ? 42 : 48);
  const items = [title, ...bullets].filter(Boolean).slice(0, role === "cover" ? 3 : 4);
  const position = role === "cover"
    ? { x: 640080, y: 1379220, cx: 3505200, cy: 640080 }
    : role === "closing"
      ? { x: 640080, y: 2438400, cx: 3352800, cy: 944880 }
      : { x: 640080, y: 1714500, cx: 3505200, cy: 975360 };
  const textXml = items.map((item, itemIndex) => {
    const lineGap = role === "cover" ? 137160 : 167640;
    const y = position.y + 106680 + itemIndex * lineGap;
    const isTitle = itemIndex === 0;
    const text = quarterlyActionLoopCompactTextV2(item, fallback, isTitle ? 38 : 40);
    return textShapeXml({ id: 2322 + itemIndex, name: `Quarterly Action Loop V2 Content Text ${itemIndex + 1}`, x: position.x + 198120, y, cx: position.cx - 396240, cy: isTitle ? 152400 : 121920, text, size: isTitle ? 680 : role === "cover" ? 520 : 560, bold: true, color: isTitle ? visual.title : visual.body })
      + rectShapeXml({ id: 2328 + itemIndex, name: `Quarterly Action Loop V2 Content Stripe ${itemIndex + 1}`, x: position.x + 106680, y: y + 15240, cx: 30480, cy: isTitle ? 106680 : 91440, fill: isTitle ? visual.primary : visual.accent });
  }).join("");
  return solidShapeXml({ id: 2320, name: "Quarterly Action Loop V2 Content Card", geom: "roundRect", ...position, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 2321, name: "Quarterly Action Loop V2 Content Card Frame", geom: "roundRect", ...position, stroke: palette.frame, width: 9525 })
    + textXml;
}

function quarterlyActionLoopThreeColumnXmlV2({ visual, palette, scene }) {
  return scene.columns.map((column, columnIndex) => {
    const x = 670560 + columnIndex * 2895600;
    const headerX = x + 670560;
    const cardXml = column.items.map((item, itemIndex) => {
      const y = 2240280 + itemIndex * 335280;
      return solidShapeXml({ id: 2200 + columnIndex * 30 + itemIndex * 3, name: `Quarterly Action Loop V2 Task Card ${columnIndex + 1}-${itemIndex + 1}`, x: x + 152400, y, cx: 1676400, cy: 228600, fill: palette.card })
        + rectShapeXml({ id: 2201 + columnIndex * 30 + itemIndex * 3, name: `Quarterly Action Loop V2 Task Rule ${columnIndex + 1}-${itemIndex + 1}`, x: x + 152400, y: y + 198120, cx: 1676400, cy: 30480, fill: columnIndex === 1 ? visual.accent : visual.primary })
        + textShapeXml({ id: 2202 + columnIndex * 30 + itemIndex * 3, name: `Quarterly Action Loop V2 Task Text ${columnIndex + 1}-${itemIndex + 1}`, x: x + 304800, y: y + 60960, cx: 1371600, cy: 106680, text: item, size: 650, bold: true, color: visual.body });
    }).join("");
    return solidShapeXml({ id: 2190 + columnIndex * 3, name: `Quarterly Action Loop V2 Column ${columnIndex + 1}`, x, y: 1866900, cx: 1981200, cy: 1981200, fill: "F8FBFF" })
      + lineFrameShapeXml({ id: 2191 + columnIndex * 3, name: `Quarterly Action Loop V2 Column Frame ${columnIndex + 1}`, geom: "rect", x, y: 1866900, cx: 1981200, cy: 1981200, stroke: palette.frame, width: 9525 })
      + solidShapeXml({ id: 2192 + columnIndex * 3, name: `Quarterly Action Loop V2 Column Header ${columnIndex + 1}`, geom: "roundRect", x: headerX, y: 1752600, cx: 914400, cy: 243840, fill: columnIndex === 1 ? visual.accent : visual.primary })
      + textShapeXml({ id: 2193 + columnIndex * 3, name: `Quarterly Action Loop V2 Column Header Text ${columnIndex + 1}`, x: headerX + 121920, y: 1813560, cx: 670560, cy: 106680, text: column.title, size: 660, bold: true, color: "FFFFFF" })
      + cardXml;
  }).join("");
}

function quarterlyActionLoopCoreXmlV2({ visual, palette, x, y, cx, cy, idBase }) {
  return arcLineShapeXml({ id: idBase, name: "Quarterly Action Loop V2 Core Orbit A", x, y, cx, cy, stroke: visual.accent, width: 38100 })
    + arcLineShapeXml({ id: idBase + 1, name: "Quarterly Action Loop V2 Core Orbit B", x: x + 152400, y: y + 304800, cx: cx - 304800, cy: cy - 609600, stroke: visual.primary, width: 30480 })
    + solidShapeXml({ id: idBase + 2, name: "Quarterly Action Loop V2 Core Dot", geom: "ellipse", x: x + Math.round(cx * 0.44), y: y + Math.round(cy * 0.42), cx: 243840, cy: 243840, fill: palette.softBlue })
    + textShapeXml({ id: idBase + 3, name: "Quarterly Action Loop V2 Core Text", x: x + 426720, y: y + 731520, cx: 1219200, cy: 365760, text: "计划\n执行\n检查\n复盘", size: 780, bold: true, color: visual.title });
}

function quarterlyActionLoopPlanArrowXmlV2({ visual }) {
  return ["计划", "执行", "检查", "复盘"].map((label, itemIndex) => {
    const x = 685800 + itemIndex * 1981200;
    return solidShapeXml({ id: 2260 + itemIndex * 3, name: `Quarterly Action Loop V2 Roadmap Arrow ${itemIndex + 1}`, geom: "rightArrow", x, y: 3657600, cx: 1905000, cy: 365760, fill: itemIndex % 2 ? visual.accent : visual.primary })
      + textShapeXml({ id: 2261 + itemIndex * 3, name: `Quarterly Action Loop V2 Roadmap Text ${itemIndex + 1}`, x: x + 533400, y: 3764280, cx: 670560, cy: 121920, text: label, size: 760, bold: true, color: "FFFFFF" });
  }).join("");
}

function quarterlyActionLoopMatrixXmlV2({ visual, palette, scene }) {
  return scene.owners.map((owner, itemIndex) => {
    const x = 4572000 + itemIndex * 1219200;
    return solidShapeXml({ id: 2280 + itemIndex * 3, name: `Quarterly Action Loop V2 Owner Matrix ${itemIndex + 1}`, geom: "roundRect", x, y: 1600200, cx: 1066800, cy: 731520, fill: "FFFFFF" })
      + rectShapeXml({ id: 2281 + itemIndex * 3, name: `Quarterly Action Loop V2 Owner Matrix Rule ${itemIndex + 1}`, x, y: 1600200, cx: 1066800, cy: 60960, fill: itemIndex === 1 ? visual.accent : visual.primary })
      + textShapeXml({ id: 2282 + itemIndex * 3, name: `Quarterly Action Loop V2 Owner Matrix Text ${itemIndex + 1}`, x: x + 152400, y: 1905000, cx: 762000, cy: 152400, text: owner, size: 820, bold: true, color: visual.title });
  }).join("");
}

function quarterlyActionLoopProgressXmlV2({ visual, palette }) {
  const bars = [0.32, 0.5, 0.7, 0.48, 0.82].map((ratio, index) => {
    const cy = Math.round(640080 * ratio);
    return solidShapeXml({ id: 2300 + index, name: `Quarterly Action Loop V2 Progress Bar ${index + 1}`, geom: "roundRect", x: 1066800 + index * 426720, y: 3406140 - cy, cx: 182880, cy, fill: index > 2 ? visual.accent : visual.primary });
  }).join("");
  return solidShapeXml({ id: 2290, name: "Quarterly Action Loop V2 Progress Panel", geom: "roundRect", x: 731520, y: 2590800, cx: 3048000, cy: 990600, fill: "FFFFFF" })
    + lineFrameShapeXml({ id: 2291, name: "Quarterly Action Loop V2 Progress Frame", geom: "roundRect", x: 731520, y: 2590800, cx: 3048000, cy: 990600, stroke: palette.frame, width: 9525 })
    + textShapeXml({ id: 2292, name: "Quarterly Action Loop V2 Progress Title", x: 914400, y: 2743200, cx: 1371600, cy: 152400, text: "执行进度", size: 760, bold: true, color: visual.title })
    + bars;
}

function quarterlyActionLoopRoadmapXmlV2({ visual, palette, x, y, idBase }) {
  return ["目标拆解", "执行追踪", "结果复盘", "下季优化"].map((label, itemIndex) => {
    const cardX = x + itemIndex * 990600;
    return solidShapeXml({ id: idBase + itemIndex * 3, name: `Quarterly Action Loop V2 Closing Card ${itemIndex + 1}`, geom: "roundRect", x: cardX, y, cx: 838200, cy: 609600, fill: itemIndex % 2 ? palette.card : "FFFFFF" })
      + lineFrameShapeXml({ id: idBase + itemIndex * 3 + 1, name: `Quarterly Action Loop V2 Closing Card Frame ${itemIndex + 1}`, geom: "roundRect", x: cardX, y, cx: 838200, cy: 609600, stroke: palette.frame, width: 9525 })
      + textShapeXml({ id: idBase + itemIndex * 3 + 2, name: `Quarterly Action Loop V2 Closing Card Text ${itemIndex + 1}`, x: cardX + 91440, y: y + 228600, cx: 655320, cy: 121920, text: label, size: 700, bold: true, color: visual.title });
  }).join("");
}

function quarterlyActionLoopCompactTextV2(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function quarterlyActionLoopSceneV2() {
  return {
    variant: "action-loop",
    kicker: "ACTION LOOP REVIEW",
    section: "EXECUTION CLOSED LOOP",
    endingTitle: "复盘沉淀与下一步行动",
    endingCaption: "目标拆解 / 执行追踪 / 结果复盘 / 持续优化",
    columns: [
      { title: "目标拆解", items: ["锁定经营目标", "明确关键动作", "分解重点项目", "沉淀检查标准"] },
      { title: "执行追踪", items: ["任务看板", "周度同步", "风险预警", "资源协调"] },
      { title: "结果复盘", items: ["目标达成", "经验沉淀", "问题修复", "下季计划"] },
    ],
    owners: ["负责人", "协同部门", "截止日期"],
  };
}

function businessOpportunityMapDecorationsXml({ visual, index, role, slide }) {
  const scene = businessOpportunityMapSceneFromSlide({ slide, index, role });
  const palette = businessOpportunityMapColorPalette(visual);
  // 机会地图模板主体用 DrawingML 图形实现，导出的 PPTX 可继续编辑节点、卡片和路径。
  const backdrop = rectShapeXml({ id: 2300, name: "Business Opportunity Map Background", x: 0, y: 0, cx: 9144000, cy: 5143500, fill: palette.backdrop })
    + solidShapeXml({ id: 2301, name: "Business Opportunity Glow Green", geom: "ellipse", x: 6934200, y: 213360, cx: 1905000, cy: 1447800, fill: palette.softAccent })
    + solidShapeXml({ id: 2302, name: "Business Opportunity Glow Gold", geom: "ellipse", x: 228600, y: 3657600, cx: 1828800, cy: 1219200, fill: palette.softGold });
  const surface = solidShapeXml({ id: 2303, name: "Business Opportunity Canvas", geom: "roundRect", x: 512064, y: 442976, cx: 8120000, cy: 4260000, fill: visual.surface })
    + lineFrameShapeXml({ id: 2304, name: "Business Opportunity Canvas Border", geom: "roundRect", x: 512064, y: 442976, cx: 8120000, cy: 4260000, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 2305, name: "Business Opportunity Top Rule", x: 512064, y: 442976, cx: 8120000, cy: 57150, fill: visual.primary })
    + rectShapeXml({ id: 2306, name: "Business Opportunity Accent Rule", x: 512064, y: 500126, cx: 8120000, cy: 22860, fill: visual.accent });
  const header = textShapeXml({ id: 2307, name: "Business Opportunity Kicker", x: 768096, y: 731520, cx: 2438400, cy: 274320, text: scene.kicker, size: 740, bold: true, color: visual.accent })
    + rectShapeXml({ id: 2308, name: "Business Opportunity Focus Rule", x: 768096, y: index === 0 ? 2164080 : 1996440, cx: 3169920, cy: 30480, fill: palette.gold });
  const content = businessOpportunityTextBlockXml({ visual, palette, scene, slide, index });
  if (scene.role === "analysis") return backdrop + surface + header + content + businessOpportunityQuadrantsXml({ visual, palette, items: scene.cards });
  if (scene.role === "path") return backdrop + surface + header + content + businessOpportunityPathXml({ visual, palette, items: scene.steps });
  if (scene.role === "actions") return backdrop + surface + header + content + businessOpportunityActionGridXml({ visual, palette, items: scene.cards });
  if (scene.role === "closing") return backdrop + surface + header + content + businessOpportunityClosingXml({ visual, palette }) + businessOpportunityPathXml({ visual, palette, items: scene.steps });
  return backdrop + surface + header + content + businessOpportunityMapPanelXml({ visual, palette }) + businessOpportunityMetricsXml({ visual, palette, metrics: scene.metrics });
}

function businessOpportunityTextBlockXml({ visual, palette, scene, slide, index }) {
  const title = businessOpportunityCompactText(slide?.title || scene.title, scene.title, index === 0 ? 30 : 28);
  const note = businessOpportunityCompactText(String(slide?.speakerNotes || scene.summary || "").replace(/作者：[^。；;]*/g, ""), scene.summary, 42);
  const bullets = businessOpportunityBulletTexts(slide).slice(0, 3).map((item, bulletIndex) => (
    textShapeXml({
      id: 2320 + bulletIndex,
      name: `Business Opportunity Bullet ${bulletIndex + 1}`,
      x: 792480,
      y: 2674620 + bulletIndex * 274320,
      cx: 3429000,
      cy: 182880,
      text: `• ${businessOpportunityCompactText(item, "", 32)}`,
      size: 760,
      bold: false,
      color: visual.body,
    })
  )).join("");
  return textShapeXml({ id: 2310, name: "Business Opportunity Title", x: 768096, y: index === 0 ? 1066800 : 914400, cx: 3962400, cy: index === 0 ? 1066800 : 792480, text: title, size: index === 0 ? 2450 : 1800, bold: true, color: visual.title })
    + textShapeXml({ id: 2311, name: "Business Opportunity Summary", x: 792480, y: index === 0 ? 2286000 : 1752600, cx: 3429000, cy: 365760, text: note, size: 740, bold: true, color: palette.muted })
    + bullets;
}

function businessOpportunityMapPanelXml({ visual, palette }) {
  const panel = solidShapeXml({ id: 2340, name: "Business Opportunity Map Panel", geom: "roundRect", x: 5486400, y: 975360, cx: 3048000, cy: 2438400, fill: palette.panel })
    + lineFrameShapeXml({ id: 2341, name: "Business Opportunity Map Border", geom: "roundRect", x: 5486400, y: 975360, cx: 3048000, cy: 2438400, stroke: palette.frame, width: 10160 });
  const grid = [0, 1, 2, 3].map((item) => {
    const x = 5791200 + item * 594360;
    return lineFrameShapeXml({ id: 2342 + item, name: `Business Opportunity Map Grid V ${item + 1}`, x, y: 1219200, cx: 0, cy: 1828800, stroke: palette.grid, width: 6350, transparency: 58000 });
  }).join("") + [0, 1, 2].map((item) => {
    const y = 1371600 + item * 457200;
    return lineFrameShapeXml({ id: 2350 + item, name: `Business Opportunity Map Grid H ${item + 1}`, x: 5791200, y, cx: 2438400, cy: 0, stroke: palette.grid, width: 6350, transparency: 58000 });
  }).join("");
  const path = rectShapeXml({ id: 2354, name: "Business Opportunity Growth Route", x: 5892800, y: 2712720, cx: 2133600, cy: 57150, fill: visual.accent })
    + solidShapeXml({ id: 2355, name: "Business Opportunity Route Arrow", geom: "triangle", x: 7886700, y: 2606040, cx: 243840, cy: 274320, fill: visual.accent });
  const nodes = [
    { x: 5867400, y: 2651760, fill: visual.accent },
    { x: 6545580, y: 2225040, fill: palette.gold },
    { x: 7241540, y: 1973580, fill: visual.accent },
    { x: 7833360, y: 1615440, fill: palette.orange },
  ].map((node, item) => solidShapeXml({ id: 2360 + item, name: `Business Opportunity Node ${item + 1}`, geom: "ellipse", x: node.x, y: node.y, cx: 182880, cy: 182880, fill: node.fill })).join("");
  return panel + grid + path + nodes;
}

function businessOpportunityMetricsXml({ visual, palette, metrics }) {
  return metrics.slice(0, 3).map((metric, index) => {
    const x = 792480 + index * 1219200;
    return solidShapeXml({ id: 2370 + index * 3, name: `Business Opportunity Metric ${index + 1}`, geom: "roundRect", x, y: 3703320, cx: 975360, cy: 579120, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 2371 + index * 3, name: `Business Opportunity Metric Border ${index + 1}`, geom: "roundRect", x, y: 3703320, cx: 975360, cy: 579120, stroke: palette.frame, width: 10160 })
      + textShapeXml({ id: 2372 + index * 3, name: `Business Opportunity Metric Text ${index + 1}`, x: x + 121920, y: 3825240, cx: 731520, cy: 274320, text: `${metric.value} ${metric.label}`, size: 740, bold: true, color: index === 1 ? palette.gold : visual.title });
  }).join("");
}

function businessOpportunityQuadrantsXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5486400 + col * 1524000;
    const y = 1097280 + row * 914400;
    return solidShapeXml({ id: 2380 + index * 4, name: `Business Opportunity Quadrant ${index + 1}`, geom: "roundRect", x, y, cx: 1280160, cy: 701040, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 2381 + index * 4, name: `Business Opportunity Quadrant Border ${index + 1}`, geom: "roundRect", x, y, cx: 1280160, cy: 701040, stroke: palette.frame, width: 10160 })
      + rectShapeXml({ id: 2382 + index * 4, name: `Business Opportunity Quadrant Accent ${index + 1}`, x: x + 152400, y: y + 137160, cx: 365760, cy: 45720, fill: index === 1 ? palette.gold : visual.accent })
      + textShapeXml({ id: 2383 + index * 4, name: `Business Opportunity Quadrant Text ${index + 1}`, x: x + 152400, y: y + 274320, cx: 944880, cy: 243840, text: businessOpportunityCompactText(item, "", 12), size: 760, bold: true, color: visual.title });
  }).join("");
}

function businessOpportunityPathXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 914400 + index * 1828800;
    return solidShapeXml({ id: 2410 + index * 4, name: `Business Opportunity Path Step ${index + 1}`, geom: "roundRect", x, y: 3601720, cx: 1447800, cy: 640080, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 2411 + index * 4, name: `Business Opportunity Path Border ${index + 1}`, geom: "roundRect", x, y: 3601720, cx: 1447800, cy: 640080, stroke: palette.frame, width: 10160 })
      + textShapeXml({ id: 2412 + index * 4, name: `Business Opportunity Path Number ${index + 1}`, x: x + 137160, y: 3733800, cx: 274320, cy: 213360, text: String(index + 1).padStart(2, "0"), size: 860, bold: true, color: visual.accent })
      + textShapeXml({ id: 2413 + index * 4, name: `Business Opportunity Path Text ${index + 1}`, x: x + 457200, y: 3733800, cx: 822960, cy: 213360, text: businessOpportunityCompactText(item, "", 10), size: 760, bold: true, color: visual.title });
  }).join("");
}

function businessOpportunityActionGridXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5486400 + col * 1524000;
    const y = 1158240 + row * 929640;
    return solidShapeXml({ id: 2440 + index * 4, name: `Business Opportunity Action ${index + 1}`, geom: "roundRect", x, y, cx: 1280160, cy: 716280, fill: "FFFFFF" })
      + lineFrameShapeXml({ id: 2441 + index * 4, name: `Business Opportunity Action Border ${index + 1}`, geom: "roundRect", x, y, cx: 1280160, cy: 716280, stroke: palette.frame, width: 10160 })
      + solidShapeXml({ id: 2442 + index * 4, name: `Business Opportunity Action Dot ${index + 1}`, geom: "ellipse", x: x + 152400, y: y + 121920, cx: 213360, cy: 213360, fill: index === 2 ? palette.gold : visual.accent })
      + textShapeXml({ id: 2443 + index * 4, name: `Business Opportunity Action Text ${index + 1}`, x: x + 152400, y: y + 396240, cx: 944880, cy: 213360, text: businessOpportunityCompactText(item, "", 12), size: 760, bold: true, color: visual.title });
  }).join("");
}

function businessOpportunityClosingXml({ visual, palette }) {
  return solidShapeXml({ id: 2470, name: "Business Opportunity Closing Panel", geom: "roundRect", x: 5486400, y: 1219200, cx: 2743200, cy: 1981200, fill: visual.primary })
    + rectShapeXml({ id: 2471, name: "Business Opportunity Closing Route", x: 5791200, y: 1828800, cx: 1828800, cy: 76200, fill: visual.accent })
    + rectShapeXml({ id: 2472, name: "Business Opportunity Closing Route Gold", x: 6705600, y: 1828800, cx: 731520, cy: 76200, fill: palette.gold })
    + lineFrameShapeXml({ id: 2473, name: "Business Opportunity Closing Frame", geom: "roundRect", x: 5943600, y: 2286000, cx: 1676400, cy: 609600, stroke: palette.softAccent, width: 10160, transparency: 22000 });
}

function businessOpportunityMapSceneFromSlide({ slide, index, role }) {
  const bullets = businessOpportunityBulletTexts(slide);
  const roleText = String(role || "");
  const sceneRole = index === 0
    ? "cover"
    : role === "closing"
      ? "closing"
      : roleText.includes("analysis")
        ? "analysis"
        : roleText.includes("path")
          ? "path"
          : roleText.includes("actions")
            ? "actions"
            : ["map", "analysis", "path", "actions"][(index - 1) % 4];
  return {
    role: sceneRole,
    title: businessOpportunityCompactText(slide?.title, "业务增长机会识别", index === 0 ? 30 : 28),
    summary: businessOpportunityCompactText(String(slide?.speakerNotes || "").replace(/作者：[^。；;]*/g, ""), "围绕市场机会、业务路径和关键动作形成增长判断。", 42),
    kicker: sceneRole === "cover" ? "GROWTH COMMAND" : sceneRole === "analysis" ? "MARKET FIT" : sceneRole === "path" ? "GROWTH PATH" : sceneRole === "actions" ? "ACTION BOARD" : sceneRole === "closing" ? "NEXT GROWTH" : "OPPORTUNITY SCAN",
    metrics: [
      { value: "3", label: "高潜方向" },
      { value: "12%", label: "增长空间" },
      { value: "4", label: "关键动作" },
    ],
    cards: ["高空间低门槛", "高收益需验证", "资源可复制", "风险需观察"].map((fallback, itemIndex) => businessOpportunityCompactText(bullets[itemIndex], fallback, 12)),
    steps: ["机会识别", "小步验证", "资源加码", "规模复制"].map((fallback, itemIndex) => businessOpportunityCompactText(bullets[itemIndex], fallback, 10)),
  };
}

function businessOpportunityBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["增长机会与目标客户判断", "关键路径与资源投入拆解", "行动闭环和指标追踪"];
}

function businessOpportunityCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!value) return fallback || "";
  return Array.from(value).slice(0, maxLength).join("");
}

function businessOpportunityMapColorPalette(visual) {
  return {
    backdrop: blendHexColor(visual.background, visual.surface, 0.34),
    panel: blendHexColor(visual.background, visual.surface, 0.62),
    frame: blendHexColor(visual.primary, visual.surface, 0.76),
    grid: blendHexColor(visual.primary, visual.surface, 0.58),
    muted: blendHexColor(visual.body, visual.surface, 0.12),
    softAccent: blendHexColor(visual.accent, visual.surface, 0.78),
    softGold: blendHexColor(visual.secondary || "D9A441", visual.surface, 0.78),
    gold: visual.secondary || "D9A441",
    orange: visual.warning || "F97316",
  };
}

function industryTrendForecastDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = industryTrendForecastScene({ index, role, slide });
  const palette = industryTrendForecastColorPalette(visual);
  const surface = solidShapeXml({ id: 1401, name: "Industry Trend Forecast Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1402, name: "Industry Trend Header Bar", x: 0, y: 0, cx: 9144000, cy: 320040, fill: visual.primary })
    + rectShapeXml({ id: 1403, name: "Industry Trend Accent Rule", x: 0, y: 297180, cx: 9144000, cy: 22860, fill: visual.accent })
    + lineFrameShapeXml({ id: 1404, name: "Industry Trend Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1405, name: "Industry Trend Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent })
    + rectShapeXml({ id: 1406, name: "Industry Trend Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  // 趋势判断模板不输出普通 bullets，而是在专用卡片中承载真实内容，避免下载 PPTX 里出现文字重叠。
  const contentCards = industryTrendForecastContentCardsXml({ visual, palette, items: scene.bullets });
  if (scene.kind === "driver") {
    return surface + header + contentCards + industryTrendForecastDriverWheelXml({ visual, palette }) + industryTrendForecastSignalCardsXml({ visual, palette, items: scene.signals, compact: true });
  }
  if (scene.kind === "risk") {
    return surface + header + contentCards + industryTrendForecastRiskGridXml({ visual, palette, items: scene.signals }) + industryTrendForecastTimelineXml({ visual, palette, items: scene.timeline, y: 3825240 });
  }
  if (scene.kind === "roadmap" || scene.kind === "closing") {
    return surface + header + contentCards + industryTrendForecastRoadmapXml({ visual, palette, items: scene.timeline });
  }
  return surface + header + contentCards + industryTrendForecastCurveXml({ visual, palette }) + industryTrendForecastSignalCardsXml({ visual, palette, items: scene.signals, compact: false }) + industryTrendForecastTimelineXml({ visual, palette, items: scene.timeline, y: 3916680 });
}

function industryTrendForecastCurveXml({ visual, palette }) {
  const x = 5350000;
  const y = 838200;
  const w = 3032760;
  const h = 2133600;
  return solidShapeXml({ id: 1410, name: "Industry Trend Curve Panel", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.panel })
    + lineFrameShapeXml({ id: 1411, name: "Industry Trend Curve Panel Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1412, name: "Industry Trend Curve Baseline", x: x + 304800, y: y + 1676400, cx: w - 609600, cy: 15240, fill: palette.line })
    + rectShapeXml({ id: 1413, name: "Industry Trend Curve Segment 1", x: x + 365760, y: y + 1371600, cx: 640080, cy: 45720, fill: visual.primary })
    + rectShapeXml({ id: 1414, name: "Industry Trend Curve Segment 2", x: x + 990600, y: y + 1066800, cx: 670560, cy: 45720, fill: visual.accent })
    + rectShapeXml({ id: 1415, name: "Industry Trend Curve Segment 3", x: x + 1600200, y: y + 670560, cx: 731520, cy: 45720, fill: palette.secondary })
    + rectShapeXml({ id: 1416, name: "Industry Trend Curve Segment 4", x: x + 2255520, y: y + 396240, cx: 518160, cy: 45720, fill: palette.warning })
    + solidShapeXml({ id: 1417, name: "Industry Trend Signal Node 1", geom: "ellipse", x: x + 914400, y: y + 990600, cx: 152400, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 1418, name: "Industry Trend Signal Node 2", geom: "ellipse", x: x + 1569720, y: y + 609600, cx: 152400, cy: 152400, fill: palette.secondary })
    + solidShapeXml({ id: 1419, name: "Industry Trend Signal Node 3", geom: "ellipse", x: x + 2514600, y: y + 304800, cx: 152400, cy: 152400, fill: palette.warning });
}

function industryTrendForecastContentCardsXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const y = 2446020 + index * 426720;
    return solidShapeXml({ id: 1420 + index * 4, name: `Industry Trend Insight Card ${index + 1}`, geom: "roundRect", x: 731520, y, cx: 3657600, cy: 320040, fill: palette.card })
      + rectShapeXml({ id: 1421 + index * 4, name: `Industry Trend Insight Accent ${index + 1}`, x: 731520, y, cx: 60960, cy: 320040, fill: index === 1 ? palette.secondary : visual.accent })
      + textShapeXml({ id: 1422 + index * 4, name: `Industry Trend Insight Text ${index + 1}`, x: 853440, y: y + 76200, cx: 3200400, cy: 167640, text: item, size: 680, bold: true, color: visual.body });
  }).join("");
}

function industryTrendForecastSignalCardsXml({ visual, palette, items, compact }) {
  const x = compact ? 5646420 : 5486400;
  const y = compact ? 3406140 : 3322320;
  const cardWidth = compact ? 853440 : 914400;
  const gap = 91440;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * (cardWidth + gap);
    return solidShapeXml({ id: 1440 + index * 3, name: `Industry Trend Signal Card ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: cardWidth, cy: 518160, fill: palette.card })
      + rectShapeXml({ id: 1441 + index * 3, name: `Industry Trend Signal Accent ${index + 1}`, x: offsetX, y, cx: cardWidth, cy: 45720, fill: index === 2 ? palette.warning : visual.accent })
      + textShapeXml({ id: 1442 + index * 3, name: `Industry Trend Signal Text ${index + 1}`, x: offsetX + 91440, y: y + 137160, cx: cardWidth - 182880, cy: 198120, text: item, size: 640, bold: true, color: visual.title });
  }).join("");
}

function industryTrendForecastDriverWheelXml({ visual, palette }) {
  const x = 5943600;
  const y = 1127760;
  const size = 1828800;
  return solidShapeXml({ id: 1460, name: "Industry Trend Driver Wheel Outer", geom: "ellipse", x, y, cx: size, cy: size, fill: visual.primary })
    + solidShapeXml({ id: 1461, name: "Industry Trend Driver Wheel Arc 1", geom: "arc", x: x + 91440, y: y + 91440, cx: size - 182880, cy: size - 182880, fill: visual.accent })
    + solidShapeXml({ id: 1462, name: "Industry Trend Driver Wheel Arc 2", geom: "pie", x: x + 228600, y: y + 228600, cx: size - 457200, cy: size - 457200, fill: palette.secondary })
    + solidShapeXml({ id: 1463, name: "Industry Trend Driver Wheel Core", geom: "ellipse", x: x + 487680, y: y + 487680, cx: 853440, cy: 853440, fill: visual.surface })
    + textShapeXml({ id: 1464, name: "Industry Trend Driver Wheel Label", x: x + 594360, y: y + 792480, cx: 640080, cy: 198120, text: "DRIVERS", size: 620, bold: true, color: visual.primary });
}

function industryTrendForecastRiskGridXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 5486400 + col * 1371600;
    const y = 1188720 + row * 792480;
    return solidShapeXml({ id: 1470 + index * 3, name: `Industry Trend Risk Cell ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 609600, fill: palette.card })
      + rectShapeXml({ id: 1471 + index * 3, name: `Industry Trend Risk Cell Accent ${index + 1}`, x, y, cx: 1219200, cy: 45720, fill: index % 2 === 0 ? visual.accent : palette.warning })
      + textShapeXml({ id: 1472 + index * 3, name: `Industry Trend Risk Text ${index + 1}`, x: x + 121920, y: y + 198120, cx: 975360, cy: 198120, text: item, size: 660, bold: true, color: visual.title });
  }).join("");
}

function industryTrendForecastTimelineXml({ visual, palette, items, y }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 5486400 + index * 685800;
    return rectShapeXml({ id: 1480 + index * 4, name: `Industry Trend Timeline Line ${index + 1}`, x, y, cx: 563880, cy: 22860, fill: index === 0 ? visual.primary : palette.line })
      + solidShapeXml({ id: 1481 + index * 4, name: `Industry Trend Timeline Dot ${index + 1}`, geom: "ellipse", x: x - 38100, y: y - 60960, cx: 144780, cy: 144780, fill: index === 0 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1482 + index * 4, name: `Industry Trend Timeline Text ${index + 1}`, x: x - 76200, y: y + 121920, cx: 670560, cy: 152400, text: item, size: 560, bold: true, color: visual.body });
  }).join("");
}

function industryTrendForecastRoadmapXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 914400 + index * 1905000;
    return solidShapeXml({ id: 1490 + index * 4, name: `Industry Trend Roadmap Step ${index + 1}`, geom: "roundRect", x, y: 3505200, cx: 1600200, cy: 609600, fill: palette.card })
      + rectShapeXml({ id: 1491 + index * 4, name: `Industry Trend Roadmap Accent ${index + 1}`, x, y: 3505200, cx: 1600200, cy: 45720, fill: index === 2 ? palette.secondary : visual.accent })
      + textShapeXml({ id: 1492 + index * 4, name: `Industry Trend Roadmap Text ${index + 1}`, x: x + 137160, y: 3672840, cx: 1295400, cy: 198120, text: item, size: 680, bold: true, color: visual.title })
      + (index < 3 ? rectShapeXml({ id: 1493 + index * 4, name: `Industry Trend Roadmap Connector ${index + 1}`, x: x + 1600200, y: 3787140, cx: 304800, cy: 22860, fill: palette.line }) : "");
  }).join("");
}

function industryTrendForecastScene({ index, role, slide }) {
  const bullets = industryTrendForecastExportBullets(slide);
  if (role === "closing") {
    return {
      kind: "closing",
      kicker: "NEXT BETS",
      bullets,
      signals: ["持续观察", "快速验证", "战略下注"],
      timeline: ["趋势监测", "机会筛选", "试点投入", "复盘迭代"],
    };
  }
  const scenes = [
    { kind: "cover", kicker: "TREND SIGNALS", signals: ["弱信号识别", "增长曲线判断", "机会窗口"], timeline: ["现在", "6个月", "12个月", "18个月"] },
    { kind: "overview", kicker: "TREND OVERVIEW", signals: ["需求变化", "技术成熟", "政策环境"], timeline: ["萌芽", "验证", "放大", "扩散"] },
    { kind: "driver", kicker: "DRIVING FORCES", signals: ["客户需求", "供给能力", "资本投入"], timeline: ["驱动识别", "因果拆解", "影响评估", "战略响应"] },
    { kind: "risk", kicker: "OPPORTUNITY & RISK", signals: ["高确定机会", "关键不确定性", "资源约束", "竞争反应"], timeline: ["优先进入", "小步验证", "扩张投入", "持续观察"] },
    { kind: "roadmap", kicker: "STRATEGIC ROADMAP", signals: ["观察指标", "验证动作", "资源配置"], timeline: ["01 信号跟踪", "02 试点验证", "03 能力建设", "04 规模推进"] },
  ];
  return { ...scenes[Math.min(index, scenes.length - 1)], bullets };
}

function industryTrendForecastExportBullets(slide) {
  const items = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return items.length ? items : ["识别早期趋势信号与关键变化", "拆解趋势背后的核心驱动因素", "判断市场机会窗口和不确定风险"];
}

function industryTrendForecastColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.14),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.78),
    line: blendHexColor(visual.primary, visual.background, 0.48),
    panel: blendHexColor(visual.background, visual.surface, 0.42),
    secondary: visual.secondary || "22C55E",
    warning: visual.warning || "F59E0B",
  };
}

function isIndustryTrendForecastVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "industry-trend-forecast" && (id === "industry-research" || id === "strategy-industry-research-trend-forecast");
}

function industryResearchDecorationsXml({ visual, index, layout, role }) {
  const scene = industryResearchScene({ index, role });
  const palette = industryResearchColorPalette(visual);
  const isCover = index === 0;
  const isClosing = role === "closing";
  const surface = solidShapeXml({ id: 1201, name: "Industry Research Consulting Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1202, name: "Industry Research Header Bar", x: 0, y: 0, cx: 9144000, cy: 298320, fill: visual.primary })
    + rectShapeXml({ id: 1203, name: "Industry Research Accent Rule", x: 0, y: 275460, cx: 9144000, cy: 22860, fill: visual.accent })
    + lineFrameShapeXml({ id: 1204, name: "Industry Research Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1205, name: "Industry Research Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 1206, name: "Industry Research Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  if (isClosing) {
    return surface
      + header
      + focusRule
      + industryResearchActionCardsXml({ visual, palette, items: scene.chain })
      + rectShapeXml({ id: 1260, name: "Industry Research Closing Rule", x: 914400, y: 3581400, cx: 6096000, cy: 22860, fill: visual.accent });
  }
  if (scene.kind === "chain") {
    return surface + header + focusRule + industryResearchMapXml({ visual, palette, compact: true }) + industryResearchChainXml({ visual, palette, items: scene.chain });
  }
  if (scene.kind === "competition") {
    return surface + header + focusRule + industryResearchMatrixXml({ visual, palette }) + industryResearchSideCardsXml({ visual, palette, items: scene.risks });
  }
  if (scene.kind === "risk") {
    return surface + header + focusRule + industryResearchOpportunityGridXml({ visual, palette }) + industryResearchSideCardsXml({ visual, palette, items: scene.risks });
  }
  return surface + header + focusRule + industryResearchMapXml({ visual, palette, compact: false }) + industryResearchMetricCardsXml({ visual, palette, metrics: scene.metrics, isCover });
}

function industryResearchMapXml({ visual, palette, compact }) {
  const x = compact ? 5638800 : 5339616;
  const y = compact ? 1371600 : 822960;
  const w = compact ? 2438400 : 3108960;
  const h = compact ? 1828800 : 2777490;
  // 导出端补齐预览中的网格质感，避免 PPTX 只剩简单坐标轴。
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const offsetX = x + Math.round((w / 6) * (index + 1));
    const offsetY = y + Math.round((h / 6) * (index + 1));
    return rectShapeXml({ id: 1300 + index * 2, name: `Industry Map Grid V ${index + 1}`, x: offsetX, y, cx: 7620, cy: h, fill: "DDEAF0", transparency: 55000 })
      + rectShapeXml({ id: 1301 + index * 2, name: `Industry Map Grid H ${index + 1}`, x, y: offsetY, cx: w, cy: 7620, fill: "DDEAF0", transparency: 55000 });
  }).join("");
  const route = lineFrameShapeXml({
    id: 1213,
    name: "Industry Map Preview Route",
    geom: "ellipse",
    x: x + Math.round(w * 0.16),
    y: y + Math.round(h * 0.32),
    cx: Math.round(w * 0.66),
    cy: Math.round(h * 0.35),
    stroke: palette.line,
    width: 19050,
    dash: "dash",
    transparency: 18000,
    rotation: -480000,
  });
  return solidShapeXml({ id: 1211, name: "Industry Map Panel", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.mapFill })
    + gridLines
    + route
    + lineFrameShapeXml({ id: 1212, name: "Industry Map Panel Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + solidShapeXml({ id: 1215, name: "Industry Map Node 1", geom: "ellipse", x: x + Math.round(w * 0.20), y: y + Math.round(h * 0.62), cx: 137160, cy: 137160, fill: visual.accent })
    + solidShapeXml({ id: 1216, name: "Industry Map Node 2", geom: "ellipse", x: x + Math.round(w * 0.53), y: y + Math.round(h * 0.27), cx: 114300, cy: 114300, fill: visual.primary })
    + solidShapeXml({ id: 1217, name: "Industry Map Node 3", geom: "ellipse", x: x + Math.round(w * 0.78), y: y + Math.round(h * 0.62), cx: 137160, cy: 137160, fill: visual.accent });
}

function industryResearchMetricCardsXml({ visual, palette, metrics, isCover }) {
  const x = 731520;
  const y = isCover ? 3825240 : 3657600;
  const cardWidth = 1371600;
  const gap = 121920;
  return metrics.slice(0, 3).map((metric, index) => {
    const offsetX = x + index * (cardWidth + gap);
    return solidShapeXml({ id: 1220 + index * 4, name: `Industry Metric Card ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: cardWidth, cy: 548640, fill: palette.card })
      + rectShapeXml({ id: 1221 + index * 4, name: `Industry Metric Accent ${index + 1}`, x: offsetX, y, cx: 76200, cy: 548640, fill: visual.accent })
      + textShapeXml({ id: 1222 + index * 4, name: `Industry Metric Text ${index + 1}`, x: offsetX + 152400, y: y + 114300, cx: 975360, cy: 228600, text: metric.value, size: 1100, bold: true, color: visual.primary })
      + textShapeXml({ id: 1223 + index * 4, name: `Industry Metric Label ${index + 1}`, x: offsetX + 152400, y: y + 304800, cx: 975360, cy: 152400, text: metric.label, size: 680, bold: true, color: visual.body });
  }).join("");
}

function industryResearchChainXml({ visual, palette, items }) {
  const x = 914400;
  const y = 3505200;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * 2438400;
    const arrow = index < 2 ? rectShapeXml({ id: 1240 + index, name: `Industry Chain Arrow ${index + 1}`, x: offsetX + 1981200, y: y + 243840, cx: 457200, cy: 22860, fill: visual.accent }) : "";
    return solidShapeXml({ id: 1230 + index * 2, name: `Industry Chain Node ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1828800, cy: 640080, fill: palette.card })
      + textShapeXml({ id: 1231 + index * 2, name: `Industry Chain Text ${index + 1}`, x: offsetX + 152400, y: y + 198120, cx: 1524000, cy: 243840, text: item, size: 960, bold: true, color: visual.title })
      + arrow;
  }).join("");
}

function industryResearchMatrixXml({ visual, palette }) {
  const x = 5486400;
  const y = 1127760;
  const w = 2743200;
  const h = 2362200;
  return solidShapeXml({ id: 1250, name: "Industry Competition Matrix", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.card })
    + lineFrameShapeXml({ id: 1251, name: "Industry Competition Matrix Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1252, name: "Industry Matrix Vertical Axis", x: x + Math.round(w / 2), y: y + 182880, cx: 15240, cy: h - 365760, fill: palette.line })
    + rectShapeXml({ id: 1253, name: "Industry Matrix Horizontal Axis", x: x + 182880, y: y + Math.round(h / 2), cx: w - 365760, cy: 15240, fill: palette.line })
    + solidShapeXml({ id: 1254, name: "Industry Player Node 1", geom: "ellipse", x: x + 548640, y: y + 1371600, cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 1255, name: "Industry Player Node 2", geom: "ellipse", x: x + 1371600, y: y + 685800, cx: 152400, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 1256, name: "Industry Player Node 3", geom: "ellipse", x: x + 1981200, y: y + 914400, cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 1257, name: "Industry Player Node 4", geom: "ellipse", x: x + 1676400, y: y + 1600200, cx: 152400, cy: 152400, fill: blendHexColor(visual.primary, visual.accent, 0.45) });
}

function industryResearchSideCardsXml({ visual, palette, items }) {
  return items.slice(0, 3).map((item, index) => {
    const x = 5486400;
    const y = 1219200 + index * 579120;
    const width = 2743200;
    const height = 396240;
    return solidShapeXml({ id: 1270 + index * 3, name: `Industry Insight Card ${index + 1}`, geom: "roundRect", x, y, cx: width, cy: height, fill: palette.card })
      + rectShapeXml({ id: 1271 + index * 3, name: `Industry Insight Card Accent ${index + 1}`, x, y, cx: 68580, cy: height, fill: visual.accent })
      + textShapeXml({ id: 1272 + index * 3, name: `Industry Insight Text ${index + 1}`, x: x + 152400, y: y + 106680, cx: width - 304800, cy: 182880, text: item, size: 720, bold: true, color: visual.title });
  }).join("");
}

function industryResearchOpportunityGridXml({ visual, palette }) {
  const x = 914400;
  const y = 3002280;
  const w = 3505200;
  const h = 1066800;
  return solidShapeXml({ id: 1280, name: "Industry Opportunity Matrix", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.mapFill })
    + lineFrameShapeXml({ id: 1281, name: "Industry Opportunity Matrix Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1282, name: "Industry Opportunity Vertical Split", x: x + Math.round(w / 2), y: y + 152400, cx: 15240, cy: h - 304800, fill: palette.line })
    + rectShapeXml({ id: 1283, name: "Industry Opportunity Horizontal Split", x: x + 152400, y: y + Math.round(h / 2), cx: w - 304800, cy: 15240, fill: palette.line });
}

function industryResearchActionCardsXml({ visual, palette, items }) {
  const x = 914400;
  const y = 3505200;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * 2209800;
    return solidShapeXml({ id: 1290 + index * 2, name: `Industry Next Action ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1828800, cy: 518160, fill: palette.card })
      + textShapeXml({ id: 1291 + index * 2, name: `Industry Next Action Text ${index + 1}`, x: offsetX + 152400, y: y + 167640, cx: 1524000, cy: 182880, text: item, size: 900, bold: true, color: visual.title });
  }).join("");
}

function industryResearchColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.12),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.76),
    line: blendHexColor(visual.primary, visual.background, 0.42),
    mapFill: blendHexColor(visual.background, visual.surface, 0.46),
  };
}

function competitionMapDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = competitionMapScene({ slide, index, role });
  const palette = competitionMapColorPalette(visual);
  const isClosing = role === "closing";
  const surface = solidShapeXml({ id: 1321, name: "Competition Map Consulting Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1322, name: "Competition Map Header Bar", x: 0, y: 0, cx: 9144000, cy: 304800, fill: visual.primary })
    + rectShapeXml({ id: 1323, name: "Competition Map Accent Rule", x: 0, y: 274320, cx: 9144000, cy: 30480, fill: visual.accent })
    + lineFrameShapeXml({ id: 1324, name: "Competition Map Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1325, name: "Competition Map Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 1326, name: "Competition Map Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  const bulletCards = competitionMapBulletCardsXml({ visual, palette, items: scene.bullets, isClosing });
  if (isClosing) {
    return surface + header + focusRule + bulletCards + competitionMapActionCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "players") {
    return surface + header + focusRule + bulletCards + competitionMapMatrixXml({ visual, palette, compact: true }) + competitionMapPlayerCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "positioning") {
    return surface + header + focusRule + bulletCards + competitionMapPositionCardsXml({ visual, palette, items: scene.cards }) + competitionMapTagCardsXml({ visual, palette, items: scene.tags });
  }
  if (scene.kind === "segments") {
    return surface + header + focusRule + bulletCards + competitionMapMatrixXml({ visual, palette, compact: true }) + competitionMapSegmentCardsXml({ visual, palette, items: scene.cards });
  }
  return surface + header + focusRule + bulletCards + competitionMapMatrixXml({ visual, palette, compact: false }) + competitionMapTagCardsXml({ visual, palette, items: scene.tags });
}

function competitionMapMatrixXml({ visual, palette, compact }) {
  const x = compact ? 5486400 : 5181600;
  const y = compact ? 1066800 : 914400;
  const w = compact ? 2827020 : 3200400;
  const h = compact ? 2133600 : 2583180;
  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const offsetX = x + Math.round((w / 5) * (index + 1));
    const offsetY = y + Math.round((h / 5) * (index + 1));
    return rectShapeXml({ id: 1340 + index * 2, name: `Competition Map Grid V ${index + 1}`, x: offsetX, y, cx: 7620, cy: h, fill: palette.grid, transparency: 45000 })
      + rectShapeXml({ id: 1341 + index * 2, name: `Competition Map Grid H ${index + 1}`, x, y: offsetY, cx: w, cy: 7620, fill: palette.grid, transparency: 45000 });
  }).join("");
  return solidShapeXml({ id: 1330, name: "Competition Position Matrix", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.mapFill })
    + gridLines
    + lineFrameShapeXml({ id: 1331, name: "Competition Position Matrix Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1332, name: "Competition Map Vertical Axis", x: x + Math.round(w / 2), y: y + 182880, cx: 15240, cy: h - 365760, fill: palette.axis })
    + rectShapeXml({ id: 1333, name: "Competition Map Horizontal Axis", x: x + 182880, y: y + Math.round(h / 2), cx: w - 365760, cy: 15240, fill: palette.axis })
    + solidShapeXml({ id: 1334, name: "Competition Player Node 1", geom: "ellipse", x: x + Math.round(w * 0.20), y: y + Math.round(h * 0.62), cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 1335, name: "Competition Player Node 2", geom: "ellipse", x: x + Math.round(w * 0.47), y: y + Math.round(h * 0.26), cx: 152400, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 1336, name: "Competition Player Node 3", geom: "ellipse", x: x + Math.round(w * 0.72), y: y + Math.round(h * 0.42), cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 1337, name: "Competition Player Node 4", geom: "ellipse", x: x + Math.round(w * 0.64), y: y + Math.round(h * 0.70), cx: 152400, cy: 152400, fill: blendHexColor(visual.primary, visual.accent, 0.4) });
}

function competitionMapBulletCardsXml({ visual, palette, items, isClosing }) {
  const x = 731520;
  const y = isClosing ? 2217420 : 2438400;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 335280;
    return rectShapeXml({ id: 1360 + index * 3, name: `Competition Insight Accent ${index + 1}`, x, y: offsetY + 38100, cx: 60960, cy: 198120, fill: visual.accent })
      + textShapeXml({ id: 1361 + index * 3, name: `Competition Insight Text ${index + 1}`, x: x + 121920, y: offsetY, cx: 3444240, cy: 243840, text: competitionMapCompactText(item, "", 34), size: 720, bold: false, color: visual.body });
  }).join("");
}

function competitionMapTagCardsXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3825240;
  const width = 1280160;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * 1432560;
    return solidShapeXml({ id: 1370 + index * 3, name: `Competition Differentiation Tag ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: width, cy: 518160, fill: palette.card })
      + rectShapeXml({ id: 1371 + index * 3, name: `Competition Tag Accent ${index + 1}`, x: offsetX, y, cx: width, cy: 45720, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1372 + index * 3, name: `Competition Tag Text ${index + 1}`, x: offsetX + 121920, y: y + 167640, cx: width - 243840, cy: 182880, text: competitionMapCompactText(item, "", 8), size: 760, bold: true, color: visual.title });
  }).join("");
}

function competitionMapPlayerCardsXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3634740;
  const width = 1828800;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 2011680;
    return solidShapeXml({ id: 1380 + index * 3, name: `Competition Player Card ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: width, cy: 670560, fill: palette.card })
      + rectShapeXml({ id: 1381 + index * 3, name: `Competition Player Card Rule ${index + 1}`, x: offsetX + 152400, y: y + 487680, cx: 518160, cy: 30480, fill: visual.accent })
      + textShapeXml({ id: 1382 + index * 3, name: `Competition Player Card Text ${index + 1}`, x: offsetX + 152400, y: y + 152400, cx: width - 304800, cy: 243840, text: competitionMapCompactText(item, "", 12), size: 760, bold: true, color: visual.title });
  }).join("");
}

function competitionMapPositionCardsXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1219200;
  const width = 1280160;
  const height = 731520;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + (index % 2) * (width + 182880);
    const offsetY = y + Math.floor(index / 2) * (height + 152400);
    return solidShapeXml({ id: 1390 + index * 3, name: `Competition Position Card ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: width, cy: height, fill: palette.card })
      + rectShapeXml({ id: 1391 + index * 3, name: `Competition Position Accent ${index + 1}`, x: offsetX, y: offsetY, cx: 60960, cy: height, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1392 + index * 3, name: `Competition Position Text ${index + 1}`, x: offsetX + 121920, y: offsetY + 213360, cx: width - 243840, cy: 243840, text: competitionMapCompactText(item, "", 12), size: 740, bold: true, color: visual.title });
  }).join("");
}

function competitionMapSegmentCardsXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3657600;
  const widths = [2438400, 1828800, 2133600];
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + widths.slice(0, index).reduce((sum, value) => sum + value + 182880, 0);
    return solidShapeXml({ id: 1410 + index * 3, name: `Competition Segment Zone ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: widths[index], cy: 670560, fill: palette.card })
      + rectShapeXml({ id: 1411 + index * 3, name: `Competition Segment Zone Accent ${index + 1}`, x: offsetX, y, cx: widths[index], cy: 45720, fill: index === 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1412 + index * 3, name: `Competition Segment Text ${index + 1}`, x: offsetX + 152400, y: y + 190500, cx: widths[index] - 304800, cy: 243840, text: competitionMapCompactText(item, "", 12), size: 760, bold: true, color: visual.title });
  }).join("");
}

function competitionMapActionCardsXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3543300;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 1981200;
    return solidShapeXml({ id: 1420 + index * 3, name: `Competition Next Action ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1676400, cy: 609600, fill: palette.card })
      + solidShapeXml({ id: 1421 + index * 3, name: `Competition Next Action Dot ${index + 1}`, geom: "ellipse", x: offsetX + 152400, y: y + 121920, cx: 167640, cy: 167640, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1422 + index * 3, name: `Competition Next Action Text ${index + 1}`, x: offsetX + 152400, y: y + 335280, cx: 1371600, cy: 182880, text: competitionMapCompactText(item, "", 12), size: 740, bold: true, color: visual.title });
  }).join("");
}

function competitionMapScene({ slide, index, role }) {
  const bullets = competitionMapBulletTexts(slide);
  const tags = ["定位", "区隔", "差异"].map((fallback, itemIndex) => competitionMapCompactText(bullets[itemIndex], fallback, 8));
  const cards = ["头部玩家", "挑战者", "利基玩家", "机会空白"].map((fallback, itemIndex) => competitionMapCompactText(bullets[itemIndex], fallback, 12));
  if (role === "closing") {
    return { kind: "closing", kicker: "STRATEGIC NEXT STEPS", bullets, tags, cards: ["明确目标区隔", "强化差异证据", "制定竞争动作", "跟踪格局变化"].map((fallback, itemIndex) => competitionMapCompactText(bullets[itemIndex], fallback, 12)) };
  }
  const scenes = [
    { kind: "cover", kicker: "COMPETITIVE LANDSCAPE", bullets, tags, cards },
    { kind: "overview", kicker: "POSITION MAP", bullets, tags, cards },
    { kind: "players", kicker: "PLAYER BENCHMARK", bullets, tags, cards },
    { kind: "positioning", kicker: "DIFFERENTIATION", bullets, tags, cards },
    { kind: "segments", kicker: "SEGMENT OPPORTUNITY", bullets, tags, cards },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function competitionMapBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["竞品能力与市场覆盖呈现分层", "头部玩家强化生态和渠道壁垒", "差异化机会集中在细分场景"];
}

function competitionMapCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function competitionMapColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.14),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.74),
    axis: blendHexColor(visual.primary, visual.background, 0.34),
    grid: blendHexColor(visual.primary, visual.background, 0.62),
    mapFill: blendHexColor(visual.background, visual.surface, 0.46),
  };
}

function secondCurveDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = secondCurveScene({ slide, index, role });
  const palette = secondCurveColorPalette(visual);
  const isClosing = role === "closing";
  const surface = solidShapeXml({ id: 1621, name: "Second Curve Consulting Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1622, name: "Second Curve Header Bar", x: 0, y: 0, cx: 9144000, cy: 320040, fill: visual.primary })
    + rectShapeXml({ id: 1623, name: "Second Curve Accent Rule", x: 0, y: 289560, cx: 9144000, cy: 30480, fill: visual.accent })
    + rectShapeXml({ id: 1624, name: "Second Curve Gold Rule", x: 6873240, y: 289560, cx: 2270760, cy: 30480, fill: palette.gold })
    + lineFrameShapeXml({ id: 1625, name: "Second Curve Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1626, name: "Second Curve Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 1627, name: "Second Curve Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  const bullets = secondCurveBulletCardsXml({ visual, items: scene.bullets, isClosing });
  if (isClosing) {
    return surface + header + focusRule + bullets + secondCurveNextActionsXml({ visual, palette, items: scene.cards }) + secondCurveChartXml({ visual, palette, compact: true });
  }
  if (scene.kind === "opportunity") {
    return surface + header + focusRule + bullets + secondCurveOpportunityMatrixXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "incubation") {
    return surface + header + focusRule + bullets + secondCurveRoadmapXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "resource") {
    return surface + header + focusRule + bullets + secondCurvePortfolioXml({ visual, palette, items: scene.cards }) + secondCurveAllocationXml({ visual, palette });
  }
  return surface + header + focusRule + bullets + secondCurveChartXml({ visual, palette, compact: false }) + secondCurveMetricCardsXml({ visual, palette, items: scene.cards });
}

function secondCurveChartXml({ visual, palette, compact }) {
  const x = compact ? 5486400 : 5181600;
  const y = compact ? 1066800 : 914400;
  const w = compact ? 2827020 : 3200400;
  const h = compact ? 2133600 : 2583180;
  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const offsetX = x + Math.round((w / 5) * (index + 1));
    const offsetY = y + Math.round((h / 5) * (index + 1));
    return rectShapeXml({ id: 1640 + index * 2, name: `Second Curve Grid V ${index + 1}`, x: offsetX, y, cx: 7620, cy: h, fill: palette.grid, transparency: 52000 })
      + rectShapeXml({ id: 1641 + index * 2, name: `Second Curve Grid H ${index + 1}`, x, y: offsetY, cx: w, cy: 7620, fill: palette.grid, transparency: 52000 });
  }).join("");
  return solidShapeXml({ id: 1630, name: "Second Curve Growth Chart", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.mapFill })
    + gridLines
    + lineFrameShapeXml({ id: 1631, name: "Second Curve Chart Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1632, name: "Second Curve Baseline", x: x + 243840, y: y + Math.round(h * 0.74), cx: w - 487680, cy: 15240, fill: palette.axis })
    + arcLineShapeXml({ id: 1633, name: "First Curve Plateau Arc", x: x + 335280, y: y + Math.round(h * 0.40), cx: Math.round(w * 0.52), cy: Math.round(h * 0.42), stroke: palette.mutedLine, width: 30480 })
    + arcLineShapeXml({ id: 1634, name: "Second Curve Growth Arc", x: x + Math.round(w * 0.26), y: y + Math.round(h * 0.20), cx: Math.round(w * 0.60), cy: Math.round(h * 0.58), stroke: visual.accent, width: 45720 })
    + rectShapeXml({ id: 1635, name: "Investment Gate", x: x + Math.round(w * 0.44), y: y + Math.round(h * 0.32), cx: 30480, cy: Math.round(h * 0.45), fill: palette.gold })
    + solidShapeXml({ id: 1636, name: "Current Business Node", geom: "ellipse", x: x + Math.round(w * 0.20), y: y + Math.round(h * 0.63), cx: 152400, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 1637, name: "Validation Node", geom: "ellipse", x: x + Math.round(w * 0.48), y: y + Math.round(h * 0.41), cx: 152400, cy: 152400, fill: palette.gold })
    + solidShapeXml({ id: 1638, name: "Scale Node", geom: "ellipse", x: x + Math.round(w * 0.75), y: y + Math.round(h * 0.27), cx: 152400, cy: 152400, fill: visual.accent });
}

function secondCurveBulletCardsXml({ visual, items, isClosing }) {
  const x = 731520;
  const y = isClosing ? 2217420 : 2438400;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 335280;
    return rectShapeXml({ id: 1660 + index * 3, name: `Second Curve Insight Accent ${index + 1}`, x, y: offsetY + 38100, cx: 60960, cy: 198120, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1661 + index * 3, name: `Second Curve Insight Text ${index + 1}`, x: x + 121920, y: offsetY, cx: 3444240, cy: 243840, text: secondCurveCompactText(item, "", 34), size: 720, bold: false, color: visual.body });
  }).join("");
}

function secondCurveMetricCardsXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3825240;
  const width = 1280160;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * 1432560;
    return solidShapeXml({ id: 1670 + index * 4, name: `Second Curve Metric Card ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: width, cy: 518160, fill: palette.card })
      + rectShapeXml({ id: 1671 + index * 4, name: `Second Curve Metric Accent ${index + 1}`, x: offsetX, y, cx: 76200, cy: 518160, fill: index === 1 ? palette.gold : visual.accent })
      + textShapeXml({ id: 1672 + index * 4, name: `Second Curve Metric Title ${index + 1}`, x: offsetX + 152400, y: y + 129540, cx: width - 304800, cy: 152400, text: item.title, size: 760, bold: true, color: visual.title })
      + textShapeXml({ id: 1673 + index * 4, name: `Second Curve Metric Caption ${index + 1}`, x: offsetX + 152400, y: y + 304800, cx: width - 304800, cy: 152400, text: item.caption, size: 560, bold: true, color: visual.body });
  }).join("");
}

function secondCurveOpportunityMatrixXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1127760;
  const w = 2743200;
  const h = 2362200;
  const cells = items.slice(0, 4).map((item, index) => {
    const cellW = Math.round((w - 304800) / 2);
    const cellH = Math.round((h - 304800) / 2);
    const cellX = x + 152400 + (index % 2) * cellW;
    const cellY = y + 152400 + Math.floor(index / 2) * cellH;
    return solidShapeXml({ id: 1690 + index * 3, name: `Second Curve Opportunity ${index + 1}`, geom: "roundRect", x: cellX + 76200, y: cellY + 76200, cx: cellW - 152400, cy: cellH - 152400, fill: index === 1 ? blendHexColor(palette.gold, visual.surface, 0.72) : palette.card })
      + textShapeXml({ id: 1691 + index * 3, name: `Second Curve Opportunity Text ${index + 1}`, x: cellX + 182880, y: cellY + 243840, cx: cellW - 365760, cy: 243840, text: item.title, size: 720, bold: true, color: visual.title });
  }).join("");
  return solidShapeXml({ id: 1680, name: "Second Curve Opportunity Matrix", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.mapFill })
    + lineFrameShapeXml({ id: 1681, name: "Second Curve Opportunity Matrix Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1682, name: "Second Curve Opportunity Vertical Axis", x: x + Math.round(w / 2), y: y + 182880, cx: 15240, cy: h - 365760, fill: palette.axis })
    + rectShapeXml({ id: 1683, name: "Second Curve Opportunity Horizontal Axis", x: x + 182880, y: y + Math.round(h / 2), cx: w - 365760, cy: 15240, fill: palette.axis })
    + cells;
}

function secondCurveRoadmapXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3657600;
  return rectShapeXml({ id: 1700, name: "Second Curve Roadmap Line", x: x + 228600, y: y - 228600, cx: 7437120, cy: 30480, fill: visual.accent })
    + items.slice(0, 4).map((item, index) => {
      const offsetX = x + index * 1981200;
      return solidShapeXml({ id: 1701 + index * 4, name: `Second Curve Roadmap Step ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1676400, cy: 640080, fill: palette.card })
        + solidShapeXml({ id: 1702 + index * 4, name: `Second Curve Roadmap Dot ${index + 1}`, geom: "ellipse", x: offsetX + 152400, y: y + 137160, cx: 167640, cy: 167640, fill: index === 2 ? palette.gold : visual.primary })
        + textShapeXml({ id: 1703 + index * 4, name: `Second Curve Roadmap Number ${index + 1}`, x: offsetX + 205740, y: y + 177800, cx: 76200, cy: 76200, text: String(index + 1), size: 420, bold: true, color: "FFFFFF" })
        + textShapeXml({ id: 1704 + index * 4, name: `Second Curve Roadmap Text ${index + 1}`, x: offsetX + 396240, y: y + 198120, cx: 1066800, cy: 182880, text: item.title, size: 680, bold: true, color: visual.title });
    }).join("");
}

function secondCurvePortfolioXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1066800;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 701040;
    return solidShapeXml({ id: 1720 + index * 4, name: `Second Curve Portfolio Card ${index + 1}`, geom: "roundRect", x, y: offsetY, cx: 2743200, cy: 548640, fill: palette.card })
      + rectShapeXml({ id: 1721 + index * 4, name: `Second Curve Portfolio Accent ${index + 1}`, x, y: offsetY, cx: 76200, cy: 548640, fill: index === 1 ? palette.gold : visual.accent })
      + textShapeXml({ id: 1722 + index * 4, name: `Second Curve Portfolio Title ${index + 1}`, x: x + 152400, y: offsetY + 114300, cx: 2286000, cy: 182880, text: item.title, size: 760, bold: true, color: visual.title })
      + textShapeXml({ id: 1723 + index * 4, name: `Second Curve Portfolio Caption ${index + 1}`, x: x + 152400, y: offsetY + 320040, cx: 2286000, cy: 152400, text: item.caption, size: 560, bold: true, color: visual.body });
  }).join("");
}

function secondCurveAllocationXml({ visual, palette }) {
  const x = 914400;
  const y = 3482340;
  return solidShapeXml({ id: 1740, name: "Second Curve Allocation Panel", geom: "roundRect", x, y, cx: 3505200, cy: 822960, fill: palette.mapFill })
    + lineFrameShapeXml({ id: 1741, name: "Second Curve Allocation Frame", geom: "roundRect", x, y, cx: 3505200, cy: 822960, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1742, name: "Second Curve Allocation Axis", x: x + 335280, y: y + 624840, cx: 2743200, cy: 15240, fill: palette.axis })
    + rectShapeXml({ id: 1743, name: "Second Curve Allocation Bar 1", x: x + 685800, y: y + 365760, cx: 304800, cy: 259080, fill: visual.primary })
    + rectShapeXml({ id: 1744, name: "Second Curve Allocation Bar 2", x: x + 1516380, y: y + 243840, cx: 304800, cy: 381000, fill: visual.accent })
    + rectShapeXml({ id: 1745, name: "Second Curve Allocation Bar 3", x: x + 2346960, y: y + 457200, cx: 304800, cy: 167640, fill: palette.gold });
}

function secondCurveNextActionsXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3543300;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 1981200;
    return solidShapeXml({ id: 1760 + index * 3, name: `Second Curve Next Action ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1676400, cy: 609600, fill: palette.card })
      + rectShapeXml({ id: 1761 + index * 3, name: `Second Curve Next Action Rule ${index + 1}`, x: offsetX, y, cx: 1676400, cy: 45720, fill: index === 2 ? palette.gold : visual.accent })
      + textShapeXml({ id: 1762 + index * 3, name: `Second Curve Next Action Text ${index + 1}`, x: offsetX + 152400, y: y + 198120, cx: 1371600, cy: 182880, text: item.title, size: 720, bold: true, color: visual.title });
  }).join("");
}

function secondCurveScene({ slide, index, role }) {
  const bullets = secondCurveBulletTexts(slide);
  const cardFallbacks = [
    ["增长目标", "目标口径"],
    ["增长假设", "验证逻辑"],
    ["资源配置", "投入节奏"],
    ["验证指标", "阶段门槛"],
  ];
  const cards = cardFallbacks.map(([titleFallback, captionFallback], itemIndex) => {
    const text = secondCurveCompactText(bullets[itemIndex], titleFallback, 18);
    const [rawTitle, rawCaption] = text.split(/[:：]/);
    return {
      title: secondCurveCompactText(rawTitle, titleFallback, 8),
      caption: secondCurveCompactText(rawCaption || bullets[itemIndex + 1], captionFallback, 10),
    };
  });
  if (role === "closing") {
    return { kind: "closing", kicker: "NEXT DECISION", bullets, cards: ["确认增长假设", "启动试点验证", "配置阶段资源", "复盘关键指标"].map((item, itemIndex) => ({ title: secondCurveCompactText(bullets[itemIndex], item, 9), caption: "" })) };
  }
  const scenes = [
    { kind: "cover", kicker: "GROWTH CURVE", bullets, cards: cards.slice(0, 3) },
    { kind: "context", kicker: "BUSINESS CONTEXT", bullets, cards: cards.slice(0, 3) },
    { kind: "opportunity", kicker: "OPPORTUNITY POOL", bullets, cards },
    { kind: "incubation", kicker: "INCUBATION PATH", bullets, cards },
    { kind: "resource", kicker: "RESOURCE BETS", bullets, cards },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function secondCurveBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["现有业务增长趋缓，需要识别新增长空间", "围绕目标客群验证新业务价值假设", "按阶段投入资源并设置关键验证指标"];
}

function secondCurveCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function secondCurveColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.14),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.74),
    axis: blendHexColor(visual.primary, visual.background, 0.44),
    grid: blendHexColor(visual.primary, visual.background, 0.62),
    mapFill: blendHexColor(visual.background, visual.surface, 0.45),
    mutedLine: blendHexColor(visual.primary, visual.background, 0.45),
    gold: visual.secondary || "F2B84B",
  };
}

function enterpriseDigitalBlueprintDecorationsXml({ visual, index, layout, role, slide }) {
  const palette = enterpriseDigitalBlueprintPalette(visual);
  const scene = enterpriseDigitalBlueprintScene({ slide, index, role });
  const surface = solidShapeXml({ id: 1500, name: "Enterprise Blueprint Content Surface", geom: "roundRect", ...layout.surface, fill: visual.surface })
    + lineFrameShapeXml({ id: 1501, name: "Enterprise Blueprint Surface Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 1502, name: "Enterprise Blueprint Top Accent", ...layout.accent, fill: visual.primary })
    + rectShapeXml({ id: 1503, name: "Enterprise Blueprint Cyan Rule", ...layout.secondaryAccent, fill: visual.accent });
  const header = textShapeXml({ id: 1510, name: "Enterprise Blueprint Section Label", ...layout.label, text: scene.kicker, size: 760, bold: true, color: visual.accent });
  const content = enterpriseDigitalBlueprintContentXml({ visual, palette, scene, layout });
  const grid = enterpriseDigitalBlueprintGridXml({ palette });
  if (scene.kind === "architecture" || scene.kind === "cover") {
    return surface + grid + header + content + enterpriseDigitalBlueprintArchitectureXml({ visual, palette, scene });
  }
  if (scene.kind === "capability") {
    return surface + grid + header + content + enterpriseDigitalBlueprintCapabilityXml({ visual, palette, scene });
  }
  if (scene.kind === "roadmap") {
    return surface + grid + header + content + enterpriseDigitalBlueprintRoadmapXml({ visual, palette, scene });
  }
  if (scene.kind === "governance") {
    return surface + grid + header + content + enterpriseDigitalBlueprintGovernanceXml({ visual, palette, scene });
  }
  if (scene.kind === "risk") {
    return surface + grid + header + content + enterpriseDigitalBlueprintRiskXml({ visual, palette, scene });
  }
  if (scene.kind === "closing") {
    return surface + grid + header + content + enterpriseDigitalBlueprintActionXml({ visual, scene });
  }
  return surface + grid + header + content + enterpriseDigitalBlueprintGovernanceXml({ visual, palette, scene });
}

function enterpriseDigitalBlueprintGridXml({ palette }) {
  const lines = [];
  for (let offset = 0; offset < 8; offset += 1) {
    lines.push(rectShapeXml({ id: 1520 + offset, name: `Enterprise Blueprint Vertical Grid ${offset + 1}`, x: 823000 + offset * 838200, y: 640080, cx: 6350, cy: 3901440, fill: palette.grid }));
  }
  for (let offset = 0; offset < 6; offset += 1) {
    lines.push(rectShapeXml({ id: 1530 + offset, name: `Enterprise Blueprint Horizontal Grid ${offset + 1}`, x: 640080, y: 777240 + offset * 609600, cx: 7772400, cy: 5080, fill: palette.grid }));
  }
  return lines.join("");
}

function enterpriseDigitalBlueprintContentXml({ visual, palette, scene, layout }) {
  // 导出端将用户生成的大纲内容放入左侧信息卡，和在线预览的内容区域保持一致。
  const summary = textShapeXml({ id: 1540, name: "Enterprise Blueprint Planned Content", x: layout.content.x, y: layout.content.y, cx: layout.content.cx, cy: 274320, text: enterpriseBlueprintCompactText(scene.summary, "", 34), size: 780, bold: true, color: visual.body });
  const bullets = scene.bullets.slice(0, 4).map((item, itemIndex) => {
    const y = layout.content.y + 381000 + itemIndex * 243840;
    return solidShapeXml({ id: 1542 + itemIndex * 4, name: `Enterprise Blueprint Bullet Dot ${itemIndex + 1}`, geom: "ellipse", x: layout.content.x + 15240, y: y + 60960, cx: 53340, cy: 53340, fill: itemIndex % 2 === 0 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1543 + itemIndex * 4, name: `Enterprise Blueprint Bullet Text ${itemIndex + 1}`, x: layout.content.x + 91440, y, cx: layout.content.cx - 121920, cy: 182880, text: enterpriseBlueprintCompactText(item, "", 26), size: 650, bold: false, color: visual.body });
  }).join("");
  return solidShapeXml({ id: 1541, name: "Enterprise Blueprint Content Callout", geom: "roundRect", x: layout.content.x - 60960, y: layout.content.y - 121920, cx: layout.content.cx + 121920, cy: 1280160, fill: palette.callout }) + summary + bullets;
}

function enterpriseDigitalBlueprintArchitectureXml({ visual, palette, scene }) {
  const frame = solidShapeXml({ id: 1560, name: "Enterprise Blueprint Architecture Frame", geom: "roundRect", x: 5638800, y: 1112520, cx: 2514600, cy: 2057400, fill: palette.panel })
    + lineFrameShapeXml({ id: 1561, name: "Enterprise Blueprint Architecture Border", geom: "roundRect", x: 5638800, y: 1112520, cx: 2514600, cy: 2057400, stroke: palette.frame, width: 12700 });
  const cards = scene.cards.slice(0, 4).map((item, itemIndex) => {
    const x = 5943600 + (itemIndex % 2) * 1066800;
    const y = 1478280 + Math.floor(itemIndex / 2) * 594360;
    return solidShapeXml({ id: 1562 + itemIndex * 4, name: `Enterprise Blueprint Architecture Node ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 853440, cy: 365760, fill: itemIndex === 0 ? visual.primary : visual.surface })
      + lineFrameShapeXml({ id: 1563 + itemIndex * 4, name: `Enterprise Blueprint Architecture Node Border ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 853440, cy: 365760, stroke: itemIndex === 0 ? visual.primary : palette.frame, width: 12700 })
      + textShapeXml({ id: 1564 + itemIndex * 4, name: `Enterprise Blueprint Architecture Text ${itemIndex + 1}`, x: x + 76200, y: y + 106680, cx: 701040, cy: 152400, text: enterpriseBlueprintCompactText(item, "", 10), size: 650, bold: true, color: itemIndex === 0 ? "FFFFFF" : visual.title });
  }).join("");
  const flow = rectShapeXml({ id: 1584, name: "Enterprise Blueprint Data Flow", x: 6248400, y: 2506980, cx: 1447800, cy: 38100, fill: visual.accent })
    + solidShapeXml({ id: 1585, name: "Enterprise Blueprint Flow Node A", geom: "ellipse", x: 6217920, y: 2423160, cx: 198120, cy: 198120, fill: visual.accent })
    + solidShapeXml({ id: 1586, name: "Enterprise Blueprint Flow Node B", geom: "ellipse", x: 7566660, y: 2423160, cx: 198120, cy: 198120, fill: visual.primary });
  return frame + cards + flow;
}

function enterpriseDigitalBlueprintCapabilityXml({ visual, palette, scene }) {
  return scene.cards.slice(0, 4).map((item, itemIndex) => {
    const x = 5486400 + (itemIndex % 2) * 1371600;
    const y = 1264920 + Math.floor(itemIndex / 2) * 838200;
    return solidShapeXml({ id: 1600 + itemIndex * 5, name: `Enterprise Blueprint Capability Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 609600, fill: visual.surface })
      + lineFrameShapeXml({ id: 1601 + itemIndex * 5, name: `Enterprise Blueprint Capability Border ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 609600, stroke: palette.frame, width: 12700 })
      + solidShapeXml({ id: 1602 + itemIndex * 5, name: `Enterprise Blueprint Capability Icon ${itemIndex + 1}`, geom: "ellipse", x: x + 121920, y: y + 121920, cx: 198120, cy: 198120, fill: itemIndex % 2 === 0 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1603 + itemIndex * 5, name: `Enterprise Blueprint Capability Text ${itemIndex + 1}`, x: x + 365760, y: y + 167640, cx: 731520, cy: 243840, text: enterpriseBlueprintCompactText(item, "", 12), size: 720, bold: true, color: visual.title });
  }).join("");
}

function enterpriseDigitalBlueprintRoadmapXml({ visual, palette, scene }) {
  const y = 3505200;
  const line = rectShapeXml({ id: 1630, name: "Enterprise Blueprint Roadmap Base", x: 822960, y: y + 259080, cx: 7467600, cy: 38100, fill: palette.line });
  const nodes = scene.steps.slice(0, 4).map((item, itemIndex) => {
    const x = 1005840 + itemIndex * 1905000;
    return solidShapeXml({ id: 1631 + itemIndex * 5, name: `Enterprise Blueprint Roadmap Node ${itemIndex + 1}`, geom: "ellipse", x, y, cx: 457200, cy: 457200, fill: itemIndex === 1 ? visual.accent : visual.primary })
      + textShapeXml({ id: 1632 + itemIndex * 5, name: `Enterprise Blueprint Roadmap Text ${itemIndex + 1}`, x: x - 365760, y: y + 548640, cx: 1188720, cy: 182880, text: enterpriseBlueprintCompactText(item, "", 10), size: 680, bold: true, color: visual.title });
  }).join("");
  return line + nodes;
}

function enterpriseDigitalBlueprintGovernanceXml({ visual, palette, scene }) {
  const frame = lineFrameShapeXml({ id: 1660, name: "Enterprise Blueprint Governance Network", geom: "roundRect", x: 5486400, y: 1264920, cx: 2743200, cy: 1828800, stroke: palette.frame, width: 12700 })
    + rectShapeXml({ id: 1661, name: "Enterprise Blueprint Governance Link X", x: 5943600, y: 2125980, cx: 1828800, cy: 30480, fill: visual.accent })
    + rectShapeXml({ id: 1662, name: "Enterprise Blueprint Governance Link Y", x: 6858000, y: 1524000, cx: 30480, cy: 1219200, fill: visual.accent });
  const nodes = scene.cards.slice(0, 4).map((item, itemIndex) => {
    const x = 5791200 + (itemIndex % 2) * 1371600;
    const y = 1478280 + Math.floor(itemIndex / 2) * 762000;
    return solidShapeXml({ id: 1663 + itemIndex * 5, name: `Enterprise Blueprint Governance Node ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 914400, cy: 365760, fill: visual.surface })
      + lineFrameShapeXml({ id: 1664 + itemIndex * 5, name: `Enterprise Blueprint Governance Border ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 914400, cy: 365760, stroke: palette.frame, width: 12700 })
      + textShapeXml({ id: 1665 + itemIndex * 5, name: `Enterprise Blueprint Governance Text ${itemIndex + 1}`, x: x + 76200, y: y + 106680, cx: 762000, cy: 152400, text: enterpriseBlueprintCompactText(item, "", 10), size: 650, bold: true, color: visual.title });
  }).join("");
  return frame + nodes;
}

function enterpriseDigitalBlueprintRiskXml({ visual, scene }) {
  return scene.cards.slice(0, 4).map((item, itemIndex) => {
    const y = 1219200 + itemIndex * 563880;
    return solidShapeXml({ id: 1690 + itemIndex * 4, name: `Enterprise Blueprint Risk Card ${itemIndex + 1}`, geom: "roundRect", x: 5638800, y, cx: 2438400, cy: 396240, fill: visual.surface })
      + rectShapeXml({ id: 1691 + itemIndex * 4, name: `Enterprise Blueprint Risk Accent ${itemIndex + 1}`, x: 5638800, y, cx: 60960, cy: 396240, fill: itemIndex % 2 === 0 ? visual.warning : visual.accent })
      + textShapeXml({ id: 1692 + itemIndex * 4, name: `Enterprise Blueprint Risk Text ${itemIndex + 1}`, x: 5814060, y: y + 106680, cx: 1981200, cy: 152400, text: enterpriseBlueprintCompactText(item, "", 18), size: 700, bold: true, color: visual.title });
  }).join("");
}

function enterpriseDigitalBlueprintActionXml({ visual, scene }) {
  return scene.cards.slice(0, 4).map((item, itemIndex) => {
    const x = 5486400 + (itemIndex % 2) * 1371600;
    const y = 1371600 + Math.floor(itemIndex / 2) * 838200;
    return solidShapeXml({ id: 1720 + itemIndex * 4, name: `Enterprise Blueprint Action Card ${itemIndex + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 609600, fill: itemIndex === 0 ? visual.primary : visual.surface })
      + textShapeXml({ id: 1721 + itemIndex * 4, name: `Enterprise Blueprint Action Text ${itemIndex + 1}`, x: x + 121920, y: y + 198120, cx: 975360, cy: 182880, text: enterpriseBlueprintCompactText(item, "", 12), size: 720, bold: true, color: itemIndex === 0 ? "FFFFFF" : visual.title });
  }).join("");
}

function enterpriseDigitalBlueprintScene({ slide, index, role }) {
  const bullets = enterpriseBlueprintBulletTexts(slide);
  const cards = ["业务流程", "数据资产", "系统平台", "组织能力"].map((fallback, itemIndex) => enterpriseBlueprintCompactText(bullets[itemIndex], fallback, 12));
  const steps = ["现状诊断", "蓝图设计", "试点建设", "规模推广"].map((fallback, itemIndex) => enterpriseBlueprintCompactText(bullets[itemIndex], fallback, 10));
  if (role === "closing") {
    return { kind: "closing", kicker: "NEXT TRANSFORMATION ACTIONS", summary: enterpriseBlueprintCompactText(bullets[0], "聚焦高价值场景启动试点，按阶段复盘和扩展", 34), bullets, cards: ["确定试点场景", "组建转型小组", "拆解里程碑", "建立复盘机制"].map((fallback, itemIndex) => enterpriseBlueprintCompactText(bullets[itemIndex], fallback, 12)), steps };
  }
  const kinds = ["cover", "diagnosis", "architecture", "capability", "roadmap", "governance", "risk"];
  const kickers = ["DIGITAL TRANSFORMATION BLUEPRINT", "CURRENT STATE DIAGNOSIS", "TARGET ARCHITECTURE", "CAPABILITY UPGRADE", "IMPLEMENTATION ROADMAP", "GOVERNANCE MODEL", "RISK & ENABLEMENT"];
  const fallbackSummaries = ["围绕业务、数据、系统和组织建立转型蓝图", "识别流程断点、系统孤岛和组织协同瓶颈", "构建体验层、流程层、数据层和智能应用层", "把转型能力拆解为可建设、可衡量、可运营模块", "明确阶段目标、交付节奏和里程碑验收标准", "建立转型办公室、业务 owner 和数据治理机制", "提前识别投入、组织、数据和系统集成风险"];
  const sceneIndex = Math.min(index, kinds.length - 1);
  return { kind: kinds[sceneIndex], kicker: kickers[sceneIndex], summary: enterpriseBlueprintCompactText(bullets[0], fallbackSummaries[sceneIndex], 34), bullets, cards, steps };
}

function enterpriseBlueprintBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["业务流程与系统能力需要统一规划", "数据治理和平台能力成为转型基础", "组织协同和阶段路线决定落地效果"];
}

function enterpriseBlueprintCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function enterpriseDigitalBlueprintPalette(visual) {
  return {
    panel: blendHexColor(visual.surface, visual.background, 0.16),
    callout: blendHexColor(visual.surface, visual.background, 0.08),
    frame: blendHexColor(visual.primary, visual.surface, 0.72),
    grid: blendHexColor(visual.accent, visual.surface, 0.86),
    line: blendHexColor(visual.primary, visual.surface, 0.62),
  };
}

function isEnterpriseDigitalBlueprintVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "enterprise-digital-blueprint" && (id === "enterprise-transformation" || id === "strategy-enterprise-transformation-digital-blueprint");
}

function swotMapDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = swotMapScene({ slide, index, role });
  const palette = swotMapColorPalette(visual);
  const isClosing = role === "closing";
  const surface = solidShapeXml({ id: 1831, name: "SWOT Map Consulting Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1832, name: "SWOT Map Header Bar", x: 0, y: 0, cx: 9144000, cy: 304800, fill: visual.primary })
    + rectShapeXml({ id: 1833, name: "SWOT Map Accent Rule", x: 0, y: 274320, cx: 9144000, cy: 30480, fill: visual.accent })
    + lineFrameShapeXml({ id: 1834, name: "SWOT Map Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1835, name: "SWOT Map Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 1836, name: "SWOT Map Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  const bullets = swotMapBulletCardsXml({ visual, palette, items: scene.bullets, isClosing });
  // SWOT 模板不输出普通 bullets，避免下载 PPTX 时文字层和四象限图形重叠。
  if (isClosing || scene.kind === "strategy") {
    return surface + header + focusRule + bullets + swotMapStrategyCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "position") {
    return surface + header + focusRule + bullets + swotMapAxisXml({ visual, palette }) + swotMapCompareCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "compare") {
    return surface + header + focusRule + bullets + swotMapCompareCardsXml({ visual, palette, items: scene.cards }) + swotMapScoreBarsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "risk") {
    return surface + header + focusRule + bullets + swotMapRiskGridXml({ visual, palette, items: scene.cards }) + swotMapQuadrantXml({ visual, palette, items: scene.cards, compact: true });
  }
  return surface + header + focusRule + bullets + swotMapQuadrantXml({ visual, palette, items: scene.cards, compact: false }) + swotMapStrategyCardsXml({ visual, palette, items: scene.tags });
}

function swotMapQuadrantXml({ visual, palette, items, compact }) {
  const x = compact ? 6126480 : 5257800;
  const y = compact ? 1264920 : 975360;
  const w = compact ? 2209800 : 2743200;
  const h = compact ? 1524000 : 2209800;
  const gap = 60960;
  const cellW = Math.round((w - gap) / 2);
  const cellH = Math.round((h - gap) / 2);
  const fills = [palette.strength, palette.weakness, palette.opportunity, palette.threat];
  const labels = ["S", "W", "O", "T"];
  const names = ["Strength", "Weakness", "Opportunity", "Threat"];
  const cards = labels.map((label, itemIndex) => {
    const cellX = x + (itemIndex % 2) * (cellW + gap);
    const cellY = y + Math.floor(itemIndex / 2) * (cellH + gap);
    const text = swotMapCompactText(items[itemIndex], names[itemIndex], compact ? 10 : 14);
    return solidShapeXml({ id: 1840 + itemIndex * 4, name: `SWOT Quadrant ${names[itemIndex]}`, geom: "roundRect", x: cellX, y: cellY, cx: cellW, cy: cellH, fill: fills[itemIndex] })
      + rectShapeXml({ id: 1841 + itemIndex * 4, name: `SWOT Quadrant ${label} Rule`, x: cellX + 152400, y: cellY + 152400, cx: 457200, cy: 45720, fill: "FFFFFF" })
      + textShapeXml({ id: 1842 + itemIndex * 4, name: `SWOT Quadrant ${label} Letter`, x: cellX + 152400, y: cellY + 243840, cx: 335280, cy: 304800, text: label, size: compact ? 1160 : 1500, bold: true, color: "FFFFFF" })
      + textShapeXml({ id: 1843 + itemIndex * 4, name: `SWOT Quadrant ${label} Text`, x: cellX + 548640, y: cellY + 274320, cx: cellW - 700000, cy: 335280, text, size: compact ? 620 : 720, bold: true, color: "FFFFFF" });
  }).join("");
  return lineFrameShapeXml({ id: 1839, name: "SWOT Quadrant Matrix", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 }) + cards;
}

function swotMapAxisXml({ visual, palette }) {
  const x = 5394960;
  const y = 1036320;
  const w = 2743200;
  const h = 2209800;
  return solidShapeXml({ id: 1860, name: "SWOT Position Axis Panel", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.mapFill })
    + lineFrameShapeXml({ id: 1861, name: "SWOT Position Axis Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1862, name: "SWOT Position Axis Vertical", x: x + Math.round(w / 2), y: y + 243840, cx: 15240, cy: h - 487680, fill: palette.axis })
    + rectShapeXml({ id: 1863, name: "SWOT Position Axis Horizontal", x: x + 243840, y: y + Math.round(h / 2), cx: w - 487680, cy: 15240, fill: palette.axis })
    + solidShapeXml({ id: 1864, name: "SWOT Position Axis", geom: "ellipse", x: x + Math.round(w * 0.62), y: y + Math.round(h * 0.22), cx: 182880, cy: 182880, fill: visual.accent })
    + solidShapeXml({ id: 1865, name: "SWOT Position Competitor A", geom: "ellipse", x: x + Math.round(w * 0.28), y: y + Math.round(h * 0.52), cx: 152400, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 1866, name: "SWOT Position Competitor B", geom: "ellipse", x: x + Math.round(w * 0.72), y: y + Math.round(h * 0.60), cx: 152400, cy: 152400, fill: palette.warning })
    + textShapeXml({ id: 1867, name: "SWOT Axis Label Top", x: x + 121920, y: y + 121920, cx: 975360, cy: 182880, text: "优势强度", size: 560, bold: true, color: visual.body })
    + textShapeXml({ id: 1868, name: "SWOT Axis Label Bottom", x: x + w - 1097280, y: y + h - 304800, cx: 975360, cy: 182880, text: "市场机会", size: 560, bold: true, color: visual.body });
}

function swotMapBulletCardsXml({ visual, palette, items, isClosing }) {
  const x = 731520;
  const y = isClosing ? 2217420 : 2438400;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 335280;
    return rectShapeXml({ id: 1870 + index * 3, name: `SWOT Insight Accent ${index + 1}`, x, y: offsetY + 38100, cx: 60960, cy: 198120, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1871 + index * 3, name: `SWOT Insight Text ${index + 1}`, x: x + 121920, y: offsetY, cx: 3444240, cy: 243840, text: swotMapCompactText(item, "", 34), size: 720, bold: false, color: visual.body });
  }).join("");
}

function swotMapStrategyCardsXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 3474720;
  const labels = ["SO", "ST", "WO", "WT"];
  return labels.map((label, index) => {
    const offsetX = x + (index % 2) * 1371600;
    const offsetY = y + Math.floor(index / 2) * 502920;
    const fill = index % 2 ? palette.card : blendHexColor(visual.accent, visual.surface, 0.82);
    return solidShapeXml({ id: 1880 + index * 4, name: `SWOT Strategy Card ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: 1219200, cy: 396240, fill })
      + textShapeXml({ id: 1881 + index * 4, name: `SWOT Strategy Label ${index + 1}`, x: offsetX + 121920, y: offsetY + 91440, cx: 304800, cy: 182880, text: label, size: 720, bold: true, color: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1882 + index * 4, name: `SWOT Strategy Text ${index + 1}`, x: offsetX + 457200, y: offsetY + 106680, cx: 609600, cy: 152400, text: swotMapCompactText(items[index], "策略动作", 8), size: 580, bold: true, color: visual.title });
  }).join("");
}

function swotMapCompareCardsXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 5394960 + (index % 2) * 1371600;
    const y = 1066800 + Math.floor(index / 2) * 914400;
    return solidShapeXml({ id: 1900 + index * 4, name: `SWOT Compare Card ${index + 1}`, geom: "roundRect", x, y, cx: 1219200, cy: 731520, fill: index % 2 ? palette.card : blendHexColor(visual.accent, visual.surface, 0.86) })
      + rectShapeXml({ id: 1901 + index * 4, name: `SWOT Compare Rule ${index + 1}`, x: x + 152400, y: y + 152400, cx: 457200, cy: 45720, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1902 + index * 4, name: `SWOT Compare Text ${index + 1}`, x: x + 152400, y: y + 304800, cx: 914400, cy: 243840, text: swotMapCompactText(item, "", 12), size: 700, bold: true, color: visual.title });
  }).join("");
}

function swotMapScoreBarsXml({ visual, palette, items }) {
  return items.slice(0, 4).map((item, index) => {
    const x = 5394960;
    const y = 3375660 + index * 259080;
    const width = 914400 + index * 304800;
    return textShapeXml({ id: 1920 + index * 3, name: `SWOT Score Label ${index + 1}`, x, y: y - 45720, cx: 792480, cy: 152400, text: swotMapCompactText(item, `能力${index + 1}`, 5), size: 520, bold: true, color: visual.body })
      + rectShapeXml({ id: 1921 + index * 3, name: `SWOT Score Track ${index + 1}`, x: x + 853440, y, cx: 1828800, cy: 76200, fill: palette.card })
      + rectShapeXml({ id: 1922 + index * 3, name: `SWOT Score Bar ${index + 1}`, x: x + 853440, y, cx: width, cy: 76200, fill: index % 2 ? visual.primary : visual.accent });
  }).join("");
}

function swotMapRiskGridXml({ visual, palette, items }) {
  const labels = ["机会", "威胁", "响应", "优先级"];
  return labels.map((label, index) => {
    const x = 5265420 + (index % 2) * 1447800;
    const y = 1036320 + Math.floor(index / 2) * 868680;
    const isThreat = index === 1;
    return solidShapeXml({ id: 1940 + index * 4, name: `SWOT Risk Grid ${index + 1}`, geom: "roundRect", x, y, cx: 1280160, cy: 731520, fill: isThreat ? blendHexColor(palette.warning, visual.surface, 0.78) : palette.card })
      + textShapeXml({ id: 1941 + index * 4, name: `SWOT Risk Label ${index + 1}`, x: x + 152400, y: y + 137160, cx: 762000, cy: 182880, text: label, size: 760, bold: true, color: isThreat ? palette.warning : visual.primary })
      + textShapeXml({ id: 1942 + index * 4, name: `SWOT Risk Text ${index + 1}`, x: x + 152400, y: y + 381000, cx: 975360, cy: 182880, text: swotMapCompactText(items[index], "", 12), size: 620, bold: true, color: visual.title });
  }).join("");
}

function swotMapScene({ slide, index, role }) {
  const bullets = swotMapBulletTexts(slide);
  const tags = ["SO 增长", "ST 防守", "WO 补位", "WT 收缩"].map((fallback, itemIndex) => swotMapCompactText(bullets[itemIndex], fallback, 8));
  const cards = ["核心优势", "关键短板", "机会窗口", "外部威胁"].map((fallback, itemIndex) => swotMapCompactText(bullets[itemIndex], fallback, 12));
  if (role === "closing") {
    return { kind: "closing", kicker: "STRATEGIC ACTIONS", bullets, tags, cards: ["放大优势打法", "建立风险护栏", "补齐短板能力", "锁定差异化战场"].map((fallback, itemIndex) => swotMapCompactText(bullets[itemIndex], fallback, 12)) };
  }
  const scenes = [
    { kind: "cover", kicker: "COMPETITOR SWOT", bullets, tags, cards },
    { kind: "overview", kicker: "SWOT OVERVIEW", bullets, tags, cards },
    { kind: "position", kicker: "POSITIONING MAP", bullets, tags, cards },
    { kind: "compare", kicker: "CAPABILITY GAP", bullets, tags, cards },
    { kind: "risk", kicker: "OPPORTUNITY & THREAT", bullets, tags, cards },
    { kind: "strategy", kicker: "STRATEGIC ACTIONS", bullets, tags, cards: ["SO 增长打法", "ST 防守策略", "WO 补位计划", "WT 风险收缩"].map((fallback, itemIndex) => swotMapCompactText(bullets[itemIndex], fallback, 12)) },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function swotMapBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).map((item) => item.trim()).filter(Boolean) : [];
  return values.length ? values : ["竞品能力分布呈现强弱分化", "差异化机会集中在高价值场景", "需要建立可验证的策略动作"];
}

function swotMapCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function swotMapColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.12),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.74),
    axis: blendHexColor(visual.primary, visual.background, 0.35),
    mapFill: blendHexColor(visual.background, visual.surface, 0.44),
    strength: visual.primary,
    weakness: visual.accent,
    opportunity: visual.secondary || "22C55E",
    threat: visual.warning || "F97316",
    warning: visual.warning || "F97316",
  };
}

function productPainPointsDecorationsXml({ visual, index, layout, role, slide }) {
  const scene = productPainPointsScene({ slide, index, role });
  const palette = productPainPointsColorPalette(visual);
  const isClosing = role === "closing";
  const surface = solidShapeXml({ id: 1521, name: "Product Pain Point Canvas", geom: "roundRect", ...layout.surface, fill: visual.surface });
  const header = solidShapeXml({ id: 1522, name: "Product Pain Header Bar", x: 0, y: 0, cx: 9144000, cy: 304800, fill: visual.primary })
    + rectShapeXml({ id: 1523, name: "Product Pain Accent Rule", x: 0, y: 274320, cx: 9144000, cy: 30480, fill: visual.accent })
    + lineFrameShapeXml({ id: 1524, name: "Product Pain Canvas Frame", geom: "roundRect", ...layout.surface, stroke: palette.frame, width: 15240 })
    + textShapeXml({ id: 1525, name: "Product Pain Section Label", ...layout.label, text: scene.kicker, size: 820, bold: true, color: visual.accent });
  const focusRule = rectShapeXml({ id: 1526, name: "Product Pain Focus Rule", ...layout.secondaryAccent, fill: visual.accent });
  const bulletCards = productPainPointBulletCardsXml({ visual, palette, items: scene.bullets, isClosing });

  if (isClosing) {
    return surface + header + focusRule + bulletCards + productPainPointActionCardsXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "scenario") {
    return surface + header + focusRule + bulletCards + productPainPointPersonaXml({ visual, palette }) + productPainPointJourneyXml({ visual, palette, items: scene.cards });
  }
  if (scene.kind === "evidence") {
    return surface + header + focusRule + bulletCards + productPainPointEvidenceCardsXml({ visual, palette, items: scene.cards }) + productPainPointTagCardsXml({ visual, palette, items: scene.tags });
  }
  if (scene.kind === "distribution") {
    return surface + header + focusRule + bulletCards + productPainPointMatrixXml({ visual, palette }) + productPainPointTagCardsXml({ visual, palette, items: scene.tags });
  }
  if (scene.kind === "opportunity") {
    return surface + header + focusRule + bulletCards + productPainPointNotesXml({ visual, palette, items: scene.cards });
  }
  return surface + header + focusRule + bulletCards + productPainPointPersonaXml({ visual, palette }) + productPainPointTagCardsXml({ visual, palette, items: scene.tags });
}

function productPainPointPersonaXml({ visual, palette }) {
  const x = 5486400;
  const y = 1005840;
  const w = 2827020;
  const h = 2133600;
  // 右侧画像面板用可编辑图形表达用户、场景和触点，不依赖整页截图。
  return solidShapeXml({ id: 1530, name: "Product Pain Persona Panel", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.panel })
    + lineFrameShapeXml({ id: 1531, name: "Product Pain Persona Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + solidShapeXml({ id: 1532, name: "Product Pain Persona Avatar", geom: "ellipse", x: x + 243840, y: y + 289560, cx: 426720, cy: 426720, fill: blendHexColor(visual.primary, "FFFFFF", 0.22) })
    + solidShapeXml({ id: 1533, name: "Product Pain Persona Head", geom: "ellipse", x: x + 381000, y: y + 350520, cx: 152400, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 1534, name: "Product Pain Persona Body", geom: "roundRect", x: x + 335280, y: y + 510540, cx: 243840, cy: 182880, fill: visual.primary })
    + rectShapeXml({ id: 1535, name: "Product Pain Persona Line 1", x: x + 883920, y: y + 350520, cx: 1127760, cy: 45720, fill: palette.line })
    + rectShapeXml({ id: 1536, name: "Product Pain Persona Line 2", x: x + 883920, y: y + 518160, cx: 823000, cy: 45720, fill: palette.line })
    + rectShapeXml({ id: 1537, name: "Product Pain Persona Journey Rule", x: x + 365760, y: y + 1158240, cx: 2011680, cy: 15240, fill: palette.axis })
    + [0, 1, 2].map((itemIndex) => solidShapeXml({ id: 1538 + itemIndex, name: `Product Pain Touchpoint ${itemIndex + 1}`, geom: "ellipse", x: x + 487680 + itemIndex * 731520, y: y + 1082040 + (itemIndex === 1 ? -152400 : 152400), cx: 152400, cy: 152400, fill: itemIndex === 1 ? visual.primary : visual.accent })).join("");
}

function productPainPointBulletCardsXml({ visual, palette, items, isClosing }) {
  const x = 731520;
  const y = isClosing ? 2217420 : 2438400;
  return items.slice(0, 3).map((item, index) => {
    const offsetY = y + index * 335280;
    return rectShapeXml({ id: 1560 + index * 3, name: `Product Pain Insight Accent ${index + 1}`, x, y: offsetY + 38100, cx: 60960, cy: 198120, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1561 + index * 3, name: `Product Pain Insight Text ${index + 1}`, x: x + 121920, y: offsetY, cx: 3444240, cy: 243840, text: productPainPointCompactText(item, "", 36), size: 720, bold: false, color: visual.body });
  }).join("");
}

function productPainPointTagCardsXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3825240;
  const width = 1280160;
  return items.slice(0, 3).map((item, index) => {
    const offsetX = x + index * 1432560;
    return solidShapeXml({ id: 1570 + index * 3, name: `Product Pain Tag ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: width, cy: 518160, fill: palette.card })
      + rectShapeXml({ id: 1571 + index * 3, name: `Product Pain Tag Accent ${index + 1}`, x: offsetX, y, cx: 60960, cy: 518160, fill: index === 1 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1572 + index * 3, name: `Product Pain Tag Text ${index + 1}`, x: offsetX + 152400, y: y + 167640, cx: width - 274320, cy: 182880, text: productPainPointCompactText(item, "", 8), size: 760, bold: true, color: visual.title });
  }).join("");
}

function productPainPointJourneyXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 3429000;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 701040;
    return solidShapeXml({ id: 1580 + index * 3, name: `Product Pain Journey Step ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 548640, cy: 579120, fill: palette.card })
      + solidShapeXml({ id: 1581 + index * 3, name: `Product Pain Journey Dot ${index + 1}`, geom: "ellipse", x: offsetX + 198120, y: y + 121920, cx: 137160, cy: 137160, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1582 + index * 3, name: `Product Pain Journey Text ${index + 1}`, x: offsetX + 76200, y: y + 335280, cx: 396240, cy: 137160, text: productPainPointCompactText(item, "", 6), size: 620, bold: true, color: visual.title });
  }).join("");
}

function productPainPointEvidenceCardsXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1219200;
  const width = 1280160;
  const height = 731520;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + (index % 2) * (width + 182880);
    const offsetY = y + Math.floor(index / 2) * (height + 152400);
    return solidShapeXml({ id: 1590 + index * 4, name: `Product Pain Evidence Card ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: width, cy: height, fill: palette.card })
      + solidShapeXml({ id: 1591 + index * 4, name: `Product Pain Evidence Dot ${index + 1}`, geom: "ellipse", x: offsetX + 152400, y: offsetY + 152400, cx: 152400, cy: 152400, fill: index % 2 ? visual.primary : visual.accent })
      + rectShapeXml({ id: 1592 + index * 4, name: `Product Pain Evidence Rule ${index + 1}`, x: offsetX + 365760, y: offsetY + 205740, cx: 579120, cy: 30480, fill: palette.line })
      + textShapeXml({ id: 1593 + index * 4, name: `Product Pain Evidence Text ${index + 1}`, x: offsetX + 152400, y: offsetY + 426720, cx: width - 304800, cy: 167640, text: productPainPointCompactText(item, "", 10), size: 660, bold: true, color: visual.title });
  }).join("");
}

function productPainPointMatrixXml({ visual, palette }) {
  const x = 5486400;
  const y = 1066800;
  const w = 2827020;
  const h = 2133600;
  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const offsetX = x + Math.round((w / 5) * (index + 1));
    const offsetY = y + Math.round((h / 5) * (index + 1));
    return rectShapeXml({ id: 1600 + index * 2, name: `Product Pain Grid V ${index + 1}`, x: offsetX, y, cx: 7620, cy: h, fill: palette.grid, transparency: 45000 })
      + rectShapeXml({ id: 1601 + index * 2, name: `Product Pain Grid H ${index + 1}`, x, y: offsetY, cx: w, cy: 7620, fill: palette.grid, transparency: 45000 });
  }).join("");
  return solidShapeXml({ id: 1598, name: "Product Pain Distribution Matrix", geom: "roundRect", x, y, cx: w, cy: h, fill: palette.panel })
    + gridLines
    + lineFrameShapeXml({ id: 1599, name: "Product Pain Distribution Frame", geom: "roundRect", x, y, cx: w, cy: h, stroke: palette.frame, width: 15240 })
    + rectShapeXml({ id: 1608, name: "Product Pain Matrix Axis X", x: x + 304800, y: y + Math.round(h / 2), cx: w - 609600, cy: 15240, fill: palette.axis })
    + rectShapeXml({ id: 1609, name: "Product Pain Matrix Axis Y", x: x + Math.round(w / 2), y: y + 304800, cx: 15240, cy: h - 609600, fill: palette.axis })
    + solidShapeXml({ id: 1610, name: "Product Pain High Frequency Node", geom: "ellipse", x: x + Math.round(w * 0.20), y: y + Math.round(h * 0.63), cx: 152400, cy: 152400, fill: visual.accent })
    + solidShapeXml({ id: 1611, name: "Product Pain High Impact Node", geom: "ellipse", x: x + Math.round(w * 0.48), y: y + Math.round(h * 0.24), cx: 152400, cy: 152400, fill: visual.primary })
    + solidShapeXml({ id: 1612, name: "Product Pain Opportunity Node", geom: "ellipse", x: x + Math.round(w * 0.72), y: y + Math.round(h * 0.45), cx: 152400, cy: 152400, fill: visual.accent });
}

function productPainPointNotesXml({ visual, palette, items }) {
  const x = 5486400;
  const y = 1188720;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + (index % 2) * 1432560;
    const offsetY = y + Math.floor(index / 2) * 914400;
    return solidShapeXml({ id: 1620 + index * 3, name: `Product Pain Opportunity Note ${index + 1}`, geom: "roundRect", x: offsetX, y: offsetY, cx: 1249680, cy: 701040, fill: index % 2 ? palette.panel : palette.card })
      + rectShapeXml({ id: 1621 + index * 3, name: `Product Pain Opportunity Note Rule ${index + 1}`, x: offsetX + 152400, y: offsetY + 152400, cx: 426720, cy: 30480, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1622 + index * 3, name: `Product Pain Opportunity Note Text ${index + 1}`, x: offsetX + 152400, y: offsetY + 304800, cx: 914400, cy: 182880, text: productPainPointCompactText(item, "", 12), size: 680, bold: true, color: visual.title });
  }).join("");
}

function productPainPointActionCardsXml({ visual, palette, items }) {
  const x = 731520;
  const y = 3543300;
  return items.slice(0, 4).map((item, index) => {
    const offsetX = x + index * 1981200;
    return solidShapeXml({ id: 1640 + index * 3, name: `Product Pain Next Action ${index + 1}`, geom: "roundRect", x: offsetX, y, cx: 1676400, cy: 609600, fill: palette.card })
      + solidShapeXml({ id: 1641 + index * 3, name: `Product Pain Next Action Dot ${index + 1}`, geom: "ellipse", x: offsetX + 152400, y: y + 121920, cx: 167640, cy: 167640, fill: index % 2 ? visual.primary : visual.accent })
      + textShapeXml({ id: 1642 + index * 3, name: `Product Pain Next Action Text ${index + 1}`, x: offsetX + 152400, y: y + 335280, cx: 1371600, cy: 182880, text: productPainPointCompactText(item, "", 12), size: 740, bold: true, color: visual.title });
  }).join("");
}

function productPainPointsScene({ slide, index, role }) {
  const bullets = productPainPointBulletTexts(slide);
  const tags = ["画像", "场景", "机会"].map((fallback, itemIndex) => productPainPointCompactText(bullets[itemIndex], fallback, 8));
  const cards = ["触发", "阻碍", "影响", "诉求"].map((fallback, itemIndex) => productPainPointCompactText(bullets[itemIndex], fallback, 12));
  if (role === "closing") {
    return { kind: "closing", kicker: "PRODUCT NEXT STEPS", bullets, tags, cards: ["验证假设", "收敛需求", "推进原型", "复盘指标"].map((fallback, itemIndex) => productPainPointCompactText(bullets[itemIndex], fallback, 12)) };
  }
  const scenes = [
    { kind: "cover", kicker: "USER PAIN POINTS", bullets, tags, cards },
    { kind: "scenario", kicker: "SCENARIO JOURNEY", bullets, tags, cards },
    { kind: "evidence", kicker: "EVIDENCE SIGNALS", bullets, tags, cards },
    { kind: "distribution", kicker: "PAIN DISTRIBUTION", bullets, tags, cards },
    { kind: "opportunity", kicker: "REQUIREMENT OPPORTUNITY", bullets, tags, cards },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function productPainPointBulletTexts(slide) {
  const values = Array.isArray(slide?.bullets) ? slide.bullets.map(exportTextValue).filter(Boolean) : [];
  return values.length ? values : ["目标用户在关键流程中频繁中断", "反馈证据集中在效率和理解成本", "需求机会需要进入原型验证"];
}

function productPainPointCompactText(text, fallback, maxLength) {
  const value = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (Array.from(value).length <= maxLength) return value;
  return `${Array.from(value).slice(0, maxLength).join("")}...`;
}

function productPainPointsColorPalette(visual) {
  return {
    card: blendHexColor(visual.surface, visual.background, 0.12),
    panel: blendHexColor(visual.background, visual.surface, 0.48),
    frame: blendHexColor(visual.primary, "FFFFFF", 0.74),
    axis: blendHexColor(visual.primary, visual.background, 0.34),
    grid: blendHexColor(visual.primary, visual.background, 0.64),
    line: blendHexColor(visual.accent, visual.surface, 0.36),
  };
}

function industryResearchScene({ index, role }) {
  if (role === "closing") {
    return {
      kind: "closing",
      kicker: "NEXT STEPS",
      metrics: [],
      chain: ["补充研究", "策略判断", "落地路径"],
      risks: ["下一步"],
    };
  }
  const scenes = [
    {
      kind: "cover",
      kicker: "MARKET STRUCTURE",
      metrics: [
        { value: "规模", label: "市场容量" },
        { value: "增速", label: "增长变化" },
        { value: "玩家", label: "核心竞争" },
      ],
      chain: ["上游资源", "核心环节", "下游客户"],
      risks: ["结构变化", "竞争分层", "机会窗口"],
    },
    {
      kind: "overview",
      kicker: "MARKET OVERVIEW",
      metrics: [
        { value: "TAM", label: "总体市场" },
        { value: "CAGR", label: "增长速度" },
        { value: "TOP", label: "头部集中" },
      ],
      chain: ["规模", "增速", "结构"],
      risks: ["市场边界", "增长驱动", "结构拆分"],
    },
    {
      kind: "chain",
      kicker: "VALUE CHAIN",
      metrics: [],
      chain: ["上游供给", "核心制造", "渠道客户"],
      risks: ["价值迁移", "瓶颈环节", "利润分布"],
    },
    {
      kind: "competition",
      kicker: "COMPETITIVE MAP",
      metrics: [],
      chain: ["领先者", "挑战者", "利基者"],
      risks: ["头部玩家", "差异定位", "能力边界"],
    },
    {
      kind: "risk",
      kicker: "OPPORTUNITY & RISK",
      metrics: [],
      chain: ["优先级", "资源", "节奏"],
      risks: ["机会窗口", "关键风险", "建议动作"],
    },
  ];
  return scenes[Math.min(index, scenes.length - 1)];
}

function isIndustryResearchVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "industry-research" && (id === "industry-research" || id === "strategy-industry-research-industry-landscape");
}

function financialReviewDecorationsXml({ visual, index, layout }) {
  const scene = financialReviewScene(visual);
  const palette = financialReviewColorPalette(visual);
  const isCover = index === 0;
  return solidShapeXml({ id: 100, name: "Financial Visual Panel", geom: "roundRect", x: 6233160, y: 1394460, cx: 2011680, cy: 1463040, fill: palette.panel })
    + lineFrameShapeXml({ id: 101, name: "Financial Visual Frame", geom: "roundRect", x: 6141720, y: 1303020, cx: 2011680, cy: 1463040, stroke: visual.accent, width: 15240 })
    + solidShapeXml({ id: 102, name: `Financial ${scene.variant} Chip`, geom: scene.chipShape, x: 7040880, y: 914400, cx: 822960, cy: 274320, fill: palette.chip })
    + textShapeXml({ id: 103, name: "Financial Chip Text", x: 7162800, y: 967740, cx: 548640, cy: 152400, text: "", size: 800, bold: true, color: "FFFFFF" })
    + textShapeXml({ id: 104, name: "Financial Section Label", ...layout.label, text: isCover ? scene.kicker : scene.section, size: 1000, bold: true, color: visual.accent })
    + solidShapeXml({ id: 105, name: "Financial Focus Line", x: 914400, y: isCover ? 3322320 : 1516380, cx: 3505200, cy: 22860, fill: visual.accent })
    + financialReviewVisualXml({ visual, palette, scene });
}

function financialReviewVisualXml({ visual, palette, scene }) {
  if (scene.variant === "control-room") {
    return solidShapeXml({ id: 110, name: "Operating Dashboard Radar", geom: "ellipse", x: 6477000, y: 1584960, cx: 548640, cy: 548640, fill: palette.soft })
      + lineFrameShapeXml({ id: 111, name: "Operating Dashboard Ring", geom: "ellipse", x: 6385560, y: 1493520, cx: 731520, cy: 731520, stroke: visual.accent, width: 22860 })
      + solidShapeXml({ id: 112, name: "Operating Dashboard Trend Base", x: 6423660, y: 2484120, cx: 1463040, cy: 22860, fill: palette.line })
      + [0, 1, 2].map((itemIndex) => solidShapeXml({ id: 113 + itemIndex, name: `Operating Dashboard KPI ${itemIndex + 1}`, geom: "roundRect", x: 6926580, y: 1569720 + itemIndex * 304800, cx: 762000, cy: 152400, fill: itemIndex === 1 ? visual.accent : palette.soft })).join("");
  }
  if (scene.variant === "warning") {
    return [0, 1, 2].map((itemIndex) => {
      const y = 1615440 + itemIndex * 350520;
      return solidShapeXml({ id: 110 + itemIndex * 4, name: `Operating Warning Light ${itemIndex + 1}`, geom: "ellipse", x: 6454140, y, cx: 182880, cy: 182880, fill: itemIndex === 1 ? "EF4444" : visual.accent })
        + solidShapeXml({ id: 111 + itemIndex * 4, name: `Operating Warning Bar ${itemIndex + 1}`, geom: "roundRect", x: 6774180, y: y + 30480, cx: 1127760 - itemIndex * 152400, cy: 121920, fill: palette.soft });
    }).join("");
  }
  if (scene.variant === "monthly") {
    return solidShapeXml({ id: 110, name: "Operating Monthly Calendar", geom: "roundRect", x: 6454140, y: 1546860, cx: 1371600, cy: 990600, fill: palette.soft })
      + rectShapeXml({ id: 111, name: "Operating Monthly Calendar Header", x: 6454140, y: 1546860, cx: 1371600, cy: 182880, fill: visual.primary })
      + [0, 1, 2, 3].map((itemIndex) => solidShapeXml({ id: 112 + itemIndex, name: `Operating Monthly Trend ${itemIndex + 1}`, geom: "roundRect", x: 6507480 + itemIndex * 274320, y: 2346960 - itemIndex * 121920, cx: 121920, cy: 121920 + itemIndex * 121920, fill: itemIndex === 3 ? visual.accent : blendHexColor(visual.accent, visual.surface, 0.32) })).join("");
  }
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
    "control-room": {
      variant: "control-room",
      kicker: "CONTROL PANEL",
      section: "KPI OVERVIEW",
      chip: "监控",
      chipShape: "roundRect",
      points: ["核心指标", "趋势监控", "经营结论"],
    },
    warning: {
      variant: "warning",
      kicker: "RISK SIGNAL",
      section: "EXCEPTION REVIEW",
      chip: "预警",
      chipShape: "rect",
      points: ["异常指标", "影响范围", "处置动作"],
    },
    monthly: {
      variant: "monthly",
      kicker: "MONTHLY REVIEW",
      section: "OPERATING RHYTHM",
      chip: "月报",
      chipShape: "parallelogram",
      points: ["月度指标", "重点事项", "下月动作"],
    },
  };
  return scenes[variant] || scenes.quarterly;
}

function financialReviewVariant(visual) {
  return ["quarterly", "audit", "forecast", "control-room", "warning", "monthly"].includes(visual?.variant) ? visual.variant : "quarterly";
}

function isFinancialReviewVisual(visual) {
  const id = String(visual?.id || "");
  return (id === "financial-review" || id === "operating-dashboard" || id.startsWith("finance-operating-dashboard-")) && visual?.layout === "executive";
}

function strategyConsultingDecorationsXml({ visual, index, layout }) {
  const scene = strategyConsultingScene(visual);
  const palette = strategyConsultingColorPalette(visual);
  const isCover = index === 0;
  return pictureXml({ id: 60, name: "Strategy Consulting Image", relId: "rId2", x: 6431280, y: 1470660, cx: 1828800, cy: 1280160 })
    + lineFrameShapeXml({ id: 61, name: "Strategy Consulting Image Frame", geom: "roundRect", x: 6339840, y: 1379220, cx: 1828800, cy: 1280160, stroke: visual.accent, width: 15240 })
    + solidShapeXml({ id: 62, name: `Strategy ${scene.variant} Chip`, geom: scene.chipShape, x: 7040880, y: 914400, cx: 822960, cy: 274320, fill: palette.chip })
    + textShapeXml({ id: 63, name: "Strategy Chip Text", x: 7162800, y: 967740, cx: 548640, cy: 152400, text: "", size: 800, bold: true, color: "FFFFFF" })
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
      sticker: "周报",
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
      sticker: "交付",
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
 * 鍒涘缓 top-band 搴曢儴缁嗙綉鏍硷紝璁╅〉闈㈡湁姝ｅ紡 PPT 妯℃澘甯歌鐨勭増蹇冨拰宸ョ▼鎰熻楗般€?
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
 * 鍒涘缓缁濆瀹氫綅鏂囨湰妗嗐€?
 * dome 鐩稿叧鏂囨湰妗嗛粯璁ゅ啓鍏?Source Han Sans 瀛椾綋澹版槑锛岃创杩戝師妯℃澘瀛楀舰銆?
 * 涓绘爣棰樺彲浼犲叆 dome-gold-gradient锛屽鐢?dome.pptx 鐨勯噾鑹叉笎鍙樻枃瀛椼€?
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, text?: string, body?: string, size: number, bold: boolean, color?: string}} input
 * @returns {string}
 */
function textShapeXml({ id, name, x, y, cx, cy, text, body, size, bold, color = "1F2937", fontFace = "", fillStyle = "" }) {
  const resolvedFontFace = fontFace || (String(name).startsWith("Dome") ? DOME_TEXT_FONT : "");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>${body || paragraphXml(text, size, bold, color, resolvedFontFace, fillStyle)}</p:txBody></p:sp>`;
}

/**
 * 鍒涘缓涓€涓?DrawingML 娈佃惤銆?
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
 * 涓烘枃鏈?run 鍐欏叆瀛椾綋鏃忋€?
 * @param {string} fontFace
 * @returns {string}
 */
function fontFaceXml(fontFace) {
  if (!fontFace) return "";
  const escaped = escapeXml(fontFace);
  return `<a:latin typeface="${escaped}"/><a:ea typeface="${escaped}"/>`;
}

/**
 * 鐢熸垚鏂囨湰 run 鐨勫～鍏呮晥鏋溿€?
 * dome-gold-gradient 浣跨敤褰撳墠 red-gold 鑹叉澘鍙傛暟鐢熸垚杩囨浮鑹诧紝鏂瑰悜涓?5400000銆?
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
 * 鍒涘缓 store-only ZIP 鍖呫€?
 * 杩欓噷涓嶅帇缂╂枃浠跺唴瀹癸紝鐩存帴鎷煎嚭 PPTX 闇€瑕佺殑 ZIP 缁撴瀯鍜?CRC銆?
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
 * 鏋勫缓鏈€灏?PDF 鏂囦欢銆?
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
 * 鏋勫缓鐢ㄦ埛涓嬭浇鏂囦欢鍚嶃€?
 * 瑙勫垯: PPT-标题-妯℃澘ID-椤垫暟p-鐢熸垚鏃堕棿-鐭璉D.ext锛屾棦鏂逛究鐢ㄦ埛鍖哄垎锛屼篃淇濇寔 HTTP 澶村拰瀵硅薄瀛樺偍鐨?ASCII 瀹夊叏銆?
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
 * 鐢熸垚鏂囦欢鍚嶇墖娈碉紝绉婚櫎涓枃銆佺┖鏍煎拰鐗规畩瀛楃锛岄伩鍏?Content-Disposition 鍦ㄩ儴鍒嗘祻瑙堝櫒涓贡鐮併€?
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
 * 灏?deck 鏃堕棿鏍囧噯鍖栦负鍖椾含鏃堕棿鍙嬪ソ鐨勭揣鍑戞牸寮忋€?
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
 * 浠?deck ID 涓彁鍙栫煭鏍囪瘑锛屼究浜庡畾浣嶈褰曚笖涓嶈鏂囦欢鍚嶈繃闀裤€?
 * @param {string | undefined} id
 * @returns {string}
 */
function shortDeckId(id) {
  const compact = String(id || "").replaceAll(/[^a-zA-Z0-9]/g, "");
  return compact ? compact.slice(-6) : "";
}

