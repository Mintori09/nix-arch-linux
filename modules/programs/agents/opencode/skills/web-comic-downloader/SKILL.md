---
name: web-comic-downloader
description: >
  Web comic downloader — download complete comics/manga from any website as images and package them into CBZ.
  ALWAYS use this skill when a user provides a URL to a comic/manga series page and asks you to download, scrape, crawl,
  save, or extract chapters. This includes Vietnamese phrases like "download truyện tranh", "tải manga", "lấy chap",
  "scrape comic", "crawl manga", or just pasting a URL of a comic site.
  Works with any comic website by dynamically analyzing the site structure — SSR (fetch+cheerio), SPA (Playwright),
  or API-based. Do NOT assume a specific domain; analyze each site fresh.
  **Requires:** superpowers:writing-plans, superpowers:executing-plans, superpowers:subagent-driven-development
---

# Web Comic Downloader

## How This Skill Works

Your job: given a URL to a comic/manga/series page, produce a complete download of all available chapters, downloading images for each chapter and compiling them into a structured directory and packaging them into CBZ files.

The core idea is **probe-first**: start with the simplest approach (fetch + cheerio for SSR sites), escalate to Playwright for JS-rendered sites, inspect network traffic for API-based sites, and use stealth techniques for anti-bot sites. Adapt to what you find rather than guessing.

## Required Integration Skills

This skill works in combination with superpowers skills for structured execution:

- **superpowers:writing-plans** — create a task-level implementation plan before probing
- **superpowers:executing-plans** — step-by-step execution with verification checkpoints
- **superpowers:subagent-driven-development** — **ALWAYS** dispatch fresh subagents per task; inline execution is not allowed

**Workflow:**

```
Plan (writing-plans) → Subagent per task → Review → Next task
```

## Dependencies

**Runtime:** Node.js + `npx tsx` for running TypeScript directly.  
**Package manager:** `pnpm` (add deps with `pnpm add <pkg>`).  
**Key libs**:

- `cheerio` for HTML parsing
- `playwright` for SPA sites
- `archiver` or system `zip` for CBZ generation

---

## Step 0: Create Implementation Plan

Before probing the site, create a structured plan using writing-plans methodology.

**Task breakdown template:**

```
### Task 1: Probe Site Structure
  - Try SSR, SPA, API, anti-bot as needed
  - Identify chapter list source and image URL selectors

### Task 2: Understand Structure & Write Adapter
  - Extract chapter list pattern
  - Write adapter script (fetchChapterUrls + scrapeChapterImages)
  - Test on a single chapter

### Task 3: Download All Chapters & Generate CBZ
  - Run adapter with batching for image downloads
  - Zip each chapter folder into a .cbz file
  - Handle errors and rate limiting

### Task 4: Generate Output & Metadata
  - Save metadata.json
  - Download cover
  - Verify result sizes/counts
```

---

## Step 1: Probe the Site

### 1A. Try SSR (fetch)

- Fetch the page to check if it's SSR or if it uses anti-bot (Cloudflare, etc.) or SPA.

### 1B. Try SPA (Playwright)

- If the content/images are loaded dynamically via JS, use Playwright to load the page and extract the image URLs.

---

## Step 2: Understand the Structure

### 2A. Chapter List

Determine how to get all chapter URLs.

### 2B. Chapter Images

Identify selectors for the images of a chapter. Commonly, it is a list of `<img>` tags inside a reader area.

- Exclude ads, logos, social sharing icons, and navigation buttons.
- Extract the `src` or `data-src` attribute from valid comic page images.

---

## Step 3: Write the Adapter

Write the adapter at `{domain}/scrape-{domain}.ts`.

### Adapter Template

```ts
import * as cheerio from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function domainFromUrl(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "").split(".")[0];
}

interface ChapterLink {
  num: string;
  title: string;
  url: string;
}

interface NovelMeta {
  title: string;
  author?: string;
  description?: string;
  coverUrl?: string;
  totalChapters: number;
}

// ... Implement metadata & image scraping logic ...

async function downloadImage(
  url: string,
  dest: string,
  retries = 3,
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const buf = await res.arrayBuffer();
      await writeFile(dest, new Uint8Array(buf));
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

async function createCbz(dirPath: string, cbzPath: string): Promise<void> {
  try {
    // Try system zip command first (fast and robust on linux)
    execSync(`zip -j -r "${cbzPath}" "${dirPath}"/*`);
  } catch (e) {
    console.error("Failed to create CBZ using system zip:", e);
    throw e;
  }
}

// ... Main runner ...
```

---

## Step 4: Run the Adapter & Verify

- Run `npx tsx {domain}/scrape-{domain}.ts {series-url}`.
- Verify directories are created and populated with zero-padded images (e.g., `001.jpg`, `002.jpg`).
- Verify `.cbz` files are successfully built.
