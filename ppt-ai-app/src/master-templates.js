import { readFileSync } from "node:fs";

/**
 * Master 模板描述符。
 *
 * 母版路线的商用视觉 = 每页整图背景 + 文字/卡片叠加。此前 dome(red-gold)把素材
 * 路径、画布尺寸、按角色配图全部写死在导出器里,新增模板无法复用。此模块把这些
 * "素材来源"抽成可注册的描述符:导出/预览按描述符取素材,渲染逻辑保持不变,
 * 新官方模板只需注册自己的描述符(自己的 assets 目录 + 画布 + 调色)。
 */

const DOME_ASSET_BASE_URL = new URL("../../templates/official/dome/assets/", import.meta.url);

/**
 * dome(red-gold)描述符:作为通用化后的第一个实例,保持与重构前完全一致的素材。
 */
const DOME_DESCRIPTOR = {
  id: "dome",
  font: "Source Han Sans CN Heavy",
  assetBaseUrl: DOME_ASSET_BASE_URL,
  // dome.pptx 的真实画布(12192000 x 6858000),坐标从旧 16:9 基准等比放大到这里。
  canvas: {
    width: 12192000,
    height: 6858000,
    scaleX: 12192000 / 9144000,
    scaleY: 6858000 / 5143500,
  },
  // 封面/结束用 cover 背景,其余页用 content 背景。
  background: { cover: "dome-cover.jpg", content: "dome-content.jpg" },
  // 不同内容角色复用的商务配图。
  business: {
    "image-report": "dome-business-1.jpeg",
    "three-steps": "dome-business-3.jpeg",
    "four-steps": "dome-business-4.jpeg",
    metrics: "dome-business-5.jpeg",
    showcase: "dome-business-2.jpeg",
    retrospective: "dome-business-3.jpeg",
    "next-plan": "dome-business-6.jpeg",
  },
};

const MASTER_DESCRIPTORS = { dome: DOME_DESCRIPTOR };

/**
 * 注册一个 master 描述符(供新官方模板接入)。
 * @param {object} descriptor
 */
export function registerMasterDescriptor(descriptor) {
  if (!descriptor?.id) throw new Error("master descriptor requires an id");
  MASTER_DESCRIPTORS[descriptor.id] = descriptor;
}

/**
 * 若该 visual 属于 master 模板,返回其描述符,否则返回 null。
 * 触发条件:layout 为 red-gold(dome 别名)或 master;具体素材包由 visual.master 指定,默认 dome。
 * @param {object} visual
 * @returns {object|null}
 */
export function resolveMasterDescriptor(visual) {
  if (!visual) return null;
  if (visual.layout !== "red-gold" && visual.layout !== "master") return null;
  const id = visual.master || (visual.layout === "red-gold" ? "dome" : null);
  return MASTER_DESCRIPTORS[id] || MASTER_DESCRIPTORS.dome;
}

/**
 * 该 master 模板的画布尺寸与缩放。
 * @param {object} descriptor
 * @returns {{width: number, height: number, scaleX: number, scaleY: number}}
 */
export function masterCanvasMetrics(descriptor) {
  return { ...descriptor.canvas };
}

/**
 * 该 master 模板的中文重字体。
 * @param {object} descriptor
 * @returns {string}
 */
export function masterFont(descriptor) {
  return descriptor.font || "";
}

/**
 * 某角色使用的整页背景文件名(封面/结束用 cover,其余用 content)。
 * @param {object} descriptor
 * @param {string} role
 * @returns {string}
 */
export function masterBackgroundFile(descriptor, role) {
  return ["cover", "closing"].includes(role) ? descriptor.background.cover : descriptor.background.content;
}

/**
 * 某内容角色使用的商务配图文件名;无则返回空字符串。
 * @param {object} descriptor
 * @param {string} role
 * @returns {string}
 */
export function masterBusinessMedia(descriptor, role) {
  return descriptor.business?.[role] || "";
}

/**
 * 构造该 master 模板要写入 ppt/media 的媒体文件(背景 + 全部商务配图)。
 * @param {object} descriptor
 * @returns {Record<string, Buffer>}
 */
export function masterMediaFiles(descriptor) {
  const business = Array.from(new Set(Object.values(descriptor.business || {}))).sort();
  const names = [descriptor.background.cover, descriptor.background.content, ...business];
  const files = {};
  for (const name of names) {
    if (!name) continue;
    const target = `ppt/media/${name}`;
    if (files[target]) continue;
    files[target] = readFileSync(new URL(name, descriptor.assetBaseUrl));
  }
  return files;
}
