import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_RENDER_TIMEOUT_MS = 30_000;

/**
 * 使用 LibreOffice/soffice 将已生成的 PPTX 渲染为浏览器可查看的 PDF 预览。
 * 预览和下载使用同一份 PPTX 字节，因此安装渲染器后可以最大限度保证内容一致。
 */
export class LibreOfficePptPreviewRenderer {
  /**
   * @param {{command?: string, imageCommand?: string, timeoutMs?: number, logger?: object}} input
   */
  constructor({ command = "", imageCommand = "", timeoutMs = DEFAULT_RENDER_TIMEOUT_MS, logger } = {}) {
    this.command = command;
    this.imageCommand = imageCommand;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
    this.resolvedCommand = null;
    this.resolvedImageCommand = null;
    this.commandResolved = false;
    this.imageCommandResolved = false;
  }

  /**
   * 将 PPTX Buffer 渲染为预览 HTML；没有可用渲染器或渲染失败时返回 null 触发兜底预览。
   * @param {{pptx: Buffer, fileName: string, deck: object}} input
   * @returns {Promise<string | null>}
   */
  async render({ pptx, fileName, deck }) {
    const command = await this.#resolveCommand();
    if (!command) return null;
    const workDir = await mkdtemp(path.join(tmpdir(), "ppt-preview-"));
    const inputPath = path.join(workDir, safePreviewFileName(fileName || "deck.pptx"));
    const outputPath = inputPath.replace(/\.pptx$/i, ".pdf");
    try {
      await writeFile(inputPath, pptx);
      await execFileAsync(command, [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        inputPath,
      ], {
        timeout: this.timeoutMs,
        windowsHide: true,
      });
      const pdf = await readFile(outputPath);
      const images = await this.#renderPdfImages({ pdfPath: outputPath, workDir });
      if (images.length) {
        return renderPptxImagePreviewHtml({ deck, images, rendererCommand: command });
      }
      return renderPptxPdfPreviewHtml({ deck, pdf, rendererCommand: command });
    } catch (error) {
      this.logger?.warn?.("ppt_preview_renderer_failed", { error: error.message, command });
      return null;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async #resolveCommand() {
    if (this.commandResolved) return this.resolvedCommand;
    this.commandResolved = true;
    const candidates = this.command ? [this.command] : ["soffice", "libreoffice"];
    for (const candidate of candidates) {
      if (await canRunCommand(candidate)) {
        this.resolvedCommand = candidate;
        return candidate;
      }
    }
    return null;
  }

  async #resolveImageCommand() {
    if (this.imageCommandResolved) return this.resolvedImageCommand;
    this.imageCommandResolved = true;
    this.resolvedImageCommand = this.imageCommand || "pdftoppm";
    return this.resolvedImageCommand;
  }

  async #renderPdfImages({ pdfPath, workDir }) {
    const imageCommand = await this.#resolveImageCommand();
    if (!imageCommand) return [];
    const outputPrefix = path.join(workDir, "slide");
    try {
      await execFileAsync(imageCommand, [
        "-png",
        "-r",
        "144",
        pdfPath,
        outputPrefix,
      ], {
        timeout: this.timeoutMs,
        windowsHide: true,
      });
      const files = await readdir(workDir);
      const imageFiles = files
        .filter((file) => /^slide-\d+\.png$/i.test(file))
        .sort((left, right) => Number(left.match(/\d+/)?.[0] || 0) - Number(right.match(/\d+/)?.[0] || 0));
      const images = [];
      for (const file of imageFiles) {
        images.push(await readFile(path.join(workDir, file)));
      }
      return images;
    } catch (error) {
      this.logger?.warn?.("ppt_preview_image_renderer_failed", { error: error.message, command: imageCommand });
      return [];
    }
  }
}

/**
 * 基于真实 PPTX 转换出的逐页 PNG 图片创建预览页面。
 * @param {{deck: object, images: Buffer[], rendererCommand: string}} input
 * @returns {string}
 */
function renderPptxImagePreviewHtml({ deck, images, rendererCommand }) {
  const pages = images.map((image, index) => `<article class="preview-page" aria-label="第 ${index + 1} 页">
    <img src="data:image/png;base64,${image.toString("base64")}" alt="第 ${index + 1} 页真实 PPTX 预览图">
    <span>${index + 1} / ${images.length}</span>
  </article>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.title || "PPT 预览")}</title><style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#edf3fb;color:#0f172a;font-family:Arial,"Microsoft YaHei",sans-serif;}
    body{display:grid;grid-template-rows:auto 1fr;}
    .preview-banner{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #dbe5f2;background:#fff;font-size:12px;color:#475569;}
    .preview-banner strong{color:#1d4ed8;font-size:13px;}
    .preview-pages{display:grid;gap:18px;padding:18px;justify-items:center;overflow:auto;}
    .preview-page{position:relative;width:min(100%,1120px);background:#fff;box-shadow:0 16px 34px rgba(15,23,42,.10);}
    .preview-page img{display:block;width:100%;height:auto;}
    .preview-page span{position:absolute;right:14px;bottom:10px;padding:3px 8px;border-radius:999px;background:rgba(15,23,42,.58);color:#fff;font-size:12px;}
  </style></head><body data-preview-source="rendered-pptx-images">
    <div class="preview-banner"><strong>真实 PPTX 图片预览</strong><span>由 ${escapeHtml(rendererCommand)} 从下载同源 PPTX 转换生成</span></div>
    <main class="preview-pages">${pages}</main>
  </body></html>`;
}

/**
 * 基于真实 PPTX 转换出的 PDF 创建预览页面。
 * @param {{deck: object, pdf: Buffer, rendererCommand: string}} input
 * @returns {string}
 */
function renderPptxPdfPreviewHtml({ deck, pdf, rendererCommand }) {
  const pdfBase64 = pdf.toString("base64");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.title || "PPT 预览")}</title><style>
    *{box-sizing:border-box}html,body{height:100%;margin:0;background:#edf3fb;color:#0f172a;font-family:Arial,"Microsoft YaHei",sans-serif;}
    body{display:grid;grid-template-rows:auto 1fr;}
    .preview-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #dbe5f2;background:#fff;font-size:12px;color:#475569;}
    .preview-banner strong{color:#1d4ed8;font-size:13px;}
    .preview-pdf{width:100%;height:100%;border:0;background:#dbe5f2;}
  </style></head><body data-preview-source="rendered-pptx">
    <div class="preview-banner"><strong>真实 PPTX 渲染预览</strong><span>由 ${escapeHtml(rendererCommand)} 从下载同源 PPTX 转换生成</span></div>
    <iframe class="preview-pdf" title="真实 PPTX 渲染预览" src="data:application/pdf;base64,${pdfBase64}"></iframe>
  </body></html>`;
}

async function canRunCommand(command, args = ["--version"]) {
  try {
    await execFileAsync(command, args, { timeout: 4000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function safePreviewFileName(fileName) {
  const normalized = String(fileName || "deck.pptx").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
  return normalized.toLowerCase().endsWith(".pptx") ? normalized : `${normalized}.pptx`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
