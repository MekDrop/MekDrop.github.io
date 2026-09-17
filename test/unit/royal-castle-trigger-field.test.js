import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RoyalCastleTriggerField } from "../../src/game/debug/RoyalCastleTriggerField.js";

class FakeColor {
  fromString() {}

  copy() {}
}

class FakeMaterial {
  diffuse = new FakeColor();
  emissive = new FakeColor();

  update() {}

  destroy() {}
}

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

class FakeRigidBody {
  angularVelocity = new FakeVec3();
  forces = [];
  linearVelocity = new FakeVec3();
  torques = [];

  applyForce(...force) {
    this.forces.push(force);
  }

  applyTorque(...torque) {
    this.torques.push(torque);
  }
}

class FakeEntity {
  children = [];
  components = new Map();
  normal = new FakeVec3(0, 1, 0);
  position = new FakeVec3();

  constructor() {
    this.render = null;
    this.rigidbody = null;
  }

  addComponent(type, options) {
    this.components.set(type, options);
    if (type === "render") {
      this.render = { meshInstances: [{ material: null }] };
    }
    if (type === "rigidbody") {
      this.rigidbody = new FakeRigidBody();
    }
  }

  setLocalPosition(x, y, z) {
    this.position.set(x, y, z);
  }

  getPosition() {
    return this.position;
  }

  getRotation() {
    return {
      transformVector: (_up, target) => target.set(
        this.normal.x,
        this.normal.y,
        this.normal.z,
      ),
    };
  }

  setLocalScale() {}

  addChild(child) {
    this.children.push(child);
  }

  destroy() {}
}

const pc = {
  BODYTYPE_DYNAMIC: "dynamic",
  Color: FakeColor,
  Entity: FakeEntity,
  StandardMaterial: FakeMaterial,
  Vec3: FakeVec3,
};

describe("royal castle trigger grass physics", () => {
  it("contributes a light weight over the marker footprint", () => {
    const field = new RoyalCastleTriggerField({
      pc,
      triggers: [{ col: 2, row: 1 }],
      cols: 5,
      rows: 5,
      tileHeightAt: () => 2,
    });

    assert.equal(field.grassWeightAt(0, -1, 2.002), 0.01);
    assert.equal(field.grassWeightAt(0.5, -1, 2.002), 0);
    assert.equal(field.grassWeightAt(0, -1, 2.2), 0);
    field.destroy();
  });

  it("uses a dynamic cylinder and applies the hero load at the contact point", () => {
    let update = null;
    const app = {
      on(event, callback) {
        assert.equal(event, "update");
        update = callback;
        return { off() {} };
      },
    };
    const field = new RoyalCastleTriggerField({
      pc,
      app,
      triggers: [{ col: 2, row: 1 }],
      cols: 5,
      rows: 5,
      tileHeightAt: () => 2,
      getGrassSupportPoints: () => [
        { x: -0.2, y: 2.002, z: -1 },
        { x: 0.2, y: 2.002, z: -1 },
      ],
    });
    const marker = field.entity.children[0];

    assert.deepEqual(marker.components.get("collision"), {
      type: "cylinder",
      radius: 0.36,
      height: 0.035,
      axis: 1,
    });
    assert.equal(marker.components.get("rigidbody").type, "dynamic");
    assert.equal(marker.components.get("rigidbody").mass, 0.01);

    field.updateHeroPosition({ x: 0.3, y: 2, z: -1 });
    update();
    const heroForce = marker.rigidbody.forces.at(-1);
    assert.deepEqual(heroForce.slice(0, 3), [0, -0.005, 0]);
    assert.ok(heroForce[3] > 0.29);

    marker.rigidbody.forces = [];
    marker.position.y -= 0.03;
    marker.normal.set(0.06, 0.998, 0);
    update();
    const supportForces = marker.rigidbody.forces.filter(
      (force) => force[1] > 0 && force.length === 6,
    );
    assert.equal(supportForces.length, 2);
    assert.notEqual(supportForces[0][1], supportForces[1][1]);

    const [contact] = field.grassSurfaceContacts;
    assert.ok(contact.compression > 0.02);
    assert.ok(contact.slopeX > 0.05);
    assert.ok(Math.abs(contact.slopeZ) < 0.0001);
    assert.ok(
      field.surfaceHeightAt(0.3, -1) <
        field.surfaceHeightAt(-0.3, -1),
    );
    assert.equal(field.surfaceHeightAt(1, -1), null);
    field.destroy();
  });
});
