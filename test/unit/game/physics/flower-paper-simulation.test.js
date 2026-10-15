import assert from "node:assert/strict";
import { before, beforeEach, afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { FlowerPaperSimulation } from "../../../../src/game/physics/FlowerPaperSimulation.js";
import { Vec3 } from "playcanvas/build/playcanvas/src/core/math/vec3.js";
import { Quat } from "playcanvas/build/playcanvas/src/core/math/quat.js";

const previousAmmo = globalThis.Ammo;
let wasmAmmo;
before(async () => {
  const glueUrl = new URL("../../../../src/assets/game/wasm/ammo/ammo.wasm.js", import.meta.url);
  const source = readFileSync(glueUrl, "utf8").replace("export default Ammo;", "");
  const context = { module: { exports: {} }, exports: {}, require: createRequire(import.meta.url),
    process, __dirname: "", Buffer, console, setTimeout, clearTimeout };
  runInNewContext(source, context);
  wasmAmmo = await context.module.exports({
    wasmBinary: readFileSync(new URL("../../../../src/assets/game/wasm/ammo/ammo.wasm.wasm", import.meta.url)),
  });
});

/**
 * @param {import("playcanvas").PhysicsBody} body
 * @param {number} x
 * @returns {Vec3}
 */
function point(body, x) {
  const position = new Vec3(), rotation = new Quat();
  body.getTransform(position, rotation);
  return rotation.transformVector(new Vec3(x, 0, 0)).add(position);
}

describe("anchored flower paper", () => {
  beforeEach(() => { globalThis.Ammo = wasmAmmo; });
  afterEach(() => { globalThis.Ammo = previousAmmo; });
  it("folds contacted sections independently, preserves seams, and recovers", () => {
    const simulation = new FlowerPaperSimulation();
    try {
      const ground = simulation.addSurface(new Vec3(), 0.5);
      const sheet = simulation.add({ position: new Vec3(0, 0.12, 0), rotation: new Quat(), length: 0.3, width: 0.08 });
      const neighbor = simulation.add({ position: new Vec3(0, 0.12, 0.25), rotation: new Quat(), length: 0.3, width: 0.08 });
      const feet = [new Vec3(0.25, 0.32, 0), new Vec3(0, -1000, 0)];
      for (let frame = 0; frame < 300; frame++) {
        simulation.step(1 / 60, feet, Quat.IDENTITY);
        const poses = simulation.poses(sheet);
        const base = poses[0].rotation.transformVector(new Vec3(-0.075, 0, 0)).add(poses[0].position);
        const seamA = poses[0].rotation.transformVector(new Vec3(0.075, 0, 0)).add(poses[0].position);
        const seamB = poses[1].rotation.transformVector(new Vec3(-0.075, 0, 0)).add(poses[1].position);
        assert.ok(base.distance(new Vec3(0, 0.12, 0)) < 1e-6, "rendered base must remain fixed even during initial overlap recovery");
        assert.ok(seamA.distance(seamB) < 1e-6, "rendered fold must never tear");
        if (frame > 60) {
          assert.ok(point(sheet.links[0], -0.075).distance(new Vec3(0, 0.12, 0)) < 0.02, "solver base must remain attached after spawn settling");
          assert.ok(point(sheet.links[0], 0.075).distance(point(sheet.links[1], -0.075)) < 0.02, "solver fold must remain connected");
        }
      }
      const bent = point(sheet.links[1], 0.075);
      for (let frame = 0; frame < 300; frame++) {
        simulation.moveAttachment(sheet, new Vec3(0, 0.12 + Math.sin(frame) * 0.0002, 0));
        simulation.step(1 / 60, feet, Quat.IDENTITY);
        assert.ok(point(sheet.links[1], 0.075).distance(bent) < 1e-6, "paper must remain still beneath a stationary boot, including attachment solver noise");
      }
      const untouched = point(neighbor.links[1], 0.075);
      assert.ok(bent.y < 0.09, `contacted tip should fold down: ${bent.y}`);
      assert.ok(bent.y > -0.01, "pressed paper must not sink through its support surface");
      assert.ok(Math.abs(untouched.y - 0.12) < 0.01, "neighboring leaf should not flatten with the contacted leaf");
      feet[0].set(2, 0.32, 0);
      for (let frame = 0; frame < 600; frame++) { simulation.step(1 / 60, feet, Quat.IDENTITY); }
      const recovered = point(sheet.links[1], 0.075);
      assert.ok(recovered.distance(new Vec3(0.3, 0.12, 0)) < 0.015, `tip should recover: ${JSON.stringify(recovered)}`);
      simulation.moveAttachment(sheet, new Vec3(0, 0.72, 0));
      const carried = point(sheet.links[1], 0.075);
      assert.ok(carried.distance(recovered.clone().add(new Vec3(0, 0.6, 0))) < 1e-6, `a floating island teleport must carry the sheet without changing its fold: ${JSON.stringify(recovered)} => ${JSON.stringify(carried)}`);
      simulation.remove(sheet); simulation.remove(neighbor);
      simulation.removeSurface(ground);
      simulation.step(1 / 60, feet, Quat.IDENTITY);
    } finally { simulation.destroy(); }
  });
});
