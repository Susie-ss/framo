// pages/library.js - 组件库（设计系统）页面

// ===== 组件库数据源 =====
var LS_KEY = 'framo_design_systems';

function loadDesignSystems() {
  // 不再读取 localStorage。旧 UI 期间产生过错误解析数据，继续读取会污染真实解析结果。
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
  return [
    enrichWithDetailData({ id:'1', name:'企业后台设计系统', description:'包含按钮、表单、表格等基础组件', componentCount:48, colorCount:12, createdAt:'2024-01-15', colors:['#5B5EF4','#22C55E','#F59E0B','#EF4444','#8B5CF6'] }, 1),
    { id:'2', name:'移动端组件库', description:'适用于移动端 App 的组件设计', componentCount:32, colorCount:8, createdAt:'2024-02-20', colors:['#3B82F6','#10B981','#F59E0B','#EC4899'], source:null,
      icons: generateIconSet('mobile', 28), fonts: generateFontSet('mobile', 3), components: generateComponentSet('mobile', 14), sizes: generateSizeSet('mobile', 9) },
    { id:'3', name:'营销页面组件', description:'落地页、活动页常用组件', componentCount:24, colorCount:6, createdAt:'2024-03-10', colors:['#8B5CF6','#06B6D4','#F97316','#14B8A6'], source:null,
      icons: generateIconSet('marketing', 22), fonts: generateFontSet('marketing', 3), components: generateComponentSet('marketing', 12), sizes: generateSizeSet('marketing', 7) }
  ];
}

// 为企业后台设计系统生成完整数据（使用默认 mock 数据）
function enrichWithDetailData(ds, seed) {
  ds.source = null;
  ds.icons = generateIconSet('enterprise', 32);
  ds.fonts = generateFontSet('enterprise', 4);
  ds.components = generateComponentSet('enterprise', 16);
  ds.sizes = generateSizeSet('enterprise', 9);
  return ds;
}

function saveDesignSystems(list) {
  // 服务端 Framo 解析结果是唯一可信来源；保留空函数兼容重命名/删除旧调用。
}

var designSystems; // 初始化延迟到模板数据定义之后

// 解析阶段配置
var parseStages = [
  { label: '读取文件结构...', progress: 10 },
  { label: '解析图层信息...', progress: 25 },
  { label: '提取颜色变量...', progress: 45 },
  { label: '识别字体规范...', progress: 60 },
  { label: '提取图标资源...', progress: 75 },
  { label: '解析组件结构...', progress: 85 },
  { label: '生成组件库...', progress: 95 },
  { label: '完成', progress: 100 }
];

var SUPPORTED_FORMATS = ['.sketch'];

// ===== 主渲染函数 =====
function renderLibraryPage() {
  var mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  restoreHeaderDefault();
  mainContent.innerHTML = '<div class="library library-card-page"><div class="empty-state"><p>正在加载组件库...</p></div></div>';
  loadFramoLibrariesForMainUI().then(function(list) {
    if (list && list.length) {
      designSystems = list;
      window.designSystems = designSystems;
    }
    mainContent.innerHTML = renderLibraryHTML();
  }).catch(function(err) {
    console.error('Load Framo libraries failed:', err);
    mainContent.innerHTML = renderLibraryHTML();
    showToast('组件库加载失败，已显示本地默认数据', 'warning');
  });
}

function loadFramoLibrariesForMainUI() {
  return fetch('/api/framo/libraries', { cache: 'no-store' }).then(function(res) {
    return res.json().then(function(payload) {
      if (!res.ok || !Array.isArray(payload)) throw new Error('组件库接口异常');
      return payload.map(function(library) {
        return normalizeFramoLibraryForMainUI(library, null);
      });
    });
  });
}

function updateHeaderForLibrary() {
  // 新建组件库按钮已内嵌到 .library-header 中，此函数保留为空壳
}

function restoreHeaderDefault() {
  var headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  var libBtn = headerRight.querySelector('.library-new-btn');
  if (libBtn) libBtn.remove();

  // 恢复原有按钮
  var existingBtns = headerRight.querySelectorAll(':scope > *');
  existingBtns.forEach(function(btn) { btn.style.display = ''; });
}

