import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { EnemyPathLane } from "../../../../src/game/navigation/EnemyPathLane.js";

/**
 * @param {string} id
 * @param {boolean} vertical
 */
function fixture(id, vertical = false) {
  return {
    pc,
    definition: { id },
    radius: 0.3,
    traversalCapability: "walking",
    position: new pc.Vec3(0, 0, 0),
    runtime: {
      mapData: {
        cols: 1,
        rows: 1,
        paths: [{
          route: vertical
            ? [{
              col: 0,
              row: -2,
              elevation: 0,
            }, {
              col: 0,
              row: 2,
              elevation: 0,
            }]
            : [{
              col: -2,
              row: 0,
              elevation: 0,
            }, {
              col: 2,
              row: 0,
              elevation: 0,
            }],
        }],
      },
    },
  };
}

it("assigns both sides and keeps the same lane when travel reverses", () => {
  for (const vertical of [false, true]) {
    const offsets = [];
    for (const id of ["enemy-a", "enemy-b"]) {
      const owner = fixture(id, vertical);
      const lane = new EnemyPathLane(owner);
      const forward = lane.next(new pc.Vec3(vertical ? 0 : 5, 0, vertical ? 5 : 0));
      const reverse = lane.next(new pc.Vec3(vertical ? 0 : -5, 0, vertical ? -5 : 0));
      offsets.push(vertical ? forward.x : forward.z);
      assert.equal(vertical ? forward.x : forward.z, vertical ? reverse.x : reverse.z);
      assert.ok(Math.abs(vertical ? forward.x : forward.z) + owner.radius <= 1);
    }
    assert.deepEqual(offsets.sort(), [-0.5, 0.5]);
  }
});

it("preserves close targets, large bodies, flight, and off-path movement", () => {
  const owner = fixture("enemy-a");
  const lane = new EnemyPathLane(owner);
  const close = new pc.Vec3(0.4, 0, 0);
  const distant = new pc.Vec3(5, 0, 0);
  assert.equal(lane.next(close), close);
  owner.radius = 0.6;
  assert.equal(lane.next(distant), distant);
  owner.radius = 0.3;
  owner.traversalCapability = "flying";
  assert.equal(lane.next(distant), distant);
  owner.traversalCapability = "walking";
  owner.position.z = 3;
  assert.equal(lane.next(distant), distant);
});

it("offsets route arrival cursors through a right-angle turn", () => {
  const owner = fixture("enemy-a");
  const lane = new EnemyPathLane(owner);
  const route = [
    {
      col: -2,
      row: 0,
      elevation: 0,
    },
    {
      col: 0,
      row: 0,
      elevation: 0,
    },
    {
      col: 0,
      row: 2,
      elevation: 0,
    },
  ];
  const corner = lane.routePoint(route, 1);
  assert.equal(corner.x, -lane.side * 0.5);
  assert.equal(corner.z, lane.side * 0.5);
  assert.equal(lane.routePoint(route, 0).z, lane.side * 0.5);
  assert.equal(lane.routePoint(route, 2).x, -lane.side * 0.5);
});

it("continues past short centerline segments without stopping at each joint", () => {
  const owner = fixture("enemy-a");
  owner.runtime.mapData.paths[0].route = Array.from({ length: 9 }, (_, index) => ({
    col: index * 0.5 - 2,
    row: 0,
    elevation: 0,
  }));
  const lane = new EnemyPathLane(owner);
  owner.position.z = lane.side * 0.5;
  for (let step = 0; step < 100; step++) {
    const point = lane.next(new pc.Vec3(5, 0, 0));
    assert.equal(point.z, lane.side * 0.5);
    const direction = point.clone().sub(owner.position).normalize();
    owner.position.add(direction.mulScalar(0.01));
  }
  assert.ok(owner.position.x > 0.99);
});
