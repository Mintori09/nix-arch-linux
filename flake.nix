{
  description = "My home manager configuration!";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    nixgl.url = "github:nix-community/nixGL";

    spicetify-nix = {
      url = "github:Gerg-L/spicetify-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    sops-nix = {
      url = "github:Mic92/sops-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    agent-skills-nix = {
      url = "github:Kyure-A/agent-skills-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    llm-agents = {
      url = "github:numtide/llm-agents.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    mcp-servers-nix = {
      url = "github:natsukium/mcp-servers-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    anthropic-skills = {
      url = "github:anthropics/skills";
      flake = false;
    };

    vercel-skills = {
      url = "github:vercel-labs/agent-skills";
      flake = false;
    };

    agentic-qe = {
      url = "github:proffesor-for-testing/agentic-qe";
      flake = false;
    };

    nicknisi-dotfiles = {
      url = "github:nicknisi/dotfiles/f1be3f2b669c8e3401b589141f9a56651e45a1a7";
      flake = false;
    };

    ccconfigs = {
      url = "github:dhruvbaldawa/ccconfigs";
      flake = false;
    };

    awesome-claude-skills = {
      url = "github:composioHQ/awesome-claude-skills";
      flake = false;
    };

    agent-toolkit = {
      url = "github:softaworks/agent-toolkit";
      flake = false;
    };

    skill-seekers = {
      url = "github:yusufkaraaslan/Skill_Seekers";
      flake = false;
    };
  };

  outputs =
    inputs@{
      nixpkgs,
      home-manager,
      nixgl,
      spicetify-nix,
      # catppuccin,
      sops-nix,
      llm-agents,
      mcp-servers-nix,
      agent-skills-nix,
      ...
    }:
    let
      username = "mintori";
      homeDirectory = "/home/${username}";
      hostName = "endeavour-desktop";
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [
          nixgl.overlay
          llm-agents.overlays.default
        ];
        config.allowUnfree = true;
      };

      spicePkgs = spicetify-nix.legacyPackages.${system};
    in
    {
      homeConfigurations.${username} = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [
          ./home.nix
          spicetify-nix.homeManagerModules.spicetify
          # catppuccin.homeModules.catppuccin
          sops-nix.homeManagerModules.sops
          agent-skills-nix.homeManagerModules.default
        ];

        extraSpecialArgs = {
          inherit
            nixgl
            spicetify-nix
            spicePkgs
            inputs
            username
            homeDirectory
            hostName
            mcp-servers-nix
            ;
        };
      };
    };
}
