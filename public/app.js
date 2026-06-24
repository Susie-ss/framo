const state = {
  metrics: [],
  projects: [],
  tags: [],
  projectView: "grid",
  projectQuery: "",
  projectTag: "",
  libraries: [],
  prototypes: [],
  selectedLibraryId: "",
  selectedAssetType: "components",
  assetQuery: "",
  generated: null
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeTokens(raw) {
  return {
    colorPrimary: raw?.colorPrimary || "#1677FF",
    colorSurface: raw?.colorSurface || "#FFFFFF",
    borderRadius: raw?.borderRadius || "16px",
    fontSizeBase: raw?.fontSizeBase || 14,
    spacingBase: raw?.spacingBase || 8
  };
}

async function request(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function renderNode(node) {
  if (!node) return "";

  if (node.type === "container") {
    return `
      <section class="render-root">
        <div class="render-card">
          <p class="eyebrow">Generated Layout</p>
          <h3>${escapeHtml(node.props?.title || "未命名容器")}</h3>
        </div>
        ${(node.children || []).map(renderNode).join("")}
      </section>
    `;
  }

  if (node.type === "stats") {
    return `
      <div class="render-row">
        ${(node.items || [])
          .map(
            (item) => `
            <article class="render-stat">
              <span class="eyebrow">${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
              <p>${escapeHtml(item.delta || "")}</p>
            </article>
          `
          )
          .join("")}
      </div>
    `;
  }

  if (node.type === "panel") {
    return `
      <article class="render-panel">
        <div class="card-head">
          <div>
            <p class="eyebrow">Generated Panel</p>
            <h3>${escapeHtml(node.title || "未命名面板")}</h3>
          </div>
          <button class="render-button">${escapeHtml(node.action || "操作")}</button>
        </div>
        ${
          node.table
            ? `
          <div class="render-table">
            <table>
              <thead>
                <tr>${(node.table.columns || []).map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${(node.table.rows || [])
                  .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
                  .join("")}
              </tbody>
            </table>
          </div>
        `
            : ""
        }
      </article>
    `;
  }

  return "";
}

function renderMetrics() {
  const root = document.querySelector("#metrics");
  root.innerHTML = state.metrics
    .map(
      (metric) => `
      <article class="metric-card">
        <p class="eyebrow">${escapeHtml(metric.label)}</p>
        <div class="metric-value">${escapeHtml(metric.value)}</div>
        <p class="metric-note">${escapeHtml(metric.note)}</p>
      </article>
    `
    )
    .join("");
}

function renderProjects() {
  const root = document.querySelector("#project-list");
  root.innerHTML = state.projects
    .slice(0, 3)
    .map(
      (project) => `
      <article class="list-card dashboard-project" data-open-project-id="${escapeHtml(project.id)}">
        <h4>${escapeHtml(project.name)}</h4>
        <p>${escapeHtml(project.description)}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml(project.status)}</span>
          <span class="tag">${escapeHtml(project.pages)} pages</span>
        </div>
      </article>
    `
    )
    .join("");
}

function formatDate(value) {
  if (!value) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));
}

function renderSidebarTags() {
  const root = document.querySelector("#sidebar-tags");
  root.innerHTML = state.tags.map((tag) => `
    <button class="sidebar-tag ${state.projectTag === tag.id ? "active" : ""}" data-tag-filter="${escapeHtml(tag.id)}">
      <i style="background:${escapeHtml(tag.color)}"></i><b>${escapeHtml(tag.name)}</b><small>${escapeHtml(tag.projectCount || 0)}</small>
    </button>
  `).join("");
  root.querySelectorAll("[data-tag-filter]").forEach((button) => button.addEventListener("click", () => {
    state.projectTag = state.projectTag === button.dataset.tagFilter ? "" : button.dataset.tagFilter;
    navigateTo("projects");
    renderSidebarTags();
    renderProjectsBrowser();
  }));
}

function filteredProjects() {
  const query = state.projectQuery.trim().toLowerCase();
  return state.projects.filter((project) => {
    const matchesQuery = !query || `${project.name} ${project.description}`.toLowerCase().includes(query);
    const matchesTag = !state.projectTag || project.tagIds?.includes(state.projectTag);
    return matchesQuery && matchesTag;
  });
}

function projectTags(project) {
  return (project.tags || []).map((tag) => `<span class="project-tag" style="--tag-color:${escapeHtml(tag.color)}">${escapeHtml(tag.name)}</span>`).join("");
}

function renderProjectsBrowser() {
  const root = document.querySelector("#projects-browser");
  const filter = document.querySelector("#project-filter");
  if (!root) return;
  const projects = filteredProjects();
  const activeTag = state.tags.find((tag) => tag.id === state.projectTag);
  filter.innerHTML = activeTag ? `<span>当前标签：<i style="background:${escapeHtml(activeTag.color)}"></i>${escapeHtml(activeTag.name)} <button id="clear-tag-filter">×</button></span>` : `<span>共 ${projects.length} 个项目</span>`;
  document.querySelector("#clear-tag-filter")?.addEventListener("click", () => { state.projectTag = ""; renderSidebarTags(); renderProjectsBrowser(); });
  if (!projects.length) {
    root.innerHTML = '<div class="empty-state"><span>□</span><h3>没有匹配的项目</h3><p>调整搜索条件，或创建一个新项目。</p></div>';
    return;
  }
  root.className = `project-browser ${state.projectView}`;
  root.innerHTML = projects.map((project) => `
    <article class="project-card" data-project-id="${escapeHtml(project.id)}">
      <div class="project-thumb" style="--project-color:${escapeHtml(project.color || "#5B5EF4")}">
        <div class="prototype-mini"><i></i><i></i><i></i><i></i></div>
        <button class="project-more" aria-label="项目操作">•••</button>
      </div>
      <div class="project-card-body">
        <div><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description || "等待添加项目说明")}</p></div>
        <div class="project-meta"><span>${projectTags(project)}</span><small>${escapeHtml(project.pages || 0)} 页 · ${formatDate(project.updatedAt)}</small></div>
      </div>
      <div class="project-inline-actions"><button data-preview-project="${escapeHtml(project.id)}">预览</button><button data-delete-project="${escapeHtml(project.id)}" class="danger-text">删除</button></div>
    </article>
  `).join("");
  root.querySelectorAll("[data-preview-project]").forEach((button) => button.addEventListener("click", () => { navigateTo("prototype"); showToast("已打开项目原型预览"); }));
  root.querySelectorAll("[data-delete-project]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm("确定删除这个项目吗？")) return;
    await request(`/api/projects/${button.dataset.deleteProject}`, { method: "DELETE" });
    [state.projects, state.tags] = await Promise.all([request("/api/projects"), request("/api/product-lines")]);
    renderProjects(); renderSidebarTags(); renderProjectsBrowser(); showToast("项目已删除");
  }));
}

