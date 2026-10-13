import { createSound, soundLabel } from './audio.ts';
import { SCENE_CHOICES, createScene } from './scenes/index.ts';
import type { Scene, SceneId } from './scenes/types.ts';
import { loadSession, saveSession, sessionFrom } from './store.ts';
import {
  CATEGORIES,
  DURATION_PRESETS,
  categoryById,
  catchUp,
  clockProgress,
  createPlan,
  focusPips,
  formatClock,
  formatFocusMinutes,
  idleClock,
  matchingPresetId,
  phaseDurationSeconds,
  phaseLabel,
  progressLabel,
  remainingMs,
  startClock,
  pauseClock,
  clampFocusSeconds,
  type CategoryId,
  type Clock,
  type Plan,
} from './timer.ts';
import './styles.css';

const RING = 2 * Math.PI * 46;
const LIGHT_SCENES = new Set<SceneId>(['flock', 'ocean', 'meadow', 'snow']);
const THEME: Record<SceneId, string> = {
  forest: '#10241c',
  flock: '#1c2430',
  rain: '#121820',
  ocean: '#0e2433',
  night: '#070b16',
  meadow: '#1c3324',
  embers: '#140c09',
  snow: '#1c2830',
};

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const phaseEl = document.querySelector<HTMLElement>('#phase');
const progressEl = document.querySelector<HTMLElement>('#progress');
const clockEl = document.querySelector<HTMLElement>('#clock');
const ringEl = document.querySelector<SVGCircleElement>('#ring-value');
const liveEl = document.querySelector<HTMLElement>('#live');
const toggleEl = document.querySelector<HTMLButtonElement>('#toggle');
const resetEl = document.querySelector<HTMLButtonElement>('#reset');
const soundEl = document.querySelector<HTMLButtonElement>('#sound');
const screenEl = document.querySelector<HTMLButtonElement>('#screen');
const settingsEl = document.querySelector<HTMLButtonElement>('#settings');
const dockEl = document.querySelector<HTMLElement>('#dock');
const themeMeta = document.querySelector<HTMLMetaElement>('#theme-color');

if (!canvas || !phaseEl || !progressEl || !clockEl || !ringEl || !liveEl || !toggleEl || !resetEl || !soundEl || !screenEl || !settingsEl || !dockEl) {
  throw new Error('Timer markup is missing');
}

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas is unavailable');

const sound = createSound();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let plan: Plan = createPlan('pomodoro');
let clock: Clock = idleClock(phaseDurationSeconds(plan) * 1000);
let sceneId: SceneId = 'forest';
let scene: Scene = createScene(sceneId);
let frameTime = 0;
let wakeLock: WakeLockSentinel | null = null;
const IDLE_MS = 4000;
let idleTimer = 0;
let announced = '';
let lastSave = 0;
let progressShown = '';
let wakeLockPending = false;

const categoryButtons = new Map<CategoryId, HTMLButtonElement>();
const durationButtons = new Map<string, HTMLButtonElement>();
const sceneButtons = new Map<SceneId, HTMLButtonElement>();
let minutesInput: HTMLInputElement | null = null;

function buildDock(): void {
  dockEl!.append(group('Category', buildCategories()), group('Minutes', buildMinutes()), group('Scene', buildScenes()));
}

function group(label: string, row: HTMLElement): HTMLElement {
  const section = document.createElement('section');
  section.className = 'group';
  const title = document.createElement('h2');
  title.textContent = label;
  section.append(title, row);
  return section;
}

function buildCategories(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'choices';
  for (const category of CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = category.label;
    button.title = category.detail;
    button.setAttribute('aria-description', category.detail);
    button.addEventListener('click', () => selectCategory(category.id));
    categoryButtons.set(category.id, button);
    row.append(button);
  }
  return row;
}