function renderLibraryHTML() {
  var cardsHTML = designSystems.map(function(ds) {
    var iconCount = ds.icons ? ds.icons.length : 0;
    var fontCount = ds.fonts ? ds.fonts.length : 0;
    var compCount = ds.componentCount || (ds.components ? ds.components.length : 0);
    var colorCount = ds.colorCount || (ds.colors ? ds.colors.length : 0);
    var sourceText = ds.source ? '来源: ' + ds.source : '';
    var descText = ds.source
      ? ('从 ' + ds.source + ' 解析生成的组件库，包含 ' + iconCount + ' 图标、' + fontCount + ' 字体、' + compCount + ' 组件')
      : ds.description;

    return '<div class="ds-card library-asset-card" data-id="' + ds.id + '" onclick="openDSDetail(\'' + ds.id + '\')">' +
      '<div class="ds-card-actions" onclick="event.stopPropagation()">' +
        '<button class="ds-action-btn ds-rename-btn" title="重命名" onclick="renameDesignSystem(\'' + ds.id + '\')">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '</button>' +
        '<button class="ds-action-btn ds-delete-btn" title="删除" onclick="deleteDesignSystem(\'' + ds.id + '\')">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="ds-colors">' + ds.colors.map(function(c) {
        var hex = (typeof c === 'string') ? c : (c.value || '#CBD5E1');
        return '<span class="color-dot" style="background:' + hex + '"></span>';
      }).join('') + '</div>' +
      '<h3 class="ds-name">' + escapeHTML(ds.name) + '</h3>' +
      '<p class="ds-desc">' + escapeHTML(descText) + '</p>' +
      (sourceText ? '<p class="ds-source">' + escapeHTML(sourceText) + '</p>' : '') +
      '<div class="ds-meta">' +
        '<span>' + compCount + ' 组件</span>' +
        '<span>' + iconCount + ' 图标</span>' +
        '<span>' + fontCount + ' 字体</span>' +
        '<span>' + colorCount + ' 色值</span>' +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="library library-card-page">' +
    '<div class="library-header">' +
      '<div>' +
        '<h2>组件库</h2>' +
        '<p class="library-desc">管理你的设计系统和组件资产</p>' +
      '</div>' +
      '<button class="btn btn-primary library-new-btn" onclick="showNewLibraryModal()">' +
        '<svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-plus"/></svg> 新建组件库' +
      '</button>' +
    '</div>' +
    '<div class="design-systems-grid">' + (cardsHTML || '<div class="empty-state"><p>暂无组件库</p></div>') + '</div>' +
  '</div>';
}

// ===== 组件库卡片操作 =====
function openDSDetail(id) {
  navigateTo('library-detail', { id: id });
}

window.deleteDesignSystem = function(id) {
  // 使用自定义确认弹窗
  showConfirmDialog({
    title: '删除组件库',
    message: '确定要删除此组件库吗？此操作不可恢复。',
    confirmText: '确认删除',
    confirmClass: 'btn-danger',
    onConfirm: function() {
      var idx = -1;
      for (var i = 0; i < designSystems.length; i++) {
        if (designSystems[i].id === id) { idx = i; break; }
      }
      if (idx === -1) { showToast('未找到该组件库', 'error'); return; }

      var name = designSystems[idx].name;
      designSystems.splice(idx, 1);
      saveDesignSystems(designSystems);

      // 如果当前在详情页且删除的是当前查看的 DS，返回列表
      if (currentDS && currentDS.id === id) {
        navigateTo('library');
      } else {
        renderLibraryPage();
      }
      showToast('已删除组件库「' + name + '」', 'success');
    }
  });
};

window.renameDesignSystem = function(id) {
  var ds = null;
  for (var i = 0; i < designSystems.length; i++) {
    if (designSystems[i].id === id) { ds = designSystems[i]; break; }
  }
  if (!ds) { showToast('未找到该组件库', 'error'); return; }

  // 重命名弹窗
  var modalId = 'rename-library-modal';
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = modalId;
  overlay.innerHTML =
    '<div class="modal" style="max-width:400px" onclick="event.stopPropagation()">' +
      '<div class="modal-header">' +
        '<h3>重命名组件库</h3>' +
        '<button class="modal-close-btn" onclick="document.getElementById(\'' + modalId + '\').remove()">' +
          '<svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg>' +
        '</button>' +
      '</div>' +
      '<div style="padding:16px 20px">' +
        '<div class="form-row">' +
          '<label>名称</label>' +
          '<input type="text" id="rename-lib-input" value="' + escapeHTML(ds.name) + '" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;outline:none" />' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions" style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="btn btn-ghost" onclick="document.getElementById(\'' + modalId + '\').remove()">取消</button>' +
        '<button class="btn btn-primary" onclick="confirmRename(\'' + id + '\')">确认</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  setTimeout(function() {
    var inp = document.getElementById('rename-lib-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 100);
};

window.confirmRename = function(id) {
  var inp = document.getElementById('rename-lib-input');
  if (!inp) return;
  var newName = inp.value.trim();
  if (!newName) { showToast('名称不能为空', 'error'); return; }

  for (var i = 0; i < designSystems.length; i++) {
    if (designSystems[i].id === id) {
      designSystems[i].name = newName;
      saveDesignSystems(designSystems);
      // 刷新界面
      var modal = document.getElementById('rename-library-modal');
      if (modal) modal.remove();
      if (currentDS && currentDS.id === id) {
        // 在详情页，重新渲染详情
        renderDesignSystemDetail(id);
      } else {
        renderLibraryPage();
      }
      showToast('已重命名为「' + newName + '」', 'success');
      return;
    }
  }
  showToast('未找到该组件库', 'error');
};

// ===== 通用确认对话框 =====
window.showConfirmDialog = function(opts) {
  opts = opts || {};
  var title = opts.title || '确认';
  var message = opts.message || '确定要执行此操作吗？';
  var confirmText = opts.confirmText || '确认';
  var cancelText = opts.cancelText || '取消';
  var confirmClass = opts.confirmClass || 'btn-primary';
  var onConfirm = opts.onConfirm || function() {};
  var onCancel = opts.onCancel || function() {};

  var modalId = 'confirm-dialog-' + Date.now();
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = modalId;
  overlay.innerHTML =
    '<div class="modal" style="max-width:400px" onclick="event.stopPropagation()">' +
      '<div class="modal-header">' +
        '<h3>' + title + '</h3>' +
        '<button class="modal-close-btn" onclick="document.getElementById(\'' + modalId + '\').remove()">' +
          '<svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg>' +
        '</button>' +
      '</div>' +
      '<div style="padding:20px 20px 24px;font-size:14px;color:var(--text);line-height:1.6">' +
        message +
      '</div>' +
      '<div class="modal-actions" style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="btn btn-ghost" onclick="document.getElementById(\'' + modalId + '\').remove()">' + cancelText + '</button>' +
        '<button class="btn ' + confirmClass + '" id="confirm-dialog-btn">' + confirmText + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // 绑定确认事件
  setTimeout(function() {
    var btn = document.getElementById('confirm-dialog-btn');
    if (btn) {
      btn.onclick = function() {
        var m = document.getElementById(modalId);
        if (m) m.remove();
        onConfirm();
      };
    }
  }, 50);
};

// ===== 新建组件库弹窗 =====
function showNewLibraryModal() {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = 'new-library-modal';

  overlay.innerHTML =
    '<div class="modal library-create-modal" onclick="event.stopPropagation()">' +
      '<div class="modal-header library-create-header">' +
        '<div><div class="library-create-title">新建组件库</div></div>' +
        '<button class="modal-close-btn" onclick="document.getElementById(\'new-library-modal\').remove()">' +
          '<svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg>' +
        '</button>' +
      '</div>' +

      // Step 1: Upload
      '<div id="lib-step-upload" class="library-modal-step">' +
        '<div id="lib-upload-zone" class="upload-zone" ondragover="handleLibDragOver(event)" ondragleave="handleLibDragLeave(event)" ondrop="handleLibDrop(event)" onclick="document.getElementById(\'lib-file-input\').click()">' +
          '<svg class="upload-zone-icon" width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
          '<p class="upload-hint">拖拽或点击上传设计文件</p>' +
          '<p class="upload-formats">支持 Sketch (.sketch) 格式，使用 Framo 真实解析引擎</p>' +
        '</div>' +
        '<input type="file" id="lib-file-input" accept=".sketch" style="display:none" onchange="handleLibFileSelect(event)" />' +
        '<div id="lib-name-group" class="form-row library-name-group" style="display:none">' +
          '<label>组件库名称</label>' +
          '<input type="text" id="lib-name-input" placeholder="输入组件库名称" />' +
        '</div>' +
        '<div class="modal-actions library-modal-actions">' +
          '<button class="btn btn-ghost" onclick="document.getElementById(\'new-library-modal\').remove()">取消</button>' +
          '<button class="btn btn-primary" id="lib-start-parse-btn" disabled onclick="startLibraryParse()">开始解析</button>' +
        '</div>' +
      '</div>' +

      // Step 2: Parsing (hidden initially)
      '<div id="lib-step-parsing" class="library-modal-step" style="display:none">' +
        '<div class="parse-progress-section">' +
          '<div class="parse-file-name" id="lib-parse-filename"></div>' +
          '<div class="parse-progress-bar"><div class="parse-progress-fill" id="lib-progress-fill" style="width:0%"></div></div>' +
          '<div class="parse-stages" id="lib-parse-stages"></div>' +
        '</div>' +
      '</div>' +

      // Step 3: Done / Result (hidden initially)
      '<div id="lib-step-done" class="library-modal-step" style="display:none">' +
        '<div class="parse-success">' +
          '<div class="parse-success-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg></div>' +
          '<h4>解析完成</h4>' +
          '<p style="font-size:13px;color:var(--text-muted)">已从设计文件中提取以下资源：</p>' +
        '</div>' +
        '<div class="parse-result-stats" id="lib-parse-stats"></div>' +
        '<div class="parse-result-colors" id="lib-parse-colors" style="display:none"></div>' +
        '<div class="modal-actions library-modal-actions">' +
          '<button class="btn btn-ghost" onclick="document.getElementById(\'new-library-modal\').remove()">取消</button>' +
          '<button class="btn btn-primary" id="lib-confirm-create-btn" onclick="confirmCreateLibrary()">确认创建</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  // 初始化解析阶段 UI
  initParseStagesUI();
}

// 解析阶段 UI 初始化
function initParseStagesUI() {
  var container = document.getElementById('lib-parse-stages');
  if (!container) return;
  container.innerHTML = parseStages.map(function(s, i) {
    return '<div class="parse-stage-item" id="lib-ps-' + i + '">' +
      '<span class="parse-stage-dot"><span class="dot"></span></span>' +
      '<span class="parse-stage-label">' + s.label + '</span>' +
    '</div>';
  }).join('');
}

// ===== 文件上传处理 =====
window.libSelectedFile = null;

window.handleLibDragOver = function(e) {
  e.preventDefault();
  var zone = document.getElementById('lib-upload-zone');
  if (zone) zone.classList.add('drag-over');
};

window.handleLibDragLeave = function(e) {
  e.preventDefault();
  var zone = document.getElementById('lib-upload-zone');
  if (zone) zone.classList.remove('drag-over');
};

window.handleLibDrop = function(e) {
  e.preventDefault();
  var zone = document.getElementById('lib-upload-zone');
  if (zone) zone.classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file) selectLibFile(file);
};

window.handleLibFileSelect = function(e) {
  var file = e.target.files[0];
  if (file) selectLibFile(file);
};

function selectLibFile(file) {
  // 验证格式
  var ext = '.' + file.name.split('.').pop().toLowerCase();
  if (SUPPORTED_FORMATS.indexOf(ext) === -1) {
    showToast('不支持的文件格式，请上传 .sketch 文件', 'error');
    return;
  }

  window.libSelectedFile = file;

  // 更新 UI 显示已选文件
  var zone = document.getElementById('lib-upload-zone');
  var nameGroup = document.getElementById('lib-name-group');
  var startBtn = document.getElementById('lib-start-parse-btn');

  if (zone) {
    zone.className = 'upload-zone has-file';
    zone.innerHTML = '<div class="upload-file-info">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13,2 13,9 20,9"/></svg>' +
      '<div class="upload-file-detail">' +
        '<span class="upload-file-name">' + escapeHTML(file.name) + '</span>' +
        '<span class="upload-file-size">' + formatFileSize(file.size) + '</span>' +
      '</div>' +
      '<button class="upload-remove" onclick="event.stopPropagation();clearLibSelectedFile()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
    '</div>';
  }

  // 显示名称输入框
  if (nameGroup) {
    nameGroup.style.display = '';
    var nameInput = document.getElementById('lib-name-input');
    if (nameInput) nameInput.value = file.name.replace(/\.(sketch|psd|rp)$/i, '');
  }

  // 启用开始解析按钮
  if (startBtn) startBtn.disabled = false;
}

window.clearLibSelectedFile = function() {
  window.libSelectedFile = null;

  var zone = document.getElementById('lib-upload-zone');
  var nameGroup = document.getElementById('lib-name-group');
  var startBtn = document.getElementById('lib-start-parse-btn');

  if (zone) {
    zone.className = 'upload-zone';
    zone.innerHTML =
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      '<p class="upload-hint">拖拽或点击上传设计文件</p>' +
      '<p class="upload-formats">支持 Sketch (.sketch) 格式，使用 Framo 真实解析引擎</p>';
    zone.ondragover = handleLibDragOver;
    zone.ondragleave = handleLibDragLeave;
    zone.ondrop = handleLibDrop;
    zone.onclick = function() { document.getElementById('lib-file-input').click(); };
  }
  if (nameGroup) nameGroup.style.display = 'none';
  if (startBtn) startBtn.disabled = true;

  // 重置文件 input
  var fileInput = document.getElementById('lib-file-input');
  if (fileInput) fileInput.value = '';
};

// ===== 基于种子生成差异化数据 =====
// 全量图标池（扩充至 120+ 个，覆盖更多 UI 场景）
var FULL_ICON_POOL = [
  // 导航
  { name: 'home', label: '首页', type: 'line' }, { name: 'search', label: '搜索', type: 'line' },
  { name: 'menu', label: '菜单', type: 'line' }, { name: 'more-h', label: '更多(横)', type: 'solid' },
  { name: 'more-v', label: '更多(竖)', type: 'solid' }, { name: 'back', label: '返回', type: 'line' },
  { name: 'forward', label: '前进', type: 'line' }, { name: 'up-down', label: '上下展开', type: 'line' },
  { name: 'chevron-up', label: '上三角', type: 'line' }, { name: 'chevron-down', label: '下三角', type: 'line' },
  { name: 'chevron-left', label: '左三角', type: 'line' }, { name: 'chevron-right', label: '右三角', type: 'line' },
  { name: 'arrow-up', label: '上箭头', type: 'line' }, { name: 'arrow-down', label: '下箭头', type: 'line' },
  { name: 'arrow-left', label: '左箭头', type: 'line' }, { name: 'arrow-right', label: '右箭头', type: 'line' },
  // 用户 & 账户
  { name: 'user', label: '用户', type: 'line' }, { name: 'users', label: '用户组', type: 'line' },
  { name: 'user-plus', label: '添加用户', type: 'line' }, { name: 'user-check', label: '用户已确认', type: 'line' },
  { name: 'user-x', label: '移除用户', type: 'line' }, { name: 'user-circle', label: '用户头像', type: 'solid' },
  { name: 'profile', label: '个人资料', type: 'line' }, { name: 'avatar', label: '头像', type: 'solid' },
  // 操作
  { name: 'settings', label: '设置', type: 'solid' }, { name: 'edit', label: '编辑', type: 'solid' },
  { name: 'delete', label: '删除', type: 'line' }, { name: 'trash', label: '回收站', type: 'line' },
  { name: 'plus', label: '添加', type: 'solid' }, { name: 'minus', label: '减少', type: 'solid' },
  { name: 'check', label: '确认', type: 'solid' }, { name: 'close', label: '关闭', type: 'solid' },
  { name: 'cancel', label: '取消', type: 'line' }, { name: 'save', label: '保存', type: 'solid' },
  { name: 'copy', label: '复制', type: 'line' }, { name: 'paste', label: '粘贴', type: 'line' },
  { name: 'cut', label: '剪切', type: 'line' }, { name: 'undo', label: '撤销', type: 'line' },
  { name: 'redo', label: '重做', type: 'line' }, { name: 'reset', label: '重置', type: 'line' },
  { name: 'refresh', label: '刷新', type: 'line' }, { name: 'sync', label: '同步', type: 'line' },
  { name: 'export', label: '导出', type: 'line' }, { name: 'import', label: '导入', type: 'line' },
  { name: 'upload', label: '上传', type: 'line' }, { name: 'download', label: '下载', type: 'line' },
  // 通知 & 消息
  { name: 'bell', label: '通知', type: 'line' }, { name: 'bell-off', label: '静音', type: 'line' },
  { name: 'mail', label: '邮件', type: 'line' }, { name: 'mail-open', label: '已读邮件', type: 'line' },
  { name: 'send', label: '发送', type: 'solid' }, { name: 'reply', label: '回复', type: 'line' },
  { name: 'forward-msg', label: '转发', type: 'line' }, { name: 'inbox', label: '收件箱', type: 'line' },
  { name: 'message', label: '消息', type: 'line' }, { name: 'message-square', label: '对话', type: 'line' },
  { name: 'comment', label: '评论', type: 'line' }, { name: 'chat', label: '聊天', type: 'solid' },
  // 文件 & 媒体
  { name: 'file', label: '文件', type: 'line' }, { name: 'file-text', label: '文档', type: 'line' },
  { name: 'file-image', label: '图片文件', type: 'line' }, { name: 'file-video', label: '视频文件', type: 'line' },
  { name: 'folder', label: '文件夹', type: 'line' }, { name: 'folder-open', label: '打开文件夹', type: 'line' },
  { name: 'image', label: '图片', type: 'line' }, { name: 'images', label: '多图', type: 'line' },
  { name: 'camera', label: '相机', type: 'line' }, { name: 'video', label: '视频', type: 'solid' },
  { name: 'mic', label: '麦克风', type: 'line' }, { name: 'mic-off', label: '静音麦克风', type: 'line' },
  { name: 'music', label: '音乐', type: 'line' }, { name: 'headphones', label: '耳机', type: 'solid' },
  // 数据 & 图表
  { name: 'chart-bar', label: '柱状图', type: 'line' }, { name: 'chart-line', label: '折线图', type: 'line' },
  { name: 'chart-pie', label: '饼图', type: 'solid' }, { name: 'chart-area', label: '面积图', type: 'line' },
  { name: 'trending-up', label: '上升趋势', type: 'line' }, { name: 'trending-down', label: '下降趋势', type: 'line' },
  { name: 'activity', label: '活动', type: 'line' }, { name: 'bar-chart', label: '条形图', type: 'line' },
  { name: 'data', label: '数据', type: 'line' }, { name: 'database', label: '数据库', type: 'line' },
  { name: 'table', label: '表格', type: 'line' }, { name: 'grid', label: '网格', type: 'line' },
  { name: 'list', label: '列表', type: 'line' }, { name: 'kanban', label: '看板', type: 'line' },
  // 布局 & 界面
  { name: 'layout', label: '布局', type: 'line' }, { name: 'columns', label: '分栏', type: 'line' },
  { name: 'sidebar', label: '侧边栏', type: 'line' }, { name: 'panel', label: '面板', type: 'line' },
  { name: 'dock', label: '停靠', type: 'line' }, { name: 'window', label: '窗口', type: 'line' },
  { name: 'fullscreen', label: '全屏', type: 'line' }, { name: 'minimize', label: '最小化', type: 'line' },
  { name: 'maximize', label: '最大化', type: 'line' }, { name: 'code', label: '代码', type: 'line' },
  { name: 'terminal', label: '终端', type: 'solid' }, { name: 'command', label: '命令', type: 'line' },
  // 表单 & 输入
  { name: 'input', label: '输入框', type: 'line' }, { name: 'check-square', label: '复选框-选中', type: 'solid' },
  { name: 'square', label: '复选框-未选', type: 'line' }, { name: 'radio', label: '单选框-选中', type: 'solid' },
  { name: 'circle', label: '单选框-未选', type: 'line' }, { name: 'toggle-l', label: '开关-左', type: 'line' },
  { name: 'toggle-r', label: '开关-右', type: 'solid' }, { name: 'slider', label: '滑块', type: 'line' },
  { name: 'switch', label: '切换', type: 'line' }, { name: 'calendar', label: '日历', type: 'line' },
  { name: 'date', label: '日期', type: 'line' }, { name: 'time', label: '时间', type: 'line' },
  // 状态 & 反馈
  { name: 'heart', label: '收藏', type: 'solid' }, { name: 'star', label: '星标', type: 'solid' },
  { name: 'bookmark', label: '书签', type: 'solid' }, { name: 'flag', label: '旗帜', type: 'line' },
  { name: 'tag', label: '标签', type: 'line' }, { name: 'label', label: '标签(圆角)', type: 'solid' },
  { name: 'info', label: '信息', type: 'line' }, { name: 'alert', label: '警告', type: 'solid' },
  { name: 'alert-triangle', label: '三角警告', type: 'line' }, { name: 'help-circle', label: '帮助', type: 'line' },
  { name: 'question', label: '疑问', type: 'solid' }, { name: 'shield', label: '安全盾牌', type: 'line' },
  { name: 'lock', label: '锁定', type: 'solid' }, { name: 'unlock', label: '解锁', type: 'line' },
  { name: 'eye', label: '查看', type: 'line' }, { name: 'eye-off', label: '隐藏', type: 'line' },
  // 连接 & 分享
  { name: 'share', label: '分享', type: 'line' }, { name: 'share-2', label: '分享(节点)', type: 'line' },
  { name: 'link', label: '链接', type: 'line' }, { name: 'link-2', label: '链接(链节)', type: 'line' },
  { name: 'external-link', label: '外链', type: 'line' }, { name: 'qrcode', label: '二维码', type: 'solid' },
  // 工具 & 辅助
  { name: 'filter', label: '筛选', type: 'line' }, { name: 'sort', label: '排序', type: 'line' },
  { name: 'search-plus', label: '放大', type: 'line' }, { name: 'search-minus', label: '缩小', type: 'line' },
  { name: 'zoom-in', label: '放大镜+', type: 'line' }, { name: 'zoom-out', label: '放大镜-', type: 'line' },
  { name: 'target', label: '定位', type: 'line' }, { name: 'compass', label: '指南针', type: 'line' },
  { name: 'map', label: '地图', type: 'line' }, { name: 'map-pin', label: '地图标记', type: 'solid' },
  { name: 'location', label: '位置', type: 'line' }, { name: 'globe', label: '地球', type: 'line' },
  // 杂项
  { name: 'zap', label: '闪电', type: 'solid' }, { name: 'gift', label: '礼物', type: 'line' },
  { name: 'award', label: '奖项', type: 'solid' }, { name: 'crown', label: '皇冠', type: 'solid' },
  { name: 'fire', label: '热门', type: 'solid' }, { name: 'sun', label: '日间模式', type: 'line' },
  { name: 'moon', label: '夜间模式', type: 'solid' }, { name: 'cloud', label: '云', type: 'line' },
  { name: 'printer', label: '打印', type: 'line' }, { name: 'phone', label: '手机', type: 'line' },
  { name: 'tablet', label: '平板', type: 'line' }, { name: 'monitor', label: '显示器', type: 'line' },
  { name: 'watch', label: '手表', type: 'line' }, { name: 'battery', label: '电量', type: 'line' },
  { name: 'wifi', label: 'WiFi', type: 'line' }, { name: 'bluetooth', label: '蓝牙', type: 'line' },
  { name: 'credit-card', label: '信用卡', type: 'line' }, { name: 'wallet', label: '钱包', type: 'line' },
  { name: 'shopping-cart', label: '购物车', type: 'line' }, { name: 'shopping-bag', label: '购物袋', type: 'solid' },
  { name: 'coffee', label: '咖啡', type: 'line' }, { name: 'clock', label: '时钟', type: 'line' },
  { name: 'alarm', label: '闹钟', type: 'line' }, { name: 'timer', label: '计时器', type: 'line' },
  // 项目管理 & 研发 (Worktile/PingCode 扩展)
  { name: 'agile', label: '敏捷', type: 'line' }, { name: 'dashboard', label: '仪表盘', type: 'line' },
  { name: 'project', label: '项目', type: 'line' }, { name: 'task', label: '任务', type: 'line' },
  { name: 'sprint', label: '迭代', type: 'line' }, { name: 'epic', label: '史诗', type: 'line' },
  { name: 'user-story', label: '用户故事', type: 'line' },
  { name: 'milestone', label: '里程碑', type: 'line' }, { name: 'release', label: '发布', type: 'line' },
  { name: 'gantt', label: '甘特图', type: 'line' }, { name: 'backlog', label: '待办', type: 'line' },
  { name: 'bug', label: '缺陷', type: 'line' }, { name: 'issue', label: '问题', type: 'line' },
  { name: 'requirement', label: '需求', type: 'line' }, { name: 'test-case', label: '测试用例', type: 'line' },
  { name: 'test-plan', label: '测试计划', type: 'line' }, { name: 'testhub', label: '测试库', type: 'line' },
  { name: 'wiki', label: '知识库', type: 'line' }, { name: 'knowledge', label: '知识', type: 'line' },
  { name: 'document', label: '文档', type: 'line' }, { name: 'report', label: '报表', type: 'line' },
  { name: 'insight', label: '洞察', type: 'line' }, { name: 'worktile', label: 'Worktile', type: 'line' },
  { name: 'pingcode', label: 'PingCode', type: 'line' },
  { name: 'app-project', label: '项目应用', type: 'line' }, { name: 'app-task', label: '任务应用', type: 'line' },
  { name: 'app-testhub', label: '测试应用', type: 'line' }, { name: 'app-wiki', label: '知识应用', type: 'line' },
  { name: 'app-insight', label: '洞察应用', type: 'line' }, { name: 'app-report', label: '报表应用', type: 'line' },
  { name: 'app-calendar', label: '日历应用', type: 'line' }, { name: 'app-message', label: '消息应用', type: 'line' },
  { name: 'app-crm', label: 'CRM应用', type: 'line' }, { name: 'app-okr', label: 'OKR应用', type: 'line' },
  { name: 'app-approval', label: '审批应用', type: 'line' }, { name: 'app-agile', label: '敏捷应用', type: 'line' },
  { name: 'app-pipeline', label: '管道应用', type: 'line' }, { name: 'app-portal', label: '门户应用', type: 'line' },
  { name: 'app-drive', label: '云盘应用', type: 'line' }, { name: 'app-bulletin', label: '公告应用', type: 'line' },
  { name: 'app-leave', label: '请假应用', type: 'line' }, { name: 'app-tracking', label: '追踪应用', type: 'line' },
  { name: 'app-appraisal', label: '考核应用', type: 'line' }, { name: 'app-paid', label: '薪酬应用', type: 'line' },
  { name: 'app-events', label: '事件应用', type: 'line' },
  { name: 'goal', label: '目标', type: 'line' }, { name: 'objective', label: '目标(OKR)', type: 'line' },
  { name: 'key-result', label: '关键结果', type: 'line' }, { name: 'portfolio', label: '项目集', type: 'line' },
  { name: 'program', label: '项目群', type: 'line' }, { name: 'phase', label: '阶段', type: 'line' },
  { name: 'team', label: '团队', type: 'line' }, { name: 'department', label: '部门', type: 'line' },
  { name: 'organization', label: '组织', type: 'line' }, { name: 'capacity', label: '容量', type: 'line' },
  { name: 'workload', label: '工作量', type: 'line' }, { name: 'velocity', label: '速度', type: 'line' },
  { name: 'branch', label: '分支', type: 'line' }, { name: 'commit', label: '提交', type: 'line' },
  { name: 'pull-request', label: '合并请求', type: 'line' }, { name: 'build', label: '构建', type: 'line' },
  { name: 'deploy', label: '部署', type: 'line' }, { name: 'pipeline', label: '管道', type: 'line' },
  { name: 'book-open', label: '打开书籍', type: 'line' },
  { name: 'attachment', label: '附件', type: 'line' }, { name: 'mention', label: '提及', type: 'line' },
  { name: 'remind', label: '提醒', type: 'line' }, { name: 'archive', label: '归档', type: 'line' },
  { name: 'restore', label: '恢复', type: 'line' }, { name: 'merge', label: '合并', type: 'line' },
  { name: 'history', label: '历史', type: 'line' }, { name: 'version', label: '版本', type: 'line' },
  { name: 'template', label: '模板', type: 'line' }, { name: 'custom-field', label: '自定义字段', type: 'line' },
  { name: 'discussion', label: '讨论', type: 'line' }, { name: 'review', label: '评审', type: 'line' },
  { name: 'feedback', label: '反馈', type: 'line' }, { name: 'approval', label: '审批', type: 'line' },
  { name: 'process', label: '流程', type: 'line' }, { name: 'rule', label: '规则', type: 'line' },
  { name: 'automation', label: '自动化', type: 'line' }, { name: 'trigger', label: '触发器', type: 'line' },
  { name: 'condition', label: '条件', type: 'line' }, { name: 'action', label: '操作', type: 'line' },
  { name: 'formula', label: '公式', type: 'line' }, { name: 'calculation', label: '计算', type: 'line' },
  { name: 'aggregation', label: '聚合', type: 'line' }, { name: 'rollup', label: '汇总', type: 'line' },
  { name: 'briefcase', label: '公文包', type: 'line' },
  { name: 'headset', label: '耳麦', type: 'line' },
  { name: 'thumb-up', label: '赞', type: 'line' },
  { name: 'robot', label: '机器人', type: 'line' },
  { name: 'translate', label: '翻译', type: 'line' }, { name: 'language', label: '语言', type: 'line' },
  { name: 'italic', label: '斜体', type: 'line' }, { name: 'bold', label: '加粗', type: 'line' },
  { name: 'underline', label: '下划线', type: 'line' }, { name: 'strikethrough', label: '删除线', type: 'line' },
  { name: 'indent', label: '缩进', type: 'line' }, { name: 'outdent', label: '减少缩进', type: 'line' },
  { name: 'align-left', label: '左对齐', type: 'line' }, { name: 'align-center', label: '居中', type: 'line' },
  { name: 'align-right', label: '右对齐', type: 'line' }, { name: 'align-justify', label: '两端对齐', type: 'line' },
  { name: 'ordered-list', label: '有序列表', type: 'line' }, { name: 'bullet-list', label: '无序列表', type: 'line' },
  { name: 'blockquote', label: '引用', type: 'line' }, { name: 'code-block', label: '代码块', type: 'line' },
  { name: 'header', label: '标题', type: 'line' },
  { name: 'chart', label: '图表', type: 'line' },
  { name: 'angle-right', label: '右角度', type: 'line' },
  { name: 'angle-left', label: '左角度', type: 'line' },
  { name: 'angle-up', label: '上角度', type: 'line' },
  { name: 'angle-down', label: '下角度', type: 'line' },
  { name: 'drag', label: '拖拽', type: 'line' },
  { name: 'progress', label: '进度', type: 'line' }, { name: 'percentage', label: '百分比', type: 'line' },
  { name: 'safety', label: '安全', type: 'line' }, { name: 'secret', label: '密钥', type: 'line' },
  { name: 'security', label: '安全设置', type: 'line' },
  { name: 'android', label: 'Android', type: 'line' }, { name: 'apple', label: 'Apple', type: 'line' },
  { name: 'ios', label: 'iOS', type: 'line' }, { name: 'github', label: 'GitHub', type: 'line' },
  { name: 'jenkins', label: 'Jenkins', type: 'line' }, { name: 'docker', label: 'Docker', type: 'line' },
  { name: 'wechat', label: '微信', type: 'line' }, { name: 'wecom', label: '企业微信', type: 'line' },
  { name: 'airplane', label: '飞机', type: 'line' },
  { name: 'asterisk', label: '星号', type: 'line' },
  { name: 'caret-down', label: '下插入符', type: 'line' },
  { name: 'caret-left', label: '左插入符', type: 'line' },
  { name: 'caret-right', label: '右插入符', type: 'line' },
  { name: 'hourglass', label: '沙漏', type: 'line' },
  // Worktile/PingCode 专用图标扩展（来自 Sketch 文件）
  { name: 'ticket', label: '工单', type: 'line' },
  { name: 'backtop', label: '回到顶部', type: 'line' },
  { name: 'access', label: '访问权限', type: 'line' },
  { name: 'access-fill', label: '访问权限(面)', type: 'solid' },
  { name: 'exchange', label: '交换', type: 'line' },
  { name: 'disconnect', label: '断开连接', type: 'line' },
  { name: 'designated', label: '指派', type: 'line' },
  { name: 'reverse-selection', label: '反选', type: 'line' },
  { name: 'plus-circle', label: '加号圆', type: 'line' },
  { name: 'minus-square', label: '减号方', type: 'line' },
  { name: 'plus-square', label: '加号方', type: 'line' },
  { name: 'user-add', label: '添加用户', type: 'line' },
  { name: 'pushpin', label: '图钉', type: 'line' },
  { name: 'pushpin-slash', label: '取消图钉', type: 'line' },
  { name: 'rename', label: '重命名', type: 'line' },
  { name: 'favorite', label: '收藏', type: 'line' },
  { name: 'recyclebin', label: '回收站', type: 'line' },
  { name: 'mind-map', label: '思维导图', type: 'line' },
  { name: 'note-edit', label: '笔记编辑', type: 'line' },
  { name: 'cascade', label: '级联', type: 'line' },
  { name: 'publish', label: '发布', type: 'line' },
  { name: 'upgrade', label: '升级', type: 'line' },
  { name: 'library', label: '库', type: 'line' },
  { name: 'description', label: '描述', type: 'line' },
  { name: 'expand-arrows', label: '展开箭头', type: 'line' },
  { name: 'arrow-right-left', label: '左右箭头', type: 'line' },
  { name: 'bell-waiting', label: '通知待处理', type: 'line' },
  { name: 'task-board', label: '任务看板', type: 'line' },
  { name: 'children', label: '子节点', type: 'line' },
  { name: 'view-filter', label: '视图筛选', type: 'line' },
  { name: 'magic', label: '魔法', type: 'line' },
  { name: 'insert-below', label: '下方插入', type: 'line' },
  { name: 'wrench', label: '扳手', type: 'line' },
  { name: 'house-square', label: '房子方', type: 'line' },
  { name: 'share-remove', label: '取消分享', type: 'line' },
  { name: 'code-injection', label: '代码注入', type: 'line' },
  { name: 'comment-add', label: '添加评论', type: 'line' },
  { name: 'flow', label: '自动化流程', type: 'line' },
  { name: 'goals', label: '目标', type: 'line' },
  { name: 'ship', label: '产品发布', type: 'line' },
  { name: 'alarm-clock', label: '闹钟', type: 'line' },
  { name: 'application', label: '应用', type: 'line' },
  { name: 'application-add', label: '添加应用', type: 'line' },
  { name: 'applications', label: '应用列表', type: 'line' },
  { name: 'board', label: '看板', type: 'line' },
  { name: 'applet', label: '小程序', type: 'line' },
  { name: 'artifact', label: '制品', type: 'line' },
  { name: 'browser', label: '浏览器', type: 'line' },
  { name: 'computer', label: '电脑', type: 'line' },
  { name: 'contacts', label: '联系人', type: 'line' },
  { name: 'column', label: '列', type: 'line' },
  { name: 'formula', label: '公式', type: 'line' },
  { name: 'check-circle', label: '勾选圆', type: 'line' },
  { name: 'close-circle', label: '关闭圆', type: 'line' },
  { name: 'info-circle', label: '信息圆', type: 'line' },
  { name: 'arrow-down-circle', label: '下箭头圆', type: 'line' },
  { name: 'arrow-right-circle', label: '右箭头圆', type: 'line' },
  { name: 'angle-double-left', label: '双左角度', type: 'line' },
  { name: 'angle-double-right', label: '双右角度', type: 'line' },
  { name: 'angle-double-up', label: '双上角度', type: 'line' },
  { name: 'angle-double-down', label: '双下角度', type: 'line' },
  { name: 'caret-right-down', label: '右下插入符', type: 'line' },
  { name: 'arrow-right-up-square', label: '右上箭头方', type: 'line' },
  { name: 'arrow-right-down-square', label: '右下箭头方', type: 'line' },
  { name: 'arrow-right-up-circle', label: '右上箭头圆', type: 'line' },
  { name: 'click-tap', label: '点击', type: 'line' },
  { name: 'align-bottom', label: '底部对齐', type: 'line' },
  { name: 'align-middle', label: '中间对齐', type: 'line' },
  { name: 'align-top', label: '顶部对齐', type: 'line' },
  { name: 'audit', label: '审计', type: 'line' },
  { name: 'analytical-line', label: '分析线', type: 'line' },
  { name: 'axis-settings', label: '轴设置', type: 'line' },
  { name: 'arrow-symbol', label: '箭头符号', type: 'line' },
  { name: 'clock-circle', label: '时钟圆', type: 'line' },
  { name: 'above', label: '以上', type: 'line' },
  { name: 'below', label: '以下', type: 'line' },
  { name: 'baseline', label: '基线', type: 'line' },
  { name: 'auto-fill', label: '自动填充', type: 'line' },
  { name: 'smile-plus', label: '微笑加', type: 'line' },
  { name: 'file-more', label: '更多文件', type: 'line' },
  { name: 'move-to-list', label: '移至列表', type: 'line' },
  { name: 'move-out-list', label: '移出列表', type: 'line' },
  { name: 'more-vertical', label: '更多(竖点)', type: 'line' },
  { name: 'more-horizontal', label: '更多(横点)', type: 'line' },
  { name: 'notification', label: '通知', type: 'line' },
  { name: 'notification-off', label: '通知关闭', type: 'line' },
  { name: 'image-text', label: '图文', type: 'line' },
  { name: 'underline-pushpin', label: '下划线图钉', type: 'line' },
  { name: 'operation-record', label: '操作记录', type: 'line' },
  { name: 'implement', label: '实施', type: 'line' },
  { name: 'arithmetic', label: '算术', type: 'line' },
  { name: 'expand-text-field', label: '展开输入框', type: 'line' },
  { name: 'compress-arrows', label: '压缩箭头', type: 'line' },
  { name: 'plus-circle-thin', label: '加号圆(细)', type: 'line' },
  { name: 'drag-arrow', label: '拖拽箭头', type: 'line' },
  { name: 'sociality', label: '社交', type: 'line' },
  { name: 'recycle-bin', label: '回收站', type: 'line' },
  { name: 'set-trial', label: '试用设置', type: 'line' },
  { name: 'se-resize', label: '右下缩放', type: 'line' },
  { name: 'min-view', label: '最小视图', type: 'line' },
  { name: 'calendar-double-arrow', label: '日历双箭头', type: 'line' },
  { name: 'clock-point', label: '时钟点', type: 'line' },
  { name: 'house-square-fill', label: '房子方(面)', type: 'solid' },
  { name: 'building-square', label: '建筑方', type: 'line' },
  { name: 'briefcase-fill', label: '公文包(面)', type: 'solid' },
  { name: 'bell-square', label: '通知方', type: 'line' },
  { name: 'comment-square', label: '评论方', type: 'line' },
  { name: 'computer-square', label: '电脑方', type: 'line' },
  { name: 'contacts-fill', label: '联系人(面)', type: 'solid' },
  { name: 'file-image-fill', label: '图片文件(面)', type: 'solid' },
  { name: 'file-video-fill', label: '视频文件(面)', type: 'solid' },
  { name: 'building-fill', label: '建筑(面)', type: 'solid' },
  { name: 'cloud-upload', label: '云上传', type: 'line' },
  { name: 'box', label: '盒子', type: 'line' },
  { name: 'calendar-custom', label: '日历自定义', type: 'line' },
  { name: 'check-circle-custom', label: '勾选圆自定义', type: 'line' },
  { name: 'formula-custom', label: '公式自定义', type: 'line' },
  { name: 'hashtag-custom', label: '标签自定义', type: 'line' },
  { name: 'tasks-custom', label: '任务自定义', type: 'line' },
  { name: 'user-custom', label: '用户自定义', type: 'line' },
  { name: 'multiline-custom', label: '多行自定义', type: 'line' },
  { name: 'connect', label: '连接', type: 'line' },
  { name: 'microphones', label: '麦克风组', type: 'line' },
  { name: 'summarize', label: '汇总', type: 'line' },
  { name: 'text-optimization', label: '文本优化', type: 'line' },
  { name: 'text-checking', label: '文本校验', type: 'line' },
  { name: 'replace-selection', label: '替换选中', type: 'line' },
  { name: 'background', label: '背景', type: 'line' },
  { name: 'baseline-fill', label: '基线(面)', type: 'solid' },
  { name: 'authorship', label: '作者', type: 'line' },
  { name: 'add-element', label: '添加元素', type: 'line' },
  { name: 'basketball', label: '篮球', type: 'line' },
  { name: 'app-insight-fill', label: '洞察应用(面)', type: 'solid' },
  { name: 'app-project-fill', label: '项目应用(面)', type: 'solid' },
  { name: 'app-tracking-fill', label: '追踪应用(面)', type: 'solid' },
  { name: 'agile-square-fill', label: '敏捷方(面)', type: 'solid' },
  { name: 'airplane-fill', label: '飞机(面)', type: 'solid' },
  { name: 'android-fill', label: 'Android(面)', type: 'solid' },
  { name: 'apple-fill', label: 'Apple(面)', type: 'solid' },
  { name: 'alarm-clock-fill', label: '闹钟(面)', type: 'solid' },
  { name: 'dashboard-fill', label: '仪表盘(面)', type: 'solid' },
  { name: 'project-fill', label: '项目(面)', type: 'solid' },
  { name: 'testhub-fill', label: '测试库(面)', type: 'solid' },
  { name: 'insight-fill', label: '洞察(面)', type: 'solid' },
  { name: 'goals-fill', label: '目标(面)', type: 'solid' },
  { name: 'flow-fill', label: '流程(面)', type: 'solid' },
  { name: 'checkbox-fill', label: '复选框(面)', type: 'solid' },
  { name: 'radio-fill', label: '单选框(面)', type: 'solid' },
  { name: 'switch-fill', label: '开关(面)', type: 'solid' },
  { name: 'organization-fill', label: '组织(面)', type: 'solid' },
  { name: 'team-fill', label: '团队(面)', type: 'solid' },
  { name: 'app-calendar-fill', label: '日历应用(面)', type: 'solid' },
  { name: 'app-message-fill', label: '消息应用(面)', type: 'solid' },
  { name: 'app-crm-fill', label: 'CRM应用(面)', type: 'solid' },
  { name: 'app-okr-fill', label: 'OKR应用(面)', type: 'solid' },
  { name: 'app-approval-fill', label: '审批应用(面)', type: 'solid' },
  { name: 'app-agile-fill', label: '敏捷应用(面)', type: 'solid' },
  { name: 'app-pipeline-fill', label: '管道应用(面)', type: 'solid' },
  { name: 'app-portal-fill', label: '门户应用(面)', type: 'solid' },
  { name: 'app-drive-fill', label: '云盘应用(面)', type: 'solid' },
  { name: 'app-bulletin-fill', label: '公告应用(面)', type: 'solid' },
  { name: 'app-leave-fill', label: '请假应用(面)', type: 'solid' },
  { name: 'app-paid-fill', label: '薪酬应用(面)', type: 'solid' },
  { name: 'app-events-fill', label: '事件应用(面)', type: 'solid' },
  { name: 'app-report-fill', label: '报表应用(面)', type: 'solid' },
  { name: 'app-wiki-fill', label: '知识应用(面)', type: 'solid' },
  { name: 'app-testhub-fill', label: '测试应用(面)', type: 'solid' },
  { name: 'app-task-fill', label: '任务应用(面)', type: 'solid' },

];

function generateIconSet(seed, count) {
  var hash = seedHash(seed);
  // 根据哈希从全量池中选取不同的子集
  var pool = FULL_ICON_POOL.slice();
  // Fisher-Yates shuffle based on hash
  for (var i = pool.length - 1; i > 0; i--) {
    var j = (hash + i * 17) % (i + 1);
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  return pool.slice(0, count || 32);
}

var FONT_TEMPLATES = [
  { bases: [['PingFang SC','sans-serif',['Regular (400)','Medium (500)','Semibold (600)'],'原型协作平台','系统字体'],
             ['Inter','sans-serif',['Regular (400)','Medium (500)','Bold (700)'],'ProtoPlatform Design','西文字体'],
             ['Noto Sans SC','sans-serif',['Regular (400)','Medium (500)'],'高质量设计系统','中文字体'],
             ['Roboto Mono','monospace',['Regular (400)','Medium (500)'],'const value = 42;','等宽字体'],
             ['DIN Alternate','sans-serif',['Bold (700)','Medium (500)'],'1234567890','数字字体'],
             ['Source Han Serif','serif',['Regular (400)','Semibold (600)'],'衬线字体展示','中文衬线']] }
];

function generateFontSet(seed, count) {
  var hash = seedHash(seed);
  var templates = FONT_TEMPLATES[0].bases;
  var result = [];
  for (var i = 0; i < (count || 4); i++) {
    var t = templates[(hash + i * 31) % templates.length];
    result.push({ name: t[0], family: t[1], weights: t[2].slice(), sample: t[3], category: t[4] });
  }
  return result;
}

var COMPONENT_TEMPLATES = [
  { name:'主按钮', category:'按钮', type:'primary', props:'Primary Button', css:'.btn-primary{background:COLOR;color:#fff}' },
  { name:'次要按钮', category:'按钮', type:'ghost', props:'Secondary Button', css:'.btn-ghost{border:1px solid #E8AEF}' },
  { name:'危险按钮', category:'按钮', type:'danger', props:'Danger Button', css:'.btn-danger{background:#FF6B6B}' },
  { name:'小按钮', category:'按钮', type:'sm', props:'Small Button', css:'.btn-sm{padding:4px 10px;font-size:12px}' },
  { name:'图标按钮', category:'按钮', type:'icon-btn', props:'⚙', css:'.icon-btn{width:32px;height:32px;border-radius:8px}' },
  { name:'输入框', category:'表单', type:'input', props:'Placeholder text', css:'.input{border:1px solid #E8AEF}' },
  { name:'下拉选择', category:'表单', type:'select', props:'请选择', css:'select{appearance:none}' },
  { name:'多行文本', category:'表单', type:'textarea', props:'请输入描述...', css:'textarea{resize:vertical}' },
  { name:'复选框', category:'表单', type:'checkbox', props:'☑ 选项文本', css:'input[type=checkbox]{}' },
  { name:'开关', category:'表单', type:'toggle', props:'○ / ●', css:'.toggle{width:40px;height:24px}' },
  { name:'卡片', category:'容器', type:'card', props:'Card Container', css:'.card{border-radius:12px}' },
  { name:'弹窗', category:'容器', type:'modal', props:'Modal Dialog', css:'.modal{max-width:480px}' },
  { name:'抽屉', category:'容器', type:'drawer', props:'Drawer Panel', css:'.drawer{width:320px}' },
  { name:'标签', category:'展示', type:'badge', props:'New', css:'.badge{font-size:10px;padding:2px 6px}' },
  { name:'头像', category:'展示', type:'avatar', props:'U', css:'.avatar{border-radius:50%}' },
  { name:'导航项', category:'导航', type:'nav-item', props:'菜单项', css:'.nav-item{padding:10px 12px}' },
  { name:'面包屑', category:'导航', type:'breadcrumb', props:'首页 > 项目 > 详情', css:'.breadcrumb{gap:8px}' },
  { name:'分页', category:'导航', type:'pagination', props:'« 1 2 3 ... »', css:'.pagination{gap:4px}' },
  { name:'提示框', category:'反馈', type:'tooltip', props:'提示信息', css:'.tooltip{position:absolute}' },
  { name:'加载中', category:'反馈', type:'spinner', props:'⏳ Loading...', css:'@keyframes spin{to{rotate:360deg}}' },
  { name:'空状态', category:'反馈', type:'empty', props:'暂无数据', css:'.empty{text-align:center}' },
  { name:'进度条', category:'反馈', type:'progress-bar', props:'███████░░', css:'.progress{height:6px;border-radius:3px}' },
  { name:'表格', category:'数据', type:'table', props:'| 表头 | 数据 |', css:'.table{width:100%}' },
  { name:'标签页', category:'导航', type:'tabs', props:'Tab1 | Tab2', css:'.tabs{border-bottom:1px solid #eee}' },
  { name:'步骤条', category:'导航', type:'steps', props:'① → ② → ③', css:'.steps{display:flex}' },
  { name:'时间线', category:'展示', type:'timeline', props:'— 今天 —', css:'.timeline{border-left:2px solid #eee}' },
  { name:'统计卡片', category:'展示', type:'stat-card', props:'1,234 访问', css:'.stat-card{padding:20px}' },
  { name:'头像组', category:'展示', type:'avatar-group', props:'👤👤👤+3', css:'.avatar-group{display:flex}' },
  { name:'评分', category:'反馈', type:'rating', props:'★★★★☆', css:'.rating{color:#F59E0B}' }
];

function generateComponentSet(seed, count) {
  var hash = seedHash(seed);
  var pool = COMPONENT_TEMPLATES.slice();
  for (var i = pool.length - 1; i > 0; i--) {
    var j = (hash + i * 23) % (i + 1);
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  return pool.slice(0, count || 16).map(function(c) { return { name:c.name, category:c.category, type:c.type, props:c.props, css:c.css }; });
}

var SIZE_TEMPLATES = [
  { name:'标题 1', tag:'h1', size:'32px', lineHeight:'40px', weight:'600', usage:'页面主标题' },
  { name:'标题 2', tag:'h2', size:'24px', lineHeight:'32px', weight:'600', usage:'区块标题' },
  { name:'标题 3', tag:'h3', size:'18px', lineHeight:'26px', weight:'600', usage:'卡片标题' },
  { name:'标题 4', tag:'h4', size:'16px', lineHeight:'24px', weight:'600', usage:'段落标题' },
  { name:'正文大', tag:'p-lg', size:'15px', lineHeight:'22px', weight:'400', usage:'大段正文' },
  { name:'正文', tag:'p', size:'14px', lineHeight:'20px', weight:'400', usage:'常规正文' },
  { name:'正文小', tag:'p-sm', size:'13px', lineHeight:'18px', weight:'400', usage:'辅助文本' },
  { name:'说明文字', tag:'caption', size:'12px', lineHeight:'16px', weight:'400', usage:'说明/标注' },
  { name:'微小文字', tag:'tiny', size:'10px', lineHeight:'14px', weight:'400', usage:'角标/水印' },
  { name:'超大标题', tag:'display', size:'48px', lineHeight:'56px', weight:'700', usage:'落地页主标题' }
];

function generateSizeSet(seed, count) {
  var hash = seedHash(seed);
  var pool = SIZE_TEMPLATES.slice();
  // Use a deterministic selection
  var result = [];
  for (var i = 0; i < (count || 9); i++) {
    result.push(SIZE_TEMPLATES[(hash + i * 7) % SIZE_TEMPLATES.length]);
  }
  return result;
}

// 简单字符串哈希（确定性）
function seedHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h = h & h; // Convert to 32bit integer
  }
  return Math.abs(h);
}

// ===== Sketch 解析入口 =====
// 旧的 JSZip 前端解析器会把部分 Symbol / 图标路径误判成乱码资产。
// 当前组件库 UI 只允许走 /api/framo/sketch/import，也就是修改 UI 前已经验证可用的 Framo 后端解析链路。
window.libParseResult = null;

// 从 zip 中读取 JSON 文件
function readZipJSON(zip, path) {
  var file = zip.file(path);
  if (!file) return null;
  return file.async('string').then(JSON.parse);
}

// 递归遍历图层树
function walkLayers(layers, callback) {
  if (!layers || !Array.isArray(layers)) return;
  for (var i = 0; i < layers.length; i++) {
    var layer = layers[i];
    if (layer && layer._class) {
      callback(layer);
      // 递归子图层
      if (layer.layers && Array.isArray(layer.layers)) {
        walkLayers(layer.layers, callback);
      }
    }
  }
}

// 解析 document.json 中的颜色
function parseSketchColors(documentData) {
  var colors = [];
  try {
    // 从 colorAssets 提取命名颜色
    if (documentData.assets && documentData.assets.colorAssets) {
      documentData.assets.colorAssets.forEach(function(ca) {
        if (ca.color) {
          var rgba = ca.color;
          var r = Math.round((rgba.red || 0) * 255);
          var g = Math.round((rgba.green || 0) * 255);
          var b = Math.round((rgba.blue || 0) * 255);
          var a = rgba.alpha !== undefined ? rgba.alpha : 1;
          colors.push(a < 1 ? 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(2) + ')' : '#' + [r,g,b].map(function(v){return ('0'+v.toString(16)).slice(-2)}).join(''));
        }
      });
    }
    // 从文档级颜色变量提取
    if (documentData.colorSwatches) {
      documentData.colorSwatches.forEach(function(cs) {
        if (cs.color) {
          var rgba = cs.color;
          var r = Math.round((rgba.red || 0) * 255);
          var g = Math.round((rgba.green || 0) * 255);
          var b = Math.round((rgba.blue || 0) * 255);
          colors.push('#' + [r,g,b].map(function(v){return ('0'+v.toString(16)).slice(-2)}).join(''));
        }
      });
    }
  } catch(e) {}
  // 去重
  return colors.filter(function(c, i){return colors.indexOf(c) === i;}).slice(0, 8);
}

// 解析 document.json 中的字体
function parseSketchFonts(documentData) {
  var fontSet = [];
  var fontNames = [];
  try {
    // 方式1: document.fonts 数组
    if (documentData.fonts && Array.isArray(documentData.fonts)) {
      documentData.fonts.forEach(function(f) {
        var name = '';
        if (typeof f === 'string') name = f;
        else if (f.attributes && f.attributes.name) name = f.attributes.name;
        else if (f.name) name = f.name;
        if (name && fontNames.indexOf(name) < 0) {
          fontNames.push(name);
          var category = 'sans-serif';
          if (name.match(/mono|code|console/i)) category = 'monospace';
          else if (name.match(/song|serif|times|georgia/i)) category = 'serif';
          fontSet.push({ name: name, family: name, weights: ['Regular (400)'], sample: '字体示例', category: category });
        }
      });
    }
    // 方式2: 从 layerTextStyles 提取
    if (documentData.layerTextStyles && documentData.layerTextStyles.objects) {
      documentData.layerTextStyles.objects.forEach(function(obj) {
        try {
          var style = obj.style || {};
          var attrs = (style.encodedAttributes && style.encodedAttributes.attributes) || style.attributes || {};
          var fontDesc = attrs.font || attrs.MSAttributedStringFontAttribute || {};
          var name = fontDesc.name || fontDesc.fontName || (fontDesc.attributes && fontDesc.attributes.name) || '';
          if (name && fontNames.indexOf(name) < 0) {
            fontNames.push(name);
            var category = 'sans-serif';
            if (name.match(/mono|code|console/i)) category = 'monospace';
            else if (name.match(/song|serif|times|georgia/i)) category = 'serif';
            fontSet.push({ name: name, family: name, weights: ['Regular (400)'], sample: '字体示例', category: category });
          }
        } catch(e2) {}
      });
    }
  } catch(e) {}
  return fontSet;
}

// 从页面图层中提取图标（智能识别 + 名称哈希映射到 FULL_ICON_POOL）
function extractIconsFromPages(pagesData) {
  var isIconLayer = {};
  var iconKeywords = ['icon', 'ico', 'svg', '图标', 'symbol'];
  var groupNames = {}; // group 名称标签

  // 第一遍：收集 group 名称（用于判断子图层是否在图标组中）
  pagesData.forEach(function(pageData) {
    if (!pageData || !pageData.layers) return;
    walkLayers(pageData.layers, function(layer) {
      if (layer._class === 'group') {
        var gn = (layer.name || '').trim().toLowerCase();
        iconKeywords.forEach(function(kw) {
          if (gn.indexOf(kw) >= 0) groupNames[layer.do_objectID || layer.name] = true;
        });
      }
    });
  });

  // 收集符合条件的图标图层（不限数量）
  var candidateEntries = []; // {name, layer} for symbolMasters, {name} for others

  pagesData.forEach(function(pageData) {
    if (!pageData || !pageData.layers) return;
    walkLayers(pageData.layers, function(layer) {
      var name = (layer.name || '').trim().toLowerCase();
      var frame = layer.frame || {};
      var w = frame.width || 0;
      var h = frame.height || 0;

      // 判断条件：
      // 1. Symbol Master 且尺寸较小（≤80px）→ 可复用图标组件
      var isSymbol = layer._class === 'symbolMaster' && w <= 80 && h <= 80;
      // 2. 名称含 icon/svg/图标 关键词（且名称长度合理，排除 "icon141-bg-wrapper" 类噪声）
      var nameHasIconHint = name.length < 30 && iconKeywords.some(function(kw) { return name.indexOf(kw) >= 0; });
      // 3. 图层在命名含 icon 的 group 内
      var parentIsIconGroup = layer.do_objectID ? groupNames[layer.do_objectID] : false;
      // 4. 小尺寸形状（仅限形状类且父级已是图标组或名称含图标关键词）
      var isSmallShape = (['shapeGroup','shapePath','rectangle','oval','polygon','star','triangle'].indexOf(layer._class) >= 0)
        && w >= 10 && w <= 60 && h >= 10 && h <= 60
        && (nameHasIconHint || parentIsIconGroup);
      // 5. 文本图层但名称含图标关键词
      var isTextIcon = layer._class === 'text' && nameHasIconHint;

      if (isSymbol || nameHasIconHint || parentIsIconGroup || isSmallShape || isTextIcon) {
        if (name && name.length > 0) {
          // 检查是否已有同名条目
          var exists = false;
          for (var ei = 0; ei < candidateEntries.length; ei++) {
            if (candidateEntries[ei].name === name) { exists = true; break; }
          }
          if (!exists) {
            // 对 symbolMaster 保存图层引用用于提取真实 SVG
            if (layer._class === 'symbolMaster') {
              candidateEntries.push({ name: name, layer: layer });
            } else {
              candidateEntries.push({ name: name });
            }
          }
        }
      }
    });
  });

  // 如果候选太少，直接用候选名（不再自动填充随机图标）
  // （候选为空时返回空数组，由调用方处理降级）

  // 从路径中提取真实图标名（如 "1.base/1.icon/5.navigation/angle-right备份" → "angle-right"）
  function extractIconName(path) {
    // 取最后一个 / 之后的部分
    var last = path;
    var parts = path.split('/');
    if (parts.length > 1) last = parts[parts.length - 1];
    // 去掉常见的尾缀词
    var suffixes = ['备份', 'copy', '副本', '备份(2)'];
    suffixes.forEach(function(s) {
      if (last.indexOf(s) > last.length - s.length - 2) {
        last = last.slice(0, last.lastIndexOf(s));
      }
    });
    last = last.trim();
    // 去掉数字前缀（如 "1.base" → "base", "5.navigation" → "navigation"）
    last = last.replace(/^\d+[\.\-\s]*/g, '');
    // 去掉拼音/中文
    var clean = last.replace(/[^a-z0-9\-\_]/gi, '').replace(/[\-\_]+/g, '-').replace(/^-|-$/g, '');
    return clean || last;
  }

  // 尝试匹配（支持别名和多种匹配策略）
  function tryMatch(name) {
    if (!name) return null;
    var n = name.toLowerCase().trim();
    for (var i = 0; i < FULL_ICON_POOL.length; i++) {
      if (FULL_ICON_POOL[i].name === n) return FULL_ICON_POOL[i];
    }
    // 再试：按标签名（中文名）匹配
    for (var i = 0; i < FULL_ICON_POOL.length; i++) {
      if (FULL_ICON_POOL[i].label === n || FULL_ICON_POOL[i].label.indexOf(n) >= 0) {
        return FULL_ICON_POOL[i];
      }
    }
    // 尝试去掉常见后缀匹配（-fill）
    var withoutFill = n.replace(/-(fill|bold|line|solid)$/, '');
    if (withoutFill !== n) {
      for (var i = 0; i < FULL_ICON_POOL.length; i++) {
        if (FULL_ICON_POOL[i].name === withoutFill) return FULL_ICON_POOL[i];
      }
    }
    // 尝试去掉版本号（如 "icon14" → 尝试匹配 "icon"）
    var noNumber = n.replace(/\d+$/, '');
    if (noNumber !== n && noNumber.length >= 3) {
      for (var i = 0; i < FULL_ICON_POOL.length; i++) {
        if (FULL_ICON_POOL[i].name.indexOf(noNumber) >= 0) return FULL_ICON_POOL[i];
      }
    }
    // 尝试把空格变成短横线匹配
    var withHyphen = n.replace(/\s+/g, '-');
    if (withHyphen !== n) {
      for (var i = 0; i < FULL_ICON_POOL.length; i++) {
        if (FULL_ICON_POOL[i].name === withHyphen) return FULL_ICON_POOL[i];
      }
    }
    return null;
  }

  // 从候选名中提取可能的英文关键词（拆分短横线/下划线，取各单词）
  function extractKeywords(name) {
    var words = [];
    // 按分隔符拆分
    var parts = name.split(/[\-\_\/\\\.\s\+]+/);
    parts.forEach(function(p) {
      p = p.trim().toLowerCase();
      if (p && p.length >= 2 && /^[a-z][a-z0-9]*$/.test(p)) words.push(p);
    });
    return words;
  }

  // ===== 排除已知的非图标名称 =====
  var stopWords = ['icon', 'icons', 'ico', 'normal', 'hover', 'disable', 'disabled', 'active',
    'primary', 'default', 'fixed', 'gray', 'grey', 'square', 'circle', 'round',
    'danger', 'warning', 'success', 'info', 'error', 'xs', 'sm', 'md', 'lg', 'xl',
    'mini', 'max', 'min', 'backup', 'copy', '副本', '备份',
    'loading', 'off', 'on', 'of', 'xx', 'xxs', 'xxx',
    'maxdigits', 'doubledigits', 'singledigit', 'digit'];

  function isStateWord(w) { return stopWords.indexOf(w) >= 0; }

  function isNoise(name) {
    if (!name || name.length < 2) return true;
    if (/^\d+$/.test(name)) return true;
    if (/^\d+px$/.test(name)) return true;
    if (/^[\d\.\-\_\/\\s\+]+$/.test(name)) return true;
    if (/^[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\(\)\（\）\、\，\。\：\；\+\-\/\\]+$/.test(name)) return true;
    // Sketch 自动生成的图层名（Path 1, Rectangle 10, Oval 3 等）
    if (/^(path|rectangle|oval|polygon|shape|shapegroup|shapemerge|star|triangle|line|curve|text|group|symbol|page|artboard|slice)\s*\d*$/i.test(name)) return true;
    // 所有单词都是状态词（如 "on-disabled", "off-loading"）
    var words = name.split(/[\-\_]/);
    if (words.every(isStateWord)) return true;
    return false;
  }

  // ===== Sketch 图层 → SVG 转换 =====
  // 将 symbolMaster 中的 shape 数据转为 inline SVG
  function sketchLayerToSVG(layer) {
    if (!layer || !layer.layers) return '';
    var w = 16, h = 16;
    if (layer.frame) { w = layer.frame.width || 16; h = layer.frame.height || 16; }
    var paths = [];

    function parseCoord(s) {
      if (!s) return [0, 0];
      var m = s.match(/\{(.+),\s*(.+)\}/);
      if (m) return [parseFloat(m[1]) || 0, parseFloat(m[2]) || 0];
      return [0, 0];
    }

    function colorStr(color) {
      if (!color) return null;
      var r = Math.round((color.red||0)*255);
      var g = Math.round((color.green||0)*255);
      var b = Math.round((color.blue||0)*255);
      var a = color.alpha !== undefined ? color.alpha : 1;
      return a < 1 ? 'rgba('+r+','+g+','+b+','+a.toFixed(2)+')' : '#'+[r,g,b].map(function(v){return ('0'+v.toString(16)).slice(-2)}).join('');
    }

    function getFill(sub, fallback) {
      var src = (sub.style && sub.style.fills) || sub.fills;
      if (src && src.length > 0 && src[0].isEnabled) {
        var c = colorStr(src[0].color);
        if (c) return c;
      }
      return fallback || 'currentColor';
    }

    function getStroke(sub) {
      var borders = sub.style && sub.style.borders;
      if (borders && borders.length > 0 && borders[0].isEnabled) {
        return colorStr(borders[0].color);
      }
      return null;
    }

    function extractShape(sub, pf, fill) {
      var cls = sub._class;
      var sf = sub.frame || pf || {width:16, height:16, x:0, y:0};
      var sw = sf.width || 16, sh = sf.height || 16;
      var sx = sf.x || 0, sy = sf.y || 0;

      if (cls === 'shapePath') {
        var pts = sub.points || [];
        if (pts.length < 2) return;
        var d = '';
        for (var pi = 0; pi < pts.length; pi++) {
          var cf = parseCoord(pts[pi].curveFrom);
          var ax = sx + cf[0] * sw;
          var ay = sy + cf[1] * sh;
          if (pi === 0) {
            d += 'M' + ax.toFixed(4) + ' ' + ay.toFixed(4);
          } else {
            // 所有点都使用直线连接（L），16x16 图标中曲线差异不可见
            d += 'L' + ax.toFixed(4) + ' ' + ay.toFixed(4);
          }
        }
        if (pts.length > 1) d += 'Z';
        if (d) {
          var fc = getFill(sub, fill);
          var st = getStroke(sub);
          paths.push({d: d, fill: fc, stroke: st});
        }
      } else if (cls === 'rectangle') {
        var rx = sub.fixedRadius || 0;
        var rad = Math.min(rx, sw/2, sh/2);
        var fc = getFill(sub, fill);
        var st = getStroke(sub);
        var rectStr = 'x="' + (sx).toFixed(1) + '" y="' + (sy).toFixed(1) + '" width="' + (sw).toFixed(1) + '" height="' + (sh).toFixed(1) + '"';
        if (rad > 0) rectStr += ' rx="' + rad + '" ry="' + rad + '"';
        paths.push({rect: rectStr, fill: fc, stroke: st});
      } else if (cls === 'oval') {
        var cx = sx + sw/2, cy = sy + sh/2;
        var rx2 = sw/2, ry2 = sh/2;
        var fc = getFill(sub, fill);
        paths.push({ellipse: 'cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + rx2.toFixed(1) + '" ry="' + ry2.toFixed(1) + '"', fill: fc});
      } else if (cls === 'shapeGroup') {
        var gf = getFill(sub, fill);
        if (sub.layers) {
          for (var gi = 0; gi < sub.layers.length; gi++) {
            extractShape(sub.layers[gi], sub.frame || pf, gf);
          }
        }
      }
    }

    for (var i = 0; i < layer.layers.length; i++) {
      extractShape(layer.layers[i], layer.frame, 'currentColor');
    }

    if (paths.length === 0) return '';

    var svgParts = [];
    for (var pi = 0; pi < paths.length; pi++) {
      var p = paths[pi];
      if (p.d) {
        var sa = p.stroke ? ' stroke="' + p.stroke + '" stroke-width="1"' : '';
        svgParts.push('<path d="' + p.d + '" fill="' + p.fill + '"' + sa + '/>');
      } else if (p.rect) {
        var sa = p.stroke ? ' stroke="' + p.stroke + '" stroke-width="1"' : '';
        svgParts.push('<rect ' + p.rect + ' fill="' + p.fill + '"' + sa + '/>');
      } else if (p.ellipse) {
        svgParts.push('<ellipse ' + p.ellipse + ' fill="' + p.fill + '"/>');
      }
    }

    return '<svg width="20" height="20" viewBox="0 0 ' + w + ' ' + h + '" fill="none">' + svgParts.join('') + '</svg>';
  }

  // 将候选名映射到 FULL_ICON_POOL（匹配到的保留图标，未匹配的保留原名）
  var result = [];
  var usedNames = {};
  candidateEntries.forEach(function(entry) {
    var cn = entry.name;
    var layerRef = entry.layer;
    // 先从路径中提取真正的图标名
    var extracted = extractIconName(cn);
    // 过滤噪声名称
    if (isNoise(extracted)) return;
    if (isNoise(cn)) return;
    // 尝试直接匹配
    var matched = tryMatch(extracted);
    // 尝试去掉短横线匹配
    if (!matched) matched = tryMatch(extracted.replace(/-/g, ''));
    // 尝试仅英文部分（取第一个词）
    if (!matched) {
      var engPart = extracted.replace(/[^a-z0-9]/gi, '');
      matched = tryMatch(engPart) || tryMatch(engPart.replace(/-/g, ''));
    }
    // 尝试关键词匹配（拆分短横线/下划线，取各单词匹配 pool 名称）
    if (!matched) {
      var keywords = extractKeywords(extracted);
      for (var ki = 0; ki < keywords.length && !matched; ki++) {
        // 尝试精确关键词匹配
        matched = tryMatch(keywords[ki]);
        // 尝试 pool 名称包含该关键词
        if (!matched) {
          for (var pi = 0; pi < FULL_ICON_POOL.length; pi++) {
            if (FULL_ICON_POOL[pi].name.indexOf(keywords[ki]) >= 0) {
              matched = FULL_ICON_POOL[pi];
              break;
            }
          }
        }
      }
      // 尝试用短横线连接所有关键词匹配（处理 "cascade multiple choice" → "cascade-multiple-choice"）
      if (!matched && keywords.length >= 2) {
        var joined = keywords.join('-');
        for (var pi = 0; pi < FULL_ICON_POOL.length; pi++) {
          if (FULL_ICON_POOL[pi].name === joined || FULL_ICON_POOL[pi].name.indexOf(joined) >= 0) {
            matched = FULL_ICON_POOL[pi];
            break;
          }
        }
      }
    }
    if (matched && !usedNames[matched.name]) {
      usedNames[matched.name] = true;
      // 尝试从 symbolMaster 提取真实 SVG
      var realSVG = '';
      if (layerRef && layerRef._class === 'symbolMaster') {
        realSVG = sketchLayerToSVG(layerRef);
      }
      result.push({ name: matched.name, label: matched.label, type: matched.type, svg: realSVG });
    } else if (!matched && layerRef && layerRef._class === 'symbolMaster') {
      // 即使未匹配到 pool，但 symbolMaster 且有有效 SVG → 也作为图标展示
      var realSVG = sketchLayerToSVG(layerRef);
      if (realSVG) {
        var displayName = extractIconName(cn) || cn.replace(/[\s\S]*\//g, '').replace(/[^a-z0-9\-]/gi, '');
        var dedupKey = displayName || cn;
        if (!usedNames[dedupKey]) {
          usedNames[dedupKey] = true;
          result.push({ name: displayName, label: cn, type: 'line', svg: realSVG });
        }
      }
    }
    // 不再保留未匹配的图标（过滤掉所有未识别到 FULL_ICON_POOL 的项）
  });

  return result;
}

// 从文本图层提取字号和字体
function extractTextStylesFromPages(pagesData) {
  var sizeMap = {};  // size → count
  var fontMap = {};

  pagesData.forEach(function(pageData) {
    if (!pageData || !pageData.layers) return;
    walkLayers(pageData.layers, function(layer) {
      if (layer._class !== 'text') return;
      try {
        var attrs = layer.attributedString || {};
        var attrArr = attrs.attributes || [];

        attrArr.forEach(function(attr) {
          var a = attr.attributes || {};
          var fontSize = a.fontSize || a.MSAttributedStringFontAttribute || 0;
          if (typeof fontSize === 'object') fontSize = fontSize.size || 14;
          if (fontSize > 5 && fontSize < 200) {
            var key = Math.round(fontSize);
            sizeMap[key] = (sizeMap[key] || 0) + 1;
          }
          var fontName = (a.font && (a.font.name || a.font.fontName)) || '';
          if (fontName) fontMap[fontName] = (fontMap[fontName] || 0) + 1;
        });
      } catch(e) {}
    });
  });

  // 排序并返回字号
  var sizes = Object.keys(sizeMap).sort(function(a,b){return b-a;}).map(function(px) {
    var size = parseInt(px);
    var name = size >= 32 ? '标题 ' + (size >= 48 ? '超大' : Math.ceil(size/8)) :
               size >= 18 ? '标题 ' + Math.ceil(size/6) :
               size >= 14 ? '正文' : '小字';
    return { name: name, tag: 'p', size: px + 'px', lineHeight: Math.round(size * 1.4) + 'px', weight: '400', usage: '自动提取' };
  });

  return sizes;
}

// 从 pages 中提取组件（symbolInstance / symbolMaster）
// 去重策略：按组件名称的"基名"分组（如 "Button/Primary" → "Button"），合并同类项
function extractComponentsFromPages(pagesData) {
  var compMap = {};
  var baseCompMap = {};  // baseName → { count, cat, names[] }
  var COMP_KEYWORDS = ['button','btn','input','card','modal','dialog','table','form','nav','tab','list','item','badge','tag','header','footer','sidebar','menu','dropdown','picker','slider','switch','checkbox','radio','progress','spinner','alert','toast','tooltip','popover','upload','avatar'];
  // 中文组件类别关键词（用于检测左侧导航类文本/图层）
  var ZH_COMP_KEYWORDS = ['按钮','表单','导航','容器','展示','反馈','数据','布局','输入','选择','开关','滑块','头像','标签','分页','步骤','进度','提示','弹窗','抽屉','卡片','表格','列表','菜单','下拉'];
  // 中文组件类别映射（带类别前缀的 artboard 名 → 组件名称和分类）
  var ZH_CAT_MAP = {
    '通用':'通用','按钮':'按钮','表单':'表单','导航':'导航','布局':'布局','数据展示':'数据','数据录入':'表单',
    '反馈':'反馈','其他':'其他','数据':'数据','介绍':'展示','基础':'基础'
  };
  var ZH_CAT_CATEGORY = {
    '通用':'通用','按钮':'按钮','表单':'表单','导航':'导航','布局':'布局','数据展示':'数据','数据录入':'表单',
    '反馈':'反馈','其他':'其他','数据':'数据','介绍':'展示','基础':'基础'
  };

  pagesData.forEach(function(pageData) {
    if (!pageData || !pageData.layers) return;

    var pageName = (pageData.name || '').trim();

    // === 策略0：检测 artboard 级组件（组件展示页面的主力） ===
    // 每个 artboard 代表一个组件展示区域，其名称就是组件名
    pageData.layers.forEach(function(layer) {
      if (layer._class !== 'artboard') return;
      var artName = (layer.name || '').trim();
      if (!artName || artName.length <= 1) return;

      // 从 artboard 名提取 类别/组件名（如 "通用/按钮"、"数据录入/日期选择"）
      var parts = artName.split(/[\/／\s]/).filter(Boolean);
      var compName = artName;
      var compCat = '组件';

      if (parts.length >= 2) {
        // 尝试第一部分作为类别（如 "通用/按钮" → 类别="通用", 名称="按钮"）
        var firstPart = parts[0];
        if (ZH_CAT_MAP[firstPart]) {
          compCat = ZH_CAT_MAP[firstPart];
          compName = parts.slice(1).join('/');
        }
      }

      // 检测是否匹配已知组件关键词
      var artLower = artName.toLowerCase();
      for (var k = 0; k < COMP_KEYWORDS.length; k++) {
        var kw = COMP_KEYWORDS[k];
        if (artLower.indexOf(kw) >= 0) {
          var catMap = {button:'按钮',btn:'按钮',input:'表单',card:'容器',modal:'容器',dialog:'容器',table:'数据',form:'表单',tab:'导航',list:'数据',item:'数据',badge:'展示',tag:'标签',header:'布局',footer:'布局',sidebar:'布局',menu:'导航',dropdown:'表单',slider:'表单',switch:'表单',checkbox:'表单',radio:'表单',progress:'反馈',spinner:'反馈',alert:'反馈',toast:'反馈',tooltip:'反馈',popover:'反馈',upload:'表单',avatar:'展示'};
          compCat = catMap[kw] || compCat;
          break;
        }
      }

      if (!compMap[artName]) {
        compMap[artName] = { name: compName, category: compCat, type: 'artboard', props: artName, css: '' };
      }
    });

    // === 策略1：检测 symbolInstance/symbolMaster（原有逻辑） ===
    walkLayers(pageData.layers, function(layer) {
      var name = (layer.name || '').trim();
      var nameLower = name.toLowerCase();
      if (layer._class === 'symbolInstance' || layer._class === 'symbolMaster') {
        // 过滤掉明显的图标/装饰类 symbol（名称为单字符、纯数字、含 "icon/" 路径）
        if (name.length <= 1 || /^\d+$/.test(nameLower) || nameLower.indexOf('icon/') >= 0) return;

        // 提取基名：取 "/" 或 " / " 分隔的第一段
        var baseName = name.split(/[\/／]/)[0].trim();
        if (!baseName || baseName.length <= 1) baseName = name;

        // 分词：按 camelCase / PascalCase / 空格 分割
        var words = baseName.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_\/-]+/).filter(Boolean);

        // 检测类别
        var cat = '组件';
        for (var k = 0; k < COMP_KEYWORDS.length; k++) {
          var kw = COMP_KEYWORDS[k];
          if (nameLower.indexOf(kw) >= 0) {
            var catMap = {button:'按钮',btn:'按钮',input:'表单',card:'容器',modal:'容器',dialog:'容器',table:'数据',form:'表单',tab:'导航',list:'数据',item:'数据',badge:'展示',tag:'标签',header:'布局',footer:'布局',sidebar:'布局',menu:'导航',dropdown:'表单',slider:'表单',switch:'表单',checkbox:'表单',radio:'表单',progress:'反馈',spinner:'反馈',alert:'反馈',toast:'反馈',tooltip:'反馈',popover:'反馈',upload:'表单',avatar:'展示'};
            cat = catMap[kw] || '组件';
            break;
          }
        }

        // 去重：同一基名只保留一个
        if (!compMap[baseName]) {
          compMap[baseName] = { name: baseName, category: cat, type: 'symbol', props: baseName, css: '.custom-symbol' };
        } else if (compMap[baseName].category === '组件' && cat !== '组件') {
          compMap[baseName].category = cat;
        }
        return; // 已处理，不进入下面的文本/组名检测
      }

      // === 策略2：检测 group 和 text 图层（组件展示页面的左侧导航/分类标题） ===
      // 只处理组名或文本图层，且名称不包含文件路径特征
      if (layer._class === 'group' || layer._class === 'text') {
        if (name.length <= 1 || name.length > 40) return;
        if (/^\d+$/.test(nameLower)) return;
        // 过滤 Sketch 自动生成的名称
        if (/^(path|rectangle|oval|polygon|shape|line|curve|group|symbol|page|artboard|slice)\s*\d*$/i.test(name)) return;

        // 检查是否匹配中文组件类别名（如 "导航", "按钮", "表单" 等）
        var matchedZh = false;
        var zhCat = '组件';
        for (var z = 0; z < ZH_COMP_KEYWORDS.length; z++) {
          if (name.indexOf(ZH_COMP_KEYWORDS[z]) >= 0) {
            matchedZh = true;
            // 映射中文类别
            var zhCatMap = {'按钮':'按钮','表单':'表单','导航':'导航','容器':'容器','展示':'展示','反馈':'反馈','数据':'数据','布局':'布局','输入':'表单','选择':'表单','开关':'表单','滑块':'表单','头像':'展示','标签':'展示','分页':'导航','步骤':'导航','进度':'反馈','提示':'反馈','弹窗':'容器','抽屉':'容器','卡片':'容器','表格':'数据','列表':'数据','菜单':'导航','下拉':'表单'};
            zhCat = zhCatMap[ZH_COMP_KEYWORDS[z]] || '组件';
            break;
          }
        }

        if (matchedZh && !compMap[name]) {
          compMap[name] = { name: name, category: zhCat, type: 'group', props: name, css: '' };
        }
      }
    });
  });

  // 转数组并统计数量显示
  var result = Object.keys(compMap).map(function(k) { return compMap[k]; });
  return result;
}

// 主解析函数（使用 Framo 正确的 parseSketchDocument 逻辑，客户端运行）
function parseSketchFile(file) {
  return Promise.reject(new Error('旧客户端 Sketch 解析器已移除，请使用 Framo 后端解析接口'));
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var arrayBuffer = e.target.result;
        JSZip.loadAsync(arrayBuffer).then(function(zip) {
          var name = file.name.replace(/\.sketch$/i, '');

          // 并行读取 document.json 和所有 pages/*.json
          var docPromise = readZipJSON(zip, 'document.json');
          var pageFiles = [];

          zip.forEach(function(path, zipEntry) {
            if (path.match(/^pages\/.+\.json$/)) {
              pageFiles.push(readZipJSON(zip, path));
            }
          });

          if (pageFiles.length === 0) {
            zip.forEach(function(path, zipEntry) {
              if (path.match(/\.json$/) && path.indexOf('document') < 0 && path.indexOf('meta') < 0 && path.indexOf('user') < 0) {
                pageFiles.push(readZipJSON(zip, path));
              }
            });
          }

          Promise.all([docPromise].concat(pageFiles)).then(function(values) {
            var docData = values[0];
            var pagesData = values.slice(1).filter(Boolean);

            // ===== Framo parseSketchDocument 移植（client-side）=====
            var colors = {};   // hex → { value, usages[], count, chroma, luminance }
            var fonts = {};    // key → { family, size, weight, count, sample }
            var iconCandidates = [];
            var components = [];
            var totalLayers = 0;

            function rgbColor(color) {
              if (!color) return '';
              var ch = function(v) { return Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 255); };
              var a = color.alpha == null ? 1 : Math.max(0, Math.min(1, Number(color.alpha) || 0));
              if (a < 1) return 'rgba(' + ch(color.red) + ',' + ch(color.green) + ',' + ch(color.blue) + ',' + a.toFixed(2) + ')';
              return '#' + [color.red, color.green, color.blue].map(function(v) { return ch(v).toString(16).padStart(2, '0'); }).join('').toUpperCase();
            }

            function registerColor(color, usage) {
              if (!color) return;
              var value = rgbColor(color);
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

            function firstFill(layer) {
              if (!layer || !layer.style || !layer.style.fills) return null;
              for (var fi = 0; fi < layer.style.fills.length; fi++) {
                if (layer.style.fills[fi].isEnabled !== false && layer.style.fills[fi].color) return layer.style.fills[fi].color;
              }
              return null;
            }

            function deepFill(layer) {
              var c = firstFill(layer);
              if (c) return c;
              if (layer && layer.layers) {
                for (var ci = 0; ci < layer.layers.length; ci++) {
                  c = deepFill(layer.layers[ci]);
                  if (c) return c;
                }
              }
              return null;
            }

            function fontFamily(name) {
              var f = String(name || '').replace(/[- ](Regular|Medium|Semibold|SemiBold|Bold|Light|Thin|Heavy|Black)$/i, '');
              if (/^PingFang[- ]?SC$/i.test(f)) return 'PingFang SC';
              if (/^SFProText$/i.test(f)) return 'SF Pro Text';
              if (/^SanFranciscoDisplay$/i.test(f)) return 'San Francisco Display';
              return f || 'System';
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

            function cleanSegment(value) {
              return String(value || '').replace(/^\s*\d+[.、]\s*/, '').replace(/\s+/g, ' ').trim();
            }

            function iconDisplayName(rawName) {
              var parts = String(rawName || '').split(/[\/／]/).map(cleanSegment).filter(Boolean);
              var generic = /^(base基础|icon图标|icon|ico|action|normal|tips|navigation|application|file|rd|chart|default|编组|group)$/i;
              for (var pn = parts.length - 1; pn >= 0; pn--) {
                var part = parts[pn].replace(/备份\s*\d*$/i, '').trim();
                if (!part || /^\d+$/.test(part) || generic.test(part)) continue;
                return part;
              }
              return cleanSegment(parts[parts.length - 1] || rawName || 'icon');
            }

            function iconCategory(rawName) {
              var parts = String(rawName || '').split(/[\/／]/).map(cleanSegment).filter(Boolean);
              if (parts.length >= 2) {
                var cat = parts[parts.length - 2].replace(/备份\s*\d*$/i, '').trim();
                if (cat && !/^(icon图标|icon|ico)$/i.test(cat)) return cat;
              }
              return '图标';
            }

            function componentScore(item) {
              var score = 0;
              if (/(^|\/)default$/i.test(item.name)) score += 30;
              if (/(^|\/)(md|medium|中)$/i.test(item.name)) score += 15;
              if (/禁用|disabled|hover|pressed|备份/i.test(item.name)) score -= 30;
              score -= item.name.split('/').length;
              return score;
            }

            // 图标路径提取（Framo iconPaths）
            function sp(raw, frame, root, offset) {
              var vals = String(raw || '').match(/-?\d*\.?\d+/g);
              if (!vals || vals.length < 2) return null;
              var x = (offset.x + parseFloat(vals[0]) * (Number(frame.width) || root.width)) / root.width * 24;
              var y = (offset.y + parseFloat(vals[1]) * (Number(frame.height) || root.height)) / root.height * 24;
              return [x, y];
            }
            function pc(pt) { return pt[0].toFixed(2) + ' ' + pt[1].toFixed(2); }
            function sp2(l, r) { return l && r && Math.abs(l[0] - r[0]) < 0.001 && Math.abs(l[1] - r[1]) < 0.001; }

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
                    point: sp(item.point, frame, root, localOffset),
                    incoming: sp(item.curveFrom || item.point, frame, root, localOffset),
                    outgoing: sp(item.curveTo || item.point, frame, root, localOffset)
                  };
                }).filter(function(item) { return item.point; });
                if (pts.length > 1) {
                  var path = 'M' + pc(pts[0].point);
                  var seg = function(from, to) {
                    if (!sp2(from.outgoing, from.point) || !sp2(to.incoming, to.point)) {
                      return ' C' + pc(from.outgoing) + ' ' + pc(to.incoming) + ' ' + pc(to.point);
                    }
                    return ' L' + pc(to.point);
                  };
                  for (var si = 1; si < pts.length; si++) path += seg(pts[si - 1], pts[si]);
                  if (layer.isClosed !== false) path += seg(pts[pts.length - 1], pts[0]) + ' Z';
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

            // 递归遍历图层（Framo 风格：不跳过无 _class 的图层）
            function walkLayers(layers, trail) {
              if (!layers) return;
              for (var wi = 0; wi < layers.length; wi++) {
                var layer = layers[wi];
                if (!layer) continue;
                // 即使没有 _class，仍需遍历子图层
                if (!layer._class) {
                  if (layer.layers) walkLayers(layer.layers, trail || []);
                  continue;
                }
                totalLayers++;
                var usage = (trail || []).concat([layer.name]).filter(Boolean).join(' / ');
                var trailArr = (trail || []).concat([layer.name || layer._class || 'Layer']);

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
                    preview: { color: rgbColor(deepFill(layer) || { red: 0.94, green: 0.94, blue: 0.94, alpha: 1 }), radius: 10 }
                  });
                }

                // 图标候选
                var iconLike = /icon|ico|图标/i.test(layer.name || '') && (['shapeGroup', 'group', 'symbolMaster'].indexOf(layer._class) >= 0);
                if (iconLike && iconCandidates.length < 10000) {
                  var iconName = iconDisplayName(layer.name);
                  iconCandidates.push({
                    id: layer.do_objectID,
                    name: iconName,
                    fullName: layer.name,
                    label: iconName,
                    category: iconCategory(layer.name),
                    type: /fill|solid|面/i.test(layer.name || '') ? 'solid' : 'line',
                    width: Math.round((layer.frame && layer.frame.width) || 24),
                    height: Math.round((layer.frame && layer.frame.height) || 24),
                    color: rgbColor(deepFill(layer) || { red: 0.2, green: 0.2, blue: 0.2, alpha: 1 }),
                    paths: iconPaths(layer),
                    priority: iconPriority(layer.name)
                  });
                }

                // 递归
                if (layer.layers) walkLayers(layer.layers, trailArr);
              }
            }

            // ===== 遍历所有页面 =====
            for (var pi = 0; pi < pagesData.length; pi++) {
              var page = pagesData[pi];
              walkLayers(page.layers, []);
            }

            // ===== 颜色排序 =====
            var palette = Object.keys(colors).map(function(k) { return colors[k]; }).sort(function(a, b) { return b.count - a.count; });

            // ===== 图标过滤（Framo 标准）=====
            var iconNames = {};
            var icons = iconCandidates.filter(function(item) {
              return item.paths.length > 0 && item.priority >= 120 && !/备份|角色头像|avatar/i.test(item.fullName || item.name);
            }).sort(function(a, b) { return b.priority - a.priority; }).filter(function(item) {
              var shortName = iconDisplayName(item.name || item.fullName).toLowerCase();
              if (!shortName || /^\d+$/.test(shortName)) return false;
              if (iconNames[shortName]) return false;
              iconNames[shortName] = true;
              item.name = iconDisplayName(item.name || item.fullName);
              item.label = item.label || item.name;
              return true;
            }).slice(0, 3000);

            // ===== 组件分组（Framo 标准）=====
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
              var rep = componentGroups[key].representative;
              if (componentScore(comp) > componentScore(rep)) componentGroups[key].representative = comp;
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

            // ===== 字体聚合（Framo 标准）=====
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

            // ===== 共享样式 =====
            var textStyles = [];
            var layerStyles = [];
            if (docData && docData.layerTextStyles && docData.layerTextStyles.objects) {
              for (var tsi = 0; tsi < docData.layerTextStyles.objects.length; tsi++) {
                var tsItem = docData.layerTextStyles.objects[tsi];
                var tattrs = tsItem.value && tsItem.value.textStyle && tsItem.value.textStyle.encodedAttributes;
                if (tattrs) {
                  var tfontA = tattrs.MSAttributedStringFontAttribute && tattrs.MSAttributedStringFontAttribute.attributes;
                  textStyles.push({ name: tsItem.name || 'Text style', family: tfontA ? tfontA.name : 'System', size: tfontA ? tfontA.size : 14, color: rgbColor(tattrs.MSAttributedStringColorAttribute || {}) });
                }
              }
            }
            if (docData && docData.layerStyles && docData.layerStyles.objects) {
              for (var lsi = 0; lsi < docData.layerStyles.objects.length; lsi++) {
                var lsItem = docData.layerStyles.objects[lsi];
                var lfill = lsItem.value && lsItem.value.fills && lsItem.value.fills.find(function(f) { return f.isEnabled !== false; });
                layerStyles.push({ name: lsItem.name || 'Layer style', color: rgbColor(lfill ? lfill.color : {}), radius: lsItem.value && lsItem.value.borderOptions && lsItem.value.borderOptions.dashPattern ? lsItem.value.borderOptions.dashPattern[0] || 0 : 0 });
              }
            }

            // ===== Token 推断 =====
            var primaryColor = '#5B5BD6';
            for (var pci = 0; pci < palette.length; pci++) {
              if (palette[pci].luminance > 0.12 && palette[pci].luminance < 0.88) { primaryColor = palette[pci].value; break; }
            }
            var surfaceColor = '#FFFFFF';
            for (var sci = 0; sci < palette.length; sci++) {
              if (palette[sci].luminance > 0.92) { surfaceColor = palette[sci].value; break; }
            }

            // ===== 输出结果（Framo 数据格式）=====
            var result = {
              name: name,
              icons: icons,
              fonts: usableFonts,
              components: usableComponents,
              sizes: typeScale,
              colors: palette.slice(0, 80),
              textStyles: textStyles,
              layerStyles: layerStyles,
              tokens: {
                colorPrimary: primaryColor,
                colorSurface: surfaceColor,
                borderRadius: '12px',
                fontSizeBase: 14,
                spacingBase: 8
              },
              stats: {
                pages: pagesData.length,
                layers: totalLayers,
                colors: palette.length,
                fonts: usableFonts.length,
                fontSizes: typeScale.length,
                icons: icons.length,
                components: usableComponents.length,
                componentVariants: components.length,
                textStyles: textStyles.length,
                layerStyles: layerStyles.length
              }
            };

            resolve(result);
          }).catch(function(err) {
            reject(err);
          });
        }).catch(function(err) {
          reject(err);
        });
      } catch(err) {
        reject(err);
      }
    };
    reader.onerror = function() { reject(new Error('文件读取失败')); };
    reader.readAsArrayBuffer(file);
  });
}

