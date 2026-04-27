import {
  applyInitialUIState,
  createEmptyScrollSnapshots,
  getLayoutContext,
  getMobilePanelState,
  restoreScrollTargets,
  saveScrollSnapshot,
} from "./app-state.js";
import {
  getOutlineHeadingElements,
  getOutlineScrollContainer,
} from "./outline.js";
import {
  buildWorkspaceTree,
  findAdjacentWorkspaceFile,
  flattenWorkspaceFiles,
  isActiveWorkspaceFile,
} from "./workspace-tree.js";
import {
  toSpeechText,
} from "./speech.js";
import {
  getDefaultSettingsTab,
  getGoogleVoicesForLanguage,
  getBrowserVoicesForLanguage,
  getReaderPopupVisibility,
} from "./reader-ui.js";

const query = new URLSearchParams(window.location.search);
const token = query.get("token") || "";
const DOCUMENT_POLL_MS = 1500;
const state = {
  config: null,
  document: null,
  workspaceRoots: [],
  viewMode: "preview",
  sidebarOpen: false,
  outlineOpen: false,
  sidebarWidth: 240,
  outlineWidth: 240,
  scrollSnapshots: createEmptyScrollSnapshots(),
  currentContext: "preview-only",
  expandedFolders: new Set(),
  outlineHeadings: [],
  activeHeadingId: null,
  headingObserver: null,
  headingScrollTarget: null,
  headingScrollHandler: null,
  documentPollTimer: null,
  documentPollInFlight: false,
  lastSyncedContent: "",
  lastSyncedRevision: "",
  acknowledgedRemoteRevision: "",
  pendingRemoteDocument: null,
  conflictActive: false,
  ttsVoices: [],
  speechStatus: "",
  speechPlaybackState: "idle",
  speechNavigationActive: false,
  workspaceFiles: [],
  activeSettingsTab: getDefaultSettingsTab(),
};

let readerAudio = null;
let readerUtterance = null;

const elements = {
  chrome: document.querySelector(".chrome"),
  toolbar: document.getElementById("toolbar"),
  docName: document.getElementById("doc-name"),
  docMeta: document.getElementById("doc-meta"),
  status: document.getElementById("status-pill"),
  speechStatus: document.getElementById("speech-status"),
  readerPopup: document.getElementById("reader-popup"),
  readerPopupTitle: document.getElementById("reader-popup-title"),
  fileSidebar: document.getElementById("file-sidebar"),
  fileList: document.getElementById("file-list"),
  addWorkspaceRoot: document.getElementById("add-workspace-root"),
  workspaceRootForm: document.getElementById("workspace-root-form"),
  workspaceRootInput: document.getElementById("workspace-root-input"),
  workspaceRootSubmit: document.getElementById("workspace-root-submit"),
  workspaceRootCancel: document.getElementById("workspace-root-cancel"),
  outlineSidebar: document.getElementById("outline-sidebar"),
  outlineList: document.getElementById("outline-list"),
  settingsDrawer: document.getElementById("settings-drawer"),
  closeSettings: document.getElementById("close-settings"),
  settingsTabTheme: document.getElementById("settings-tab-theme"),
  settingsTabReading: document.getElementById("settings-tab-reading"),
  settingsThemePanel: document.getElementById("settings-theme-panel"),
  settingsReadingPanel: document.getElementById("settings-reading-panel"),
  searchDrawer: document.getElementById("search-drawer"),
  workspace: document.getElementById("workspace"),
  btnSpeechPlay: document.getElementById("btn-speech-play"),
  btnSpeechStop: document.getElementById("btn-speech-stop"),
  btnSpeechPrev: document.getElementById("btn-speech-prev"),
  btnSpeechNext: document.getElementById("btn-speech-next"),
  previewPane: document.getElementById("preview-pane"),
  preview: document.getElementById("preview"),
  speechLanguage: document.getElementById("speech-language-select"),
  speechVoice: document.getElementById("speech-voice-select"),
  speechRate: document.getElementById("speech-rate-input"),
  speechAutoNext: document.getElementById("speech-auto-next-input"),
  ttsProvider: document.getElementById("tts-provider-select"),
  theme: document.getElementById("theme-select"),
  appearance: document.getElementById("appearance-select"),
  fontFamily: document.getElementById("font-family-select"),
  width: document.getElementById("width-input"),
  fontSize: document.getElementById("font-size-input"),
  bodyLineHeight: document.getElementById("body-line-height-input"),
  paragraphSpacing: document.getElementById("paragraph-spacing-input"),
  codeFontSize: document.getElementById("code-font-size-input"),
  codeLineHeight: document.getElementById("code-line-height-input"),
  searchQuery: document.getElementById("search-query"),
  searchScope: document.getElementById("search-scope"),
  searchResults: document.getElementById("search-results"),
};

