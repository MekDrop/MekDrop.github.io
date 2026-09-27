import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addHeroPartColliders } from "../../../../../src/game/objects/hero/HeroPartColliders.js";

class FakeVec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeEntity {
  children = [];
  components = new Map();
  position = new FakeVec3();

  constructor(name) {
    this.name = name;
  }

  addChild(child) {
    this.children.push(child);
  }

  addComponent(type, options) {
    this.components.set(type, options);
  }

  setLocalPosition(value) {
    this.position = new FakeVec3(value.x, value.y, value.z);
  }
}

function addMesh(part, center, halfExtents) {
  part.render = {
    meshInstances: [{ mesh: { aabb: { center, halfExtents } } }],
  };
}

describe("addHeroPartColliders", () => {
  it("fits upper-body boxes without adding stair-catching boot colliders", () => {
    const root = new FakeEntity("Hero model");
    const glove = new FakeEntity("Left white glove");
    const boot = new FakeEntity("Boot foot");
    const emptyJoint = new FakeEntity("Left arm joint");
    addMesh(glove, new FakeVec3(0.2, 0.1, -0.1), new FakeVec3(0.3, 0.2, 0.1));
    addMesh(boot, new FakeVec3(0, -0.2, 0.1), new FakeVec3(0.4, 0.08, 0.25));
    root.addChild(glove);
    root.addChild(emptyJoint);
    emptyJoint.addChild(boot);

    const colliders = addHeroPartColliders({
      pc: { Entity: FakeEntity, Vec3: FakeVec3 },
      modelRoot: root,
    });

    assert.equal(colliders.length, 1);
    assert.deepEqual(
      colliders.map(({ name }) => name).sort(),
      ["Hero Left white glove collider 1"],
    );
    assert.equal(glove.children.length, 1);
    assert.equal(boot.children.length, 0);
    assert.equal(emptyJoint.children.length, 1);
    assert.deepEqual(glove.children[0].position, new FakeVec3(0.2, 0.1, -0.1));
    assert.deepEqual(glove.children[0].components.get("collision"), {
      type: "box",
      halfExtents: new FakeVec3(0.3, 0.2, 0.1),
    });
  });

  it("gives flat mesh bounds a usable minimum thickness", () => {
    const root = new FakeEntity("Round face");
    addMesh(root, new FakeVec3(), new FakeVec3(0, 0.2, 0.001));

    addHeroPartColliders({
      pc: { Entity: FakeEntity, Vec3: FakeVec3 },
      modelRoot: root,
    });

    assert.deepEqual(root.children[0].components.get("collision"), {
      type: "box",
      halfExtents: new FakeVec3(0.01, 0.2, 0.01),
    });
  });
});
