import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { LatchScoopGel } from "../../../../../../src/game/objects/enemies/latch-slug/LatchScoopGel.js";

const skin = new Float32Array([
  -0.09, 0, -0.07, 0.1, 0, -0.06, 0.04, 0, 0.09,
  -0.09, 0, -0.07, 0.04, 0, 0.09, -0.08, 0, 0.05,
  2, 0, 0, 2.1, 0, 0, 2, 0, 0.1,
]);

test("peels a closed irregular sliver of actual skin instead of a fixed primitive", () => {
  const patch = LatchScoopGel.extractPatch(pc, skin, new pc.Vec3(), new pc.Vec3(0, 1, 0));
  assert.equal(patch.positions.length, 24);
  assert.equal(patch.indices.length, 36);
  assert.equal(Math.max(...patch.positions), Math.fround(0.1));
  const edges = new Map();
  for (let i = 0; i < patch.indices.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = patch.indices[i + j], b = patch.indices[i + (j + 1) % 3];
      const key = [Math.min(a, b), Math.max(a, b)].join();
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every(value => value === 2));
});

test("contact indents then stretches skin, distant skin stays put, and release restores visibility", () => {
  const owner = {
    pc,
    entity: new pc.Entity(),
    getImpactMeshes: () => [],
  };
  const gel = new LatchScoopGel(owner, {}, 0);
  gel.active = true;
  gel.source = {
    visible: true,
    parameters: {},
  };
  gel.wasVisible = true;
  gel.contact = new pc.Vec3();
  gel.normal = new pc.Vec3(0, 1, 0);
  gel.positions = skin;
  gel.indices = Array.from({ length: skin.length / 3 }, (_, i) => i);
  gel.patch = LatchScoopGel.extractPatch(pc, skin, gel.contact, gel.normal);
  const create = () => ({
    entity: { destroy: () => {} },
    mesh: {
      setPositions: positions => {
        result.push(Array.from(positions));
      },
      setNormals: () => {},
      update: () => {},
      destroy: () => {},
    },
    instance: { setParameter: () => {} },
  });
  const result = [];
  gel.body = create();
  gel.piece = create();
  gel.pose(0.4, new pc.Vec3());
  assert.ok(result[0][1] < 0);
  assert.equal(result[0][18], 2);
  gel.pose(0.65, new pc.Vec3(0, 0.2, 0));
  assert.ok(result[2][1] > 0);
  assert.equal(gel.piece.entity.enabled, false, "the peeled region is still part of the connected skin");
  assert.notDeepEqual(result[1], result[3]);
  assert.equal(gel.source.visible, false);
  gel.pose(0.8, new pc.Vec3(0, 0.2, 0));
  assert.equal(gel.piece.entity.enabled, true);
  gel.pose(1.1, new pc.Vec3(0, 0.2, 0));
  assert.ok(Math.abs(result[6][1]) < Math.abs(result[4][1]), "the body recoils to its old silhouette");
  gel.destroy();
  assert.equal(gel.source.visible, true);
  gel.source.visible = false;
  gel.destroy();
  assert.equal(gel.source.visible, false, "late scoop cleanup must not resurrect a collapsed body");
});
