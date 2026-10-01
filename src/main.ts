import { createSound } from './audio.ts';
import { SCENE_CHOICES, createScene } from './scenes/index.ts';
import type { Scene, SceneId } from './scenes/types.ts';
import { loadSession, saveSession, sessionFrom } from './store.ts';
import {
  CATEGORIES,
  DURATION_PRESETS,
  categoryById,
  clockProgress,
  createPlan,
  focusPips,
  formatClock,
  idleClock,
  matchingPresetId,
  nextPhase,
  phaseDurationSeconds,
  phaseLabel,
  remainingMs,
  startClock,
  pauseClock,
  tickClock,
  clampFocusSeconds,
  type CategoryId,
  type Clock,
  type Plan,
} from './timer.ts';
import './styles.css';

const RING = 2 * Math.PI * 46;
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
const clockEl = document.querySelector<HTMLElement>('#clock');
const ringEl = document.querySelector<SVGCircleElement>('#ring-value');
const pipsEl = document.querySelector<HTMLElement>('#pips');
const liveEl = document.querySelector<HTMLElement>('#live');
const toggleEl = document.querySelector<HTMLButtonElement>('#toggle');
const resetEl = document.querySelector<HTMLButtonElement>('#reset');
const soundEl = document.querySelector<HTMLButtonElement>('#sound');
const screenEl = document.querySelector<HTMLButtonElement>('#screen');
const dockEl = document.querySelector<HTMLElement>('#dock');
const themeMeta = document.querySelector<HTMLMetaElement>('#theme-color');

if (!canvas || !phaseEl || !clockEl || !ringEl || !pipsEl || !liveEl || !toggleEl || !resetEl || !soundEl || !screenEl || !dockEl) {
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
let chromeTimer = 0;
let announced = '';
let lastSave = 0;

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
  input.step = '1';
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', 'Custom minutes');
  input.addEventListener('change', () => {
    const value = Number(input.value);
    if (Number.isFinite(value)) setFocusSeconds(value * 60);
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
  const category = categoryById(id);
  plan = createPlan(id, category.defaultSeconds);
  clock = idleClock(phaseDurationSeconds(plan) * 1000);
  switchScene(category.defaultScene);
  say(phaseLabel(plan));
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
  clockEl!.textContent = formatClock(ms);
  ringEl!.style.strokeDasharray = `${RING} ${RING}`;
  ringEl!.style.strokeDashoffset = String(RING * clockProgress(clock, now));
  if (clock.status === 'running') document.title = `${formatClock(ms)} · ${phaseLabel(plan)}`;
  else if (clock.status === 'paused') document.title = `${formatClock(ms)} paused`;
  else if (clock.status === 'done') document.title = 'Done · Timer';
  else document.title = 'Timer';
}

function renderPips(): void {
  const pips = focusPips(plan);
  if (!pips) {
    pipsEl!.hidden = true;
    pipsEl!.replaceChildren();
    return;
  }
  pipsEl!.hidden = false;
  pipsEl!.replaceChildren();
  for (let index = 0; index < pips.total; index += 1) {
    const dot = document.createElement('span');
    dot.className = index < pips.filled ? 'pip on' : 'pip';
    pipsEl!.append(dot);
  }
  pipsEl!.setAttribute('aria-label', `${pips.filled} of ${pips.total} focus blocks done`);
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
  if (minutesInput && document.activeElement !== minutesInput) {
    minutesInput.value = String(Math.round(plan.focusSeconds / 60));
  }
  if (minutesInput) minutesInput.disabled = locked;
  for (const [id, button] of sceneButtons) {
    button.setAttribute('aria-pressed', String(id === sceneId));
  }
  toggleEl!.textContent = clock.status === 'running' ? 'Pause' : clock.status === 'paused' ? 'Resume' : clock.status === 'done' ? 'Again' : 'Start';
  soundEl!.textContent = sound.label();
  soundEl!.setAttribute('aria-pressed', String(sound.mode !== 'off'));
  const screening = document.body.classList.contains('screen');
  const narrow = window.matchMedia('(max-width: 720px)').matches;
  screenEl!.textContent = screening ? (narrow ? 'Exit' : 'Exit screen') : (narrow ? 'Screen' : 'Screensaver');
  screenEl!.setAttribute('aria-pressed', String(screening));
  renderPips();
  paintClock(Date.now());
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

function finishPhase(now: number): void {
  sound.chime();
  const finished = phaseLabel(plan);
  if (categoryById(plan.categoryId).cycle) {
    plan = nextPhase(plan);
    clock = startClock(idleClock(phaseDurationSeconds(plan) * 1000), now);
    const next = phaseLabel(plan);
    say(`${finished} finished. ${next} started.`);
    notify(`${finished} finished`, `${next} started.`);
  } else {
    say(`${finished} finished.`);
    notify(`${finished} finished`, 'The block is done.');
  }
}

function tick(now: number): void {
  if (clock.status !== 'running') return;
  const before = clock.status;
  clock = tickClock(clock, now);
  const finished = before === 'running' && clock.status === 'done';
  if (finished) finishPhase(now);
  render();
  if (finished || now - lastSave > 5000) {
    lastSave = now;
    save();
  }
}

async function toggleRun(): Promise<void> {
  await sound.unlock();
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // Permission can fail in embedded browsers.
    }
  }
  const now = Date.now();
  clock = clock.status === 'running' ? pauseClock(clock, now) : startClock(clock, now);
  say(clock.status === 'running' ? `${phaseLabel(plan)} started.` : 'Paused.');
  render();
  save();
  await syncWakeLock();
}

function reset(): void {
  plan = { ...plan, phase: 'focus', focusBlocksCompleted: 0 };
  clock = idleClock(phaseDurationSeconds(plan) * 1000);
  say('Reset.');
  render();
  save();
  void syncWakeLock();
}

function save(): void {
  saveSession(sessionFrom(plan, sceneId, sound.mode, clock));
}

async function syncWakeLock(): Promise<void> {
  const want = clock.status === 'running' || document.body.classList.contains('screen');
  if (!('wakeLock' in navigator)) return;
  if (want) {
    if (wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null;
    }
    return;
  }
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // Already released.
  }
  wakeLock = null;
}

