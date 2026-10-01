import type { Pointer } from './types.ts';

export type { Pointer };

export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function wrap(value: number, max: number): number {
  if (max <= 0) return 0;
  return ((value % max) + max) % max;
}

export const FAR_POINTER: Pointer = { x: -9999, y: -9999, inside: false };

export function sky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: Array<[number, string]>,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  flap: number,
  scale: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lift = Math.sin(flap) * 5.5;
  ctx.beginPath();
  ctx.moveTo(-14, lift * 0.25);
  ctx.quadraticCurveTo(-6, -lift - 3, 0, 0);
  ctx.quadraticCurveTo(6, -lift - 3, 14, lift * 0.25);
  ctx.stroke();
  ctx.restore();
}

export function elapsedSeconds(time: number, reduced: boolean): number {
  return reduced ? 0 : time / 1000;
}

export function frameDelta(time: number, last: number): number {
  if (last < 0) return 0;
  return clamp((time - last) / 1000, 0, 0.05);
}
