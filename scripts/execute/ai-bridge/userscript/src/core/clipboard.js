document.addEventListener("keydown", async (e) => {
  if (e.altKey && e.key === "x") {
    e.preventDefault();
    try {
      const res = await gmFetch(`http://127.0.0.1:${getPort()}/clipboard`);
      const data = await res.json();
      if (data.text && data.text.length > 0) {
        const platform = detectPlatform();
        if (platform) {
          await platform.fillInput(data.text);
          if (!e.shiftKey) {
            platform.clickSend();
          }
        }
      }
    } catch (err) {
      console.warn("[ai-bridge] clipboard fetch failed:", err);
    }
  }
});
