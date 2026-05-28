{ pkgs }:
let
  scriptsDir = ../../scripts/execute;
  utilsPath = scriptsDir + "/utils.ts";

  mkScriptPackage =
    {
      name,
      entry,
      extraPackages ? [ ],
      extraPathPackages ? [ ],
      extraEnv ? "",
      extraScripts ? [ ],
    }:
    let
      entryName = builtins.baseNameOf entry;
      bundleDir = pkgs.runCommand "${name}-bundle" { buildInputs = [ pkgs.esbuild ]; } ''
        mkdir -p $out
        cp ${utilsPath} $out/utils.ts
        cp ${entry} "$out/${entryName}"
        ${builtins.concatStringsSep "\n" (map (f: "cp ${f} $out/${builtins.baseNameOf f}") extraScripts)}
        esbuild "$out/${entryName}" --bundle --platform=node --format=esm --outfile=$out/main.mjs
      '';
      pathPrefix =
        if extraPathPackages == [ ] then
          ""
        else
          ''export PATH="${pkgs.lib.makeBinPath extraPathPackages}:$PATH"'';
      script = pkgs.writeShellScriptBin name ''
        ${pathPrefix}
        ${extraEnv}
        exec ${pkgs.nodejs}/bin/node "${bundleDir}/main.mjs" "$@"
      '';
    in
    [ script ] ++ extraPackages;
in
{
  inherit mkScriptPackage;
}
