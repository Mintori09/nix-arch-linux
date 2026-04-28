package session

import (
	"testing"
	"time"
)

func TestPresenceMonitorDoesNotAutoShutdownBeforeAnyClientConnects(t *testing.T) {
	t.Parallel()

	monitor := NewPresenceMonitor(PresenceOptions{
		IdleGrace:     20 * time.Millisecond,
		StaleAfter:    time.Minute,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	select {
	case <-monitor.Done():
		t.Fatal("expected monitor to stay idle until a client connects")
	case <-time.After(40 * time.Millisecond):
	}
}

func TestPresenceMonitorFirstClientArmsTheMonitor(t *testing.T) {
	t.Parallel()

	monitor := NewPresenceMonitor(PresenceOptions{
		IdleGrace:     time.Second,
		StaleAfter:    time.Minute,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	monitor.Touch("client-1")

	monitor.mu.Lock()
	defer monitor.mu.Unlock()
	if !monitor.armed {
		t.Fatal("expected first client to arm the monitor")
	}
	if got := len(monitor.clients); got != 1 {
		t.Fatalf("expected 1 active client, got %d", got)
	}
}

func TestPresenceMonitorLastCloseStartsGraceAndThenShutsDown(t *testing.T) {
	t.Parallel()

	monitor := NewPresenceMonitor(PresenceOptions{
		IdleGrace:     25 * time.Millisecond,
		StaleAfter:    time.Minute,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	monitor.Touch("client-1")
	monitor.CloseClient("client-1")

	select {
	case <-monitor.Done():
	case <-time.After(200 * time.Millisecond):
		t.Fatal("expected shutdown after last client closed")
	}
}

func TestPresenceMonitorReconnectWithinGraceCancelsShutdown(t *testing.T) {
	t.Parallel()

	monitor := NewPresenceMonitor(PresenceOptions{
		IdleGrace:     60 * time.Millisecond,
		StaleAfter:    time.Minute,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	monitor.Touch("client-1")
	monitor.CloseClient("client-1")
	time.Sleep(20 * time.Millisecond)
	monitor.Touch("client-2")

	select {
	case <-monitor.Done():
		t.Fatal("expected reconnect to cancel pending shutdown")
	case <-time.After(90 * time.Millisecond):
	}
}

func TestPresenceMonitorPrunesStaleClientsThenStartsShutdownGrace(t *testing.T) {
	t.Parallel()

	monitor := NewPresenceMonitor(PresenceOptions{
		IdleGrace:     25 * time.Millisecond,
		StaleAfter:    40 * time.Millisecond,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	now := time.Now()
	monitor.touchAt("client-1", now)
	monitor.pruneAt(now.Add(50 * time.Millisecond))

	select {
	case <-monitor.Done():
	case <-time.After(200 * time.Millisecond):
		t.Fatal("expected shutdown after stale client expired and grace elapsed")
	}
}
