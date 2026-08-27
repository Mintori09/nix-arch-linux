import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { args, pathExists, COLORS } from "./utils.ts";
import {
  loadStyleConfig,
  loadReferenceDocConfig,
  resolveAlias,
  loadDefaults,
  CONFIG_DIR,
} from "./config.ts";
import { runCommand } from "./core/command.ts";
import { withSpinner } from "./ui/spinner.ts";
import { ROUTES } from "./routes.ts";
import { CliError } from "./errors.ts";
import {
  hasMermaidBlocks,
  tryPreprocessMermaid,
} from "./converters/mermaid.ts";
import {
  type ConvertContext,
  type ConversionFlags,
} from "./converters/index.ts";

const DEFAULT_CSS: Record<string, string> = {
  "pdf.css": `/* cv-cli default PDF style */
@page {
  size: A4;
  margin: 2cm;
}

body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 12pt;
  line-height: 1.6;
  color: #1a1a1a;
}

h1 { font-size: 2em; margin-top: 1.5em; margin-bottom: 0.5em; page-break-before: always; }
h1:first-child { page-break-before: avoid; }
h2 { font-size: 1.5em; margin-top: 1.2em; margin-bottom: 0.4em; }
h3 { font-size: 1.25em; margin-top: 1em; margin-bottom: 0.3em; }

p { margin: 0.5em 0; }

pre {
  background: #f5f5f5;
  padding: 0.8em;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-family: "Fira Code", "Cascadia Code", Consolas, monospace;
  font-size: 0.9em;
  page-break-inside: avoid;
  overflow-x: auto;
}

code {
  font-family: "Fira Code", "Cascadia Code", Consolas, monospace;
  font-size: 0.9em;
  background: #f5f5f5;
  padding: 0.15em 0.3em;
  border-radius: 2px;
}

pre code { background: none; padding: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  page-break-inside: avoid;
}

th, td {
  border: 1px solid #ccc;
  padding: 0.5em;
  text-align: left;
}

th { background: #f0f0f0; font-weight: bold; }

blockquote {
  margin: 0.5em 0;
  padding: 0 1em;
  border-left: 4px solid #ccc;
  color: #555;
}

img { max-width: 100%; height: auto; }

a { color: #0366d6; text-decoration: none; }
`,
  "html.css": `/* cv-cli default HTML style */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #1a1a1a;
  max-width: 800px;
  margin: 2em auto;
  padding: 0 1em;
  background: #fff;
}

h1 { font-size: 2em; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; margin-top: 1.2em; margin-bottom: 0.4em; }
h3 { font-size: 1.25em; margin-top: 1em; margin-bottom: 0.3em; }

p { margin: 0.5em 0; }

pre {
  background: #f6f8fa;
  padding: 1em;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  font-family: "SF Mono", "Fira Code", Consolas, monospace;
  font-size: 0.85em;
  overflow-x: auto;
}

code {
  font-family: "SF Mono", "Fira Code", Consolas, monospace;
  font-size: 0.85em;
  background: #f6f8fa;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

pre code { background: none; padding: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  display: block;
  overflow-x: auto;
}

th, td {
  border: 1px solid #dfe2e5;
  padding: 0.5em;
  text-align: left;
}

th { background: #f6f8fa; font-weight: 600; }

tr:nth-child(even) { background: #fafbfc; }

blockquote {
  margin: 0.5em 0;
  padding: 0 1em;
  border-left: 4px solid #dfe2e5;
  color: #6a737d;
}

img { max-width: 100%; height: auto; }

a { color: #0366d6; text-decoration: none; }
a:hover { text-decoration: underline; }

ul, ol { padding-left: 2em; }

hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
`,
  "docx2html.css": `/* cv-cli default docx-to-HTML style */
body {
  font-family: Calibri, "Segoe UI", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #222;
  max-width: 900px;
  margin: 2em auto;
  padding: 0 1em;
}

h1 { font-size: 2em; margin-top: 1.5em; margin-bottom: 0.3em; }
h2 { font-size: 1.5em; margin-top: 1.3em; margin-bottom: 0.3em; }
h3 { font-size: 1.25em; margin-top: 1.1em; margin-bottom: 0.3em; }

p { margin: 0.3em 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
}

th, td {
  border: 1px solid #999;
  padding: 0.3em 0.5em;
  text-align: left;
  vertical-align: top;
}

th { background: #eaeaea; font-weight: bold; }

tr:nth-child(even) { background: #f5f5f5; }

pre {
  background: #f5f5f5;
  padding: 0.5em;
  border: 1px solid #ccc;
  font-family: Consolas, "Courier New", monospace;
  font-size: 9pt;
  overflow-x: auto;
}

code {
  font-family: Consolas, "Courier New", monospace;
  font-size: 0.9em;
  background: #f4f4f4;
  padding: 0.1em 0.3em;
}

pre code { background: none; padding: 0; }

blockquote {
  margin: 0.3em 0;
  padding: 0 0.8em;
  border-left: 3px solid #bbb;
  color: #555;
}

ol, ul { padding-left: 2em; }

img { max-width: 100%; height: auto; }

a { color: #0563c1; text-decoration: underline; }
`,
};

