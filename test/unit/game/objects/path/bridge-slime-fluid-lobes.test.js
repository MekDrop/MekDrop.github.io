import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { bridgeSlimeFluidLobes } from "../../../../../src/game/objects/path/BridgeSlimeFluidLobes.js";

/**
 * @returns {import("../../../../../src/game/objects/path/BridgeSlimeFluidLobes.js").FluidLobeOptions}
 */
function state() {
  const nativePoses = new Map();
  for (let i = 0; i < 4; i++) {
    nativePoses.set(i, {
      position: new pc.Vec3(i + 0.5, 0, 0),
      start: new pc.Vec3(i, 0, 0),
      end: new pc.Vec3(i + 1, 0, 0),
      volume: 1,
    });
  }

  return {
    pc,
    transform: new pc.Mat4(),
    nativePoses,
    arrivals: [{
      bankFeed: true,
      complete: false,
      station: 4,
      source: new pc.Vec3(-0.5, 0, 0),
      target: new pc.Vec3(4.5, 0, 0),
      age: 0,
    }],
    poolTransfers: [],
    poolSources: new Map(),
    time: 0,
    finishAge: 0,
    flowActive: true,
  };
}

test("a whole donating unit softens at the bank before it travels across existing tissue", () => {
  const options = state();
  options.arrivals[0].age = 0.7;
  const pooled = bridgeSlimeFluidLobes(options);
  assert.ok(Math.abs(pooled.volume - 5 * 0.4888) < 1e-12);
  assert.equal(pooled.transports.length, 0);
  const source = pooled.lobes.find(/**
   * @param {{weight:number,center:number[]}} lobe
   */
    (lobe) => lobe.weight > 0 && lobe.center[0] === -0.5);
  assert.equal(source.center[0], -0.5);
  const positions = [];
  for (const age of [1.3, 2.1, 3.2]) {
    options.arrivals[0].age = age;
    const flowing = bridgeSlimeFluidLobes(options);
    assert.equal(flowing.volume, pooled.volume);
    positions.push(flowing.transports[0].position[0]);
  }
  assert.ok(positions[0] < 0 && positions[1] > 1 && positions[2] > 3.5, "the same material unit actually travels from shore through native middle tissue to the frontier");
});

test("settled lobe geometry ignores elapsed fluid clocks", () => {
  const options = state();
  options.arrivals = [];
  options.flowActive = false;
  options.finishAge = 5;
  const first = bridgeSlimeFluidLobes(options);
  options.time = 100;
  options.finishAge = 100;
  assert.deepEqual(bridgeSlimeFluidLobes(options), first);
});
import { bridgeSlimeImplicitSurface } from "../../../../../src/game/objects/path/BridgeSlimeImplicitSurface.js";

test("a travelling donation retains one connected liquid union from source pool through the native deck", () => {
  const options = state();
  options.nativePoses.set(-1, {
    position: new pc.Vec3(-0.5, 0, 0),
    start: new pc.Vec3(-1, 0, 0),
    end: new pc.Vec3(0, 0, 0),
    volume: 1,
    reservoir: true,
  });
  options.arrivals[0].source.set(-1.2, 0, 0);
  options.poolSources.set(-1, options.arrivals[0].source);
  for (const age of [1.3, 2, 2.65, 3.2]) {
    options.arrivals[0].age = age;
    const data = bridgeSlimeFluidLobes(options);
    const mesh = bridgeSlimeImplicitSurface({
      ...data,
      maxCells: 8000,
    });
    const parents = [];
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      parents.push(i);
    }
    /**
     * @param {number} id @returns {number}
     */
    function root(id) {
      while (parents[id] !== id) {
        parents[id] = parents[parents[id]];
        id = parents[id];
      }

      return id;
    }
    for (let i = 0; i < mesh.indices.length; i += 3) {
      parents[root(mesh.indices[i + 1])] = root(mesh.indices[i]);
      parents[root(mesh.indices[i + 2])] = root(mesh.indices[i]);
    }
    const components = new Set();
    for (let i = 0; i < parents.length; i++) {
      components.add(root(i));
    }
    assert.equal(components.size, 1, `no detached source cup at donation age ${age}`);
    assert.ok(Math.abs(mesh.volume - data.volume) < 1e-6);
  }
});

test("deep native structural profiles do not turn the wet upper skin into a curtain", () => {
  const options = state();
  options.arrivals = [];
  for (const pose of options.nativePoses.values()) {
    pose.width = 0.1;
    pose.thickness = 10;
  }
  const data = bridgeSlimeFluidLobes(options);
  assert.equal(data.volume, 4 * 0.4888);
  for (const lobe of data.lobes) {
    assert.ok(lobe.radii[1] <= 0.18, "the hidden native truss does not become a visible rigid fin");
  }
  assert.ok(data.lobes[0].radii[2] >= 0.65, "fluid spreads as a broad upper envelope, without adding collision support");
});