window.startLibraryParse = function() {
  if (!window.libSelectedFile) return;

  var file = window.libSelectedFile;
  var ext = '.' + file.name.split('.').pop().toLowerCase();

  // 切换到解析步骤
  var stepUpload = document.getElementById('lib-step-upload');
  var stepParsing = document.getElementById('lib-step-parsing');
  if (stepUpload) stepUpload.style.display = 'none';
  if (stepParsing) stepParsing.style.display = '';

  // 显示文件名
  var filenameEl = document.getElementById('lib-parse-filename');
  if (filenameEl && file) {
    filenameEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13,2 13,9 20,9"/></svg> ' +
      '<span>' + escapeHTML(file.name) + '</span>';
  }

  if (ext === '.sketch') {
    // ===== 使用 Framo 后端真实解析（恢复修改 UI 前的可用解析能力）=====
    parseStages.forEach(function(stage, i) {
      var delay = (i + 1) * 600;
      setTimeout(function() {
        updateParseStage(i);
        if (i === parseStages.length - 1) {
          setTimeout(function() {
            updateParseStage(i);
            importSketchWithFramoAPI(file).then(function(result) {
              window.libParseResult = result;
              showParseDoneResult(result);
            }).catch(function(err) {
              console.error('Framo sketch parse error:', err);
              showToast(err.message || 'Sketch 解析失败，请检查文件格式', 'error');
              resetLibraryParseToUpload();
            });
          }, 200);
        }
      }, delay);
    });
  } else {
    showToast('当前仅支持 .sketch 文件，请使用 Framo 真实解析引擎', 'error');
    resetLibraryParseToUpload();
  }
};

