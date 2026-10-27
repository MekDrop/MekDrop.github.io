import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Mat4, Quat, Vec3 } from "playcanvas";

for (const name of ["king", "queen", "princess"]) {
  it(`${name} embeds a seated pose with bent hips and knees`, () => {
    const buffer = readFileSync(new URL(`../../../../../../src/game/models/castle/royals/${name}.glb`, import.meta.url));
    const jsonLength = buffer.readUInt32LE(12);
    const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
    const binaryOffset = 28 + jsonLength;
    const clip = gltf.animations.find((animation) => animation.name === "RoyalSit");
    assert.ok(clip, "dedicated seated animation");
    if (name === "king" || name === "queen") {
      const transforms = gltf.nodes.map((node) => ({
        translation: node.translation ?? [0, 0, 0],
        rotation: node.rotation ?? [0, 0, 0, 1],
        scale: node.scale ?? [1, 1, 1],
      }));
      for (const channel of clip.channels) {
        const accessor = gltf.accessors[clip.samplers[channel.sampler].output];
        const view = gltf.bufferViews[accessor.bufferView];
        const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const size = channel.target.path === "rotation" ? 4 : 3;
        transforms[channel.target.node][channel.target.path] = Array.from({ length: size }, (_, index) => buffer.readFloatLE(offset + index * 4));
      }
      const parents = new Map();
      gltf.nodes.forEach((node, index) => node.children?.forEach((child) => parents.set(child, index)));
      const matrices = new Map();
      /**
       * @param {number} index
       * @returns {Mat4}
       */
      function world(index) {
        if (matrices.has(index)) {
          return matrices.get(index);
        }
        const pose = transforms[index];
        const matrix = new Mat4().setTRS(new Vec3(...pose.translation), new Quat(...pose.rotation), new Vec3(...pose.scale));
        if (parents.has(index)) {
          matrix.mul2(world(parents.get(index)), matrix.clone());
        }
        matrices.set(index, matrix);

        return matrix;
      }
      const pose = new Map(gltf.nodes.map((node, index) => [node.name, world(index).getTranslation()]));
      for (const side of ["left", "right"]) {
        const hip = pose.get(`Royal ${side} leg rig`);
        const knee = pose.get(`Royal ${side} knee`);
        const ankle = pose.get(`${name === "king" ? "King" : "Queen"} ${side} foot`);
        assert.ok(hip && knee && ankle, `${side} seated leg requires hip, knee, and ankle joints`);
        const thigh = knee.clone().sub(hip).normalize();
        const shin = ankle.clone().sub(knee).normalize();
        assert.ok(Math.abs(thigh.y) < 0.2, `${side} seated thigh should rest approximately horizontally`);
        assert.ok(shin.y < -0.9, `${side} seated shin should hang down from the knee`);
        assert.ok(Math.abs(thigh.dot(shin)) < 0.2, `${side} knee bends approximately 90 degrees in world space`);
      }

      return;
    }
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
