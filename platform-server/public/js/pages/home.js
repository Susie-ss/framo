// pages/home.js - 首页
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return diff + ' 秒前';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  return Math.floor(diff / 86400) + ' 天前';
}

// Generate a lighter version of color for gradient
function lightenColor(hex, amount) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = Math.min(255, parseInt(h.substring(0,2), 16) + amount);
  const g = Math.min(255, parseInt(h.substring(2,4), 16) + amount);
  const b = Math.min(255, parseInt(h.substring(4,6), 16) + amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

async function renderHomePage() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  mainContent.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:60px"><div class="spinner"></div></div>';

  try {
    const result = await api.get('/api/stats');
    if (!result.success) { mainContent.innerHTML = '<div class="empty-state"><p>加载失败</p></div>'; return; }
    const s = result.data;

    const latestTimeStr = s.latestCommentTime ? timeAgo(s.latestCommentTime) : '暂无';

    mainContent.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px">' +
        // 项目总数
        '<div class="stat-card">' +
          '<div class="icon-wrap" style="background:#EEF0FF"><svg class="icon-color" style="font-size:18px"><use href="/libs/iconpark/icons.svg#ico-folder"/></svg></div>' +
          '<div class="label">项目总数</div>' +
          '<div class="value">' + (s.projectCount || 0) + '</div>' +
          '<div class="change up">↑ ' + (s.thisWeekProjectCount || 0) + ' 本周新增</div>' +
        '</div>' +
        // 评论数
        '<div class="stat-card">' +
          '<div class="icon-wrap" style="background:#FFF7ED"><svg class="icon-color" style="font-size:18px"><use href="/libs/iconpark/icons.svg#ico-chat"/></svg></div>' +
          '<div class="label">评论数</div>' +
          '<div class="value">' + (s.totalCommentCount || 0) + '</div>' +
          '<div class="change down">↓ 最新 ' + latestTimeStr + '</div>' +
        '</div>' +
        // 标签数
        '<div class="stat-card">' +
          '<div class="icon-wrap" style="background:#F0FDF4"><svg class="icon-color" style="font-size:18px"><use href="/libs/iconpark/icons.svg#ico-tag"/></svg></div>' +
          '<div class="label">标签数</div>' +
          '<div class="value">' + (s.tagCount || 0) + '</div>' +
          '<div class="change up">标签数量</div>' +
        '</div>' +
      '</div>' +

      // AI 生成入口
      '<div style="margin-bottom:32px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
          '<h3 style="font-size:15px;font-weight:700">AI 智能生成</h3>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
          '<div onclick="navigateTo(\'ai-generate\')" style="background:linear-gradient(135deg,#5B5EF4,#8B5CF6);border-radius:var(--radius);padding:24px;cursor:pointer;color:#fff;transition:transform .2s;display:flex;align-items:center;gap:16px" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'">' +
            '<div style="width:48px;height:48px;background:rgba(255,255,255,.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">✨</div>' +
            '<div>' +
              '<div style="font-size:15px;font-weight:600;margin-bottom:4px">AI 生成原型</div>' +
              '<div style="font-size:12px;opacity:.8">描述需求，AI 自动生成原型界面</div>' +
            '</div>' +
          '</div>' +
          '<div onclick="navigateTo(\'ai-generate\')" style="background:var(--surface);border:2px dashed var(--border);border-radius:var(--radius);padding:24px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:16px" onmouseover="this.style.borderColor=\'var(--primary)\';this.style.background=\'var(--primary-light)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--surface)\'">' +
            '<div style="width:48px;height:48px;background:var(--bg);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px">🎨</div>' +
            '<div>' +
              '<div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px">匹配设计系统风格</div>' +
              '<div style="font-size:12px;color:var(--text-muted)">选择组件库，生成匹配风格的界面</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // 最近项目
      '<div><h3 style="font-size:15px;font-weight:700;margin-bottom:14px">最近项目</h3>' +
        (s.recentProjects && s.recentProjects.length > 0 ?
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">' +
          s.recentProjects.map(p => {
            const pColor = p.color || '#5B5EF4';
            const lighterColor = lightenColor(pColor, 100);
            const hasPL = p.productLines && p.productLines.length > 0;
            const plTags = hasPL
              ? p.productLines.slice(0, 2).map(pl => {
                  const st = getTagStyle(pl.color || '#5B5EF4');
                  return '<span class="pl-tag" style="' + st + '">' + pl.name + '</span>';
                }).join(' ')
                + (p.productLines.length > 2 ? '<span class="pl-tag-more" title="' + p.productLines.map(pl=>pl.name).join(', ') + '">...</span>' : '')
              : '';
            return '<div onclick="navigateTo(\'project-detail\',{id:\'' + p.id + '\'})" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor=\'var(--primary)\';this.style.boxShadow=\'var(--shadow-lg)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.boxShadow=\'none\';this.style.transform=\'none\'">' +
              '<div style="height:130px;background:linear-gradient(135deg,' + lighterColor + '20, ' + pColor + '10);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">' +
                '<div style="width:120px;height:90px;background:#fff;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.12);display:flex;flex-direction:column;padding:8px;gap:5px">' +
                  '<div style="height:14px;background:' + pColor + ';opacity:.3;border-radius:4px"></div>' +
                  '<div style="height:8px;background:#E8EAEF;border-radius:4px"></div>' +
                  '<div style="height:8px;background:#E8EAEF;border-radius:4px;width:60%"></div>' +
                  '<div style="height:8px;background:#E8EAEF;border-radius:4px"></div>' +
                  '<div style="height:8px;background:#E8EAEF;border-radius:4px;width:55%"></div>' +
                '</div>' +
              '</div>' +
              '<div style="padding:12px 14px">' +
                '<div style="font-size:13px;font-weight:500;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.name + '</div>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-muted);gap:8px">' +
                  '<span style="display:flex;align-items:center;gap:3px;overflow:hidden;flex:1;min-width:0">' + plTags + '</span>' +
                  '<span>' + (p.pages_json ? formatDate(p.updated_at) : '等待上传') + '</span>' +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('') +
          '</div>' :
          '<div style="text-align:center;padding:40px 20px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text-muted)">' +
            '<div style="font-size:32px;margin-bottom:8px;opacity:.4"><svg class="icon-color icon-xl" style="opacity:.4"><use href="/libs/iconpark/icons.svg#ico-folder-empty"/></svg></div>' +
            '<div style="font-size:14px">还没有项目</div>' +
            '<div style="font-size:12px;margin-top:6px"><a onclick="navigateTo(\'projects\')" style="color:var(--primary);cursor:pointer">去创建项目 →</a></div>' +
          '</div>') +
      '</div>';
  } catch (e) {
    mainContent.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}
window.renderHomePage = renderHomePage;