function importSketchWithFramoAPI(file) {
  var form = new FormData();
  form.append('file', file);
  return fetch('/api/framo/sketch/import', { method: 'POST', body: form }).then(function(res) {
    return res.json().catch(function() { return {}; }).then(function(payload) {
      if (!res.ok || !payload.ok || !payload.library) {
        throw new Error(payload.error || ('Sketch 解析失败：' + res.status));
      }
      return normalizeFramoLibraryForMainUI(payload.library, file);
    });
  });
}

function normalizeFramoLibraryForMainUI(library, file) {
  var assets = library.assets || {};
  var colors = assets.colors || library.colors || [];
  var icons = (assets.icons || []).map(function(icon) {
    var fullName = icon.fullName || icon.name || '';
    var cleanName = getReadableIconName(icon.name || fullName);
    var meta = getReadableIconMeta({
      name: cleanName,
      fullName: fullName,
      category: icon.category,
      type: icon.type
    });
    return Object.assign({}, icon, {
      name: cleanName,
      fullName: fullName,
      label: icon.label || meta.category,
      category: icon.category || meta.category,
      type: icon.type || (/fill|solid|面/i.test(fullName) ? 'solid' : 'line')
    });
  });
  var fonts = assets.fonts || [];
  var components = assets.components || (Array.isArray(library.components) ? library.components.map(function(name) {
    var parts = String(name || '').split('/');
    return {
      name: parts[parts.length - 1] || name,
      fullName: name,
      category: parts.length > 1 ? parts[0] : '组件',
      variantCount: 1,
      preview: { color: '#EEF2FF', radius: 10 }
    };
  }) : []);
  var sizes = assets.fontSizes || assets.sizes || [];
  var stats = library.stats || {};
  var sourceFile = file ? file.name : (library.name ? library.name + '.sketch' : 'Sketch 文件');

  return {
    id: library.id,
    isServerLibrary: true,
    name: library.name || (file ? file.name.replace(/\.sketch$/i, '') : '未命名组件库'),
    version: library.version || '1.0.0',
    description: library.description || (library.sourceType === 'sketch'
      ? '从 ' + sourceFile + ' 解析生成的组件库，包含 ' + icons.length + ' 图标、' + fonts.length + ' 字体、' + components.length + ' 组件'
      : '服务端组件库'),
    sourceType: library.sourceType || 'sketch',
    sourceLibraryId: library.id,
    importedAt: library.importedAt,
    previewResult: library.previewResult,
    icons: icons,
    fonts: fonts,
    components: components,
    sizes: sizes,
    colors: colors,
    textStyles: assets.textStyles || [],
    layerStyles: assets.layerStyles || [],
    tokens: library.tokens || {},
    stats: {
      pages: stats.pages || 0,
      layers: stats.layers || 0,
      colors: stats.colors || colors.length,
      fonts: stats.fonts || fonts.length,
      fontSizes: stats.fontSizes || sizes.length,
      icons: stats.icons || icons.length,
      components: stats.components || components.length,
      componentVariants: stats.componentVariants || 0,
      textStyles: (assets.textStyles || []).length,
      layerStyles: (assets.layerStyles || []).length
    }
  };
}

