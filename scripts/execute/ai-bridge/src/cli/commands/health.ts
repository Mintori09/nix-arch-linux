import { DAEMON_URL } from "../../config";

export async function cmdHealth() {
  try {
    const res = await fetch(`${DAEMON_URL}/health`);
    const data = await res.json();
    console.log(JSON.stringify(data));
  } catch {
    console.error("Daemon not running");
    process.exit(1);
  }
}
