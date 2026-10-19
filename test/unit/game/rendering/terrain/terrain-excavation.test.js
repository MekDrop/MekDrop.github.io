import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { TerrainInstanceRenderer } from "../../../../../src/game/rendering/terrain/TerrainInstanceRenderer.js";

let nextMeshId = 0;
class Mesh {
  static fromGeometry(device, geometry) {
    return Object.assign(new Mesh(), {
      geometry,
      id: nextMeshId++,
    });
  }
  incRefCount() {} decRefCount() {} destroy() {}
  setPositions() {} setNormals() {} setUvs() {} setIndices() {} update() {}
}

it("closes bridge decks below the walking surface with downward-facing geometry", () => {
  const root = new pc.Entity();
  const wood = {};
  const renderer = new TerrainInstanceRenderer({
    pc: {
      ...pc,
      Entity,
      Mesh,
      VertexBuffer,
      MeshInstance,
      VertexFormat: { getDefaultInstancingFormat: () => {} },
    },
    app: { graphicsDevice: {} },
    root,
    materials: new Map([["wood", wood]]),
    mapData: {
      cols: 1,
      rows: 1,
    },
  });
  for (const coverage of ["bridgeHorizontalSidesOnly", "bridgeVerticalSidesOnly"]) {
    renderer.addBoxMatrix("wood", "wood", 0, 1, 0, 0, 2, 0.24, 2, coverage, "wood");
  }
  renderer.build();
  const faces = root.children.flatMap((child) => child.render?.meshInstances ?? []);
  const bottoms = faces.filter(({ mesh }) => mesh.geometry.normals.every((value, index) => value === (index % 3 === 1 ? -1 : 0)));
  assert.equal(bottoms.length, 1);
  const bottom = bottoms[0];
  assert.equal(bottom.material, wood);
  assert.ok(bottom.mesh.geometry.positions.every((value, index) => index % 3 !== 1 || value === -0.5));
  assert.equal(bottom.buffer.data.length, 32);
  renderer.destroy();
});
class Entity extends pc.Entity {
  addComponent(type, options) {
    this.render = options;
  }
}
class VertexBuffer {
  constructor(device, format, count, options) {
    this.data = options.data;
  }
  lock() {
    return this.data;
  } unlock() {} destroy() {}
}
class MeshInstance {
  constructor(mesh, material) {
    this.mesh = mesh; this.material = material;
  }
  setInstancing(buffer) {
    this.buffer = buffer;
  }
}

it("opens and restores a single grass top without moving its walls or neighboring cube", () => {
  const root = new pc.Entity();
  const renderer = new TerrainInstanceRenderer({
    pc: {
      ...pc,
      Entity,
      Mesh,
      VertexBuffer,
      MeshInstance,
      VertexFormat: { getDefaultInstancingFormat: () => {} },
    },
    app: { graphicsDevice: {} },
    root,
    materials: new Map([["grass-0", {}], ["earth", {}]]),
    mapData: {
      cols: 2,
      rows: 1,
      islandConnectorData: {
        nearIsland: ["0,0", "1,0"],
        farIsland: [],
      },
    },
  });
  for (const x of [-0.5, 0.5]) {
    renderer.addCubeMatrix("grass-0", "earth", x, 1.5, 0, "full", "earth", 0.004);
  }
  renderer.build();
  const [walls, underlay, top] = root.children[0].children.flatMap((child) => child.render.meshInstances);
  const original = new Float32Array(walls.buffer.data);
  const target = {
    x: -0.5,
    y: 2.004,
    z: 0,
  };
  renderer.excavateSurface(target, 0.31);
  assert.deepEqual(walls.buffer.data, original);
  assert.notEqual(underlay.buffer, walls.buffer);
  assert.equal(underlay.buffer.data[13], -10000, "remove the soil cap across the cavity too");
  assert.equal(underlay.buffer.data[29], original[29], "keep the neighboring soil cap intact");
  assert.equal(top.buffer.data[13], -10000);
  assert.equal(top.buffer.data[29], original[29]);
  const openings = root.children[0].children.filter((child) => child.name === "Excavated cube surface");
  assert.equal(openings.length, 2);
  renderer.setIslandOffsets(0.2, -0.1);
  for (const opening of openings) {
    assert.ok(Math.abs(opening.getPosition().y - 2.204) < 1e-6);
  }
  renderer.excavateSurface(target, 0);
  assert.deepEqual(top.buffer.data, original);
  assert.deepEqual(underlay.buffer.data, original);
  assert.ok(openings.every((opening) => !opening.enabled));
});
