import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { IslandObjectRoots } from "../../../../../src/game/objects/shared/IslandObjectRoots.js";

it("preserves prop transforms and follows only the owning island", () => {
  const parent = new pc.Entity("map");
  parent.setLocalPosition(8, 9, 10);
  const roots = new IslandObjectRoots(pc, parent, {
    islandConnectorData: { nearIsland: ["2,3"], farIsland: ["7,6"] },
  });
  const near = new pc.Entity("tree");
  const far = new pc.Entity("rock mesh with map-space vertices");
  const unowned = new pc.Entity("unowned");
  near.setLocalPosition(-4, 2, 3);
  near.setLocalEulerAngles(0, 37, 0);
  near.setLocalScale(2, 3, 4);
  const rotation = near.getLocalRotation().clone();
  roots.addChild(near, { col: 2, row: 3 });
  roots.addChild(far, { col: 7, row: 6 });
  roots.addChild(unowned, { col: 0, row: 0 });
  for (const [nearOffset, farOffset] of [[0.5, -0.25], [-0.1, 0.75], [0, 0]]) {
    roots.setOffsets(nearOffset, farOffset);
    assert.deepEqual(near.getLocalPosition().toArray(), [-4, 2, 3]);
    assert.ok(near.getLocalRotation().equals(rotation));
    assert.deepEqual(near.getLocalScale().toArray(), [2, 3, 4]);
    assert.ok(Math.abs(near.getPosition().y - (11 + nearOffset)) < 1e-6);
    assert.ok(Math.abs(far.getPosition().y - (9 + farOffset)) < 1e-6);
    assert.equal(unowned.getPosition().y, 9);
  }
  // Objects created after motion begins inherit the current island offset.
  const patch = new pc.Entity("dirt patch");
  roots.setOffsets(0.5, -0.25);
  patch.setLocalPosition(1, 2, 3);
  roots.addChild(patch, { col: 7, row: 6 });
  assert.equal(patch.getPosition().y, 10.75);
  parent.destroy();
});

it("keeps single-island props directly under their original parent", () => {
  const parent = new pc.Entity();
  const roots = new IslandObjectRoots(pc, parent);
  const prop = new pc.Entity();
  prop.setLocalPosition(1, 2, 3);
  roots.addChild(prop, { col: 2, row: 3 });
  roots.setOffsets(1, -1);
  assert.equal(prop.parent, parent);
  assert.deepEqual(prop.getLocalPosition().toArray(), [1, 2, 3]);
  parent.destroy();
});
