// pages/projects.js - 项目列表页面

function getTagStyle(hexColor) {
  let h = hexColor.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = parseInt(h.substring(0,2), 16);
  const g = parseInt(h.substring(2,4), 16);
  const b = parseInt(h.substring(4,6), 16);
  return 'background:rgba('+r+','+g+','+b+',.18);color:'+hexColor;
}

function lightenColor(hex, amount) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = Math.min(255, parseInt(h.substring(0,2), 16) + amount);
  const g = Math.min(255, parseInt(h.substring(2,4), 16) + amount);
  const b = Math.min(255, parseInt(h.substring(4,6), 16) + amount);
  return '#'+r.toString(16).padStart(2,'0')+g.toString(16).padStart(2,'0')+b.toString(16).padStart(2,'0');
}

let allProjects = [];
let allTags = [];
let currentViewMode = 'grid';
let searchKeyword = '';
let currentProductLine = null;

function getProject(id) { return (allProjects||[]).find(p=>p.id===id)||{}; }
function getProjectName(id) { return getProject(id).name||''; }

async function renderProjectsPage() {
  searchKeyword = '';
  currentProductLine = null;
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = '<div class="toolbar"><h2>项目</h2><div class="spacer"></div><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-primary" onclick="showNewProjectModal()">+ 新建项目</button><div style="position:relative"><input type="text" id="proj-search" placeholder="搜索项目..." value="'+searchKeyword+'" style="padding:8px 12px 8px 32px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;outline:none;background:var(--surface);width:200px" oninput="onProjectSearch(this.value)"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%)"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-search"/></svg></span></div><div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden"><button id="proj-view-grid" onclick="switchProjectView(\'grid\')" style="padding:8px 12px;background:var(--surface);color:var(--text-secondary);border:none;cursor:pointer"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-grid"/></svg></button><button id="proj-view-list" onclick="switchProjectView(\'list\')" style="padding:8px 12px;background:var(--surface);color:var(--text-secondary);border:none;cursor:pointer"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-list"/></svg></button></div></div></div><div id="projects-content-container"></div>';

  await loadProjects();
  switchProjectView(currentViewMode);
}

async function loadProjects() {
  try {
    const result = await api.get('/api/projects');
    if (!result.success) { showToast(result.message||'加载失败','error'); return; }
    allProjects = (result.data||[]).map(p=>({...p,productLines:p.productLines||[]}));
    try {
      const tagRes = await api.get('/api/product-lines');
      if(tagRes.success) allTags = (tagRes.data&&tagRes.data.lines)||[];
    }catch(e){}
    renderProjectsContent();
  }catch(err){showToast('网络错误','error');}
}

function onProjectSearch(keyword){searchKeyword=keyword.trim().toLowerCase();renderProjectsContent();}

function getFilteredProjects(){
  let projects=allProjects||[];
  if(currentProductLine) projects=projects.filter(p=>p.productLines&&p.productLines.some(pl=>pl.id===currentProductLine));
  if(searchKeyword) projects=projects.filter(p=>p.name.toLowerCase().includes(searchKeyword));
  return projects;
}

function switchProjectView(mode){
  currentViewMode=mode;
  var gb=document.getElementById('proj-view-grid'),lb=document.getElementById('proj-view-list');
  if(gb){gb.style.background=mode==='grid'?'var(--primary)':'var(--surface)';gb.style.color=mode==='grid'?'#fff':'var(--text-secondary)';gb.classList.toggle('view-btn-active',mode==='grid');}
  if(lb){lb.style.background=mode==='list'?'var(--primary)':'var(--surface)';lb.style.color=mode==='list'?'#fff':'var(--text-secondary)';lb.classList.toggle('view-btn-active',mode==='list');}
  renderProjectsContent();
}

function renderProjectsContent(){
  var c=document.getElementById('projects-content-container');
  if(!c)return;
  var projects=getFilteredProjects();
  if(!projects||!projects.length){
    c.innerHTML='<div class="empty-state"><div class="empty-state-icon"><svg class="icon-color icon-xl"><use href="/libs/iconpark/icons.svg#ico-folder-empty"/></svg></div><div class="empty-state-text">'+(searchKeyword?'没有匹配的项目':'暂无项目')+'</div><div class="empty-state-hint">'+(searchKeyword?'尝试其他关键词':'点击上方按钮创建第一个项目')+'</div></div>';
    return;
  }
  if(currentViewMode==='grid') renderProjectGridView(c,projects);
  else renderProjectListView(c,projects);
}

