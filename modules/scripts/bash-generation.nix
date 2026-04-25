{ pkgs, ... }:
{
  home.packages = [
    (pkgs.buildGoModule {
      pname = "ask";
      version = "0.1.0";
      src = ../../tools/ask;
      vendorHash = null;
      subPackages = [ "cmd/ask" ];

      meta = with pkgs.lib; {
        description = "Generate shell commands from natural language with explicit confirmation";
        mainProgram = "ask";
        license = licenses.mit;
        platforms = platforms.linux;
      };
    })
  ];
}
