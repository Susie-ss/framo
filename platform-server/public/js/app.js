// app.js - 主应用逻辑（UI 交互、模态框、全局状态）
let currentUser = null;
let sidebarCollapsed = false;

// 根据屏幕宽度自动收起/展开侧边栏
let autoCollapseTimer = null;
function autoCollapseSidebar() {
  if (window.innerWidth <= 768) {
    if (!sidebarCollapsed) {
      sidebarCollapsed = true;
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.add('collapsed');
      const icon = document.getElementById('sidebar-toggle-icon');
      if (icon) { const svg = icon.querySelector('use'); if (svg) svg.setAttribute('href', '/libs/iconpark/icons.svg#ico-chevron-right'); }
    }
  }
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  autoCollapseSidebar();
  checkAuthState();
  window.addEventListener('resize', () => {
    clearTimeout(autoCollapseTimer);
    autoCollapseTimer = setTimeout(autoCollapseSidebar, 200);
  });
});

// 检查认证状态
async function checkAuthState() {
  if (isLoggedIn()) {
    try {
      const result = await api.get('/api/auth/me');
      if (result.success) {
        currentUser = result.data;
        showMainUI();
        renderRoute(); // 触发路由渲染
      } else {
        clearTokens();
        showAuthUI();
      }
    } catch (err) {
      clearTokens();
      showAuthUI();
    }
  } else {
    showAuthUI();
  }
}

// 显示认证界面
function showAuthUI() {
  var path = window.location.pathname;
  if (path !== '/login' && path !== '/register' && !path.startsWith('/share')) {
    history.pushState(null, '', '/login');
  }
  renderRoute();
}

// 显示主界面
function showMainUI() {
  const header = document.getElementById('header');
  const layout = document.getElementById('main-layout');
  const authContainer = document.getElementById('auth-container');
  if (header) header.style.display = 'flex';
  if (layout) layout.style.display = 'flex';
  if (authContainer) authContainer.style.display = 'none';
  
  updateHeaderAvatar();
  loadNotificationBadge();
  setInterval(loadNotificationBadge, 60000);

  // 加载产品线列表到侧边栏
  if (typeof loadProductLines === 'function') {
    loadProductLines();
  }
}

// 更新头像
function updateHeaderAvatar() {
  const avatar = document.getElementById('header-avatar');
  if (!avatar) return;

  const user = getCurrentUser();
  if (user && user.username) {
    const userId = user.userId || user.id || '';
    const initial = user.username.charAt(0).toUpperCase();
    avatar.style.display = 'flex';
    avatar.innerHTML = '<img src="/api/users/avatar/' + userId + '?t=' + Date.now() + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + initial + '\'" />';
  } else {
    avatar.style.display = 'none';
  }
}

// ===== 认证相关 =====
async function doLogin() {
  const username = document.getElementById('login-username')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const errEl = document.getElementById('login-error-text');

  if (!username || !password) {
    if (errEl) errEl.textContent = '请输入用户名和密码';
    return;
  }

  try {
    const result = await api.post('/api/auth/login', { username, password });
    if (result.success) {
      setTokens(result.accessToken, result.refreshToken);
      currentUser = { userId: result.user.id, username: result.user.username, nickname: result.user.nickname };
      showMainUI();
      navigateTo('products');
    } else {
      if (errEl) errEl.textContent = result.error || result.message || '登录失败';
    }
  } catch (err) {
    if (errEl) errEl.textContent = '网络错误，请稍后重试';
  }
}

async function doRegister() {
  const username = document.getElementById('register-username')?.value?.trim();
  const password = document.getElementById('register-password')?.value;
  const errEl = document.getElementById('register-error-text');
  
  if (!username || !password) {
    if (errEl) errEl.textContent = '请输入用户名和密码';
    return;
  }
  if (username.length < 3) {
    if (errEl) errEl.textContent = '用户名至少3位';
    return;
  }
  if (password.length < 6) {
    if (errEl) errEl.textContent = '密码至少6位';
    return;
  }
  
  try {
    const result = await api.post('/api/auth/register', { username, password });
    if (result.success) {
      showToast('注册成功，请登录', 'success');
      history.pushState(null, '', '/login');
    } else {
      if (errEl) errEl.textContent = result.message || result.error || '注册失败';
    }
  } catch (err) {
    if (errEl) errEl.textContent = '网络错误，请稍后重试';
  }
}

