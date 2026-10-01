import type { Scene } from './types.ts';
import { FAR_POINTER, frameDelta, rng, sky, wrap, type Pointer } from './paint.ts';

interface Flake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
  vx: number;
  vy: number;
}

export function createSnow(): Scene {
  let width = 800;
  let height = 600;
  let pointer: Pointer = FAR_POINTER;
  let last = -1;
  const random = rng(41);
  const flakes: Flake[] = Array.from({ length: 140 }, () => makeFlake(random, width, height, true));

  return {
    id: 'snow',
    resize(nextWidth, nextHeight) {
      const sx = nextWidth / width;
      const sy = nextHeight / height;
      for (const flake of flakes) {
        flake.x *= sx;
        flake.y *= sy;
      }
      width = nextWidth;
      height = nextHeight;
    },
    pointer(next) {
      pointer = next;
    },
    pulse(x, y) {
      for (const flake of flakes) {
        const dx = flake.x - x;
        const dy = flake.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist < 160 && dist > 1) {
          flake.vx += (dx / dist) * 4;
          flake.vy += (dy / dist) * 2.2;
        }
      }
    },
    draw(ctx, time, reduced) {
      const dt = reduced ? 0 : frameDelta(time, last);
      last = time;
      sky(ctx, width, height, [
        [0, '#8ea4b6'],
        [0.45, '#d5e0ea'],
        [1, '#eef3f6'],
      ]);

      const pines: Array<[number, number, number]> = [
        [0.12, 0.42, 0.55],
        [0.28, 0.5, 0.7],
        [0.7, 0.46, 0.5],
        [0.86, 0.36, 0.85],
      ];
      for (const [xRatio, heightRatio, alpha] of pines) {
        const x = width * xRatio;
        const treeHeight = height * heightRatio;
        const ground = height * 0.86;
        ctx.fillStyle = `rgba(22, 36, 44, ${alpha})`;
        for (let layer = 0; layer < 3; layer += 1) {
          const top = ground - treeHeight + layer * treeHeight * 0.22;
          const half = treeHeight * (0.28 - layer * 0.04);
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x + half, top + treeHeight * 0.32);
          ctx.lineTo(x - half, top + treeHeight * 0.32);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = '#f7fbfd';
      ctx.fillRect(0, height * 0.86, width, height * 0.14);

      for (const flake of flakes) {
        if (!reduced) {
          flake.vy += 0.01;
          flake.vx *= 0.985;
          flake.vy = Math.min(flake.vy, flake.speed);
          if (pointer.inside) {
            const dx = flake.x - pointer.x;
            const dy = flake.y - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 130 && dist > 1) {
              flake.vx += (-dy / dist) * 0.35;
              flake.vy += (dx / dist) * 0.08;
            }
          }
          const step = dt * 60;
          flake.x += (flake.vx + Math.sin(time / 800 + flake.phase) * flake.drift) * step;
          flake.y += flake.vy * step;
          if (flake.y > height + 8) {
            flake.x = random() * width;
            flake.y = -8;
            flake.vx = 0;
            flake.vy = flake.speed;
          }
          flake.x = wrap(flake.x, width);
        }
        ctx.fillStyle = `rgba(255,255,255,${0.45 + flake.radius / 6})`;
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

function makeFlake(random: () => number, width: number, height: number, anywhere: boolean): Flake {
  const speed = 0.6 + random() * 1.6;
  return {
    x: random() * width,
    y: anywhere ? random() * height : -8,
    radius: 0.8 + random() * 2.2,
    speed,
    drift: 0.15 + random() * 0.45,
    phase: random() * 10,
    vx: 0,
    vy: speed,
  };
}
