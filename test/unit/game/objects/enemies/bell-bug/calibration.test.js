import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BellBugCalibration } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugCalibration.js';

test('the measured animated footprint fits one tile at every heading with a matching collider scale',()=>{
  const root=new URL('../../../../../../src/game/objects/enemies/bell-bug/',import.meta.url);
  const record=JSON.parse(readFileSync(new URL('model-calibration.json',root)));
  const asset=readFileSync(new URL('../../../models/enemies/bell-bug/bell-bug.glb',root));
  assert.equal(createHash('sha256').update(asset).digest('hex'),record.assetSha256,'remeasure after changing the asset');
  assert.equal(BellBugCalibration.scale,record.scale);
  assert.ok(record.unscaledMaximumGroundRadius*2*BellBugCalibration.scale<=0.9);
  assert.equal(BellBugCalibration.radius,0.42*BellBugCalibration.scale);
  assert.equal(BellBugCalibration.height,0.85*BellBugCalibration.scale);
});
