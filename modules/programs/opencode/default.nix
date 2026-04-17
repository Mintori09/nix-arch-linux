{ pkgs, lib, ... }:
let
  languages = import ./_languages.nix { inherit pkgs; };
  skills = import ./_skills.nix { inherit pkgs; };

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
      disabled_providers = [
        "amazon-bedrock"
        "anthropic"
        "azure-openai"
        "azure-cognitive-services"
        "baseten"
        "cerebras"
        "cloudflare-ai-gateway"
        "cortecs"
        "deepseek"
        "deep-infra"
        "github-copilot"
        "groq"
        "hugging-face"
        "helicone"
        "llama.cpp"
        "io-net"
        "lmstudio"
        "moonshot-ai"
        "nebius-token-factory"
        "ollama"
        "ollama-cloud"
        "openai"
        "sap-ai-core"
        "ovhcloud-ai-endpoints"
        "together-ai"
        "venice-ai"
        "xai"
        "zai"
        "zenmux"
        "google"
      ];
      enabled_providers = [
        "openrouter"
        "opencode"
        "nano-gpt"
      ];
      mcp = {
        gh_grep = {
          type = "remote";
          url = "https://mcp.grep.app/";
          enabled = true;
          timeout = 10000;
        };
        deepwiki = {
          type = "remote";
          url = "https://mcp.deepwiki.com/mcp";
          enabled = true;
          timeout = 10000;
        };
        context7 = {
          type = "remote";
          url = "https://mcp.context7.com/mcp";
          enabled = true;
          timeout = 10000;
        };
      };
      inherit (languages) formatter lsp;
    };
    "opencode/skill".source = skills.skillsSource + "/skill";
  };
}
