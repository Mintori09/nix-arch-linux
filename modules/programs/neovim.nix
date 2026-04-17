{ pkgs, ... }:

{
  programs.neovim = {
    enable = true;
    viAlias = true;
    vimAlias = true;

    withNodeJs = true;
    withPython3 = true;

    extraPackages = with pkgs; [
      gcc
      gnumake
      tree-sitter

      # --- Go Development ---
      go
      gopls
      gotools
      golangci-lint
      gomodifytags
      impl

      # --- JavaScript / TypeScript / Bun ---
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

      # --- Lua  ---
      lua-language-server
      stylua

      # --- CLI Utilities  ---
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
