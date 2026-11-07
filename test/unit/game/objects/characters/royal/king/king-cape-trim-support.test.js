import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { KingCapeTrimSupport } from "../../../../../../../src/game/objects/characters/royal/king/KingCapeTrimSupport.js";

it("samples a shared hem once despite duplicated face vertices and preserves its complete floor envelope", () => {
  const edge = {
    a: 0,
    b: 1,
  };
  const low = new Vec3(0.1, -0.2, 0.3);
  const high = new Vec3(-0.1, 0.3, -0.2);
  const offsets = Array.from({ length: 2000 }, (_, index) => index % 2 ? high : low);
  const support = new KingCapeTrimSupport([{
    mapping: offsets.map(() => 0),
    trimEdges: offsets.map(() => edge),
    trimOffsets: offsets,
  }, {
    mapping: [2, -1],
    trimOffsets: [new Vec3(0, -0.4, 0), new Vec3(0, -20, 0)],
  }]);
  const frame = {
    tangent: new Vec3(1, 0, 0),
    bitangent: new Vec3(0, 1, 0),
    normal: new Vec3(0, 0, 1),
  };
  const sample = {
    point: new Vec3(0, 0.1, 0),
    frame,
  };
  let samples = 0;
  const sampleHem = () => {
    samples++;

    return sample;
  };
  const clearances = [10, 10, 10];
  support.update([frame, frame, frame], sampleHem, 0.012, clearances);
  assert.equal(samples, 1);
  assert.deepEqual(clearances, [0.2, 0.2, 0.4]);
  assert.equal(sample.point.y, 0.1 + Math.max(0, 0.012 - (0.1 - 0.2)));

  // A later fold must recompute support from the live frame and clear old bounds.
  frame.bitangent.y = -1;
  sample.point.y = 0.1;
  support.update([frame, frame, frame], sampleHem, 0.012, clearances);
  assert.equal(samples, 2);
  assert.deepEqual(clearances, [0.3, 0.3, 0]);
  assert.equal(sample.point.y, 0.1 + Math.max(0, 0.012 - (0.1 - 0.3)));
});
