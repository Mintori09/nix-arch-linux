# home.nix (single file)
{ config, pkgs, ... }:

{
  home.packages = with pkgs; [
    pandoc
    texlive.combined.scheme-medium
    mermaid-cli
  ];

  xdg.configFile."pandoc/defaults.yaml".text = ''
    from: markdown
    to: pdf

    pdf-engine: xelatex

    variables:
      mainfont: Inter
      monofont: "JetBrainsMono Nerd Font Mono"
      fontsize: 11pt
      geometry: margin=1in

    filters:
      - pandoc-crossref

    metadata:
      link-citations: true
  '';
}
