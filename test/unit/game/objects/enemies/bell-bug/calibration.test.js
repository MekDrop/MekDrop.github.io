import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BellBugCalibration } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugCalibration.js';

test('locomotion retains tile clearance and planted rear scratching fits one tile at every heading',()=>{
  const root=new URL('../../../../../../src/game/objects/enemies/bell-bug/',import.meta.url);
  const record=JSON.parse(readFileSync(new URL('model-calibration.json',root)));
  const asset=readFileSync(new URL('../../../models/enemies/bell-bug/bell-bug.glb',root));
  assert.equal(createHash('sha256').update(asset).digest('hex'),record.assetSha256,'remeasure after changing the asset');
  assert.equal(BellBugCalibration.scale,record.scale);
  const measured = record.measurement;
  assert.ok(measured.locomotion.unscaledMaximumGroundRadius*2*BellBugCalibration.scale<=0.9);
  assert.ok(record.unscaledMaximumGroundRadius*2*BellBugCalibration.scale<=record.tileSize);
  assert.ok(measured.rearScratch.footprintDiameter<=record.tileSize);
  assert.equal(record.sampledPoses,measured.sampledActions.length*25);
  assert.equal(measured.sampledActions.length,27);
  assert.equal(BellBugCalibration.radius,0.42*BellBugCalibration.scale);
  assert.equal(BellBugCalibration.height,0.85*BellBugCalibration.scale);
});
