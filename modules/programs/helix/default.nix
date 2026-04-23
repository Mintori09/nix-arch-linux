{
  pkgs,
  lib,
  ...
}:
let
  configFile = "helix/config.toml";
  toTOML = (pkgs.formats.toml { }).generate;
  languagesTOML = import ./_languages.nix { inherit pkgs; };
  lspPackages = import ./_packages.nix { inherit pkgs; };

  lspBinPath = pkgs.buildEnv {
    name = "helix-lsp-env";
    paths = lspPackages;
    pathsToLink = [ "/bin" ];
  };

  helixWithLSP =
    pkgs.runCommand "helix-with-lsp"
      {
        buildInputs = [ pkgs.makeWrapper ];
      }
      ''
        mkdir -p $out/bin
        makeWrapper ${pkgs.helix}/bin/hx $out/bin/hx \
          --prefix PATH : ${lspBinPath}/bin


        for bin in ${pkgs.helix}/bin/*; do
          if [ "$(basename $bin)" != "hx" ]; then
            ln -s $bin $out/bin/$(basename $bin)
          fi
        done
      '';
in
{
  home.packages = [
    (lib.hiPrio helixWithLSP)
  ];

  xdg.configFile."${configFile}" = {
    source = toTOML "config.toml" (import ./_config.nix);

    force = true;
  };
  xdg.configFile."helix/languages.toml" = {
    source = languagesTOML;
    force = true;
  };
}
