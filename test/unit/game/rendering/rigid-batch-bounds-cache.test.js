import assert from "node:assert/strict";
import { it } from "node:test";
import { BoundingBox, GraphNode, Vec3 } from "playcanvas";
import { cacheRigidBatchBounds } from "../../../../src/game/rendering/RigidBatchBoundsCache.js";

it("reuses bounds but invalidates them for movement, ancestor scaling and mesh changes", () => {
  const parent = new GraphNode("island");
  const node = new GraphNode("prop");
  parent.addChild(node);
  const geometry = new BoundingBox(new Vec3(Math.PI / 10, 0, 0), new Vec3(0.123456789, 1, 1));
  let updates = 0;
  const batch = { dynamic: true, origMeshInstances: [{ node, mesh: { aabb: geometry } }],
    updateBoundingBox: () => { updates++; } };
  cacheRigidBatchBounds(batch);
  cacheRigidBatchBounds(batch);
  for (let frame = 0; frame < 120; frame++) batch.updateBoundingBox();
  assert.equal(updates, 1);
  node.setLocalPosition(0, 0, 0);
  batch.updateBoundingBox();
  assert.equal(updates, 1);
  node.setLocalPosition(2, 0, 0);
  batch.updateBoundingBox();
  assert.equal(updates, 2);
  parent.setLocalScale(2, 2, 2);
  batch.updateBoundingBox();
  assert.equal(updates, 3);
  geometry.halfExtents.set(2, 2, 2);
  batch.updateBoundingBox();
  assert.equal(updates, 4);
  batch.origMeshInstances.push({ node: new GraphNode("new prop"), mesh: { aabb: geometry } });
  batch.updateBoundingBox();
  assert.equal(updates, 5);
});
