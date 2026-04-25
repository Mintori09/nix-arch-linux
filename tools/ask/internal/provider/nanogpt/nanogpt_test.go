package nanogpt

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"

	"github.com/mintori/home-manager/tools/ask/internal/provider"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type timeoutError struct{}

func (timeoutError) Error() string   { return "timeout" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

var _ net.Error = timeoutError{}

func TestGenerateCommandParsesResponse(t *testing.T) {
	var captured requestBody
	client := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
				t.Fatalf("Decode() error = %v", err)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(`{"choices":[{"message":{"content":"ls -la\n"}}]}`)),
			}, nil
		}),
	}
	gen := New(client)

	cmd, err := gen.GenerateCommand(context.Background(), "list files", provider.Options{
		Model:    "test-model",
		Endpoint: "https://example.test/v1",
		APIKey:   "secret",
		Timeout:  1,
	})
	if err != nil {
		t.Fatalf("GenerateCommand() error = %v", err)
	}
	if cmd != "ls -la" {
		t.Fatalf("command = %q", cmd)
	}
	if len(captured.Messages) != 2 {
		t.Fatalf("messages = %+v", captured.Messages)
	}
	if !strings.Contains(captured.Messages[0].Content, "shell expert") {
		t.Fatalf("system prompt = %q", captured.Messages[0].Content)
	}
	if !strings.Contains(captured.Messages[0].Content, "no markdown") {
		t.Fatalf("system prompt = %q", captured.Messages[0].Content)
	}
	if !strings.Contains(captured.Messages[1].Content, "User request:") {
		t.Fatalf("user prompt = %q", captured.Messages[1].Content)
	}
}

func TestGenerateCommandPreservesMultilineScript(t *testing.T) {
	gen := New(&http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader("{\"choices\":[{\"message\":{\"content\":\"echo one\\nprintf '%s\\\\n' two\\n\"}}]}")),
			}, nil
		}),
	})

	cmd, err := gen.GenerateCommand(context.Background(), "print two lines", provider.Options{
		Model:    "test-model",
		Endpoint: "https://example.test/v1",
		APIKey:   "secret",
		Timeout:  1,
	})
	if err != nil {
		t.Fatalf("GenerateCommand() error = %v", err)
	}
	if cmd != "echo one\nprintf '%s\\n' two" {
		t.Fatalf("command = %q", cmd)
	}
}

func TestGenerateCommandReturnsHTTPError(t *testing.T) {
	gen := New(&http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusBadGateway,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader("bad upstream\n")),
			}, nil
		}),
	})
	_, err := gen.GenerateCommand(context.Background(), "list files", provider.Options{
		Model:    "test-model",
		Endpoint: "https://example.test/v1",
		APIKey:   "secret",
		Timeout:  1,
	})
	if err == nil || !strings.Contains(err.Error(), "502") {
		t.Fatalf("error = %v, want http status", err)
	}
}

func TestGenerateCommandReturnsTimeoutError(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return nil, timeoutError{}
		}),
	}
	gen := New(client)

	_, err := gen.GenerateCommand(context.Background(), "list files", provider.Options{
		Model:    "test-model",
		Endpoint: "https://example.test/v1",
		APIKey:   "secret",
		Timeout:  1,
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "timeout") {
		t.Fatalf("error = %v, want timeout", err)
	}
}

func TestGenerateCommandRejectsEmptyCommand(t *testing.T) {
	gen := New(&http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(`{"choices":[{"message":{"content":"   "}}]}`)),
			}, nil
		}),
	})
	_, err := gen.GenerateCommand(context.Background(), "list files", provider.Options{
		Model:    "test-model",
		Endpoint: "https://example.test/v1",
		APIKey:   "secret",
		Timeout:  1,
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "empty") {
		t.Fatalf("error = %v, want empty command error", err)
	}
}
