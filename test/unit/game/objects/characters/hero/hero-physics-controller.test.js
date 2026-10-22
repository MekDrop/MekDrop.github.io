import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { HeroPhysicsController } from "../../../../../../src/game/objects/characters/hero/HeroPhysicsController.js";

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
  handlers = new Map();
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

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  off(event, handler) {
    if (this.handlers.get(event) === handler) {
      this.handlers.delete(event);
    }
  }

  fire(event, value) {
    this.handlers.get(event)?.(value);
  }

  teleport(x, y, z) {
    this.teleportCalls.push(new FakeVec3(x, y, z));
  }
}

class FakeEntity {
  children = [];
  components = new Map();
  position = new FakeVec3(2, 3, 4);
  rigidbody = null;

  constructor(name = "Hero") {
    this.name = name;
  }

  addChild(child) {
    this.children.push(child);
  }

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

  getPosition() {
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
    destroy: (value) => {
      destroyed.push(value);
    },
  };
  const raycasts = [];
  const rigidbody = {
    fixedTimeStep: 1 / 30,
    maxSubSteps,
    raycastAll: (start, end, options) => {
      raycasts.push({
        start,
        end,
        options,
      });

      return [];
    },
  };
  const app = { systems: { rigidbody } };
  const entity = new FakeEntity();
  const controller = new HeroPhysicsController({
    pc: {
      Entity: FakeEntity,
      Vec3: FakeVec3,
    },
    app,
    entity,
    radius: 0.31,
    height: 1.44,
    gravity: -18,
    ...(fixedTimeStep === undefined ? {} : { fixedTimeStep }),
  });

  return {
    app,
    controller,
    destroyed,
    entity,
    raycasts,
  };
}

