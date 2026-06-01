#!/usr/bin/env tsx
import { promises as fs } from "node:fs";
import { args, isMain, spawnAsync, spawnInherit, which } from "./utils.ts";

const HOME = process.env.HOME!;
const REMOTE_BASE = "Drive:mintori-backup";
const ARCHIVES_REMOTE = `${REMOTE_BASE}/archives`;
const OBSIDIAN_DST = `Drive:[2] Personal/[2] Obsidian`;

const FILTER_DIR = `${HOME}/.config/rclone/filter`;
const CONFIG_FILTER = `${FILTER_DIR}/config.txt`;
const FIREFOX_FILTER = `${FILTER_DIR}/firefox profile.txt`;
const LOG_FILE = process.env.RCLONE_LOG_FILE || `${HOME}/rclone-sync.log`;
const TMP_DIR = "/tmp/rclone-sync";

const ZEN_PROFILES = [
  `${HOME}/.config/zen/4nb0p4x5.Default (release)`,
  `${HOME}/.config/zen/7rtgyhs5.Default Profile`,
];

const OBSIDIAN_SRC = `${HOME}/Documents/[2] Obsidian`;

const KEEP_VERSIONS = 10;

const CONFIG_EXCLUDES = [
  ".cache",
  ".cargo",
  ".local/share/Trash",
  ".config/google-chrome",
  ".config/Antigravity",
  ".config/Bitwarden",
  ".config/BraveSoftware",
  ".config/Code",
  ".config/Folo",
  ".config/marktext",
  ".config/obsidian",
  ".config/openscreen",
  ".config/pomatez",
  ".config/Signal",
  ".config/Slack",
  ".config/superProductivity",
  ".config/Todoist",
  ".config/Typora",
  ".config/com.differentai.openwork",
  ".config/Sigma file manager",
  ".config/YouTube Music",
  ".config/waveterm",
  ".config/openwarp",
  ".config/noctalia",
  ".config/anyrun/plugins",
  ".config/anyrun/anyrun-favicons",
  ".config/rclone/rclone.conf",
  ".config/gh/hosts.yml",
  ".config/kdeconnect",
  ".config/Proton",
  ".config/environment.d",
  "Documents",
  "Downloads",
];

const ZEN_EXCLUDES = [
  "storage/permanent",
  "cache2",
  "startupCache",
  "crashes",
  "minidumps",
  "datareporting",
  "saved-telemetry-pings",
  "weave",
  "chrome_debugger_profile",
  ".parentlock",
  "lock",
];

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function printHeader(text: string): void {
  const line = "─".repeat(50);
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(`${line}\n`);
}

function printUsage(): void {
  console.log(`
rclone-sync - Đồng bộ config lên Google Drive

Cách dùng:
  rclone-sync --config         Tar & upload ~/.config
  rclone-sync --zen            Tar & upload Zen profiles
  rclone-sync --obsidian       Rclone sync Obsidian vault
  rclone-sync --all            Config + Zen + Obsidian

Modifiers:
  --dry-run, -n    Preview, không sync thật
  --help, -h       Hiển thị trợ giúp

Remote:  ${REMOTE_BASE}
Log:     ${LOG_FILE}
`);
}

async function checkPrerequisites(): Promise<void> {
  if (!which("rclone")) {
    console.error("Lỗi: rclone chưa được cài đặt!");
    process.exit(1);
  }

  const remoteCheck = await spawnAsync("rclone", ["listremotes"]);
  if (!remoteCheck.stdout.includes("Drive:")) {
    console.error("Lỗi: Remote 'Drive:' chưa được cấu hình trong rclone!");
    process.exit(1);
  }

  await fs.mkdir(TMP_DIR, { recursive: true });
}

