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

type fakeEditor struct {
	result string
	calls  []string
}

func (f *fakeEditor) Edit(_ context.Context, command string) (string, error) {
	f.calls = append(f.calls, command)
	return f.result, nil
}

type fakeKeyReader struct {
	keys []byte
}

func (f *fakeKeyReader) ReadKey() (byte, error) {
	key := f.keys[0]
	f.keys = f.keys[1:]
	return key, nil
}

func TestExecutePrintOnlyDoesNotRun(t *testing.T) {
	runner := &fakeRunner{}
	var out bytes.Buffer

	_, err := Execute(context.Background(), Params{
		Command:     "ls -la",
		PrintOnly:   true,
		Stdout:      &out,
		Runner:      runner,
		Interactive: true,
		IsTTYOutput: true,
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if len(runner.commands) != 0 {
		t.Fatalf("runner.commands = %+v, want none", runner.commands)
	}
	if !strings.Contains(out.String(), "ls") || !strings.Contains(out.String(), "-la") {
		t.Fatalf("stdout = %q", out.String())
	}
	if !strings.Contains(out.String(), "\x1b[") {
		t.Fatalf("stdout = %q, want ansi highlight", out.String())
	}
}

func TestExecuteRunsOnSingleKeypress(t *testing.T) {
	runner := &fakeRunner{}
	_, err := Execute(context.Background(), Params{
		Command:     "ls -la",
		Stdout:      &bytes.Buffer{},
		Runner:      runner,
		Interactive: true,
		IsTTYOutput: true,
		KeyReader:   &fakeKeyReader{keys: []byte{'r'}},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if len(runner.commands) != 1 || runner.commands[0] != "ls -la" {
		t.Fatalf("runner.commands = %+v", runner.commands)
	}
}

func TestExecuteEditThenRunUsesEditedCommand(t *testing.T) {
	runner := &fakeRunner{}
	editor := &fakeEditor{result: "pwd"}
	result, err := Execute(context.Background(), Params{
		Command:     "ls -la",
		Stdout:      &bytes.Buffer{},
		Runner:      runner,
		Editor:      editor,
		Interactive: true,
		IsTTYOutput: true,
		KeyReader:   &fakeKeyReader{keys: []byte{'e', 'r'}},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if result.FinalCommand != "pwd" {
		t.Fatalf("FinalCommand = %q, want pwd", result.FinalCommand)
	}
	if len(editor.calls) != 1 || editor.calls[0] != "ls -la" {
		t.Fatalf("editor.calls = %+v", editor.calls)
	}
	if len(runner.commands) != 1 || runner.commands[0] != "pwd" {
		t.Fatalf("runner.commands = %+v", runner.commands)
	}
}

func TestExecuteQuitDoesNotRun(t *testing.T) {
	runner := &fakeRunner{}
	result, err := Execute(context.Background(), Params{
		Command:     "ls -la",
		Stdout:      &bytes.Buffer{},
		Runner:      runner,
		Interactive: true,
		IsTTYOutput: true,
		KeyReader:   &fakeKeyReader{keys: []byte{'q'}},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if result.Executed {
		t.Fatalf("result = %+v, want not executed", result)
	}
	if len(runner.commands) != 0 {
		t.Fatalf("runner.commands = %+v, want none", runner.commands)
	}
}

func TestExecuteRejectsNonInteractiveAutoRun(t *testing.T) {
	runner := &fakeRunner{}
	_, err := Execute(context.Background(), Params{
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

func TestExecutePrintOnlyPlainTextWhenNotTTY(t *testing.T) {
	var out bytes.Buffer

	_, err := Execute(context.Background(), Params{
		Command:     "echo hello | cat",
		PrintOnly:   true,
		Stdout:      &out,
		Interactive: false,
		IsTTYOutput: false,
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if strings.Contains(out.String(), "\x1b[") {
		t.Fatalf("stdout = %q, want plain text", out.String())
	}
}
