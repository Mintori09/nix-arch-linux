#!/usr/bin/env tsx
import { spawnSync } from "child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { isMain } from "./utils";

const SCRATCH_DIR = "/tmp/my-scratchpads";

const EXT_BY_TYPE: Record<string, string> = {
  javascript: "js", python: "py", bash: "sh", typescript: "ts",
  ruby: "rb", php: "php", lua: "lua", perl: "pl", zsh: "zsh",
  json: "json", yaml: "yml", toml: "toml", xml: "xml",
  html: "html", css: "css", markdown: "md",
};

const SHEBANG_BY_EXT: Record<string, string> = {
  sh: "#!/bin/bash", bash: "#!/bin/bash",
  py: "#!/usr/bin/env python3", python: "#!/usr/bin/env python3",
  js: "#!/usr/bin/env node", node: "#!/usr/bin/env node",
  rb: "#!/usr/bin/env ruby", ruby: "#!/usr/bin/env ruby",
  pl: "#!/usr/bin/env perl", perl: "#!/usr/bin/env perl",
  ts: "#!/usr/bin/env tsx", typescript: "#!/usr/bin/env tsx",
  lua: "#!/usr/bin/env lua", php: "#!/usr/bin/env php",
  zsh: "#!/bin/zsh",
};

function getExtensionByType(typeLabel: string): string {
  return EXT_BY_TYPE[typeLabel] ?? "";
}

function getShebangByExtension(ext: string): string {
  return SHEBANG_BY_EXT[ext] ?? "";
}

function detectExtensionFromContent(content: string): string {
  const magika = spawnSync("magika", ["-", "--json"], {
    input: content, encoding: "utf-8",
  });
  if (magika.status === 0) {
    try {
      const parsed = JSON.parse(magika.stdout);
      const label: string = parsed[0]?.output?.ct_label ?? "";
      if (label && label !== "null") {
        const ext = getExtensionByType(label);
        if (ext) return ext;
      }
    } catch {}
  }

  if (content.includes("<html") || content.includes("<!DOCTYPE html")) return "html";

  const fileCmd = spawnSync("file", ["--brief", "--extension", "-"], {
    input: content, encoding: "utf-8",
  });
  if (fileCmd.status === 0) {
    const ext = fileCmd.stdout?.trim().split("/")[0] ?? "";
    if (ext && ext !== "???") return ext;
  }

  return "";
}

function applyExecutableEnvironment(filePath: string, extension: string): void {
  const shebang = getShebangByExtension(extension);
  if (!shebang) return;

  const firstLine = readFileSync(filePath, "utf-8").split("\n")[0];
  if (!firstLine.startsWith("#!")) {
    const content = `${shebang}\n\n${readFileSync(filePath, "utf-8")}`;
    writeFileSync(filePath, content, "utf-8");
  }
  chmodSync(filePath, 0o755);
}

function isStdinPresent(): boolean {
  try {
    return !process.stdin.isTTY;
  } catch {
    return false;
  }
}

function persistScratchpad(sourcePath: string, originalFilename: string, extension: string): void {
  try {
    const content = readFileSync(sourcePath, "utf-8");
    if (!content.trim()) return;

    process.stdout.write("\nSave scratch file to current directory? [y/N]: ");
    const buf = spawnSync("bash", ["-c", "read -n1 ans && echo \"$ans\""], { encoding: "utf-8" });
    const resp = buf.stdout?.trim() ?? "";

    if (resp.toLowerCase() === "y") {
      const cwd = process.cwd();
      let dest = `${cwd}/${sourcePath.split("/").pop()}`;
      if (existsSync(dest)) {
        dest = `${cwd}/${originalFilename}-${Math.floor(Date.now() / 1000)}.${extension}`;
      }
      copyFileSync(sourcePath, dest);
      console.log(`Saved to: ${dest}`);
    }
  } catch {}
}

function main(): void {
  mkdirSync(SCRATCH_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  let extension = "";
  const baseFilename = `scratch-${ts}`;
  let scratchPath = "";

  if (isStdinPresent()) {
    const chunks: Buffer[] = [];
    let chunk: Buffer;
    while ((chunk = process.stdin.read()) !== null) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString("utf-8");

    const args = process.argv.slice(2);
    if (args[0]) {
      extension = args[0];
    } else {
      extension = detectExtensionFromContent(content);
    }

    scratchPath = extension
      ? `${SCRATCH_DIR}/${baseFilename}.${extension}`
      : `${SCRATCH_DIR}/${baseFilename}`;

    writeFileSync(scratchPath, content, "utf-8");
    if (extension) applyExecutableEnvironment(scratchPath, extension);
  } else {
    extension = process.argv[2] || "sh";
    const customName = process.argv[3] || baseFilename;
    scratchPath = `${SCRATCH_DIR}/${customName}.${extension}`;

    const shebang = getShebangByExtension(extension);
    if (shebang) {
      writeFileSync(scratchPath, `${shebang}\n\n`, "utf-8");
      chmodSync(scratchPath, 0o755);
    } else {
      writeFileSync(scratchPath, "", "utf-8");
    }
  }

  process.on("exit", () => {
    persistScratchpad(scratchPath, baseFilename, extension);
    try { unlinkSync(scratchPath); } catch {}
  });
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  const editor = process.env.EDITOR || "vim";
  spawnSync(editor, [scratchPath], { stdio: "inherit" });
}

if (isMain(import.meta.url)) main();
