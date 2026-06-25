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
        item.className = "turn-item " + (isUser ? "turn-user" : "turn-gemini");
        item.dataset.index = i;

        const badge = document.createElement("div");
        badge.className =
          "turn-role-badge " + (isUser ? "turn-role-user" : "turn-role-gemini");
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
            turn.element.scrollIntoView({ behavior: "smooth", block: "start" });
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
          navigator.clipboard.writeText(turn.text);
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
