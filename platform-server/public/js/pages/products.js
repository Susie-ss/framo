// pages/products.js - 标签页面
let allProductLines = [];
let plAllProjects = [];
let plViewMode = 'grid';
let plSearchKeyword = '';

async function renderProductsPage() {
  plSearchKeyword = '';
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = '<div class="toolbar"><h2>标签</h2><div class="spacer"></div><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-primary" onclick="showNewProductLineModal()"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-plus"/></svg> 新建标签</button><div style="position:relative"><input type="text" id="pl-search" placeholder="搜索标签..." value="'+plSearchKeyword+'" style="padding:8px 12px 8px 32px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;outline:none;background:var(--surface);width:200px" oninput="onPLSearch(this.value)"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;align-items:center"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-search"/></svg></span></div><div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden"><button id="pl-view-grid" onclick="switchPLView(\'grid\')" style="padding:8px 12px;background:var(--surface);color:var(--text-secondary);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-grid"/></svg></button><button id="pl-view-list" onclick="switchPLView(\'list\')" style="padding:8px 12px;background:var(--surface);color:var(--text-secondary);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-list"/></svg></button></div></div></div><div id="pl-content-container"></div>';

  await loadProductLines();
  switchPLView(plViewMode);
}

async function loadProductLines() {
  try {
    const result = await api.get('/api/product-lines');
    if (!result.success) { showToast(result.message || '加载失败', 'error'); return; }
    allProductLines = (result.data && result.data.lines) || [];

    try {
      const projResult = await api.get('/api/projects');
      if (projResult.success) {
        const projData = projResult.data || [];
        plAllProjects = projData.projects || projData;
      }
    } catch (e) {}

    renderPLContent();
    updateSidebarProductLines(allProductLines);
  } catch (err) { showToast('网络错误', 'error'); }
}

function onPLSearch(keyword) { plSearchKeyword = keyword.trim().toLowerCase(); renderPLContent(); }

function getFilteredLines() {
  let lines = plSearchKeyword
    ? allProductLines.filter(pl => pl.name.toLowerCase().includes(plSearchKeyword))
    : [...allProductLines];
  return lines;
}

function switchPLView(mode) {
  plViewMode = mode;
  const gb = document.getElementById('pl-view-grid'), lb = document.getElementById('pl-view-list');
  if (gb) { gb.style.background = mode==='grid'?'var(--primary)':'var(--surface)'; gb.style.color = mode==='grid'?'#fff':'var(--text-secondary)'; gb.classList.toggle('view-btn-active',mode==='grid'); }
  if (lb) { lb.style.background = mode==='list'?'var(--primary)':'var(--surface)'; lb.style.color = mode==='list'?'#fff':'var(--text-secondary)'; lb.classList.toggle('view-btn-active',mode==='list'); }
  renderPLContent();
}

function renderPLContent() {
  const container = document.getElementById('pl-content-container');
  if (!container) return;
  const lines = getFilteredLines();
  if (!lines || lines.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg class="icon-color icon-xl"><use href="/libs/iconpark/icons.svg#ico-tag"/></svg></div><div class="empty-state-text">'+ (plSearchKeyword?'没有匹配的标签':'暂无标签') +'</div><div class="empty-state-hint">'+ (plSearchKeyword?'尝试其他关键词':'点击上方按钮创建第一个标签') +'</div></div>';
    return;
  }
  if (plViewMode === 'grid') renderPLGridView(container, lines);
  else renderPLListView(container, lines);
}

