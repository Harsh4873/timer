import type { Scene } from './types.ts';
import { FAR_POINTER, frameDelta, rng, sky, wrap, type Pointer } from './paint.ts';

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
  depth: number;
}

export function createRain(): Scene {
  let width = 800;
  let height = 600;
  let pointer: Pointer = FAR_POINTER;
  let last = -1;
  const ripples: Array<{ x: number; y: number; t: number }> = [];
  const random = rng(19);
  const drops: Drop[] = Array.from({ length: 160 }, () => ({
    x: random() * width,
    y: random() * height,
    length: 10 + random() * 18,
    speed: 7 + random() * 10,
    depth: 0.35 + random() * 0.65,
  }));

  return {
    id: 'rain',
    resize(nextWidth, nextHeight) {
      const sx = nextWidth / width;
      const sy = nextHeight / height;
      for (const drop of drops) {
        drop.x *= sx;
        drop.y *= sy;
      }
      width = nextWidth;
      height = nextHeight;
    },
    pointer(next) {
      pointer = next;
    },
    pulse(x, y, time) {
      ripples.push({ x, y, t: time });
    },
    draw(ctx, time, reduced) {
      const dt = reduced ? 0 : frameDelta(time, last);
      last = time;
      sky(ctx, width, height, [
        [0, '#1c2938'],
        [0.55, '#121a24'],
        [1, '#0c1016'],
      ]);
      ctx.beginPath();
      ctx.moveTo(0, height * 0.72);
      for (let x = 0; x <= width; x += 20) {
        ctx.lineTo(x, height * 0.7 + Math.sin(x * 0.02) * 10);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.fillStyle = '#090d12';
      ctx.fill();

      for (const drop of drops) {
        drop.y += drop.speed * drop.depth * dt * 60;
        drop.x -= 0.6 * dt * 60;
        if (pointer.inside) {
          const dx = drop.x - pointer.x;
          const dy = drop.y - pointer.y;
          if (dx * dx + dy * dy < 110 * 110) drop.x += dx * 0.04;
        }
        if (drop.y > height + 20) {
          drop.y = -30;
          drop.x = random() * width;
        }
        drop.x = wrap(drop.x, width);
        ctx.strokeStyle = `rgba(186, 208, 224, ${0.18 + drop.depth * 0.35})`;
        ctx.lineWidth = drop.depth > 0.7 ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 2, drop.y + drop.length);
        ctx.stroke();
      }

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        const age = (time - ripple.t) / 1000;
        if (age > 1.5) {
          ripples.splice(index, 1);
          continue;
        }
        ctx.beginPath();
        ctx.strokeStyle = `rgba(198, 220, 232, ${0.7 * (1 - age / 1.5)})`;
        ctx.lineWidth = 1.2;
        ctx.ellipse(ripple.x, ripple.y, 10 + age * 80, 4 + age * 18, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  };
}
