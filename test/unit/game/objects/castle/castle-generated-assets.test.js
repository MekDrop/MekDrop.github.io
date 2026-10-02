import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

/**
 * @param {string} path
 * @returns {object}
 */
function model(path) {
  const buffer = readFileSync(new URL(`../../../../../src/game/models/castle/${path}.glb`, import.meta.url));
  const jsonLength = buffer.readUInt32LE(12);
  return { ...JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)), binary: buffer.subarray(28 + jsonLength) };
}

it("exports one rectangular interior leaf with an animated right-hand hinge", () => {
  const asset = model("doors/interior-doors");
  const hinges = asset.nodes.filter((node) => node.name.includes("hinge"));
  assert.equal(hinges.length, 1);
  // Looking inward along +Z, model -X is the viewer's right jamb.
  assert.equal(hinges[0].translation[0], -1);
  assert.equal(asset.nodes.filter((node) => node.name.includes("door plank")).length, 4);
  assert.ok(asset.animations[0].channels.some((channel) => channel.target.path === "rotation" &&
    asset.nodes[channel.target.node] === hinges[0]));
  const sampler = asset.animations[0].samplers[0];
  const output = asset.accessors[sampler.output];
  const view = asset.bufferViews[output.bufferView];
  const offset = (view.byteOffset ?? 0) + (output.byteOffset ?? 0) + (output.count - 1) * 16;
  // -90 degrees about Y swings inward and stops before cutting through the jamb.
  assert.ok(Math.abs(asset.binary.readFloatLE(offset + 4) + Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(asset.binary.readFloatLE(offset + 12) - Math.SQRT1_2) < 1e-6);
});

it("exports continuous carpet and solid masonry without overlapping decorative faces", () => {
  for (const path of ["residential/carpet-panel", "residential/masonry-block"]) {
    const asset = model(path);
    assert.equal(asset.meshes.length, 1);
    assert.equal(asset.meshes[0].primitives.length, 1);
    const primitive = asset.meshes[0].primitives[0];
    assert.equal(asset.accessors[primitive.indices].count, 36);
    assert.ok(primitive.attributes.TEXCOORD_0 !== undefined);
  }
});