function buildMinutes(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'choices minutes';
  for (const preset of DURATION_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice minute';
    button.textContent = preset.label;
    button.setAttribute('aria-label', `${preset.label} minutes`);
    button.addEventListener('click', () => setFocusSeconds(preset.seconds));
    durationButtons.set(preset.id, button);
    row.append(button);
  }
  const label = document.createElement('label');
  label.className = 'custom';
  label.textContent = 'Custom';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = '180';
  input.step = 'any';
  input.inputMode = 'decimal';
  input.setAttribute('aria-label', 'Custom minutes');
  input.addEventListener('change', () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      render();
      return;
    }
    setFocusSeconds(value * 60);
  });
  label.append(input);
  minutesInput = input;
  row.append(label);
  return row;
}

function buildScenes(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'choices scenes';
  for (const choice of SCENE_CHOICES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice scene';
    button.title = choice.caption;
    button.setAttribute('aria-label', `${choice.label}. ${choice.caption}`);
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.background = `linear-gradient(160deg, ${choice.swatch[0]}, ${choice.swatch[1]})`;
    const name = document.createElement('span');
    name.className = 'scene-name';
    name.textContent = choice.label;
    button.append(swatch, name);
    button.addEventListener('click', () => switchScene(choice.id));
    sceneButtons.set(choice.id, button);
    row.append(button);
  }
  return row;
}

function selectCategory(id: CategoryId): void {
  if (clock.status === 'running') return;
  if (id === plan.categoryId) return;
  const category = categoryById(id);
  plan = createPlan(id, category.defaultSeconds);
  clock = idleClock(phaseDurationSeconds(plan) * 1000);
  switchScene(category.defaultScene);
  say(`${category.label} selected. ${formatFocusMinutes(category.defaultSeconds)} minutes.`);
  render();
  save();
}

function setFocusSeconds(seconds: number): void {
  if (clock.status === 'running') return;
  const next = clampFocusSeconds(seconds);
  plan = { ...plan, focusSeconds: next };
  if (plan.phase === 'focus') {
    if (clock.status === 'paused') {
      clock = {
        status: 'paused',
        durationMs: next * 1000,
        remainingMs: Math.min(clock.remainingMs, next * 1000),
        endsAt: null,
      };
    } else {
      clock = idleClock(next * 1000);
    }
  }
  render();
  save();
}

function switchScene(id: SceneId): void {
  if (id === sceneId) {
    render();
    return;
  }
  sceneId = id;
  scene = createScene(id);
  sound.setScene(id);
  resize();
  if (themeMeta) themeMeta.content = THEME[id];
  render();
  save();
}

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  canvas!.width = Math.floor(width * dpr);
  canvas!.height = Math.floor(height * dpr);
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  scene.resize(width, height);
}

function paintClock(now: number): void {
  const ms = remainingMs(clock, now);
  const digits = formatClock(ms);
  clockEl!.textContent = digits;
  if (document.activeElement !== clockEl) {
    const name = `${digits} remaining`;
    if (clockEl!.getAttribute('aria-label') !== name) clockEl!.setAttribute('aria-label', name);
  }
  ringEl!.style.strokeDasharray = `${RING} ${RING}`;
  ringEl!.style.strokeDashoffset = String(RING * clockProgress(clock, now));
  if (clock.status === 'running') document.title = `${formatClock(ms)} · ${phaseLabel(plan)}`;
  else if (clock.status === 'paused') document.title = `${formatClock(ms)} paused`;
  else if (clock.status === 'done') document.title = 'Done · Timer';
  else document.title = 'Timer';
}

