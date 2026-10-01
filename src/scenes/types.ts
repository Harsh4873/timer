export const SCENE_IDS = ['forest', 'flock', 'rain', 'ocean', 'night', 'meadow', 'embers', 'snow'] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export function isSceneId(value: unknown): value is SceneId {
  return typeof value === 'string' && (SCENE_IDS as readonly string[]).includes(value);
}

export interface Pointer {
  x: number;
  y: number;
  inside: boolean;
}

export interface Scene {
  id: SceneId;
  resize(width: number, height: number): void;
  pointer(pointer: Pointer): void;
  pulse(x: number, y: number, time: number): void;
  draw(ctx: CanvasRenderingContext2D, time: number, reduced: boolean): void;
}