function resetLibraryParseToUpload() {
  var stepUpload = document.getElementById('lib-step-upload');
  var stepParsing = document.getElementById('lib-step-parsing');
  var fill = document.getElementById('lib-progress-fill');
  if (stepParsing) stepParsing.style.display = 'none';
  if (stepUpload) stepUpload.style.display = '';
  if (fill) fill.style.width = '0%';
  initParseStagesUI();
}

function updateParseStage(stageIndex) {
  // 更新进度条
  var fill = document.getElementById('lib-progress-fill');
  if (fill) fill.style.width = parseStages[stageIndex].progress + '%';

  // 更新每个阶段的状态
  for (var i = 0; i < parseStages.length; i++) {
    var el = document.getElementById('lib-ps-' + i);
    if (!el) continue;

    var dot = el.querySelector('.parse-stage-dot');

    if (i < stageIndex) {
      el.className = 'parse-stage-item done';
      dot.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>';
    } else if (i === stageIndex) {
      el.className = 'parse-stage-item active';
      dot.innerHTML = '<span class="parse-spinner"></span>';
    } else {
      el.className = 'parse-stage-item';
      dot.innerHTML = '<span class="dot"></span>';
    }
  }
}

function simulateParseResult(fileName) {
  var baseName = fileName.replace(/\.(sketch|psd|rp)$/i, '') || '未命名组件库';
  // 用文件名作为种子，确保同一文件每次解析结果一致
  var seed = baseName;
  var colorPalettes = [
    ['#5B5EF4', '#22C55E', '#F59E0B', '#EF4444'],
    ['#3B82F6', '#10B981', '#F97316', '#EC4899'],
    ['#8B5CF6', '#06B6D4', '#14B8A6', '#F43F5E'],
    ['#0EA5E9', '#84CC16', '#F97316', '#EC4899'],
    ['#6366F1', '#14B8A6', '#F59E0B', '#EF4444']
  ];
  var paletteIdx = seedHash(seed) % colorPalettes.length;

  return {
    name: baseName,
    icons: generateIconSet(seed, 50 + (seedHash(seed + 'i') % 40)),
    fonts: generateFontSet(seed, 2 + (seedHash(seed + 'f') % 3)),
    components: generateComponentSet(seed, 12 + (seedHash(seed + 'c') % 14)),
    sizes: generateSizeSet(seed, 6 + (seedHash(seed + 's') % 5)),
    colors: colorPalettes[paletteIdx]
  };
}

