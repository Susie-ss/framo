// viewer.js — 统一预览组件（项目详情/全屏预览/分享页共用）
// 用法：renderViewer({ container, projectId, mode: 'embedded'|'fullscreen'|'share', initPage, shareToken })

let viewerState = { projectId: '', currentPage: '', tab: 'pages', projectVersion: 1, isShare: false, shareToken: '' };
let pageTreeByRelPath = {};
let _iframeSyncSetup = false;

async function renderViewer(opts = {}) {
  const { container, projectId, mode = 'embedded', initPage = '', shareToken = '' } = opts;
  const isShare = mode === 'share';
  const showToolbar = isShare; // only share mode shows internal toolbar; fullscreen toolbar is in preview.html
  const showComments = !isShare;

  viewerState.projectId = projectId;
  viewerState.isShare = isShare;
  viewerState.shareToken = shareToken;

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.innerHTML = '<div style="display:flex;flex-direction:column;flex:1;min-height:0">' +
    (showToolbar ?
      '<div class="preview-toolbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0">' +
        '<span class="version-badge" id="v-version">V1</span>' +
        '<span class="title" id="v-title" style="font-size:14px;font-weight:600"></span>' +
        (isShare ? '<span id="v-share-tags" style="display:inline-flex;align-items:center;gap:4px;margin-left:6px"></span>' : '') +
        '<span style="flex:1"></span>' +
      '</div>' : '') +
    '<div style="display:flex;flex:1;overflow:hidden">' +
      '<div class="preview-main" id="v-main" style="display:flex;background:#f0f0f0;padding:12px;min-width:0;overflow:hidden;position:relative">' +
        '<iframe id="v-frame" style="flex:1;border:none;background:#fff;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.1);min-width:0" scrolling="auto"></iframe>' +
        // Collapse button — narrow arrow at right edge of main area
        '<button class="sidebar-collapse-btn" id="v-collapse-btn" onclick="viewerToggleSidebar()" title="收起面板"><svg class="iconpark"><use href="/libs/iconpark/sprite.svg#right"/></svg></button>' +
      '</div>' +
      '<div class="preview-sidebar" id="v-sidebar" style="display:flex;flex-direction:column;background:var(--surface)">' +
        '<div class="comment-tabs" id="v-tabs">' +
          '<button class="comment-tab-btn active" data-tab="pages" onclick="viewerSwitchTab(\'pages\')"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-tree"/></svg> 页面结构</button>' +
          (showComments ? '<button class="comment-tab-btn" data-tab="comments" onclick="viewerSwitchTab(\'comments\')"><svg class="iconpark"><use href="/libs/iconpark/sprite.svg#comment"/></svg> 评论 <span class="comment-count-inline" id="v-comment-count">0</span></button>' : '') +
        '</div>' +
        '<div class="page-tree-list" id="v-tab-pages" style="overflow-y:auto;flex:1"></div>' +
        (showComments ? '<div id="v-tab-comments" style="display:none;flex:1;flex-direction:column;overflow:hidden"><div class="comment-list" id="v-comment-list" style="flex:1;overflow-y:auto"></div><div class="comment-input-row"><input placeholder="添加评论..." id="v-comment-input" onkeydown="if(event.key===\'Enter\')viewerSubmitComment()" /><button onclick="viewerSubmitComment()"><svg class="iconpark"><use href="/libs/iconpark/sprite.svg#send"/></svg></button></div></div>' : '') +
      '</div>' +
    '</div>' +
  '</div>';

  // 加载项目数据
  try {
    // 分享模式下传递 shareToken 以便后端校验权限
    let projectUrl = '/api/projects/' + projectId;
    if (isShare && shareToken) projectUrl += '?token=' + encodeURIComponent(shareToken);
    const r = await api.get(projectUrl);
    if (!r.success) { container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">项目不存在</div>'; return; }
    const p = r.data;
    const hasPages = !!p.pages_json;
    viewerState.projectVersion = hasPages ? (p.version_num || 1) : 0;
    const vEl = document.getElementById('v-version'); if (vEl) vEl.textContent = 'V' + viewerState.projectVersion;
    const tEl = document.getElementById('v-title'); if (tEl) tEl.textContent = p.name || '';

    // 空页面时禁用评论
    if (!hasPages && !isShare) {
      const tabsEl = document.getElementById('v-tabs');
      if (tabsEl) {
        const commentBtns = tabsEl.querySelectorAll('[data-tab="comments"]');
        commentBtns.forEach(b => b.disabled = true);
      }
      const inputEl = document.getElementById('v-comment-input');
      if (inputEl) { inputEl.disabled = true; inputEl.placeholder = '上传内容后方可评论'; }
    }
    if (isShare) {
      const tagsEl = document.getElementById('v-share-tags');
      if (tagsEl) tagsEl.innerHTML = '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#fef2f2;color:#EF4444;margin-right:4px"><svg class="iconpark" style="font-size:10px"><use href="/libs/iconpark/sprite.svg#lock"/></svg> 只读</span><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--primary-light);color:var(--primary)">分享</span>';
    }
    // 加载页面树（分享模式下传递 token）
    let pagesUrl = '/api/projects/' + projectId + '/pages';
    if (isShare && shareToken) pagesUrl += '?token=' + encodeURIComponent(shareToken);
    const pagesRes = await api.get(pagesUrl);
    if (pagesRes.success) await viewerLoadTree(pagesRes.data, initPage);

    // Initialize split.js after DOM is ready
    setTimeout(viewerInitSplit, 50);

    // Load per-page comment count badge
    if (!isShare) {
      viewerUpdateCommentCount();
    }
  } catch (e) { container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">加载失败</div>'; }
}

let pageCommentCounts = {};
let allComments = [];

async function viewerLoadTree(data, selectedPage) {
  const tree = data?.tree || [];
  const container = document.getElementById('v-tab-pages');
  if (!container) return;
  if (!tree.length) { container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">暂无页面</div>'; return; }
  const flat = viewerFlattenTree(tree);

  // 构建 relPath → 节点信息 映射，用于 iframe 内页跳转后侧栏联动
  pageTreeByRelPath = {};
  flat.forEach(n => {
    const key = n.relPath || n.url;
    if (key) pageTreeByRelPath[key] = { name: n.name, url: n.url, relPath: key };
  });

  // 加载评论计数（分享模式不加载）
  if (!viewerState.isShare) {
    try {
      const r = await api.get('/api/projects/' + viewerState.projectId + '/comment-counts');
      if (r.success) { pageCommentCounts = {}; (r.data||[]).forEach(c => { pageCommentCounts[c.page_path] = c.count; }); }
    } catch (e) {}
  }
  viewerRenderTree(tree, flat, container, selectedPage);

  // 注册 iframe 加载事件，实现页内跳转后侧栏自动联动
  if (!_iframeSyncSetup) {
    _iframeSyncSetup = true;
    viewerSetupIframeSync();
  }
}

function viewerRenderTree(tree, flat, container, selectedPage) {
  container.innerHTML = viewerTreeHTML(tree, 0);
  const first = selectedPage ? flat.find(f => f.relPath === selectedPage) : flat[0];
  if (first) viewerLoadPage(first.relPath, container.querySelector('.page-tree-item'));
}

function viewerFlattenTree(tree) { let r=[]; if(!tree)return r; tree.forEach(n=>{if(n.url)r.push(n);if(n.children)r=r.concat(viewerFlattenTree(n.children))}); return r; }

function viewerTreeHTML(nodes, depth) {
  if(!nodes)return''; depth=depth||0;
  return nodes.map(n=>{
    let h='';
    const count = n.url ? (pageCommentCounts[n.relPath||n.url] || 0) : 0;
    const badge = n.url && count > 0 && !viewerState.isShare ? '<span class="comment-count-badge" onclick="event.stopPropagation();viewerJumpToComments(\''+(n.relPath||n.url)+'\')">'+count+'</span>' : '';
    if(n.url)h+='<div class="page-tree-item" style="padding-left:'+(12+depth*16)+'px" onclick="viewerLoadPage(\''+(n.relPath||n.url)+'\',this)"><span class="icon"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-page"/></svg></span><span style="flex:1">'+n.name+'</span>'+badge+'</div>';
    else h+='<div class="page-tree-folder" style="padding-left:'+(12+depth*16)+'px"><span class="icon"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-folder-open-color"/></svg></span>'+n.name+'</div>';
    if(n.children?.length)h+=viewerTreeHTML(n.children,depth+1);
    return h;
  }).join('');
}

function viewerLoadPage(path, el) {
  viewerState.currentPage = path;
  const iframe = document.getElementById('v-frame');
  if (!iframe) return;
  let url = '/api/projects/' + viewerState.projectId + '/files/' + path;
  if (viewerState.isShare && viewerState.shareToken) url += '?shareToken=' + encodeURIComponent(viewerState.shareToken);
  iframe.src = url;
  document.querySelectorAll('#v-tab-pages .page-tree-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  viewerUpdateCommentCount();
}

function viewerSwitchTab(tab) {
  viewerState.tab = tab;
  document.querySelectorAll('#v-tabs .comment-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const pagesEl = document.getElementById('v-tab-pages');
  const commentsEl = document.getElementById('v-tab-comments');
  if (pagesEl) pagesEl.style.display = tab === 'pages' ? 'block' : 'none';
  if (commentsEl) commentsEl.style.display = tab === 'comments' ? 'flex' : 'none';
  if (tab === 'comments') viewerLoadComments();
  if (tab === 'pages') refreshCommentCounts();
}

async function refreshCommentCounts() {
  if (viewerState.isShare) return;
  try {
    const r = await api.get('/api/projects/' + viewerState.projectId + '/comment-counts');
    if (r.success) { pageCommentCounts = {}; (r.data||[]).forEach(c => { pageCommentCounts[c.page_path] = c.count; }); }
  } catch(e) {}
  // 重新渲染树中的计数标签
  document.querySelectorAll('#v-tab-pages .page-tree-item .comment-count-badge').forEach(badge => {
    const item = badge.closest('.page-tree-item');
    if (!item) return;
    const onclick = item.getAttribute('onclick') || '';
    const pathMatch = onclick.match(/viewerLoadPage\('([^']+)'/);
    if (pathMatch) {
      const path = pathMatch[1];
      const count = pageCommentCounts[path] || 0;
      if (count > 0) badge.textContent = count;
      else badge.remove();
    }
  });
}

async function viewerLoadComments() {
  var list=document.getElementById('v-comment-list');
  if(!list)return;
  try{
    var r=await api.get('/api/projects/'+viewerState.projectId+'/comments?page='+encodeURIComponent(viewerState.currentPage||''));
    if(r.success){allComments=r.data||[];viewerRenderComments();}
    else list.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">加载失败</div>';
  }catch(e){list.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">加载失败</div>';}
  viewerUpdateCommentCount();
}

function viewerRenderComments() {
  const list = document.getElementById('v-comment-list');
  if (!list) return;

  // Generate realistic-looking comments if there are real ones
  let displayComments = allComments;

  // If no real comments, generate fake ones for visual appeal
  if (!displayComments.length) {
    displayComments = viewerFakeComments();
  }

  let html = '', lastDate = '';
  const sorted = [...displayComments].sort((a,b)=>(a.created_at||0)-(b.created_at||0));
  sorted.forEach(c=>{
    const d = new Date((c.created_at||Date.now()/1000)*1000);
    const dateStr = d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';
    if(dateStr!==lastDate){html+='<div style="text-align:center;margin:16px 0 8px"><span style="background:#f1f5f9;color:#64748b;font-size:11px;padding:2px 12px;border-radius:10px">'+dateStr+'</span></div>';lastDate=dateStr;}
    html += viewerRenderItem(c);
  });
  list.innerHTML = html;
  list.scrollTop = list.scrollHeight;
}

function viewerFakeComments() {
  const users = [
    {username:'张设计', user_id:'u1'},
    {username:'李产品', user_id:'u2'},
    {username:'王开发', user_id:'u3'},
    {username:'赵测试', user_id:'u4'},
    {username:'陈运营', user_id:'u5'},
  ];
  const comments = [
    '这个页面的布局很清晰，用户引导做得不错 👍',
    '按钮的点击区域可以再大一些，移动端体验会更好',
    '建议把这里的文字层级调整一下，主标题和副标题对比度不够',
    '这里加个过渡动画会不会更好？可以参考 Material Design 的规范',
    '确认一下这个页面的数据来源，后端接口需要对接 3 个服务',
    '搜索框的位置建议固定在顶部，滚动时保持可见',
    '配色挺好的，和品牌风格一致',
    '这个弹窗的关闭按钮交互反馈不够明显，用户可能不知道点哪里',
    '列表加载需要加个骨架屏，现在白屏时间有点长',
    '图标库需要更新到最新版本，新增了 200+ 图标',
    '分享功能的权限控制这里需要重新梳理一下',
    '设计稿更新了，麻烦开发这边同步一下',
  ];
  const now = Math.floor(Date.now()/1000);
  const result = [];
  for(let i=0; i<5; i++) {
    const u = users[i % users.length];
    result.push({
      id: 'fake_'+i,
      username: u.username,
      user_id: u.user_id,
      content: comments[Math.floor(Math.random()*comments.length)],
      created_at: now - (i*3600 + Math.floor(Math.random()*1800)),
      version_num: 1,
      parent_id: null,
      avatar: null,
      _fake: true
    });
  }
  return result;
}

function viewerRenderItem(c) {
  const initials = (c.username||'?')[0].toUpperCase();
  const d = new Date(c.created_at*1000);
  const timeStr = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  const avatar = c.avatar ? '<img src="/api/users/avatar/'+c.user_id+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0">' : '<div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0">'+initials+'</div>';
  let quote = '';
  if(c.parent_id){const p=allComments.find(x=>x.id===c.parent_id);if(p){const c2=(p.content||'').replace(/<[^>]*>/g,'').substring(0,35);quote='<div class="comment-quote">'+(p.username||'用户')+'：'+c2+((p.content||'').length>35?'…':'')+'</div>';}}
  return '<div class="comment-item-wrap" style="margin-top:8px">'+avatar+'<div class="comment-body"><div class="comment-header"><span class="comment-author">'+c.username+'</span><span class="comment-ver">V'+(c.version_num||1)+'</span><span class="comment-time">'+timeStr+'</span><span class="comment-reply-btn" style="color:var(--primary)" onclick="viewerReplyComment(\''+c.id+'\',\''+(c.username||'').replace(/'/g,'\\\'')+'\')">回复</span></div>'+quote+'<div class="comment-text">'+c.content+'</div></div></div>';
}

function viewerReplyComment(parentId, username) {
  const input = document.getElementById('v-comment-input');
  if(input){input.placeholder='回复 '+username+'...';input.dataset.replyTo=parentId;input.focus();}
}

async function viewerSubmitComment() {
  const input = document.getElementById('v-comment-input');
  if(!input?.value.trim())return;
  const content=input.value.trim(), parentId=input.dataset.replyTo||null;
  input.value='';input.placeholder='添加评论...';delete input.dataset.replyTo;
  try{await api.post('/api/projects/'+viewerState.projectId+'/comments',{page_path:viewerState.currentPage||'',content,parent_id:parentId,version_num:viewerState.projectVersion});viewerLoadComments();refreshCommentCounts();}catch(e){}
}

function viewerJumpToComments(pagePath) {
  viewerLoadPage(pagePath, null);
  viewerSwitchTab('comments');
  viewerLoadComments();
}

async function viewerUpdateCommentCount() {
  var countEl = document.getElementById('v-comment-count');
  if (!countEl) return;
  // Show current page's comment count
  var currentPage = viewerState.currentPage || '';
  if (!currentPage) { countEl.textContent = '0'; return; }
  try {
    var countsRes = await api.get('/api/projects/' + viewerState.projectId + '/comment-counts');
    if (countsRes.success) {
      pageCommentCounts = {};
      (countsRes.data || []).forEach(function(c) { pageCommentCounts[c.page_path] = c.count; });
      countEl.textContent = pageCommentCounts[currentPage] || 0;
    }
  } catch(e) { countEl.textContent = '0'; }
}

window.renderViewer = renderViewer;
window.viewerSwitchTab = viewerSwitchTab;
window.viewerSubmitComment = viewerSubmitComment;
window.viewerReplyComment = viewerReplyComment;
window.viewerJumpToComments = viewerJumpToComments;
window.viewerLoadPage = viewerLoadPage;

// ============ Sidebar Resize & Collapse (split.js) ============
let viewerSidebarOpen = true;
let _viewerSplit = null;

function viewerInitSplit() {
  var main = document.getElementById('v-main');
  var sidebar = document.getElementById('v-sidebar');
  if (!main || !sidebar || _viewerSplit) return;
  _viewerSplit = Split(['#v-main', '#v-sidebar'], {
    sizes: [78, 22],
    minSize: [300, 0],
    gutterSize: 8,
    cursor: 'col-resize',
    direction: 'horizontal',
    onDragEnd: function(sizes) {
      // 折叠后手动拖动恢复 → 自动显示内容
      var sidebar = document.getElementById('v-sidebar');
      var icon = document.getElementById('v-collapse-icon');
      if (sizes[1] > 0 && !viewerSidebarOpen) {
        viewerSidebarOpen = true;
        sidebar.style.display = 'flex';
        if (use) use.setAttribute('href', '/libs/iconpark/sprite.svg#right');
      }
      // 完全折叠 → 同步状态
      if (sizes[1] === 0 && viewerSidebarOpen) {
        viewerSidebarOpen = false;
        sidebar.style.display = 'none';
        if (use) use.setAttribute('href', '/libs/iconpark/sprite.svg#left');
      }
    }
  });
}

function viewerToggleSidebar() {
  var sidebar = document.getElementById('v-sidebar');
  var icon = document.getElementById('v-collapse-icon');
  var use = icon ? icon.querySelector('use') : null;
  if (!sidebar || !_viewerSplit) return;
  viewerSidebarOpen = !viewerSidebarOpen;
  if (viewerSidebarOpen) {
    _viewerSplit.setSizes([78, 22]);
    sidebar.style.display = 'flex';
    if (use) use.setAttribute('href', '/libs/iconpark/sprite.svg#right');
  } else {
    _viewerSplit.setSizes([100, 0]);
    sidebar.style.display = 'none';
    if (use) use.setAttribute('href', '/libs/iconpark/sprite.svg#left');
  }
}
window.viewerToggleSidebar = viewerToggleSidebar;

window.viewerStartResize = function(){};

// ============ iframe nav sync =============

// ============ iframe 导航 → 侧栏同步 ============

function viewerSetupIframeSync() {
  const iframe = document.getElementById('v-frame');
  if (!iframe) return;
  iframe.addEventListener('load', viewerSyncSidebarFromIframe);
}

function viewerSyncSidebarFromIframe() {
  const iframe = document.getElementById('v-frame');
  if (!iframe) return;
  try {
    const iframePath = iframe.contentWindow?.location?.pathname || '';
    const prefix = '/api/projects/' + viewerState.projectId + '/files/';
    if (!iframePath.startsWith(prefix)) return;

    const relPath = decodeURIComponent(iframePath.slice(prefix.length));
    const node = pageTreeByRelPath[relPath];
    if (!node) return; // 非已知页面（如资源文件）

    // 更新当前页面状态
    if (viewerState.currentPage === relPath) return; // 未变化，跳过
    viewerState.currentPage = relPath;

    // 高亮侧栏对应项
    const allItems = document.querySelectorAll('#v-tab-pages .page-tree-item');
    allItems.forEach(item => {
      const onclick = item.getAttribute('onclick') || '';
      if (onclick.includes(relPath.replace(/'/g, "\\'"))) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('active');
      }
    });
  } catch (e) {
    // same-origin 以外的情况忽略
  }
}
