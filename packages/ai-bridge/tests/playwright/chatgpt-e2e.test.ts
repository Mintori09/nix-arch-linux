import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, Page } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const userscriptPath = path.resolve(__dirname, "../../dist/ai-bridge.user.js");
let userscriptContent = "";

describe("Playwright E2E ChatGPT Userscript Test", () => {
  let server: http.Server;
  let serverUrl: string;
  let browser: Browser;

  beforeAll(async () => {
    userscriptContent = fs.readFileSync(userscriptPath, "utf-8");
    // 1. Create a mock ChatGPT HTML server
    server = http.createServer((req, res) => {
      if (req.url === "/prompts") {
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify([
          { name: "summarize.md", title: "summarize", content: "Summarize this text:" },
          { name: "translate-vi.md", title: "translate-vi", content: "Dịch sang tiếng Việt:" }
        ]));
        return;
      }
      if (req.url?.startsWith("/prompts/")) {
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ content: "Summarize this text:" }));
        return;
      }
      if (req.url === "/dequeue") {
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ text: null }));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <meta charset="utf-8">
          <title>ChatGPT Mock</title>
          <style>
            :root {
              --text-primary: #f0f0f0;
              --bg-primary: #121212;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: sans-serif;
              background-color: var(--bg-primary);
              color: var(--text-primary);
            }
            #app {
              display: flex;
              flex-direction: column;
              height: 100vh;
            }
            .chat-history {
              flex: 1;
              overflow-y: auto;
              padding: 20px;
            }
            .composer-container {
              padding: 16px;
              border-top: 1px solid #333;
            }
            form {
              display: flex;
              gap: 8px;
            }
            textarea {
              flex: 1;
              height: 48px;
              background: #222;
              color: #fff;
              border: 1px solid #444;
              border-radius: 8px;
              padding: 8px;
            }
            button {
              padding: 8px 16px;
              background: #0084ff;
              color: #fff;
              border: none;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <div id="app">
            <div class="chat-history">
              <article data-testid="conversation-turn-2" data-message-author-role="user">
                <div class="whitespace-pre-wrap">Hello ChatGPT!</div>
              </article>
              <article data-testid="conversation-turn-3" data-message-author-role="assistant">
                <div class="markdown prose"><p>Hello! How can I help you today?</p></div>
              </article>
            </div>
            <div class="composer-container">
              <form id="composer-form">
                <textarea id="prompt-textarea" placeholder="Message ChatGPT..."></textarea>
                <button type="submit" data-testid="send-button">Send</button>
              </form>
            </div>
          </div>
          <div id="portal-root">Portal Root Node</div>
        </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  it("loads ChatGPT mock page and verifies userscript behavior", async () => {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const serverPort = (server.address() as any).port;

    // Provide userscript mocks (GM_xmlhttpRequest, GM_getValue) and mock platform
    await page.addInitScript((port) => {
      (window as any).__AI_BRIDGE_FORCE_PLATFORM__ = "chatgpt";
      (window as any).GM_getValue = (k: string, def: any) => {
        if (k === "ai_bridge_port") return port;
        return def;
      };
      (window as any).GM_setValue = () => {};
      (window as any).GM_xmlhttpRequest = (opts: any) => {
        fetch(opts.url, { method: opts.method, body: opts.data })
          .then(async (res) => {
            const text = await res.text();
            let parsed = text;
            try { parsed = JSON.parse(text); } catch {}
            if (opts.onload) opts.onload({ status: res.status, responseText: text, response: parsed });
          })
          .catch((err) => {
            if (opts.onerror) opts.onerror(err);
          });
      };
    }, serverPort);

    await page.goto(serverUrl);

    // Execute userscript
    await page.evaluate(userscriptContent);
    await page.waitForSelector("#ai-bridge-inserted-panel", { state: "attached" });

    // 1. Verify document.body children are NOT reparented (app and portal-root remain direct children of body)
    const isAppDirectChild = await page.evaluate(() => {
      const app = document.getElementById("app");
      return app?.parentElement === document.body;
    });
    expect(isAppDirectChild).toBe(true);

    const isPortalDirectChild = await page.evaluate(() => {
      const portal = document.getElementById("portal-root");
      return portal?.parentElement === document.body;
    });
    expect(isPortalDirectChild).toBe(true);

    // 2. Verify Chat Navigator panel is initialized in hidden state on ChatGPT
    const isPanelHidden = await page.evaluate(() => {
      const panel = document.getElementById("ai-bridge-inserted-panel");
      return panel?.classList.contains("sidebar-hidden");
    });
    expect(isPanelHidden).toBe(true);

    const isToggleCollapsed = await page.evaluate(() => {
      const btn = document.getElementById("ai-bridge-toggle-navbar-btn");
      return btn?.classList.contains("btn-collapsed");
    });
    expect(isToggleCollapsed).toBe(true);

    // 3. Verify CSS variable isolation (:root --text-primary is unchanged)
    const hostTextPrimary = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim();
    });
    expect(hostTextPrimary).toBe("#f0f0f0");

    // 4. Test Autocomplete typing !sum and pressing Enter
    const textarea = page.locator("#prompt-textarea");
    await textarea.focus();
    await textarea.fill("Hello !sum");

    // Dispatch input to trigger autocomplete popup
    await page.evaluate(() => {
      const ta = document.getElementById("prompt-textarea") as HTMLTextAreaElement;
      ta.selectionStart = ta.value.length;
      ta.selectionEnd = ta.value.length;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new KeyboardEvent("keyup", { key: "m", bubbles: true }));
    });

    const isPopupVisible = await page.evaluate(() => {
      const popup = document.getElementById("ai-bridge-autocomplete-popup");
      return popup && popup.style.display === "block";
    });
    expect(isPopupVisible).toBe(true);

    // Track if form submit was triggered
    let formSubmitted = false;
    await page.exposeFunction("__onFormSubmit", () => {
      formSubmitted = true;
    });
    await page.evaluate(() => {
      document.getElementById("composer-form")?.addEventListener("submit", () => {
        (window as any).__onFormSubmit();
      });
    });

    // Focus and press Enter to complete prompt template
    await textarea.focus();
    await page.keyboard.press("Enter");

    // Verify textarea content was replaced with template content
    await page.waitForFunction(() => {
      const ta = document.getElementById("prompt-textarea") as HTMLTextAreaElement;
      return ta.value.includes("Summarize this text:");
    });

    const finalVal = await textarea.inputValue();
    expect(finalVal).toBe("Hello Summarize this text:");
    expect(formSubmitted).toBe(false);

    // Verify popup is hidden
    const isPopupHidden = await page.evaluate(() => {
      const popup = document.getElementById("ai-bridge-autocomplete-popup");
      return popup && popup.style.display === "none";
    });
    expect(isPopupHidden).toBe(true);

    // 5. Test normal Enter does NOT reload the page
    let navigationOccurred = false;
    page.on("framenavigated", () => {
      navigationOccurred = true;
    });

    await textarea.fill("My new message");
    await textarea.press("Enter");

    await page.waitForTimeout(300);
    expect(navigationOccurred).toBe(false);

    // 6. Test opening the Chat Navigator panel
    const toggleBtn = page.locator("#ai-bridge-toggle-navbar-btn");
    await toggleBtn.click();

    const isPanelOpen = await page.evaluate(() => {
      const panel = document.getElementById("ai-bridge-inserted-panel");
      return !panel?.classList.contains("sidebar-hidden");
    });
    expect(isPanelOpen).toBe(true);

    // 7. Verify turns are rendered in Navigator without duplicates
    const turnItems = page.locator("#ai-bridge-panel-list .turn-item");
    expect(await turnItems.count()).toBe(2);

    // 8. Test clicking turn item scroll & highlight
    await turnItems.first().click();

    expect(consoleErrors).toHaveLength(0);
    await page.close();
  }, 15000);
});
