{ pkgs }:
let
  fetchSkill =
    {
      name,
      owner,
      repo,
      rev,
      path,
      hash,
    }:
    pkgs.stdenv.mkDerivation {
      name = "opencode-skill-${name}";
      src = pkgs.fetchFromGitHub {
        inherit
          owner
          repo
          rev
          hash
          ;
      };

      installPhase = ''
        mkdir -p $out
        cp ${path} $out/SKILL.md
      '';
    };

  fetchSkillDir =
    {
      name,
      owner,
      repo,
      rev,
      basePath,
      hash,
    }:
    pkgs.stdenv.mkDerivation {
      name = "opencode-skill-${name}";
      src = pkgs.fetchFromGitHub {
        inherit
          owner
          repo
          rev
          hash
          ;
      };

      installPhase = ''
        mkdir -p $out
        cp -r ${basePath}/* $out/
      '';
    };

  localSkill =
    {
      name,
      path,
    }:
    pkgs.stdenv.mkDerivation {
      name = "opencode-skill-${name}";
      src = path;
      installPhase = ''
        mkdir -p $out
        cp SKILL.md $out/SKILL.md
      '';
    };

  skills = {
    technical-writing = fetchSkill {
      name = "technical-writing";
      owner = "proffesor-for-testing";
      repo = "agentic-qe";
      rev = "990aee4a6a747f2db0ef77a2f67d58462f61e608";
      path = ".claude/skills/technical-writing/SKILL.md";
      hash = "sha256-PdIVhLp5/quigz325ZeG4NaWUgPsD3PgykSD61FFjLo=";
    };

    blog-post-writer = fetchSkillDir {
      name = "blog-post-writer";
      owner = "nicknisi";
      repo = "dotfiles";
      rev = "f1be3f2b669c8e3401b589141f9a56651e45a1a7";
      basePath = "home/.claude/skills/blog-post-writer";
      hash = "sha256-U1GqtQMgzimGbbDJpqIGrBnu5HiSTZDETAKFhijMU9s=";
    };

    frontend-design = fetchSkill {
      name = "frontend-design";
      owner = "anthropics";
      repo = "claude-code";
      rev = "d213a74fc8e3b6efded52729196e0c2d4c3abb3e";
      path = "plugins/frontend-design/skills/frontend-design/SKILL.md";
      hash = "sha256-SleLxTUjM7HNHc78YklikuFwix2DPaTDIACUnsSQCrA=";
    };

    # flutter-development = fetchSkill {
    #   name = "flutter-development";
    #   owner = "aj-geddes";
    #   repo = "useful-ai-prompts";
    #   rev = "ce8c39c22df0e0e64c853817a7f8d79f0ea331e2";
    #   path = "skills/flutter-development/SKILL.md";
    #   hash = "sha256-BCvO+P2URoTiUOSV8PTq62ckyxXLEHtIml0EkZGRbK8=";
    # };

    writing-documentation = fetchSkillDir {
      name = "writing-documentation";
      owner = "dhruvbaldawa";
      repo = "ccconfigs";
      rev = "451b604718d39fcc2c008d22e550bdf60c7115da";
      basePath = "essentials/skills/writing-documentation";
      hash = "sha256-7V1xG2FmzqWdnWmVV6WWKBAvY6QHWo+UKzh0Uu/Xg/w=";
    };

    changelog-generator = fetchSkill {
      name = "changelog-generator";
      owner = "composioHQ";
      repo = "awesome-claude-skills";
      rev = "362d35428562ad05d1faa1767abaf39d6e3a8e7a";
      path = "changelog-generator/SKILL.md";
      hash = "sha256-tSEO0h9J3lPVePFoy7A7c1K6umNNE/21/2RbaJD4Abc=";
    };

    commit-work = fetchSkillDir {
      name = "commit-work";
      owner = "softaworks";
      repo = "agent-toolkit";
      rev = "3027f20f3181758385a1bb8c022d4041dfb4de84";
      basePath = "skills/commit-work";
      hash = "sha256-1q4IP55kvZhJibTLJct0SSifw46lBmAQhp9nSmDzYxs=";
    };

    memory-aware-architect = localSkill {
      name = "memory-aware-architect";
      path = ./skills/memory-aware-architect;
    };

    vercel-react-best-practices = fetchSkillDir {
      name = "vercel-react-best-practices";
      owner = "vercel-labs";
      repo = "agent-skills";
      rev = "b9c8ee0643d87d3c5a953d1e22382ff2ead39229";
      basePath = "skills/react-best-practices";
      hash = "sha256-6AGzIGGAMFrfPRZDac3Dtn+K07V6BhpY/td5gTDkRsg=";
    };

    skill-seekers = fetchSkillDir {
      name = "skill-seekers";
      owner = "yusufkaraaslan";
      repo = "Skill_Seekers";
      rev = "ff0f832febc8db931e88d401a8d0896aac134159";
      basePath = "skills/skill-seekers";
      hash = "sha256-Ht374rBPMDo3ma98vfh5L8JJrJH64oq/TVzb3lE8754=";
    };

    webapp-testing = fetchSkillDir {
      name = "webapp-testing";
      owner = "anthropics";
      repo = "skills";
      rev = "6a5bb06904ab164a345e41c381fc9097954b83da";
      basePath = "skills/webapp-testing";
      hash = "sha256-GytrPFxw1PC2B0MILR6eNa83qAmxcjvLPkJzHQXT93g=";
    };
  };

  allSkills = pkgs.runCommand "opencode-skills" { } ''
    mkdir -p $out/skill

    ${pkgs.lib.concatStringsSep "\n" (
      pkgs.lib.mapAttrsToList (name: skill: ''
        mkdir -p $out/skill/${name}
        cp -r ${skill}/* $out/skill/${name}/
      '') skills
    )}
  '';
in
{
  packages = [ ];
  skillsSource = allSkills;
}
