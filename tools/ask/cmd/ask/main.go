package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	askconfig "github.com/mintori/home-manager/tools/ask/internal/config"
	askexec "github.com/mintori/home-manager/tools/ask/internal/exec"
	"github.com/mintori/home-manager/tools/ask/internal/history"
	"github.com/mintori/home-manager/tools/ask/internal/provider"
	"github.com/mintori/home-manager/tools/ask/internal/provider/nanogpt"
)

type commandGenerator = provider.Generator

type Dependencies struct {
	NewProvider func(string) (commandGenerator, error)
	Executor    askexec.Runner
	Stdout      io.Writer
	Stderr      io.Writer
	Stdin       io.Reader
	Interactive bool
	HomeDir     string
	Env         func(string) string
}

func main() {
	deps := Dependencies{
		NewProvider: func(name string) (commandGenerator, error) {
			switch name {
			case "nanogpt":
				return nanogpt.New(nil), nil
			default:
				return nil, fmt.Errorf("unsupported provider %q", name)
			}
		},
		Executor: askexec.ShellRunner{
			Shell:  firstNonEmpty(os.Getenv("SHELL"), "/bin/sh"),
			Stdout: os.Stdout,
			Stderr: os.Stderr,
		},
		Stdout:      os.Stdout,
		Stderr:      os.Stderr,
		Stdin:       os.Stdin,
		Interactive: isInteractive(),
		HomeDir:     firstNonEmpty(os.Getenv("HOME"), "."),
		Env:         os.Getenv,
	}

	if err := run(context.Background(), os.Args[1:], deps); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, deps Dependencies) error {
	if len(args) == 0 && !deps.Interactive && deps.Stdin != nil {
		prompt, err := io.ReadAll(deps.Stdin)
		if err != nil {
			return fmt.Errorf("read prompt from stdin: %w", err)
		}
		trimmed := strings.TrimSpace(string(prompt))
		if trimmed != "" {
			args = []string{"--print-only", trimmed}
		}
	}

	cfg, err := askconfig.Parse(args, deps.Env, deps.HomeDir)
	if err != nil {
		return err
	}

	store := history.New(cfg.HistoryPath)
	if cfg.Command == askconfig.CommandHistory {
		return runHistory(deps.Stdout, store, cfg.HistoryDelete)
	}

	gen, err := deps.NewProvider(cfg.Provider)
	if err != nil {
		return err
	}

	command, err := gen.GenerateCommand(ctx, cfg.Prompt, provider.Options{
		Model:    cfg.Model,
		Endpoint: cfg.Endpoint,
		APIKey:   cfg.APIKey,
		Timeout:  cfg.TimeoutSeconds,
	})
	if err != nil {
		return err
	}

	if err := askexec.Execute(ctx, askexec.Params{
		Command:     command,
		PrintOnly:   cfg.PrintOnly,
		Interactive: deps.Interactive,
		Stdin:       deps.Stdin,
		Stdout:      deps.Stdout,
		Runner:      deps.Executor,
	}); err != nil {
		return err
	}

	if cfg.NoCache {
		return nil
	}

	return store.Save(history.Entry{
		ID:        makeID(cfg.Prompt, command),
		Prompt:    cfg.Prompt,
		Command:   command,
		Provider:  cfg.Provider,
		Model:     cfg.Model,
		Timestamp: time.Now().UTC(),
	})
}

func runHistory(stdout io.Writer, store history.Store, deleteID string) error {
	if deleteID != "" {
		_, err := store.Delete(deleteID)
		return err
	}
	entries, err := store.List()
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if _, err := fmt.Fprintf(
			stdout,
			"%s\t%s\t%s\t%s\t%s\t%s\n",
			entry.ID,
			entry.Timestamp.Format(time.RFC3339),
			entry.Provider,
			entry.Model,
			entry.Prompt,
			entry.Command,
		); err != nil {
			return err
		}
	}
	return nil
}

func makeID(prompt, command string) string {
	sum := sha256.Sum256([]byte(prompt + "\n" + command))
	return fmt.Sprintf("%x", sum[:6])
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func isInteractive() bool {
	info, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return (info.Mode() & os.ModeCharDevice) != 0
}
