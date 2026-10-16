import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, EventHandler } from "playcanvas";
import { ServantHeroClearance } from "../../../../../src/game/objects/shared/ServantHeroClearance.js";

it("registers the collider with the supplied application without a global app", () => {
  const app = new EventHandler();
  const components = [];
  app.systems = Object.fromEntries(["collision", "rigidbody"].map((type) => [type, {
    addComponent: (entity, data) => {
      components.push({
        type,
        entity,
        data,
      });
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

it("shares the hero lookup across servants and invalidates it when the hero is replaced", () => {
  const app = new EventHandler();
  app._enableList = [];
  app.systems = {
    collision: { addComponent: () => {} },
    rigidbody: {
      addComponent: (entity) => {
        entity.rigidbody = { teleport: () => {} };
      },
    },
  };
  app.root = new Entity("Scene", app);
  app.root._enabledInHierarchy = true;
  const original = app.root.findByName.bind(app.root);
  let lookups = 0;
  app.root.findByName = (name) => {
    if (name === "Hero") {
      lookups += 1;
    }
    return original(name);
  };
  const hero = new Entity("Hero", app);
  hero.enabled = false;
  app.root.addChild(hero);
  const actors = [new Entity("First servant", app), new Entity("Second servant", app)];
  for (const actor of actors) {
    app.root.addChild(actor);
  }
  const clearances = actors.map((actor) => new ServantHeroClearance(actor, app));
  app.fire("prerender");
  app.fire("prerender");
  assert.equal(lookups, 1);
  hero.destroy();
  const replacement = new Entity("Hero", app);
  replacement.enabled = false;
  app.root.addChild(replacement);
  app.fire("prerender");
  assert.equal(lookups, 2);
  for (const clearance of clearances) {
    clearance.destroy();
  }
  replacement.destroy();
});
