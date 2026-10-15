import assert from "node:assert/strict";
import { before, beforeEach, afterEach, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { SignalBellRope } from "../../../../../src/game/objects/signal-bell/SignalBellRope.js";
import { AmmoPhysicsWorld } from "playcanvas/build/playcanvas/src/framework/physics/ammo/ammo-physics-world.js";
import { Vec3 } from "playcanvas/build/playcanvas/src/core/math/vec3.js";
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

beforeEach(() => { globalThis.Ammo = wasmAmmo; });
afterEach(() => { globalThis.Ammo = previousAmmo; });
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
    constructor(name) { super(name, app); }
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
  }, app, model);
  try {
    const root = app.root.findByName("Signal bell simulated rope");
    const knot = root.findByName("Bell rope knot");
    const hand = new Vec3(0, 0.5, 0.18);
    rope.hand = () => hand;
    let maxError = 0;
    for (let frame = 0; frame < 120; frame++) {
      hand.y = 0.5 - 0.05 * frame / 120;
      world.step(1 / 60, 1, 1 / 60);
      app.fire("prerender");
      if (frame > 5) { maxError = Math.max(maxError, knot.getPosition().distance(hand)); }
    }
    assert.ok(maxError < 0.025, `visible hand/rope gap: ${maxError}`);
    const before = knot.getPosition().clone();
    rope.release();
    for (let frame = 0; frame < 120; frame++) {
      world.step(1 / 60, 1, 1 / 60);
      app.fire("prerender");
    }
    assert.ok(knot.getPosition().distance(before) > 0.05, "the visible rope swings after release");
  } finally { rope.destroy(); model.destroy(); world.destroy(); }
});
