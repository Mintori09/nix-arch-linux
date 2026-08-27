import { mkdtempSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { runCommand } from "../core/command.ts";

const MERMAID_RE = /^\s*```\s*mermaid\s*$/im;

const MMDR_CONFIG = {
  themeVariables: {
    // mmdr chấp nhận Mermaid-like themeVariables trong file JSON
    backgroundColor: "white",
  },
};

function mmdrAvailable(): boolean {
  const result = spawnSync("which", ["mmdr"]);
  return result.status === 0;
}

export function hasMermaidBlocks(content: string): boolean {
  return MERMAID_RE.test(content);
}

export async function tryPreprocessMermaid(
  content: string,
  context: { dryRun: boolean },
): Promise<string> {
  if (!hasMermaidBlocks(content)) return content;
  if (context.dryRun) return content;
  if (!mmdrAvailable()) {
    console.warn("mmdr not found on PATH; skipping mermaid preprocessing");
    return content;
  }

  const tmpDir = mkdtempSync(path.join(tmpdir(), "cv-mermaid-"));
  try {
    const configPath = path.join(tmpDir, "mmdr-config.json");
    await writeFile(configPath, JSON.stringify(MMDR_CONFIG, null, 2));

    const mmdPath = path.join(tmpDir, "diagram.mmd");
    const imgPath = path.join(tmpDir, "diagram.png");

    const matches = content.matchAll(/```\s*mermaid\s*\n([\s\S]*?)```/gm);
    let result = content;
    let offset = 0;

    for (const match of matches) {
      const mermaidCode = match[1].trim();
      const fullMatch = match[0];
      const matchIndex = match.index! + offset;

      await writeFile(mmdPath, mermaidCode);

      // Cấu hình tham số chuẩn theo mmdr CLI:
      // -i <INPUT>
      // -o <OUTPUT>
      // -e png (định dạng xuất)
      // -t default (preset theme)
      // -w / -H (kích thước)
      // -c <CONFIG> (JSON chứa themeVariables)
      await runCommand(
        [
          "mmdr",
          "-i",
          mmdPath,
          "-o",
          imgPath,
          "-e",
          "png",
          "-t",
          "default",
          "-w",
          "1200",
          "-H",
          "800",
          "-c",
          configPath,
        ],
        { dryRun: false },
      );

      const imgContent = await readFile(imgPath);
      const base64Img = Buffer.from(imgContent).toString("base64");
      const dataUri = `![](data:image/png;base64,${base64Img})`;

      const before = result.slice(0, matchIndex);
      const after = result.slice(matchIndex + fullMatch.length);
      const newLen = dataUri.length - fullMatch.length;
      offset += newLen;
      result = before + dataUri + after;
    }

    return result;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
