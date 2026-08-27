{
  description = "AI Bridge - Bridge terminal prompts to AI web apps";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
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
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs;
        pnpm = pkgs.pnpm;
        pnpmConfigHook = pkgs.pnpmConfigHook;

        pnpmDeps = pkgs.testers.invalidateFetcherByDrvHash pkgs.fetchPnpmDeps {
          pname = "ai-bridge";
          version = "1.0.0";
          src = self;
          pnpm = pnpm;
          fetcherVersion = 4;
          hash = "sha256-a45/44dN4nemJf5e0reNNY8qTo3a0YHNFBtxVlo1SR0=";
        };
      in
      {
        packages = {
          default = pkgs.stdenv.mkDerivation {
            pname = "ai-bridge";
            version = "1.0.0";
            src = self;

            nativeBuildInputs = [
              nodejs
              pnpmConfigHook
              pnpm
            ];

            inherit pnpmDeps;

            postPatch = ''
              sed -i 's/"devEngines":/"_devEngines":/' package.json
            '';

            __structuredAttrs = true;

            buildPhase = ''
              runHook preBuild
              pnpm build:daemon
              pnpm build:userscript
              runHook postBuild
            '';

            installPhase = ''
              install -Dm755 dist/ai-bridge.js $out/bin/ai-bridge
              substituteInPlace $out/bin/ai-bridge \
                --replace-fail '#!/usr/bin/env tsx' '#!${pkgs.lib.getExe nodejs}'
              install -Dm644 dist/ai-bridge.user.js $out/share/ai-bridge/ai-bridge.user.js
            '';

            meta = {
              description = "Bridge terminal prompts to AI web apps";
              homepage = "https://github.com/mintori/ai-bridge";
              license = pkgs.lib.licenses.isc;
              mainProgram = "ai-bridge";
              platforms = pkgs.lib.platforms.linux;
            };
          };
        };

        apps.default = flake-utils.lib.mkApp {
          drv = self.packages.${system}.default;
        };

        devShells.default = pkgs.mkShellNoCC {
          packages = [
            nodejs
            pkgs.typescript
            pkgs.tsx
            pnpm
            pkgs.nixfmt
          ];
        };

        formatter = pkgs.nixfmt;
      }
    );
}