function render(): void {
  const locked = clock.status === 'running';
  phaseEl!.textContent = clock.status === 'done' ? 'Done' : phaseLabel(plan);
  for (const [id, button] of categoryButtons) {
    button.setAttribute('aria-pressed', String(id === plan.categoryId));
    button.disabled = locked;
  }
  const preset = matchingPresetId(plan.focusSeconds);
  for (const [id, button] of durationButtons) {
    button.setAttribute('aria-pressed', String(id === preset));
    button.disabled = locked;
  }
  if (minutesInput) {
    minutesInput.value = formatFocusMinutes(plan.focusSeconds);
    minutesInput.disabled = locked;
  }
  for (const [id, button] of sceneButtons) {
    button.setAttribute('aria-pressed', String(id === sceneId));
  }
  toggleEl!.textContent = clock.status === 'running' ? 'Pause' : clock.status === 'paused' ? 'Resume' : clock.status === 'done' ? 'Again' : 'Start';
  const voice = sound.mode === 'ambient' ? sound.label() : '';
  soundEl!.textContent = soundLabel(sound.mode);
  soundEl!.setAttribute('aria-pressed', String(sound.mode !== 'off'));
  if (sound.mode === 'ambient') {
    soundEl!.setAttribute('aria-label', `Ambient room tone, ${voice}`);
    soundEl!.setAttribute('aria-description', `${voice} follows the scene`);
    soundEl!.title = `${voice} follows the scene`;
  } else if (sound.mode === 'chime') {
    soundEl!.setAttribute('aria-label', 'Chime');
    soundEl!.setAttribute('aria-description', 'Plays a chime when a block ends');
    soundEl!.title = 'Plays a chime when a block ends';
  } else {
    soundEl!.setAttribute('aria-label', 'Sound off');
    soundEl!.setAttribute('aria-description', 'No chime or room tone');
    soundEl!.title = 'No chime or room tone';
  }
  const screening = document.body.classList.contains('screen');
  const narrow = window.matchMedia('(max-width: 720px)').matches;
  screenEl!.textContent = screening ? (narrow ? 'Exit' : 'Exit screen') : (narrow ? 'Screen' : 'Screensaver');
  screenEl!.setAttribute('aria-pressed', String(screening));
  const settingsOpen = !document.body.classList.contains('settings-hidden');
  settingsEl!.setAttribute('aria-pressed', String(settingsOpen));
  settingsEl!.title = settingsOpen ? 'Hide the setup panel' : 'Show the setup panel';
  document.body.classList.toggle('scene-light', LIGHT_SCENES.has(sceneId));
  renderProgress();
  clockEl!.setAttribute('aria-describedby', progressEl!.hidden ? 'phase' : 'phase progress');
  paintClock(Date.now());
}

function renderProgress(): void {
  const label = progressLabel(plan) ?? '';
  const pips = focusPips(plan);
  if (!label || !pips) {
    progressShown = '';
    progressEl!.hidden = true;
    progressEl!.replaceChildren();
    return;
  }
  if (label === progressShown && !progressEl!.hidden) return;
  progressShown = label;
  progressEl!.hidden = false;
  const dots = document.createElement('span');
  dots.className = 'pips';
  dots.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < pips.total; index += 1) {
    const dot = document.createElement('span');
    dot.className = index < pips.filled ? 'pip on' : 'pip';
    dots.append(dot);
  }
  const text = document.createElement('span');
  text.textContent = label;
  progressEl!.replaceChildren(dots, text);
}

function spoken(message: string): string {
  const detail = progressLabel(plan);
  return detail ? `${message} ${detail}.` : message;
}

function say(message: string): void {
  if (message === announced) return;
  announced = message;
  liveEl!.textContent = message;
}

function notify(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // Some browsers reject notifications outside a direct gesture.
  }
}

function tick(now: number): void {
  if (clock.status !== 'running') return;
  const caught = catchUp(plan, clock, now);
  const finished = caught.finishedLabels.length > 0;
  plan = caught.plan;
  clock = caught.clock;
  if (finished) {
    sound.chime();
    const last = caught.finishedLabels[caught.finishedLabels.length - 1] ?? phaseLabel(plan);
    if (clock.status === 'running') {
      const next = phaseLabel(plan);
      const lead = caught.finishedLabels.length === 1 ? `${last} finished.` : `${caught.finishedLabels.length} blocks finished.`;
      say(spoken(`${lead} ${next} started.`));
      notify(`${last} finished`, `${next} started.`);
    } else {
      say(spoken(`${last} finished.`));
      notify(`${last} finished`, 'The block is done.');
    }
    void syncWakeLock();
  }
  render();
  if (finished || now - lastSave > 5000) {
    lastSave = now;
    save();
  }
}

