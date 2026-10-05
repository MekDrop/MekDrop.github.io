import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, EventHandler } from "playcanvas";
import { ServantHeroClearance } from "../../../../../src/game/objects/shared/ServantHeroClearance.js";

it("registers the collider with the supplied application without a global app", () => {
  const app = new EventHandler();
  const components = [];
  app.systems = Object.fromEntries(["collision", "rigidbody"].map((type) => [type, {
    addComponent(entity, data) {
      components.push({ type, entity, data });
    },
  }]));
  app.root = new Entity("Scene", app);
  const actor = new Entity("Servant", app);
  app.root.addChild(actor);
  const clearance = new ServantHeroClearance(actor, app);
  const body = app.root.findByName("Servant body collider");
  assert.equal(components.length, 2);
  assert.ok(components.every(({ entity }) => entity === body));
  assert.equal(components[0].data.type, "capsule");
  assert.equal(components[1].data.type, "kinematic");
  clearance.destroy();
  assert.equal(app.root.findByName("Servant body collider"), null);
});
