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

    # CLI tools
    tdf
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
    glow
    navi
    lazyjournal
    lazysql

    # Formatters & linters
    gofumpt
    hadolint
    kdlfmt
    kdlfmt
    ruff
    shellcheck
    shfmt
    sql-formatter
    stylua
    taplo

    # Program
    slack
  ];
}
