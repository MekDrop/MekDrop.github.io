import assert from "node:assert/strict";
import test from "node:test";
import { LatchFloorPuddle } from "../../../../../../src/game/objects/enemies/latch-slug/LatchFloorPuddle.js";

test("posed skin collapses continuously into a thin irregular floor puddle", () => {
  const skin = new Float32Array([-0.3, 0, -0.2, 0.3, 0.7, 0.2, 0, 0.2, 0.4]);
  assert.deepEqual(LatchFloorPuddle.collapse(skin, 0, 0.009), skin);
  const middle = LatchFloorPuddle.collapse(skin, 0.4, 0.009);
  assert.ok(middle[4] < skin[4] && middle[4] > 0.025);
  const puddle = LatchFloorPuddle.collapse(skin, 1.5, 0.009);
  for (let i = 1; i < puddle.length; i += 3) {
    assert.ok(puddle[i] >= 0.0089 && puddle[i] <= 0.0251);
  }
  assert.ok(Math.abs(puddle[0]) > Math.abs(skin[0]));
  assert.ok(puddle[8] > skin[8]);
});

test("losing support makes the top lean and opposing sides sag unevenly", () => {
  const skin = new Float32Array([-0.3, 0.7, 0.2, 0.3, 0.7, 0.2, 0, 0, 0]);
  const slumped = LatchFloorPuddle.collapse(skin, 0.45, 0.009);
  assert.notEqual(slumped[1], slumped[4], "the silhouette must fold unevenly");
  assert.ok(slumped[0] + slumped[3] > 0.05, "upper gel leans instead of shrinking centrally");
  assert.ok(slumped[1] > 0.025 && slumped[4] > 0.025, "the body struggles before settling flat");
});

test("the floor impact sounds once and the nonblocking puddle persists then fades", () => {
  const sounds = [], opacities = [];
  const owner = {
    getImpactMeshes: () => [],
    gelMass: { opacity: 0.09 },
    audio: { play: name => sounds.push(name) },
    pc: { calculateNormals: () => [] },
  };
  const puddle = new LatchFloorPuddle(owner);
  puddle.active = true;
  puddle.positions = new Float32Array([0, 0, 0, 1, 1, 0, 0, 0, 1]);
  puddle.indices = [0, 1, 2];
  puddle.floor = 0.009;
  puddle.source = { parameters: {} };
  puddle.mesh = {
    setPositions: () => {},
    setNormals: () => {},
    update: () => {},
  };
  puddle.instance = { setParameter: (name, value) => opacities.push(value) };
  puddle.parts = [{
    entity: { enabled: true },
    positions: puddle.positions,
    indices: puddle.indices,
    source: puddle.source,
    mesh: puddle.mesh,
    instance: puddle.instance,
    isBody: true,
  }];
  const tipOpacity = [];
  const tip = {
    ...puddle.parts[0],
    entity: { enabled: true },
    instance: { setParameter: (name, value) => tipOpacity.push(value) },
    isBody: false,
  };
  puddle.parts.push(tip);
  puddle.update(0.5);
  assert.equal(sounds.length, 0);
  assert.equal(tip.entity.enabled, true);
  assert.ok(tipOpacity.at(-1) > 0 && tipOpacity.at(-1) < 1, "sensory tips fade while drooping");
  puddle.update(0.1);
  puddle.update(2);
  assert.equal(tip.entity.enabled, false);
  assert.deepEqual(sounds, ["splash"]);
  assert.equal(puddle.active, true);
  puddle.update(6.4);
  assert.ok(opacities.at(-1) < 0.24);
  puddle.update(1.1);
  assert.equal(puddle.active, false);
  assert.equal(opacities.at(-1), 0);
});
