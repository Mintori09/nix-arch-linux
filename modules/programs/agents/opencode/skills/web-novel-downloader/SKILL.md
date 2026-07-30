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

### 1D. Anti-Bot Bypass (Cloudflare / Datadome / Turnstile)

**First, classify the block type** — this determines which bypass tier to use:

| Dấu hiệu | Loại |
|----------|------|
| Status `403` + header `cf-mitigated: challenge` | JS challenge |
| Status `503` + `<title>Just a moment...</title>` | JS challenge |
| Body contains `cf-browser-verification`, `challenge-form` | Turnstile / challenge |
| Connection reset / timeout at TLS handshake | TLS fingerprint block |
| Status `429` / `1020` / `1015` | Rate limit / WAF rule |

Use a helper to detect:

```ts
function isCFChallenge(html: string): boolean {
  return (
    html.includes("cf-browser-verification") ||
    html.includes("challenge-form") ||
    html.includes("__cf_chl_f_tk") ||
    html.includes("cf_challenge") ||
    /<title>Just a moment/i.test(html) ||
    html.includes("Checking your browser")
  );
}
```

**Then run the bypass pipeline** (4 tiers, tried in order):

---

#### Tier 1 — Enhanced fetch with cookie jar

- [ ] **Use a CookieJar + realistic headers** for all fetch calls. Most Cloudflare blocks at this level are from missing/incorrect headers, not TLS:

```ts
class CookieJar {
  private map = new Map<string, string>();

  set(url: string, rawHeaders: string[] | undefined) {
    if (!rawHeaders) return;
    const domain = new URL(url).hostname;
    for (const raw of rawHeaders) {
      const parts = raw.split(";")[0]; // name=value
      const eq = parts.indexOf("=");
      if (eq === -1) continue;
      const key = `${domain}:${parts.slice(0, eq)}`;
      this.map.set(key, parts);
    }
  }

  getHeader(url: string): string {
    const domain = new URL(url).hostname;
    const cookies: string[] = [];
    for (const [k, v] of this.map) {
      if (k.startsWith(domain + ":")) cookies.push(v);
    }
    return cookies.join("; ");
  }
}
```

- [ ] Build a `fetchWithCookies()` that auto-attaches cookies and saves Set-Cookie:

```ts
async function fetchWithCookies(
  url: string,
  jar: CookieJar,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const cookie = jar.getHeader(url);
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
    ...(cookie ? { Cookie: cookie } : {}),
    ...extraHeaders,
  };
  const res = await fetch(url, { headers });
  jar.set(url, res.headers.getSetCookie?.());
  return res;
}
```

> If using an older Node.js without `getSetCookie()`, polyfill: `const raw = res.headers.get("set-cookie"); if (raw) jar.set(url, [raw]);`

- [ ] Try Tier 1: `const res = await fetchWithCookies(url, jar);`
- [ ] If `res.ok` and HTML has actual content → done
- [ ] If `403`/`503` and `isCFChallenge(html)` → continue to **Tier 2**

---

#### Tier 2 — TLS fingerprint spoofing (impit)

Cloudflare checks JA3/JA4 TLS fingerprints — Node's built-in `fetch` has a distinctive signature. `impit` mimics Chrome's TLS handshake byte-for-byte.

- [ ] `pnpm add impit`
- [ ] Use impit as the HTTP client:

```ts
let _impit: any = null;
async function getImpit() {
  if (!_impit) {
    const { Impit } = await import("impit");
    _impit = new Impit({ browser: "chrome" });
  }
  return _impit;
}

async function fetchWithImpit(
  url: string,
  jar: CookieJar,
): Promise<{ html: string; ok: boolean }> {
  const impit = await getImpit();
  const cookie = jar.getHeader(url);
  const res = await impit.fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const html = await res.text();
  // impit returns headers as a plain object
  const setCookie = res.headers["set-cookie"];
  if (setCookie) jar.set(url, Array.isArray(setCookie) ? setCookie : [setCookie]);
  return { html, ok: res.ok ?? res.status < 400 };
}
```

