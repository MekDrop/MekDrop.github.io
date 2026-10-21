import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { SurfaceSpatialIndex } from "../../../../../../src/game/objects/shared/SurfaceSpatialIndex.js";

// Exercise the production narrow phase without requiring a GPU/model loader.
const source = readFileSync(new URL("../../../../../../src/game/objects/castle/structure/CastleEntityBuilder.js", import.meta.url), "utf8");
const method = (signature) => {
  const start = source.indexOf(`  ${signature}`);

  return source.slice(start, source.indexOf("\n  /**", start));
};
const Collider = new Function("CASTLE_BLOCK_SIZE", `return class {
  #cameraCollisionIndex; #cameraCollisionBlocks; #animatedDoors = [];
  #audienceRoom = null; #stairs = null; #serviceStairs = null;
  #groundCollisionColumns = []; #position = { elevation: 2 };
  #buildPlan = { layout: { basePlanId: "authored" } };
  #residence = { blocksMovementAt: () => false };
  constructor(index, blocks) { this.#cameraCollisionIndex = index; this.#cameraCollisionBlocks = blocks; }
  get residence() { return this.#residence; }
  ${method("blocksMovementAt(")}
  ${method("intersectsGroundFootprint(")}
  ${method("#intersectsGroundColumns(")}
}`)(0.25);

it("preserves castle collision at every sampled level, radius, and masonry boundary", () => {
  const blocks = [];
  const index = new SurfaceSpatialIndex();
  for (let x = -8; x <= 8; x += 2) {
    for (let z = -8; z <= 8; z += 2) {
      const block = {
        x,
        y: 2 + ((x + z + 16) % 3),
        z,
        halfX: 0.75,
        halfY: 0.5,
        halfZ: 0.25,
      };
      blocks.push(block);
      index.add(block, {
        minX: x - block.halfX,
        maxX: x + block.halfX,
        minZ: z - block.halfZ,
        maxZ: z + block.halfZ,
      });
    }
  }
  const indexed = new Collider(index, blocks);
  const linear = new Collider({ query: () => blocks }, blocks);
  for (let x = -10; x <= 10; x += 0.25) {
    for (let z = -10; z <= 10; z += 0.25) {
      for (const radius of [0, 0.3, 1, 5]) {
        assert.equal(indexed.intersectsGroundFootprint(x, z, radius), linear.intersectsGroundFootprint(x, z, radius));
        for (const elevation of [1.5, 2, 2.75, 4]) {
          assert.equal(indexed.blocksMovementAt(x, z, radius, elevation, 0.05), linear.blocksMovementAt(x, z, radius, elevation, 0.05));
        }
      }
    }
  }
});
