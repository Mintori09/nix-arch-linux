{ pkgs, ... }:

{
  home.shellAliases = {
    gst = "${pkgs.git}/bin/git status";
    gcw = "git clone $(${pkgs.wl-clipboard}/bin/wl-paste)";
  };

  programs.git = {
    enable = true;

    settings = {

      alias = {
        # Display a pretty commit graph with abbreviated hashes, relative dates, and branch decorations
        graph = "log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(bold green)(%ar)%C(reset) %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(bold yellow)%d%C(reset)' --all";
        # Short status output with branch info
        s = "status -sb";
        # Undo the last commit while keeping changes staged
        uncommit = "reset --soft HEAD~1";
        # Remove files from staging area (unstage) while keeping changes in working directory
        unstage = "reset HEAD --";
        # Amend the last commit without changing the message
        amend = "commit --amend --no-edit";
        # Show detailed stats for the last commit
        last = "log -1 HEAD --stat";
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

  home.packages = [ pkgs.wl-clipboard ];
}
