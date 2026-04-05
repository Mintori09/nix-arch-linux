{ pkgs, ... }:
{
  home.packages = with pkgs; [
    # Archive
    atool
    gnutar
    pbzip2
    pigz
    pxz
    unzip
    zip
    zstd

    # Core utilities
    fd
    ripgrep
    wl-clipboard
    opencode

    # CLI tools
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
  ];
}
