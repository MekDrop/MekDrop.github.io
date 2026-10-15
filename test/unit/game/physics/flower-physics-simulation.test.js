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
      contact = simulation.step(state(0, false, new Float32Array([-0.5 + frame * 0.025, 0.32, 0.12, 0, -1000, 0])));
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
  it("stays stable between both feet and returns upright after prolonged contact", (context) => {
    const simulation = createSimulation();
    context.after(() => {
      const currentAmmo = globalThis.Ammo;
      globalThis.Ammo = wasmAmmo;
      try { simulation.destroy(); } finally { globalThis.Ammo = currentAmmo; }
    });
    const spawn = simulation.step(state(0, false, new Float32Array([-0.13, 0.32, 0.1, 0.13, 0.32, 0.1])));
    assert.ok(spawn[1] < 0.006, "first spawn snapshot must place the tip beneath the boots");
    let previous;
    let maximumMotion = 0;
    for (let frame = 0; frame < 600; frame++) {
      const transform = simulation.step(state(0, false, new Float32Array([-0.13, 0.32, 0.1, 0.13, 0.32, 0.1])));
      assert.ok(Array.from(transform).every(Number.isFinite));
      // A rooted patch must remain above ground rather than turn upside down.
      assert.ok(1 - 2 * (transform[3] ** 2 + transform[5] ** 2) > 0);
      if (frame > 480) {
        assert.ok(transform[1] < 0.006, "standing feet must compress the tip below their sole");
        maximumMotion = Math.max(maximumMotion, Math.hypot(...transform.slice(0, 3).map((value, index) => value - previous[index])));
      }
      previous = transform;
    }
    assert.ok(maximumMotion < 0.005, `stationary feet caused ${maximumMotion} metres of movement per frame`);
    let recovered;
    for (let frame = 0; frame < 600; frame++) {
      recovered = simulation.step(state(0, false, new Float32Array([2, 0.32, 0, 2.26, 0.32, 0])));
    }
    assert.ok(Math.hypot(recovered[3], recovered[5]) < 0.01, "flower must recover upright rather than sleep while bent");
    assert.ok(Math.hypot(recovered[0], recovered[2]) < 0.005, "flower must return to its root");
  });
  it("does not invert during repeated turns at different worker update rates", (context) => {
    const simulation = createSimulation();
    context.after(() => {
      const currentAmmo = globalThis.Ammo;
      globalThis.Ammo = wasmAmmo;
      try { simulation.destroy(); } finally { globalThis.Ammo = currentAmmo; }
    });
    for (let frame = 0; frame < 120; frame++) { simulation.step(state()); }
    for (const deltaTime of [1 / 30, 1 / 60, 1 / 144]) {
      for (let frame = 0; frame < 720; frame++) {
        const angle = Math.floor(frame / 60) * Math.PI / 2;
        const forwardX = Math.sin(angle), forwardZ = Math.cos(angle);
        const feet = new Float32Array([
          forwardX * 0.1 - forwardZ * 0.13, 0.32, forwardZ * 0.1 + forwardX * 0.13,
          forwardX * 0.1 + forwardZ * 0.13, 0.32, forwardZ * 0.1 - forwardX * 0.13,
        ]);
        const transform = simulation.step({ ...state(0, false, feet), deltaTime });
        assert.ok(1 - 2 * (transform[3] ** 2 + transform[5] ** 2) > 0, `inverted at frame ${frame}, dt ${deltaTime}`);
      }
    }
  });
});
