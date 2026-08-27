import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, ROOT } from "../config/env.js";
import { loadFrontHtml, loadBackHtml, loadCss, SEPARATOR } from "./template.js";
import type { InputDeckItem } from "./generator.js";
import { watchFiles, type WatcherHandle } from "../utils/watcher.js";

export interface PreviewServerOptions {
  port?: number;
  openBrowser?: boolean;
}

export function renderCardHtml(
  frontHtml: string,
  backHtml: string,
  css: string,
  fieldNames: readonly string[],
  cardFields: Record<string, string>,
): { front: string; back: string } {
  let renderedFront = frontHtml;
  let renderedBack = backHtml;

  for (const name of fieldNames) {
    const val = cardFields[name] ?? "";
    const reg = new RegExp(`{{${name}}}`, "g");
    const sectionReg = new RegExp(`{{#${name}}}([\\s\\S]*?){{/${name}}}`, "g");

    if (val && val.trim().length > 0) {
      renderedFront = renderedFront.replace(sectionReg, "$1");
      renderedBack = renderedBack.replace(sectionReg, "$1");
    } else {
      renderedFront = renderedFront.replace(sectionReg, "");
      renderedBack = renderedBack.replace(sectionReg, "");
    }

    renderedFront = renderedFront.replace(reg, val);
    renderedBack = renderedBack.replace(reg, val);
  }

  // Handle any remaining unreplaced field placeholders
  renderedFront = renderedFront.replace(/{{[#^/]?\w+}}/g, "");
  renderedBack = renderedBack.replace(/{{[#^/]?\w+}}/g, "");

  return {
    front: renderedFront,
    back: renderedBack,
  };
}

export function buildPreviewAppHtml(items: InputDeckItem[]): string {
  // Aggregate card information
  const cardsPayload = items.flatMap((item, itemIdx) => {
    const templateName = item.parser.getTemplateName();
    const fieldNames = item.parser.getFieldNames();
    const frontTemplate = loadFrontHtml(templateName);
    const backTemplate = loadBackHtml(templateName);
    const css = loadCss(templateName);

    return item.parsedResult.cards.map((card, cardIdx) => {
      const { front, back } = renderCardHtml(
        frontTemplate,
        backTemplate,
        css,
        fieldNames,
        card.fields,
      );
      return {
        deckName: item.deckName,
        cardIndex: cardIdx + 1,
        css,
        front,
        back,
      };
    });
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Anki Flashcard Previewer</title>
  <style>
    :root {
      --app-bg: #0f172a;
      --app-card-bg: #1e293b;
      --app-text: #f8fafc;
      --app-accent: #38bdf8;
      --app-border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--app-bg);
      color: var(--app-text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--app-card-bg);
      border-bottom: 1px solid var(--app-border);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--app-accent);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .deck-badge {
      background: #0284c7;
      color: #fff;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    button.btn {
      background: #334155;
      color: #f8fafc;
      border: 1px solid #475569;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button.btn:hover {
      background: #475569;
      border-color: #64748b;
    }
    button.btn-primary {
      background: #0284c7;
      border-color: #0369a1;
    }
    button.btn-primary:hover {
      background: #0369a1;
    }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
      max-width: 900px;
      width: 100%;
      margin: 0 auto;
    }
    .preview-container {
      width: 100%;
      background: #ffffff;
      color: #111827;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      padding: 24px;
      min-height: 380px;
      position: relative;
    }
    .card-side-label {
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.05em;
    }
    .card-indicator {
      font-size: 0.9rem;
      color: #94a3b8;
    }
    .shortcuts-help {
      margin-top: 24px;
      font-size: 0.8rem;
      color: #64748b;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .kbd {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
  </style>
  <style id="dynamic-card-css"></style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🎴 Anki Live Preview</span>
      <span class="deck-badge" id="deck-name-badge">Deck</span>
    </div>
    <div class="controls">
      <button class="btn" id="prev-btn">← Prev</button>
      <span class="card-indicator" id="card-counter">Card 1 / 1</span>
      <button class="btn" id="next-btn">Next →</button>
      <button class="btn btn-primary" id="flip-btn">Flip (Space)</button>
    </div>
  </header>

  <main>
    <div class="preview-container">
      <div class="card-side-label" id="side-label">Front</div>
      <div id="card-render-root"></div>
    </div>

    <div class="shortcuts-help">
      <span><span class="kbd">Space</span> Flip Card</span>
      <span><span class="kbd">←</span> / <span class="kbd">A</span> Prev Card</span>
      <span><span class="kbd">→</span> / <span class="kbd">D</span> Next Card</span>
      <span><span class="kbd">F</span> Flip Side</span>
    </div>
  </main>

  <script>
    const CARDS = ${JSON.stringify(cardsPayload)};
    let currentIndex = 0;
    let isFlipped = false;

    // Restore index from sessionStorage
    try {
      const saved = sessionStorage.getItem("anki_preview_idx");
      if (saved !== null) currentIndex = parseInt(saved, 10) || 0;
      if (currentIndex >= CARDS.length) currentIndex = 0;
    } catch(e) {}

    const dynamicCss = document.getElementById("dynamic-card-css");
    const renderRoot = document.getElementById("card-render-root");
    const sideLabel = document.getElementById("side-label");
    const cardCounter = document.getElementById("card-counter");
    const deckBadge = document.getElementById("deck-name-badge");

    function renderCurrentCard() {
      if (CARDS.length === 0) {
        renderRoot.innerHTML = "<p>No cards available.</p>";
        return;
      }
      const card = CARDS[currentIndex];
      deckBadge.textContent = card.deckName;
      cardCounter.textContent = \`Card \${currentIndex + 1} / \${CARDS.length}\`;
      dynamicCss.innerHTML = card.css;

      if (!isFlipped) {
        sideLabel.textContent = "FRONT";
        renderRoot.innerHTML = card.front;
      } else {
        sideLabel.textContent = "BACK";
        renderRoot.innerHTML = card.back;
      }

      // Re-run embedded scripts in the card template
      const scripts = renderRoot.querySelectorAll("script");
      scripts.forEach(s => {
        const newScript = document.createElement("script");
        newScript.text = s.innerHTML;
        document.body.appendChild(newScript).parentNode.removeChild(newScript);
      });

      try {
        sessionStorage.setItem("anki_preview_idx", currentIndex.toString());
      } catch(e) {}
    }

    function flip() {
      isFlipped = !isFlipped;
      renderCurrentCard();
    }

    function next() {
      if (currentIndex < CARDS.length - 1) {
        currentIndex++;
        isFlipped = false;
        renderCurrentCard();
      }
    }

    function prev() {
      if (currentIndex > 0) {
        currentIndex--;
        isFlipped = false;
        renderCurrentCard();
      }
    }

    document.getElementById("flip-btn").addEventListener("click", flip);
    document.getElementById("next-btn").addEventListener("click", next);
    document.getElementById("prev-btn").addEventListener("click", prev);

    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === " " || e.key === "f" || e.key === "F") {
        e.preventDefault();
        flip();
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        prev();
      }
    });

    renderCurrentCard();

    // SSE Live Reload listener
    const evtSource = new EventSource("/events");
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "reload") {
          window.location.reload();
        }
      } catch(e) {}
    };
  </script>
</body>
</html>`;
}

export function startPreviewServer(
  getItems: () => Promise<InputDeckItem[]>,
  watchedPaths: string[],
  initialPort = 3000,
): Promise<{ server: http.Server; port: number; stop: () => void }> {
  return new Promise((resolve, reject) => {
    let sseClients: http.ServerResponse[] = [];

    const watcher = watchFiles(
      watchedPaths,
      () => {
        console.log("File change detected. Reloading preview...");
        for (const client of sseClients) {
          try {
            client.write(`data: ${JSON.stringify({ type: "reload" })}\n\n`);
          } catch (_) {}
        }
      },
      300,
    );

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);

      if (url.pathname === "/") {
        try {
          const items = await getItems();
          const html = buildPreviewAppHtml(items);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h1>Compilation Error</h1><pre>${err?.message || err}</pre>`);
        }
        return;
      }

      if (url.pathname === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        sseClients.push(res);
        req.on("close", () => {
          sseClients = sseClients.filter((c) => c !== res);
        });
        return;
      }

      if (url.pathname.startsWith("/media/")) {
        const mediaFileName = decodeURIComponent(url.pathname.replace("/media/", ""));
        const mediaFilePath = path.join(MEDIA_DIR, mediaFileName);
        if (fs.existsSync(mediaFilePath)) {
          const ext = path.extname(mediaFilePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".svg": "image/svg+xml",
          };
          const contentType = mimeTypes[ext] || "application/octet-stream";
          res.writeHead(200, { "Content-Type": contentType });
          fs.createReadStream(mediaFilePath).pipe(res);
          return;
        }
        res.writeHead(404);
        res.end("Media not found");
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    const tryListen = (port: number) => {
      server.listen(port, () => {
        console.log(`\n🚀 Anki Preview Server running at: http://localhost:${port}\n`);
        resolve({
          server,
          port,
          stop: () => {
            watcher.stop();
            sseClients.forEach((c) => c.end());
            server.close();
          },
        });
      });

      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          tryListen(port + 1);
        } else {
          reject(err);
        }
      });
    };

    tryListen(initialPort);
  });
}
