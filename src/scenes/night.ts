import type { Scene } from './types.ts';
import { FAR_POINTER, elapsedSeconds, glow, rng, sky, type Pointer } from './paint.ts';

interface Star {
  x: number;
  y: number;
  radius: number;
  phase: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

export function createNight(): Scene {
  let width = 800;
  let height = 600;
  let pointer: Pointer = FAR_POINTER;
  let nextShot = 6000;
  const shots: Shot[] = [];
  const random = rng(29);
  const stars: Star[] = Array.from({ length: 180 }, () => ({
    x: random(),
    y: random() * 0.82,
    radius: random() < 0.08 ? 1.8 : 0.6 + random() * 0.8,
    phase: random() * Math.PI * 2,
  }));

  return {
    id: 'night',
    resize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
    },
    pointer(next) {
      pointer = next;
    },
    pulse(x, y, time) {
      shots.push({ x, y, vx: 220 + random() * 80, vy: 30 + random() * 40, t: time });
    },
    draw(ctx, time, reduced) {
      const t = elapsedSeconds(time, reduced);
      sky(ctx, width, height, [
        [0, '#070b16'],
        [0.55, '#141a33'],
        [1, '#0c1214'],
      ]);
      const moonX = width * 0.78;
      const moonY = height * 0.22;
      glow(ctx, moonX, moonY, 90, 'rgba(232, 226, 206, 0.35)');
      ctx.fillStyle = '#f4efe2';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#141a33';
      ctx.beginPath();
      ctx.arc(moonX + 10, moonY - 4, 22, 0, Math.PI * 2);
      ctx.fill();

      if (!reduced && time > nextShot) {
        shots.push({ x: random() * width * 0.7, y: random() * height * 0.35, vx: 260, vy: 48, t: time });
        nextShot = time + 7000 + random() * 6000;
      }

      for (const star of stars) {
        const x = star.x * width;
        const y = star.y * height;
        let alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.5 + star.phase));
        let radius = star.radius;
        if (pointer.inside) {
          const dist = Math.hypot(x - pointer.x, y - pointer.y);
          if (dist < 90) {
            alpha = 1;
            radius += (1 - dist / 90) * 1.6;
          }
        }
        ctx.fillStyle = `rgba(244, 242, 232, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let index = shots.length - 1; index >= 0; index -= 1) {
        const shot = shots[index];
        const age = (time - shot.t) / 1000;
        if (age > 1.1) {
          shots.splice(index, 1);
          continue;
        }
        const x = shot.x + shot.vx * age;
        const y = shot.y + shot.vy * age;
        ctx.strokeStyle = `rgba(255, 250, 240, ${1 - age / 1.1})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - shot.vx * 0.08, y - shot.vy * 0.08);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(0, height * 0.86);
      ctx.quadraticCurveTo(width * 0.4, height * 0.78, width, height * 0.88);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.fillStyle = '#07090d';
      ctx.fill();
    },
  };
}
