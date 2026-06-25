import { DAEMON_URL } from "../../config";

export async function cmdEnqueue(text: string, title?: string, ttl?: number) {
  const res = await fetch(`${DAEMON_URL}/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, title, ttl }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(data.error ?? "Request failed");
    process.exit(1);
  }
  console.log(JSON.stringify(data));
}
