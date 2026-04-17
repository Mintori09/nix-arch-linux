{ pkgs, ... }:

let
  toTOML = (pkgs.formats.toml { }).generate;
in
toTOML "languages.toml" {
  language = [
    {
      name = "nix";
      scope = "source.nix";
      auto-format = true;
      formatter = {
        command = "alejandra";
      };
    }
    {
      name = "typescript";
      scope = "source.ts";
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
      auto-format = true;
      formatter = {
        command = "shfmt";
      };
    }
    {
      name = "markdown";
      scope = "source.md";
      auto-format = true;
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
      auto-format = true;
    }
  ];
}
