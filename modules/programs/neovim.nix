# ~/.config/home-manager/modules/programs/neovim.nix
{ pkgs, ... }:

{
  programs.neovim = {
    enable = true;
    sideloadInitLua = true;

    extraPackages = with pkgs; [
      gcc
      live-server
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
      slint-lsp
    ];
  };

  xdg.desktopEntries.nvim = {
    name = "Neovim";
    genericName = "Text Editor";
    comment = "Vim-fork focused on extensibility and usability";
    icon = "nvim";
    exec = "kitty -e nvim %F";
    terminal = false;
    type = "Application";
    categories = [
      "Development"
      "TextEditor"
      "Utility"
    ];
    mimeType = [
      "text/plain"
      "text/markdown"
      "text/x-makefile"
      "text/x-c"
      "text/x-c++"
      "text/x-csrc"
      "text/x-chdr"
      "text/x-python"
      "text/x-shellscript"
      "application/json"
      "application/toml"
      "application/yaml"
      "application/xml"
      "application/x-yaml"
    ];
  };
}