function showToast(message, type = "success") {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = "toast"; }, 2400);
}

function closeModal() {
  const modal = document.querySelector("#app-modal");
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

function openModal({ title, subtitle, body, confirmText = "创建", onConfirm }) {
  const modal = document.querySelector("#app-modal");
  document.querySelector("#modal-title").textContent = title;
  document.querySelector("#modal-subtitle").textContent = subtitle;
  document.querySelector("#modal-body").innerHTML = body;
  const confirm = document.querySelector("#modal-confirm");
  confirm.textContent = confirmText;
  confirm.onclick = onConfirm;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function projectModal() {
  openModal({
    title: "新建项目",
    subtitle: "创建一个新的原型设计项目",
    body: `<label class="form-field">项目名称 <input id="new-project-name" placeholder="例如：首页重设计 v3" /></label><label class="form-field">项目说明 <textarea id="new-project-description" placeholder="简单描述项目目标"></textarea></label><label class="form-field">所属标签 <select id="new-project-tag"><option value="">暂不选择</option>${state.tags.map((tag) => `<option value="${escapeHtml(tag.id)}">${escapeHtml(tag.name)}</option>`).join("")}</select></label><div class="form-field"><span>卡片颜色</span><div class="color-options">${["#5B5EF4", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#06B6D4"].map((color, index) => `<button data-project-color="${color}" class="${index === 0 ? "selected" : ""}" style="background:${color}"></button>`).join("")}</div></div>`,
    onConfirm: async () => {
      const name = document.querySelector("#new-project-name").value.trim();
      if (!name) return showToast("请输入项目名称", "error");
      const selected = document.querySelector("[data-project-color].selected");
      await request("/api/projects", { method: "POST", body: JSON.stringify({ name, description: document.querySelector("#new-project-description").value, tagId: document.querySelector("#new-project-tag").value, color: selected?.dataset.projectColor }) });
      [state.projects, state.tags] = await Promise.all([request("/api/projects"), request("/api/product-lines")]);
      closeModal(); renderProjects(); renderSidebarTags(); renderProjectsBrowser(); navigateTo("projects"); showToast("项目创建成功");
    }
  });
  document.querySelectorAll("[data-project-color]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-project-color]").forEach((item) => item.classList.remove("selected")); button.classList.add("selected"); }));
}

