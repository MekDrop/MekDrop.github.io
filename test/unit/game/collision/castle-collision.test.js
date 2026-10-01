import { createCastleStairFlight } from "../../../../src/game/objects/castle/CastleStairFlight.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { GroundCollisionWorld } from "../../../../src/game/collision/GroundCollisionWorld.js";
import { CASTLE_BOUNDARY } from "../../../../src/game/enum/CastleBoundary.js";

// Vite owns asset URL imports. Keep the real collision implementation while
// substituting only rendering imports that require a browser/GPU in Node.
const stairSource = readFileSync(new URL(
  "../../../../src/game/objects/castle/CastleStairs.js", import.meta.url,
), "utf8").replace(/^import \{ createCastleStairFlight \}[^\n]*\n/, `const createCastleStairFlight = ${createCastleStairFlight.toString()};\n`).replace(/^import stairModuleModelUrl[^\n]*\n/m, 'const stairModuleModelUrl = "stair-model";\n');
const { CastleStairs } = await import(
  `data:text/javascript;base64,${Buffer.from(stairSource).toString("base64")}`
);
const castleSource = readFileSync(new URL(
  "../../../../src/game/objects/castle/CastleEntityBuilder.js", import.meta.url,
), "utf8").replace(/^import[\s\S]*?from "[^"]+";\r?\n/gm, "");
const { CastleEntityBuilder } = await import(`data:text/javascript;base64,${Buffer.from(
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
      const level = Math.min(3, Math.floor(inward / 0.5));
      const height = 2 + (level + 1) * 0.25;
      assert.ok(Math.abs(flight.surfaceHeightAt(x, z) - height) < 1e-10);
      assert.equal(flight.blocksMovementAt(x, z, 0.18, height, 0.32), false);
      for (const direction of [-1, 1]) {
        // The hero also probes 0.28 units ahead of its current foot position.
        const probe = point(side, inward + direction * 0.31);
        assert.equal(flight.blocksMovementAt(...probe, 0.18, height, 0.32), false);
      }
    }
    flight.destroy();
  });

  it(`${side} stairs block a low actor at raised sides and use circular corner clearance`, () => {
    const flight = stairs(side);
    const sideContact = point(side, 1.8, 2.9);
    assert.equal(flight.blocksMovementAt(...sideContact, 0.18, 2, 0.32), true);
    assert.equal(flight.blocksMovementAt(...sideContact, 0.18, 3, 0.32), false);
    assert.equal(flight.surfaceHeightAt(...sideContact), null);
    const outsideRadius = point(side, 1.8, 2.7);
    assert.equal(flight.blocksMovementAt(...outsideRadius, 0.18, 2, 0.32), false);
    const outsideCorner = point(side, 2.15, 2.85);
    assert.equal(flight.blocksMovementAt(...outsideCorner, 0.18, 2, 0.32), false);
    const touchingCorner = point(side, 2.1, 2.9);
    assert.equal(flight.blocksMovementAt(...touchingCorner, 0.18, 2, 0.32), true);
    const entrance = point(side, -0.1);
    assert.equal(flight.blocksMovementAt(...entrance, 0.18, 2, 0.32), false);
    flight.destroy();
  });
}

it("keeps each support level under the full visible stair tread", () => {
  const flight = stairs("WEST");

  assert.equal(flight.surfaceHeightAt(...point("WEST", 0.001)), 2.25);
  assert.equal(flight.surfaceHeightAt(...point("WEST", 0.499)), 2.25);
  assert.equal(flight.surfaceHeightAt(...point("WEST", 0.501)), 2.5);
  flight.destroy();
});

it("a level entrance does not create invisible stairs or blocking surfaces", () => {
  const flight = stairs("WEST", 0);
  assert.equal(flight.surfaceHeightAt(-0.2, 4), null);
  assert.equal(flight.blocksMovementAt(-0.2, 4, 0.18, 2, 0.32), false);
  flight.destroy();
});


  it("castle solid footprints block movement even when the same collider supplies a low floor", () => {
    const world = new GroundCollisionWorld();
    // Exercise Castle's real solid-collision entry point without constructing
    // its rendering hierarchy. This branch must not consult a supporting floor.
    const collider = {
      intersectsGroundFootprint: () => true,
      surfaceHeightAt: () => 3,
      blocksMovementAt: CastleEntityBuilder.prototype.blocksMovementAt,
    };
    world.add(collider);
    assert.equal(world.surfaceHeightAt(0, 0), 3);
    assert.equal(world.isBlocked(0, 0, 0.18, 3, 0.22), true);
    assert.equal(world.isMovementBlocked(-0.1, 0, 0, 0, 0.18, 3, 0.22), true);
  });

it("fills the widened whole-cell excavation with rendered treads and matching support", () => {
  for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
    const door = { side, offset: 3, width: 2, approachElevation: 2 };
    const position = { x: 0, z: 0, width: 8, depth: 8, elevation: 3 };
    const bounds = createCastleStairFlight(position, door);
    assert.equal(bounds.width, 2);
    assert.equal(bounds.offset, door.offset, "The outer left strip remains grass");
    assert.equal(door.width, 2, "Widening the flight retains the doorway width");
    const acrossCenters = [];
    const flight = new CastleStairs({ pc, position, doors: [door], cubeSize: 0.25, materials: new Map(),
      modelLibrary: { instantiateMergedBatch: (_url, matrices) => {
        for (let offset = 0; offset < matrices.length; offset += 16) {
          acrossCenters.push(matrices[offset + (bounds.vertical ? 14 : 12)]);
        }
        return null;
      } },
    });
    assert.equal(Math.min(...acrossCenters) - 0.125, bounds.acrossStart);
    assert.equal(Math.max(...acrossCenters) + 0.125, bounds.acrossEnd);
    for (const across of [bounds.acrossStart + 0.01, bounds.acrossEnd - 0.01]) {
      const sample = point(side, 1.8, across);
      assert.equal(flight.surfaceHeightAt(...sample), 3);
      assert.equal(flight.blocksMovementAt(...sample, 0.18, 3, 0.32), false);
    }
    flight.destroy();
  }
  const service = createCastleStairFlight({ x: -6.5, z: -8.5, width: 12, depth: 11, elevation: 4 },
    { side: "EAST", offset: 8.25, width: 1, approachElevation: 2 });
  assert.equal(service.width, 2);
  assert.equal(service.offset, 8);
});

it("trims extra stair width before neighboring road and gate cells in every orientation", () => {
  for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
    for (const type of [2, 5]) {
      const position = { x: 0, z: 0, width: 8, depth: 8, elevation: 3 };
      const door = { side, offset: 3, width: 2, approachElevation: 2 };
      const grid = Array.from({ length: 32 }, () => Array(32).fill(1));
      const [x, z] = point(side, 1.5, 5.5);
      grid[Math.round(z + 15.5)][Math.round(x + 15.5)] = type;
      const layout = createCastleStairFlight(position, door, 0.25, { grid, cols: 32, rows: 32 });
      assert.equal(layout.width, 2);
      assert.equal(layout.acrossEnd, 5);
      assert.equal(layout.acrossStart, 3, "The left outer grass strip remains clear");
      door.stairOffset = layout.offset;
      door.stairWidth = layout.width;
      assert.deepEqual(createCastleStairFlight(position, door), layout, "Runtime uses the prepared footprint");
    }
  }
});

it("walks across ground-floor courtyard slabs while retaining walls and closed doors", async () => {
  const probeSource = castleSource.replace(/  constructor\(\{[\s\S]*?\n  get entity\(\)/, `
  constructor({ blocks, doors = [], residenceBlocked = false }) {
    this.#position = { elevation: 4 };
    this.#residence = { blocksMovementAt: () => residenceBlocked };
    this.#groundCollisionColumns = [{ x: 0, z: 0 }];
    this.#cameraCollisionBlocks = blocks;
    this.#animatedDoors = doors;
  }
  get entity()`);
  const { CastleEntityBuilder: ProbeCastle } = await import(`data:text/javascript;base64,${Buffer.from(
    `const CASTLE_BOUNDARY = ${JSON.stringify(CASTLE_BOUNDARY)};\n${probeSource}`,
  ).toString("base64")}`);
  const slab = { x: 0, y: 4.125, z: 0, halfX: 0.125, halfY: 0.125, halfZ: 0.125 };
  const castle = new ProbeCastle({ blocks: [slab] });
  assert.equal(castle.blocksMovementAt(0, 0, 0.18, 4, 0.32), false);
  assert.equal(new ProbeCastle({ blocks: [{ ...slab, y: 4.375 }] }).blocksMovementAt(0, 0, 0.18, 4, 0.32), true);
  assert.equal(new ProbeCastle({ blocks: [slab], doors: [{ blocksCameraAt: () => true }] }).blocksMovementAt(0, 0, 0.18, 4, 0.32), true);
  assert.equal(new ProbeCastle({ blocks: [slab], residenceBlocked: true }).blocksMovementAt(0, 0, 0.18, 4, 0.32), true);
});