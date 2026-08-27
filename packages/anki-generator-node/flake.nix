{
  description = "anki-generator-node — Nix flake dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs_22;

        runtimeDeps = with pkgs; [
          unzip # required by --export mode to unpack .apkg archives
          zsh # required by ZSH completion script
        ];

        devDeps = with pkgs; [
          nodejs
          pnpm_10
          just
          prettier
          nixfmt-rfc-style
        ];

        # ── Installable package ──────────────────────────────────────────────
        anki-tool = pkgs.buildNpmPackage {
          pname = "anki-generator-node";
          version = "1.0.0";
          src = ./.;

          nodejs = nodejs;

          npmDeps = pkgs.importNpmLock {
            npmRoot = ./.;
          };

          npmConfigHook = pkgs.importNpmLock.npmConfigHook;

          # esbuild bundles everything → single JS file
          buildPhase = ''
            runHook preBuild
            npm run build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            mkdir -p $out/bin $out/lib/anki-tool $out/share/zsh/site-functions

            # Copy bundled script
            cp dist/index.js $out/lib/anki-tool/anki-tool.js

            # Copy templates, styles (needed at runtime relative to ROOT)
            cp -r templates $out/lib/anki-tool/
            cp -r styles    $out/lib/anki-tool/

            # Wrapper script that sets ROOT and injects runtime deps
            makeWrapper ${nodejs}/bin/node $out/bin/anki-tool \
              --add-flags "$out/lib/anki-tool/anki-tool.js" \
              --prefix PATH : ${pkgs.lib.makeBinPath runtimeDeps} \
              --set ANKI_TOOL_ROOT "$out/lib/anki-tool"

            # ZSH completion
            cp completions/_anki-tool $out/share/zsh/site-functions/

            runHook postInstall
          '';

          nativeBuildInputs = [ pkgs.makeWrapper ];

          meta = {
            description = "Generate Anki .apkg decks from structured JSON vocabulary, grammar, or MCQ data";
            license = pkgs.lib.licenses.isc;
            mainProgram = "anki-tool";
          };
        };
      in
      {
        # `nix build` / `nix run`
        packages = {
          default = anki-tool;
          inherit anki-tool;
        };

        # `nix run .#`
        apps.default = {
          type = "app";
          program = "${anki-tool}/bin/anki-tool";
        };

        # `nix develop`
        devShells.default = pkgs.mkShellNoCC {
          packages = devDeps ++ runtimeDeps;

          shellHook = ''
            echo ""
            echo "  anki-generator-node dev shell"
            echo "  Node $(node --version) · pnpm $(pnpm --version)"
            echo ""
            echo "  Quick commands:"
            echo "    pnpm install    — install dependencies"
            echo "    pnpm build      — bundle to dist/index.js"
            echo "    pnpm test       — run unit tests"
            echo "    pnpm format     — format with prettier"
            echo ""
          '';
        };

        # `nix fmt`
        formatter = pkgs.nixfmt-rfc-style;
      }
    );
}
