const query = new URLSearchParams(window.location.search);
const token = query.get("token") || "";

const state = {
  config: null,
  document: null,
  files: [],
  editMode: query.get("mode") === "edit",
  readerMode: query.get("mode") === "reader",
  sidebarOpen: query.get("sidebar") === "1",
  outlineOpen: false,
  autosaveTimer: null,
};

const elements = {
  chrome: document.querySelector(".chrome"),
  toolbar: document.getElementById("toolbar"),
  docName: document.getElementById("doc-name"),
  docMeta: document.getElementById("doc-meta"),
  status: document.getElementById("status-pill"),
  fileSidebar: document.getElementById("file-sidebar"),
  fileList: document.getElementById("file-list"),
  outlineSidebar: document.getElementById("outline-sidebar"),
  outlineList: document.getElementById("outline-list"),
  settingsDrawer: document.getElementById("settings-drawer"),
  searchDrawer: document.getElementById("search-drawer"),
  workspace: document.getElementById("workspace"),
  editorPane: document.getElementById("editor-pane"),
  editor: document.getElementById("editor"),
  preview: document.getElementById("preview"),
  theme: document.getElementById("theme-select"),
  appearance: document.getElementById("appearance-select"),
  fontFamily: document.getElementById("font-family-select"),
  width: document.getElementById("width-input"),
  fontSize: document.getElementById("font-size-input"),
  lineHeight: document.getElementById("line-height-input"),
  searchQuery: document.getElementById("search-query"),
  searchScope: document.getElementById("search-scope"),
  searchResults: document.getElementById("search-results"),
};

document.getElementById("toggle-sidebar").addEventListener("click", () => {
  state.sidebarOpen = !state.sidebarOpen;
  syncLayout();
});
document.getElementById("toggle-outline").addEventListener("click", () => {
  state.outlineOpen = !state.outlineOpen;
  syncLayout();
});
document.getElementById("toggle-edit").addEventListener("click", () => {
  state.editMode = !state.editMode;
  state.readerMode = false;
  syncLayout();
});
document.getElementById("toggle-reader").addEventListener("click", () => {
  state.readerMode = !state.readerMode;
  if (state.readerMode) state.editMode = false;
  syncLayout();
});
document.getElementById("toggle-settings").addEventListener("click", () => {
  elements.settingsDrawer.classList.toggle("hidden");
  elements.searchDrawer.classList.add("hidden");
});
document
  .getElementById("print-page")
  .addEventListener("click", () => window.print());
document.getElementById("open-search").addEventListener("click", () => {
  elements.searchDrawer.classList.toggle("hidden");
  elements.settingsDrawer.classList.add("hidden");
  if (!elements.searchDrawer.classList.contains("hidden")) {
    elements.searchQuery.focus();
  }
});

elements.editor.addEventListener("input", async (event) => {
  const value = event.target.value;
  state.document.content = value;
  if (!state.document.temporary) {
    setStatus("Unsaved");
  }
  await renderPreview(value);
  scheduleAutosave();
});

elements.theme.addEventListener("change", saveSettings);
elements.appearance.addEventListener("change", saveSettings);
elements.fontFamily.addEventListener("change", saveSettings);
elements.width.addEventListener("input", saveSettings);
elements.fontSize.addEventListener("input", saveSettings);
elements.lineHeight.addEventListener("input", saveSettings);
elements.searchQuery.addEventListener("input", runSearch);
elements.searchScope.addEventListener("change", runSearch);
window.addEventListener("resize", syncResponsiveState);

init().catch((error) => {
  console.error(error);
  setStatus("Error");
});

async function init() {
  const [config, doc, files] = await Promise.all([
    api("/api/config"),
    api("/api/document"),
    api("/api/files").catch(() => ({ files: [] })),
  ]);

  state.config = config;
  state.document = doc;
  state.files = files.files || [];

  bindSettings(config);
  applyConfig();
  if (
    state.document.temporary &&
    !state.document.content &&
    query.get("mode") !== "reader"
  ) {
    state.editMode = true;
  }
  loadDocument(doc);
  renderFileList();
  syncLayout();
}

function bindSettings(config) {
  elements.theme.value = config.theme;
  elements.appearance.value = config.appearance;
  elements.fontFamily.value = config.font_family;
  elements.width.value = config.content_width;
  elements.fontSize.value = config.font_size;
  elements.lineHeight.value = Number.parseFloat(config.line_height) || 1.8;
}

function applyConfig() {
  const root = document.documentElement;
  root.dataset.theme = state.config.theme;
  root.dataset.appearance = state.config.appearance;
  root.style.setProperty("--content-width", `${state.config.content_width}px`);
  root.style.setProperty("--font-size", `${state.config.font_size}px`);
  root.style.setProperty("--line-height", state.config.line_height);
  root.style.setProperty("--body-font", state.config.font_family);
}

function loadDocument(doc) {
  state.document = doc;
  elements.docName.textContent = doc.name || "Untitled";
  elements.docMeta.textContent =
    doc.path || (doc.temporary ? "Temporary document" : "");
  elements.editor.value = doc.content || "";
  elements.editor.placeholder = doc.temporary
    ? "Paste Markdown here or open a file."
    : "";
  renderPreview(doc.content || "");
  updateStatusFromDocument();
}

function updateStatusFromDocument() {
  if (state.document.read_only) {
    setStatus("Read-only");
    return;
  }
  if (state.document.temporary) {
    setStatus("Temporary");
    return;
  }
  setStatus("Saved");
}

function setStatus(label) {
  elements.status.textContent = label;
}