- [ ] If `isCFChallenge(html)` still → continue to **Tier 3**

---

#### Tier 3 — Playwright stealth (headless → headed fallback)

When HTTP-level bypasses fail, use a real browser. The strategy: **start headless, fall back to headed**.

- [ ] Install if missing: `pnpm add playwright`
- [ ] Launch with anti-detection args:

```ts
import { chromium } from "playwright";

async function launchStealthBrowser() {
  const width = 1280 + Math.floor(Math.random() * 200);
  const height = 720 + Math.floor(Math.random() * 100);
  return chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      `--window-size=${width},${height}`,
    ],
  });
}
```

- [ ] **Solve the challenge** — navigate and wait for `cf_clearance` cookie:

```ts
async function solveChallenge(
  browser: any,
  url: string,
  jar: CookieJar,
): Promise<boolean> {
  const context = await browser.newContext({
    viewport: { width: 1280 + Math.floor(Math.random() * 200), height: 720 + Math.floor(Math.random() * 100) },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    locale: "en-US",
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    // Wait for cf_clearance cookie (signal that challenge passed)
    const cfClearance = await page.waitForFunction(
      () => document.cookie.includes("cf_clearance"),
      { timeout: 30000 },
    ).then(() => true).catch(() => false);

    if (cfClearance) {
      // Save cookies into jar
      const cookies = await context.cookies();
      for (const c of cookies) {
        // set-cookie format: name=value; Domain=...
        jar.set(url, [`${c.name}=${c.value}`]);
      }
      return true;
    }
    return false;
  } finally {
    await page.close();
    await context.close();
  }
}
```

- [ ] **Headless attempt:**
  ```ts
  const browser = await launchStealthBrowser();
  const solved = await solveChallenge(browser, url, jar);
  await browser.close();
  ```
- [ ] If solved → Tier 4 (cookie reuse)
- [ ] **If headless fails → try headed mode:**
  ```ts
  const headedBrowser = await chromium.launch({
    headless: false,  // visible browser window
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  const solvedHeaded = await solveChallenge(headedBrowser, url, jar);
  await headedBrowser.close();
  ```
  Headed mode is harder to detect — the browser process has actual window chrome, GPU compositing, and proper screen surface. Some Cloudflare challenges specifically check for headless-only signals.
- [ ] If still stuck (e.g., Turnstile CAPTCHA requiring manual solve) → tell user to solve manually in the visible window, then press Enter. After manual solve, cookies will be extracted.

---

#### Tier 4 — Cookie reuse (no browser for batch requests)

Once `cf_clearance` is in the jar, subsequent requests can use plain `fetch()` with the cookie — **no browser or impit needed**.

- [ ] The `fetchWithCookies()` from Tier 1 will auto-attach the cookie
- [ ] `cf_clearance` is typically valid for **15–30 minutes**
- [ ] For batch chapter downloads, this means only 1 Playwright launch for the whole batch

```ts
// After solving challenge, fetchChapterUrls and scrapeChapter use fetchWithCookies
const chapters = await fetchChapterUrls(seriesUrl, jar);  // Tier 4: fast fetch
for (const ch of chapters) {
  const data = await scrapeChapter(ch.url, jar);  // Tier 4: fast fetch
  // ...
}
```

**The CookieJar should be passed to all helpers** (`extractSeriesMeta`, `fetchChapterUrls`, `scrapeChapter`) instead of using the bare `UA` object.

---

#### Tier 5 — Manual fallback

- [ ] If all tiers fail: tell the user the site has anti-bot that couldn't be bypassed. Suggest:
  - Open the URL manually in a regular browser
  - Solve any CAPTCHA
  - Copy the page content or use browser devtools to save the HTML

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

// --- Cookie jar for Cloudflare cf_clearance reuse ---

