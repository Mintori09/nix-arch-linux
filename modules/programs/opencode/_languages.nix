{pkgs}: let
  formatterBins = {
    alejandra = "${pkgs.alejandra}/bin/alejandra";
    biome = "${pkgs.biome}/bin/biome";
    oxfmt = "${pkgs.oxfmt}/bin/oxfmt";
    rustfmt = "${pkgs.rustfmt}/bin/rustfmt";
    shfmt = "${pkgs.shfmt}/bin/shfmt";
    ruff = "${pkgs.ruff}/bin/ruff";
  };

  lspBins = {
    astro-ls = "${pkgs.astro-language-server}/bin/astro-ls";
    biome = "${pkgs.biome}/bin/biome";
    marksman = "${pkgs.marksman}/bin/marksman";
    nil = "${pkgs.nil}/bin/nil";
    pyright = "${pkgs.pyright}/bin/pyright-langserver";
    rust-analyzer = "${pkgs.rust-analyzer}/bin/rust-analyzer";
    tailwindcss = "${pkgs.tailwindcss-language-server}/bin/tailwindcss-language-server";
    typescript = "${pkgs.typescript-language-server}/bin/typescript-language-server";
    volar = "${pkgs.vue-language-server}/bin/vue-language-server";
  };
in {
  packages = with pkgs; [
    astro-language-server
    biome
    marksman
    nil
    pyright
    rust-analyzer
    rustfmt
    tailwindcss-language-server
    typescript-language-server
    vue-language-server
    alejandra
    oxfmt
    ruff
    shfmt
  ];

  formatter = {
    shfmt = {
      command = [
        formatterBins.shfmt
        "-i"
        "2"
      ];
      extensions = [
        "sh"
        "bash"
      ];
    };
    oxfmt = {
      command = [formatterBins.oxfmt];
      extensions = [
        "yaml"
        "js"
        "json"
        "jsx"
        "md"
        "ts"
        "tsx"
        "rust"
        "css"
        "html"
        "vue"
      ];
    };
    biome = {
      command = [
        formatterBins.biome
        "format"
        "--stdin-file-path"
      ];
      extensions = ["astro"];
    };
    alejandra = {
      command = [
        formatterBins.alejandra
        "-q"
      ];
      extensions = ["nix"];
    };
    rustfmt = {
      command = [formatterBins.rustfmt];
      extensions = ["rs"];
    };
    ruff = {
      command = [
        formatterBins.ruff
        "format"
      ];
      extensions = ["py"];
    };
  };

  lsp = {
    astro-ls = {
      command = [
        lspBins.astro-ls
        "--stdio"
      ];
      extensions = ["astro"];
    };
    biome = {
      command = [
        lspBins.biome
        "lsp-proxy"
      ];
      extensions = [
        "js"
        "ts"
        "json"
        "jsx"
        "tsx"
      ];
    };
    nil = {
      command = [lspBins.nil];
      extensions = ["nix"];
    };
    marksman = {
      command = [lspBins.marksman];
      extensions = ["md"];
    };
    tailwindcss = {
      command = [
        lspBins.tailwindcss
        "--stdio"
      ];
      extensions = [
        "css"
        "html"
      ];
    };
    pyright = {
      command = [
        lspBins.pyright
        "--stdio"
      ];
      extensions = ["py"];
    };
    rust-analyzer = {
      command = [lspBins.rust-analyzer];
      extensions = ["rs"];
    };
    typescript = {
      command = [
        lspBins.typescript
        "--stdio"
      ];
      extensions = [
        "js"
        "ts"
        "jsx"
        "tsx"
      ];
    };
    volar = {
      command = [
        lspBins.volar
        "--stdio"
      ];
      extensions = ["vue"];
    };
  };
}