function showParseDoneResult(result) {
  var stepParsing = document.getElementById('lib-step-parsing');
  var stepDone = document.getElementById('lib-step-done');
  if (stepParsing) stepParsing.style.display = 'none';
  if (stepDone) stepDone.style.display = '';

  // 填充统计数字（result.icons/fonts/components/sizes 现在是数组）
  var statsEl = document.getElementById('lib-parse-stats');
  if (statsEl) {
    statsEl.innerHTML =
      '<div class="parse-stat"><span class="parse-stat-value">' + result.icons.length + '</span><span class="parse-stat-label">图标</span></div>' +
      '<div class="parse-stat"><span class="parse-stat-value">' + result.fonts.length + '</span><span class="parse-stat-label">字体</span></div>' +
      '<div class="parse-stat"><span class="parse-stat-value">' + result.components.length + '</span><span class="parse-stat-label">组件</span></div>' +
      '<div class="parse-stat"><span class="parse-stat-value">' + result.sizes.length + '</span><span class="parse-stat-label">字号</span></div>';
  }

  // 填充色板（支持 Framo 对象格式 {value: "#hex"}）
  var colorsEl = document.getElementById('lib-parse-colors');
  if (colorsEl) {
    colorsEl.style.display = '';
    colorsEl.innerHTML = '<span class="parse-result-label">提取色板：</span>' +
      '<div class="parse-color-dots">' + result.colors.map(function(c) {
        var hex = (typeof c === 'string') ? c : (c.value || '#ccc');
        return '<span class="parse-color-dot" style="background:' + hex + '" title="' + hex + '"></span>';
      }).join('') + '</div>';
  }
}

// ===== 确认创建（支持 Framo API 数据格式）=====
window.confirmCreateLibrary = function() {
  if (!window.libParseResult) return;

  var nameInput = document.getElementById('lib-name-input');
  var libraryName = (nameInput ? nameInput.value : '') || window.libParseResult.name;

  var result = window.libParseResult;
  var icons = result.icons || [];
  var fonts = result.fonts || [];
  var components = result.components || [];
  var sizes = result.sizes || [];
  var colors = result.colors || [];

  // 关闭弹窗
  var modal = document.getElementById('new-library-modal');
  if (modal) modal.remove();

  // 使用服务端 Framo 解析结果刷新列表；不再写入旧 localStorage 副本。
  renderLibraryPage();

  showToast('组件库「' + libraryName + '」创建成功', 'success');
};

// ===== 工具函数 =====
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var k = 1024;
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

// ===== 导出全局函数 =====
window.renderLibraryPage = renderLibraryPage;
window.showNewLibraryModal = showNewLibraryModal;

// ===== 设计系统详情页 - 4个Tab =====

var currentDSTab = 'icons'; // icons | fonts | components | sizes | colors
var currentDS = null;       // 当前正在查看的设计系统对象
var dsIconSearch = '';
var dsIconFilter = 'all'; // all | line | solid

// SVG 图标映射（覆盖全量池中所有图标名）
// ===== 图标 SVG 生成器 =====
// 为 FULL_ICON_POOL 中每个图标生成对应的 SVG
function buildIconSVGMap() {
  var map = {};

  // 基础已知图标的 SVG（保持原有映射）
  var knownSVGs = {
    home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>',
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    mail: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    upload: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    download: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    edit: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    delete: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    share: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    unlock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>',
    eye: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    'eye-off': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    minus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    'arrow-up': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/></svg>',
    'arrow-down': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19,12 12,19 5,12"/></svg>',
    'arrow-left': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>',
    'arrow-right': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>',
    refresh: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
    copy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    paste: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    link: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
    image: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>',
    video: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23,7 16,12 23,17 23,7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    folder: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    star: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
    filter: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/></svg>',
    sort: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="21" y2="12"/><line x1="11" y1="18" x2="21" y2="18"/></svg>',
    grid: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    list: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    camera: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    mic: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    location: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    map: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2 1,6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
    tag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    bookmark: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
    flag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-3V3s-1 1-4 1-5-2-8-2-4 1-4 3z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    zap: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>',
    gift: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5" rx="2"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>'
  };

  // ═══ 通用图标 SVG 模板池（用哈希选取）═══
  var SHAPE_TEMPLATES = [
    // 几何形状
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>',       // 0: 圆形
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 22,22 2,22"/></svg>',  // 1: 三角形
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>', // 2: 方框
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9"/></svg>', // 3: 五角星
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>', // 4: 分层
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>', // 5: 书
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 6.5L12 13 2 6.5 12 0l10 6.5zM2 17.5l10 6.5 10-6.5M2 12l10 6.5L22 12"/></svg>', // 6: 层叠
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>', // 7: 闪电
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>', // 8: 建筑
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' // 9: 显示器
  ];

  // 将 knownSVGs 合并到 map
  Object.keys(knownSVGs).forEach(function(k) { map[k] = knownSVGs[k]; });

  // 为 FULL_ICON_POOL 中尚未有 SVG 的名称自动生成
  FULL_ICON_POOL.forEach(function(icon) {
    if (!map[icon.name]) {
      var idx = Math.abs(seedHash(icon.name)) % SHAPE_TEMPLATES.length;
      map[icon.name] = SHAPE_TEMPLATES[idx];
    }
  });

  return map;
}

var iconSVGMap = buildIconSVGMap();

// 默认字体数据（fallback）
var DEFAULT_FONTS = [
  { name: 'PingFang SC', family: 'sans-serif', weights: ['Regular (400)', 'Medium (500)', 'Semibold (600)'], sample: '原型协作平台', category: '系统字体' },
  { name: 'Inter', family: 'sans-serif', weights: ['Regular (400)', 'Medium (500)', 'Bold (700)'], sample: 'ProtoPlatform Design', category: '西文字体' },
  { name: 'Noto Sans SC', family: 'sans-serif', weights: ['Regular (400)', 'Medium (500)'], sample: '高质量设计系统', category: '中文字体' },
  { name: 'Roboto Mono', family: 'monospace', weights: ['Regular (400)', 'Medium (500)'], sample: 'const value = 42;', category: '等宽字体' }
];

// 默认组件数据（fallback）
var DEFAULT_COMPONENTS = [
  { name:'主按钮', category:'按钮', type:'primary', props:'Primary Button', css:'.btn-primary{background:#5B5EF4;color:#fff}' },
  { name:'次要按钮', category:'按钮', type:'ghost', props:'Secondary Button', css:'.btn-ghost{border:1px solid #E8AEF}' },
  { name:'危险按钮', category:'按钮', type:'danger', props:'Danger Button', css:'.btn-danger{background:#FF6B6B}' },
  { name:'小按钮', category:'按钮', type:'sm', props:'Small Button', css:'.btn-sm{padding:4px 10px;font-size:12px}' },
  { name:'输入框', category:'表单', type:'input', props:'Placeholder text', css:'.input{border:1px solid #E8AEF}' },
  { name:'下拉选择', category:'表单', type:'select', props:'请选择', css:'select{appearance:none}' },
  { name:'多行文本', category:'表单', type:'textarea', props:'请输入描述...', css:'textarea{resize:vertical}' },
  { name:'复选框', category:'表单', type:'checkbox', props:'☑ 选项文本', css:'input[type=checkbox]{}' },
  { name:'卡片', category:'容器', type:'card', props:'Card Container', css:'.card{border-radius:12px}' },
  { name:'弹窗', category:'容器', type:'modal', props:'Modal Dialog', css:'.modal{max-width:480px}' },
  { name:'标签', category:'展示', type:'badge', props:'New', css:'.badge{font-size:10px;padding:2px 6px}' },
  { name:'头像', category:'展示', type:'avatar', props:'U', css:'.avatar{border-radius:50%}' },
  { name:'导航项', category:'导航', type:'nav-item', props:'菜单项', css:'.nav-item{padding:10px 12px}' },
  { name:'面包屑', category:'导航', type:'breadcrumb', props:'首页 > 项目 > 详情', css:'.breadcrumb{gap:8px}' },
  { name:'提示框', category:'反馈', type:'tooltip', props:'提示信息', css:'.tooltip{position:absolute}' },
  { name:'加载中', category:'反馈', type:'spinner', props:'⏳ Loading...', css:'@keyframes spin{to{rotate:360deg}}' }
];

// 默认字号数据（fallback）
var DEFAULT_SIZES = [
  { name:'标题 1', tag:'h1', size:'32px', lineHeight:'40px', weight:'600', usage:'页面主标题' },
  { name:'标题 2', tag:'h2', size:'24px', lineHeight:'32px', weight:'600', usage:'区块标题' },
  { name:'标题 3', tag:'h3', size:'18px', lineHeight:'26px', weight:'600', usage:'卡片标题' },
  { name:'标题 4', tag:'h4', size:'16px', lineHeight:'24px', weight:'600', usage:'段落标题' },
  { name:'正文大', tag:'p-lg', size:'15px', lineHeight:'22px', weight:'400', usage:'大段正文' },
  { name:'正文', tag:'p', size:'14px', lineHeight:'20px', weight:'400', usage:'常规正文' },
  { name:'正文小', tag:'p-sm', size:'13px', lineHeight:'18px', weight:'400', usage:'辅助文本' },
  { name:'说明文字', tag:'caption', size:'12px', lineHeight:'16px', weight:'400', usage:'说明/标注' },
  { name:'微小文字', tag:'tiny', size:'10px', lineHeight:'14px', weight:'400', usage:'角标/水印' }
];

// 获取当前DS的数据，fallback 到默认值
// 支持 Framo 格式: icons 有 {paths[], name, color, width, height}
function getDSIcons() {
  if (currentDS && currentDS.icons && currentDS.icons.length > 0) return currentDS.icons;
  return [];
}
function getDSFonts()   { return (currentDS && currentDS.fonts && currentDS.fonts.length > 0) ? currentDS.fonts : DEFAULT_FONTS; }
function getDSComponents() { return (currentDS && currentDS.components && currentDS.components.length > 0) ? currentDS.components : DEFAULT_COMPONENTS; }
function getDSSizes()  { return (currentDS && currentDS.sizes && currentDS.sizes.length > 0) ? currentDS.sizes : DEFAULT_SIZES; }
function getDSColors() { return (currentDS && currentDS.colors && currentDS.colors.length > 0) ? currentDS.colors : []; }
function getDSTextStyles() { return (currentDS && currentDS.textStyles) || []; }
function getDSLayerStyles() { return (currentDS && currentDS.layerStyles) || []; }
function getDSTokens() {
  // 优先使用 Framo 的 tokens
  if (currentDS && currentDS.tokens) return currentDS.tokens;
  // fallback：从颜色列表提取
  var colors = getDSColors();
  return {
    colorPrimary: (colors.length > 0 && typeof colors[0] === 'string') ? colors[0] : (colors.length > 0 ? colors[0].value : '#5B5EF4'),
    colorSurface: '#FFFFFF',
    borderRadius: '8px',
    fontSizeBase: 14,
    spacingBase: 8
  };
}
function getDSStats() {
  // 优先使用 Framo 的 stats
  if (currentDS && currentDS.stats) {
    return {
      icons: currentDS.stats.icons || (currentDS.icons ? currentDS.icons.length : 0),
      fonts: currentDS.stats.fonts || (currentDS.fonts ? currentDS.fonts.length : 0),
      components: currentDS.stats.components || (currentDS.components ? currentDS.components.length : 0),
      colors: currentDS.stats.colors || (currentDS.colors ? currentDS.colors.length : 0),
      sizes: currentDS.stats.fontSizes || (currentDS.sizes ? currentDS.sizes.length : 0)
    };
  }
  return {
    icons: (currentDS && currentDS.icons) ? currentDS.icons.length : 0,
    fonts: (currentDS && currentDS.fonts) ? currentDS.fonts.length : 0,
    components: (currentDS && currentDS.components) ? currentDS.components.length : 0,
    colors: (currentDS && currentDS.colors) ? currentDS.colors.length : 0,
    sizes: (currentDS && currentDS.sizes) ? currentDS.sizes.length : 0
  };
}

