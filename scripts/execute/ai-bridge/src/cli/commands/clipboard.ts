import { DAEMON_URL } from "../../config";

export async function cmdClipboard(opts: {
  pasteOnly?: boolean;
  title?: string;
  ttl?: number;
}) {
  if (opts.pasteOnly) {
    const res = await fetch(`${DAEMON_URL}/clipboard`);
    const data = await res.json();
    if (!res.ok) {
      console.error(data.error ?? "Request failed");
      process.exit(1);
    }
    console.log(JSON.stringify(data));
    return;
  }

  const res = await fetch(`${DAEMON_URL}/clipboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: opts.title, ttl: opts.ttl }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(data.error ?? "Request failed");
    process.exit(1);
  }
  console.log(JSON.stringify(data));
}
