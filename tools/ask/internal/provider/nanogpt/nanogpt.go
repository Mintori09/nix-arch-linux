package nanogpt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/mintori/home-manager/tools/ask/internal/provider"
)

type Client struct {
	httpClient *http.Client
}

func New(httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{httpClient: httpClient}
}

type requestBody struct {
	Model    string           `json:"model"`
	Messages []requestMessage `json:"messages"`
}

type requestMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseBody struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (c *Client) GenerateCommand(ctx context.Context, prompt string, options provider.Options) (string, error) {
	body, err := json.Marshal(requestBody{
		Model: options.Model,
		Messages: []requestMessage{
			{
				Role:    "system",
				Content: buildSystemPrompt(),
			},
			{
				Role:    "user",
				Content: buildUserPrompt(prompt),
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, options.Endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+options.APIKey)
	req.Header.Set("Content-Type", "application/json")

	httpClient := c.httpClient
	if options.Timeout > 0 {
		clone := *c.httpClient
		clone.Timeout = time.Duration(options.Timeout) * time.Second
		httpClient = &clone
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		if nerr, ok := err.(net.Error); ok && nerr.Timeout() {
			return "", fmt.Errorf("provider timeout: %w", err)
		}
		if strings.Contains(strings.ToLower(err.Error()), "timeout") {
			return "", fmt.Errorf("provider timeout: %w", err)
		}
		return "", fmt.Errorf("provider request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("provider returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(payload)))
	}

	var decoded responseBody
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return "", fmt.Errorf("decode provider response: %w", err)
	}
	if len(decoded.Choices) == 0 {
		return "", fmt.Errorf("provider returned empty command")
	}

	command := strings.TrimSpace(strings.Trim(decoded.Choices[0].Message.Content, "`"))
	if command == "" {
		return "", fmt.Errorf("provider returned empty command")
	}

	return command, nil
}

func buildSystemPrompt() string {
	return strings.Join([]string{
		"You are a shell expert.",
		"Return only a runnable shell command or shell script snippet.",
		"no markdown.",
		"no prose.",
		"no explanations.",
		"Prefer common tools over personal aliases.",
		"Keep it minimal and directly executable.",
	}, " ")
}

func buildUserPrompt(prompt string) string {
	return fmt.Sprintf("User request:\n%s\n\nReturn only the runnable shell output.", prompt)
}
