import { DAEMON_URL } from "../../config";

export async function cmdFocus() {
  const res = await fetch(`${DAEMON_URL}/focus`, { method: "POST" });
  const data = await res.json();
  console.log(JSON.stringify(data));
}
