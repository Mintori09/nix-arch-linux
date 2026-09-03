import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ankiPkg from "anki-apkg-export";
const Exporter = (ankiPkg as any).Exporter || (ankiPkg as any).default?.Exporter || ankiPkg;
import type { ParsedResult } from "../types/index.js";
import type { BaseParser } from "../parsers/base.js";
import { loadFrontHtml, loadBackHtml, loadCss, createAnkiTemplate, SEPARATOR } from "./template.js";
import { ROOT } from "../config/env.js";

export interface InputDeckItem {
  parsedResult: ParsedResult;
  parser: BaseParser;
  deckName: string;
}

export async function generateApkg(
  items: InputDeckItem | InputDeckItem[] | ParsedResult,
  outputFilenameOrParser: string | BaseParser = "ankideck.apkg",
  legacyDeckName?: string,
  legacyOutputFilename?: string,
): Promise<void> {
  let itemList: InputDeckItem[];
  let outputFilename: string;

  if (items && "cards" in (items as any) && typeof outputFilenameOrParser === "object") {
    // Legacy overload: generateApkg(result, parser, deckName, outputFilename)
    itemList = [
      {
        parsedResult: items as ParsedResult,
        parser: outputFilenameOrParser as BaseParser,
        deckName: legacyDeckName || "Default",
      },
    ];
    outputFilename = legacyOutputFilename || "ankideck.apkg";
  } else {
    itemList = Array.isArray(items) ? (items as InputDeckItem[]) : [items as InputDeckItem];
    outputFilename =
      typeof outputFilenameOrParser === "string" ? outputFilenameOrParser : "ankideck.apkg";
  }

  let sql: any;
  try {
    const req = createRequire(import.meta.url);
    try {
      const apkgPath = req.resolve("anki-apkg-export");
      const ankiRequire = createRequire(apkgPath);
      sql = ankiRequire("sql.js/js/sql-memory-growth.js");
    } catch {
      sql = req("sql.js/js/sql-memory-growth.js");
    }
  } catch (err) {
    throw new Error(`Failed to resolve sql.js: ${err}`);
  }

  // Patch Exporter methods to properly free prepared statements and avoid memory exhaustion
  if (!(Exporter.prototype as any)._patched) {
    (Exporter.prototype as any)._patched = true;

    (Exporter.prototype as any)._update = function (query: string, obj: any) {
      this.db.run(query, obj);
    };

    (Exporter.prototype as any)._getId = function (table: string, col: string, ts: number) {
      const query = `SELECT ${col} from ${table} WHERE ${col} >= :ts ORDER BY ${col} DESC LIMIT 1`;
      const stmt = this.db.prepare(query);
      const rowObj = stmt.getAsObject({ ":ts": ts });
      stmt.free();
      return rowObj[col] ? +rowObj[col] + 1 : ts;
    };

    (Exporter.prototype as any)._getNoteId = function (guid: string, ts: number) {
      const query = "SELECT id from notes WHERE guid = :guid ORDER BY id DESC LIMIT 1";
      const stmt = this.db.prepare(query);
      const rowObj = stmt.getAsObject({ ":guid": guid });
      stmt.free();
      return rowObj.id || this._getId("notes", "id", ts);
    };

    (Exporter.prototype as any)._getCardId = function (note_id: number, ts: number) {
      const query = "SELECT id from cards WHERE nid = :note_id ORDER BY id DESC LIMIT 1";
      const stmt = this.db.prepare(query);
      const rowObj = stmt.getAsObject({ ":note_id": note_id });
      stmt.free();
      return rowObj.id || this._getId("cards", "id", ts);
    };
  }

  if (itemList.length === 0) {
    throw new Error("No input items provided for generateApkg.");
  }

  // Primary item determines top-level package deck name or initial template setup
  const primaryItem = itemList[0];
  const primaryTemplateName = primaryItem.parser.getTemplateName();
  const primaryFieldNames = primaryItem.parser.getFieldNames();

  const frontHtml = loadFrontHtml(primaryTemplateName);
  const backHtml = loadBackHtml(primaryTemplateName);
  const css = loadCss(primaryTemplateName);
  const template = createAnkiTemplate(frontHtml, backHtml, css, primaryFieldNames);

  // Top-level package deck name
  const topLevelDeckName = primaryItem.deckName.includes("::")
    ? primaryItem.deckName.split("::")[0]
    : primaryItem.deckName;

  const apkg = new Exporter(topLevelDeckName, { template, sql });

  // Map to cache deck names to deck IDs within SQLite collection
  const deckIdMap = new Map<string, number>();
  deckIdMap.set(topLevelDeckName, (apkg as any).topDeckId);

  // Helper function to resolve or create a deck in Anki SQLite database
  const getOrCreateDeckId = (fullDeckName: string): number => {
    if (deckIdMap.has(fullDeckName)) {
      return deckIdMap.get(fullDeckName)!;
    }

    const db = (apkg as any).db;
    const decksStr = (apkg as any)._getFirstVal("select decks from col");
    const now = Date.now();
    const newDeckId = (apkg as any)._getId("cards", "did", now);

    // Copy deck configuration from topDeckId
    const baseDeck = decksStr[(apkg as any).topDeckId + ""] || Object.values(decksStr)[0];
    const newDeck = JSON.parse(JSON.stringify(baseDeck));
    newDeck.name = fullDeckName;
    newDeck.id = newDeckId;
    decksStr[newDeckId + ""] = newDeck;

    (apkg as any)._update("update col set decks=:decks where id=1", {
      ":decks": JSON.stringify(decksStr),
    });

    deckIdMap.set(fullDeckName, newDeckId);
    return newDeckId;
  };

  for (const item of itemList) {
    const fieldNames = item.parser.getFieldNames();
    const targetDeckId = getOrCreateDeckId(item.deckName);

    // Add media assets
    for (const file of item.parsedResult.media) {
      apkg.addMedia(file.filename, file.buffer);
    }

    // Temporarily set topDeckId so (apkg as any).addCard puts card into targetDeckId
    const originalTopDeckId = (apkg as any).topDeckId;
    (apkg as any).topDeckId = targetDeckId;

    for (const card of item.parsedResult.cards) {
      const frontFieldName = fieldNames[0];
      const frontValue = card.fields[frontFieldName] ?? card.frontKeyField;
      const backValues = fieldNames.slice(1).map((name) => card.fields[name] ?? "");
      const back = backValues.join(SEPARATOR);
      (apkg as any).addCard(frontValue, back);
    }

    (apkg as any).topDeckId = originalTopDeckId;
  }

  console.log("Packing apkg file...");
  try {
    const zip = await (apkg as any).save();
    const finalPath = path.isAbsolute(outputFilename)
      ? outputFilename
      : path.join(ROOT, outputFilename);
    fs.writeFileSync(finalPath, zip);
    console.log(`Success! Exported ${path.basename(finalPath)}`);
  } catch (err) {
    console.error("Error packing apkg:", err);
    throw err;
  }
}