async function renderPreview(content) {
  const payload = await api("/api/render", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  elements.preview.innerHTML = payload.html;
  rewritePreviewLinks();
  renderOutline();
}

function rewritePreviewLinks() {
  for (const image of elements.preview.querySelectorAll("img")) {
    const src = image.getAttribute("src");
    if (!src || isAbsoluteURL(src) || src.startsWith("/api/asset")) continue;
    if (looksLikeMarkdownPath(src)) {
      image.removeAttribute("src");
      image.dataset.invalidSource = src;
      image.alt = image.alt || src;
      image.classList.add("preview-image--invalid");
      continue;
    }
    image.src = `/api/asset?path=${encodeURIComponent(src)}`;
  }

  for (const link of elements.preview.querySelectorAll("a")) {
    const href = link.getAttribute("href");
    if (!href) continue;
    if (href.endsWith(".md")) {
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        const doc = await api(`/api/open?path=${encodeURIComponent(href)}`);
        loadDocument(doc);
      });
    } else if (!isAbsoluteURL(href) && !href.startsWith("#")) {
      link.href = `/api/asset?path=${encodeURIComponent(href)}`;
      link.target = "_blank";
    }
  }

  wrapPreviewTables();
}

function renderOutline() {
  const headings = Array.from(
    elements.preview.querySelectorAll("h1, h2, h3, h4"),
  );
  elements.outlineList.innerHTML = "";
  for (const heading of headings) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "outline-link";
    button.textContent = heading.textContent;
    button.dataset.level = heading.tagName.slice(1);
    button.addEventListener("click", () =>
      heading.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    elements.outlineList.appendChild(button);
  }
}

function renderFileList() {
  elements.fileList.innerHTML = "";
  for (const file of state.files) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "file-link";
    button.textContent = file.path;
    button.addEventListener("click", async () => {
      const doc = await api(`/api/open?path=${encodeURIComponent(file.path)}`);
      loadDocument(doc);
    });
    elements.fileList.appendChild(button);
  }
}

function syncLayout() {
  const showFileSidebar =
    state.sidebarOpen && state.files.length > 0 && !state.readerMode;
  const showOutlineSidebar = state.outlineOpen && !state.readerMode;

  document.body.classList.toggle("reader-mode", state.readerMode);
  elements.editorPane.classList.toggle("hidden", !state.editMode);
  elements.fileSidebar.classList.toggle("hidden", !showFileSidebar);
  elements.outlineSidebar.classList.toggle("hidden", !showOutlineSidebar);
  if (state.editMode) {
    elements.workspace.classList.add("split");
  } else {
    elements.workspace.classList.remove("split");
  }
  elements.chrome.dataset.layout = getChromeLayout(
    showFileSidebar,
    showOutlineSidebar,
  );
  requestAnimationFrame(syncResponsiveState);
}

function scheduleAutosave() {
  if (!state.document || state.document.temporary || state.document.read_only) {
    return;
  }
  if (state.autosaveTimer) {
    clearTimeout(state.autosaveTimer);
  }
  state.autosaveTimer = setTimeout(async () => {
    try {
      setStatus("Saving...");
      await api("/api/document", {
        method: "PUT",
        body: JSON.stringify({ content: elements.editor.value }),
      });
      setStatus("Saved");
    } catch (error) {
      console.error(error);
      setStatus("Save error");
    }
  }, state.config.autosave_debounce_ms);
}

async function saveSettings() {
  state.config = {
    ...state.config,
    theme: elements.theme.value,
    appearance: elements.appearance.value,
    font_family: elements.fontFamily.value,
    content_width: Number(elements.width.value),
    font_size: Number(elements.fontSize.value),
    line_height: Number(elements.lineHeight.value).toFixed(1),
  };
  applyConfig();
  await api("/api/config", {
    method: "PUT",
    body: JSON.stringify(state.config),
  });
}

async function runSearch() {
  const q = elements.searchQuery.value.trim();
  if (!q) {
    elements.searchResults.innerHTML = "";
    return;
  }
  const payload = await api(
    `/api/search?q=${encodeURIComponent(q)}&scope=${encodeURIComponent(elements.searchScope.value)}`,
  );
  elements.searchResults.innerHTML = "";
  for (const result of payload.results || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.innerHTML = `<strong>${result.path}</strong><span>Line ${result.line}: ${result.excerpt}</span>`;
    button.addEventListener("click", async () => {
      if (
        elements.searchScope.value === "workspace" &&
        result.path.endsWith(".md")
      ) {
        const doc = await api(
          `/api/open?path=${encodeURIComponent(result.path)}`,
        );
        loadDocument(doc);
      }
      scrollToLine(result.line);
    });
    elements.searchResults.appendChild(button);
  }
}

function scrollToLine(lineNumber) {
  const lines = elements.editor.value.split("\n");
  let offset = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i += 1) {
    offset += lines[i].length + 1;
  }
  elements.editor.focus();
  elements.editor.setSelectionRange(offset, offset);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("X-MDView-Token", token);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return response.json();
}

function isAbsoluteURL(value) {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  );
}

function looksLikeMarkdownPath(value) {
  return /\.md(?:[#?].*)?$/i.test(value);
}

function getChromeLayout(showFileSidebar, showOutlineSidebar) {
  if (showFileSidebar && showOutlineSidebar) return "both";
  if (showFileSidebar) return "left";
  if (showOutlineSidebar) return "right";
  return "main";
}

function syncResponsiveState() {
  const shouldStack = state.editMode && elements.workspace.clientWidth < 960;
  elements.workspace.classList.toggle("stacked", shouldStack);
}

function wrapPreviewTables() {
  for (const table of elements.preview.querySelectorAll("table")) {
    if (table.parentElement?.classList.contains("table-wrap")) {
      continue;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
}
