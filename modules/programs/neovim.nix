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
          pynvim
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

      marksman

      clang-tools
      cmake-language-server
      dockerfile-language-server-nodejs
      nodePackages.tailwindcss-language-server
      nodePackages.intelephense
      rustc
      cargo
    ];
  };
}
