import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { AxeSupportGrip } from "../../../../../../../src/game/objects/characters/hero/tools/AxeSupportGrip.js";

it("corrects a blended support grip without moving the shoulder or stretching the arm", () => {
  for (const scale of [0.512, 1]) {
    const root = new Entity("Hero");
    root.setLocalScale(scale, scale, scale);
    root.setLocalEulerAngles(0, 140, 0);
    const arm = new Entity("Left arm");
    const elbow = new Entity("Left elbow");
    const hand = new Entity("Left white glove");
    const rightHand = new Entity("Right white glove");
    root.addChild(rightHand);
    rightHand.setLocalPosition(0, 0.6, 0.2);
    root.addChild(arm);
    arm.addChild(elbow);
    elbow.addChild(hand);
    arm.setLocalPosition(-0.2, 0.7, 0);
    elbow.setLocalPosition(0, -0.17, 0.14);
    hand.setLocalPosition(0, -0.17, 0.14);
    const tool = new Entity("Axe");
    const head = new Entity("Axe head");
    root.addChild(tool);
    tool.addChild(head);
    tool.setLocalPosition(0, 0.6, 0.2);
    head.setLocalPosition(0, 0, 1.24);
    const lengths = [elbow.getLocalPosition().clone(), hand.getLocalPosition().clone()];
    const socket = arm.getLocalPosition().clone();
    const grip = new AxeSupportGrip(rightHand);
    // Engine instances may come from separate module builds in the browser.
    // Numeric setter overloads avoid their Vec3/Quat instanceof boundaries.
    const setPosition = tool.setPosition.bind(tool);
    tool.setPosition = (x, y, z) => {
      assert.ok([x, y, z].every(Number.isFinite));
      setPosition(x, y, z);
    };
    for (const joint of [arm, elbow, hand]) {
      const setRotation = joint.setRotation.bind(joint);
      joint.setRotation = (x, y, z, w) => {
        assert.ok([x, y, z, w].every(Number.isFinite));
        setRotation(x, y, z, w);
      };
    }
    for (const offset of [0, 0.04, -0.03]) {
      tool.setLocalPosition(offset, 0.6, 0.2);
      grip.update(tool);
      const palm = hand.getWorldTransform().transformPoint(new Vec3(0, -0.08, 0.095));
      const expected = tool.getWorldTransform().transformPoint(new Vec3(0, 0, -0.06));
      assert.ok(palm.distance(expected) < 0.00001, "support palm stays on its authored shaft contact");
      const rightPalm = rightHand.getWorldTransform().transformPoint(new Vec3(0, -0.08, 0.095));
      assert.ok(rightPalm.distance(tool.getWorldTransform().transformPoint(new Vec3(0, 0, 0.08))) < 0.00001);
      assert.ok(arm.getLocalPosition().distance(socket) < 0.000001);
      assert.ok(elbow.getLocalPosition().distance(lengths[0]) < 0.000001);
      assert.ok(hand.getLocalPosition().distance(lengths[1]) < 0.000001);
    }
    root.destroy();
  }
});