function renderProjectGridView(container,projects){
  container.innerHTML='<div class="card-grid">'+projects.map(function(p){
    var pColor=p.color||'#5B5EF4';
    var lighterColor=lightenColor(pColor,120);
    var hasPL=p.productLines&&p.productLines.length>0;
    var allTagNames=hasPL?p.productLines.map(function(pl){return pl.name;}).join(', '):'';
    var plTags=hasPL?p.productLines.slice(0,2).map(function(pl){
      return '<span class="pl-tag" style="'+getTagStyle(pl.color||'#5B5EF4')+'">'+pl.name+'</span>';
    }).join(' ')+(p.productLines.length>2?'<span class="pl-tag-more" title="'+allTagNames+'">...</span>':''):'';
    return '<div class="project-card" data-pid="'+p.id+'" onclick="goToProjectPreview(\''+p.id+'\')">'+
      '<div class="thumb" style="background:linear-gradient(135deg,'+lighterColor+'20,'+pColor+'10)">'+
        '<div class="frame">'+
          '<div class="row primary" style="height:14px;background:'+pColor+';opacity:.3;border-radius:4px"></div>'+
          '<div class="row"></div><div class="row short"></div><div class="row"></div><div class="row short"></div>'+
        '</div>'+
        '<button class="project-card-menu-btn" data-pid="'+p.id+'" title="更多"><svg class="icon-color icon-md"><use href="/libs/iconpark/icons.svg#ico-three-dots"/></svg></button>'+
        '<div class="overlay"><button class="mini-btn preview-btn" onclick="event.stopPropagation();goToProjectPreview(\''+p.id+'\')"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-eye"/></svg> 预览</button></div>'+
      '</div>'+
      '<div class="info"><h4>'+p.name+'</h4><div class="meta">'+
        '<span class="pl-tags">'+plTags+'</span>'+
        '<span>'+formatDate(p.updated_at)+'</span>'+
      '</div></div></div>';
  }).join('')+'</div>';

  // Bind 3-dot menu clicks via event delegation
  container.querySelectorAll('.project-card-menu-btn').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      toggleProjectCardMenu(this);
    });
  });
}

function renderProjectListView(container,projects){
  container.innerHTML='<div class="file-list-view">'+projects.map(function(p){
    var pColor=p.color||'#5B5EF4';
    var hasPL=p.productLines&&p.productLines.length>0;
    var allTagNames=hasPL?p.productLines.map(function(pl){return pl.name;}).join(', '):'';
    var plTags=hasPL?p.productLines.slice(0,2).map(function(pl){
      return '<span class="pl-tag" style="'+getTagStyle(pl.color||'#5B5EF4')+'">'+pl.name+'</span>';
    }).join(' ')+(p.productLines.length>2?'<span class="pl-tag-more" title="'+allTagNames+'">...</span>':''):'';
    return '<div class="file-list-item" onclick="goToProjectPreview(\''+p.id+'\')">'+
      '<div class="file-icon" style="background:'+pColor+'15;color:'+pColor+'">'+getInitials(p.name)+'</div>'+
      '<div class="file-info"><div class="file-name">'+p.name+'</div><div class="file-meta">'+
        '<span class="pl-tags">'+plTags+'</span><span>更新于 '+formatDate(p.updated_at)+'</span>'+
      '</div></div>'+
      '<div class="file-actions">'+
        '<button class="btn btn-ghost btn-sm" data-act="edit" data-pid="'+p.id+'"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-edit"/></svg></button>'+
        '<button class="btn btn-ghost btn-sm" data-act="tag" data-pid="'+p.id+'"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-tag"/></svg></button>'+
        '<button class="btn btn-ghost btn-sm" style="color:#EF4444" data-act="del" data-pid="'+p.id+'"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-delete"/></svg></button>'+
      '</div></div>';
  }).join('')+'</div>';

  // Bind list view action buttons
  container.querySelectorAll('[data-act]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var pid=btn.getAttribute('data-pid');
      var act=btn.getAttribute('data-act');
      if(act==='edit') showEditProjectModal(pid);
      else if(act==='tag') showTagSettingModal(pid);
      else if(act==='del') deleteProject(pid);
    });
  });
}

