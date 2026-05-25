#!/usr/bin/env tsx
import { spawnSync, spawn } from "child_process";
import { readFileSync } from "fs";
import { isMain } from "./utils";

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_TOKEN_NOVEL_BOT;
  const chatId = process.env.TELEGRAM_GROUP_NOVEL_BOT;
  const filePath = process.argv[2];

  if (!token) {
    console.error("L\u1ed7i: Bi\u1ebfn m\u00f4i tr\u01b0\u1eddng TELEGRAM_TOKEN_NOVEL_BOT ch\u01b0a \u0111\u01b0\u1ee3c thi\u1ebft l\u1eadp!");
    process.exit(1);
  }
  if (!chatId) {
    console.error("L\u1ed7i: Bi\u1ebfn m\u00f4i tr\u01b0\u1eddng TELEGRAM_GROUP_NOVEL_BOT ch\u01b0a \u0111\u01b0\u1ee3c thi\u1ebft l\u1eadp!");
    process.exit(1);
  }
  if (!filePath) {
    console.error(`L\u1ed7i: Thi\u1ebfu \u0111\u01b0\u1eddng d\u1eabn file. C\u00e1ch d\u00f9ng: telepush <file>`);
    process.exit(1);
  }

  try {
    readFileSync(filePath);
  } catch {
    console.error(`L\u1ed7i: File '${filePath}' kh\u00f4ng t\u1ed3n t\u1ea1i!`);
    process.exit(1);
  }

  const stat = spawnSync("stat", ["-c%s", filePath], { encoding: "utf-8" });
  const fileSize = parseInt(stat.stdout?.trim() || "0", 10);
  const maxSize = 50 * 1024 * 1024;

  if (fileSize > maxSize) {
    console.error(`C\u1ea3nh b\u00e1o: File l\u1edbn h\u01a1n 50MB. Vui l\u00f2ng d\u00f9ng 'telegram-upload' thay th\u1ebf.`);
    process.exit(1);
  }

  console.log(`\u0110ang \u0111\u1ea9y file: ${filePath.split("/").pop()}...`);
  const sizeStr = spawnSync("numfmt", ["--to=iec-i", String(fileSize)], { encoding: "utf-8" }).stdout?.trim();
  console.log(`  K\u00edch th\u01b0\u1edbc: ${sizeStr || fileSize}`);
  console.log(`  Chat ID: ${chatId}`);

  const formData = new FormData();
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer]);
  formData.append("document", blob, filePath.split("/").pop()!);

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendDocument?chat_id=${chatId}`,
      { method: "POST", body: formData },
    );
    const body = await res.text();

    if (body.includes('"ok":true')) {
      console.log("Th\u00e0nh c\u00f4ng! Ki\u1ec3m tra \u0111i\u1ec7n tho\u1ea1i c\u1ee7a b\u1ea1n.");
    } else {
      console.error("Th\u1ea5t b\u1ea1i khi g\u1eedi file \u0111\u1ebfn Telegram.");
      console.error(`  M\u00e3 ph\u1ea3n h\u1ed3i HTTP: ${res.status}`);
      console.error(`  Chi ti\u1ebft l\u1ed7i t\u1eeb API: ${body}`);

      if (body.includes('"error_code":400')) console.error("  \u2192 L\u1ed7i 400: Y\u00eau c\u1ea7u kh\u00f4ng h\u1ee3p l\u1ec7");
      else if (body.includes('"error_code":401')) console.error("  \u2192 L\u1ed7i 401: Token bot kh\u00f4ng h\u1ee3p l\u1ec7");
      else if (body.includes('"error_code":403')) console.error("  \u2192 L\u1ed7i 403: Bot kh\u00f4ng c\u00f3 quy\u1ec1n");
      else if (body.includes('"error_code":413')) console.error("  \u2192 L\u1ed7i 413: File qu\u00e1 l\u1edbn");
      else if (body.includes('"error_code":429')) console.error("  \u2192 L\u1ed7i 429: G\u1eedi qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u");
      else if (body.includes('"error_code":500') || body.includes('"error_code":502')) console.error("  \u2192 L\u1ed7i m\u00e1y ch\u1ee7 Telegram");

      process.exit(1);
    }
  } catch (err: any) {
    console.error("L\u1ed7i k\u1ebft n\u1ed1i:", err.message);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) main();
