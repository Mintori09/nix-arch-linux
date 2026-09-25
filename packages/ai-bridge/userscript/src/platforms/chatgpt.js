const ChatGPTAdapter = {
  INPUT_SELECTORS: [
    '#prompt-textarea',
    '#mobile-composer-prompt',
    'div[contenteditable="true"]#prompt-textarea',
    'div.ProseMirror#prompt-textarea',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea#prompt-textarea',
    'textarea#mobile-composer-prompt',
    'textarea[name="prompt-textarea"]',
    'textarea[name="prompt"]',
    'textarea[placeholder*="ChatGPT"]',
    'textarea[aria-label*="ChatGPT"]',
    'textarea',
  ],
  SEND_SELECTORS: [
    'button[data-testid="send-button"]',
    'button[data-testid="fruitjuice-send-button"]',
    'button[data-composer-submit]',
    'button.composer-submit-button-color',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="Gửi"]',
    'button[aria-label*="gửi"]',
    'form button[type="submit"]',
    'form[data-type="unified-composer"] button[type="button"]:has(svg)',
    'button:has(svg path[d*="M14.8974"])',
    'button:has(svg path[d*="M.5 1.5"])',
    'form button:has(svg)',
  ],
  TURN_SELECTORS: [
    'article[data-testid^="conversation-turn-"]',
    'div[data-testid^="conversation-turn-"]',
    'article:has([data-message-author-role])',
    '[data-message-author-role]',
    'article',
  ],
  defaultHideNavigator: true,

  init() {
    // Intercept form submit event in capturing phase to prevent full page reloads
    document.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();
      },
      true,
    );
  },

  validateDOM() {
    for (const sel of this.INPUT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) {
        console.log("[ai-bridge] [chatgpt] validateDOM: found with", sel);
        return true;
      }
    }
    console.warn(
      "[ai-bridge] [chatgpt] validateDOM: no input found — selectors:",
      this.INPUT_SELECTORS,
    );
    return false;
  },

  findInput() {
    const userSelectors = getSelectors().inputSelectors;
    const selectors = userSelectors || this.INPUT_SELECTORS;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        console.log("[ai-bridge] [chatgpt] findInput: trying", sel, "→ found");
        return el;
      }
    }
    return null;
  },

  findSendButton() {
    const userSelectors = getSelectors().sendSelectors;
    const selectors = userSelectors || this.SEND_SELECTORS;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && !el.disabled) {
        console.log(
          "[ai-bridge] [chatgpt] findSendButton: trying",
          sel,
          "→ found",
        );
        return el;
      }
    }
    // Fallback: search any matching button even if currently marked or inside form
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  },

  async fillInput(text) {
    const input = this.findInput();
    if (!input) {
      console.warn(
        "[ai-bridge] [chatgpt] fillInput: no input element, text:",
        text.slice(0, 60),
      );
      return;
    }
    console.log(
      "[ai-bridge] [chatgpt] fillInput: text=" +
        text.slice(0, 60) +
        ", input=" +
        (input.tagName || "?"),
    );
    input.focus();

    if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Contenteditable (ProseMirror)
      // Clear placeholder if present
      const isPlaceholder = input.querySelector(
        ".placeholder, [data-empty-paragraph], [data-placeholder]",
      );
      if (isPlaceholder) {
        input.textContent = "";
      }

      // Try execCommand first (best for ProseMirror / undo stack)
      const success = document.execCommand("insertText", false, text);
      if (!success || !input.textContent.trim()) {
        input.textContent = text;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    await new Promise((r) => setTimeout(r, 150));
    const sendBtn = this.findSendButton();
    console.log(
      "[ai-bridge] [chatgpt] fillInput: sendBtn",
      sendBtn ? "found, clicking" : "not found, sending Enter key",
    );
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  },

  clickSend() {
    const btn = this.findSendButton();
    console.log(
      "[ai-bridge] [chatgpt] clickSend: button",
      btn ? "found, clicking" : "not found",
    );
    if (btn) btn.click();
  },

  getTurnName(turnEl) {
    const roleAttr =
      turnEl.getAttribute("data-message-author-role") ||
      turnEl
        .querySelector("[data-message-author-role]")
        ?.getAttribute("data-message-author-role");
    if (roleAttr === "user") return "User";
    if (roleAttr === "assistant") return "ChatGPT";

    const authorEl = turnEl.querySelector(
      '[data-testid="author-name"], h5, h6',
    );
    if (authorEl) {
      const text = authorEl.textContent.trim();
      if (/you|bạn/i.test(text)) return "User";
      if (/chatgpt|gpt|ai/i.test(text)) return "ChatGPT";
    }

    if (
      turnEl.classList.contains("turn-user") ||
      turnEl.querySelector('.user-message, [data-testid*="user"]')
    ) {
      return "User";
    }

    return "ChatGPT";
  },

  getResponseText(turnEl) {
    const contentEl = turnEl.querySelector(
      '.markdown, .prose, [data-message-author-role] .markdown, div[class*="markdown"], .whitespace-pre-wrap',
    );
    const text = contentEl
      ? contentEl.textContent.trim()
      : turnEl.textContent.trim();
    console.log("[ai-bridge] [chatgpt] getResponseText: length", text.length);
    return text;
  },

  getResponseHTMLElement(turnEl) {
    const contentEl = turnEl.querySelector(
      '.markdown, .prose, [data-message-author-role] .markdown, div[class*="markdown"], .whitespace-pre-wrap',
    );
    const result = contentEl || turnEl;
    console.log(
      "[ai-bridge] [chatgpt] getResponseHTMLElement: returning",
      result.tagName,
    );
    return result;
  },

  getTurnSelector(index) {
    const sel = `${this.TURN_SELECTORS.join(", ")}:nth-child(${index + 1})`;
    return sel;
  },
};