function doLogout() {
  // Close any open modals/menus
  var menu = document.getElementById('user-menu');
  if (menu) menu.remove();
  clearTokens();
  currentUser = null;
  history.pushState(null, '', '/login');
}

// ===== 模态框控制 =====
function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// 统一弹窗工厂：title, bodyHTML, buttons[{text,cls,onClick}], closable, width
function openModal(title, bodyHTML, buttons, opts = {}) {
  const { closable = true, width = 440, onClose } = opts;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  const btnHTML = (buttons || []).map(b =>
    '<button class="' + (b.cls || 'btn btn-ghost') + '" id="modal-btn-' + b.text.replace(/\s/g,'') + '">' + b.text + '</button>'
  ).join('');
  overlay.innerHTML =
    '<div class="modal" style="width:' + width + 'px" onclick="event.stopPropagation()">' +
      (title ? '<div class="modal-header"><div><div style="font-size:15px;font-weight:600">' + title + '</div></div>' + (closable ? '<button class="modal-close-btn" onclick="this.closest(\'.modal-overlay\').remove()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button>' : '') + '</div>' : '') +
      '<div style="padding:0 24px 20px">' + (bodyHTML || '') + '</div>' +
      (buttons && buttons.length > 0 ? '<div class="modal-actions" style="padding:0 24px 20px">' + btnHTML + '</div>' : '') +
    '</div>';
  document.body.appendChild(overlay);

  // 绑定按钮事件
  if (buttons) {
    buttons.forEach(b => {
      const el = overlay.querySelector('#modal-btn-' + b.text.replace(/\s/g, ''));
      if (el && b.onClick) el.addEventListener('click', async () => {
        const result = await b.onClick(overlay);
        if (result !== false) overlay.remove();
      });
    });
  }

  // 点击空白关闭
  if (closable) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { if (onClose) onClose(); overlay.remove(); }
    });
  }

  return overlay;
}
window.openModal = openModal;

// ===== 产品线操作 =====
async function showNewProductLineModal() {
  // 重置表单
  const nameInput = document.getElementById('new-pl-name');
  if (nameInput) nameInput.value = '';
  const colorInput = document.getElementById('new-pl-color');
  if (colorInput) colorInput.value = '#5B5EF4';
  // 重置色块选中状态
  document.querySelectorAll('#pl-color-swatches .color-swatch').forEach((s, i) => {
    s.classList.toggle('selected', i === 0);
  });
  showModal('new-product-line-modal');
}

