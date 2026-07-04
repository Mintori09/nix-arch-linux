{
  config,
  lib,
  inputs,
  hostName,
  ...
}:

let
  inherit (config.home) homeDirectory;
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

      agentic-qe = {
        path = inputs.agentic-qe.outPath;
        subdir = ".claude/skills";
      };

      nicknisi-dotfiles = {
        path = inputs.nicknisi-dotfiles.outPath;
        subdir = "home/.claude/skills";
      };

      ccconfigs = {
        path = inputs.ccconfigs.outPath;
        subdir = "essentials/skills";
        filter.nameRegex = "^writing-documentation$";
      };

      awesome-claude-skills = {
        path = inputs.awesome-claude-skills.outPath;
        filter.nameRegex = "^changelog-generator$";
      };

      agent-toolkit = {
        path = inputs.agent-toolkit.outPath;
        subdir = "skills";
      };

      skill-seekers = {
        path = inputs.skill-seekers.outPath;
        subdir = "skills";
      };

      superpowers = {
        path = inputs.superpowers.outPath;
        subdir = "skills";
      };

      opencode-local = {
        path = ./opencode/skills;
      };
    }
    // lib.optionalAttrs (hostName == "work-laptop") {
      work = {
        path = "${homeDirectory}/work/agent-skills";
        subdir = "skills";
      };
    };

    skills.enableAll = [
      "opencode-local"
      "superpowers"
    ];

    skills.enable = [
      "skill-creator"
      "webapp-testing"
      "frontend-design"
      "react-best-practices"
      "technical-writing"
      "blog-post-writer"
      "writing-documentation"
      "changelog-generator"
      "commit-work"
      "skill-seekers"
      "anki-vocab-generator"
    ];

    targets = {
      claude = {
        enable = true;
        dest = ".claude/skills";
        structure = "link";
      };

      opencode = {
        enable = true;
        dest = ".config/opencode/skill";
        structure = "link";
      };

      codex = {
        enable = true;
        dest = ".codex/skills";
        structure = "link";
      };

      antigravity = {
        enable = true;
        dest = ".gemini/skills";
        structure = "link";
      };
    };
  };
}
