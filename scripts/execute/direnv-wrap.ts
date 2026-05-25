#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { isMain } from "./utils.ts";

type Language = "python" | "node" | "go" | "rust" | "ruby" | "java" | "deno" | "qt" | "gtk" | "wails" | "tauri" | "flutter" | "electron";

type Template = {
  name: string;
  envrc: string;
  scaffold?: string;
  description: string;
  gui?: boolean;
  guiVariables?: Record<string, string>;
};

const TEMPLATES: Record<Language, Template> = {
  python: {
    name: "Python",
    description: "Python with local virtual environment (.venv)",
    envrc: `# Simple Python venv setup
if [ ! -d .venv ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi
source .venv/bin/activate

# Uncomment to use Nix for tools/libraries
# use nix

export LD_LIBRARY_PATH=""  # Use system GUI libraries
`,
    scaffold: `requirements.txt`,
  },
  node: {
    name: "Node.js",
    description: "Node.js with local node_modules",
    envrc: `# Simple Node.js setup
export PATH=$PWD/node_modules/.bin:$PATH

# Uncomment to use Nix for tools/libraries
# use nix

export LD_LIBRARY_PATH=""  # Use system GUI libraries
`,
    scaffold: `package.json`,
  },
  go: {
    name: "Go",
    description: "Go with local GOPATH",
    envrc: `# Simple Go setup
export GOPATH=$PWD/.go
export PATH=$GOPATH/bin:$PATH
export CGO_ENABLED=1

# Uncomment to use Nix for tools/libraries
# use nix
`,
  },
  rust: {
    name: "Rust",
    description: "Rust with local CARGO_HOME",
    envrc: `# Simple Rust setup
export CARGO_HOME=$PWD/.cargo
export PATH=$CARGO_HOME/bin:$PATH

# Uncomment to use Nix for tools/libraries
# use nix
`,
  },
  ruby: {
    name: "Ruby",
    description: "Ruby with local bundle",
    envrc: `# Simple Ruby setup
# layout ruby

# Uncomment to use Nix for tools/libraries
# use nix
`,
    scaffold: `Gemfile`,
  },
  java: {
    name: "Java",
    description: "Java with local environment",
    envrc: `# Simple Java setup
export JAVA_OPTS="-Xmx2g"

# Uncomment to use Nix for tools/libraries
# use nix
`,
  },
  deno: {
    name: "Deno",
    description: "Deno runtime",
    envrc: `# Simple Deno setup
# layout deno

# Uncomment to use Nix for tools/libraries
# use nix
`,
  },
  qt: {
    name: "Qt",
    description: "Qt5/Qt6 application with GUI support (system libs)",
    gui: true,
    envrc: `# Simple Qt setup
# Nix provides tools (compiler, cmake), system provides GUI libs
export LD_LIBRARY_PATH=""
export QT_QPA_PLATFORM=xcb

# Uncomment to use Nix for tools/libraries
# use nix
`,
    guiVariables: {
      "QT_QPA_PLATFORMTHEME": "gtk3",
      "QT_STYLE_OVERRIDE": "gtk3",
    },
  },
  gtk: {
    name: "GTK",
    description: "GTK3/GTK4 application with GUI support (system libs)",
    gui: true,
    envrc: `# Simple GTK setup
# Nix provides tools, system provides GUI libs
export LD_LIBRARY_PATH=""
export GDK_BACKEND=x11

# Uncomment to use Nix for tools/libraries
# use nix
`,
    guiVariables: {
      "GTK_THEME": "Adwaita:dark",
    },
  },
  wails: {
    name: "Wails",
    description: "Wails (Go+WebView) desktop app (system libs)",
    gui: true,
    envrc: `# Simple Wails setup
export CGO_ENABLED=1
export LD_LIBRARY_PATH=""

# Uncomment to use Nix for tools/libraries
# use nix
`,
    guiVariables: {
      "WEBVIEW_DISABLE_COMPOSITING_MODE": "1",
    },
  },
  tauri: {
    name: "Tauri",
    description: "Tauri (Rust+WebView) desktop app (system libs)",
    gui: true,
    envrc: `# Simple Tauri setup
export LD_LIBRARY_PATH=""

# Uncomment to use Nix for tools/libraries
# use nix
`,
  },
  flutter: {
    name: "Flutter",
    description: "Flutter desktop app (system libs)",
    gui: true,
    envrc: `# Simple Flutter setup
export LD_LIBRARY_PATH=""

# Uncomment to use Nix for tools/libraries
# use nix
`,
  },
  electron: {
    name: "Electron",
    description: "Electron desktop app (system libs)",
    gui: true,
    envrc: `# Simple Electron setup
export LD_LIBRARY_PATH=""

# Uncomment to use Nix for tools/libraries
# use nix
`,
  },
};

