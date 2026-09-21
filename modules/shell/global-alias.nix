{ lib, ... }:

let
  globalAliases = {
    # Pipes
    G = "| rg";
    F = "| fzf";
    J = "| jq";
    Y = "| yq";

    # Output
    B = "| bat";
    D = "| delta";
    L = "| less";

    # Clipboard
    C = "| wl-copy";
    CP = "| cpath";
    W = "wl-paste >";

    # Redirects
    N = ">/dev/null";
    E = "2>/dev/null";
    NE = ">/dev/null 2>&1";
  };
in
{
  programs.zsh.initContent = lib.concatStringsSep "\n" (
    lib.mapAttrsToList (name: value: "alias -g ${name}='${value}'") globalAliases
  );
}
