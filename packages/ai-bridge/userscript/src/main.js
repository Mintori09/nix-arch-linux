function detectPlatform() {
  const host = window.location.hostname;
  if (host.includes("gemini.google.com")) return GeminiAdapter;
  if (host.includes("chatgpt.com")) return null;
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

  const bridge = createBridgeController(adapter);

  // Wait for bridge (health check + dequeue)
  await bridge.init();

  // Init prompts module (fetches /prompts from daemon)
  const promptsPanel = createPromptTemplatesPanel(adapter);
  await promptsPanel.init();

  // Init autocomplete
  const autocomplete = createAutocomplete(adapter, () =>
    promptsPanel.getPromptList(),
  );
  autocomplete.init();

  // Init panel (pass prompts container to insert before turn list)
  const panel = createChatHistoryPanel(adapter, promptsPanel.getContainerEl());
  panel.init();
})();
