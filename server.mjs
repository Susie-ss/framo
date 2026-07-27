import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import AdmZip from "adm-zip";

const PORT = Number(process.env.PORT || 4173);
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(ROOT, "data", "sketch-libraries.json");
const DELETED_LIBRARIES_FILE = join(ROOT, "data", "deleted-library-ids.json");
const PLATFORM_FILE = join(ROOT, "data", "platform.json");
const PLUGIN_FILE = join(ROOT, "downloads", "Flowa-Axure-Plugin-1.0.0.zip");
const SKETCHTOOL = "/Applications/Sketch.app/Contents/MacOS/sketchtool";
const ASSET_ROOT = join(ROOT, "data", "sketch-assets");
const require = createRequire(import.meta.url);
const { createStore } = require("./platform-server/services/library-store.js");
const libraryStore = createStore({
  dataFile: DATA_FILE,
  deletedFile: DELETED_LIBRARIES_FILE,
  assetRoot: ASSET_ROOT
});
const execFileAsync = promisify(execFile);
const MAX_UPLOAD_MB = 200;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

function parseZipCentralDirectory(buffer) {
  const minEOCD = 22;
  const maxCommentLength = 0xffff;
  const searchStart = Math.max(0, buffer.length - minEOCD - maxCommentLength);
  let eocd = -1;
  for (let offset = buffer.length - minEOCD; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Sketch ZIP 中央目录缺失");
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  let centralOffset = buffer.readUInt32LE(eocd + 16);
  if (centralOffset === 0xffffffff || totalEntries === 0xffff) {
    throw new Error("暂不支持 Zip64 格式的 Sketch 文档");
  }
  const entries = new Map();
  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error("Sketch ZIP 中央目录异常");
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const uncompressedSize = buffer.readUInt32LE(centralOffset + 24);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString("utf8");
    entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntryFromCentralDirectory(buffer, entry) {
  if (!entry) throw new Error("Sketch 文档缺少指定条目");
  const localOffset = entry.localOffset;
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Sketch ZIP 条目异常：${entry.name}`);
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRawSync(compressed, { finishFlush: 2 });
  throw new Error(`Sketch ZIP 使用了不支持的压缩方式：${entry.method}`);
}

function readSketchJsonEntries(buffer) {
  const entries = [];
  let entryMap;
  try {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    entries.push(...zipEntries.map((entry) => entry.entryName).filter(Boolean));
    entryMap = new Map(zipEntries.map((entry) => [entry.entryName, { admEntry: entry }]));
  } catch {
    entryMap = null;
  }
  if (!entryMap) {
    const central = parseZipCentralDirectory(buffer);
    entries.push(...central.keys());
    entryMap = new Map([...central.entries()].map(([name, entry]) => [name, { centralEntry: entry }]));
  }
  if (entries.length > 100000) throw new Error("Sketch 文件条目过多，无法安全解析");
  if (entries.some((entry) => entry.startsWith("/") || entry.split("/").includes(".."))) {
    throw new Error("Sketch 文件包含不安全的路径");
  }
  const readEntry = (entryName) => {
    const entry = entryMap.get(entryName);
    if (!entry) throw new Error(`Sketch 文档缺少 ${entryName}`);
    try {
      if (entry.admEntry) return JSON.parse(entry.admEntry.getData().toString("utf8"));
    } catch (error) {
      if (!/ADM-ZIP|Descriptor data/i.test(String(error?.message || error))) throw error;
      const central = parseZipCentralDirectory(buffer);
      const fallback = central.get(entryName);
      if (!fallback) throw error;
      return JSON.parse(readZipEntryFromCentralDirectory(buffer, fallback).toString("utf8"));
    }
    return JSON.parse(readZipEntryFromCentralDirectory(buffer, entry.centralEntry).toString("utf8"));
  };
  return { entries, readEntry };
}

const projects = [
  {
    id: "proj-design-ai",
    name: "企业设计中台",
    description: "绑定 Enterprise Console 组件库，推进 AI 页面生成与原型预览。",
    status: "In Progress",
    pages: 12,
    color: "#5B5EF4",
    tagIds: ["tag-design"],
    updatedAt: "2026-06-24T08:30:00.000Z"
  },
  {
    id: "proj-axure-hosting",
    name: "Axure 托管改造",
    description: "优先打通 HTML 托管、分享、评论与版本展示。",
    status: "Planning",
    pages: 4,
    color: "#06B6D4",
    tagIds: ["tag-prototype"],
    updatedAt: "2026-06-23T11:20:00.000Z"
  },
  {
    id: "proj-spec-parsing",
    name: "规范解析实验",
    description: "对接 PDF / OCR / LLM，输出结构化 Design Token。",
    status: "Research",
    pages: 7,
    color: "#A855F7",
    tagIds: ["tag-ai"],
    updatedAt: "2026-06-22T04:10:00.000Z"
  }
];

const productLines = [
  { id: "tag-design", name: "设计中台", color: "#5B5EF4" },
  { id: "tag-prototype", name: "原型协作", color: "#06B6D4" },
  { id: "tag-ai", name: "AI 实验", color: "#A855F7" }
];

const savedPlatform = await readFile(PLATFORM_FILE, "utf8").then(JSON.parse).catch(() => null);
if (savedPlatform?.projects?.length) projects.splice(0, projects.length, ...savedPlatform.projects);
if (savedPlatform?.productLines?.length) productLines.splice(0, productLines.length, ...savedPlatform.productLines);

async function persistPlatform() {
  await mkdir(dirname(PLATFORM_FILE), { recursive: true });
  await writeFile(PLATFORM_FILE, JSON.stringify({ projects, productLines }, null, 2));
}

if (!existsSync(PLATFORM_FILE)) await persistPlatform();

const libraries = [
  {
    id: "lib-ant-enterprise",
    name: "Enterprise Console",
    version: "0.9.0",
    sourceType: "manual",
    tokens: {
      colorPrimary: "#C85C3D",
      colorSurface: "#FFFDF8",
      colorSuccess: "#2F8F6B",
      borderRadius: "18px",
      spacingBase: 8,
      fontSizeBase: 14
    },
    components: ["button", "card", "stat", "table", "input", "tag"]
  },
  {
    id: "lib-ai-parsed",
    name: "AI Parsed Finance UI",
    version: "0.3.2",
    sourceType: "ai",
    tokens: {
      colorPrimary: "#23463F",
      colorSurface: "#F5F8F7",
      colorAccent: "#5EA38E",
      borderRadius: "16px",
      spacingBase: 10,
      fontSizeBase: 13
    },
    components: ["button", "table", "filter-bar", "metric-card", "drawer"]
  }
];

const savedSketchLibraries = await libraryStore.loadSketchLibraries().catch((error) => {
  console.error("[Framo] 无法读取持久化组件库，回退到本地数据：", error.message);
  return readFile(DATA_FILE, "utf8").then(JSON.parse).catch(() => []);
});
if (Array.isArray(savedSketchLibraries)) libraries.unshift(...savedSketchLibraries);
// 手动/AI 预置库并不位于 sketch-libraries.json 中；保存删除标记，避免服务重启后重新注入。
const deletedLibraryIds = new Set(await libraryStore.loadDeletedLibraryIds().catch((error) => {
  console.error("[Framo] 无法读取删除记录，回退到本地数据：", error.message);
  return readFile(DELETED_LIBRARIES_FILE, "utf8").then(JSON.parse).catch(() => []);
}).then((ids) => Array.isArray(ids) ? ids : []));
for (let index = libraries.length - 1; index >= 0; index -= 1) {
  if (deletedLibraryIds.has(libraries[index].id)) libraries.splice(index, 1);
}

async function persistSketchLibraries() {
  await libraryStore.saveSketchLibraries(libraries);
}

async function persistDeletedLibraryIds() {
  await libraryStore.saveDeletedLibraryIds(deletedLibraryIds);
}

async function deleteLibraries(ids = []) {
  const targets = new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
  if (!targets.size) return { deleted: [] };
  const deleted = [];
  for (let index = libraries.length - 1; index >= 0; index -= 1) {
    const library = libraries[index];
    if (!targets.has(library.id)) continue;
    libraries.splice(index, 1);
    deleted.push(library.id);
    deletedLibraryIds.add(library.id);
    if (library.sourceType === "sketch") {
      await libraryStore.deleteAssets(library.id);
    }
  }
  if (deleted.length) await Promise.all([persistSketchLibraries(), persistDeletedLibraryIds()]);
  return { deleted };
}

function rgba(color = {}) {
  const channel = (value) => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 255);
  const alpha = color.alpha == null ? 1 : Math.max(0, Math.min(1, Number(color.alpha) || 0));
  if (alpha < 1) return `rgba(${channel(color.red)}, ${channel(color.green)}, ${channel(color.blue)}, ${alpha.toFixed(2)})`;
  return `#${[color.red, color.green, color.blue].map((value) => channel(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function walkLayers(layers, visit, trail = []) {
  for (const layer of layers || []) {
    visit(layer, trail);
    walkLayers(layer.layers, visit, [...trail, layer.name || layer._class || "Layer"]);
  }
}

function firstFill(layer) {
  return layer?.style?.fills?.find((fill) => fill.isEnabled !== false && fill.color)?.color;
}

function deepFill(layer) {
  if (!layer || layer.isVisible === false || Number(layer?.style?.contextSettings?.opacity) === 0) return null;
  if (firstFill(layer)) return firstFill(layer);
  for (const child of layer?.layers || []) {
    const color = deepFill(child);
    if (color) return color;
  }
  return null;
}

function sketchPoint(raw, frame, root, offset) {
  const values = String(raw || "").match(/-?\d*\.?\d+/g)?.map(Number) || [];
  if (values.length < 2) return null;
  const x = (offset.x + values[0] * (Number(frame.width) || root.width)) / root.width * 24;
  const y = (offset.y + values[1] * (Number(frame.height) || root.height)) / root.height * 24;
  return [x, y];
}

function pointCommand(point) {
  return `${point[0].toFixed(2)} ${point[1].toFixed(2)}`;
}

function samePoint(left, right) {
  return left && right && Math.abs(left[0] - right[0]) < .001 && Math.abs(left[1] - right[1]) < .001;
}

function iconPaths(layer, paths = [], rootSize = null, offset = { x: 0, y: 0 }, isRoot = true) {
  // Sketch Symbol 常包含隐藏的「规范」图层。它们只能用于编辑参考，
  // 不能进入图标 SVG，否则会把真实图形挤出路径上限并污染颜色。
  if (!layer || layer.isVisible === false || Number(layer?.style?.contextSettings?.opacity) === 0) return paths;
  if (paths.length >= 32) return paths;
  const frame = layer?.frame || {};
  const root = rootSize || { width: Math.max(1, frame.width || 24), height: Math.max(1, frame.height || 24) };
  const localOffset = isRoot ? offset : { x: offset.x + (Number(frame.x) || 0), y: offset.y + (Number(frame.y) || 0) };
  if (layer?._class === "shapePath" && Array.isArray(layer.points) && layer.points.length > 1) {
    const points = layer.points.map((item) => ({
      point: sketchPoint(item.point, frame, root, localOffset),
      // Sketch 的 curveFrom / curveTo 是以当前锚点为参照记录的：
      // 前者是从当前点离开的手柄，后者是抵达当前点的手柄。
      // 按 SVG Bézier 的方向映射，避免曲线反向折叠成错误图形。
      incoming: sketchPoint(item.curveTo || item.point, frame, root, localOffset),
      outgoing: sketchPoint(item.curveFrom || item.point, frame, root, localOffset)
    })).filter((item) => item.point);
    if (points.length > 1) {
      let path = `M${pointCommand(points[0].point)}`;
      const segment = (from, to) => {
        if (!samePoint(from.outgoing, from.point) || !samePoint(to.incoming, to.point)) {
          return ` C${pointCommand(from.outgoing)} ${pointCommand(to.incoming)} ${pointCommand(to.point)}`;
        }
        return ` L${pointCommand(to.point)}`;
      };
      for (let index = 1; index < points.length; index += 1) path += segment(points[index - 1], points[index]);
      if (layer.isClosed !== false) path += `${segment(points[points.length - 1], points[0])} Z`;
      paths.push(path);
    }
  }
  for (const child of layer?.layers || []) iconPaths(child, paths, root, localOffset, false);
  return paths;
}

function escapeSvgText(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

// 在生产环境没有 Sketch.app / sketchtool 时，仍根据 Sketch 的真实图层
// （位置、尺寸、填充色、边框、文字）生成 SVG 预览。它不是规则占位图，
// 而是该组件画板的轻量矢量缩略图；Sketchtool 可用时仍优先使用其原始导出。
function sketchThumbnailSvg(rootLayer) {
  const rootFrame = rootLayer?.frame || {};
  const width = Math.max(1, Math.round(Number(rootFrame.width) || 320));
  const height = Math.max(1, Math.round(Number(rootFrame.height) || 180));
  const parts = [];
  let count = 0;
  const draw = (layer, isRoot = false, parentX = 0, parentY = 0) => {
    if (!layer || layer.isVisible === false || Number(layer?.style?.contextSettings?.opacity) === 0 || count >= 720) return;
    const frame = layer.frame || {};
    const x = isRoot ? 0 : parentX + Math.round(Number(frame.x) || 0);
    const y = isRoot ? 0 : parentY + Math.round(Number(frame.y) || 0);
    const w = Math.max(0, Number(frame.width) || 0);
    const h = Math.max(0, Number(frame.height) || 0);
    const opacity = Math.max(0, Math.min(1, Number(layer?.style?.contextSettings?.opacity ?? 1)));
    const fill = firstFill(layer);
    const border = layer?.style?.borders?.find((entry) => entry.isEnabled !== false && entry.color)?.color;
    const strokeWidth = Number(layer?.style?.borders?.find((entry) => entry.isEnabled !== false)?.thickness) || 1;
    const style = ` fill="${fill ? rgba(fill) : "none"}"${border ? ` stroke="${rgba(border)}" stroke-width="${strokeWidth}"` : ""}${opacity < 1 ? ` opacity="${opacity.toFixed(3)}"` : ""}`;
    const isDrawable = w > 0 && h > 0 && ["artboard", "rectangle", "oval", "shapeGroup", "shapePath", "bitmap", "star", "triangle", "polygon"].includes(layer._class);
    if (isDrawable && (fill || border || layer._class === "bitmap")) {
      count += 1;
      const radius = Math.max(0, Number(layer.fixedRadius) || 0);
      if (layer._class === "oval") parts.push(`<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"${style}/> `);
      else parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}"${style || " fill=\"#e2e8f0\""}/> `);
    }
    if (layer._class === "text" && w > 0 && h > 0) {
      const attrs = layer?.style?.textStyle?.encodedAttributes || {};
      const font = attrs.MSAttributedStringFontAttribute?.attributes || {};
      const color = attrs.MSAttributedStringColorAttribute || firstFill(layer) || { red: .2, green: .24, blue: .32, alpha: 1 };
      const text = String(layer?.attributedString?.string || layer.name || "").replace(/\s+/g, " ").trim();
      if (text) {
        count += 1;
        parts.push(`<text x="${x}" y="${y + Math.min(h - 1, Math.max(9, (Number(font.size) || 14)))}" fill="${rgba(color)}" font-family="${escapeSvgText(fontFamily(font.name || "System"))}" font-size="${Math.max(7, Number(font.size) || 14)}" font-weight="${fontWeight(font.name || "")}">${escapeSvgText(text.slice(0, 90))}</text>`);
      }
    }
    for (const child of layer.layers || []) draw(child, false, x, y);
  };
  draw(rootLayer, true);
  const background = deepFill(rootLayer) ? "" : `<rect width="${width}" height="${height}" fill="#FFFFFF"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${background}${parts.join("")}</svg>`;
}

function iconPriority(name = "") {
  let score = 0;
  if (/Base基础\/1\.icon图标/i.test(name)) score += 120;
  if (/(^|\/)1\.icon图标\/(0\.\s*导航|1\.\s*action|2\.normal|3\.tips|5\.navigation)(\/|$)/i.test(name)) score += 90;
  if (/anticon|iconfont/i.test(name)) score += 140;
  if (/(^|[./\s_-])icon([/\s_-]|$)/i.test(name)) score += 130;
  if (/(^|\/)icon图标(\/|$)/i.test(name)) score += 70;
  if (/(^|\/)(icon|ico)(\/|$)/i.test(name)) score += 50;
  if (/\/(0\.\s*导航|1\.\s*action|2\.normal|3\.tips|5\.navigation)\//i.test(name)) score += 45;
  if (/\/(11\.editor|12\.文件类型|0\.应用|9\.application|13\.角色头像|13\.勋章)\//i.test(name)) score -= 240;
  if (/图标按钮|图标\+文字|带icon/i.test(name)) score -= 45;
  if (/editor|UML|图形|文件类型|应用|application|勋章|Clipped|测试管理|管理后台|Access|Testhub|角色头像|avatar|备份|mask|蒙版|bg|background/i.test(name)) score -= 120;
  if (/default|hover|禁用|选中/i.test(name)) score -= 15;
  return score;
}

function isUsableIconCandidate(item) {
  const fullName = String(item.name || "");
  const segments = fullName.split("/").map(cleanSegment).filter(Boolean);
  const shortName = cleanSegment(segments.at(-1) || fullName);
  if (!shortName || /^\d+$/.test(shortName)) return false;
  if (isInternalSketchLayerName(shortName)) return false;
  if (!item.paths?.length) return false;
  if (item.priority < 120) return false;
  // 一些 Sketch 文件（例如 AntDesign Pro 的页面稿）没有单独的
  // 「icon图标」Symbol 库，图标是带名称的矢量 group。它们通过 source
  // 明确标记后也可以安全保留；其他普通 group 仍维持严格路径过滤。
  const namedVectorFallback = item.source === "named-vector";
  if (!namedVectorFallback && !/(^|\/)(?:1\.)?icon图标\/(?:0\.\s*导航|1\.\s*action|2\.normal|3\.tips|5\.navigation|导航|action|normal|tips|navigation)(\/|$)/i.test(fullName)
    && !/Base基础\/(?:1\.)?icon图标\/(?:0\.\s*导航|1\.\s*action|2\.normal|3\.tips|5\.navigation|导航|action|normal|tips|navigation)(\/|$)/i.test(fullName)) return false;
  if (/(11\.editor|12\.文件类型|0\.应用|9\.application|13\.角色头像|13\.勋章|editor|UML|图形|文件类型|应用|application|勋章|Clipped|测试管理|管理后台|Access|Testhub|角色头像|avatar|备份|mask|蒙版|bg|background)/i.test(fullName)) return false;
  if (/^(zip|rar|txt|ppt|php|doc|pdf|mp3|mp4|html|css|js|java|ipa|apk|exe|csv|xls|xsd|vss|swf|ttf|bak|bat|code|key|fla|文件|图片|文档|链接)$/i.test(shortName)) return false;
  const width = Number(item.width) || 0;
  const height = Number(item.height) || 0;
  if (width > 64 || height > 64) return false;
  return true;
}

function sanitizeLibraryForClient(library) {
  if (!library || library.sourceType !== "sketch" || !library.assets) return library;
  const assets = { ...library.assets };
  const attachPreviewUrl = (item) => {
    if (!item || !item.id) return item;
    const fileName = `${item.id}.svg`;
    if (item.previewUrl) {
      return {
        ...item,
        previewUrl: `/api/framo/assets/${library.id}/${fileName}`,
        previewEngine: item.previewEngine || "prebuilt-svg"
      };
    }
    if (existsSync(join(ASSET_ROOT, library.id, fileName))) {
      return {
        ...item,
        previewUrl: `/api/framo/assets/${library.id}/${fileName}`,
        previewEngine: item.previewEngine || "prebuilt-svg"
      };
    }
    return item;
  };
  const seenIcons = new Set();
  assets.icons = (assets.icons || [])
    .map(attachPreviewUrl)
    .map((item) => ({ ...item, priority: item.priority ?? iconPriority(item.name) }))
    .filter(isUsableIconCandidate)
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => {
      const shortName = String(item.name || "").split("/").pop().trim().toLowerCase();
      if (!shortName || seenIcons.has(shortName)) return false;
      seenIcons.add(shortName);
      return true;
    })
    .slice(0, 240);

  assets.components = (assets.components || [])
    .map(attachPreviewUrl)
    .filter((component) => {
      const fullName = String(component.fullName || component.name || "");
      const segments = fullName.split("/").map(cleanSegment).filter(Boolean);
      if (/Base基础\/1\.icon图标/i.test(fullName)) return false;
      if (/^icon图标$/i.test(segments[0] || "")) return false;
      if (/^normal$/i.test(segments[1] || "") && segments.length <= 2) return false;
      return true;
    });

  return {
    ...library,
    assets,
    components: assets.components.map((item) => item.fullName || item.name).filter(Boolean),
    stats: {
      ...(library.stats || {}),
      icons: assets.icons.length,
      components: assets.components.length
    }
  };
}

function fontWeight(name = "") {
  if (/black|heavy/i.test(name)) return 900;
  if (/extra.?bold|ultra.?bold/i.test(name)) return 800;
  if (/bold/i.test(name)) return 700;
  if (/semi.?bold|demi.?bold/i.test(name)) return 600;
  if (/medium/i.test(name)) return 500;
  if (/light/i.test(name)) return 300;
  if (/thin/i.test(name)) return 200;
  return 400;
}

function fontFamily(name = "System") {
  const family = name.replace(/[- ](Regular|Medium|Semibold|SemiBold|Bold|Light|Thin|Heavy|Black)$/i, "");
  if (/^PingFang[- ]?SC$/i.test(family)) return "PingFang SC";
  if (/^SFProText$/i.test(family)) return "SF Pro Text";
  if (/^SanFranciscoDisplay$/i.test(family)) return "San Francisco Display";
  return family;
}

function cleanSegment(value = "") {
  return value.replace(/^\s*\d+[.、]\s*/, "").replace(/\s+/g, " ").trim();
}

function isInternalSketchLayerName(value = "") {
  return /^(group|编组|shape|path|fill\s*\d*|stroke\s*\d*|rectangle|rect|oval|layer|line|shape path|shape group|规范|网格|grid|形状结合|合并形状|路径(?:\s*\d*)?|矩形(?:备份)?(?:\s*\d*)?|椭圆形|圆形|多边形|直线(?:\s*\d*)?|蒙版|mask|clipped)$/i.test(cleanSegment(value));
}

function isNamedVectorIconName(value = "") {
  const name = cleanSegment(value);
  if (!name || isInternalSketchLayerName(name)) return false;
  // Sketch 自动生成的 Group 12、Combined Shape、Copy 等不是用户命名的图标。
  if (/^(?:group|combined shape|shape|layer)(?:[\s_-]*(?:copy|\d+|备份))*$/i.test(name)) return false;
  if (/^(?:形状|组合形状|路径|矩形|圆形|椭圆|多边形)(?:备份)?$/i.test(name)) return false;
  if (/^(?:copy|备份|默认|default|normal|hover|active|disabled|状态|背景|前景|内容)$/i.test(name)) return false;
  if (/^\d+(?:\.\d+)?$/.test(name)) return false;
  // 英文 icon 名、中文语义名均可；过短的无意义字符不作为资产。
  return /^[a-z][a-z0-9_-]{2,}$/i.test(name) || /^[\u4e00-\u9fff][\u4e00-\u9fff\w-]{1,}$/u.test(name);
}

function normalizeIconCandidateName(fullPath = "", fallbackName = "") {
  const segments = String(fullPath || fallbackName || "").split("/").map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const iconIndex = segments.findIndex((segment) => /icon图标$/i.test(segment) || /^icon$/i.test(segment));
  if (iconIndex >= 0 && segments.length > iconIndex + 2) {
    const prefix = segments.slice(Math.max(0, iconIndex - 1), iconIndex + 2);
    const tail = segments.slice(iconIndex + 2).filter((segment) => {
      const clean = cleanSegment(segment);
      return clean && !/^\d+$/.test(clean) && !isInternalSketchLayerName(clean);
    });
    const iconName = cleanSegment(tail.at(-1) || fallbackName);
    return [...prefix, iconName].filter(Boolean).join("/");
  }
  return fallbackName || fullPath;
}

function componentScore(item) {
  let score = 0;
  if (/(^|\/)default$/i.test(item.name)) score += 30;
  if (/(^|\/)(md|medium|中)$/i.test(item.name)) score += 15;
  if (/禁用|disabled|hover|pressed|备份/i.test(item.name)) score -= 30;
  score -= item.name.split("/").length;
  return score;
}

async function exportSketchPreviews(sketchPath, libraryId, assets) {
  const target = join(ASSET_ROOT, libraryId);
  const items = [...assets.icons, ...assets.components];
  const writeJsonSvgPreviews = async () => {
    await mkdir(target, { recursive: true });
    let exported = 0;
    for (const item of items) {
      if (!item?.id || !item.previewSvg) continue;
      const fileName = `${item.id}.svg`;
      if (!existsSync(join(target, fileName))) await writeFile(join(target, fileName), item.previewSvg, "utf8");
      if (existsSync(join(target, fileName))) {
        item.previewUrl = `/api/framo/assets/${libraryId}/${fileName}`;
        item.previewEngine = "sketch-json-svg";
        exported += 1;
      }
    }
    return exported;
  };
  const stripPreviewMarkup = () => {
    for (const item of items) delete item.previewSvg;
  };
  const attachExistingPreviews = () => {
    let exported = 0;
    for (const item of [...assets.icons, ...assets.components]) {
      const fileName = `${item.id}.svg`;
      if (existsSync(join(target, fileName))) {
        item.previewUrl = `/api/framo/assets/${libraryId}/${fileName}`;
        item.previewEngine = "prebuilt-svg";
        exported += 1;
      }
    }
    return exported;
  };
  if (!existsSync(SKETCHTOOL)) {
    const existing = attachExistingPreviews();
    const generated = await writeJsonSvgPreviews();
    stripPreviewMarkup();
    return generated > 0 ? { engine: "sketch-json-svg", exported: generated } : (existing > 0 ? { engine: "prebuilt-svg", exported: existing } : { engine: "json-fallback", exported: 0 });
  }
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const warnings = [];
  const runExport = (batch) => execFileAsync(SKETCHTOOL, [
    "export", "layers", sketchPath,
    `--output=${target}`,
    `--items=${batch.join(",")}`,
    "--formats=svg", "--use-id-for-name=YES", "--trimmed=YES", "--overwriting=YES"
  ], { maxBuffer: 16 * 1024 * 1024, timeout: 120000 });
  const exportBatch = async (batch, kind) => {
    try {
      await runExport(batch);
    } catch (error) {
      if (kind === "组件" && batch.length > 1) {
        for (let index = 0; index < batch.length; index += 4) {
          await Promise.all(batch.slice(index, index + 4).map(async (id) => {
            try {
              await runExport([id]);
            } catch {
              warnings.push(`组件图层 ${id} 无法导出`);
            }
          }));
        }
      } else {
        warnings.push(`${kind}预览批次导出失败（${batch.length} 项）`);
      }
    }
  };
  const iconIds = [...new Set(assets.icons.map((item) => item.id).filter(Boolean))];
  const componentIds = [...new Set(assets.components.map((item) => item.id).filter(Boolean))];
  for (let index = 0; index < iconIds.length; index += 100) {
    await exportBatch(iconIds.slice(index, index + 100), "图标");
  }
  for (let index = 0; index < componentIds.length; index += 20) {
    await exportBatch(componentIds.slice(index, index + 20), "组件");
  }
  let exported = 0;
  for (const item of items) {
    const fileName = `${item.id}.svg`;
    if (existsSync(join(target, fileName))) {
      item.previewUrl = `/api/framo/assets/${libraryId}/${fileName}`;
      item.previewEngine = "sketchtool";
      exported += 1;
    }
  }
  // 不可被 sketchtool 导出的 foreign Symbol / 非 Symbol 画板，仍以其真实
  // JSON 图层生成预览，避免客户端落回占位缩略图。
  const generated = await writeJsonSvgPreviews();
  stripPreviewMarkup();
  return { engine: exported ? "sketchtool" : "sketch-json-svg", exported: Math.max(exported, generated), requested: iconIds.length + componentIds.length, warnings };
}

function parseSketchDocument(document, pages) {
  const colors = new Map();
  const fonts = new Map();
  const iconCandidates = [];
  const namedVectorIconCandidates = [];
  const components = [];
  const artboards = [];
  const semanticComponents = new Map();
  const textStyles = [];
  const layerStyles = [];

  const registerReusableAsset = (layer, trail = []) => {
    if (!layer) return;
    const fullPath = [...trail, layer.name].filter(Boolean).join("/");
    const layerName = cleanSegment(layer.name || "");
    if (layer._class === "symbolMaster") {
      components.push({
        id: layer.do_objectID,
        symbolId: layer.symbolID,
        name: layer.name || "Unnamed component",
        width: Math.round(layer.frame?.width || 0),
        height: Math.round(layer.frame?.height || 0),
        category: (layer.name || "Component").split(/[\/_-]/)[0],
        preview: { color: rgba(deepFill(layer) || { red: .94, green: .94, blue: .94, alpha: 1 }), radius: layer?.style?.contextSettings?.opacity === 0 ? 0 : 10 },
        previewSvg: sketchThumbnailSvg(layer)
      });
    }
    if (layer._class === "artboard" && layer.do_objectID) {
      artboards.push({
        id: layer.do_objectID,
        name: layer.name || "Untitled screen",
        width: Math.round(layer.frame?.width || 0),
        height: Math.round(layer.frame?.height || 0),
        preview: { color: rgba(deepFill(layer) || { red: .96, green: .97, blue: .99, alpha: 1 }), radius: 10 },
        previewSvg: sketchThumbnailSvg(layer)
      });
    }

    // 设计稿中的表格工具栏通常只是命名 group，而不是 symbolMaster。
    // 将反复出现、且名称明确的筛选/排序/工具栏提升为可复用组件，避免
    // Table 组件只有一个空缩略图而丢失其关键交互结构。
    const tableContext = /表格|table/i.test(fullPath);
    const semanticKind = /带筛选排序/.test(layerName) ? "工具栏" : (/^筛选(?:备份)?$/i.test(layerName) ? "筛选" : (/^排序(?:备份)?$/i.test(layerName) ? "排序" : ""));
    if (tableContext && semanticKind && ["group", "shapeGroup"].includes(layer._class) && (layer.layers || []).length >= 2) {
      const key = `数据展示 Data Display/Table ${semanticKind}`;
      if (!semanticComponents.has(key)) {
        semanticComponents.set(key, {
          id: layer.do_objectID || `semantic-table-${semanticKind}`,
          symbolId: null,
          // 与 symbolMaster 一致使用「分类/名称」格式，后续分组逻辑才能
          // 作为独立组件保留下来，而不是被 segments.length 过滤掉。
          name: `数据展示 Data Display/Table ${semanticKind}`,
          width: Math.round(layer.frame?.width || 0),
          height: Math.round(layer.frame?.height || 0),
          category: "数据展示 Data Display",
          preview: { color: rgba(deepFill(layer) || { red: .4, green: .6, blue: .95, alpha: 1 }), radius: 6 }
        });
      }
    }

    const inIconLibrary = /(^|\/)(1\.)?Base基础\/1\.icon图标\//i.test(fullPath)
      || /(^|\/)1\.icon图标\//i.test(fullPath);
    const namedIconLayer = !isInternalSketchLayerName(layerName);
    const iconLike = (inIconLibrary || /icon|ico|图标/i.test(layer.name || ""))
      && namedIconLayer
      && ["shapeGroup", "group", "symbolMaster", "symbolInstance"].includes(layer._class);
    if (iconLike && iconCandidates.length < 10000) {
      const rawCandidateName = inIconLibrary ? fullPath.replace(/^.*?(?=1\.Base基础\/1\.icon图标\/|Base基础\/1\.icon图标\/|1\.icon图标\/)/i, "") : (layer.name || fullPath);
      const candidateName = inIconLibrary ? normalizeIconCandidateName(rawCandidateName, layer.name) : rawCandidateName;
      const sourceBoost = inIconLibrary && !/数据输入|反馈|表格|弹窗|按钮|导航菜单|搜索|筛选|配置|渠道|工单|排期|设置|详情|列表|表单/i.test(fullPath) ? 400 : 0;
      iconCandidates.push({
        id: layer.do_objectID,
        name: candidateName,
        width: Math.round(layer.frame?.width || 24),
        height: Math.round(layer.frame?.height || 24),
        color: rgba(deepFill(layer) || { red: .2, green: .2, blue: .2, alpha: 1 }),
        paths: iconPaths(layer),
        priority: iconPriority(candidateName) + sourceBoost
      });
    }

    // 不含 icon Symbol 的页面型 Sketch（AntDesign Pro 等）会把图标嵌在
    // 画板内。只收集尺寸小、名称具有明确语义、且确实包含矢量路径的图层，
    // 作为最后兜底，避免将卡片、文件类型或装饰形状误识别成图标。
    const vectorFallback = !inIconLibrary
      && ["group", "shapeGroup"].includes(layer._class)
      && isNamedVectorIconName(layerName)
      && (Number(layer.frame?.width) || 0) >= 8
      && (Number(layer.frame?.height) || 0) >= 8
      && (Number(layer.frame?.width) || 0) <= 64
      && (Number(layer.frame?.height) || 0) <= 64;
    if (vectorFallback && namedVectorIconCandidates.length < 5000) {
      const paths = iconPaths(layer);
      if (paths.length) namedVectorIconCandidates.push({
        id: layer.do_objectID,
        name: layerName,
        width: Math.round(layer.frame?.width || 24),
        height: Math.round(layer.frame?.height || 24),
        color: rgba(deepFill(layer) || { red: .2, green: .2, blue: .2, alpha: 1 }),
        paths,
        priority: 130,
        source: "named-vector"
      });
    }
  };

  const registerColor = (color, usage) => {
    if (!color) return;
    const value = rgba(color);
    const red = Math.max(0, Math.min(1, Number(color.red) || 0));
    const green = Math.max(0, Math.min(1, Number(color.green) || 0));
    const blue = Math.max(0, Math.min(1, Number(color.blue) || 0));
    if (!colors.has(value)) colors.set(value, { value, usages: [], count: 0, chroma: Math.max(red, green, blue) - Math.min(red, green, blue), luminance: red * .2126 + green * .7152 + blue * .0722 });
    const item = colors.get(value);
    item.count += 1;
    if (usage && item.usages.length < 3 && !item.usages.includes(usage)) item.usages.push(usage);
  };

  for (const page of pages) {
    walkLayers(page.layers, (layer, trail) => {
      const usage = [...trail, layer.name].filter(Boolean).join(" / ");
      for (const fill of layer?.style?.fills || []) registerColor(fill.color, usage);
      for (const border of layer?.style?.borders || []) registerColor(border.color, usage);
      const text = layer?.style?.textStyle?.encodedAttributes;
      if (text?.MSAttributedStringFontAttribute?.attributes) {
        const font = text.MSAttributedStringFontAttribute.attributes;
        const family = fontFamily(font.name || "Unknown");
        const size = Number(font.size) || 14;
        const weight = fontWeight(font.name);
        const key = `${family}-${weight}-${size.toFixed(2)}`;
        if (!fonts.has(key)) fonts.set(key, { family, size, weight, count: 0, sample: layer.attributedString?.string || layer.name || "Aa 字体预览" });
        fonts.get(key).count += 1;
      }
      registerColor(text?.MSAttributedStringColorAttribute, usage);

      registerReusableAsset(layer, trail);
    });
  }

  // 旧版 Sketch 会把可复用 Symbol 放在 document.foreignSymbols 中，
  // 页面 JSON 里只有实例；同时兼容直接存放在 layerSymbols.objects 的文档。
  const documentSymbols = [
    ...(document.foreignSymbols || []).map((item) => item?.symbolMaster).filter(Boolean),
    ...(document.layerSymbols?.objects || []).map((item) => item?.symbolMaster || item).filter(Boolean)
  ];
  for (const symbol of documentSymbols) {
    registerReusableAsset(symbol, ["Symbol"]);
    walkLayers(symbol.layers, registerReusableAsset, [symbol.name || "Symbol"]);
  }

  const sharedText = document.layerTextStyles?.objects || [];
  for (const item of sharedText) {
    const attrs = item.value?.textStyle?.encodedAttributes || {};
    const font = attrs.MSAttributedStringFontAttribute?.attributes || {};
    textStyles.push({ name: item.name || "Text style", family: font.name || "System", size: font.size || 14, color: rgba(attrs.MSAttributedStringColorAttribute || {}) });
  }
  for (const item of document.layerStyles?.objects || []) {
    const fill = item.value?.fills?.find((entry) => entry.isEnabled !== false)?.color;
    const radius = item.value?.borderOptions?.dashPattern?.[0] || 0;
    layerStyles.push({ name: item.name || "Layer style", color: rgba(fill || {}), radius });
  }

  const palette = [...colors.values()].sort((a, b) => b.count - a.count);
  const primary = [...palette].filter((item) => item.luminance > .12 && item.luminance < .88).sort((a, b) => (b.chroma * Math.log2(b.count + 1)) - (a.chroma * Math.log2(a.count + 1)))[0]?.value || "#5B5BD6";
  const surface = palette.filter((item) => item.luminance > .92).sort((a, b) => b.count - a.count)[0]?.value || "#FFFFFF";
  const iconNames = new Set();
  const approvedIconCandidates = iconCandidates.filter(isUsableIconCandidate);
  // 仅当文件没有规范 icon Symbol 库时才启用兜底，防止影响已有的 Tethys
  // 等标准设计系统解析结果。
  const iconInput = approvedIconCandidates.length ? approvedIconCandidates : namedVectorIconCandidates.filter(isUsableIconCandidate);
  const icons = iconInput.sort((a, b) => b.priority - a.priority).filter((item) => {
    const shortName = item.name.split("/").pop().trim().toLowerCase();
    if (!shortName || /^\d+$/.test(shortName)) return false;
    if (iconNames.has(shortName)) return false;
    iconNames.add(shortName);
    return true;
  }).slice(0, 240);

  // 有些产品原型不使用 Symbol，而是以画板直接承载真实页面组件。保留画板
  // 作为「页面模板」组件，保证查询表格、表单、Dashboard 等内容不会被丢弃。
  if (components.length < 4) {
    for (const artboard of artboards) {
      const segments = String(artboard.name).split("/").map(cleanSegment).filter(Boolean);
      const title = segments.at(-1) || artboard.name;
      const category = `页面模板 ${segments.at(-2) || segments.at(0) || "Screen"}`;
      components.push({
        ...artboard,
        name: `${category}/${title}`,
        category,
        source: "artboard"
      });
    }
  }

  const componentGroups = new Map();
  for (const component of semanticComponents.values()) components.push(component);
  for (const component of components) {
    if (/Base基础\/1\.icon图标/i.test(component.name)) continue;
    if (/^icon图标\//i.test(component.name)) continue;
    const segments = component.name.split("/").map(cleanSegment).filter(Boolean);
    if (segments.length < 2) continue;
    const category = segments[0];
    const name = segments[1];
    if (/^icon图标$/i.test(category)) continue;
    if (/^normal$/i.test(name) && segments.length <= 2) continue;
    const key = `${category}/${name}`.toLowerCase();
    if (!componentGroups.has(key)) componentGroups.set(key, { name, category, variants: [], representative: component });
    const group = componentGroups.get(key);
    group.variants.push(component.name);
    if (componentScore(component) > componentScore(group.representative)) group.representative = component;
  }
  const usableComponents = [...componentGroups.values()].map((group) => ({
    id: group.representative.id,
    symbolId: group.representative.symbolId,
    name: group.name,
    fullName: `${group.category}/${group.name}`,
    category: group.category,
    variantCount: group.variants.length,
    width: group.representative.width,
    height: group.representative.height,
    preview: group.representative.preview
    , previewSvg: group.representative.previewSvg
  })).sort((a, b) => a.category.localeCompare(b.category, "zh-CN") || a.name.localeCompare(b.name, "zh-CN"));

  const fontFamilies = new Map();
  const fontSizes = new Map();
  for (const item of fonts.values()) {
    if (!fontFamilies.has(item.family)) fontFamilies.set(item.family, { family: item.family, weights: new Set(), sizes: new Set(), count: 0, sample: item.sample });
    const family = fontFamilies.get(item.family);
    family.weights.add(item.weight);
    if (item.size >= 8 && item.size <= 96) family.sizes.add(Number(item.size.toFixed(2)));
    family.count += item.count;
    if (Math.abs(item.size - Math.round(item.size)) < .02 && item.size >= 8 && item.size <= 96) {
      const size = Math.round(item.size);
      if (!fontSizes.has(size)) fontSizes.set(size, { size, count: 0, samples: [] });
      const scale = fontSizes.get(size);
      scale.count += item.count;
      if (scale.samples.length < 3 && item.sample) scale.samples.push(String(item.sample).slice(0, 30));
    }
  }
  const usableFonts = [...fontFamilies.values()].filter((item) => item.count >= 2 && !/emoji/i.test(item.family)).map((item) => ({ ...item, weights: [...item.weights].sort(), sizes: [...item.sizes].sort((a, b) => a - b) })).sort((a, b) => b.count - a.count);
  const typeScale = [...fontSizes.values()].filter((item) => item.count >= 2).sort((a, b) => a.size - b.size);
  const radii = [];
  for (const page of pages) walkLayers(page.layers, (layer) => { for (const point of layer.fixedRadius ? [layer.fixedRadius] : layer.points?.map((p) => p.cornerRadius) || []) if (Number(point) > 0) radii.push(Number(point)); });

  return {
    tokens: { colorPrimary: primary, colorSurface: surface, borderRadius: `${Math.round(radii.sort((a, b) => a - b)[Math.floor(radii.length / 2)] || 12)}px`, fontSizeBase: Math.round([...fonts.values()][0]?.size || 14), spacingBase: 8 },
    assets: { colors: palette.slice(0, 80), fonts: usableFonts, fontSizes: typeScale, icons, components: usableComponents, textStyles, layerStyles },
    components: usableComponents.map((item) => item.fullName),
    stats: { pages: pages.length, layers: pages.reduce((count, page) => { walkLayers(page.layers, () => { count += 1; }); return count; }, 0), colors: palette.length, fonts: usableFonts.length, fontSizes: typeScale.length, icons: icons.length, components: usableComponents.length, componentVariants: components.length }
  };
}

function parseMultipart(buffer, contentTypeHeader) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentTypeHeader || "");
  if (!match) throw new Error("缺少 multipart boundary");
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const headerEndMarker = Buffer.from("\r\n\r\n");
  let cursor = buffer.indexOf(boundary);
  while (cursor >= 0) {
    const headerStart = cursor + boundary.length + 2;
    const headerEnd = buffer.indexOf(headerEndMarker, headerStart);
    if (headerEnd < 0) break;
    const headers = buffer.subarray(headerStart, headerEnd).toString("utf8");
    const nextBoundary = buffer.indexOf(boundary, headerEnd + 4);
    if (nextBoundary < 0) break;
    if (/name="file"/i.test(headers)) {
      const name = /filename="([^"]*)"/i.exec(headers)?.[1] || "upload.sketch";
      return { name, data: buffer.subarray(headerEnd + 4, nextBoundary - 2) };
    }
    cursor = nextBoundary;
  }
  throw new Error("没有找到上传文件");
}

async function readRawBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD_BYTES) throw new Error(`文件超过 ${MAX_UPLOAD_MB}MB 限制`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function parseSketchUpload(file) {
  if (!file.name.toLowerCase().endsWith(".sketch")) throw new Error("仅支持 .sketch 文件");
  if (file.data[0] !== 0x50 || file.data[1] !== 0x4b) throw new Error("文件不是有效的 Sketch ZIP 文档");
  const dir = await mkdtemp(join(tmpdir(), "framo-sketch-"));
  const path = join(dir, "upload.sketch");
  try {
    await writeFile(path, file.data);
    const { entries, readEntry } = readSketchJsonEntries(file.data);
    if (!entries.includes("document.json")) throw new Error("Sketch 文档缺少 document.json");
    const pageEntries = entries.filter((entry) => /^pages\/[^/]+\.json$/i.test(entry));
    const document = readEntry("document.json");
    const pages = pageEntries.map(readEntry);
    const parsed = parseSketchDocument(document, pages);
    const libraryId = `lib-sketch-${createHash("sha1").update(file.data).digest("hex").slice(0, 12)}`;
    let previewResult = { engine: "json-fallback", exported: 0 };
    try {
      previewResult = await exportSketchPreviews(path, libraryId, parsed.assets);
    } catch (error) {
      previewResult = { engine: "json-fallback", exported: 0, warning: error instanceof Error ? error.message : "Sketch 预览导出失败" };
    }
    if (previewResult.engine === "sketchtool") {
      // sketchtool 无法导出部分旧版 foreignSymbols；保留已从 JSON
      // 可靠识别出的资产，缺少 SVG 时由前端使用矢量路径或样式预览降级展示。
      parsed.components = parsed.assets.components.map((item) => item.fullName);
      parsed.stats.icons = parsed.assets.icons.length;
      parsed.stats.components = parsed.assets.components.length;
    }
    const library = {
      id: libraryId,
      name: file.name.replace(/\.sketch$/i, "").trim(),
      version: "1.0.0",
      sourceType: "sketch",
      importedAt: new Date().toISOString(),
      previewResult,
      ...parsed
    };
    for (let index = libraries.length - 1; index >= 0; index -= 1) {
      if (libraries[index].sourceType === "sketch" && libraries[index].name === library.name) libraries.splice(index, 1);
    }
    libraries.unshift(library);
    await persistSketchLibraries();
    return library;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const metrics = [
  { label: "项目数", value: "03", note: "绑定组件库的活跃项目" },
  { label: "组件库", value: "02", note: "支持 AI / 手动 / 上传来源" },
  { label: "原型版本", value: "11", note: "支持 iframe 统一预览" },
  { label: "Prompt 模板", value: "03", note: "解析 / 生成 / HTML 转换" }
];

const prototypes = [
  {
    id: "proto-demo-1",
    name: "运营控制台 HTML Demo",
    url: "/prototype/demo/index.html",
    type: "html",
    version: "v0.1.0"
  }
];

function normalizeTokens(raw = {}) {
  return {
    colorPrimary: raw.colorPrimary || "#1677FF",
    colorSurface: raw.colorSurface || "#FFFFFF",
    borderRadius: raw.borderRadius || "16px",
    fontSizeBase: raw.fontSizeBase || 14,
    spacingBase: raw.spacingBase || 8
  };
}

function buildLayout(prompt, library) {
  const tokens = normalizeTokens(library?.tokens);
  const compactPrompt = String(prompt || "").trim();
  const available = library?.components || [];
  const pick = (pattern, fallback) => available.find((name) => pattern.test(name)) || (library?.sourceType === "sketch" ? null : fallback);
  const references = [
    { role: "page-container", component: pick(/page|layout|container|页面|容器/i, "container"), reason: "作为页面结构容器" },
    { role: "summary", component: pick(/card|stat|metric|统计|卡片/i, "stat"), reason: "承载关键指标" },
    { role: "content", component: pick(/table|list|列表|表格/i, "table"), reason: "展示主要业务数据" },
    { role: "action", component: pick(/button|action|按钮/i, "button"), reason: "提供主操作入口" }
  ].filter((item) => item.component);

  return {
    type: "page",
    libraryId: library?.id || libraries[0].id,
    tokens,
    prompt: compactPrompt,
    componentReferences: references,
    layout: [
      {
        type: "container",
        props: {
          title: compactPrompt.includes("分析") ? "数据分析总览" : "运营总览"
        },
        children: [
          {
            type: "stats",
            items: [
              { label: "待审核任务", value: compactPrompt ? "28" : "18", delta: "+12%" },
              { label: "在线原型", value: "16", delta: "+4%" },
              { label: "规范命中率", value: "93%", delta: "+7%" }
            ]
          },
          {
            type: "panel",
            title: compactPrompt || "智能任务列表",
            action: "新建页面",
            table: {
              columns: ["页面", "负责人", "状态", "更新时间"],
              rows: [
                ["控制台首页", "Ava", "已生成", "2 分钟前"],
                ["用户分析页", "Noah", "待确认", "12 分钟前"],
                ["策略配置页", "Mia", "设计中", "28 分钟前"]
              ]
            }
          }
        ]
      }
    ]
  };
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "application/javascript; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".png") return "image/png";
  if (extension === ".zip") return "application/zip";
  if (extension === ".svg") return "image/svg+xml; charset=utf-8";
  if (extension === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

async function serveFile(res, filePath) {
  try {
    const buffer = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(buffer);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    json(res, 400, { error: "Invalid request" });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, { ok: true, service: "framo", port: PORT });
    return;
  }

  if (["GET", "HEAD"].includes(req.method) && url.pathname === "/downloads/Flowa-Axure-Plugin-1.0.0.zip") {
    try {
      const buffer = await readFile(PLUGIN_FILE);
      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Length": buffer.length,
        "Content-Disposition": 'attachment; filename="Flowa-Axure-Plugin-1.0.0.zip"'
      });
      res.end(req.method === "HEAD" ? undefined : buffer);
    } catch {
      json(res, 404, { error: "插件安装包不存在" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/metrics") {
    json(res, 200, metrics.map((metric) => {
      if (metric.label === "项目数") return { ...metric, value: String(projects.length).padStart(2, "0") };
      if (metric.label === "组件库") return { ...metric, value: String(libraries.length).padStart(2, "0") };
      return metric;
    }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    json(res, 200, projects.map((project) => ({ ...project, tags: productLines.filter((tag) => project.tagIds?.includes(tag.id)) })));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/projects") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    if (!name) return json(res, 400, { error: "项目名称不能为空" });
    const project = {
      id: `proj-${Date.now().toString(36)}`,
      name,
      description: String(body.description || "等待上传原型或通过 AI 创建页面。"),
      status: "Planning",
      pages: 0,
      color: body.color || "#5B5EF4",
      tagIds: body.tagId ? [body.tagId] : [],
      updatedAt: new Date().toISOString()
    };
    projects.unshift(project);
    await persistPlatform();
    json(res, 201, { ...project, tags: productLines.filter((tag) => project.tagIds.includes(tag.id)) });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/projects/")) {
    const id = url.pathname.split("/").pop();
    const index = projects.findIndex((project) => project.id === id);
    if (index < 0) return json(res, 404, { error: "项目不存在" });
    projects.splice(index, 1);
    await persistPlatform();
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/product-lines") {
    json(res, 200, productLines.map((tag) => ({ ...tag, projectCount: projects.filter((project) => project.tagIds?.includes(tag.id)).length })));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/product-lines") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    if (!name) return json(res, 400, { error: "标签名称不能为空" });
    const tag = { id: `tag-${Date.now().toString(36)}`, name, color: body.color || "#5B5EF4" };
    productLines.push(tag);
    await persistPlatform();
    json(res, 201, tag);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/libraries") {
    json(res, 200, libraries);
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/libraries/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop() || "");
    const result = await deleteLibraries([id]);
    if (!result.deleted.length) return json(res, 404, { ok: false, error: "组件库不存在" });
    json(res, 200, { ok: true, ...result });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/libraries/batch-delete") {
    const body = await readBody(req);
    const result = await deleteLibraries(Array.isArray(body.ids) ? body.ids : []);
    json(res, 200, { ok: true, ...result });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sketch/import") {
    try {
      const raw = await readRawBody(req);
      const file = parseMultipart(raw, req.headers["content-type"]);
      const library = await parseSketchUpload(file);
      json(res, 201, { ok: true, library });
    } catch (error) {
      json(res, 400, { ok: false, error: error instanceof Error ? error.message : "Sketch 解析失败" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/prototypes") {
    json(res, 200, prototypes);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ai/generate") {
    const body = await readBody(req);
    const library = sanitizeLibraryForClient(libraries.find((item) => item.id === body.libraryId) || libraries[0]);
    const layout = buildLayout(body.prompt, library);

    json(res, 200, {
      ok: true,
      promptTemplate: {
        libraryId: library.id,
        rules: [
          "只能使用组件库中的组件",
          "必须输出 JSON",
          "颜色必须来自 tokens",
          "必须使用 container 包裹"
        ]
      },
      result: layout
    });
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  await serveFile(res, filePath);
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, "::", () => {
    console.log(`Flowa running at http://[::1]:${PORT}`);
  });
}

async function getLibraryAsset(libraryId, fileName) {
  const safeLibraryId = String(libraryId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const safeFileName = String(fileName || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeLibraryId || !safeFileName || !safeFileName.endsWith(".svg")) return null;
  return libraryStore.getAsset(safeLibraryId, safeFileName);
}

export { server, parseSketchUpload, parseSketchDocument, sanitizeLibraryForClient, deleteLibraries, getLibraryAsset, buildLayout, libraries, metrics, projects, prototypes };
