import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Module from 'node:module';
import { createRequire } from 'node:module';

// 使用浏览器真实渲染 SVG，再截图为 PNG，确保中文字体和版式按浏览器效果导出。
const bundledNodeModules =
  process.env.CODEX_BUNDLED_NODE_MODULES ||
  'C:\\Users\\tqy96\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
process.env.NODE_PATH = [process.env.NODE_PATH, bundledNodeModules].filter(Boolean).join(path.delimiter);
Module._initPaths();

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'docs', 'template-ui-design-previews', 's-level');
const files = (await fs.readdir(outputDir))
  .filter((file) => /^\d{2}-.*\.svg$/.test(file))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1060 }, deviceScaleFactor: 1 });

try {
  for (const file of files) {
    const svgPath = path.join(outputDir, file);
    const pngPath = path.join(outputDir, file.replace(/\.svg$/i, '.png'));

    // 每张 SVG 作为独立页面打开，截图尺寸与 SVG 画布保持一致，便于后续直接作为设计预览图使用。
    await page.goto(pathToFileURL(svgPath).href);
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: 1600, height: 1060 } });
  }
} finally {
  await browser.close();
}

console.log(`已导出 ${files.length} 张 S 级模板 UI PNG 预览图：${outputDir}`);
