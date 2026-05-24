{
  pkgs,
  lib,
  config,
  ...
}:
let
  languages = import ./languages.nix { inherit pkgs; };
  configJson = import ./config.nix { inherit pkgs lib config; };

  inherit (pkgs) opencode;

  toolsEnv = pkgs.buildEnv {
    name = "opencode-tools-env";
    paths = languages.packages;
  };

  opencodeInitScript = pkgs.writeShellScript "opencode-init" ''
    mkdir -p "$HOME/.local/cache/opencode/node_modules/@opencode-ai"
    mkdir -p "$HOME/.config/opencode/node_modules/@opencode-ai"
    if [ -d "$HOME/.config/opencode/node_modules/@opencode-ai/plugin" ]; then
      if [ ! -L "$HOME/.local/cache/opencode/node_modules/@opencode-ai/plugin" ]; then
        ln -sf "$HOME/.config/opencode/node_modules/@opencode-ai/plugin" \
               "$HOME/.local/cache/opencode/node_modules/@opencode-ai/plugin"
      fi
    fi
    exec ${opencode}/bin/opencode "$@"
  '';

  opencodeWrapped =
    pkgs.runCommand "opencode-wrapped"
      {
        buildInputs = [ pkgs.makeWrapper ];
      }
      ''
        mkdir -p $out/bin
        makeWrapper ${opencodeInitScript} $out/bin/opencode \
          --prefix PATH : ${toolsEnv}/bin \
          --prefix LD_LIBRARY_PATH : "${pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ]}"
      '';

  opencodeEnv = pkgs.buildEnv {
    name = "opencode-env";
    paths = [
      toolsEnv
      opencodeWrapped
    ];
  };

  configFile = "opencode/config.json";
in
{
  home.packages = [
    (lib.hiPrio opencodeEnv)
  ];
  xdg.configFile."${configFile}".text = configJson;
}
