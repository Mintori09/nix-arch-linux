import { DAEMON_URL } from "../../config";

export async function cmdStats() {
  const res = await fetch(`${DAEMON_URL}/stats`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
