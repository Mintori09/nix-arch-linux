import { startServer } from "../../daemon/server";
import { getProcessUsingPort } from "../../utils";
import { DAEMON_URL, DAEMON_PORT } from "../../config";

export async function cmdServer() {
  try {
    const res = await fetch(`${DAEMON_URL}/health`);
    if (res.ok) {
      console.error("ai-bridge already running");
      const processUsing = await getProcessUsingPort(58721);
      console.log(DAEMON_URL, "\n", processUsing);
      process.exit(1);
    }
  } catch {}

  const { port } = await startServer(parseInt(DAEMON_PORT, 10));
  console.log(`ai-bridge daemon listening on 127.0.0.1:${port}`);
}

export async function cmdStop() {
  try {
    await fetch(`${DAEMON_URL}/shutdown`, { method: "POST" });
  } catch {}

  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      await fetch(`${DAEMON_URL}/health`);
    } catch {
      console.log("ai-bridge stopped");
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  console.error("ai-bridge failed to stop (timeout)");
  process.exit(1);
}
