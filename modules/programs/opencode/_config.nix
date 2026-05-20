{
  pkgs,
  lib,
}: let
  providers = import ./_providers.nix;
  mcp = import ./_mcp.nix;
  languages = import ./_languages.nix {inherit pkgs;};
in
  builtins.toJSON {
    "$schema" = "https://opencode.ai/config.json";
    plugin = [
      "superpowers@git+https://github.com/obra/superpowers.git"
      "@tarquinen/opencode-dcp@git+https://github.com/Opencode-DCP/opencode-dynamic-context-pruning.git"
    ];
    autoupdate = false;
    share = "disabled";
    model = "opencode-go/deepseek-v4-flash";
    disabled_providers = providers.disabled;
    mcp = mcp;
    permission = {
      read = {
        "~/.ssh/**" = "deny";
        "~/.gnupg/**" = "deny";
        "~/.aws/**" = "deny";
        "~/.azure/**" = "deny";
        "~/.kube/**" = "deny";
        "~/.docker/**" = "deny";
        "~/.config/gcloud/**" = "deny";
        ".env*" = "deny";
        "*.pem" = "deny";
        "*.key" = "deny";
        "*.p12" = "deny";
        "*.jks" = "deny";
        "*credentials*" = "deny";
      };
      edit = {
        "~/.aws/**" = "deny";
        "~/.azure/**" = "deny";
        "~/.ssh/**" = "deny";
        "~/.gnupg/**" = "deny";
        "~/.kube/**" = "deny";
        "~/.docker/**" = "deny";
        "~/.config/gcloud/**" = "deny";
      };
      bash = {
        "rm *credentials*" = "deny";
        "rm *.env*" = "deny";
      };
    };
    inherit (languages) formatter lsp;
  }
