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
	"sync"
	"syscall"
	"time"

	"github.com/mintori/home-manager/tools/mdview/internal/assets"
	"github.com/mintori/home-manager/tools/mdview/internal/browser"
	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
	"github.com/mintori/home-manager/tools/mdview/internal/server"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
	"github.com/mintori/home-manager/tools/mdview/internal/share"
)

const Version = "0.1.1"

type Runtime struct {
	ConfigManager config.Manager
	stdout        io.Writer
	loadConfig    func(context.Context) (config.Config, error)
	openBrowser   func(string, string, string) error
	waitForServer func(context.Context, string) error
	serveHTTP     func(net.Listener, http.Handler) httpServerHandle
	shareStarter  func(context.Context, string, session.Document, config.Config) (shareRuntimeHandle, error)
}

type CLIOptions struct {
	Clip       bool
	Browser    string
	Theme      string
	Appearance string
	Width      int
	FontSize   int
	NoSidebar  bool
	Port       int
	NoToken    bool
	Share      bool
	Version    bool
	Help       bool
	Path       string
}

type httpServerHandle struct {
	Shutdown func(context.Context) error
}

type shareRuntimeHandle struct {
	PublicURL string
	ShareID   string
	Stop      func() error
	Done      <-chan error
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
	if opts.Help {
		fmt.Println("Usage: mdview [options] [file]")
		fmt.Println("\nOptions:")
		fmt.Println("  -browser string    browser command")
		fmt.Println("  -theme string      theme name (warm, minimal, dark, paper)")
		fmt.Println("  -appearance string appearance (light, dark, system)")
		fmt.Println("  -width int         content width in pixels")
		fmt.Println("  -font-size int     font size")
		fmt.Println("  -no-sidebar       start with sidebar hidden")
		fmt.Println("  -port int          listen on specific port")
		fmt.Println("  -no-token          disable token protection for write actions")
		fmt.Println("  -share             start a read-only public share with cloudflared")
		fmt.Println("  -version           print version")
		fmt.Println("  -help, -h         show help")
		return nil
	}

	loadConfig := rt.loadConfig
	if loadConfig == nil {
		loadConfig = rt.ConfigManager.Load
	}

	cfg, err := loadConfig(ctx)
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
	presence := session.NewPresenceMonitor(session.PresenceOptions{})
	defer presence.Close()
	appState.Presence = presence

	srv := server.New(server.Options{
		App:           appState,
		Store:         document.Store{},
		ConfigManager: rt.ConfigManager,
		Assets:        assets.FS(),
		Share:         shareService(rt.shareStarter),
	})
	defer srv.Share().Close()

	listenAddr := "127.0.0.1:0"
	if opts.Port > 0 {
		listenAddr = "127.0.0.1:" + strconv.Itoa(opts.Port)
	}

	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer listener.Close()

	serveHTTP := rt.serveHTTP
	if serveHTTP == nil {
		serveHTTP = func(listener net.Listener, handler http.Handler) httpServerHandle {
			httpServer := &http.Server{Handler: handler}
			go func() {
				_ = httpServer.Serve(listener)
			}()
			return httpServerHandle{Shutdown: httpServer.Shutdown}
		}
	}
	httpServer := serveHTTP(listener, srv.Handler())

	targetURL := buildURL(listener.Addr().String(), token, opts)
	readyCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	waitForServer := rt.waitForServer
	if waitForServer == nil {
		waitForServer = waitForServerReady
	}
	if err := waitForServer(readyCtx, targetURL); err != nil {
		_ = httpServer.Shutdown(context.Background())
		return err
	}

	if opts.Share {
		_, doc, _ := appState.Snapshot()
		state, err := srv.Share().Start(ctx, "http://"+listener.Addr().String(), doc, cfg)
		if err != nil {
			_ = httpServer.Shutdown(context.Background())
			return err
		}
		fmt.Fprintf(rt.output(), "Share URL: %s\n", state.PublicURL)
		fmt.Fprintf(rt.output(), "Admin URL: %s\n", targetURL)
	} else {
		openBrowser := rt.openBrowser
		if openBrowser == nil {
			openBrowser = browser.Open
		}
		if err := openBrowser(cfg.Browser, cfg.FallbackBrowser, targetURL); err != nil {
			_ = httpServer.Shutdown(context.Background())
			return err
		}
	}

	sigCtx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()
	waitForShutdown(sigCtx.Done(), presence.Done())
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
	fs.IntVar(&opts.Port, "port", 0, "listen on a specific port")
	fs.BoolVar(&opts.NoToken, "no-token", false, "disable token protection for write actions")
	fs.BoolVar(&opts.Share, "share", false, "start a read-only public share with cloudflared")
	fs.BoolVar(&opts.Version, "version", false, "print version")
	fs.BoolVar(&opts.Help, "h", false, "show help")
	fs.BoolVar(&opts.Help, "help", false, "show help")

	if err := fs.Parse(args); err != nil {
		return CLIOptions{}, err
	}
	if fs.NArg() > 1 {
		return CLIOptions{}, errors.New("mdview accepts at most one path argument")
	}
	if fs.NArg() == 1 {
		opts.Path = fs.Arg(0)
	}
	if opts.Share && opts.NoToken {
		return CLIOptions{}, errors.New("--share cannot be used with --no-token")
	}
	return opts, nil
}

func (rt Runtime) output() io.Writer {
	if rt.stdout != nil {
		return rt.stdout
	}
	return os.Stdout
}

func shareService(starter func(context.Context, string, session.Document, config.Config) (shareRuntimeHandle, error)) share.Service {
	if starter == nil {
		return share.NewManager(share.Options{})
	}
	return &injectedShareService{start: starter}
}

type injectedShareService struct {
	mu    sync.RWMutex
	state share.State
	start func(context.Context, string, session.Document, config.Config) (shareRuntimeHandle, error)
	stop  func() error
}

func (s *injectedShareService) Start(ctx context.Context, localURL string, doc session.Document, cfg config.Config) (share.State, error) {
	handle, err := s.start(ctx, localURL, doc, cfg)
	if err != nil {
		return share.State{}, err
	}

	s.mu.Lock()
	s.stop = handle.Stop
	s.state = share.State{
		Status:         share.StatusActive,
		PublicURL:      handle.PublicURL,
		ShareID:        handle.ShareID,
		SharedDocument: doc,
		SharedConfig:   cfg,
	}
	s.mu.Unlock()
	return s.state, nil
}

func (s *injectedShareService) Stop() error {
	s.mu.Lock()
	stop := s.stop
	s.stop = nil
	s.state = share.State{Status: share.StatusIdle}
	s.mu.Unlock()
	if stop != nil {
		return stop()
	}
	return nil
}

func (s *injectedShareService) Snapshot() share.State {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state
}

func (s *injectedShareService) Close() error {
	return s.Stop()
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

func waitForServerReady(ctx context.Context, targetURL string) error {
	client := &http.Client{Timeout: 150 * time.Millisecond}
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()

	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
		if err != nil {
			return fmt.Errorf("build readiness request: %w", err)
		}

		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}

		select {
		case <-ctx.Done():
			return fmt.Errorf("wait for local server ready: %w", ctx.Err())
		case <-ticker.C:
		}
	}
}

func waitForShutdown(signalDone <-chan struct{}, presenceDone <-chan struct{}) {
	select {
	case <-signalDone:
	case <-presenceDone:
	}
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
