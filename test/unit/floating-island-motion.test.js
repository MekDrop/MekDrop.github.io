import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FloatingIslandMotion } from '../../src/game/objects/scenery/FloatingIslandMotion.js';

describe('floating island motion', () => {
  it('keeps the fitted 1x view still to prevent texture shimmer', () => {
    const motion = new FloatingIslandMotion({ zoom: 1 });

    for (let frame = 0; frame < 600; frame += 1) {
      assert.deepEqual(motion.update(1 / 60), { x: 0, y: 0 });
    }
  });

  it('retains floating motion once the view is zoomed in', () => {
    const motion = new FloatingIslandMotion({ zoom: 1.1 });
    const offsets = Array.from({ length: 180 }, () => motion.update(1 / 60));

    assert.ok(offsets.some(({ x }) => Math.abs(x) > 0.1));
    assert.ok(offsets.some(({ y }) => Math.abs(y) > 0.1));
  });

  it('stops immediately when zooming back to the fitted view', () => {
    const motion = new FloatingIslandMotion({ zoom: 1.1 });
    motion.update(1);

    motion.zoom = 1;

    assert.deepEqual(motion.update(1 / 60), { x: 0, y: 0 });
  });
});