function goToProjectPreview(projectId){
  window.open('/preview.html?project='+projectId,'_blank');
}
window.goToProjectPreview=goToProjectPreview;

// ===== 3-dot menu (fixed to body, compact) =====
function toggleProjectCardMenu(btn){
  var existing=document.querySelector('.project-card-dropdown');
  if(existing){existing.remove();if(existing.dataset.pid===btn.getAttribute('data-pid'))return;}
  var pid=btn.getAttribute('data-pid');
  var menu=document.createElement('div');
  menu.className='project-card-dropdown';
  menu.dataset.pid=pid;
  menu.innerHTML=''+
    '<button class="project-card-dropdown-item" data-act="edit"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-edit"/></svg> 编辑</button>'+
    '<button class="project-card-dropdown-item" data-act="tag"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-tag"/></svg> 设置标签</button>'+
    '<button class="project-card-dropdown-item danger" data-act="del"><svg class="icon-color icon-sm"><use href="/libs/iconpark/icons.svg#ico-delete"/></svg> 删除</button>';
  document.body.appendChild(menu);
  var rect=btn.getBoundingClientRect();
  menu.style.position='fixed';
  menu.style.top=(rect.bottom+4)+'px';
  menu.style.left=Math.min(rect.right-140,window.innerWidth-150)+'px';
  menu.style.minWidth='130px';

  // Bind menu item clicks (no inline onclick = no syntax errors)
  menu.querySelectorAll('[data-act]').forEach(function(item){
    item.addEventListener('click',function(e){
      e.stopPropagation();
      var act=item.getAttribute('data-act');
      menu.remove();
      if(act==='edit') showEditProjectModal(pid);
      else if(act==='tag') showTagSettingModal(pid);
      else if(act==='del') deleteProject(pid);
    });
  });

  setTimeout(function(){
    document.addEventListener('click',function closeMenu(e){
      if(!menu.contains(e.target)&&e.target!==btn){menu.remove();document.removeEventListener('click',closeMenu);}
    });
  },10);
}
window.toggleProjectCardMenu=toggleProjectCardMenu;

// ===== Edit modal (name + color, no cancel button) =====
function showEditProjectModal(projectId){
  var project=getProject(projectId);
  var projectName=project.name||'';
  var currentColor=project.color||'#5B5EF4';
  var colors=['#5B5EF4','#22C55E','#F59E0B','#EF4444','#A855F7','#06B6D4','#8B5CF6'];

  var overlay = Modal.show({
    title: '编辑项目', subtitle: '修改名称或卡片颜色',
    width: 420,
    body: '<div class="form-row"><label>项目名称 <span style="color:#EF4444">*</span></label><input type="text" id="edit-proj-name" value="'+projectName+'" placeholder="项目名称" style="padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;outline:none;width:100%;box-sizing:border-box"></div>'+
      '<div class="form-row" style="margin-top:14px"><label>卡片颜色</label>'+
        '<div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap" id="edit-proj-colors">'+
          colors.map(function(c){return '<div class="color-swatch '+(c===currentColor?'selected':'')+'" style="background:'+c+'" data-color="'+c+'"></div>';}).join('')+
        '</div>'+
        '<input type="hidden" id="edit-proj-color" value="'+currentColor+'">'+
      '</div>',
    buttons: [
      { text: '保存', cls: 'btn btn-primary', onClick: async function(ov) {
        var name=ov.querySelector('#edit-proj-name').value.trim();
        var color=ov.querySelector('#edit-proj-color').value;
        if(!name){showToast('名称不能为空','error');return;}
        try{
          var res=await api.put('/api/projects/'+projectId,{name:name,color:color});
          if(res.success){showToast('已更新','success');ov.remove();await loadProjects();}
          else showToast(res.error||'更新失败','error');
        }catch(e){showToast('网络错误','error');}
      }}
    ]
  });

  // Bind color swatches
  overlay.querySelectorAll('#edit-proj-colors .color-swatch').forEach(function(s){
    s.addEventListener('click',function(){
      overlay.querySelector('#edit-proj-color').value=s.getAttribute('data-color');
      overlay.querySelectorAll('#edit-proj-colors .color-swatch').forEach(function(ss){ss.classList.remove('selected');});
      s.classList.add('selected');
    });
  });
}
window.showEditProjectModal=showEditProjectModal;

