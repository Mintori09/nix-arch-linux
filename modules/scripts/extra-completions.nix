{ pkgs, ... }:

let
  completions = [
    "_alejandra"
    "_anyflip-downloader"
    "_arp-scan"
    "_atool"
    "_auto-click"
    "_biome"
    "_bookokrat"
    "_caesiumclt"
    "_cliphist"
    "_czg"
    "_defuddle"
    "_difft"
    "_direnv-wrap"
    "_disktree"
    "_duf"
    "_fmtron"
    "_gofumpt"
    "_hadolint"
    "_hexyl"
    "_lazydocker"
    "_lazyjournal"
    "_lazysql"
    "_magika"
    "_markitdown"
    "_mmdc"
    "_mmdr"
    "_mold"
    "_navi"
    "_nixfmt"
    "_orca"
    "_oxfmt"
    "_prettier"
    "_prisma"
    "_rust-anything"
    "_rustfmt"
    "_samply"
    "_sccache"
    "_sgpt"
    "_shellcheck"
    "_sheprd"
    "_shfmt"
    "_sleep-cycles"
    "_spicetify"
    "_stylua"
    "_systemctl-tui"
    "_tdf"
    "_telepush"
    "_tsx"
    "_typstyle"
    "_uvx"
    "_vex"
    "_websocat"
  ];

  extraZshCompletions = pkgs.runCommandLocal "extra-zsh-completions" { } ''
    mkdir -p "$out/share/zsh/site-functions"
    ${pkgs.lib.concatMapStringsSep "\n" (
      name: ''cp ${./completions/${name}} "$out/share/zsh/site-functions/${name}"''
    ) completions}
  '';
in
{
  home.packages = [ extraZshCompletions ];
}
