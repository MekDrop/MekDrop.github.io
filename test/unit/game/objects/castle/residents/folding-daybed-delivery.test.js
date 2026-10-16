import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoldingDaybedDelivery } from '../../../../../../src/game/objects/castle/residents/FoldingDaybedDelivery.js';

test('sets the folded daybed down before unfolding and folds before lifting', () => {
  assert.deepEqual(FoldingDaybedDelivery.pose(0), {
    placement: 0,
    unfold: 0,
  });
  assert.deepEqual(FoldingDaybedDelivery.pose(1), {
    placement: 1,
    unfold: 1,
  });
  for (let step = 0; step <= 100; step++) {
    const progress = step / 100;
    const pose = FoldingDaybedDelivery.pose(progress);
    if (pose.unfold > 0) { assert.equal(pose.placement, 1); }
    if (pose.placement < 1) { assert.equal(pose.unfold, 0); }
    const previous = FoldingDaybedDelivery.pose(Math.max(0, progress - 0.01));
    assert.ok(pose.placement >= previous.placement && pose.unfold >= previous.unfold);
  }
});
