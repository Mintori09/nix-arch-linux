import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionPresence } from './session-presence.js';

function createEmitter(initialVisibility = 'visible') {
  const listeners = new Map();
  return {
    visibilityState: initialVisibility,
    addEventListener(type, listener) {
      const bucket = listeners.get(type) || [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    removeEventListener(type, listener) {
      const bucket = listeners.get(type) || [];
      listeners.set(type, bucket.filter((item) => item !== listener));
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) {
        listener(event);
      }
    },
  };
}

test('initial announce happens once even if started twice', async () => {
  const fetchCalls = [];
  const documentImpl = createEmitter();
  const windowImpl = createEmitter();
  const presence = createSessionPresence({
    clientId: 'client-1',
    token: 'secret',
    documentImpl,
    windowImpl,
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      return { ok: true };
    },
    navigatorImpl: {},
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  });

  await presence.start();
  await presence.start();

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, '/api/session/presence?token=secret');
  assert.equal(fetchCalls[0].options.method, 'POST');
  assert.equal(fetchCalls[0].options.body, JSON.stringify({
    client_id: 'client-1',
    state: 'active',
  }));
});

test('heartbeat scheduling sends active pings on the configured interval', async () => {
  const fetchCalls = [];
  const timers = [];
  const presence = createSessionPresence({
    clientId: 'client-1',
    documentImpl: createEmitter(),
    windowImpl: createEmitter(),
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      return { ok: true };
    },
    navigatorImpl: {},
    setIntervalImpl: (callback, delay) => {
      timers.push({ callback, delay });
      return 7;
    },
    clearIntervalImpl: () => {},
    heartbeatMs: 1234,
  });

  await presence.start();
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 1234);

  await timers[0].callback();
  assert.equal(fetchCalls.length, 2);
  assert.equal(JSON.parse(fetchCalls[1].options.body).state, 'active');
});

test('pagehide emits a closing payload through sendBeacon', async () => {
  const beacons = [];
  const documentImpl = createEmitter();
  const windowImpl = createEmitter();
  const presence = createSessionPresence({
    clientId: 'client-1',
    token: 'secret',
    documentImpl,
    windowImpl,
    fetchImpl: async () => ({ ok: true }),
    navigatorImpl: {
      sendBeacon(url, payload) {
        beacons.push({ url, payload });
        return true;
      },
    },
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  });

  await presence.start();
  windowImpl.dispatch('pagehide');

  assert.equal(beacons.length, 1);
  assert.equal(beacons[0].url, '/api/session/presence?token=secret');
  assert.equal(beacons[0].payload, JSON.stringify({
    client_id: 'client-1',
    state: 'closing',
  }));
});

test('beforeunload emits a closing payload through sendBeacon', async () => {
  const beacons = [];
  const documentImpl = createEmitter();
  const windowImpl = createEmitter();
  const presence = createSessionPresence({
    clientId: 'client-1',
    token: 'secret',
    documentImpl,
    windowImpl,
    fetchImpl: async () => ({ ok: true }),
    navigatorImpl: {
      sendBeacon(url, payload) {
        beacons.push({ url, payload });
        return true;
      },
    },
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  });

  await presence.start();
  windowImpl.dispatch('beforeunload');

  assert.equal(beacons.length, 1);
  assert.equal(beacons[0].url, '/api/session/presence?token=secret');
  assert.equal(beacons[0].payload, JSON.stringify({
    client_id: 'client-1',
    state: 'closing',
  }));
});

test('closing is only announced once across beforeunload and pagehide', async () => {
  const beacons = [];
  const documentImpl = createEmitter();
  const windowImpl = createEmitter();
  const presence = createSessionPresence({
    clientId: 'client-1',
    token: 'secret',
    documentImpl,
    windowImpl,
    fetchImpl: async () => ({ ok: true }),
    navigatorImpl: {
      sendBeacon(url, payload) {
        beacons.push({ url, payload });
        return true;
      },
    },
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  });

  await presence.start();
  windowImpl.dispatch('beforeunload');
  windowImpl.dispatch('pagehide');

  assert.equal(beacons.length, 1);
});

test('visibility return re-announces presence', async () => {
  const fetchCalls = [];
  const documentImpl = createEmitter('hidden');
  const presence = createSessionPresence({
    clientId: 'client-1',
    documentImpl,
    windowImpl: createEmitter(),
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      return { ok: true };
    },
    navigatorImpl: {},
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  });

  await presence.start();
  documentImpl.visibilityState = 'visible';
  documentImpl.dispatch('visibilitychange');

  assert.equal(fetchCalls.length, 2);
  assert.equal(JSON.parse(fetchCalls[1].options.body).state, 'active');
});

test('visibility hidden announces closing before unload', async () => {
  const beacons = [];
  const documentImpl = createEmitter('visible');
  const windowImpl = createEmitter();
  const presence = createSessionPresence({
    clientId: 'client-1',
    token: 'secret',
    documentImpl,
    windowImpl,
    fetchImpl: async () => ({ ok: true }),
    navigatorImpl: {
      sendBeacon(url, payload) {
        beacons.push({ url, payload });
        return true;
      },
    },
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  });

  await presence.start();
  documentImpl.visibilityState = 'hidden';
  documentImpl.dispatch('visibilitychange');

  assert.equal(beacons.length, 1);
  assert.equal(beacons[0].payload, JSON.stringify({
    client_id: 'client-1',
    state: 'closing',
  }));
});
