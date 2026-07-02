#!/usr/bin/env node
/**
 * Extracts embedded images from a .pptx and converts them to JPG background
 * candidates for a master-based template.
 *
 * A .pptx is a zip; full-bleed slide backgrounds usually live in ppt/media/.
 * This script unzips the media, converts each image to JPG (via Python/Pillow,
 * so TIFF/PNG are handled), reports dimensions, and flags ~16:9 full-bleed
 * candidates suitable as template backgrounds.
 *
 * Usage:
 *   node scripts/extract-pptx-media.mjs <source.pptx> <outDir>
 *
 * Tools required on PATH: unzip, python3 (with Pillow).
 * Then pick candidates and rename per app/master-template-asset-spec.md §2.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";

const [, , sourceArg, outArg] = process.argv;

if (!sourceArg || !outArg) {
  console.error("用法: node scripts/extract-pptx-media.mjs <source.pptx> <outDir>");
  process.exit(1);
}

const source = resolve(sourceArg);
const outDir = resolve(outArg);

if (!existsSync(source)) {
  console.error(`找不到 pptx: ${source}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const staging = mkdtempSync(join(tmpdir(), "pptx-media-"));

try {
  // 1. 解出 ppt/media 下的所有图片(pptx 即 zip)。
  try {
    execFileSync("unzip", ["-o", "-j", source, "ppt/media/*", "-d", staging], { stdio: "ignore" });
  } catch {
    console.error("解压失败:请确认已安装 unzip,且该 pptx 含 ppt/media。");
    process.exit(1);
  }

  const files = readdirSync(staging).filter((name) => /\.(png|jpe?g|tif?f|bmp|gif|webp)$/i.test(name));
  if (files.length === 0) {
    console.error("pptx 内未发现可用图片。");
    process.exit(1);
  }

  // 2. 用 Pillow 把每张图转成 JPG 并输出尺寸;16:9 且够大的标为整图背景候选。
  const py = `
import sys, os
from PIL import Image
staging, out = sys.argv[1], sys.argv[2]
rows = []
for name in sorted(os.listdir(staging)):
    src = os.path.join(staging, name)
    try:
        im = Image.open(src).convert("RGB")
    except Exception as e:
        print("SKIP\\t%s\\t%s" % (name, e)); continue
    w, h = im.size
    stem = os.path.splitext(name)[0]
    dst = os.path.join(out, stem + ".jpg")
    im.save(dst, "JPEG", quality=86)
    ratio = w / h if h else 0
    full_bleed = (abs(ratio - 16/9) < 0.06) and (w >= 1200)
    rows.append((os.path.basename(dst), w, h, round(ratio, 3), full_bleed, os.path.getsize(dst)))
rows.sort(key=lambda r: (not r[4], -(r[1]*r[2])))
print("FILE\\tW\\tH\\tRATIO\\tFULLBLEED\\tBYTES")
for r in rows:
    print("%s\\t%d\\t%d\\t%s\\t%s\\t%d" % (r[0], r[1], r[2], r[3], "YES" if r[4] else "-", r[5]))
`;
  const report = execFileSync("python3", ["-c", py, staging, outDir], { encoding: "utf8" });

  console.log(`源: ${basename(source)}`);
  console.log(`输出: ${outDir}\n`);
  console.log(report.trimEnd());
  console.log("\n提示: FULLBLEED=YES 的是 16:9 整图背景候选。");
  console.log("按 app/master-template-asset-spec.md §2 从中挑图并重命名为 cover.jpg / content.jpg / closing.jpg 等。");
} finally {
  rmSync(staging, { recursive: true, force: true });
}
