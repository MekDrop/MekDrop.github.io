import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { BellBugGooMeal } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugGooMeal.js";

test("collected donor skin follows the claw to the mouth and is counted only after swallowing", () => {
  class TestEntity extends pc.Entity {
    addComponent(type, data) {
      assert.equal(type, "render", "food must not become falling rigid debris");
      this.render = data;
    }
  }
  class TestMesh {
    setPositions(positions) {
      this.positions = positions;
    }
    setIndices() {}
    setNormals() {}
    update() {}
    destroy() {
      this.destroyed = true;
    }
  }
  class TestMeshInstance {
    constructor(mesh, material, node) {
      Object.assign(this, {
        mesh,
        material,
        node,
      });
    }
  }
  const app = new pc.EventHandler();
  const entity = new TestEntity();
  const head = new TestEntity();
  head.setPosition(0, 0.5, 0);
  const sounds = [];
  const owner = {
    pc: {
      ...pc,
      Entity: TestEntity,
      Mesh: TestMesh,
      MeshInstance: TestMeshInstance,
    },
    app,
    entity,
    position: entity.getPosition(),
    alive: true,
    animationPlayback: { model: { findByName: () => head } },
    doorScratch: { swallowedVolume: 0 },
    playGooSound: name => sounds.push(name),
  };
  const material = new pc.StandardMaterial();
  const contact = new pc.Vec3(0, 0.5, -0.25);
  const meal = new BellBugGooMeal(owner, {
    positions: [-0.04, 0.5, -0.25, 0.04, 0.5, -0.25, 0, 0.57, -0.25],
    material,
    volume: 0.001,
  }, 0, contact);
  assert.ok(meal.goal.distance(contact) < 1e-6);
  app.fire("update", 0.46);
  assert.deepEqual(sounds,["gooPull"], "taste waits for the same pull-to-mouth delay as a living slime");
  app.fire("update", 0.01);
  meal.pose();
  assert.ok(meal.entity.getPosition().distance(meal.mouth) < 1e-6);
  assert.deepEqual(sounds, ["gooPull", "gooSwallow"]);
  assert.equal(owner.doorScratch.swallowedVolume, 0);
  head.setPosition(0.1, 0.5, 0);
  meal.pose();
  assert.ok(meal.entity.getPosition().distance(meal.mouth) < 1e-6);
  app.fire("update", 0.21);
  assert.equal(owner.doorScratch.swallowedVolume, 0.001);
  assert.equal(meal.active, false);
  assert.equal(meal.mesh.destroyed, true);
  app.fire("update", 1);
  assert.equal(owner.doorScratch.swallowedVolume, 0.001);
  material.destroy();
});