function tagModal() {
  openModal({
    title: "新建标签",
    subtitle: "创建新的项目分类标签",
    body: `<label class="form-field">标签名称 <input id="new-tag-name" placeholder="例如：营销活动、B 端系统" /></label><div class="form-field"><span>标识颜色</span><div class="color-options">${["#5B5EF4", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#06B6D4"].map((color, index) => `<button data-tag-color="${color}" class="${index === 0 ? "selected" : ""}" style="background:${color}"></button>`).join("")}</div></div>`,
    onConfirm: async () => {
      const name = document.querySelector("#new-tag-name").value.trim();
      if (!name) return showToast("请输入标签名称", "error");
      await request("/api/product-lines", { method: "POST", body: JSON.stringify({ name, color: document.querySelector("[data-tag-color].selected")?.dataset.tagColor }) });
      state.tags = await request("/api/product-lines"); closeModal(); renderSidebarTags(); showToast("标签创建成功");
    }
  });
  document.querySelectorAll("[data-tag-color]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-tag-color]").forEach((item) => item.classList.remove("selected")); button.classList.add("selected"); }));
}

function pluginModal() {
  openModal({
    title: "下载 Flowa 插件",
    subtitle: "一键同步 Axure 原型到设计协作平台",
    confirmText: "⇩ 立即下载",
    body: `
      <div class="plugin-hero"><span class="plugin-mark">F</span><div><strong>Flowa Axure Sync 1.0.0</strong><p>通用 Electron 插件包 · 约 106KB · 支持 macOS / Windows 构建</p></div></div>
      <div class="plugin-steps">
        <div class="plugin-step"><b>1</b><div><strong>下载并解压插件</strong><small>安装包内包含源码、依赖清单和平台构建脚本</small></div></div>
        <div class="plugin-step"><b>2</b><div><strong>安装并启动</strong><small>按安装说明运行，首次使用前配置 Flowa 服务地址</small></div></div>
        <div class="plugin-step"><b>3</b><div><strong>打开 Axure 预览</strong><small>插件自动检测本地预览并整理页面结构进行发布</small></div></div>
      </div>
      <div class="plugin-features"><span>↻ 版本自动覆盖</span><span>♧ 团队共享预览</span><span>↗ 一键生成链接</span><span>▱ 多端在线预览</span></div>
    `,
    onConfirm: () => {
      const link = document.createElement("a");
      link.href = "/downloads/Flowa-Axure-Plugin-1.0.0.zip";
      link.download = "Flowa-Axure-Plugin-1.0.0.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      closeModal();
      showToast("插件下载已开始");
    }
  });
}

function renderLibraries() {
  const libraryList = document.querySelector("#library-list");
  libraryList.innerHTML = state.libraries
    .map(
      (library) => `
      <article class="list-card library-card ${library.id === state.selectedLibraryId ? "selected" : ""}" data-library-id="${escapeHtml(library.id)}">
        <h4>${escapeHtml(library.name)}</h4>
        <p>版本 ${escapeHtml(library.version)} · 来源 ${escapeHtml(library.sourceType)}</p>
        <div class="tag-row">
          ${(library.components || []).slice(0, 6).map((component) => `<span class="tag">${escapeHtml(component)}</span>`).join("")}
          ${(library.components || []).length > 6 ? `<span class="tag">+${(library.components || []).length - 6} 个组件族</span>` : ""}
        </div>
      </article>
    `
    )
    .join("");

  const current = state.libraries.find((item) => item.id === state.selectedLibraryId) || state.libraries[0];
  document.querySelector("#token-preview").textContent = JSON.stringify(
    normalizeTokens(current?.tokens),
    null,
  2
  );

  libraryList.querySelectorAll("[data-library-id]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedLibraryId = card.dataset.libraryId;
      document.querySelector("#library-select").value = state.selectedLibraryId;
      renderLibraries();
      renderAssetInspector();
    });
  });

  renderAssetInspector();
}

