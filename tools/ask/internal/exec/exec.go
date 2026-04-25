package exec

import (
	"context"
	"fmt"
	"io"
	"os"
	osexec "os/exec"
	"strings"
	"syscall"
	"unsafe"
)

type Runner interface {
	Run(ctx context.Context, command string) error
}

type Editor interface {
	Edit(ctx context.Context, command string) (string, error)
}

type KeyReader interface {
	ReadKey() (byte, error)
}

type Executor interface {
	Execute(ctx context.Context, params Params) (Result, error)
}

type Params struct {
	Command     string
	PrintOnly   bool
	Interactive bool
	IsTTYOutput bool
	Stdin       io.Reader
	Stdout      io.Writer
	Runner      Runner
	Editor      Editor
	KeyReader   KeyReader
}

type Result struct {
	FinalCommand string
	Executed     bool
}

type ShellRunner struct {
	Shell  string
	Stdout io.Writer
	Stderr io.Writer
}

type ShellEditor struct {
	Command string
	Stdin   io.Reader
	Stdout  io.Writer
	Stderr  io.Writer
}

type DefaultExecutor struct{}

func (d DefaultExecutor) Execute(ctx context.Context, params Params) (Result, error) {
	return Execute(ctx, params)
}

func (s ShellRunner) Run(ctx context.Context, command string) error {
	cmd := osexec.CommandContext(ctx, s.Shell, "-lc", command)
	cmd.Stdout = s.Stdout
	cmd.Stderr = s.Stderr
	cmd.Stdin = nil
	return cmd.Run()
}

func (s ShellEditor) Edit(ctx context.Context, command string) (string, error) {
	editor := strings.TrimSpace(s.Command)
	if editor == "" {
		return "", fmt.Errorf("EDITOR is not set")
	}

	file, err := os.CreateTemp("", "ask-*.sh")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	path := file.Name()
	defer os.Remove(path)

	if _, err := file.WriteString(command); err != nil {
		file.Close()
		return "", fmt.Errorf("write temp file: %w", err)
	}
	if err := file.Close(); err != nil {
		return "", fmt.Errorf("close temp file: %w", err)
	}

	cmd := osexec.CommandContext(ctx, editor, path)
	cmd.Stdin = s.Stdin
	cmd.Stdout = s.Stdout
	cmd.Stderr = s.Stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("open editor: %w", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read edited file: %w", err)
	}
	return strings.TrimSpace(string(data)), nil
}

func Execute(ctx context.Context, params Params) (Result, error) {
	if params.Stdout == nil {
		return Result{}, fmt.Errorf("stdout is required")
	}

	command := params.Command
	if err := renderCommand(params.Stdout, command, params.IsTTYOutput); err != nil {
		return Result{}, err
	}

	if params.PrintOnly {
		return Result{FinalCommand: command, Executed: false}, nil
	}
	if !params.Interactive {
		return Result{}, fmt.Errorf("interactive TTY required to execute command; use --print-only")
	}
	if params.Runner == nil {
		return Result{}, fmt.Errorf("runner is required")
	}

	keyReader := params.KeyReader
	if keyReader == nil {
		stdin, ok := params.Stdin.(*os.File)
		if !ok {
			return Result{}, fmt.Errorf("raw key reader requires *os.File stdin")
		}
		keyReader = newTTYKeyReader(stdin)
	}

	for {
		if _, err := fmt.Fprint(params.Stdout, "Actions: [r] run [e] edit [q] quit "); err != nil {
			return Result{}, err
		}

		key, err := keyReader.ReadKey()
		if err != nil {
			return Result{}, err
		}
		if _, err := fmt.Fprintln(params.Stdout); err != nil {
			return Result{}, err
		}

		switch strings.ToLower(string([]byte{key})) {
		case "r":
			if err := params.Runner.Run(ctx, command); err != nil {
				return Result{}, err
			}
			return Result{FinalCommand: command, Executed: true}, nil
		case "e":
			if params.Editor == nil {
				return Result{}, fmt.Errorf("editor is required for edit action")
			}
			edited, err := params.Editor.Edit(ctx, command)
			if err != nil {
				return Result{}, err
			}
			if strings.TrimSpace(edited) != "" {
				command = edited
			}
			if err := renderCommand(params.Stdout, command, params.IsTTYOutput); err != nil {
				return Result{}, err
			}
		case "q":
			return Result{FinalCommand: command, Executed: false}, nil
		}
	}
}

func renderCommand(w io.Writer, command string, colorize bool) error {
	if colorize {
		command = highlight(command)
	}
	_, err := fmt.Fprintln(w, command)
	return err
}

func highlight(command string) string {
	replacer := strings.NewReplacer(
		"|", "\x1b[36m|\x1b[0m",
		">", "\x1b[36m>\x1b[0m",
		"<", "\x1b[36m<\x1b[0m",
		"$", "\x1b[33m$\x1b[0m",
	)
	lines := strings.Split(command, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			lines[i] = "\x1b[90m" + line + "\x1b[0m"
			continue
		}
		fields := strings.Fields(line)
		if len(fields) > 0 {
			first := fields[0]
			colored := "\x1b[32m" + first + "\x1b[0m"
			lines[i] = strings.Replace(line, first, colored, 1)
		}
		lines[i] = replacer.Replace(lines[i])
	}
	return strings.Join(lines, "\n")
}

type ttyKeyReader struct {
	file *os.File
}

func newTTYKeyReader(file *os.File) KeyReader {
	return ttyKeyReader{file: file}
}

func (r ttyKeyReader) ReadKey() (byte, error) {
	fd := int(r.file.Fd())
	state, err := makeRaw(fd)
	if err != nil {
		return 0, fmt.Errorf("enable raw mode: %w", err)
	}
	defer restore(fd, state)

	var buf [1]byte
	_, err = r.file.Read(buf[:])
	return buf[0], err
}

func makeRaw(fd int) (*syscall.Termios, error) {
	state, err := ioctlGetTermios(fd)
	if err != nil {
		return nil, err
	}
	raw := *state
	raw.Iflag &^= syscall.ICRNL | syscall.INLCR | syscall.IGNCR | syscall.IXON
	raw.Lflag &^= syscall.ECHO | syscall.ICANON | syscall.IEXTEN
	raw.Cc[syscall.VMIN] = 1
	raw.Cc[syscall.VTIME] = 0
	if err := ioctlSetTermios(fd, &raw); err != nil {
		return nil, err
	}
	return state, nil
}

func restore(fd int, state *syscall.Termios) {
	_ = ioctlSetTermios(fd, state)
}

func ioctlGetTermios(fd int) (*syscall.Termios, error) {
	state := &syscall.Termios{}
	_, _, errno := syscall.Syscall6(syscall.SYS_IOCTL, uintptr(fd), uintptr(syscall.TCGETS), uintptr(unsafe.Pointer(state)), 0, 0, 0)
	if errno != 0 {
		return nil, errno
	}
	return state, nil
}

func ioctlSetTermios(fd int, state *syscall.Termios) error {
	_, _, errno := syscall.Syscall6(syscall.SYS_IOCTL, uintptr(fd), uintptr(syscall.TCSETS), uintptr(unsafe.Pointer(state)), 0, 0, 0)
	if errno != 0 {
		return errno
	}
	return nil
}
