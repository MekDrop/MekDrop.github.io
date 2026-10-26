import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { TerracePropGrip } from "../../../../../../../src/game/objects/castle/rooms/terrace/TerracePropGrip.js";

it("keeps deep cargo ahead of the carrier across stage scales, headings and elevations", () => {
  for (const yaw of [0, 73, 180, 270]) {
    for (const elevation of [0, 0.6, 1.2]) {
      const stage = new pc.Entity();
      stage.setLocalPosition(3, 2, -4);
      stage.setLocalScale(0.68, 0.68, 0.68);
      stage.setLocalEulerAngles(0, -31, 0);
      const entity = new pc.Entity();
      entity.setPosition(2, elevation, 5);
      entity.setEulerAngles(0, yaw, 0);
      entity.setLocalScale(0.62, 0.62, 0.62);
      const leftHand = new pc.Entity();
      const rightHand = new pc.Entity();
      entity.addChild(leftHand);
      entity.addChild(rightHand);
      leftHand.setLocalPosition(-0.3, 1.1, 0.3);
      rightHand.setLocalPosition(0.3, 1.1, 0.3);
      const prop = new pc.Entity();
      stage.addChild(prop);
      const mesh = { aabb: new pc.BoundingBox(new pc.Vec3(0, 0.5, 0), new pc.Vec3(0.5, 0.5, 0.7)) };
      prop.findComponents = () => [{
        meshInstances: [{
          mesh,
          node: prop,
        }],
      }];
      const actor = {
        entity,
        model: entity,
        height: 2.2,
        leftHand,
        rightHand,
      };
      prop.setLocalPosition(TerracePropGrip.carryPosition(pc, stage, prop, actor, [[-0.3, 0.8, 0], [0.3, 0.8, 0]]));
      const forward = entity.getRotation().transformVector(new pc.Vec3(0, 0, 1));
      const front = prop.getPosition().clone().sub(entity.getPosition()).dot(forward) - 0.7 * 0.68;
      assert.ok(front >= 2.2 * 0.62 * 0.15 - 0.00001, `yaw ${yaw}, elevation ${elevation}: ${front}`);
      stage.destroy();
      entity.destroy();
    }
  }
});

it("lifts the cargo's low vertices above a higher tread ahead of the carrier", () => {
  const stage = new pc.Entity();
  const prop = new pc.Entity();
  stage.addChild(prop);
  const entity = new pc.Entity();
  const leftHand = new pc.Entity();
  const rightHand = new pc.Entity();
  entity.addChild(leftHand);
  entity.addChild(rightHand);
  leftHand.setLocalPosition(-0.3, 0.85, 0.4);
  rightHand.setLocalPosition(0.3, 0.85, 0.4);
  const vertices = [-0.3, 0, -0.3, 0.3, 0, 0.3, 0, 0.8, 0];
  const mesh = {
    aabb: new pc.BoundingBox(new pc.Vec3(0, 0.4, 0), new pc.Vec3(0.3, 0.4, 0.3)),
    getPositions: (values) => values.push(...vertices),
  };
  prop.findComponents = () => [{
    meshInstances: [{
      mesh,
      node: prop,
    }],
  }];
  const actor = {
    entity,
    model: entity,
    height: 2.2,
    leftHand,
    rightHand,
    carrySupportHeight: (point) => point.z > 0.5 ? 0.3 : 0,
  };
  prop.setLocalPosition(TerracePropGrip.carryPosition(pc, stage, prop, actor, [[-0.3, 0.8, 0], [0.3, 0.8, 0]]));
  for (let index = 0; index < vertices.length; index += 3) {
    const point = prop.getWorldTransform().transformPoint(new pc.Vec3(...vertices.slice(index, index + 3)));
    assert.ok(point.y >= actor.carrySupportHeight(point) + 0.0149, "carried legs must clear the next tread, not only the carrier's floor");
  }
  stage.destroy();
  entity.destroy();
});

it("clears a tread under a broad face even when all four corner vertices miss it", () => {
  const stage = new pc.Entity();
  const prop = new pc.Entity();
  stage.addChild(prop);
  const entity = new pc.Entity();
  const leftHand = new pc.Entity();
  const rightHand = new pc.Entity();
  entity.addChild(leftHand);
  entity.addChild(rightHand);
  leftHand.setLocalPosition(-0.2, 0.85, 0.3);
  rightHand.setLocalPosition(0.2, 0.85, 0.3);
  const vertices = [-0.3, 0, -0.3, 0.3, 0, -0.3, 0.3, 0, 0.3, -0.3, 0, 0.3];
  const mesh = {
    aabb: new pc.BoundingBox(pc.Vec3.ZERO, new pc.Vec3(0.3, 0, 0.3)),
    getPositions: values => values.push(...vertices),
    getIndices: values => values.push(0, 1, 2, 0, 2, 3),
  };
  prop.findComponents = () => [{
    meshInstances: [{
      mesh,
      node: prop,
    }],
  }];
  const actor = {
    entity,
    model: entity,
    height: 2.2,
    leftHand,
    rightHand,
    carrySupportHeight: point => Math.abs(point.x) < 0.05 && point.z > 0.55 && point.z < 0.75 ? 1.1 : 0,
  };
  prop.setLocalPosition(TerracePropGrip.carryPosition(pc, stage, prop, actor, [[-0.2, 0, 0], [0.2, 0, 0]]));
  assert.ok(prop.getPosition().y >= 1.1149, "the face interior needs clearance even though its original vertices never enter the tread");
  stage.destroy();
  entity.destroy();
});

it("includes an overhanging saucer in the loaded tray's tread clearance", () => {
  const stage = new pc.Entity();
  const tray = new pc.Entity();
  const saucer = new pc.Entity();
  stage.addChild(tray);
  stage.addChild(saucer);
  saucer.setLocalPosition(0, 0, 0.6);
  for (const prop of [tray, saucer]) {
    const mesh = {
      aabb: new pc.BoundingBox(pc.Vec3.ZERO, new pc.Vec3(0.2, 0, 0.2)),
      getPositions: values => values.push(-0.2, 0, -0.2, 0.2, 0, -0.2, 0.2, 0, 0.2, -0.2, 0, 0.2),
      getIndices: values => values.push(0, 1, 2, 0, 2, 3),
    };
    prop.findComponents = () => [{
      meshInstances: [{
        mesh,
        node: prop,
      }],
    }];
  }
  const entity = new pc.Entity();
  const leftHand = new pc.Entity();
  const rightHand = new pc.Entity();
  entity.addChild(leftHand);
  entity.addChild(rightHand);
  leftHand.setLocalPosition(-0.2, 0.85, 0.5);
  rightHand.setLocalPosition(0.2, 0.85, 0.5);
  const actor = {
    entity,
    model: entity,
    height: 2.2,
    leftHand,
    rightHand,
    carrySupportHeight: point => point.z > 1 ? 1.1 : 0,
  };
  const grips = [[-0.2, 0, 0], [0.2, 0, 0]];
  const empty = TerracePropGrip.carryPosition(pc, stage, tray, actor, grips);
  const loaded = TerracePropGrip.carryPosition(pc, stage, tray, actor, grips, null, 0.022, 0, 0, [saucer]);
  assert.ok(empty.y < 1.1, "the tray alone does not reach the higher tread");
  assert.ok(loaded.y >= 1.1149, "the overhanging saucer must clear that tread too");
  stage.destroy();
  entity.destroy();
});
