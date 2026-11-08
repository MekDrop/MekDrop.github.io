import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { EnemyPathLane } from "../../../../src/game/navigation/EnemyPathLane.js";

it("changes lanes around a peer, waits with both lanes occupied, and resumes when clear", () => {
  for (const vertical of [false, true]) {
    const owner = fixture("enemy-a", vertical);
    const lane = new EnemyPathLane(owner);
    const side = lane.side;
    owner.position.set(vertical ? -side * 0.5 : 0, 0, vertical ? 0 : side * 0.5);
    const blocker = {
      isEnemy: true,
      alive: true,
      radius: 0.3,
      position: owner.position.clone().add(new pc.Vec3(vertical ? 0 : 0.9, 0, vertical ? 0.9 : 0)),
    };
    owner.actors = [blocker];
    const goal = new pc.Vec3(vertical ? 0 : 5, 0, vertical ? 5 : 0);
    const crossing = lane.next(goal);
    assert.equal(lane.side, -side);
    assert.equal(vertical ? crossing.x : crossing.z, - (vertical ? owner.position.x : owner.position.z));
    lane.side = side;
    owner.actors.push({
      ...blocker,
      position: new pc.Vec3(vertical ? side * 0.5 : 0, 0, vertical ? 0 : -side * 0.5),
    });
    assert.deepEqual(lane.next(goal), owner.position);
    assert.equal(lane.side, side);
    owner.actors = [];
    assert.notDeepEqual(lane.next(goal), owner.position);
  }
});

it("waits when a wall blocks the lane change and ignores dead or airborne peers", () => {
  const owner = fixture("enemy-a");
  const lane = new EnemyPathLane(owner);
  owner.position.z = lane.side * 0.5;
  const blocker = {
    isEnemy: true,
    alive: true,
    radius: 0.3,
    position: new pc.Vec3(0.9, 0, owner.position.z),
  };
  owner.actors = [blocker];
  owner.app = {
    systems: {
      rigidbody: {
        raycastAll: () => [{
          entity: { rigidbody: { type: "static" } },
          normal: new pc.Vec3(1, 0, 0),
        }],
      },
    },
  };
  const goal = new pc.Vec3(5, 0, 0);
  assert.deepEqual(lane.next(goal), owner.position);
  delete owner.app;
  blocker.alive = false;
  assert.notDeepEqual(lane.next(goal), owner.position);
  blocker.alive = true;
  blocker.airborne = true;
  assert.notDeepEqual(lane.next(goal), owner.position);
});

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

it("uses the stair center and carries its elevation onto the final landing", () => {
  for (const id of ["enemy-a", "enemy-b"]) {
    const owner = fixture(id);
    owner.doorOwners = [{
      capsuleSupportHeightAt: (x, z) => x <= 1.5 && z === 0 ? 0.5 : null,
    }];
    const lane = new EnemyPathLane(owner);
    const route = [{
      col: 1.5,
      row: 0,
      elevation: 0,
    }, {
      col: 2,
      row: 0,
      elevation: 0,
    }, {
      col: 2.5,
      row: 0,
      elevation: 0,
    }, {
      col: 3,
      row: 0,
      elevation: 0,
    }];
    assert.deepEqual(lane.routePoint(route, 0), new pc.Vec3(1.5, 0.5, 0));
    assert.deepEqual(lane.routePoint(route, 1), new pc.Vec3(2, 0.5, 0));
    assert.deepEqual(lane.routePoint(route, 2), new pc.Vec3(2.5, 0.5, 0));
    assert.deepEqual(lane.routePoint(route, 3), new pc.Vec3(3, 0.5, 0));
    const steering = lane.next(new pc.Vec3(5, 0.5, 0));
    assert.equal(steering.z, 0);
    assert.equal(steering.y, 0.5);
    owner.position.y = 0.5;
    owner.actors = [{
      isEnemy: true,
      alive: true,
      radius: 0.3,
      position: new pc.Vec3(0.9, 0.5, 0),
    }];
    assert.deepEqual(lane.next(new pc.Vec3(5, 0.5, 0)), owner.position,
      "a blocked stair center waits instead of crossing a full lane off the tread");
  }
});

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

it("allows separation from existing contact but refuses to move deeper into it", () => {
  const owner = fixture("enemy-a");
  const lane = new EnemyPathLane(owner);
  owner.position.z = lane.side * 0.5;
  const peer = {
    isEnemy: true,
    alive: true,
    radius: 0.42,
    position: new pc.Vec3(-0.6, 0, owner.position.z),
  };
  owner.actors = [peer];
  const escaping = lane.next(new pc.Vec3(5, 0, owner.position.z));
  assert.ok(escaping.x > owner.position.x, "contact does not permanently pin the pair");
  peer.position.x = 0.6;
  const toward = lane.next(new pc.Vec3(5, 0, owner.position.z));
  assert.ok(toward.x <= owner.position.x, "the blocked forward sweep is not allowed");
});

it("waits for a yielding slug when the other lane is occupied", () => {
  const owner = fixture("bell-bug");
  owner.isBellBug = true;
  const lane = new EnemyPathLane(owner);
  const side = lane.side;
  owner.position.z = side * 0.5;
  owner.actors = [{
    isEnemy: true,
    alive: true,
    radius: 0.42,
    position: new pc.Vec3(0.7, 0, owner.position.z),
    yieldsTo: actor => actor.isBellBug,
  }, {
    isEnemy: true,
    alive: true,
    radius: 0.42,
    position: new pc.Vec3(0, 0, -owner.position.z),
  }];
  const goal = new pc.Vec3(5, 0, owner.position.z);
  for (let frame = 0; frame < 60; frame++) {
    const next = lane.next(goal);
    assert.equal(lane.side, side);
    assert.equal(next.z, owner.position.z);
    assert.deepEqual(next, owner.position);
  }
  owner.actors[0].position.x = 2;
  assert.ok(lane.next(goal).x > owner.position.x);
});
