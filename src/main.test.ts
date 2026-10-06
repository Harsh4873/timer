import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
import { categoryById, createPlan, idleClock, nextPhase, phaseDurationSeconds, phaseLabel, startClock, tickClock, type CategoryId } from './timer.ts';

const source = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
const lifecycle = parsed.statements
  .filter((statement) => ts.isFunctionDeclaration(statement) && ['tick', 'finishPhase', 'syncWakeLock'].includes(statement.name?.text ?? ''))
  .map((statement) => statement.getText(parsed))
  .join('\n');
const compiled = ts.transpileModule(lifecycle, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function completion(category: CategoryId, screensaver = false) {
  let releases = 0;
  const lock = { release: async () => { releases += 1; }, addEventListener: () => {} };
  const plan = createPlan(category);
  const context = createContext({
    plan,
    clock: startClock(idleClock(10_000), 0),
    wakeLock: null,
    lastSave: 0,
    navigator: { wakeLock: { request: async () => lock } },
    document: { body: { classList: { contains: () => screensaver } } },
    categoryById, nextPhase, phaseDurationSeconds, phaseLabel, startClock, idleClock, tickClock,
    sound: { chime: () => {} },
    say: () => {}, notify: () => {}, render: () => {}, save: () => {},
  });
  runInContext(compiled, context);
  return { context, releases: () => releases };
}

test('one-shot completion releases the screen wake lock without another user action', async () => {
  const session = completion('deep-work');
  await runInContext('syncWakeLock()', session.context);
  runInContext('tick(10_000)', session.context);
  await setImmediate();
  assert.equal(session.context.clock.status, 'done');
  assert.equal(session.releases(), 1);
  assert.equal(session.context.wakeLock, null);
  runInContext('tick(20_000)', session.context);
  assert.equal(session.releases(), 1);
});

test('completion keeps the lock for an automatically started Pomodoro break', async () => {
  const session = completion('pomodoro');
  await runInContext('syncWakeLock()', session.context);
  runInContext('tick(10_000)', session.context);
  assert.equal(session.context.clock.status, 'running');
  assert.equal(session.context.plan.phase, 'short-break');
  assert.equal(session.releases(), 0);
});

test('explicit screensaver mode keeps the lock after a one-shot session', async () => {
  const session = completion('deep-work', true);
  await runInContext('syncWakeLock()', session.context);
  runInContext('tick(10_000)', session.context);
  assert.equal(session.context.clock.status, 'done');
  assert.equal(session.releases(), 0);
});
