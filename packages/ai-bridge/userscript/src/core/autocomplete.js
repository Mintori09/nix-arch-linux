function createAutocomplete(adapter, getPromptList) {
  let popupEl = null;
  let active = false;
  let selectedIndex = 0;
  let currentQuery = "";
  let inputEl = null;
  let cachedContents = {};
  let lastQuery = null;

  function fuzzyMatch(text, query) {
    if (!query) return { matches: true, score: 0 };
    text = text.toLowerCase();
    query = query.toLowerCase();

    let score = 0;
    let textIdx = 0;
    let queryIdx = 0;
    let lastMatchIdx = -1;

    while (textIdx < text.length && queryIdx < query.length) {
      if (text[textIdx] === query[queryIdx]) {
        score += 1;
        if (lastMatchIdx !== -1 && textIdx === lastMatchIdx + 1) {
          score += 2;
        }
        if (textIdx === 0 || [" ", "-", "_"].includes(text[textIdx - 1])) {
          score += 3;
        }
        lastMatchIdx = textIdx;
        queryIdx++;
      }
      textIdx++;
    }

    return {
      matches: queryIdx === query.length,
      score: score,
    };
  }

  function getInputElement() {
    if (!inputEl || !inputEl.isConnected) {
      const found = adapter.findInput();
      if (found) {
        if (inputEl && inputEl !== found) {
          detachListeners(inputEl);
        }
        inputEl = found;
        attachListeners(inputEl);
      }
    }
    return inputEl;
  }

    let justSelectedWithEnter = false;

  function attachListeners(el) {
    if (!el) return;
    el.addEventListener("input", checkAutocomplete);
    el.addEventListener("keyup", checkAutocomplete);
    el.addEventListener("blur", onBlur);
  }

  function detachListeners(el) {
    if (!el) return;
    el.removeEventListener("input", checkAutocomplete);
    el.removeEventListener("keyup", checkAutocomplete);
    el.removeEventListener("blur", onBlur);
  }

  function init() {
    inputEl = adapter.findInput();

    popupEl = document.createElement("div");
    popupEl.id = "ai-bridge-autocomplete-popup";
    popupEl.style.display = "none";

    document.body.appendChild(popupEl);

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);

    if (inputEl) {
      attachListeners(inputEl);
    }

    // Keep checking in case input is rendered or replaced dynamically
    document.addEventListener("focusin", () => {
      getInputElement();
    });
  }

  function destroy() {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    if (popupEl) popupEl.remove();
    if (inputEl) {
      detachListeners(inputEl);
    }
  }

  function getTextBeforeCursor() {
    const el = getInputElement();
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const pos = typeof el.selectionStart === "number" ? el.selectionStart : el.value.length;
      return el.value.slice(0, pos);
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return "";
    const range = sel.getRangeAt(0);

    try {
      const preRange = range.cloneRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.startContainer, range.startOffset);
      return preRange.toString();
    } catch (e) {
      return range.startContainer.textContent.slice(0, range.startOffset);
    }
  }

  function checkAutocomplete(e) {
    if (
      e &&
      e.type === "keyup" &&
      ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)
    ) {
      return;
    }

    const textBefore = getTextBeforeCursor();
    const match = textBefore.match(/(?:^|\s)!(\w*)$/);

    if (match) {
      const query = match[1];
      if (query !== lastQuery) {
        lastQuery = query;
        currentQuery = query;
        showPopup(query);
      }
    } else {
      lastQuery = null;
      hidePopup();
    }
  }

  function onKeyDown(e) {
    if (!active) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectedIndex = Math.min(
        selectedIndex + 1,
        getFilteredPrompts().length - 1,
      );
      highlightItem();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      highlightItem();
      return;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      justSelectedWithEnter = true;
      setTimeout(() => {
        justSelectedWithEnter = false;
      }, 500);
      selectCurrent();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      hidePopup();
      return;
    }
  }

  function onKeyUp(e) {
    if (justSelectedWithEnter && (e.key === "Enter" || e.key === "Tab")) {
      justSelectedWithEnter = false;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }
  }

  function onBlur() {
    setTimeout(hidePopup, 200);
  }

  function getFilteredPrompts() {
    const prompts = getPromptList();
    if (!currentQuery) return prompts;

    const results = prompts
      .map((p) => {
        const nameMatch = fuzzyMatch(p.name, currentQuery);
        const titleMatch = fuzzyMatch(p.title, currentQuery);

        const bestScore = Math.max(nameMatch.score, titleMatch.score);
        const matches = nameMatch.matches || titleMatch.matches;

        return { prompt: p, matches, score: bestScore };
      })
      .filter((r) => r.matches);

    results.sort((a, b) => b.score - a.score);

    return results.map((r) => r.prompt);
  }

  function showPopup(query) {
    const filtered = getFilteredPrompts();
    if (filtered.length === 0) {
      hidePopup();
      return;
    }

    selectedIndex = 0;
    active = true;

    // 1. Populate the list items
    popupEl.textContent = "";
    filtered.forEach((p, i) => {
      const item = document.createElement("div");
      item.dataset.index = i;
      item.className = "autocomplete-item";

      const icon = document.createElement("span");
      icon.textContent = ">";
      icon.className = "icon";

      const text = document.createElement("span");
      text.textContent = p.title;

      item.appendChild(icon);
      item.appendChild(text);

      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectedIndex = parseInt(item.dataset.index, 10);
        selectCurrent();
      });

      item.addEventListener("mouseenter", () => {
        selectedIndex = i;
        highlightItem();
      });

      popupEl.appendChild(item);
    });

    // 2. Make popup visible to measure it
    popupEl.style.display = "block";

    // 3. Compute optimal position relative to viewport boundaries
    const sel = window.getSelection();
    if (sel && sel.rangeCount && typeof sel.getRangeAt(0).getBoundingClientRect === "function") {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const popupHeight = popupEl.offsetHeight || 240;
      const popupWidth = popupEl.offsetWidth || 200;
      const margin = 4;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let topPosition = rect.bottom + margin;
      if (
        spaceBelow < popupHeight + margin &&
        spaceAbove > popupHeight + margin
      ) {
        topPosition = rect.top - popupHeight - margin;
      }

      let leftPosition = rect.left;
      if (leftPosition + popupWidth > window.innerWidth) {
        leftPosition = Math.max(
          margin,
          window.innerWidth - popupWidth - margin,
        );
      }

      popupEl.style.top = topPosition + "px";
      popupEl.style.left = leftPosition + "px";
    }

    highlightItem();
  }

  function hidePopup() {
    active = false;
    lastQuery = null;
    if (popupEl) popupEl.style.display = "none";
  }

  function highlightItem() {
    const items = popupEl.querySelectorAll(".autocomplete-item");
    items.forEach((item, i) => {
      if (i === selectedIndex) {
        item.classList.add("autocomplete-selected");
      } else {
        item.classList.remove("autocomplete-selected");
      }
    });
  }

  function insertCompletion(content) {
    const el = getInputElement();
    if (!el) return;

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const val = el.value || "";
      const pos = typeof el.selectionStart === "number" ? el.selectionStart : val.length;
      const textBefore = val.slice(0, pos);
      const textAfter = val.slice(pos);
      const match = textBefore.match(/(?:^|\s)!(\w*)$/);

      if (match) {
        const triggerPos = textBefore.lastIndexOf("!" + match[1]);
        const beforeTrigger = val.slice(0, triggerPos);
        el.value = beforeTrigger + content + textAfter;
        const newCursor = beforeTrigger.length + content.length;
        el.selectionStart = newCursor;
        el.selectionEnd = newCursor;
      } else {
        el.value = content;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.focus();
      return;
    }

    // Contenteditable (ProseMirror / div)
    el.focus();
    const sel = window.getSelection();
    let replaced = false;
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const nodeText = range.startContainer.textContent || "";
      const textBefore = nodeText.slice(0, range.startOffset);
      const match = textBefore.match(/!(\w*)$/);

      if (match && range.startOffset >= match[0].length) {
        const startOffset = range.startOffset - match[0].length;
        try {
          range.setStart(range.startContainer, startOffset);
          range.setEnd(range.startContainer, range.startOffset);
          sel.removeAllRanges();
          sel.addRange(range);
          replaced = document.execCommand("insertText", false, content);
        } catch (e) {
          // ignore
        }
      }
    }

    if (!replaced) {
      const success = document.execCommand("insertText", false, content);
      if (!success) {
        const text = el.textContent || "";
        const match = text.match(/(?:^|\s)!(\w*)$/);
        if (match) {
          const triggerPos = text.lastIndexOf("!" + match[1]);
          el.textContent = text.slice(0, triggerPos) + content;
        } else {
          el.textContent = content;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function selectCurrent() {
    const filtered = getFilteredPrompts();
    const prompt = filtered[selectedIndex];
    if (!prompt) return;

    hidePopup();

    let content = prompt.content || cachedContents[prompt.name];
    if (!content) {
      try {
        const port = typeof getPort === "function" ? getPort() : 3457;
        const url = `http://127.0.0.1:${port}/prompts/${encodeURIComponent(prompt.name)}`;
        const res = await gmFetch(url);
        if (res.ok) {
          const data = await res.json();
          content = data.content || "";
          cachedContents[prompt.name] = content;
        }
      } catch (err) {
        console.warn("[ai-bridge] fetch prompt content error:", err);
        return;
      }
    }

    if (!content) return;

    insertCompletion(content);
  }

  return { init, destroy, insertCompletion };
}
