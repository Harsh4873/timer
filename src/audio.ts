import type { SceneId } from './scenes/types.ts';

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

export interface AmbientVoice {
  label: string;
  filterType: BiquadFilterType;
  frequency: number;
  q: number;
  gain: number;
  lfoFrequency: number | null;
  lfoDepth: number;
}

export const AMBIENT_VOICES: Record<SceneId, AmbientVoice> = {
  forest: { label: 'Stream', filterType: 'lowpass', frequency: 850, q: 0.7, gain: 0.035, lfoFrequency: 0.18, lfoDepth: 0.008 },
  flock: { label: 'Bright', filterType: 'bandpass', frequency: 1500, q: 0.6, gain: 0.02, lfoFrequency: null, lfoDepth: 0 },
  rain: { label: 'Rain', filterType: 'highpass', frequency: 1100, q: 0.7, gain: 0.05, lfoFrequency: null, lfoDepth: 0 },
  ocean: { label: 'Ocean', filterType: 'lowpass', frequency: 480, q: 0.8, gain: 0.055, lfoFrequency: 0.1, lfoDepth: 0.028 },
  night: { label: 'Dark', filterType: 'lowpass', frequency: 220, q: 0.7, gain: 0.045, lfoFrequency: null, lfoDepth: 0 },
  meadow: { label: 'Balanced', filterType: 'lowpass', frequency: 620, q: 0.7, gain: 0.032, lfoFrequency: 0.13, lfoDepth: 0.006 },
  embers: { label: 'Fire', filterType: 'lowpass', frequency: 300, q: 0.9, gain: 0.05, lfoFrequency: 0.45, lfoDepth: 0.012 },
  snow: { label: 'Wind', filterType: 'lowpass', frequency: 400, q: 0.7, gain: 0.02, lfoFrequency: 0.07, lfoDepth: 0.009 },
};

export function ambientVoiceFor(sceneId: string): AmbientVoice {
  return (AMBIENT_VOICES as Record<string, AmbientVoice>)[sceneId] ?? AMBIENT_VOICES.meadow;
}

interface Bed {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode | null;
  lfoGain: GainNode | null;
}

export function createSound() {
  let mode: SoundMode = 'chime';
  let unlocked = false;
  let sceneId: SceneId = 'forest';
  let context: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let bed: Bed | null = null;

  function audio(): AudioContext {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  function whiteNoise(active: AudioContext): AudioBuffer {
    if (noiseBuffer && noiseBuffer.sampleRate === active.sampleRate) return noiseBuffer;
    const length = active.sampleRate * 2;
    const buffer = active.createBuffer(1, length, active.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    noiseBuffer = buffer;
    return buffer;
  }

  function stopNodes(node: AudioScheduledSourceNode | null): void {
    if (!node) return;
    try {
      node.stop();
    } catch {
      // Already stopped.
    }
    node.disconnect();
  }

  function stopBed(): void {
    if (!bed) return;
    stopNodes(bed.source);
    stopNodes(bed.lfo);
    bed.lfoGain?.disconnect();
    bed.filter.disconnect();
    bed.gain.disconnect();
    bed = null;
  }

  function applyVoice(id: string, immediate: boolean): void {
    if (!bed || !context) return;
    const voice = ambientVoiceFor(id);
    const now = context.currentTime;
    const ease = immediate ? 0.02 : 0.4;
    bed.filter.type = voice.filterType;
    bed.filter.Q.setTargetAtTime(voice.q, now, 0.3);
    bed.filter.frequency.setTargetAtTime(voice.frequency, now, ease);
    bed.gain.gain.setTargetAtTime(voice.gain, now, immediate ? 0.08 : 0.5);
    if (voice.lfoFrequency == null || voice.lfoDepth <= 0) {
      stopNodes(bed.lfo);
      bed.lfoGain?.disconnect();
      bed.lfo = null;
      bed.lfoGain = null;
      return;
    }
    if (!bed.lfo || !bed.lfoGain) {
      const lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = voice.lfoFrequency;
      depth.gain.value = voice.lfoDepth;
      lfo.connect(depth);
      depth.connect(bed.gain.gain);
      lfo.start();
      bed.lfo = lfo;
      bed.lfoGain = depth;
      return;
    }
    bed.lfo.frequency.setTargetAtTime(voice.lfoFrequency, now, ease);
    bed.lfoGain.gain.setTargetAtTime(voice.lfoDepth, now, ease);
  }

  function startBed(): void {
    if (!unlocked || mode !== 'ambient' || bed) return;
    const active = audio();
    const source = active.createBufferSource();
    source.buffer = whiteNoise(active);
    source.loop = true;
    const filter = active.createBiquadFilter();
    const gain = active.createGain();
    gain.gain.value = 0.0001;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(active.destination);
    source.start();
    bed = { source, filter, gain, lfo: null, lfoGain: null };
    applyVoice(sceneId, true);
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
      if (mode !== 'ambient') return soundLabel(mode);
      return ambientVoiceFor(sceneId).label;
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
    setScene(id: SceneId): void {
      sceneId = id;
      if (bed) applyVoice(id, false);
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
  };
}
