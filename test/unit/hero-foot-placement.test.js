import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as pc from "playcanvas";
import { HeroFootPlacement } from "../../src/game/objects/hero/HeroFootPlacement.js";

function createFoot(side) {
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
  return { side, leg, sole, cuff, tiltingParts: [sole] };
}

describe("hero foot placement physics contacts", () => {
  it("lifts and tilts boots from physics raycast hits", () => {
    const raycasts = [];
    const placement = new HeroFootPlacement({
      pc,
      surfaceAt: (x, z, maximumHeight) => {
        raycasts.push({ x, z, maximumHeight });
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
});
