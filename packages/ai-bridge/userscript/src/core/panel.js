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

function createChatHistoryPanel(adapter, promptsContainerEl) {
  let panelContainer = null;
  let listEl = null;
  let toggleBtn = null;
  const defaultHidden = Boolean(adapter && adapter.defaultHideNavigator);
  let isOpen = !defaultHidden;

  function init() {
    const prevFocus = document.activeElement;
    injectCSS();
    buildDOM();
    setupToggle();
    observeTurns();
    renderTurns();
    restoreInputFocus(prevFocus);
  }

  function restoreInputFocus(prevFocus) {
    if (
      prevFocus &&
      prevFocus !== document.body &&
      typeof prevFocus.focus === "function"
    ) {
      requestAnimationFrame(() => prevFocus.focus());
    }
  }

  function injectCSS() {
    if (document.getElementById("ai-bridge-style")) return;
    const style = document.createElement("style");
    style.id = "ai-bridge-style";
    if (ttPolicy) {
      style.textContent = ttPolicy.createHTML(panelCSS);
    } else {
      style.textContent = panelCSS;
    }
    document.head.appendChild(style);
  }

  function buildDOM() {
    // Cleanup old instances
    const oldPanel = document.getElementById("ai-bridge-inserted-panel");
    if (oldPanel) oldPanel.remove();
    const oldToggle = document.getElementById("ai-bridge-toggle-navbar-btn");
    if (oldToggle) oldToggle.remove();

    panelContainer = document.createElement("div");
    panelContainer.id = "ai-bridge-inserted-panel";
    if (defaultHidden) {
      panelContainer.classList.add("sidebar-hidden");
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

    // Insert prompts section before list if provided
    if (promptsContainerEl) {
      panelContainer.appendChild(promptsContainerEl);
    }

    // Build toggle button
    toggleBtn = document.createElement("button");
    toggleBtn.id = "ai-bridge-toggle-navbar-btn";
    toggleBtn.textContent = "\u2630";
    toggleBtn.title = "\u01afu/\u1ea8n Sidebar";
    if (defaultHidden) {
      toggleBtn.classList.add("btn-collapsed");
    }

    // Assemble DOM tree
    panelContainer.appendChild(header);
    panelContainer.appendChild(listEl);

    document.body.appendChild(panelContainer);
    document.body.appendChild(toggleBtn);
  }

  function setupToggle() {
    toggleBtn.addEventListener("click", () => {
      panelContainer.classList.toggle("sidebar-hidden");
      toggleBtn.classList.toggle("btn-collapsed");
      isOpen = !panelContainer.classList.contains("sidebar-hidden");
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 260);
    });
  }

  function getChatTitle() {
    const activeLink = document.querySelector(
      "a.is-active, nav a[aria-current='page'], nav li.active a",
    );
    if (activeLink) {
      const ariaLabel = activeLink.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;
      const titleEl = activeLink.querySelector(
        ".title-text, div[class*='truncate']",
      );
      if (titleEl) return titleEl.textContent.trim();
    }
    const t = document.title.replace(/\s*[-–|].*$/, "").trim();
    return t || null;
  }

  function getTurns() {
    const rawEls = Array.from(
      document.querySelectorAll(adapter.TURN_SELECTORS.join(", ")),
    );
    // Keep only top-level matching turns to prevent duplicates from nested selectors
    const turnEls = rawEls.filter((el) => {
      return !rawEls.some((other) => other !== el && other.contains(el));
    });

    return turnEls.map((el, i) => ({
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
            turn.element.scrollIntoView({ behavior: "smooth", block: "center" });
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
    const observer = new MutationObserver(() => {
      if (mutationTimer) clearTimeout(mutationTimer);
      mutationTimer = setTimeout(renderTurns, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return { init, togglePanel: () => toggleBtn && toggleBtn.click() };
}
