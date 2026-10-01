import { isSoundMode, type SoundMode } from './audio.ts';
import { isSceneId, type SceneId } from './scenes/types.ts';
import {
  clampFocusSeconds,
  isCategoryId,
  type CategoryId,
  type Clock,
  type PhaseKind,
  type Plan,
} from './timer.ts';

const KEY = 'timer.session.v1';

export interface PersistedSession {
  categoryId: CategoryId;
  focusSeconds: number;
  sceneId: SceneId;
  sound: SoundMode;
  clock: Clock;
  phase: PhaseKind;
  focusBlocksCompleted: number;
}

function isPhase(value: unknown): value is PhaseKind {
  return value === 'focus' || value === 'short-break' || value === 'long-break';
}

function isClock(value: unknown): value is Clock {
  if (!value || typeof value !== 'object') return false;
  const clock = value as Clock;
  const statusOk = clock.status === 'idle' || clock.status === 'running' || clock.status === 'paused' || clock.status === 'done';
  return statusOk
    && Number.isFinite(clock.durationMs)
    && clock.durationMs > 0
    && Number.isFinite(clock.remainingMs)
    && (clock.endsAt === null || Number.isFinite(clock.endsAt));
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (!isCategoryId(parsed.categoryId) || !isSceneId(parsed.sceneId) || !isSoundMode(parsed.sound)) return null;
    if (!isPhase(parsed.phase) || !isClock(parsed.clock)) return null;
    if (!Number.isFinite(parsed.focusBlocksCompleted) || (parsed.focusBlocksCompleted ?? -1) < 0) return null;
    const clock = parsed.clock;
    const safeClock: Clock = clock.status === 'running' && clock.endsAt == null
      ? { ...clock, status: 'paused' }
      : clock;
    return {
      categoryId: parsed.categoryId,
      focusSeconds: clampFocusSeconds(parsed.focusSeconds ?? 25 * 60),
      sceneId: parsed.sceneId,
      sound: parsed.sound,
      clock: safeClock,
      phase: parsed.phase,
      focusBlocksCompleted: Math.floor(parsed.focusBlocksCompleted ?? 0),
    };
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode can refuse storage. The timer still runs.
  }
}

export function sessionFrom(plan: Plan, sceneId: SceneId, sound: SoundMode, clock: Clock): PersistedSession {
  return {
    categoryId: plan.categoryId,
    focusSeconds: plan.focusSeconds,
    sceneId,
    sound,
    clock,
    phase: plan.phase,
    focusBlocksCompleted: plan.focusBlocksCompleted,
  };
}