function renderAssetInspector() {
  const library = state.libraries.find((item) => item.id === state.selectedLibraryId);
  const root = document.querySelector("#asset-inspector");
  const grid = document.querySelector("#asset-grid");
  const assets = library?.assets;
  root.classList.toggle("empty", !assets);
  document.querySelector("#asset-title").textContent = assets ? `${library.name} · 识别资产` : "选择一个 Sketch 组件库查看识别结果";
  document.querySelector("#asset-stats").innerHTML = library?.stats
    ? Object.entries(library.stats).filter(([key]) => !["componentVariants"].includes(key)).map(([key, value]) => `<span><strong>${escapeHtml(value)}</strong>${escapeHtml({ pages: "页面", layers: "图层", colors: "颜色", fonts: "字体族", fontSizes: "字号", icons: "可用图标", components: "组件族" }[key] || key)}</span>`).join("")
    : "";

  if (!assets) {
    grid.innerHTML = '<div class="asset-empty">该组件库不是从 Sketch 导入。上传 .sketch 文件后可查看完整识别结果。</div>';
    return;
  }

  const type = state.selectedAssetType;
  let items = assets[type] || [];
  if (type === "styles") items = [...(assets.textStyles || []).map((item) => ({ ...item, kind: "文字" })), ...(assets.layerStyles || []).map((item) => ({ ...item, kind: "图层" }))];
  const query = state.assetQuery.trim().toLowerCase();
  if (query) items = items.filter((item) => [item.name, item.fullName, item.family, item.value, item.size, ...(item.usages || []), ...(item.samples || [])].filter(Boolean).join(" ").toLowerCase().includes(query));
  if (!items.length) {
    grid.innerHTML = `<div class="asset-empty">这个文件中没有识别到${escapeHtml({ components: "组件", icons: "图标", fonts: "字体", fontSizes: "字号", colors: "颜色", styles: "共享样式" }[type])}。</div>`;
    return;
  }

  const visibleItems = items.slice(0, 240);
  grid.innerHTML = visibleItems.map((item) => {
    if (type === "colors") return `<article class="asset-item color-item"><span class="color-swatch" style="background:${escapeHtml(item.value)}"></span><div><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.usages?.[0] || "全局颜色")}</small></div></article>`;
    if (type === "fonts") return `<article class="asset-item font-item"><span style="font-family:${escapeHtml(item.family)}">${escapeHtml(String(item.sample || "Aa 字体预览").slice(0, 18))}</span><strong>${escapeHtml(item.family)}</strong><small>字重 ${escapeHtml(item.weights?.join(" / ") || "400")} · ${escapeHtml(item.sizes?.length || 0)} 个字号</small></article>`;
    if (type === "fontSizes") return `<article class="asset-item type-scale-item"><span style="font-size:${Math.min(item.size, 40)}px">Aa 字体</span><strong>${escapeHtml(item.size)} px</strong><small>使用 ${escapeHtml(item.count)} 次 · ${escapeHtml(item.samples?.[0] || "")}</small></article>`;
    if (type === "icons") {
      const paths = (item.paths || []).map((path) => `<path d="${escapeHtml(path)}"></path>`).join("");
      const preview = item.previewUrl ? `<img src="${escapeHtml(item.previewUrl)}" alt="" loading="lazy" />` : `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
      return `<article class="asset-item icon-item"><span class="icon-preview" style="color:${escapeHtml(item.color)}">${preview}</span><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name.split("/").pop())}</strong><small>${escapeHtml(item.width)} × ${escapeHtml(item.height)} · ${item.previewEngine === "sketchtool" ? "Sketch 原生" : "兼容预览"}</small></article>`;
    }
    if (type === "components") return `<article class="asset-item component-item"><div class="component-preview">${item.previewUrl ? `<img src="${escapeHtml(item.previewUrl)}" alt="" loading="lazy" />` : `<span style="background:${escapeHtml(item.preview?.color || "#eee")}"></span>`}</div><strong title="${escapeHtml(item.fullName || item.name)}">${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.variantCount || 1)} 个变体</small></article>`;
    return `<article class="asset-item style-item"><span class="style-kind">${escapeHtml(item.kind)}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.family || item.color || "共享样式")}${item.size ? ` · ${escapeHtml(item.size)}px` : ""}</small></article>`;
  }).join("") + (items.length > visibleItems.length ? `<div class="asset-limit-note">共 ${escapeHtml(items.length)} 项，当前展示前 ${visibleItems.length} 项；输入名称可搜索全部资产。</div>` : "");
}

function renderPrototypes() {
  const meta = state.prototypes[0];
  if (!meta) return;

  document.querySelector("#prototype-meta").innerHTML = `
    <div class="mini-card">
      <p class="eyebrow">托管原型</p>
      <h3>${escapeHtml(meta.name)}</h3>
      <p>${escapeHtml(meta.type.toUpperCase())} · ${escapeHtml(meta.version)}</p>
    </div>
  `;

  document.querySelector("#prototype-frame").src = meta.url;
}

function renderGeneratedResult() {
  const output = document.querySelector("#json-output");
  const canvas = document.querySelector("#render-canvas");

  if (!state.generated) {
    output.textContent = "点击“生成页面”后，这里会出现结构化 JSON。";
    canvas.innerHTML = "";
    document.querySelector("#reference-list").innerHTML = '<p class="muted">生成后展示所引用的组件与用途。</p>';
    return;
  }

  output.textContent = JSON.stringify(state.generated, null, 2);
  canvas.style.setProperty("--primary", state.generated.tokens?.colorPrimary || "#1677FF");
  canvas.style.setProperty("--paper-strong", state.generated.tokens?.colorSurface || "#FFFFFF");
  canvas.style.setProperty("--generated-radius", state.generated.tokens?.borderRadius || "16px");
  canvas.innerHTML = (state.generated.layout || []).map(renderNode).join("");
  document.querySelector("#reference-list").innerHTML = (state.generated.componentReferences || []).map((reference) => `
    <div class="reference-item">
      <span>${escapeHtml(reference.role)}</span>
      <strong>${escapeHtml(reference.component)}</strong>
      <small>${escapeHtml(reference.reason)}</small>
    </div>
  `).join("");
}

async function uploadSketch(file) {
  if (!file) return;
  const status = document.querySelector("#upload-status");
  status.textContent = "正在解析…";
  status.className = "status-pill loading";
  const form = new FormData();
  form.append("file", file);
  try {
    const response = await fetch("/api/sketch/import", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `上传失败：${response.status}`);
    state.libraries.unshift(payload.library);
    state.selectedLibraryId = payload.library.id;
    renderLibraries();
    initLibrarySelect();
    status.textContent = `已识别 ${payload.library.stats.components} 个组件`;
    status.className = "status-pill success";
  } catch (error) {
    status.textContent = error.message;
    status.className = "status-pill error";
  }
}

function initSketchUpload() {
  const input = document.querySelector("#sketch-input");
  const zone = document.querySelector("#sketch-dropzone");
  const pick = () => input.click();
  document.querySelector("#pick-sketch-btn").addEventListener("click", pick);
  zone.addEventListener("click", pick);
  zone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") pick(); });
  input.addEventListener("change", () => uploadSketch(input.files[0]));
  for (const eventName of ["dragenter", "dragover"]) zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.add("dragging"); });
  for (const eventName of ["dragleave", "drop"]) zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.remove("dragging"); });
  zone.addEventListener("drop", (event) => uploadSketch(event.dataTransfer.files[0]));
  document.querySelectorAll(".asset-tab").forEach((tab) => tab.addEventListener("click", () => {
    document.querySelectorAll(".asset-tab").forEach((item) => item.classList.toggle("active", item === tab));
    state.selectedAssetType = tab.dataset.asset;
    renderAssetInspector();
  }));
  document.querySelector("#asset-search").addEventListener("input", (event) => {
    state.assetQuery = event.target.value;
    renderAssetInspector();
  });
}

async function generatePage() {
  const prompt = document.querySelector("#page-prompt").value.trim();
  const payload = await request("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      libraryId: state.selectedLibraryId
    })
  });

  state.generated = payload.result;
  renderGeneratedResult();
}

function initLibrarySelect() {
  const select = document.querySelector("#library-select");
  select.innerHTML = state.libraries
    .map(
      (library) => `
      <option value="${library.id}">${escapeHtml(library.name)} · ${escapeHtml(library.version)}</option>
    `
    )
    .join("");

  state.selectedLibraryId = state.selectedLibraryId || state.libraries[0]?.id || "";
  select.value = state.selectedLibraryId;

  select.addEventListener("change", () => {
    state.selectedLibraryId = select.value;
    renderLibraries();
  });
}

function navigateTo(target) {
  const links = Array.from(document.querySelectorAll(".nav-link[data-section]"));
  const panels = Array.from(document.querySelectorAll(".panel"));
  links.forEach((item) => item.classList.toggle("active", item.dataset.section === target));
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === target));
  document.querySelector(".sidebar").classList.remove("mobile-open");
  if (target === "projects") renderProjectsBrowser();
}

function initNavigation() {
  const links = Array.from(document.querySelectorAll(".nav-link[data-section]"));

  links.forEach((link) => {
    link.addEventListener("click", () => navigateTo(link.dataset.section));
  });
  document.querySelectorAll("[data-go]").forEach((item) => item.addEventListener("click", (event) => { event.preventDefault(); navigateTo(item.dataset.go); }));
}

function initPlatformChrome() {
  document.querySelectorAll("[data-open-project]").forEach((button) => button.addEventListener("click", projectModal));
  document.querySelector("#quick-create-btn").addEventListener("click", projectModal);
  document.querySelector("#download-plugin-btn").addEventListener("click", pluginModal);
  document.querySelector("#new-tag-btn").addEventListener("click", tagModal);
  document.querySelector("#modal-close").addEventListener("click", closeModal);
  document.querySelector("#modal-cancel").addEventListener("click", closeModal);
  document.querySelector("#app-modal").addEventListener("click", (event) => { if (event.target.id === "app-modal") closeModal(); });
  document.querySelector("#project-search").addEventListener("input", (event) => { state.projectQuery = event.target.value; renderProjectsBrowser(); });
  document.querySelectorAll("[data-project-view]").forEach((button) => button.addEventListener("click", () => {
    state.projectView = button.dataset.projectView;
    document.querySelectorAll("[data-project-view]").forEach((item) => item.classList.toggle("active", item === button));
    renderProjectsBrowser();
  }));
  document.querySelector("#sidebar-collapse-btn").addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
  document.querySelector("#mobile-menu-btn").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("mobile-open"));
  const toggleMenu = (id) => {
    document.querySelectorAll(".dropdown-panel").forEach((menu) => menu.classList.toggle("open", menu.id === id && !menu.classList.contains("open")));
  };
  document.querySelector("#notification-btn").addEventListener("click", (event) => { event.stopPropagation(); toggleMenu("notification-menu"); });
  document.querySelector("#user-menu-btn").addEventListener("click", (event) => { event.stopPropagation(); toggleMenu("user-menu"); });
  document.addEventListener("click", () => document.querySelectorAll(".dropdown-panel").forEach((menu) => menu.classList.remove("open")));
}

async function bootstrap() {
  const [metrics, projects, libraries, prototypes, tags] = await Promise.all([
    request("/api/metrics"),
    request("/api/projects"),
    request("/api/libraries"),
    request("/api/prototypes"),
    request("/api/product-lines")
  ]);

  state.metrics = metrics;
  state.projects = projects;
  state.libraries = libraries;
  state.prototypes = prototypes;
  state.tags = tags;
  state.selectedLibraryId = libraries[0]?.id || "";

  renderMetrics();
  renderProjects();
  renderSidebarTags();
  renderProjectsBrowser();
  renderLibraries();
  initLibrarySelect();
  renderPrototypes();
  renderGeneratedResult();
  initNavigation();
  initSketchUpload();
  initPlatformChrome();

  document.querySelector("#generate-btn").addEventListener("click", generatePage);
  await generatePage();
}

bootstrap().catch((error) => {
  console.error(error);
  document.querySelector("#json-output").textContent = `初始化失败：${error.message}`;
});
