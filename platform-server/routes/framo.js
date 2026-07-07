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
    if (!rootSize) {
      var f = layer.frame || {};
      rootSize = { width: Math.max(1, f.width || 24), height: Math.max(1, f.height || 24) };
    }
    if (!offset) offset = { x: 0, y: 0 };
    if (isRoot === undefined) isRoot = true;
    if (paths.length >= 8) return paths;
    var frame = layer.frame || {};
    var root = rootSize;
    var localOffset = isRoot ? offset : { x: offset.x + (Number(frame.x) || 0), y: offset.y + (Number(frame.y) || 0) };
    if (layer._class === 'shapePath' && Array.isArray(layer.points) && layer.points.length > 1) {
      var pts = layer.points.map(function(item) {
        return {
          point: sketchPoint(item.point, frame, root, localOffset),
          incoming: sketchPoint(item.curveFrom || item.point, frame, root, localOffset),
          outgoing: sketchPoint(item.curveTo || item.point, frame, root, localOffset)
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

// ===== AI 调用（OpenRouter）=====
function callOpenRouter(messages) {
  return new Promise(function(resolve, reject) {
    var apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      return reject(new Error('未配置 ANTHROPIC_API_KEY'));
    }
    var data = JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: messages,
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });
    var options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://framo.app',
        'X-Title': 'Framo AI Generator'
      }
    };
    var req = https.request(options, function(response) {
      var chunks = [];
      response.on('data', function(chunk) { chunks.push(chunk); });
      response.on('end', function() {
        var body = Buffer.concat(chunks).toString();
        try {
          var result = JSON.parse(body);
          if (result.error) return reject(new Error(result.error.message || 'AI API error'));
          var content = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
          if (!content) return reject(new Error('AI 返回空内容'));
          resolve(content);
        } catch (e) {
          reject(new Error('AI 返回解析失败: ' + e.message));
        }
      });
    });
    req.on('error', function(err) { reject(err); });
    req.write(data);
    req.end();
  });
}

function buildAIPrompt(userPrompt, library) {
  var tokens = library.tokens || {};
  var components = library.components || [];
  var colors = library.assets && library.assets.colors ? library.assets.colors.slice(0, 10) : [];
  var fonts = library.assets && library.assets.fonts ? library.assets.fonts.slice(0, 3) : [];

  var colorList = colors.map(function(c) { return c.value || c; }).join(', ');
  var fontList = fonts.map(function(f) { return f.family || f; }).join(', ');
  var componentList = components.join(', ');

  return [
    {
      role: 'system',
      content: '你是一个专业的 UI 设计师和前端开发者。你的任务是根据用户描述和组件库规范，生成一个页面原型的 JSON 布局描述。\n\n' +
        '你必须返回一个有效的 JSON 对象，格式如下：\n' +
        '{\n' +
        '  "type": "page",\n' +
        '  "tokens": { "colorPrimary": "...", "colorSurface": "...", "borderRadius": "...", "fontSizeBase": 14 },\n' +
        '  "componentReferences": [\n' +
        '    { "role": "容器", "component": "...", "reason": "..." }\n' +
        '  ],\n' +
        '  "layout": [\n' +
        '    {\n' +
        '      "type": "container",\n' +
        '      "props": { "title": "页面标题" },\n' +
        '      "children": [\n' +
        '        { "type": "stats", "items": [{ "label": "...", "value": "...", "delta": "..." }] },\n' +
        '        { "type": "panel", "title": "...", "action": "...", "table": { "columns": ["..."], "rows": [["..."]] } }\n' +
        '      ]\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        '布局节点类型说明：\n' +
        '- container: 页面容器，必须有 props.title 和 children\n' +
        '- stats: 统计卡片行，items 数组包含 label/value/delta\n' +
        '- panel: 面板，包含 title/action/table(可选)\n' +
        '- 所有颜色必须使用组件库提供的颜色值\n' +
        '- 根据用户描述生成合适的业务内容，不要返回固定示例数据'
    },
    {
      role: 'user',
      content: '用户描述：' + userPrompt + '\n\n' +
        '组件库信息：\n' +
        '- 名称：' + (library.name || '默认组件库') + '\n' +
        '- 主色：' + (tokens.colorPrimary || '#1677FF') + '\n' +
        '- 表面色：' + (tokens.colorSurface || '#FFFFFF') + '\n' +
        '- 圆角：' + (tokens.borderRadius || '8px') + '\n' +
        '- 基础字号：' + (tokens.fontSizeBase || 14) + 'px\n' +
        '- 可用颜色：' + (colorList || tokens.colorPrimary) + '\n' +
        '- 可用字体：' + (fontList || 'System') + '\n' +
        '- 可用组件：' + (componentList || 'button, card, table') + '\n\n' +
        '请根据以上信息生成一个完整的页面原型 JSON。'
    }
  ];
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

    var messages = buildAIPrompt(prompt, library);
    var aiResponse = await callOpenRouter(messages);

    var layout;
    try {
      layout = JSON.parse(aiResponse);
    } catch (e) {
      // 尝试从 markdown 代码块中提取 JSON
      var match = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) layout = JSON.parse(match[1]);
      else {
        // 兜底：使用 mock 布局但注入用户 prompt
        layout = advanced.buildLayout(prompt, library);
        layout.prompt = prompt;
      }
    }

    // 确保返回格式兼容前端
    if (!layout.tokens) layout.tokens = library.tokens || { colorPrimary: '#1677FF', colorSurface: '#FFFFFF', borderRadius: '8px' };
    if (!layout.componentReferences) layout.componentReferences = [];
    if (!layout.layout) layout.layout = [];

    res.json({
      ok: true,
      promptTemplate: {
        libraryId: library.id,
        rules: ['只能使用组件库中的组件', '必须输出 JSON', '颜色必须来自 tokens', '必须使用 container 包裹']
      },
      result: layout
    });
  } catch (err) {
    console.error('AI generate error:', err.message);
    // 兜底返回 mock 数据
    var advanced = await advancedFramo();
    var library = advanced.libraries[0];
    var layout = advanced.buildLayout(prompt, library);
    res.json({
      ok: true,
      promptTemplate: { libraryId: library.id, rules: [] },
      result: layout
    });
  }
});

module.exports = router;
