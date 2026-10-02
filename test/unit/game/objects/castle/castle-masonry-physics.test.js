import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { createCastleMasonryVoxels } from "../../../../../src/game/objects/castle/CastleMasonryPhysics.js";

it("merges solid masonry without changing its occupied volume or doorway openings", async () => {
  const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
    doors: [{ side: "NORTH", offset: 3, width: 2 }], style: "twin-tower", seed: "rooms" });
  const blocks = plan.metadata.collision.cameraBlocks;
  const solids = createCastleMasonryVoxels(blocks);
  assert.ok(solids.length < blocks.length / 10);
  const originalVolume = blocks.reduce((sum, box) => sum + box.halfX * box.halfY * box.halfZ * 8, 0);
  const mergedVolume = solids.reduce((sum, box) => sum + box.width * box.height * box.depth, 0);
  assert.ok(Math.abs(mergedVolume - originalVolume) < 1e-6);
  for (const block of blocks) {
    assert.ok(solids.some((solid) => Math.abs(block.x - solid.x) + block.halfX <= solid.width / 2 + 1e-6 &&
      Math.abs(block.y - solid.y) + block.halfY <= solid.height / 2 + 1e-6 &&
      Math.abs(block.z - solid.z) + block.halfZ <= solid.depth / 2 + 1e-6));
  }
  for (const doorway of plan.layout.roomPlan.doorways) {
    const origin = plan.layout.roomPlan.origin;
    const x = origin.x + (doorway.axis === "x" ? doorway.coordinate : doorway.center);
    const z = origin.z + (doorway.axis === "z" ? doorway.coordinate : doorway.center);
    assert.equal(solids.some((solid) => Math.abs(x - solid.x) < solid.width / 2 - 1e-6 &&
      Math.abs(z - solid.z) < solid.depth / 2 - 1e-6 &&
      Math.abs(doorway.floorY + 1 - solid.y) < solid.height / 2 - 1e-6), false);
  }
});
