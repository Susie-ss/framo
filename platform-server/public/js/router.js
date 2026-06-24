// router.js - 前端路径路由系统 (HTML5 History API)
const routes = {};
let currentRoute = null;
let currentParams = {};

function registerRoute(path, handler) {
  routes[path] = handler;
}

// 解析路径路由
function parseRoute() {
  var path = window.location.pathname;
  if (path === '/') return { route: 'home', params: {} };
  
  var parts = path.split('/').filter(Boolean);
  
  if (path === '/login')      return { route: 'login', params: {} };
  if (path === '/register')   return { route: 'register', params: {} };
  if (path === '/products')   return { route: 'products', params: {} };
  if (path === '/projects')   return { route: 'projects', params: {} };
  if (path === '/library')    return { route: 'library', params: {} };
  if (path === '/ai-generate') return { route: 'ai-generate', params: {} };
  if (parts[0] === 'library' && parts[1]) return { route: 'library-detail', params: { id: parts[1] } };

  if (parts[0] === 'share' && parts[1]) return { route: 'share', params: { token: parts[1] } };
  
  return { route: 'home', params: {} };
}

// 路由导航
function navigateTo(route, params) {
  params = params || {};
  var url = '';
  
  switch (route) {
    case 'home':         url = '/'; break;
    case 'products':     url = '/products'; break;
    case 'projects':     url = '/projects'; break;
    case 'library':      url = '/library'; break;
    case 'ai-generate':  url = '/ai-generate'; break;
    case 'library-detail': url = '/library/' + params.id; break;
    case 'project-detail':
      window.open('/preview.html?project=' + params.id, '_blank');
      return;
    case 'share':        url = '/share/' + params.token; break;
    case 'login':        url = '/login'; break;
    case 'register':     url = '/register'; break;
    default:             url = '/'; break;
  }
  
  history.pushState(null, '', url);
  renderRoute();
}

// 渲染页面
async function renderRoute() {
  var parsed = parseRoute();
  var route = parsed.route;
  var params = parsed.params;
  currentRoute = route;
  currentParams = params;
  
  var mainContent = document.getElementById('main-content');
  var authContainer = document.getElementById('auth-container');
  var header = document.getElementById('header');
  var layout = document.getElementById('main-layout');
  var sidebar = document.getElementById('sidebar');
  
  if (mainContent) {
    mainContent.style.padding = '';
    mainContent.style.height = '';
  }
  
  // ===== 公开路由 =====
  if (route === 'login' || route === 'register') {
    if (isLoggedIn()) {
      navigateTo('products');
      return;
    }
    if (header) header.style.display = 'none';
    if (layout) layout.style.display = 'none';
    if (authContainer) authContainer.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'none';
    
    if (route === 'login') renderLoginPage(authContainer);
    else renderRegisterPage(authContainer);
    return;
  }
  
  if (route === 'share') {
    if (header) header.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (layout) { layout.style.display = 'flex'; layout.style.marginTop = '0'; }
    if (authContainer) authContainer.style.display = 'none';
    document.body.style.height = '100vh';
    document.body.style.margin = '0';
    if (mainContent) { mainContent.style.padding = '0'; mainContent.style.overflow = 'hidden'; }
    await renderSharePage(mainContent, params.token);
    return;
  }
  
  // ===== 需要登录 =====
  if (!isLoggedIn()) {
    navigateTo('login');
    return;
  }
  
  if (authContainer) authContainer.style.display = 'none';
  if (header) header.style.display = 'flex';
  if (layout) { layout.style.display = 'flex'; layout.style.marginTop = ''; }
  if (sidebar) sidebar.style.display = '';
  if (mainContent) { mainContent.style.padding = ''; mainContent.style.overflow = ''; }
  document.body.style.height = '';
  document.body.style.margin = '';
  
  updateSidebarActive(route);
  updatePageTitle(route, params);

  // 恢复 header 默认状态（非组件库页面时）
  if (route !== 'library' && route !== 'library-detail' && typeof restoreHeaderDefault === 'function') {
    restoreHeaderDefault();
  }

  if (route === 'home') {
    if (typeof renderHomePage === 'function') renderHomePage();
  } else if (route === 'products') {
    if (typeof renderProductsPage === 'function') renderProductsPage();
  } else if (route === 'projects') {
    if (typeof renderProjectsPage === 'function') renderProjectsPage();
  } else if (route === 'library') {
    if (typeof renderLibraryPage === 'function') renderLibraryPage();
  } else if (route === 'library-detail') {
    if (typeof renderDesignSystemDetail === 'function') renderDesignSystemDetail(params.id);
  } else if (route === 'ai-generate') {
    if (typeof renderAIGeneratePage === 'function') renderAIGeneratePage();
  }
}

