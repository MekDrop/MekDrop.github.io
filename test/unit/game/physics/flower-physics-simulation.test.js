import assert from "node:assert/strict";
import { before, beforeEach, afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { FlowerPhysicsSimulation } from "../../../../src/game/physics/FlowerPhysicsSimulation.js";

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
 * @param {number} offset
 * @param {boolean} hidden
 * @param {Float32Array} feet
 * @returns {{deltaTime: number, offsets: Float32Array, hidden: Uint8Array, feet: Float32Array}}
 */
function state(offset = 0, hidden = false, feet = new Float32Array([0, -1000, 0, 0, -1000, 0])) {
  return { deltaTime: 1 / 60, offsets: new Float32Array([offset]), hidden: new Uint8Array([Number(hidden)]), feet };
}

/**
 * @returns {FlowerPhysicsSimulation}
 */
function createSimulation() {
  return new FlowerPhysicsSimulation([{ position: { x: 0, y: 0, z: 0 }, pivotHeight: 0.18, radius: 0.38 }], -22);
}

describe("flower worker Ammo simulation", () => {
  beforeEach(() => { globalThis.Ammo = wasmAmmo; });
  afterEach(() => { globalThis.Ammo = previousAmmo; });
  it("keeps the spring bounded and follows a floating island without accumulating offsets", (context) => {
    const simulation = createSimulation();
    context.after(() => {
      const currentAmmo = globalThis.Ammo;
      globalThis.Ammo = wasmAmmo;
      try { simulation.destroy(); } finally { globalThis.Ammo = currentAmmo; }
    });
    let transforms;
    for (let frame = 0; frame < 180; frame++) { transforms = simulation.step(state()); }
    const settledY = transforms[1];
    assert.ok(Number.isFinite(settledY) && Math.abs(settledY) < 0.4);
    const shifted = simulation.step(state(0.6));
    assert.ok(Math.abs(shifted[1] - settledY - 0.6) < 0.03, `${settledY} => ${shifted[1]}`);
    const returned = simulation.step(state());
    assert.ok(Math.abs(returned[1] - settledY) < 0.03);
  });
  it("reacts to a moving foot collider and recovers after it leaves", (context) => {
    const simulation = createSimulation();
    context.after(() => {
      const currentAmmo = globalThis.Ammo;
      globalThis.Ammo = wasmAmmo;
      try { simulation.destroy(); } finally { globalThis.Ammo = currentAmmo; }
    });
    for (let frame = 0; frame < 60; frame++) { simulation.step(state()); }
    let contact;
    for (let frame = 0; frame < 30; frame++) {
      contact = simulation.step(state(0, false, new Float32Array([-0.5 + frame * 0.025, 0.19, 0.12, 0, -1000, 0])));
    }
    const contactTilt = Math.abs(contact[3]) + Math.abs(contact[5]);
    assert.ok(contactTilt > 0.01, "foot contact must bend the flower");
    let recovered;
    for (let frame = 0; frame < 240; frame++) { recovered = simulation.step(state()); }
    assert.ok(Math.abs(recovered[3]) + Math.abs(recovered[5]) < contactTilt);
  });
  it("removes collected flowers from subsequent simulation snapshots", (context) => {
    const simulation = createSimulation();
    context.after(() => {
      const currentAmmo = globalThis.Ammo;
      globalThis.Ammo = wasmAmmo;
      try { simulation.destroy(); } finally { globalThis.Ammo = currentAmmo; }
    });
    simulation.step(state());
    const hidden = simulation.step(state(0, true));
    assert.deepEqual(Array.from(hidden), [0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(Array.from(simulation.step(state(1, true))), Array.from(hidden));
  });
});
