import assert from "node:assert/strict";
import { before, beforeEach, afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { BellRopePhysics } from "../../../../../src/game/objects/signal-bell/BellRopePhysics.js";
import { Quat } from "playcanvas/build/playcanvas/src/core/math/quat.js";

const previousAmmo = globalThis.Ammo;
let wasmAmmo;
before(async () => {
  const glueUrl = new URL("../../../../../src/assets/game/wasm/ammo/ammo.wasm.js", import.meta.url);
  const source = readFileSync(glueUrl, "utf8").replace("export default Ammo;", "");
  const context = { module: { exports: {} }, exports: {}, require: createRequire(import.meta.url),
    process, __dirname: "", Buffer, console, setTimeout, clearTimeout };
  runInNewContext(source, context);
  wasmAmmo = await context.module.exports({
    wasmBinary: readFileSync(new URL("../../../../../src/assets/game/wasm/ammo/ammo.wasm.wasm", import.meta.url)),
  });
});
import { AmmoPhysicsWorld } from "playcanvas/build/playcanvas/src/framework/physics/ammo/ammo-physics-world.js";
import { Vec3 } from "playcanvas/build/playcanvas/src/core/math/vec3.js";

/**
 * @param {import("node:test").TestContext} context
 * @returns {{world: AmmoPhysicsWorld, rope: BellRopePhysics}}
 */
function setup(context) {
  const world = new AmmoPhysicsWorld();
  world.setGravity(new Vec3(0, -9.81, 0));
  world.nativeWorld.getSolverInfo().set_m_numIterations(40);
  const rope = new BellRopePhysics(world, new Vec3(0, 1, 0));
  context.after(() => { globalThis.Ammo = wasmAmmo; rope.destroy(); world.destroy(); });
  return { world, rope };
}

describe("bell rope Ammo constraints", () => {
  beforeEach(() => { globalThis.Ammo = wasmAmmo; });
  afterEach(() => { globalThis.Ammo = previousAmmo; });
  it("collides with the game's static geometry", (context) => {
    const { world, rope } = setup(context);
    const shape = world.createShape({ type: "box", halfExtents: new Vec3(1, 0.1, 1) });
    const floor = world.createBody({ type: "static", shape, mass: 0,
      position: new Vec3(0, 0.05, 0), rotation: Quat.IDENTITY });
    world.addBody(floor, 2, 65535);
    for (let frame = 0; frame < 240; frame++) {
      rope.updateAttachments(new Vec3(0, 1 - 0.3 * Math.min(1, frame / 120), 0));
      world.step(1 / 60, 4, 1 / 120);
    }
    assert.ok(rope.transforms.at(-1).position.y > 0.13, "the loose tail rests on the floor");
    world.removeBody(floor);
    world.destroyBody(floor);
    world.destroyShape(shape);
  });
  it("cleans up every joint, body and collision shape, including a held grip", (context) => {
    const { world, rope } = setup(context);
    const joints = context.mock.method(world, "destroyJoint");
    const bodies = context.mock.method(world, "destroyBody");
    const shapes = context.mock.method(world, "destroyShape");
    rope.updateAttachments(new Vec3(0, 1, 0), new Vec3(0, 0.6, 0.1));
    rope.destroy();
    assert.equal(joints.mock.callCount(), 12);
    assert.equal(bodies.mock.callCount(), 13);
    assert.equal(shapes.mock.callCount(), 13);
  });
  it("hangs under gravity and carries every link with a teleported attachment", (context) => {
    const { world, rope } = setup(context);
    for (let frame = 0; frame < 180; frame++) {
      rope.updateAttachments(new Vec3(0, 1, 0));
      world.step(1 / 60, 4, 1 / 120);
    }
    const before = rope.transforms;
    assert.ok(Math.abs(before.at(-1).position.y - 0.35) < 0.03);
    rope.updateAttachments(new Vec3(3, 5, -2));
    for (const [index, link] of rope.transforms.entries()) {
      assert.ok(link.position.distance(before[index].position.clone().add(new Vec3(3, 4, -2))) < 0.001);
    }
  });
  for (const fps of [30, 60, 120]) {
    it(`holds a moving grip then swings and settles after release at ${fps} fps`, (context) => {
      const { world, rope } = setup(context);
      const anchor = new Vec3(0, 1, 0);
      for (let frame = 0; frame < fps; frame++) {
        rope.updateAttachments(anchor, new Vec3(0, 0.6 - 0.06 * frame / fps, 0.18));
        world.step(1 / fps, 4, 1 / 120);
      }
      const grip = rope.transforms[7];
      const end = grip.position.clone().add(grip.rotation.transformVector(new Vec3(0, -grip.length / 2, 0)));
      assert.ok(end.distance(new Vec3(0, 0.54, 0.18)) < 0.025, `grip: ${end}`);
      rope.release();
      let swing = 0;
      for (let frame = 0; frame < fps * 6; frame++) {
        rope.updateAttachments(anchor);
        world.step(1 / fps, 4, 1 / 120);
        const tip = rope.transforms.at(-1).position;
        assert.ok(Number.isFinite(tip.y) && tip.distance(anchor) < 0.8);
        if (frame < fps) { swing = Math.max(swing, Math.abs(tip.z)); }
      }
      assert.ok(swing > 0.05, "release retains motion");
      assert.ok(Math.abs(rope.transforms.at(-1).position.z) < 0.05, "gravity and damping settle the free rope");
      rope.destroy();
    });
  }
});
