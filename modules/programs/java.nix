{ pkgs, ... }:
{
  home.packages = with pkgs; [
    jdk21
    maven
  ];

  home.sessionVariables = {
    JAVA_HOME = "${pkgs.jdk21}/lib/openjdk";
  };
}
