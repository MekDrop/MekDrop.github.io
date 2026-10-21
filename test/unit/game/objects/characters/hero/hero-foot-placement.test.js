import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as pc from "playcanvas";
import { HeroFootPlacement } from "../../../../../../src/game/objects/characters/hero/HeroFootPlacement.js";

function createFoot(side, tiltSole = true) {
  const leg = new pc.Entity(`${side} leg`);
  const sole = new pc.Entity(`${side} sole`);
  const cuff = new pc.Entity(`${side} cuff`);
  sole.render = {
    meshInstances: [
      {
        mesh: {
          aabb: new pc.BoundingBox(
            new pc.Vec3(0, 0, 0),
            new pc.Vec3(0.1, 0.05, 0.2),
          ),
        },
      },
    ],
  };
  leg.addChild(sole);
  leg.addChild(cuff);

  return {
    side,
    leg,
    sole,
    cuff,
    tiltingParts: tiltSole ? [sole] : [],
  };
}

describe("hero foot placement physics contacts", () => {
  it("aligns boot meshes without reparenting or moving the animated ankle", () => {
    const left = createFoot("left");
    const ankle = new pc.Entity("Left ankle");
    left.leg.addChild(ankle);
    ankle.setLocalPosition(0, 0.4, 0.2);
    ankle.setLocalEulerAngles(20, 0, 0);
    ankle.addChild(left.sole);
    const position = ankle.getPosition().clone();
    const rotation = ankle.getLocalRotation().clone();
    const placement = new HeroFootPlacement({
      pc,
      surfaceAt: () => ({
        height: 0,
        normal: new pc.Vec3(0.3, 1, 0).normalize(),
      }),
      getHeroPosition: () => new pc.Vec3(),
      left,
      right: createFoot("right"),
    });
    placement.update(1, true);
    assert.equal(ankle.parent.name, "Left leg surface adjustment");
    assert.ok(ankle.getLocalRotation().equals(rotation));
    assert.ok(Math.abs(ankle.getPosition().x - position.x) < 0.00001);
    assert.ok(Math.abs(ankle.getPosition().z - position.z) < 0.00001);
    assert.equal(left.sole.parent.name, "left boot surface tilt");
  });

  it("lifts and tilts boots from physics raycast hits", () => {
    const raycasts = [];
    const placement = new HeroFootPlacement({
      pc,
      surfaceAt: (x, z, maximumHeight) => {
        raycasts.push({
          x,
          z,
          maximumHeight,
        });

        return {
          height: 0,
          normal: new pc.Vec3(0.8, 0.6, 0),
          point: new pc.Vec3(x, 0, z),
        };
      },
      getHeroPosition: () => new pc.Vec3(0, 0, 0),
      left: createFoot("left"),
      right: createFoot("right"),
    });

    placement.update(1, true);

    assert.equal(raycasts.length, 20);
    assert.ok(raycasts.every(({ maximumHeight }) => maximumHeight === 0.32));
    assert.ok(placement.state.left.appliedLift > 0);
    assert.ok(placement.state.left.minimumClearance >= 0);
    assert.ok(placement.state.left.tiltDegrees > 29.9);
    assert.ok(placement.state.left.tiltDegrees <= 30);
    assert.equal(placement.grassContacts.length, 2);
  });

  it("releases placement state when physics reports no surface", () => {
    const placement = new HeroFootPlacement({
      pc,
      surfaceAt: () => null,
      getHeroPosition: () => new pc.Vec3(0, 0, 0),
      left: createFoot("left"),
      right: createFoot("right"),
    });

    placement.update(1 / 60, true);

    assert.deepEqual(placement.state.left, {
      appliedLift: 0,
      minimumClearance: null,
      tiltDegrees: 0,
    });
    assert.deepEqual(placement.grassContacts, []);
  });

  it("moves the whole hero with an island without changing the stance on flat ground", () => {
    const left = createFoot("left", false);
    const right = createFoot("right", false);
    const visualRoot = new pc.Entity("Hero island visuals");
    const head = new pc.Entity("Hero head");
    head.setLocalPosition(0, 1.4, 0);
    visualRoot.addChild(head);
    visualRoot.addChild(left.leg);
    visualRoot.addChild(right.leg);
    let visualOffset = 0;
    const placement = new HeroFootPlacement({
      pc,
      surfaceAt: (x, z) => ({
        height: 0,
        normal: new pc.Vec3(0, 1, 0),
        point: new pc.Vec3(x, 0, z),
      }),
      getHeroPosition: () => new pc.Vec3(0, 0, 0),
      visualOffsetAt: () => visualOffset,
      left,
      right,
    });

    placement.update(1, true);
    const baseline = left.sole.getPosition().y;
    const headBaseline = head.getPosition().y;
    const lift = placement.state.left.appliedLift;
    const clearance = placement.state.left.minimumClearance;
    for (const offset of [0.065, -0.045, 0, 0.065]) {
      visualOffset = offset;
      visualRoot.setLocalPosition(0, offset, 0);
      placement.update(1, true, offset);
      assert.ok(Math.abs(left.sole.getPosition().y - baseline - offset) < 0.001);
      assert.ok(Math.abs(right.sole.getPosition().y - baseline - offset) < 0.001);
      assert.ok(Math.abs(head.getPosition().y - headBaseline - offset) < 0.001);
      assert.ok(Math.abs(placement.state.left.appliedLift - lift) < 0.00001);
      assert.ok(Math.abs(placement.state.left.minimumClearance - clearance) < 0.00001);
      assert.equal(placement.state.left.tiltDegrees, 0);
    }
    placement.update(1, false, visualOffset);
    assert.ok(Math.abs(left.sole.getPosition().y - visualOffset) < 0.001);
    assert.ok(Math.abs(head.getPosition().y - headBaseline - visualOffset) < 0.001);
  });
});
