import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { GroundCoverHeldItem } from "../../../../../src/game/objects/ground-cover/GroundCoverHeldItem.js";

it("turns an upright mushroom around its supporting grip without moving the grip", () => {
  const hero = new pc.Entity("hero");
  hero.setLocalEulerAngles(0, 45, 0);
  const hand = new pc.Entity("hand");
  hero.addChild(hand);
  hand.setLocalPosition(-0.3, 0.46, 0.8);
  hand.setLocalEulerAngles(0, 0, 90);
  const item = new GroundCoverHeldItem({
    pc,
    modelLibrary: { instantiate: () => new pc.Entity("model") },
    modelUrl: "mushroom.glb",
    name: "mushroom",
    gripPoint: {
      x: -0.3,
      y: 0.46,
      z: 0,
    },
    pickupTilt: 0,
    keepCapUpright: true,
  });
  item.mount(hero, hand);
  const root = hero.findByName("Held mushroom");
  assert.ok(root.getLocalPosition().distance(new pc.Vec3(0, 0, 0.8)) < 0.00001);
  for (const yaw of [-45, -90, -135, -180]) {
    hand.setLocalRotation(new pc.Quat().setFromEulerAngles(0, yaw, 0)
      .mul(new pc.Quat().setFromEulerAngles(0, 0, 90)));
    item.follow();
    const grip = root.getWorldTransform().transformPoint(new pc.Vec3(-0.3, 0.46, 0));
    assert.ok(grip.distance(hand.getPosition()) < 0.00001, `grip slipped at ${yaw} degrees`);
    assert.ok(root.up.dot(pc.Vec3.UP) > 0.9999, "cap must stay upright");
  }
  assert.ok(root.getLocalPosition().x < -0.59, "the turn must carry the cap outside the body");
  item.destroy();
  hero.destroy();
});

it("aligns the held mushroom with a model facing independently of the hero root", () => {
  const hero = new pc.Entity("hero");
  const model = new pc.Entity("model");
  hero.addChild(model);
  model.setLocalEulerAngles(0, 45, 0);
  const hand = new pc.Entity("hand");
  model.addChild(hand);
  hand.setLocalPosition(-0.3, 0.46, 0.8);
  hand.setLocalEulerAngles(0, 0, 90);
  const item = new GroundCoverHeldItem({
    pc,
    modelLibrary: { instantiate: () => new pc.Entity("visual") },
    modelUrl: "mushroom.glb",
    name: "mushroom",
    gripPoint: {
      x: -0.3,
      y: 0.46,
      z: 0,
    },
    pickupTilt: 0,
    keepCapUpright: true,
  });
  item.mount(hero, hand);
  const expected = model.getWorldTransform().transformPoint(new pc.Vec3(0, 0, 0.8));
  assert.ok(hero.findByName("Held mushroom").getPosition().distance(expected) < 0.00001);
  item.destroy();
  hero.destroy();
});
