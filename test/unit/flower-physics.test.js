import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FlowerPhysics } from "../../src/game/objects/ground-cover/FlowerPhysics.js";

class FakeVec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  mulScalar(value) {
    this.x *= value;
    this.y *= value;
    this.z *= value;
    return this;
  }
}

class FakeQuat {
  setFromEulerAngles() {
    return this;
  }

  transformVector(vector, target) {
    return target.set(vector.x, vector.y, vector.z);
  }

  mul2() {
    return this;
  }
}

class FakeMat4 {
  data = new Float32Array(16);

  setTRS(position, _rotation, scale) {
    this.data.fill(0);
    this.data[0] = scale.x;
    this.data[5] = scale.y;
    this.data[10] = scale.z;
    this.data[12] = position.x;
    this.data[13] = position.y;
    this.data[14] = position.z;
    this.data[15] = 1;
    return this;
  }
}

class FakeEntity {
  children = [];
  components = new Map();
  enabled = true;
  position = new FakeVec3();
  rotation = new FakeQuat();

  constructor(name) {
    this.name = name;
  }

  addChild(child) {
    this.children.push(child);
  }

  addComponent(type, options) {
    this.components.set(type, options);
  }

  setLocalPosition(x, y, z) {
    this.position.set(x, y, z);
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
  }

  getPosition() {
    return this.position;
  }

  getRotation() {
    return this.rotation;
  }

  destroy() {}
}

const pc = {
  BODYGROUP_USER_1: 128,
  BODYGROUP_USER_2: 256,
  BODYTYPE_DYNAMIC: "dynamic",
  BODYTYPE_KINEMATIC: "kinematic",
  Entity: FakeEntity,
  JOINTTYPE_6DOF: "6dof",
  MOTION_LIMITED: "limited",
  MOTION_LOCKED: "locked",
  Mat4: FakeMat4,
  Quat: FakeQuat,
  Vec3: FakeVec3,
};

function createFlower(physics) {
  return physics.addFlower({
    variant: "daisy-patch",
    matrixIndex: 0,
    position: { x: 2, y: 3, z: 4 },
    rotation: 20,
    horizontalScale: 1.5,
    verticalScale: 2,
    interactionRadius: 0.38,
  });
}

describe("flower physics", () => {
  it("uses isolated Ammo bodies, spring joints, and kinematic feet", () => {
    const physics = new FlowerPhysics({ pc });
    const flower = createFlower(physics);
    const [leftFoot, rightFoot, anchor] = physics.entity.children;
    const [body] = anchor.children;

    assert.equal(leftFoot.components.get("rigidbody").type, "kinematic");
    assert.equal(rightFoot.components.get("rigidbody").type, "kinematic");
    assert.equal(leftFoot.components.get("rigidbody").group, 256);
    assert.equal(leftFoot.components.get("rigidbody").mask, 128);
    assert.equal(body.components.get("rigidbody").type, "dynamic");
    assert.equal(body.components.get("rigidbody").group, 128);
    assert.equal(body.components.get("rigidbody").mask, 256);
    assert.equal(anchor.components.get("joint").type, "6dof");
    assert.equal(anchor.components.get("joint").entityA, body);
    assert.equal(anchor.components.get("joint").linearMotionY, "limited");
    assert.equal(anchor.components.get("joint").angularMotionX, "limited");
    assert.equal(anchor.components.get("joint").angularMotionY, "locked");
    assert.equal(flower.anchor, anchor);

    physics.updateHeroPosition(
      { x: 1, y: 2, z: 3 },
      { x: 0, z: 1 },
    );
    assert.deepEqual(leftFoot.position, new FakeVec3(0.87, 2.16, 3.1));
    assert.deepEqual(rightFoot.position, new FakeVec3(1.13, 2.16, 3.1));
  });

  it("removes a collected flower from physics and its instance batch", () => {
    const physics = new FlowerPhysics({ pc });
    const flower = createFlower(physics);
    const storage = new Float32Array(16);
    let unlockCount = 0;
    physics.setBatch("daisy-patch", {
      lock: () => storage,
      unlock: () => {
        unlockCount += 1;
      },
    });

    physics.hide(flower);

    assert.equal(flower.anchor.enabled, false);
    assert.equal(storage[0], 0);
    assert.equal(storage[5], 0);
    assert.equal(storage[10], 0);
    assert.equal(unlockCount, 1);
  });
});
