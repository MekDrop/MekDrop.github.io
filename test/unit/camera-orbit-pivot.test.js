import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CameraOrbitPivot } from "../../src/game/camera/CameraOrbitPivot.js";

const camera = {
  nearClip: 0,
  farClip: 20,
  screenToWorld: (x, y, depth) => new pc.Vec3(0, 10 - depth, 0),
};
const terrain = { cols: 1, rows: 1, heightmap: [[2]] };

function root(instances = []) {
  return {
    getWorldTransform: () => new pc.Mat4(),
    findComponents: () => [{ enabled: true, entity: { enabled: true }, meshInstances: instances }],
  };
}

function triangle(positions) {
  return {
    visible: true,
    pick: true,
    material: { blendType: pc.BLEND_NONE },
    node: { getWorldTransform: () => new pc.Mat4() },
    aabb: new pc.BoundingBox(new pc.Vec3(0, 5, 0), new pc.Vec3(2, 0.1, 2)),
    mesh: {
      getPositions: (out) => out.push(...positions),
      getIndices: (out) => out.push(0, 1, 2),
    },
  };
}

it("focuses on the raised object under the center, ahead of the terrain", () => {
  const object = triangle([-1, 5, -1, 1, 5, -1, 0, 5, 1]);
  const focus = new CameraOrbitPivot(pc).find(camera, root([object]), terrain, 800, 600);
  assert.deepEqual([focus.x, focus.y, focus.z], [0, 5, 0]);
});

it("looks through empty parts of mesh bounds to the terrain", () => {
  const object = triangle([1, 5, 1, 2, 5, 1, 1, 5, 2]);
  const focus = new CameraOrbitPivot(pc).find(camera, root([object]), terrain, 800, 600);
  assert.equal(focus.y, 2);
});

it("ignores unpickable particles and returns no focus over empty space", () => {
  const particle = triangle([-1, 5, -1, 1, 5, -1, 0, 5, 1]);
  particle.pick = false;
  const focus = new CameraOrbitPivot(pc).find(camera, root([particle]), { ...terrain, heightmap: [[0]] }, 800, 600);
  assert.equal(focus, null);
});
