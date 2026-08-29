{ pkgs, inputs, ... }:
{
  nixpkgs.config.allowUnfree = true;
  home.packages = with pkgs; [
    inputs.mmdr.packages.${pkgs.stdenv.hostPlatform.system}.default
    # Archive
    atool
    bzip2
    gzip
    libarchive
    pbzip2
    p7zip
    pigz
    pxz
    unrar
    unzip
    zip
    zstd

    # Core utilities
    fastfetch
    magika
    cliphist
    fd
    ripgrep
    wl-clipboard
    just
    # opencode
    fx

    # CLI tools
    aichat
    pv
    onefetch
    xh
    tdf
    dust
    aichat
    btop
    konsave
    rofi
    vex-tui

    # aider-chat
    duf
    watchexec
    arp-scan
    bun
    chafa
    ffmpegthumbnailer
    hexyl
    jq
    # mise
    glow
    nixfmt
    rust-script
    television
    pnpm
    gopls
    lazygit
    lazydocker
    spicetify-cli
    rclone

    brotab
    navi
    lazyjournal
    lazysql
    helix
    devenv

    # Formatters & linters
    gofumpt
    hadolint
    kdlfmt
    ruff
    shellcheck
    shfmt
    sql-formatter
    stylua
    taplo
    nodejs_22
    pnpm
    yarn
    node-gyp

    gnumake
    shell-gpt
    brotab

    # Program
    slack
    signal-desktop

    # Document conversion
    pandoc
    imagemagick
    python314Packages.markitdown
    tabiew

    # Custom packages (prebuilt from GitHub)
    bookokrat
    dbx
    zap
    anyflip-downloader
    cv-cli
    anki-tool
    ai-bridge
    generate-toc
    fitgirl-link-extractor
    keyboard-rs
    qbittorrent
    fmtron
    sd
    watchexec
    rclone
    trashy
    gdown
    proton-vpn

    # Typst
    typstyle
    typst
    tinymist
    websocat

    charm-freeze
    tsx

    # C/C++
    clang
    clang-tools

    # Rust
    cargo-deny # Lints dependencies for security advisories, license compliance, duplicate crates, and bans

    cargo
    rustc
    mold
    # Testing & Coverage
    cargo-nextest # Next-generation test runner that executes tests in parallel with fast, clean output
    cargo-llvm-cov # Measures source-based code coverage using LLVM instrumentation (highly accurate and cross-platform)
    cargo-tarpaulin # Native code coverage tool for Rust projects (primarily designed for Linux/x86_64)

    # Dependency & Analysis
    cargo-audit # Audits Cargo.lock for crates with known security vulnerabilities via the RustSec Advisory Database
    cargo-edit # Utilities to manage Cargo.toml dependencies via CLI (`cargo add`, `cargo rm`, `cargo upgrade`)
    cargo-semver-checks # Lints Rust crates for SemVer compliance and breaking API changes before publishing
    cargo-bloat # Analyzes executable binaries to find what functions and crates take up the most space
    cargo-machete # Fast tool to detect and clean up unused dependencies in Cargo.toml
    cargo-watch # Watches source files for changes and automatically re-runs commands (e.g., check, test, run)

    # Performance & Binary Analysis
    cargo-flamegraph # Profiles performance and generates interactive SVG flame graphs (pkgs.cargo-flamegraph)
    cargo-bloat # Analyzes executable binaries to find what functions and crates take up the most space (pkgs.cargo-bloat)
    cargo-show-asm # Shows the generated assembly, LLVM-IR, or MIR for specific Rust functions (`cargo asm`)

    # git
    gitleaks

    foliate
    aspell
    telegram-desktop
    kdePackages.kamoso
    google-java-format
    python314Packages.icnsutil

    # Nix helpers
    nh
    nix-output-monitor
  ];
}
