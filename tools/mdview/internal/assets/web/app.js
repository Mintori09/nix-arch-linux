import {
  applyInitialUIState,
  createEmptyScrollSnapshots,
  getLayoutContext,
  getMobilePanelState,
  restoreScrollTargets,
  saveScrollSnapshot,
} from "./app-state.js";
import {
  getEditorContentForSaving,
  getVimIndicatorState,
  getVimKeyAction,
  getWysiwygInitialContent,
} from "./app-wysiwyg.js";

import { Editor } from "https://esm.sh/@tiptap/core@2.11.5";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.11.5";
import { Selection, TextSelection } from "https://esm.sh/prosemirror-state@1.4.3";

const query = new URLSearchParams(window.location.search);
const token = query.get("token") || "";

const state = {
  config: null,
  document: null,
  files: [],
  viewMode: "preview",
  sidebarOpen: false,
  outlineOpen: false,
  sidebarWidth: 240,
  outlineWidth: 240,
  editorType: "textarea",
  vimMode: "insert",
  vimRegister: "",
  vimCount: "",
  autosaveTimer: null,
  scrollSnapshots: createEmptyScrollSnapshots(),
  currentContext: "preview-only",
  expandedFolders: new Set(),
  outlineHeadings: [],
  activeHeadingId: null,
  headingObserver: null,
};

let tiptapEditor = null;

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
  vimModeChip: document.getElementById("vim-mode-chip"),
  btnPreview: document.getElementById("btn-preview"),
  btnEdit: document.getElementById("btn-edit"),
  btnWysiwyg: document.getElementById("btn-wysiwyg"),
  previewPane: document.getElementById("preview-pane"),
  preview: document.getElementById("preview"),
  theme: document.getElementById("theme-select"),
  appearance: document.getElementById("appearance-select"),
  fontFamily: document.getElementById("font-family-select"),
  width: document.getElementById("width-input"),
  fontSize: document.getElementById("font-size-input"),
  bodyLineHeight: document.getElementById("body-line-height-input"),
  paragraphSpacing: document.getElementById("paragraph-spacing-input"),
  codeFontSize: document.getElementById("code-font-size-input"),
  codeLineHeight: document.getElementById("code-line-height-input"),
  editorFont: document.getElementById("editor-font-select"),
  editorFontSize: document.getElementById("editor-font-size-input"),
  editorLineHeight: document.getElementById("editor-line-height-input"),
  searchQuery: document.getElementById("search-query"),
  searchScope: document.getElementById("search-scope"),
  searchResults: document.getElementById("search-results"),
};

