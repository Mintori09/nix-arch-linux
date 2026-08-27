export function resolveFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-.]/g, "")
    .slice(0, 99);
}

export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.on("data", (chunk: Buffer) => (data += chunk.toString()));
    process.stdin.on("end", () => resolve(data.trim()));
  });
}
