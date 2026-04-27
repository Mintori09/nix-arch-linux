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
	LineHeight         string `toml:"line_height,omitempty" json:"line_height,omitempty"`
	BodyLineHeight     string `toml:"body_line_height" json:"body_line_height"`
	ParagraphSpacing   string `toml:"paragraph_spacing" json:"paragraph_spacing"`
	CodeFontSize       int    `toml:"code_font_size" json:"code_font_size"`
	CodeLineHeight     string `toml:"code_line_height" json:"code_line_height"`
	EditorFont         string `toml:"editor_font" json:"editor_font"`
	EditorFontSize     int    `toml:"editor_font_size" json:"editor_font_size"`
	EditorLineHeight   string `toml:"editor_line_height" json:"editor_line_height"`
	FontFamily         string `toml:"font_family" json:"font_family"`
	CustomCSS          string `toml:"custom_css" json:"custom_css"`
	AssetsDir          string `toml:"assets_dir" json:"assets_dir"`
	AutosaveDebounceMS int    `toml:"autosave_debounce_ms" json:"autosave_debounce_ms"`
	AllowRawHTML       bool   `toml:"allow_raw_html" json:"allow_raw_html"`
	LocalOnly          bool   `toml:"local_only" json:"local_only"`
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
		BodyLineHeight:     "1.8",
		ParagraphSpacing:   "0.85",
		CodeFontSize:       14,
		CodeLineHeight:     "1.6",
		EditorFont:         "monospace",
		EditorFontSize:     15,
		EditorLineHeight:   "1.7",
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
	path, err := m.path()
	if err != nil {
		return Config{}, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Default(), nil
		}
		return Config{}, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := toml.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("decode config: %w", err)
	}

	return normalize(cfg), nil
}

func (m Manager) Save(_ context.Context, cfg Config) error {
	path, err := m.path()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	cfg = normalize(cfg)
	cfg.LineHeight = ""

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

func normalize(cfg Config) Config {
	defaults := Default()

	if cfg.Browser == "" {
		cfg.Browser = defaults.Browser
	}
	if cfg.FallbackBrowser == "" {
		cfg.FallbackBrowser = defaults.FallbackBrowser
	}
	if cfg.Theme == "" {
		cfg.Theme = defaults.Theme
	}
	if cfg.Appearance == "" {
		cfg.Appearance = defaults.Appearance
	}
	if cfg.ContentWidth == 0 {
		cfg.ContentWidth = defaults.ContentWidth
	}
	if cfg.FontSize == 0 {
		cfg.FontSize = defaults.FontSize
	}
	if cfg.BodyLineHeight == "" {
		if cfg.LineHeight != "" {
			cfg.BodyLineHeight = cfg.LineHeight
		} else {
			cfg.BodyLineHeight = defaults.BodyLineHeight
		}
	}
	if cfg.ParagraphSpacing == "" {
		cfg.ParagraphSpacing = defaults.ParagraphSpacing
	}
	if cfg.CodeFontSize == 0 {
		cfg.CodeFontSize = defaults.CodeFontSize
	}
	if cfg.CodeLineHeight == "" {
		cfg.CodeLineHeight = defaults.CodeLineHeight
	}
	if cfg.EditorFont == "" {
		cfg.EditorFont = defaults.EditorFont
	}
	if cfg.EditorFontSize == 0 {
		cfg.EditorFontSize = defaults.EditorFontSize
	}
	if cfg.EditorLineHeight == "" {
		cfg.EditorLineHeight = defaults.EditorLineHeight
	}
	if cfg.FontFamily == "" {
		cfg.FontFamily = defaults.FontFamily
	}
	if cfg.CustomCSS == "" {
		cfg.CustomCSS = defaults.CustomCSS
	}
	if cfg.AssetsDir == "" {
		cfg.AssetsDir = defaults.AssetsDir
	}
	if cfg.AutosaveDebounceMS == 0 {
		cfg.AutosaveDebounceMS = defaults.AutosaveDebounceMS
	}
	return cfg
}