function updateSidebarActive(route) {
  document.querySelectorAll('.sidebar-item').forEach(function(item) {
    var r = item.getAttribute('data-page');
    if (r === route) item.classList.add('active');
    else item.classList.remove('active');
  });
}

// 页面标题映射
const pageTitleMap = {
  home: '首页',
  products: '产品线',
  projects: '项目',
  library: '组件库',
  'ai-generate': 'AI生成'
};

function updatePageTitle(route, params) {
  var titleEl = document.querySelector('.page-title');
  if (!titleEl) return;
  if (route === 'library-detail' && params && params.id) {
    var ds = findDesignSystemById(params.id);
    titleEl.textContent = ds ? '设计规范 - ' + ds.name : '设计规范';
  } else {
    titleEl.textContent = pageTitleMap[route] || '首页';
  }
}

// Render login/register pages
function renderLoginPage(container) {
  container.innerHTML = '<div class="auth-layout"><div class="auth-banner"><div class="auth-banner-bg"><div class="auth-banner-shape shape-1"></div><div class="auth-banner-shape shape-2"></div><div class="auth-banner-shape shape-3"></div><div class="auth-banner-shape shape-4"></div></div><div class="auth-banner-content"><div class="auth-banner-logo"><img src="/favicon.png" style="width:64px;height:64px;border-radius:16px" /></div><h1>Flowa</h1><p class="auth-banner-desc">高效管理 Axure 原型，团队协作更顺畅</p><div class="auth-banner-divider"></div><ul class="auth-banner-features"><li><span class="feature-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>一键上传，即时预览</li><li><span class="feature-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>页面结构树，清晰导航</li><li><span class="feature-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></span>安全分享，权限可控</li><li><span class="feature-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></span>团队协作，高效沟通</li></ul></div></div><div class="auth-form-side"><div class="auth-card"><div class="auth-card-header"><h2>欢迎回来</h2><p class="auth-subtitle">登录到 Flowa 账号</p></div><div class="form-row"><label>用户名</label><div class="input-wrap"><svg class="input-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 00-16 0"/></svg><input type="text" id="login-username" placeholder="请输入用户名" /></div></div><div class="form-row"><label>密码</label><div class="input-wrap"><svg class="input-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9CA3AF" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><input type="password" id="login-password" placeholder="请输入密码" /></div></div><div class="auth-error-text" id="login-error-text"></div><button class="btn btn-primary auth-btn" onclick="doLogin()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>登录</button><div class="auth-footer-link">没有账号？<a href="/register">立即注册</a></div></div></div></div>';
}

function renderRegisterPage(container) {
  container.innerHTML = '<div class="auth-layout"><div class="auth-banner"><div class="auth-banner-logo"><img src="/favicon.png" style="width:56px;height:56px" /></div><h1>Flowa</h1><p>高效管理 Axure 原型，团队协作更顺畅</p><ul class="auth-banner-features"><li><span class="feature-icon"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#upload-one"/></svg></span>一键上传，即时预览</li><li><span class="feature-icon"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#tree-list"/></svg></span>页面结构树，清晰导航</li><li><span class="feature-icon"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#share"/></svg></span>安全分享，权限可控</li><li><span class="feature-icon"><svg class="iconpark iconpark-lg"><use href="/libs/iconpark/sprite.svg#people"/></svg></span>团队协作，高效沟通</li></ul></div><div class="auth-form-side"><div class="auth-card"><h2>创建账号</h2><p class="auth-subtitle">注册Flowa账号</p><div class="form-row"><label>用户名</label><input type="text" id="register-username" placeholder="至少3位" /></div><div class="form-row"><label>密码</label><input type="password" id="register-password" placeholder="至少6位" /></div><div class="auth-error-text" id="register-error-text"></div><button class="btn btn-primary" onclick="doRegister()">注册</button><div class="auth-footer-link">已有账号？<a href="/login">立即登录</a></div></div></div></div>';
}

