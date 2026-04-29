package share

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"regexp"
	"strings"
	"sync"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
)

const (
	StatusIdle     = "idle"
	StatusStarting = "starting"
	StatusActive   = "active"
	StatusError    = "error"
)

type State struct {
	Status         string
	PublicURL      string
	ShareID        string
	Error          string
	SharedDocument session.Document
	SharedConfig   config.Config
}

type Service interface {
	Start(context.Context, string, session.Document, config.Config) (State, error)
	Stop() error
	Snapshot() State
	Close() error
}

type Process interface {
	WaitForReady(context.Context) (string, error)
	Done() <-chan error
	Stop() error
}

type Options struct {
	StartProcess func(context.Context, string) (Process, error)
	NewShareID   func() (string, error)
}

type Manager struct {
	mu      sync.RWMutex
	state   State
	process Process
	opts    Options
}

func NewManager(opts Options) *Manager {
	if opts.StartProcess == nil {
		opts.StartProcess = startCloudflaredProcess
	}
	if opts.NewShareID == nil {
		opts.NewShareID = randomShareID
	}
	return &Manager{
		state: State{Status: StatusIdle},
		opts:  opts,
	}
}

func (m *Manager) Start(ctx context.Context, localURL string, doc session.Document, cfg config.Config) (State, error) {
	shareID, err := m.opts.NewShareID()
	if err != nil {
		return State{}, fmt.Errorf("generate share id: %w", err)
	}

	process, err := m.opts.StartProcess(ctx, localURL)
	if err != nil {
		m.setError(err, shareID)
		return State{}, err
	}

	m.mu.Lock()
	previous := m.process
	m.process = process
	m.state = State{
		Status:         StatusStarting,
		ShareID:        shareID,
		SharedDocument: cloneDocument(doc),
		SharedConfig:   cfg,
	}
	m.mu.Unlock()

	if previous != nil {
		_ = previous.Stop()
	}

	rawURL, err := process.WaitForReady(ctx)
	if err != nil {
		_ = process.Stop()
		m.setError(err, shareID)
		return State{}, err
	}

	publicURL, err := parseQuickTunnelURL(rawURL, shareID)
	if err != nil {
		_ = process.Stop()
		m.setError(err, shareID)
		return State{}, err
	}

	m.mu.Lock()
	if m.process == process {
		m.state.Status = StatusActive
		m.state.PublicURL = publicURL
		m.state.Error = ""
	}
	state := m.state
	m.mu.Unlock()

	go m.watch(process)
	return state, nil
}

func (m *Manager) Stop() error {
	m.mu.Lock()
	process := m.process
	m.process = nil
	m.state = State{Status: StatusIdle}
	m.mu.Unlock()

	if process == nil {
		return nil
	}
	return process.Stop()
}

func (m *Manager) Snapshot() State {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := m.state
	state.SharedDocument = cloneDocument(state.SharedDocument)
	return state
}

func (m *Manager) Close() error {
	return m.Stop()
}

func (m *Manager) watch(process Process) {
	err, ok := <-process.Done()
	if !ok || err == nil {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.process != process {
		return
	}
	m.process = nil
	m.state.Status = StatusError
	m.state.PublicURL = ""
	m.state.Error = err.Error()
}

func (m *Manager) setError(err error, shareID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.process = nil
	m.state = State{
		Status:  StatusError,
		ShareID: shareID,
		Error:   err.Error(),
	}
}

func cloneDocument(doc session.Document) session.Document {
	return doc
}

var quickTunnelPattern = regexp.MustCompile(`https://[A-Za-z0-9.-]+trycloudflare\.com`)

func parseQuickTunnelURL(output, shareID string) (string, error) {
	match := quickTunnelPattern.FindString(output)
	if match == "" {
		return "", errors.New("cloudflared did not report a public URL")
	}
	return strings.TrimRight(match, "/") + "/s/" + shareID, nil
}

func randomShareID() (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

type cloudflaredProcess struct {
	cmd    *exec.Cmd
	ready  chan readyResult
	done   chan error
	stopMu sync.Mutex
}

type readyResult struct {
	output string
	err    error
}

func startCloudflaredProcess(ctx context.Context, localURL string) (Process, error) {
	path, err := exec.LookPath("cloudflared")
	if err != nil {
		return nil, fmt.Errorf("cloudflared not found in PATH")
	}

	cmd := exec.CommandContext(ctx, path, "tunnel", "--url", localURL)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("cloudflared stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("cloudflared stderr pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start cloudflared: %w", err)
	}

	process := &cloudflaredProcess{
		cmd:   cmd,
		ready: make(chan readyResult, 1),
		done:  make(chan error, 1),
	}

	go process.captureReady(stdout, stderr)
	go func() {
		err := cmd.Wait()
		process.done <- err
		close(process.done)
	}()

	return process, nil
}

func (p *cloudflaredProcess) WaitForReady(ctx context.Context) (string, error) {
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case result := <-p.ready:
		return result.output, result.err
	}
}

func (p *cloudflaredProcess) Done() <-chan error {
	return p.done
}

func (p *cloudflaredProcess) Stop() error {
	p.stopMu.Lock()
	defer p.stopMu.Unlock()
	if p.cmd.Process == nil {
		return nil
	}
	return p.cmd.Process.Kill()
}

func (p *cloudflaredProcess) captureReady(stdout, stderr io.ReadCloser) {
	reader := io.MultiReader(stdout, stderr)
	scanner := bufio.NewScanner(reader)
	var builder strings.Builder
	for scanner.Scan() {
		line := scanner.Text()
		builder.WriteString(line)
		builder.WriteByte('\n')
		if quickTunnelPattern.MatchString(line) {
			p.ready <- readyResult{output: builder.String()}
			close(p.ready)
			return
		}
	}
	if err := scanner.Err(); err != nil {
		p.ready <- readyResult{err: fmt.Errorf("read cloudflared output: %w", err)}
	} else {
		p.ready <- readyResult{err: errors.New("cloudflared exited before reporting a public URL")}
	}
	close(p.ready)
}
