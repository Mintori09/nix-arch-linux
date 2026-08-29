{ pkgs, ... }:
let
  inherit (pkgs) lib;
  helpers = import ./_helpers.nix { inherit pkgs; };

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
    pkgs.fmtron
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

  yamlSrc = pkgs.fetchurl {
    url = "https://registry.npmjs.org/yaml/-/yaml-2.9.0.tgz";
    sha256 = "14ggs4m6rb3wm5mi9s2n6kkgz9h9pymlb81b4zh019qvrc2a53q0";
  };

  yamlPackage = pkgs.runCommand "yaml-2.9.0" { } ''
    mkdir -p $out/lib/node_modules/yaml
    tar -xzf ${yamlSrc} -C $out/lib/node_modules/yaml --strip-components=1
  '';
in
{
  home.packages =
    helpers.mkScriptPackage {
      name = "format";
      entry = "${../../scripts/execute/format-file.ts}";
      extraPathPackages = formatterPackages;
      extraEnv = ''
        export NODE_PATH="${yamlPackage}/lib/node_modules:$NODE_PATH"
        export FORMAT_PRETTIER_ENTRYPOINT="${pkgs.prettier}/lib/node_modules/prettier/index.mjs";
      '';
    }
    ++ formatterPackages;
}
