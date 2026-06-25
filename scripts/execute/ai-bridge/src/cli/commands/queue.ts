import { DAEMON_URL } from "../../config";

export async function cmdQueue() {
  const res = await fetch(`${DAEMON_URL}/queue`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function cmdClear() {
  const res = await fetch(`${DAEMON_URL}/queue`, { method: "DELETE" });
  const data = await res.json();
  console.log(JSON.stringify(data));
}
