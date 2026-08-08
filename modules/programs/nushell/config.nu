# Nushell Main Configuration
$env.config = {
  show_banner: false
  edit_mode: "vi"
  shell_integration: {
    osc2: true
    osc7: true
    osc133: true
    reset_application_mode: true
  }
  table: {
    mode: rounded
  }
  history: {
    file_format: "sqlite"
    sync_on_enter: true
    isolation: false
  }
}

# Carapace completion setup
let carapace_completer = {|spans|
  carapace $spans.0 nushell ...$spans | from json
}

$env.config = ($env.config | merge {
  completions: {
    case_sensitive: false
    quick: true
    partial: true
    algorithm: "fuzzy"
    external: {
      enable: true
      max_results: 100
      completer: $carapace_completer
    }
  }
  menus: [
    {
      name: fuzzy_menu
      only_buffer_difference: false
      marker: "? "
      type: {
        layout: list
        page_size: 10
      }
      style: {
        text: green
        selected_text: green_reverse
        description_text: yellow
      }
    }
  ]
})

# Interactive directory navigation with FZF + eza preview
def --env cdi [path?: string] {
  if ($path | is-empty) {
    let target = (
      fd --hidden --type d --exclude .git --exclude node_modules --exclude .venv . .
      | fzf --height=40% --reverse --preview 'eza -la --icons --group-directories-first {}'
      | str trim
    )
    if not ($target | is-empty) {
      cd $target
    }
  } else {
    cd $path
  }
}

# Keybindings configuration
$env.config = ($env.config | merge {
  keybindings: [
    {
      name: fuzzy_completion
      modifier: none
      keycode: tab
      mode: [emacs, vi_normal, vi_insert]
      event: {
        until: [
          { send: menu name: fuzzy_menu }
          { send: menu name: completion_menu }
        ]
      }
    }
    {
      name: zoxide_menu
      modifier: alt
      keycode: char_z
      mode: [emacs, vi_normal, vi_insert]
      event: {
        send: executehostcommand
        cmd: "let dir = (zoxide query --interactive | str trim); if not ($dir | is-empty) { cd $dir }"
      }
    }
    {
      name: fzf_find_file
      modifier: control
      keycode: char_o
      mode: [emacs, vi_normal, vi_insert]
      event: {
        send: executehostcommand
        cmd: "let file = (rg -l '.*' --hidden --glob '!.git' --glob '!.venv' --glob '!node_modules' --glob '!target' | fzf --height=80% --reverse --preview 'bat --color=always --line-range :50 {}' | str trim); if not ($file | is-empty) { nvim $file }"
      }
    }
    {
      name: fzf_history
      modifier: control
      keycode: char_r
      mode: [emacs, vi_normal, vi_insert]
      event: {
        send: executehostcommand
        cmd: "let cmd = (history | get command | reverse | uniq | str join (char newline) | fzf --height=40% --reverse --no-preview | str trim); if not ($cmd | is-empty) { commandline edit --insert $cmd }"
      }
    }
  ]
})
