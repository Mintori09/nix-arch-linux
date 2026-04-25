package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	askexec "github.com/mintori/home-manager/tools/ask/internal/exec"
	"github.com/mintori/home-manager/tools/ask/internal/provider"
)

type stubProvider struct {
	command string
	err     error
}

func (s stubProvider) GenerateCommand(context.Context, string, provider.Options) (string, error) {
	return s.command, s.err
}

type stubExecutor struct {
	results  []askexec.Result
	commands []string
}

func (s *stubExecutor) Run(_ context.Context, command string) error {
	s.commands = append(s.commands, command)
	return nil
}

func (s *stubExecutor) Execute(_ context.Context, params askexec.Params) (askexec.Result, error) {
	if params.Stdout != nil {
		_, _ = fmt.Fprintln(params.Stdout, params.Command)
	}
	if len(s.results) > 0 {
		result := s.results[0]
		s.results = s.results[1:]
		return result, nil
	}
	return askexec.Result{}, nil
}

func TestRunGenerateCommandAndSaveHistory(t *testing.T) {
	dir := t.TempDir()
	var out bytes.Buffer
	exec := &stubExecutor{}

	err := run(context.Background(), []string{"--print-only", "list files"}, Dependencies{
		NewProvider: func(string) (commandGenerator, error) {
			return stubProvider{command: "ls -la"}, nil
		},
		Executor:    exec,
		Stdout:      &out,
		Stderr:      &bytes.Buffer{},
		Stdin:       strings.NewReader(""),
		Interactive: false,
		HomeDir:     dir,
		Env: func(key string) string {
			if key == "NANOGPT_API_KEY" {
				return "secret"
			}
			return ""
		},
	})
	if err != nil {
		t.Fatalf("run() error = %v", err)
	}

	if !strings.Contains(out.String(), "ls -la") {
		t.Fatalf("stdout = %q", out.String())
	}
	path := filepath.Join(dir, ".local", "state", "ask", "history.json")
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("history file missing: %v", err)
	}
}

func TestRunSavesEditedCommandToHistory(t *testing.T) {
	dir := t.TempDir()
	exec := &stubExecutor{
		results: []askexec.Result{{
			FinalCommand: "pwd",
			Executed:     true,
		}},
	}

	err := run(context.Background(), []string{"show cwd"}, Dependencies{
		NewProvider: func(string) (commandGenerator, error) {
			return stubProvider{command: "ls -la"}, nil
		},
		Executor:    exec,
		Stdout:      &bytes.Buffer{},
		Stderr:      &bytes.Buffer{},
		Stdin:       strings.NewReader(""),
		Interactive: true,
		HomeDir:     dir,
		Env: func(key string) string {
			if key == "NANOGPT_API_KEY" {
				return "secret"
			}
			return ""
		},
	})
	if err != nil {
		t.Fatalf("run() error = %v", err)
	}

	data, err := os.ReadFile(filepath.Join(dir, ".local", "state", "ask", "history.json"))
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	if !strings.Contains(string(data), "\"pwd\"") || strings.Contains(string(data), "\"ls -la\"") {
		t.Fatalf("history = %s", string(data))
	}
}

func TestRunDoesNotSaveHistoryWhenQuit(t *testing.T) {
	dir := t.TempDir()
	exec := &stubExecutor{
		results: []askexec.Result{{
			FinalCommand: "ls -la",
			Executed:     false,
		}},
	}

	err := run(context.Background(), []string{"list files"}, Dependencies{
		NewProvider: func(string) (commandGenerator, error) {
			return stubProvider{command: "ls -la"}, nil
		},
		Executor:    exec,
		Stdout:      &bytes.Buffer{},
		Stderr:      &bytes.Buffer{},
		Stdin:       strings.NewReader(""),
		Interactive: true,
		HomeDir:     dir,
		Env: func(key string) string {
			if key == "NANOGPT_API_KEY" {
				return "secret"
			}
			return ""
		},
	})
	if err != nil {
		t.Fatalf("run() error = %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, ".local", "state", "ask", "history.json")); !os.IsNotExist(err) {
		t.Fatalf("history file exists, err = %v", err)
	}
}

func TestRunHistoryDelete(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".local", "state", "ask")
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(path, "history.json"), []byte(`[{"id":"abc123","prompt":"p","command":"ls","provider":"nanogpt","model":"m","timestamp":"2024-01-01T00:00:00Z"}]`), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	err := run(context.Background(), []string{"history", "--delete", "abc123"}, Dependencies{
		NewProvider: func(string) (commandGenerator, error) {
			t.Fatal("provider should not be used")
			return nil, nil
		},
		Executor:    &stubExecutor{},
		Stdout:      &bytes.Buffer{},
		Stderr:      &bytes.Buffer{},
		Stdin:       strings.NewReader(""),
		Interactive: false,
		HomeDir:     dir,
		Env:         func(string) string { return "" },
	})
	if err != nil {
		t.Fatalf("run() error = %v", err)
	}

	data, err := os.ReadFile(filepath.Join(path, "history.json"))
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	if strings.Contains(string(data), "abc123") {
		t.Fatalf("history still contains deleted entry: %s", string(data))
	}
}

func TestRunHistoryList(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".local", "state", "ask")
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(path, "history.json"), []byte(`[{"id":"abc123","prompt":"list files","command":"ls","provider":"nanogpt","model":"m","timestamp":"2024-01-01T00:00:00Z"}]`), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	var out bytes.Buffer
	err := run(context.Background(), []string{"history"}, Dependencies{
		NewProvider: func(string) (commandGenerator, error) {
			t.Fatal("provider should not be used")
			return nil, nil
		},
		Executor:    &stubExecutor{},
		Stdout:      &out,
		Stderr:      &bytes.Buffer{},
		Stdin:       strings.NewReader(""),
		Interactive: false,
		HomeDir:     dir,
		Env:         func(string) string { return "" },
	})
	if err != nil {
		t.Fatalf("run() error = %v", err)
	}
	if !strings.Contains(out.String(), "list files") || !strings.Contains(out.String(), "nanogpt") {
		t.Fatalf("stdout = %q", out.String())
	}
}

func TestRunReadsPromptFromStdin(t *testing.T) {
	dir := t.TempDir()
	var out bytes.Buffer

	err := run(context.Background(), nil, Dependencies{
		NewProvider: func(string) (commandGenerator, error) {
			return stubProvider{command: "pwd"}, nil
		},
		Executor:    &stubExecutor{},
		Stdout:      &out,
		Stderr:      &bytes.Buffer{},
		Stdin:       strings.NewReader("current directory\n"),
		Interactive: false,
		HomeDir:     dir,
		Env: func(key string) string {
			if key == "NANOGPT_API_KEY" {
				return "secret"
			}
			return ""
		},
	})
	if err != nil {
		t.Fatalf("run() error = %v", err)
	}
	if !strings.Contains(out.String(), "pwd") {
		t.Fatalf("stdout = %q", out.String())
	}
}
