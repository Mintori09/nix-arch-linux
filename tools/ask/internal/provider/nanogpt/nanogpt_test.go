package nanogpt

import (
	"context"
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
	client := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
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
