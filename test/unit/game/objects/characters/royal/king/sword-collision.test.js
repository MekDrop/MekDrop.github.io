import assert from "node:assert/strict";
import { it } from "node:test";
import { BoundingBox, Entity, Vec3 } from "playcanvas";
import { KingSwordCollision } from "../../../../../../../src/game/objects/characters/royal/king/KingSwordCollision.js";

class ColliderEntity extends Entity {
  addComponent(type, options) {
    this[type] = options;
  }
}

it("fits separate solid blade and guard colliders that follow the animated sword", () => {
  const model = new Entity();
  const sword = new Entity("King sword");
  model.addChild(sword);
  const blade = new Entity("King sword blade");
  const guard = new Entity("King sword crossguard");
  sword.addChild(blade);
  sword.addChild(guard);
  const bounds = new BoundingBox(new Vec3(0, 0.4, 0), new Vec3(0.075, 0.395, 0.028));
  blade.render = { meshInstances: [{ mesh: { aabb: bounds } }] };
  guard.render = { meshInstances: [{ mesh: { aabb: bounds } }] };
  new KingSwordCollision({
    Entity: ColliderEntity,
    BODYTYPE_KINEMATIC: "kinematic",
  }, model);
  assert.equal(blade.children.length, 1);
  assert.equal(guard.children.length, 1);
  const collider = blade.children[0];
  assert.deepEqual(collider.collision.halfExtents, bounds.halfExtents);
  assert.notEqual(collider.collision.halfExtents, bounds.halfExtents);
  assert.equal(collider.rigidbody.type, "kinematic");
  assert.equal(collider.rigidbody.restitution, 0);
  sword.setLocalEulerAngles(90, 0, 0);
  model.setLocalScale(0.7, 0.7, 0.7);
  model.setLocalPosition(1, 2, 3);
  assert.ok(collider.getPosition().distance(new Vec3(1, 2, 3.28)) < 1e-6);
  model.destroy();
  assert.equal(collider.parent, null);
});

it("allows royal variants without sword meshes", () => {
  const model = new Entity();
  new KingSwordCollision({ Entity: ColliderEntity }, model);
  assert.equal(model.children.length, 0);
});
