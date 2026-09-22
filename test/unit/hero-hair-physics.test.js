import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { HeroHairPhysics } from "../../src/game/objects/hero/HeroHairPhysics.js";

const originalAmmo = globalThis.Ammo;

afterEach(() => {
  globalThis.Ammo = originalAmmo;
});

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
}

class FakeQuat {}

class FakeEntity {
  children = [];
  components = new Map();
  position = new FakeVec3();
  rotation = new FakeQuat();
  destroyed = false;

  constructor(name) {
    this.name = name;
  }

  addChild(child) {
    this.children.push(child);
  }

  addComponent(type, options) {
    this.components.set(type, options);
    if (type === "rigidbody") {
      const entity = this;
      this.rigidbody = {
        activated: 0,
        body: {
          setGravity(gravity) {
            entity.gravity = gravity;
          },
        },
        activate() {
          this.activated += 1;
        },
        teleport(position, rotation) {
          entity.setPosition(position);
          entity.setRotation(rotation);
        },
      };
    }
  }

  setPosition(positionOrX, y, z) {
    if (y === undefined) {
      this.position.set(positionOrX.x, positionOrX.y, positionOrX.z);
      return;
    }
    this.position.set(positionOrX, y, z);
  }

  getPosition() {
    return this.position;
  }

  setRotation(rotation) {
    this.rotation = rotation;
  }

  getRotation() {
    return this.rotation;
  }

  destroy() {
    this.destroyed = true;
  }
}

class FakeHairEntity {
  constructor(name, position) {
    this.name = name;
    this.position = { ...position };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
  }

  getLocalPosition() {
    return this.position;
  }

  getLocalEulerAngles() {
    return this.rotation;
  }

  getLocalScale() {
    return this.scale;
  }

  setLocalPosition(x, y, z) {
    this.position = { x, y, z };
  }

  setLocalEulerAngles(x, y, z) {
    this.rotation = { x, y, z };
  }

  setLocalScale(x, y, z) {
    this.scale = { x, y, z };
  }
}

class FakeHeadEntity extends FakeEntity {
  up = new FakeVec3(0, 1, 0);

  getWorldTransform() {
    return {
      transformPoint: (point, target) => target.set(
        this.position.x + point.x,
        this.position.y + point.y,
        this.position.z + point.z,
      ),
    };
  }
}

const pc = {
  BODYGROUP_USER_3: 512,
  BODYGROUP_USER_4: 1024,
  BODYMASK_NONE: 0,
  BODYTYPE_DYNAMIC: "dynamic",
  BODYTYPE_KINEMATIC: "kinematic",
  Entity: FakeEntity,
  JOINTTYPE_6DOF: "6dof",
  MOTION_LIMITED: "limited",
  MOTION_LOCKED: "locked",
  Vec3: FakeVec3,
};

function createPhysics(hairEntities) {
  const root = new FakeEntity("App root");
  const head = new FakeHeadEntity("Hero head");
  head.setPosition(2, 3, 4);
  const physics = new HeroHairPhysics({
    pc,
    app: { root },
    headEntity: head,
    hairEntities,
    modelScale: 0.65,
  });
  return { head, physics, root };
}

describe("HeroHairPhysics", () => {
  it("uses isolated Ammo bodies and a 6-DOF spring joint", () => {
    const destroyed = [];
    globalThis.Ammo = {
      btVector3: class extends FakeVec3 {},
      destroy: (value) => destroyed.push(value),
    };
    const cap = new FakeHairEntity("Bright cyan hair cap", {
      x: 0,
      y: 0.67,
      z: -0.035,
    });
    const { physics, root } = createPhysics([cap]);
    const [physicsRoot] = root.children;
    const [anchor, driver, joint] = physicsRoot.children;

    assert.equal(anchor.components.get("rigidbody").type, "kinematic");
    assert.equal(anchor.components.get("rigidbody").mask, 0);
    assert.equal(driver.components.get("rigidbody").type, "dynamic");
    assert.equal(driver.components.get("rigidbody").group, 512);
    assert.equal(driver.components.get("rigidbody").mask, 1024);
    assert.equal(driver.components.get("collision").type, "sphere");
    assert.equal(joint.components.get("joint").type, "6dof");
    assert.equal(joint.components.get("joint").entityA, driver);
    assert.equal(joint.components.get("joint").entityB, anchor);
    assert.equal(joint.components.get("joint").linearMotionY, "limited");
    assert.equal(joint.components.get("joint").angularMotionY, "locked");
    assert.deepEqual(physics.state, { compression: 0, engine: "ammo" });
    assert.equal(driver.gravity.x, 0);
    assert.equal(driver.gravity.y, 0);
    assert.equal(driver.gravity.z, 0);

    physics.destroy();
    assert.equal(physicsRoot.destroyed, true);
    assert.equal(destroyed.length, 1);
  });

  it("drives hair deformation from the Ammo body's displacement", () => {
    const cap = new FakeHairEntity("Bright cyan hair cap", {
      x: 0,
      y: 0.67,
      z: -0.035,
    });
    const { physics, root } = createPhysics([cap]);
    const [, driver] = root.children[0].children;

    driver.position.y -= 0.04;
    physics.update();

    assert.equal(physics.state.engine, "ammo");
    assert.ok(physics.state.compression > 0.06);
    assert.ok(cap.position.y < 0.62);
    assert.ok(cap.scale.y < 0.94);
    assert.ok(cap.scale.x > 1);
  });

  it("teleports the driver on a large hero relocation and restores authored hair", () => {
    const lock = new FakeHairEntity("Left cyan layered lock 0", {
      x: -0.385,
      y: 0.4,
      z: 0.2,
    });
    lock.rotation = { x: 1, y: 2, z: 3 };
    lock.scale = { x: 0.9, y: 1.1, z: 1.2 };
    const { head, physics, root } = createPhysics([lock]);
    const [, driver] = root.children[0].children;
    driver.position.y -= 0.04;
    physics.update();

    head.position.x += 2;
    physics.update();
    assert.equal(driver.position.x, head.position.x);
    assert.equal(driver.rigidbody.activated, 2);

    physics.destroy();
    assert.deepEqual(lock.position, { x: -0.385, y: 0.4, z: 0.2 });
    assert.deepEqual(lock.rotation, { x: 1, y: 2, z: 3 });
    assert.deepEqual(lock.scale, { x: 0.9, y: 1.1, z: 1.2 });
  });
});