function renderPLGridView(container, lines) {
  container.innerHTML = '<div class="pl-grid-view">'+lines.map(pl => {
    const projectCount = pl.project_count || 0;
    const color = pl.color || '#5B5EF4';
    return '<div class="pl-grid-card" onclick="showPLDetailOverlay(\''+pl.id+'\')">' +
      '<div class="pl-grid-color" style="background:'+color+'"><span class="pl-grid-initials">'+getInitials(pl.name)+'</span></div>' +
      '<div class="pl-grid-footer"><div class="pl-grid-name">'+pl.name+'</div><div class="pl-grid-count">'+projectCount+' 个项目</div></div>' +
      '<div class="pl-grid-actions" onclick="event.stopPropagation()">' +
        '<button class="pl-action-btn" title="添加项目" onclick="showAddProjectModal(\''+pl.id+'\')"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-plus"/></svg></button>' +
        '<button class="pl-action-btn" title="编辑" onclick="showEditPLModal(\''+pl.id+'\')"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-edit"/></svg></button>' +
        '<button class="pl-action-btn" title="删除" onclick="deleteProductLine(\''+pl.id+'\',\''+pl.name.replace(/'/g,"\\'")+'\')"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-delete"/></svg></button>' +
      '</div></div>';
  }).join('')+'</div>';
}

function renderPLListView(container, lines) {
  container.innerHTML = '<div class="pl-list-view">'+lines.map(pl => {
    const projectCount = pl.project_count || 0;
    const color = pl.color || '#5B5EF4';
    const plProjects = getProjectsForLine(pl.id);
    return '<div class="pl-list-item"><div class="pl-list-header" onclick="togglePLListExpand(this)">' +
      '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">' +
        '<span class="pl-list-dot" style="background:'+color+'"></span>' +
        '<span class="pl-list-name">'+pl.name+'</span>' +
        '<span class="pl-list-count">'+projectCount+' 个项目</span>' +
      '</div>' +
      '<div class="pl-list-actions" onclick="event.stopPropagation()">' +
        '<button class="pl-action-btn" title="添加项目" onclick="showAddProjectModal(\''+pl.id+'\')"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-plus"/></svg> 添加项目</button>' +
        '<button class="pl-action-btn" title="编辑" onclick="showEditPLModal(\''+pl.id+'\')"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-edit"/></svg> 编辑</button>' +
        '<button class="pl-action-btn pl-action-btn-danger" title="删除" onclick="deleteProductLine(\''+pl.id+'\',\''+pl.name.replace(/'/g,"\\'")+'\')"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-delete"/></svg> 删除</button>' +
      '</div></div>' +
      '<div class="pl-list-children">'+plProjects.map(p =>
        '<div class="pl-list-project" onclick="navigateTo(\'project-detail\', {id:\''+p.id+'\'})">' +
          '<span class="pl-list-project-icon" style="background:'+color+'">'+getInitials(p.name)+'</span>' +
          '<span class="pl-list-project-name">'+p.name+'</span>' +
          '<span class="pl-list-project-remove" onclick="event.stopPropagation();removeProjectFromLine(\''+p.id+'\',\''+pl.id+'\')">移出</span>' +
        '</div>'
      ).join('') +
      (plProjects.length === 0 ? '<div class="pl-list-empty">暂无项目</div>' : '') +
      '</div></div>';
  }).join('')+'</div>';
}

function togglePLListExpand(header) {
  const item = header.closest('.pl-list-item');
  if (item) item.classList.toggle('expanded');
}

function getProjectsForLine(lineId) {
  return plAllProjects.filter(p => {
    return p.productLines && p.productLines.some(pl => pl.id === lineId);
  });
}

// Detail overlay
function showPLDetailOverlay(lineId) {
  const pl = allProductLines.find(p => p.id === lineId);
  if (!pl) return;
  const projects = getProjectsForLine(lineId);
  const color = pl.color || '#5B5EF4';

  let overlay = document.getElementById('pl-detail-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'pl-detail-overlay';
  overlay.className = 'pl-overlay';
  overlay.innerHTML = '<div class="pl-overlay-content" onclick="event.stopPropagation()">' +
    '<div class="pl-overlay-header"><div style="display:flex;align-items:center;gap:12px">' +
      '<div style="width:36px;height:36px;border-radius:8px;background:'+color+';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px">'+getInitials(pl.name)+'</div>' +
      '<div><div style="font-size:16px;font-weight:600">'+pl.name+'</div><div style="font-size:13px;color:var(--text-muted)">'+projects.length+' 个项目</div></div></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<button class="btn btn-ghost btn-sm" onclick="showAddProjectModal(\''+pl.id+'\')">+ 添加项目</button>' +
        '<button class="modal-close-btn" onclick="closePLOverlay()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button>' +
      '</div></div>' +
    '<div class="pl-overlay-body">' +
      (projects.length === 0 ? '<div class="empty-state" style="padding:40px"><div class="empty-state-icon"><svg class="icon-color icon-xl" style="opacity:.5"><use href="/libs/iconpark/icons.svg#ico-folder-empty"/></svg></div><div class="empty-state-text">暂无项目</div></div>' :
        projects.map(p => '<div class="pl-overlay-project" onclick="closePLOverlay();navigateTo(\'project-detail\', {id:\''+p.id+'\'})">' +
          '<div class="pl-overlay-project-icon" style="background:'+color+'">'+getInitials(p.name)+'</div>' +
          '<div class="pl-overlay-project-info"><div class="pl-overlay-project-name">'+p.name+'</div><div class="pl-overlay-project-meta">更新于 '+formatDate(p.updated_at)+'</div></div>' +
          '<div class="pl-overlay-project-actions" onclick="event.stopPropagation()"><button class="pl-action-btn" title="移出标签" onclick="removeProjectFromLine(\''+p.id+'\',\''+pl.id+'\')">移出</button></div>' +
        '</div>').join('')
      ) +
    '</div></div>';

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePLOverlay(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
}

function closePLOverlay() {
  const overlay = document.getElementById('pl-detail-overlay');
  if (overlay) { overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 200); }
}

// Edit PL modal
function showEditPLModal(id) {
  const pl = allProductLines.find(p => p.id === id);
  if (!pl) return;

  const colors = ['#5B5EF4','#22C55E','#F59E0B','#EF4444','#A855F7','#06B6D4','#8B5CF6'];
  const currentColor = pl.color || '#5B5EF4';

  let modal = document.getElementById('edit-pl-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'edit-pl-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = '<div class="modal" style="width:440px"><div class="modal-header"><div><div style="font-size:15px;font-weight:600">编辑标签</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">修改名称或标识颜色</div></div><button class="modal-close-btn" onclick="document.getElementById(\'edit-pl-modal\').remove()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button></div>' +
    '<div class="form-row"><label>标签名称 <span style="color:#EF4444">*</span></label><input type="text" id="edit-pl-name" value="'+pl.name+'" placeholder="标签名称" /></div>' +
    '<div class="form-row" style="margin-top:14px"><label>标识颜色</label><div style="display:flex;gap:10px;margin-top:4px" id="edit-pl-color-swatches">' +
      colors.map(c => '<div class="color-swatch '+(c===currentColor?'selected':'')+'" style="background:'+c+'" onclick="selectEditPLColor(\''+c+'\', this)"></div>').join('') +
    '</div><input type="hidden" id="edit-pl-color" value="'+currentColor+'" /></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="document.getElementById(\'edit-pl-modal\').remove()">取消</button><button class="btn btn-primary" onclick="saveEditPL(\''+id+'\')">保存</button></div></div>';

  document.body.appendChild(modal);
  modal.querySelector('.modal').addEventListener('click', function(e) { e.stopPropagation(); });
  modal.addEventListener('click', function() { modal.remove(); });
}

function selectEditPLColor(color, el) {
  document.getElementById('edit-pl-color').value = color;
  document.querySelectorAll('#edit-pl-color-swatches .color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

async function saveEditPL(id) {
  const name = document.getElementById('edit-pl-name')?.value?.trim();
  const color = document.getElementById('edit-pl-color')?.value || '#5B5EF4';
  if (!name) { showToast('请输入标签名称', 'error'); return; }
  try {
    const result = await api.put('/api/product-lines/'+id, { name, color });
    if (result.success) { showToast('更新成功', 'success'); document.getElementById('edit-pl-modal')?.remove(); await loadProductLines(); }
    else showToast(result.error || '更新失败', 'error');
  } catch (err) { showToast('网络错误', 'error'); }
}

// Add project to line
async function showAddProjectModal(lineId) {
  const pl = allProductLines.find(p => p.id === lineId);
  if (!pl) return;
  const existingIds = getProjectsForLine(lineId).map(p => p.id);
  const availableProjects = plAllProjects.filter(p => !existingIds.includes(p.id));

  let modal = document.getElementById('add-project-pl-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'add-project-pl-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = '<div class="modal" style="width:440px"><div class="modal-header"><div><div style="font-size:15px;font-weight:600">添加项目到「'+pl.name+'」</div></div><button class="modal-close-btn" onclick="document.getElementById(\'add-project-pl-modal\').remove()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button></div>' +
    '<div style="max-height:400px;overflow-y:auto">' +
      (availableProjects.length === 0 ? '<div style="text-align:center;padding:30px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:8px;opacity:0.5"><svg class="icon-color icon-xl" style="opacity:.5"><use href="/libs/iconpark/icons.svg#ico-folder-empty"/></svg></div><div>没有可添加的项目</div></div>' :
        availableProjects.map(p => '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px;margin-bottom:8px;transition:all .15s" onmouseover="this.style.borderColor=\'var(--primary)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
          '<input type="checkbox" value="'+p.id+'" class="add-project-checkbox" style="width:16px;height:16px;accent-color:var(--primary)" /><span style="flex:1">'+p.name+'</span></label>').join('')
      ) +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="document.getElementById(\'add-project-pl-modal\').remove()">取消</button><button class="btn btn-primary" onclick="doAddProjectsToLine(\''+lineId+'\')">添加</button></div></div>';

  document.body.appendChild(modal);
  modal.querySelector('.modal').addEventListener('click', function(e) { e.stopPropagation(); });
  modal.addEventListener('click', function() { modal.remove(); });
}

async function doAddProjectsToLine(lineId) {
  const checkboxes = document.querySelectorAll('#add-project-pl-modal .add-project-checkbox:checked');
  const projectIds = Array.from(checkboxes).map(cb => cb.value);
  if (projectIds.length === 0) { showToast('请选择至少一个项目', 'error'); return; }
  try {
    for (const projectId of projectIds) {
      await api.post('/api/product-lines/'+lineId+'/add-project', { projectId });
    }
    showToast('添加成功', 'success');
    document.getElementById('add-project-pl-modal')?.remove();
    await loadProductLines();
  } catch (err) { showToast('添加失败', 'error'); }
}

async function removeProjectFromLine(projectId, lineId) {
  try {
    const result = await api.del('/api/product-lines/'+lineId+'/remove-project/'+projectId);
    if (result.success) { showToast('已移出标签', 'success'); await loadProductLines(); }
    else showToast(result.error || '操作失败', 'error');
  } catch (err) { showToast('网络错误', 'error'); }
}

async function deleteProductLine(id, name) {
  const pl = allProductLines.find(p => p.id === id);
  const projectCount = pl ? (pl.project_count || 0) : 0;
  const msg = '确定要删除标签「'+name+'」吗？' + (projectCount > 0 ? '\n该标签内的 '+projectCount+' 个项目将移除此标签。' : '');
  if (!confirm(msg)) return;
  try {
    const result = await api.del('/api/product-lines/'+id);
    if (result.success) { showToast('删除成功', 'success'); await loadProductLines(); }
    else showToast(result.error || '删除失败', 'error');
  } catch (err) { showToast('网络错误', 'error'); }
}

// Sidebar tag list with edit icon
function updateSidebarProductLines(productLines) {
  const container = document.getElementById('sidebar-product-lines');
  if (!container) return;

  const visible = productLines.slice(0, 10);

  container.innerHTML = visible.map(pl => '' +
    '<div class="sidebar-pl-item" onclick="filterByProductLine(\''+pl.id+'\')">' +
      '<span class="sidebar-pl-dot" style="background:'+(pl.color||'#5B5EF4')+'"></span>' +
      '<span class="sidebar-text">'+pl.name+'</span>' +
      '<button class="sidebar-pl-edit" title="编辑标签" onclick="event.stopPropagation();showEditPLModal(\''+pl.id+'\')"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-edit"/></svg></button>' +
    '</div>'
  ).join('');
}

async function filterByProductLine(id) {
  if (!allProductLines || allProductLines.length === 0) {
    try {
      const result = await api.get('/api/product-lines');
      if (result.success) allProductLines = (result.data && result.data.lines) || [];
    } catch (e) {}
  }
  try {
    const projResult = await api.get('/api/projects');
    if (projResult.success) {
      const projData = projResult.data || [];
      plAllProjects = projData.projects || projData;
    }
  } catch (e) {}
  showPLDetailOverlay(id);
}

window.renderProductsPage = renderProductsPage;
window.loadProductLines = loadProductLines;
window.onPLSearch = onPLSearch;
window.switchPLView = switchPLView;
window.showPLDetailOverlay = showPLDetailOverlay;
window.closePLOverlay = closePLOverlay;
window.showEditPLModal = showEditPLModal;
window.selectEditPLColor = selectEditPLColor;
window.saveEditPL = saveEditPL;
window.showAddProjectModal = showAddProjectModal;
window.doAddProjectsToLine = doAddProjectsToLine;
window.removeProjectFromLine = removeProjectFromLine;
window.deleteProductLine = deleteProductLine;
window.togglePLListExpand = togglePLListExpand;
