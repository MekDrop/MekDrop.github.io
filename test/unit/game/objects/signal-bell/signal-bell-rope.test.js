import assert from "node:assert/strict";
import { before, beforeEach, afterEach, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { SignalBellRope } from "../../../../../src/game/objects/signal-bell/SignalBellRope.js";
import { AmmoPhysicsWorld } from "playcanvas/build/playcanvas/src/framework/physics/ammo/ammo-physics-world.js";
import { Vec3 } from "playcanvas/build/playcanvas/src/core/math/vec3.js";
import { Quat } from "playcanvas/build/playcanvas/src/core/math/quat.js";
import { Entity } from "playcanvas/build/playcanvas/src/framework/entity.js";
import { EventHandler } from "playcanvas/build/playcanvas/src/core/event-handler.js";

const previousAmmo = globalThis.Ammo;
let wasmAmmo;
before(async () => {
  const glueUrl = new URL("../../../../../src/assets/game/wasm/ammo/ammo.wasm.js", import.meta.url);
  const source = readFileSync(glueUrl, "utf8").replace("export default Ammo;", "");
  const context = {
    module: { exports: {} },
    exports: {},
    require: createRequire(import.meta.url),
    process,
    __dirname: "",
    Buffer,
    console,
    setTimeout,
    clearTimeout,
  };
  runInNewContext(source, context);
  wasmAmmo = await context.module.exports({
    wasmBinary: readFileSync(new URL("../../../../../src/assets/game/wasm/ammo/ammo.wasm.wasm", import.meta.url)),
  });
});

beforeEach(() => {
  globalThis.Ammo = wasmAmmo;
});
afterEach(() => {
  globalThis.Ammo = previousAmmo;
});
it("updates the visible rope and held grip on the application's actual render event", () => {
  const world = new AmmoPhysicsWorld();
  world.setGravity(new Vec3(0, -9.81, 0));
  const app = new EventHandler();
  app.systems = { rigidbody: { physicsWorld: world } };
  app._entityIndex = {};
  class TestEntity extends Entity {
    /**
     * @param {string} name
     */
    constructor(name) {
      super(name, app);
    }
  }
  app.root = new TestEntity("root");
  const model = new TestEntity("model");
  app.root.addChild(model);
  for (const name of ["Signal bell bronze bowl clapper and rope", "Bell pull rope", "Bell rope tail", "Bell rope knot"]) {
    model.addChild(new TestEntity(name));
  }
  const rope = new SignalBellRope({
    Entity: TestEntity,
    Vec3,
    Quat,
  }, app, model);
  try {
    const root = app.root.findByName("Signal bell simulated rope");
    const knot = root.findByName("Bell rope knot");
    const hand = new Vec3(0, 0.65, 0.3);
    rope.hand = () => hand;
    for (let frame = 0; frame < 60; frame++) {
      world.step(1 / 60, 1, 1 / 60);
      app.fire("prerender");
    }
    assert.ok(Math.abs(knot.getPosition().z) < 0.01, "a distant glove cannot attract the rope");
    assert.ok(Math.abs(knot.getPosition().y - 0.65) < 0.02, "the knot hangs at the authored grasp height");
    hand.copy(knot.getPosition());
    app.fire("prerender");
    let maxError = 0;
    let maxJointGap = 0;
    for (let frame = 0; frame < 120; frame++) {
      hand.z = 0.18 * frame / 120;
      hand.y = 1.15 - Math.sqrt(0.5 ** 2 - hand.z ** 2);
      world.step(1 / 60, 1, 1 / 60);
      app.fire("prerender");
      if (frame > 5) {
        maxError = Math.max(maxError, knot.getPosition().distance(hand));
      }
      for (let index = 1; index < 8; index++) {
        const previous = root.findByName(`Rope link ${index - 1}`);
        const next = root.findByName(`Rope link ${index}`);
        const end = previous.getPosition().clone().add(previous.getRotation().transformVector(new Vec3(0, -previous.getLocalScale().y / 2, 0)));
        const start = next.getPosition().clone().add(next.getRotation().transformVector(new Vec3(0, next.getLocalScale().y / 2, 0)));
        maxJointGap = Math.max(maxJointGap, end.distance(start));
      }
    }
    assert.ok(maxError < 0.025, `visible hand/rope gap: ${maxError}`);
    assert.ok(maxJointGap < 0.00001, `rope stays connected during the draw: ${maxJointGap}`);
    const before = knot.getPosition().clone();
    rope.release();
    for (let frame = 0; frame < 120; frame++) {
      world.step(1 / 60, 1, 1 / 60);
      app.fire("prerender");
    }
    assert.ok(knot.getPosition().distance(before) > 0.05, "the visible rope swings after release");
  } finally {
    rope.destroy(); model.destroy(); world.destroy();
  }
});
