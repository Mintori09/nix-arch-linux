{ pkgs }:
let
  scriptsDir = ../../scripts/execute;
  utilsPath = scriptsDir + "/utils.ts";

  mkScriptPackage =
    {
      name,
      runtime,
      entry,
      extraPackages ? [ ],
      extraPathPackages ? [ ],
      extraEnv ? "",
    }:
    let
      entryName = builtins.baseNameOf entry;
      bundleDir = pkgs.runCommand "${name}-bundle" { } ''
        mkdir -p $out
        cp ${utilsPath} $out/utils.ts
        cp ${entry} "$out/${entryName}"
      '';
      pathPrefix =
        if extraPathPackages == [ ] then
          ""
        else
          ''export PATH="${pkgs.lib.makeBinPath extraPathPackages}:$PATH"'';
      script = pkgs.writeShellScriptBin name ''
        ${pathPrefix}
        ${extraEnv}
        exec ${runtime} "${bundleDir}/${entryName}" "$@"
      '';
    in
    [ script ] ++ extraPackages;
in
{
  inherit mkScriptPackage;
}
