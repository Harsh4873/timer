import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSession, saveSession, sessionFrom, sessionSignature } from './store.ts';
import { createPlan, idleClock, phaseDurationSeconds } from './timer.ts';

const memory = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  },
};

function sample(open: boolean) {
  const plan = createPlan('pomodoro');
  return sessionFrom(plan, 'rain', 'ambient', idleClock(phaseDurationSeconds(plan) * 1000), open);
}

test('the setup panel visibility round-trips through storage', () => {
  memory.clear();
  saveSession(sample(false));
  const closed = loadSession();
  assert.ok(closed);
  assert.equal(closed.settingsOpen, false);
  assert.equal(closed.sceneId, 'rain');

  saveSession(sample(true));
  assert.equal(loadSession()?.settingsOpen, true);
});

test('sessions saved before the toggle existed open the panel', () => {
  memory.clear();
  const legacy = sample(true) as unknown as Record<string, unknown>;
  delete legacy.settingsOpen;
  memory.set('timer.session.v1', JSON.stringify(legacy));
  assert.equal(loadSession()?.settingsOpen, true);
});

test('a save stamp round-trips and older sessions count as the first write', () => {
  memory.clear();
  const stamped = { ...sample(true), savedAt: 1234 };
  saveSession(stamped);
  assert.equal(loadSession()?.savedAt, 1234);
  const legacy = sample(true) as unknown as Record<string, unknown>;
  delete legacy.savedAt;
  memory.set('timer.session.v1', JSON.stringify(legacy));
  assert.equal(loadSession()?.savedAt, 0);
});

test('a running session ignores the ticking remainder when deciding to write', () => {
  const plan = createPlan('pomodoro');
  const durationMs = phaseDurationSeconds(plan) * 1000;
  const base = sessionFrom(plan, 'rain', 'chime', {
    status: 'running',
    durationMs,
    remainingMs: durationMs,
    endsAt: 5_000,
  }, true);
  const later = sessionSignature({ ...base, clock: { ...base.clock, remainingMs: 1_000 } });
  assert.equal(later, sessionSignature(base));
  const paused = sessionSignature({
    ...base,
    clock: { status: 'paused', durationMs, remainingMs: 4_000, endsAt: null },
  });
  const pausedLess = sessionSignature({
    ...base,
    clock: { status: 'paused', durationMs, remainingMs: 3_000, endsAt: null },
  });
  assert.notEqual(paused, pausedLess);
  assert.notEqual(paused, sessionSignature(base));
});

test('invalid sessions are still rejected', () => {
  memory.clear();
  const bad = { ...sample(true), sound: 'loud' };
  memory.set('timer.session.v1', JSON.stringify(bad));
  assert.equal(loadSession(), null);
});
