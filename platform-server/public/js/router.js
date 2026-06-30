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
function renderAuthBrandPanel() {
  return '<div class="auth-banner flowa-auth-banner"><div class="auth-banner-bg"><div class="auth-banner-shape shape-1"></div><div class="auth-banner-shape shape-2"></div><div class="auth-banner-shape shape-3"></div><div class="auth-banner-shape shape-4"></div></div><div class="auth-banner-content flowa-auth-brand"><div class="auth-product-tag">DESIGN AI WORKSPACE</div><div class="auth-banner-logo"><img src="/favicon.png" alt="Flowa" /></div><h1>把设计资产变成可复用的生产力</h1><p class="auth-banner-desc">上传 Sketch 与 Axure 资源，识别图标、字体、组件和 Token，让 AI 生成页面时直接引用真实组件库规范。</p><div class="auth-pipeline"><div class="auth-pipeline-step"><b>01</b><span><strong>上传设计文件</strong><em>Sketch / Axure 资源统一托管</em></span></div><div class="auth-pipeline-step"><b>02</b><span><strong>解析组件与 Token</strong><em>图标、字体、颜色、共享样式自动沉淀</em></span></div><div class="auth-pipeline-step"><b>03</b><span><strong>AI 引用生成页面</strong><em>基于组件库输出可预览业务原型</em></span></div></div><div class="auth-proof-grid"><div><strong>Sketch</strong><span>资产解析</span></div><div><strong>Token</strong><span>规范同步</span></div><div><strong>Prompt</strong><span>页面生成</span></div></div></div></div>';
}

function renderLoginPage(container) {
  container.innerHTML = '<div class="auth-layout flowa-auth-layout">' + renderAuthBrandPanel() + '<div class="auth-form-side flowa-auth-form"><div class="auth-card flowa-auth-card"><div class="auth-card-kicker">FLOWA ACCESS</div><div class="auth-card-header"><h2>进入设计资产工作台</h2><p class="auth-subtitle">继续管理原型、组件库和 AI 页面生成任务</p></div><div class="auth-context-panel"><span><i></i>组件库 / Token</span><span><i></i>AI 生成</span><span><i></i>原型预览</span></div><div class="form-row"><label>用户名</label><div class="input-wrap"><svg class="input-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7C84A3" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 00-16 0"/></svg><input type="text" id="login-username" placeholder="请输入用户名" /></div></div><div class="form-row"><label>密码</label><div class="input-wrap"><svg class="input-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7C84A3" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><input type="password" id="login-password" placeholder="请输入密码" /></div></div><div class="auth-error-text" id="login-error-text"></div><button class="btn btn-primary auth-btn" onclick="doLogin()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>进入工作台</button><div class="auth-footer-link">第一次使用 Flowa？<a href="/register">创建团队账号</a></div></div></div></div>';
}

function renderRegisterPage(container) {
  container.innerHTML = '<div class="auth-layout flowa-auth-layout">' + renderAuthBrandPanel() + '<div class="auth-form-side flowa-auth-form"><div class="auth-card flowa-auth-card"><div class="auth-card-kicker">CREATE WORKSPACE</div><div class="auth-card-header"><h2>创建 Flowa 工作台</h2><p class="auth-subtitle">建立可被团队和 AI 共同引用的设计资产库</p></div><div class="auth-context-panel"><span><i></i>上传解析</span><span><i></i>资产沉淀</span><span><i></i>协作预览</span></div><div class="form-row"><label>用户名</label><div class="input-wrap"><svg class="input-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7C84A3" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 00-16 0"/></svg><input type="text" id="register-username" placeholder="至少3位" /></div></div><div class="form-row"><label>密码</label><div class="input-wrap"><svg class="input-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7C84A3" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><input type="password" id="register-password" placeholder="至少6位" /></div></div><div class="auth-error-text" id="register-error-text"></div><button class="btn btn-primary auth-btn" onclick="doRegister()">创建并进入</button><div class="auth-footer-link">已有账号？<a href="/login">立即登录</a></div></div></div></div>';
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
