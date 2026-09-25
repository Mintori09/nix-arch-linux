function detectPlatform() {
  if (typeof window !== "undefined" && window.__AI_BRIDGE_FORCE_PLATFORM__ === "chatgpt") return ChatGPTAdapter;
  if (typeof window !== "undefined" && window.__AI_BRIDGE_FORCE_PLATFORM__ === "gemini") return GeminiAdapter;
  const host = window.location.hostname;
  if (host.includes("gemini.google.com")) return GeminiAdapter;
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return ChatGPTAdapter;
  if (host.includes("claude.ai")) return null;
  if (host.includes("chat.deepseek.com")) return null;
  return null;
}

(async function () {
  const adapter = detectPlatform();
  if (!adapter) {
    console.warn("[ai-bridge] unsupported platform:", window.location.hostname);
    return;
  }

  if (typeof adapter.init === "function") {
    adapter.init();
  }

  const bridge = createBridgeController(adapter);

  // Wait for bridge (health check + dequeue)
  await bridge.init();

  // Init prompts module (fetches /prompts from daemon)
  const promptsPanel = createPromptTemplatesPanel(adapter);
  await promptsPanel.init();

  // Init autocomplete (!prompt template completion in input)
  const autocomplete = createAutocomplete(adapter, () =>
    promptsPanel.getPromptList(),
  );
  autocomplete.init();

  // Init panel only if adapter supports turn navigation / sidebar
  if (adapter.TURN_SELECTORS) {
    const panel = createChatHistoryPanel(adapter, promptsPanel.getContainerEl());
    panel.init();
  }
})();
