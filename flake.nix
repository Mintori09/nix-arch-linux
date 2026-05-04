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
  };

  outputs =
    {
      nixpkgs,
      home-manager,
      nixgl,
      spicetify-nix,
      ...
    }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ nixgl.overlay ];

        config.allowUnfree = true;
      };
      spicePkgs = spicetify-nix.legacyPackages.${system};
    in
    {
      homeConfigurations."mintori" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [
          ./home.nix
          spicetify-nix.homeManagerModules.spicetify
        ];

        extraSpecialArgs = {
          inherit nixgl spicetify-nix spicePkgs;
        };
      };
    };
}