// ===== Tag setting modal =====
var tagModalState={};

function showTagSettingModal(projectId){
  var project=getProject(projectId);
  var selectedIds=(project.productLines||[]).map(function(pl){return pl.id;});
  tagModalState[projectId]=selectedIds.slice();

  function renderTagBody(selIds){
    var selected=allTags.filter(function(t){return selIds.indexOf(t.id)>=0;});
    var available=allTags.filter(function(t){return selIds.indexOf(t.id)<0;});
    return '<div style="margin-bottom:16px">'+
      '<div class="tag-select-label">已选标签 ('+selected.length+')</div>'+
      '<div class="tag-select-grid">'+
        (selected.length===0?'<span style="font-size:12px;color:var(--text-muted)">暂无选中标签</span>':'')+
        selected.map(function(t){return '<span class="tag-select-chip" style="border-color:'+(t.color||'#5B5EF4')+'" data-tid="'+t.id+'" data-action="remove"><span class="tag-chip-dot" style="background:'+(t.color||'#5B5EF4')+'"></span>'+t.name+'<span class="tag-chip-remove">×</span></span>';}).join('')+
      '</div></div>'+
    '<div style="margin-bottom:8px">'+
      '<div class="tag-select-label">所有标签 ('+available.length+')</div>'+
      '<div class="tag-select-grid">'+
        (available.length===0?'<span style="font-size:12px;color:var(--text-muted)">暂无更多标签</span>':'')+
        available.map(function(t){return '<span class="tag-select-chip" style="border-color:'+(t.color||'#5B5EF4')+'" data-tid="'+t.id+'" data-action="add"><span class="tag-chip-dot" style="background:'+(t.color||'#5B5EF4')+'"></span>'+t.name+'</span>';}).join('')+
      '</div></div>';
  }

  var overlay = Modal.show({
    title: '设置标签', subtitle: '为项目选择分类标签',
    width: 540,
    body: '<div id="tag-modal-body">'+renderTagBody(selectedIds)+'</div>'
  });

  // Bind chip clicks via delegation
  overlay.querySelector('#tag-modal-body').addEventListener('click',function(e){
    var chip=e.target.closest('.tag-select-chip');
    if(!chip)return;
    var tid=chip.getAttribute('data-tid');
    var action=chip.getAttribute('data-action');
    var curIds=tagModalState[projectId]||selectedIds;
    if(action==='remove') tagModalState[projectId]=curIds.filter(function(id){return id!==tid;});
    else tagModalState[projectId]=curIds.concat([tid]);

    // Auto-save
    var newIds=tagModalState[projectId];
    api.put('/api/projects/'+projectId+'/tags',{tagIds:newIds}).then(function(){
      loadProjects().then(function(){
        var body=overlay.querySelector('#tag-modal-body');
        if(body) body.innerHTML=renderTagBody(newIds);
      });
    }).catch(function(){});
  });
}
window.showTagSettingModal=showTagSettingModal;

// ===== Delete project =====
function deleteProject(id){
  var project=getProject(id);
  var name=project.name||'项目';
  if(!confirm('确定要删除项目「'+name+'」吗？此操作不可恢复！'))return;
  api.del('/api/projects/'+id).then(function(res){
    if(res.success){showToast('删除成功','success');loadProjects();}
    else showToast(res.message||'删除失败','error');
  }).catch(function(){showToast('网络错误','error');});
}
window.deleteProject=deleteProject;

window.renderProjectsPage=renderProjectsPage;
window.loadProjects=loadProjects;
window.onProjectSearch=onProjectSearch;
window.switchProjectView=switchProjectView;
