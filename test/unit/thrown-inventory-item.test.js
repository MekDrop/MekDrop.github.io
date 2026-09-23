import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ThrownInventoryItem } from "../../src/game/objects/inventory/ThrownInventoryItem.js";

class FakeVec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeQuat {
  transformVector(vector, target) {
    target.x = vector.x;
    target.y = vector.y;
    target.z = vector.z;
    return target;
  }
}

class FakeRigidBody {
  linearVelocity = null;
  angularVelocity = null;
  events = new Map();

  on(event, callback) {
    this.events.set(event, callback);
  }

  off(event, callback) {
    if (this.events.get(event) === callback) {
      this.events.delete(event);
    }
  }

  fire(event, value) {
    this.events.get(event)?.(value);
  }
}

class FakeEntity {
  children = [];
  components = new Map();
  position = new FakeVec3();
  eulerAngles = new FakeVec3();
  rigidbody = null;

  constructor(name) {
    this.name = name;
  }

  addChild(child) {
    this.children.push(child);
  }

  addComponent(type, options) {
    this.components.set(type, options);
    if (type === "rigidbody") {
      this.rigidbody = new FakeRigidBody();
    }
  }

  setLocalPosition(x, y, z) {
    this.position = new FakeVec3(x, y, z);
  }

  setLocalEulerAngles(x, y, z) {
    this.eulerAngles = new FakeVec3(x, y, z);
  }

  getPosition() {
    return this.position;
  }

  getRotation() {
    return new FakeQuat();
  }

  destroy() {}
}

function createMaterial() {
  return {
    blendType: null,
    opacity: 1,
    clone() {
      return createMaterial();
    },
    destroy() {},
    update() {},
  };
}

const pc = {
  BLEND_NORMAL: "normal",
  BODYGROUP_USER_3: 512,
  BODYGROUP_USER_4: 1024,
  BODYTYPE_DYNAMIC: "dynamic",
  BODYTYPE_STATIC: "static",
  Entity: FakeEntity,
  Vec3: FakeVec3,
};

function createThrownItem(direction = { x: 3, z: 4 }) {
  const material = createMaterial();
  const renders = [{ meshInstances: [{ material }, { material }] }];
  const model = new FakeEntity("inventory model");
  model.findComponents = () => renders;
  const thrownItem = new ThrownInventoryItem({
    pc,
    modelLibrary: { instantiate: () => model },
    item: { modelUrl: "item.glb", variant: "red-mushroom" },
    position: { x: 2, y: 3, z: 5 },
    direction,
  });
  return { thrownItem, material: renders[0].meshInstances[0].material, model };
}

function createDroppedItem(direction = { x: 3, z: 4 }) {
  const material = createMaterial();
  const renders = [{ meshInstances: [{ material }, { material }] }];
  const model = new FakeEntity("inventory model");
  model.findComponents = () => renders;
  const thrownItem = new ThrownInventoryItem({
    pc,
    modelLibrary: { instantiate: () => model },
    item: { modelUrl: "item.glb", variant: "red-mushroom" },
    position: { x: 2, y: 3, z: 5 },
    direction,
    dropped: true,
  });
  return { thrownItem, material: renders[0].meshInstances[0].material, model };
}

describe("thrown inventory item", () => {
  it("delegates ballistic movement, bouncing, damping, and settling to Ammo", () => {
    const { thrownItem, model } = createThrownItem();
    const [body, floor] = thrownItem.entity.children;

    assert.equal(body.children[0], model);
    assert.deepEqual(body.position, new FakeVec3(2, 3.86, 5));
    assert.deepEqual(body.eulerAngles, new FakeVec3(-18, 24, 12));
    assert.deepEqual(body.components.get("collision"), {
      type: "box",
      halfExtents: new FakeVec3(0.12, 0.1, 0.12),
      linearOffset: new FakeVec3(0, 0.1, 0),
    });
    assert.deepEqual(body.components.get("rigidbody"), {
      type: "dynamic",
      mass: 0.08,
      friction: 0.74,
      rollingFriction: 0.3,
      restitution: 0.28,
      linearDamping: 0.08,
      angularDamping: 0.48,
      group: 512,
      mask: 1024,
    });
    assert.deepEqual(
      body.rigidbody.linearVelocity,
      new FakeVec3(0.87, 3.15, 1.16),
    );
    assert.ok(
      Math.abs(body.rigidbody.angularVelocity.x - 5.410520681182422) < 1e-12,
    );
    assert.ok(
      Math.abs(body.rigidbody.angularVelocity.y - 3.839724354387525) < 1e-12,
    );
    assert.ok(
      Math.abs(body.rigidbody.angularVelocity.z + 4.71238898038469) < 1e-12,
    );

    assert.deepEqual(floor.position, new FakeVec3(2, 3.015, 5));
    assert.deepEqual(floor.components.get("collision"), {
      type: "box",
      halfExtents: new FakeVec3(3, 0.025, 3),
    });
    assert.deepEqual(floor.components.get("rigidbody"), {
      type: "static",
      friction: 0.86,
      restitution: 0.28,
      group: 1024,
      mask: 512,
    });
  });

  it("keeps fading independent from the physics simulation", () => {
    const { thrownItem, material } = createThrownItem({ x: 0, z: 0 });

    thrownItem.advance(1);
    assert.equal(thrownItem.expired, false);

    thrownItem.beginFade();
    thrownItem.advance(0.12);
    assert.equal(thrownItem.expired, false);
    assert.ok(material.opacity < 1);

    thrownItem.advance(0.12);
    thrownItem.advance(0.12);
    assert.equal(thrownItem.expired, true);
    assert.equal(material.opacity, 0);
  });

  it("can drop downward without a launch impulse", () => {
    const { thrownItem } = createDroppedItem();
    const [body] = thrownItem.entity.children;

    assert.deepEqual(body.position, new FakeVec3(2, 3.85, 5));
    assert.deepEqual(body.rigidbody.linearVelocity, new FakeVec3(0, 0, 0));
    assert.deepEqual(body.rigidbody.angularVelocity, new FakeVec3(0, 0, 0));

    assert.deepEqual(thrownItem.grassImpressionContacts, []);

    body.position = new FakeVec3(2, 3.04, 5);
    body.rigidbody.fire("collisionstart", {
      other: thrownItem.entity.children[1],
    });
    const [contact] = thrownItem.grassImpressionContacts;
    assert.equal(contact.x, 2);
    assert.equal(contact.y, 3.004);
    assert.equal(contact.z, 5);
  });

  it("exposes a grass impression driven by the Ammo body transform", () => {
    const { thrownItem } = createThrownItem();
    const [body] = thrownItem.entity.children;

    assert.deepEqual(thrownItem.grassImpressionContacts, []);

    body.position = new FakeVec3(2.2, 3.04, 5.1);
    body.rigidbody.fire("collisionstart", { other: thrownItem.entity.children[1] });
    const [contact] = thrownItem.grassImpressionContacts;
    assert.equal(contact.id, thrownItem);
    assert.equal(contact.x, 2.2);
    assert.equal(contact.y, 3.004);
    assert.equal(contact.z, 5.1);
    assert.equal(contact.directionX, 0);
    assert.equal(contact.directionZ, 1);
    assert.equal(contact.halfWidth, 0.16);
    assert.equal(contact.halfLength, 0.16);
    assert.equal(contact.strength, 1);

    body.rigidbody.fire("collisionend", thrownItem.entity.children[1]);
    assert.deepEqual(thrownItem.grassImpressionContacts, []);
  });
});