async function ensureOutputDir(output: string): Promise<void> {
  await mkdir(path.dirname(output), { recursive: true });
}

async function assertToolAvailable(
  tool: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  try {
    await runCommand(["which", tool], { dryRun: false, captureStdout: true });
  } catch {
    throw new CliError(
      `${COLORS.RED}Missing dependency:${COLORS.NC} '${tool}' was not found in PATH.`,
    );
  }
}

function printSupportedRoutes(): void {
  console.log(`${COLORS.BLUE}Supported conversions:${COLORS.NC}`);
  for (const route of Object.keys(ROUTES).sort()) console.log(`- ${route}`);
}

function printUsage(): void {
  console.log(
    `${COLORS.YELLOW}Usage:${COLORS.NC} tsx src/index.ts [--dry-run] [--list] [--style=<file.css>] [--metadata-file=<file.json>] [--reference-doc=<file.docx>] [--toc] [--number-sections] [--wrap=<none|preserve>] [--extract-media=<dir>] [--page-size=<a3|a4|a5|letter|legal>] <input_file> <output_file> [...passthrough_args]`,
  );
  console.log(
    `       ${COLORS.YELLOW}cv init${COLORS.NC}        Initialize config directory at ${CONFIG_DIR}`,
  );
}

async function cmdInit(): Promise<void> {
  const stylesDir = path.join(CONFIG_DIR, "styles");
  await mkdir(stylesDir, { recursive: true });
  const cfgPath = path.join(CONFIG_DIR, "config.json");
  if (!existsSync(cfgPath)) {
    await writeFile(
      cfgPath,
      JSON.stringify(
        {
          styles: {
            blog: "~/projects/blog/theme.css",
          },
          referenceDocs: {
            modern: "~/templates/modern.docx",
          },
          defaults: {
            "md:pdf": {
              css: "~/.config/convert-file/styles/pdf.css",
              pageSize: "a4",
              toc: true,
              numberSections: false,
              metadataFile: "~/metadata.json",
              wrap: "none",
            },
            "md:html": {
              css: "~/.config/convert-file/styles/html.css",
              toc: true,
              numberSections: true,
              metadataFile: "~/metadata.json",
              wrap: "none",
              extractMedia: "./media",
            },
            "md:epub": {
              toc: true,
              numberSections: false,
              metadataFile: "~/metadata.json",
            },
            "docx:html": {
              css: "~/.config/convert-file/styles/docx2html.css",
              extractMedia: "./media",
            },
          },
        },
        null,
        2,
      ),
    );
  }
  for (const [name, content] of Object.entries(DEFAULT_CSS)) {
    const cssPath = path.join(stylesDir, name);
    if (!existsSync(cssPath)) await writeFile(cssPath, content);
  }
  console.log(`${COLORS.GREEN}Config initialized.${COLORS.NC}`);
  console.log(`  Config: ${cfgPath}`);
  console.log(`  Styles: ${stylesDir}/`);
  console.log(`\nEdit ${cfgPath} to customize defaults and style aliases.`);
  console.log(`CLI flags (--style, --toc, etc.) override defaults.`);
}

