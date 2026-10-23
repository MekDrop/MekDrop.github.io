import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { BoundingBox, Vec3 } from "playcanvas";
import { BowlPacking } from "../../../../../../src/game/objects/castle-props/bowl/BowlPacking.js";
import { AmmoPhysicsWorld } from "playcanvas/build/playcanvas/src/framework/physics/ammo/ammo-physics-world.js";

const previousAmmo = globalThis.Ammo;
before(async () => {
  const base = new URL("../../../../../../src/assets/game/wasm/ammo/", import.meta.url);
  const context = {
    module: { exports: {} },
    exports: {},
    require: createRequire(import.meta.url),
    process,
    __dirname: "",
    Buffer,
    console,
    setTimeout,
    clearTimeout,
  };
  runInNewContext(readFileSync(new URL("ammo.wasm.js", base), "utf8").replace("export default Ammo;", ""), context);
  globalThis.Ammo = await context.module.exports({ wasmBinary: readFileSync(new URL("ammo.wasm.wasm", base)) });
});
after(() => {
  globalThis.Ammo = previousAmmo;
});

/**
 * Reads the untransformed mesh primitives of the authored bowl kit.
 * @param {string} path
 * @returns {import("../../../../../../src/game/objects/castle-props/bowl/BowlPacking.js").BowlPackingGeometry}
 */
function assetGeometry(path) {
  const buffer = readFileSync(new URL(`../../../../../../src/game/models/${path}`, import.meta.url));
  const length = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + length));
  const binary = buffer.subarray(28 + length);
  /**
   * @param {number} id
   * @returns {number[]}
   */
  const accessor = (id) => {
    const data = gltf.accessors[id], view = gltf.bufferViews[data.bufferView];
    const components = data.type === "VEC3" ? 3 : 1;
    const bytes = data.componentType === 5123 ? 2 : 4;
    const values = [];
    for (let index = 0; index < data.count; index++) {
      for (let component = 0; component < components; component++) {
        const offset = (view.byteOffset ?? 0) + (data.byteOffset ?? 0) +
          index * (view.byteStride ?? components * bytes) + component * bytes;
        values.push(data.componentType === 5126 ? binary.readFloatLE(offset) :
          bytes === 2 ? binary.readUInt16LE(offset) : binary.readUInt32LE(offset));
      }
    }

    return values;
  };
  const positions = [], indices = [];
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const base = positions.length / 3;
      positions.push(...accessor(primitive.attributes.POSITION));
      indices.push(...accessor(primitive.indices).map(index => index + base));
    }
  }
  const bounds = new BoundingBox();
  bounds.compute(positions);

  return {
    positions,
    indices,
    bounds,
  };
}

test("authored voxel bowls cook compact hulls and keep only the current drop dynamic", async () => {
  const shell = assetGeometry("bowl/bowl.glb");
  const vegetable = assetGeometry("food/green-vegetable.glb");
  const size = vegetable.bounds.halfExtents;
  const fit = 0.07056 / (2 * Math.max(size.x, size.y, size.z));
  vegetable.positions = vegetable.positions.map(value => value * fit);
  vegetable.bounds.compute(vegetable.positions);
  assert.equal(BowlPacking.convexPoints(vegetable.positions).length, 8 * 3,
    "render face tessellation must reduce to the eight box corners");
  const dynamic = new Set();
  let supports = 0;
  const addBody = AmmoPhysicsWorld.prototype.addBody;
  const removeBody = AmmoPhysicsWorld.prototype.removeBody;
  AmmoPhysicsWorld.prototype.addBody = function (body, group, mask) {
    if (body._type === "dynamic") {
      dynamic.add(body);
    } else {
      supports++;
    }
    assert.ok(dynamic.size <= 1, "settled items must become static supports");

    return addBody.call(this, body, group, mask);
  };
  AmmoPhysicsWorld.prototype.removeBody = function (body) {
    dynamic.delete(body);

    return removeBody.call(this, body);
  };
  try {
    const poses = BowlPacking.settle(shell, Array.from({ length: 9 }, () => vegetable));
    assert.equal(poses.length, 9);
    assert.equal(supports, 10);
    assert.equal(dynamic.size, 0);
    let painted = false;
    const timer = setTimeout(() => {
      painted = true;
    }, 0);
    const asyncPoses = await BowlPacking.settleAsync(shell, Array.from({ length: 9 }, () => vegetable));
    clearTimeout(timer);
    assert.equal(painted, true, "loading must get an event-loop turn while packing");
    assert.deepEqual(asyncPoses, poses, "yielding preserves every fixed physics step");
    assert.equal(dynamic.size, 0);
    for (const pose of poses) {
      assert.ok(Number.isFinite(pose.position.y) && pose.position.y > -0.1 && pose.position.y < 0.4);
    }
  } finally {
    AmmoPhysicsWorld.prototype.addBody = addBody;
    AmmoPhysicsWorld.prototype.removeBody = removeBody;
  }
});

/**
 * @param {number[]} center
 * @param {number[]} half
 * @returns {import("../../../../../../src/game/objects/castle-props/bowl/BowlPacking.js").BowlPackingGeometry}
 */
function box(center, half) {
  const positions = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        positions.push(center[0] + x * half[0], center[1] + y * half[1], center[2] + z * half[2]);
      }
    }
  }

  return {
    positions,
    indices: [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1,
      2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3],
    bounds: new BoundingBox(new Vec3(...center), new Vec3(...half)),
  };
}

test("Ammo packs unlike shapes inside a hollow shell and returns frozen, repeatable poses", () => {
  const pieces = [box([0, 0.01, 0], [0.12, 0.01, 0.12]),
    box([-0.13, 0.07, 0], [0.01, 0.07, 0.14]), box([0.13, 0.07, 0], [0.01, 0.07, 0.14]),
    box([0, 0.07, -0.13], [0.12, 0.07, 0.01]), box([0, 0.07, 0.13], [0.12, 0.07, 0.01])];
  const shell = {
    positions: [],
    indices: [],
    bounds: new BoundingBox(new Vec3(0, 0.07, 0), new Vec3(0.14, 0.07, 0.14)),
  };
  for (const piece of pieces) {
    const offset = shell.positions.length / 3;
    shell.positions.push(...piece.positions);
    shell.indices.push(...piece.indices.map(index => index + offset));
  }
  const items = [box([0, 0, 0], [0.025, 0.025, 0.025]), box([0.01, 0.02, 0], [0.04, 0.012, 0.018]),
    box([0, 0, 0], [0.018, 0.035, 0.018])];
  const poses = BowlPacking.settle(shell, items);
  assert.equal(poses.length, items.length);
  assert.deepEqual(BowlPacking.settle(shell, items), poses);
  for (const [index, pose] of poses.entries()) {
    const center = pose.rotation.transformVector(items[index].bounds.center).add(pose.position);
    assert.ok(center.y > 0.025 && center.y < 0.16, `object rests in the bowl: ${center.y}`);
    assert.ok(Math.abs(center.x) < 0.12 && Math.abs(center.z) < 0.12);
  }
  assert.deepEqual(BowlPacking.settle(shell, []), []);
});
