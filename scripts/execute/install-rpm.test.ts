import { assertEquals, assertStrictEq, assertThrows } from "jsr:@std/assert";
import { assertRejects } from "jsr:@std/assert";
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

Deno.test("cleanup temp dirs", async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

Deno.test("parseCliArgs - parses install subcommand", () => {
  const args = parseCliArgs(["install", "--force", "pkg.rpm"]);
  assertStrictEq(args.command, "install");
  assertStrictEq(args.force, true);
  assertStrictEq(args.help, false);
  assertStrictEq(args.idsOnly, false);
  assertEquals(args.positionals, ["pkg.rpm"]);
});

Deno.test("parseCliArgs - maps legacy install alias to install command", () => {
  const args = parseCliArgs(["--install", "pkg.rpm"]);
  assertStrictEq(args.command, "install");
  assertStrictEq(args.install, true);
  assertEquals(args.positionals, ["pkg.rpm"]);
});

Deno.test("parseCliArgs - parses remove and list commands", () => {
  const removeArgs = parseCliArgs(["remove", "pkg-id"]);
  assertStrictEq(removeArgs.command, "remove");
  assertEquals(removeArgs.positionals, ["pkg-id"]);

  const listArgs = parseCliArgs(["list", "--ids"]);
  assertStrictEq(listArgs.command, "list");
  assertStrictEq(listArgs.idsOnly, true);
  assertEquals(listArgs.positionals, []);
});

Deno.test("ensureRequiredTools - does not require sudo in install mode anymore", () => {
  ensureRequiredTools(true, (tool) =>
    tool === "rpm2cpio" || tool === "cpio" ? `/bin/${tool}` : null,
  );
});

Deno.test("archive path validation - normalizes leading dot segments", () => {
  assertStrictEq(normalizeArchiveEntry("./usr/share/app"), "usr/share/app");
});

Deno.test("archive path validation - accepts safe relative entries", () => {
  assertEquals(
    findUnsafeArchiveEntries([
      "usr/bin/example",
      "./usr/share/doc/readme.txt",
      "opt/example/",
    ]),
    [],
  );
});

Deno.test("archive path validation - rejects absolute and traversal entries", () => {
  assertEquals(
    findUnsafeArchiveEntries([
      "/etc/passwd",
      "../escape",
      "usr/share/../../../evil",
    ]),
    ["/etc/passwd", "../escape", "usr/share/../../../evil"],
  );
});

Deno.test("installable path validation - accepts user-space paths", () => {
  assertEquals(
    validateInstallableEntries([
      "usr/bin/hello",
      "usr/share/applications/hello.desktop",
      "usr/share/pixmaps/hello.png",
      "opt/hello/bin/hello",
    ]),
    [],
  );
});

Deno.test("installable path validation - rejects system-level paths", () => {
  assertEquals(
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

Deno.test("buildExtractCommands - constructs cpio extraction with directory confinement flags", () => {
  const commands = buildExtractCommands("/tmp/pkg.rpm", "/tmp/out");

  assertEquals(commands.rpm2cpio.argv, ["rpm2cpio", "/tmp/pkg.rpm"]);
  assertEquals(commands.cpio.argv, [
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

Deno.test("prepareWorkspace - creates a temporary directory for install mode without a target", async () => {
  const tempRoot = await makeTempDir("irpm-rpm-");
  const rpmPath = path.join(tempRoot, "pkg.rpm");
  await writeFile(rpmPath, "rpm");

  const workspace = await prepareWorkspace({
    force: false,
    install: true,
    rpmPath,
  });

  tempDirs.push(workspace.targetDir);

  assertStrictEq(workspace.cleanupAfterUse, true);
  assert.match(path.basename(workspace.targetDir), /^irpm-/);
});

Deno.test("prepareWorkspace - refuses to reuse an existing destination without force", async () => {
  const tempRoot = await makeTempDir("irpm-existing-");
  const rpmPath = path.join(tempRoot, "pkg.rpm");
  const destPath = path.join(tempRoot, "out");
  await writeFile(rpmPath, "rpm");
  await mkdir(destPath, { recursive: true });
  await writeFile(path.join(destPath, "marker.txt"), "keep");

  await assertRejects(
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

Deno.test("createRunContext - defaults extract mode to extracted_rpm", async () => {
  const tempRoot = await makeTempDir("irpm-context-");
  const rpmPath = path.join(tempRoot, "pkg.rpm");
  const originalCwd = Deno.cwd();
  await writeFile(rpmPath, "rpm");

  Deno.chdir(tempRoot);

  try {
    const context = await createRunContext(
      parseCliArgs([path.basename(rpmPath)]),
    );

    assertStrictEq(context.command, "extract");
    assertStrictEq(context.workspaceCleanupAfterUse, false);
    assertStrictEq(context.targetDir, path.join(tempRoot, "extracted_rpm"));
  } finally {
    Deno.chdir(originalCwd);
  }
});

Deno.test("auditExtractedTree - rejects symlinks that escape the extracted root", async () => {
  const root = await makeTempDir("irpm-audit-link-");
  await mkdir(path.join(root, "usr/bin"), { recursive: true });
  await symlink("/etc/passwd", path.join(root, "usr/bin/hello"));

  await assertRejects(() => auditExtractedTree(root), Error, "Symlink escapes");
});

Deno.test("auditExtractedTree - rejects setuid files", async () => {
  const root = await makeTempDir("irpm-audit-mode-");
  await mkdir(path.join(root, "usr/bin"), { recursive: true });
  const file = path.join(root, "usr/bin/hello");
  await writeFile(file, "echo hi");
  const chmodProc = spawnSync("chmod", ["4755", file]);
  assertStrictEq(chmodProc.status, 0);
  assertStrictEq((await lstat(file)).mode & 0o6000, 0o6000);

  await assertRejects(() => auditExtractedTree(root), Error, "setuid or setgid");
});

Deno.test("install lifecycle - installs into XDG-managed paths and rewrites desktop entries", async () => {
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

  assertStrictEq(result.manifest.id, "hello-rpm");
  assertStrictEq(existsSync(wrapperPath), true);
  assertStrictEq(existsSync(desktopPath), true);
  assertStrictEq(existsSync(manifestPath), true);

  const wrapperBody = await readFile(wrapperPath, "utf8");
  assertStrictEq(wrapperBody.includes(stageExecutable), true);
  assertStrictEq(wrapperBody.includes("LD_LIBRARY_PATH"), true);

  const desktopBody = await readFile(desktopPath, "utf8");
  assertStrictEq(desktopBody.includes(`Exec=${wrapperPath} --flag`), true);
  assertStrictEq(desktopBody.includes("# managed-by-irpm hello-rpm"), true);

  const iconLink = path.join(dataHome, "pixmaps", "hello-rpm.png");
  assertStrictEq((await lstat(iconLink)).isSymbolicLink(), true);
});

Deno.test("install lifecycle - list returns install ids from manifest store", async () => {
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

  assertEquals(
    await listInstalledPackageIds({
      HOME: homeDir,
      XDG_DATA_HOME: dataHome,
      XDG_STATE_HOME: stateHome,
    }),
    ["hello-rpm"],
  );
});

Deno.test("install lifecycle - rejects wrapper collisions owned by another file", async () => {
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

  await assertRejects(
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

Deno.test("install lifecycle - remove deletes only manifest-owned artifacts", async () => {
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

  assertStrictEq(existsSync(path.join(binDir, "hello-rpm")), false);
  assertStrictEq(existsSync(path.join(binDir, "keep-me")), true);
  assertStrictEq(existsSync(path.join(stateHome, "irpm/installs/hello-rpm.json")), false);
});