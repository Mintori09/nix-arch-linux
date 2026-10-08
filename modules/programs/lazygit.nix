{ ... }:

{
  programs.lazygit = {
    enable = true;
    settings = {
      git = {
        diffRenderers = [
          {
            name = "difftastic";
            type = "extDiff";
            command = "difft --color=always --background={{colorScheme}} --context={{diffContext}}";
          }
          {
            name = "default";
            type = "rawGit";
          }
        ];
      };
    };
  };
}
