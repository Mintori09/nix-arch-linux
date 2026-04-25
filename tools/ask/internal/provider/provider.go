package provider

import "context"

type Options struct {
	Model    string
	Endpoint string
	APIKey   string
	Timeout  int
}

type Generator interface {
	GenerateCommand(ctx context.Context, prompt string, options Options) (string, error)
}
