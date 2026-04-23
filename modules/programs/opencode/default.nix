{ pkgs, lib, ... }:
let
  languages = import ./_languages.nix { inherit pkgs; };
  skills = import ./_skills.nix { inherit pkgs; };
  providers = import ./_providers.nix;
  mcp = import ./_mcp.nix;

  inherit (pkgs) opencode;

  # Environment containing only the tools (languages/skills), not opencode itself.
  # This is safe to reference in the wrapper script.
  toolsEnv = pkgs.buildEnv {
    name = "opencode-tools-env";
    paths = languages.packages ++ skills.packages;
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

  # Final environment containing the wrapped opencode.
  # opencodeWrapped is placed last so it takes precedence.
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
  # Use hiPrio to ensure this environment takes precedence over any other
  # packages providing 'opencode' (e.g., dependencies of other tools).
  home.packages = [
    (lib.hiPrio opencodeEnv)
  ];
  xdg.configFile = {
    "${configFile}".text = builtins.toJSON {
      "$schema" = "https://opencode.ai/config.json";
      # plugin = [""];
      autoupdate = false;
      share = "disabled";
      disabled_providers = providers.disabled;
      enabled_providers = providers.enabled;
      mcp = mcp;
      inherit (languages) formatter lsp;
    };
    "opencode/skill".source = skills.skillsSource + "/skill";
  };
}