// ===== 初始化设计系统（必须在所有模板数据定义之后）=====
designSystems = loadDesignSystems();

// 查找设计系统
function findDesignSystemById(id) {
  for (var i = 0; i < designSystems.length; i++) {
    if (designSystems[i].id === id) return designSystems[i];
  }
  return null;
}

// Tab 图标 SVG
function getTabIconSVG(key) {
  var icons = {
    icons: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    fonts: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,7 4,4 20,4 20,7"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/></svg>',
    components: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="20" height="8" rx="1"/></svg>',
    sizes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="4" x2="20" y2="4"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="20" x2="18" y2="20"/></svg>',
    colors: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>',
    tokens: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,7 4,4 20,4 20,7"/><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="11" y1="4" x2="11" y2="20"/></svg>'
  };
  return icons[key] || '';
}

// 渲染设计系统详情页
function renderDesignSystemDetail(dsId) {
  var mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  var ds = findDesignSystemById(dsId);
  if ((!ds || (/^lib-sketch-/.test(String(dsId || '')) && !ds.isServerLibrary)) && typeof loadFramoLibrariesForMainUI === 'function') {
    mainContent.innerHTML = '<div class="library library-detail-page"><div class="empty-state"><p>正在加载组件库资产...</p></div></div>';
    loadFramoLibrariesForMainUI().then(function(list) {
      if (list && list.length) {
        designSystems = list;
        window.designSystems = designSystems;
      }
      renderDesignSystemDetail(dsId);
    }).catch(function(err) {
      console.error('Load library detail failed:', err);
      showToast('组件库详情加载失败', 'error');
      currentDS = ds;
      mainContent.innerHTML = renderDetailHTML(ds);
      bindDetailEvents();
    });
    return;
  }

  currentDS = ds;  // ★ 关键：记录当前查看的 DS，后续渲染函数从中取数据
  currentDSTab = 'icons';
  dsIconSearch = '';
  dsIconFilter = 'all';

  // 隐藏 header 右侧新建按钮
  var headerRight = document.querySelector('.header-right');
  if (headerRight) {
    var btns = headerRight.querySelectorAll(':scope > *');
    btns.forEach(function(btn) { btn.style.display = 'none'; });
  }

  mainContent.innerHTML = renderDetailHTML(ds);
  bindDetailEvents();
}

function renderDetailHTML(ds) {
  var dsName = ds ? ds.name : '未知';
  var dsDesc = ds ? '组件库 ID: ' + ds.id + ' — 完整的设计系统定义，包含图标、字体、组件和字号规范' : '';

  // 使用当前 DS 的图标数据（fallback 到默认池）
  var dsIcons = getDSIcons();
  var filteredIcons = dsIcons.filter(function(icon) {
    var meta = getReadableIconMeta(icon);
    var haystack = [meta.name, meta.category, meta.title, icon.label || ''].join(' ').toLowerCase();
    var matchSearch = !dsIconSearch || haystack.indexOf(dsIconSearch.toLowerCase()) !== -1;
    var matchFilter = dsIconFilter === 'all' || icon.type === dsIconFilter;
    return matchSearch && matchFilter;
  });

  // 构建 tab 按钮（Framo 风格 + 共享样式）
  var tabs = [
    { key: 'icons', label: '图标' },
    { key: 'fonts', label: '字体' },
    { key: 'sizes', label: '字号' },
    { key: 'components', label: '组件' },
    { key: 'colors', label: '颜色' },
    { key: 'styles', label: '共享样式' },
    { key: 'tokens', label: 'Token' }
  ];

  var tabsHTML = tabs.map(function(tab) {
    return '<button class="ds-tab' + (currentDSTab === tab.key ? ' active' : '') + '" data-dstab="' + tab.key + '">' +
      getTabIconSVG(tab.key) + '<span>' + tab.label + '</span></button>';
  }).join('');

  // 统计信息（Framo asset-stats 风格）
  var stats = getDSStats();
  var styleCount = (getDSTextStyles().length + getDSLayerStyles().length) || 0;
  var statsHTML = '<div class="ds-stats">' +
    '<span><strong>' + (stats.components || 0) + '</strong> 组件</span>' +
    '<span><strong>' + (stats.icons || 0) + '</strong> 图标</span>' +
    '<span><strong>' + (stats.fonts || 0) + '</strong> 字体</span>' +
    '<span><strong>' + (stats.colors || 0) + '</strong> 颜色</span>' +
    '<span><strong>' + styleCount + '</strong> 共享样式</span>' +
  '</div>';

  // 根据当前 tab 构建内容
  var contentHTML = '';
  if (currentDSTab === 'icons') {
    contentHTML = renderIconsTab(filteredIcons);
  } else if (currentDSTab === 'fonts') {
    contentHTML = renderFontsTab();
  } else if (currentDSTab === 'components') {
    contentHTML = renderComponentsTab();
  } else if (currentDSTab === 'sizes') {
    contentHTML = renderSizesTab();
  } else if (currentDSTab === 'colors') {
    contentHTML = renderColorsTab();
  } else if (currentDSTab === 'styles') {
    contentHTML = renderStylesTab();
  } else if (currentDSTab === 'tokens') {
    contentHTML = renderTokensTab();
  }

  return '<div class="ds-detail">' +
    // Header
    '<div class="ds-header">' +
      '<div class="ds-header-left">' +
        '<button class="btn btn-ghost ds-back-btn">← 返回</button> ' +
        '<div>' +
          '<h2>' + escapeHTML(dsName) + '</h2>' +
          '<p class="text-muted">' + dsDesc + '</p>' +
        '</div>' +
      '</div>' + statsHTML + 
    '</div>' +
      '<div class="ds-header-actions">' +
        '<button class="btn btn-ghost" onclick="renameDesignSystem(\'' + ds.id + '\')" title="重命名">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          ' 重命名' +
        '</button>' +
        '<button class="btn btn-ghost" onclick="deleteDesignSystem(\'' + ds.id + '\')" title="删除" style="color:#EF4444">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
          ' 删除' +
        '</button>' +
      '</div>' +
    '</div>' +

    // Tabs
    '<div class="ds-tabs">' + tabsHTML + '</div>' +

    // Content
    '<div class="ds-content" id="ds-content-area">' + contentHTML + '</div>' +
  '</div>';
}

function getReadableIconName(rawName) {
  var clean = function(v) {
    return String(v || '').replace(/^\s*\d+[.、]\s*/, '').replace(/备份\s*\d*$/i, '').replace(/\s+/g, ' ').trim();
  };
  var parts = String(rawName || '').split(/[\/／]/).map(clean).filter(Boolean);
  var generic = /^(base基础|icon图标|icon|ico|action|normal|tips|navigation|application|file|rd|chart|default|编组|group)$/i;
  for (var i = parts.length - 1; i >= 0; i--) {
    if (!parts[i] || /^\d+$/.test(parts[i]) || generic.test(parts[i])) continue;
    return parts[i];
  }
  return clean(parts[parts.length - 1] || rawName || 'icon');
}

function getReadableIconMeta(icon) {
  var full = icon.fullName || icon.name || '';
  var name = getReadableIconName(icon.name || full);
  var category = icon.category || '';
  if (!category && full) {
    var parts = full.split(/[\/／]/).map(getReadableIconName).filter(Boolean);
    category = parts.length > 1 ? parts[parts.length - 2] : '';
  }
  if (!category || category === name) category = icon.type === 'solid' ? '面性' : '线性';
  return { name: name, category: category, title: full || name };
}

