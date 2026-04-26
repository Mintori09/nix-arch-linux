package config

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestManagerLoadReturnsDefaultsWhenFileMissing(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	manager := Manager{ConfigDir: root}

	cfg, err := manager.Load(context.Background())
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}

	if cfg.Browser != "zen-browser" {
		t.Fatalf("expected default browser zen-browser, got %q", cfg.Browser)
	}

	if cfg.Theme != "warm" {
		t.Fatalf("expected default theme warm, got %q", cfg.Theme)
	}

	if cfg.AutosaveDebounceMS != 700 {
		t.Fatalf("expected debounce 700, got %d", cfg.AutosaveDebounceMS)
	}
}

func TestManagerSavePersistsConfig(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	manager := Manager{ConfigDir: root}
	cfg := Default()
	cfg.Theme = "paper"
	cfg.ContentWidth = 820

	if err := manager.Save(context.Background(), cfg); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	configPath := filepath.Join(root, "mdview", "config.toml")
	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}

	if len(data) == 0 {
		t.Fatal("expected config file to be written")
	}

	loaded, err := manager.Load(context.Background())
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}

	if loaded.Theme != "paper" {
		t.Fatalf("expected saved theme paper, got %q", loaded.Theme)
	}

	if loaded.ContentWidth != 820 {
		t.Fatalf("expected saved width 820, got %d", loaded.ContentWidth)
	}
}
