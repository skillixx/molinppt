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
 * 灏嗗叚浣嶅崄鍏繘鍒堕鑹茶浆鎹㈡垚 PDF 濉厖鑹叉搷浣溿€?
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
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${groupShapeXml()}${templateDecorationsXml(visual, index, layout, role, slide)}${textShapeXml({ id: 20, name: titleName, ...layout.title, text: slide.title, size: titleSize, bold: true, color: titleColor, fontFace, fillStyle: titleFillStyle })}${bodyShape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
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
 * 涓?red-gold 鏍囬瀵硅薄璁剧疆鍙鍚嶇О锛屾柟渚垮湪 PPT 缂栬緫鍣ㄩ噷璇嗗埆 dome 椤甸潰灞傜骇銆?
 * @param {object} visual
 * @param {string} role
 * @returns {string}
 */
function resolveTitleSize({ visual, index, title, fallbackSize }) {
  if (!["top-band", "status-report", "annual-summary"].includes(visual.layout)) return fallbackSize;
  const textLength = String(title || "").replace(/\s+/g, "").length;
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
  if (visual.layout === "quarterly-action-loop") return false;
  if (visual.layout === "quarterly-dashboard") return false;
  return shouldRenderDomeBodyList(visual, role);
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
 * 瀛楀彿涓嶅湪杩欓噷缂╂斁锛屽洜涓哄瓧鍙锋湰韬槸 pt 鍊硷紱杩欓噷鍙鐞?OOXML 閲岀殑浣嶇疆鍜屽昂瀵搞€?
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
    return base + quarterlyActionLoopDecorationsXml({ visual, index, layout, slide });
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
          + topBandMetricCardXml({ id: 37, x: 1282700, y: 3657600, number: "01", label: "鎴樼暐", visual, palette })
          + topBandMetricCardXml({ id: 40, x: 3200400, y: 3657600, number: "02", label: "澶嶇洏", visual, palette })
          + topBandMetricCardXml({ id: 43, x: 5118100, y: 3657600, number: "03", label: "琛屽姩", visual, palette })
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
          + textShapeXml({ id: 33, name: "Top Band Insight Title", x: 6553200, y: 2076450, cx: 1219200, cy: 228600, text: "閲嶇偣鍏虫敞", size: 1050, bold: true, color: visual.title })
          + textShapeXml({ id: 34, name: "Top Band Insight Caption", x: 6553200, y: 2350000, cx: 1219200, cy: 365760, text: "楂樼鍐崇瓥瑙嗗浘", size: 800, bold: false, color: visual.body })
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
 * red-gold 浼氭妸浠?dome.pptx 鎻愬彇鍑虹殑灏侀潰銆佸唴瀹硅儗鏅拰鍟嗗姟鍥剧墖鍐欏叆 ppt/media銆?
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
 * 杩欓噷浼樺厛灏婇噸 AI 鎴栧墠绔紶鍏ョ殑 slide.layout锛涙病鏈夋樉寮忓竷灞€鏃讹紝鍐嶆寜椤靛簭鍜屾爣棰樺叧閿瘝鍏滃簳銆?
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
    // 鐩綍椤靛浐瀹氳緭鍑?4 涓崱鐗囨Ы浣嶏紝淇濇寔 dome.pptx 鐨勫崱鐗囧紡鐩綍楠ㄦ灦涓嶅洜鐢ㄦ埛灏戝～鍐呭鑰屽彉鍖栥€?
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
    // 涓夋楠ゆ祦绋嬮〉琛ラ綈鍟嗗姟鍥剧墖灞傦紝淇濇寔娴佺▼绫诲唴瀹归〉涔熸湁 dome.pptx 鐨勫浘鏂囧晢鍔℃皵璐ㄣ€?
    const threeStepsImage = role === "three-steps"
      ? pictureXml({ id: 69, name: "Dome Three Steps Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    // 鍥涙楠ゆ祦绋嬮〉澶嶇敤 dome.pptx 鐨勭 4 寮犲晢鍔″浘锛岄伩鍏嶆彁鍙栧嚭鐨勪笟鍔¤瑙夎祫浜ч棽缃€?
    const fourStepsImage = role === "four-steps"
      ? pictureXml({ id: 70, name: "Dome Four Steps Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    // 涓嬩竴姝ヨ鍒掗〉澶嶇敤 dome.pptx 鐨勭 6 寮犲晢鍔″浘锛屼笌棰勮绔殑 next-plan 瑙嗚淇濇寔涓€鑷淬€?
    const nextPlanImage = role === "next-plan"
      ? pictureXml({ id: 71, name: "Dome Next Plan Image", relId: "rId3", x: 5943600, y: 1371600, cx: 1828800, cy: 1219200 })
      : "";
    return role === "next-plan"
      ? contentSurface + sectionLabel + nextPlanImage + steps + rectShapeXml({ id: 70, name: "Dome Next Plan Timeline", x: 1219200, y: 2438400, cx: 6400800, cy: 30480, fill: visual.accent })
      : contentSurface + sectionLabel + threeStepsImage + fourStepsImage + stepConnector + steps;
  }
  if (role === "metrics") {
    const metricItems = normalizeDomeMetricItems(slide, 3);
    // 鎸囨爣椤典繚鐣欐祬鑹叉壙杞介潰鍜屽彸涓婄珷鑺傛爣绛撅紝浣挎暟鎹崱鐗囦笌 dome.pptx 鍐呭椤靛眰绾т竴鑷淬€?
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
 * 鐢熸垚 dome 鐩綍椤电殑 4 涓崱鐗囨枃妗堛€?
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
        // 灏侀潰鏍囬鍘熸绐?cx 3962400)涓斿彸缂樹几杩涘竼鑸瑰尯,闀挎爣棰樹細浠庤瘝涓棿鏂;鍔犲骞跺乏绉婚伩寮€甯嗚埞,闄嶅瓧鍙疯闀挎爣棰樺湪鍑€鍖哄唴鍧囪　鎹㈣銆?
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
 * 瀹為檯瑙嗚鍐呭閮藉湪姣忛〉 slide XML 涓敓鎴愶紝layout 鍙彁渚?Office 鎵€闇€缁撴瀯銆?
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
 * 涓婚鑹蹭粠 visual 娉ㄥ叆锛屽叿浣?dome 瑁呴グ涓嶆斁鍦?master锛屼究浜庢瘡椤垫寜瑙掕壊宸紓鍖栥€?
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
 * red-gold 澶嶇敤 dome.pptx 鐨?588ku 瀛椾綋鏂规锛屽叾浠栨ā鏉夸繚鐣欏師 Moling 瀛椾綋鏂规銆?
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
 * @param {{id: number, name: string, x: number, y: number, cx: number, cy: number, fill: string}} input
 * @returns {string}
 */
function rectShapeXml({ id, name, x, y, cx, cy, fill }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
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
 * 鍒涘缓浠呮弿杈瑰舰鐘讹紙鐢ㄤ簬鍗＄墖杈规/澶栨锛?
 * @param {{id: number, name: string, geom: string, x: number, y: number, cx: number, cy: number, stroke: string, width?: number}} input
 * @returns {string}
 */
function lineFrameShapeXml({ id, name, geom, x, y, cx, cy, stroke, width = 19050 }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${escapeXml(geom)}"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="${width}" cap="round"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln></p:spPr></p:sp>`;
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
    [6096000, 2286000, 213360, 838200],
    [6553200, 1973580, 213360, 1150620],
    [7010400, 2385060, 213360, 739140],
    [7467600, 1714500, 213360, 1417320],
    [7924800, 2133600, 213360, 990600],
  ];
  return solidShapeXml({ id: 508, name: "Quarterly Dashboard Hero Glass Panel", geom: "roundRect", x: 5715000, y: 1219200, cx: 2819400, cy: 2590800, fill: "2A5A98" })
    + lineFrameShapeXml({ id: 509, name: "Quarterly Dashboard Hero Panel Frame", geom: "roundRect", x: 5715000, y: 1219200, cx: 2819400, cy: 2590800, stroke: "C4D8EF", width: 9525 })
    + rectShapeXml({ id: 518, name: "Quarterly Dashboard Hero Panel Header", x: 5943600, y: 1447800, cx: 2133600, cy: 91440, fill: "C4D8EF" })
    + rectShapeXml({ id: 519, name: "Quarterly Dashboard Hero Axis", x: 5943600, y: 3124200, cx: 2209800, cy: 15240, fill: "8BB2DB" })
    + bars.map(([x, y, cx, cy], index) => solidShapeXml({ id: 510 + index, name: `Quarterly Dashboard Hero Bar ${index + 1}`, geom: "roundRect", x, y, cx, cy, fill: palette.barBlue })).join("");
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
  const labels = ["缁忚惀浜偣", "椋庨櫓璇婃柇", "鏉ュ勾琛屽姩"];
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
        { value: "128%", label: "鐩爣杈炬垚" },
        { value: "36%", label: "涓氬姟澧為暱" },
        { value: "12", label: "椤圭洰钀藉湴" },
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
    + textShapeXml({ id: 1292, name: "Quarterly Action Loop Progress Title", x: 914400, y: 2743200, cx: 1371600, cy: 152400, text: "杩涘害杩借釜", size: 760, bold: true, color: visual.title })
    + bars;
}

function quarterlyActionLoopRoadmapXml({ visual, palette, x, y, idBase }) {
  const labels = ["鐩爣鎷嗚В", "鎵ц杩借釜", "缁撴灉澶嶇洏", "涓嬪浼樺寲"];
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
      chip: "澶嶇洏",
      chipShape: "roundRect",
      points: ["鏀跺叆缁撴瀯", "鍒╂鼎璐ㄩ噺", "鐜伴噾鏁堢巼"],
    },
    audit: {
      variant: "audit",
      kicker: "AUDIT CHECK",
      section: "RISK REVIEW",
      chip: "瀹¤",
      chipShape: "rect",
      points: ["宸紓鏍搁獙", "椋庨櫓搴曠", "鏁存敼闂幆"],
    },
    forecast: {
      variant: "forecast",
      kicker: "FORECAST PLAN",
      section: "BUDGET OUTLOOK",
      chip: "棰勬祴",
      chipShape: "parallelogram",
      points: ["婊氬姩棰勬祴", "棰勭畻鏍″噯", "鎯呮櫙鍋囪"],
    },
    "control-room": {
      variant: "control-room",
      kicker: "CONTROL PANEL",
      section: "KPI OVERVIEW",
      chip: "鐩戞帶",
      chipShape: "roundRect",
      points: ["鏍稿績鎸囨爣", "瓒嬪娍鐩戞帶", "缁忚惀缁撹"],
    },
    warning: {
      variant: "warning",
      kicker: "RISK SIGNAL",
      section: "EXCEPTION REVIEW",
      chip: "棰勮",
      chipShape: "rect",
      points: ["寮傚父鎸囨爣", "褰卞搷鑼冨洿", "澶勭疆鍔ㄤ綔"],
    },
    monthly: {
      variant: "monthly",
      kicker: "MONTHLY REVIEW",
      section: "OPERATING RHYTHM",
      chip: "鏈堟姤",
      chipShape: "parallelogram",
      points: ["鏈堝害鎸囨爣", "閲嶇偣浜嬮」", "涓嬫湀鍔ㄤ綔"],
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
      sticker: "杩涘害",
      metrics: [
        { value: "95%", label: "杩涘害杈炬垚" },
        { value: "3", label: "鍏抽敭椋庨櫓" },
        { value: "7", label: "鏈懆浜嬮」" },
      ],
    },
    steering: {
      variant: "steering",
      kicker: "STEERING MEETING",
      section: "DECISION REVIEW",
      sticker: "鍐崇瓥",
      metrics: [
        { value: "4", label: "鏍稿績璁" },
        { value: "2", label: "寰呭喅浜嬮」" },
        { value: "8", label: "琛屽姩璐ｄ换" },
      ],
    },
    delivery: {
      variant: "delivery",
      kicker: "DELIVERY TRACK",
      section: "MILESTONE CHECK",
      sticker: "楠屾敹",
      metrics: [
        { value: "12", label: "浜や粯鑺傜偣" },
        { value: "96%", label: "楠屾敹閫氳繃" },
        { value: "5", label: "椋庨櫓闂幆" },
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
 * 瑙勫垯: PPT-鏍囬-妯℃澘ID-椤垫暟p-鐢熸垚鏃堕棿-鐭璉D.ext锛屾棦鏂逛究鐢ㄦ埛鍖哄垎锛屼篃淇濇寔 HTTP 澶村拰瀵硅薄瀛樺偍鐨?ASCII 瀹夊叏銆?
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