document.getElementById("toggle-sidebar").addEventListener("click", () => {
  transitionLayout(() => {
    if (isMobileViewport()) {
      const next = getMobilePanelState({
        isMobile: true,
        filesAvailable: state.files.length > 0,
        toggle: "sidebar",
        current: {
          sidebarOpen: state.sidebarOpen,
          outlineOpen: state.outlineOpen,
        },
      });
      state.sidebarOpen = next.sidebarOpen;
      state.outlineOpen = next.outlineOpen;
      return;
    }

    state.sidebarOpen = !state.sidebarOpen;
  });
});
document.getElementById("toggle-outline").addEventListener("click", () => {
  transitionLayout(() => {
    if (isMobileViewport()) {
      const next = getMobilePanelState({
        isMobile: true,
        filesAvailable: state.files.length > 0,
        toggle: "outline",
        current: {
          sidebarOpen: state.sidebarOpen,
          outlineOpen: state.outlineOpen,
        },
      });
      state.sidebarOpen = next.sidebarOpen;
      state.outlineOpen = next.outlineOpen;
      return;
    }

    state.outlineOpen = !state.outlineOpen;
  });
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

elements.editor.addEventListener("input", async () => {
  if (state.viewMode === "wysiwyg" && tiptapEditor) {
    return;
  }

  const value = getEditorPlainText();
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
elements.bodyLineHeight.addEventListener("input", saveSettings);
elements.paragraphSpacing.addEventListener("input", saveSettings);
elements.codeFontSize.addEventListener("input", saveSettings);
elements.codeLineHeight.addEventListener("input", saveSettings);
elements.editorFont.addEventListener("change", saveSettings);
elements.editorFontSize.addEventListener("input", saveSettings);
elements.editorLineHeight.addEventListener("input", saveSettings);

function insertFormatting(format) {
  const editor = elements.editor;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const selected = text.substring(start, end) || "text";

  const formats = {
    bold: `**${selected}**`,
    italic: `*${selected}*`,
    heading: `\n# ${selected}`,
    link: `[${selected}](url)`,
    code: `\`${selected}\``,
    list: `\n- ${selected}`,
  };

  const replacement = formats[format] || selected;
  editor.setRangeText(replacement, start, end, "select");
  editor.focus();
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

elements.searchQuery.addEventListener("input", runSearch);
elements.searchScope.addEventListener("change", runSearch);
window.addEventListener("resize", () => {
  transitionLayout(() => {}, state.currentContext);
});
window.addEventListener("keydown", (event) => {
  const isPlainEditMode = state.viewMode === "edit";
  if ((state.viewMode === "edit" || state.viewMode === "wysiwyg") && (event.ctrlKey || event.metaKey)) {
    if (event.shiftKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      if (state.viewMode === "wysiwyg") {
        toggleVimMode();
      }
      return;
    }
    const shortcuts = { b: "bold", i: "italic", k: "link" };
    const key = event.key.toLowerCase();
    if (isPlainEditMode && shortcuts[key] && !event.shiftKey) {
      event.preventDefault();
      insertFormatting(shortcuts[key]);
      return;
    }
  }

  if (event.key !== "Escape") {
    return;
  }
  if (!state.sidebarOpen && !state.outlineOpen) {
    return;
  }
  transitionLayout(() => {
    closePanels();
  });
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () =>
    init().catch(handleInitError),
  );
} else {
  init().catch(handleInitError);
}

function handleInitError(error) {
  console.error("Init failed:", error);
  setStatus("Error");
  retryInit();
}

let initRetryCount = 0;
const maxInitRetries = 3;

function retryInit() {
  if (initRetryCount >= maxInitRetries) {
    console.error("Init failed after", maxInitRetries, "retries");
    return;
  }
  initRetryCount++;
  console.log("Retrying init...", initRetryCount);
  setTimeout(() => {
    init().catch((error) => {
      console.error("Init retry failed:", error);
      if (initRetryCount < maxInitRetries) {
        retryInit();
      } else {
        setStatus("Error");
      }
    });
  }, 500 * initRetryCount);
}

async function init() {
  const [config, doc, files] = await Promise.all([
    api("/api/config"),
    api("/api/document"),
    api("/api/files").catch(() => ({ files: [] })),
  ]);

  state.config = config;
  state.document = doc;
  state.files = files.files || [];

  Object.assign(
    state,
    applyInitialUIState({
      query: Object.fromEntries(query.entries()),
      config,
      document: doc,
    }),
  );

  bindSettings(config);
  applyConfig();
  await loadDocument(doc);
  renderFileList();
  syncLayout();
  initSidebarResize();
  initOutlineResize();
  initVimModeToggle();
}

function bindSettings(config) {
  elements.theme.value = config.theme;
  elements.appearance.value = config.appearance;
  elements.fontFamily.value = config.font_family;
  elements.width.value = config.content_width;
  elements.fontSize.value = config.font_size;
  elements.bodyLineHeight.value =
    Number.parseFloat(config.body_line_height || config.line_height) || 1.8;
  elements.paragraphSpacing.value =
    Number.parseFloat(config.paragraph_spacing) || 0.85;
  elements.codeFontSize.value = config.code_font_size || 14;
  elements.codeLineHeight.value =
    Number.parseFloat(config.code_line_height) || 1.6;
  elements.editorFont.value = config.editor_font || "monospace";
  elements.editorFontSize.value = config.editor_font_size || 15;
  elements.editorLineHeight.value =
    Number.parseFloat(config.editor_line_height) || 1.7;
}

function applyConfig() {
  const root = document.documentElement;
  root.dataset.theme = state.config.theme;
  root.dataset.appearance = state.config.appearance;
  root.style.setProperty("--content-width", `${state.config.content_width}px`);
  root.style.setProperty("--font-size", `${state.config.font_size}px`);
  root.style.setProperty(
    "--body-line-height",
    state.config.body_line_height || state.config.line_height,
  );
  root.style.setProperty(
    "--paragraph-spacing",
    `${state.config.paragraph_spacing}rem`,
  );
  root.style.setProperty(
    "--code-font-size",
    `${state.config.code_font_size}px`,
  );
  root.style.setProperty("--code-line-height", state.config.code_line_height);
  root.style.setProperty("--body-font", state.config.font_family);
  root.style.setProperty(
    "--editor-font",
    state.config.editor_font || "monospace",
  );
  root.style.setProperty(
    "--editor-font-size",
    `${state.config.editor_font_size || 15}px`,
  );
  root.style.setProperty(
    "--editor-line-height",
    state.config.editor_line_height || "1.7",
  );
}

async function loadDocument(doc) {
  state.document = doc;
  elements.docName.textContent = doc.name || "Untitled";
  elements.docMeta.textContent =
    doc.path || (doc.temporary ? "Temporary document" : "");
  elements.editor.textContent = doc.content || "";
  elements.editor.placeholder = doc.temporary
    ? "Paste Markdown here or open a file."
    : "";
  autoResizeEditor();
  await renderPreview(doc.content || "");
  if (state.viewMode === "wysiwyg") {
    initTiptapEditor(
      getWysiwygInitialContent({
        markdown: doc.content || "",
        renderedHTML: elements.preview.innerHTML,
      }),
    );
  }
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

function parseHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  return doc.body.firstChild;
}

async function renderMermaid() {
  const mermaid = window.mermaid;
  if (!mermaid) {
    console.warn("Mermaid not loaded");
    return;
  }

  try {
    if (!mermaid._initialized) {
      await mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: getMermaidTheme(),
        fontFamily: "inherit",
        maxTextSize: 100000,
        flowchart: { 
          curve: "basis", 
          htmlLabels: true,
          rankSpacing: 80,
          nodeSpacing: 50,
          padding: 15,
        },
        sequence: { 
          actorMargin: 50, 
          showSequenceNumbers: false,
          boxMargin: 10,
          boxTextMargin: 5,
        },
        state: { useMaxWidth: true },
        gantt: { topAxis: false },
      });
      mermaid._initialized = true;
    }
    const preBlocks = elements.preview.querySelectorAll("pre");
    console.log("Found pre blocks:", preBlocks.length);
    for (const pre of preBlocks) {
      const code = pre.querySelector("code");
      if (!code) continue;
      const classList = code.className || "";
      const isMermaid = classList.includes("language-mermaid") || 
                        classList.includes("lang-mermaid") ||
                        pre.classList.contains("mermaid");
      console.log("Checking block:", classList, "isMermaid:", isMermaid);
      if (!isMermaid) continue;
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      console.log("Rendering mermaid:", id, "content:", code.textContent.slice(0, 50));
      const { svg } = await mermaid.render(id, code.textContent);
      pre.replaceWith(parseHTML(svg));
    }
  } catch (e) {
    console.error("Mermaid render error:", e);
  }
}

function getMermaidTheme() {
  const appearance = document.documentElement.dataset.appearance;
  if (appearance === "dark") return "dark";
  return "default";
}

function addCopyButtons() {
  const codeBlocks = elements.preview.querySelectorAll("pre");
  codeBlocks.forEach((pre) => {
    if (pre.querySelector(".copy-btn") || pre.querySelector(".mermaid")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const button = document.createElement("button");
    button.className = "copy-btn";
    button.type = "button";
    button.innerHTML = "📋";
    button.title = "Copy code";

    const code = pre.querySelector("code")?.textContent || pre.textContent;

    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(code);
      button.innerHTML = "✓";
      setTimeout(() => {
        button.innerHTML = "📋";
      }, 2000);
    });

    wrapper.appendChild(button);
  });
}

async function renderPreview(content) {
  const payload = await api("/api/render", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  elements.preview.innerHTML = payload.html;
  autoResizeEditor();
  rewritePreviewLinks();
  renderOutline();
  await renderMermaid();
  addCopyButtons();
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
        await loadDocument(doc);
        if (isMobileViewport()) {
          transitionLayout(() => {
            closePanels();
          });
        }
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
  state.outlineHeadings = headings;
  elements.outlineList.innerHTML = "";

  if (headings.length === 0) return;

  const headingIds = new Set();
  headings.forEach((h, i) => {
    if (!h.id) {
      h.id = `heading-${i}`;
    }
    headingIds.add(h.id);
  });

  headings.forEach((heading) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "outline-link";
    button.textContent = heading.textContent;
    button.dataset.level = heading.tagName.slice(1);
    button.dataset.target = heading.id;
    button.addEventListener("click", () => {
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
      if (isMobileViewport()) {
        transitionLayout(() => {
          closePanels();
        });
      }
    });
    elements.outlineList.appendChild(button);
  });

  setupHeadingObserver();
}

function setupHeadingObserver() {
  if (state.headingObserver) {
    state.headingObserver.disconnect();
  }

  if (state.outlineHeadings.length === 0) return;

  let activeId = null;
  let scrollDir = 0;
  let lastScrollY = window.scrollY;

  const updateActiveHeading = () => {
    const currentScrollY = window.scrollY;
    scrollDir = currentScrollY > lastScrollY ? 1 : currentScrollY < lastScrollY ? -1 : scrollDir;
    lastScrollY = currentScrollY;

    const visibleHeadings = state.outlineHeadings.filter((h) => {
      const rect = h.getBoundingClientRect();
      return rect.top >= 0 && rect.top <= window.innerHeight * 0.6;
    });

    let newActiveId = null;
    if (visibleHeadings.length > 0) {
      if (scrollDir > 0) {
        const heading = visibleHeadings.reduce((a, b) =>
          a.getBoundingClientRect().top < b.getBoundingClientRect().top ? a : b,
        );
        newActiveId = heading.id;
      } else {
        const heading = visibleHeadings.reduce((a, b) =>
          a.getBoundingClientRect().top > b.getBoundingClientRect().top ? a : b,
        );
        newActiveId = heading.id;
      }
    }

    if (newActiveId !== activeId) {
      activeId = newActiveId;
      state.activeHeadingId = activeId;

      elements.outlineList.querySelectorAll(".outline-link").forEach((link) => {
        link.classList.toggle("active", link.dataset.target === activeId);
      });

      if (activeId) {
        const activeLink = elements.outlineList.querySelector(
          `.outline-link[data-target="${activeId}"]`,
        );
        if (activeLink) {
          const listRect = elements.outlineList.getBoundingClientRect();
          const linkRect = activeLink.getBoundingClientRect();
          const linkTop = linkRect.top - listRect.top + elements.outlineList.scrollTop;
          const linkBottom = linkTop + linkRect.height;
          const viewTop = elements.outlineList.scrollTop;
          const viewBottom = viewTop + listRect.height;

          if (linkTop < viewTop || linkBottom > viewBottom) {
            elements.outlineList.scrollTo({
              top: linkTop - listRect.height / 3,
              behavior: "smooth",
            });
          }
        }
      }
    }
  };

  state.headingObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          updateActiveHeading();
          break;
        }
      }
    },
    {
      rootMargin: "-10% 0px -60% 0px",
      threshold: 0,
    },
  );

  state.outlineHeadings.forEach((heading) => {
    state.headingObserver.observe(heading);
  });

  window.addEventListener("scroll", updateActiveHeading, { passive: true });
}

