import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catchUp,
  clockProgress,
  createPlan,
  focusPips,
  formatClock,
  formatFocusMinutes,
  idleClock,
  nextPhase,
  applyFocusLength,
  pauseClock,
  pauseOrAdvance,
  phaseDurationSeconds,
  phaseLabel,
  progressLabel,
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

test('pomodoro progress names the next break', () => {
  let plan = createPlan('pomodoro');
  assert.equal(progressLabel(plan), '0 of 4 · 5 minute break next');
  plan = nextPhase(plan);
  assert.equal(progressLabel(plan), '1 of 4 · 5 minute break');
  plan = { ...createPlan('pomodoro'), phase: 'focus', focusBlocksCompleted: 3 };
  assert.equal(progressLabel(plan), '3 of 4 · 15 minute break next');
  plan = { ...plan, phase: 'long-break', focusBlocksCompleted: 4 };
  assert.equal(progressLabel(plan), '4 of 4 · 15 minute break');
  assert.equal(progressLabel(createPlan('reading')), null);
});

test('custom minutes follow the clamped length', () => {
  assert.equal(formatFocusMinutes(90), '1.5');
  assert.equal(formatFocusMinutes(25 * 60), '25');
  assert.equal(formatFocusMinutes(999 * 60), '180');
  assert.equal(formatFocusMinutes(30), '1');
});

test('the next phase starts at the previous end, not at a late tick', () => {
  const plan = createPlan('pomodoro', 25 * 60);
  const clock = startClock(idleClock(25 * 60 * 1000), 0);
  const caught = catchUp(plan, clock, 25 * 60 * 1000 + 500);
  assert.equal(caught.plan.phase, 'short-break');
  assert.equal(caught.clock.status, 'running');
  assert.equal(caught.clock.endsAt, 25 * 60 * 1000 + 5 * 60 * 1000);
  assert.equal(caught.clock.remainingMs, 5 * 60 * 1000 - 500);
  assert.deepEqual(caught.finishedLabels, ['Focus']);
});

test('overdue pomodoro phases keep running from the original end', () => {
  const now = 5_000_000;
  const endsAt = now - 90 * 60 * 1000;
  const plan = { ...createPlan('pomodoro', 25 * 60), phase: 'focus' as const, focusBlocksCompleted: 3 };
  const clock = { status: 'running' as const, durationMs: 25 * 60 * 1000, remainingMs: 0, endsAt };
  const caught = catchUp(plan, clock, now);
  assert.equal(caught.plan.phase, 'focus');
  assert.equal(caught.plan.focusBlocksCompleted, 6);
  assert.equal(caught.clock.status, 'running');
  assert.equal(caught.clock.endsAt, endsAt + (15 + 25 + 5 + 25 + 5 + 25) * 60 * 1000);
  assert.equal(caught.clock.remainingMs, 10 * 60 * 1000);
  assert.equal(caught.finishedLabels.length, 6);
});

test('catch-up keeps a phase that has not ended', () => {
  const plan = createPlan('reading');
  const clock = startClock(idleClock(60_000), 0);
  const caught = catchUp(plan, clock, 15_000);
  assert.equal(caught.clock.status, 'running');
  assert.equal(caught.clock.remainingMs, 45_000);
  assert.equal(caught.clock.endsAt, 60_000);
  assert.equal(caught.finishedLabels.length, 0);
});

test('a one-shot block stays done when the tick is late', () => {
  const plan = createPlan('deep-work');
  const clock = startClock(idleClock(10_000), 1_000);
  const caught = catchUp(plan, clock, 50_000);
  assert.equal(caught.clock.status, 'done');
  assert.equal(caught.plan.phase, 'focus');
  assert.deepEqual(caught.finishedLabels, ['Deep work']);
});

test('catch-up leaves a paused clock alone', () => {
  const plan = createPlan('pomodoro');
  const clock = pauseClock(startClock(idleClock(10_000), 0), 4_000);
  const caught = catchUp(plan, clock, 90_000);
  assert.equal(caught.clock.status, 'paused');
  assert.equal(caught.clock.remainingMs, clock.remainingMs);
  assert.equal(caught.finishedLabels.length, 0);
});

