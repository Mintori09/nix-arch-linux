{
  description = "Development environment for the CLI format converter tool (cv)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        cv = pkgs.callPackage ./nix/convert-file.nix {
          src = self;
        };
      in
      {
        packages = {
          inherit cv;
          default = cv;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            typescript

            ffmpeg
            imagemagick
            pandoc
            zunit
            libreoffice
            python3Packages.weasyprint
            chromium
            yq-go
            xlsx2csv
            mermaid-cli
            jq
            poppler

            which
          ];

          shellHook = ''
            echo "========================================================="
            echo "  Mintori's Converter Project Development Environment    "
            echo "========================================================="
            echo "Runtime environments:"
            echo "  - Node: $(node --version)"
            echo "System tools loaded into shell environment PATH:"
            echo "  - ffmpeg, magick, pandoc, soffice, weasyprint,"
            echo             "    chromium, yq, xlsx2csv, mmdr (mermaid-cli), jq"
            echo "========================================================="

            if [ -n "$ZSH_VERSION" ]; then
                autoload -Uz compinit && compinit
              fi
          '';
        };
      }
    );
}
