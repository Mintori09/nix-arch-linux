package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/mintori/home-manager/tools/mdview/internal/assets"
	"github.com/mintori/home-manager/tools/mdview/internal/browser"
	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
	"github.com/mintori/home-manager/tools/mdview/internal/server"
)

const Version = "0.1.0"

type Runtime struct {
	ConfigManager config.Manager
}

type CLIOptions struct {
	Clip       bool
	Browser    string
	Theme      string
	Appearance string
	Width      int
	FontSize   int
	NoSidebar  bool
	Edit       bool
	Reader     bool
	Port       int
	NoToken    bool
	Version    bool
	Path       string
}

func (rt Runtime) Run(ctx context.Context, args []string, stdin io.Reader) error {
	opts, err := ParseCLI(args)
	if err != nil {
		return err
	}
	if opts.Version {
		fmt.Println(Version)
		return nil
	}

	cfg, err := rt.ConfigManager.Load(ctx)
	if err != nil {
		return err
	}
	applyOverrides(&cfg, opts)

	input, err := ResolveInput(ctx, ResolveOptions{
		Args:      pathArgs(opts),
		Stdin:     stdin,
		Clipboard: wlClipboard{},
		UseClip:   opts.Clip,
	})
	if err != nil {
		return err
	}

	token := ""
	if !opts.NoToken {
		token, err = randomToken()
		if err != nil {
			return err
		}
	}

	appState, err := BuildSession(ctx, BuildOptions{
		Input:  input,
		Config: cfg,
		Token:  token,
	})
	if err != nil {
		return err
	}

	srv := server.New(server.Options{
		App:           appState,
		Store:         document.Store{},
		ConfigManager: rt.ConfigManager,
		Assets:        assets.FS(),
	})

	listenAddr := "127.0.0.1:0"
	if opts.Port > 0 {
		listenAddr = "127.0.0.1:" + strconv.Itoa(opts.Port)
	}

	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer listener.Close()

	httpServer := &http.Server{Handler: srv.Handler()}
	go func() {
		_ = httpServer.Serve(listener)
	}()

	targetURL := buildURL(listener.Addr().String(), token, opts)
	if err := browser.Open(cfg.Browser, cfg.FallbackBrowser, targetURL); err != nil {
		return err
	}

	sigCtx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-sigCtx.Done()
	return httpServer.Shutdown(context.Background())
}

func ParseCLI(args []string) (CLIOptions, error) {
	fs := flag.NewFlagSet("mdview", flag.ContinueOnError)
	fs.SetOutput(io.Discard)

	var opts CLIOptions
	fs.BoolVar(&opts.Clip, "clip", false, "load markdown from clipboard")
	fs.StringVar(&opts.Browser, "browser", "", "browser command")
	fs.StringVar(&opts.Theme, "theme", "", "theme name")
	fs.StringVar(&opts.Appearance, "appearance", "", "light, dark, or system")
	fs.IntVar(&opts.Width, "width", 0, "content width")
	fs.IntVar(&opts.FontSize, "font-size", 0, "font size")
	fs.BoolVar(&opts.NoSidebar, "no-sidebar", false, "start with sidebar hidden")
	fs.BoolVar(&opts.Edit, "edit", false, "start in edit mode")
	fs.BoolVar(&opts.Reader, "reader", false, "start in reader mode")
	fs.IntVar(&opts.Port, "port", 0, "listen on a specific port")
	fs.BoolVar(&opts.NoToken, "no-token", false, "disable write token protection")
	fs.BoolVar(&opts.Version, "version", false, "print version")

	if err := fs.Parse(args); err != nil {
		return CLIOptions{}, err
	}
	if fs.NArg() > 1 {
		return CLIOptions{}, errors.New("mdview accepts at most one path argument")
	}
	if fs.NArg() == 1 {
		opts.Path = fs.Arg(0)
	}
	return opts, nil
}

func applyOverrides(cfg *config.Config, opts CLIOptions) {
	if opts.Browser != "" {
		cfg.Browser = opts.Browser
	}
	if opts.Theme != "" {
		cfg.Theme = opts.Theme
	}
	if opts.Appearance != "" {
		cfg.Appearance = opts.Appearance
	}
	if opts.Width > 0 {
		cfg.ContentWidth = opts.Width
	}
	if opts.FontSize > 0 {
		cfg.FontSize = opts.FontSize
	}
}

func buildURL(addr, token string, opts CLIOptions) string {
	values := url.Values{}
	if token != "" {
		values.Set("token", token)
	}
	if opts.Edit {
		values.Set("mode", "edit")
	}
	if opts.Reader {
		values.Set("mode", "reader")
	}
	if opts.NoSidebar {
		values.Set("sidebar", "0")
	}
	return "http://" + addr + "/?" + values.Encode()
}

func pathArgs(opts CLIOptions) []string {
	if opts.Path == "" {
		return nil
	}
	return []string{opts.Path}
}

func randomToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

type wlClipboard struct{}

func (wlClipboard) ReadText(_ context.Context) (string, error) {
	path, err := exec.LookPath("wl-paste")
	if err != nil {
		return "", ErrClipboardUnavailable
	}

	data, err := exec.Command(path, "--no-newline").Output()
	if err != nil {
		return "", fmt.Errorf("wl-paste: %w", err)
	}
	return string(data), nil
}
