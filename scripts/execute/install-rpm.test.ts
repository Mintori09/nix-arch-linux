import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  auditExtractedTree,
  buildExtractCommands,
  createRunContext,
  ensureRequiredTools,
  findUnsafeArchiveEntries,
  installExtractedTree,
  listInstalledPackageIds,
  normalizeArchiveEntry,
  parseCliArgs,
  prepareWorkspace,
  removeInstalledPackage,
  validateInstallableEntries,
} from "./install-rpm";

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function makeFakeExtractedTree(root: string): Promise<void> {
  await mkdir(path.join(root, "usr/bin"), { recursive: true });
  await mkdir(path.join(root, "usr/share/applications"), { recursive: true });
  await mkdir(path.join(root, "usr/share/pixmaps"), { recursive: true });
  await mkdir(path.join(root, "usr/lib64"), { recursive: true });

  await writeFile(
    path.join(root, "usr/bin/hello-rpm"),
    "#!/usr/bin/env bash\necho hello\n",
  );
  await chmod(path.join(root, "usr/bin/hello-rpm"), 0o755);

  await writeFile(path.join(root, "usr/lib64/libhello.so"), "fake");
  await writeFile(path.join(root, "usr/share/pixmaps/hello-rpm.png"), "png");
  await writeFile(
    path.join(root, "usr/share/applications/hello-rpm.desktop"),
    [
      "[Desktop Entry]",
      "Type=Application",
      "Name=Hello RPM",
      "Exec=hello-rpm --flag",
      "Icon=hello-rpm",
      "",
    ].join("\n"),
  );
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("parseCliArgs", () => {
  test("parses install subcommand", () => {
    expect(parseCliArgs(["install", "--force", "pkg.rpm"])).toMatchObject({
      command: "install",
      force: true,
      help: false,
      idsOnly: false,
      positionals: ["pkg.rpm"],
    });
  });

  test("maps legacy install alias to install command", () => {
    expect(parseCliArgs(["--install", "pkg.rpm"])).toMatchObject({
      command: "install",
      install: true,
      positionals: ["pkg.rpm"],
    });
  });

  test("parses remove and list commands", () => {
    expect(parseCliArgs(["remove", "pkg-id"])).toMatchObject({
      command: "remove",
      positionals: ["pkg-id"],
    });

    expect(parseCliArgs(["list", "--ids"])).toMatchObject({
      command: "list",
      idsOnly: true,
      positionals: [],
    });
  });
});

describe("ensureRequiredTools", () => {
  test("does not require sudo in install mode anymore", () => {
    expect(() =>
      ensureRequiredTools(true, (tool) =>
        tool === "rpm2cpio" || tool === "cpio" ? `/bin/${tool}` : null,
      ),
    ).not.toThrow();
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

describe("installable path validation", () => {
  test("accepts user-space paths", () => {
    expect(
      validateInstallableEntries([
        "usr/bin/hello",
        "usr/share/applications/hello.desktop",
        "usr/share/pixmaps/hello.png",
        "opt/hello/bin/hello",
      ]),
    ).toEqual([]);
  });

  test("rejects system-level paths", () => {
    expect(
      validateInstallableEntries([
        "etc/profile.d/hello.sh",
        "usr/lib/systemd/user/hello.service",
        "var/lib/hello",
      ]),
    ).toEqual([
      "etc/profile.d/hello.sh",
      "usr/lib/systemd/user/hello.service",
      "var/lib/hello",
    ]);
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
});

describe("createRunContext", () => {
  test("defaults extract mode to extracted_rpm", async () => {
    const tempRoot = await makeTempDir("irpm-context-");
    const rpmPath = path.join(tempRoot, "pkg.rpm");
    const originalCwd = process.cwd();
    await writeFile(rpmPath, "rpm");

    process.chdir(tempRoot);

    try {
      const context = await createRunContext(
        parseCliArgs([path.basename(rpmPath)]),
      );

      expect(context.command).toBe("extract");
      expect(context.workspaceCleanupAfterUse).toBe(false);
      expect(context.targetDir).toBe(path.join(tempRoot, "extracted_rpm"));
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("auditExtractedTree", () => {
  test("rejects symlinks that escape the extracted root", async () => {
    const root = await makeTempDir("irpm-audit-link-");
    await mkdir(path.join(root, "usr/bin"), { recursive: true });
    await symlink("/etc/passwd", path.join(root, "usr/bin/hello"));

    await expect(auditExtractedTree(root)).rejects.toThrow(/Symlink escapes/);
  });

  test("rejects setuid files", async () => {
    const root = await makeTempDir("irpm-audit-mode-");
    await mkdir(path.join(root, "usr/bin"), { recursive: true });
    const file = path.join(root, "usr/bin/hello");
    await writeFile(file, "echo hi");
    const chmodProc = Bun.spawn(["chmod", "4755", file], {
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(await chmodProc.exited).toBe(0);
    expect((await lstat(file)).mode & 0o6000).not.toBe(0);

    await expect(auditExtractedTree(root)).rejects.toThrow(/setuid or setgid/);
  });
});

describe("install lifecycle", () => {
  test("installs into XDG-managed paths and rewrites desktop entries", async () => {
    const root = await makeTempDir("irpm-stage-");
    const homeDir = path.join(root, "home");
    const dataHome = path.join(homeDir, ".local/share");
    const stateHome = path.join(homeDir, ".local/state");
    const binDir = path.join(homeDir, ".local/bin");
    const extractedRoot = path.join(root, "extracted");
    const rpmPath = path.join(root, "hello.rpm");

    await makeFakeExtractedTree(extractedRoot);
    await writeFile(rpmPath, "rpm");

    const result = await installExtractedTree({
      env: {
        HOME: homeDir,
        XDG_DATA_HOME: dataHome,
        XDG_STATE_HOME: stateHome,
      },
      extractedRoot,
      force: false,
      installId: "hello-rpm",
      rpmPath,
    });

    const wrapperPath = path.join(binDir, "hello-rpm");
    const desktopPath = path.join(
      dataHome,
      "applications",
      "hello-rpm.desktop",
    );
    const manifestPath = path.join(
      stateHome,
      "irpm/installs",
      "hello-rpm.json",
    );
    const stageExecutable = path.join(
      dataHome,
      "irpm/packages/hello-rpm/root/usr/bin/hello-rpm",
    );

    expect(result.manifest.id).toBe("hello-rpm");
    expect(await Bun.file(wrapperPath).exists()).toBe(true);
    expect(await Bun.file(desktopPath).exists()).toBe(true);
    expect(await Bun.file(manifestPath).exists()).toBe(true);

    const wrapperBody = await readFile(wrapperPath, "utf8");
    expect(wrapperBody).toContain(stageExecutable);
    expect(wrapperBody).toContain("LD_LIBRARY_PATH");

    const desktopBody = await readFile(desktopPath, "utf8");
    expect(desktopBody).toContain(`Exec=${wrapperPath} --flag`);
    expect(desktopBody).toContain("# managed-by-irpm hello-rpm");

    const iconLink = path.join(dataHome, "pixmaps", "hello-rpm.png");
    expect((await lstat(iconLink)).isSymbolicLink()).toBe(true);
  });

  test("list returns install ids from manifest store", async () => {
    const root = await makeTempDir("irpm-list-");
    const homeDir = path.join(root, "home");
    const dataHome = path.join(homeDir, ".local/share");
    const stateHome = path.join(homeDir, ".local/state");
    const extractedRoot = path.join(root, "extracted");
    const rpmPath = path.join(root, "hello.rpm");

    await makeFakeExtractedTree(extractedRoot);
    await writeFile(rpmPath, "rpm");

    await installExtractedTree({
      env: {
        HOME: homeDir,
        XDG_DATA_HOME: dataHome,
        XDG_STATE_HOME: stateHome,
      },
      extractedRoot,
      force: false,
      installId: "hello-rpm",
      rpmPath,
    });

    expect(
      await listInstalledPackageIds({
        HOME: homeDir,
        XDG_DATA_HOME: dataHome,
        XDG_STATE_HOME: stateHome,
      }),
    ).toEqual(["hello-rpm"]);
  });

  test("rejects wrapper collisions owned by another file", async () => {
    const root = await makeTempDir("irpm-collision-");
    const homeDir = path.join(root, "home");
    const dataHome = path.join(homeDir, ".local/share");
    const stateHome = path.join(homeDir, ".local/state");
    const binDir = path.join(homeDir, ".local/bin");
    const extractedRoot = path.join(root, "extracted");
    const rpmPath = path.join(root, "hello.rpm");

    await makeFakeExtractedTree(extractedRoot);
    await writeFile(rpmPath, "rpm");
    await mkdir(binDir, { recursive: true });
    await writeFile(path.join(binDir, "hello-rpm"), "#!/usr/bin/env bash\n");

    await expect(
      installExtractedTree({
        env: {
          HOME: homeDir,
          XDG_DATA_HOME: dataHome,
          XDG_STATE_HOME: stateHome,
        },
        extractedRoot,
        force: false,
        installId: "hello-rpm",
        rpmPath,
      }),
    ).rejects.toThrow(/already exists/);
  });

  test("remove deletes only manifest-owned artifacts", async () => {
    const root = await makeTempDir("irpm-remove-");
    const homeDir = path.join(root, "home");
    const dataHome = path.join(homeDir, ".local/share");
    const stateHome = path.join(homeDir, ".local/state");
    const binDir = path.join(homeDir, ".local/bin");
    const extractedRoot = path.join(root, "extracted");
    const rpmPath = path.join(root, "hello.rpm");

    await makeFakeExtractedTree(extractedRoot);
    await writeFile(rpmPath, "rpm");
    await mkdir(binDir, { recursive: true });
    await writeFile(path.join(binDir, "keep-me"), "echo keep");

    await installExtractedTree({
      env: {
        HOME: homeDir,
        XDG_DATA_HOME: dataHome,
        XDG_STATE_HOME: stateHome,
      },
      extractedRoot,
      force: false,
      installId: "hello-rpm",
      rpmPath,
    });

    await removeInstalledPackage("hello-rpm", {
      HOME: homeDir,
      XDG_DATA_HOME: dataHome,
      XDG_STATE_HOME: stateHome,
    });

    expect(await Bun.file(path.join(binDir, "hello-rpm")).exists()).toBe(false);
    expect(await Bun.file(path.join(binDir, "keep-me")).exists()).toBe(true);
    expect(
      await Bun.file(
        path.join(stateHome, "irpm/installs/hello-rpm.json"),
      ).exists(),
    ).toBe(false);
  });
});
