package config

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"
)

type Command string

const (
	CommandGenerate Command = "generate"
	CommandHistory  Command = "history"
)

const (
	defaultProvider = "nanogpt"
	defaultModel    = "zai-org/glm-5"
	defaultEndpoint = "https://nano-gpt.com/api/v1/chat/completions"
)

type Config struct {
	Command        Command
	Prompt         string
	Provider       string
	Model          string
	Endpoint       string
	APIKey         string
	NoCache        bool
	PrintOnly      bool
	TimeoutSeconds int
	HistoryPath    string
	HistoryDelete  string
}

func Parse(args []string, getenv func(string) string, homeDir string) (Config, error) {
	cfg := Config{
		Command:        CommandGenerate,
		Provider:       firstNonEmpty(getenv("ASK_PROVIDER"), defaultProvider),
		Model:          firstNonEmpty(getenv("ASK_MODEL"), defaultModel),
		Endpoint:       firstNonEmpty(getenv("ASK_ENDPOINT"), defaultEndpoint),
		APIKey:         getenv("NANOGPT_API_KEY"),
		TimeoutSeconds: 30,
		HistoryPath:    filepath.Join(homeDir, ".local", "state", "ask", "history.json"),
	}

	if len(args) > 0 && args[0] == string(CommandHistory) {
		cfg.Command = CommandHistory
		fs := flag.NewFlagSet("history", flag.ContinueOnError)
		fs.StringVar(&cfg.HistoryDelete, "delete", "", "delete history entry by id")
		if err := fs.Parse(args[1:]); err != nil {
			return Config{}, err
		}
		return cfg, nil
	}

	fs := flag.NewFlagSet("ask", flag.ContinueOnError)
	fs.StringVar(&cfg.Provider, "provider", cfg.Provider, "provider")
	fs.StringVar(&cfg.Model, "model", cfg.Model, "model")
	fs.StringVar(&cfg.Endpoint, "endpoint", cfg.Endpoint, "endpoint")
	fs.IntVar(&cfg.TimeoutSeconds, "timeout", cfg.TimeoutSeconds, "timeout in seconds")
	fs.BoolVar(&cfg.NoCache, "no-cache", false, "skip history save")
	fs.BoolVar(&cfg.PrintOnly, "print-only", false, "print command only")
	if err := fs.Parse(args); err != nil {
		return Config{}, err
	}

	cfg.Prompt = strings.TrimSpace(strings.Join(fs.Args(), " "))
	if cfg.Prompt == "" {
		return Config{}, errors.New("prompt is required")
	}
	if cfg.APIKey == "" {
		return Config{}, fmt.Errorf("missing NANOGPT_API_KEY")
	}

	return cfg, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
