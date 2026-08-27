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
