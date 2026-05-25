import { describe, it, after } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

after(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("parseCliArgs", () => {
  it("parses install subcommand", () => {
    const args = parseCliArgs(["install", "--force", "pkg.rpm"]);
    assert.strictEqual(args.command, "install");
    assert.strictEqual(args.force, true);
    assert.strictEqual(args.help, false);
    assert.strictEqual(args.idsOnly, false);
    assert.deepStrictEqual(args.positionals, ["pkg.rpm"]);
  });

  it("maps legacy install alias to install command", () => {
    const args = parseCliArgs(["--install", "pkg.rpm"]);
    assert.strictEqual(args.command, "install");
    assert.strictEqual(args.install, true);
    assert.deepStrictEqual(args.positionals, ["pkg.rpm"]);
  });

  it("parses remove and list commands", () => {
    const removeArgs = parseCliArgs(["remove", "pkg-id"]);
    assert.strictEqual(removeArgs.command, "remove");
    assert.deepStrictEqual(removeArgs.positionals, ["pkg-id"]);

    const listArgs = parseCliArgs(["list", "--ids"]);
    assert.strictEqual(listArgs.command, "list");
    assert.strictEqual(listArgs.idsOnly, true);
    assert.deepStrictEqual(listArgs.positionals, []);
  });
});

describe("ensureRequiredTools", () => {
  it("does not require sudo in install mode anymore", () => {
    assert.doesNotThrow(() =>
      ensureRequiredTools(true, (tool) =>
        tool === "rpm2cpio" || tool === "cpio" ? `/bin/${tool}` : null,
      ),
    );
  });
});

describe("archive path validation", () => {
  it("normalizes leading dot segments", () => {
    assert.strictEqual(normalizeArchiveEntry("./usr/share/app"), "usr/share/app");
  });

  it("accepts safe relative entries", () => {
    assert.deepStrictEqual(
      findUnsafeArchiveEntries([
        "usr/bin/example",
        "./usr/share/doc/readme.txt",
        "opt/example/",
      ]),
      [],
    );
  });

  it("rejects absolute and traversal entries", () => {
    assert.deepStrictEqual(
      findUnsafeArchiveEntries([
        "/etc/passwd",
        "../escape",
        "usr/share/../../../evil",
      ]),
      ["/etc/passwd", "../escape", "usr/share/../../../evil"],
    );
  });
});

describe("installable path validation", () => {
  it("accepts user-space paths", () => {
    assert.deepStrictEqual(
      validateInstallableEntries([
        "usr/bin/hello",
        "usr/share/applications/hello.desktop",
        "usr/share/pixmaps/hello.png",
        "opt/hello/bin/hello",
      ]),
      [],
    );
  });

  it("rejects system-level paths", () => {
    assert.deepStrictEqual(
      validateInstallableEntries([
        "etc/profile.d/hello.sh",
        "usr/lib/systemd/user/hello.service",
        "var/lib/hello",
      ]),
      [
        "etc/profile.d/hello.sh",
        "usr/lib/systemd/user/hello.service",
        "var/lib/hello",
      ],
    );
  });
});

describe("buildExtractCommands", () => {
  it("constructs cpio extraction with directory confinement flags", () => {
    const commands = buildExtractCommands("/tmp/pkg.rpm", "/tmp/out");

    assert.deepStrictEqual(commands.rpm2cpio.argv, ["rpm2cpio", "/tmp/pkg.rpm"]);
    assert.deepStrictEqual(commands.cpio.argv, [
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
  it("creates a temporary directory for install mode without a target", async () => {
    const tempRoot = await makeTempDir("irpm-rpm-");
    const rpmPath = path.join(tempRoot, "pkg.rpm");
    await writeFile(rpmPath, "rpm");

    const workspace = await prepareWorkspace({
      force: false,
      install: true,
      rpmPath,
    });

    tempDirs.push(workspace.targetDir);

    assert.strictEqual(workspace.cleanupAfterUse, true);
    assert.match(path.basename(workspace.targetDir), /^irpm-/);
  });

  it("refuses to reuse an existing destination without force", async () => {
    const tempRoot = await makeTempDir("irpm-existing-");
    const rpmPath = path.join(tempRoot, "pkg.rpm");
    const destPath = path.join(tempRoot, "out");
    await writeFile(rpmPath, "rpm");
    await mkdir(destPath, { recursive: true });
    await writeFile(path.join(destPath, "marker.txt"), "keep");

    await assert.rejects(
      prepareWorkspace({
        force: false,
        install: false,
        rpmPath,
        targetDir: destPath,
      }),
      /Destination exists/,
    );
  });
});

describe("createRunContext", () => {
  it("defaults extract mode to extracted_rpm", async () => {
    const tempRoot = await makeTempDir("irpm-context-");
    const rpmPath = path.join(tempRoot, "pkg.rpm");
    const originalCwd = process.cwd();
    await writeFile(rpmPath, "rpm");

    process.chdir(tempRoot);

    try {
      const context = await createRunContext(
        parseCliArgs([path.basename(rpmPath)]),
      );

      assert.strictEqual(context.command, "extract");
      assert.strictEqual(context.workspaceCleanupAfterUse, false);
      assert.strictEqual(context.targetDir, path.join(tempRoot, "extracted_rpm"));
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("auditExtractedTree", () => {
  it("rejects symlinks that escape the extracted root", async () => {
    const root = await makeTempDir("irpm-audit-link-");
    await mkdir(path.join(root, "usr/bin"), { recursive: true });
    await symlink("/etc/passwd", path.join(root, "usr/bin/hello"));

    await assert.rejects(auditExtractedTree(root), /Symlink escapes/);
  });

  it("rejects setuid files", async () => {
    const root = await makeTempDir("irpm-audit-mode-");
    await mkdir(path.join(root, "usr/bin"), { recursive: true });
    const file = path.join(root, "usr/bin/hello");
    await writeFile(file, "echo hi");
    const chmodProc = spawnSync("chmod", ["4755", file]);
    assert.strictEqual(chmodProc.status, 0);
    assert.notStrictEqual((await lstat(file)).mode & 0o6000, 0);

    await assert.rejects(auditExtractedTree(root), /setuid or setgid/);
  });
});

describe("install lifecycle", () => {
  it("installs into XDG-managed paths and rewrites desktop entries", async () => {
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

    assert.strictEqual(result.manifest.id, "hello-rpm");
    assert.ok(existsSync(wrapperPath));
    assert.ok(existsSync(desktopPath));
    assert.ok(existsSync(manifestPath));

    const wrapperBody = await readFile(wrapperPath, "utf8");
    assert.ok(wrapperBody.includes(stageExecutable));
    assert.ok(wrapperBody.includes("LD_LIBRARY_PATH"));

    const desktopBody = await readFile(desktopPath, "utf8");
    assert.ok(desktopBody.includes(`Exec=${wrapperPath} --flag`));
    assert.ok(desktopBody.includes("# managed-by-irpm hello-rpm"));

    const iconLink = path.join(dataHome, "pixmaps", "hello-rpm.png");
    assert.strictEqual((await lstat(iconLink)).isSymbolicLink(), true);
  });

  it("list returns install ids from manifest store", async () => {
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

    assert.deepStrictEqual(
      await listInstalledPackageIds({
        HOME: homeDir,
        XDG_DATA_HOME: dataHome,
        XDG_STATE_HOME: stateHome,
      }),
      ["hello-rpm"],
    );
  });

  it("rejects wrapper collisions owned by another file", async () => {
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

    await assert.rejects(
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
      /already exists/,
    );
  });

  it("remove deletes only manifest-owned artifacts", async () => {
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

    assert.ok(!existsSync(path.join(binDir, "hello-rpm")));
    assert.ok(existsSync(path.join(binDir, "keep-me")));
    assert.ok(!existsSync(path.join(stateHome, "irpm/installs/hello-rpm.json")));
  });
});
