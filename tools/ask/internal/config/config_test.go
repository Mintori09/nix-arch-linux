package config

import (
	"strings"
	"testing"
)

func TestParseUsesEnvDefaults(t *testing.T) {
	cfg, err := Parse([]string{"list files"}, func(key string) string {
		switch key {
		case "NANOGPT_API_KEY":
			return "secret"
		case "ASK_MODEL":
			return "env-model"
		case "ASK_PROVIDER":
			return "nanogpt"
		case "ASK_ENDPOINT":
			return "https://example.test/v1"
		default:
			return ""
		}
	}, "/tmp/home")
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	if cfg.APIKey != "secret" {
		t.Fatalf("APIKey = %q, want secret", cfg.APIKey)
	}
	if cfg.Model != "env-model" {
		t.Fatalf("Model = %q, want env-model", cfg.Model)
	}
	if cfg.Provider != "nanogpt" {
		t.Fatalf("Provider = %q, want nanogpt", cfg.Provider)
	}
	if cfg.Endpoint != "https://example.test/v1" {
		t.Fatalf("Endpoint = %q", cfg.Endpoint)
	}
	if cfg.Prompt != "list files" {
		t.Fatalf("Prompt = %q", cfg.Prompt)
	}
}

func TestParseFlagsOverrideEnv(t *testing.T) {
	cfg, err := Parse([]string{
		"--provider", "mock",
		"--model", "flag-model",
		"--endpoint", "https://flag.test/v1",
		"--no-cache",
		"--print-only",
		"show disk usage",
	}, func(key string) string {
		switch key {
		case "NANOGPT_API_KEY":
			return "secret"
		case "ASK_MODEL":
			return "env-model"
		case "ASK_PROVIDER":
			return "nanogpt"
		case "ASK_ENDPOINT":
			return "https://env.test/v1"
		default:
			return ""
		}
	}, "/tmp/home")
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	if cfg.Provider != "mock" || cfg.Model != "flag-model" || cfg.Endpoint != "https://flag.test/v1" {
		t.Fatalf("flags did not override env: %+v", cfg)
	}
	if !cfg.NoCache || !cfg.PrintOnly {
		t.Fatalf("bool flags not parsed: %+v", cfg)
	}
}

func TestParseMissingAPIKeyReturnsHelpfulError(t *testing.T) {
	_, err := Parse([]string{"whoami"}, func(string) string { return "" }, "/tmp/home")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "NANOGPT_API_KEY") {
		t.Fatalf("error = %q, want NANOGPT_API_KEY hint", err)
	}
}

func TestParseHistoryCommandDoesNotRequireAPIKey(t *testing.T) {
	cfg, err := Parse([]string{"history", "--delete", "abc123"}, func(string) string { return "" }, "/tmp/home")
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if cfg.Command != CommandHistory {
		t.Fatalf("Command = %v, want history", cfg.Command)
	}
	if cfg.HistoryDelete != "abc123" {
		t.Fatalf("HistoryDelete = %q", cfg.HistoryDelete)
	}
}
