import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchDoorLeap } from "../../../../../../src/game/objects/enemies/latch-slug/LatchDoorLeap.js";

it("reaches native leaf contact within a brief ballistic lunge instead of hovering short", () => {
  const entity = new pc.Entity();
  entity.setPosition(0, 0, 1);
  entity.rigidbody = { linearVelocity: new pc.Vec3() };
  const owner = {
    pc,
    entity,
    get position() {
      return entity.getPosition();
    },
    height: 0.84,
    radius: 0.42,
    statuses: new Map(),
    app: { systems: { rigidbody: { gravity: new pc.Vec3(0, -9.81, 0) } } },
    faceTarget: () => {},
  };
  const door = {
    entity: new pc.Entity(),
    openAmount: 0,
    clearWidth: 2,
    clearHeight: 2.4,
    getHit: () => ({ distance: 0.5 }),
  };
  const leap = new LatchDoorLeap(owner);
  assert.equal(leap.begin(door), true);
  const velocity = entity.rigidbody.linearVelocity;
  const contactTime = (owner.position.z - owner.radius) / -velocity.z;
  const contactHeight = owner.height / 2 + velocity.y * contactTime - 9.81 * contactTime ** 2 / 2;
  assert.ok(contactTime > 0 && contactTime <= 0.4);
  assert.ok(Math.abs(contactHeight - leap.point.y) < owner.radius);
  assert.equal(owner.airborne, true);
});
