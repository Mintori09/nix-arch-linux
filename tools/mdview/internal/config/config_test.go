package config

import (
	"context"
	"os"
	"path/filepath"
	"strings"
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

	if cfg.SpeechLanguage != "vi-VN" {
		t.Fatalf("expected default speech language vi-VN, got %q", cfg.SpeechLanguage)
	}

	if cfg.SpeechRate != 1.0 {
		t.Fatalf("expected default speech rate 1.0, got %v", cfg.SpeechRate)
	}

	if cfg.SpeechAutoNext == nil || !*cfg.SpeechAutoNext {
		t.Fatalf("expected speech auto next default true, got %+v", cfg.SpeechAutoNext)
	}

	if cfg.TTSProvider != "google" || cfg.TTSLanguage != "vi-VN" || cfg.TTSVoice == "" || cfg.TTSSpeed != 1.0 {
		t.Fatalf("unexpected default TTS config: %+v", cfg)
	}

	if cfg.TTSAutoNext == nil || !*cfg.TTSAutoNext {
		t.Fatalf("expected TTS auto next default true, got %+v", cfg.TTSAutoNext)
	}
}

func TestManagerSavePersistsConfig(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	manager := Manager{ConfigDir: root}
	cfg := Default()
	cfg.Theme = "paper"
	cfg.ContentWidth = 820
	cfg.SpeechLanguage = "en-US"
	cfg.SpeechVoice = "Example Voice"
	cfg.SpeechRate = 1.2
	cfg.SpeechAutoNext = boolPtr(false)
	cfg.TTSLanguage = "vi-VN"
	cfg.TTSVoice = "vi-VN-Wavenet-B"
	cfg.TTSSpeed = 0.9
	cfg.TTSAutoNext = boolPtr(false)

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

	text := string(data)
	if containsAny(text, "editor_font", "editor_font_size", "editor_line_height", "autosave_debounce_ms") {
		t.Fatalf("expected saved config to omit editor settings, got %s", text)
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

	if loaded.SpeechLanguage != "en-US" || loaded.SpeechVoice != "Example Voice" || loaded.SpeechRate != 1.2 {
		t.Fatalf("expected saved speech settings, got %+v", loaded)
	}

	if loaded.SpeechAutoNext == nil || *loaded.SpeechAutoNext {
		t.Fatalf("expected saved speech auto next false, got %+v", loaded.SpeechAutoNext)
	}

	if loaded.TTSProvider != "google" || loaded.TTSLanguage != "vi-VN" || loaded.TTSVoice != "vi-VN-Wavenet-B" || loaded.TTSSpeed != 0.9 {
		t.Fatalf("expected saved TTS settings, got %+v", loaded)
	}

	if loaded.TTSAutoNext == nil || *loaded.TTSAutoNext {
		t.Fatalf("expected saved TTS auto next false, got %+v", loaded.TTSAutoNext)
	}
}

func TestManagerSavePersistsWorkspaceRoots(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	manager := Manager{ConfigDir: root}
	cfg := Default()
	cfg.WorkspaceRoots = []string{"/tmp/workspace-a", "/tmp/workspace-b"}

	if err := manager.Save(context.Background(), cfg); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	loaded, err := manager.Load(context.Background())
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}

	if len(loaded.WorkspaceRoots) != 2 {
		t.Fatalf("expected 2 workspace roots, got %+v", loaded.WorkspaceRoots)
	}

	if loaded.WorkspaceRoots[0] != "/tmp/workspace-a" || loaded.WorkspaceRoots[1] != "/tmp/workspace-b" {
		t.Fatalf("unexpected workspace roots: %+v", loaded.WorkspaceRoots)
	}
}

func containsAny(value string, needles ...string) bool {
	for _, needle := range needles {
		if needle != "" && strings.Contains(value, needle) {
			return true
		}
	}
	return false
}
