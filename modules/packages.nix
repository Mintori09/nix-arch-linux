{ pkgs, inputs, ... }:
{
  nixpkgs.config.allowUnfree = true;
  home.packages = with pkgs; [
    inputs.mmdr.packages.${pkgs.system}.default
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
    systemctl-tui
    # magika
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
    codex

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
    sd
    watchexec
    rclone
    trashy
  ];

}