async function toggleRun(): Promise<void> {
  const now = Date.now();
  const starting = clock.status !== 'running';
  clock = starting ? startClock(clock, now) : pauseClock(clock, now);
  say(clock.status === 'running' ? `${phaseLabel(plan)} started.` : 'Paused.');
  render();
  save();
  wake();
  if (starting && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      void Notification.requestPermission();
    } catch {
      // Permission can fail in embedded browsers.
    }
  }
  await sound.unlock();
  await syncWakeLock();
}

function reset(): void {
  plan = { ...plan, phase: 'focus', focusBlocksCompleted: 0 };
  clock = idleClock(phaseDurationSeconds(plan) * 1000);
  say('Reset.');
  render();
  save();
  wake();
  void syncWakeLock();
}

function save(): void {
  saveSession(sessionFrom(plan, sceneId, sound.mode, clock, !document.body.classList.contains('settings-hidden')));
}

function toggleSettings(): void {
  document.body.classList.toggle('settings-hidden');
  render();
  save();
}

async function syncWakeLock(): Promise<void> {
  const want = clock.status === 'running' || document.body.classList.contains('screen');
  if (!('wakeLock' in navigator)) return;
  if (!want) {
    const current = wakeLock;
    wakeLock = null;
    if (!current) return;
    try {
      await current.release();
    } catch {
      // Already released.
    }
    return;
  }
  if (document.hidden) return;
  if ((wakeLock && !wakeLock.released) || wakeLockPending) return;
  wakeLockPending = true;
  try {
    const sentinel = await navigator.wakeLock.request('screen');
    if (clock.status !== 'running' && !document.body.classList.contains('screen')) {
      wakeLock = null;
      try {
        await sentinel.release();
      } catch {
        // Already released.
      }
      return;
    }
    wakeLock = sentinel;
    sentinel.addEventListener('release', () => {
      if (wakeLock === sentinel) wakeLock = null;
      if (document.hidden) return;
      void syncWakeLock();
    });
  } catch {
    wakeLock = null;
  } finally {
    wakeLockPending = false;
  }
}

function hideChrome(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest('.top, .dock, .transport, .status')) {
    const digits = clockEl!.textContent ?? '';
    clockEl!.setAttribute('aria-label', `${digits} remaining`);
    clockEl!.focus({ preventScroll: true });
  }
  document.body.classList.add('chrome-hidden');
}

function armIdle(): void {
  window.clearTimeout(idleTimer);
  const screening = document.body.classList.contains('screen');
  if (reducedMotion.matches && !screening) return;
  if (clock.status !== 'running' && !screening) return;
  idleTimer = window.setTimeout(() => {
    if (reducedMotion.matches && !document.body.classList.contains('screen')) return;
    if (clock.status !== 'running' && !document.body.classList.contains('screen')) return;
    hideChrome();
  }, IDLE_MS);
}

function wake(): void {
  document.body.classList.remove('chrome-hidden');
  armIdle();
}

async function setScreensaver(on: boolean): Promise<void> {
  document.body.classList.toggle('screen', on);
  if (on) {
    // Hide the chrome at once. Mobile browsers often refuse fullscreen,
    // and waiting for the timeout made the button look dead.
    window.clearTimeout(idleTimer);
    hideChrome();
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be denied. The scene still fills the page.
    }
  } else {
    document.body.classList.remove('chrome-hidden');
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore.
      }
    }
  }
  render();
  armIdle();
  await syncWakeLock();
}

