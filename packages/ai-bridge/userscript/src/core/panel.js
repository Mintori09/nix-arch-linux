function resolveFilename(name) {
  const cleaned = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || "chat-response"; // Fallback nếu chuỗi rỗng (VD: toàn emoji/CJK)
}

function createChatHistoryPanel(adapter, promptsContainerEl) {
  let panelContainer = null;
  let listEl = null;
  let toggleBtn = null;
  let observer = null;
  let mutationTimer = null;
  let throttleTimer = null;
  let cachedTurns = [];

  const defaultHidden = Boolean(adapter?.defaultHideNavigator);
  let isOpen = !defaultHidden;
  let isDirty = true; // Đánh dấu cần render lại khi mở panel

  function init() {
    destroy(); // Dọn sạch observer và DOM cũ trước khi khởi tạo
    const prevFocus = document.activeElement;
    injectCSS();
    buildDOM();
    setupEvents();
    observeTurns();
    renderTurns();
    restoreInputFocus(prevFocus);
  }

  function destroy() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (mutationTimer) clearTimeout(mutationTimer);
    if (throttleTimer) cancelAnimationFrame(throttleTimer);
    document.getElementById("ai-bridge-inserted-panel")?.remove();
    document.getElementById("ai-bridge-toggle-navbar-btn")?.remove();
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
    const cssText = typeof panelCSS !== "undefined" ? panelCSS : "";
    style.textContent =
      typeof ttPolicy !== "undefined" && ttPolicy
        ? ttPolicy.createHTML(cssText)
        : cssText;
    document.head.appendChild(style);
  }

  function buildDOM() {
    panelContainer = document.createElement("div");
    panelContainer.id = "ai-bridge-inserted-panel";
    if (defaultHidden) panelContainer.classList.add("sidebar-hidden");

    const header = document.createElement("div");
    header.id = "ai-bridge-panel-header";
    const headerText = document.createElement("span");
    headerText.textContent = "Chat navigator";
    header.appendChild(headerText);

    listEl = document.createElement("div");
    listEl.id = "ai-bridge-panel-list";

    if (promptsContainerEl) {
      panelContainer.appendChild(promptsContainerEl);
    }

    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.id = "ai-bridge-toggle-navbar-btn";
    toggleBtn.textContent = "\u2630";
    toggleBtn.title = "\u1ea8n/hi\u1ec7n sidebar";
    toggleBtn.setAttribute("aria-label", "\u1ea8n/hi\u1ec7n sidebar");
    if (defaultHidden) toggleBtn.classList.add("btn-collapsed");

    panelContainer.appendChild(header);
    panelContainer.appendChild(listEl);

    document.body.appendChild(panelContainer);
    document.body.appendChild(toggleBtn);
  }

  function flashButton(btn, symbol = "\u2713") {
    const orig = btn.textContent;
    btn.textContent = symbol;
    setTimeout(() => {
      btn.textContent = orig;
    }, 1000);
  }

  function setupEvents() {
    // 1. Toggle Sidebar
    toggleBtn.addEventListener("click", () => {
      panelContainer.classList.toggle("sidebar-hidden");
      toggleBtn.classList.toggle("btn-collapsed");
      isOpen = !panelContainer.classList.contains("sidebar-hidden");

      // Nếu mở lại mà có thay đổi trước đó thì mới render
      if (isOpen && isDirty) {
        renderTurns();
      }
      setTimeout(() => window.dispatchEvent(new Event("resize")), 260);
    });

    // 2. Event Delegation cho toàn bộ danh sách (Tránh gắn N*3 listener mỗi lần render)
    listEl.addEventListener("click", async (e) => {
      const item = e.target.closest(".turn-item");
      if (!item) return;

      const index = Number(item.dataset.index);
      const turn = cachedTurns[index];
      if (!turn) return;

      const copyBtn = e.target.closest(".turn-copy");
      if (copyBtn) {
        e.stopPropagation();
        const markdown = htmlToMarkdown(turn.htmlElement);
        await navigator.clipboard.writeText(markdown);
        flashButton(copyBtn);
        return;
      }

      const dlBtn = e.target.closest(".turn-download");
      if (dlBtn) {
        e.stopPropagation();
        const title = adapter._downloadTitle || getChatTitle() || turn.name;
        const name = resolveFilename(title);
        const markdown = htmlToMarkdown(turn.htmlElement);
        const blob = new Blob([markdown], {
          type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}-${index + 1}.md`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      // Click vào item để cuộn tới tin nhắn
      if (turn.element) {
        turn.element.scrollIntoView({ behavior: "smooth", block: "center" });
        turn.element.classList.add("gemini-activated-highlight");
        setTimeout(() => {
          turn.element.classList.remove("gemini-activated-highlight");
        }, 1500);
      }
    });
  }

  function getChatTitle() {
    const activeLink = document.querySelector(
      "a.is-active, nav a[aria-current='page'], nav li.active a",
    );
    if (activeLink) {
      const ariaLabel = activeLink.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel.trim();
      const titleEl = activeLink.querySelector(
        ".title-text, div[class*='truncate']",
      );
      if (titleEl) return titleEl.textContent.trim();
    }
    const t = document.title.replace(/\s*[-–|].*$/, "").trim();
    return t || null;
  }

  function getTurns() {
    const selector = adapter.TURN_SELECTORS.join(", ");
    const rawEls = Array.from(document.querySelectorAll(selector));

    // Lọc nhanh phần tử cha bằng parentElement.closest() thay vì vòng lặp O(N^2)
    const rawSet = new Set(rawEls);
    const turnEls = rawEls.filter((el) => {
      let parent = el.parentElement;
      while (parent) {
        if (rawSet.has(parent)) return false;
        parent = parent.parentElement;
      }
      return true;
    });

    return turnEls.map((el, i) => ({
      element: el,
      index: i,
      name: adapter.getTurnName(el),
      text: adapter.getResponseText(el) || "",
      htmlElement: adapter.getResponseHTMLElement(el),
    }));
  }

  function renderTurns() {
    if (!listEl) return;
    if (!isOpen) {
      isDirty = true;
      return;
    }
    if (throttleTimer) return;

    throttleTimer = requestAnimationFrame(() => {
      throttleTimer = null;
      isDirty = false;
      cachedTurns = getTurns();

      if (cachedTurns.length === 0) {
        const empty = document.createElement("p");
        empty.className = "ai-bridge-empty-state";
        empty.textContent =
          "Ch\u01b0a ph\u00e1t hi\u1ec7n tin nh\u1eafn n\u00e0o.";
        listEl.replaceChildren(empty);
        return;
      }

      const fragment = document.createDocumentFragment();

      cachedTurns.forEach((turn, i) => {
        const preview =
          turn.text.length > 80 ? turn.text.slice(0, 80) + "..." : turn.text;
        const isUser = turn.name === "User";

        const item = document.createElement("div");
        item.className = "turn-item " + (isUser ? "turn-user" : "turn-gemini");
        item.dataset.index = i;
        item.setAttribute("role", "button");
        item.tabIndex = 0;

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
        copyBtn.type = "button";
        copyBtn.className = "turn-copy";
        copyBtn.textContent = "\u2398";
        copyBtn.setAttribute("aria-label", "Sao ch\u00e9p n\u1ed9i dung");

        const dlBtn = document.createElement("button");
        dlBtn.type = "button";
        dlBtn.className = "turn-download";
        dlBtn.textContent = "\u2b07";
        dlBtn.setAttribute("aria-label", "T\u1ea3i xu\u1ed1ng Markdown");

        actions.append(copyBtn, dlBtn);
        item.append(badge, previewEl, actions);
        fragment.appendChild(item);
      });

      listEl.replaceChildren(fragment);
    });
  }

  function observeTurns() {
    observer = new MutationObserver((mutations) => {
      const hasExternalMutation = mutations.some(
        (m) => !panelContainer || !panelContainer.contains(m.target),
      );
      if (!hasExternalMutation) return;

      if (mutationTimer) clearTimeout(mutationTimer);
      mutationTimer = setTimeout(renderTurns, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return {
    init,
    destroy,
    togglePanel: () => toggleBtn?.click(),
  };
}