class CookieJar {
  private map = new Map<string, string>();

  set(url: string, rawHeaders: string[] | undefined) {
    if (!rawHeaders) return;
    const domain = new URL(url).hostname;
    for (const raw of rawHeaders) {
      const parts = raw.split(";")[0];
      const eq = parts.indexOf("=");
      if (eq === -1) continue;
      this.map.set(`${domain}:${parts.slice(0, eq)}`, parts);
    }
  }

  getHeader(url: string): string {
    const domain = new URL(url).hostname;
    const cookies: string[] = [];
    for (const [k, v] of this.map) {
      if (k.startsWith(domain + ":")) cookies.push(v);
    }
    return cookies.join("; ");
  }
}

// --- Cloudflare bypass: Tier 1 — fetch with cookie support ---

async function fetchWithCookies(
  url: string,
  jar: CookieJar,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const cookie = jar.getHeader(url);
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
    ...(cookie ? { Cookie: cookie } : {}),
    ...extraHeaders,
  };
  const res = await fetch(url, { headers });
  // @ts-ignore - getSetCookie available in Node 22+
  jar.set(url, res.headers.getSetCookie?.());
  return res;
}

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

async function extractSeriesMeta(seriesUrl: string, jar: CookieJar): Promise<NovelMeta> {
  const res = await fetchWithCookies(seriesUrl, jar);
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

async function fetchChapterUrls(seriesUrl: string, jar: CookieJar): Promise<ChapterLink[]> {
  const res = await fetchWithCookies(seriesUrl, jar);
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
  jar: CookieJar,
): Promise<{ title: string; body: string } | null> {
  const res = await fetchWithCookies(url, jar);
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
  jar: CookieJar,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetchWithCookies(url, jar);
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
  const jar = new CookieJar();

  // 1. Extract metadata from series page
  console.log("Extracting series metadata...");
  const meta = await extractSeriesMeta(seriesUrl, jar);
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
    ? await downloadCover(meta.coverUrl, outDir, jar)
    : null;
  if (coverFile) console.log(`  Cover saved: ${coverFile}`);

  // 4. Fetch chapter list (uses cookies from metadata fetch)
  const chapters = await fetchChapterUrls(seriesUrl, jar);
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
    jar: CookieJar,
  ): Promise<string | null> {
    if (!url) return null;
    try {
      const res = await fetchWithCookies(url, jar);
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

- **403 / 503 (Cloudflare)**: Run the full bypass pipeline (1D) — Tier 1 (cookie jar), Tier 2 (impit TLS spoofing), Tier 3 (Playwright headless → headed)
- **TLS connection reset / timeout**: Likely TLS fingerprint block → `pnpm add impit` and use Tier 2
- **Headless Playwright gets blocked → still showing challenge**: Fall back to headed mode (Tier 3b) — real browser window passes more detection signals
- **`cf_clearance` cookie expires mid-batch**: Re-launch Playwright (Tier 3) once to refresh; batch likely finishes within 15-30 min
- **Empty content after fetch**: Try Playwright (the site is probably SPA)
- **Chapter list incomplete**: Check for pagination, "load more" buttons, or API pagination
- **Rate limited**: Increase `BATCH_DELAY_MS`, reduce `BATCH_SIZE`, add jitter to timing; rotate User-Agent
- **Can't find content selector**: Use Playwright to inspect the rendered DOM; look for the element with the largest text block
- **Turndown throws error on HTML**: The content container may not have `innerHTML`; fall back to `$.html()` on a parent element

## Design Philosophy

This skill works best when you think of each novel website as a puzzle with a few key pieces:

1. Where do chapters live? (list source)
2. What does a chapter page look like? (content extraction)
3. How do you get from 1 to N? (iteration strategy)
4. How do you get past the front door? (anti-bot)

The answers vary per site, but the approach is always the same: probe, analyze, adapt, execute. The existing adapters in the project are your best reference — they show patterns that have worked before.
