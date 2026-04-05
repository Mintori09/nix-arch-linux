{ pkgs, ... }:

{
  programs.git = {
    enable = true;

    settings = {

      aliases = {
        s = "status -sb";
        uncommit = "reset --soft HEAD~1";
      };
      user = {
        name = "Mintori09";
        email = "mintori09@users.noreply.github.com";
        signingkey = "~/.ssh/id_ed25519.pub";
      };

      init.defaultBranch = "main";

      core = {
        ignorecase = false;
        autocrlf = "input";
      };

      color.ui = "auto";

      delta = {
        features = "catppuccin-mocha";
        syntax-theme = "OneHalfDark";
        line-numbers = true;
        side-by-side = false;
        hyperlinks = true;
        minus-style = "red italic black";
        plus-style = "green bold black";
      };

      pull.rebase = true;
      push.autoSetupRemote = true;
      fetch.prune = true;

      merge.conflictstyle = "zdiff3";

      help.autocorrect = 20;

      include.path = toString ../../assets/catppuccin.gitconfig;

      commit.gpgsign = true;
      gpg.format = "ssh";
    };

  };

  programs.delta = {
    enable = true;
    enableGitIntegration = true;
  };
}
