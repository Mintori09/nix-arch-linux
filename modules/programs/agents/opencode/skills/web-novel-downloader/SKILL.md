---
name: web-novel-downloader
description: >
  Web novel downloader — download complete novels from any website as markdown.
  ALWAYS use this skill when a user provides a URL to a novel/series page and asks you to download, scrape, crawl,
  save, or extract chapters. This includes Vietnamese phrases like "download truyện", "lấy chapter", "tải bộ này",
  "scrape", "crawl novel", or just pasting a URL with context like "giúp tôi" or "download dùm".
  Works with any novel website by dynamically analyzing the site structure — SSR (fetch+cheerio), SPA (Playwright),
  or API-based. Do NOT assume a specific domain; analyze each site fresh.
  **Requires:** superpowers:writing-plans, superpowers:executing-plans, superpowers:subagent-driven-development
---

# Web Novel Downloader

## How This Skill Works

Your job: given a URL to a novel/series page, produce a complete download of all available chapters as markdown files.

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
**Key libs** (check `package.json` first — most are already installed):

- `cheerio` for HTML parsing
- `turndown` for HTML→Markdown conversion
- `playwright` for SPA sites (available via tools if not in deps)
- `node-html-parser` (lightweight alternative, sometimes present)
- `epub-gen` for epub generation (only if you need epub output)

