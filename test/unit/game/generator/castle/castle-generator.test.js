import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

  it("preserves castle dimensions while carving the planned rooms", async () => {
    const plan = await CastleGenerator.generate(options);

    assert.deepEqual(plan.structure.wall, {
      castleDepth: 20,
      facadeSpan: 32,
      towerSpan: 8,
      wallHeight: 11,
      battlementPeriod: 2,
      wallWings: [],
    });
    assert.deepEqual(plan.structure.towers, [
      { u: 0, v: 0, front: true, span: 8, height: 20 },
      { u: 0, v: 24, front: true, span: 8, height: 20 },
    ]);
    assert.equal(plan.metadata.runtime.interiorDepth, 4.5);
    assert.equal(plan.metadata.runtime.interiorWidth, 7);
    assert.deepEqual(plan.metadata.runtime.terrace, {
      x: -0.7949999999999999,
      z: 0,
      y: 6,
      yaw: 90,
      depth: 1.5,
      width: 7,
    });
    assert.equal(plan.metadata.collision.blockSize, 0.25);
    assert.equal(plan.metadata.collision.groundCourse, 0);
    assert.deepEqual(plan.metadata.collision.cameraBlockHalfExtents, {
      x: 0.125,
      y: 0.125,
      z: 0.125,
    });
    assert.deepEqual(
      {
        boxes: plan.geometry.boxes.length,
        flames: plan.geometry.decorations.flames.length,
        banners: plan.geometry.decorations.banners.length,
        flags: plan.geometry.decorations.flags.length,
        roofs: plan.geometry.decorations.roofs.length,
        groundColumns: plan.metadata.collision.groundColumns.length,
        cameraBlocks: plan.metadata.collision.cameraBlocks.length,
      },
      {
        boxes: 5158,
        flames: 4,
        banners: 4,
        flags: 1,
        roofs: 1,
        groundColumns: 268,
        cameraBlocks: 5140,
      },
    );
    assert.equal(
      createHash("sha256")
        .update(JSON.stringify(plan.geometry))
        .digest("hex"),
      "d506b763101f4b4406c6fbfdb9ae37a00687ae0143259a3a8a435be8ccf4743d",
    );
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
