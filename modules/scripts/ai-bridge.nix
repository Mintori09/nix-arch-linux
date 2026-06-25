{ pkgs, ... }:
let
  inherit (pkgs) lib;

  aiBridgeSrc = lib.sourceFilesBySuffices ../../scripts/execute/ai-bridge [
    ".ts"
    ".json"
    ".yaml"
  ];

  aiBridgeBundle =
    pkgs.runCommand "ai-bridge-bundle"
      {
        buildInputs = [
          pkgs.esbuild
          pkgs.nodejs
          pkgs.cacert
        ];
        SSL_CERT_FILE = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
      }
      ''
        mkdir -p $out/build

        cp -r ${aiBridgeSrc}/src $out/build/src
        cp ${aiBridgeSrc}/package.json $out/build/

        chmod -R +w $out/build
        cd $out/build

        # Keep only find-process dep, drop tsx/devEngines
        ${pkgs.nodejs}/bin/node -e "
          const p = JSON.parse(require('fs').readFileSync('package.json','utf8'));
          delete p.devEngines;
          p.dependencies = { 'find-process': p.dependencies['find-process'] };
          require('fs').writeFileSync('package.json', JSON.stringify(p));
        "

        HOME="$TMPDIR" npm install --omit=dev --no-audit --no-fund --ignore-scripts

        esbuild src/cli/index.ts --bundle --platform=node --format=cjs --outfile=$out/main.cjs

        rm -rf $out/build
      '';
in
let
  aiBridgePkg = pkgs.writeShellScriptBin "ai-bridge" ''
    exec ${pkgs.nodejs}/bin/node "${aiBridgeBundle}/main.cjs" "$@"
  '';
in
{
  home.packages = [ aiBridgePkg ];

  systemd.user.services."ai-bridge" = {
    Unit = {
      Description = "AI Bridge daemon (Gemini clipboard bridge)";
      After = [ "network-online.target" ];
      Wants = [ "network-online.target" ];
    };
    Service = {
      Type = "simple";
      ExecStart = "${aiBridgePkg}/bin/ai-bridge server";
      Restart = "on-failure";
      RestartSec = 5;
    };
    Install.WantedBy = [ "default.target" ];
  };
}
