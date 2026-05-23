# ~/.config/home-manager/modules/programs/neovim.nix
{ pkgs, ... }:

{
  programs.neovim = {
    enable = true;
    sideloadInitLua = true;

    extraPackages = with pkgs; [
      gcc
      gnumake
      rust-analyzer
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
  };
}