function pokeChrome(): void {
  document.body.classList.remove('chrome-hidden');
  window.clearTimeout(chromeTimer);
  if (!document.body.classList.contains('screen')) return;
  chromeTimer = window.setTimeout(() => {
    document.body.classList.add('chrome-hidden');
  }, 3500);
}

async function setScreensaver(on: boolean): Promise<void> {
  document.body.classList.toggle('screen', on);
  if (on) {
    pokeChrome();
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
  sound.setMode(saved.sound);
  const now = Date.now();
  clock = tickClock(saved.clock, now);
  if (saved.clock.status === 'running' && clock.status === 'done') {
    if (categoryById(plan.categoryId).cycle) {
      plan = nextPhase(plan);
      clock = idleClock(phaseDurationSeconds(plan) * 1000);
      say(`${phaseLabel(plan)} is ready.`);
    } else {
      say('The block finished while this was closed.');
    }
    notify(phaseLabel(plan), 'A block finished while this was closed.');
  }
}

function frame(time: number): void {
  frameTime = time;
  if (!document.hidden) {
    scene.draw(ctx!, time, reducedMotion.matches);
    paintClock(Date.now());
    sound.tick(sceneId, time);
  }
  window.requestAnimationFrame(frame);
}

buildDock();
restore();
resize();
if (themeMeta) themeMeta.content = THEME[sceneId];
render();
void syncWakeLock();

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

window.addEventListener('resize', resize);
window.addEventListener('pointermove', (event) => {
  scene.pointer({ x: event.clientX, y: event.clientY, inside: true });
  if (document.body.classList.contains('screen')) pokeChrome();
});
window.addEventListener('pointerdown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const onControl = Boolean(target?.closest('button, input, a, .dock, .top'));
  if (document.body.classList.contains('screen') && document.body.classList.contains('chrome-hidden')) {
    pokeChrome();
    if (!onControl) return;
  }
  if (!onControl) scene.pulse(event.clientX, event.clientY, frameTime);
});
window.addEventListener('pointerleave', () => {
  scene.pointer({ x: 0, y: 0, inside: false });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tick(Date.now());
  void syncWakeLock();
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('screen')) {
    document.body.classList.remove('screen', 'chrome-hidden');
    render();
    void syncWakeLock();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('screen')) {
    event.preventDefault();
    void setScreensaver(false);
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) return;
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
