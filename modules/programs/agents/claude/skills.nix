{
  config,
  lib,
  inputs,
  hostName,
  ...
}:

let
  home = config.home.homeDirectory;
in
{
  programs.agent-skills = {
    enable = true;

    sources = {
      anthropic = {
        path = inputs.anthropic-skills.outPath;
        subdir = "skills";
      };

      vercel = {
        path = inputs.vercel-skills.outPath;
        subdir = "skills";
      };

      local = {
        path = "${home}/.config/home-manager/config/agents/local-skills";
      };
    }
    // lib.optionalAttrs (hostName == "work-laptop") {
      work = {
        path = "${home}/work/agent-skills";
        subdir = "skills";
      };
    };

    skills.enableAll = [ "local" ];

    skills.enable = [
      "skill-creator"
      "webapp-testing"
      "frontend-design"
      "react-best-practices"
    ];

    targets = {
      claude = {
        dest = ".claude/skills";
        structure = "link";
      };

      codex = {
        dest = ".codex/skills";
        structure = "link";
      };
    };
  };
}