function renderFileList() {
  elements.fileList.innerHTML = "";

  const buildTree = (entries, parentPath = "") => {
    const tree = {};
    for (const entry of entries) {
      const parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/") + 1) : "";
      if (parent === parentPath) {
        if (!tree[parentPath]) tree[parentPath] = [];
        tree[parentPath].push(entry);
      }
    }
    return tree;
  };

  const render = (entries, parentPath = "", depth = 0) => {
    const children = entries.filter(e => {
      const parent = e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/") + 1) : "";
      return parent === parentPath;
    });

    const dirs = children.filter(c => c.type === "directory").sort((a, b) => a.name.localeCompare(b.name));
    const files = children.filter(c => c.type === "file").sort((a, b) => a.name.localeCompare(b.name));

    for (const dir of dirs) {
      const folderPath = dir.path;
      const isExpanded = state.expandedFolders.has(folderPath);

      const wrapper = document.createElement("div");
      wrapper.className = "tree-folder";
      wrapper.style.setProperty("--depth", depth);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "file-link folder-toggle";
      button.innerHTML = `<span class="icon">📁</span><span class="name">${dir.name}</span>`;
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        if (state.expandedFolders.has(folderPath)) {
          state.expandedFolders.delete(folderPath);
        } else {
          state.expandedFolders.add(folderPath);
        }
        renderFileList();
      });

      wrapper.appendChild(button);

      if (isExpanded) {
        const childContainer = document.createElement("div");
        childContainer.className = "folder-children";
        childContainer.appendChild(render(state.files, folderPath, depth + 1));
        wrapper.appendChild(childContainer);
      }

      elements.fileList.appendChild(wrapper);
    }

    for (const file of files) {
      const wrapper = document.createElement("div");
      wrapper.className = "tree-file";
      wrapper.style.setProperty("--depth", depth);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "file-link";
      button.innerHTML = `<span class="icon">📄</span><span class="name">${file.name}</span>`;
      button.addEventListener("click", async () => {
        const doc = await api(`/api/open?path=${encodeURIComponent(file.path)}`);
        await loadDocument(doc);
        if (isMobileViewport()) {
          transitionLayout(() => {
            closePanels();
          });
        }
      });

      wrapper.appendChild(button);
      elements.fileList.appendChild(wrapper);
    }
  };

  render(state.files);
}