function extensionOf(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}

async function convertOne(
  input: string,
  output: string,
  passthroughArgs: string[],
  options: { dryRun: boolean; flags: ConversionFlags },
): Promise<void> {
  if (!(await pathExists(input)))
    throw new CliError(
      `${COLORS.RED}Error:${COLORS.NC} Input file '${input}' not found.`,
    );
  const inExt = extensionOf(input);
  const outExt = extensionOf(output);
  if (!inExt || !outExt)
    throw new CliError(
      `${COLORS.RED}Error:${COLORS.NC} Both input and output need file extensions.`,
    );
  let tempInput: string | undefined;
  if (!options.dryRun && (inExt === "md" || inExt === "markdown")) {
    const content = await readFile(input, "utf-8");
    if (hasMermaidBlocks(content)) {
      const preprocessed = await tryPreprocessMermaid(content, {
        dryRun: false,
      });
      if (preprocessed !== content) {
        const tdir = await mkdtemp(path.join(tmpdir(), "cv-mermaid-"));
        tempInput = path.join(tdir, "input.md");
        await writeFile(tempInput, preprocessed);
      }
    }
  }
  const actualInput = tempInput ?? input;
  const route = `${inExt}:${outExt}`;
  const routeDefaults = loadDefaults(route);
  for (const [key, val] of Object.entries(routeDefaults)) {
    const k = key as keyof ConversionFlags;
    if (options.flags[k] === undefined && val !== undefined) {
      (options.flags as Record<string, unknown>)[k] = val;
    }
  }
  const routeConfig = ROUTES[route];
  if (!routeConfig)
    throw new CliError(
      `${COLORS.RED}Unsupported conversion:${COLORS.NC} ${route}`,
    );
  const context: ConvertContext = {
    dryRun: options.dryRun,
    passthroughArgs,
    route,
    flags: options.flags,
  };
  await assertToolAvailable(routeConfig.tool, options.dryRun);
  await ensureOutputDir(output);
  try {
    await withSpinner(context, () =>
      routeConfig.convert(actualInput, output, context),
    );
  } finally {
    if (tempInput)
      await rm(path.dirname(tempInput), { recursive: true, force: true });
  }
  console.log(
    `\n${COLORS.GREEN}Conversion successful:${COLORS.NC} ${output}${options.dryRun ? " (dry-run)" : ""}`,
  );
}

const KNOWN_BOOLEANS = new Set<string>([
  "dry-run",
  "list",
  "help",
  "toc",
  "number-sections",
  "no-dry-run",
  "no-list",
  "no-help",
  "no-toc",
  "no-number-sections",
]);

const KNOWN_STRINGS = new Set<string>([
  "style",
  "metadata-file",
  "reference-doc",
  "wrap",
  "extract-media",
  "page-size",
]);

function isCvOption(arg: string): boolean {
  if (arg === "-h") return true;
  if (!arg.startsWith("--")) return false;
  const eqIdx = arg.indexOf("=");
  const name = eqIdx !== -1 ? arg.slice(2, eqIdx) : arg.slice(2);
  return KNOWN_BOOLEANS.has(name) || KNOWN_STRINGS.has(name);
}

function isCvStringOptionWithoutEquals(arg: string): boolean {
  if (!arg.startsWith("--")) return false;
  if (arg.includes("=")) return false;
  const name = arg.slice(2);
  return KNOWN_STRINGS.has(name);
}

