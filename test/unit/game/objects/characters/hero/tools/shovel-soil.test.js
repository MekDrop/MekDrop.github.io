import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, Vec3, BoundingBox } from "playcanvas";
import { ShovelSoil } from "../../../../../../../src/game/objects/characters/hero/tools/ShovelSoil.js";
import { HERO_ANIMATION } from "../../../../../../../src/game/enum/HeroAnimation.js";

it("carries released dirt and its landing surface with their original island without changing velocity", () => {
  const app = {
    _entityIndex: {},
    systems: {
      collision: {
        addComponent: (entity, data) => {
          entity.collision = data;
        },
      },
      rigidbody: {
        addComponent: (entity) => {
          entity.rigidbody = {
            teleport: (x, y, z) => entity.setPosition(x, y, z),
            body: {
              setCcdMotionThreshold: () => {},
              setCcdSweptSphereRadius: () => {},
            },
          };
        },
      },
    },
  };
  app.root = new Entity("Scene", app);
  app.root._enabledInHierarchy = true;
  const owner = new Entity("Hero", app);
  const shovel = new Entity("Shovel", app);
  const load = new Entity("Shovel soil load", app);
  const source = new Entity("Soil", app);
  source.render = { meshInstances: [{ aabb: new BoundingBox(new Vec3(), new Vec3(0.02, 0.02, 0.02)) }] };
  app.root.addChild(owner);
  owner.addChild(shovel);
  shovel.addChild(load);
  load.addChild(source);
  let offset = 0.06;
  const queries = [];
  owner.setPosition(0, offset, 0);
  const soil = new ShovelSoil({
    app,
    owner,
    shovel,
    islandOffsetAt: (x, z) => {
      queries.push([x, z]);

      return x === 2 ? offset : 100;
    },
  });
  try {
    const action = {
      phase: "use",
      useAnimation: HERO_ANIMATION.DIG,
      toolContext: {},
      targetPosition: {
        x: 2,
        y: 0,
        z: 3,
      },
      tool: { useDuration: 1.6 },
      elapsed: 0.7,
    };
    soil.update(0, action);
    action.elapsed = 1.24;
    soil.update(0, action);
    const clod = app.root.findByName("Shovel soil clod 0");
    const ground = app.root.findByName("Shovel soil landing surface");
    assert.equal(clod.enabled, true);
    assert.ok(Math.abs(ground.getPosition().y - (-0.2 + offset)) < 1e-6);
    const start = clod.getPosition().clone();
    const velocity = clod.rigidbody.linearVelocity.clone();
    const angularVelocity = clod.rigidbody.angularVelocity.clone();
    owner.setPosition(100, 100, 100);
    for (const next of [0.064, -0.03, 0.06]) {
      offset = next;
      soil.syncIslandOffsets();
      assert.ok(Math.abs(clod.getPosition().y - start.y - (offset - 0.06)) < 1e-6);
      assert.ok(Math.abs(ground.getPosition().y - (-0.2 + offset)) < 1e-6);
      assert.deepEqual(clod.rigidbody.linearVelocity, velocity);
      assert.deepEqual(clod.rigidbody.angularVelocity, angularVelocity);
    }
    assert.ok(queries.every(([x, z]) => x === 2 && z === 3));
    soil.update(2.1, null);
    assert.equal(clod.enabled, false);
    assert.equal(ground.enabled, false);
  } finally {
    soil.destroy();
  }
});
