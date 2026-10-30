# Nushell completions for Custom Scripts & Local Packages

# --- fcitx5-remote ---
def "nu-complete fcitx5 imnames" [] {
  let profile = ($env.XDG_CONFIG_HOME? | default $"($env.HOME)/.config/fcitx5/profile")
  if ($profile | path exists) {
    try {
      let content = (open $profile)
      let ims = ($content | lines | where ($it =~ 'Name=') | each {|l| $l | parse "Name={name}" | get -o 0.name } | compact | uniq)
      if ($ims | is-not-empty) {
        return ($ims | each {|im| { value: $im, description: "Input Method" } })
      }
    }
  }
  []
}

def "nu-complete fcitx5 groups" [] {
  let profile = ($env.XDG_CONFIG_HOME? | default $"($env.HOME)/.config/fcitx5/profile")
  if ($profile | path exists) {
    try {
      let content = (open $profile)
      let groups = ($content | lines | where ($it =~ '^\[Groups/') | each {|l| $l | str replace -r '^\[Groups/[0-9]+\]' "" } | compact)
      # Extract group names from profile
      let lines = ($content | lines)
      # Fallback common groups
      return [
        { value: "Default", description: "Default Group" }
      ]
    }
  }
  [ { value: "Default", description: "Default Group" } ]
}

# Fcitx5 Remote Control
export extern "fcitx5-remote" [
  -c                                                            # Inactivate input method
  -o                                                            # Activate input method
  -r                                                            # Reload fcitx config
  -t                                                            # Switch Active/Inactive
  -T                                                            # Switch Active/Inactive
  -e                                                            # Request fcitx to exit
  -a                                                            # Print fcitx DBus address
  -m: string@"nu-complete fcitx5 imnames"                       # Print corresponding addon name for IM
  -g: string@"nu-complete fcitx5 groups"                        # Set current input method group
  -q                                                            # Get current input method group name
  -n                                                            # Get current input method name
  -s: string@"nu-complete fcitx5 imnames"                       # Switch to input method
  -x                                                            # Open new X11 connection using DISPLAY
  -h                                                            # Display help and exit
  --check                                                       # Check if Fcitx is running
]

# --- format ---
# Formatter wrapper for multiple file formats
export extern "format" [
  ...files: path                                                # Files or directories to format
  --help(-h)                                                    # Show help message
]

# --- extract ---
# Universal archive extractor
export extern "extract" [
  ...archives: path                                             # Archives to extract (.tar.gz, .zip, .7z, .rar, etc.)
]

# --- compress-wrap ---
def "nu-complete compress formats" [] {
  [ "tar.gz", "tar.xz", "tar.zst", "tar.bz2", "zip", "7z" ]
}

# Archive compression helper
export extern "compress-wrap" [
  output: string                                                # Output archive name
  ...inputs: path                                               # Files or directories to compress
  --format(-f): string@"nu-complete compress formats"           # Archive format override
  --help(-h)                                                    # Show help
]

# --- ai-renamer ---
def "nu-complete ai-renamer models" [] {
  [
    { value: "gemini-3.5-flash-lite", description: "Gemini 3.5 Flash Lite" }
    { value: "gemini-3.5-flash", description: "Gemini 3.5 Flash" }
    { value: "gemini-2.5-flash", description: "Gemini 2.5 Flash" }
    { value: "gemini-2.5-pro", description: "Gemini 2.5 Pro" }
  ]
}

def "nu-complete ai-renamer cases" [] {
  [ "kebab", "snake", "camel", "pascal", "lower", "preserve" ]
}

# AI batch file renamer
export extern "ai-renamer" [
  ...files: path                                                # Files to rename
  --prompt(-p): string                                          # Custom instruction / naming hint
  --dry-run(-n)                                                 # Preview proposed renames
  --yes(-y)                                                     # Automatically apply renames
  --recursive(-r)                                               # Recursively scan directories
  --model(-m): string@"nu-complete ai-renamer models"           # Choose Gemini model
  --case: string@"nu-complete ai-renamer cases"                 # Enforce case convention
  --no-content                                                  # Do not read file content snippets
  --verbose(-v)                                                 # Print verbose debug output
  --help(-h)                                                    # Show help message
]

