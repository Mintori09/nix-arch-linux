# ~/.config/home-manager/modules/programs/neovim.nix
{ pkgs, ... }:

{
  home.packages = with pkgs; [
    gcc
    gnumake
    tree-sitter

    go
    gopls
    golangci-lint
    gomodifytags
    impl

    bun
    nodejs_22
    typescript-language-server
    vtsls
    prettier
    eslint

    (python3.withPackages (
      ps: with ps; [
        black
        isort
        pyflakes
      ]
    ))
    pyright
    ruff

    lua-language-server
    stylua

    ripgrep
    fd
    fzf
    lazygit
    sqlite

    pandoc
    marksman
  ];
}