function restore(): void {
  const saved = loadSession();
  if (!saved) return;
  plan = {
    categoryId: saved.categoryId,
    focusSeconds: saved.focusSeconds,
    phase: saved.phase,
    focusBlocksCompleted: saved.focusBlocksCompleted,
  };
  sceneId = saved.sceneId;
  scene = createScene(sceneId);
  sound.setScene(saved.sceneId);
  sound.setMode(saved.sound);
  document.body.classList.toggle('settings-hidden', saved.settingsOpen === false);
  const caught = catchUp(plan, saved.clock, Date.now());
  plan = caught.plan;
  clock = caught.clock;
  if (caught.finishedLabels.length > 0) {
    if (clock.status === 'running') {
      const lead = caught.finishedLabels.length === 1
        ? `${phaseLabel(plan)} is underway.`
        : `${caught.finishedLabels.length} blocks passed. ${phaseLabel(plan)} is underway.`;
      say(spoken(lead));
    } else {
      say(spoken('The block finished while this was closed.'));
    }
    notify(phaseLabel(plan), 'A block finished while this was closed.');
    save();
  }
}

function frame(time: number): void {
  frameTime = time;
  if (!document.hidden) {
    scene.draw(ctx!, time, reducedMotion.matches);
    paintClock(Date.now());
  }
  window.requestAnimationFrame(frame);
}

buildDock();
restore();
resize();
if (themeMeta) themeMeta.content = THEME[sceneId];
render();
void syncWakeLock();
armIdle();

toggleEl.addEventListener('click', () => {
  void toggleRun();
});
resetEl.addEventListener('click', reset);
soundEl.addEventListener('click', () => {
  void sound.unlock().then(() => {
    sound.cycle();
    render();
    save();
  });
});
screenEl.addEventListener('click', () => {
  void setScreensaver(!document.body.classList.contains('screen'));
});
settingsEl.addEventListener('click', toggleSettings);

window.addEventListener('resize', resize);
window.addEventListener('pointermove', (event) => {
  scene.pointer({ x: event.clientX, y: event.clientY, inside: true });
  wake();
});
window.addEventListener('pointerdown', (event) => {
  const hidden = document.body.classList.contains('chrome-hidden');
  wake();
  const target = event.target instanceof Element ? event.target : null;
  const onControl = Boolean(target?.closest('button, input, a, .dock, .top'));
  if (hidden && !onControl) return;
  if (!onControl) scene.pulse(event.clientX, event.clientY, frameTime);
});
window.addEventListener('wheel', wake, { passive: true });
window.addEventListener('pointerleave', () => {
  scene.pointer({ x: 0, y: 0, inside: false });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    tick(Date.now());
    wake();
    wakeLock = null;
  }
  void syncWakeLock();
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('screen')) {
    document.body.classList.remove('screen', 'chrome-hidden');
    wake();
    render();
    void syncWakeLock();
  }
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && !document.body.classList.contains('screen')) {
    window.clearTimeout(idleTimer);
    document.body.classList.remove('chrome-hidden');
    return;
  }
  armIdle();
});

document.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  const typing = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'));
  if (typing) {
    wake();
    return;
  }
  if (event.key === 'Escape' && document.body.classList.contains('screen')) {
    event.preventDefault();
    void setScreensaver(false);
    return;
  }
  const hidden = document.body.classList.contains('chrome-hidden');
  const shortcut = event.key === ' ' || event.key === 'f' || event.key === 'F' || event.key === 'r' || event.key === 'R';
  if (hidden && shortcut) {
    if (event.key === ' ') event.preventDefault();
    wake();
    return;
  }
  wake();
  if (target && target.tagName === 'BUTTON') return;
  if (event.key === ' ') {
    event.preventDefault();
    void toggleRun();
  } else if (event.key === 'f' || event.key === 'F') {
    void setScreensaver(!document.body.classList.contains('screen'));
  } else if (event.key === 'r' || event.key === 'R') {
    reset();
  }
});

window.setInterval(() => {
  tick(Date.now());
}, 250);

window.requestAnimationFrame(frame);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
