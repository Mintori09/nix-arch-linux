import { DAEMON_URL } from "../../config";

export async function cmdStatus(id: string) {
  const res = await fetch(`${DAEMON_URL}/status/${id}`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
