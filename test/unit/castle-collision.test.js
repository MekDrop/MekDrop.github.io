import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { GroundCollisionWorld } from "../../src/game/collision/GroundCollisionWorld.js";
import { CASTLE_BOUNDARY } from "../../src/game/enum/CastleBoundary.js";

// Vite owns asset URL imports. Keep the real collision implementation while
// substituting only rendering imports that require a browser/GPU in Node.
const stairSource = readFileSync(new URL(
  "../../src/game/objects/castle/CastleStairs.js", import.meta.url,
), "utf8").replace(/^import stairModuleModelUrl[^\n]*\n/, 'const stairModuleModelUrl = "stair-model";\n');
const { CastleStairs } = await import(
  `data:text/javascript;base64,${Buffer.from(stairSource).toString("base64")}`
);
const castleSource = readFileSync(new URL(
  "../../src/game/objects/castle/Castle.js", import.meta.url,
), "utf8").replace(/^import[^\n]*\n/gm, "");
const { Castle } = await import(`data:text/javascript;base64,${Buffer.from(
  `const CASTLE_BOUNDARY = ${JSON.stringify(CASTLE_BOUNDARY)};\n${castleSource}`,
).toString("base64")}`);

function stairs(side, rise = 1) {
  return new CastleStairs({
    pc,
    position: { x: 0, z: 0, width: 8, depth: 8, elevation: 2 + rise },
    doors: [{ side, offset: 3, width: 2, approachElevation: 2 }],
    cubeSize: 0.25,
    modelLibrary: { instantiateMergedBatch: () => null },
    materials: new Map(),
  });
}

function point(side, inward, across = 4) {
  if (side === "WEST") {
    return [-2 + inward, across];
  }
  if (side === "EAST") {
    return [10 - inward, across];
  }
  if (side === "NORTH") {
    return [across, -2 + inward];
  }
  return [across, 10 - inward];
}

for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
  it(`${side} stairs support the full ascent and descent without false forward-probe walls`, () => {
    const flight = stairs(side);
    for (let step = 0; step <= 40; step += 1) {
      const inward = step / 20;
      const [x, z] = point(side, inward);
      const height = 2 + inward / 2;
      assert.ok(Math.abs(flight.surfaceHeightAt(x, z) - height) < 1e-10);
      assert.equal(flight.blocksMovementAt(x, z, 0.18, height, 0.22), false);
      for (const direction of [-1, 1]) {
        // The hero also probes 0.28 units ahead of its current foot position.
        const probe = point(side, inward + direction * 0.31);
        assert.equal(flight.blocksMovementAt(...probe, 0.18, height, 0.22), false);
      }
    }
    flight.destroy();
  });

  it(`${side} stairs block a low actor at raised sides and use circular corner clearance`, () => {
    const flight = stairs(side);
    const sideContact = point(side, 1.8, 2.9);
    assert.equal(flight.blocksMovementAt(...sideContact, 0.18, 2, 0.22), true);
    assert.equal(flight.blocksMovementAt(...sideContact, 0.18, 3, 0.22), false);
    assert.equal(flight.surfaceHeightAt(...sideContact), null);
    const outsideRadius = point(side, 1.8, 2.7);
    assert.equal(flight.blocksMovementAt(...outsideRadius, 0.18, 2, 0.22), false);
    const outsideCorner = point(side, 2.15, 2.85);
    assert.equal(flight.blocksMovementAt(...outsideCorner, 0.18, 2, 0.22), false);
    const touchingCorner = point(side, 2.1, 2.9);
    assert.equal(flight.blocksMovementAt(...touchingCorner, 0.18, 2, 0.22), true);
    const entrance = point(side, -0.1);
    assert.equal(flight.blocksMovementAt(...entrance, 0.18, 2, 0.22), false);
    flight.destroy();
  });
}

it("a level entrance does not create invisible stairs or blocking surfaces", () => {
  const flight = stairs("WEST", 0);
  assert.equal(flight.surfaceHeightAt(-0.2, 4), null);
  assert.equal(flight.blocksMovementAt(-0.2, 4, 0.18, 2, 0.22), false);
  flight.destroy();
});


  it("castle solid footprints block movement even when the same collider supplies a low floor", () => {
    const world = new GroundCollisionWorld();
    // Exercise Castle's real solid-collision entry point without constructing
    // its rendering hierarchy. This branch must not consult a supporting floor.
    const collider = {
      intersectsGroundFootprint: () => true,
      surfaceHeightAt: () => 3,
      blocksMovementAt: Castle.prototype.blocksMovementAt,
    };
    world.add(collider);
    assert.equal(world.surfaceHeightAt(0, 0), 3);
    assert.equal(world.isBlocked(0, 0, 0.18, 3, 0.22), true);
    assert.equal(world.isMovementBlocked(-0.1, 0, 0, 0, 0.18, 3, 0.22), true);
  });
