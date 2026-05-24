{ pkgs }:
{
  mkWrappedBinary =
    {
      name,
      package,
      binaryName ? name,
    }:
    pkgs.symlinkJoin {
      name = "${name}-wrapped";
      paths = [ package ];
      postBuild = ''
        rm -f "$out/bin/${binaryName}"
        cat >"$out/bin/${binaryName}" <<'EOF'
        #!${pkgs.runtimeShell}
        exec env \
          FREETYPE_PROPERTIES="autofitter:no-stem-darkening=1 cff:no-stem-darkening=1" \
          nixGL \
          ${package}/bin/${binaryName} \
          "$@"
        EOF
        chmod +x "$out/bin/${binaryName}"

        if [ "${name}" != "${binaryName}" ]; then
          ln -sf "$out/bin/${binaryName}" "$out/bin/${name}"
        fi
      '';
    };
}
