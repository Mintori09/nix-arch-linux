package exec

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

type fakeRunner struct {
	commands []string
}

func (f *fakeRunner) Run(_ context.Context, command string) error {
	f.commands = append(f.commands, command)
	return nil
}

func TestExecutePrintOnlyDoesNotRun(t *testing.T) {
	runner := &fakeRunner{}
	var out bytes.Buffer

	err := Execute(context.Background(), Params{
		Command:     "ls -la",
		PrintOnly:   true,
		Stdout:      &out,
		Runner:      runner,
		Interactive: true,
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if len(runner.commands) != 0 {
		t.Fatalf("runner.commands = %+v, want none", runner.commands)
	}
	if !strings.Contains(out.String(), "ls -la") {
		t.Fatalf("stdout = %q", out.String())
	}
}

func TestExecuteConfirmsBeforeRunning(t *testing.T) {
	runner := &fakeRunner{}
	err := Execute(context.Background(), Params{
		Command:     "ls -la",
		Stdin:       strings.NewReader("y\n"),
		Stdout:      &bytes.Buffer{},
		Runner:      runner,
		Interactive: true,
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if len(runner.commands) != 1 {
		t.Fatalf("runner.commands = %+v, want one run", runner.commands)
	}
}

func TestExecuteRejectsNonInteractiveAutoRun(t *testing.T) {
	runner := &fakeRunner{}
	err := Execute(context.Background(), Params{
		Command:     "ls -la",
		Stdout:      &bytes.Buffer{},
		Runner:      runner,
		Interactive: false,
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "tty") {
		t.Fatalf("error = %v, want tty error", err)
	}
	if len(runner.commands) != 0 {
		t.Fatalf("runner.commands = %+v, want none", runner.commands)
	}
}
