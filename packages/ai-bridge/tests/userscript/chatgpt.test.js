// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";

// Mock GM_getValue
global.getSelectors = () => ({});
global.GM_getValue = vi.fn((key, def) => def);
global.GM_setValue = vi.fn();

// Load ChatGPTAdapter code
const chatgptAdapterPath = path.resolve(__dirname, "../../userscript/src/platforms/chatgpt.js");
const chatgptAdapterCode = fs.readFileSync(chatgptAdapterPath, "utf-8");

describe("ChatGPTAdapter", () => {
  let ChatGPTAdapter;

  beforeEach(() => {
    document.body.innerHTML = "";
    // Eval adapter in current JSDOM context
    const fn = new Function("getSelectors", "GM_getValue", `${chatgptAdapterCode}; return ChatGPTAdapter;`);
    ChatGPTAdapter = fn(global.getSelectors, global.GM_getValue);
  });

  describe("validateDOM & findInput", () => {
    it("detects #prompt-textarea", () => {
      document.body.innerHTML = '<textarea id="prompt-textarea"></textarea>';
      expect(ChatGPTAdapter.validateDOM()).toBe(true);
      expect(ChatGPTAdapter.findInput()).not.toBeNull();
      expect(ChatGPTAdapter.findInput().id).toBe("prompt-textarea");
    });

    it("detects mobile composer textarea (#mobile-composer-prompt)", () => {
      document.body.innerHTML = '<textarea id="mobile-composer-prompt" placeholder="Ask ChatGPT"></textarea>';
      expect(ChatGPTAdapter.validateDOM()).toBe(true);
      expect(ChatGPTAdapter.findInput()).not.toBeNull();
      expect(ChatGPTAdapter.findInput().id).toBe("mobile-composer-prompt");
    });

    it("detects ProseMirror contenteditable div", () => {
      document.body.innerHTML = '<div id="prompt-textarea" contenteditable="true" role="textbox" class="ProseMirror"></div>';
      expect(ChatGPTAdapter.validateDOM()).toBe(true);
      expect(ChatGPTAdapter.findInput()).not.toBeNull();
      expect(ChatGPTAdapter.findInput().tagName).toBe("DIV");
    });

    it("returns false and null when no input is present", () => {
      document.body.innerHTML = '<div class="other">No input here</div>';
      expect(ChatGPTAdapter.validateDOM()).toBe(false);
      expect(ChatGPTAdapter.findInput()).toBeNull();
    });
  });

  describe("findSendButton", () => {
    it("finds button[data-testid='send-button']", () => {
      document.body.innerHTML = '<button data-testid="send-button">Send</button>';
      const btn = ChatGPTAdapter.findSendButton();
      expect(btn).not.toBeNull();
      expect(btn.getAttribute("data-testid")).toBe("send-button");
    });

    it("finds button[data-composer-submit]", () => {
      document.body.innerHTML = '<button data-composer-submit="" aria-label="Send message">Send</button>';
      const btn = ChatGPTAdapter.findSendButton();
      expect(btn).not.toBeNull();
      expect(btn.getAttribute("aria-label")).toBe("Send message");
    });

    it("finds button[aria-label='Send message']", () => {
      document.body.innerHTML = '<button aria-label="Send message">Send</button>';
      const btn = ChatGPTAdapter.findSendButton();
      expect(btn).not.toBeNull();
    });

    it("skips disabled buttons when enabled candidate exists", () => {
      document.body.innerHTML = `
        <button data-testid="send-button" disabled>Send</button>
        <button aria-label="Send message">Send Enabled</button>
      `;
      const btn = ChatGPTAdapter.findSendButton();
      expect(btn).not.toBeNull();
      expect(btn.getAttribute("aria-label")).toBe("Send message");
    });
  });

  describe("fillInput", () => {
    it("fills textarea and triggers events", async () => {
      document.body.innerHTML = `
        <form>
          <textarea id="prompt-textarea"></textarea>
          <button data-testid="send-button">Send</button>
        </form>
      `;
      const input = document.getElementById("prompt-textarea");
      const button = document.querySelector('button');
      const clickSpy = vi.spyOn(button, "click");

      await ChatGPTAdapter.fillInput("Test prompt message");
      expect(input.value).toBe("Test prompt message");
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("Turns & Responses", () => {
    it("identifies turn role from data-message-author-role", () => {
      document.body.innerHTML = `
        <article data-testid="conversation-turn-2" data-message-author-role="user">
          <div class="user-message">User Query</div>
        </article>
        <article data-testid="conversation-turn-3" data-message-author-role="assistant">
          <div class="markdown prose">Assistant Answer</div>
        </article>
      `;
      const turns = document.querySelectorAll('article');
      expect(ChatGPTAdapter.getTurnName(turns[0])).toBe("User");
      expect(ChatGPTAdapter.getTurnName(turns[1])).toBe("ChatGPT");
      expect(ChatGPTAdapter.getResponseText(turns[1])).toBe("Assistant Answer");
    });

    it("returns correct HTML element for turn response", () => {
      document.body.innerHTML = `
        <article data-testid="conversation-turn-3" data-message-author-role="assistant">
          <div class="markdown prose"><p>Paragraph 1</p></div>
        </article>
      `;
      const turn = document.querySelector('article');
      const el = ChatGPTAdapter.getResponseHTMLElement(turn);
      expect(el.classList.contains("markdown")).toBe(true);
    });
  });

  describe("Chat Navigator default visibility", () => {
    it("has defaultHideNavigator enabled", () => {
      expect(ChatGPTAdapter.defaultHideNavigator).toBe(true);
    });

    it("initializes panel in hidden state when defaultHideNavigator is true", () => {
      const panelPath = path.resolve(__dirname, "../../userscript/src/core/panel.js");
      const panelCode = fs.readFileSync(panelPath, "utf-8");
      const panelCSS = "";
      const ttPolicy = null;
      const htmlToMarkdown = () => "";
      const fn = new Function(
        "adapter",
        "panelCSS",
        "ttPolicy",
        "htmlToMarkdown",
        `${panelCode}; return createChatHistoryPanel(adapter);`
      );
      const panel = fn(ChatGPTAdapter, panelCSS, ttPolicy, htmlToMarkdown);
      panel.init();

      const panelContainer = document.getElementById("ai-bridge-inserted-panel");
      const toggleBtn = document.getElementById("ai-bridge-toggle-navbar-btn");

      expect(panelContainer).not.toBeNull();
      expect(panelContainer.classList.contains("sidebar-hidden")).toBe(true);
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn.classList.contains("btn-collapsed")).toBe(true);
    });
  });

  describe("Form submission reload prevention", () => {
    it("prevents default submit event on form submission", () => {
      document.body.innerHTML = `
        <form id="chat-form">
          <textarea id="prompt-textarea"></textarea>
          <button type="submit">Submit</button>
        </form>
      `;
      ChatGPTAdapter.init();

      const form = document.getElementById("chat-form");
      const event = new Event("submit", { bubbles: true, cancelable: true });
      const dispatched = form.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(dispatched).toBe(false);
    });
  });

  describe("Autocomplete insertion in textarea", () => {
    it("replaces !prompt query in textarea upon Enter completion", () => {
      const autocompletePath = path.resolve(__dirname, "../../userscript/src/core/autocomplete.js");
      const autocompleteCode = fs.readFileSync(autocompletePath, "utf-8");
      document.body.innerHTML = '<textarea id="prompt-textarea">Hello !sum</textarea>';
      const textarea = document.getElementById("prompt-textarea");
      textarea.selectionStart = 10;
      textarea.selectionEnd = 10;

      const prompts = [{ name: "summarize.md", title: "summarize", content: "Summarize this:" }];
      const fn = new Function(
        "adapter",
        "getPromptList",
        `${autocompleteCode}; return createAutocomplete(adapter, getPromptList);`
      );
      const ac = fn(ChatGPTAdapter, () => prompts);
      ac.init();

      // Trigger completion directly
      ac.insertCompletion("Summarize this:");
      expect(textarea.value).toBe("Hello Summarize this:");
      ac.destroy();
    });

    it("intercepts Enter keydown and does not trigger send button when popup is active", () => {
      const autocompletePath = path.resolve(__dirname, "../../userscript/src/core/autocomplete.js");
      const autocompleteCode = fs.readFileSync(autocompletePath, "utf-8");
      document.body.innerHTML = `
        <form>
          <textarea id="prompt-textarea">Hello !sum</textarea>
          <button data-testid="send-button">Send</button>
        </form>
      `;
      const textarea = document.getElementById("prompt-textarea");
      textarea.selectionStart = 10;
      textarea.selectionEnd = 10;
      const sendBtn = document.querySelector("button");
      const sendSpy = vi.spyOn(sendBtn, "click");

      const prompts = [{ name: "summarize.md", title: "summarize", content: "Summarize this:" }];
      const fn = new Function(
        "adapter",
        "getPromptList",
        `${autocompleteCode}; return createAutocomplete(adapter, getPromptList);`
      );
      const ac = fn(ChatGPTAdapter, () => prompts);
      ac.init();

      // Trigger popup
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent("keyup", { key: "m", bubbles: true }));

      const popup = document.getElementById("ai-bridge-autocomplete-popup");
      expect(popup.style.display).toBe("block");

      // Press Enter keydown
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(enterEvent);

      expect(enterEvent.defaultPrevented).toBe(true);
      expect(sendSpy).not.toHaveBeenCalled();
      expect(textarea.value).toBe("Hello Summarize this:");
      expect(popup.style.display).toBe("none");

      ac.destroy();
    });
  });
});
