import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { HeroStairGait } from "../../../../../../src/game/objects/characters/hero/HeroStairGait.js";

const surfaceAt = (x, z) => ({
  height: Math.max(0, Math.floor(z / 0.5) * 0.25),
  point: new Vec3(x, 0, z),
  normal: new Vec3(0, 1, 0),
});
it("plants one foot while the other swings, then exchanges feet on successive treads", () => {
  const gait = new HeroStairGait();
  const position = new Vec3(0, 0, 0.3);
  const velocity = new Vec3(0, 0, 1);
  const soles = [new Vec3(-0.1, 0, 0.3), new Vec3(0.1, 0, 0.3)];
  const initial = gait.update(0.01, true, position, velocity, soles, surfaceAt);
  const right = initial[1].clone();
  let targets;
  for (let i = 0; i < 12; i++) {
    position.z += 0.01;
    targets = gait.update(0.01, true, position, velocity, soles, surfaceAt);
    assert.ok(targets[1].distance(right) < 0.00001);
  }
  assert.equal(gait.state.swing, 0);
  assert.ok(targets[0].y > 0.25);
  for (let i = 0; i < 13; i++) {
    position.z += 0.01;
    targets = gait.update(0.01, true, position, velocity, soles, surfaceAt);
  }
  const left = targets[0].clone();
  assert.equal(gait.state.swing, 1);
  assert.ok(Math.abs(left.y - 0.256) < 0.001);
  for (let i = 0; i < 8; i++) {
    position.z += 0.01;
    targets = gait.update(0.01, true, position, velocity, soles, surfaceAt);
    assert.ok(targets[0].distance(left) < 0.00001);
  }
  assert.ok(targets[1].y > 0.05);
});

it("finishes a released tap, keeps resting contacts, and releases them for jumping", () => {
  const gait = new HeroStairGait();
  const position = new Vec3(0, 0, 0.2);
  const soles = [new Vec3(-0.1, 0, 0.2), new Vec3(0.1, 0, 0.2)];
  gait.update(0.02, true, position, new Vec3(0, 0, 1), soles, surfaceAt);
  let targets;
  for (let i = 0; i < 40; i++) {
    targets = gait.update(0.02, true, position, new Vec3(), soles, surfaceAt);
  }
  assert.equal(gait.state.swing, null);
  const plants = targets.map(v => v.clone());
  targets = gait.update(1, true, position, new Vec3(), soles, surfaceAt);
  assert.ok(targets.every((v, i) => v.distance(plants[i]) === 0));
  assert.equal(gait.update(0.02, false, position, new Vec3(), soles, surfaceAt), null);
});

it("bends a scaled hip and knee onto a tread without moving the hip or stretching either bone", () => {
  const root = new Entity();
  root.setLocalScale(0.512, 0.512, 0.512);
  const hip = new Entity();
  root.addChild(hip);
  hip.setLocalPosition(0, 0.71, 0);
  const hipCorrection = new Entity();
  hip.addChild(hipCorrection);
  const knee = new Entity();
  hipCorrection.addChild(knee);
  knee.setLocalPosition(0, -0.18, 0);
  const kneeCorrection = new Entity();
  knee.addChild(kneeCorrection);
  const ankle = new Entity();
  kneeCorrection.addChild(ankle);
  ankle.setLocalPosition(0, -0.4, 0);
  const origin = hip.getPosition().clone();
  const target = new Vec3(0, 0.25, 0.16);
  // The runtime can load the Engine from a separate module instance. Its
  // instanceof overload must receive scalar rotation components, not our Quat.
  for (const correction of [hipCorrection, kneeCorrection]) {
    const setRotation = correction.setRotation.bind(correction);
    correction.setRotation = (x, y, z, w) => {
      assert.ok([x, y, z, w].every(Number.isFinite));
      setRotation(x, y, z, w);
    };
  }
  HeroStairGait.pose(hip, knee, ankle, hipCorrection, kneeCorrection,
    ankle.getPosition().clone(), target, new Vec3(0, 0, 1));
  assert.ok(hip.getPosition().distance(origin) < 0.00001);
  assert.ok(ankle.getPosition().distance(target) < 0.00001);
  assert.ok(Math.abs(hip.getPosition().distance(knee.getPosition()) - 0.18 * 0.512) < 0.00001);
  assert.ok(Math.abs(knee.getPosition().distance(ankle.getPosition()) - 0.4 * 0.512) < 0.00001);
});
