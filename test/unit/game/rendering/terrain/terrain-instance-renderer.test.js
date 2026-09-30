import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { TerrainInstanceRenderer } from "../../../../../src/game/rendering/terrain/TerrainInstanceRenderer.js";

it("shares top and underside batches across side materials while preserving cube transforms", () => {
  let nextMeshId = 0;
  class Entity extends pc.Entity {
    addComponent(type, options) { this[type] = options; }
  }
  class VertexBuffer {
    constructor(device, format, count, options) {
      this.data = options.data;
      this.count = count;
    }
  }
  class MeshInstance {
    constructor(mesh, material) { this.mesh = mesh; this.material = material; }
    setInstancing(buffer) { this.buffer = buffer; }
  }
  const fakePc = { ...pc, Entity, VertexBuffer, MeshInstance,
    VertexFormat: { getDefaultInstancingFormat: () => ({}) },
    Mesh: { fromGeometry: () => ({ id: nextMeshId++, incRefCount() {} }) },
  };
  const root = new Entity("Terrain");
  const materials = new Map(["grass-0", "side-0", "side-1", "earth"].map((name) => [name, { name }]));
  const renderer = new TerrainInstanceRenderer({ pc: fakePc, app: { graphicsDevice: {} }, root, materials });
  renderer.addCubeMatrix("grass-0", "side-0", 0, 0.5, 0, "full", "earth");
  renderer.addCubeMatrix("grass-0", "side-1", 2, 0.5, 0, "full", "earth");
  renderer.build();
  const instances = root.children.flatMap((entity) => entity.render.meshInstances);
  assert.equal(instances.length, 4, "two sides share one top and one underside draw call");
  for (const name of ["grass-0", "earth"]) {
    const buffer = instances.find((instance) => instance.material.name === name).buffer;
    assert.equal(buffer.count, 2);
    assert.equal(buffer.data[12], 0);
    assert.equal(buffer.data[28], 2);
    assert.equal(buffer.data[13], 0.5);
    assert.equal(buffer.data[29], 0.5);
  }
  for (const name of ["side-0", "side-1"]) {
    assert.equal(instances.find((instance) => instance.material.name === name).buffer.count, 1);
  }
});