type Args = {
  command: "init" | "list" | "add";
  language?: Language;
  directory?: string;
  scaffold?: boolean;
  gui?: boolean;
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
    } else if (arg === "--gui" || arg === "-g") {
      options.gui = true;
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
  -g, --gui         Enable GUI wrapper scripts for desktop applications
  -d, --dir <dir>   Target directory (default: current directory)
  -h, --help        Show this help message

Supported languages (GUI-capable):
${Object.entries(TEMPLATES)
  .map(([key, tmpl]) => {
    const gui = tmpl.gui ? " [GUI]" : "";
    return `  ${key.padEnd(10)} ${tmpl.description}${gui}`;
  })
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

function createGuiWrapper(language: Language, dir: string): void {
  const template = TEMPLATES[language];
  if (!template.gui) return;

  const wrapperScript = `${dir}/run-gui.sh`;
  if (existsSync(wrapperScript)) return;

  const guiVars = template.guiVariables || {};
  const envVars = Object.entries(guiVars)
    .map(([k, v]) => `export ${k}="${v}"`)
    .join("\n");

  const content = `#!/bin/bash
# GUI wrapper for ${template.name} applications
# Uses SYSTEM libraries for GUI while Nix provides tools
set -e

# Environment setup for hybrid Nix + system environment
export DISPLAY=\${DISPLAY:-:0}
${envVars}

# Preserve system GUI libraries (don't let Nix override)
export LD_LIBRARY_PATH=""

# Execute the app with system GUI libraries
echo "🖥️  Running with system GUI libraries"
exec "$@"
`;

  writeFileSync(wrapperScript, content);
  console.log(`  ✓ Created run-gui.sh wrapper for ${template.name}`);
}

function initEnvironment(language: Language, dir: string, withScaffold: boolean, gui: boolean = false): number {
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

  // Create shell.nix for hybrid setup (tools from Nix, GUI from system)
  const shellNixPath = `${dir}/shell.nix`;
  if (!existsSync(shellNixPath)) {
    const runtimePkgs = getRuntimePkgs(language);
    const shellNixContent = `{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "${language}-dev";

  buildInputs = with pkgs; [
    ${runtimePkgs}
  ];

  shellHook = ''
    echo "🛠️  Nix tools + system GUI libraries (hybrid mode)"
    export LD_LIBRARY_PATH=""
  '';
}
`;
    writeFileSync(shellNixPath, shellNixContent);
    console.log("  ✓ Created shell.nix (hybrid mode)");
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
    qt: [],
    gtk: [],
    wails: [],
    tauri: [],
    flutter: [".dart_tool", "build"],
    electron: [],
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

  // Create GUI wrapper for GUI apps
  if (template.gui || gui) {
    createGuiWrapper(language, dir);
  }

  console.log(`\n✅ Done! Run the following to activate:\n`);
  console.log(`  cd ${dir}`);
  console.log(`  direnv allow`);
  console.log("\n  # The environment is set up for local development by default.");
  console.log("  # To use Nix for tools and libraries, uncomment 'use nix' in .envrc");

  if (template.gui) {
    console.log(`  chmod +x run-gui.sh`);
    console.log(`  ./run-gui.sh your-app`);
  }
  console.log("");

  return 0;
}

function getRuntimePkgs(language: Language): string {
  const pkgMap: Record<string, string> = {
    python: "python3",
    node: "nodejs bun",
    deno: "deno",
    go: "go",
    rust: "rustc cargo",
    ruby: "ruby",
    java: "jdk",
    qt: "qt5.qtbase cmake",
    gtk: "gtk3 glib pkg-config",
    wails: "go webkitgtk gtk3",
    tauri: "rustc cargo webkitgtk gtk3",
    flutter: "flutter dart",
    electron: "nodejs bun",
  };
  return pkgMap[language] || "nodejs";
}

function addEnvironment(language: Language, dir: string, gui: boolean = false): number {
  // Similar to init but for existing projects
  return initEnvironment(language, dir, false, gui);
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
      return initEnvironment(args.language, targetDir, args.scaffold || false, args.gui);

    case "add":
      if (!args.language) {
        console.error("Error: Language is required for 'add' command");
        printUsage();
        return 1;
      }
      return addEnvironment(args.language, targetDir, args.gui);

    default:
      console.error(`Error: Unknown command '${args.command}'`);
      printUsage();
      return 1;
  }
}

if (isMain(import.meta.url)) {
  main().then((code) => process.exit(code));
}