test("helpers grow the bank reservoir backward and sideways without advancing its inlet", () => {
  const options = state();
  options.arrivals = [];
  options.nativePoses.clear();
  const pose = {
    position: new pc.Vec3(-0.5, 0, 0),
    start: new pc.Vec3(-1, 0, 0),
    end: new pc.Vec3(0, 0, 0),
    volume: 1,
    reservoir: true,
  };
  options.nativePoses.set(-1, pose);
  options.poolSources.set(-1, new pc.Vec3(-1.2, 0, 0));
  const first = bridgeSlimeFluidLobes(options);
  pose.volume = 8;
  const grown = bridgeSlimeFluidLobes(options);
  assert.equal(grown.volume, first.volume * 8);
  assert.ok(grown.lobes[0].center[0] < first.lobes[0].center[0]);
  assert.ok(grown.lobes[0].radii[2] > first.lobes[0].radii[2] * 1.9);
  assert.ok(Math.abs(grown.lobes[0].center[0] + grown.lobes[0].radii[0] - first.lobes[0].center[0] - first.lobes[0].radii[0]) < 1e-10, "accumulating helpers does not invent the next deck section");
});

test("the fully melted pool blends continuously into its moving crest at constant volume", () => {
  const options = state();
  options.arrivals[0].age = 1.15;
  const before = bridgeSlimeImplicitSurface({
    ...bridgeSlimeFluidLobes(options),
    maxCells: 8000,
    smoothPasses: 1,
  });
  options.arrivals[0].age = 1.16;
  const after = bridgeSlimeImplicitSurface({
    ...bridgeSlimeFluidLobes(options),
    maxCells: 8000,
    smoothPasses: 1,
  });
  assert.ok(Math.abs(before.volume - after.volume) < 1e-6);
  for (let axis = 0; axis < 3; axis++) {
    const a = [], b = [];
    for (let i = axis; i < before.positions.length; i += 3) {
      a.push(before.positions[i]);
    }
    for (let i = axis; i < after.positions.length; i += 3) {
      b.push(after.positions[i]);
    }
    assert.ok(Math.abs(Math.min(...a) - Math.min(...b)) < 0.07);
    assert.ok(Math.abs(Math.max(...a) - Math.max(...b)) < 0.07);
  }
});

test("a steep native free edge stays joined to a lower frontier until native admission", () => {
  const options = state();
  options.arrivals[0].source.set(-1.2, 0, 0);
  options.arrivals[0].target.set(4.5, 0.05, 0);
  options.poolSources.set(-1, new pc.Vec3(-1.2, 0, 0));
  options.nativePoses.set(-1, {
    position: new pc.Vec3(-0.5, 0, 0),
    start: new pc.Vec3(-1, 0, 0),
    end: new pc.Vec3(0, 0, 0),
    volume: 3,
    reservoir: true,
  });
  options.nativePoses.get(0).linkedPrevious = true;
  for (let i = 0; i < 4; i++) {
    const pose = options.nativePoses.get(i);
    pose.position.y = pose.start.y = pose.end.y = 0.4 + i * 0.25;
  }
  for (const age of [3.2, 3.4, 3.58, 4.5]) {
    options.arrivals[0].age = age;
    const data = bridgeSlimeFluidLobes(options);
    const mesh = bridgeSlimeImplicitSurface({
      ...data,
      maxCells: 8000,
      smoothPasses: 1,
      initialIsovalue: 0.15,
      maxFits: 3,
    });
    assert.equal(meshComponents(mesh), 1, `the held frontier is connected at age ${age}`);
    assert.ok(Math.abs(mesh.volume - data.volume) < 1e-6);
  }
});

/**
 * @param {{positions:number[],indices:number[]}} mesh
 * @returns {number}
 */
function meshComponents(mesh) {
  const parents = [];
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    parents.push(i);
  }
  /**
   * @param {number} id @returns {number}
   */
  function root(id) {
    while (parents[id] !== id) {
      parents[id] = parents[parents[id]];
      id = parents[id];
    }

    return id;
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    parents[root(mesh.indices[i + 1])] = root(mesh.indices[i]);
    parents[root(mesh.indices[i + 2])] = root(mesh.indices[i]);
  }
  const components = new Set();
  for (const id of mesh.indices) {
    components.add(root(id));
  }

  return components.size;
}
