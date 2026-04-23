{ pkgs, config, ... }:

let
  secretPath = "${config.home.homeDirectory}/.config/home-manager/secrets.json";
in
{
  programs.bash = {
    enable = true;
    initExtra = ''
      if [ -s "${secretPath}" ]; then
        eval "$(${pkgs.jq}/bin/jq -r 'to_entries | .[] | "export \(.key)=\(.value | @sh)"' "${secretPath}")"
      fi
    '';
  };

  programs.zsh = {
    enable = true;
    initContent = ''
      if [ -s "${secretPath}" ]; then
        eval "$(${pkgs.jq}/bin/jq -r 'to_entries | .[] | "export \(.key)=\(.value | @sh)"' "${secretPath}")"
      fi
    '';
  };
}
