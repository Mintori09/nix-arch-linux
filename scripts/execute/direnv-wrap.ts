import { readdirSync, writeFileSync } from "node:fs";
import { isMain, which, spawnSyncOutput, args } from "./utils.ts";

export function getRuntimePkgs(language: string): string {
  const pkgs: Record<string, string> = {
    python: "python3",
    node: "nodejs bun",
    deno: "deno",
    go: "go",
    rust: "rustc cargo",
    ruby: "ruby",
    java: "jdk",
    qt: "qt5.qtbase cmake",
    gtk: "gtk3 glib pkg-config",
    flutter: "flutter dart",
    bun: "bun",
    "c-cpp": "clang-tools cmake",
    clojure: "clojure",
    cue: "cue",
    dhall: "dhall",
    elixir: "elixir erlang",
    elm: "elm",
    gleam: "gleam",
    hashi: "packer terraform nomad vault",
    haskell: "ghc cabal-install",
    haxe: "haxe",
    jupyter: "jupyter",
    kotlin: "kotlin gradle",
    latex: "texlive texlab",
    lean4: "lean",
    nickel: "nickel",
    nim: "nim",
    nix: "nix nixfmt cachix statix",
    ocaml: "ocaml dune",
    odin: "odin",
    opa: "opa conftest",
    php: "php",
    platformio: "platformio",
    protobuf: "protobuf buf",
    pulumi: "pulumi",
    purescript: "purescript spago",
    r: "r",
    scala: "scala sbt",
    shell: "shellcheck",
    "swi-prolog": "swi-prolog",
    typst: "typst",
    vlang: "vlang",
    zig: "zig",
  };
  return pkgs[language] ?? "nodejs";
}

const LANGUAGE_DETECTORS: { files: string[]; language: string }[] = [
  { files: ["bun.lockb", "bunfig.toml"], language: "bun" },
  { files: ["Cargo.toml"], language: "rust" },
  { files: ["package.json", "yarn.lock", "pnpm-lock.yaml"], language: "node" },
  { files: ["go.mod", "go.sum"], language: "go" },
  { files: ["Gemfile", "Gemfile.lock"], language: "ruby" },
  {
    files: [
      "requirements.txt",
      "pyproject.toml",
      "setup.py",
      "Pipfile",
      "setup.cfg",
    ],
    language: "python",
  },
  { files: ["deno.json", "deno.jsonc"], language: "deno" },
  { files: ["pom.xml", "build.gradle", "build.gradle.kts"], language: "java" },
  { files: ["pubspec.yaml"], language: "flutter" },
  { files: ["CMakeLists.txt"], language: "c-cpp" },
  { files: ["tsconfig.json"], language: "typescript" },
  { files: ["project.clj", "deps.edn", "bb.edn"], language: "clojure" },
  { files: ["cue.mod"], language: "cue" },
  { files: ["package.dhall"], language: "dhall" },
  { files: ["mix.exs"], language: "elixir" },
  { files: ["elm.json"], language: "elm" },
  { files: ["gleam.toml"], language: "gleam" },
  { files: [".terraform.hcl", "terraform.tf"], language: "hashi" },
  {
    files: ["stack.yaml", "cabal.project", "package.yaml"],
    language: "haskell",
  },
  { files: ["haxelib.json"], language: "haxe" },
  { files: ["lakefile.lean", "lean-toolchain"], language: "lean4" },
  { files: ["nickel.lock"], language: "nickel" },
  { files: ["nim.cfg"], language: "nim" },
  { files: ["flake.nix", "shell.nix", "default.nix"], language: "nix" },
  { files: ["dune-project"], language: "ocaml" },
  { files: ["ols.json"], language: "odin" },
  { files: ["composer.json"], language: "php" },
  { files: ["platformio.ini"], language: "platformio" },
  { files: ["buf.gen.yaml", "buf.work.yaml"], language: "protobuf" },
  { files: ["Pulumi.yaml", "Pulumi.yml"], language: "pulumi" },
  { files: ["spago.dhall"], language: "purescript" },
  { files: [".Rprofile"], language: "r" },
  { files: ["build.sbt"], language: "scala" },
  { files: [".shellcheckrc"], language: "shell" },
  { files: ["typst.toml"], language: "typst" },
  { files: ["vpkg.json", "v.mod"], language: "vlang" },
  { files: ["build.zig", "build.zig.zon"], language: "zig" },
];

const EXT_LANGUAGE_MAP: Record<string, string> = {
  ".rs": "rust",
  ".go": "go",
  ".py": "python",
  ".rb": "ruby",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "node",
  ".jsx": "node",
  ".zig": "zig",
  ".ex": "elixir",
  ".exs": "elixir",
  ".hs": "haskell",
  ".ml": "ocaml",
  ".php": "php",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".dart": "flutter",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".edn": "clojure",
  ".dhall": "dhall",
  ".elm": "elm",
  ".gleam": "gleam",
  ".hx": "haxe",
  ".tex": "latex",
  ".lean": "lean4",
  ".ncl": "nickel",
  ".nim": "nim",
  ".nix": "nix",
  ".odin": "odin",
  ".opa": "opa",
  ".rego": "opa",
  ".purs": "purescript",
  ".r": "r",
  ".scala": "scala",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".pl": "swi-prolog",
  ".typ": "typst",
  ".v": "vlang",
  ".tf": "hashi",
  ".tfvars": "hashi",
  ".c": "c-cpp",
  ".h": "c-cpp",
  ".cpp": "c-cpp",
  ".hpp": "c-cpp",
  ".cxx": "c-cpp",
  ".java": "java",
  ".gradle": "kotlin",
  ".cabal": "haskell",
  ".mli": "ocaml",
};

function detectLanguage(dir: string = "."): string | null {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  for (const detector of LANGUAGE_DETECTORS) {
    for (const file of detector.files) {
      if (entries.includes(file)) {
        return detector.language;
      }
    }
  }

  for (const entry of entries) {
    for (const [ext, lang] of Object.entries(EXT_LANGUAGE_MAP)) {
      if (entry.endsWith(ext)) {
        return lang;
      }
    }
  }

  return null;
}

function main(): void {
  const language = args[0] ?? detectLanguage();

  if (!language) {
    console.error("Usage: direnv-wrap [language]");
    console.error(
      "Detects project language and sets up direnv with nix packages.",
    );
    process.exit(1);
  }

  const pkgs = getRuntimePkgs(language);
  const envrc = `# direnv-wrap: ${language}\n# runtime: ${pkgs}\n\nuse nix\n`;

  writeFileSync(".envrc", envrc);
  console.log(`Created .envrc for ${language} (${pkgs})`);

  const direnvPath = which("direnv");
  if (direnvPath) {
    const result = spawnSyncOutput(direnvPath, ["allow"]);
    if (result.exitCode === 0) {
      console.log("direnv allow: OK");
    } else {
      const msg = result.stderr.trim();
      if (msg) console.error("direnv:", msg);
    }
  } else {
    console.error("direnv not found in PATH");
  }
}

if (isMain(import.meta.url)) {
  main();
}
