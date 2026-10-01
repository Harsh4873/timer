import type { Scene } from './types.ts';
import { FAR_POINTER, drawBird, frameDelta, glow, rng, sky, type Pointer } from './paint.ts';

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export function createFlock(): Scene {
  let width = 800;
  let height = 600;
  let pointer: Pointer = FAR_POINTER;
  let last = -1;
  const pulses: Array<{ x: number; y: number; t: number }> = [];
  const random = rng(11);
  const boids: Boid[] = Array.from({ length: 46 }, () => ({
    x: random() * width,
    y: random() * height * 0.7,
    vx: random() * 2 - 1,
    vy: random() * 2 - 1,
    phase: random() * Math.PI * 2,
  }));

  return {
    id: 'flock',
    resize(nextWidth, nextHeight) {
      const sx = nextWidth / width;
      const sy = nextHeight / height;
      for (const boid of boids) {
        boid.x *= sx;
        boid.y *= sy;
      }
      width = nextWidth;
      height = nextHeight;
    },
    pointer(next) {
      pointer = next;
    },
    pulse(x, y, time) {
      pulses.push({ x, y, t: time });
    },
    draw(ctx, time, reduced) {
      const dt = reduced ? 0 : frameDelta(time, last);
      last = time;
      const step = dt * 60;
      sky(ctx, width, height, [
        [0, '#8eafc9'],
        [0.55, '#e7d2b8'],
        [1, '#f4e4cf'],
      ]);
      glow(ctx, width * 0.78, height * 0.28, width * 0.2, 'rgba(255, 244, 220, 0.55)');
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.ellipse(width * 0.22, height * 0.22, 90, 28, 0, 0, Math.PI * 2);
      ctx.ellipse(width * 0.28, height * 0.24, 70, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, height * 0.78);
      ctx.quadraticCurveTo(width * 0.35, height * 0.7, width, height * 0.8);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.fillStyle = '#24343a';
      ctx.fill();

      for (const boid of boids) {
        if (!reduced) {
        let separateX = 0;
        let separateY = 0;
        let alignX = 0;
        let alignY = 0;
        let cohereX = 0;
        let cohereY = 0;
        let neighbors = 0;
        let crowded = 0;
        for (const other of boids) {
          if (other === boid) continue;
          const dx = other.x - boid.x;
          const dy = other.y - boid.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= 0 || dist >= 58) continue;
          cohereX += other.x;
          cohereY += other.y;
          alignX += other.vx;
          alignY += other.vy;
          neighbors += 1;
          if (dist < 26) {
            separateX -= dx / dist;
            separateY -= dy / dist;
            crowded += 1;
          }
        }
        let forceX = Math.cos(boid.phase + time / 900) * 0.012;
        let forceY = Math.sin(boid.phase + time / 1100) * 0.012;
        if (crowded) {
          forceX += (separateX / crowded) * 0.09;
          forceY += (separateY / crowded) * 0.09;
        }
        if (neighbors) {
          forceX += (alignX / neighbors - boid.vx) * 0.045;
          forceY += (alignY / neighbors - boid.vy) * 0.045;
          forceX += (cohereX / neighbors - boid.x) * 0.0009;
          forceY += (cohereY / neighbors - boid.y) * 0.0009;
        }
        const margin = 64;
        if (boid.x < margin) forceX += 0.09;
        if (boid.x > width - margin) forceX -= 0.09;
        if (boid.y < margin) forceY += 0.09;
        if (boid.y > height * 0.72) forceY -= 0.08;
        if (pointer.inside) {
          const dx = boid.x - pointer.x;
          const dy = boid.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 150 && dist > 0.5) {
            forceX += (dx / dist) * 0.28;
            forceY += (dy / dist) * 0.28;
          }
        }
        for (const pulse of pulses) {
          if (time - pulse.t > 900) continue;
          const dx = boid.x - pulse.x;
          const dy = boid.y - pulse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 240 && dist > 0.5) {
            forceX += (dx / dist) * 0.45;
            forceY += (dy / dist) * 0.45;
          }
        }
        boid.vx += forceX;
        boid.vy += forceY;
        const speed = Math.hypot(boid.vx, boid.vy) || 1;
        const maxSpeed = 2.7;
        const minSpeed = 1.15;
        const capped = Math.max(minSpeed, Math.min(maxSpeed, speed));
        boid.vx = (boid.vx / speed) * capped;
        boid.vy = (boid.vy / speed) * capped;
        boid.x += boid.vx * step;
        boid.y += boid.vy * step;
        }
        const angle = Math.atan2(boid.vy, boid.vx);
        drawBird(ctx, boid.x, boid.y, angle, time / 180 + boid.phase, 1.15, 'rgba(22, 24, 26, 0.9)');
      }

      for (let index = pulses.length - 1; index >= 0; index -= 1) {
        if (time - pulses[index].t > 1000) pulses.splice(index, 1);
      }
    },
  };
}
