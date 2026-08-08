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
