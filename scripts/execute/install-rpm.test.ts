import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  buildExtractCommands,
  createRunContext,
  ensureRequiredTools,
  findUnsafeArchiveEntries,
  normalizeArchiveEntry,
  parseCliArgs,
  prepareWorkspace,
} from "./install-rpm";

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("parseCliArgs", () => {
  test("parses install and force flags", () => {
    expect(parseCliArgs(["--install", "-f", "pkg.rpm", "dest"])).toEqual({
      force: true,
      help: false,
      install: true,
      positionals: ["pkg.rpm", "dest"],
    });
  });

  test("parses short help flag", () => {
    expect(parseCliArgs(["-h"])).toEqual({
      force: false,
      help: true,
      install: false,
      positionals: [],
    });
  });
});

describe("ensureRequiredTools", () => {
  test("requires sudo only in install mode", () => {
    expect(() =>
      ensureRequiredTools(false, (tool) =>
        tool === "rpm2cpio" || tool === "cpio" ? `/bin/${tool}` : null,
      ),
    ).not.toThrow();

    expect(() =>
      ensureRequiredTools(true, (tool) =>
        tool === "rpm2cpio" || tool === "cpio" ? `/bin/${tool}` : null,
      ),
    ).toThrow(/sudo/);
  });
});

describe("archive path validation", () => {
  test("normalizes leading dot segments", () => {
    expect(normalizeArchiveEntry("./usr/share/app")).toBe("usr/share/app");
  });

  test("accepts safe relative entries", () => {
    expect(
      findUnsafeArchiveEntries([
        "usr/bin/example",
        "./usr/share/doc/readme.txt",
        "opt/example/",
      ]),
    ).toEqual([]);
  });

  test("rejects absolute and traversal entries", () => {
    expect(
      findUnsafeArchiveEntries([
        "/etc/passwd",
        "../escape",
        "usr/share/../../../evil",
      ]),
    ).toEqual(["/etc/passwd", "../escape", "usr/share/../../../evil"]);
  });
});

describe("buildExtractCommands", () => {
  test("constructs cpio extraction with directory confinement flags", () => {
    const commands = buildExtractCommands("/tmp/pkg.rpm", "/tmp/out");

    expect(commands.rpm2cpio.argv).toEqual(["rpm2cpio", "/tmp/pkg.rpm"]);
    expect(commands.cpio.argv).toEqual([
      "cpio",
      "--extract",
      "--make-directories",
      "--preserve-modification-time",
      "--unconditional",
      "--directory",
      "/tmp/out",
      "--no-absolute-filenames",
      "--verbose",
    ]);
  });
});

describe("prepareWorkspace", () => {
  test("creates a temporary directory for install mode without a target", async () => {
    const tempRoot = await makeTempDir("irpm-rpm-");
    const rpmPath = path.join(tempRoot, "pkg.rpm");
    await writeFile(rpmPath, "rpm");

    const workspace = await prepareWorkspace({
      force: false,
      install: true,
      rpmPath,
    });

    tempDirs.push(workspace.targetDir);

    expect(workspace.cleanupAfterUse).toBe(true);
    expect(path.basename(workspace.targetDir)).toMatch(/^irpm-/);
  });

  test("refuses to reuse an existing destination without force", async () => {
    const tempRoot = await makeTempDir("irpm-existing-");
    const rpmPath = path.join(tempRoot, "pkg.rpm");
    const destPath = path.join(tempRoot, "out");
    await writeFile(rpmPath, "rpm");
    await mkdir(destPath, { recursive: true });
    await writeFile(path.join(destPath, "marker.txt"), "keep");

    await expect(
      prepareWorkspace({
        force: false,
        install: false,
        rpmPath,
        targetDir: destPath,
      }),
    ).rejects.toThrow(/Destination exists/);
  });

  test("replaces an existing destination with force", async () => {
    const tempRoot = await makeTempDir("irpm-force-");
    const rpmPath = path.join(tempRoot, "pkg.rpm");
    const destPath = path.join(tempRoot, "out");
    await writeFile(rpmPath, "rpm");
    await mkdir(destPath, { recursive: true });
    await writeFile(path.join(destPath, "old.txt"), "stale");

    const workspace = await prepareWorkspace({
      force: true,
      install: false,
      rpmPath,
      targetDir: destPath,
    });

    expect(workspace.cleanupAfterUse).toBe(false);
    expect(workspace.targetDir).toBe(destPath);
    expect(await Bun.file(path.join(destPath, "old.txt")).exists()).toBe(false);
  });
});

describe("createRunContext", () => {
  test("defaults non-install mode to extracted_rpm", async () => {
    const tempRoot = await makeTempDir("irpm-context-");
    const rpmPath = path.join(tempRoot, "pkg.rpm");
    const originalCwd = process.cwd();
    await writeFile(rpmPath, "rpm");

    process.chdir(tempRoot);

    try {
      const context = await createRunContext(
        parseCliArgs([path.basename(rpmPath)]),
      );

      expect(context.install).toBe(false);
      expect(context.workspaceCleanupAfterUse).toBe(false);
      expect(context.targetDir).toBe(path.join(tempRoot, "extracted_rpm"));
    } finally {
      process.chdir(originalCwd);
    }
  });
});
