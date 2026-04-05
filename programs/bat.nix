{ ... }:
{
  programs.bat = {
    enable = true;
    config = {
      theme = "TwoDark";
      style = "numbers,changes,header";
      italic-text = "always";
      pager = "less --quit-if-one-screen --RAW-CONTROL-CHARS";
      map-syntax = [
        "h:cpp"
        ".ignore:.gitignore"
      ];
    };
  };
}
