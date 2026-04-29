package share

import (
	"context"
	"errors"
	"io"
	"strings"
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

func TestCloudflaredProcessCaptureReadyDetectsURLFromStderrWhileStdoutStaysOpen(t *testing.T) {
	t.Parallel()

	stdoutReader, stdoutWriter := io.Pipe()
	stderrReader, stderrWriter := io.Pipe()
	process := &cloudflaredProcess{ready: make(chan readyResult, 1)}

	go process.captureReady(stdoutReader, stderrReader)

	go func() {
		_, _ = io.WriteString(stderrWriter, "INF quick tunnel: https://demo.trycloudflare.com\n")
		_ = stderrWriter.Close()
	}()

	result, ok := waitForReadyResult(process.ready, 200*time.Millisecond)
	_ = stdoutWriter.Close()
	if !ok {
		t.Fatal("expected ready result before stdout closed")
	}
	if result.err != nil {
		t.Fatalf("expected ready without error, got %v", result.err)
	}
	if got := parseReadyURL(t, result.output); got != "https://demo.trycloudflare.com/s/share-123" {
		t.Fatalf("expected stderr URL to be parsed, got %q", got)
	}
}

func TestCloudflaredProcessCaptureReadyDetectsURLFromStdout(t *testing.T) {
	t.Parallel()

	stdoutReader, stdoutWriter := io.Pipe()
	stderrReader, stderrWriter := io.Pipe()
	process := &cloudflaredProcess{ready: make(chan readyResult, 1)}

	go process.captureReady(stdoutReader, stderrReader)

	go func() {
		_, _ = io.WriteString(stdoutWriter, "INF quick tunnel: https://demo.trycloudflare.com\n")
		_ = stdoutWriter.Close()
		_ = stderrWriter.Close()
	}()

	result, ok := waitForReadyResult(process.ready, time.Second)
	if !ok {
		t.Fatal("expected ready result from stdout")
	}
	if result.err != nil {
		t.Fatalf("expected ready without error, got %v", result.err)
	}
	if got := parseReadyURL(t, result.output); got != "https://demo.trycloudflare.com/s/share-123" {
		t.Fatalf("expected stdout URL to be parsed, got %q", got)
	}
}

func TestCloudflaredProcessCaptureReadyReturnsErrorWhenStreamsEndWithoutURL(t *testing.T) {
	t.Parallel()

	stdoutReader, stdoutWriter := io.Pipe()
	stderrReader, stderrWriter := io.Pipe()
	process := &cloudflaredProcess{ready: make(chan readyResult, 1)}

	go process.captureReady(stdoutReader, stderrReader)

	go func() {
		_, _ = io.WriteString(stdoutWriter, "INF still starting\n")
		_ = stdoutWriter.Close()
		_, _ = io.WriteString(stderrWriter, "ERR no public URL emitted\n")
		_ = stderrWriter.Close()
	}()

	result, ok := waitForReadyResult(process.ready, time.Second)
	if !ok {
		t.Fatal("expected ready error when both streams end")
	}
	if result.err == nil || result.err.Error() != "cloudflared exited before reporting a public URL" {
		t.Fatalf("expected missing URL error, got %v", result.err)
	}
}

func TestCloudflaredProcessCaptureReadyReturnsScannerError(t *testing.T) {
	t.Parallel()

	process := &cloudflaredProcess{ready: make(chan readyResult, 1)}

	go process.captureReady(errReadCloser{err: errors.New("boom")}, io.NopCloser(strings.NewReader("")))

	result, ok := waitForReadyResult(process.ready, time.Second)
	if !ok {
		t.Fatal("expected ready error from scanner")
	}
	if result.err == nil || result.err.Error() != "read cloudflared output: boom" {
		t.Fatalf("expected scanner error, got %v", result.err)
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

type errReadCloser struct {
	err error
}

func (r errReadCloser) Read([]byte) (int, error) {
	return 0, r.err
}

func (r errReadCloser) Close() error {
	return nil
}

func waitForReadyResult(ch <-chan readyResult, timeout time.Duration) (readyResult, bool) {
	select {
	case result, ok := <-ch:
		return result, ok
	case <-time.After(timeout):
		return readyResult{}, false
	}
}

func parseReadyURL(t *testing.T, output string) string {
	t.Helper()

	publicURL, err := parseQuickTunnelURL(output, "share-123")
	if err != nil {
		t.Fatalf("parseQuickTunnelURL returned error: %v", err)
	}
	return publicURL
}
