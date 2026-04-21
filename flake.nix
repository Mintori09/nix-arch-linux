{
  description = "My home manager configuration!";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    nixgl.url = "github:nix-community/nixGL";
  };

  outputs =
    {
      nixpkgs,
      home-manager,
      nixgl,
      ...
    }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ nixgl.overlay ];

        config.allowUnfree = true;
      };
    in
    {
      homeConfigurations."mintori" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [ ./home.nix ];

        extraSpecialArgs = { inherit nixgl; };
      };
    };
}
