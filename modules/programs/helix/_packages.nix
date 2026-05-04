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

  # Formatters
  alejandra
  oxfmt
  shfmt
  black
  stylua
]
