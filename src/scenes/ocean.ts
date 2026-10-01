import type { Scene } from './types.ts';
import { FAR_POINTER, drawBird, elapsedSeconds, frameDelta, glow, rng, sky, type Pointer } from './paint.ts';

export function createOcean(): Scene {
  let width = 1;
  let height = 1;
  let pointer: Pointer = FAR_POINTER;
  let last = -1;
  const splashes: Array<{ x: number; y: number; t: number }> = [];
  const random = rng(23);
  const gulls = Array.from({ length: 5 }, () => ({
    x: random(),
    y: 0.12 + random() * 0.2,
    speed: 0.012 + random() * 0.02,
    phase: random() * 8,
    scale: 0.7 + random() * 0.55,
  }));

  return {
    id: 'ocean',
    resize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
    },
    pointer(next) {
      pointer = next;
    },
    pulse(x, y, time) {
      splashes.push({ x, y, t: time });
    },
    draw(ctx, time, reduced) {
      const dt = reduced ? 0 : frameDelta(time, last);
      last = time;
      const t = elapsedSeconds(time, reduced);
      sky(ctx, width, height, [
        [0, '#8eb6cc'],
        [0.42, '#f0d2b2'],
        [0.58, '#7eb8c6'],
        [1, '#0c3344'],
      ]);
      const sunY = height * 0.4;
      glow(ctx, width * 0.72, sunY, width * 0.18, 'rgba(255, 228, 186, 0.85)');
      ctx.fillStyle = '#ffe3b8';
      ctx.beginPath();
      ctx.arc(width * 0.72, sunY, 28, 0, Math.PI * 2);
      ctx.fill();

      const bands: Array<[number, number, number, string]> = [
        [0.56, 16, 0.9, '#2f8ea3'],
        [0.64, 20, 1.2, '#1d6d86'],
        [0.74, 26, 0.7, '#14556c'],
        [0.86, 18, 1.4, '#0d3a4c'],
      ];
      for (const [base, amp, speed, color] of bands) {
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 8) {
          let y = height * base + Math.sin(x * 0.012 + t * speed) * amp + Math.sin(x * 0.005 + t * 0.4) * amp * 0.35;
          if (pointer.inside) {
            const dist = Math.abs(x - pointer.x);
            if (dist < 120) y -= (1 - dist / 120) * 16;
          }
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }

      for (const gull of gulls) {
        if (!reduced) {
          gull.x += gull.speed * dt;
          if (gull.x > 1.15) gull.x = -0.15;
        }
        const x = ((gull.x * width) % (width + 40) + width + 40) % (width + 40) - 20;
        const y = gull.y * height + Math.sin(t * 1.4 + gull.phase) * 8;
        drawBird(ctx, x, y, -0.05, t * 5 + gull.phase, gull.scale, 'rgba(247, 244, 238, 0.95)');
      }

      for (let index = splashes.length - 1; index >= 0; index -= 1) {
        const splash = splashes[index];
        const age = (time - splash.t) / 1000;
        if (age > 1.3) {
          splashes.splice(index, 1);
          continue;
        }
        ctx.beginPath();
        ctx.strokeStyle = `rgba(230, 246, 248, ${0.75 * (1 - age / 1.3)})`;
        ctx.lineWidth = 1.4;
        ctx.ellipse(splash.x, Math.max(splash.y, height * 0.6), 8 + age * 70, 3 + age * 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  };
}
