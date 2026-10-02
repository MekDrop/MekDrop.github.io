import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleGenerationAbortedError } from "../../../../../src/game/errors/castle/index.js";

const options = {
  position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
  doors: [
    {
      side: "WEST",
      offset: 3,
      width: 2,
      approachElevation: 2,
    },
  ],
  style: "twin-tower",
};

describe("CastleGenerator", () => {
  it("returns a Promise of a deterministic plain build plan", async () => {
    const firstGeneration = CastleGenerator.generate(options);
    assert.equal(firstGeneration instanceof Promise, true);

    const first = await firstGeneration;
    const second = await CastleGenerator.generate(options);

    assert.deepEqual(first, second);
    assert.equal(Object.getPrototypeOf(first), Object.prototype);
    assert.equal(first.layout.style.id, "twin-tower");
    assert.deepEqual(first.layout.openings, [
      { boundary: "FRONT", start: 12, end: 20 },
    ]);
  });

  it("uses the full reserved footprint and keeps geometry/collision finite", async () => {
    const plan = await CastleGenerator.generate(options);
    assert.equal(plan.structure.wall.castleDepth, 32);
    assert.equal(plan.structure.wall.facadeSpan, 32);
    assert.equal(plan.metadata.runtime.interiorDepth, 7.5);
    assert.equal(plan.metadata.runtime.interiorWidth, 7);
    assert.equal(plan.metadata.collision.blockSize, 0.25);
    assert.ok(plan.geometry.boxes.length > 0);
    for (const block of plan.metadata.collision.cameraBlocks) {
      assert.ok(Object.values(block).every(Number.isFinite));
      assert.ok(block.x - block.halfX >= options.position.x);
      assert.ok(block.x + block.halfX <= options.position.x + options.position.width);
      assert.ok(block.z - block.halfZ >= options.position.z);
      assert.ok(block.z + block.halfZ <= options.position.z + options.position.depth);
    }
  });

  it("normalizes side-facing openings exactly as the previous builder did", async () => {
    const plan = await CastleGenerator.generate({
      ...options,
      position: { ...options.position, width: 10 },
      doors: [
        { side: "EAST", offset: 3, width: 2 },
        { side: "NORTH", offset: 6, width: 2 },
      ],
      style: "right-angle",
    });

    assert.deepEqual(plan.layout.openings, [
      { boundary: "FRONT", start: 12, end: 20 },
      { boundary: "LEFT", start: 8, end: 16 },
    ]);
    assert.equal(plan.layout.castleDepth, 40);
  });

  it("rejects with the named cancellation error before allocating a plan", async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      CastleGenerator.generate({ ...options, signal: controller.signal }),
      CastleGenerationAbortedError,
    );
  });
});
