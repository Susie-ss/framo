// routes/ai.js - AI 原型生成 API（含设计系统风格匹配）

const express = require('express');
const router = express.Router();
const db = require('../db/connector');

// 设计系统风格模板（Mock——实际应存在数据库中）
const styleTemplates = {
  '1': { // 企业后台设计系统
    name: '企业后台设计系统',
    primaryColor: '#5B5EF4',
    secondaryColor: '#22C55E',
    fontFamily: 'PingFang SC, sans-serif',
    borderRadius: '8px',
    buttonStyle: 'rounded',
    cardStyle: 'shadow',
    sidebarStyle: 'dark',
    tableStyle: 'striped'
  },
  '2': { // 移动端组件库
    name: '移动端组件库',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    fontFamily: 'PingFang SC, sans-serif',
    borderRadius: '16px',
    buttonStyle: 'full-width',
    cardStyle: 'flat',
    sidebarStyle: 'bottom-tab',
    tableStyle: 'mobile-list'
  },
  '3': { // 营销页面组件
    name: '营销页面组件',
    primaryColor: '#8B5CF6',
    secondaryColor: '#06B6D4',
    fontFamily: 'PingFang SC, sans-serif',
    borderRadius: '12px',
    buttonStyle: 'gradient',
    cardStyle: 'colorful',
    sidebarStyle: 'minimal',
    tableStyle: 'card'
  }
};

// 根据提示词和设计系统生成原型（Mock 实现）
function mockGeneratePrototype(prompt, designSystemId) {
  var style = styleTemplates[designSystemId] || styleTemplates['1'];
  var timestamp = Date.now();

  // 根据提示词推断页面类型
  var pageType = 'dashboard';
  var lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.indexOf('登录') !== -1 || lowerPrompt.indexOf('login') !== -1) pageType = 'login';
  else if (lowerPrompt.indexOf('列表') !== -1 || lowerPrompt.indexOf('list') !== -1) pageType = 'list';
  else if (lowerPrompt.indexOf('表单') !== -1 || lowerPrompt.indexOf('form') !== -1) pageType = 'form';
  else if (lowerPrompt.indexOf('详情') !== -1 || lowerPrompt.indexOf('detail') !== -1) pageType = 'detail';
  else if (lowerPrompt.indexOf('设置') !== -1 || lowerPrompt.indexOf('setting') !== -1) pageType = 'settings';

  var pages = [];

  if (pageType === 'dashboard') {
    pages = [
      { name: '数据看板', type: 'dashboard', widgets: ['stat-cards', 'chart', 'table', 'calendar'] },
      { name: '数据列表', type: 'list', widgets: ['filters', 'table', 'pagination'] },
      { name: '详情页', type: 'detail', widgets: ['header', 'info-card', 'related-table'] }
    ];
  } else if (pageType === 'login') {
    pages = [
      { name: '登录页', type: 'login', widgets: ['logo', 'username-input', 'password-input', 'login-btn', 'footer'] }
    ];
  } else if (pageType === 'list') {
    pages = [
      { name: '列表页', type: 'list', widgets: ['search-bar', 'filters', 'table', 'pagination', 'actions'] }
    ];
  } else if (pageType === 'form') {
    pages = [
      { name: '表单页', type: 'form', widgets: ['title', 'form-fields', 'upload', 'submit-btn'] }
    ];
  } else if (pageType === 'settings') {
    pages = [
      { name: '设置页', type: 'settings', widgets: ['nav-tabs', 'profile-section', 'security-section', 'notification-section'] }
    ];
  } else {
    pages = [
      { name: '主页', type: 'page', widgets: ['header', 'content', 'footer'] }
    ];
  }

  // 生成 HTML/CSS 代码
  var generatedHTML = generateMockHTML(pages, style, prompt);
  var generatedCSS = generateMockCSS(style);

  return {
    success: true,
    data: {
      id: 'ai-' + timestamp,
      prompt: prompt,
      designSystemId: designSystemId,
      designSystemName: style.name,
      style: style,
      pages: pages,
      html: generatedHTML,
      css: generatedCSS,
      createdAt: new Date().toISOString()
    }
  };
}

function generateMockHTML(pages, style, prompt) {
  var primaryColor = style.primaryColor;
  var borderRadius = style.borderRadius;

  return '<!-- AI 生成原型: ' + escapeHTML(prompt) + ' -->\n' +
    '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n  <title>' + escapeHTML(prompt) + '</title>\n  <link rel="stylesheet" href="style.css"/>\n</head>\n<body>\n' +
    pages.map(function(p) {
      return '  <!-- ' + p.name + ' -->\n' +
        '  <div class="page page-' + p.type + '">\n' +
        '    <h1>' + p.name + '</h1>\n' +
        '    <div class="widgets">' + p.widgets.map(function(w) {
          return '\n      <div class="widget widget-' + w + '">' + w + '</div>';
        }).join('') + '\n    </div>\n' +
        '  </div>\n';
    }).join('\n') +
    '</body>\n</html>';
}

