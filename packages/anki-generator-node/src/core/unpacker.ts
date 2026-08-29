import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import cp from "node:child_process";
import zlib from "node:zlib";
import { createRequire } from "node:module";

export async function unpackApkg(apkgPath: string, outputDir: string): Promise<void> {
  const absoluteApkgPath = path.isAbsolute(apkgPath)
    ? path.normalize(apkgPath)
    : path.resolve(process.cwd(), apkgPath);

  const absoluteOutputDir = path.isAbsolute(outputDir)
    ? path.normalize(outputDir)
    : path.resolve(process.cwd(), outputDir);

  if (!fs.existsSync(absoluteApkgPath)) {
    throw new Error(`APKG file not found: ${absoluteApkgPath}`);
  }

  // Create output directory recursively if missing
  fs.mkdirSync(absoluteOutputDir, { recursive: true });

  // Create a temporary directory for zip extraction
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "anki-unpack-"));

  try {
    console.log(`Unpacking APKG archive: ${absoluteApkgPath}`);
    // Extract APKG as ZIP
    cp.execSync(`unzip -o "${absoluteApkgPath}" -d "${tmpDir}"`, { stdio: "ignore" });

    // Determine DB file name (Anki 2.1 uses collection.anki21, older use collection.anki2)
    let dbName = "collection.anki21";
    if (!fs.existsSync(path.join(tmpDir, dbName))) {
      dbName = "collection.anki2";
    }

    const dbPath = path.join(tmpDir, dbName);
    if (!fs.existsSync(dbPath)) {
      throw new Error("Invalid .apkg: SQLite database collection file not found inside package.");
    }

    // Resolve SQL.js
    let sql: any;
    try {
      const workspaceRequire =
        typeof require !== "undefined" ? require : createRequire(import.meta.url);
      try {
        const apkgPackagePath = workspaceRequire.resolve("anki-apkg-export");
        const ankiRequire = createRequire(apkgPackagePath);
        sql = ankiRequire("sql.js/js/sql-memory-growth.js");
      } catch {
        sql = workspaceRequire("sql.js/js/sql-memory-growth.js");
      }
    } catch (err) {
      throw new Error(`Failed to resolve sql.js: ${err}`);
    }

    // Load and optionally gunzip database
    let dbBuffer = fs.readFileSync(dbPath);
    if (dbBuffer.length > 2 && dbBuffer[0] === 0x1f && dbBuffer[1] === 0x8b) {
      dbBuffer = zlib.gunzipSync(dbBuffer);
    }

    const db = new sql.Database(dbBuffer);

    // Read models mapping table
    const colResult = db.exec("SELECT models FROM col;");
    if (!colResult.length || !colResult[0].values.length) {
      throw new Error("Invalid database: col table or models not found.");
    }
    const modelsJson = colResult[0].values[0][0] as string;
    const models = JSON.parse(modelsJson) as Record<string, any>;

    // Read notes
    const notesResult = db.exec("SELECT id, mid, flds, tags FROM notes;");
    const cardsList: any[] = [];

    if (notesResult.length && notesResult[0].values.length) {
      const columns = notesResult[0].columns;
      const values = notesResult[0].values;

      const idIdx = columns.indexOf("id");
      const midIdx = columns.indexOf("mid");
      const fldsIdx = columns.indexOf("flds");
      const tagsIdx = columns.indexOf("tags");

      for (const row of values) {
        const id = row[idIdx];
        const mid = String(row[midIdx]);
        const flds = row[fldsIdx] as string;
        const tagsRaw = row[tagsIdx] as string;

        const tags = tagsRaw ? tagsRaw.trim().split(/\s+/).filter(Boolean) : [];
        const model = models[mid];
        const modelName = model ? model.name : "Unknown Model";
        const modelFields = model ? model.flds : [];

        const fieldValues = flds.split("\u001f");
        const fields: Record<string, string> = {};

        // anki-apkg-export prepends frontKeyField to front of back fields list
        if (fieldValues.length === modelFields.length + 1) {
          modelFields.forEach((field: any, index: number) => {
            fields[field.name] = fieldValues[index + 1] || "";
          });
        } else {
          modelFields.forEach((field: any, index: number) => {
            fields[field.name] = fieldValues[index] || "";
          });
        }

        cardsList.push({
          id,
          modelName,
          fields,
          tags,
        });
      }
    }

    // Write metadata JSON
    const outputJsonPath = path.join(absoluteOutputDir, "cards.json");
    fs.writeFileSync(outputJsonPath, JSON.stringify(cardsList, null, 2), "utf-8");
    console.log(`Exported card metadata to: ${outputJsonPath}`);

    // Map obfuscated assets back to human-readable filenames
    const mediaMapPath = path.join(tmpDir, "media");
    if (fs.existsSync(mediaMapPath)) {
      let mediaMap: Record<string, string> = {};
      try {
        mediaMap = JSON.parse(fs.readFileSync(mediaMapPath, "utf-8"));
      } catch (e) {
        console.warn("Failed to parse media dictionary:", e);
      }

      let copiedCount = 0;
      for (const [obfuscatedName, originalName] of Object.entries(mediaMap)) {
        const sourceFile = path.join(tmpDir, obfuscatedName);
        if (fs.existsSync(sourceFile)) {
          const destFile = path.join(absoluteOutputDir, originalName);
          fs.copyFileSync(sourceFile, destFile);
          copiedCount++;
        }
      }
      if (copiedCount > 0) {
        console.log(`Unpacked ${copiedCount} media assets to: ${absoluteOutputDir}`);
      }
    }
  } finally {
    // Clean up temporary files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup failures
    }
  }
}
