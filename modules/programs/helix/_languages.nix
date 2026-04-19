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
        command = "alejandra";
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
        tab-width = 4;
        unit = "  ";
      };
      auto-format = true;
      formatter = {
        command = "shfmt";
        args = [
          "-i"
          "2"
          "-s"
        ];
      };
    }
    {
      name = "typescript";
      scope = "source.ts";
      file-types = [
        "ts"
        "tsx"
      ];
      auto-format = true;
      formatter = {
        command = "biome";
        args = [
          "format"
          "--stdin-file-path"
          "file.ts"
        ];
      };
    }
    {
      name = "javascript";
      scope = "source.js";
      file-types = [
        "js"
        "jsx"
      ];
      auto-format = true;
      formatter = {
        command = "biome";
        args = [
          "format"
          "--stdin-file-path"
          "file.js"
        ];
      };
    }
    {
      name = "json";
      scope = "source.json";
      file-types = [ "json" ];
      auto-format = true;
      formatter = {
        command = "biome";
        args = [
          "format"
          "--stdin-file-path"
          "file.json"
        ];
      };
    }
    {
      name = "html";
      scope = "text.html";
      file-types = [ "html" ];
      auto-format = true;
      formatter = {
        command = "biome";
        args = [
          "format"
          "--stdin-file-path"
          "file.html"
        ];
      };
    }
    {
      name = "css";
      scope = "source.css";
      file-types = [ "css" ];
      auto-format = true;
      formatter = {
        command = "biome";
        args = [
          "format"
          "--stdin-file-path"
          "file.css"
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
      };
    }
    {
      name = "markdown";
      scope = "source.md";
      file-types = [ "md" ];
      auto-format = true;
      language-servers = [ "marksman" ];
      formatter = {
        command = "biome";
        args = [
          "format"
          "--stdin-file-path"
          "file.md"
        ];
      };
    }
    {
      name = "astro";
      scope = "source.astro";
      file-types = [ "astro" ];
      auto-format = true;
      formatter = {
        command = "biome";
        args = [
          "format"
          "--stdin-file-path"
          "file.astro"
        ];
      };
    }
    {
      name = "vue";
      scope = "source.vue";
      file-types = [ "vue" ];
      auto-format = true;
      formatter = {
        command = "biome";
        args = [
          "format"
          "--stdin-file-path"
          "file.vue"
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
      name = "java";
      scope = "source.java";
      file-types = [ "java" ];
      auto-format = true;
      language-servers = [ "jdtls" ];
    }
    {
      name = "php";
      scope = "source.php";
      file-types = [ "php" ];
      auto-format = true;
      language-servers = [ "intelephense" ];
      formatter = {
        command = "intelephense";
        args = [
          "--format"
          "--stdin-file-path"
          "file.php"
        ];
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
      ];
      auto-format = true;
      language-servers = [ "clangd" ];
      formatter = {
        command = "clang-format";
      };
    }
    {
      name = "python";
      scope = "source.python";
      file-types = [ "py" ];
      auto-format = true;
      language-servers = [ "pyright" ];
      formatter = {
        command = "black";
        args = [ "-" ];
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
      name = "yaml";
      scope = "source.yaml";
      file-types = [
        "yml"
        "yaml"
      ];
      auto-format = true;
      formatter = {
        command = "yamlfmt";
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
      name = "xml";
      scope = "text.xml";
      file-types = [ "xml" ];
      auto-format = true;
      formatter = {
        command = "xmllint";
        args = [
          "--format"
          "-"
        ];
      };
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
    {
      name = "ron";
      scope = "source.ron";
      file-types = [ "ron" ];
      auto-format = true;
    }
  ];
}
