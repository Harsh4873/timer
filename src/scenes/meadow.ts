import type { Scene } from './types.ts';
import { FAR_POINTER, clamp, drawBird, elapsedSeconds, frameDelta, glow, rng, type Pointer } from './paint.ts';

export function createMeadow(): Scene {
  let width = 1;
  let height = 1;
  let pointer: Pointer = FAR_POINTER;
  let last = -1;
  const bursts: Array<{ x: number; y: number; t: number }> = [];
  const random = rng(31);
  const blades = Array.from({ length: 70 }, () => ({
    x: random(),
    height: 0.08 + random() * 0.12,
    phase: random() * 6,
    lean: random() * 2 - 1,
  }));
  const birds = Array.from({ length: 4 }, () => ({
    x: random(),
    y: 0.12 + random() * 0.16,
    speed: 0.01 + random() * 0.02,
    phase: random() * 5,
    scale: 0.55 + random() * 0.35,
  }));
  const pollen = Array.from({ length: 30 }, () => ({
    x: random(),
    y: 0.3 + random() * 0.55,
    phase: random() * 10,
  }));

  return {
    id: 'meadow',
    resize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
    },
    pointer(next) {
      pointer = next;
    },
    pulse(x, y, time) {
      bursts.push({ x, y, t: time });
    },
    draw(ctx, time, reduced) {
      const dt = reduced ? 0 : frameDelta(time, last);
      last = time;
      const t = elapsedSeconds(time, reduced);
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#b7c9d4');
      gradient.addColorStop(0.48, '#f3e3c6');
      gradient.addColorStop(0.62, '#d7e4cf');
      gradient.addColorStop(1, '#1d3b28');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      glow(ctx, width * 0.3, height * 0.42, width * 0.22, 'rgba(255, 236, 196, 0.55)');

      ctx.beginPath();
      ctx.moveTo(0, height * 0.62);
      ctx.quadraticCurveTo(width * 0.5, height * 0.54, width, height * 0.6);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.fillStyle = '#6e8f78';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, height * 0.7);
      ctx.quadraticCurveTo(width * 0.45, height * 0.64, width, height * 0.72);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.fillStyle = '#2f5d3a';
      ctx.fill();

      for (const blade of blades) {
        const x = blade.x * width;
        const base = height * 0.78 + (blade.x % 0.2) * height * 0.2;
        const tip = base - blade.height * height;
        const sway = Math.sin(t * 0.8 + blade.phase) * 8 * blade.lean;
        ctx.strokeStyle = 'rgba(18, 48, 28, 0.55)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x, Math.min(base, height));
        ctx.quadraticCurveTo(x + sway, (tip + base) / 2, x + sway * 1.4, tip);
        ctx.stroke();
      }

      for (const bird of birds) {
        if (!reduced) {
          bird.x += bird.speed * dt;
          if (pointer.inside) {
            const dx = bird.x - pointer.x / width;
            const dy = bird.y - pointer.y / height;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.2 && dist > 0.001) bird.x += (dx / dist) * 0.45 * dt;
          }
          if (bird.x > 1.2) bird.x = -0.15;
        }
        drawBird(
          ctx,
          bird.x * width,
          bird.y * height + Math.sin(t + bird.phase) * 6,
          0.1,
          t * 5 + bird.phase,
          bird.scale,
          'rgba(28, 42, 34, 0.8)',
        );
      }

      for (const mote of pollen) {
        const x = ((mote.x * width + Math.sin(t * 0.25 + mote.phase) * 20) % width + width) % width;
        const y = mote.y * height + Math.cos(t * 0.3 + mote.phase) * 10;
        glow(ctx, x, y, 7, 'rgba(255, 248, 220, 0.35)');
      }

      for (let index = bursts.length - 1; index >= 0; index -= 1) {
        const burst = bursts[index];
        const age = (time - burst.t) / 1000;
        if (age > 1.4) {
          bursts.splice(index, 1);
          continue;
        }
        for (let i = 0; i < 8; i += 1) {
          const angle = (Math.PI * 2 * i) / 8 + age;
          const x = burst.x + Math.cos(angle) * age * 70;
          const y = burst.y + Math.sin(angle) * age * 40 - age * 20;
          glow(ctx, clamp(x, 0, width), clamp(y, 0, height), 8, `rgba(255, 244, 210, ${0.4 * (1 - age / 1.4)})`);
        }
      }
    },
  };
}
