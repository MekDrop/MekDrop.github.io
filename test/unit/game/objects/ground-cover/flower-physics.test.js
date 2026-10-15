import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FlowerPhysics } from "../../../../../src/game/objects/ground-cover/FlowerPhysics.js";

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
  setFromDirections() { return this; }
  set(x, y, z, w) { Object.assign(this, { x, y, z, w }); return this; }
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
    if (type === "rigidbody") {
      this.rigidbody = { on() {}, syncEntityToBody() {}, teleport: (x, y, z) => this.setPosition(x, y, z) };
    }
  }

  setLocalPosition(x, y, z) {
    this.position.set(x, y, z);
  }

  setPosition(x, y, z) {
    if (typeof x === "object") { this.position.set(x.x, x.y, x.z); }
    else { this.position.set(x, y, z); }
  }

  setPositionAndRotation(position, rotation) {
    this.setPosition(position);
    this.rotation = rotation;
  }

  getLocalPosition() {
    return this.position;
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
  it("moves the spring support and instance matrix without accumulating offsets", () => {
    const physics = new FlowerPhysics({ pc });
    const flower = createFlower(physics);
    const storage = new Float32Array(16);
    physics.setBatch("daisy-patch", { lock: () => storage, unlock() {} });
    flower.body.setPosition(2, 3.18, 4);
    physics.setOffset(flower, 0.6);
    physics.updateMatrices();
    assert.equal(flower.anchor.getPosition().y, 3.6);
    assert.ok(Math.abs(storage[13] - 3.6) < 1e-6);
    physics.setOffset(flower, -0.2);
    physics.updateMatrices();
    assert.equal(flower.anchor.getPosition().y, 2.8);
    assert.ok(Math.abs(storage[13] - 2.8) < 1e-6);
    physics.setOffset(flower, 0);
    physics.updateMatrices();
    assert.ok(Math.abs(storage[13] - 3) < 1e-6);
  });
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
    assert.equal(anchor.components.get("joint").entityA, anchor);
    assert.equal(anchor.components.get("joint").entityB, body);
    assert.equal(anchor.components.get("rigidbody").type, "kinematic");
    assert.equal(anchor.components.get("rigidbody").mask, 0);
    assert.equal(anchor.components.get("joint").linearMotionY, "limited");
    assert.equal(anchor.components.get("joint").angularMotionX, "locked");
    assert.equal(anchor.components.get("joint").angularMotionY, "locked");
    assert.equal(flower.anchor, anchor);

    physics.updateHeroPosition(
      { x: 1, y: 2, z: 3 },
      { x: 0, z: 1 },
    );
    assert.deepEqual(leftFoot.position, new FakeVec3(0.893, 2.32, 3.076));
    assert.deepEqual(rightFoot.position, new FakeVec3(1.107, 2.32, 3.076));
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
  it("retains foot compression without rotating the petal plane into the hero", () => {
    const physics = new FlowerPhysics({ pc });
    const flower = createFlower(physics);
    const storage = new Float32Array(16);
    physics.setBatch("daisy-patch", { lock: () => storage, unlock() {} });
    // A compressed, laterally displaced tip must keep the visible canopy below
    // the sole, even when its direction would otherwise rotate the entire patch.
    flower.body.setPosition(2.1, 3.04, 4.08);
    physics.updateMatrices();
    assert.ok(0.1586 * storage[5] < 0.1, "petals must remain below the foot contact surface");
    assert.equal(storage[1], 0);
    assert.equal(storage[9], 0);
    assert.ok(storage[4] > 0 && storage[6] > 0, "stem should follow the simulated lateral displacement");
    assert.deepEqual(Array.from(storage.slice(12, 15)), [2, 3, 4]);
  });
  it("preserves outer petals and supplies contact poses immediately on spawn", () => {
    const physics = new FlowerPhysics({ pc });
    const flower = createFlower(physics);
    const storage = new Float32Array(16);
    physics.setBatch("daisy-patch", { lock: () => storage, unlock() {} });
    const contacts = new Map();
    physics.setContactMaterial({ setParameter: (name, value) => contacts.set(name, Array.from(value)) });
    flower.body.setPosition(2, 3.32, 4);
    // No solver step or worker response has occurred yet.
    physics.updateHeroPosition({ x: 2, y: 3, z: 4 });
    assert.ok(0.1586 * storage[5] > 0.08, "outer petals must remain visible above the grass");
    assert.ok(Math.abs(contacts.get("uFlowerFoot0")[1] - 3.02) < 1e-5, "shader receives the current sole boundary before a solver response");
    physics.updateHeroPosition({ x: 2, y: 3, z: 4 }, { x: 0, z: 0 });
    assert.deepEqual(contacts.get("uFlowerFootDirection"), [0, 1], "standing still must retain a valid local footprint");
    flower.body.setPosition(2, 3.18, 4);
    physics.updateMatrices();
    assert.ok(0.1586 * storage[5] > 0.08, "contact should retain surrounding petals even with a stale worker pose");
    physics.updateHeroPosition({ x: 4, y: 3, z: 4 });
    assert.ok(storage[5] > 0.9, "a released flower must follow its simulated pose again");
  });
});

