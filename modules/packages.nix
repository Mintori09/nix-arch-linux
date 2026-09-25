{ pkgs, inputs, ... }:
{
  nixpkgs.config.allowUnfree = true;
  home.packages = with pkgs; [
    inputs.mmdr.packages.${pkgs.stdenv.hostPlatform.system}.default

    # Archive utilities
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

    # Core CLI utilities
    fastfetch
    magika
    cliphist
    fd
    ripgrep
    sd
    trashy
    wl-clipboard
    just
    fx
    jq
    carapace
    pv
    onefetch
    xh
    tdf
    dust
    duf
    btop
    konsave
    rofi
    vex-tui
    watchexec
    arp-scan
    chafa
    ffmpegthumbnailer
    hexyl
    glow
    nixfmt
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
    charm-freeze
    websocat
    gdown
    proton-vpn
    google-java-format

    # AI tools
    aichat
    shell-gpt

    # Web & Node runtime / packages
    bun
    deno
    nodejs_22
    pnpm
    yarn
    node-gyp
    tsx

    # C / C++ / Build
    clang
    clang-tools
    gnumake

    # Go
    gopls

    # Python & Doc tools
    uv
    python314Packages.icnsutil
    python314Packages.markitdown
    pandoc
    imagemagick
    tabiew
    qpdf

    # Rust & Cargo Ecosystem
    rustc
    cargo
    rust-script
    mold
    cargo-deny
    cargo-nextest
    cargo-llvm-cov
    cargo-tarpaulin
    cargo-audit
    cargo-edit
    cargo-semver-checks
    cargo-bloat
    cargo-machete
    cargo-watch
    cargo-flamegraph
    cargo-show-asm
    cargo-outdated

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

    # Typst Ecosystem
    typstyle
    typst
    tinymist

    # Git
    gitleaks

    # Desktop & GUI apps
    slack
    signal-desktop
    foliate
    aspell
    telegram-desktop
    kdePackages.kamoso
    vesktop
    bitwarden-desktop

    # Nix helpers
    nh
    nix-output-monitor

    # Custom packages (prebuilt from GitHub / local)
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
    hoppscotch
    kmp-lsp
    fmtron
    samply
  ];
}