function syncLayout(fromContext = state.currentContext) {
  const isMobile = isMobileViewport();
  const nextMobilePanels = getMobilePanelState({
    isMobile,
    filesAvailable: state.files.length > 0,
    toggle: null,
    current: {
      sidebarOpen: state.sidebarOpen,
      outlineOpen: state.outlineOpen,
    },
  });
  state.sidebarOpen = nextMobilePanels.sidebarOpen;
  state.outlineOpen = nextMobilePanels.outlineOpen;

  const showFileSidebar = state.sidebarOpen && state.files.length > 0;
  const showOutlineSidebar = state.outlineOpen;

  document.body.classList.toggle("mobile-viewport", isMobile);
  document.body.classList.toggle(
    "mobile-panel-open",
    isMobile && (showFileSidebar || showOutlineSidebar),
  );
  const isEditMode = state.viewMode === "edit";
  const isWysiwygMode = state.viewMode === "wysiwyg";
  const isEditorMode = isEditMode || isWysiwygMode;
  elements.editorPane.classList.toggle("hidden", !isEditorMode);
  elements.previewPane.classList.toggle("hidden", isWysiwygMode);
  elements.fileSidebar.classList.toggle("hidden", !showFileSidebar);
  elements.outlineSidebar.classList.toggle("hidden", !showOutlineSidebar);
  if (isEditMode) {
    elements.workspace.classList.add("split");
  } else {
    elements.workspace.classList.remove("split");
  }
  elements.chrome.dataset.layout = getChromeLayout(
    showFileSidebar,
    showOutlineSidebar,
  );

  requestAnimationFrame(() => {
    syncResponsiveState();
    const nextContext = getCurrentLayoutContext();
    restoreScrollPosition(fromContext, nextContext);
    state.currentContext = nextContext;
    autoResizeEditor();
  });
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
        body: JSON.stringify({ content: getCurrentDocumentContent() }),
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
    body_line_height: Number(elements.bodyLineHeight.value).toFixed(1),
    paragraph_spacing: Number(elements.paragraphSpacing.value).toFixed(1),
    code_font_size: Number(elements.codeFontSize.value),
    code_line_height: Number(elements.codeLineHeight.value).toFixed(1),
    editor_font: elements.editorFont.value,
    editor_font_size: Number(elements.editorFontSize.value),
    editor_line_height: Number(elements.editorLineHeight.value).toFixed(1),
  };
  applyConfig();
  autoResizeEditor();
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
        await loadDocument(doc);
      }
      scrollToLine(result.line);
      if (isMobileViewport()) {
        transitionLayout(() => {
          closePanels();
        });
      }
    });
    elements.searchResults.appendChild(button);
  }
}

