import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { GardenVineAttachments } from "../../../../../../src/game/objects/castle-props/garden-shelter/GardenVineAttachments.js";
import { GardenVineAttachmentNotFoundError } from "../../../../../../src/game/errors/castle/index.js";

const bytes = readFileSync(new URL("../../../../../../src/game/models/castle/garden/pergola.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;

it("reads the visible stem endpoints from the exported mesh through transformed model frames", () => {
  for (const yaw of [0, 90, 213]) {
    const owner = new Entity("island");
    owner.setPosition(7, 4, -3);
    owner.setEulerAngles(0, yaw, 0);
    const model = new Entity("scaled model");
    owner.addChild(model);
    model.setLocalScale(1.1, 0.9, 1.3);
    model.setLocalPosition(0.2, 0.1, -0.3);
    for (const [index, x] of [-1.02, 0.51].entries()) {
      const node = gltf.nodes.find(node => node.name === `Living vine shoot attachment ${index}`);
      const primitive = gltf.meshes[node.mesh].primitives[0];
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      const view = gltf.bufferViews[accessor.bufferView];
      const positions = [];
      for (let vertex = 0; vertex < accessor.count; vertex++) {
        const offset = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + vertex * (view.byteStride ?? 12);
        positions.push(bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8));
      }
      const stem = new Entity("authored node");
      model.addChild(stem);
      stem.setLocalPosition(0.02, 0.04, 0.06);
      const attachment = GardenVineAttachments.fromMesh({
        mesh: { getPositions: output => output.push(...positions) },
        node: stem,
      }, model);
      const expected = new Vec3(x + 0.02, 2.35, -1.55);
      assert.ok(attachment.distance(expected) < 0.00001,
        `mesh endpoint ${attachment.toString()}, expected ${expected.toString()}`);
      const world = model.getWorldTransform().transformPoint(attachment);
      const authoredEnd = stem.getWorldTransform().transformPoint(new Vec3(x, 2.31, -1.61));
      assert.ok(world.distance(authoredEnd) < 0.00001,
        "the live anchor must coincide with the rendered mesh at the actual scale and yaw");
    }
    owner.destroy();
  }
});

it("reports a missing authored attachment instead of guessing an anchor position", () => {
  assert.throws(() => GardenVineAttachments.read(new Entity("missing stems")), GardenVineAttachmentNotFoundError);
});
