{ pkgs }:
let
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
      pathPrefix =
        if extraPathPackages == [ ] then
          ""
        else
          ''export PATH="${pkgs.lib.makeBinPath extraPathPackages}:$PATH"'';
      script = pkgs.writeShellScriptBin name ''
        ${pathPrefix}
        ${extraEnv}
        exec ${runtime} "${entry}" "$@"
      '';
    in
    [ script ] ++ extraPackages;
in
{
  inherit mkScriptPackage;
}
