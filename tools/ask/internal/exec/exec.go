package exec

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

type Runner interface {
	Run(ctx context.Context, command string) error
}

type Params struct {
	Command     string
	PrintOnly   bool
	Interactive bool
	Stdin       io.Reader
	Stdout      io.Writer
	Runner      Runner
}

type ShellRunner struct {
	Shell  string
	Stdout io.Writer
	Stderr io.Writer
}

func (s ShellRunner) Run(ctx context.Context, command string) error {
	cmd := exec.CommandContext(ctx, s.Shell, "-lc", command)
	cmd.Stdout = s.Stdout
	cmd.Stderr = s.Stderr
	cmd.Stdin = nil
	return cmd.Run()
}

func Execute(ctx context.Context, params Params) error {
	if _, err := fmt.Fprintln(params.Stdout, params.Command); err != nil {
		return err
	}
	if params.PrintOnly {
		return nil
	}
	if !params.Interactive {
		return fmt.Errorf("interactive TTY required to execute command; use --print-only")
	}
	if params.Runner == nil {
		return fmt.Errorf("runner is required")
	}
	if params.Stdin == nil {
		return fmt.Errorf("stdin is required for confirmation")
	}

	if _, err := fmt.Fprint(params.Stdout, "Run command? [y/N]: "); err != nil {
		return err
	}
	answer, err := bufio.NewReader(params.Stdin).ReadString('\n')
	if err != nil && err != io.EOF {
		return err
	}
	answer = strings.TrimSpace(strings.ToLower(answer))
	if answer != "y" && answer != "yes" {
		return nil
	}

	return params.Runner.Run(ctx, params.Command)
}
