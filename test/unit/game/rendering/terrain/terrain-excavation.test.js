import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { TerrainInstanceRenderer } from "../../../../../src/game/rendering/terrain/TerrainInstanceRenderer.js";

class Mesh {
  static fromGeometry() { return new Mesh(); }
  incRefCount() {} decRefCount() {} destroy() {}
  setPositions() {} setNormals() {} setUvs() {} setIndices() {} update() {}
}
class Entity extends pc.Entity {
  addComponent(type, options) { this.render = options; }
}
class VertexBuffer {
  constructor(device, format, count, options) { this.data = options.data; }
  lock() { return this.data; } unlock() {} destroy() {}
}
class MeshInstance {
  constructor(mesh, material) { this.mesh = mesh; this.material = material; }
  setInstancing(buffer) { this.buffer = buffer; }
}

it("opens and restores a single grass top without moving its walls or neighboring cube", () => {
  const root = new pc.Entity();
  const renderer = new TerrainInstanceRenderer({
    pc: { ...pc, Entity, Mesh, VertexBuffer, MeshInstance, VertexFormat: { getDefaultInstancingFormat() {} } },
    app: { graphicsDevice: {} }, root, materials: new Map([["grass-0", {}], ["earth", {}]]),
    mapData: { cols: 2, rows: 1, islandConnectorData: { nearIsland: ["0,0", "1,0"], farIsland: [] } },
  });
  for (const x of [-0.5, 0.5]) { renderer.addCubeMatrix("grass-0", "earth", x, 1.5, 0, "full", "earth", 0.004); }
  renderer.build();
  const batch = root.children[0].children[0];
  const [walls, underlay, top] = batch.render.meshInstances;
  const original = new Float32Array(walls.buffer.data);
  const target = { x: -0.5, y: 2.004, z: 0 };
  renderer.excavateSurface(target, 0.31);
  assert.deepEqual(walls.buffer.data, original);
  assert.equal(underlay.buffer, walls.buffer);
  assert.equal(top.buffer.data[13], -10000);
  assert.equal(top.buffer.data[29], original[29]);
  const opening = root.children[0].children[1];
  renderer.setIslandOffsets(0.2, -0.1);
  assert.ok(Math.abs(opening.getPosition().y - 2.204) < 1e-6);
  renderer.excavateSurface(target, 0);
  assert.deepEqual(top.buffer.data, original);
  assert.equal(opening.enabled, false);
});
