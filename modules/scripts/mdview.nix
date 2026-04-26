{ pkgs, ... }:
{
  home.packages = [
    (pkgs.buildGoModule {
      pname = "mdview";
      version = "0.1.0";

      src = ../../tools/mdview;

      vendorHash = "sha256-D1Dvd38893S9ZuZNmx8AQoJQvIppRUzhCh2ckoXTk4Q=";

      subPackages = [ "cmd/mdview" ];

      # Nếu frontend được build bằng Vite và embed vào Go bằng go:embed,
      # bạn có thể bật phần này sau.
      # nativeBuildInputs = with pkgs; [
      #   nodejs
      #   pnpm
      # ];

      # preBuild = ''
      #   cd web
      #   pnpm install --frozen-lockfile
      #   pnpm build
      #   cd ..
      # '';

      meta = with pkgs.lib; {
        description = "Fast preview-first Markdown reader and lightweight editor running in the browser";
        mainProgram = "mdview";
        license = licenses.mit;
        platforms = platforms.linux;
      };
    })
  ];
}