// 选择产品线颜色
function selectPLColor(color, el) {
  document.getElementById('new-pl-color').value = color;
  document.querySelectorAll('#pl-color-swatches .color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

async function createProductLine() {
  const name = document.getElementById('new-pl-name')?.value?.trim();
  const color = document.getElementById('new-pl-color')?.value || '#5B5EF4';
  
  if (!name) {
    showToast('请输入产品线名称', 'error');
    return;
  }
  
  try {
    const result = await api.post('/api/product-lines', { name, color });
    if (result.success) {
      showToast('产品线创建成功', 'success');
      hideModal('new-product-line-modal');
      if (typeof renderProductsPage === 'function') {
        await renderProductsPage();
      }
    } else {
      showToast(result.error || result.message || '创建失败', 'error');
    }
  } catch (err) {
    showToast('网络错误', 'error');
  }
}

// ===== 项目操作 =====
function selectProjColor(color, el) {
  document.getElementById('new-project-color').value = color;
  document.querySelectorAll('#proj-color-swatches .color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

async function showNewProjectModal() {
  const nameInput = document.getElementById('new-project-name');
  if (nameInput) nameInput.value = '';
  const colorInput = document.getElementById('new-project-color');
  if (colorInput) colorInput.value = '#5B5EF4';
  document.querySelectorAll('#proj-color-swatches .color-swatch').forEach((s, i) => {
    s.classList.toggle('selected', i === 0);
  });
  showModal('new-project-modal');
}

async function createProject() {
  const name = document.getElementById('new-project-name')?.value?.trim();
  const color = document.getElementById('new-project-color')?.value || '#5B5EF4';
  
  if (!name) {
    showToast('请输入项目名称', 'error');
    return;
  }
  
  try {
    const payload = { name, color };
    const result = await api.post('/api/projects', payload);
    if (result.success) {
      showToast('项目创建成功', 'success');
      hideModal('new-project-modal');
      if (typeof renderProjectsPage === 'function') {
        await renderProjectsPage();
      }
    } else {
      showToast(result.error || result.message || '创建失败', 'error');
    }
  } catch (err) {
    showToast('网络错误', 'error');
  }
}

// ===== 侧边栏控制 =====
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle('collapsed');
  
  const icon = document.getElementById('sidebar-toggle-icon');
  if (icon) {
    const svg = icon.querySelector('use');
    if (svg) svg.setAttribute('href', '/libs/iconpark/icons.svg#ico-chevron-' + (sidebarCollapsed ? 'right' : 'left'));
  }
}

// ===== Toast 通知 =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  // 显示
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 3秒后隐藏
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ===== 用户菜单 → 个人资料卡 =====
async function toggleUserMenu() {
  let menu = document.getElementById('user-menu');
  if (menu) { menu.remove(); return; }

  const user = getCurrentUser();
  const username = user?.username || '用户';
  const nickname = user?.nickname || username;
  const userId = user?.userId || '';

  // Fetch profile stats
  let profileData = { projectCount: 0, commentCount: 0, tagCount: 0, created_at: 0 };
  try {
    const res = await api.get('/api/auth/profile');
    if (res.success) profileData = res.data;
  } catch(e) {}

  const createdDate = profileData.created_at ? new Date(profileData.created_at * 1000).toLocaleDateString('zh-CN', {year:'numeric', month:'long', day:'numeric'}) : '-';

  menu = document.createElement('div');
  menu.id = 'user-menu';
  menu.className = 'modal-overlay active';
  menu.style.zIndex = '400';
  menu.innerHTML = '<div class="modal" style="width:420px" onclick="event.stopPropagation()">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
      '<h3 style="margin:0;font-size:16px">个人资料</h3>' +
      '<button class="modal-close-btn" onclick="var m=document.getElementById(\'user-menu\');if(m)m.remove()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button>' +
    '</div>' +
    '<div class="profile-header-bg">' +
      '<div class="profile-avatar-lg" style="background:linear-gradient(135deg,#F59E0B,#EF4444)">' + username[0].toUpperCase() + '</div>' +
      '<div>' +
        '<div style="font-size:16px;font-weight:700;margin-bottom:4px">'+nickname+'</div>' +
        '<div style="font-size:12px;color:var(--text-secondary)">@'+username+'</div>' +
      '</div>' +
    '</div>' +
    '<div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:16px">' +
      '<div class="profile-info-row" onclick="showEditNicknameModal(\''+userId+'\',\''+(nickname||'').replace(/'/g,"\\'")+'\')" style="cursor:pointer">' +
        '<span class="profile-info-icon"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-person"/></svg></span>' +
        '<div class="profile-info-content"><div class="profile-info-label">昵称</div><div class="profile-info-value">'+nickname+'</div></div>' +
        '<span class="profile-info-action">修改</span>' +
      '</div>' +
      '<div class="profile-info-row" onclick="showChangePasswordModal()" style="cursor:pointer">' +
        '<span class="profile-info-icon"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-lock"/></svg></span>' +
        '<div class="profile-info-content"><div class="profile-info-label">密码</div><div class="profile-info-value">••••••••</div></div>' +
        '<span class="profile-info-action">修改</span>' +
      '</div>' +
      '<div class="profile-info-row">' +
        '<span class="profile-info-icon"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-calendar"/></svg></span>' +
        '<div class="profile-info-content"><div class="profile-info-label">注册时间</div><div class="profile-info-value">'+createdDate+'</div></div>' +
      '</div>' +
    '</div>' +
    '<div class="profile-stats-row">' +
      '<div class="profile-stat-block"><div class="profile-stat-num">'+profileData.projectCount+'</div><div class="profile-stat-label">项目数量</div></div>' +
      '<div class="profile-stat-block"><div class="profile-stat-num">'+profileData.commentCount+'</div><div class="profile-stat-label">评论数</div></div>' +
      '<div class="profile-stat-block"><div class="profile-stat-num">'+profileData.tagCount+'</div><div class="profile-stat-label">标签数</div></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="doLogout()"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-logout"/></svg> 切换账号</button>' +
      '<button class="btn btn-ghost" style="flex:1;justify-content:center;color:var(--accent);border-color:var(--accent)" onclick="doLogout()">退出登录</button>' +
    '</div>' +
  '</div>';

  document.body.appendChild(menu);
  menu.addEventListener('click', e => { if(e.target === menu) menu.remove(); });
}

function showEditNicknameModal(userId, currentNickname) {
  openModal('修改昵称',
    '<div class="form-row"><label>昵称</label><input type="text" id="edit-nickname-input" value="'+currentNickname+'" placeholder="1-20位" maxlength="20" style="padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;outline:none;width:100%;box-sizing:border-box"></div>',
    [{text:'取消',cls:'btn btn-ghost',onClick:()=>{}},{text:'保存',cls:'btn btn-primary',onClick:async (overlay)=>{
      const nickname = overlay.querySelector('#edit-nickname-input').value.trim();
      if(!nickname){showToast('昵称不能为空','error');return false;}
      try{
        const res = await api.put('/api/auth/nickname',{nickname});
        if(res.success){showToast('昵称已更新','success');
          // Refresh token if returned
          if(res.accessToken) setTokens(res.accessToken, getRefreshToken());
          document.getElementById('user-menu')?.remove();
          toggleUserMenu();
        } else showToast(res.error||'修改失败','error');
      }catch(e){showToast('网络错误','error');}
    }}]
  );
}
window.showEditNicknameModal = showEditNicknameModal;

// ===== 下载插件弹窗 =====
function showDownloadPluginModal() {
  let modal = document.getElementById('plugin-modal');
  if (modal) modal.remove();
  const downloadBase = 'https://github.com/Susie-ss/framo/releases/latest/download/';
  const downloads = {
    windows: downloadBase + 'Flowa-Axure-Plugin-1.0.0-win-x64-setup.exe',
    macArm: downloadBase + 'Flowa-Axure-Plugin-1.0.0-mac-arm64.dmg',
    macX64: downloadBase + 'Flowa-Axure-Plugin-1.0.0-mac-x64.dmg',
    full: downloadBase + 'Flowa-Axure-Plugin-1.0.0-installers.zip'
  };

  modal = document.createElement('div');
  modal.id = 'plugin-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = '<div class="modal" style="width:560px" onclick="event.stopPropagation()">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:44px;height:44px;background:linear-gradient(135deg,#5B5EF4,#8B8EFF);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg class="icon-color" style="font-size:22px"><use href="/libs/iconpark/icons.svg#ico-file"/></svg></div>' +
        '<div><div style="font-size:16px;font-weight:600">Flowa插件</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">一键发布原型到平台，实现在线预览</div></div>' +
      '</div>' +
      '<button class="modal-close-btn" onclick="document.getElementById(\'plugin-modal\').remove()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button>' +
    '</div>' +
    '<div class="plugin-modal-steps">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:16px">安装步骤</div>' +
      '<div class="plugin-step"><div class="plugin-step-num">1</div><div><div class="plugin-step-title">下载正式安装包</div><div class="plugin-step-desc">Windows 使用 .exe，macOS 按芯片选择 Apple Silicon 或 Intel 的 .dmg</div></div></div>' +
      '<div class="plugin-step"><div class="plugin-step-num">2</div><div><div class="plugin-step-title">安装插件</div><div class="plugin-step-desc">双击安装包完成安装；macOS 首次打开可能需要在系统设置中允许</div></div></div>' +
      '<div class="plugin-step"><div class="plugin-step-num">3</div><div><div class="plugin-step-title">打开预览发布</div><div class="plugin-step-desc">在 Axure 中打开文档，点击预览，插件自动检测并上传</div></div></div>' +
    '</div>' +
    '<div style="margin-bottom:20px">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:12px">功能特点</div>' +
      '<div class="plugin-feature-grid">' +
        '<div class="plugin-feature-item"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-refresh"/></svg> 版本自动覆盖</div>' +
        '<div class="plugin-feature-item"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-users"/></svg> 团队共享预览</div>' +
        '<div class="plugin-feature-item"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-link"/></svg> 一键分享链接</div>' +
        '<div class="plugin-feature-item"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-phone"/></svg> 支持手机预览</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<a class="btn btn-primary" href="' + downloads.windows + '" onclick="showToast(\'Windows 安装包下载已开始\',\'success\');document.getElementById(\'plugin-modal\').remove()"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-download"/></svg> Windows</a>' +
      '<a class="btn btn-secondary" href="' + downloads.macArm + '" onclick="showToast(\'macOS Apple 芯片安装包下载已开始\',\'success\')">macOS Apple 芯片</a>' +
      '<a class="btn btn-secondary" href="' + downloads.macX64 + '" onclick="showToast(\'macOS Intel 安装包下载已开始\',\'success\')">macOS Intel</a>' +
      '<a class="btn btn-secondary" href="' + downloads.full + '" onclick="showToast(\'完整插件包下载已开始\',\'success\')">完整插件包</a>' +
    '</div>' +
  '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}
window.showDownloadPluginModal = showDownloadPluginModal;

// ===== 修改个人信息弹窗 =====
function showEditProfileModal() {
  // 先关闭用户菜单
  const menu = document.getElementById('user-menu');
  if (menu) menu.remove();
  
  const user = getCurrentUser();
  const username = user?.username || '';
  const userId = user?.userId || '';

  let modal = document.getElementById('edit-profile-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'edit-profile-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="width:440px">
      <div class="modal-header">
        <div>
          <div style="font-size:15px;font-weight:600">修改个人信息</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">更新你的个人资料</div>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('edit-profile-modal').remove()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button>
      </div>
      <div style="padding:0 24px 20px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">
          <div id="avatar-preview" style="width:60px;height:60px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;flex-shrink:0;position:relative" onclick="document.getElementById('avatar-file').click()">
            <img id="avatar-img" src="/api/users/avatar/${userId}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover;display:none" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
            <span id="avatar-placeholder" style="font-size:24px;color:var(--primary);font-weight:700;display:flex">${username?.[0]?.toUpperCase()||'?'}</span>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:2px">头像</div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">支持 JPG/PNG，不超过 500KB</div>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('avatar-file').click()">上传头像</button>
            <input type="file" id="avatar-file" accept="image/jpeg,image/png" style="display:none" onchange="uploadAvatar()" />
          </div>
        </div>
        <div class="form-row">
          <label>用户名</label>
          <input type="text" id="edit-profile-username" value="${username}" placeholder="请输入用户名" />
        </div>
      </div>
      <div class="modal-actions" style="padding:0 24px 20px">
        <button class="btn btn-ghost" onclick="document.getElementById('edit-profile-modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="saveEditProfile()">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function uploadAvatar() {
  const file = document.getElementById('avatar-file')?.files?.[0];
  if (!file) return;
  if (file.size > 500 * 1024) { showToast('头像文件不能超过 500KB', 'error'); return; }
  const fm = new FormData();
  fm.append('avatar', file);
  try {
    const result = await api.upload('/api/users/avatar', fm);
    if (result.success) {
      showToast('头像已更新', 'success');
      // 刷新头像预览
      const img = document.getElementById('avatar-img');
      const ph = document.getElementById('avatar-placeholder');
      if (img) { img.src = '/api/users/avatar/' + (getCurrentUser()?.userId || '') + '?t=' + Date.now(); img.style.display = 'block'; }
      if (ph) ph.style.display = 'none';
      // 更新顶部头像
      updateHeaderAvatar();
    } else {
      showToast(result.error || '上传失败', 'error');
    }
  } catch (e) { showToast('网络错误', 'error'); }
}

function updateHeaderAvatar() {
  const avatar = document.getElementById('header-avatar');
  if (!avatar) return;
  const user = getCurrentUser();
  const userId = user?.userId || '';
  const initial = (user?.username || '?')[0].toUpperCase();
  avatar.innerHTML = '<img src="/api/users/avatar/' + userId + '?t=' + Date.now() + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + initial + '\'" />';
}

async function saveEditProfile() {
  const username = document.getElementById('edit-profile-username')?.value?.trim();
  if (!username) {
    showToast('用户名不能为空', 'error');
    return;
  }
  if (username.length < 3) {
    showToast('用户名至少3位', 'error');
    return;
  }
  
  try {
    const result = await api.put('/api/auth/profile', { username });
    if (result.success) {
      showToast('个人信息已更新，请重新登录', 'success');
      document.getElementById('edit-profile-modal')?.remove();
      // 如果后端返回了新 token，更新
      if (result.accessToken) {
        setTokens(result.accessToken, getRefreshToken());
      }
    } else {
      showToast(result.message || result.error || '更新失败', 'error');
    }
  } catch (err) {
    showToast('网络错误', 'error');
  }
}

// ===== 修改密码弹窗 =====
function showChangePasswordModal() {
  // 先关闭用户菜单
  const menu = document.getElementById('user-menu');
  if (menu) menu.remove();
  
  let modal = document.getElementById('change-password-modal');
  if (modal) modal.remove();
  
  modal = document.createElement('div');
  modal.id = 'change-password-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="width:440px">
      <div class="modal-header">
        <div>
          <div style="font-size:15px;font-weight:600">修改登录密码</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">设置新的登录密码</div>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('change-password-modal').remove()"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#close"/></svg></button>
      </div>
      <div style="padding:0 24px 20px">
        <div class="form-row">
          <label>当前密码</label>
          <input type="password" id="change-pw-old" placeholder="请输入当前密码" />
        </div>
        <div class="form-row" style="margin-top:14px">
          <label>新密码</label>
          <input type="password" id="change-pw-new" placeholder="至少6位" />
        </div>
        <div class="form-row" style="margin-top:14px">
          <label>确认新密码</label>
          <input type="password" id="change-pw-confirm" placeholder="再次输入新密码" />
        </div>
      </div>
      <div class="modal-actions" style="padding:0 24px 20px">
        <button class="btn btn-ghost" onclick="document.getElementById('change-password-modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="saveChangePassword()">确认修改</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

async function saveChangePassword() {
  const oldPassword = document.getElementById('change-pw-old')?.value;
  const newPassword = document.getElementById('change-pw-new')?.value;
  const confirmPassword = document.getElementById('change-pw-confirm')?.value;
  
  if (!oldPassword || !newPassword || !confirmPassword) {
    showToast('请填写所有密码项', 'error');
    return;
  }
  if (newPassword.length < 6) {
    showToast('新密码至少6位', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('两次输入的新密码不一致', 'error');
    return;
  }
  
  try {
    const result = await api.put('/api/auth/password', { oldPassword, newPassword });
    if (result.success) {
      showToast('密码修改成功，请重新登录', 'success');
      document.getElementById('change-password-modal')?.remove();
      // 密码修改后需要重新登录
      setTimeout(() => {
        clearTokens();
        currentUser = null;
        history.pushState(null, '', '/login');
      }, 1000);
    } else {
      showToast(result.message || result.error || '修改失败', 'error');
    }
  } catch (err) {
    showToast('网络错误', 'error');
  }
}

// ===== 通知面板 =====
let notificationCount = 0;

async function loadNotificationBadge() {
  if (!isLoggedIn()) return;
  try {
    const result = await api.get('/api/notifications');
    if (result.success && result.data) {
      // 过滤已读：只统计上次标为已读之后的新通知
      const lastRead = parseInt(localStorage.getItem('notif_read_at') || '0');
      const unread = result.data.filter(n => (n.created_at || 0) * 1000 > lastRead);
      notificationCount = unread.length;
      const badge = document.getElementById('notification-badge');
      if (badge) {
        badge.textContent = notificationCount;
        badge.style.display = notificationCount > 0 ? 'flex' : 'none';
      }
    }
  } catch (e) {}
}

async function toggleNotificationPanel() {
  let panel = document.getElementById('notification-panel');
  if (panel) { panel.remove(); return; }

  panel = document.createElement('div');
  panel.id = 'notification-panel';
  panel.className = 'notification-dropdown';
  panel.innerHTML = '<div class="notification-header"><span style="font-weight:600;font-size:14px">消息提醒</span><button style="background:none;border:none;font-size:12px;color:var(--primary);cursor:pointer" onclick="markAllRead()">全部已读</button></div><div class="notification-list"><div style="text-align:center;padding:20px;color:var(--text-muted)">加载中...</div></div>';
  document.body.appendChild(panel);

  try {
    const result = await api.get('/api/notifications');
    const list = panel.querySelector('.notification-list');
    const lastRead = parseInt(localStorage.getItem('notif_read_at') || '0');
    if (result.success && result.data?.length > 0) {
      list.innerHTML = result.data.map(n => {
        const time = new Date(n.created_at * 1000);
        const timeStr = time.toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
        const initials = (n.reply_user || '?')[0].toUpperCase();
        const isUnread = (n.created_at || 0) * 1000 > lastRead;
        return '<div class="notification-item '+(isUnread?'unread':'read')+'" onclick="localStorage.setItem(\'notif_read_at\',Date.now());window.open(\'/preview.html?project=' + n.project_id + '\',\'_blank\');document.getElementById(\'notification-panel\')?.remove()" style="cursor:pointer">' +
          (isUnread ? '<span class="notif-dot"></span>' : '') +
          '<div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11px;flex-shrink:0">' + initials + '</div>' +
          '<div class="notification-content">' +
            '<div class="notification-text"><strong>' + n.reply_user + '</strong> 回复了你在 <strong>' + (n.project_name || '项目') + '</strong> 中的评论</div>' +
            '<div class="notification-time">' + timeStr + '</div>' +
          '</div></div>';
      }).join('');
    } else {
      list.innerHTML = '<div class="notification-empty"><div class="notification-text">暂无新通知</div></div>';
    }
  } catch (e) {
    panel.querySelector('.notification-list').innerHTML = '<div class="notification-empty"><div class="notification-text">加载失败</div></div>';
  }

  setTimeout(() => {
    document.addEventListener('click', function closePanel(e) {
      if (!panel.contains(e.target) && e.target.id !== 'notification-btn' && !e.target.closest('#notification-btn')) {
        panel.remove();
        document.removeEventListener('click', closePanel);
      }
    });
  }, 10);
}

function markAllRead() {
  localStorage.setItem('notif_read_at', Date.now());
  document.querySelectorAll('.notification-item.unread').forEach(item => {
    item.classList.remove('unread');
    item.classList.add('read');
    const dot = item.querySelector('.notif-dot');
    if(dot) dot.remove();
  });
  const badge = document.getElementById('notification-badge');
  if (badge) badge.style.display = 'none';
  notificationCount = 0;
}

// ===== 工具函数 =====
function formatDate(dateString) {
  if (!dateString || dateString === 0) return '-';
  const d = new Date(dateString * 1000); // 假设输入是Unix时间戳（秒）
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

// 导出
window.doLogin = doLogin;
window.doRegister = doRegister;
window.doLogout = doLogout;
window.showModal = showModal;
window.hideModal = hideModal;
window.showNewProductLineModal = showNewProductLineModal;
window.createProductLine = createProductLine;
window.selectPLColor = selectPLColor;
window.selectProjColor = selectProjColor;
window.showNewProjectModal = showNewProjectModal;
window.createProject = createProject;
window.toggleSidebar = toggleSidebar;
window.toggleUserMenu = toggleUserMenu;
window.showToast = showToast;
window.showEditProfileModal = showEditProfileModal;
window.saveEditProfile = saveEditProfile;
window.showChangePasswordModal = showChangePasswordModal;
window.saveChangePassword = saveChangePassword;
window.toggleNotificationPanel = toggleNotificationPanel;
window.markAllRead = markAllRead;
window.loadNotificationBadge = loadNotificationBadge;
window.uploadAvatar = uploadAvatar;
window.updateHeaderAvatar = updateHeaderAvatar;
window.showDownloadPluginModal = showDownloadPluginModal;
