// pages/ai-generate.js - AI 生成工作台
// 左侧：对话 + 组件库选择；右侧：真实 iframe 预览

var aiGenMessages = [];
var aiGenLibraries = [];
var aiGenCurrentHTML = '';
var aiGenSelectedLibraryId = '';
var aiGenIsLoading = false;

function aiEscape(value) {
  if (typeof escapeHTML === 'function') return escapeHTML(value == null ? '' : String(value));
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAIGeneratePage() {
  var mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  if (typeof restoreHeaderDefault === 'function') restoreHeaderDefault();

  aiGenMessages = [{
    type: 'bot',
    text: '告诉我你想生成什么页面。我会优先引用左侧选中的组件库、Token、字体和组件规范，并在右侧生成可预览的原型。'
  }];
  aiGenCurrentHTML = renderEmptyPreview();

  mainContent.innerHTML =
    '<div class="ai-gen-page ai-chat-workbench">' +
      '<section class="ai-gen-left">' +
        '<div class="ai-gen-header">' +
          '<h3>AI 生成</h3>' +
          '<div class="ai-gen-ds-selector">' +
            '<label>引用组件库</label>' +
            '<select id="ai-gen-ds-select" onchange="aiGenChangeLibrary(this.value)">' +
              '<option value="">正在加载组件库...</option>' +
            '</select>' +
          '</div>' +
          '<div id="ai-gen-library-summary" class="ai-gen-library-summary">选择组件库后，会引用它的组件、字体、字号和 Token。</div>' +
        '</div>' +
        '<div class="ai-gen-messages" id="ai-gen-messages"></div>' +
        '<div class="ai-gen-quick-prompts">' +
          '<button onclick="aiGenUsePrompt(\'生成一个企业后台数据看板，包含统计卡片、趋势图和任务表格\')">后台看板</button>' +
          '<button onclick="aiGenUsePrompt(\'生成一个项目管理页面，包含任务列表、状态筛选和新建按钮\')">项目管理</button>' +
          '<button onclick="aiGenUsePrompt(\'生成一个登录页面，体现当前组件库的品牌风格\')">登录页</button>' +
        '</div>' +
        '<div class="ai-gen-input-area">' +
          '<textarea id="ai-gen-input" placeholder="例如：生成一个工作台首页，包含项目统计、最近原型、组件库使用情况..." onkeydown="aiGenHandleKeydown(event)"></textarea>' +
          '<button class="btn btn-primary ai-gen-send-btn" id="ai-gen-send-btn" onclick="aiGenSendMessage()" title="发送">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
          '</button>' +
        '</div>' +
      '</section>' +
      '<section class="ai-gen-right">' +
        '<div class="ai-gen-preview-header">' +
          '<span id="ai-gen-preview-title">预览：等待生成</span>' +
          '<button class="ai-gen-refresh-btn" onclick="aiGenRefreshPreview()" title="刷新预览">↻</button>' +
        '</div>' +
        '<iframe id="ai-gen-preview" class="ai-gen-preview-frame" title="AI 生成预览"></iframe>' +
      '</section>' +
    '</div>';

  renderAIMessages();
  updatePreview(aiGenCurrentHTML);
  loadAIGenerateLibraries();
}

function loadAIGenerateLibraries() {
  fetch('/api/framo/libraries', { cache: 'no-store' })
    .then(function(res) { return res.json(); })
    .then(function(list) {
      aiGenLibraries = Array.isArray(list) ? list : [];
      window.designSystems = aiGenLibraries;
      renderLibrarySelect();
    })
    .catch(function(err) {
      console.error('AI libraries load failed:', err);
      aiGenLibraries = window.designSystems || [];
      renderLibrarySelect();
      addAIMessage('bot', '组件库加载失败，暂时使用默认 Token 生成。');
    });
}

function renderLibrarySelect() {
  var select = document.getElementById('ai-gen-ds-select');
  if (!select) return;
  if (!aiGenLibraries.length) {
    select.innerHTML = '<option value="">无可用组件库</option>';
    updateLibrarySummary(null);
    return;
  }
  var preferred = aiGenSelectedLibraryId || (aiGenLibraries.find(function(item) { return item.sourceType === 'sketch'; }) || aiGenLibraries[0]).id;
  aiGenSelectedLibraryId = preferred;
  select.innerHTML = aiGenLibraries.map(function(lib) {
    var stats = lib.stats || {};
    var label = lib.name + ' · ' + (stats.components || (lib.components || []).length || 0) + '组件 / ' + (stats.icons || (lib.assets && lib.assets.icons ? lib.assets.icons.length : 0) || 0) + '图标';
    return '<option value="' + aiEscape(lib.id) + '"' + (lib.id === preferred ? ' selected' : '') + '>' + aiEscape(label) + '</option>';
  }).join('');
  updateLibrarySummary(getSelectedLibrary());
}

function aiGenChangeLibrary(id) {
  aiGenSelectedLibraryId = id || '';
  updateLibrarySummary(getSelectedLibrary());
}

function getSelectedLibrary() {
  for (var i = 0; i < aiGenLibraries.length; i++) {
    if (aiGenLibraries[i].id === aiGenSelectedLibraryId) return aiGenLibraries[i];
  }
  return null;
}

function updateLibrarySummary(lib) {
  var el = document.getElementById('ai-gen-library-summary');
  if (!el) return;
  if (!lib) {
    el.innerHTML = '未选择组件库，将使用默认 Flowa 组件协议生成。';
    return;
  }
  var stats = lib.stats || {};
  var fonts = lib.assets && lib.assets.fonts ? lib.assets.fonts.length : (lib.fonts || []).length;
  var sizes = lib.assets && lib.assets.fontSizes ? lib.assets.fontSizes.length : (lib.sizes || []).length;
  el.innerHTML =
    '<strong>' + aiEscape(lib.name) + '</strong>' +
    '<span>' + (stats.components || (lib.components || []).length || 0) + ' 组件</span>' +
    '<span>' + (stats.icons || (lib.assets && lib.assets.icons ? lib.assets.icons.length : 0) || 0) + ' 图标</span>' +
    '<span>' + fonts + ' 字体</span>' +
    '<span>' + sizes + ' 字号</span>';
}

function addAIMessage(type, text, payload) {
  aiGenMessages.push({ type: type, text: text, payload: payload || null });
  renderAIMessages();
}

function renderAIMessages() {
  var box = document.getElementById('ai-gen-messages');
  if (!box) return;
  box.innerHTML = aiGenMessages.map(function(msg) {
    var cls = msg.type === 'user' ? 'ai-gen-msg ai-gen-msg-user' : 'ai-gen-msg ai-gen-msg-bot';
    var avatar = msg.type === 'user' ? '<div class="ai-gen-msg-avatar">U</div>' : '<div class="ai-gen-msg-avatar">✦</div>';
    var extra = '';
    if (msg.payload && msg.payload.refs && msg.payload.refs.length) {
      extra += '<div class="ai-gen-comp-refs"><strong>引用组件</strong><div class="comp-refs-list">' + msg.payload.refs.map(function(ref) {
        return '<div class="comp-ref-item"><span class="comp-ref-role">' + aiEscape(ref.role) + '</span><strong>' + aiEscape(ref.component) + '</strong><small>' + aiEscape(ref.reason || '') + '</small></div>';
      }).join('') + '</div></div>';
    }
    if (msg.payload && msg.payload.tokens) {
      extra += '<div class="ai-gen-token-line">Token：' + aiEscape(msg.payload.tokens.colorPrimary || '#5B5EF4') + ' / ' + aiEscape(msg.payload.tokens.fontSizeBase || 14) + 'px / ' + aiEscape(msg.payload.tokens.borderRadius || '8px') + '</div>';
    }
    return '<div class="' + cls + '">' + avatar + '<div class="ai-gen-msg-content"><p>' + aiEscape(msg.text) + '</p>' + extra + '</div></div>';
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function aiGenHandleKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    aiGenSendMessage();
  }
}

function aiGenUsePrompt(text) {
  var input = document.getElementById('ai-gen-input');
  if (!input) return;
  input.value = text;
  input.focus();
}

function aiGenSetLoading(loading) {
  aiGenIsLoading = loading;
  var input = document.getElementById('ai-gen-input');
  var btn = document.getElementById('ai-gen-send-btn');
  if (input) input.disabled = loading;
  if (btn) btn.disabled = loading;
}

function aiGenSendMessage() {
  if (aiGenIsLoading) return;
  var input = document.getElementById('ai-gen-input');
  if (!input) return;
  var prompt = input.value.trim();
  if (!prompt) return;
  input.value = '';
  addAIMessage('user', prompt);
  addAIMessage('bot', '正在读取组件库规范并生成页面...');
  aiGenSetLoading(true);

  var library = getSelectedLibrary();
  fetch('/api/framo/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt, libraryId: library ? library.id : undefined })
  })
    .then(function(res) {
      return res.json().then(function(payload) {
        if (!res.ok || !payload.ok) throw new Error(payload.error || 'AI 生成失败');
        return payload;
      });
    })
    .then(function(payload) {
      // 后端返回 { ok: true, result: layout }
      // layout 包含 tokens, componentReferences, layout 等字段
      var result = payload.result || buildLocalLayout(prompt, library);
      var refs = result.componentReferences || [];
      aiGenMessages.pop();
      addAIMessage('bot', '已基于「' + (library ? library.name : '默认组件库') + '」生成页面，右侧可以直接预览。', {
        refs: refs,
        tokens: result.tokens || {}
      });
      aiGenCurrentHTML = renderGeneratedPreview(result, library, prompt);
      updatePreview(aiGenCurrentHTML);
      updatePreviewTitle(prompt, library);
    })
    .catch(function(err) {
      console.error(err);
      var fallback = buildLocalLayout(prompt, library);
      aiGenMessages.pop();
      addAIMessage('bot', '后端生成暂时不可用，已使用本地组件协议生成预览。', {
        refs: fallback.componentReferences || [],
        tokens: fallback.tokens || {}
      });
      aiGenCurrentHTML = renderGeneratedPreview(fallback, library, prompt);
      updatePreview(aiGenCurrentHTML);
      updatePreviewTitle(prompt, library);
    })
    .finally(function() {
      aiGenSetLoading(false);
      if (input) input.focus();
    });
}

function updatePreviewTitle(prompt, library) {
  var el = document.getElementById('ai-gen-preview-title');
  if (!el) return;
  el.textContent = '预览：' + prompt.slice(0, 24) + (prompt.length > 24 ? '…' : '') + (library ? ' · ' + library.name : '');
}

function buildLocalLayout(prompt, library) {
  var tokens = normalizePreviewTokens(library);
  var components = getLibraryComponents(library);
  var pick = function(pattern, fallback) {
    for (var i = 0; i < components.length; i++) {
      var name = components[i].fullName || components[i].name || components[i];
      if (pattern.test(name)) return name;
    }
    return fallback;
  };
  return {
    type: 'page',
    prompt: prompt,
    libraryId: library ? library.id : '',
    tokens: tokens,
    componentReferences: [
      { role: 'summary', component: pick(/Statistic|统计|Card|卡片/i, 'Statistic 数据统计'), reason: '展示关键指标' },
      { role: 'content', component: pick(/Table|表格|List|列表/i, 'Table 表格'), reason: '承载主数据' },
      { role: 'action', component: pick(/Button|按钮/i, 'Button 按钮'), reason: '提供操作入口' },
      { role: 'feedback', component: pick(/Message|Alert|Notify|提示|通知/i, 'Message 全局提示'), reason: '反馈操作状态' }
    ],
    layout: [{
      type: 'container',
      props: { title: inferPreviewTitle(prompt) },
      children: [
        { type: 'stats', items: [{ label: '项目数', value: '28', delta: '+12%' }, { label: '完成率', value: '86%', delta: '+8%' }, { label: '待处理', value: '14', delta: '-3%' }] },
        { type: 'panel', title: prompt, action: '新建', table: { columns: ['名称', '负责人', '状态', '更新时间'], rows: [['控制台首页', 'Ava', '已生成', '刚刚'], ['组件资产', 'Noah', '待确认', '12 分钟前'], ['业务页面', 'Mia', '设计中', '28 分钟前']] } }
      ]
    }]
  };
}

function normalizePreviewTokens(library) {
  var tokens = library && library.tokens ? library.tokens : {};
  var colors = library && library.assets && library.assets.colors ? library.assets.colors : [];
  var colorValue = function(item) { return typeof item === 'string' ? item : item && item.value; };
  return {
    colorPrimary: tokens.colorPrimary || colorValue(colors[0]) || '#5B5EF4',
    colorSurface: tokens.colorSurface || '#FFFFFF',
    borderRadius: tokens.borderRadius || '12px',
    fontSizeBase: tokens.fontSizeBase || 14,
    spacingBase: tokens.spacingBase || 8
  };
}

function getLibraryComponents(library) {
  if (!library) return [];
  if (library.assets && Array.isArray(library.assets.components)) return library.assets.components;
  return library.components || [];
}

function inferPreviewTitle(prompt) {
  if (/登录|login|signin/i.test(prompt)) return '登录到 Flowa';
  if (/项目|任务|协作/i.test(prompt)) return '项目协作工作台';
  if (/数据|看板|统计|分析/i.test(prompt)) return '数据分析总览';
  if (/组件|设计系统/i.test(prompt)) return '组件资产管理';
  return prompt.slice(0, 18) || '智能生成页面';
}

function renderGeneratedPreview(result, library, prompt) {
  // 如果后端返回了 HTML，直接渲染
  if (result && result.html) {
    return result.html;
  }
  
  var tokens = result.tokens || normalizePreviewTokens(library);
  var primary = tokens.colorPrimary || '#5B5EF4';
  var surface = tokens.colorSurface || '#FFFFFF';
  var radius = tokens.borderRadius || '12px';
  var fontSize = Number(tokens.fontSizeBase || 14);
  var title = result.layout && result.layout[0] && result.layout[0].props ? result.layout[0].props.title : inferPreviewTitle(prompt);
  var children = result.layout && result.layout[0] ? (result.layout[0].children || []) : [];
  var statsBlock = children.find(function(item) { return item.type === 'stats'; }) || { items: [] };
  var panel = children.find(function(item) { return item.type === 'panel'; }) || {};
  var refs = result.componentReferences || [];
  var family = getPreviewFontFamily(library);

  var html = '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '*{box-sizing:border-box}body{margin:0;background:#F5F7FB;color:#172033;font-family:' + family + ';font-size:' + fontSize + 'px}' +
    '.shell{min-height:100vh;padding:28px;background:linear-gradient(135deg,#F8FAFF,#EEF2FF)}' +
    '.hero{display:flex;justify-content:space-between;gap:24px;align-items:stretch;background:' + surface + ';border:1px solid rgba(15,23,42,.08);border-radius:' + radius + ';padding:28px;box-shadow:0 18px 48px rgba(15,23,42,.08)}' +
    '.eyebrow{letter-spacing:.16em;text-transform:uppercase;color:#94A3B8;font-size:12px;font-weight:700;margin-bottom:10px}.hero h1{margin:0 0 12px;font-size:30px;line-height:1.25}.hero p{margin:0;color:#64748B;line-height:1.8;max-width:720px}.brand{min-width:260px;border-radius:' + radius + ';background:linear-gradient(135deg,' + primary + ',#7C3AED);color:#fff;padding:24px;display:flex;flex-direction:column;justify-content:center}.brand small{opacity:.75}.brand strong{font-size:22px;margin-top:16px}' +
    '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0}.card{background:#fff;border:1px solid rgba(15,23,42,.08);border-radius:' + radius + ';padding:20px;box-shadow:0 12px 32px rgba(15,23,42,.06)}.card .label{color:#94A3B8;font-size:12px}.card .value{font-size:30px;color:' + primary + ';font-weight:800;margin-top:8px}.card .delta{color:#10B981;font-size:12px;margin-top:10px}' +
    '.main{display:grid;grid-template-columns:1.6fr .8fr;gap:20px}.panel h2,.refs h2{font-size:18px;margin:0 0 16px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #EEF2F7}th{color:#94A3B8;font-size:12px}.status{display:inline-flex;padding:4px 10px;border-radius:999px;background:' + primary + '14;color:' + primary + ';font-size:12px}.refs-list{display:flex;flex-direction:column;gap:10px}.ref{padding:12px;border:1px solid #EEF2F7;border-radius:12px}.ref span{font-size:11px;color:#94A3B8;text-transform:uppercase}.ref strong{display:block;margin-top:4px}.tokens{margin-top:14px;padding:12px;border-radius:12px;background:#0F172A;color:#C7D2FE;font-family:monospace;font-size:12px;white-space:pre-wrap}' +
    '@media(max-width:900px){.hero,.main{grid-template-columns:1fr;display:block}.brand{margin-top:16px}.stats{grid-template-columns:1fr}}' +
    '</style></head><body><div class="shell">';

  html += '<section class="hero"><div><div class="eyebrow">AI Generated Prototype</div><h1>' + aiEscape(title) + '</h1><p>根据你的需求生成，并引用「' + aiEscape(library ? library.name : '默认组件库') + '」中的组件、Token、字体与字号规范。</p></div><div class="brand"><small>Component Library</small><strong>' + aiEscape(library ? library.name : 'Flowa Default') + '</strong><small style="margin-top:10px">' + aiEscape(refs.length || 0) + ' referenced components</small></div></section>';

  html += '<section class="stats">' + (statsBlock.items || []).slice(0, 3).map(function(item) {
    return '<div class="card"><div class="label">' + aiEscape(item.label) + '</div><div class="value">' + aiEscape(item.value) + '</div><div class="delta">' + aiEscape(item.delta || '+0%') + '</div></div>';
  }).join('') + '</section>';

  var table = panel.table || { columns: ['名称', '负责人', '状态', '时间'], rows: [] };
  html += '<section class="main"><div class="card panel"><h2>' + aiEscape(panel.title || title) + '</h2><table><thead><tr>' + (table.columns || []).map(function(col) { return '<th>' + aiEscape(col) + '</th>'; }).join('') + '</tr></thead><tbody>' + (table.rows || []).map(function(row) {
    return '<tr>' + row.map(function(cell, idx) { return '<td>' + (idx === 2 ? '<span class="status">' + aiEscape(cell) + '</span>' : aiEscape(cell)) + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody></table></div>';

  html += '<aside class="card refs"><h2>引用组件</h2><div class="refs-list">' + refs.map(function(ref) {
    return '<div class="ref"><span>' + aiEscape(ref.role) + '</span><strong>' + aiEscape(ref.component) + '</strong><small>' + aiEscape(ref.reason || '') + '</small></div>';
  }).join('') + '</div><div class="tokens">' + aiEscape(JSON.stringify(tokens, null, 2)) + '</div></aside></section>';
  html += '</div></body></html>';
  return html;
}

function getPreviewFontFamily(library) {
  var fonts = library && library.assets ? (library.assets.fonts || []) : [];
  var family = fonts[0] && (fonts[0].family || fonts[0].name);
  return family ? "'" + String(family).replace(/'/g, '') + "', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
}

function renderEmptyPreview() {
  return '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#F7F8FC;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#64748B}.box{text-align:center}.icon{width:64px;height:64px;border-radius:18px;background:#EEF2FF;color:#5B5EF4;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px}h1{font-size:20px;color:#172033;margin:0 0 8px}p{margin:0;font-size:14px}</style></head><body><div class="box"><div class="icon">✦</div><h1>等待生成</h1><p>在左侧输入需求，选择组件库后开始生成。</p></div></body></html>';
}

function updatePreview(html) {
  aiGenCurrentHTML = html || aiGenCurrentHTML || renderEmptyPreview();
  var iframe = document.getElementById('ai-gen-preview');
  if (!iframe) return;
  iframe.srcdoc = aiGenCurrentHTML;
}

function aiGenRefreshPreview() {
  updatePreview(aiGenCurrentHTML || renderEmptyPreview());
}

window.renderAIGeneratePage = renderAIGeneratePage;
window.aiGenSendMessage = aiGenSendMessage;
window.aiGenHandleKeydown = aiGenHandleKeydown;
window.aiGenUsePrompt = aiGenUsePrompt;
window.aiGenChangeLibrary = aiGenChangeLibrary;
window.aiGenRefreshPreview = aiGenRefreshPreview;
