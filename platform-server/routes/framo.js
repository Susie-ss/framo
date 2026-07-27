// routes/framo.js — 从 Framo-component-library-ai 搬运的完整功能
// 包括：仪表盘指标、项目列表、组件库管理、AI 生成、Sketch 解析

var express = require('express');
var router = express.Router();
var multer = require('multer');
var multerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
var db = require('../db/connector');
var path = require('path');
var https = require('https');
var advancedModulePromise;

function advancedFramo() {
  if (!advancedModulePromise) {
    advancedModulePromise = import(path.join(__dirname, '..', '..', 'server.mjs'));
  }
  return advancedModulePromise;
}

// ===== Mock 数据（匹配 Framo server.mjs =====
var METRICS = [
  { label: '项目数', value: '03', note: '绑定组件库的活跃项目' },
  { label: '组件库', value: '02', note: '支持 AI / 手动 / 上传来源' },
  { label: '原型版本', value: '11', note: '支持 iframe 统一预览' },
  { label: 'Prompt 模板', value: '03', note: '解析 / 生成 / HTML 转换' }
];

var PROJECTS = [
  { id: 'proj-design-ai', name: '企业设计中台', description: '绑定 Enterprise Console 组件库，推进 AI 页面生成与原型预览。', status: 'In Progress', pages: 12 },
  { id: 'proj-axure-hosting', name: 'Axure 托管改造', description: '优先打通 HTML 托管、分享、评论与版本展示。', status: 'Planning', pages: 4 },
  { id: 'proj-spec-parsing', name: '规范解析实验', description: '对接 PDF / OCR / LLM，输出结构化 Design Token。', status: 'Research', pages: 7 }
];

var LIBRARIES = [
  {
    id: 'lib-ant-enterprise',
    name: 'Enterprise Console',
    version: '0.9.0',
    sourceType: 'manual',
    tokens: { colorPrimary: '#C85C3D', colorSurface: '#FFFDF8', colorSuccess: '#2F8F6B', borderRadius: '18px', spacingBase: 8, fontSizeBase: 14 },
    components: ['button', 'card', 'stat', 'table', 'input', 'tag'],
    assets: null,
    stats: { pages: 0, layers: 0, colors: 0, fonts: 0, fontSizes: 0, icons: 0, components: 0, componentVariants: 0 }
  },
  {
    id: 'lib-ai-parsed',
    name: 'AI Parsed Finance UI',
    version: '0.3.2',
    sourceType: 'ai',
    tokens: { colorPrimary: '#23463F', colorSurface: '#F5F8F7', colorAccent: '#5EA38E', borderRadius: '16px', spacingBase: 10, fontSizeBase: 13 },
    components: ['button', 'table', 'filter-bar', 'metric-card', 'drawer'],
    assets: null,
    stats: { pages: 0, layers: 0, colors: 0, fonts: 0, fontSizes: 0, icons: 0, components: 0, componentVariants: 0 }
  }
];

var PROTOTYPES = [
  { id: 'proto-demo-1', name: '运营控制台 HTML Demo', url: '/preview.html', type: 'html', version: 'v0.1.0' }
];

// ===== 辅助函数（匹配 Framo server.mjs）=====
function rgba(color) {
  if (!color) return '';
  var channel = function(v) { return Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 255); };
  var alpha = color.alpha == null ? 1 : Math.max(0, Math.min(1, Number(color.alpha) || 0));
  if (alpha < 1) return 'rgba(' + channel(color.red) + ',' + channel(color.green) + ',' + channel(color.blue) + ',' + alpha.toFixed(2) + ')';
  return '#' + [color.red, color.green, color.blue].map(function(v) { return channel(v).toString(16).padStart(2, '0'); }).join('').toUpperCase();
}

function fontFamily(name) {
  var family = String(name || '').replace(/[- ](Regular|Medium|Semibold|SemiBold|Bold|Light|Thin|Heavy|Black)$/i, '');
  if (/^PingFang[- ]?SC$/i.test(family)) return 'PingFang SC';
  if (/^SFProText$/i.test(family)) return 'SF Pro Text';
  if (/^SanFranciscoDisplay$/i.test(family)) return 'San Francisco Display';
  return family || 'System';
}

function fontWeight(name) {
  if (/black|heavy/i.test(name)) return 900;
  if (/extra.?bold|ultra.?bold/i.test(name)) return 800;
  if (/bold/i.test(name)) return 700;
  if (/semi.?bold|demi.?bold/i.test(name)) return 600;
  if (/medium/i.test(name)) return 500;
  if (/light/i.test(name)) return 300;
  if (/thin/i.test(name)) return 200;
  return 400;
}

function firstFill(layer) {
  if (!layer || !layer.style || !layer.style.fills) return null;
  for (var i = 0; i < layer.style.fills.length; i++) {
    if (layer.style.fills[i].isEnabled !== false && layer.style.fills[i].color) return layer.style.fills[i].color;
  }
  return null;
}

function deepFill(layer) {
  if (!layer || layer.isVisible === false || Number(layer.style && layer.style.contextSettings && layer.style.contextSettings.opacity) === 0) return null;
  var c = firstFill(layer);
  if (c) return c;
  if (layer && layer.layers) {
    for (var i = 0; i < layer.layers.length; i++) {
      c = deepFill(layer.layers[i]);
      if (c) return c;
    }
  }
  return null;
}

function cleanSegment(value) {
  return String(value || '').replace(/^\s*\d+[.、]\s*/, '').replace(/\s+/g, ' ').trim();
}

