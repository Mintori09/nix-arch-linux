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
      yaml-language-server

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
          pynvim
        ]
      ))
      basedpyright
      ruff

      lua-language-server
      stylua

      ripgrep
      fd
      fzf
      lazygit
      sqlite

      marksman

      clang-tools
      cmake-language-server
      dockerfile-language-server
      tailwindcss-language-server
      intelephense
      rustc
      cargo
    ];
  };
}