function scrollToLine(lineNumber) {
  const lines = getEditorPlainText().split("\n");
  let offset = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i += 1) {
    offset += lines[i].length + 1;
  }
  elements.editor.focus();
  if (
    typeof elements.editor.setSelectionRange === "function" &&
    state.viewMode !== "wysiwyg"
  ) {
    elements.editor.setSelectionRange(offset, offset);
  }
  const styles = window.getComputedStyle(elements.editor);
  const lineHeight =
    Number.parseFloat(styles.lineHeight) ||
    Number.parseFloat(styles.fontSize) * 1.7;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const editorTop =
    elements.editor.getBoundingClientRect().top + window.scrollY + paddingTop;
  const target = editorTop + Math.max(0, lineNumber - 1) * lineHeight - 96;
  window.scrollTo({ top: target, behavior: "smooth" });
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
  const shouldStack = state.viewMode === "edit" && elements.workspace.clientWidth < 960;
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

function transitionLayout(mutator, fromContext = state.currentContext) {
  captureScrollPosition(fromContext);
  mutator(fromContext);
  syncLayout(fromContext);
}

function captureScrollPosition(context) {
  saveScrollSnapshot(state.scrollSnapshots, context, {
    pageY: window.scrollY,
    pageMax: getPageMaxScroll(),
  });
}

