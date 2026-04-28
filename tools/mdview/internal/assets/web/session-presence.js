const DEFAULT_HEARTBEAT_MS = 30_000;

export function createSessionPresence({
  clientId = createClientId(),
  token = "",
  endpoint = "/api/session/presence",
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  navigatorImpl = globalThis.navigator,
  documentImpl = globalThis.document,
  windowImpl = globalThis.window,
  setIntervalImpl = globalThis.setInterval?.bind(globalThis),
  clearIntervalImpl = globalThis.clearInterval?.bind(globalThis),
} = {}) {
  const url = buildPresenceURL(endpoint, token);
  let started = false;
  let intervalId = null;

  async function announce(state) {
    if (typeof fetchImpl !== "function") {
      return;
    }
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, state }),
      keepalive: state === "closing",
    });
    if (!response.ok) {
      throw new Error(`presence ${state} failed`);
    }
  }

  async function handleVisibilityChange() {
    if (documentImpl?.visibilityState === "visible") {
      await announce("active");
    }
  }

  function handlePageHide() {
    const payload = JSON.stringify({ client_id: clientId, state: "closing" });
    if (typeof navigatorImpl?.sendBeacon === "function") {
      if (navigatorImpl.sendBeacon(url, payload)) {
        return;
      }
    }
    void announce("closing");
  }

  async function start() {
    if (started) {
      return;
    }
    started = true;
    await announce("active");
    documentImpl?.addEventListener?.("visibilitychange", handleVisibilityChange);
    windowImpl?.addEventListener?.("pagehide", handlePageHide);
    intervalId = setIntervalImpl?.(() => announce("active"), heartbeatMs) ?? null;
  }

  function stop() {
    if (!started) {
      return;
    }
    started = false;
    if (intervalId !== null) {
      clearIntervalImpl?.(intervalId);
      intervalId = null;
    }
    documentImpl?.removeEventListener?.("visibilitychange", handleVisibilityChange);
    windowImpl?.removeEventListener?.("pagehide", handlePageHide);
  }

  return {
    clientId,
    start,
    stop,
  };
}

export function buildPresenceURL(endpoint, token) {
  if (!token) {
    return endpoint;
  }
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}token=${encodeURIComponent(token)}`;
}

function createClientId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `client-${Math.random().toString(16).slice(2)}`;
}
