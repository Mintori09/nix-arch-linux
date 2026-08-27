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

  function init() {
    inputEl = adapter.findInput();
    if (!inputEl) return;

    popupEl = document.createElement("div");
    popupEl.id = "ai-bridge-autocomplete-popup";
    popupEl.style.display = "none";

    document.body.appendChild(popupEl);

    inputEl.addEventListener("input", checkAutocomplete);
    inputEl.addEventListener("keyup", checkAutocomplete);
    inputEl.addEventListener("keydown", onKeyDown);
    inputEl.addEventListener("blur", onBlur);
  }

  function destroy() {
    if (popupEl) popupEl.remove();
    if (inputEl) {
      inputEl.removeEventListener("input", checkAutocomplete);
      inputEl.removeEventListener("keyup", checkAutocomplete);
      inputEl.removeEventListener("keydown", onKeyDown);
      inputEl.removeEventListener("blur", onBlur);
    }
  }

  function getTextBeforeCursor() {
    if (!inputEl) return "";
    if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
      return inputEl.value.slice(0, inputEl.selectionStart);
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return "";
    const range = sel.getRangeAt(0);

    try {
      const preRange = range.cloneRange();
      preRange.selectNodeContents(inputEl);
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
      selectedIndex = Math.min(
        selectedIndex + 1,
        getFilteredPrompts().length - 1,
      );
      highlightItem();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      highlightItem();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectCurrent();
      return;
    }

    if (e.key === "Escape") {
      hidePopup();
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
        selectedIndex = parseInt(item.dataset.index);
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
    if (sel && sel.rangeCount) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const popupHeight = popupEl.offsetHeight || 240;
      const popupWidth = popupEl.offsetWidth || 200;
      const margin = 4;

      // Vertical positioning: check if there is enough space below the cursor
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let topPosition = rect.bottom + margin;
      if (
        spaceBelow < popupHeight + margin &&
        spaceAbove > popupHeight + margin
      ) {
        // Position above the cursor
        topPosition = rect.top - popupHeight - margin;
      }

      // Horizontal positioning: keep popup within the screen bounds
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

  async function selectCurrent() {
    const filtered = getFilteredPrompts();
    const prompt = filtered[selectedIndex];
    if (!prompt) return;

    hidePopup();

    if (!cachedContents[prompt.name]) {
      try {
        const url = `http://127.0.0.1:${getPort()}/prompts/${encodeURIComponent(prompt.name)}`;
        const res = await gmFetch(url);
        if (res.ok) {
          const data = await res.json();
          cachedContents[prompt.name] = data.content || "";
        }
      } catch {
        return;
      }
    }

    const content = cachedContents[prompt.name];
    if (!content) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textBefore = range.startContainer.textContent.slice(
      0,
      range.startOffset,
    );
    const match = textBefore.match(/(?:^|\s)!(\w*)$/);

    if (!match) return;

    const fullMatch = match[0];
    const startOffset = range.startOffset - fullMatch.length;

    range.setStart(range.startContainer, startOffset);
    range.deleteContents();
    range.insertNode(document.createTextNode(content));
    range.collapse(false);

    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return { init, destroy };
}
