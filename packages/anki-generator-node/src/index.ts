import fs from "node:fs";
import path from "node:path";
import { parseJsonInput, validateJsonStructure } from "./utils/helpers.js";
import { generateApkg, type InputDeckItem } from "./core/generator.js";
import { unpackApkg } from "./core/unpacker.js";
import { VocabParser } from "./parsers/vocab.js";
import { GrammarParser } from "./parsers/grammar.js";
import { MCQParser } from "./parsers/mcq.js";
import { MCQShuffleParser } from "./parsers/mcq-shuffle.js";
import { MCQListeningParser } from "./parsers/mcq-listening.js";
import { BasicParser } from "./parsers/basic.js";
import { JpVocabParser } from "./parsers/jp_vocab.js";
import { JpGrammarParser } from "./parsers/jp_grammar.js";
import type { BaseParser } from "./parsers/base.js";
import { ROOT } from "./config/env.js";
import { resolveDeckAndOutputNames } from "./utils/deck-resolver.js";
import { watchFiles } from "./utils/watcher.js";
import { startPreviewServer } from "./core/preview-server.js";

const VALID_STRATEGIES = [
  "vocab",
  "grammar",
  "mcq",
  "mcq-shuffle",
  "mcq-listening",
  "mcq_listening",
  "basic",
  "jp_vocab",
  "jp_grammar",
] as const;
type Strategy = (typeof VALID_STRATEGIES)[number];

const PROMPT_MAPPING: Record<string, string> = {
  "anki-flashcard-english-vocab": "prompt-anki-flashcard-english-vocab.md",
  "mcq-creation": "prompt-mcq-creation.md",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const hasType = args.includes("--type");
  const hasExport = args.includes("--export");
  const hasPrompt = args.includes("--prompt");
  const hasAutocomplete = args.includes("--autocomplete");
  const hasWatch = args.includes("--watch") || args.includes("-w");
  const hasPreview = args.includes("--preview") || args.includes("-p");

  let deckName: string | undefined;
  const deckIdx =
    args.indexOf("--deck-name") !== -1 ? args.indexOf("--deck-name") : args.indexOf("-d");
  if (deckIdx !== -1 && args[deckIdx + 1] && !args[deckIdx + 1].startsWith("-")) {
    deckName = args[deckIdx + 1];
  }

  let port: number | undefined;
  const portIdx = args.indexOf("--port");
  if (portIdx !== -1 && args[portIdx + 1] && !args[portIdx + 1].startsWith("-")) {
    port = parseInt(args[portIdx + 1], 10);
  }

  return {
    args,
    hasType,
    hasExport,
    hasPrompt,
    hasAutocomplete,
    hasWatch,
    hasPreview,
    deckName,
    port,
  };
}

function printUsageAndExit(): never {
  console.error("Terminal Usage Error:");
  console.error("  Compilation Mode:");
  console.error(
    "    node src/index.js --type <vocab | grammar | mcq | mcq-shuffle | mcq-listening | basic | jp_vocab | jp_grammar> <path_to_input_json...> [--deck-name <name>] [--watch]",
  );
  console.error("  Preview Mode:");
  console.error(
    "    node src/index.js --type <strategy> <path_to_input_json...> [--deck-name <name>] --preview [--port <port>]",
  );
  console.error("  Deconstruction Mode:");
  console.error("    node src/index.js --export <path_to_target_apkg> <path_to_output_directory>");
  console.error("  Prompt Retrieval Mode:");
  console.error("    node src/index.js --prompt [name]");
  console.error("  Autocomplete Output Mode:");
  console.error("    node src/index.js --autocomplete");
  process.exit(1);
}

function resolveAbsolutePath(inputPath: string): string {
  return path.isAbsolute(inputPath)
    ? path.normalize(inputPath)
    : path.resolve(process.cwd(), inputPath);
}

function resolveParser(strategy: Strategy): BaseParser {
  const parsers: Record<Strategy, () => BaseParser> = {
    vocab: () => new VocabParser(),
    grammar: () => new GrammarParser(),
    mcq: () => new MCQParser(),
    "mcq-shuffle": () => new MCQShuffleParser(),
    "mcq-listening": () => new MCQListeningParser(),
    mcq_listening: () => new MCQListeningParser(),
    basic: () => new BasicParser(),
    jp_vocab: () => new JpVocabParser(),
    jp_grammar: () => new JpGrammarParser(),
  };
  return parsers[strategy]();
}

