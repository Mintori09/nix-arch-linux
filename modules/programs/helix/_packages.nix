{ pkgs }:
with pkgs;
[
  # Language Server Protocol
  astro-language-server
  biome
  marksman
  nil
  tailwindcss-language-server
  vue-language-server
  zls
  gopls
  tinymist
  csharp-ls

  # New LSPs
  jdt-language-server
  intelephense
  clang-tools
  pyright
  lua-language-server
  dockerfile-language-server
  docker-compose-language-service
  rust-analyzer
  bash-language-server

  # Formatters & Linters
  nixfmt
  alejandra
  oxfmt
  shfmt
  prettier
  black
  ruff
  stylua
  gofumpt
  gotools # provides goimports
  rustfmt
  taplo
  sql-formatter
  google-java-format
  csharpier
  hadolint
  typstyle
]
