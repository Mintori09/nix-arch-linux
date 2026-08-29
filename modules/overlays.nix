{ nixgl, inputs, ... }:
{
  nixpkgs.overlays = [
    nixgl.overlay
    inputs.llm-agents.overlays.shared-nixpkgs
    (final: prev: {
      bookokrat = final.callPackage ./packages/bookokrat.nix { };
      dbx = final.callPackage ./packages/dbx.nix { };
      zap = final.callPackage ./packages/zap.nix { };
      anyflip-downloader = final.callPackage ./packages/anyflip-downloader.nix { };
      cv-cli = final.callPackage ./packages/cv-cli.nix { };
      anki-tool = final.callPackage ./packages/anki-tool.nix { };
      ai-bridge = final.callPackage ./packages/ai-bridge.nix { };
      generate-toc = final.callPackage ./packages/generate-toc.nix { };
      fitgirl-link-extractor = final.callPackage ./packages/fitgirl-link-extractor.nix { };
      magika = final.callPackage ./packages/magika.nix { };
      keyboard-rs = final.callPackage ./packages/keyboard-rs.nix { };
      vicinae = final.callPackage ./packages/vicinae.nix { };
      qbittorrent = final.callPackage ./packages/qbittorrent.nix { };
      fmtron = final.callPackage ./packages/fmtron.nix {
        src = inputs.fmtron;
      };
    })
  ];
}
