package browser

import (
	"fmt"
	"os/exec"
)

func Open(preferred, fallback, targetURL string) error {
	commands := make([][]string, 0, 2)
	if preferred != "" {
		commands = append(commands, []string{preferred, targetURL})
	}
	if fallback == "system" || fallback == "" {
		commands = append(commands, []string{"xdg-open", targetURL})
	}

	var lastErr error
	for _, argv := range commands {
		if _, err := exec.LookPath(argv[0]); err != nil {
			lastErr = err
			continue
		}
		if err := exec.Command(argv[0], argv[1:]...).Start(); err != nil {
			lastErr = err
			continue
		}
		return nil
	}

	return fmt.Errorf("open browser: %w", lastErr)
}
