{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  rcloneSyncCompletion = pkgs.writeTextFile {
    name = "rclone-sync-zsh-completion";
    destination = "/share/zsh/site-functions/_rclone-sync";
    text = ''
      #compdef rclone-sync

      _rclone-sync() {
        _arguments \
          '--config[tar & upload ~/.config to Drive]' \
          '--zen[tar & upload Zen browser profiles to Drive]' \
          '--obsidian[rclone sync Obsidian vault to Drive]' \
          '--all[sync config + zen + obsidian]' \
          '(-n)--dry-run[preview without syncing]' \
          '(-n --dry-run)-n[preview without syncing]' \
          '(-h)--help[show help message]' \
          '(-h --help)-h[show help message]'
      }

      _rclone-sync "$@"
    '';
  };
in
{
  home.packages =
    helpers.mkScriptPackage {
      name = "rclone-sync";
      entry = "${../../scripts/execute/rclone-sync.ts}";
      extraPathPackages = [ pkgs.rclone ];
    }
    ++ [
      rcloneSyncCompletion
    ];
}
