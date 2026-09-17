import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { HeroPhysicsController } from
  "../../src/game/objects/hero/HeroPhysicsController.js";

const previousAmmo = globalThis.Ammo;

afterEach(() => {
  globalThis.Ammo = previousAmmo;
});

class FakeVec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new FakeVec3(this.x, this.y, this.z);
  }
}

class FakeAmmoVector {
  constructor(x, y, z) {
    this.setValue(x, y, z);
  }

  setValue(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeRigidBody {
  activateCount = 0;
  gravityCalls = [];
  linearVelocity = new FakeVec3();
  teleportCalls = [];

  body = {
    setGravity: (value) => {
      this.gravityCalls.push(new FakeVec3(value.x, value.y, value.z));
    },
  };

  activate() {
    this.activateCount += 1;
  }

  teleport(x, y, z) {
    this.teleportCalls.push(new FakeVec3(x, y, z));
  }
}

class FakeEntity {
  components = new Map();
  position = new FakeVec3(2, 3, 4);
  rigidbody = null;

  addComponent(type, options) {
    this.components.set(type, options);
    if (type === "rigidbody") {
      this.rigidbody = new FakeRigidBody();
      Object.assign(this.rigidbody, options);
    }
  }

  getLocalPosition() {
    return this.position;
  }

  setLocalPosition(x, y, z) {
    this.position = new FakeVec3(x, y, z);
  }
}

function createFixture({ maxSubSteps = 4, fixedTimeStep } = {}) {
  const destroyed = [];
  globalThis.Ammo = {
    btVector3: FakeAmmoVector,
    destroy(value) {
      destroyed.push(value);
    },
  };
  const raycasts = [];
  const rigidbody = {
    fixedTimeStep: 1 / 30,
    maxSubSteps,
    raycastAll(start, end, options) {
      raycasts.push({ start, end, options });
      return [];
    },
  };
  const app = { systems: { rigidbody } };
  const entity = new FakeEntity();
  const controller = new HeroPhysicsController({
    pc: { Vec3: FakeVec3 },
    app,
    entity,
    radius: 0.31,
    height: 1.44,
    gravity: -18,
    ...(fixedTimeStep === undefined ? {} : { fixedTimeStep }),
  });
  return { app, controller, destroyed, entity, raycasts };
}

describe("HeroPhysicsController", () => {
  it("configures the fixed step and creates an upright dynamic capsule", () => {
    const { app, controller, entity } = createFixture();

    assert.equal(app.systems.rigidbody.fixedTimeStep, 1 / 120);
    assert.equal(app.systems.rigidbody.maxSubSteps, 12);
    assert.deepEqual(entity.components.get("collision"), {
      type: "capsule",
      axis: 1,
      radius: 0.31,
      height: 1.44,
      linearOffset: new FakeVec3(0, 0.72, 0),
    });
    assert.deepEqual(entity.components.get("rigidbody"), {
      type: "dynamic",
      mass: 1,
      friction: 0,
      restitution: 0,
      linearDamping: 0,
      angularDamping: 1,
      linearFactor: new FakeVec3(1, 1, 1),
      angularFactor: new FakeVec3(0, 0, 0),
    });
    assert.deepEqual(entity.rigidbody.gravityCalls, [new FakeVec3(0, -18, 0)]);
    assert.equal(entity.rigidbody.activateCount, 1);

    controller.destroy();
  });

  it("accepts an explicit fixed step without reducing a larger substep budget", () => {
    const { app, controller } = createFixture({
      fixedTimeStep: 1 / 90,
      maxSubSteps: 20,
    });

    assert.equal(app.systems.rigidbody.fixedTimeStep, 1 / 90);
    assert.equal(app.systems.rigidbody.maxSubSteps, 20);

    controller.destroy();
  });

  it("writes velocity, teleports, and switches cleanly through scripted motion", () => {
    const { controller, entity } = createFixture();
    const rigidbody = entity.rigidbody;

    controller.velocity = { x: 5, y: 6, z: 7 };
    assert.deepEqual(rigidbody.linearVelocity, new FakeVec3(5, 6, 7));
    assert.equal(rigidbody.activateCount, 2);

    controller.teleport({ x: 8, y: 9, z: 10 });
    assert.deepEqual(rigidbody.teleportCalls, [new FakeVec3(8, 9, 10)]);
    assert.deepEqual(controller.velocity, { x: 5, y: 6, z: 7 });

    controller.setScripted(
      { x: 11, y: 12, z: 13 },
      { x: -1, y: -2, z: -3 },
    );
    assert.equal(controller.scripted, true);
    assert.equal(rigidbody.type, "kinematic");
    assert.deepEqual(controller.position, { x: 11, y: 12, z: 13 });
    assert.deepEqual(controller.velocity, { x: -1, y: -2, z: -3 });

    controller.resume(
      { x: 14, y: 15, z: 16 },
      { x: 1, y: 2, z: 3 },
    );
    assert.equal(controller.scripted, false);
    assert.equal(rigidbody.type, "dynamic");
    assert.deepEqual(rigidbody.teleportCalls.at(-1), new FakeVec3(14, 15, 16));
    assert.deepEqual(controller.velocity, { x: 1, y: 2, z: 3 });
    assert.deepEqual(rigidbody.gravityCalls.at(-1), new FakeVec3(0, -18, 0));

    controller.destroy();
  });

  it("filters its own body and returns the first sufficiently upward surface", () => {
    const { app, controller, entity, raycasts } = createFixture();
    const wall = {
      entity: { name: "wall" },
      normal: new FakeVec3(0.94, 0.34, 0),
      point: new FakeVec3(4, 7, 6),
    };
    const floor = {
      entity: { name: "floor" },
      normal: { x: 0.1, y: 0.8, z: 0.2 },
      point: { x: 4, y: 5.5, z: 6 },
    };
    app.systems.rigidbody.raycastAll = (start, end, options) => {
      raycasts.push({ start, end, options });
      return [wall, floor];
    };

    const surface = controller.surfaceAt(4, 6, 9, 2);
    const [{ start, end, options }] = raycasts;

    assert.deepEqual(start, new FakeVec3(4, 9, 6));
    assert.deepEqual(end, new FakeVec3(4, 2, 6));
    assert.equal(options.sort, true);
    assert.equal(options.filterCallback(entity), false);
    assert.equal(options.filterCallback(floor.entity), true);
    assert.deepEqual(surface, {
      entity: floor.entity,
      height: 5.5,
      normal: new FakeVec3(0.1, 0.8, 0.2),
      point: new FakeVec3(4, 5.5, 6),
    });

    controller.destroy();
  });

  it("reports ground only inside the short downward contact probe", () => {
    const { app, controller } = createFixture();
    const floor = {
      entity: { name: "floor" },
      normal: new FakeVec3(0, 1, 0),
      point: new FakeVec3(2, 2.85, 4),
    };
    app.systems.rigidbody.raycastAll = () => [floor];

    assert.equal(controller.groundContact()?.height, 2.85);

    floor.point.y = 2.839;
    assert.equal(controller.groundContact(), null);

    controller.destroy();
  });

  it("reuses and destroys its per-body Ammo gravity vector", () => {
    const { controller, destroyed, entity } = createFixture();
    const rigidbody = entity.rigidbody;

    controller.gravity = -24;
    assert.deepEqual(rigidbody.gravityCalls, [
      new FakeVec3(0, -18, 0),
      new FakeVec3(0, -24, 0),
    ]);

    controller.destroy();
    assert.equal(destroyed.length, 1);
    assert.ok(destroyed[0] instanceof FakeAmmoVector);
    assert.deepEqual(destroyed[0], new FakeAmmoVector(0, -24, 0));

    controller.destroy();
    assert.equal(destroyed.length, 1);
  });
});
