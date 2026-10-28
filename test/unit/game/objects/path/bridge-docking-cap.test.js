import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

it("keeps brass corners inside the bridge footprint at both docking ends", () => {
  const bytes = readFileSync(new URL("../../../../../src/game/models/bridge/bridge-docking-cap.glb", import.meta.url));
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
  assert.equal(gltf.meshes.length, 1);
  const meshNode = gltf.nodes.find((node) => node.mesh === 0);
  assert.ok(!meshNode.translation || meshNode.translation.every((value) => value === 0));
  const bounds = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
  assert.ok(bounds.min[0] >= -0.991 && bounds.max[0] <= 0.991, "brass stays inside the two lane deck, away from neighbouring grass");
  for (const direction of [-1, 1]) {
    const ends = [bounds.min[2], bounds.max[2]].map((value) => direction * (0.47 + value));
    assert.ok(Math.min(...ends) >= -0.500001 && Math.max(...ends) <= 0.500001,
      "inward corner plates cannot overlap the adjacent path while the islands bob");
  }
  const primitive = gltf.meshes[0].primitives[0];
  const position = gltf.accessors[primitive.attributes.POSITION];
  const normal = gltf.accessors[primitive.attributes.NORMAL];
  const positionView = gltf.bufferViews[position.bufferView];
  const normalView = gltf.bufferViews[normal.bufferView];
  const binaryStart = 28 + bytes.readUInt32LE(12);
  for (let index = 0; index < position.count; index++) {
    const y = bytes.readFloatLE(binaryStart + (positionView.byteOffset ?? 0) + (position.byteOffset ?? 0) + index * (positionView.byteStride ?? 12) + 4);
    const up = bytes.readFloatLE(binaryStart + (normalView.byteOffset ?? 0) + (normal.byteOffset ?? 0) + index * (normalView.byteStride ?? 12) + 4);
    assert.ok(up < 0.99 || Math.abs(y) > 0.001, "brass top faces must not share the timber deck plane and flicker");
  }
});
