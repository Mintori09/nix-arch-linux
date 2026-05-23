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

    # catppuccin = {
    #   url = "github:catppuccin/nix";
    #   inputs.nixpkgs.follows = "nixpkgs";
    # };

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
