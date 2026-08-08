{
  pkgs,
  lib,
  config,
}:
let
  providers = import ./providers.nix;
  mcp = import ./mcp.nix { inherit pkgs config; };
  languages = import ./languages.nix { inherit pkgs; };
in
builtins.toJSON {
  "$schema" = "https://opencode.ai/config.json";
  plugin = [
    "superpowers@git+https://github.com/obra/superpowers.git"
    # "@tarquinen/opencode-dcp"
    "@mohak34/opencode-notifier@latest"
  ];
  agent = {
    yolo = {
      description = "Allow all permission";
      model = "opencode/deepseek-v4-flash-free";
      prompt = "";
      permission = {
        "*" = "allow";
      };
    };
  };
  # agent = {
  #   code-reviewer = {
  #     description = "Reviews code for best practices and potential issues";
  #     model = "opencode-go/deepseek-v4-pro";
  #     prompt = "/using-superpowers You are a code reviewer. Focus on security, performance, and maintainability.";
  #     tools = {
  #       write = false;
  #       edit = false;
  #     };
  #   };
  #
  #   plan = {
  #     description = "Architects implementation plans and breaks down complex features";
  #     model = "opencode-go/deepseek-v4-pro";
  #     prompt = "/using-superpowers You are a technical project planner. Break down feature requests into step-by-step implementation plans and milestones.";
  #     tools = {
  #       write = true;
  #       edit = true;
  #     };
  #   };
  # };
  autoupdate = true;
  share = "disabled";
  model = "opencode/deepseek-v4-flash-free";

  skills = {
    paths = [
      "~/.config/opencode/skill"
    ];
  };
  disabled_providers = providers.disabled;
  mcp = mcp;
  permission = {
    websearch = "allow";
    question = "allow";
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
