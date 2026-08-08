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
}

# Interactive cd with FZF and eza preview when called without parameters
def --env cd [path?: string] {
  if ($path | is-empty) {
    let target = (
      fd --hidden --type d --exclude .git --exclude node_modules --exclude .venv . .
      | fzf --height=40% --reverse --preview 'eza -la --icons --group-directories-first {}'
      | str trim
    )
    if not ($target | is-empty) {
      std repeat null | ignore
      cd $target
    }
  } else {
    std repeat null | ignore
    cd $path
  }
}

# Keybindings configuration
$env.config = ($env.config | merge {
  keybindings: [
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
  ]
})
