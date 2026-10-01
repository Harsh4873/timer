import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clockProgress,
  createPlan,
  focusPips,
  formatClock,
  idleClock,
  nextPhase,
  pauseClock,
  phaseDurationSeconds,
  phaseLabel,
  startClock,
  tickClock,
} from './timer.ts';

test('formatClock counts down in whole seconds', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(1), '0:01');
  assert.equal(formatClock(1000), '0:01');
  assert.equal(formatClock(1001), '0:02');
  assert.equal(formatClock(25 * 60 * 1000), '25:00');
  assert.equal(formatClock(50 * 60 * 1000), '50:00');
  assert.equal(formatClock(90 * 60 * 1000), '90:00');
  assert.equal(formatClock(Number.NaN), '0:00');
});

test('the clock follows wall time across pause and resume', () => {
  const started = startClock(idleClock(25 * 60 * 1000), 1_000);
  const mid = tickClock(started, 11_000);
  assert.equal(mid.status, 'running');
  assert.equal(mid.remainingMs, 25 * 60 * 1000 - 10_000);

  const paused = pauseClock(mid, 11_000);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.endsAt, null);
  assert.equal(tickClock(paused, 80_000).remainingMs, paused.remainingMs);

  const resumed = startClock(paused, 90_000);
  assert.equal(resumed.endsAt, 90_000 + paused.remainingMs);
  const done = tickClock(resumed, resumed.endsAt! + 20);
  assert.equal(done.status, 'done');
  assert.equal(done.remainingMs, 0);
  assert.equal(formatClock(done.remainingMs), '0:00');
});

test('starting again after done uses the full duration', () => {
  const done = tickClock(startClock(idleClock(10_000), 0), 10_000);
  const again = startClock(done, 12_000);
  assert.equal(again.remainingMs, 10_000);
  assert.equal(again.endsAt, 22_000);
});

test('pomodoro takes a long break after four focus blocks', () => {
  let plan = createPlan('pomodoro', 25 * 60);
  const seen = [plan.phase];
  for (let step = 0; step < 8; step += 1) {
    plan = nextPhase(plan);
    seen.push(plan.phase);
  }
  assert.deepEqual(seen, [
    'focus',
    'short-break',
    'focus',
    'short-break',
    'focus',
    'short-break',
    'focus',
    'long-break',
    'focus',
  ]);
  assert.equal(phaseDurationSeconds({ ...createPlan('pomodoro', 50 * 60), phase: 'focus' }), 50 * 60);
  assert.equal(phaseDurationSeconds({ ...createPlan('pomodoro'), phase: 'short-break' }), 5 * 60);
  assert.equal(phaseDurationSeconds({ ...createPlan('pomodoro'), phase: 'long-break' }), 15 * 60);
});

test('pips fill through a set and clear after the long break', () => {
  let plan = createPlan('pomodoro');
  assert.deepEqual(focusPips(plan), { filled: 0, total: 4 });
  plan = nextPhase(plan);
  assert.equal(plan.phase, 'short-break');
  assert.deepEqual(focusPips(plan), { filled: 1, total: 4 });
  while (plan.phase !== 'long-break') plan = nextPhase(plan);
  assert.equal(plan.focusBlocksCompleted, 4);
  assert.deepEqual(focusPips(plan), { filled: 4, total: 4 });
  plan = nextPhase(plan);
  assert.equal(plan.phase, 'focus');
  assert.deepEqual(focusPips(plan), { filled: 0, total: 4 });
  assert.equal(focusPips(createPlan('meditation')), null);
  assert.equal(phaseLabel(createPlan('deep-work')), 'Deep work');
  assert.equal(phaseLabel({ ...createPlan('pomodoro'), phase: 'short-break' }), 'Short break');
});

test('progress drains as time passes', () => {
  const clock = startClock(idleClock(10_000), 0);
  assert.equal(clockProgress(clock, 0), 0);
  assert.equal(clockProgress(clock, 2_500), 0.25);
  assert.equal(clockProgress(tickClock(clock, 10_000), 10_000), 1);
});