class FakeWorker {
  static current;
  messages = [];
  terminated = false;
  constructor() { FakeWorker.current = this; }
  postMessage(message) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  emit(data) { this.onmessage({ data }); }
}

describe("flower worker lifecycle", () => {
  it("bounds outstanding requests and adjusts delayed poses to current island offsets", () => {
    const originalWorker = globalThis.Worker;
    globalThis.Worker = FakeWorker;
    try {
      const physics = new FlowerPhysics({ pc, useWorker: true });
      const flower = createFlower(physics);
      const storage = new Float32Array(16);
      physics.setBatch("daisy-patch", { lock: () => storage, unlock() {} });
      physics.advance(1 / 60);
      const worker = FakeWorker.current;
      assert.equal(worker.messages[0].type, "initialize");
      worker.emit({ type: "ready" });
      assert.equal(physics.entity.enabled, false);
      physics.advance(1 / 60);
      physics.advance(1 / 60);
      assert.equal(worker.messages.filter(m => m.type === "step").length, 1);
      physics.setOffset(flower, 0.3);
      worker.emit({ type: "result", transforms: new Float32Array([2, 3.18, 4, 0, 0, 0, 1]) });
      physics.advance(1 / 60);
      assert.ok(Math.abs(storage[13] - 3.3) < 1e-5);
      physics.hide(flower);
      worker.emit({ type: "result", transforms: new Float32Array([2, 3.18, 4, 0, 0, 0, 1]) });
      physics.advance(1 / 60);
      assert.equal(storage[0], 0);
      assert.equal(worker.messages.at(-1).hidden[0], 1);
      physics.destroy();
      assert.equal(worker.terminated, true);
    } finally { globalThis.Worker = originalWorker; }
  });
  it("restores main-thread simulation when the worker fails", () => {
    const originalWorker = globalThis.Worker;
    const originalWarn = console.warn;
    globalThis.Worker = FakeWorker;
    console.warn = () => {};
    try {
      const physics = new FlowerPhysics({ pc, useWorker: true });
      createFlower(physics);
      physics.advance(1 / 60);
      const worker = FakeWorker.current;
      worker.emit({ type: "ready" });
      let prevented = false;
      worker.onerror({ message: "test failure", preventDefault() { prevented = true; } });
      assert.equal(prevented, true);
      assert.equal(physics.entity.enabled, true);
      assert.equal(worker.terminated, true);
      physics.advance(1 / 60);
      assert.equal(FakeWorker.current, worker);
      physics.destroy();
    } finally { globalThis.Worker = originalWorker; console.warn = originalWarn; }
  });
});
