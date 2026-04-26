{ pkgs, ... }:
{
  nixpkgs.config.allowUnfree = true;
  home.packages = with pkgs; [
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
    fd
    ripgrep
    wl-clipboard
    opencode
    wails

    # CLI tools
    tdf
    dust
    aichat
    btop
    bun
    chafa
    ffmpegthumbnailer
    glow
    hexyl
    mise
    nixfmt
    rust-script
    television
    go
    pnpm
    gopls
    lazygit
    lazydocker
    spicetify-cli
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

    python3
    gcc
    gnumake
    pkg-config

    # Program
    slack
  ];
}