function buildExcludeArgs(excludes: string[]): string[] {
  const args: string[] = [];
  for (const ex of excludes) {
    args.push("--exclude", ex);
  }
  return args;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

async function cleanupOldArchives(
  remotePath: string,
  prefix: string,
): Promise<void> {
  console.log(`\n  Dọn archive cũ (giữ ${KEEP_VERSIONS})...`);

  const listResult = await spawnAsync("rclone", [
    "lsf",
    remotePath,
    "--include",
    `${prefix}-*.tar.gz`,
    "--format",
    "%f",
  ]);

  if (listResult.exitCode !== 0) return;

  const files = listResult.stdout
    .split("\n")
    .filter((f) => f.trim())
    .sort()
    .reverse();

  if (files.length <= KEEP_VERSIONS) {
    console.log(`  Còn ${files.length} file, chưa cần dọn.`);
    return;
  }

  const toDelete = files.slice(KEEP_VERSIONS);
  for (const file of toDelete) {
    console.log(`  Xóa: ${file}`);
    await spawnAsync("rclone", ["delete", `${remotePath}/${file}`]);
  }
}

async function syncConfig(dryRun: boolean): Promise<number> {
  printHeader("Sync: Config → Google Drive (tar.gz)");

  const ts = timestamp();
  const archiveName = `config-${ts}.tar.gz`;
  const archivePath = `${TMP_DIR}/${archiveName}`;

  const excludeArgs = buildExcludeArgs(CONFIG_EXCLUDES);

  const tarArgs = [
    "czf",
    archivePath,
    "-C",
    HOME,
    ...excludeArgs,
    ".config/",
    ".ideavimrc",
  ];

  if (dryRun) {
    console.log(`  Tar: tar ${tarArgs.join(" ")}`);
    console.log(`  Upload: rclone copy ${archivePath} ${ARCHIVES_REMOTE}/`);
    console.log(`  (dry-run — skipped)\n`);
    return 0;
  }

  console.log(`  Đang nén...`);
  const tarCode = await spawnInherit("tar", tarArgs);
  if (tarCode !== 0) {
    console.error(`  Lỗi tar (code: ${tarCode})`);
    return tarCode;
  }

  try {
    const stat = await fs.stat(archivePath);
    console.log(`  Archive: ${archiveName} (${formatSize(stat.size)})`);
  } catch {
    console.error(`  Lỗi: File không tồn tại: ${archivePath}`);
    return 1;
  }

  console.log(`  Upload lên ${ARCHIVES_REMOTE}/...`);
  const uploadCode = await spawnInherit("rclone", [
    "copy",
    archivePath,
    `${ARCHIVES_REMOTE}/`,
    "--progress",
    "--log-file",
    LOG_FILE,
    "--log-level",
    "INFO",
  ]);

  if (uploadCode !== 0) {
    console.error(`  Lỗi upload (code: ${uploadCode})`);
    return uploadCode;
  }

  await fs.rm(archivePath);
  console.log(`  Đã xóa archive local.`);

  await cleanupOldArchives(ARCHIVES_REMOTE, "config");

  console.log(`  Hoàn tất: ${archiveName}`);
  return 0;
}

async function syncZen(dryRun: boolean): Promise<number> {
  printHeader("Sync: Zen profiles → Google Drive (tar.gz)");

  let exitCode = 0;

  for (const profileDir of ZEN_PROFILES) {
    try {
      await fs.stat(profileDir);
    } catch {
      console.log(`  Bỏ qua profile không tồn tại: ${profileDir}`);
      continue;
    }

    const profileName = profileDir.split("/").pop()!;
    const ts = timestamp();
    const archiveName = `zen-${profileName}-${ts}.tar.gz`;
    const archivePath = `${TMP_DIR}/${archiveName}`;

    const excludeArgs = buildExcludeArgs(ZEN_EXCLUDES);

    const tarArgs = [
      "czf",
      archivePath,
      "-C",
      HOME,
      ...excludeArgs,
      profileDir.replace(`${HOME}/`, ""),
    ];

    if (dryRun) {
      console.log(`  Tar: tar ${tarArgs.join(" ")}`);
      console.log(`  (dry-run — skipped)\n`);
      continue;
    }

    console.log(`  Đang nén: ${profileName}...`);
    const tarCode = await spawnInherit("tar", tarArgs);
    if (tarCode !== 0) {
      console.error(`  Lỗi tar ${profileName} (code: ${tarCode})`);
      exitCode = tarCode;
      continue;
    }

    try {
      const stat = await fs.stat(archivePath);
      console.log(`  Archive: ${archiveName} (${formatSize(stat.size)})`);
    } catch {
      console.error(`  Lỗi: File không tồn tại: ${archivePath}`);
      exitCode = 1;
      continue;
    }

    console.log(`  Upload lên ${ARCHIVES_REMOTE}/...`);
    const uploadCode = await spawnInherit("rclone", [
      "copy",
      archivePath,
      `${ARCHIVES_REMOTE}/`,
      "--progress",
      "--log-file",
      LOG_FILE,
      "--log-level",
      "INFO",
    ]);

    if (uploadCode !== 0) {
      console.error(`  Lỗi upload ${profileName} (code: ${uploadCode})`);
      exitCode = uploadCode;
      continue;
    }

    await fs.rm(archivePath);
    console.log(`  Hoàn tất: ${archiveName}`);
  }

  if (exitCode === 0) {
    await cleanupOldArchives(ARCHIVES_REMOTE, "zen");
  }

  return exitCode;
}

async function syncObsidian(dryRun: boolean): Promise<number> {
  printHeader("Sync: Obsidian → Google Drive");

  try {
    await fs.stat(OBSIDIAN_SRC);
  } catch {
    console.error(`Lỗi: Thư mục Obsidian không tồn tại: ${OBSIDIAN_SRC}`);
    return 1;
  }

  const cmdArgs = [
    "sync",
    OBSIDIAN_SRC,
    OBSIDIAN_DST,
    "--fast-list",
    "--no-traverse",
    "--exclude-from",
    `${OBSIDIAN_SRC}/.rclone-ignore`,
    "--tpslimit",
    "8",
    "--transfers",
    "6",
    "--checkers",
    "12",
    "--drive-chunk-size",
    "64M",
    "--drive-use-trash=false",
    "--verbose",
    "--progress",
    "--stats",
    "5s",
    "--stats-one-line",
    "--log-file",
    LOG_FILE,
  ];

  if (dryRun) cmdArgs.push("--dry-run");

  return await spawnInherit("rclone", cmdArgs);
}

async function main(): Promise<void> {
  const dryRun = args.includes("--dry-run") || args.includes("-n");
  const showHelp = args.includes("--help") || args.includes("-h");

  if (showHelp) {
    printUsage();
    return;
  }

  const doConfig = args.includes("--config");
  const doZen = args.includes("--zen");
  const doObsidian = args.includes("--obsidian");
  const doAll = args.includes("--all");

  if (!doConfig && !doZen && !doObsidian && !doAll) {
    printUsage();
    return;
  }

  if (dryRun) {
    console.log("=== DRY RUN MODE ===");
  }

  await checkPrerequisites();

  const start = Date.now();
  console.log(`Bắt đầu sync: ${new Date().toLocaleString("vi-VN")}`);

  let exitCode = 0;

  if (doAll || doConfig) {
    const code = await syncConfig(dryRun);
    if (code !== 0) exitCode = code;
  }

  if (doAll || doZen) {
    const code = await syncZen(dryRun);
    if (code !== 0) exitCode = code;
  }

  if (doAll || doObsidian) {
    const code = await syncObsidian(dryRun);
    if (code !== 0) exitCode = code;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  printHeader("Kết quả");

  if (exitCode === 0) {
    console.log(`  Hoàn tất trong ${elapsed}s`);
    console.log(`  Log: ${LOG_FILE}`);
  } else {
    console.error(`  Có lỗi xảy ra (code: ${exitCode})`);
    console.error(`  Kiểm tra log: ${LOG_FILE}`);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) main();
