import type { SceneId } from './scenes/types.ts';

export const MIN_FOCUS_SECONDS = 60;
export const MAX_FOCUS_SECONDS = 180 * 60;

export interface DurationPreset {
  id: string;
  label: string;
  seconds: number;
}

export const DURATION_PRESETS: DurationPreset[] = [
  { id: '5', label: '5', seconds: 5 * 60 },
  { id: '10', label: '10', seconds: 10 * 60 },
  { id: '15', label: '15', seconds: 15 * 60 },
  { id: '25', label: '25', seconds: 25 * 60 },
  { id: '50', label: '50', seconds: 50 * 60 },
  { id: '90', label: '90', seconds: 90 * 60 },
];

export const CATEGORY_IDS = ['pomodoro', 'deep-work', 'meditation', 'reading', 'recovery'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Cycle {
  shortBreakSeconds: number;
  longBreakSeconds: number;
  focusBlocksBeforeLongBreak: number;
}

export interface Category {
  id: CategoryId;
  label: string;
  detail: string;
  defaultSeconds: number;
  defaultScene: SceneId;
  cycle: Cycle | null;
}

export const CATEGORIES: Category[] = [
  {
    id: 'pomodoro',
    label: 'Pomodoro',
    detail: 'Focus, short break, long break after four',
    defaultSeconds: 25 * 60,
    defaultScene: 'forest',
    cycle: { shortBreakSeconds: 5 * 60, longBreakSeconds: 15 * 60, focusBlocksBeforeLongBreak: 4 },
  },
  {
    id: 'deep-work',
    label: 'Deep work',
    detail: 'One long block',
    defaultSeconds: 50 * 60,
    defaultScene: 'embers',
    cycle: null,
  },
  {
    id: 'meditation',
    label: 'Meditation',
    detail: 'Sit and stay',
    defaultSeconds: 10 * 60,
    defaultScene: 'meadow',
    cycle: null,
  },
  {
    id: 'reading',
    label: 'Reading',
    detail: 'A quiet stretch of pages',
    defaultSeconds: 25 * 60,
    defaultScene: 'rain',
    cycle: null,
  },
  {
    id: 'recovery',
    label: 'Break',
    detail: 'Step away',
    defaultSeconds: 10 * 60,
    defaultScene: 'ocean',
    cycle: null,
  },
];

export type PhaseKind = 'focus' | 'short-break' | 'long-break';

export interface Plan {
  categoryId: CategoryId;
  focusSeconds: number;
  phase: PhaseKind;
  focusBlocksCompleted: number;
}

export type ClockStatus = 'idle' | 'running' | 'paused' | 'done';

export interface Clock {
  status: ClockStatus;
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function categoryById(id: CategoryId): Category {
  const category = CATEGORIES.find((item) => item.id === id);
  if (!category) throw new Error(`Unknown category ${id}`);
  return category;
}

export function clampFocusSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 25 * 60;
  return Math.round(Math.max(MIN_FOCUS_SECONDS, Math.min(MAX_FOCUS_SECONDS, seconds)));
}

export function createPlan(categoryId: CategoryId, focusSeconds?: number): Plan {
  const category = categoryById(categoryId);
  return {
    categoryId,
    focusSeconds: clampFocusSeconds(focusSeconds ?? category.defaultSeconds),
    phase: 'focus',
    focusBlocksCompleted: 0,
  };
}

export function phaseDurationSeconds(plan: Plan): number {
  const category = categoryById(plan.categoryId);
  if (!category.cycle || plan.phase === 'focus') return plan.focusSeconds;
  if (plan.phase === 'short-break') return category.cycle.shortBreakSeconds;
  return category.cycle.longBreakSeconds;
}

export function nextPhase(plan: Plan): Plan {
  const category = categoryById(plan.categoryId);
  if (!category.cycle) return { ...plan, phase: 'focus' };
  if (plan.phase !== 'focus') return { ...plan, phase: 'focus' };
  const focusBlocksCompleted = plan.focusBlocksCompleted + 1;
  const longBreak = focusBlocksCompleted % category.cycle.focusBlocksBeforeLongBreak === 0;
  return {
    ...plan,
    phase: longBreak ? 'long-break' : 'short-break',
    focusBlocksCompleted,
  };
}

export function phaseLabel(plan: Plan): string {
  const category = categoryById(plan.categoryId);
  if (category.cycle) {
    if (plan.phase === 'short-break') return 'Short break';
    if (plan.phase === 'long-break') return 'Long break';
    return 'Focus';
  }
  return category.label;
}

export function focusPips(plan: Plan): { filled: number; total: number } | null {
  const category = categoryById(plan.categoryId);
  if (!category.cycle) return null;
  const total = category.cycle.focusBlocksBeforeLongBreak;
  if (plan.phase === 'long-break') return { filled: total, total };
  return { filled: plan.focusBlocksCompleted % total, total };
}

export function matchingPresetId(seconds: number): string | null {
  return DURATION_PRESETS.find((preset) => preset.seconds === seconds)?.id ?? null;
}

export function idleClock(durationMs: number): Clock {
  return { status: 'idle', durationMs, remainingMs: durationMs, endsAt: null };
}

export function startClock(clock: Clock, now: number): Clock {
  if (clock.status === 'running') return clock;
  const remaining = clock.status === 'paused' && clock.remainingMs > 0 ? clock.remainingMs : clock.durationMs;
  return {
    status: 'running',
    durationMs: clock.durationMs,
    remainingMs: remaining,
    endsAt: now + remaining,
  };
}

export function pauseClock(clock: Clock, now: number): Clock {
  if (clock.status !== 'running' || clock.endsAt == null) return clock;
  const remaining = Math.max(0, clock.endsAt - now);
  if (remaining === 0) return { ...clock, status: 'done', remainingMs: 0, endsAt: null };
  return { ...clock, status: 'paused', remainingMs: remaining, endsAt: null };
}

export function tickClock(clock: Clock, now: number): Clock {
  if (clock.status !== 'running' || clock.endsAt == null) return clock;
  const remaining = Math.max(0, clock.endsAt - now);
  if (remaining === 0) return { ...clock, status: 'done', remainingMs: 0, endsAt: null };
  return { ...clock, remainingMs: remaining };
}

export function remainingMs(clock: Clock, now: number): number {
  if (clock.status === 'running' && clock.endsAt != null) return Math.max(0, clock.endsAt - now);
  return Math.max(0, clock.remainingMs);
}

export function formatClock(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const seconds = safe === 0 ? 0 : Math.ceil(safe / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export function clockProgress(clock: Clock, now: number): number {
  if (clock.durationMs <= 0) return 0;
  const ratio = 1 - remainingMs(clock, now) / clock.durationMs;
  return Math.max(0, Math.min(1, ratio));
}
