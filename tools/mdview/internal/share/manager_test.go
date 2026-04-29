package share

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
)

func TestParseQuickTunnelURL(t *testing.T) {
	t.Parallel()

	output := "INF | Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): https://demo.trycloudflare.com\n"

	publicURL, err := parseQuickTunnelURL(output, "share-123")
	if err != nil {
		t.Fatalf("parseQuickTunnelURL returned error: %v", err)
	}

	if publicURL != "https://demo.trycloudflare.com/s/share-123" {
		t.Fatalf("expected public url with share path, got %q", publicURL)
	}
}

func TestManagerStartTransitionsToActiveWithFrozenSnapshot(t *testing.T) {
	t.Parallel()

	manager := NewManager(Options{
		StartProcess: func(context.Context, string) (Process, error) {
			return &stubProcess{
				stdout: "https://demo.trycloudflare.com",
				done:   make(chan error),
			}, nil
		},
	})

	doc := session.Document{Name: "note.md", Content: "# frozen", Path: "/tmp/note.md"}
	cfg := config.Default()

	state, err := manager.Start(context.Background(), "http://127.0.0.1:9988", doc, cfg)
	if err != nil {
		t.Fatalf("Start returned error: %v", err)
	}

	if state.Status != StatusActive {
		t.Fatalf("expected active status, got %q", state.Status)
	}
	if state.ShareID == "" {
		t.Fatal("expected share id to be assigned")
	}
	if state.SharedDocument.Name != "note.md" || state.SharedDocument.Content != "# frozen" {
		t.Fatalf("expected frozen document snapshot, got %+v", state.SharedDocument)
	}
}

func TestManagerStopClearsStateAndStopsProcess(t *testing.T) {
	t.Parallel()

	process := &stubProcess{
		stdout: "https://demo.trycloudflare.com",
		done:   make(chan error),
	}
	manager := NewManager(Options{
		StartProcess: func(context.Context, string) (Process, error) {
			return process, nil
		},
	})

	_, err := manager.Start(context.Background(), "http://127.0.0.1:9988", session.Document{Name: "note.md"}, config.Default())
	if err != nil {
		t.Fatalf("Start returned error: %v", err)
	}

	if err := manager.Stop(); err != nil {
		t.Fatalf("Stop returned error: %v", err)
	}

	state := manager.Snapshot()
	if state.Status != StatusIdle {
		t.Fatalf("expected idle status after stop, got %q", state.Status)
	}
	if state.PublicURL != "" || state.ShareID != "" || state.SharedDocument.Name != "" {
		t.Fatalf("expected share state to be cleared, got %+v", state)
	}
	if !process.stopped {
		t.Fatal("expected process to be stopped")
	}
}

func TestManagerTransitionsToErrorWhenProcessExitsUnexpectedly(t *testing.T) {
	t.Parallel()

	done := make(chan error, 1)
	manager := NewManager(Options{
		StartProcess: func(context.Context, string) (Process, error) {
			return &stubProcess{
				stdout: "https://demo.trycloudflare.com",
				done:   done,
			}, nil
		},
	})

	_, err := manager.Start(context.Background(), "http://127.0.0.1:9988", session.Document{Name: "note.md"}, config.Default())
	if err != nil {
		t.Fatalf("Start returned error: %v", err)
	}

	done <- errors.New("cloudflared exited")

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		state := manager.Snapshot()
		if state.Status == StatusError {
			if state.Error == "" {
				t.Fatal("expected error message to be recorded")
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}

	t.Fatal("expected manager to transition to error state")
}

type stubProcess struct {
	stdout  string
	done    chan error
	stopped bool
}

func (p *stubProcess) WaitForReady(context.Context) (string, error) {
	return p.stdout, nil
}

func (p *stubProcess) Done() <-chan error {
	return p.done
}

func (p *stubProcess) Stop() error {
	p.stopped = true
	return nil
}
