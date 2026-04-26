package config

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestManagerLoadMigratesLegacyLineHeight(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	configPath := filepath.Join(root, "mdview", "config.toml")
	if err := os.MkdirAll(filepath.Dir(configPath), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	data := []byte("line_height = '1.9'\n")
	if err := os.WriteFile(configPath, data, 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	manager := Manager{ConfigDir: root}
	cfg, err := manager.Load(context.Background())
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}

	if cfg.BodyLineHeight != "1.9" {
		t.Fatalf("expected body line height 1.9, got %q", cfg.BodyLineHeight)
	}
}
