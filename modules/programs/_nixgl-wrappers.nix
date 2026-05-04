{ pkgs }:
{
  mkWrappedBinary =
    {
      name,
      package,
      binaryName ? name,
    }:
    pkgs.writeShellScriptBin name ''
      exec env \
        FREETYPE_PROPERTIES="autofitter:no-stem-darkening=1 cff:no-stem-darkening=1" \
        nixGL \
        ${package}/bin/${binaryName} \
        "$@"
    '';
}
