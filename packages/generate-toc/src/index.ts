#!/usr/bin/env node
import { Command } from "commander";
import { existsSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { generateToc } from "./core.js";

const program = new Command();

program
  .name("generate-toc")
  .description(
    "Generate a Markdown Table of Contents from .md, .docx, or .html files",
  )
  .argument("<file>", "Path to the input file")
  .option("-o, --output <file>", "Write output to file instead of stdout")
  .action(async (file: string, options: { output?: string }) => {
    try {
      if (!existsSync(file)) {
        console.error(`Error: File not found: '${file}'`);
        process.exit(1);
      }

      const toc = await generateToc(file);

      if (!toc) {
        console.error("No headings found in the file.");
        process.exit(0);
      }

      const result = `## TABLE OF CONTENTS\n\n${toc}\n`;

      if (options.output) {
        writeFileSync(options.output, result, "utf-8");
        console.log(`Table of contents written to '${options.output}'`);
      } else {
        console.log(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse();
