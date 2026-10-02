import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

it("keeps touching parquet and backing faces single-sided to prevent first-person depth fighting", () => {
  const bytes = readFileSync(new URL(
    "../../../../src/game/models/castle/residential/floor-panel.glb",
    import.meta.url,
  ));
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
  const backing = gltf.nodes.find(({ name }) => name === "Tile backing");
  assert.ok(backing, "the floor must retain its solid backing");
  const backingPrimitive = gltf.meshes[backing.mesh].primitives[0];
  const backingBounds = gltf.accessors[backingPrimitive.attributes.POSITION];
  const backingTop = backing.translation[1] + backingBounds.max[1];
  for (const node of gltf.nodes.filter(({ name }) => name.startsWith("Stone tile"))) {
    const primitive = gltf.meshes[node.mesh].primitives[0];
    const bounds = gltf.accessors[primitive.attributes.POSITION];
    const tileBottom = node.translation[1] + bounds.min[1];
    assert.ok(Math.abs(tileBottom - backingTop) < 1e-6, "tiles rest on the backing");
    // These opposing internal faces share a depth. Rendering both sides lets
    // them fight when the eye enters the panel or looks along its edge.
    for (const index of [primitive.material, backingPrimitive.material]) {
      assert.notEqual(gltf.materials[index].doubleSided, true, gltf.materials[index].name);
    }
  }
});