# --- anki-tool ---
def "nu-complete anki-tool types" [] {
  [
    { value: "vocab", description: "English vocabulary cards" }
    { value: "grammar", description: "English grammar cards" }
    { value: "mcq", description: "Multiple-choice questions" }
    { value: "mcq-shuffle", description: "Shuffled multiple-choice questions" }
    { value: "mcq-listening", description: "Listening multiple-choice questions" }
    { value: "basic", description: "Basic front/back cards" }
    { value: "jp_vocab", description: "Japanese vocabulary cards" }
    { value: "jp_grammar", description: "Japanese grammar cards" }
  ]
}

def "nu-complete anki-tool prompts" [] {
  [ "anki-flashcard-english-vocab", "mcq-creation" ]
}

# Anki flashcard package generator
export extern "anki-tool" [
  ...json_files: path                                           # Input JSON files
  --type: string@"nu-complete anki-tool types"                  # Specify parsing strategy mode
  --deck-name(-d): string                                       # Custom deck name or root hierarchy
  --watch(-w)                                                   # Watch input files and auto rebuild APKG
  --preview(-p)                                                 # Start local web preview server
  --without-image                                               # Skip image downloading
  --port: int                                                   # Specify port for preview server
  --export: path                                                # Export / deconstruct .apkg file
  --prompt: string@"nu-complete anki-tool prompts"              # Output prompt template
  --autocomplete                                                # Output completion script
]

# --- cv (converter tool) ---
def "nu-complete cv page-sizes" [] {
  [ "a3", "a4", "a5", "letter", "legal" ]
}

def "nu-complete cv wrap-modes" [] {
  [ "none", "preserve" ]
}

# Universal document and file format converter
export extern "cv" [
  input?: path                                                  # Input file or directory
  output?: path                                                 # Output file or destination
  --dry-run                                                     # Simulate conversion without running tools
  --list                                                        # List all supported format conversions
  --metadata-file: path                                         # Metadata file for pandoc variables
  --wrap: string@"nu-complete cv wrap-modes"                    # Text wrapping mode
  --standalone                                                  # Produce standalone output
  --toc                                                         # Generate table of contents
  --no-toc                                                      # Do not generate table of contents
  --number-sections                                             # Number section headings
  --no-number-sections                                          # Do not number section headings
  --extract-media: path                                         # Extract media to directory
  --reference-doc: path                                         # Reference DOCX for style template
  --style: path                                                 # CSS style file or alias
  --page-size: string@"nu-complete cv page-sizes"               # Page size for PDF output
  --help(-h)                                                    # Show help
]

# --- gentoc ---
# Table of contents generator
export extern "gentoc" [
  ...files: path                                                # Markdown or document files
  --help(-h)                                                    # Show help
]

# --- rust-script ---
def "nu-complete rust-script toolchains" [] {
  if (which rustup | is-not-empty) {
    try {
      let output = (^rustup toolchain list | complete)
      if $output.exit_code == 0 {
        return ($output.stdout | lines | each {|l| $l | split row " " | get 0 } | each {|tc| { value: $tc, description: "Rust toolchain" } })
      }
    }
  }
  [ { value: "stable" }, { value: "beta" }, { value: "nightly" } ]
}

# Run Rust scripts with dependency resolution
export extern "rust-script" [
  script?: path                                                 # Rust script (.rs, .ers)
  ...args: string                                               # Arguments passed to the script
  --expr(-e): string                                            # Execute script as a literal expression
  --loop(-l): string                                            # Execute script as a loop closure
  --base-path(-b): path                                         # Base path for resolving dependencies
  --cargo-output(-c)                                            # Show cargo output when building
  --count                                                       # Invoke loop closure with line number
  --debug                                                       # Build a debug executable
  --dep(-d): string                                             # Add dependency (name or name=version)
  --extern(-x): string                                          # Add macro_use extern crate item
  --unstable-feature(-u): string                                # Add feature declaration
  --clear-cache                                                 # Clear out script cache
  --force(-f)                                                   # Force rebuild
  --package(-p)                                                 # Generate Cargo package without running
  --pkg-path: path                                              # Where to place generated Cargo package
  --test                                                        # Compile and run tests
  --bench                                                       # Compile and run benchmarks
  --toolchain(-t): string@"nu-complete rust-script toolchains"  # Build script using given toolchain
  --wrapper(-w): string                                         # Wrapper command
  --version(-V)                                                 # Print version
  --help(-h)                                                    # Print help
]