// Render share page
async function renderSharePage(container, token) {
  Object.assign(container.style, {
    display: 'flex', flexDirection: 'column',
    flex: '1', overflow: 'hidden',
    padding: '0', margin: '0'
  });

  var viewer = document.createElement('div');
  viewer.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  viewer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">加载中...</div>';
  container.innerHTML = '';
  container.appendChild(viewer);

  // Extract password from URL query (e.g. /share/TOKEN?pwd=XXXX)
  var hashPwd = '';
  var qs = window.location.search;
  var m = qs.match(/[?&]pwd=([^&]*)/);
  if (m) hashPwd = decodeURIComponent(m[1]);

  async function loadShare(pwd) {
    var url = '/api/share/' + token;
    if (pwd) url += '?pwd=' + encodeURIComponent(pwd);
    try {
      var result = await api.get(url);
      if (result.success) {
        viewer.innerHTML = '';
        renderViewer({ container: viewer, projectId: result.project.id, mode: 'share', shareToken: token });
        return true;
      }
      if (result.needPassword) {
        showPasswordPrompt(pwd);
        return false;
      }
      viewer.innerHTML = '<div style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px;opacity:.5"><svg class="iconpark" style="width:48px;height:48px"><use href="/libs/iconpark/sprite.svg#lock"/></svg></div><h3 style="margin-bottom:8px">访问受限</h3><p style="color:var(--text-secondary)">此分享链接无效或已失效</p></div>';
      return false;
    } catch (err) {
      viewer.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">加载失败</div>';
      return false;
    }
  }

  function showPasswordPrompt(wrongPwd) {
    viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%"><div style="background:var(--surface);border-radius:12px;padding:40px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.12);width:360px;max-width:90vw"><div style="font-size:40px;margin-bottom:16px"><i class="iconpark" style="width:40px;height:40px;color:var(--primary)"><use href="/libs/iconpark/sprite.svg#lock"/></svg></div><h3 style="margin:0 0 8px;font-size:18px">需要密码访问</h3><p style="color:var(--text-muted);font-size:13px;margin:0 0 24px">此分享链接已加密，请输入密码查看</p><div style="display:flex;gap:8px"><input type="text" id="pwd-input" placeholder="输入4位密码" maxlength="4" style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:14px;outline:none;text-align:center" onkeydown="if(event.key===\'Enter\')submitSharePwd()"><button onclick="submitSharePwd()" style="padding:10px 20px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap">确认</button></div>' + (wrongPwd ? '<p style="color:#EF4444;font-size:12px;margin:12px 0 0">密码错误，请重试</p>' : '') + '</div></div>';

    window.submitSharePwd = function() {
      var inp = document.getElementById('pwd-input');
      var pwd = inp ? inp.value.trim() : '';
      if (!pwd) return;
      // Update URL with password so it can be shared
      var newUrl = '/share/' + token + '?pwd=' + encodeURIComponent(pwd);
      history.replaceState(null, '', newUrl);
      loadShare(pwd);
    };
  }

  loadShare(hashPwd);
}

// Event listeners
window.addEventListener('popstate', renderRoute);
window.addEventListener('load', renderRoute);

// Handle clicks on internal links to prevent full page reload
document.addEventListener('click', function(e) {
  var link = e.target.closest('a');
  if (!link) return;
  var href = link.getAttribute('href');
  if (!href) return;
  // Only intercept internal navigation links (not #, not external)
  if (href.startsWith('/') && !href.startsWith('/api/') && !href.startsWith('/preview.html')) {
    e.preventDefault();
    history.pushState(null, '', href);
    renderRoute();
  }
});

// Exports
window.navigateTo = navigateTo;
window.renderRoute = renderRoute;
