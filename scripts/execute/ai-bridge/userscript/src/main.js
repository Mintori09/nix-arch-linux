function detectPlatform() {
  const host = window.location.hostname;
  if (host.includes("gemini.google.com")) return GeminiAdapter;
  if (host.includes("chatgpt.com")) return null;
  if (host.includes("claude.ai")) return null;
  if (host.includes("chat.deepseek.com")) return null;
  return null;
}

(function () {
  const adapter = detectPlatform();
  if (!adapter) {
    console.warn("[ai-bridge] unsupported platform:", window.location.hostname);
    return;
  }

  const bridge = createBridgeController(adapter);
  const panel = createChatHistoryPanel(adapter);

  bridge.init().then(() => {
    panel.init();
  });
})();
