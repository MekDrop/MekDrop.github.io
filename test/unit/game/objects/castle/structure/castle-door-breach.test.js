import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleWindowLayout } from "../../../../../../src/game/objects/castle/structure/CastleWindowLayout.js";
import { createCastleMasonryVoxels } from "../../../../../../src/game/objects/castle/structure/CastleMasonryPhysics.js";

it("widens the real narrow throne doorway in matching visual and physics boxes", async () => {
  const plan = await CastleGenerator.generate({
    position: {
      x: -14.53846153846154,
      z: -6,
      width: 28,
      depth: 16,
      elevation: 2,
    },
    doors: [{
      side: "NORTH",
      offset: 13.53846153846154,
      width: 2,
    }],
    seed: 1,
  });
  const door = plan.metadata.runtime.roomDoors.find((entry) => entry.roomId === "throne-hall");
  assert.equal(door.width, 1);
  const cut = {
    minX: door.x - 0.8,
    maxX: door.x + 0.8,
    minY: door.y + 0.025,
    maxY: door.y + 2.35,
    minZ: door.z - 1.5,
    maxZ: door.z + 1.5,
  };
  const original = JSON.stringify(plan);
  const windows = new CastleWindowLayout(plan);
  const visuals = CastleWindowLayout.subtractBoxes(windows.cutBoxes(plan.geometry.boxes), [cut]);
  const collisions = plan.metadata.collision.cameraBlocks.map((block) => ({
    ...block,
    sx: block.halfX * 2,
    sy: block.halfY * 2,
    sz: block.halfZ * 2,
    yaw: 0,
  }));
  const cutCollisions = CastleWindowLayout.subtractBoxes(collisions, [cut]);
  for (const boxes of [visuals, cutCollisions]) {
    assert.ok(boxes.every((box) => !CastleWindowLayout.intersects(CastleWindowLayout.bounds(box), cut)));
    assert.ok(boxes.every((box) => box.sx > 0 && box.sy > 0 && box.sz > 0));
    assert.ok(boxes.some((box) => CastleWindowLayout.bounds(box).maxY > cut.maxY + 0.5));
  }
  const native = createCastleMasonryVoxels(cutCollisions.map((box) => ({
    x: box.x,
    y: box.y,
    z: box.z,
    halfX: box.sx / 2,
    halfY: box.sy / 2,
    halfZ: box.sz / 2,
  })));
  assert.ok(native.every((box) => !CastleWindowLayout.intersects(CastleWindowLayout.bounds({
    ...box,
    sx: box.width,
    sy: box.height,
    sz: box.depth,
    yaw: 0,
  }), cut)));
  assert.equal(JSON.stringify(plan), original);
});
