import assert from "node:assert/strict";
import { before, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { GardenVine } from "../../../../../../src/game/objects/castle-props/garden-shelter/GardenVine.js";
import { Entity, EventHandler } from "playcanvas";

const previousAmmo = globalThis.Ammo;
let wasmAmmo;
before(async () => {
  const glueUrl = new URL("../../../../../../src/assets/game/wasm/ammo/ammo.wasm.js", import.meta.url);
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
    wasmBinary: readFileSync(new URL("../../../../../../src/assets/game/wasm/ammo/ammo.wasm.wasm", import.meta.url)),
  });
});
import { AmmoPhysicsWorld } from "playcanvas/build/playcanvas/src/framework/physics/ammo/ammo-physics-world.js";
import { Vec3 } from "playcanvas/build/playcanvas/src/core/math/vec3.js";
import { Quat } from "playcanvas/build/playcanvas/src/core/math/quat.js";

it("keeps wind-driven shoots attached, carries island teleports and releases Ammo resources", (context) => {
  globalThis.Ammo = wasmAmmo;
  const world = new AmmoPhysicsWorld();
  world.setGravity(new Vec3(0, -9.81, 0));
  const rafterShape = world.createShape({
    type: "box",
    halfExtents: new Vec3(2.1, 0.075, 1.8),
  });
  const rafter = world.createBody({
    type: "static",
    shape: rafterShape,
    position: new Vec3(0, 2.6, 0),
    rotation: Quat.IDENTITY,
    mass: 0,
  });
  world.addBody(rafter, 2, 65535);
  const beamShape = world.createShape({
    type: "box",
    halfExtents: new Vec3(2.025, 0.1, 0.09),
  });
  const beam = world.createBody({
    type: "static",
    shape: beamShape,
    position: new Vec3(0, 2.43, -1.5),
    rotation: Quat.IDENTITY,
    mass: 0,
  });
  world.addBody(beam, 2, 65535);
  const app = new EventHandler();
  app.root = new Entity("root");
  app.systems = { rigidbody: { physicsWorld: world } };
  const support = new Entity("pergola");
  app.root.addChild(support);
  const models = {
    instantiate: name => {
      const mesh = new Entity(name);
      mesh.setLocalEulerAngles(-90, 0, 0);

      return mesh;
    },
  };
  const bodies = context.mock.method(world, "destroyBody");
  const joints = context.mock.method(world, "destroyJoint");
  const shapes = context.mock.method(world, "destroyShape");
  const attachments = [new Vec3(-1.02, 2.31, -1.61), new Vec3(0.51, 2.31, -1.61)];
  const supportTransform = support.getWorldTransform();
  const transformPoint = supportTransform.transformPoint;
  const vectorHandoff = context.mock.method(supportTransform, "transformPoint", function (point, output) {
    assert.ok(output instanceof Vec3, "scene transforms must fill a vine-owned vector across Engine builds");

    return transformPoint.call(this, point, output);
  });
  const vine = new GardenVine(app, support, models, "stem", "leaf", attachments);
  vectorHandoff.mock.restore();
  try {
    for (let frame = 0; frame < 180; frame++) {
      app.fire("update", 1 / 60);
      world.step(1 / 60, 4, 1 / 120);
      app.fire("prerender");
    }
    const leaves = vine.entity.children.filter(node => node.name === "Vine leaf");
    assert.equal(leaves.length, 12);
    const stems = vine.entity.children.filter(node => node.name === "Vine stem");
    for (const [chain, x] of [-1.02, 0.51].entries()) {
      assert.ok(stems[chain * 6].getPosition().distance(new Vec3(x, 2.31, -1.61)) < 0.00001,
        "each shoot visibly starts at its authored attachment");
      for (let segment = 1; segment < 6; segment++) {
        const previous = stems[chain * 6 + segment - 1];
        const end = previous.getWorldTransform().transformPoint(new Vec3(0, -1, 0));
        assert.ok(end.distance(stems[chain * 6 + segment].getPosition()) < 0.00001,
          "Ammo joint residuals must not leave visible floating stem segments");
      }
    }
    for (const leaf of leaves) {
      assert.ok(Math.abs(leaf.children[0].getLocalEulerAngles().x + 90) < 0.001,
        "simulation must preserve the GLB root's authored axis conversion");
      const p = leaf.getPosition();
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
      assert.ok(p.y < 2.31 && p.y > 1.90, "young leaves emerge below the beam on compact trailing tips");
      assert.ok(leaf.getLocalScale().x < 0.8, "free tips carry smaller young leaves");
    }
    assert.ok(leaves.some(leaf => Math.abs(leaf.getPosition().z + 1.61) > 0.001), "wind moves the free shoots");
    // Compare the same physics state on both sides of the teleport.
    app.fire("update", 0);
    app.fire("prerender");
    const before = leaves.map(leaf => leaf.getPosition().clone());
    support.setPosition(3, 4, -2);
    app.fire("update", 0);
    app.fire("prerender");
    for (const [index, leaf] of leaves.entries()) {
      assert.ok(leaf.getPosition().distance(before[index].clone().add(new Vec3(3, 4, -2))) < 0.001);
    }
    // Island transforms can change after this object's update listener.
    // The original imported model is retained disabled after rigid batching.
    support.enabled = false;
    app.fire("update", 1 / 60);
    support.setPosition(3, 4.08, -2);
    app.fire("prerender");
    for (const [chain, point] of attachments.entries()) {
      const expected = support.getWorldTransform().transformPoint(point);
      assert.ok(stems[chain * 6].getPosition().distance(expected) < 0.00001,
        "the first visible stem follows late model movement in the same rendered frame");
    }
  } finally {
    vine.destroy();
    assert.equal(app.hasEvent("update"), false);
    assert.equal(app.hasEvent("prerender"), false);
    assert.equal(bodies.mock.callCount(), 14);
    assert.equal(shapes.mock.callCount(), 14);
    assert.equal(joints.mock.callCount(), 12);
    world.removeBody(beam);
    world.destroyBody(beam);
    world.destroyShape(beamShape);
    world.removeBody(rafter);
    world.destroyBody(rafter);
    world.destroyShape(rafterShape);
    world.destroy();
    app.root.destroy();
    globalThis.Ammo = previousAmmo;
  }
});
