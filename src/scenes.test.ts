import assert from 'node:assert/strict';
import test from 'node:test';
import { SCENE_CHOICES, createScene } from './scenes/index.ts';

function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_target, property) {
      if (property === 'canvas') return { width: 800, height: 600 };
      if (property === 'createLinearGradient' || property === 'createRadialGradient') return () => gradient;
      return () => undefined;
    },
    set() {
      return true;
    },
  });
}

test('every scene draws, resizes, and takes a pointer without throwing', () => {
  const ctx = fakeContext();
  assert.equal(SCENE_CHOICES.length, 8);
  for (const choice of SCENE_CHOICES) {
    const scene = createScene(choice.id);
    assert.equal(scene.id, choice.id);
    scene.resize(900, 600);
    scene.pointer({ x: 120, y: 80, inside: true });
    scene.pulse(200, 240, 1000);
    scene.draw(ctx, 0, false);
    scene.draw(ctx, 1200, false);
    scene.draw(ctx, 8000, true);
    scene.resize(400, 800);
    scene.draw(ctx, 8600, false);
  }
});