async function prepareDeckItems(
  strategy: Strategy,
  rawInputPaths: string[],
  customDeckName?: string,
): Promise<{ items: InputDeckItem[]; outputPath: string }> {
  const resolvedInfo = resolveDeckAndOutputNames(rawInputPaths, customDeckName);
  const firstInputPath = resolveAbsolutePath(rawInputPaths[0]);
  const inputDir = path.dirname(firstInputPath);
  const outputPath = path.join(inputDir, `${resolvedInfo.masterOutputName}.apkg`);

  const items: InputDeckItem[] = [];

  for (const resolvedItem of resolvedInfo.items) {
    const absoluteInputPath = resolveAbsolutePath(resolvedItem.inputPath);

    if (!fs.existsSync(absoluteInputPath)) {
      console.error(`Input file not found: ${absoluteInputPath}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(absoluteInputPath, "utf-8");
    const data = parseJsonInput(raw);
    validateJsonStructure(data, strategy);

    const parser = resolveParser(strategy);
    console.log(
      `Compiling payload [${path.basename(absoluteInputPath)}] with strategy: ${strategy}`,
    );
    const parsedResult = await parser.parse(raw);

    items.push({
      parsedResult,
      parser,
      deckName: resolvedItem.deckName,
    });
  }

  return { items, outputPath };
}

async function runCompile(
  args: string[],
  options: { hasWatch: boolean; hasPreview: boolean; deckName?: string; port?: number },
) {
  const typeIdx = args.indexOf("--type");
  const strategy = args[typeIdx + 1]?.toLowerCase() as Strategy;

  const rawInputPaths: string[] = [];
  for (let i = typeIdx + 2; i < args.length; i++) {
    if (args[i].startsWith("-")) {
      // Skip flags that have parameter arguments
      if (args[i] === "--deck-name" || args[i] === "-d" || args[i] === "--port") {
        i++;
      }
      continue;
    }
    rawInputPaths.push(args[i]);
  }

  if (!strategy || !VALID_STRATEGIES.includes(strategy)) {
    console.error(
      "Error: Invalid or missing type. Must be one of: vocab, grammar, mcq, mcq-shuffle, basic, jp_vocab, jp_grammar",
    );
    process.exit(1);
  }

  if (rawInputPaths.length === 0) {
    console.error("Error: Missing path to input JSON file(s).");
    process.exit(1);
  }

  const absolutePaths = rawInputPaths.map(resolveAbsolutePath);

  if (options.hasPreview) {
    console.log("Starting Anki Flashcard Live Preview...");
    await startPreviewServer(
      async () => {
        const { items } = await prepareDeckItems(strategy, rawInputPaths, options.deckName);
        return items;
      },
      absolutePaths,
      options.port || 3000,
    );
    return;
  }

  const compileOnce = async () => {
    try {
      const { items, outputPath } = await prepareDeckItems(
        strategy,
        rawInputPaths,
        options.deckName,
      );
      await generateApkg(items, outputPath);
    } catch (err: any) {
      console.error("Compilation error:", err?.message || err);
      if (!options.hasWatch) {
        process.exit(1);
      }
    }
  };

  await compileOnce();

  if (options.hasWatch) {
    console.log("\n👀 Watch mode enabled. Waiting for file changes (press Ctrl+C to exit)...");
    watchFiles(
      absolutePaths,
      async (changedFile) => {
        console.log(`\nDetected change in ${path.basename(changedFile)}. Recompiling...`);
        await compileOnce();
      },
      300,
    );
  }
}

async function runExport(args: string[]) {
  const exportIdx = args.indexOf("--export");
  const apkgPath = args[exportIdx + 1];
  const outputDir = args[exportIdx + 2];

  if (!apkgPath) {
    console.error("Error: Missing target APKG package path.");
    process.exit(1);
  }

  if (!outputDir) {
    console.error("Error: Missing destination directory path.");
    process.exit(1);
  }

  await unpackApkg(apkgPath, outputDir);
}

async function runPrompt(args: string[]) {
  const promptIdx = args.indexOf("--prompt");
  const name = args[promptIdx + 1];
  const assetsDir = path.join(ROOT, "assets");

  if (!name || name.startsWith("-")) {
    if (!fs.existsSync(assetsDir)) {
      console.error("Error: assets directory not found.");
      process.exit(1);
    }
    const files = fs.readdirSync(assetsDir).filter((file) => file.endsWith(".md"));
    const list: string[] = [];
    for (const file of files) {
      let shortName = file.replace(/\.md$/, "");
      if (shortName.startsWith("prompt-")) {
        shortName = shortName.slice(7);
      }
      const stats = fs.statSync(path.join(assetsDir, file));
      const sizeKb = (stats.size / 1024).toFixed(2);
      list.push(`${shortName} (${sizeKb} KB)`);
    }
    console.log(list.join("\n"));
  } else {
    const filename = PROMPT_MAPPING[name] || `prompt-${name}.md`;
    const fullPath = path.join(assetsDir, filename);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Prompt template '${name}' not found.`);
      console.error("Available options:");
      const files = fs.existsSync(assetsDir)
        ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".md"))
        : [];
      for (const file of files) {
        let shortName = file.replace(/\.md$/, "");
        if (shortName.startsWith("prompt-")) {
          shortName = shortName.slice(7);
        }
        console.error(`  - ${shortName}`);
      }
      process.exit(1);
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    process.stdout.write(content);
  }
}

async function runAutocomplete() {
  const completionPath = path.join(ROOT, "completions", "_anki-tool");
  if (!fs.existsSync(completionPath)) {
    console.error(`Error: Completion script not found at ${completionPath}`);
    process.exit(1);
  }
  try {
    const content = fs.readFileSync(completionPath, "utf-8");
    process.stdout.write(content);
  } catch (err: any) {
    console.error(`Error reading completion script: ${err?.message || err}`);
    process.exit(1);
  }
}

async function main() {
  const {
    args,
    hasType,
    hasExport,
    hasPrompt,
    hasAutocomplete,
    hasWatch,
    hasPreview,
    deckName,
    port,
  } = parseArgs();

  const activeFlagsCount = [hasType, hasExport, hasPrompt, hasAutocomplete].filter(Boolean).length;
  if (activeFlagsCount > 1) {
    console.error(
      "Error: --type, --export, --prompt, and --autocomplete are mutually exclusive and only one may be active per invocation.",
    );
    process.exit(1);
  }

  if (activeFlagsCount === 0) printUsageAndExit();

  if (hasType) await runCompile(args, { hasWatch, hasPreview, deckName, port });
  if (hasExport) await runExport(args);
  if (hasPrompt) await runPrompt(args);
  if (hasAutocomplete) await runAutocomplete();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
