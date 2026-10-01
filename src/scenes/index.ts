import { createEmbers } from './embers.ts';
import { createFlock } from './flock.ts';
import { createForest } from './forest.ts';
import { createMeadow } from './meadow.ts';
import { createNight } from './night.ts';
import { createOcean } from './ocean.ts';
import { createRain } from './rain.ts';
import { createSnow } from './snow.ts';
import type { Scene, SceneId } from './types.ts';

export interface SceneChoice {
  id: SceneId;
  label: string;
  caption: string;
  swatch: [string, string];
}

export const SCENE_CHOICES: SceneChoice[] = [
  { id: 'forest', label: 'Forest', caption: 'Dusk trees, birds, and fireflies', swatch: ['#16382c', '#e2b56a'] },
  { id: 'flock', label: 'Birds', caption: 'A murmuration that moves away from you', swatch: ['#8eafc9', '#1b1a17'] },
  { id: 'rain', label: 'Rain', caption: 'Glass, streaks, and ripples', swatch: ['#1c2938', '#9db4c6'] },
  { id: 'ocean', label: 'Ocean', caption: 'Slow swells and gulls', swatch: ['#1d6d86', '#f0d2b2'] },
  { id: 'night', label: 'Night', caption: 'Moon, stars, and the odd meteor', swatch: ['#070b16', '#f4efe2'] },
  { id: 'meadow', label: 'Meadow', caption: 'Morning grass and pollen', swatch: ['#2f5d3a', '#f3e3c6'] },
  { id: 'embers', label: 'Embers', caption: 'A low fire for deep work', swatch: ['#140c09', '#ff8a3d'] },
  { id: 'snow', label: 'Snow', caption: 'Pines and a swirl of flakes', swatch: ['#8ea4b6', '#f7fbfd'] },
];

export function createScene(id: SceneId): Scene {
  switch (id) {
    case 'forest':
      return createForest();
    case 'flock':
      return createFlock();
    case 'rain':
      return createRain();
    case 'ocean':
      return createOcean();
    case 'night':
      return createNight();
    case 'meadow':
      return createMeadow();
    case 'embers':
      return createEmbers();
    case 'snow':
      return createSnow();
    default: {
      const unknown: never = id;
      throw new Error(`Unknown scene ${unknown}`);
    }
  }
}
