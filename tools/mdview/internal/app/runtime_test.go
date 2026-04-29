package app

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
)

func TestWaitForShutdownReturnsWhenPresenceMonitorCloses(t *testing.T) {
	t.Parallel()

	signalDone := make(chan struct{})
	presenceDone := make(chan struct{})
	finished := make(chan struct{})

	go func() {
		waitForShutdown(signalDone, presenceDone)
		close(finished)
	}()

	close(presenceDone)

	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("expected waitForShutdown to return when presence monitor closes")
	}
}

func TestWaitForShutdownReturnsWhenSignalContextCloses(t *testing.T) {
	t.Parallel()

	signalDone := make(chan struct{})
	presenceDone := make(chan struct{})
	finished := make(chan struct{})

	go func() {
		waitForShutdown(signalDone, presenceDone)
		close(finished)
	}()

	close(signalDone)

	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("expected waitForShutdown to return when signal channel closes")
	}
}

func TestParseCLIDoesNotAcceptEditFlag(t *testing.T) {
	t.Parallel()

	_, err := ParseCLI([]string{"-edit"})
	if err == nil {
		t.Fatal("expected -edit flag to be rejected")
	}
}

func TestParseCLIAcceptsShareFlag(t *testing.T) {
	t.Parallel()

	opts, err := ParseCLI([]string{"--share", "README.md"})
	if err != nil {
		t.Fatalf("ParseCLI returned error: %v", err)
	}

	if !opts.Share {
		t.Fatal("expected share flag to be enabled")
	}
	if opts.Path != "README.md" {
		t.Fatalf("expected path README.md, got %q", opts.Path)
	}
}

func TestParseCLIRejectsShareWithoutTokenProtection(t *testing.T) {
	t.Parallel()

	_, err := ParseCLI([]string{"--share", "--no-token"})
	if err == nil {
		t.Fatal("expected --share with --no-token to be rejected")
	}
}

func TestBuildURLDoesNotEmitModeEdit(t *testing.T) {
	t.Parallel()

	raw := buildURL("127.0.0.1:9999", "token123", CLIOptions{
		NoSidebar: true,
	})

	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}

	if got := parsed.Query().Get("mode"); got != "" {
		t.Fatalf("expected no mode query param, got %q", got)
	}
	if got := parsed.Query().Get("token"); got != "token123" {
		t.Fatalf("expected token query param, got %q", got)
	}
	if got := parsed.Query().Get("sidebar"); got != "0" {
		t.Fatalf("expected sidebar query param, got %q", got)
	}
}

func TestWaitForServerReadyReturnsNilWhenServerResponds(t *testing.T) {
	t.Parallel()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	server := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	}
	defer server.Close()

	go func() {
		_ = server.Serve(listener)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	if err := waitForServerReady(ctx, "http://"+listener.Addr().String()+"/"); err != nil {
		t.Fatalf("waitForServerReady returned error: %v", err)
	}
}

func TestWaitForServerReadyTimesOutWhenServerNeverResponds(t *testing.T) {
	t.Parallel()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := listener.Addr().String()
	listener.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Millisecond)
	defer cancel()

	if err := waitForServerReady(ctx, "http://"+addr+"/"); err == nil {
		t.Fatal("expected timeout error")
	}
}

func TestRunShareSkipsBrowserOpenAndPrintsURLs(t *testing.T) {
	t.Parallel()

	rt := Runtime{
		loadConfig: func(context.Context) (config.Config, error) {
			return config.Default(), nil
		},
		openBrowser: func(string, string, string) error {
			t.Fatal("expected browser opener to be skipped in share mode")
			return nil
		},
		shareStarter: func(_ context.Context, localURL string, doc session.Document, cfg config.Config) (shareRuntimeHandle, error) {
			return shareRuntimeHandle{
				PublicURL: "https://demo.trycloudflare.com/s/share-123",
				ShareID:   "share-123",
				Stop:      func() error { return nil },
				Done:      make(chan error),
			}, nil
		},
		waitForServer: func(context.Context, string) error { return nil },
		serveHTTP: func(listener net.Listener, handler http.Handler) httpServerHandle {
			return httpServerHandle{
				Shutdown: func(context.Context) error { return nil },
			}
		},
	}

	stdout := &bytes.Buffer{}
	rt.stdout = stdout

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := rt.Run(ctx, []string{"--share"}, strings.NewReader("# shared"))
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}

	output := stdout.String()
	if !strings.Contains(output, "Share URL: https://demo.trycloudflare.com/s/share-123") {
		t.Fatalf("expected share url in output, got %q", output)
	}
	if !strings.Contains(output, "Admin URL: http://") {
		t.Fatalf("expected admin url in output, got %q", output)
	}
}

func TestRunReturnsShareStartupError(t *testing.T) {
	t.Parallel()

	rt := Runtime{
		loadConfig: func(context.Context) (config.Config, error) {
			return config.Default(), nil
		},
		openBrowser: func(string, string, string) error { return nil },
		shareStarter: func(context.Context, string, session.Document, config.Config) (shareRuntimeHandle, error) {
			return shareRuntimeHandle{}, errors.New("cloudflared not found")
		},
		waitForServer: func(context.Context, string) error { return nil },
		serveHTTP: func(listener net.Listener, handler http.Handler) httpServerHandle {
			return httpServerHandle{
				Shutdown: func(context.Context) error { return nil },
			}
		},
	}
	rt.stdout = io.Discard

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := rt.Run(ctx, []string{"--share"}, strings.NewReader("# shared"))
	if err == nil || !strings.Contains(err.Error(), "cloudflared not found") {
		t.Fatalf("expected share startup error, got %v", err)
	}
}
