{ pkgs, ... }:
let
  excludedDirs = [
    ".git"
    "node_modules"
    ".cache"
    ".cargo"
    ".rustup"
    "venv"
    "__pycache__"
    ".mypy_cache"
    "dist"
    "build"
    "out"
    "target"
    ".idea"
    ".vscode"
    ".next"
    ".vite"
    ".local/share/Trash"
    ".var"
    ".flatpak"
    ".steam"
    ".thumbnails"
    ".snap"
    ".wine"
    ".android"
    ".gradle"
    "__pypackages__"
    ".venv"
    ".pytest_cache"
    ".ipynb_checkpoints"
    "go"
    "pkg"
    ".DS_Store"
    "coverage"
    ".scannerwork"
    ".settings"
  ];
  excludeArgs = builtins.concatStringsSep " " (map (dir: "-E ${dir}") excludedDirs);
in
{
  programs.fzf = {
    enable = true;
    enableZshIntegration = true;
    defaultCommand = "fd --hidden -t f ${excludeArgs}";
    defaultOptions = [
      "--layout=reverse"
      "--info=inline"
      "--height=80%"
      "--multi"
      "--cycle"
      "--margin=1"
      "--border=rounded"
      "--prompt=' '"
      "--pointer=' '"
      "--marker=' '"
      "--color='fg:#c6d0f7,bg:#303446,hl:#e78284,fg+:#c6d0f7,bg+:#414559,hl+:#a6d189,info:#ca9ee6,prompt:#8caaee,pointer:#f4b8e7,marker:#eebebe,spinner:#ca9ee6,header:#eebebe,gutter:#303446'"
      "--preview-window=right:65%"
      "--bind '?:toggle-preview'"
      "--bind 'esc:execute-silent(kitty icat --clear)+abort'"
      "--bind 'ctrl-c:execute-silent(kitty icat --clear)+abort'"
      "--bind 'ctrl-a:select-all'"
      "--bind 'ctrl-y:execute-silent(echo {+} | wl-copy)'"
      "--bind 'ctrl-e:execute($TERMINAL $EDITOR {+})+reload(fzf)'"
      "--preview '$HOME/.config/shell/scripts/fzf-preview.sh {}'"
    ];
  };
}