If a lib is missing: `pnpm add cheerio turndown epub-gen` (or whatever's needed).

---

## Step 0: Create Implementation Plan

Before probing the site, create a structured plan using writing-plans methodology.

**Task breakdown template:**

```
### Task 1: Probe Site Structure
  - Try SSR, SPA, API, anti-bot as needed
  - Identify chapter list source and content container

### Task 2: Understand Structure & Write Adapter
  - Extract chapter list pattern
  - Write adapter script (fetchChapterUrls + scrapeChapter)
  - Test on a single chapter

### Task 3: Download All Chapters
  - Run adapter with batching
  - Handle errors, premium detection

### Task 4: Generate Output
  - Save metadata.json
  - Download cover
  - Generate epub

### Task 5: Verify Results
  - Check count, content, formatting
```

- [ ] Create task-level plan matching the site's specific patterns
- [ ] Save plan to `docs/superpowers/plans/YYYY-MM-DD-download-{novel-slug}.md`
- [ ] **Execute using subagent-driven-development** (dispatch one subagent per task)
- [ ] Do NOT skip to probing — plan first

---

## Step 1: Probe the Site

### 1A. Try SSR (fetch)

- [ ] Fetch the series page with a realistic User-Agent header:
  ```ts
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });
  const html = await res.text();
  ```
- [ ] Check if the HTML contains actual content:
  - Look for chapter title tags (`h1`, `.entry-title`, `.post-title`)
  - Look for a content container (`article`, `.entry-content`, `.epcontent`, `#reader-area`)
  - Look for chapter links in the body
- [ ] If **403/503** or response body contains `cf-challenge`, `Cloudflare`, `just a moment`, `Checking your browser` → skip to **1D** (anti-bot)
- [ ] If the HTML body is mostly empty / just JS bundles / `<div id="root">` with no content → this is an **SPA**. Go to **1B**

### 1B. Try SPA (Playwright)

- [ ] Use `playwright_browser_navigate` to load the URL
- [ ] Use `playwright_browser_snapshot` to see the rendered page
- [ ] Use `playwright_browser_network_requests` to check for API calls fetching chapter data
- [ ] Extract data via `playwright_browser_evaluate` if the data is in JS variables or window objects
- [ ] If Playwright also hits a Cloudflare challenge → go to **1D**

### 1C. Look for API Endpoints

- [ ] Check network requests for JSON/XHR endpoints
- [ ] Look for patterns like `/api/series/{id}/chapters`, `/wp-json/wp/v2/posts`
- [ ] If found, use fetch directly on the API (much faster)

### 1D. Anti-Bot Bypass (Cloudflare / Datadome)

Signs to look for:

- Response status 403 or 503
- HTML body: `<title>Just a moment...</title>`, `cf-browser-verification`, `challenge-form`
- Playwright shows "Checking your browser before accessing..."

- [ ] **Playwright Stealth approach (try first):**
  ```ts
  await playwright_browser_navigate(url);
  await playwright_browser_wait_for({ time: 5 });
  const snapshot = await playwright_browser_snapshot();
  ```
- [ ] If challenge resolves, proceed normally
- [ ] **If not, try custom headers via fetch:**
  ```ts
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: new URL(url).origin + "/",
    },
  });
  ```
- [ ] **Fallback:** If all methods fail, tell the user the site has anti-bot protection that couldn't be bypassed. Suggest manual browser access to solve CAPTCHA, then retry.

### ✓ Verification Checkpoint A

After probing, confirm before proceeding:

- [ ] Can access site content successfully?
- [ ] Identified chapter list source (series page list / numeric URL pattern / paginated API)?
- [ ] Identified content extraction method (SSR fetch+cheerio / Playwright / API fetch)?

If blocked or can't determine structure → **STOP and report to user**. Do not proceed.

---

## Step 2: Understand the Structure

### 2A. Chapter List

You need to figure out how to get all chapter URLs. Common patterns:

- [ ] **Pattern A — List on series page:** The series page itself contains links to all chapters.
      Look for: `#chapter-list a`, `.eplister ul li a`, `.chapter-list a`, any list of links with sequential numbering
      Extract href + chapter number + title

- [ ] **Pattern B — Numeric URL pattern:** Chapters follow `/series/{slug}/chapter-{N}` or `/novel/{novel}/chapter/{N}`
      Determine range (1 to total). Total may be on series page as "All (123)" or "Free (100)"

- [ ] **Pattern C — Paginated list:** Chapters spread across multiple pages.
      Check for "next page" / "load more" links. Paginate through to collect all URLs.
      Or check for API endpoints returning paginated JSON.

### 2B. Single Chapter Page

For each chapter page, determine:

- [ ] **Title selector:** `h1`, `.entry-title`, `.post-title`, `main button span span`, or `title` tag
- [ ] **Content container:** `article`, `.epcontent.entry-content`, `.entry-content`, `#reader-area`, `p.para` parent, `.chapter-content`, `#chapter-content`
- [ ] **Noise to remove:** `script`, `style`, `nav`, `button`, `svg`, `iframe`, `.sharedaddy`, `#jp-post-flair`, `.code-block`, `.wpcnt`, navigation links, social sharing widgets, hidden watermark spans

### 2C. Metadata & Cover Extraction

While on the series page, also extract metadata for epub generation:

- [ ] **Title:** `h1`, `meta[property="og:title"]`
- [ ] **Author:** `meta[property="books:author"]`, `meta[name="author"]`, `.author`, `.entry-author`
- [ ] **Description:** `meta[property="og:description"]`, `meta[name="description"]`, `.summary`, `.series-summary`
- [ ] **Cover:** `meta[property="og:image"]`, `.attachment-thumbnail`, `.series-cover img`, `.novel-cover img`
- [ ] **Genres:** `.genre a`, `.genres a`, `a[rel='tag']`
- [ ] **Status:** text pattern like `Status: Ongoing/Completed` (including Vietnamese: `Đang ra`, `Hoàn thành`)

### 2D. Premium/Locked Detection

Some sites lock chapters behind paywalls:

- [ ] Look for `"is_premium": true` in the HTML
- [ ] Look for elements with class `.mycred-price`, `.locked`, `.premium`
- [ ] Check for missing content area (falls short of expected length)
- [ ] Skip premium chapters by default; note them in the output

---

## Step 3: Write the Adapter

### 3A. Check for Existing Code

- [ ] Look in the project for existing adapters at `{domain}/scrape-{domain}.ts`
- [ ] If the domain already has one, use it directly. Skip to Step 4.
- [ ] Otherwise, write a new one.

### 3B. Derive Paths

Before writing the adapter, derive these from the URL:

- [ ] `domain` = hostname (e.g. `novelshaven` from `https://novelshaven.com/...`)
- [ ] `novelSlug` = slugified series name from the series page

### 3C. Adapter Template — SSR Sites

Follow this pattern. The key insight: each adapter is just three things — a way to find chapters, a way to extract content from a chapter page, and a main loop that connects them.

- [ ] Write adapter script using the template below, customizing `fetchChapterUrls()` and `scrapeChapter()`:

```ts
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

// --- METADATA ---

interface NovelMeta {
  title: string;
  author?: string;
  description?: string;
  coverUrl?: string;
  genres?: string[];
  status?: string;
  totalChapters: number;
  freeChapters: number;
}

async function extractSeriesMeta(seriesUrl: string): Promise<NovelMeta> {
  const res = await fetch(seriesUrl, { headers: UA });
  const $ = cheerio.load(await res.text());
  const bodyText = $("body").text();

  const title =
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  const coverUrl =
    $('meta[property="og:image"]').attr("content") ||
    $(
      ".attachment-thumbnail, .series-cover img, .novel-cover img, .wp-post-image",
    )
      .first()
      .attr("src");

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    $(".series-summary, .summary, .description").first().text().trim();

  const author =
    $('meta[property="books:author"]').attr("content") ||
    $('meta[name="author"]').attr("content") ||
    $(".author, .entry-author").first().text().trim();

  const genres: string[] = [];
  $(".genre a, .genres a, a[rel='tag']").each((_, el) => {
    const g = $(el).text().trim();
    if (g) genres.push(g);
  });

  const statusMatch = bodyText.match(
    /(?:Status|Tiến độ|Tình trạng)\s*:?\s*(Ongoing|Completed|Oneshot|Đang ra|Hoàn thành|Đã hoàn)/i,
  );
  let status = statusMatch?.[1];
  if (status === "Đang ra") status = "Ongoing";
  else if (status === "Hoàn thành" || status === "Đã hoàn")
    status = "Completed";

  const allMatch = bodyText.match(/All\s*\(\s*(\d+)\s*\)/i);
  const freeMatch = bodyText.match(/Free\s*\(\s*(\d+)\s*\)/i);

  return {
    title: title || "Unknown",
    totalChapters: allMatch ? parseInt(allMatch[1], 10) : 0,
    freeChapters: freeMatch ? parseInt(freeMatch[1], 10) : 0,
    author,
    description,
    coverUrl,
    genres: genres.length ? genres : undefined,
    status,
  };
}

// --- SITE-SPECIFIC: customize these two functions ---

async function fetchChapterUrls(seriesUrl: string): Promise<ChapterLink[]> {
  const res = await fetch(seriesUrl, { headers: UA });
  const $ = cheerio.load(await res.text());
  const links: ChapterLink[] = [];
  $("YOUR-LIST-SELECTOR").each((_, el) => {
    const href = $(el).attr("href");
    // extract chapter number and title
    links.push({ num, title, url });
  });
  return links;
}

async function scrapeChapter(
  url: string,
): Promise<{ title: string; body: string } | null> {
  const res = await fetch(url, { headers: UA });
  const $ = cheerio.load(await res.text());

  // check premium
  if ($("body").text().includes('"is_premium":true')) return null;

  const title = $("h1, .entry-title").first().text().trim();
  const content = $("YOUR-CONTENT-SELECTOR").first();
  content.find("script, style, nav, button, svg, iframe, .sharedaddy").remove();

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const body = turndown.turndown(content.html() || "").trim();
  return { title, body };
}

// --- COVER ---

async function downloadCover(
  url: string | undefined,
  outDir: string,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    const ext = ct.includes("png")
      ? "png"
      : ct.includes("webp")
        ? "webp"
        : "jpg";
    const buf = await res.arrayBuffer();
    const filename = `cover.${ext}`;
    await writeFile(join(outDir, filename), new Uint8Array(buf));
    return filename;
  } catch {
    return null;
  }
}

// --- EPUB ---

async function generateEpub(
  outDir: string,
  meta: NovelMeta,
  chapters: Array<{ title: string; body: string }>,
  coverFilename: string | null,
): Promise<void> {
  const { default: EPub } = await import("epub-gen");

  const contentHtml = chapters.map((ch) => {
    const turndown = new TurndownService({ headingStyle: "atx" });
    const html = ch.body.replace(/\n\n/g, "</p><p>");
    return {
      title: ch.title,
      data: `<h1>${ch.title}</h1><p>${html}</p>`,
    };
  });

  const opt = {
    title: meta.title,
    author: meta.author || "Unknown",
    cover: coverFilename ? join(outDir, coverFilename) : undefined,
    description: meta.description,
    showContents: true,
    content: contentHtml,
  };

  const epubPath = join(outDir, `${slugify(meta.title)}.epub`);
  await new EPub(opt, epubPath).promise;
  console.log(`  Epub saved: ${epubPath}`);
}

// --- SAVE METADATA ---

async function saveMetaJson(
  outDir: string,
  meta: NovelMeta,
  coverFilename?: string | null,
): Promise<void> {
  const { totalChapters, freeChapters, coverUrl, ...rest } = meta;
  const printable: Record<string, unknown> = {
    ...rest,
    totalChapters,
    freeChapters,
  };
  if (coverFilename) printable["cover-image"] = coverFilename;
  await writeFile(
    join(outDir, "metadata.json"),
    JSON.stringify(printable, null, 2),
    "utf8",
  );
}

// --- MAIN ---

async function main() {
  const seriesUrl = process.argv[2];
  if (!seriesUrl) {
    console.error("Usage: npx tsx <this-file>.ts <series-url>");
    process.exit(1);
  }

  const domain = domainFromUrl(seriesUrl);

  // 1. Extract metadata from series page
  console.log("Extracting series metadata...");
  const meta = await extractSeriesMeta(seriesUrl);
  console.log(`  Title: ${meta.title}`);
  if (meta.author) console.log(`  Author: ${meta.author}`);
  console.log(
    `  Chapters: ${meta.freeChapters} free / ${meta.totalChapters} total`,
  );

  // 2. Derive paths
  const novelSlug = slugify(meta.title);
  const outDir = join(domain, novelSlug);
  await mkdir(outDir, { recursive: true });

  // 3. Download cover
  const coverFile = meta.coverUrl
    ? await downloadCover(meta.coverUrl, outDir)
    : null;
  if (coverFile) console.log(`  Cover saved: ${coverFile}`);

  // 4. Fetch chapter list
  const chapters = await fetchChapterUrls(seriesUrl);
  console.log(`Found ${chapters.length} chapters`);

  // ... download loop (batching, error handling) ...
  const downloaded: Array<{ title: string; body: string }> = [];
  // (populate downloaded with results from scrapeChapter)

  // 5. Save metadata.json (includes cover-image field)
  await saveMetaJson(outDir, meta, coverFile);

  // 6. Generate epub
  await generateEpub(outDir, meta, downloaded, coverFile);

  console.log("Done! Check outDir for output.");
}

main();
```

- [ ] **For SPA sites**, use Playwright + browser tools instead of fetch+cheerio:
  ```ts
  await browser_navigate(url);
  const data = await browser_evaluate(target: "body", function: `
    () => {
      const title = document.querySelector("h1")?.textContent?.trim() || "";
      const content = document.querySelector(".chapter-content")?.innerHTML || "";
      return { title, content };
    }
  `);
  ```

### 3D. Shared Utilities

- [ ] Include these inline in new adapter files:
  - `slugify(text)` — convert text to filename-safe slug
  - `domainFromUrl(url)` — extract hostname prefix from URL
  - `extractChapterNum(url)` — extract chapter number, zero-pad to 3 digits
  - `buildFilename(title, url)` — produce `chapter-{NNN}-{slug}.md`
  - `sleep(ms)` — delay helper for rate limiting
  - `extractSeriesMeta(url)` — returns `NovelMeta`
  - `downloadCover(url, outDir)` — download cover image
  - `saveMetaJson(outDir, meta)` — write `metadata.json`
  - `generateEpub(outDir, meta, chapters, coverFilename?)` — create epub

- [ ] File naming: `chapter-{NNN}-{slugified-title}.md` where NNN is zero-padded

### 3E. Output Format

Each chapter file:

```markdown
# {Chapter Title}

{chapter body in markdown}
```

Output directory structure:

```
{domain}/
  scrape-{domain}.ts            # adapter (saved once)
  {novel-slug}/                 # created per download
    cover.{ext}                 # cover image (if available)
    metadata.json               # series metadata
    {novel-slug}.epub           # generated epub
    chapter-001-title.md
    chapter-002-title.md
    ...
```

### 3F. Preserving Images (Light Novels)

- [ ] Check that `<img>` elements survive noise removal step
- [ ] If images missing after conversion, add custom Turndown rule:
  ```ts
  turndown.addRule("preserveImages", {
    filter: "img",
    replacement(content, node) {
      const el = node as HTMLElement;
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "";
      return src ? `\n\n![${alt}](${src})\n\n` : "";
    },
  });
  ```

### 3G. Batching & Concurrency

- [ ] Use batched concurrency instead of sequential loading:

  ```ts
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 2000;

  async function downloadAll(chapters: ChapterLink[], outDir: string) {
    let success = 0,
      skipped = 0;
    const failed: Array<{ num: string; reason: string }> = [];

    for (let i = 0; i < chapters.length; i += BATCH_SIZE) {
      const batch = chapters.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((ch) => scrapeAndSave(ch, outDir)),
      );

      for (let j = 0; j < results.length; j++) {
        const idx = i + j;
        const ch = chapters[idx];
        const r = results[j];
        if (r.status === "fulfilled") {
          if (r.value === null) skipped++;
          else success++;
        } else {
          failed.push({
            num: ch.num,
            reason: r.reason?.message || String(r.reason),
          });
        }
      }

      if (i + BATCH_SIZE < chapters.length) await sleep(BATCH_DELAY_MS);
    }

    return { success, skipped, failed };
  }
  ```

- [ ] Adjust `BATCH_SIZE` (3-10) and `BATCH_DELAY_MS` (1000-3000) based on site aggressiveness

### 3H. Error Handling

- [ ] Catch per-chapter errors so one failure doesn't stop the whole batch
- [ ] Track success/skipped/failed counters
- [ ] Report summary at the end
- [ ] For I/O, use `writeFile` from `node:fs/promises`:
  ```ts
  import { mkdir, writeFile } from "node:fs/promises";
  import { join } from "node:path";
  ```

### 3I. Metadata JSON & Cover Image

- [ ] Save `metadata.json` after downloading (includes `cover-image` if cover was saved):

  ```ts
  interface NovelMeta {
    title: string;
    author?: string;
    description?: string;
    coverUrl?: string;
    genres?: string[];
    status?: string;
    totalChapters: number;
    freeChapters: number;
  }

  async function saveMetaJson(
    outDir: string,
    meta: NovelMeta,
    coverFilename?: string | null,
  ): Promise<void> {
    const { coverUrl, ...rest } = meta;
    const printable: Record<string, unknown> = { ...rest };
    if (coverFilename) printable["cover-image"] = coverFilename;
    await writeFile(
      join(outDir, "metadata.json"),
      JSON.stringify(printable, null, 2),
      "utf8",
    );
  }
  ```

- [ ] Download cover image:
  ```ts
  async function downloadCover(
    url: string | undefined,
    outDir: string,
  ): Promise<string | null> {
    if (!url) return null;
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") || "";
      const ext = ct.includes("png")
        ? "png"
        : ct.includes("webp")
          ? "webp"
          : "jpg";
      const buf = await res.arrayBuffer();
      const filename = `cover.${ext}`;
      await writeFile(join(outDir, filename), new Uint8Array(buf));
      return filename;
    } catch {
      return null;
    }
  }
  ```

### 3J. Epub Generation

- [ ] Install if missing: `pnpm add epub-gen`
- [ ] Generate epub after chapters are downloaded:

  ```ts
  async function generateEpub(
    outDir: string,
    meta: NovelMeta,
    chapters: Array<{ title: string; body: string }>,
    coverFilename: string | null,
  ): Promise<void> {
    const { default: EPub } = await import("epub-gen");

    const content = chapters.map((ch) => ({
      title: ch.title,
      data: `<h1>${ch.title}</h1><p>${ch.body.replace(/\n\n/g, "</p><p>")}</p>`,
    }));

    const opt = {
      title: meta.title,
      author: meta.author || "Unknown",
      cover: coverFilename ? join(outDir, coverFilename) : undefined,
      description: meta.description,
      showContents: true,
      content,
    };

    const epubPath = join(outDir, `${slugify(meta.title)}.epub`);
    await new EPub(opt, epubPath).promise;
    console.log(`  Epub saved: ${epubPath}`);
  }
  ```

- [ ] Integration in `main()`:
  ```ts
  // 1. Extract metadata
  const meta = await extractSeriesMeta(seriesUrl);
  // 2. Download cover (first, so it's available for epub)
  const coverFile = meta.coverUrl
    ? await downloadCover(meta.coverUrl, outDir)
    : null;
  // 3. Download chapters, collect into `downloaded` array
  // 4. Save metadata (includes cover-image field)
  await saveMetaJson(outDir, meta, coverFile);
  // 5. Generate epub
  await generateEpub(outDir, meta, downloaded, coverFile);
  ```

### ✓ Verification Checkpoint B

After writing the adapter, verify before downloading all chapters:

- [ ] Adapter file exists at `{domain}/scrape-{domain}.ts`
- [ ] `fetchChapterUrls()` uses the correct selectors for this site
- [ ] `scrapeChapter()` correctly identifies content container
- [ ] Premium/locked detection is configured
- [ ] Noise removal covers site-specific elements
- [ ] Run on a single chapter: `npx tsx {domain}/scrape-{domain}.ts {single-chapter-url}` returns non-empty markdown

If adapter fails on a single chapter → **STOP and debug**. Do not proceed to full download.

---

## Step 4: Run the Adapter

- [ ] Run the adapter:
  ```bash
  npx tsx {domain}/scrape-{domain}.ts {series-url}
  ```
- [ ] If the adapter uses epub generation, ensure `epub-gen` is installed:
  ```bash
  pnpm add epub-gen
  ```
- [ ] Verify output directory `{domain}/{novel-slug}/` exists and contains `.md` files
- [ ] Spot-check 1-2 files to ensure content is non-empty and properly formatted
- [ ] If the adapter already exists from a prior download, reuse it — no need to rewrite

### ✓ Verification Checkpoint C

- [ ] Chapter count downloaded matches expectations (free vs total)
- [ ] Files follow consistent zero-padded naming pattern
- [ ] Cover image exists (if available)
- [ ] `metadata.json` has correct title/author and `cover-image` field (if cover existed)
- [ ] Epub file exists and is non-empty (if epub generation enabled)

---

## Step 5: Final Verification

Before declaring done, confirm all items:

- [ ] Confirm the chapter count matches expectations (free vs total)
- [ ] Open a random chapter file and verify it has content beyond just the title
- [ ] Verify `metadata.json` exists with correct title/author and `cover-image` field (if cover existed)
- [ ] If a cover was available, check `cover.{ext}` exists and is a valid image
- [ ] If epub generation was enabled, verify the `.epub` file exists and is non-empty
- [ ] Ensure the filename pattern is consistent (zero-padded for sorting)
- [ ] If the novel has images, spot-check that `<img>` tags were preserved

If any check fails → **fix the issue** (update adapter and re-run) before declaring complete.
Then add to justfile command to run this scripts or create justfile (if not exist).

---

## Execution

**REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development

```
Plan → Subagent per task → Review → Next task
```

**Rules:**

- Always create the plan first (Step 0) — never skip
- Always dispatch a fresh subagent per task
- After each task completes, review output before dispatching next
- If a task hits a blocker, STOP and report to user
- Do NOT use inline execution

Task breakdown:

```
Task 1: Probe Site Structure
Task 2: Understand Structure & Write Adapter
Task 3: Download All Chapters
Task 4: Generate Output (metadata, cover, epub)
Task 5: Verify Results
```

---

## Common Patterns Reference

### WordPress (.wordpress.com, or self-hosted)

- Content: `.entry-content`, `.post-content`, `.post-entry`, `article`, `.wp-block-post-content`
- Chapter list: often via numeric URL pattern, or custom theme selectors
- Noise: `.sharedaddy`, `#jp-post-flair`, `.wpcnt`, `.wp-block-spacer`, `.wp-block-post-comments`

### Custom Novel Hosting (novelshaven, nobadnovel, etc.)

- Content: `article`, `.epcontent.entry-content`, `#reader-area`, `p.para` parent, `article.chapter-content`
- Chapter list: series page has list, or URLs follow `/series/{slug}/chapter-{N}` pattern
- Premium: check HTML for `is_premium`, `.mycred-price`, `.locked` class

### SPA / JS-Rendered

- Content hidden behind JS rendering
- Use Playwright to load and extract
- Check network tab for API endpoints that return JSON with chapter data
- The API itself may accept `fetch` directly once discovered

---

## When Things Go Wrong

- **403 Forbidden**: Add/rotate User-Agent, add `Accept`, `Referer` headers; or try Step 1D anti-bot
- **503 / Cloudflare challenge**: Go to Step 1D (Playwright stealth, custom headers, proxy as last resort)
- **Empty content after fetch**: Try Playwright (the site is probably SPA)
- **Chapter list incomplete**: Check for pagination, "load more" buttons, or API pagination
- **Rate limited**: Increase `BATCH_DELAY_MS`, reduce `BATCH_SIZE`, add jitter to timing
- **Can't find content selector**: Use Playwright to inspect the rendered DOM; look for the element with the largest text block
- **Turndown throws error on HTML**: The content container may not have `innerHTML`; fall back to `$.html()` on a parent element

## Design Philosophy

This skill works best when you think of each novel website as a puzzle with a few key pieces:

1. Where do chapters live? (list source)
2. What does a chapter page look like? (content extraction)
3. How do you get from 1 to N? (iteration strategy)
4. How do you get past the front door? (anti-bot)

The answers vary per site, but the approach is always the same: probe, analyze, adapt, execute. The existing adapters in the project are your best reference — they show patterns that have worked before.
