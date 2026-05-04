{ pkgs, ... }:
let
  inherit (pkgs) lib;
  helpers = import ./_helpers.nix { inherit pkgs; };

  fmtron = pkgs.rustPlatform.buildRustPackage {
    pname = "fmtron";
    version = "unstable-2026-04-21";

    src = pkgs.fetchFromGitHub {
      owner = "barafael";
      repo = "fmtron";
      rev = "937cec1356aa35ae1b41c83a5b1372d5950608b1";
      hash = "sha256-KQzcN7MSJHZtNZ9QTMqb8THbCnoX4EU2U9TWJR97gik=";
    };

    cargoHash = "sha256-7mizUBkJdzODXqs8O/nVGgUYWFaBfEgkHfiNz7klNeo=";
  };

  optionalPkg =
    name:
    lib.optionals (builtins.hasAttr name pkgs) [
      (builtins.getAttr name pkgs)
    ];

  optionalNestedPkg =
    parent: name:
    lib.optionals (builtins.hasAttr parent pkgs && builtins.hasAttr name (builtins.getAttr parent pkgs))
      [
        (builtins.getAttr name (builtins.getAttr parent pkgs))
      ];

  formatterPackages = [
    pkgs.bun
    pkgs.prettier
    pkgs.taplo
    fmtron
    pkgs.kdlfmt
    pkgs.rustfmt
    pkgs.stylua
    pkgs.ruff
    pkgs.go
    pkgs.nixfmt
    pkgs.dart
    pkgs.elixir
    pkgs.erlfmt
    pkgs.shfmt
  ]
  ++ optionalPkg "clang-tools"
  ++ optionalPkg "blade-formatter"
  ++ optionalPkg "google-java-format"
  ++ optionalPkg "dotnet-sdk"
  ++ optionalPkg "sql-formatter"
  ++ optionalPkg "prisma"
  ++ optionalPkg "dockfmt"
  ++ optionalNestedPkg "phpPackages" "php-cs-fixer";

in
{
  home.packages =
    helpers.mkScriptPackage {
      name = "format";
      runtime = "${pkgs.bun}/bin/bun";
      entry = "${../../scripts/execute/format-file.ts}";
      extraPathPackages = formatterPackages;
      extraEnv = ''
        export FORMAT_PRETTIER_ENTRYPOINT="${pkgs.prettier}/lib/node_modules/prettier/index.mjs"
      '';
    }
    ++ formatterPackages;
}
