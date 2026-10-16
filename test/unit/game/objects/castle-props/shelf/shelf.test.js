import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { IslandObjectRoots } from "../../../../../../src/game/objects/shared/IslandObjectRoots.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/castle-props/shelf/Shelf.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "");
const Shelf = new Function("storageUrl", "bookcaseUrl", "bookUrl", "IslandObjectRoots", "addGeneratedVoxelPhysics",
  source.replace("export class Shelf", "return class Shelf"))("storage", "bookcase", "book", IslandObjectRoots, createCollider);

/**
 * @param {{parent: pc.Entity, voxels: Array}} options
 */
function createCollider({ parent, voxels }) {
  const collider = new pc.Entity("collider");
  collider.voxels = voxels;
  collider.syncCount = 0;
  collider.rigidbody = {
    syncEntityToBody: () => {
      collider.syncCount++;
    },
  };
  parent.addChild(collider);

  return collider;
}

it("keeps storage artwork and collision together, replaces embedded supplies, and destroys its hierarchy", () => {
  for (const items of [undefined, [], [{ object: "Book" }]]) {
    const models = [];
    const shelf = new Shelf({
      pc,
      definition: {
        id: "storage",
        object: "Shelf",
        variant: "storage",
        position: {
          x: 10,
          y: 3,
          z: 20,
        },
        rotation: 270,
        collisionRotation: 90,
        scale: 0.75,
        footprint: {
          width: 0.225,
          depth: 0.6,
        },
        items,
      },
      modelLibrary: {
        instantiate: (url) => {
          assert.equal(url, "storage");
          const model = new pc.Entity("rack");
          for (const name of ["Shelf board", "Supply crate", "Crate iron band"]) {
            model.addChild(new pc.Entity(name));
          }
          models.push(model);

          return model;
        },
      },
    });
    const visual = shelf.visualRoots[0];
    assert.deepEqual(visual.getPosition(), new pc.Vec3(10, 3, 20));
    assert.equal(Math.round(visual.getEulerAngles().y), 90);
    assert.deepEqual(models[0].getLocalScale(), new pc.Vec3(0.75, 0.75, 0.75));
    assert.equal(Boolean(models[0].findByName("Supply crate")), items === undefined);
    assert.ok(models[0].findByName("Shelf board"));
    const collider = visual.children.find(child => child.name === "collider");
    assert.deepEqual(collider.voxels, [{
      x: 0,
      y: 0.375,
      z: 0,
      width: 0.225,
      height: 0.75,
      depth: 0.6,
    }]);
    shelf.onSceneReady();
    shelf.setIslandOffsets(2, 3);
    assert.equal(collider.syncCount, 2);
    shelf.destroy();
    assert.equal(shelf.entity.children.length, 0);
  }
});
