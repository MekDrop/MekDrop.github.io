import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { ResidentFootPlacement } from "../../../../../../src/game/objects/castle/residents/ResidentFootPlacement.js";

for (const scale of [0.6, 1]) {
  it(`plants both soles on distinct treads at scale ${scale} and restores authored motion`, () => {
    const root = new pc.Entity();
    const model = new pc.Entity();
    root.addChild(model);
    const legs = [];
    for (const [side, x] of [["left", -0.15], ["right", 0.15]]) {
      const hip = new pc.Entity(`Royal ${side} leg rig`);
      const knee = new pc.Entity(`Servant ${side} knee`);
      const ankle = new pc.Entity(`mixamorig:${side === "left" ? "Left" : "Right"}Foot`);
      model.addChild(hip); hip.addChild(knee); knee.addChild(ankle);
      hip.setLocalPosition(x, 0.8, 0);
      knee.setLocalPosition(0, -0.4, 0.01);
      ankle.setLocalPosition(0, -0.3, -0.01);
      legs.push({
        hip,
        knee,
        ankle,
      });
    }
    const placement = new ResidentFootPlacement(pc, root, model);
    root.setLocalScale(scale, scale, scale);
    const before = legs.map(({ hip, knee, ankle }) => [hip.getLocalRotation().clone(), knee.getLocalRotation().clone(), ankle.getRotation().clone()]);
    placement.apply((x) => x < 0 ? 0.2 * scale : 0.1 * scale);
    for (const [index, { ankle }] of legs.entries()) {
      const expected = (index ? 0.2 : 0.3) * scale;
      assert.ok(Math.abs(ankle.getPosition().y - expected) < 0.0001,
        `ankle ${ankle.getPosition().y} expected ${expected}`);
      assert.ok(ankle.getRotation().equalsApprox(before[index][2], 0.0001));
    }
    placement.restore();
    for (const [index, { hip, knee, ankle }] of legs.entries()) {
      assert.ok(hip.getLocalRotation().equalsApprox(before[index][0], 0.0001));
      assert.ok(knee.getLocalRotation().equalsApprox(before[index][1], 0.0001));
      assert.ok(Math.abs(ankle.getPosition().y - 0.1 * scale) < 0.0001);
    }
    root.destroy();
  });
}
