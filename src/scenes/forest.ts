import type { Scene } from './types.ts';
import { FAR_POINTER, clamp, drawBird, elapsedSeconds, frameDelta, glow, rng, sky, type Pointer } from './paint.ts';

interface Bird {
  x: number;
  y: number;
  speed: number;
  phase: number;
  scale: number;
}

export function createForest(): Scene {
  let width = 1;
  let height = 1;
  let pointer: Pointer = FAR_POINTER;
  let last = -1;
  const pulses: Array<{ x: number; y: number; t: number }> = [];
  const random = rng(7);
  const trees = Array.from({ length: 34 }, () => ({
    x: random(),
    layer: random(),
    height: 0.16 + random() * 0.26,
    shade: random(),
  }));
  const birds: Bird[] = Array.from({ length: 7 }, () => ({
    x: random(),
    y: 0.1 + random() * 0.22,
    speed: 0.018 + random() * 0.03,
    phase: random() * Math.PI * 2,
    scale: 0.75 + random() * 0.7,
  }));
  const flies = Array.from({ length: 26 }, () => ({
    x: random(),
    y: 0.4 + random() * 0.45,
    phase: random() * 12,
  }));

  return {
    id: 'forest',
    resize(nextWidth, nextHeight) {
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
      const t = elapsedSeconds(time, reduced);
      sky(ctx, width, height, [
        [0, '#071410'],
        [0.42, '#17382f'],
        [0.7, '#d4894a'],
        [0.82, '#1a3328'],
        [1, '#0c1c16'],
      ]);
      glow(ctx, width * 0.74, height * 0.66, width * 0.32, 'rgba(255, 186, 110, 0.42)');

      const hills: Array<[number, string, number]> = [
        [0.74, '#1d4638', 16],
        [0.82, '#14352a', 22],
        [0.9, '#0d221b', 10],
      ];
      for (const [base, color, amp] of hills) {
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 14) {
          ctx.lineTo(x, height * base + Math.sin(x * 0.008 + t * 0.15) * amp);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }

      const ordered = [...trees].sort((a, b) => a.layer - b.layer);
      for (const tree of ordered) {
        const ground = height * (0.7 + tree.layer * 0.24);
        const treeHeight = height * tree.height * (0.75 + tree.layer * 0.55);
        const x = tree.x * width;
        const sway = Math.sin(t * 0.6 + tree.x * 9) * 7 * tree.layer;
        const green = Math.round(24 + tree.shade * 30);
        ctx.fillStyle = `rgba(${8 + tree.shade * 16}, ${green}, ${16}, ${0.45 + tree.layer * 0.5})`;
        ctx.fillRect(x - 2, ground - treeHeight * 0.22, 4, treeHeight * 0.22);
        for (let layer = 0; layer < 3; layer += 1) {
          const top = ground - treeHeight + layer * treeHeight * 0.2;
          const half = treeHeight * (0.34 - layer * 0.05);
          ctx.beginPath();
          ctx.moveTo(x + sway * (0.2 + layer * 0.15), top);
          ctx.lineTo(x + half, top + treeHeight * 0.34);
          ctx.lineTo(x - half, top + treeHeight * 0.34);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.fillStyle = 'rgba(232, 220, 196, 0.08)';
      ctx.fillRect(0, height * 0.64, width, height * 0.1);

      for (const bird of birds) {
        if (!reduced) {
          bird.x += bird.speed * dt;
          if (bird.x > 1.2) bird.x = -0.2;
          if (pointer.inside) {
            const dx = bird.x - pointer.x / width;
            const dy = bird.y - pointer.y / height;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.16 && dist > 0.001) {
              bird.x += (dx / dist) * 0.35 * dt;
              bird.y += (dy / dist) * 0.2 * dt;
            }
          }
          for (const pulse of pulses) {
            if (time - pulse.t > 1200) continue;
            const dx = bird.x * width - pulse.x;
            const dy = bird.y * height - pulse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 200 && dist > 1) {
              bird.x += (dx / dist) * 0.55 * dt;
              bird.y -= 0.15 * dt;
            }
          }
          bird.y = clamp(bird.y, 0.05, 0.4);
        }
        const x = bird.x * width;
        const y = bird.y * height + Math.sin(t * 1.6 + bird.phase) * 12;
        drawBird(ctx, x, y, Math.sin(t + bird.phase) * 0.2, t * 6 + bird.phase, bird.scale, 'rgba(247, 240, 226, 0.92)');
      }

      for (const fly of flies) {
        const x = ((fly.x * width + Math.sin(t * 0.35 + fly.phase) * 24) % width + width) % width;
        const y = fly.y * height + Math.cos(t * 0.45 + fly.phase) * 14;
        const flicker = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.2 + fly.phase));
        glow(ctx, x, y, 12, `rgba(214, 255, 150, ${0.28 * flicker})`);
      }

      for (let index = pulses.length - 1; index >= 0; index -= 1) {
        if (time - pulses[index].t > 1400) pulses.splice(index, 1);
      }
    },
  };
}
