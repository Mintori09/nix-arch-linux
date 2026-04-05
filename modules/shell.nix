{ pkgs, lib, ... }:
{
  programs.zsh = {
    enable = true;
    autocd = true;
    enableCompletion = true;

    # oh-my-zsh = {
    #   enable = true;
    #   plugins = [
    #     "git"
    #     "archlinux"
    #     "extract"
    #     "colored-man-pages"
    #   ];
    # };

    plugins = [
      {
        name = "zsh-vi-mode";
        src = pkgs.zsh-vi-mode;
      }
      {
        name = "zsh-autosuggestions";
        src = pkgs.zsh-autosuggestions;
      }
      {
        name = "zsh-syntax-highlighting";
        src = pkgs.zsh-syntax-highlighting;
      }
      {
        name = "fzf-tab";
        src = pkgs.zsh-fzf-tab;
      }
    ];

    initContent = lib.mkMerge [
      (lib.mkBefore ''
        fpath=(/usr/share/zsh/site-functions ${pkgs.zsh-completions}/share/zsh-completions/functions $fpath)

        zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
        zstyle ':completion:*' list-colors "''${(s.:.)LS_COLORS}"
        zstyle ':fzf-tab:*' fzf-flags '--layout=reverse' '--info=inline' '--height=80%' '--border=rounded'
        zstyle ':fzf-tab:complete:cd:*' fzf-preview '${pkgs.eza}/bin/eza -1 --color=always $realpath'
        zstyle ':fzf-tab:complete:*:*' fzf-preview '${pkgs.bat}/bin/bat --color=always --line-range :50 $realpath'
        zstyle ':fzf-tab:complete:kill:argument-rest' fzf-preview 'ps --pid=$word -o cmd --no-headers'
        zstyle ':fzf-tab:complete:systemctl-*:*' fzf-preview 'systemctl status $word'

        [[ ! -f "$HOME/.p10k.zsh" ]] || source "$HOME/.p10k.zsh"

        export ZSH_AUTOSUGGEST_USE_ASYNC=1
        export ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
        export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=#838ba7'
        export KEYTIMEOUT=1
        export FZF_COMPLETION_TRIGGER='**'

        ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets pattern)
        ZSH_HIGHLIGHT_STYLES[default]='fg=#c6d0f7'
        ZSH_HIGHLIGHT_STYLES[command]='fg=#8caaee'
        ZSH_HIGHLIGHT_STYLES[alias]='fg=#a6d189'
        ZSH_HIGHLIGHT_STYLES[builtin]='fg=#a6d189'
        ZSH_HIGHLIGHT_STYLES[function]='fg=#8caaee'
        ZSH_HIGHLIGHT_STYLES[reserved-word]='fg=#ca9ee6'
        ZSH_HIGHLIGHT_STYLES[path]='fg=#f4b8e7'
        ZSH_HIGHLIGHT_STYLES[globbing]='fg=#ea999c'
        ZSH_HIGHLIGHT_STYLES[single-hyphen-option]='fg=#eebebe'
        ZSH_HIGHLIGHT_STYLES[double-hyphen-option]='fg=#eebebe'
        ZSH_HIGHLIGHT_STYLES[unknown-token]='fg=#e78284'
        ZSH_HIGHLIGHT_STYLES[commandseparator]='fg=#949cbb'
        ZSH_HIGHLIGHT_STYLES[comment]='fg=#737994'

        function zvm_after_init() {
          zsh-vi-yank-to-clipboard() {
            zvm_yank
            if command -v wl-copy > /dev/null; then
                printf "%s" "$CUTBUFFER" | wl-copy
            fi
          }
          zvm_define_widget zsh-vi-yank-to-clipboard
          zvm_bindkey vicmd 'y' zsh-vi-yank-to-clipboard
          zvm_bindkey visual 'd' zvm_vi_delete
          zvm_bindkey visual '^?' zvm_vi_delete
          zvm_bindkey visual '^H' zvm_vi_delete
        }

        function zvm_after_lazy_keybindings() {
          zvm_set_cursor $'\e[6 q'
        }

        setopt appendhistory sharehistory hist_ignore_space hist_ignore_all_dups
        setopt hist_save_no_dups hist_ignore_dups hist_reduce_blanks hist_find_no_dups
        unsetopt BEEP

        export HISTSIZE=10000
        export HISTFILE="$HOME/.zsh_history"
        export SAVEHIST=$HISTSIZE

        _fzf_compgen_path() { fd --hidden -t f -E .git -E node_modules -E .cache -E .cargo -E .rustup -E venv -E __pycache__ -E .mypy_cache -E dist -E build -E out -E target -E .idea -E .vscode -E .next -E .vite -E .local/share/Trash -E .var -E .flatpak -E .steam -E .thumbnails -E .snap -E .wine -E .android -E .gradle -E __pypackages__ -E .venv -E .pytest_cache -E .ipynb_checkpoints -E go -E pkg -E .DS_Store -E coverage -E .scannerwork -E .settings . "$1"; }
        _fzf_compgen_dir() { fd --hidden -t d -E .git -E node_modules -E .cache -E .cargo -E .rustup -E venv -E __pycache__ -E .mypy_cache -E dist -E build -E out -E target -E .idea -E .vscode -E .next -E .vite -E .local/share/Trash -E .var -E .flatpak -E .steam -E .thumbnails -E .snap -E .wine -E .android -E .gradle -E __pypackages__ -E .venv -E .pytest_cache -E .ipynb_checkpoints -E go -E pkg -E .DS_Store -E coverage -E .scannerwork -E .settings . "$1"; }
      '')
      (lib.mkAfter ''
        _fn() {
          local -a subcmds
          subcmds=('new' 'config' 'alias' 'unalias' 'delete' 'edit' 'list')
          if (( CURRENT == 2 )); then
            _describe 'command' subcmds
          elif (( CURRENT == 3 )); then
            case $words[2] in
              edit|alias)
                local script_dir="$HOME/.config/shell/scripts"
                local scripts=($(${pkgs.fd}/bin/fd -t f . "$script_dir" | sed 's!.*/!!'))
                _describe 'script' scripts
                ;;
            esac
          fi
        }
        compdef _fn fn
      '')
    ];
  };
}
