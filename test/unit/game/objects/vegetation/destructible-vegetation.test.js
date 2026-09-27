import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DestructibleVegetation } from "../../../../../src/game/objects/vegetation/DestructibleVegetation.js";

function createEntity() {
  return {
    name: "Vegetation",
    children: [],
    addChild(child) {
      this.children.push(child);
    },
    setLocalPosition() {},
    setLocalEulerAngles() {},
    destroy() {},
  };
}

describe("destructible vegetation grass footprint", () => {
  it("weights only ground-contact voxels instead of their bounding rectangle", () => {
    const vegetation = new DestructibleVegetation({
      modelLibrary: { instantiate: () => createEntity() },
      modelUrl: "vegetation.glb",
      id: "test",
      variant: "test",
      kind: "bush",
      cutsRequired: 2,
      collisionRows: [
        { y: 0, cells: [[-1, 0], [1, 0]] },
        { y: 1, cells: [[0, 0]] },
      ],
      x: 2,
      y: 3,
      z: 4,
    });

    assert.equal(vegetation.grassWeightAt(1.75, 4, 3.002), 1);
    assert.equal(vegetation.grassWeightAt(2.25, 4, 3.002), 1);
    assert.equal(vegetation.grassWeightAt(2, 4, 3.002), 0);
    assert.equal(vegetation.grassWeightAt(1.75, 4, 4), 0);
  });

  it("builds Ammo bodies for every generated tree and bush voxel", () => {
    const physicsEntities = [];
    class PhysicsEntity {
      constructor(name) {
        this.name = name;
        this.children = [];
        this.components = {};
        this.tags = { add: (tag) => (this.tag = tag) };
        physicsEntities.push(this);
      }

      setLocalPosition(x, y, z) {
        this.position = { x, y, z };
      }

      setLocalEulerAngles(x, y, z) {
        this.rotation = { x, y, z };
      }

      addChild(child) {
        this.children.push(child);
      }

      addComponent(type, options) {
        this.components[type] = options;
      }

      destroy() {
        this.destroyed = true;
      }
    }
    class Vec3 {
      constructor(x, y, z) {
        Object.assign(this, { x, y, z });
      }
    }
    const vegetation = new DestructibleVegetation({
      pc: { Entity: PhysicsEntity, Vec3 },
      modelLibrary: { instantiate: () => createEntity() },
      modelUrl: "tree.glb",
      id: "test-tree",
      variant: "oak",
      kind: "tree",
      cutsRequired: 2,
      collisionRows: [
        { y: 0, cells: [[0, 0]] },
        { y: 1, cells: [[0, 0], [-1, 0], [1, 0], [0, -1]] },
      ],
      x: 0,
      y: 0,
      z: 0,
    });

    const collider = physicsEntities.find(
      ({ name }) => name === "Tree physics collider",
    );
    assert.equal(collider.name, "Tree physics collider");
    assert.equal(collider.tag, undefined);
    assert.equal(collider.components.collision.type, "compound");
    assert.equal(collider.children.length, 5);
    assert.deepEqual(
      collider.children.map(({ position }) => position),
      [
        { x: 0, y: 0.125, z: 0 },
        { x: 0, y: 0.375, z: 0 },
        { x: -0.25, y: 0.375, z: 0 },
        { x: 0.25, y: 0.375, z: 0 },
        { x: 0, y: 0.375, z: -0.25 },
      ],
    );
    assert.deepEqual({
      ...collider.children[0].components.collision.halfExtents,
    }, {
      x: 0.125,
      y: 0.125,
      z: 0.125,
    });
    assert.equal(collider.components.rigidbody.type, "static");
    assert.ok(vegetation.collisionDepthAt(0, 0, 0.18, 0, 0.22) > 0);
    assert.equal(
      vegetation.movementCollisionDepthAt(0, 0, 0.18, 0, 0.22),
      0,
    );

    const bush = new DestructibleVegetation({
      pc: { Entity: PhysicsEntity, Vec3 },
      modelLibrary: { instantiate: () => createEntity() },
      modelUrl: "bush.glb",
      id: "test-bush",
      variant: "round-bush",
      kind: "bush",
      cutsRequired: 1,
      collisionRows: [{ y: 0, cells: [[0, 0], [1, 0]] }],
      x: 0,
      y: 0,
      z: 0,
    });
    const bushCollider = physicsEntities.find(
      ({ name }) => name === "Bush physics collider",
    );
    assert.equal(bushCollider.components.collision.type, "compound");
    assert.equal(bushCollider.children.length, 2);
    assert.equal(bushCollider.components.rigidbody.type, "static");
    assert.equal(bush.movementCollisionDepthAt(0, 0, 0.18, 0, 0.22), 0);
  });
});
