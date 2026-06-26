// ==UserScript==
// @name         AI Bridge
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Bridge terminal prompts to AI web apps
// @author       You
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://chat.deepseek.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  let ttPolicy = null;
  if (window.trustedTypes) {
    try {
      if (!window.trustedTypes.defaultPolicy) {
        ttPolicy = window.trustedTypes.createPolicy("ai-bridge-policy", {
          createHTML: (s) => s,
          createScriptURL: (s) => s,
        });
      } else {
        ttPolicy = window.trustedTypes.defaultPolicy;
      }
    } catch (e) {
      console.warn("[ai-bridge] Trusted Types policy generation skipped:", e);
    }
  }
  const panelCSS =
    '/* ==========================================================================\n   AI BRIDGE LAYOUT - GEMINI STYLE\n   Tự động đồng bộ Light/Dark Mode theo hệ thống của Gemini \n   ========================================================================== */\n\n:root {\n  /* Các biến màu fallback nếu không nhận được biến hệ thống của Gemini */\n  --bg-primary: var(--dt-surface-large, #ffffff);\n  --bg-secondary: var(--dt-surface, #f8f9fa);\n  --bg-hover: var(--dt-surface-variant, #f1f3f4);\n  --text-primary: var(--dt-on-surface, #1f1f1f);\n  --text-secondary: var(--dt-on-surface-variant, #444746);\n  --border-color: var(--dt-outline-variant, #c4c7c5);\n  --brand-primary: var(--dt-primary, #1a73e8);\n  --brand-hover: var(--dt-primary-hover, #1b66ca);\n  --brand-on-primary: var(--dt-on-primary, #ffffff);\n  --radius-md: 12px;\n  --radius-lg: 16px;\n  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);\n  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);\n}\n\n/* Ép chế độ tối dựa trên thuộc tính tương thích của Gemini nếu có */\n@media (prefers-color-scheme: dark) {\n  :root {\n    --bg-primary: var(--dt-surface-large, #1e1e1e);\n    --bg-secondary: var(--dt-surface, #131314);\n    --bg-hover: var(--dt-surface-variant, #282a2c);\n    --text-primary: var(--dt-on-surface, #e3e3e3);\n    --text-secondary: var(--dt-on-surface-variant, #c4c7c5);\n    --border-color: var(--dt-outline-variant, #444746);\n    --brand-primary: var(--dt-primary, #a8c7fa);\n    --brand-hover: var(--dt-primary-hover, #7cacf8);\n    --brand-on-primary: var(--dt-on-primary, #04306e);\n  }\n}\n\n/* Toàn bộ wrapper bao quanh */\n#ai-bridge-layout-wrapper {\n  display: flex !important;\n  width: 100vw !important;\n  height: 100vh !important;\n  overflow: hidden !important;\n  position: fixed !important;\n  top: 0 !important;\n  left: 0 !important;\n  background-color: var(--bg-secondary) !important;\n}\n\n/* Container chứa Gemini chính */\n#ai-bridge-gemini-container {\n  flex: 1 !important;\n  height: 100% !important;\n  position: relative !important;\n  overflow: auto !important;\n}\n\n/* Panel Sidebar chèn thêm */\n#ai-bridge-inserted-panel {\n  width: 360px !important;\n  height: 100% !important;\n  background-color: var(--bg-primary) !important;\n  border-left: 1px solid var(--border-color) !important;\n  display: flex !important;\n  flex-direction: column !important;\n  box-sizing: border-box !important;\n  z-index: 999998 !important;\n  transition:\n    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),\n    margin-right 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;\n  box-shadow: var(--shadow-md) !important;\n}\n\n/* Khi Sidebar bị ẩn */\n#ai-bridge-inserted-panel.sidebar-hidden {\n  transform: translateX(360px) !important;\n  margin-right: -360px !important;\n  box-shadow: none !important;\n}\n\n/* Nút Toggle đóng mở Sidebar */\n#ai-bridge-toggle-navbar-btn {\n  position: fixed !important;\n  top: 16px !important;\n  right: 376px !important;\n  width: 40px !important;\n  height: 40px !important;\n  background-color: var(--brand-primary) !important;\n  color: var(--brand-on-primary) !important;\n  border: none !important;\n  border-radius: var(--radius-md) !important;\n  font-size: 16px !important;\n  cursor: pointer !important;\n  box-shadow: var(--shadow-md) !important;\n  z-index: 999999 !important;\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  transition:\n    right 0.28s cubic-bezier(0.4, 0, 0.2, 1),\n    background-color 0.2s,\n    transform 0.2s !important;\n}\n\n#ai-bridge-toggle-navbar-btn:hover {\n  background-color: var(--brand-hover) !important;\n  transform: scale(1.04) !important;\n}\n\n#ai-bridge-toggle-navbar-btn.btn-collapsed {\n  right: 16px !important;\n}\n\n/* Header của Panel */\n#ai-bridge-panel-header {\n  display: flex !important;\n  justify-content: space-between !important;\n  align-items: center !important;\n  padding: 16px 20px !important;\n  background-color: var(--bg-primary) !important;\n  color: var(--text-primary) !important;\n  border-bottom: 1px solid var(--border-color) !important;\n  font-size: 16px !important;\n  font-weight: 500 !important;\n  font-family: "Google Sans", "Inter", Roboto, sans-serif !important;\n  flex-shrink: 0 !important;\n}\n\n/* Danh sách bên trong Panel */\n#ai-bridge-panel-list {\n  flex: 1 !important;\n  overflow-y: auto !important;\n  padding: 12px 8px !important;\n  font-family: "Google Sans", "Inter", Roboto, sans-serif !important;\n  background-color: var(--bg-primary) !important;\n}\n\n/* Từng Item dòng (Turn Item) */\n#ai-bridge-panel-list .turn-item {\n  display: flex !important;\n  align-items: flex-start !important;\n  gap: 12px !important;\n  padding: 12px 14px !important;\n  margin-bottom: 4px !important;\n  cursor: pointer !important;\n  border-radius: var(--radius-md) !important;\n  border: 1px solid transparent !important;\n  transition:\n    background-color 0.2s,\n    border-color 0.2s !important;\n}\n\n#ai-bridge-panel-list .turn-item:hover {\n  background-color: var(--bg-hover) !important;\n}\n\n/* Đoạn text preview bên trong item */\n#ai-bridge-panel-list .turn-item .turn-preview {\n  flex: 1 !important;\n  font-size: 14px !important;\n  color: var(--text-secondary) !important;\n  line-height: 1.5 !important;\n  word-break: break-word !important;\n}\n\n#ai-bridge-panel-list .turn-item:hover .turn-preview {\n  color: var(--text-primary) !important;\n}\n\n/* Cụm nút hành động của Item */\n#ai-bridge-panel-list .turn-item .turn-actions {\n  display: flex !important;\n  gap: 6px !important;\n  flex-shrink: 0 !important;\n}\n\n/* Các button hành động nhỏ */\n#ai-bridge-panel-list .turn-item .turn-actions button {\n  background: none !important;\n  border: none !important;\n  cursor: pointer !important;\n  color: var(--text-secondary) !important;\n  font-size: 14px !important;\n  padding: 6px !important;\n  border-radius: 8px !important;\n  opacity: 0 !important; /* Ẩn đi mặc định, chỉ hiện khi hover item */\n  transition:\n    opacity 0.2s,\n    background-color 0.15s,\n    color 0.15s !important;\n}\n\n/* Hiển thị nút hành động khi hover vào dòng */\n#ai-bridge-panel-list .turn-item:hover .turn-actions button {\n  opacity: 0.7 !important;\n}\n\n#ai-bridge-panel-list .turn-item .turn-actions button:hover {\n  opacity: 1 !important;\n  background-color: var(--bg-hover) !important;\n  color: var(--text-primary) !important;\n}\n\n/* Hiệu ứng Highlight Pulse đặc trưng kiểu Gemini */\n.gemini-activated-highlight {\n  animation: gemini-highlight-pulse 1.8s cubic-bezier(0.4, 0, 0.2, 1) !important;\n}\n\n@keyframes gemini-highlight-pulse {\n  0% {\n    box-shadow: 0 0 0 0 rgba(26, 115, 232, 0.5) !important;\n    border-color: var(--brand-primary) !important;\n  }\n  70% {\n    box-shadow: 0 0 0 12px rgba(26, 115, 232, 0) !important;\n  }\n  100% {\n    box-shadow: none !important;\n  }\n}\n\n/* ==========================================================================\n   ROLE BADGES & ROLE-SPECIFIC STYLES\n   Phân biệt rõ ràng giữa User và Gemini\n   ========================================================================== */\n\n/* Badge chung */\n.turn-role-badge {\n  font-size: 10px !important;\n  font-weight: 700 !important;\n  padding: 2px 8px !important;\n  border-radius: 4px !important;\n  flex-shrink: 0 !important;\n  text-transform: uppercase !important;\n  letter-spacing: 0.5px !important;\n  line-height: 1.4 !important;\n  user-select: none !important;\n}\n\n/* Badge User */\n.turn-role-user {\n  background-color: var(--brand-primary) !important;\n  color: var(--brand-on-primary) !important;\n}\n\n/* Badge Gemini (AI) */\n.turn-role-gemini {\n  background-color: #34a853 !important;\n  color: #ffffff !important;\n}\n\n/* Turn item của User - viền trái xanh */\n.turn-item.turn-user {\n  border-left: 3px solid var(--brand-primary) !important;\n  background-color: var(--bg-primary) !important;\n}\n\n.turn-item.turn-user:hover {\n  background-color: var(--bg-hover) !important;\n}\n\n/* Turn item của Gemini - viền trái xanh lá */\n.turn-item.turn-gemini {\n  border-left: 3px solid #34a853 !important;\n  background-color: var(--bg-primary) !important;\n}\n\n.turn-item.turn-gemini:hover {\n  background-color: var(--bg-hover) !important;\n}\n';

  const DAEMON_PORT_KEY = "ai_bridge_port";
  const SELECTORS_KEY = "ai_bridge_selectors";
  const DEFAULT_PORT = 58721;

  function getPort() {
    return GM_getValue(DAEMON_PORT_KEY, DEFAULT_PORT);
  }

  function setPort(port) {
    GM_setValue(DAEMON_PORT_KEY, port);
  }

  function getSelectors() {
    return GM_getValue(SELECTORS_KEY, {});
  }

  function setSelectors(selectors) {
    GM_setValue(SELECTORS_KEY, selectors);
  }

  function createBridgeController(adapter) {
    const DAEMON_URL = () => `http://127.0.0.1:${getPort()}`;
    let isSubmitting = false;

    async function healthCheck() {
      try {
        const res = await gmFetch(`${DAEMON_URL()}/health`);
        console.log("[ai-bridge] healthCheck:", res.ok, DAEMON_URL());
        return res.ok;
      } catch (err) {
        console.warn("[ai-bridge] healthCheck failed:", err);
        return false;
      }
    }

    async function dequeue() {
      if (isSubmitting) {
        console.log("[ai-bridge] dequeue skipped: currently submitting");
        return false;
      }

      console.log("[ai-bridge] executing dequeue fetch...");
      try {
        const res = await gmFetch(`${DAEMON_URL()}/dequeue`, {
          method: "POST",
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        if (data && data.title) {
          adapter._downloadTitle = data.title;
        }
        if (data && data.text && data.text.length > 0) {
          console.log("[ai-bridge] dequeue received:", data.text.slice(0, 60));
          isSubmitting = true;
          try {
            await adapter.fillInput(data.text);
            return true; // Fetch và điền dữ liệu thành công
          } catch (fillErr) {
            console.error("[ai-bridge] adapter.fillInput failed:", fillErr);
            return false;
          } finally {
            isSubmitting = false;
          }
        } else {
          console.log("[ai-bridge] dequeue empty");
          return false;
        }
      } catch (err) {
        console.warn("[ai-bridge] dequeue failed:", err);
        return false;
      }
    }

    function waitForInput(timeout = 10000) {
      const start = Date.now();
      return new Promise((resolve) => {
        let resolved = false;

        const safeResolve = () => {
          if (resolved) return;
          resolved = true;
          if (observer) observer.disconnect();
          clearTimeout(timerId);
          resolve();
        };

        const check = () => {
          if (adapter.validateDOM()) {
            console.log(
              "[ai-bridge] input field found via polling after",
              Date.now() - start,
              "ms",
            );
            safeResolve();
            return;
          }
          if (Date.now() - start > timeout) {
            console.warn(
              "[ai-bridge] hydration wait timeout after",
              timeout,
              "ms",
            );
            safeResolve();
            return;
          }
          timerId = setTimeout(check, 100);
        };

        let timerId = setTimeout(check, 100);
        let observer = null;

        if (document.body) {
          observer = new MutationObserver(() => {
            if (adapter.validateDOM()) {
              console.log("[ai-bridge] input field found via Observer");
              safeResolve();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    }

    async function init() {
      console.log("[ai-bridge] init start");

      const ok = await healthCheck();
      if (!ok) {
        console.warn("[ai-bridge] daemon not reachable — skipping bridge init");
        return;
      }

      console.log("[ai-bridge] daemon reachable, waiting for input field...");
      await waitForInput();

      console.log(
        "[ai-bridge] input field ready, triggering fetch sequence...",
      );

      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[ai-bridge] Fetch attempt ${attempt}/${maxRetries}`);
        const success = await dequeue();

        if (success) {
          console.log("[ai-bridge] Fetch and submit completed successfully.");
          break;
        }

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      console.log("[ai-bridge] init done");
    }

    return { init, dequeue, healthCheck };
  }

  document.addEventListener("keydown", async (e) => {
    if (e.altKey && e.key === "x") {
      e.preventDefault();
      try {
        const res = await gmFetch(`http://127.0.0.1:${getPort()}/clipboard`);
        const data = await res.json();
        if (data.text && data.text.length > 0) {
          const platform = detectPlatform();
          if (platform) {
            await platform.fillInput(data.text);
            if (!e.shiftKey) {
              platform.clickSend();
            }
          }
        }
      } catch (err) {
        console.warn("[ai-bridge] clipboard fetch failed:", err);
      }
    }
  });

  function gmFetch(url, opts = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        url,
        method: opts.method || "GET",
        headers: opts.headers || {},
        responseType: "json",
        onload(res) {
          resolve({
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            json: () => Promise.resolve(res.response),
          });
        },
        onerror(err) {
          reject(new Error(`GM_xmlhttpRequest failed: ${err}`));
        },
      });
    });
  }

  // html2md.js — Lightweight HTML-to-Markdown converter
  // Converts a DOM element's innerHTML to Markdown text.

  function htmlToMarkdown(el) {
    if (!el) return "";
    // If string (innerHTML), parse into DOM element via DOMParser (CSP-safe)
    if (typeof el === "string") {
      el = new DOMParser().parseFromString(el, "text/html").body;
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toLowerCase();

      // Skip non-content elements
      if (tag === "script" || tag === "style") return "";
      if (node.getAttribute("aria-hidden") === "true") return "";

      // Pre-scan: identify label siblings consumed by code blocks (Gemini format)
      const childArr = Array.from(node.childNodes);
      const consumed = new Set();
      for (let i = 0; i < childArr.length; i++) {
        const c = childArr[i];
        if (
          c.nodeType === Node.ELEMENT_NODE &&
          c.tagName.toLowerCase() === "pre"
        ) {
          for (let j = i - 1; j >= 0; j--) {
            const prev = childArr[j];
            if (prev.nodeType === Node.ELEMENT_NODE && !consumed.has(j)) {
              const span = prev.querySelector(":scope > span");
              if (span && span.textContent.trim().length < 30) {
                consumed.add(j);
              }
              break;
            }
          }
        }
      }
      const children = childArr
        .filter((_, i) => !consumed.has(i))
        .map(walk)
        .join("");

      switch (tag) {
        // Headings
        case "h1":
          return "# " + children.trim() + "\n\n";
        case "h2":
          return "## " + children.trim() + "\n\n";
        case "h3":
          return "### " + children.trim() + "\n\n";
        case "h4":
          return "#### " + children.trim() + "\n\n";
        case "h5":
          return "##### " + children.trim() + "\n\n";
        case "h6":
          return "###### " + children.trim() + "\n\n";

        // Block elements
        case "p":
          return children.trim() + "\n\n";
        case "br":
          return "\n";
        case "hr":
          return "---\n\n";

        // Code
        case "pre": {
          const codeEl = node.querySelector("code");
          let lang = codeEl
            ? (codeEl.className.match(/language-(\S+)/) || [])[1] || ""
            : "";

          // Fallback: check previous sibling for a language label (Gemini format)
          if (!lang) {
            const prev = node.previousElementSibling;
            if (prev) {
              const labelSpan = prev.querySelector(":scope > span");
              if (labelSpan) {
                const text = labelSpan.textContent.trim();
                if (text && text.length < 30) {
                  lang = text.toLowerCase();
                }
              }
            }
          }

          const code = (codeEl ? codeEl.textContent : node.textContent).trim();
          return "```" + lang + "\n" + code + "\n```\n\n";
        }
        case "code": {
          // Inline code — only if not inside <pre>
          if (
            node.parentElement &&
            node.parentElement.tagName.toLowerCase() === "pre"
          ) {
            return node.textContent;
          }
          return "`" + node.textContent + "`";
        }

        // Inline formatting
        case "strong":
        case "b":
          return "**" + node.textContent.trim() + "**";
        case "em":
        case "i":
          return "*" + node.textContent.trim() + "*";
        case "del":
        case "s":
        case "strike":
          return "~~" + node.textContent.trim() + "~~";

        // Links and images
        case "a": {
          const href = node.getAttribute("href");
          const text = node.textContent.trim();
          if (!href) return text;
          return "[" + text + "](" + href + ")";
        }
        case "img": {
          const src = node.getAttribute("src") || "";
          const alt = node.getAttribute("alt") || "";
          return "![" + alt + "](" + src + ")";
        }

        // Lists
        case "ul":
          return "\n" + children + "\n";
        case "ol":
          return "\n" + children + "\n";
        case "li": {
          const parent = node.parentElement;
          if (!parent) return "- " + children.trim() + "\n";
          const isOrdered = parent.tagName.toLowerCase() === "ol";
          if (isOrdered) {
            const idx = Array.from(parent.children).indexOf(node) + 1;
            return idx + ". " + children.trim() + "\n";
          }
          return "- " + children.trim() + "\n";
        }

        // Table
        case "table":
          return "\n" + convertTable(node) + "\n";

        // Ignore everything else, just return children
        default:
          return children;
      }
    }

    function convertTable(tableEl) {
      // 1. Thu thập hàng thuộc nhóm tiêu đề (thead) hoặc hàng đầu tiên của bảng
      const thead = tableEl.querySelector(":scope > thead");
      const tbody = tableEl.querySelector(":scope > tbody");

      let headerRows = thead
        ? Array.from(thead.querySelectorAll(":scope > tr"))
        : [];
      let bodyRows = tbody
        ? Array.from(tbody.querySelectorAll(":scope > tr"))
        : [];

      // Trường hợp bảng không dùng thead/tbody phẳng
      if (headerRows.length === 0 && bodyRows.length === 0) {
        const allRows = Array.from(tableEl.querySelectorAll(":scope > tr"));
        if (allRows.length > 0) {
          headerRows = [allRows[0]];
          bodyRows = allRows.slice(1);
        }
      }

      if (headerRows.length === 0 && bodyRows.length === 0) return "";

      const result = [];
      let maxCols = 0;

      // Hàm xử lý chung cho một hàng (tr)
      function processRow(row) {
        const cells = Array.from(
          row.querySelectorAll(":scope > th, :scope > td"),
        );
        maxCols = Math.max(maxCols, cells.length);
        return cells.map((c) => c.textContent.replace(/[\n\r]/g, " ").trim());
      }

      // 2. Xử lý các hàng tiêu đề
      const processedHeaders = headerRows.map(processRow);
      // Nếu không tìm thấy hàng tiêu đề rõ ràng, lấy hàng đầu tiên của body làm tiêu đề
      if (processedHeaders.length === 0 && bodyRows.length > 0) {
        processedHeaders.push(processRow(bodyRows.shift()));
      }

      // Đẩy hàng tiêu đề vào mảng kết quả
      processedHeaders.forEach((cells) => {
        result.push("| " + cells.join(" | ") + " |");
      });

      // 3. Tạo thanh phân tách (Separator) dựa trên số lượng cột lớn nhất detected
      if (maxCols > 0) {
        const sep = "| " + Array(maxCols).fill("---").join(" | ") + " |";
        result.push(sep);
      }

      // 4. Xử lý các hàng nội dung (body)
      bodyRows.forEach((row) => {
        const cells = processRow(row);
        // Điền thêm ô trống nếu hàng này có ít cột hơn hàng tiêu đề
        while (cells.length < maxCols) {
          cells.push("");
        }
        result.push("| " + cells.join(" | ") + " |");
      });

      return result.join("\n");
    }

    return walk(el)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function resolveFilename(name) {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function createChatHistoryPanel(adapter) {
    let layoutWrapper = null;
    let geminiContainer = null;
    let panelContainer = null;
    let listEl = null;
    let toggleBtn = null;
    let isOpen = true;

    function init() {
      injectCSS();
      buildDOM();
      setupToggle();
      observeTurns();
    }

    function injectCSS() {
      const style = document.createElement("style");
      if (ttPolicy) {
        style.textContent = ttPolicy.createHTML(panelCSS);
      } else {
        style.textContent = panelCSS;
      }
      document.head.appendChild(style);
    }

    function buildDOM() {
      // Cleanup old instances
      const oldWrapper = document.getElementById("ai-bridge-layout-wrapper");
      if (oldWrapper) {
        const oldGemini = document.getElementById("ai-bridge-gemini-container");
        if (oldGemini) {
          while (oldGemini.firstChild) {
            document.body.appendChild(oldGemini.firstChild);
          }
        }
        oldWrapper.remove();
      }
      const oldToggle = document.getElementById("ai-bridge-toggle-navbar-btn");
      if (oldToggle) oldToggle.remove();

      // Create layout structure
      layoutWrapper = document.createElement("div");
      layoutWrapper.id = "ai-bridge-layout-wrapper";

      geminiContainer = document.createElement("div");
      geminiContainer.id = "ai-bridge-gemini-container";

      panelContainer = document.createElement("div");
      panelContainer.id = "ai-bridge-inserted-panel";

      // Move all existing body children into geminiContainer
      while (document.body.firstChild) {
        geminiContainer.appendChild(document.body.firstChild);
      }

      // Build panel header
      const header = document.createElement("div");
      header.id = "ai-bridge-panel-header";
      const headerText = document.createElement("span");
      headerText.textContent = "Chat Navigator";
      header.appendChild(headerText);

      // Build list container
      listEl = document.createElement("div");
      listEl.id = "ai-bridge-panel-list";

      // Build toggle button
      toggleBtn = document.createElement("button");
      toggleBtn.id = "ai-bridge-toggle-navbar-btn";
      toggleBtn.textContent = "\u2630";
      toggleBtn.title = "\u01afu/\u1ea8n Sidebar";

      // Assemble DOM tree
      panelContainer.appendChild(header);
      panelContainer.appendChild(listEl);
      layoutWrapper.appendChild(geminiContainer);
      layoutWrapper.appendChild(panelContainer);

      document.body.appendChild(layoutWrapper);
      document.body.appendChild(toggleBtn);
    }

    function setupToggle() {
      toggleBtn.addEventListener("click", () => {
        panelContainer.classList.toggle("sidebar-hidden");
        toggleBtn.classList.toggle("btn-collapsed");
        // Trigger Gemini layout recalculation
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 260);
      });
    }

    function getChatTitle() {
      // Try aria-label on active sidebar link
      const activeLink =
        geminiContainer && geminiContainer.querySelector("a.is-active");
      if (!activeLink) {
        // Fallback: page title
        const t = document.title.replace(/\s*[-–|].*$/, "").trim();
        return t || null;
      }
      const ariaLabel = activeLink.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;
      // Fallback: title-text span inside active link
      const titleEl = activeLink.querySelector(".title-text");
      if (titleEl) return titleEl.textContent.trim();
      // Fallback: page title
      const t = document.title.replace(/\s*[-–|].*$/, "").trim();
      return t || null;
    }

    function getTurns() {
      if (!geminiContainer) return [];
      const turnEls = geminiContainer.querySelectorAll(
        adapter.TURN_SELECTORS.join(", "),
      );
      return Array.from(turnEls).map((el, i) => ({
        element: el,
        index: i,
        name: adapter.getTurnName(el),
        text: adapter.getResponseText(el),
        htmlElement: adapter.getResponseHTMLElement(el),
      }));
    }

    let throttleTimer = null;
    function renderTurns() {
      if (!listEl) return;
      if (throttleTimer) return;
      throttleTimer = requestAnimationFrame(() => {
        throttleTimer = null;
        const turns = getTurns();

        if (turns.length === 0) {
          const empty = document.createElement("p");
          empty.textContent =
            "Ch\u01b0a ph\u00e1t hi\u1ec7n tin nh\u1eafn n\u00e0o.";
          empty.style.cssText =
            "color:#666;font-size:12px;text-align:center;padding-top:20px;font-family:sans-serif;";
          listEl.textContent = "";
          listEl.appendChild(empty);
          return;
        }

        // Build all turn items with DOM (no innerHTML for CSP safety)
        listEl.textContent = "";
        turns.forEach((turn, i) => {
          const preview =
            turn.text.length > 80 ? turn.text.slice(0, 80) + "..." : turn.text;
          const isUser = turn.name === "User";

          const item = document.createElement("div");
          item.className =
            "turn-item " + (isUser ? "turn-user" : "turn-gemini");
          item.dataset.index = i;

          const badge = document.createElement("div");
          badge.className =
            "turn-role-badge " +
            (isUser ? "turn-role-user" : "turn-role-gemini");
          badge.textContent = isUser ? "You" : "AI";

          const previewEl = document.createElement("span");
          previewEl.className = "turn-preview";
          previewEl.textContent = preview;

          const actions = document.createElement("span");
          actions.className = "turn-actions";

          const copyBtn = document.createElement("button");
          copyBtn.className = "turn-copy";
          copyBtn.dataset.index = i;
          copyBtn.textContent = "\ud83d\udccb";

          const dlBtn = document.createElement("button");
          dlBtn.className = "turn-download";
          dlBtn.dataset.index = i;
          dlBtn.textContent = "\u2b07";

          actions.appendChild(copyBtn);
          actions.appendChild(dlBtn);
          item.appendChild(badge);
          item.appendChild(previewEl);
          item.appendChild(actions);
          listEl.appendChild(item);

          // Click to scroll to turn
          item.addEventListener("click", (e) => {
            if (e.target.closest(".turn-actions")) return;
            if (turn.element) {
              turn.element.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
              setTimeout(() => {
                geminiContainer.scrollBy({ top: -80, behavior: "smooth" });
              }, 120);
              turn.element.classList.add("gemini-activated-highlight");
              setTimeout(() => {
                turn.element.classList.remove("gemini-activated-highlight");
              }, 1500);
            }
          });

          // Copy button
          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const markdown = htmlToMarkdown(turn.htmlElement);
            navigator.clipboard.writeText(markdown);
          });

          // Download button
          dlBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const chatTitle = getChatTitle();
            const title = adapter._downloadTitle;
            const name = resolveFilename(
              title || chatTitle || turn.name || "chat-response",
            );
            const markdown = htmlToMarkdown(turn.htmlElement);
            const blob = new Blob([markdown], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name + ".md";
            a.click();
            URL.revokeObjectURL(url);
          });
        });
      });
    }

    let mutationTimer = null;
    function observeTurns() {
      if (!geminiContainer) return;
      const observer = new MutationObserver(() => {
        if (mutationTimer) clearTimeout(mutationTimer);
        mutationTimer = setTimeout(renderTurns, 300);
      });
      observer.observe(geminiContainer, { childList: true, subtree: true });
    }

    return { init, togglePanel: () => toggleBtn && toggleBtn.click() };
  }

  const GeminiAdapter = {
    INPUT_SELECTORS: [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      "textarea",
    ],
    SEND_SELECTORS: [
      '[data-test-id="send-button-container"] button',
      ".send-button-container button",
      "gem-icon-button.submit button",

      'button:has([fonticon="arrow_upward"])',

      'button[aria-label*="Send"]',
      'button[aria-label*="Gửi"]',
      'button[aria-label*="gửi"]',
    ],
    TURN_SELECTORS: ["model-response", "user-query"],

    validateDOM() {
      for (const sel of this.INPUT_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) {
          console.log("[ai-bridge] validateDOM: found with", sel);
          return true;
        }
      }
      console.warn(
        "[ai-bridge] validateDOM: no input found — selectors:",
        this.INPUT_SELECTORS,
      );
      return false;
    },

    findInput() {
      const userSelectors = getSelectors().inputSelectors;
      const selectors = userSelectors || this.INPUT_SELECTORS;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        console.log(
          "[ai-bridge] findInput: trying",
          sel,
          "→",
          el ? "found" : "null",
        );
        if (el) return el;
      }
      return null;
    },

    findSendButton() {
      const userSelectors = getSelectors().sendSelectors;
      const selectors = userSelectors || this.SEND_SELECTORS;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        console.log(
          "[ai-bridge] findSendButton: trying",
          sel,
          "→",
          el ? "found" : "null",
        );
        if (el) return el;
      }
      return null;
    },

    async fillInput(text) {
      const input = this.findInput();
      if (!input) {
        console.warn(
          "[ai-bridge] fillInput: no input element, text:",
          text.slice(0, 60),
        );
        return;
      }
      console.log(
        "[ai-bridge] fillInput: text=" +
          text.slice(0, 60) +
          ", input=" +
          (input.tagName || "?"),
      );
      input.focus();
      document.execCommand("insertText", false, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
      const sendBtn = this.findSendButton();
      console.log(
        "[ai-bridge] fillInput: sendBtn",
        sendBtn ? "found, clicking" : "not found",
      );
      if (sendBtn) sendBtn.click();
    },

    clickSend() {
      const btn = this.findSendButton();
      console.log(
        "[ai-bridge] clickSend: button",
        btn ? "found, clicking" : "not found",
      );
      if (btn) btn.click();
    },

    getTurnName(turnEl) {
      const tag = turnEl.tagName.toLowerCase();
      const role = tag === "user-query" ? "User" : "Gemini";
      console.log("[ai-bridge] getTurnName:", tag, "→", role);
      return role;
    },

    getResponseText(turnEl) {
      const contentEl = turnEl.querySelector(".markdown, user-query-content");
      const text = contentEl
        ? contentEl.textContent.trim()
        : turnEl.textContent.trim();
      console.log("[ai-bridge] getResponseText: length", text.length);
      return text;
    },

    getResponseHTMLElement(turnEl) {
      const contentEl = turnEl.querySelector(".markdown, user-query-content");
      const result = contentEl || turnEl;
      console.log(
        "[ai-bridge] getResponseHTMLElement: returning",
        result.tagName,
      );
      return result;
    },

    getTurnSelector(index) {
      const sel = `${this.TURN_SELECTORS.join(", ")}:nth-child(${index + 1})`;
      return sel;
    },
  };

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("gemini.google.com")) return GeminiAdapter;
    if (host.includes("chatgpt.com")) return null;
    if (host.includes("claude.ai")) return null;
    if (host.includes("chat.deepseek.com")) return null;
    return null;
  }

  (function () {
    const adapter = detectPlatform();
    if (!adapter) {
      console.warn(
        "[ai-bridge] unsupported platform:",
        window.location.hostname,
      );
      return;
    }

    const bridge = createBridgeController(adapter);
    const panel = createChatHistoryPanel(adapter);

    bridge.init().then(() => {
      panel.init();
    });
  })();
})();
