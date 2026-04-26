package app

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestWaitForServerReadyReturnsNilWhenServerResponds(t *testing.T) {
	t.Parallel()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	server := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	}
	defer server.Close()

	go func() {
		_ = server.Serve(listener)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	if err := waitForServerReady(ctx, "http://"+listener.Addr().String()+"/"); err != nil {
		t.Fatalf("waitForServerReady returned error: %v", err)
	}
}

func TestWaitForServerReadyTimesOutWhenServerNeverResponds(t *testing.T) {
	t.Parallel()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := listener.Addr().String()
	listener.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Millisecond)
	defer cancel()

	if err := waitForServerReady(ctx, "http://"+addr+"/"); err == nil {
		t.Fatal("expected timeout error")
	}
}
