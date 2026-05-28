{ pkgs }:
let
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
      bundleDir = pkgs.runCommand "${name}-bundle" { buildInputs = [ pkgs.esbuild ]; } ''
        mkdir -p $out
        esbuild ${entry} --bundle --platform=node --format=cjs --outfile=$out/main.cjs --external:yaml
      '';
      pathPrefix =
        if extraPathPackages == [ ] then
          ""
        else
          ''export PATH="${pkgs.lib.makeBinPath extraPathPackages}:$PATH"'';
      script = pkgs.writeShellScriptBin name ''
        ${pathPrefix}
        ${extraEnv}
        exec ${pkgs.nodejs}/bin/node "${bundleDir}/main.cjs" "$@"
      '';
    in
    [ script ] ++ extraPackages;
in
{
  inherit mkScriptPackage;
}