test('pausing at the end of focus starts the break instead of finishing', () => {
  const plan = createPlan('pomodoro', 25 * 60);
  const clock = startClock(idleClock(25 * 60 * 1000), 0);
  const outcome = pauseOrAdvance(plan, clock, 25 * 60 * 1000);
  assert.equal(outcome.plan.phase, 'short-break');
  assert.equal(outcome.clock.status, 'running');
  assert.equal(outcome.clock.endsAt, 25 * 60 * 1000 + 5 * 60 * 1000);
  assert.deepEqual(outcome.finishedLabels, ['Focus']);
});

test('pausing in the middle keeps the time left', () => {
  const plan = createPlan('pomodoro', 25 * 60);
  const clock = startClock(idleClock(25 * 60 * 1000), 0);
  const outcome = pauseOrAdvance(plan, clock, 10_000);
  assert.equal(outcome.plan.phase, 'focus');
  assert.equal(outcome.clock.status, 'paused');
  assert.equal(outcome.clock.remainingMs, 25 * 60 * 1000 - 10_000);
  assert.equal(outcome.finishedLabels.length, 0);
});

test('pausing at the end of a one-shot block finishes it', () => {
  const plan = createPlan('deep-work', 60);
  const clock = startClock(idleClock(60_000), 0);
  const outcome = pauseOrAdvance(plan, clock, 60_000);
  assert.equal(outcome.clock.status, 'done');
  assert.equal(outcome.plan.phase, 'focus');
  assert.deepEqual(outcome.finishedLabels, ['Deep work']);
});

test('a paused focus block takes a new length in full', () => {
  const plan = createPlan('pomodoro', 25 * 60);
  const clock = pauseClock(startClock(idleClock(25 * 60 * 1000), 0), 15 * 60 * 1000);
  assert.equal(clock.remainingMs, 10 * 60 * 1000);

  const longer = applyFocusLength(plan, clock, 50 * 60);
  assert.equal(longer.plan.focusSeconds, 50 * 60);
  assert.equal(longer.clock.status, 'paused');
  assert.equal(longer.clock.durationMs, 50 * 60 * 1000);
  assert.equal(longer.clock.remainingMs, 50 * 60 * 1000);

  const shorter = applyFocusLength(plan, clock, 5 * 60);
  assert.equal(shorter.clock.remainingMs, 5 * 60 * 1000);
  assert.equal(shorter.clock.durationMs, 5 * 60 * 1000);

  const same = applyFocusLength(plan, clock, 25 * 60);
  assert.equal(same.clock.remainingMs, clock.remainingMs);
  assert.equal(same.clock.durationMs, clock.durationMs);
});

test('minutes during a break change the next focus and leave the break', () => {
  const plan = { ...createPlan('pomodoro', 25 * 60), phase: 'short-break' as const, focusBlocksCompleted: 1 };
  const clock = pauseClock(startClock(idleClock(5 * 60 * 1000), 0), 60_000);
  const next = applyFocusLength(plan, clock, 50 * 60);
  assert.equal(next.plan.phase, 'short-break');
  assert.equal(next.plan.focusSeconds, 50 * 60);
  assert.equal(next.clock.remainingMs, clock.remainingMs);
  assert.equal(next.clock.durationMs, clock.durationMs);
  assert.equal(next.clock.status, 'paused');
});

test('an idle clock shows the full chosen length', () => {
  const plan = createPlan('reading', 25 * 60);
  const clock = idleClock(25 * 60 * 1000);
  const next = applyFocusLength(plan, clock, 15 * 60);
  assert.equal(next.clock.status, 'idle');
  assert.equal(next.clock.remainingMs, 15 * 60 * 1000);
  const running = startClock(clock, 0);
  const ignored = applyFocusLength(plan, running, 50 * 60);
  assert.equal(ignored.plan.focusSeconds, plan.focusSeconds);
  assert.equal(ignored.clock, running);
});

test('progress drains as time passes', () => {
  const clock = startClock(idleClock(10_000), 0);
  assert.equal(clockProgress(clock, 0), 0);
  assert.equal(clockProgress(clock, 2_500), 0.25);
  assert.equal(clockProgress(tickClock(clock, 10_000), 10_000), 1);
});
