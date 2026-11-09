import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as pc from "playcanvas";
import { FallenTree } from "../../../../../src/game/objects/vegetation/FallenTree.js";

describe("fallen tree lifetime", () => {
  it("uses a dynamic body and starts cleanup only after ground contact", () => {
    const app = new pc.EventHandler();
    const released = [];
    const impulses = [];
    const world = {
      createShape: options => options,
      addCompoundChild: () => {},
      destroyShape: shape => released.push(shape),
    };
    class PhysicsEntity extends pc.Entity {
      addComponent(type, options) {
        if (type === "collision") {
          this.collision = {
            shape: {},
            system: { physicsWorld: world },
          };
        } else {
          this.rigidbody = Object.assign(new pc.EventHandler(), options, {
            applyImpulse: (...impulse) => impulses.push(impulse),
            applyTorqueImpulse: (...impulse) => impulses.push(impulse),
          });
        }
      }
    }
    const parent = new pc.Entity("vegetation");
    const source = new pc.Entity("tree");
    const part = new pc.Entity("crown");
    part.clone = () => new pc.Entity("crown");
    parent.addChild(source);
    source.addChild(part);
    part.setLocalPosition(0, 1, 0);
    new FallenTree({
      pc: {
        ...pc,
        Entity: PhysicsEntity,
      },
      app,
      source,
      parts: [part],
      voxels: [{
        x: 0,
        y: 1,
        z: 0,
        width: 0.25,
        height: 1,
        depth: 0.25,
      }],
      direction: {
        x: 0,
        z: -1,
      },
    });
    const root = parent.findByName("Fallen tree origin");
    const body = root.findByName("Fallen tree physics collider");
    assert.equal(body.rigidbody.type, "static", "hold the crown at the severing impact");
    app.fire("update", 0.03);
    assert.equal(body.rigidbody.type, "static");
    assert.equal(impulses.length, 0);
    app.fire("update", 0.021);
    assert.equal(body.rigidbody.type, "dynamic");
    assert.equal(impulses.length, 2);
    assert.ok(impulses.flat().every(Number.isFinite));
    assert.ok(body.findByName("crown"));
    app.fire("update", 20);
    assert.equal(root.parent, parent, "air time does not consume the ground timer");
    body.rigidbody.fire("collisionstart", {
      other: new pc.Entity("wall"),
      contacts: [{ normal: new pc.Vec3(1, 0, 0) }],
    });
    app.fire("update", 20);
    assert.equal(root.parent, parent);
    const ground = new pc.Entity("ground");
    ground.tags.add("terrain-physics-surface");
    body.rigidbody.fire("collisionstart", {
      other: ground,
      contacts: [{ normal: new pc.Vec3(0, -1, 0) }],
    });
    app.fire("update", 3.9);
    assert.equal(root.parent, parent);
    source.destroy();
    assert.equal(root.parent, parent, "removing the stump leaves its fallen crown alive");
    app.fire("update", 0.2);
    assert.equal(root.parent, null);
    assert.equal(released.length, 1);
    assert.equal(app.hasEvent("update"), false);
  });
});