// ===== 从 Framo parseSketchDocument 搬运的完整解析逻辑 =====
// 包括：颜色/字体/图标/组件/共享样式提取 + Token 推断 + 统计
function parseSketchDocument(document, pages) {
  var colors = {};   // hex → { value, usages[], count, chroma, luminance }
  var fonts = {};    // key → { family, size, weight, count, sample }
  var iconCandidates = [];
  var components = [];
  var textStyles = [];
  var layerStyles = [];
  var totalLayers = 0;

  function registerColor(color, usage) {
    if (!color) return;
    var value = rgba(color);
    var red = Math.max(0, Math.min(1, Number(color.red) || 0));
    var green = Math.max(0, Math.min(1, Number(color.green) || 0));
    var blue = Math.max(0, Math.min(1, Number(color.blue) || 0));
    if (!colors[value]) {
      colors[value] = { value: value, usages: [], count: 0, chroma: Math.max(red, green, blue) - Math.min(red, green, blue), luminance: red * 0.2126 + green * 0.7152 + blue * 0.0722 };
    }
    colors[value].count += 1;
    if (usage && colors[value].usages.length < 3 && colors[value].usages.indexOf(usage) < 0) {
      colors[value].usages.push(usage);
    }
  }

  // 递归遍历图层（匹配 Framo walkLayers）
  function walkLayers(layers, trail) {
    if (!layers) return;
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      if (!layer) continue;
      // 即使没有 _class，仍需遍历其子图层（Framo 参考实现不跳过无 _class 的图层）
      if (!layer._class) {
        if (layer.layers) walkLayers(layer.layers, trail);
        continue;
      }
      totalLayers++;
      var usage = trail.concat([layer.name]).filter(Boolean).join(' / ');
      var trailArr = trail.concat([layer.name || layer._class || 'Layer']);

      // 颜色：fills + borders
      var fills = layer.style && layer.style.fills;
      if (fills) { for (var fi = 0; fi < fills.length; fi++) { registerColor(fills[fi].color, usage); } }
      var borders = layer.style && layer.style.borders;
      if (borders) { for (var bi = 0; bi < borders.length; bi++) { registerColor(borders[bi].color, usage); } }

      // 颜色：文字色
      var textColor = layer.style && layer.style.textStyle && layer.style.textStyle.encodedAttributes && layer.style.textStyle.encodedAttributes.MSAttributedStringColorAttribute;
      if (textColor) registerColor(textColor, usage);

      // 字体
      var fontAttr = layer.style && layer.style.textStyle && layer.style.textStyle.encodedAttributes && layer.style.textStyle.encodedAttributes.MSAttributedStringFontAttribute;
      if (fontAttr && fontAttr.attributes) {
        var attrs = fontAttr.attributes;
        var family = fontFamily(attrs.name || 'Unknown');
        var size = Number(attrs.size) || 14;
        var weight = fontWeight(attrs.name);
        var key = family + '-' + weight + '-' + size.toFixed(2);
        if (!fonts[key]) {
          fonts[key] = { family: family, size: size, weight: weight, count: 0, sample: layer.attributedString ? layer.attributedString.string : (layer.name || 'Aa 字体预览') };
        }
        fonts[key].count += 1;
      }

      // 组件：symbolMaster
      if (layer._class === 'symbolMaster') {
        components.push({
          id: layer.do_objectID,
          symbolId: layer.symbolID,
          name: layer.name || 'Unnamed component',
          width: Math.round((layer.frame && layer.frame.width) || 0),
          height: Math.round((layer.frame && layer.frame.height) || 0),
          category: (layer.name || 'Component').split(/[\/_-]/)[0],
          preview: { color: rgba(deepFill(layer) || { red: 0.94, green: 0.94, blue: 0.94, alpha: 1 }), radius: 10 }
        });
      }

      // 图标候选
      var iconLike = /icon|ico|图标/i.test(layer.name || '') && (['shapeGroup', 'group', 'symbolMaster'].indexOf(layer._class) >= 0);
      if (iconLike && iconCandidates.length < 10000) {
        iconCandidates.push({
          id: layer.do_objectID,
          name: layer.name,
          width: Math.round((layer.frame && layer.frame.width) || 24),
          height: Math.round((layer.frame && layer.frame.height) || 24),
          color: rgba(deepFill(layer) || { red: 0.2, green: 0.2, blue: 0.2, alpha: 1 }),
          paths: iconPaths(layer),
          priority: iconPriority(layer.name)
        });
      }

      // 递归
      if (layer.layers) walkLayers(layer.layers, trailArr);
    }
  }

  // 图标路径提取（匹配 Framo iconPaths）
  function sketchPoint(raw, frame, root, offset) {
    var values = String(raw || '').match(/-?\d*\.?\d+/g);
    if (!values || values.length < 2) return null;
    var x = (offset.x + parseFloat(values[0]) * (Number(frame.width) || root.width)) / root.width * 24;
    var y = (offset.y + parseFloat(values[1]) * (Number(frame.height) || root.height)) / root.height * 24;
    return [x, y];
  }

  function pointCommand(point) { return point[0].toFixed(2) + ' ' + point[1].toFixed(2); }

  function samePoint(left, right) {
    return left && right && Math.abs(left[0] - right[0]) < 0.001 && Math.abs(left[1] - right[1]) < 0.001;
  }

  function iconPaths(layer, paths, rootSize, offset, isRoot) {
    if (!paths) paths = [];
    if (!layer || layer.isVisible === false || Number(layer.style && layer.style.contextSettings && layer.style.contextSettings.opacity) === 0) return paths;
    if (!rootSize) {
      var f = layer.frame || {};
      rootSize = { width: Math.max(1, f.width || 24), height: Math.max(1, f.height || 24) };
    }
    if (!offset) offset = { x: 0, y: 0 };
    if (isRoot === undefined) isRoot = true;
    if (paths.length >= 32) return paths;
    var frame = layer.frame || {};
    var root = rootSize;
    var localOffset = isRoot ? offset : { x: offset.x + (Number(frame.x) || 0), y: offset.y + (Number(frame.y) || 0) };
    if (layer._class === 'shapePath' && Array.isArray(layer.points) && layer.points.length > 1) {
      var pts = layer.points.map(function(item) {
        return {
          point: sketchPoint(item.point, frame, root, localOffset),
          incoming: sketchPoint(item.curveTo || item.point, frame, root, localOffset),
          outgoing: sketchPoint(item.curveFrom || item.point, frame, root, localOffset)
        };
      }).filter(function(item) { return item.point; });
      if (pts.length > 1) {
        var path = 'M' + pointCommand(pts[0].point);
        var segment = function(from, to) {
          if (!samePoint(from.outgoing, from.point) || !samePoint(to.incoming, to.point)) {
            return ' C' + pointCommand(from.outgoing) + ' ' + pointCommand(to.incoming) + ' ' + pointCommand(to.point);
          }
          return ' L' + pointCommand(to.point);
        };
        for (var si = 1; si < pts.length; si++) path += segment(pts[si - 1], pts[si]);
        if (layer.isClosed !== false) path += segment(pts[pts.length - 1], pts[0]) + ' Z';
        paths.push(path);
      }
    }
    if (layer.layers) {
      for (var ci = 0; ci < layer.layers.length; ci++) {
        iconPaths(layer.layers[ci], paths, root, localOffset, false);
      }
    }
    return paths;
  }

  function iconPriority(name) {
    var score = 0;
    if (/Base基础\/1\.icon图标/i.test(name)) score += 120;
    if (/(^|\/)icon图标(\/|$)/i.test(name)) score += 70;
    if (/(^|\/)(icon|ico)(\/|$)/i.test(name)) score += 50;
    if (/图标按钮|图标\+文字|带icon/i.test(name)) score -= 45;
    if (/default|hover|禁用|选中/i.test(name)) score -= 15;
    return score;
  }

  // 遍历所有页面
  for (var pi = 0; pi < pages.length; pi++) {
    var page = pages[pi];
    walkLayers(page.layers, []);
  }

  // 共享样式
  if (document.layerTextStyles && document.layerTextStyles.objects) {
    for (var tsi = 0; tsi < document.layerTextStyles.objects.length; tsi++) {
      var item = document.layerTextStyles.objects[tsi];
      var attrs = item.value && item.value.textStyle && item.value.textStyle.encodedAttributes;
      if (attrs) {
        var fontA = attrs.MSAttributedStringFontAttribute && attrs.MSAttributedStringFontAttribute.attributes;
        textStyles.push({
          name: item.name || 'Text style',
          family: fontA ? fontA.name : 'System',
          size: fontA ? fontA.size : 14,
          color: rgba(attrs.MSAttributedStringColorAttribute || {})
        });
      }
    }
  }
  if (document.layerStyles && document.layerStyles.objects) {
    for (var lsi = 0; lsi < document.layerStyles.objects.length; lsi++) {
      var litem = document.layerStyles.objects[lsi];
      var lfill = litem.value && litem.value.fills && litem.value.fills.find(function(f) { return f.isEnabled !== false; });
      layerStyles.push({
        name: litem.name || 'Layer style',
        color: rgba(lfill ? lfill.color : {}),
        radius: litem.value && litem.value.borderOptions && litem.value.borderOptions.dashPattern ? litem.value.borderOptions.dashPattern[0] || 0 : 0
      });
    }
  }

  // Token 推断：从调色板提取主色和表面色
  var palette = Object.keys(colors).map(function(k) { return colors[k]; }).sort(function(a, b) { return b.count - a.count; });
  var primaryColor = '#5B5BD6';
  for (var pci = 0; pci < palette.length; pci++) {
    var item = palette[pci];
    if (item.luminance > 0.12 && item.luminance < 0.88) {
      primaryColor = item.value;
      break;
    }
  }
  var surfaceColor = '#FFFFFF';
  for (var sci = 0; sci < palette.length; sci++) {
    if (palette[sci].luminance > 0.92) { surfaceColor = palette[sci].value; break; }
  }

  // 图标过滤
  var iconNames = {};
  var icons = iconCandidates.filter(function(item) {
    return item.paths.length > 0 && item.priority >= 120 && !/备份|角色头像|avatar/i.test(item.name);
  }).sort(function(a, b) { return b.priority - a.priority; }).filter(function(item) {
    var shortName = item.name.split('/').pop().trim().toLowerCase();
    if (!shortName || /^\d+$/.test(shortName)) return false;
    if (iconNames[shortName]) return false;
    iconNames[shortName] = true;
    return true;
  }).slice(0, 3000);

  // 组件分组
  var componentGroups = {};
  for (var cgi = 0; cgi < components.length; cgi++) {
    var comp = components[cgi];
    if (/Base基础\/1\.icon图标/i.test(comp.name)) continue;
    var segs = comp.name.split('/').map(cleanSegment).filter(Boolean);
    if (segs.length < 2) continue;
    var cat = segs[0];
    var cname = segs[1];
    var key = (cat + '/' + cname).toLowerCase();
    if (!componentGroups[key]) componentGroups[key] = { name: cname, category: cat, variants: [], representative: comp };
    componentGroups[key].variants.push(comp.name);
    // 评分（匹配 Framo componentScore）
    var rep = componentGroups[key].representative;
    var repScore = 0;
    if (/(^|\/)default$/i.test(rep.name)) repScore += 30;
    if (/(^|\/)(md|medium|中)$/i.test(rep.name)) repScore += 15;
    if (/禁用|disabled|hover|pressed|备份/i.test(rep.name)) repScore -= 30;
    repScore -= rep.name.split('/').length;
    var compScore = 0;
    if (/(^|\/)default$/i.test(comp.name)) compScore += 30;
    if (/(^|\/)(md|medium|中)$/i.test(comp.name)) compScore += 15;
    if (/禁用|disabled|hover|pressed|备份/i.test(comp.name)) compScore -= 30;
    compScore -= comp.name.split('/').length;
    if (compScore > repScore) componentGroups[key].representative = comp;
  }

  var usableComponents = Object.keys(componentGroups).map(function(k) {
    var g = componentGroups[k];
    return {
      id: g.representative.id,
      symbolId: g.representative.symbolId,
      name: g.name,
      fullName: g.category + '/' + g.name,
      category: g.category,
      variantCount: g.variants.length,
      width: g.representative.width,
      height: g.representative.height,
      preview: g.representative.preview
    };
  }).sort(function(a, b) { return a.category.localeCompare(b.category, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN'); });

  // 字体聚合
  var fontFamilies = {};
  var fontSizes = {};
  Object.keys(fonts).forEach(function(k) {
    var item = fonts[k];
    if (!fontFamilies[item.family]) fontFamilies[item.family] = { family: item.family, weights: {}, sizes: {}, count: 0, sample: item.sample };
    var ff = fontFamilies[item.family];
    ff.weights[item.weight] = true;
    if (item.size >= 8 && item.size <= 96) ff.sizes[item.size.toFixed(2)] = true;
    ff.count += item.count;
    if (Math.abs(item.size - Math.round(item.size)) < 0.02 && item.size >= 8 && item.size <= 96) {
      var sz = Math.round(item.size);
      if (!fontSizes[sz]) fontSizes[sz] = { size: sz, count: 0, samples: [] };
      fontSizes[sz].count += item.count;
      if (fontSizes[sz].samples.length < 3 && item.sample) fontSizes[sz].samples.push(String(item.sample).slice(0, 30));
    }
  });

  var usableFonts = Object.keys(fontFamilies).filter(function(f) { return fontFamilies[f].count >= 2 && !/emoji/i.test(f); }).map(function(f) {
    var ff = fontFamilies[f];
    return { family: ff.family, weights: Object.keys(ff.weights).map(Number).sort(), sizes: Object.keys(ff.sizes).map(Number).sort(function(a,b){return a-b;}), count: ff.count, sample: ff.sample };
  }).sort(function(a, b) { return b.count - a.count; });

  var typeScale = Object.keys(fontSizes).map(function(s) { return fontSizes[s]; }).filter(function(item) { return item.count >= 2; }).sort(function(a, b) { return a.size - b.size; });

  // 圆角统计
  var radii = [];
  for (var rpi = 0; rpi < pages.length; rpi++) {
    (function walkRadii(layers) {
      if (!layers) return;
      for (var ri = 0; ri < layers.length; ri++) {
        var rl = layers[ri];
        if (!rl) continue;
        if (rl.fixedRadius && Number(rl.fixedRadius) > 0) radii.push(Number(rl.fixedRadius));
        if (rl.points) {
          for (var rpi2 = 0; rpi2 < rl.points.length; rpi2++) {
            if (rl.points[rpi2].cornerRadius && Number(rl.points[rpi2].cornerRadius) > 0) radii.push(Number(rl.points[rpi2].cornerRadius));
          }
        }
        if (rl.layers) walkRadii(rl.layers);
      }
    })(pages[rpi].layers);
  }
  radii.sort(function(a, b) { return a - b; });
  var medianRadius = radii.length > 0 ? radii[Math.floor(radii.length / 2)] : 12;

  return {
    tokens: { colorPrimary: primaryColor, colorSurface: surfaceColor, borderRadius: Math.round(medianRadius) + 'px', fontSizeBase: Math.round(Object.keys(fonts).length > 0 ? fonts[Object.keys(fonts)[0]].size : 14), spacingBase: 8 },
    assets: { colors: palette.slice(0, 80), fonts: usableFonts, fontSizes: typeScale, icons: icons, components: usableComponents, textStyles: textStyles, layerStyles: layerStyles },
    components: usableComponents.map(function(c) { return c.fullName; }),
    stats: { pages: pages.length, layers: totalLayers, colors: palette.length, fonts: usableFonts.length, fontSizes: typeScale.length, icons: icons.length, components: usableComponents.length, componentVariants: components.length }
  };
}

// ===== Framo buildLayout（完整结构化布局生成）=====
function buildLayout(prompt, library) {
  function normalizeTokens(raw) {
    return {
      colorPrimary: (raw && raw.colorPrimary) || '#1677FF',
      colorSurface: (raw && raw.colorSurface) || '#FFFFFF',
      borderRadius: (raw && raw.borderRadius) || '16px',
      fontSizeBase: (raw && raw.fontSizeBase) || 14,
      spacingBase: (raw && raw.spacingBase) || 8
    };
  }
  var tokens = normalizeTokens(library && library.tokens);
  var compactPrompt = String(prompt || '').trim();
  var available = (library && library.components) || [];
  var pick = function(pattern, fallback) {
    for (var pi = 0; pi < available.length; pi++) {
      if (pattern.test(available[pi])) return available[pi];
    }
    return (library && library.sourceType === 'sketch') ? null : fallback;
  };
  var references = [
    { role: 'page-container', component: pick(/page|layout|container|页面|容器/i, 'container'), reason: '作为页面结构容器' },
    { role: 'summary', component: pick(/card|stat|metric|统计|卡片/i, 'stat'), reason: '承载关键指标' },
    { role: 'content', component: pick(/table|list|列表|表格/i, 'table'), reason: '展示主要业务数据' },
    { role: 'action', component: pick(/button|action|按钮/i, 'button'), reason: '提供主操作入口' }
  ].filter(function(item) { return item.component; });

  return {
    type: 'page',
    libraryId: (library && library.id) || '',
    tokens: tokens,
    prompt: compactPrompt,
    componentReferences: references,
    layout: [
      {
        type: 'container',
        props: { title: compactPrompt.indexOf('分析') >= 0 ? '数据分析总览' : '运营总览' },
        children: [
          {
            type: 'stats',
            items: [
              { label: '待审核任务', value: compactPrompt ? '28' : '18', delta: '+12%' },
              { label: '在线原型', value: '16', delta: '+4%' },
              { label: '规范命中率', value: '93%', delta: '+7%' }
            ]
          },
          {
            type: 'panel',
            title: compactPrompt || '智能任务列表',
            action: '新建页面',
            table: {
              columns: ['页面', '负责人', '状态', '更新时间'],
              rows: [
                ['控制台首页', 'Ava', '已生成', '2 分钟前'],
                ['用户分析页', 'Noah', '待确认', '12 分钟前'],
                ['策略配置页', 'Mia', '设计中', '28 分钟前']
              ]
            }
          }
        ]
      }
    ]
  };
}

// ===== API 端点 =====

// Framo: GET /api/metrics — 仪表盘指标
router.get('/metrics', async function(req, res) {
  var advanced = await advancedFramo();
  res.json(advanced.metrics);
});

// Framo: GET /api/projects — 项目列表
router.get('/projects', async function(req, res) {
  var advanced = await advancedFramo();
  res.json(advanced.projects);
});

// Framo: GET /api/libraries — 组件库列表
router.get('/libraries', async function(req, res) {
  var advanced = await advancedFramo();
  var sanitize = advanced.sanitizeLibraryForClient || function(library) { return library; };
  res.json(advanced.libraries.map(sanitize));
});

// 解析后的 SVG 预览在生产环境由 PostgreSQL 保存；本地开发时仍从
// data/sketch-assets 回退读取，避免 Render 重启后组件预览丢失。
router.get('/assets/:libraryId/:fileName', async function(req, res) {
  try {
    var advanced = await advancedFramo();
    var asset = await advanced.getLibraryAsset(req.params.libraryId, req.params.fileName);
    if (!asset) return res.status(404).end();
    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(asset);
  } catch (error) {
    return res.status(500).json({ ok: false, error: '读取组件预览失败' });
  }
});

// Framo: DELETE /api/libraries/:id — 删除组件库
router.delete('/libraries/:id', async function(req, res) {
  var advanced = await advancedFramo();
  var remove = advanced.deleteLibraries;
  if (typeof remove !== 'function') {
    return res.status(500).json({ ok: false, error: '组件库删除能力未初始化' });
  }
  var result = await remove([req.params.id]);
  if (!result.deleted || !result.deleted.length) {
    return res.status(404).json({ ok: false, error: '组件库不存在' });
  }
  res.json({ ok: true, deleted: result.deleted });
});

// Framo: POST /api/libraries/batch-delete — 批量删除组件库
router.post('/libraries/batch-delete', async function(req, res) {
  var advanced = await advancedFramo();
  var remove = advanced.deleteLibraries;
  if (typeof remove !== 'function') {
    return res.status(500).json({ ok: false, error: '组件库删除能力未初始化' });
  }
  var ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  var result = await remove(ids);
  res.json({ ok: true, deleted: result.deleted || [] });
});

// Framo: GET /api/prototypes — 原型列表
router.get('/prototypes', async function(req, res) {
  var advanced = await advancedFramo();
  res.json(advanced.prototypes);
});

// Framo: POST /api/sketch/import — 上传并解析 Sketch 文件（使用 multer 兼容 Vercel）
router.post('/sketch/import', multerUpload.single('file'), async function(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: '请上传 .sketch 文件' });
    }
    var advanced = await advancedFramo();
    var library = await advanced.parseSketchUpload({
      name: req.file.originalname || 'upload.sketch',
      data: req.file.buffer
    });

    res.status(201).json({ ok: true, library: library });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || 'Sketch 解析失败' });
  }
});

