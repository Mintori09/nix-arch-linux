import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname);
const SRC = resolve(ROOT, "src");
const TEMPLATES = resolve(ROOT, "templates");
const OUTPUT = resolve(ROOT, "..", "dist", "ai-bridge.user.js");

const metadata = `// ==UserScript==
// @name         AI Bridge
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Bridge terminal prompts to AI web apps
// @author       You
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://chat.deepseek.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function() {
'use strict';

let ttPolicy = null;
if (window.trustedTypes) {
  try {
    if (!window.trustedTypes.defaultPolicy) {
      ttPolicy = window.trustedTypes.createPolicy("ai-bridge-policy", {
        createHTML: (s) => s,
        createScriptURL: (s) => s,
      });
    } else {
      ttPolicy = window.trustedTypes.defaultPolicy;
    }
  } catch (e) {
    console.warn("[ai-bridge] Trusted Types policy generation skipped:", e);
  }
}
`;

function readTemplates() {
  const out = {};
  if (!existsSync(TEMPLATES)) return out;
  for (const file of readdirSync(TEMPLATES)) {
    const path = resolve(TEMPLATES, file);
    if (statSync(path).isFile()) {
      const name = file.replace(/\.[^.]+$/, "");
      out[name] = readFileSync(path, "utf-8");
    }
  }
  return out;
}

function concatSrc(templates) {
  const files = [];
  function walk(dir) {
    const entries = readdirSync(dir);
    entries.sort((a, b) => {
      if (a === "main.js") return 1;
      if (b === "main.js") return -1;
      return a.localeCompare(b);
    });
    for (const entry of entries) {
      const path = resolve(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".js")) files.push(path);
    }
  }
  walk(SRC);

  const parts = files.map((f) => readFileSync(f, "utf-8"));
  const tmplVars = Object.entries(templates)
    .map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`)
    .join("\n");

  return tmplVars + "\n\n" + parts.join("\n\n");
}

function build() {
  const templates = readTemplates();
  const src = concatSrc(templates);
  writeFileSync(OUTPUT, metadata + src + "\n\n})();");
  console.log("Built " + OUTPUT);
}

build();
