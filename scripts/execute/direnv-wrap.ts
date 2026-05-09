#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";

type Language = "python" | "node" | "go" | "rust" | "ruby" | "java" | "deno";

type Template = {
  name: string;
  envrc: string;
  scaffold?: string;
  description: string;
};

const TEMPLATES: Record<Language, Template> = {
  python: {
    name: "Python",
    description: "Python with pipenv/pyenv style environment",
    envrc: `use nix
layout python
`,
    scaffold: `requirements.txt`,
  },
  node: {
    name: "Node.js",
    description: "Node.js with npm/yarn/pnpm",
    envrc: `use nix
layout node
`,
    scaffold: `package.json`,
  },
  go: {
    name: "Go",
    description: "Go with local GOPATH",
    envrc: `use nix
export GOPATH=$PWD/.go
export PATH=$GOPATH/bin:$PATH
`,
  },
  rust: {
    name: "Rust",
    description: "Rust with local CARGO_HOME",
    envrc: `use nix
export CARGO_HOME=$PWD/.cargo
export PATH=$CARGO_HOME/bin:$PATH
`,
  },
  ruby: {
    name: "Ruby",
    description: "Ruby with bundler",
    envrc: `use nix
layout ruby
`,
    scaffold: `Gemfile`,
  },
  java: {
    name: "Java",
    description: "Java with Maven/Gradle",
    envrc: `use nix
export JAVA_OPTS="-Xmx2g"
`,
  },
  deno: {
    name: "Deno",
    description: "Deno runtime",
    envrc: `use nix
layout deno
`,
  },
};

type Args = {
  command: "init" | "list" | "add";
  language?: Language;
  directory?: string;
  scaffold?: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const command = args[0] as Args["command"];
  const options: Args = { command };

  // Check if second arg is a language (for init/add commands)
  if (args.length >= 2) {
    const potentialLang = args[1] as Language;
    if (TEMPLATES[potentialLang]) {
      options.language = potentialLang;
    }
  }

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--scaffold" || arg === "-s") {
      options.scaffold = true;
    } else if (arg === "--dir" || arg === "-d") {
      options.directory = args[++i];
    }
  }

  return options;
}

function printUsage(): void {
  console.log(`Usage: direnv-wrap <command> [options]

Commands:
  init <language>   Initialize a direnv environment for the specified language
  list              List all supported languages
  add <language>    Add direnv config to existing project

Options:
  -s, --scaffold    Create initial project files (package.json, requirements.txt, etc.)
  -d, --dir <dir>   Target directory (default: current directory)
  -h, --help        Show this help message

Supported languages:
${Object.entries(TEMPLATES)
  .map(([key, tmpl]) => `  ${key.padEnd(10)} ${tmpl.description}`)
  .join("\n")}`);
}

function listLanguages(): void {
  console.log("Supported languages:");
  for (const [key, tmpl] of Object.entries(TEMPLATES)) {
    console.log(`  ${key.padEnd(10)} ${tmpl.description}`);
  }
}

function getEnvrcPath(dir: string): string {
  return `${dir}/.envrc`;
}

function getScaffoldPath(dir: string, filename: string): string {
  return `${dir}/${filename}`;
}

function createScaffold(language: Language, dir: string): void {
  const template = TEMPLATES[language];
  if (!template.scaffold) return;

  const scaffoldFile = getScaffoldPath(dir, template.scaffold);

  if (existsSync(scaffoldFile)) {
    console.log(`  ⚠ Skipping ${template.scaffold} (already exists)`);
    return;
  }

  let content = "";
  switch (language) {
    case "python":
      content = `# Python dependencies
# Add your packages here, e.g.:
# requests>=2.28.0
`;
      break;
    case "node":
      content = JSON.stringify(
        {
          name: "my-project",
          version: "1.0.0",
          description: "",
          main: "index.js",
          scripts: {
            start: "node index.js",
            dev: "node index.js",
          },
          license: "MIT",
        },
        null,
        2,
      );
      break;
    case "ruby":
      content = `# frozen_string_literal: true

# gem "rails"
`;
      break;
  }

  if (content) {
    writeFileSync(scaffoldFile, content);
    console.log(`  ✓ Created ${template.scaffold}`);
  }
}

function initEnvironment(language: Language, dir: string, withScaffold: boolean): number {
  const template = TEMPLATES[language];

  console.log(`\n🚀 Setting up ${template.name} environment in ${dir}`);

  // Create .envrc
  const envrcPath = getEnvrcPath(dir);
  if (existsSync(envrcPath)) {
    console.log("  ⚠ .envrc already exists, skipping...");
  } else {
    writeFileSync(envrcPath, template.envrc);
    console.log("  ✓ Created .envrc");
  }

  // Create .gitignore entries (language-specific)
  const gitignorePath = `${dir}/.gitignore`;
  const defaultGitignoreEntries = [".direnv", ".devenv"];
  const languageGitignore: Record<Language, string[]> = {
    python: [".python-version", "__pycache__", "*.pyc", ".venv", "venv", ".mypy_cache"],
    node: ["node_modules", ".node-version"],
    go: [".go"],
    rust: [".cargo", "target"],
    ruby: [".ruby-version", ".bundle", "vendor/bundle"],
    java: [".java-version"],
    deno: [],
  };
  const gitignoreEntries = [...defaultGitignoreEntries, ...languageGitignore[language]];

  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, "utf-8");
    const newEntries = gitignoreEntries.filter((e) => !existing.includes(e));
    if (newEntries.length > 0) {
      writeFileSync(gitignorePath, existing + "\n" + newEntries.join("\n") + "\n");
      console.log("  ✓ Updated .gitignore");
    }
  } else {
    writeFileSync(gitignorePath, gitignoreEntries.join("\n") + "\n");
    console.log("  ✓ Created .gitignore");
  }

  // Create scaffold files if requested
  if (withScaffold) {
    createScaffold(language, dir);
  }

  console.log(`\n✅ Done! Run the following to activate:\n`);
  console.log(`  cd ${dir}`);
  console.log(`  direnv allow`);
  console.log("");

  return 0;
}

function addEnvironment(language: Language, dir: string): number {
  // Similar to init but for existing projects
  return initEnvironment(language, dir, false);
}

async function main(): Promise<number> {
  const args = parseArgs();

  const targetDir = args.directory || process.cwd();

  // Create directory if it doesn't exist
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  switch (args.command) {
    case "list":
      listLanguages();
      return 0;

    case "init":
      if (!args.language) {
        console.error("Error: Language is required for 'init' command");
        printUsage();
        return 1;
      }
      return initEnvironment(args.language, targetDir, args.scaffold || false);

    case "add":
      if (!args.language) {
        console.error("Error: Language is required for 'add' command");
        printUsage();
        return 1;
      }
      return addEnvironment(args.language, targetDir);

    default:
      console.error(`Error: Unknown command '${args.command}'`);
      printUsage();
      return 1;
  }
}

if (import.meta.main) {
  process.exit(await main());
}