function splitArgs(rawArgs: string[]): {
  cvArgs: string[];
  passthroughArgs: string[];
} {
  const cvArgs: string[] = [];
  const passthroughArgs: string[] = [];
  let positionalsCount = 0;
  let expectingValueFor: string | null = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === "--") {
      passthroughArgs.push(...rawArgs.slice(i + 1));
      break;
    }

    if (expectingValueFor !== null) {
      cvArgs.push(arg);
      expectingValueFor = null;
      continue;
    }

    if (isCvOption(arg)) {
      cvArgs.push(arg);
      if (isCvStringOptionWithoutEquals(arg)) {
        expectingValueFor = arg;
      }
    } else {
      if (positionalsCount < 2 && !arg.startsWith("-")) {
        cvArgs.push(arg);
        positionalsCount++;
      } else {
        passthroughArgs.push(arg);
      }
    }
  }

  return { cvArgs, passthroughArgs };
}

function preprocessNegatedFlags(
  rawArgs: string[],
  booleanNames: Set<string>,
): { filteredArgs: string[]; finalState: Map<string, boolean> } {
  const finalState = new Map<string, boolean>();
  const filteredArgs: string[] = [];
  const NEGATED_RE = /^--no-(.+)$/;
  const POSITIVE_RE = /^--([a-zA-Z][a-zA-Z0-9-]*)/;
  for (const arg of rawArgs) {
    const negMatch = arg.match(NEGATED_RE);
    if (negMatch && booleanNames.has(negMatch[1])) {
      finalState.set(negMatch[1], false);
      continue;
    }
    const posMatch = arg.match(POSITIVE_RE);
    if (posMatch && booleanNames.has(posMatch[1])) {
      finalState.set(posMatch[1], true);
    }
    filteredArgs.push(arg);
  }
  return { filteredArgs, finalState };
}

export async function run(): Promise<void> {
  const BOOLEAN_NAMES = new Set<string>([
    "dry-run",
    "list",
    "help",
    "toc",
    "number-sections",
  ]);
  const { cvArgs: splitCvArgs, passthroughArgs } = splitArgs(args);
  const { filteredArgs, finalState } = preprocessNegatedFlags(
    splitCvArgs,
    BOOLEAN_NAMES,
  );
  const parsed = parseArgs({
    args: filteredArgs,
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      style: { type: "string" },
      "metadata-file": { type: "string" },
      "reference-doc": { type: "string" },
      toc: { type: "boolean" },
      "number-sections": { type: "boolean" },
      wrap: { type: "string" },
      "extract-media": { type: "string" },
      "page-size": { type: "string" },
    },
  });
  const parsedValues = parsed.values as Record<
    string,
    boolean | string | undefined
  >;
  for (const [name, value] of finalState) {
    if (!value) {
      parsedValues[name] = false;
    }
  }
  const dryRun = parsed.values["dry-run"] === true;
  if (parsed.values.help) {
    printUsage();
    return;
  }
  if (parsed.values.list) {
    printSupportedRoutes();
    return;
  }
  const [input, output] = parsed.positionals;
  if (input === "init") {
    await cmdInit();
    return;
  }

  const conversionFlags: ConversionFlags = {
    style: parsed.values["style"],
    metadataFile: parsed.values["metadata-file"],
    referenceDoc: parsed.values["reference-doc"],
    toc: parsed.values["toc"],
    numberSections: parsed.values["number-sections"],
    wrap: parsed.values["wrap"] as "none" | "preserve" | undefined,
    extractMedia: parsed.values["extract-media"],
    pageSize: parsed.values["page-size"],
  };
  const styleAliases = loadStyleConfig();
  if (conversionFlags.style) {
    const aliasPath = resolveAlias(conversionFlags.style, styleAliases);
    if (aliasPath) conversionFlags.style = aliasPath;
  }
  const refDocAliases = loadReferenceDocConfig();
  if (conversionFlags.referenceDoc) {
    const aliasPath = resolveAlias(conversionFlags.referenceDoc, refDocAliases);
    if (aliasPath) conversionFlags.referenceDoc = aliasPath;
  }

  if (!input || !output) {
    printUsage();
    throw new CliError("Input and output files are required.");
  }
  await convertOne(input, output, passthroughArgs, {
    dryRun,
    flags: conversionFlags,
  });
}