function generateMockCSS(style) {
  return '/* AI 生成样式 - 基于: ' + style.name + ' */\n' +
    ':root {\n' +
    '  --primary: ' + style.primaryColor + ';\n' +
    '  --secondary: ' + style.secondaryColor + ';\n' +
    '  --font-family: ' + style.fontFamily + ';\n' +
    '  --border-radius: ' + style.borderRadius + ';\n' +
    '}\n\n' +
    'body {\n' +
    '  font-family: var(--font-family);\n' +
    '  margin: 0; padding: 20px;\n' +
    '  background: #f5f7fa;\n' +
    '}\n\n' +
    '.page { max-width: 1200px; margin: 0 auto 40px; background: #fff; border-radius: var(--border-radius); padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }\n' +
    '.page h1 { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #1a1d2e; }\n' +
    '.widgets { display: flex; flex-direction: column; gap: 12px; }\n' +
    '.widget { padding: 12px 16px; background: #f5f7fa; border-radius: 8px; font-size: 14px; color: #666; border: 1px dashed #ddd; }\n' +
    '.btn-primary { background: var(--primary); color: #fff; border: none; padding: 10px 20px; border-radius: var(--border-radius); cursor: pointer; font-size: 14px; }\n';
}

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== API 路由 =====

// POST /api/ai/generate - AI 生成原型
router.post('/generate', async (req, res) => {
  try {
    var prompt = (req.body.prompt || '').trim();
    var designSystemId = req.body.designSystemId || '1';

    if (!prompt) {
      return res.status(400).json({ success: false, error: '请输入生成描述' });
    }

    // 模拟 AI 处理延迟（1-3秒）
    var delay = 1000 + Math.random() * 2000;
    await new Promise(function(r) { setTimeout(r, 500); }); // 快速返回，实际应异步处理

    var result = mockGeneratePrototype(prompt, designSystemId);

    res.json(result);
  } catch (err) {
    console.error('AI generate error:', err);
    res.status(500).json({ success: false, error: '生成失败: ' + err.message });
  }
});

// GET /api/ai/design-systems - 获取所有设计系统（供 AI 生成时选择）
router.get('/design-systems', async (req, res) => {
  try {
    // 从数据库获取设计系统列表
    var result = await db.all(
      'SELECT id, name, description, component_count as "componentCount", color_count as "colorCount", created_at as "createdAt" FROM design_systems ORDER BY created_at DESC'
    );

    // 如果数据库中没有，返回默认的
    if (!result || result.length === 0) {
      result = [
        { id: '1', name: '企业后台设计系统', description: '包含按钮、表单、表格等基础组件', componentCount: 48, colorCount: 12 },
        { id: '2', name: '移动端组件库', description: '适用于移动端 App 的组件设计', componentCount: 32, colorCount: 8 },
        { id: '3', name: '营销页面组件', description: '落地页、活动页常用组件', componentCount: 24, colorCount: 6 }
      ];
    }

    res.json({ success: true, data: result });
  } catch (err) {
    // 出错时返回默认数据
    res.json({ success: true, data: [
      { id: '1', name: '企业后台设计系统', description: '包含按钮、表单、表格等基础组件', componentCount: 48, colorCount: 12 },
      { id: '2', name: '移动端组件库', description: '适用于移动端 App 的组件设计', componentCount: 32, colorCount: 8 },
      { id: '3', name: '营销页面组件', description: '落地页、活动页常用组件', componentCount: 24, colorCount: 6 }
    ]});
  }
});

// POST /api/ai/save-result - 保存 AI 生成结果到项目
router.post('/save-result', async (req, res) => {
  try {
    var userId = req.user.userId;
    var projectId = req.body.projectId;
    var resultData = req.body.resultData;

    if (!projectId || !resultData) {
      return res.status(400).json({ success: false, error: '参数不完整' });
    }

    // 这里可以将 AI 生成结果保存到项目的 pages_json 字段
    // 或者创建一个新的项目记录
    // Mock: 直接返回成功
    res.json({
      success: true,
      data: {
        id: 'proj-' + Date.now(),
        message: '原型已保存到项目',
        resultData: resultData
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: '保存失败: ' + err.message });
  }
});

module.exports = router;
