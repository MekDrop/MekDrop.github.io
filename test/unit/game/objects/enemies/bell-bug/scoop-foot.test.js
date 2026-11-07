import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { BellBugScoopFoot } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugScoopFoot.js";

test("bends the toe onto contact while retaining the socket and shared source mesh", () => {
  const original = [0, 0, 0, 0, 0, -0.3, 0.05, 0, -0.1];
  const source = {
    getPositions: output => output.push(...original),
    getIndices: output => output.push(0, 1, 2),
    getUvs: () => {},
  };
  const bone = new pc.Entity("leg_L_0");
  const node = new pc.Entity();
  bone.addChild(node);
  const instance = {
    mesh: source,
    node,
  };
  node.findComponents = () => [{ meshInstances: [instance] }];
  const model = { findByName: name => name === "leg_L_0" ? bone : node };
  class CaptureMesh {
    setPositions(positions) {
      this.positions = positions;
    }
    setIndices() {}
    setNormals() {}
    update() {}
    destroy() {}
  }
  const owner = {
    pc: {
      ...pc,
      Mesh: CaptureMesh,
    },
    app: { graphicsDevice: {} },
  };
  const foot = new BellBugScoopFoot(owner, model, 0);
  const goal = new pc.Vec3(0.2, 0.1, -0.25);
  assert.equal(foot.canReach(goal), true);
  assert.equal(foot.canReach(new pc.Vec3(2, 0, 0)), false);
  foot.pose(goal);
  assert.ok(foot.contactPoint.distance(goal) < 1e-6);
  assert.deepEqual(Array.from(foot.mesh.positions.slice(0, 3)), [0, 0, 0]);
  assert.deepEqual(original, [0, 0, 0, 0, 0, -0.3, 0.05, 0, -0.1]);
  foot.restore();
  assert.equal(instance.mesh, source);
  assert.ok(bone.getLocalRotation().equals(pc.Quat.IDENTITY));
  foot.destroy();
});
