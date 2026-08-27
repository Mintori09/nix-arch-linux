import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../config/env.js";

export function loadFrontHtml(templateName: string): string {
  const customPath = path.join(ROOT, "templates", templateName, "front.html");
  if (fs.existsSync(customPath)) {
    return fs.readFileSync(customPath, "utf-8").trim();
  }
  return fs.readFileSync(path.join(ROOT, "templates", "front.html"), "utf-8").trim();
}

export function loadBackHtml(templateName: string): string {
  const customPath = path.join(ROOT, "templates", templateName, "back.html");
  if (fs.existsSync(customPath)) {
    return fs.readFileSync(customPath, "utf-8").trim();
  }
  return fs.readFileSync(path.join(ROOT, "templates", "back.html"), "utf-8").trim();
}

function resolveCssImports(cssContent: string, visited: Set<string> = new Set()): string {
  const importRegex = /@import\s+(?:url\((['"]?)([^'")]+)\1\)|(['"])([^'"]+)\3);?/g;
  return cssContent.replace(importRegex, (_, _quote1, file1, _quote2, file2) => {
    const filename = file1 || file2;
    if (!filename) return "";
    if (filename === "card.css") return "";
    const importedPath = path.join(ROOT, "styles", filename);
    if (visited.has(importedPath)) return "";
    visited.add(importedPath);
    if (fs.existsSync(importedPath)) {
      const content = fs.readFileSync(importedPath, "utf-8").trim();
      return resolveCssImports(content, visited);
    }
    return "";
  });
}

export function loadCss(templateName: string): string {
  const basePath = path.join(ROOT, "styles", "card.css");
  const baseCss = fs.readFileSync(basePath, "utf-8").trim();

  if (templateName && templateName !== "card") {
    const customPath = path.join(ROOT, "styles", `${templateName}.css`);
    if (fs.existsSync(customPath)) {
      const customCss = fs.readFileSync(customPath, "utf-8").trim();
      const resolvedCustomCss = resolveCssImports(customCss, new Set([customPath, basePath]));
      return `${baseCss}\n\n${resolvedCustomCss}`.trim();
    }
  }
  return baseCss;
}

export function createAnkiTemplate(
  frontHtml: string,
  backHtml: string,
  css: string,
  fieldNames: readonly string[],
): string {
  const flds = fieldNames.map((name, i) => ({
    name,
    media: [],
    sticky: false,
    rtl: false,
    ord: i,
    font: "Arial",
    size: 20,
  }));

  const models = {
    "1388596687391": {
      veArs: [],
      name: "Dynamic-Anki-Card",
      tags: ["Tag"],
      did: 1435588830424,
      usn: -1,
      req: [[0, "all", [0]]],
      flds,
      sortf: 0,
      latexPre:
        "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
      tmpls: [
        {
          name: "Anki Card",
          qfmt: frontHtml,
          did: null,
          bafmt: "",
          afmt: backHtml,
          ord: 0,
          bqfmt: "",
        },
      ],
      latexPost: "\\end{document}",
      type: 0,
      id: 1388596687391,
      css,
      mod: 1435645658,
    },
  };

  const decks = {
    "1": {
      desc: "",
      name: "Default",
      extendRev: 50,
      usn: 0,
      collapsed: false,
      newToday: [0, 0],
      timeToday: [0, 0],
      dyn: 0,
      extendNew: 10,
      conf: 1,
      revToday: [0, 0],
      lrnToday: [0, 0],
      id: 1,
      mod: 1435645724,
    },
    "1435588830424": {
      desc: "",
      name: "Template",
      extendRev: 50,
      usn: -1,
      collapsed: false,
      newToday: [545, 0],
      timeToday: [545, 0],
      dyn: 0,
      extendNew: 10,
      conf: 1,
      revToday: [545, 0],
      lrnToday: [545, 0],
      id: 1435588830424,
      mod: 1435588830,
    },
  };

  const dconf = {
    "1": {
      name: "Default",
      replayq: true,
      lapse: {
        leechFails: 8,
        minInt: 1,
        delays: [10],
        leechAction: 0,
        mult: 0,
      },
      rev: {
        perDay: 100,
        fuzz: 0.05,
        ivlFct: 1,
        maxIvl: 36500,
        ease4: 1.3,
        bury: true,
        minSpace: 1,
      },
      timer: 0,
      maxTaken: 60,
      usn: 0,
      new: {
        perDay: 20,
        delays: [1, 10],
        separate: true,
        ints: [1, 4, 7],
        initialFactor: 2500,
        bury: true,
        order: 1,
      },
      mod: 0,
      id: 1,
      autoplay: true,
    },
  };

  return [
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
    "CREATE TABLE col (id integer primary key,crt integer not null,mod integer not null,scm integer not null,ver integer not null,dty integer not null,usn integer not null,ls integer not null,conf text not null,models text not null,decks text not null,dconf text not null,tags text not null);",
    `INSERT INTO "col" VALUES(1,1388548800,1435645724219,1435645724215,11,0,0,0,'${JSON.stringify({ nextPos: 1, estTimes: true, activeDecks: [1], sortType: "noteFld", timeLim: 0, sortBackwards: false, addToCur: true, curDeck: 1, newBury: true, newSpread: 0, dueCounts: true, curModel: "1435645724216", collapseTime: 1200 })}','${escapeJson(JSON.stringify(models))}','${escapeJson(JSON.stringify(decks))}','${escapeJson(JSON.stringify(dconf))}','{}');`,
    "CREATE TABLE notes (id integer primary key,guid text not null,mid integer not null,mod integer not null,usn integer not null,tags text not null,flds text not null,sfld integer not null,csum integer not null,flags integer not null,data text not null);",
    "CREATE TABLE cards (id integer primary key,nid integer not null,did integer not null,ord integer not null,mod integer not null,usn integer not null,type integer not null,queue integer not null,due integer not null,ivl integer not null,factor integer not null,reps integer not null,lapses integer not null,left integer not null,odue integer not null,odid integer not null,flags integer not null,data text not null);",
    "CREATE TABLE revlog (id integer primary key,cid integer not null,usn integer not null,ease integer not null,ivl integer not null,lastIvl integer not null,factor integer not null,time integer not null,type integer not null);",
    "CREATE TABLE graves (usn integer not null,oid integer not null,type integer not null);",
    "ANALYZE sqlite_master;",
    "INSERT INTO \"sqlite_stat1\" VALUES('col',NULL,'1');",
    "CREATE INDEX ix_notes_usn on notes (usn);",
    "CREATE INDEX ix_cards_usn on cards (usn);",
    "CREATE INDEX ix_revlog_usn on revlog (usn);",
    "CREATE INDEX ix_cards_nid on cards (nid);",
    "CREATE INDEX ix_cards_sched on cards (did, queue, due);",
    "CREATE INDEX ix_revlog_cid on revlog (cid);",
    "CREATE INDEX ix_notes_csum on notes (csum);",
    "COMMIT;",
  ].join("\n");
}

function escapeJson(json: string): string {
  return json.replace(/'/g, "''");
}

export const SEPARATOR = "\u001F";
