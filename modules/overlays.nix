{ nixgl, inputs, ... }:
{
  nixpkgs.overlays = [
    nixgl.overlay
    inputs.llm-agents.overlays.shared-nixpkgs
    (final: prev: {
      bookokrat = final.callPackage ./packages/bookokrat.nix { };
      disktree = final.callPackage ./packages/disktree.nix { };
      dbx = final.callPackage ./packages/dbx.nix { };
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
      hoppscotch = final.callPackage ./packages/hoppscotch.nix { };
      kmp-lsp = final.callPackage ./packages/kmp-lsp.nix { };
      caesium-clt = final.callPackage ./packages/caesium-clt.nix { };
      herdr-gpui = final.callPackage ./packages/herdr-gpui.nix { };
      neovide = final.callPackage ./packages/neovide.nix { };
      neovim-nightly = final.callPackage ./packages/neovim-nightly.nix { };
      yazi-nightly = final.callPackage ./packages/yazi-nightly.nix { };
      fmtron = final.callPackage ./packages/fmtron.nix {
        src = inputs.fmtron;
      };
    })
  ];
}
