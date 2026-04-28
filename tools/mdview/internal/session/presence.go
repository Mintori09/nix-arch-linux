package session

import (
	"sync"
	"time"
)

const (
	defaultPresenceIdleGrace  = 10 * time.Second
	defaultPresenceStaleAfter = 2 * time.Minute
	defaultPresencePruneEvery = 30 * time.Second
)

type PresenceOptions struct {
	IdleGrace     time.Duration
	StaleAfter    time.Duration
	PruneInterval time.Duration
}

type PresenceMonitor struct {
	mu      sync.Mutex
	clients map[string]time.Time
	armed   bool

	idleGrace  time.Duration
	staleAfter time.Duration

	timer    *time.Timer
	done     chan struct{}
	stop     chan struct{}
	doneOnce sync.Once
	stopOnce sync.Once
}

func NewPresenceMonitor(opts PresenceOptions) *PresenceMonitor {
	idleGrace := opts.IdleGrace
	if idleGrace <= 0 {
		idleGrace = defaultPresenceIdleGrace
	}

	staleAfter := opts.StaleAfter
	if staleAfter <= 0 {
		staleAfter = defaultPresenceStaleAfter
	}

	pruneInterval := opts.PruneInterval
	if pruneInterval <= 0 {
		pruneInterval = defaultPresencePruneEvery
	}

	monitor := &PresenceMonitor{
		clients:    make(map[string]time.Time),
		idleGrace:  idleGrace,
		staleAfter: staleAfter,
		done:       make(chan struct{}),
		stop:       make(chan struct{}),
	}

	go monitor.runPruner(pruneInterval)
	return monitor
}

func (m *PresenceMonitor) Touch(clientID string) {
	m.touchAt(clientID, time.Now())
}

func (m *PresenceMonitor) CloseClient(clientID string) {
	m.closeClientAt(clientID, time.Now())
}

func (m *PresenceMonitor) Done() <-chan struct{} {
	return m.done
}

func (m *PresenceMonitor) Close() {
	m.stopOnce.Do(func() {
		close(m.stop)
	})

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.timer != nil {
		m.timer.Stop()
		m.timer = nil
	}
}

func (m *PresenceMonitor) ActiveClientCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.clients)
}

func (m *PresenceMonitor) runPruner(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.pruneAt(time.Now())
		case <-m.stop:
			return
		}
	}
}

func (m *PresenceMonitor) touchAt(clientID string, now time.Time) {
	if clientID == "" {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.armed = true
	m.clients[clientID] = now
	m.cancelTimerLocked()
}

func (m *PresenceMonitor) closeClientAt(clientID string, now time.Time) {
	if clientID == "" {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.clients, clientID)
	m.maybeStartShutdownTimerLocked(now)
}

func (m *PresenceMonitor) pruneAt(now time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for clientID, lastSeen := range m.clients {
		if now.Sub(lastSeen) >= m.staleAfter {
			delete(m.clients, clientID)
		}
	}
	m.maybeStartShutdownTimerLocked(now)
}

func (m *PresenceMonitor) maybeStartShutdownTimerLocked(_ time.Time) {
	if !m.armed || len(m.clients) > 0 {
		m.cancelTimerLocked()
		return
	}
	if m.timer != nil {
		return
	}

	m.timer = time.AfterFunc(m.idleGrace, func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		m.timer = nil
		if m.armed && len(m.clients) == 0 {
			m.doneOnce.Do(func() {
				close(m.done)
			})
		}
	})
}

func (m *PresenceMonitor) cancelTimerLocked() {
	if m.timer == nil {
		return
	}
	m.timer.Stop()
	m.timer = nil
}
