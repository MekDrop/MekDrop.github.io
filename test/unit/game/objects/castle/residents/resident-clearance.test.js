import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { ResidentClearance } from "../../../../../../src/game/objects/castle/residents/ResidentClearance.js";
import { CastleResidentMotion } from "../../../../../../src/game/objects/castle/residents/CastleResidentMotion.js";
import { Entity } from "playcanvas";

it("supports a doorway seam while rejecting real edges, holes, and floor-height gaps", () => {
  const first = {
    minX: -2,
    maxX: 0,
    minZ: -1,
    maxZ: 1,
    floorY: 0,
  };
  const second = {
    ...first,
    minX: 0,
    maxX: 2,
  };
  const layout = {
    walkableAreas: [first, second],
    rooms: {},
    toLocal: (x, z) => ({
      x,
      z,
    }),
  };
  assert.equal(ResidentClearance.isSupported(layout, new Vec3(0, 0, 0)), true);
  assert.equal(ResidentClearance.isSupported(layout, new Vec3(-0.05, 0, 0)), true);
  assert.equal(ResidentClearance.isSupported(layout, new Vec3(1.9, 0, 0)), false);
  assert.equal(ResidentClearance.isSupported({
    ...layout,
    walkableAreas: [{
      ...first,
      maxX: -0.05,
    }, {
      ...second,
      minX: 0.05,
    }],
  }, new Vec3(0, 0, 0)), false);
  assert.equal(ResidentClearance.isSupported({
    ...layout,
    walkableAreas: [first, {
      ...second,
      floorY: 2,
    }],
  }, new Vec3(0, 0, 0)), false);
});

it("keeps a walking coat clear when the old foot capsule would miss a wall", () => {
  const wall = {
    x: 0,
    y: 1.5,
    z: 0,
    halfX: 0.125,
    halfY: 1.5,
    halfZ: 3,
  };
  assert.equal(ResidentClearance.blockedByWalls([wall], new Vec3(0.5, 0, 0)), true);
  assert.equal(ResidentClearance.blockedByWalls([wall], new Vec3(0.7, 0, 0)), false);
  assert.equal(ResidentClearance.blockedByWalls([wall], new Vec3(0.7, 0, 3.6)), false);
});

it("retains stair support, overhead clearance, and the narrow low-rail footprint", () => {
  const block = {
    x: 0,
    y: 0.5,
    z: 0,
    halfX: 0.125,
    halfY: 0.5,
    halfZ: 3,
  };
  assert.equal(ResidentClearance.blockedByWalls([block], new Vec3(0.5, 0, 0)), false);
  assert.equal(ResidentClearance.blockedByWalls([block], new Vec3(0.3, 0, 0)), true);
  assert.equal(ResidentClearance.blockedByWalls([block], new Vec3(0, 1, 0)), false);
  assert.equal(ResidentClearance.blockedByWalls([block], new Vec3(0, -2, 0)), false);
  const upperFloor = {
    ...block,
    y: 1.4,
    halfY: 0.125,
  };
  assert.equal(ResidentClearance.blockedByWalls([upperFloor], new Vec3(0.5, 0, 0)), false);
});

it("waits rather than walking into a destination without room for the coat", () => {
  const wall = {
    x: 0,
    y: 1.5,
    z: 2,
    halfX: 0.125,
    halfY: 1.5,
    halfZ: 4,
  };
  const entity = new Entity();
  const start = new Vec3(2, 0, 2);
  entity.setPosition(start);
  const motion = new CastleResidentMotion({
    actor: {
      entity,
      pose: () => {},
    },
    layout: {
      origin: { y: 0 },
      walkableAreas: [{
        minX: 0,
        maxX: 4,
        minZ: 0,
        maxZ: 4,
        floorY: 0,
      }],
      authoredStairs: [],
      stairs: null,
      toLocal: (x, z) => ({
        x,
        z,
      }),
      toWorld: (x, z, y) => ({
        x,
        y,
        z,
      }),
    },
    blocked: point => ResidentClearance.blockedByWalls([wall], point),
    clear: () => true,
  });
  motion.moveTo(new Vec3(0.4, 0, 2));
  for (let frame = 0; frame < 10; frame++) {
    motion.update(0.1);
    assert.ok(entity.getPosition().equals(start));
  }
  assert.equal(motion.arrived, false);
});
