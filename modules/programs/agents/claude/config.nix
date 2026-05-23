{ mcpServers }:
builtins.toJSON {
  theme = "dark";
  autoUpdates = false;
  includeCoAuthoredBy = false;
  autoCompactEnabled = false;
  enableAllProjectMcpServers = true;

  statusLine = {
    type = "command";
    command = "cat | ccusage statusline";
  };

  permissions = {
    deny = [
      "Bash(rm -rf /*)"
      "Bash(rm -rf /)"
      "Bash(sudo rm -rf *)"
      "Bash(mkfs.*)"
      "Bash(dd if=* of=/dev/*)"
    ];
  };

  mcpServers = mcpServers;
}
