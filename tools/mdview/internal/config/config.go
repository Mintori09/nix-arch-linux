package config

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	toml "github.com/pelletier/go-toml/v2"
)

type Config struct {
	Browser            string `toml:"browser" json:"browser"`
	FallbackBrowser    string `toml:"fallback_browser" json:"fallback_browser"`
	Theme              string `toml:"theme" json:"theme"`
	Appearance         string `toml:"appearance" json:"appearance"`
	ContentWidth       int    `toml:"content_width" json:"content_width"`
	FontSize           int    `toml:"font_size" json:"font_size"`
	LineHeight         string `toml:"line_height" json:"line_height"`
	FontFamily         string `toml:"font_family" json:"font_family"`
	CustomCSS          string `toml:"custom_css" json:"custom_css"`
	AssetsDir          string `toml:"assets_dir" json:"assets_dir"`
	AutosaveDebounceMS int    `toml:"autosave_debounce_ms" json:"autosave_debounce_ms"`
	AllowRawHTML       bool   `toml:"allow_raw_html" json:"allow_raw_html"`
	LocalOnly          bool   `toml:"local_only" json:"local_only"`
	DefaultEditMode    bool   `toml:"default_edit_mode" json:"default_edit_mode"`
	DefaultReaderMode  bool   `toml:"default_reader_mode" json:"default_reader_mode"`
	DefaultSidebarOpen bool   `toml:"default_sidebar_open" json:"default_sidebar_open"`
	DefaultOutlineOpen bool   `toml:"default_outline_open" json:"default_outline_open"`
}

func Default() Config {
	return Config{
		Browser:            "zen-browser",
		FallbackBrowser:    "system",
		Theme:              "warm",
		Appearance:         "system",
		ContentWidth:       760,
		FontSize:           17,
		LineHeight:         "1.8",
		FontFamily:         "serif",
		CustomCSS:          "~/.config/mdview/custom.css",
		AssetsDir:          "attachments",
		AutosaveDebounceMS: 700,
		AllowRawHTML:       false,
		LocalOnly:          true,
	}
}

type Manager struct {
	ConfigDir string
}

func (m Manager) Load(_ context.Context) (Config, error) {
	cfg := Default()
	path, err := m.path()
	if err != nil {
		return Config{}, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return Config{}, fmt.Errorf("read config: %w", err)
	}

	if err := toml.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("decode config: %w", err)
	}

	return cfg, nil
}

func (m Manager) Save(_ context.Context, cfg Config) error {
	path, err := m.path()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	data, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("encode config: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write config: %w", err)
	}

	return nil
}

func (m Manager) path() (string, error) {
	if m.ConfigDir != "" {
		return filepath.Join(m.ConfigDir, "mdview", "config.toml"), nil
	}

	root, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config dir: %w", err)
	}

	return filepath.Join(root, "mdview", "config.toml"), nil
}