describe("HeroPhysicsController", () => {
  it("scales body velocity and gravity while preserving logical velocity through suspension", () => {
    const { controller, entity } = createFixture();
    controller.velocity = {
      x: 4,
      y: 6,
      z: -2,
    };
    controller.localTimeScale = 0.5;
    assert.deepEqual(entity.rigidbody.linearVelocity, new FakeVec3(2, 3, -1));
    assert.deepEqual(controller.velocity, {
      x: 4,
      y: 6,
      z: -2,
    });
    assert.equal(entity.rigidbody.gravityCalls.at(-1).y, -4.5);
    controller.gravity = -10;
    assert.equal(entity.rigidbody.gravityCalls.at(-1).y, -2.5);
    controller.localTimeScale = 0;
    assert.deepEqual(entity.rigidbody.linearVelocity, new FakeVec3(0, 0, -0));
    assert.deepEqual(controller.velocity, {
      x: 4,
      y: 6,
      z: -2,
    });
    controller.localTimeScale = 1;
    assert.deepEqual(entity.rigidbody.linearVelocity, new FakeVec3(4, 6, -2));
    assert.equal(entity.rigidbody.gravityCalls.at(-1).y, -10);
    controller.destroy();
  });
  it("holds resting stepped supports with Ammo friction and releases grip for movement", () => {
    const { controller, entity } = createFixture();
    assert.equal(entity.rigidbody.friction, 0);
    controller.setSurfaceGrip(true);
    assert.equal(entity.rigidbody.friction, 2);
    controller.setSurfaceGrip(false);
    assert.equal(entity.rigidbody.friction, 0);
    controller.destroy();
  });
  it("retains animated eye motion when the view is clear", () => {
    const { controller, entity, raycasts } = createFixture();
    const anchor = {
      x: 2.15,
      y: 4.2,
      z: 4.1,
    };
    assert.deepEqual(controller.cameraPosition(anchor), anchor);
    const { start, options } = raycasts[0];
    assert.deepEqual(start, new FakeVec3(2, 3 + 1.44 / 2, 4));
    assert.equal(options.sort, true);
    assert.equal(options.filterCallback(entity), false);
    assert.equal(options.filterCallback({ parent: { parent: entity } }), false);
    assert.equal(options.filterCallback({ parent: null }), true);
    controller.destroy();
  });

  it("pulls eyes back before a stair wall or low ceiling in either travel direction", () => {
    for (const direction of [{
      x: 1,
      y: 0,
      z: 0,
    }, {
      x: 0,
      y: 0,
      z: -1,
    }, {
      x: 0,
      y: 1,
      z: 0,
    }]) {
      const { app, controller } = createFixture();
      const start = {
        x: 2,
        y: 3.72,
        z: 4,
      };
      const anchor = {
        x: start.x + direction.x * 0.3,
        y: start.y + direction.y * 0.3,
        z: start.z + direction.z * 0.3,
      };
      app.systems.rigidbody.raycastAll = () => [{
        point: {
          x: start.x + direction.x * 0.2,
          y: start.y + direction.y * 0.2,
          z: start.z + direction.z * 0.2,
        },
      }];
      const camera = controller.cameraPosition(anchor);
      const travel = Math.hypot(camera.x - start.x, camera.y - start.y, camera.z - start.z);
      assert.ok(Math.abs(travel - 0.16) < 1e-9);
      controller.destroy();
    }
  });

  it("keeps the near plane clear even when the eyes have not crossed a wall", () => {
    const { app, controller } = createFixture();
    app.systems.rigidbody.raycastAll = (start, end) => {
      assert.ok(end.x > 2.31);

      return [{
        point: {
          x: 2.31,
          y: 3.72,
          z: 4,
        },
      }];
    };
    const camera = controller.cameraPosition({
      x: 2.3,
      y: 3.72,
      z: 4,
    });
    assert.ok(Math.abs(camera.x - 2.27) < 1e-9);
    controller.destroy();
  });

  it("creates a compound body ready for fitted animated part colliders", () => {
    const { app, controller, entity } = createFixture();

    assert.equal(app.systems.rigidbody.fixedTimeStep, 1 / 60);
    assert.equal(app.systems.rigidbody.maxSubSteps, 12);
    assert.deepEqual(entity.components.get("collision"), {
      type: "compound",
    });
    assert.equal(entity.children.length, 1);
    assert.equal(entity.children[0].name, "Hero body collider");
    assert.deepEqual(entity.children[0].position, new FakeVec3(0, 0.72, 0));
    assert.deepEqual(entity.children[0].components.get("collision"), {
      type: "capsule",
      axis: 1,
      radius: 0.31,
      height: 1.44,
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

    controller.velocity = {
      x: 5,
      y: 6,
      z: 7,
    };
    assert.deepEqual(rigidbody.linearVelocity, new FakeVec3(5, 6, 7));
    assert.equal(rigidbody.activateCount, 2);

    controller.teleport({
      x: 8,
      y: 9,
      z: 10,
    });
    assert.deepEqual(rigidbody.teleportCalls, [new FakeVec3(8, 9, 10)]);
    assert.deepEqual(controller.velocity, {
      x: 5,
      y: 6,
      z: 7,
    });

    controller.setScripted({
      x: 11,
      y: 12,
      z: 13,
    }, {
      x: -1,
      y: -2,
      z: -3,
    });
    assert.equal(controller.scripted, true);
    assert.equal(rigidbody.type, "kinematic");
    assert.deepEqual(controller.position, {
      x: 11,
      y: 12,
      z: 13,
    });
    assert.deepEqual(controller.velocity, {
      x: -1,
      y: -2,
      z: -3,
    });

    controller.resume({
      x: 14,
      y: 15,
      z: 16,
    }, {
      x: 1,
      y: 2,
      z: 3,
    });
    assert.equal(controller.scripted, false);
    assert.equal(rigidbody.type, "dynamic");
    assert.deepEqual(rigidbody.teleportCalls.at(-1), new FakeVec3(14, 15, 16));
    assert.deepEqual(controller.velocity, {
      x: 1,
      y: 2,
      z: 3,
    });
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
      normal: {
        x: 0.1,
        y: 0.8,
        z: 0.2,
      },
      point: {
        x: 4,
        y: 5.5,
        z: 6,
      },
    };
    app.systems.rigidbody.raycastAll = (start, end, options) => {
      raycasts.push({
        start,
        end,
        options,
      });

      return [wall, floor];
    };

    const surface = controller.surfaceAt(4, 6, 9, 2);
    const [{ start, end, options }] = raycasts;

    assert.deepEqual(start, new FakeVec3(4, 9, 6));
    assert.deepEqual(end, new FakeVec3(4, 2, 6));
    assert.equal(options.sort, true);
    assert.equal(options.filterCallback(entity), false);
    assert.equal(options.filterCallback(floor.entity), true);
    assert.equal(
      options.filterCallback({
        tags: { has: (tag) => tag === "hero-surface-ignore" },
      }),
      false,
    );
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

  it("retains low upward contacts as exact physical support", () => {
    const { controller, entity } = createFixture();

    entity.rigidbody.fire("contact", {
      contacts: [
        {
          normal: new FakeVec3(1, 0, 0),
          point: new FakeVec3(2, 3, 4),
        },
        {
          normal: new FakeVec3(0, 1, 0),
          point: new FakeVec3(2, 3.31, 4),
        },
      ],
    });
    assert.equal(controller.consumeSupportContact(), false);

    entity.rigidbody.fire("contact", {
      contacts: [
        {
          normal: new FakeVec3(0, 1, 0),
          point: new FakeVec3(2, 3.2, 4),
        },
      ],
    });
    assert.equal(controller.consumeSupportContact(), true);
    assert.equal(controller.consumeSupportContact(), false);

    controller.destroy();
    assert.equal(entity.rigidbody.handlers.has("contact"), false);
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
