{
  pkgs,
  lib,
  config,
  ...
}:

let
  oc-go-cc = pkgs.stdenv.mkDerivation {
    name = "oc-go-cc";
    src = pkgs.fetchurl {
      url = "https://github.com/samueltuyizere/oc-go-cc/releases/download/v0.1.6/oc-go-cc_linux-amd64";
      sha256 = "a0ba4f3b934e6692341f6001ec4a8cdeed5d8ca4479268b62e41ffdd9b1d0613";
    };
    phases = [ "installPhase" ];
    installPhase = ''
      install -m755 -D $src $out/bin/oc-go-cc
    '';
  };

  oc-go-cc-wrapper = pkgs.writeShellScriptBin "oc-go-cc" ''
    export OC_GO_CC_API_KEY="$(
      ${pkgs.jq}/bin/jq -r '.OC_GO_CC_API_KEY // empty' \
        "${config.home.homeDirectory}/.config/home-manager/secrets.json"
    )"
    exec ${oc-go-cc}/bin/oc-go-cc "$@"
  '';
in
{
  home.packages = [
    oc-go-cc-wrapper
  ];

  xdg.configFile."oc-go-cc/config.json".text = builtins.toJSON {
    api_key = "\${OC_GO_CC_API_KEY}";
    host = "127.0.0.1";
    port = 3456;
    hot_reload = false;

    models = {
      default = {
        provider = "opencode-go";
        model_id = "deepseek-v4-flash";
        temperature = 0.7;
        max_tokens = 4096;
      };
      background = {
        provider = "opencode-go";
        model_id = "deepseek-v4-flash";
        temperature = 0.5;
        max_tokens = 2048;
      };
      think = {
        provider = "opencode-go";
        model_id = "deepseek-v4-pro";
        temperature = 0.7;
        max_tokens = 8192;
      };
      complex = {
        provider = "opencode-go";
        model_id = "deepseek-v4-pro";
        temperature = 0.7;
        max_tokens = 4096;
      };
      long_context = {
        provider = "opencode-go";
        model_id = "glm-5.1";
        temperature = 0.7;
        max_tokens = 16384;
        context_threshold = 80000;
      };
      fast = {
        provider = "opencode-go";
        model_id = "deepseek-v4-flash";
        temperature = 0.7;
        max_tokens = 4096;
      };
    };

    fallbacks = {
      default = [
        {
          provider = "opencode-go";
          model_id = "deepseek-v4-pro";
        }
        {
          provider = "opencode-go";
          model_id = "glm-5.1";
        }
      ];
      think = [
        {
          provider = "opencode-go";
          model_id = "deepseek-v4-flash";
        }
      ];
      complex = [
        {
          provider = "opencode-go";
          model_id = "deepseek-v4-flash";
        }
      ];
      long_context = [
        {
          provider = "opencode-go";
          model_id = "deepseek-v4-pro";
        }
      ];
      fast = [
        {
          provider = "opencode-go";
          model_id = "deepseek-v4-pro";
        }
      ];
    };

    opencode_go = {
      base_url = "https://opencode.ai/zen/go/v1/chat/completions";
      timeout_ms = 300000;
    };

    logging = {
      level = "info";
      requests = true;
    };
  };

  systemd.user.services.oc-go-cc = {
    Unit = {
      Description = "OpenCode Go to Claude Code proxy";
      After = [ "network-online.target" ];
      Wants = [ "network-online.target" ];
    };
    Service = {
      ExecStart = "${oc-go-cc-wrapper}/bin/oc-go-cc serve";
      Restart = "on-failure";
      RestartSec = 5;
    };
    Install.WantedBy = [ "default.target" ];
  };

  home.sessionVariables = {
    ANTHROPIC_BASE_URL = "http://127.0.0.1:3456";
    ANTHROPIC_AUTH_TOKEN = "unused";
  };
}
