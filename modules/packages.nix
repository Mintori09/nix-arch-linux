{ pkgs, ... }:
{
  nixpkgs.config.allowUnfree = true;
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
    fastfetch
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
    go
    gopls
    lazygit
    lazydocker

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

    # Program
    obsidian
    slack
  ];
}
