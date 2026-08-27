function createBridgeController(adapter) {
  const DAEMON_URL = () => `http://127.0.0.1:${getPort()}`;
  let isSubmitting = false;

  async function healthCheck() {
    try {
      const res = await gmFetch(`${DAEMON_URL()}/health`);
      console.log("[ai-bridge] healthCheck:", res.ok, DAEMON_URL());
      return res.ok;
    } catch (err) {
      console.warn("[ai-bridge] healthCheck failed:", err);
      return false;
    }
  }

  async function dequeue() {
    if (isSubmitting) {
      console.log("[ai-bridge] dequeue skipped: currently submitting");
      return false;
    }

    console.log("[ai-bridge] executing dequeue fetch...");
    try {
      const res = await gmFetch(`${DAEMON_URL()}/dequeue`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      if (data && data.title) {
        adapter._downloadTitle = data.title;
      }
      if (data && data.text && data.text.length > 0) {
        console.log("[ai-bridge] dequeue received:", data.text.slice(0, 60));
        isSubmitting = true;
        try {
          await adapter.fillInput(data.text);
          return true; // Fetch và điền dữ liệu thành công
        } catch (fillErr) {
          console.error("[ai-bridge] adapter.fillInput failed:", fillErr);
          return false;
        } finally {
          isSubmitting = false;
        }
      } else {
        console.log("[ai-bridge] dequeue empty");
        return false;
      }
    } catch (err) {
      console.warn("[ai-bridge] dequeue failed:", err);
      return false;
    }
  }

  function waitForInput(timeout = 10000) {
    const start = Date.now();
    return new Promise((resolve) => {
      let resolved = false;

      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        if (observer) observer.disconnect();
        clearTimeout(timerId);
        resolve();
      };

      const check = () => {
        if (adapter.validateDOM()) {
          console.log(
            "[ai-bridge] input field found via polling after",
            Date.now() - start,
            "ms",
          );
          safeResolve();
          return;
        }
        if (Date.now() - start > timeout) {
          console.warn(
            "[ai-bridge] hydration wait timeout after",
            timeout,
            "ms",
          );
          safeResolve();
          return;
        }
        timerId = setTimeout(check, 100);
      };

      let timerId = setTimeout(check, 100);
      let observer = null;

      if (document.body) {
        observer = new MutationObserver(() => {
          if (adapter.validateDOM()) {
            console.log("[ai-bridge] input field found via Observer");
            safeResolve();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  async function init() {
    console.log("[ai-bridge] init start");

    const ok = await healthCheck();
    if (!ok) {
      console.warn("[ai-bridge] daemon not reachable — skipping bridge init");
      return;
    }

    console.log("[ai-bridge] daemon reachable, waiting for input field...");
    await waitForInput();

    console.log("[ai-bridge] input field ready, triggering fetch sequence...");

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[ai-bridge] Fetch attempt ${attempt}/${maxRetries}`);
      const success = await dequeue();

      if (success) {
        console.log("[ai-bridge] Fetch and submit completed successfully.");
        break;
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    console.log("[ai-bridge] init done");
  }

  return { init, dequeue, healthCheck };
}
