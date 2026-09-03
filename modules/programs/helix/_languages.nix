{ pkgs, ... }:

let
  toTOML = (pkgs.formats.toml { }).generate;
in
toTOML "languages.toml" {
  language = [
    {
      name = "nix";
      scope = "source.nix";
      file-types = [ "nix" ];
      auto-format = true;
      formatter = {
        command = "nixfmt";
      };
    }
    {
      name = "bash";
      scope = "source.bash";
      injection-regex = "(shell|bash|sh)";
      file-types = [
        "sh"
        "bash"
        "shebang"
      ];
      shebangs = [
        "sh"
        "bash"
        "dash"
      ];
      comment-token = "#";
      language-servers = [ "bash-language-server" ];
      indent = {
        tab-width = 2;
        unit = "  ";
      };
      auto-format = true;
      formatter = {
        command = "shfmt";
        args = [
          "-i"
          "2"
          "-ci"
        ];
      };
    }
    {
      name = "sh";
      scope = "source.sh";
      file-types = [
        "sh"
        "bash"
      ];
      auto-format = true;
      formatter = {
        command = "shfmt";
        args = [
          "-i"
          "2"
          "-ci"
        ];
      };
    }
    {
      name = "javascript";
      scope = "source.js";
      file-types = [
        "js"
        "mjs"
        "cjs"
      ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "babel"
        ];
      };
    }
    {
      name = "jsx";
      scope = "source.jsx";
      file-types = [ "jsx" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "babel"
        ];
      };
    }
    {
      name = "typescript";
      scope = "source.ts";
      file-types = [
        "ts"
        "mts"
        "cts"
      ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "typescript"
        ];
      };
    }
    {
      name = "tsx";
      scope = "source.tsx";
      file-types = [ "tsx" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "typescript"
        ];
      };
    }
    {
      name = "vue";
      scope = "source.vue";
      file-types = [ "vue" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "vue"
        ];
      };
    }
    {
      name = "css";
      scope = "source.css";
      file-types = [ "css" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "css"
        ];
      };
    }
    {
      name = "scss";
      scope = "source.scss";
      file-types = [ "scss" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "scss"
        ];
      };
    }
    {
      name = "html";
      scope = "text.html";
      file-types = [ "html" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "html"
        ];
      };
    }
    {
      name = "json";
      scope = "source.json";
      file-types = [ "json" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "json"
        ];
      };
    }
    {
      name = "jsonc";
      scope = "source.jsonc";
      file-types = [ "jsonc" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "json"
        ];
      };
    }
    {
      name = "yaml";
      scope = "source.yaml";
      file-types = [
        "yml"
        "yaml"
      ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "yaml"
        ];
      };
    }
    {
      name = "graphql";
      scope = "source.graphql";
      file-types = [
        "gql"
        "graphql"
      ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "graphql"
        ];
      };
    }
    {
      name = "markdown";
      scope = "source.md";
      file-types = [ "md" ];
      auto-format = true;
      language-servers = [ "marksman" ];
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "markdown"
          "--prose-wrap"
          "never"
        ];
      };
    }
    {
      name = "typst";
      scope = "source.typst";
      file-types = [ "typ" ];
      auto-format = true;
      formatter = {
        command = "typstyle";
      };
    }
    {
      name = "python";
      scope = "source.python";
      file-types = [ "py" ];
      auto-format = true;
      language-servers = [ "pyright" ];
      formatter = {
        command = "ruff";
        args = [
          "format"
          "-"
        ];
      };
    }
    {
      name = "lua";
      scope = "source.lua";
      file-types = [ "lua" ];
      auto-format = true;
      language-servers = [ "lua-language-server" ];
      formatter = {
        command = "stylua";
        args = [ "-" ];
      };
    }
    {
      name = "php";
      scope = "source.php";
      file-types = [ "php" ];
      auto-format = true;
      language-servers = [ "intelephense" ];
      formatter = {
        command = "pint";
      };
    }
    {
      name = "go";
      scope = "source.go";
      file-types = [ "go" ];
      auto-format = true;
      language-servers = [ "gopls" ];
      formatter = {
        command = "gofumpt";
      };
    }
    {
      name = "rust";
      scope = "source.rust";
      file-types = [ "rs" ];
      auto-format = true;
      language-servers = [ "rust-analyzer" ];
      formatter = {
        command = "rustfmt";
      };
    }
    {
      name = "toml";
      scope = "source.toml";
      file-types = [ "toml" ];
      auto-format = true;
      formatter = {
        command = "taplo";
        args = [
          "fmt"
          "-"
        ];
      };
    }
    {
      name = "sql";
      scope = "source.sql";
      file-types = [ "sql" ];
      auto-format = true;
      formatter = {
        command = "sql-formatter";
      };
    }
    {
      name = "dockerfile";
      scope = "source.dockerfile";
      file-types = [
        "Dockerfile"
        "dockerfile"
      ];
      auto-format = true;
      language-servers = [ "dockerfile-language-server" ];
    }
    {
      name = "java";
      scope = "source.java";
      file-types = [ "java" ];
      auto-format = true;
      language-servers = [ "jdtls" ];
      formatter = {
        command = "google-java-format";
        args = [ "-" ];
      };
    }
    {
      name = "c";
      scope = "source.c";
      file-types = [
        "c"
        "h"
      ];
      auto-format = true;
      language-servers = [ "clangd" ];
      formatter = {
        command = "clang-format";
      };
    }
    {
      name = "cpp";
      scope = "source.cpp";
      file-types = [
        "cpp"
        "hpp"
        "cc"
        "hh"
        "cxx"
        "hxx"
        "ino"
      ];
      auto-format = true;
      language-servers = [ "clangd" ];
      formatter = {
        command = "clang-format";
      };
    }
    {
      name = "c-sharp";
      scope = "source.cs";
      file-types = [ "cs" ];
      auto-format = true;
      formatter = {
        command = "csharpier";
        args = [ "--write-stdout" ];
      };
    }
    {
      name = "ron";
      scope = "source.ron";
      file-types = [ "ron" ];
      auto-format = true;
      formatter = {
        command = "ronfmt";
      };
    }
    {
      name = "astro";
      scope = "source.astro";
      file-types = [ "astro" ];
      auto-format = true;
      formatter = {
        command = "prettier";
        args = [
          "--parser"
          "astro"
        ];
      };
    }
    {
      name = "zig";
      scope = "source.zig";
      file-types = [ "zig" ];
      auto-format = true;
    }
    {
      name = "cmake";
      scope = "source.cmake";
      file-types = [ "cmake" ];
      auto-format = true;
      formatter = {
        command = "cmake-format";
      };
    }
  ];
}
