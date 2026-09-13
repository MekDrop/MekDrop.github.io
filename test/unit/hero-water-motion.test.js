import assert from 'node:assert/strict';
import { it } from 'node:test';
import { HeroWaterMotion } from '../../src/game/objects/hero/HeroWaterMotion.js';

it('bobs visibly with deeper dips and smooth, bounded motion', () => {
  const samples = Array.from({ length: 1200 }, (_, i) => HeroWaterMotion.offsetAt(i / 120));
  assert.ok(Math.min(...samples) < -0.1);
  assert.ok(Math.max(...samples) > 0.055);
  for (let i = 0; i < samples.length; i++) {
    assert.ok(samples[i] >= -0.18 && samples[i] <= 0.1);
    if (i > 0) {
      assert.ok(Math.abs(samples[i] - samples[i - 1]) < 0.01);
    }
  }
});