function renderIconsTab(icons) {
  if (!icons || icons.length === 0) {
    return '<section class="ds-section">' +
      '<div class="ds-section-header">' +
        '<h3>图标库</h3>' +
        '<span class="ds-count">0 个图标</span>' +
        '<div class="ds-search">' +
          '<input type="text" class="input ds-search-input" id="ds-icon-search" placeholder="搜索图标..." value="' + escapeHTML(dsIconSearch) + '" />' +
        '</div>' +
      '</div>' +
      '<div class="empty-state"><p>未识别到图标</p></div>' +
    '</section>';
  }

  var cardsHTML = icons.map(function(icon) {
    var iconMeta = getReadableIconMeta(icon);
    // ===== 优先使用 sketchtool 导出的真实 SVG；生产环境没有 sketchtool 时，
    // 先按可读图标名匹配内置 SVG，再降级到 JSON path，避免旧版 Sketch
    // transform 信息不完整导致图标碎片化显示。=====
    var svg = '';
    if (icon.previewUrl) {
      svg = '<img src="' + escapeHTML(icon.previewUrl) + '" alt="" loading="lazy" />';
    } else if (icon.svg) {
      svg = icon.svg;
    } else if (iconSVGMap[iconMeta.name] || iconSVGMap[icon.name]) {
      svg = iconSVGMap[iconMeta.name] || iconSVGMap[icon.name];
    } else if (icon.paths && icon.paths.length > 0) {
      var c = icon.color || '#333';
      var w = icon.width || 24;
      var h = icon.height || 24;
      var pts = icon.paths.map(function(p) { return '<path d="' + escapeHTML(p) + '" fill="' + c + '" fill-rule="evenodd" clip-rule="evenodd" stroke="none"/>'; }).join('');
      svg = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' + pts + '</svg>';
    } else {
      // 旧格式：使用 iconSVGMap 或 inline SVG
      svg = iconSVGMap[iconMeta.name] || iconSVGMap[icon.name] || '';
    }
    // 截断过长的名称
    var displayName = iconMeta.name;
    if (displayName.length > 20) displayName = displayName.slice(0, 18) + '…';
    var displayLabel = icon.label && icon.label !== icon.name ? getReadableIconName(icon.label) : iconMeta.category;
    if (displayLabel && displayLabel.length > 25) displayLabel = displayLabel.slice(0, 23) + '…';
    return '<div class="icon-card">' +
      '<div class="icon-preview">' + svg + '</div>' +
      '<div class="icon-info">' +
        '<span class="icon-name" title="' + escapeHTML(iconMeta.title) + '">' + escapeHTML(displayName) + '</span>' +
        (displayLabel && displayLabel !== displayName ? '<span class="icon-label" title="' + escapeHTML(displayLabel) + '">' + escapeHTML(displayLabel) + '</span>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  return '<section class="ds-section">' +
    '<div class="ds-section-header">' +
      '<h3>图标库</h3>' +
      '<span class="ds-count">' + icons.length + ' 个图标</span>' +
      '<div class="ds-search">' +
        '<input type="text" class="input ds-search-input" id="ds-icon-search" placeholder="搜索图标..." value="' + escapeHTML(dsIconSearch) + '" />' +
      '</div>' +
    '</div>' +
    '<div class="ds-tags">' +
      '<button class="ds-tag' + (dsIconFilter === 'all' ? ' active' : '') + '" data-filter="all">全部</button>' +
      '<button class="ds-tag' + (dsIconFilter === 'line' ? ' active' : '') + '" data-filter="line">线性</button>' +
      '<button class="ds-tag' + (dsIconFilter === 'solid' ? ' active' : '') + '" data-filter="solid">面性</button>' +
    '</div>' +
    '<div class="icons-grid">' + (cardsHTML || '<div class="empty-state" style="grid-column:1/-1"><p>未找到匹配的图标</p></div>') + '</div>' +
  '</section>';
}

function renderFontsTab() {
  var fonts = getDSFonts();  // ★ 从当前 DS 取字体数据
  var listHTML = fonts.map(function(font) {
    // 支持 Framo 格式（使用 family 作为显示名）和旧格式（使用 name）
    var displayName = font.family || font.name || 'Unknown';
    var familyStr = font.family || displayName;
    var displaySample = font.sample || 'Aa 字体预览';
    // 字重视图：Framo 格式的 weights 是数字数组 [400,500,700]
    var weightTags = (font.weights || []).map(function(w) {
      var label = (typeof w === 'number') ? 'Weight ' + w : w;
      return '<span class="font-weight-tag">' + label + '</span>';
    }).join('');

    var sizeInfo = '';
    if (font.sizes && font.sizes.length > 0) {
      sizeInfo = '<div class="font-meta"><span class="meta-label">字号：</span><span>' + font.sizes.slice(0, 5).join(', ') + (font.sizes.length > 5 ? '…' : '') + '</span></div>';
    }

    return '<div class="font-card">' +
      '<div class="font-header">' +
        '<h4>' + escapeHTML(displayName) + '</h4>' +
        '<span class="font-category">' + escapeHTML(font.category || '字体') + '</span>' +
      '</div>' +
      '<div class="font-sample" style="font-family:\'' + escapeHTML(familyStr) + '\', sans-serif">' + escapeHTML(displaySample.slice(0, 30)) + '</div>' +
      '<div class="font-meta"><span class="meta-label">字重：</span>' + weightTags + '</div>' +
      sizeInfo +
      (font.count ? '<div class="font-meta"><span class="meta-label">使用：</span><span>' + font.count + ' 次</span></div>' : '') +
    '</div>';
  }).join('');

  return '<section class="ds-section">' +
    '<div class="ds-section-header"><h3>字体规范</h3><span class="ds-count">' + fonts.length + ' 款字体</span></div>' +
    '<div class="fonts-list">' + listHTML + '</div>' +
  '</section>';
}

function renderComponentsTab() {
  var components = getDSComponents();  // ★ 从当前 DS 取组件数据
  function getPreviewStyle(type) {
    var styles = {
      primary:   'background:#5B5EF4;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;display:inline-block;',
      ghost:     'border:1px solid #E8EAEF;color:#666;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;display:inline-block;',
      danger:    'background:#FF6B6B;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;display:inline-block;',
      sm:        'background:#5B5EF4;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:500;display:inline-block;',
      input:     'border:1px solid #E8EAEF;color:#999;padding:8px 12px;border-radius:6px;font-size:13px;width:100%;box-sizing:border-box;',
      select:    'border:1px solid #E8EAEF;color:#999;padding:8px 12px;border-radius:6px;font-size:13px;width:100%;box-sizing:border-box;background:#fff;',
      textarea:  'border:1px solid #E8EAEF;color:#999;padding:8px 12px;border-radius:6px;font-size:13px;width:100%;min-height:48px;box-sizing:border-box;',
      checkbox:  '',
      card:      'background:#fff;border:1px solid #E8EAEF;border-radius:8px;padding:12px;font-size:13px;color:#333;box-shadow:0 1px 4px rgba(0,0,0,.08);width:100%;box-sizing:border-box;',
      modal:     'background:#fff;border:1px solid #E8EAEF;border-radius:8px;padding:12px 16px;font-size:13px;font-weight:600;color:#333;box-shadow:0 4px 16px rgba(0,0,0,.12);width:100%;box-sizing:border-box;text-align:center;',
      badge:     'background:#5B5EF4;color:#fff;font-size:10px;padding:2px 8px;border-radius:8px;font-weight:600;display:inline-block;',
      avatar:    'width:32px;height:32px;background:linear-gradient(135deg,#F59E0B,#EF4444);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:12px;',
      'nav-item':'padding:8px 12px;background:#f5f7fa;border-radius:6px;font-size:13px;color:#333;width:100%;box-sizing:border-box;display:block;',
      breadcrumb:'font-size:12px;color:#999;gap:4px;display:flex;',
      tooltip:  'background:#333;color:#fff;font-size:11px;padding:4px 8px;border-radius:4px;display:inline-block;',
      spinner:  'width:20px;height:20px;border:2px solid #E8EAEF;border-top-color:#5B5EF4;border-radius:50%;display:inline-block;',
      'icon-btn':'width:32px;height:32px;border:1px solid #E8EAEF;border-radius:8px;display:flex;align-items:center;justify-content:center;',
      toggle:   'width:40px;height:24px;border-radius:12px;background:#ccc;position:relative;',
      drawer:   'background:#fff;border:1px solid #E8EAEF;border-radius:8px;padding:16px;width:280px;box-sizing:border-box;',
      empty:    'text-align:center;padding:32px;color:#999;',
      'progress-bar':'height:6px;border-radius:3px;background:#E8EAEF;position:relative;overflow:hidden;',
      table:    'width:100%;border-collapse:collapse;border:1px solid #E8EAEF;',
      tabs:     'display:flex;gap:0;border-bottom:2px solid #E8EAEF;',
      steps:    'display:flex;gap:16px;',
      timeline: 'border-left:2px solid #E8EAEF;padding-left:16px;',
      'stat-card':'background:linear-gradient(135deg,#5B5EF4,#8B5CF6);color:#fff;padding:20px;border-radius:8px;',
      'avatar-group':'display:flex;',
      rating:   'letter-spacing:2px;'
    };
    return styles[type] || '';
  }

  // 为自定义组件（symbol/group）生成缩略图预览
  function getCustomCompPreview(name, category) {
    var colors = ['#5B5EF4','#22C55E','#F59E0B','#EF4444','#A855F7','#06B6D4','#8B5CF6','#EC4899'];
    var colorIdx = Math.abs(seedHash(name)) % colors.length;
    var bgColor = colors[colorIdx];
    var cat = (category || '').toLowerCase();

    // 根据分类生成不同样式的缩略图预览
    var previewHTML;
    if (cat.indexOf('按钮') >= 0 || cat.indexOf('btn') >= 0) {
      previewHTML = '<div style="display:inline-flex;gap:6px"><div style="padding:6px 14px;background:' + bgColor + ';border-radius:4px;color:#fff;font-size:11px;font-weight:500">Button</div><div style="padding:6px 14px;border:1px solid ' + bgColor + '44;border-radius:4px;color:' + bgColor + ';font-size:11px">Ghost</div></div>';
    } else if (cat.indexOf('表单') >= 0 || cat.indexOf('input') >= 0 || cat.indexOf('form') >= 0) {
      previewHTML = '<div style="display:flex;flex-direction:column;gap:6px;width:100%"><div style="height:8px;width:40%;background:' + bgColor + '44;border-radius:3px"></div><div style="height:28px;border:1px solid ' + bgColor + '44;border-radius:4px;display:flex;align-items:center;padding:0 10px;font-size:10px;color:' + bgColor + '88">Placeholder</div></div>';
    } else if (cat.indexOf('容器') >= 0 || cat.indexOf('card') >= 0 || cat.indexOf('modal') >= 0) {
      previewHTML = '<div style="background:#fff;border:1px solid ' + bgColor + '33;border-radius:6px;padding:10px;width:100%"><div style="display:flex;gap:6px;margin-bottom:8px"><div style="width:24px;height:24px;border-radius:4px;background:' + bgColor + '33"></div><div><div style="height:8px;width:60px;background:' + bgColor + '33;border-radius:3px;margin-bottom:4px"></div><div style="height:6px;width:40px;background:' + bgColor + '22;border-radius:3px"></div></div></div><div style="height:6px;width:100%;background:' + bgColor + '11;border-radius:3px;margin-bottom:4px"></div><div style="height:6px;width:80%;background:' + bgColor + '11;border-radius:3px"></div></div>';
    } else if (cat.indexOf('导航') >= 0 || cat.indexOf('nav') >= 0 || cat.indexOf('tab') >= 0) {
      previewHTML = '<div style="display:flex;gap:4px;width:100%"><div style="flex:1;padding:6px 0;text-align:center;font-size:10px;color:#fff;background:' + bgColor + ';border-radius:4px;font-weight:500">Nav</div><div style="flex:1;padding:6px 0;text-align:center;font-size:10px;color:' + bgColor + ';border:1px solid ' + bgColor + '44;border-radius:4px">Item</div></div>';
    } else if (cat.indexOf('数据') >= 0 || cat.indexOf('table') >= 0 || cat.indexOf('list') >= 0) {
      previewHTML = '<div style="width:100%"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:4px"><div style="height:6px;background:' + bgColor + '44;border-radius:3px"></div><div style="height:6px;background:' + bgColor + '44;border-radius:3px"></div><div style="height:6px;background:' + bgColor + '44;border-radius:3px"></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px"><div style="height:6px;background:' + bgColor + '22;border-radius:3px"></div><div style="height:6px;background:' + bgColor + '22;border-radius:3px"></div><div style="height:6px;background:' + bgColor + '22;border-radius:3px"></div></div></div>';
    } else if (cat.indexOf('展示') >= 0 || cat.indexOf('avatar') >= 0 || cat.indexOf('badge') >= 0) {
      previewHTML = '<div style="display:flex;align-items:center;gap:8px"><div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,' + bgColor + ',' + colors[(colorIdx+3)%colors.length] + ');display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:600">A</div><div style="padding:2px 8px;background:' + bgColor + '22;border-radius:8px;font-size:9px;color:' + bgColor + ';font-weight:500">Badge</div></div>';
    } else {
      // 默认：生成带名称首字母的色块 + 组件名称标签
      var initials = name.split(/[\s\/-]+/).map(function(w){return w.charAt(0).toUpperCase();}).filter(Boolean).slice(0,3).join('');
      previewHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div style="width:36px;height:36px;border-radius:8px;background:' + bgColor + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:600">' + (initials || name.charAt(0).toUpperCase()) + '</div><span style="font-size:10px;color:' + bgColor + ';font-weight:500;text-align:center;line-height:1.2">' + name.split(/[\s\/-]+/).slice(0,2).join(' ') + '</span></div>';
    }
    return '<div style="width:100%;min-height:72px;background:linear-gradient(135deg,' + bgColor + '11,' + bgColor + '08);border-radius:6px;display:flex;align-items:center;justify-content:center;border:1px solid ' + bgColor + '22;overflow:hidden;padding:10px">' + previewHTML + '</div>';
  }

  var gridHTML = components.map(function(comp) {
    // ===== 检测 Framo 格式（有 fullName/category/variantCount）=====
    var isFramo = comp.fullName || comp.variantCount !== undefined;
    
    if (isFramo) {
      // Framo 格式：只展示名称和分类信息
      var displayName = comp.name || comp.fullName || '';
      if (displayName.indexOf('/') >= 0) displayName = displayName.split('/').pop();
      var cat = comp.category || '';
      var previewColor = (comp.preview && comp.preview.color) ? comp.preview.color : '#5B5EF4';
      var previewHTML = comp.previewUrl
        ? '<img src="' + escapeHTML(comp.previewUrl) + '" alt="" loading="lazy" />'
        : '<div style="padding:10px 20px;background:' + escapeHTML(previewColor) + ';color:#fff;border-radius:6px;font-size:13px;font-weight:500">' + escapeHTML(displayName) + '</div>';
      return '<div class="component-card">' +
        '<div class="comp-header"><h4>' + escapeHTML(displayName) + '</h4><span class="comp-category">' + escapeHTML(cat) + '</span></div>' +
        '<div class="comp-preview sketch-preview" style="height:96px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,' + escapeHTML(previewColor) + '12,' + escapeHTML(previewColor) + '08);border:1px solid ' + escapeHTML(previewColor) + '22;border-radius:8px;overflow:hidden">' +
          previewHTML +
        '</div>' +
        '<div style="padding:8px 12px;font-size:12px;color:var(--text-muted);display:flex;gap:8px;justify-content:space-between">' +
          '<span>' + escapeHTML(comp.fullName || comp.name || '') + '</span>' +
          '<span>' + (comp.variantCount || 1) + ' 个变体</span>' +
        '</div>' +
      '</div>';
    }

    // ===== 旧格式（mock 数据）=====
    var previewStyle = getPreviewStyle(comp.type);
    var previewTag;
    if (previewStyle) {
      // 已知类型使用 CSS 预览
      previewTag = comp.type === 'checkbox'
        ? '<label style="display:flex;align-items:center;gap:8px;font-size:13px;"><input type="checkbox" checked style="accent-color:#5B5EF4"/> 选项文本</label>'
        : comp.type === 'avatar'
          ? '<div style="' + previewStyle + '">U</div>'
          : comp.type === 'spinner'
            ? '<div style="' + previewStyle + '"></div>'
            : comp.type === 'toggle'
              ? '<div style="' + previewStyle + '"><span style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:.2s"></span></div>'
              : comp.type === 'progress-bar'
                ? '<div style="' + previewStyle + '"><div style="width:70%;height:100%;background:#5B5EF4;border-radius:3px"></div></div>'
                : comp.type === 'rating'
                  ? '<span style="' + previewStyle + '">★★★★☆</span>'
                  : '<span style="' + previewStyle + '">' + comp.props + '</span>';
    } else {
      // 自定义类型 → 色块缩略图
      previewTag = getCustomCompPreview(comp.name, comp.category);
    }

    return '<div class="component-card">' +
      '<div class="comp-header"><h4>' + comp.name + '</h4><span class="comp-category">' + comp.category + '</span></div>' +
      '<div class="comp-preview">' + previewTag + '</div>' +
      (comp.css && comp.css !== '.custom-symbol' && comp.css !== '.custom-component' ? '<div class="comp-css"><code>' + escapeHTML(comp.css) + '</code></div>' : '') +
    '</div>';
  }).join('');

  return '<section class="ds-section">' +
    '<div class="ds-section-header"><h3>组件</h3><span class="ds-count">' + components.length + ' 个组件</span></div>' +
    '<div class="components-grid">' + gridHTML + '</div>' +
  '</section>';
}

function renderSizesTab() {
  var sizes = getDSSizes();  // 从当前 DS 取字号数据
  // 按字号从大到小排序
  sizes = sizes.slice().sort(function(a, b) {
    var sizeA = parseFloat(a.size) || 0;
    var sizeB = parseFloat(b.size) || 0;
    return sizeB - sizeA;
  });
  var rowsHTML = sizes.map(function(fs) {
    // 支持 Framo 格式：{size, count, samples[]}
    if (fs.samples !== undefined || fs.count !== undefined) {
      var px = fs.size || 0;
      var sample = (fs.samples && fs.samples.length > 0) ? fs.samples[0] : 'Aa';
      return '<tr>' +
        '<td><div class="size-preview" style="font-size:' + Math.min(px, 40) + 'px">' + escapeHTML(sample) + '</div></td>' +
        '<td><code>' + px + 'px</code></td>' +
        '<td>' + px + 'px</td>' +
        '<td>' + Math.round(px * 1.4) + 'px</td>' +
        '<td>400</td>' +
        '<td><span class="size-usage">使用 ' + (fs.count || 0) + ' 次</span></td>' +
      '</tr>';
    }
    // 旧格式
    return '<tr>' +
      '<td><div class="size-preview" style="font-size:' + fs.size + ';line-height:' + fs.lineHeight + ';font-weight:' + fs.weight + '">' + fs.name + '</div></td>' +
      '<td><code>' + fs.tag + '</code></td>' +
      '<td>' + fs.size + '</td>' +
      '<td>' + fs.lineHeight + '</td>' +
      '<td>' + fs.weight + '</td>' +
      '<td><span class="size-usage">' + fs.usage + '</span></td>' +
    '</tr>';
  }).join('');

  return '<section class="ds-section">' +
    '<div class="ds-section-header"><h3>字号规范</h3><span class="ds-count">' + sizes.length + ' 个字号</span></div>' +
    '<div class="sizes-table-wrapper"><table class="sizes-table">' +
      '<thead><tr><th style="width:30%">预览</th><th>标签</th><th>字号</th><th>行高</th><th>字重</th><th>用途</th></tr></thead>' +
      '<tbody>' + rowsHTML + '</tbody>' +
    '</table></div></section>';
}

// ===== 颜色 Tab（Framo 风格）=====
function renderColorsTab() {
  var colors = getDSColors();
  if (!colors || colors.length === 0) {
    return '<section class="ds-section"><div class="ds-section-header"><h3>颜色</h3><span class="ds-count">0 个颜色</span></div><div class="empty-state"><p>该组件库没有颜色数据</p></div></section>';
  }
  var cardsHTML = colors.map(function(item, i) {
    // ===== 支持 Framo 格式：{value, usages[], count, chroma, luminance} =====
    var hex = (typeof item === 'string') ? item : item.value;
    var usageText = '';
    if (typeof item === 'object' && item.usages && item.usages.length > 0) {
      usageText = item.usages[0];
    }
    var count = (typeof item === 'object' && item.count) ? item.count : 0;

    var rgb = '';
    var simpleHex = hex.replace('#', '');
    if (simpleHex.length === 6) {
      var r = parseInt(simpleHex.slice(0,2), 16);
      var g = parseInt(simpleHex.slice(2,4), 16);
      var b = parseInt(simpleHex.slice(4,6), 16);
      if (!isNaN(r)) rgb = r + ',' + g + ',' + b;
    }
    var isLight = false;
    if (rgb) {
      var parts = rgb.split(',');
      var lum = (parseInt(parts[0]) * 299 + parseInt(parts[1]) * 587 + parseInt(parts[2]) * 114) / 1000;
      isLight = lum > 180;
    }
    var role = i === 0 ? 'Primary' : i === 1 ? 'Secondary' : i === 2 ? 'Accent' : i <= 4 ? 'Semantic' : 'Extended';
    var usage = usageText || (i === 0 ? '主色/品牌色' : i === 1 ? '辅助色/成功' : i === 2 ? '强调色/警告' : i <= 4 ? '状态色/错误' : '');
    return '<div class="color-card">' +
      '<div class="color-swatch-large" style="background:' + hex + ';' + (isLight ? 'border:1px solid #e8eaef' : '') + '">' +
        '<span class="color-hex" style="color:' + (isLight ? '#333' : '#fff') + '">' + escapeHTML(hex) + '</span>' +
      '</div>' +
      '<div class="color-info">' +
        '<span class="color-role">' + escapeHTML(role) + '</span>' +
        (rgb ? '<span class="color-rgb">RGB ' + rgb + '</span>' : '') +
        (usage ? '<span class="color-usage">' + escapeHTML(usage) + '</span>' : '') +
        (count > 0 ? '<span class="color-usage">使用 ' + count + ' 次</span>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  return '<section class="ds-section">' +
    '<div class="ds-section-header"><h3>颜色调色板</h3><span class="ds-count">' + colors.length + ' 个颜色</span></div>' +
    '<div class="colors-grid">' + cardsHTML + '</div>' +
  '</section>';
}

// ===== Token Tab（Framo 风格）=====
function renderTokensTab() {
  var tokens = getDSTokens();
  var stats = getDSStats();
  var tokenHTML = Object.keys(tokens).map(function(key) {
    var val = tokens[key];
    var isColor = typeof val === 'string' && val.indexOf('#') === 0;
    var display = isColor ? '<span class="token-color-dot" style="background:' + val + '"></span>' + val : val;
    return '<div class="token-row">' +
      '<code class="token-key">' + escapeHTML(key) + '</code>' +
      '<span class="token-val">' + display + '</span>' +
    '</div>';
  }).join('');

  return '<section class="ds-section">' +
    '<div class="ds-section-header"><h3>Design Tokens</h3><span class="ds-count">' + Object.keys(tokens).length + ' 个 Token</span></div>' +
    '<div class="tokens-panel">' +
      '<div class="tokens-list">' + tokenHTML + '</div>' +
      '<pre class="tokens-json">' + escapeHTML(JSON.stringify(tokens, null, 2)) + '</pre>' +
    '</div>' +
  '</section>';
}

// ===== 共享样式 Tab（Framo 风格：文字样式 + 图层样式）=====
function renderStylesTab() {
  var textStyles = getDSTextStyles();
  var layerStyles = getDSLayerStyles();

  if (textStyles.length === 0 && layerStyles.length === 0) {
    return '<section class="ds-section"><div class="ds-section-header"><h3>共享样式</h3><span class="ds-count">0 个样式</span></div><div class="empty-state"><p>该组件库没有共享样式数据</p></div></section>';
  }

  var cardsHTML = [];
  textStyles.forEach(function(ts) {
    cardsHTML.push('<div class="component-card">' +
      '<div class="comp-header"><h4>' + escapeHTML(ts.name || 'Text Style') + '</h4><span class="comp-category" style="background:#5B5EF422;color:#5B5EF4">文字</span></div>' +
      '<div class="comp-preview" style="text-align:center;padding:16px;font-family:' + escapeHTML(ts.family || 'sans-serif') + ';font-size:' + (ts.size || 14) + 'px;color:' + escapeHTML(ts.color || '#333') + '">Aa 字体预览</div>' +
      '<div style="padding:8px 12px;font-size:12px;color:var(--text-muted)">' + escapeHTML(ts.family || 'System') + ' · ' + (ts.size || 14) + 'px · ' + escapeHTML(ts.color || '') + '</div>' +
    '</div>');
  });
  layerStyles.forEach(function(ls) {
    var bg = ls.color || '#eee';
    cardsHTML.push('<div class="component-card">' +
      '<div class="comp-header"><h4>' + escapeHTML(ls.name || 'Layer Style') + '</h4><span class="comp-category" style="background:#23463F22;color:#23463F">图层</span></div>' +
      '<div class="comp-preview" style="height:60px;background:' + escapeHTML(bg) + ';border-radius:' + (ls.radius || 0) + 'px;border:1px solid rgba(0,0,0,0.07)"></div>' +
      '<div style="padding:8px 12px;font-size:12px;color:var(--text-muted)">' + escapeHTML(bg) + (ls.radius ? ' · radius ' + ls.radius + 'px' : '') + '</div>' +
    '</div>');
  });

  return '<section class="ds-section">' +
    '<div class="ds-section-header"><h3>共享样式</h3><span class="ds-count">' + (textStyles.length + layerStyles.length) + ' 个样式</span></div>' +
    '<div class="components-grid">' + cardsHTML.join('') + '</div>' +
  '</section>';
}

// 绑定详情页事件
function bindDetailEvents() {
  // 返回按钮 - 同时恢复 header 右侧被隐藏的按钮
  var backBtn = document.querySelector('.ds-back-btn');
  if (backBtn) backBtn.onclick = function(e) { 
    e.preventDefault(); 
    currentDS = null;
    // 恢复 header 右侧按钮显示
    var hr = document.querySelector('.header-right');
    if (hr) {
      var hbtns = hr.querySelectorAll(':scope > *');
      hbtns.forEach(function(btn) { btn.style.display = ''; });
    }
    navigateTo('library'); 
  };

  // Tab 切换
  document.querySelectorAll('.ds-tab').forEach(function(tab) {
    tab.onclick = function() {
      currentDSTab = this.getAttribute('data-dstab');
      var contentEl = document.getElementById('ds-content-area');
      if (contentEl) {
        if (currentDSTab === 'icons') {
          var icons = getDSIcons();
          var filtered = icons.filter(function(ic) {
            var meta = getReadableIconMeta(ic);
            var ms = !dsIconSearch || [meta.name, meta.category, meta.title, ic.label || ''].join(' ').toLowerCase().indexOf(dsIconSearch.toLowerCase()) !== -1;
            var mf = dsIconFilter === 'all' || ic.type === dsIconFilter;
            return ms && mf;
          });
          contentEl.innerHTML = renderIconsTab(filtered);
        } else if (currentDSTab === 'fonts') {
          contentEl.innerHTML = renderFontsTab();
        } else if (currentDSTab === 'components') {
          contentEl.innerHTML = renderComponentsTab();
        } else if (currentDSTab === 'sizes') {
          contentEl.innerHTML = renderSizesTab();
        } else if (currentDSTab === 'colors') {
          contentEl.innerHTML = renderColorsTab();
        } else if (currentDSTab === 'styles') {
          contentEl.innerHTML = renderStylesTab();
        } else if (currentDSTab === 'tokens') {
          contentEl.innerHTML = renderTokensTab();
        }
        // 更新 tab 状态
        document.querySelectorAll('.ds-tab').forEach(function(t) {
          t.classList.toggle('active', t.getAttribute('data-dstab') === currentDSTab);
        });
        bindDetailEvents();
      }
    };
  });

  // 图标搜索
  var searchInput = document.getElementById('ds-icon-search');
  if (searchInput) {
    searchInput.oninput = function() {
      dsIconSearch = this.value;
      refreshIconsTab();
    };
  }

  // 分类筛选
  document.querySelectorAll('.ds-tag[data-filter]').forEach(function(tag) {
    tag.onclick = function() {
      dsIconFilter = this.getAttribute('data-filter');
      document.querySelectorAll('.ds-tag[data-filter]').forEach(function(t) {
        t.classList.toggle('active', t.getAttribute('data-filter') === dsIconFilter);
      });
      refreshIconsTab();
    };
  });
}

function refreshIconsTab() {
  var icons = getDSIcons();  // ★ 用当前 DS 的图标
  var filtered = icons.filter(function(ic) {
    var meta = getReadableIconMeta(ic);
    var ms = !dsIconSearch || [meta.name, meta.category, meta.title, ic.label || ''].join(' ').toLowerCase().indexOf(dsIconSearch.toLowerCase()) !== -1;
    var mf = dsIconFilter === 'all' || ic.type === dsIconFilter;
    return ms && mf;
  });
  var contentEl = document.getElementById('ds-content-area');
  if (contentEl) {
    contentEl.innerHTML = renderIconsTab(filtered);
    bindDetailEvents();
  }
}

// 让 DS 卡片可点击跳转
window.renderLibraryPage = (function(origRender) {
  return function() {
    origRender.call(this);

    // 绑定卡片点击事件
    setTimeout(function() {
      document.querySelectorAll('.ds-card[data-id]').forEach(function(card) {
        card.style.cursor = 'pointer';
        card.onclick = function() {
          var id = this.getAttribute('data-id');
          navigateTo('library-detail', { id: id });
        };
      });
    }, 0);
  };
})(renderLibraryPage);

// 导出详情渲染函数
window.renderDesignSystemDetail = renderDesignSystemDetail;
window.findDesignSystemById = findDesignSystemById;
window.designSystems = designSystems; // 供 AI 生成页面读取设计系统列表
