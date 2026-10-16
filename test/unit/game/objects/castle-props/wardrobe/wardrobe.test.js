import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";

const source = readFileSync(new URL("../../../../../../src/game/objects/castle-props/wardrobe/Wardrobe.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "");

/**
 * Rendering-free lifecycle harness; use real engine transforms for collision queries.
 */
class PropBase {
  /**
   * @param {{definition: import("../../../../../../src/game/objects/ObjectTypes.js").MapObjectDefinition}} options
   */
  constructor({ definition }) {
    this.definition = definition;
    this.entity = new pc.Entity();
    this.entity.setLocalPosition(definition.position.x, definition.position.y, definition.position.z);
    this.entity.setLocalEulerAngles(0, definition.rotation ?? 0, 0);
    this.visualRoots = [this.entity];
    this.selectedModel = this.modelUrl;
  }
  /**
   * @param {number} near
   */
  setIslandOffsets(near) { this.entity.setLocalPosition(10, 3 + near, 20); }
  onSceneReady() {}
}

/**
 * @param {{parent: pc.Entity, voxels: Array, friction: number}} options
 */
function createCollider({ parent, voxels, friction }) {
  const collider = new pc.Entity();
  collider.voxels = voxels;
  collider.friction = friction;
  collider.syncCount = 0;
  collider.rigidbody = {
    syncEntityToBody() { collider.syncCount++; },
  };
  parent.addChild(collider);

  return collider;
}

const Wardrobe = new Function("AbstractCastleProp", "addGeneratedVoxelPhysics", "wardrobeUrl",
  `${source.replace("export class", "class")}\nreturn Wardrobe;`)(PropBase, createCollider, "wardrobe.glb");

for (const variant of ["wardrobe"]) {
  it(`keeps wardrobe model selection, vertical collision, heading and island movement together`, () => {
    const wardrobe = new Wardrobe({
      pc,
      definition: {
        id: "wardrobe",
        object: "Wardrobe",
        variant,
        position: {
          x: 10,
          y: 3,
          z: 20,
        },
        rotation: 90,
        collisionRotation: 0,
        scale: 0.8,
        footprint: {
          width: 1.6,
          depth: 0.72,
        },
      },
    });
    const collider = wardrobe.entity.children[0];
    const height = 1.15 * 0.8;
    assert.equal(wardrobe.selectedModel, `${variant}.glb`);
    assert.equal(collider.friction, 0.6);
    assert.deepEqual(collider.voxels, [{
      x: 0,
      y: height / 2,
      z: 0,
      width: 1.6,
      height,
      depth: 0.72,
    }]);
    assert.ok(wardrobe.blocksMovementAt(10.7, 20, 0.2, 3));
    assert.equal(wardrobe.blocksMovementAt(10, 20.7, 0.2, 3), false);
    assert.equal(wardrobe.blocksMovementAt(10, 20, 0.2, 3 + height), false);
    assert.equal(wardrobe.blocksMovementAt(10, 20, 0.2, 1), false);
    assert.ok(wardrobe.blocksCameraAt(10, 3 + height / 2, 20, 0.1));
    assert.equal(wardrobe.blocksCameraAt(10, 3 + height + 0.3, 20, 0.1), false);
    wardrobe.onSceneReady();
    wardrobe.setIslandOffsets(5, 5);
    assert.equal(collider.syncCount, 2);
    assert.equal(wardrobe.blocksMovementAt(10, 20, 0.2, 3), false);
    assert.ok(wardrobe.blocksMovementAt(10, 20, 0.2, 8));
    assert.equal(wardrobe.isGroundCollider, true);
    assert.equal(wardrobe.physicsSurface, false);
    wardrobe.entity.destroy();
  });
}
