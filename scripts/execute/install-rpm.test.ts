import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
} from "./install-rpm.ts";

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

it("cleanup temp dirs", async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

it("parseCliArgs - parses install subcommand", () => {
  const args = parseCliArgs(["install", "--force", "pkg.rpm"]);
  assert.strictEqual(args.command, "install");
  assert.strictEqual(args.force, true);
  assert.strictEqual(args.help, false);
  assert.strictEqual(args.idsOnly, false);
  assert.deepEqual(args.positionals, ["pkg.rpm"]);
});

it("parseCliArgs - maps legacy install alias to install command", () => {
  const args = parseCliArgs(["--install", "pkg.rpm"]);
  assert.strictEqual(args.command, "install");
  assert.strictEqual(args.install, true);
  assert.deepEqual(args.positionals, ["pkg.rpm"]);
});

it("parseCliArgs - parses remove and list commands", () => {
  const removeArgs = parseCliArgs(["remove", "pkg-id"]);
  assert.strictEqual(removeArgs.command, "remove");
  assert.deepEqual(removeArgs.positionals, ["pkg-id"]);

  const listArgs = parseCliArgs(["list", "--ids"]);
  assert.strictEqual(listArgs.command, "list");
  assert.strictEqual(listArgs.idsOnly, true);
  assert.deepEqual(listArgs.positionals, []);
});

it("ensureRequiredTools - does not require sudo in install mode anymore", () => {
  ensureRequiredTools(true, (tool) =>
    tool === "rpm2cpio" || tool === "cpio" ? `/bin/${tool}` : null,
  );
});

it("archive path validation - normalizes leading dot segments", () => {
  assert.strictEqual(normalizeArchiveEntry("./usr/share/app"), "usr/share/app");
});

it("archive path validation - accepts safe relative entries", () => {
  assert.deepEqual(
    findUnsafeArchiveEntries([
      "usr/bin/example",
      "./usr/share/doc/readme.txt",
      "opt/example/",
    ]),
    [],
  );
});

it("archive path validation - rejects absolute and traversal entries", () => {
  assert.deepEqual(
    findUnsafeArchiveEntries([
      "/etc/passwd",
      "../escape",
      "usr/share/../../../evil",
    ]),
    ["/etc/passwd", "../escape", "usr/share/../../../evil"],
  );
});

it("installable path validation - accepts user-space paths", () => {
  assert.deepEqual(
    validateInstallableEntries([
      "usr/bin/hello",
      "usr/share/applications/hello.desktop",
      "usr/share/pixmaps/hello.png",
      "opt/hello/bin/hello",
    ]),
    [],
  );
});

it("installable path validation - rejects system-level paths", () => {
  assert.deepEqual(
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

it("buildExtractCommands - constructs cpio extraction with directory confinement flags", () => {
  const commands = buildExtractCommands("/tmp/pkg.rpm", "/tmp/out");

  assert.deepEqual(commands.rpm2cpio.argv, ["rpm2cpio", "/tmp/pkg.rpm"]);
  assert.deepEqual(commands.cpio.argv, [
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

it("prepareWorkspace - creates a temporary directory for install mode without a target", async () => {
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
  assert.ok(/^irpm-/.test(path.basename(workspace.targetDir)));
});

it("prepareWorkspace - refuses to reuse an existing destination without force", async () => {
  const tempRoot = await makeTempDir("irpm-existing-");
  const rpmPath = path.join(tempRoot, "pkg.rpm");
  const destPath = path.join(tempRoot, "out");
  await writeFile(rpmPath, "rpm");
  await mkdir(destPath, { recursive: true });
  await writeFile(path.join(destPath, "marker.txt"), "keep");

  await assert.rejects(
    () =>
      prepareWorkspace({
        force: false,
        install: false,
        rpmPath,
        targetDir: destPath,
      }),
    Error,
    "Destination exists",
  );
});

it("createRunContext - defaults extract mode to extracted_rpm", async () => {
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

it("auditExtractedTree - rejects symlinks that escape the extracted root", async () => {
  const root = await makeTempDir("irpm-audit-link-");
  await mkdir(path.join(root, "usr/bin"), { recursive: true });
  await symlink("/etc/passwd", path.join(root, "usr/bin/hello"));

  await assert.rejects(() => auditExtractedTree(root), Error, "Symlink escapes");
});

it("auditExtractedTree - rejects setuid files", async () => {
  const root = await makeTempDir("irpm-audit-mode-");
  await mkdir(path.join(root, "usr/bin"), { recursive: true });
  const file = path.join(root, "usr/bin/hello");
  await writeFile(file, "echo hi");
  const chmodProc = spawnSync("chmod", ["4755", file]);
  assert.strictEqual(chmodProc.status, 0);
  assert.strictEqual((await lstat(file)).mode & 0o4000, 0o4000);

  await assert.rejects(() => auditExtractedTree(root), Error, "setuid or setgid");
});

it("install lifecycle - installs into XDG-managed paths and rewrites desktop entries", async () => {
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
  assert.strictEqual(existsSync(wrapperPath), true);
  assert.strictEqual(existsSync(desktopPath), true);
  assert.strictEqual(existsSync(manifestPath), true);

  const wrapperBody = await readFile(wrapperPath, "utf8");
  assert.strictEqual(wrapperBody.includes(stageExecutable), true);
  assert.strictEqual(wrapperBody.includes("LD_LIBRARY_PATH"), true);

  const desktopBody = await readFile(desktopPath, "utf8");
  assert.strictEqual(desktopBody.includes(`Exec=${wrapperPath} --flag`), true);
  assert.strictEqual(desktopBody.includes("# managed-by-irpm hello-rpm"), true);

  const iconLink = path.join(dataHome, "pixmaps", "hello-rpm.png");
  assert.strictEqual((await lstat(iconLink)).isSymbolicLink(), true);
});

it("install lifecycle - list returns install ids from manifest store", async () => {
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

  assert.deepEqual(
    await listInstalledPackageIds({
      HOME: homeDir,
      XDG_DATA_HOME: dataHome,
      XDG_STATE_HOME: stateHome,
    }),
    ["hello-rpm"],
  );
});

it("install lifecycle - rejects wrapper collisions owned by another file", async () => {
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
    () =>
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
    Error,
    "already exists",
  );
});

it("install lifecycle - remove deletes only manifest-owned artifacts", async () => {
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

  assert.strictEqual(existsSync(path.join(binDir, "hello-rpm")), false);
  assert.strictEqual(existsSync(path.join(binDir, "keep-me")), true);
  assert.strictEqual(existsSync(path.join(stateHome, "irpm/installs/hello-rpm.json")), false);
});