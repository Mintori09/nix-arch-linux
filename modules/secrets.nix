{ pkgs, config, ... }:

let
  secretPath = "${config.home.homeDirectory}/.config/home-manager/secrets.json";
  cfAuthPath = "${config.home.homeDirectory}/.config/cloudflare/config/default.json";
  exportScript = ''
    if [ -s "${secretPath}" ]; then
      eval "$(${pkgs.jq}/bin/jq -r 'to_entries | .[] | "export \(.key)=\(.value | @sh)"' "${secretPath}")"
    fi
    if [ -z "$CLOUDFLARE_API_TOKEN" ] && [ -s "${cfAuthPath}" ]; then
      export CLOUDFLARE_API_TOKEN="$(${pkgs.jq}/bin/jq -r '.oauth_token // empty' "${cfAuthPath}" 2>/dev/null)"
    fi
  '';
in
{
  programs.bash = {
    enable = true;
    initExtra = exportScript;
  };

  programs.zsh = {
    enable = true;
    initContent = exportScript;
  };
}
