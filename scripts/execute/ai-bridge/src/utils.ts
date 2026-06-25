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

import find from "find-process";

/**
 * Returns the name and details of the process occupying a specific port.
 * @param port The port number to check.
 * @returns Object with process details, or null if nothing is running.
 */
export async function getProcessUsingPort(port: number) {
  try {
    const list = await find("port", port);

    if (list.length > 0) {
      // Returns { pid: 1234, name: 'node', cmd: 'node index.js', ... }
      return {
        pid: list[0].pid,
        name: list[0].name,
        cmd: list[0].cmd,
      };
    }

    return null; // Port is completely clear
  } catch (err) {
    console.error("Failed to query system processes:", err);
    return null;
  }
}
