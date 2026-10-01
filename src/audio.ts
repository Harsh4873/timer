export type SoundMode = 'off' | 'chime' | 'ambient';

const SOUND_MODES: SoundMode[] = ['off', 'chime', 'ambient'];

export function isSoundMode(value: unknown): value is SoundMode {
  return value === 'off' || value === 'chime' || value === 'ambient';
}

export function soundLabel(mode: SoundMode): string {
  if (mode === 'off') return 'Sound off';
  if (mode === 'chime') return 'Chime';
  return 'Ambient';
}

const NATURE = new Set(['forest', 'flock', 'meadow', 'ocean']);

export function createSound() {
  let mode: SoundMode = 'chime';
  let unlocked = false;
  let context: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let bed: AudioBufferSourceNode | null = null;
  let nextCue = 0;

  function audio(): AudioContext {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  function brownNoise(active: AudioContext): AudioBuffer {
    if (noiseBuffer && noiseBuffer.sampleRate === active.sampleRate) return noiseBuffer;
    const length = active.sampleRate * 2;
    const buffer = active.createBuffer(1, length, active.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[index] = last * 3.2;
    }
    noiseBuffer = buffer;
    return buffer;
  }

  function stopBed(): void {
    if (!bed) return;
    try {
      bed.stop();
    } catch {
      // Already stopped.
    }
    bed.disconnect();
    bed = null;
  }

  function startBed(): void {
    if (!unlocked || mode !== 'ambient' || bed) return;
    const active = audio();
    const source = active.createBufferSource();
    source.buffer = brownNoise(active);
    source.loop = true;
    const filter = active.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const gain = active.createGain();
    gain.gain.value = 0.04;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(active.destination);
    source.start();
    bed = source;
  }

  function tone(frequency: number, when: number, duration: number, peak: number): void {
    const active = audio();
    const osc = active.createOscillator();
    const gain = active.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(active.destination);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  return {
    get mode(): SoundMode {
      return mode;
    },
    label(): string {
      return soundLabel(mode);
    },
    async unlock(): Promise<void> {
      unlocked = true;
      const active = audio();
      if (active.state === 'suspended') await active.resume();
      startBed();
    },
    setMode(next: SoundMode): void {
      mode = next;
      if (mode === 'ambient') startBed();
      else stopBed();
    },
    cycle(): void {
      const index = SOUND_MODES.indexOf(mode);
      this.setMode(SOUND_MODES[(index + 1) % SOUND_MODES.length] ?? 'chime');
    },
    chime(): void {
      if (!unlocked || mode === 'off') return;
      const now = audio().currentTime;
      tone(523.25, now, 0.38, 0.07);
      tone(659.25, now + 0.12, 0.42, 0.06);
      tone(783.99, now + 0.24, 0.55, 0.05);
    },
    tick(sceneId: string, now: number): void {
      if (!unlocked || mode !== 'ambient' || now < nextCue) return;
      if (sceneId === 'embers') {
        tone(140 + Math.random() * 40, audio().currentTime, 0.08, 0.03);
        nextCue = now + 2500 + Math.random() * 4000;
        return;
      }
      if (!NATURE.has(sceneId)) return;
      const start = audio().currentTime;
      tone(1600 + Math.random() * 700, start, 0.16, 0.035);
      tone(900 + Math.random() * 200, start + 0.09, 0.12, 0.02);
      nextCue = now + 4500 + Math.random() * 7000;
    },
  };
}
