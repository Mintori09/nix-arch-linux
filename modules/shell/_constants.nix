{
  systemPathPriority = [
    "/usr/bin"
    "/bin"
    "/usr/local/bin"
  ];
  systemDataPriority = [
    "/usr/share/ubuntu"
    "/usr/local/share"
    "/usr/share"
    "/var/lib/snapd/desktop"
  ];
  fzfCompletionTrigger = "**";
  clipCopy = "wl-copy";
  clipPaste = "wl-paste";
  pnpmHome = "$HOME/.local/share/pnpm";
  spicetifyPath = "$HOME/.spicetify";
  intelliHome = "$HOME/.local/share/intellishell";
}