function restoreScrollPosition(fromContext, toContext) {
  const targets = restoreScrollTargets({
    fromContext,
    toContext,
    snapshots: state.scrollSnapshots,
    current: {
      pageMax: getPageMaxScroll(),
    },
  });
  window.scrollTo(0, targets.pageY);
}

function getCurrentLayoutContext() {
  return getLayoutContext({
    viewMode: state.viewMode,
    isStacked: elements.workspace.classList.contains("stacked"),
  });
}

function getPageMaxScroll() {
  return Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
}

function isMobileViewport() {
  return window.innerWidth < 960;
}

function closePanels() {
  state.sidebarOpen = false;
  state.outlineOpen = false;
}

function autoResizeEditor() {
  const isEditorMode = state.viewMode === "edit" || state.viewMode === "wysiwyg";
  if (!elements.editor || !isEditorMode) {
    if (elements.editor) {
      elements.editor.style.height = "";
    }
    return;
  }

  elements.editor.style.height = "auto";
  elements.editor.style.height = `${elements.editor.scrollHeight}px`;
}

function initSidebarResize() {
  const handle = document.createElement("div");
  handle.className = "resize-handle";
  elements.fileSidebar.appendChild(handle);

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  handle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = elements.fileSidebar.offsetWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const width = startWidth + (e.clientX - startX);
    const clamped = Math.min(400, Math.max(150, width));
    elements.fileSidebar.style.width = `${clamped}px`;
    state.sidebarWidth = clamped;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

function initOutlineResize() {
  const handle = document.createElement("div");
  handle.className = "resize-handle left";
  elements.outlineSidebar.appendChild(handle);

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  handle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = elements.outlineSidebar.offsetWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const width = startWidth - (e.clientX - startX);
    const clamped = Math.min(400, Math.max(150, width));
    elements.outlineSidebar.style.width = `${clamped}px`;
    state.outlineWidth = clamped;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

function initTiptapEditor(content = "") {
  if (tiptapEditor) {
    destroyTiptapEditor();
  }

  elements.editor.innerHTML = "";
  const mount = document.createElement("div");
  elements.editor.appendChild(mount);
  elements.editor.classList.add("tiptap-editor");
  tiptapEditor = new Editor({
    element: mount,
    extensions: [StarterKit],
    content: "",
    onUpdate: async ({ editor }) => {
      const markdown = getEditorContentForSaving({
        viewMode: "wysiwyg",
        plainText: editor.getText(),
        html: editor.getHTML(),
      });
      state.document.content = markdown;
      if (!state.document.temporary) {
        setStatus("Unsaved");
      }
      await renderPreview(markdown);
      scheduleAutosave();
    },
  });
  tiptapEditor.commands.setContent(content, false);

  setupVimBindings();
  elements.editor.classList.add(`vim-${state.vimMode}-mode`);
}

function destroyTiptapEditor() {
  if (tiptapEditor) {
    tiptapEditor.destroy();
    tiptapEditor = null;
  }
  elements.editor.classList.remove("tiptap-editor", "vim-insert-mode", "vim-normal-mode");
}

function setViewMode(mode) {
  const currentMode = state.viewMode;
  
  if (currentMode === mode) return;
  
  if (currentMode === "wysiwyg" && tiptapEditor) {
    const markdown = getEditorContentForSaving({
      viewMode: "wysiwyg",
      plainText: tiptapEditor.getText(),
      html: tiptapEditor.getHTML(),
    });
    state.document.content = markdown;
    elements.editor.textContent = markdown;
    destroyTiptapEditor();
  }
  
  state.viewMode = mode;
  
  if (mode === "wysiwyg") {
    state.editorType = "wysiwyg";
    initTiptapEditor(
      getWysiwygInitialContent({
        markdown: state.document?.content || getEditorPlainText(),
        renderedHTML: elements.preview.innerHTML,
      }),
    );
    state.vimMode = "insert";
  } else {
    state.editorType = "textarea";
  }
  
  syncLayout();
  updateViewModeButtons();
  updateVimModeChip();
}

function getEditorPlainText() {
  if (!elements.editor) {
    return "";
  }
  return elements.editor.textContent || "";
}

function getCurrentDocumentContent() {
  return getEditorContentForSaving({
    viewMode: state.viewMode,
    plainText:
      state.viewMode === "wysiwyg" && tiptapEditor
        ? tiptapEditor.getText()
        : getEditorPlainText(),
    html: state.viewMode === "wysiwyg" && tiptapEditor ? tiptapEditor.getHTML() : "",
  });
}

let vimKeyHandler = null;

function setupVimBindings() {
  if (!tiptapEditor) return;
  if (vimKeyHandler) {
    document.removeEventListener("keydown", vimKeyHandler);
  }
  vimKeyHandler = (e) => handleVimKeydown(e);
  document.addEventListener("keydown", vimKeyHandler);
}

function handleVimKeydown(e) {
  if (state.viewMode !== "wysiwyg") return;
  if (!tiptapEditor) return;

  const isCtrl = e.ctrlKey || e.metaKey;
  const action = getVimKeyAction({
    vimMode: state.vimMode,
    key: e.key,
    isCtrl,
  });

  if (!action) {
    return;
  }

  e.preventDefault();
  applyVimAction(action);
}

function setVimMode(mode) {
  state.vimMode = mode;
  elements.editor.classList.remove(
    "vim-insert-mode",
    "vim-normal-mode",
    "vim-visual-mode",
  );
  elements.editor.classList.add(`vim-${mode}-mode`);
  updateVimModeChip();
}

function toggleVimMode() {
  if (state.viewMode !== "wysiwyg") return;
  if (state.vimMode === "insert") {
    setVimMode("normal");
  } else {
    setVimMode("insert");
  }
}

function initVimModeToggle() {
  if (elements.btnPreview) {
    elements.btnPreview.addEventListener("click", () => setViewMode("preview"));
  }
  if (elements.btnEdit) {
    elements.btnEdit.addEventListener("click", () => setViewMode("edit"));
  }
  if (elements.btnWysiwyg) {
    elements.btnWysiwyg.addEventListener("click", () => setViewMode("wysiwyg"));
  }

  updateViewModeButtons();
  updateVimModeChip();
}

function updateViewModeButtons() {
  if (elements.btnPreview) {
    elements.btnPreview.classList.toggle("active", state.viewMode === "preview");
  }
  if (elements.btnEdit) {
    elements.btnEdit.classList.toggle("active", state.viewMode === "edit");
  }
  if (elements.btnWysiwyg) {
    elements.btnWysiwyg.classList.toggle("active", state.viewMode === "wysiwyg");
  }
}

function updateVimModeChip() {
  if (!elements.vimModeChip) return;

  const chip = getVimIndicatorState({
    viewMode: state.viewMode,
    vimMode: state.vimMode,
  });

  elements.vimModeChip.className = `vim-mode-chip${chip.hidden ? " hidden" : ""}${chip.tone ? ` ${chip.tone}` : ""}`;
  elements.vimModeChip.textContent = chip.text;
}

function applyVimAction(action) {
  if (!tiptapEditor) {
    return;
  }

  tiptapEditor.commands.focus();

  if (action.type === "noop") {
    return;
  }

  if (action.type === "set-mode") {
    if (action.collapseSelection) {
      collapseSelectionToHead();
    }
    setVimMode(action.mode);
    return;
  }

  if (action.type === "command") {
    runEditorCommand(action.command, action.extend);
    if (action.mode) {
      setVimMode(action.mode);
    }
    return;
  }

  if (action.type === "command-sequence") {
    for (const command of action.commands) {
      runEditorCommand(command, false);
    }
    if (action.mode) {
      setVimMode(action.mode);
    }
  }
}

function runEditorCommand(command, extendSelection = false) {
  if (!tiptapEditor) {
    return;
  }

  if (extendSelection) {
    moveEditorSelection(command, true);
    return;
  }

  switch (command) {
    case "moveCursorBackward":
    case "moveCursorForward":
    case "moveCursorToStartOfLine":
    case "moveCursorToEndOfLine":
    case "moveCursorToStart":
    case "moveCursorToEnd":
      moveEditorSelection(command, false);
      return;
    case "insertContentNewline":
      tiptapEditor.commands.insertContent("\n");
      return;
    default:
      if (typeof tiptapEditor.commands[command] === "function") {
        tiptapEditor.commands[command]();
      }
  }
}

function collapseSelectionToHead() {
  if (!tiptapEditor) {
    return;
  }

  const { state: editorState, dispatch } = tiptapEditor.view;
  const head = editorState.selection.head;
  dispatch(
    editorState.tr.setSelection(
      TextSelection.create(
        editorState.doc,
        resolveInlinePosition(editorState.doc, head, -1),
      ),
    ),
  );
}

function moveEditorSelection(command, extendSelection) {
  if (!tiptapEditor) {
    return;
  }

  const { state: editorState, dispatch } = tiptapEditor.view;
  const { selection, doc } = editorState;
  const { anchor, head, $head } = selection;
  const nextHead = getTargetSelectionPosition({
    command,
    head,
    docSize: doc.content.size,
    parentOffset: $head.parentOffset,
    parentSize: $head.parent.content.size,
  });

  if (nextHead === head && (!extendSelection || anchor === head)) {
    return;
  }

  const from = extendSelection
    ? resolveInlinePosition(doc, anchor, anchor <= nextHead ? 1 : -1)
    : resolveInlinePosition(doc, nextHead, -1);
  const to = extendSelection
    ? resolveInlinePosition(doc, nextHead, nextHead >= anchor ? 1 : -1)
    : from;

  dispatch(editorState.tr.setSelection(TextSelection.create(doc, from, to)));
}

function getTargetSelectionPosition({
  command,
  head,
  docSize,
  parentOffset,
  parentSize,
}) {
  const blockStart = head - parentOffset;
  const blockEnd = blockStart + parentSize;

  switch (command) {
    case "moveCursorBackward":
      return Math.max(1, head - 1);
    case "moveCursorForward":
      return Math.min(docSize - 1, head + 1);
    case "moveCursorToStartOfLine":
    case "moveCursorToStart":
      return blockStart;
    case "moveCursorToEndOfLine":
    case "moveCursorToEnd":
      return blockEnd;
    default:
      return head;
  }
}

function resolveInlinePosition(doc, position, bias) {
  const clamped = Math.max(0, Math.min(position, doc.content.size));
  return Selection.near(doc.resolve(clamped), bias).from;
}
