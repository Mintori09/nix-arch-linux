import { IncomingMessage, ServerResponse } from "http";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, sep } from "path";
import os from "os";

function expandHome(dir: string): string {
  if (dir.startsWith("~")) {
    return resolve(os.homedir(), dir.slice(1));
  }
  return resolve(dir);
}

function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) return content.slice(1);
  return content;
}

export function handleListPrompts(
  _req: IncomingMessage,
  res: ServerResponse,
  promptDir: string,
) {
  const dir = expandHome(promptDir);

  if (!existsSync(dir)) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([]));
    return;
  }

  try {
    const entries = readdirSync(dir);
    const prompts = entries
      .filter((e) => e.endsWith(".md") && statSync(resolve(dir, e)).isFile())
      .map((name) => {
        const content = readFileSync(resolve(dir, name), "utf-8");
        const clean = stripBOM(content);
        const preview = clean
          .replace(/---[\s\S]*?---/, "")
          .slice(0, 80)
          .trim();
        return {
          name,
          title: name.slice(0, -3),
          preview: preview + (preview.length === 80 ? "..." : ""),
        };
      });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(prompts));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to read prompts directory" }));
  }
}

export function handleGetPrompt(
  _req: IncomingMessage,
  res: ServerResponse,
  promptDir: string,
  name: string,
) {
  // Path traversal protection
  if (name.includes("..") || name.includes(sep)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid prompt name" }));
    return;
  }

  if (!name.endsWith(".md")) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Name must end with .md" }));
    return;
  }

  const dir = expandHome(promptDir);
  const filePath = resolve(dir, name);

  if (!filePath.startsWith(dir + sep)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid prompt name" }));
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Prompt not found" }));
    return;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const clean = stripBOM(content);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name,
        title: name.slice(0, -3),
        content: clean,
      }),
    );
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to read prompt file" }));
  }
}