document.getElementById("toggle-sidebar").addEventListener("click", () => {
  transitionLayout(() => {
    if (isMobileViewport()) {
      const next = getMobilePanelState({
        isMobile: true,
        filesAvailable: state.workspaceRoots.length > 0,
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
        filesAvailable: state.workspaceRoots.length > 0,
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
elements.closeSettings?.addEventListener("click", () => {
  elements.settingsDrawer.classList.add("hidden");
});
elements.settingsTabTheme?.addEventListener("click", () => {
  setActiveSettingsTab("theme");
});
elements.settingsTabReading?.addEventListener("click", () => {
  setActiveSettingsTab("reading");
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

elements.theme.addEventListener("change", saveSettings);
elements.appearance.addEventListener("change", saveSettings);
elements.fontFamily.addEventListener("change", saveSettings);
elements.width.addEventListener("input", saveSettings);
elements.fontSize.addEventListener("input", saveSettings);
elements.bodyLineHeight.addEventListener("input", saveSettings);
elements.paragraphSpacing.addEventListener("input", saveSettings);
elements.codeFontSize.addEventListener("input", saveSettings);
elements.codeLineHeight.addEventListener("input", saveSettings);
elements.ttsProvider?.addEventListener("change", handleTTSProviderChange);
elements.speechLanguage?.addEventListener("change", handleSpeechLanguageChange);
elements.speechVoice?.addEventListener("change", saveSettings);
elements.speechRate?.addEventListener("input", saveSettings);
elements.speechAutoNext?.addEventListener("change", saveSettings);

elements.searchQuery.addEventListener("input", runSearch);
elements.searchScope.addEventListener("change", runSearch);
elements.btnSpeechPlay?.addEventListener("click", handleSpeechPlayPause);
elements.btnSpeechStop?.addEventListener("click", () => stopSpeech());
elements.btnSpeechPrev?.addEventListener("click", () => navigateSpeechFile("prev"));
elements.btnSpeechNext?.addEventListener("click", () => navigateSpeechFile("next"));
elements.addWorkspaceRoot?.addEventListener("click", () => {
  elements.workspaceRootForm?.classList.toggle("hidden");
  if (!elements.workspaceRootForm?.classList.contains("hidden")) {
    elements.workspaceRootInput?.focus();
  }
});
elements.workspaceRootCancel?.addEventListener("click", () => {
  hideWorkspaceRootForm();
});
elements.workspaceRootForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addWorkspaceRoot();
});
window.addEventListener("resize", () => {
  transitionLayout(() => {}, state.currentContext);
});
window.addEventListener("keydown", (event) => {
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
    api("/api/files").catch(() => ({ roots: [] })),
  ]);

  state.config = config;
  state.document = doc;
  state.workspaceRoots = files.roots || [];
  for (const root of state.workspaceRoots) {
    state.expandedFolders.add(root.path);
  }

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
  await initTTSSettings();
  await loadDocument(doc);
  renderFileList();
  syncLayout();
  initSidebarResize();
  initOutlineResize();
  startDocumentPolling();
}

function bindSettings(config) {
  setActiveSettingsTab(state.activeSettingsTab);
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
  elements.ttsProvider.value = config.tts_provider || "google";
  elements.speechLanguage.value = config.tts_language || "vi-VN";
  elements.speechRate.value = config.tts_speed || 1;
  elements.speechAutoNext.checked = Boolean(config.tts_auto_next ?? true);
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
}

function bindTTSVoices() {
  const select = elements.speechVoice;
  if (!select) return;
  const current = state.config?.tts_voice || "";
  select.innerHTML = "";
  for (const v of state.ttsVoices) {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.label} (${v.gender}, ${v.tier})`;
    select.appendChild(opt);
  }
  if (state.ttsVoices.some((v) => v.name === current)) {
    select.value = current;
  }
}

async function initTTSSettings() {
  await loadTTSVoices();
  updateSpeechControls();
}

async function loadTTSVoices() {
  const provider = state.config?.tts_provider || "google";
  const language = state.config?.tts_language || "vi-VN";

  if (provider === "browser") {
    const synth = window.speechSynthesis;
    if (!synth) {
      state.ttsVoices = [];
      bindTTSVoices();
      return;
    }
    let voices = getBrowserVoicesForLanguage(language);
    if (voices.length === 0 && synth.onvoiceschanged !== undefined) {
      await new Promise((resolve) => {
        synth.addEventListener("voiceschanged", () => {
          voices = getBrowserVoicesForLanguage(language);
          resolve();
        }, { once: true });
        setTimeout(resolve, 1000);
      });
    }
    state.ttsVoices = voices;
    bindTTSVoices();
    return;
  }

  try {
    const payload = await api(`/api/tts/voices?language=${encodeURIComponent(language)}`);
    state.ttsVoices = payload.voices || [];
  } catch (error) {
    console.error("Load TTS voices failed:", error);
    state.ttsVoices = getGoogleVoicesForLanguage(language);
  }
  bindTTSVoices();
}

async function handleSpeechLanguageChange() {
  if (state.config) {
    state.config.tts_language = elements.speechLanguage.value;
  }
  await loadTTSVoices();
  saveSettings().catch((error) => {
    console.error("Save reading language failed:", error);
  });
}

async function handleTTSProviderChange() {
  stopSpeech({ silent: true });
  if (state.config) {
    state.config.tts_provider = elements.ttsProvider.value;
  }
  await loadTTSVoices();
  saveSettings().catch((error) => {
    console.error("Save TTS provider failed:", error);
  });
}

function setSpeechStatus(label) {
  state.speechStatus = label;
  elements.speechStatus.textContent = label;
}

function setActiveSettingsTab(tab) {
  state.activeSettingsTab = tab;
  const isTheme = tab === "theme";
  elements.settingsTabTheme?.classList.toggle("active", isTheme);
  elements.settingsTabReading?.classList.toggle("active", !isTheme);
  elements.settingsThemePanel?.classList.toggle("hidden", !isTheme);
  elements.settingsReadingPanel?.classList.toggle("hidden", isTheme);
}

function updateSpeechControls() {
  const neighborPrev = getSpeechNeighbor("prev");
  const neighborNext = getSpeechNeighbor("next");
  const canPlay = Boolean(state.document?.content) && Boolean(elements.speechVoice?.value);
  const playbackState = state.speechPlaybackState;

  elements.readerPopup?.classList.toggle("hidden", !getReaderPopupVisibility(playbackState));
  if (elements.readerPopupTitle) {
    elements.readerPopupTitle.textContent = state.document?.name || "Reader";
  }
  if (elements.btnSpeechPlay) {
    elements.btnSpeechPlay.disabled = !canPlay;
    elements.btnSpeechPlay.textContent = playbackState === "paused" ? "Resume" : playbackState === "playing" ? "Pause" : "Play";
  }
  if (elements.btnSpeechStop) {
    elements.btnSpeechStop.disabled = playbackState === "idle";
  }
  if (elements.btnSpeechPrev) {
    elements.btnSpeechPrev.disabled = !neighborPrev;
  }
  if (elements.btnSpeechNext) {
    elements.btnSpeechNext.disabled = !neighborNext;
  }
}

async function handleSpeechPlayPause() {
  if (state.speechPlaybackState === "playing") {
    if (state.config?.tts_provider === "browser" && window.speechSynthesis) {
      window.speechSynthesis.pause();
    } else if (readerAudio) {
      readerAudio.pause();
    }
    return;
  }

  if (state.speechPlaybackState === "paused") {
    if (state.config?.tts_provider === "browser" && window.speechSynthesis) {
      window.speechSynthesis.resume();
    } else if (readerAudio) {
      await readerAudio.play();
    }
    return;
  }

  await startSpeech();
}

async function startSpeech() {
  const text = toSpeechText(getCurrentDocumentContent());
  if (!text) {
    setSpeechStatus("Nothing to read");
    updateSpeechControls();
    return;
  }

  stopSpeech({ silent: true });
  setSpeechStatus("Loading");
  state.speechPlaybackState = "loading";
  updateSpeechControls();

  if (state.config?.tts_provider === "browser") {
    startBrowserSpeech(text);
    return;
  }

  try {
    const payload = await api("/api/tts", {
      method: "POST",
      body: JSON.stringify({
        provider: state.config.tts_provider,
        text,
        language: state.config.tts_language,
        voice: elements.speechVoice.value || state.config.tts_voice,
        speed: Number(state.config.tts_speed) || 1,
      }),
    });

    readerAudio = new Audio(`data:${payload.content_type};base64,${payload.audio_content}`);
    readerAudio.addEventListener("play", () => {
      state.speechPlaybackState = "playing";
      setSpeechStatus("Reading");
      updateSpeechControls();
    });
    readerAudio.addEventListener("pause", () => {
      if (state.speechPlaybackState === "idle") {
        return;
      }
      state.speechPlaybackState = "paused";
      setSpeechStatus("Paused");
      updateSpeechControls();
    });
    readerAudio.addEventListener("ended", async () => {
      state.speechPlaybackState = "idle";
      updateSpeechControls();
      if (state.config.tts_auto_next) {
        const continued = await navigateSpeechFile("next", { autoplay: true, autoAdvance: true });
        if (continued) {
          return;
        }
      }
      setSpeechStatus("Finished");
      updateSpeechControls();
    });
    await readerAudio.play();
  } catch (error) {
    console.error("Start reading failed:", error);
    state.speechPlaybackState = "idle";
    setSpeechStatus("TTS error");
    updateSpeechControls();
  }
}

function startBrowserSpeech(text) {
  const synth = window.speechSynthesis;
  if (!synth) {
    state.speechPlaybackState = "idle";
    setSpeechStatus("Browser TTS unavailable");
    updateSpeechControls();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.config.tts_language || "vi-VN";
  utterance.rate = Number(state.config.tts_speed) || 1;

  const voiceName = elements.speechVoice.value;
  if (voiceName) {
    const allVoices = synth.getVoices();
    const match = allVoices.find((v) => v.name === voiceName);
    if (match) {
      utterance.voice = match;
    }
  }

  utterance.addEventListener("start", () => {
    state.speechPlaybackState = "playing";
    setSpeechStatus("Reading");
    updateSpeechControls();
  });
  utterance.addEventListener("pause", () => {
    if (state.speechPlaybackState === "idle") {
      return;
    }
    state.speechPlaybackState = "paused";
    setSpeechStatus("Paused");
    updateSpeechControls();
  });
  utterance.addEventListener("resume", () => {
    state.speechPlaybackState = "playing";
    setSpeechStatus("Reading");
    updateSpeechControls();
  });
  utterance.addEventListener("end", async () => {
    state.speechPlaybackState = "idle";
    readerUtterance = null;
    updateSpeechControls();
    if (state.config.tts_auto_next) {
      const continued = await navigateSpeechFile("next", { autoplay: true, autoAdvance: true });
      if (continued) {
        return;
      }
    }
    setSpeechStatus("Finished");
    updateSpeechControls();
  });
  utterance.addEventListener("error", (event) => {
    console.error("Browser TTS error:", event);
    state.speechPlaybackState = "idle";
    readerUtterance = null;
    setSpeechStatus("TTS error");
    updateSpeechControls();
  });

  readerUtterance = utterance;
  synth.speak(utterance);
}

function stopSpeech(options = {}) {
  state.speechPlaybackState = "idle";
  if (readerAudio) {
    readerAudio.pause();
    readerAudio.src = "";
    readerAudio = null;
  }
  if (readerUtterance) {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
    }
    readerUtterance = null;
  }
  if (!options.silent) {
    setSpeechStatus("Stopped");
  }
  updateSpeechControls();
}

function getSpeechNeighbor(direction) {
  if (!state.document?.path || !state.document?.folder_root) {
    return null;
  }
  const current = {
    rootPath: state.document.folder_root,
    path: state.document.path.slice(state.document.folder_root.length + 1).replaceAll("\\", "/"),
  };
  return findAdjacentWorkspaceFile(state.workspaceRoots, current, direction);
}

async function navigateSpeechFile(direction, options = {}) {
  const neighbor = getSpeechNeighbor(direction);
  if (!neighbor) {
    if (options.autoAdvance) {
      setSpeechStatus("Finished");
    }
    updateSpeechControls();
    return false;
  }

  state.speechNavigationActive = true;
  stopSpeech({ silent: true });
  const doc = await api(buildOpenURL(neighbor.path, neighbor.rootPath));
  await loadDocument(doc, { speechNavigation: true });
  state.speechNavigationActive = false;
  if (options.autoplay) {
    await startSpeech();
  } else {
    setSpeechStatus("Speech ready");
  }
  return true;
}

async function loadDocument(doc, options = {}) {
  if (!options.speechNavigation) {
    stopSpeech({ silent: true });
  }

  state.document = doc;
  renderFileList();
  elements.docName.textContent = doc.name || "Untitled";
  elements.docMeta.textContent =
    doc.path || (doc.temporary ? "Temporary document" : "");
  await renderPreview(doc.content || "");
  syncDocumentMarkers(doc, options);
  updateStatusFromDocument();
  if (options.statusLabel) {
    setStatus(options.statusLabel);
  }
  updateSpeechControls();
}

function updateStatusFromDocument() {
  if (state.conflictActive) {
    setStatus("Conflict");
    return;
  }
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

function syncDocumentMarkers(doc, options = {}) {
  state.lastSyncedContent = doc.content || "";
  state.lastSyncedRevision = doc.revision_id || "";
  state.document.revision_id = doc.revision_id || "";
  state.document.last_modified = doc.last_modified || "";
  state.acknowledgedRemoteRevision = "";
  state.pendingRemoteDocument = null;
  state.conflictActive = false;
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
        const doc = await api(buildOpenURL(href, state.document.folder_root));
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
  const headings = getOutlineHeadingElements({
    previewElement: elements.preview,
  });
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
  if (state.headingScrollTarget && state.headingScrollHandler) {
    state.headingScrollTarget.removeEventListener("scroll", state.headingScrollHandler);
  }
  state.headingObserver = null;
  state.headingScrollTarget = null;
  state.headingScrollHandler = null;

  if (state.outlineHeadings.length === 0) return;

  let activeId = null;
  let scrollDir = 0;
  const scrollContainer = getOutlineScrollContainer();
  const scrollEventTarget = scrollContainer || window;
  let lastScrollY = scrollContainer ? scrollContainer.scrollTop : window.scrollY;

  const updateActiveHeading = () => {
    const currentScrollY = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    scrollDir = currentScrollY > lastScrollY ? 1 : currentScrollY < lastScrollY ? -1 : scrollDir;
    lastScrollY = currentScrollY;

    const visibleHeadings = state.outlineHeadings.filter((h) => {
      const rect = h.getBoundingClientRect();
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const threshold = containerRect.top + containerRect.height * 0.6;
        return rect.top >= containerRect.top && rect.top <= threshold;
      }
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
      root: scrollContainer,
      rootMargin: "-10% 0px -60% 0px",
      threshold: 0,
    },
  );

  state.outlineHeadings.forEach((heading) => {
    state.headingObserver.observe(heading);
  });

  state.headingScrollTarget = scrollEventTarget;
  state.headingScrollHandler = updateActiveHeading;
  scrollEventTarget.addEventListener("scroll", updateActiveHeading, { passive: true });
  updateActiveHeading();
}

function getFolderKey(rootPath, path = "") {
  return `${rootPath}::${path}`;
}

function toggleFolder(key) {
  if (state.expandedFolders.has(key)) {
    state.expandedFolders.delete(key);
  } else {
    state.expandedFolders.add(key);
  }
  renderFileList();
}

function buildOpenURL(path, rootPath) {
  const params = new URLSearchParams({ path });
  if (rootPath) {
    params.set("root", rootPath);
  }
  return `/api/open?${params.toString()}`;
}

function hideWorkspaceRootForm() {
  elements.workspaceRootForm?.classList.add("hidden");
  if (elements.workspaceRootInput) {
    elements.workspaceRootInput.value = "";
  }
}

async function refreshWorkspaceRoots(payload = null) {
  const next = payload || await api("/api/files");
  state.workspaceRoots = next.roots || [];
  for (const root of state.workspaceRoots) {
    state.expandedFolders.add(root.path);
  }
  state.workspaceFiles = flattenWorkspaceFiles(state.workspaceRoots);
  renderFileList();
  syncLayout();
  updateSpeechControls();
}

async function addWorkspaceRoot() {
  const path = elements.workspaceRootInput?.value.trim();
  if (!path) {
    return;
  }

  try {
    const payload = await api("/api/workspace/roots", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
    hideWorkspaceRootForm();
    await refreshWorkspaceRoots(payload);
  } catch (error) {
    console.error("Add workspace root failed:", error);
    setStatus("Root error");
  }
}

async function removeWorkspaceRoot(path) {
  try {
    const payload = await api("/api/workspace/roots", {
      method: "DELETE",
      body: JSON.stringify({ path }),
    });
    state.expandedFolders.delete(path);
    await refreshWorkspaceRoots(payload);
  } catch (error) {
    console.error("Remove workspace root failed:", error);
    setStatus("Root error");
  }
}

function renderFileList() {
  elements.fileList.innerHTML = "";
  state.workspaceFiles = flattenWorkspaceFiles(state.workspaceRoots);
  const tree = buildWorkspaceTree(state.workspaceRoots);
  const fragment = document.createDocumentFragment();

  const renderNodes = (nodes, container, depth = 0) => {
    for (const node of nodes) {
      if (node.type === "root") {
        const wrapper = document.createElement("section");
        wrapper.className = "workspace-root";

        const header = document.createElement("div");
        header.className = "workspace-root__header";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "file-link folder-toggle workspace-root__toggle";
        button.innerHTML = `<span class="icon">🗂️</span><span class="name">${node.name}</span>`;
        button.addEventListener("click", () => {
          toggleFolder(node.path);
        });
        header.appendChild(button);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "workspace-root__remove";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", async () => {
          await removeWorkspaceRoot(node.path);
        });
        header.appendChild(removeButton);
        wrapper.appendChild(header);

        if (state.expandedFolders.has(node.path)) {
          const children = document.createElement("div");
          children.className = "folder-children";
          renderNodes(node.children || [], children, 1);
          wrapper.appendChild(children);
        }

        container.appendChild(wrapper);
        continue;
      }

      const wrapper = document.createElement("div");
      wrapper.className = node.type === "directory" ? "tree-folder" : "tree-file";
      wrapper.style.setProperty("--depth", depth);

      const button = document.createElement("button");
      button.type = "button";
      button.className = node.type === "directory" ? "file-link folder-toggle" : "file-link";
      if (isActiveWorkspaceFile(node, state.document)) {
        button.classList.add("active");
      }
      button.innerHTML = node.type === "directory"
        ? `<span class="icon">📁</span><span class="name">${node.name}</span>`
        : `<span class="icon">📄</span><span class="name">${node.name}</span>`;

      if (node.type === "directory") {
        button.addEventListener("click", () => {
          toggleFolder(getFolderKey(node.rootPath, node.path));
        });
      } else {
        button.addEventListener("click", async () => {
          const doc = await api(buildOpenURL(node.path, node.rootPath));
          await loadDocument(doc);
          if (isMobileViewport()) {
            transitionLayout(() => {
              closePanels();
            });
          }
        });
      }

      wrapper.appendChild(button);
      container.appendChild(wrapper);

      if (node.type === "directory" && state.expandedFolders.has(getFolderKey(node.rootPath, node.path))) {
        const children = document.createElement("div");
        children.className = "folder-children";
        renderNodes(node.children || [], children, depth + 1);
        container.appendChild(children);
      }
    }
  };

  renderNodes(tree, fragment);
  elements.fileList.appendChild(fragment);
}

function syncLayout(fromContext = state.currentContext) {
  const isMobile = isMobileViewport();
  const nextMobilePanels = getMobilePanelState({
    isMobile,
    filesAvailable: state.workspaceRoots.length > 0,
    toggle: null,
    current: {
      sidebarOpen: state.sidebarOpen,
      outlineOpen: state.outlineOpen,
    },
  });
  state.sidebarOpen = nextMobilePanels.sidebarOpen;
  state.outlineOpen = nextMobilePanels.outlineOpen;

  const showFileSidebar = state.sidebarOpen && state.workspaceRoots.length > 0;
  const showOutlineSidebar = state.outlineOpen;

  document.body.classList.toggle("mobile-viewport", isMobile);
  document.body.classList.toggle(
    "mobile-panel-open",
    isMobile && (showFileSidebar || showOutlineSidebar),
  );
  elements.fileSidebar.classList.toggle("hidden", !showFileSidebar);
  elements.outlineSidebar.classList.toggle("hidden", !showOutlineSidebar);
  elements.workspace.classList.remove("split");
  elements.chrome.dataset.layout = getChromeLayout(
    showFileSidebar,
    showOutlineSidebar,
  );

  requestAnimationFrame(() => {
    syncResponsiveState();
    const nextContext = getCurrentLayoutContext();
    restoreScrollPosition(fromContext, nextContext);
    state.currentContext = nextContext;
  });
}

async function saveSettings() {
  state.config = {
    ...state.config,
    tts_provider: elements.ttsProvider.value,
    tts_language: elements.speechLanguage.value,
    tts_voice: elements.speechVoice.value,
    tts_speed: Number(elements.speechRate.value),
    tts_auto_next: elements.speechAutoNext.checked,
    theme: elements.theme.value,
    appearance: elements.appearance.value,
    font_family: elements.fontFamily.value,
    content_width: Number(elements.width.value),
    font_size: Number(elements.fontSize.value),
    body_line_height: Number(elements.bodyLineHeight.value).toFixed(1),
    paragraph_spacing: Number(elements.paragraphSpacing.value).toFixed(1),
    code_font_size: Number(elements.codeFontSize.value),
    code_line_height: Number(elements.codeLineHeight.value).toFixed(1),
  };
  state.config.speech_language = state.config.tts_language;
  state.config.speech_voice = state.config.tts_voice;
  state.config.speech_rate = state.config.tts_speed;
  state.config.speech_auto_next = state.config.tts_auto_next;
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
    const location = result.root
      ? `${result.root} / ${result.path}`
      : result.path;
    button.innerHTML = `<strong>${location}</strong><span>Line ${result.line}: ${result.excerpt}</span>`;
    button.addEventListener("click", async () => {
      if (
        elements.searchScope.value === "workspace" &&
        result.path.endsWith(".md")
      ) {
        const doc = await api(buildOpenURL(result.path, result.root));
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
  const blocks = [
    ...elements.preview.querySelectorAll("p, li, blockquote, pre, h1, h2, h3, h4"),
  ];
  const targetBlock = blocks[Math.max(0, Math.min(blocks.length - 1, lineNumber - 1))];
  if (targetBlock) {
    targetBlock.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  elements.workspace.classList.remove("stacked");
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
  return getLayoutContext();
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

function getCurrentDocumentContent() {
  return state.document?.content || "";
}

function startDocumentPolling() {
  stopDocumentPolling();
  state.documentPollTimer = window.setInterval(() => {
    pollDocumentStatus().catch((error) => {
      console.error("document poll failed:", error);
    });
  }, DOCUMENT_POLL_MS);
}

function stopDocumentPolling() {
  if (state.documentPollTimer) {
    window.clearInterval(state.documentPollTimer);
    state.documentPollTimer = null;
  }
}

async function pollDocumentStatus() {
  if (state.documentPollInFlight || !state.document) {
    return;
  }

  state.documentPollInFlight = true;
  try {
    const status = await api("/api/document/status");
    await handleDocumentStatus(status);
  } finally {
    state.documentPollInFlight = false;
  }
}

async function handleDocumentStatus(status) {
  if (!status?.tracked || !status.revision_id || !status.changed) {
    return;
  }

  if (
    status.revision_id === state.lastSyncedRevision ||
    status.revision_id === state.acknowledgedRemoteRevision
  ) {
    return;
  }

  const remoteDocument = {
    ...state.document,
    content: status.content || "",
    revision_id: status.revision_id,
    last_modified: status.last_modified || "",
    read_only: Boolean(status.read_only),
  };
  await loadDocument(remoteDocument, { statusLabel: "Reloaded" });
}
