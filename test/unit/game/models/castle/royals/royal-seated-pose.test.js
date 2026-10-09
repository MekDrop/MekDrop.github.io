import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

for (const name of ["king", "queen", "princess"]) {
  it(`${name} embeds a seated pose with bent hips and knees`, () => {
    const buffer = readFileSync(new URL(`../../../../../../src/game/models/castle/royals/${name}.glb`, import.meta.url));
    const jsonLength = buffer.readUInt32LE(12);
    const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
    const binaryOffset = 28 + jsonLength;
    const clip = gltf.animations.find((animation) => animation.name === "RoyalSit");
    assert.ok(clip, "dedicated seated animation");
    for (const joint of ["Royal left leg rig", "Royal right leg rig", "Royal left knee", "Royal right knee"]) {
      const channel = clip.channels.find(({ target }) => gltf.nodes[target.node].name === joint && target.path === "rotation");
      assert.ok(channel, `${joint} seated articulation`);
      const accessor = gltf.accessors[clip.samplers[channel.sampler].output];
      const view = gltf.bufferViews[accessor.bufferView];
      const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const x = buffer.readFloatLE(offset);
      const w = buffer.readFloatLE(offset + 12);
      assert.ok(Math.abs(x) > 0.65 && Math.abs(w) > 0.65, `${joint} bends approximately 90 degrees instead of standing straight`);
    }
  });
}