// ===== AI 生成：OpenAI / OpenRouter + 组件库驱动兜底 =====
function escapeHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripMarkdownCodeBlock(content) {
  return String(content || '')
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function ensureFullHTML(html, title) {
  html = stripMarkdownCodeBlock(html);
  if (!/<html[\s>]/i.test(html)) {
    html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escapeHTML(title || 'AI Generated') + '</title></head><body>' + html + '</body></html>';
  }
  return html;
}

function normalizeAIComponents(library) {
  var raw = [];
  if (library && library.assets && Array.isArray(library.assets.components)) raw = library.assets.components;
  else if (library && Array.isArray(library.components)) raw = library.components;
  return raw.map(function(item) {
    if (typeof item === 'string') return { name: item, fullName: item, category: item.split('/')[0] || 'Component', variants: [] };
    return {
      name: item.name || item.fullName || item.category || 'Component',
      fullName: item.fullName || item.name || 'Component',
      category: item.category || String(item.fullName || item.name || 'Component').split('/')[0],
      variants: item.variants || []
    };
  }).filter(function(item) { return item.name; });
}

function normalizeAITokens(library) {
  var tokens = library && library.tokens ? library.tokens : {};
  var colors = library && library.assets && Array.isArray(library.assets.colors) ? library.assets.colors : [];
  var firstColor = colors[0] && (colors[0].value || colors[0]);
  var fontSizes = library && library.assets && Array.isArray(library.assets.fontSizes) ? library.assets.fontSizes : [];
  var fonts = library && library.assets && Array.isArray(library.assets.fonts) ? library.assets.fonts : [];
  var font = fonts[0] && (fonts[0].family || fonts[0].name);
  return {
    colorPrimary: tokens.colorPrimary || firstColor || '#5B5EF4',
    colorSurface: tokens.colorSurface || '#FFFFFF',
    borderRadius: tokens.borderRadius || '12px',
    fontSizeBase: Number(tokens.fontSizeBase || (fontSizes[0] && fontSizes[0].size) || 14),
    spacingBase: Number(tokens.spacingBase || 8),
    fontFamily: font || 'system-ui'
  };
}

function inferAIPageType(prompt) {
  var text = String(prompt || '').toLowerCase();
  if (/登录|注册|login|signin|sign in/.test(text)) return 'login';
  if (/表单|录入|创建|编辑|form/.test(text)) return 'form';
  // 看板需要优先于“表格”识别：看板里可以包含任务表格，但页面主体不是列表页。
  if (/看板|统计|趋势|分析|dashboard/.test(text)) return 'dashboard';
  if (/列表|表格|查询|筛选|table|list/.test(text)) return 'list';
  if (/详情|profile|detail/.test(text)) return 'detail';
  if (/营销|官网|landing|活动/.test(text)) return 'landing';
  return 'dashboard';
}

function pickAIComponent(components, pattern, fallback) {
  for (var i = 0; i < components.length; i++) {
    var name = components[i].fullName || components[i].name || '';
    if (pattern.test(name)) return name;
  }
  return fallback;
}

function buildComponentReferences(prompt, library) {
  var components = normalizeAIComponents(library);
  var pageType = inferAIPageType(prompt);
  // 保留下面的数据引用分支；看板本身也会引用数据组件。
  var type = '';
  var shipTableWorkflow = isShipTableWorkflow(library, prompt);
  if (shipTableWorkflow) {
    return [
      { role: 'table', component: pickAIComponent(components, /Table[ /]?(表格)?$/i, 'Table 表格'), reason: '承载 Ship 项目计划数据' },
      { role: 'toolbar', component: pickAIComponent(components, /Table.*工具栏|工具栏/i, 'Table 工具栏'), reason: '承载搜索与批量操作' },
      { role: 'filter', component: pickAIComponent(components, /Table.*筛选|筛选/i, 'Table 筛选'), reason: '按状态筛选任务' },
      { role: 'sort', component: pickAIComponent(components, /Table.*排序|排序/i, 'Table 排序'), reason: '按字段排序项目计划' }
    ];
  }
  var refs = [
    { role: 'layout', component: pickAIComponent(components, /Layout|布局|Card|卡片|Container|容器/i, 'Card / Layout'), reason: '页面结构与信息分区' },
    { role: 'action', component: pickAIComponent(components, /Button|按钮|Action/i, 'Button 按钮'), reason: '主操作与次操作' }
  ];
  if (pageType === 'login' || pageType === 'form') {
    refs.push({ role: 'input', component: pickAIComponent(components, /Input|输入|Form|表单|Select|选择/i, 'Input / Form 表单'), reason: '输入与校验' });
  } else if (type === 'dashboard') {
    core = '<section class="stats"><div><small>本周完成任务</small><b>128</b><span>较上周 +18%</span></div><div><small>进行中项目</small><b>24</b><span>8 个待关注</span></div><div><small>交付准时率</small><b>92%</b><span>较上周 +6%</span></div></section><section class="grid"><div class="panel"><div class="panel-head"><h2>' + escapeHTML(title) + '</h2><button>查看详情</button></div><div class="trend"><div class="axis"><span>120</span><span>80</span><span>40</span><span>0</span></div><div class="chart"><svg viewBox="0 0 520 180" preserveAspectRatio="none" aria-label="项目趋势图"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + primary + '" stop-opacity=".28"/><stop offset="1" stop-color="' + primary + '" stop-opacity=".02"/></linearGradient></defs><path d="M0 148 C45 126,72 137,108 108 S172 112,210 84 S271 93,307 53 S367 72,401 43 S467 45,520 16 L520 180 L0 180Z" fill="url(#area)"/><path d="M0 148 C45 126,72 137,108 108 S172 112,210 84 S271 93,307 53 S367 72,401 43 S467 45,520 16" fill="none" stroke="' + primary + '" stroke-width="4" stroke-linecap="round"/></svg><div class="chart-labels"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div></div></div></div><div class="panel accent"><h2>待处理事项</h2><ul><li><b>设计评审</b><span>今天 15:00</span></li><li><b>原型验收</b><span>明天</span></li><li><b>需求排期</b><span>本周内</span></li></ul>' + componentBadges + '</div></section><section class="panel" style="margin-top:16px"><div class="panel-head"><h2>项目任务</h2><button class="ghost">筛选</button></div><table><thead><tr><th>任务名称</th><th>负责人</th><th>状态</th><th>更新时间</th></tr></thead><tbody><tr><td>设计系统组件盘点</td><td>产品设计组</td><td><em>进行中</em></td><td>刚刚</td></tr><tr><td>原型交互验收</td><td>体验团队</td><td><em>待确认</em></td><td>今天</td></tr></tbody></table></section>';
  } else {
    refs.push({ role: 'data', component: pickAIComponent(components, /Table|表格|List|列表|Data|数据/i, 'Table / List 数据展示'), reason: '承载业务数据' });
  }
  refs.push({ role: 'feedback', component: pickAIComponent(components, /Alert|Message|Notify|Toast|提示|通知/i, 'Message / Alert 反馈'), reason: '状态反馈' });
  return refs;
}

function isShipTableWorkflow(library, prompt) {
  var name = String(library && library.name || '');
  var components = normalizeAIComponents(library).map(function(item) { return item.fullName || item.name || ''; }).join(' ');
  var task = String(prompt || '');
  // “看板 / 趋势 / 统计”可包含表格，但应由 AI 生成完整看板，不能被表格模板截断。
  var dashboardRequest = /看板|统计|趋势|分析|dashboard/i.test(task);
  return !dashboardRequest && /ship/i.test(name) && /Table|表格|筛选|排序|工具栏/i.test(components) && /项目|任务|表格|列表|筛选|排序|计划/i.test(task);
}

// Ship 的 Sketch 文件包含一组完整的项目计划表格（表格、工具栏、筛选、排序）。
// 对这类请求使用结构化生成器，避免通用后台模板覆盖已解析的组件语义与视觉结构。
function buildShipTableHTML(prompt, library) {
  var tokens = normalizeAITokens(library);
  var primary = tokens.colorPrimary || '#4F8CF7';
  var family = String(tokens.fontFamily || 'PingFang SC').replace(/["<>]/g, '');
  var rows = [
    ['1', '本期项目计划', '', '', '', 'group'],
    ['2', '组件库解析优化', 'Susie', '进行中', '2026年7月', 'blue'],
    ['3', 'AI 页面生成适配', 'Flowa AI', '待确认', '2026年7月', 'purple'],
    ['4', '项目协作工作台', 'Mia', '设计中', '2026年8月', 'orange'],
    ['5', '原型预览发布', 'Team', '已完成', '2026年7月', 'green'],
    ['6', '设计 Token 校验', 'Noah', '进行中', '2026年8月', 'blue'],
    ['7', '插件安装包发布', 'Susie', '待确认', '2026年8月', 'purple']
  ];
  var rowHTML = rows.map(function(row, index) {
    var group = row[5] === 'group';
    var title = group
      ? '<span class="caret">›</span><span class="group-icon">◇</span>' + escapeHTML(row[1])
      : '<span class="issue-dot">●</span><span class="issue-id">AE-' + (2818 + index) + '</span>' + escapeHTML(row[1]);
    var state = group ? '' : '<span class="state state-' + escapeHTML(row[5]) + '">' + escapeHTML(row[3]) + '</span>';
    return '<tr class="' + (group ? 'group-row' : '') + '"><td class="index">' + escapeHTML(row[0]) + '</td><td class="subject">' + title + '</td><td>' + escapeHTML(row[2]) + '</td><td>' + state + '</td><td>' + escapeHTML(row[4]) + '</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>项目计划</title><style>' +
    '*{box-sizing:border-box}body{margin:0;background:#fff;color:#394150;font-family:"' + family + '",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;font-size:14px}.ship-page{min-height:100vh;background:#fff}.topline{height:54px;display:flex;align-items:center;padding:0 34px;border-bottom:1px solid #eef0f3;color:#697386;font-size:17px}.crumb-icon{font-size:20px;margin-right:12px;color:#7c8798}.crumb{color:#394150;font-weight:600}.toolbar{height:82px;display:flex;align-items:center;gap:28px;padding:0 34px;border-bottom:1px solid #e9edf1;color:#747d8c}.search{display:flex;align-items:center;gap:11px;min-width:390px;color:#9aa3b0;font-size:16px}.search i{font-size:26px;font-style:normal;font-weight:300}.search .chevron{margin-left:auto;font-size:20px}.tool{display:flex;align-items:center;gap:8px;font-size:16px;white-space:nowrap}.tool b{font-size:21px;font-weight:400;color:#8e98a7}.tool.count{margin-left:4px;color:#7b8492}.data{padding:0 34px 40px;overflow:auto}table{width:100%;min-width:920px;border-collapse:collapse;table-layout:fixed}th{height:62px;color:#4d5562;font-size:16px;font-weight:600;text-align:left;border-bottom:1px solid #e6e9ed;padding:0 20px;white-space:nowrap}td{height:68px;border-bottom:1px solid #edf0f3;padding:0 20px;color:#3f4652;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}th+th,td+td{border-left:1px solid #edf0f3}.index{width:7%;text-align:center;color:#a6adb8;padding:0}.subject{width:39%;font-size:16px}.group-row td{font-weight:600;background:#fcfcfd}.caret{display:inline-block;font-size:28px;line-height:0;vertical-align:-2px;color:#9aa2af;margin-right:12px}.group-icon{color:#99a1ad;font-size:22px;vertical-align:-2px;margin-right:10px}.issue-dot{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:5px;background:' + primary + ';color:#fff;font-size:11px;margin-right:9px;vertical-align:0}.issue-id{color:#9ca3ad;margin-right:8px;font-size:14px}.state{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:5px;font-weight:600;font-size:14px}.state-blue{background:#edf5ff;color:#2d7be8}.state-purple{background:#f0edff;color:#7461dc}.state-orange{background:#fff4e8;color:#e78527}.state-green{background:#ebf8ef;color:#24a05a}@media(max-width:760px){.topline,.toolbar{padding-left:18px;padding-right:18px}.toolbar{gap:14px;height:auto;min-height:72px;flex-wrap:wrap;padding-top:12px;padding-bottom:12px}.search{min-width:100%;height:28px}.data{padding:0 18px}}</style></head><body><main class="ship-page"><div class="topline"><span class="crumb-icon">☷</span><span class="crumb">全部计划 / 黑色部分</span><span style="margin-left:10px">⌄</span></div><div class="toolbar"><div class="search"><i>⌕</i><span>搜索</span><span class="chevron">⌄</span></div><div class="tool"><b>☷</b> 筛选</div><div class="tool"><b>⇅</b> 排序</div><div class="tool"><b>♧</b> 树状</div><div class="tool count">13 条需求</div></div><div class="data"><table><colgroup><col style="width:7%"><col style="width:39%"><col style="width:17%"><col style="width:18%"><col style="width:19%"></colgroup><thead><tr><th class="index"><span style="font-size:21px;color:#c1c7d0">□</span></th><th>任务名称</th><th>负责人</th><th>状态</th><th>计划时间</th></tr></thead><tbody>' + rowHTML + '</tbody></table></div></main></body></html>';
}

function getAIConfig() {
  if (process.env.OPENAI_API_KEY) {
    var openAIModel = process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini';
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: openAIModel,
      models: [openAIModel, 'gpt-4o-mini']
    };
  }
  if (process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY) {
    // 默认使用 OpenRouter 的免费路由，避免没有充值额度时仍去请求付费模型。
    // 只有显式开启 AI_ALLOW_PAID=true 时才允许使用部署环境的付费模型变量。
    var allowPaid = process.env.AI_ALLOW_PAID === 'true';
    var openRouterModel = allowPaid ? (process.env.OPENROUTER_MODEL || process.env.AI_MODEL || 'openrouter/free') : 'openrouter/free';
    return {
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: openRouterModel,
      requestTimeout: allowPaid ? 30000 : 12000,
      models: [openRouterModel]
    };
  }
  return null;
}

function requestChatCompletion(config, model, messages) {
  return new Promise(function(resolve, reject) {
    var endpoint = new URL(config.baseURL.replace(/\/$/, '') + '/chat/completions');
    var data = JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.55,
      max_tokens: 3500
    });
    var options = {
      hostname: endpoint.hostname,
      path: endpoint.pathname + endpoint.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': 'Bearer ' + config.apiKey
      }
    };
    if (config.provider === 'openrouter') {
      options.headers['HTTP-Referer'] = process.env.PUBLIC_APP_URL || 'https://framo-production.up.railway.app';
      options.headers['X-Title'] = 'Flowa AI Generator';
    }
    var req = https.request(options, function(response) {
      var chunks = [];
      response.on('data', function(chunk) { chunks.push(chunk); });
      response.on('end', function() {
        var body = Buffer.concat(chunks).toString();
        try {
          var result = JSON.parse(body);
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(new Error((result.error && result.error.message) || ('AI API HTTP ' + response.statusCode)));
          }
          if (result.error) return reject(new Error(result.error.message || 'AI API error'));
          var content = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
          if (!content) return reject(new Error('AI 返回空内容'));
          resolve({ content: content, provider: config.provider, model: model });
        } catch (e) {
          reject(new Error('AI 返回解析失败: ' + e.message));
        }
      });
    });
    req.on('error', function(err) { reject(err); });
    req.setTimeout(config.requestTimeout || 30000, function() {
      req.destroy(new Error('AI 请求超时'));
    });
    req.write(data);
    req.end();
  });
}

async function callChatCompletion(messages) {
  var config = getAIConfig();
  if (!config) throw new Error('未配置 OPENAI_API_KEY 或 OPENROUTER_API_KEY');
  var models = config.models && config.models.length ? config.models : [config.model];
  var lastError = null;
  for (var i = 0; i < models.length; i++) {
    try {
      return await requestChatCompletion(config, models[i], messages);
    } catch (err) {
      lastError = err;
      console.warn('[AI] model failed:', models[i], err.message);
    }
  }
  throw lastError || new Error('AI 模型调用失败');
}

function buildAIPrompt(userPrompt, library, context) {
  var tokens = normalizeAITokens(library);
  var components = normalizeAIComponents(library);
  var componentList = components.slice(0, 20).map(function(item) { return item.fullName || item.name; }).join('；');
  var palette = library && library.assets && Array.isArray(library.assets.colors) ? library.assets.colors.slice(0, 10).map(function(item) { return item.value || item; }).join('、') : tokens.colorPrimary;
  var fonts = library && library.assets && Array.isArray(library.assets.fonts) ? library.assets.fonts.slice(0, 6).map(function(f) { return f.family || f.name; }).join('、') : '系统字体';
  var sizes = library && library.assets && Array.isArray(library.assets.fontSizes) ? library.assets.fontSizes.slice(0, 8).map(function(s) { return s.size || s; }).join('、') : String(tokens.fontSizeBase);
  var history = context && Array.isArray(context.history) ? context.history.slice(-6).map(function(item) {
    return (item.type === 'user' ? '用户：' : '助手：') + String(item.text || '').slice(0, 300);
  }).join('\n') : '';
  var currentHtml = context && context.currentHtml ? String(context.currentHtml).slice(0, 12000) : '';

  return [
    {
      role: 'system',
      content: '你是 Flowa 的资深产品设计师和前端原型工程师。只输出一个完整可预览 HTML 文件，不要 markdown，不要解释，不要外链资源，不要 script。页面必须真实像产品原型：有清晰业务结构、可辨认组件、合理空状态/表格/表单/卡片/按钮。当前选中的组件库是「' + String(library && library.name || '默认组件库') + '」，它是唯一视觉来源，严禁使用另一套设计系统或默认紫色模板。必须使用这些设计 Token：主色 ' + tokens.colorPrimary + '，表面色 ' + tokens.colorSurface + '，圆角 ' + tokens.borderRadius + '，基础字号 ' + tokens.fontSizeBase + 'px，间距基数 ' + tokens.spacingBase + 'px。优先引用组件库语义：' + (componentList || 'Button、Input、Form、Card、Table') + '。可用字体：' + fonts + '；字号：' + sizes + '；组件库色板：' + palette + '。CSS 中的按钮、输入框、表格、标签、卡片必须围绕上述 Token 和色板构建；如果颜色不在色板中，只能使用灰阶。'
    },
    {
      role: 'user',
      content: '请根据这个需求生成或修改一个 1280px 宽度内适配的中文业务页面原型：' + userPrompt + '\n最近对话：\n' + (history || '无') + '\n当前预览 HTML（如果有，请在此基础上迭代，而不是重新跑偏）：\n' + (currentHtml || '无') + '\n要求：1. 内联 CSS 2. 视觉精致但代码紧凑 3. 用注释标出引用的组件库组件 4. body 只包含页面本身，不要生成工作台外壳、AI 说明、Token 面板或组件引用列表 5. 所有视觉控件都要与当前组件库风格一致。'
    }
  ];
}

function buildLocalAIHTML(prompt, library) {
  var tokens = normalizeAITokens(library);
  var refs = buildComponentReferences(prompt, library);
  if (isShipTableWorkflow(library, prompt)) {
    return buildShipTableHTML(prompt, library);
  }
  var componentBadges = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px">' + refs.slice(0, 4).map(function(ref) {
    return '<span style="border:1px solid rgba(15,23,42,.1);border-radius:999px;padding:6px 9px;font-size:12px;color:#475569">' + escapeHTML(ref.component) + '</span>';
  }).join('') + '</div>';
  var type = inferAIPageType(prompt);
  var primary = tokens.colorPrimary;
  var surface = tokens.colorSurface;
  var fontFamily = String(tokens.fontFamily || 'system-ui').replace(/["<>]/g, '');
  var palette = library && library.assets && Array.isArray(library.assets.colors) ? library.assets.colors : [];
  var accent = palette[1] && (palette[1].value || palette[1]) || primary;
  var radius = tokens.borderRadius;
  var fontSize = tokens.fontSizeBase;
  var title = /登录|login/i.test(prompt) ? '进入 Flowa 工作台' : (/项目|任务/i.test(prompt) ? '项目协作工作台' : (/表单|录入|创建/i.test(prompt) ? '新建业务对象' : (/营销|官网|landing/i.test(prompt) ? '设计资产智能协作平台' : '业务数据工作台')));
  var core = '';
  if (type === 'login') {
    core = '<section class="login-card"><div><h1>' + escapeHTML(title) + '</h1><p>使用你的团队账号继续。</p><label>团队账号</label><input placeholder="请输入用户名"><label>密码</label><input type="password" placeholder="请输入密码"><button>登录</button></div></section>';
  } else if (type === 'form') {
    core = '<section class="panel"><div class="panel-head"><h2>' + escapeHTML(title) + '</h2><button>保存草稿</button></div><div class="form-grid"><label>名称<input value="智能生成页面"></label><label>负责人<input value="Susie"></label><label>状态<select><option>设计中</option><option>待评审</option></select></label><label>优先级<select><option>高</option><option>中</option></select></label></div><textarea placeholder="补充业务说明">根据组件库规范自动生成页面结构、字段和操作区。</textarea><div class="actions"><button class="ghost">取消</button><button>提交</button></div></section>';
  } else if (type === 'list') {
    core = '<section class="panel"><div class="panel-head"><h2>' + escapeHTML(title) + '</h2><button>新建记录</button></div><div class="toolbar"><input placeholder="搜索名称 / 状态"><button class="ghost">筛选</button><button class="ghost">导出</button></div><table><thead><tr><th>名称</th><th>负责人</th><th>状态</th><th>更新时间</th></tr></thead><tbody><tr><td>组件库解析优化</td><td>Susie</td><td><em>进行中</em></td><td>刚刚</td></tr><tr><td>AI 页面生成</td><td>Flowa AI</td><td><em>已生成</em></td><td>12 分钟前</td></tr><tr><td>原型预览发布</td><td>Team</td><td><em>待确认</em></td><td>今天</td></tr></tbody></table></section>';
  } else if (type === 'dashboard') {
    core = '<section class="stats"><div><small>本周完成任务</small><b>128</b><span>较上周 +18%</span></div><div><small>进行中项目</small><b>24</b><span>8 个待关注</span></div><div><small>交付准时率</small><b>92%</b><span>较上周 +6%</span></div></section><section class="grid"><div class="panel"><div class="panel-head"><h2>' + escapeHTML(title) + '</h2><button>查看详情</button></div><div class="trend"><div class="axis"><span>120</span><span>80</span><span>40</span><span>0</span></div><div class="chart"><svg viewBox="0 0 520 180" preserveAspectRatio="none" aria-label="项目趋势图"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + primary + '" stop-opacity=".28"/><stop offset="1" stop-color="' + primary + '" stop-opacity=".02"/></linearGradient></defs><path d="M0 148 C45 126,72 137,108 108 S172 112,210 84 S271 93,307 53 S367 72,401 43 S467 45,520 16 L520 180 L0 180Z" fill="url(#area)"/><path d="M0 148 C45 126,72 137,108 108 S172 112,210 84 S271 93,307 53 S367 72,401 43 S467 45,520 16" fill="none" stroke="' + primary + '" stroke-width="4" stroke-linecap="round"/></svg><div class="chart-labels"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div></div></div></div><div class="panel accent"><h2>待处理事项</h2><ul><li><b>设计评审</b><span>今天 15:00</span></li><li><b>原型验收</b><span>明天</span></li><li><b>需求排期</b><span>本周内</span></li></ul>' + componentBadges + '</div></section><section class="panel" style="margin-top:16px"><div class="panel-head"><h2>项目任务</h2><button class="ghost">筛选</button></div><table><thead><tr><th>任务名称</th><th>负责人</th><th>状态</th><th>更新时间</th></tr></thead><tbody><tr><td>设计系统组件盘点</td><td>产品设计组</td><td><em>进行中</em></td><td>刚刚</td></tr><tr><td>原型交互验收</td><td>体验团队</td><td><em>待确认</em></td><td>今天</td></tr></tbody></table></section>';
  } else {
    core = '<section class="stats"><div><small>项目数</small><b>28</b><span>+12%</span></div><div><small>组件引用</small><b>' + escapeHTML(String(refs.length)) + '</b><span>来自组件库</span></div><div><small>完成率</small><b>86%</b><span>+8%</span></div></section><section class="grid"><div class="panel"><div class="panel-head"><h2>最近任务</h2><button>新建</button></div><ul><li><b>组件库解析</b><span>进行中</span></li><li><b>AI 页面预览</b><span>已完成</span></li><li><b>插件发布</b><span>待验证</span></li></ul></div><div class="panel accent"><h2>生成策略</h2><p>页面已按组件库 Token、字体、字号和组件语义自动组织，可继续在对话中要求调整。</p>' + componentBadges + '</div></section>';
  }
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHTML(title) + '</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f6fb;color:#172033;font-family:"' + fontFamily + '",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;font-size:' + fontSize + 'px}.page{min-height:100vh;padding:32px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:0 0 20px}.stats div,.panel,.login-card{background:' + surface + ';border:1px solid #e7eaf3;border-radius:' + radius + ';box-shadow:0 14px 36px rgba(15,23,42,.06)}.stats div{padding:20px}.stats small{display:block;color:#8a94a6}.stats b{display:block;font-size:34px;color:' + primary + ';margin:8px 0}.stats span{color:' + accent + '}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}.panel{padding:22px}.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.panel h2{margin:0;font-size:20px}button{border:0;border-radius:10px;background:' + primary + ';color:white;padding:10px 16px;font-weight:700;cursor:pointer}.ghost{background:#f1f5f9;color:#475569}input,select,textarea{width:100%;border:1px solid #dfe4ee;border-radius:10px;padding:12px 14px;background:#fff;font:inherit}textarea{min-height:96px;margin-top:14px}.toolbar{display:flex;gap:10px;margin-bottom:14px}.toolbar input{flex:1}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:13px;border-bottom:1px solid #edf0f6}th{color:#8a94a6;font-weight:600}em{font-style:normal;color:' + primary + ';background:' + primary + '18;padding:4px 8px;border-radius:999px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}label{display:block;color:#64748b;margin-bottom:12px}label input,label select{margin-top:7px}.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.login-card{padding:30px}.panel ul{list-style:none;padding:0;margin:0}.panel li{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #edf0f6}.accent p{line-height:1.8;color:#64748b}.trend{display:flex;gap:12px;height:226px}.axis{width:28px;display:flex;flex-direction:column;justify-content:space-between;color:#a0a8b5;font-size:11px;padding:10px 0 24px}.chart{flex:1;display:flex;flex-direction:column;min-width:0;background:repeating-linear-gradient(to bottom,transparent 0,transparent 52px,#edf0f5 53px)}.chart svg{flex:1;width:100%;min-height:0}.chart-labels{display:flex;justify-content:space-between;color:#9aa3af;font-size:12px;padding-top:8px}@media(max-width:860px){.grid,.login-card{display:block}.stats,.form-grid{grid-template-columns:1fr}.accent{margin-top:16px}}</style></head><body><main class="page">' + core + '</main></body></html>';
}

function buildAIResult(prompt, library, html, meta) {
  var tokens = normalizeAITokens(library);
  var refs = buildComponentReferences(prompt, library);
  return {
    type: 'page',
    prompt: prompt,
    libraryId: library && library.id,
    tokens: tokens,
    componentReferences: refs,
    layout: [{
      type: 'container',
      props: { title: prompt },
      children: [
        { type: 'stats', items: [
          { label: '生成方式', value: meta && meta.mode === 'model' ? 'AI' : 'Local', delta: meta && meta.model ? meta.model : '可用兜底' },
          { label: '引用组件', value: String(refs.length), delta: library ? library.name : '默认组件库' },
          { label: '主色', value: tokens.colorPrimary, delta: 'Token' }
        ]},
        { type: 'ai-frame', content: html }
      ]
    }],
    html: html,
    meta: meta || {}
  };
}

// Framo: POST /api/ai/generate — 真实 AI 生成
router.post('/ai/generate', async function(req, res) {
  try {
    var prompt = req.body.prompt || '';
    var libraryId = req.body.libraryId || '';
    var advanced = await advancedFramo();
    var sanitize = advanced.sanitizeLibraryForClient || function(library) { return library; };
    var library = sanitize(advanced.libraries.find(function(l) { return l.id === libraryId; }) || advanced.libraries[0]);

    if (!prompt.trim()) {
      return res.status(400).json({ ok: false, error: '请输入生成描述' });
    }

    // Ship 的表格资产有明确的工具栏/筛选/排序/表格层级；优先使用结构化结果，
    // 避免外部模型产出与原始 Sketch 风格无关的通用后台表格。
    if (isShipTableWorkflow(library, prompt)) {
      var shipHTML = buildShipTableHTML(prompt, library);
      return res.json({
        ok: true,
        promptTemplate: { libraryId: library.id, rules: ['Ship 表格组件驱动', '复用工具栏、筛选、排序与表格字段'] },
        result: buildAIResult(prompt, library, shipHTML, {
          mode: 'component-driven',
          provider: 'ship-structured-generator',
          generatedAt: new Date().toISOString()
        })
      });
    }

    var messages = buildAIPrompt(prompt, library, {
      history: req.body.history || [],
      currentHtml: req.body.currentHtml || ''
    });
    var aiResponse = await callChatCompletion(messages);
    var html = ensureFullHTML(aiResponse.content, prompt);
    var layout = buildAIResult(prompt, library, html, {
      mode: 'model',
      provider: aiResponse.provider,
      model: aiResponse.model,
      generatedAt: new Date().toISOString()
    });

    res.json({
      ok: true,
      promptTemplate: {
        libraryId: library.id,
        rules: ['使用组件库规范', '响应式布局']
      },
      result: layout
    });
  } catch (err) {
    console.error('AI generate error:', err.message);
    // 兜底：没有 AI Key 或模型异常时，仍基于组件库 Token 生成可用 HTML 原型
    try {
      var fallbackAdvanced = await advancedFramo();
      var fallbackSanitize = fallbackAdvanced.sanitizeLibraryForClient || function(library) { return library; };
      var fallbackLib = fallbackSanitize(fallbackAdvanced.libraries.find(function(l) { return l.id === (req.body.libraryId || ''); }) || fallbackAdvanced.libraries[0] || LIBRARIES[0]);
      var fallbackHTML = buildLocalAIHTML(prompt, fallbackLib);
      res.json({
        ok: true,
        promptTemplate: { libraryId: fallbackLib.id, rules: ['组件库 Token 兜底生成', '可直接预览'] },
        result: buildAIResult(prompt, fallbackLib, fallbackHTML, {
          mode: 'local',
          provider: 'local-generator',
          error: err.message,
          generatedAt: new Date().toISOString()
        })
      });
    } catch (fallbackErr) {
      console.error('AI fallback generate error:', fallbackErr.message);
      return res.json({ ok: false, error: '组件库回退生成失败：' + (fallbackErr.message || err.message) });
    }
  }
});

module.exports = router;
