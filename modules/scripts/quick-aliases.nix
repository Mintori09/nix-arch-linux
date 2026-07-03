{ pkgs, ... }:
{
  home.packages = [
    # gcl: Clear clipboard contents in KDE Klipper
    (pkgs.writeShellScriptBin "gcl" ''
      exec qdbus org.kde.klipper /klipper org.kde.klipper.klipper.clearClipboardContents
    '')

    # cleantrash: Safely clean desktop environment trash bin
    (pkgs.writeShellScriptBin "cleantrash" ''
      echo -n "Taking out the trash..." | pv -qL 10
      rm -rf "$HOME/.local/share/Trash/files"
      fastfetch
    '')

    # fkill: Interactively search and kill processes using fzf
    (pkgs.writeShellScriptBin "fkill" ''
      pid=$(ps -ef | fzf | awk '{print $2}')
      if [ -n "$pid" ]; then
        kill "$pid"
        echo "Killed process $pid"
      fi
    '')

    # fepub: Interactively search and open epub books using fzf and zathura
    (pkgs.writeShellScriptBin "fepub" ''
      file=$(fd -e epub . | fzf +m)
      if [ -n "$file" ]; then
        exec zathura "$file"
      fi
    '')

    # ytdl-music: Download music files from URL using yt-dlp
    (pkgs.writeShellScriptBin "ytdl-music" ''
      if [ "$#" -gt 0 ]; then
        exec yt-dlp --no-playlist --no-config -x --audio-format mp3 --audio-quality 0 -o '%(title)s.%(ext)s' -P '.' "$@"
      else
        echo "Usage: ytdl-music <url1> [url2 ...]"
      fi
    '')

    # reload-anyrun: Restart anyrun service
    (pkgs.writeShellScriptBin "reload-anyrun" ''
      killall -9 anyrun 2>/dev/null || true
      systemctl --user restart anyrun.service
    '')

    # nix-clean: Collect Nix store garbage older than 2 days
    (pkgs.writeShellScriptBin "nix-clean" ''
      exec nix-collect-garbage --delete-older-than 2d --cores 16
    '')

    # ai-rename: Rename files using Ollama/gemma3 model
    (pkgs.writeShellScriptBin "ai-rename" ''
      exec ai-renamer --provider=ollama ---model=gemma3:4b-it-qat --chars 100 --language English "$@"
    '')
  ];
}
