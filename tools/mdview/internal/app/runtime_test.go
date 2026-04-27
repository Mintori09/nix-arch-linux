package app

import (
	"context"
	"net"
	"net/http"
	"net/url"
	"testing"
	"time"
)

func TestParseCLIDoesNotAcceptEditFlag(t *testing.T) {
	t.Parallel()

	_, err := ParseCLI([]string{"-edit"})
	if err == nil {
		t.Fatal("expected -edit flag to be rejected")
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
