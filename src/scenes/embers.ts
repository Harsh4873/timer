import type { Scene } from './types.ts';
import { FAR_POINTER, frameDelta, glow, rng, sky, type Pointer } from './paint.ts';

interface Spark {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
}

export function createEmbers(): Scene {
  let width = 800;
  let height = 600;
  let pointer: Pointer = FAR_POINTER;
  let last = -1;
  const random = rng(37);
  const sparks: Spark[] = Array.from({ length: 70 }, () => makeSpark(random, width, height, true));

  return {
    id: 'embers',
    resize(nextWidth, nextHeight) {
      const sx = width > 0 ? nextWidth / width : 1;
      const sy = height > 0 ? nextHeight / height : 1;
      for (const spark of sparks) {
        spark.x *= sx;
        spark.y *= sy;
      }
      width = nextWidth;
      height = nextHeight;
    },
    pointer(next) {
      pointer = next;
    },
    pulse(x, y) {
      for (let i = 0; i < 12; i += 1) {
        sparks.push({
          x,
          y,
          vy: -0.4 - random() * 1.4,
          life: 0,
          max: 0.6 + random() * 0.8,
        });
      }
    },
    draw(ctx, time, reduced) {
      const dt = reduced ? 0 : frameDelta(time, last);
      last = time;
      sky(ctx, width, height, [
        [0, '#070605'],
        [0.7, '#120c09'],
        [1, '#1a0c08'],
      ]);
      const hearthX = width / 2;
      const hearthY = height * 0.78;
      glow(ctx, hearthX, hearthY, width * 0.42, 'rgba(255, 120, 40, 0.22)');
      glow(ctx, hearthX, hearthY, width * 0.18, 'rgba(255, 170, 70, 0.55)');
      ctx.fillStyle = '#2a140c';
      ctx.beginPath();
      ctx.ellipse(hearthX, hearthY + 16, 70, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2216';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hearthX - 46, hearthY + 8);
      ctx.lineTo(hearthX + 36, hearthY - 8);
      ctx.moveTo(hearthX - 30, hearthY - 4);
      ctx.lineTo(hearthX + 48, hearthY + 10);
      ctx.stroke();

      const drift = pointer.inside ? (pointer.x - hearthX) / width : 0;
      for (let index = sparks.length - 1; index >= 0; index -= 1) {
        const spark = sparks[index];
        spark.life += dt;
        spark.y += spark.vy * dt * 60;
        spark.x += (Math.sin(time / 300 + spark.y * 0.02) * 0.35 + drift * 1.4) * dt * 60;
        const alpha = 1 - spark.life / spark.max;
        if (alpha <= 0 || spark.y < -20) {
          sparks[index] = makeSpark(random, width, height, false);
          continue;
        }
        glow(ctx, spark.x, spark.y, 7, `rgba(255, ${140 + (1 - alpha) * 60}, 60, ${0.55 * alpha})`);
      }
      if (sparks.length > 120) sparks.splice(0, sparks.length - 90);
    },
  };
}

function makeSpark(random: () => number, width: number, height: number, anywhere: boolean): Spark {
  return {
    x: width * (0.38 + random() * 0.24),
    y: anywhere ? height * (0.4 + random() * 0.4) : height * 0.76,
    vy: -0.35 - random() * 1.1,
    life: anywhere ? random() * 0.8 : 0,
    max: 0.8 + random() * 1.3,
  };
}
